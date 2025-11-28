// / @ts-check
/// <reference path="../node_modules/@types/p5/global.d.ts" />

import { createHalfAdder } from "./examples/half-adder.js";
import { CircuitShape } from "./visuals/circuit-shape.js";
import { OutputShape } from "./visuals/output-shape.js";
import { InputShape } from "./visuals/input-shape.js";
import { ComponentInput } from "./visuals/component-input.js";
import { ComponentOutput } from "./visuals/component-output.js";
import { Wire } from "./visuals/wire.js";
import { Viewport } from "./visuals/viewport.js";
import { State } from "./visuals/state.js";

let font;
const viewport = new Viewport();
const state = new State();

let selectedElement = null;

function preload() {
	font = loadFont("/fonts/ttf/JetBrainsMono-SemiBold.ttf");
}

function setup() {
	textFont(font);
	createCanvas(500, 500);
	rectMode(CENTER);

	// -- Setup Scene --
	viewport.zoomLevel = 0.7;
	viewport.offsetX = 20;
	viewport.offsetY = 50;

	// Add Components
	const halfAdder1 = createHalfAdder();
	const halfAdder2 = createHalfAdder();

	state.shapes.push(new CircuitShape(150, 250, 200, halfAdder1));
	state.shapes.push(new CircuitShape(450, 250, 200, halfAdder2));

	state.shapes.push(new ComponentInput(50, 100));
	state.shapes.push(new ComponentInput(50, 180));
	state.shapes.push(new ComponentInput(50, 320));
	state.shapes.push(new ComponentInput(50, 400));
	state.shapes.push(new ComponentOutput(600, 150));
	state.shapes.push(new ComponentOutput(600, 350));
}

function stepSimulation() {
	for (let wire of state.wires) {
		wire.propagate();
	}
	for (let shape of state.shapes) {
		if (shape instanceof CircuitShape) {
			shape.updateOutputs();
		}
	}
}

function draw() {
	background(255);

	push();
	translate(viewport.offsetX, viewport.offsetY);
	scale(viewport.zoomLevel);
	viewport.drawGrid();
	pop();

	// Reset Logic
	for (const shape of state.shapes) {
		if (shape instanceof CircuitShape) {
			shape.inputShapes.forEach((input) => (input.isDriven = false));
		} else if (shape instanceof InputShape) {
			shape.isDriven = false;
		}
	}

	for (const wire of state.wires) {
		if (wire.endConnectedShape && wire.endConnectedShape instanceof InputShape) {
			wire.endConnectedShape.isDriven = true;
		}
	}

	// Draw Shapes
	for (let i = state.shapes.length - 1; i >= 0; i--) {
		let shape = state.shapes[i];
		shape.updatePosition(viewport.offsetX, viewport.offsetY, viewport.zoomLevel, viewport.gridSpacing);

		if (shape instanceof CircuitShape) {
			shape.updateInputLocations(viewport.gridSpacing);
			shape.updateOutputLocations(viewport.gridSpacing);
			shape.updateChildPositions(viewport.offsetX, viewport.offsetY, viewport.zoomLevel, viewport.gridSpacing);
		}

		shape.drawSelection();
		shape.draw(font);
	}

	// Draw Wires
	for (let wire of state.wires) {
		wire.updatePosition(viewport.offsetX, viewport.offsetY, viewport.zoomLevel, viewport.gridSpacing, state.shapes);
		wire.draw(viewport.zoomLevel, viewport.offsetX, viewport.offsetY);
	}

	// Wire Preview & Creation Logic
	let snapTarget = null;
	let mouseWorld = {
		x: (mouseX - viewport.offsetX) / viewport.zoomLevel,
		y: (mouseY - viewport.offsetY) / viewport.zoomLevel
	};

	if (state.creatingWire || state.potentialWireTarget) {
		snapTarget = Wire.findSnapTarget(mouseWorld.x, mouseWorld.y, state.shapes);
		if (snapTarget) {
			push();
			noFill();
			stroke(255, 200, 0, 150);
			strokeWeight(3);
			let sx = snapTarget.worldX * viewport.zoomLevel + viewport.offsetX;
			let sy = snapTarget.worldY * viewport.zoomLevel + viewport.offsetY;
			let sSize = snapTarget.size * viewport.zoomLevel;
			if (snapTarget instanceof ComponentInput || snapTarget instanceof ComponentOutput) {
				rectMode(CENTER);
				rect(sx, sy, sSize * 1.2, sSize * 1.2, 5);
			} else {
				ellipse(sx, sy, sSize * 1.5);
			}
			pop();
		}
	}

	if (state.creatingWire && state.wirePreview) {
		if (snapTarget) {
			state.wirePreview.endX = snapTarget.worldX;
			state.wirePreview.endY = snapTarget.worldY;
			state.wirePreview.endConnectedShape = snapTarget;
		} else {
			state.wirePreview.endX = round(mouseWorld.x / viewport.gridSpacing) * viewport.gridSpacing;
			state.wirePreview.endY = round(mouseWorld.y / viewport.gridSpacing) * viewport.gridSpacing;
			state.wirePreview.endConnectedShape = null;
		}

		// --- LATCH & RESET LOGIC ---
		const dx = Math.abs(state.wirePreview.endX - state.wirePreview.startX);
		const dy = Math.abs(state.wirePreview.endY - state.wirePreview.startY);
		const LATCH_THRESHOLD = 20; // Pixels to move before locking

		// 1. Reset: If user goes back to start, unlock orientation
		if (dx < LATCH_THRESHOLD && dy < LATCH_THRESHOLD) {
			state.wirePreview.orientationLocked = false;
		}

		// 2. Latch: If unlocked, set direction based on first significant movement
		if (!state.wirePreview.orientationLocked) {
			if (dx > LATCH_THRESHOLD) {
				state.wirePreview.horizontalFirst = true; // Horizontal move dominated
				state.wirePreview.orientationLocked = true;
			} else if (dy > LATCH_THRESHOLD) {
				state.wirePreview.horizontalFirst = false; // Vertical move dominated
				state.wirePreview.orientationLocked = true;
			} else {
				// While within deadzone, just default to basic logic
				state.wirePreview.horizontalFirst = dx >= dy;
			}
		}

		state.wirePreview.draw(viewport.zoomLevel, viewport.offsetX, viewport.offsetY);
	}

	fill(0);
	textSize(16);
	textAlign(LEFT, TOP);
	if (state.shapes.length > 0 && state.shapes[0].gate) {
		text(`EDGE: ${state.shapes[0].gate.getEdgeTrigger()}`, 10, height - 50);
	}
	text(`Zoom: ${floor(viewport.zoomLevel * 100)}% | [Space] Step | [W] Wire | Dbl-Click to Select`, 10, height - 30);
}

