// / @ts-check
/// <reference path="../node_modules/@types/p5/global.d.ts" />

import { createFullAdder } from "./examples/full-adder.js";
import { CircuitShape } from "./visuals/circuit-shape.js";
import { OutputShape } from "./visuals/output-shape.js";
import { InputShape } from "./visuals/input-shape.js";
import { Wire } from "./visuals/wire.js";
import { Viewport } from "./visuals/viewport.js";
import { State } from "./visuals/state.js";

let font;
const viewport = new Viewport();
const state = new State();

function preload() {
	font = loadFont("/fonts/ttf/JetBrainsMono-SemiBold.ttf");
}

function setup() {
	textFont(font);
	createCanvas(500, 500);
	rectMode(CENTER);

	const full_adder = createFullAdder();
	console.log(full_adder.toString());
	state.shapes.push(new CircuitShape(width / 2, height / 2, 200, full_adder));
}

function draw() {
	background(255);

	push();
	translate(viewport.offsetX, viewport.offsetY);
	scale(viewport.zoomLevel);
	viewport.drawGrid();
	pop();

	// Update and draw shapes
	for (let i = state.shapes.length - 1; i >= 0; i--) {
		let shape = state.shapes[i];
		shape.updatePosition(viewport.offsetX, viewport.offsetY, viewport.zoomLevel, viewport.gridSpacing);

		if (shape instanceof CircuitShape) {
			shape.updateInputLocations();
			shape.updateOutputLocations();
			shape.updateChildPositions(viewport.offsetX, viewport.offsetY, viewport.zoomLevel, viewport.gridSpacing);
		}
		shape.draw(font);
	}

	// Update and draw wires
	for (let wire of state.wires) {
		wire.updatePosition(viewport.offsetX, viewport.offsetY, viewport.zoomLevel, viewport.gridSpacing);
		wire.draw(viewport.zoomLevel, viewport.offsetX, viewport.offsetY);
	}

	// Draw wire preview during creation
	if (state.creatingWire && state.wirePreview) {
		let worldX = round((mouseX - viewport.offsetX) / viewport.zoomLevel / viewport.gridSpacing) * viewport.gridSpacing;
		let worldY = round((mouseY - viewport.offsetY) / viewport.zoomLevel / viewport.gridSpacing) * viewport.gridSpacing;
		state.wirePreview.endX = worldX;
		state.wirePreview.endY = worldY;
		state.wirePreview.draw(viewport.zoomLevel, viewport.offsetX, viewport.offsetY);
	}

	// UI text
	fill(0);
	textSize(16);
	textAlign(LEFT, TOP);
	if (state.shapes.length > 0) {
		text(`EDGE: ${state.shapes[0].gate.getEdgeTrigger()}`, 10, height - 50);
	}
	text(`Zoom: ${floor(viewport.zoomLevel * 100)}% Press 'W' to create wire`, 10, height - 30);
}

function mousePressed() {
	state.mouseIsReleased = false;
	state.potentialDragTarget = null;
	state.potentialWireTarget = null;
	state.pressLocation = { x: mouseX, y: mouseY };

	let itemSelected = false;

	// Finalize wire creation on click
	if (state.creatingWire && state.wirePreview) {
		const permanentWire = new Wire(state.wirePreview.startX, state.wirePreview.startY, state.wirePreview.endX, state.wirePreview.endY);
		state.wires.push(permanentWire);
		state.creatingWire = false;
		state.wirePreview = null;
		itemSelected = true;
	}

	// Check wires for dragging
	if (!state.creatingWire) {
		for (let i = state.wires.length - 1; i >= 0; i--) {
			let wire = state.wires[i];
			if (wire.isMouseOverStart(viewport.zoomLevel, viewport.offsetX, viewport.offsetY)) {
				wire.startDrag(true);
				state.potentialWireTarget = wire;
				itemSelected = true;
				state.bringWireToFront(wire);
				break;
			} else if (wire.isMouseOverEnd(viewport.zoomLevel, viewport.offsetX, viewport.offsetY)) {
				wire.startDrag(false);
				state.potentialWireTarget = wire;
				itemSelected = true;
				state.bringWireToFront(wire);
				break;
			}
		}
	}

	if (!itemSelected) {
		// Check input/output shapes and circuit bodies
		for (const parentShape of state.shapes) {
			if (parentShape instanceof CircuitShape) {
				for (const input of parentShape.inputShapes) {
					if (input.isMouseOver()) {
						state.potentialDragTarget = input;
						itemSelected = true;
						break;
					}
				}
				if (itemSelected) break;
				for (const output of parentShape.outputShapes) {
					if (output.isMouseOver()) {
						state.potentialDragTarget = output;
						itemSelected = true;
						break;
					}
				}
				if (itemSelected) break;
				if (parentShape.isMouseOver()) {
					state.potentialDragTarget = parentShape;
					itemSelected = true;
					state.bringToFront(parentShape);
					break;
				}
			}
		}
		if (!itemSelected && !state.creatingWire) {
			viewport.startGridPan();
		}
	}
}