function mousePressed() {
	state.mouseIsReleased = false;
	state.potentialDragTarget = null;
	state.potentialWireTarget = null;
	state.pressLocation = { x: mouseX, y: mouseY };

	// Note: We do NOT select here. Only Deselect if clicking empty space.
	// However, if we click empty space, we should verify we aren't dragging something.
	// For now, let's leave selection persistence until double click or explicit deselect.
	// To strictly follow "Highlight ONLY on double clicks", we deselect on single click background.

	let hitSomething = false;

	// Check Wire Hit (for dragging, not selection)
	for (let i = state.wires.length - 1; i >= 0; i--) {
		let wire = state.wires[i];
		if (
			wire.isMouseOverStart(viewport.zoomLevel, viewport.offsetX, viewport.offsetY) ||
			wire.isMouseOverEnd(viewport.zoomLevel, viewport.offsetX, viewport.offsetY)
		) {
			hitSomething = true;
		}
	}
	// Check Shape Hit
	if (!hitSomething) {
		for (const shape of state.shapes) {
			if (shape.isMouseOver()) {
				hitSomething = true;
				break;
			}
			if (shape instanceof CircuitShape) {
				if (shape.inputShapes.some((s) => s.isMouseOver()) || shape.outputShapes.some((s) => s.isMouseOver())) {
					hitSomething = true;
					break;
				}
			}
		}
	}

	if (!hitSomething && !state.creatingWire) {
		// Single click on background deselects
		if (selectedElement) {
			selectedElement.isSelected = false;
			selectedElement = null;
		}
	}

	// ... [Rest of mousePressed logic for Dragging/Creation] ...
	let itemSelected = false;

	if (state.creatingWire && state.wirePreview) {
		const permanentWire = new Wire(
			state.wirePreview.startX,
			state.wirePreview.startY,
			state.wirePreview.endX,
			state.wirePreview.endY
		);

		permanentWire.startConnectedShape = state.wirePreview.startConnectedShape;
		permanentWire.endConnectedShape = state.wirePreview.endConnectedShape;
		permanentWire.horizontalFirst = state.wirePreview.horizontalFirst;
		permanentWire.orientationLocked = state.wirePreview.orientationLocked;

		state.wires.push(permanentWire);
		state.creatingWire = false;
		state.wirePreview = null;
		itemSelected = true;
	}

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
		for (const shape of state.shapes) {
			if (shape instanceof CircuitShape) {
				for (const input of shape.inputShapes) {
					if (input.isMouseOver()) {
						state.potentialDragTarget = input;
						itemSelected = true;
						break;
					}
				}
				if (itemSelected) break;
				for (const output of shape.outputShapes) {
					if (output.isMouseOver()) {
						state.potentialDragTarget = output;
						itemSelected = true;
						break;
					}
				}
			}
			if (itemSelected) break;
			if (shape.isMouseOver()) {
				state.potentialDragTarget = shape;
				itemSelected = true;
				state.bringToFront(shape);
				break;
			}
		}

		if (!itemSelected && !state.creatingWire) {
			viewport.startGridPan();
		}
	}
}

function doubleClicked() {
	// 1. Deselect previous
	if (selectedElement) {
		selectedElement.isSelected = false;
		selectedElement = null;
	}

	let hit = false;

	// 2. Check Wires
	for (let wire of state.wires) {
		if (wire.isMouseOverLine(viewport.zoomLevel, viewport.offsetX, viewport.offsetY)) {
			selectedElement = wire;
			wire.isSelected = true;
			hit = true;
			break;
		}
	}

	// 3. Check Shapes
	if (!hit) {
		for (const shape of state.shapes) {
			if (shape.isMouseOver()) {
				selectedElement = shape;
				shape.isSelected = true;
				hit = true;
				break;
			}
		}
	}
}

function mouseDragged() {
	if (viewport.draggingGrid) {
		viewport.updateGridPan();
	} else if (state.potentialWireTarget) {
		state.potentialWireTarget.updatePosition(
			viewport.offsetX,
			viewport.offsetY,
			viewport.zoomLevel,
			viewport.gridSpacing,
			state.shapes
		);
	} else if (state.potentialDragTarget && !state.potentialDragTarget.dragging) {
		const distSq = (mouseX - state.pressLocation.x) ** 2 + (mouseY - state.pressLocation.y) ** 2;
		if (distSq > 25) {
			state.potentialDragTarget.startDrag(viewport.offsetX, viewport.offsetY, viewport.zoomLevel);
		}
	}
}

function mouseReleased() {
	state.mouseIsReleased = true;
	if (state.potentialDragTarget && !state.potentialDragTarget.dragging) {
		if (state.potentialDragTarget instanceof InputShape) {
			if (!state.potentialDragTarget.isDriven) {
				state.potentialDragTarget.value = 1 - state.potentialDragTarget.value;
			}
		} else if (state.potentialDragTarget instanceof ComponentInput) {
			state.potentialDragTarget.toggle();
		}
	}

	for (const shape of state.shapes) {
		if (shape.dragging) shape.endDrag();
		if (shape instanceof CircuitShape) {
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
		let worldX = (mouseX - viewport.offsetX) / viewport.zoomLevel;
		let worldY = (mouseY - viewport.offsetY) / viewport.zoomLevel;

		const snap = Wire.findSnapTarget(worldX, worldY, state.shapes);

		let startX, startY;
		let startConn = null;

		if (snap) {
			startX = snap.worldX;
			startY = snap.worldY;
			startConn = snap;
		} else {
			startX = round(worldX / viewport.gridSpacing) * viewport.gridSpacing;
			startY = round(worldY / viewport.gridSpacing) * viewport.gridSpacing;
		}

		state.wirePreview = new Wire(startX, startY, startX, startY);
		state.wirePreview.startConnectedShape = startConn;
		state.wirePreview.endConnectedShape = startConn;
	}

	if (key === "Delete" || key === "Backspace") {
		if (selectedElement) {
			if (selectedElement instanceof Wire) {
				const index = state.wires.indexOf(selectedElement);
				if (index > -1) state.wires.splice(index, 1);
			} else {
				const index = state.shapes.indexOf(selectedElement);
				if (index > -1) {
					// Cleanup wires connected to deleted shape
					for (let i = state.wires.length - 1; i >= 0; i--) {
						let w = state.wires[i];
						let connectedToShape = false;

						if (w.startConnectedShape === selectedElement || w.endConnectedShape === selectedElement)
							connectedToShape = true;

						if (selectedElement instanceof CircuitShape) {
							if (
								selectedElement.inputShapes.includes(w.startConnectedShape) ||
								selectedElement.inputShapes.includes(w.endConnectedShape)
							)
								connectedToShape = true;
							if (
								selectedElement.outputShapes.includes(w.startConnectedShape) ||
								selectedElement.outputShapes.includes(w.endConnectedShape)
							)
								connectedToShape = true;
						}

						if (connectedToShape) state.wires.splice(i, 1);
					}
					state.shapes.splice(index, 1);
				}
			}
			selectedElement = null;
		}
	}

	if (key === "Escape") {
		if (state.creatingWire) {
			state.creatingWire = false;
			state.wirePreview = null;
		}
	}

	if (key === " ") {
		stepSimulation();
	}

	if (key === "ArrowUp") {
		if (state.shapes.length > 0 && state.shapes[0].gate) state.shapes[0].gate.setClock(1);
	}
	if (key === "ArrowDown") {
		if (state.shapes.length > 0 && state.shapes[0].gate) state.shapes[0].gate.setClock(0);
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
window.doubleClicked = doubleClicked;