function mouseDragged() {
	if (viewport.draggingGrid) {
		viewport.updateGridPan();
	} else if (state.potentialWireTarget) {
		state.potentialWireTarget.updatePosition(viewport.offsetX, viewport.offsetY, viewport.zoomLevel, viewport.gridSpacing);
	} else if (state.potentialDragTarget && !state.potentialDragTarget.dragging) {
		if (state.potentialDragTarget instanceof CircuitShape) {
			const distSq = (mouseX - state.pressLocation.x) ** 2 + (mouseY - state.pressLocation.y) ** 2;
			if (distSq > 25) {
				state.potentialDragTarget.startDrag(viewport.offsetX, viewport.offsetY, viewport.zoomLevel);
			}
		}
	}
	// Update wire preview during creation
	if (state.creatingWire && state.wirePreview) {
		let worldX = round((mouseX - viewport.offsetX) / viewport.zoomLevel / viewport.gridSpacing) * viewport.gridSpacing;
		let worldY = round((mouseY - viewport.offsetY) / viewport.zoomLevel / viewport.gridSpacing) * viewport.gridSpacing;
		state.wirePreview.endX = worldX;
		state.wirePreview.endY = worldY;
	}
}

function mouseReleased() {
	state.mouseIsReleased = true;
	if (state.potentialDragTarget && !state.potentialDragTarget.dragging) {
		if (state.potentialDragTarget instanceof InputShape) {
			state.potentialDragTarget.value = 1 - state.potentialDragTarget.value;
		}
	}
	for (const shape of state.shapes) {
		if (shape instanceof CircuitShape) {
			if (shape.dragging) shape.endDrag();
			for (const input of shape.inputShapes) {
				if (input.dragging) input.endDrag();
			}
			for (const output of shape.outputShapes) {
				if (output.dragging) output.endDrag();
			}
		}
	}
	if (state.potentialWireTarget) {
		state.potentialWireTarget.endDrag();
	}
	viewport.endGridPan();
	state.resetDragState();
}

function keyPressed() {
	if (key === "w" || key === "W") {
		state.creatingWire = true;
		let worldX = round((mouseX - viewport.offsetX) / viewport.zoomLevel / viewport.gridSpacing) * viewport.gridSpacing;
		let worldY = round((mouseY - viewport.offsetY) / viewport.zoomLevel / viewport.gridSpacing) * viewport.gridSpacing;
		state.wirePreview = new Wire(worldX, worldY, worldX, worldY);
	}
	if (key === " ") {
		if (state.shapes.length > 0) {
			state.shapes[0].updateOutputs();
		}
	}
	if (key === "ArrowUp") {
		if (state.shapes.length > 0) state.shapes[0].gate.setClock(1);
	}
	if (key === "ArrowDown") {
		if (state.shapes.length > 0) state.shapes[0].gate.setClock(0);
	}
}

function mouseWheel(event) {
	return viewport.handleZoom(event);
}

window.preload = preload;
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseDragged = mouseDragged;
window.mouseReleased = mouseReleased;
window.mouseWheel = mouseWheel;
window.keyPressed = keyPressed;