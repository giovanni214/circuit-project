// / @ts-check
/// <reference path="../node_modules/@types/p5/global.d.ts" />

// Global variables for grid & zoom
let offsetX = 0;
let offsetY = 0;
let zoomLevel = 1;
const gridSpacing = 50;

// Global variables for panning the grid
let draggingGrid = false;
let gridPanOffset = { x: 0, y: 0 };

//
// Abstract Shape Class
//
class Shape {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} size
	 */
	constructor(x, y, size) {
		this.worldX = x; // world coordinates
		this.worldY = y;
		this.size = size; // defined in world units

		this.screenSize = size * zoomLevel; //screen coordinates (used for rendering)
		this.screenX = x * zoomLevel + offsetX;
		this.screenY = y * zoomLevel + offsetY;
		this.dragging = false;
		this.offset = createVector(0, 0);
	}

	// Check if the mouse is over this shape (using rectMode(CENTER))
	isMouseOver() {
		let sx = this.screenX;
		let sy = this.screenY;
		let halfSize = (this.size * zoomLevel) / 2;
		return mouseX >= sx - halfSize && mouseX <= sx + halfSize && mouseY >= sy - halfSize && mouseY <= sy + halfSize;
	}

	// Call when dragging starts. Calculate offset from the shape's center.
	startDrag() {
		this.dragging = true;
		let worldMouse = createVector((mouseX - offsetX) / zoomLevel, (mouseY - offsetY) / zoomLevel);
		this.offset = createVector(this.worldX - worldMouse.x, this.worldY - worldMouse.y);
	}

	// Update position based on mouse (and snap to grid immediately)
	updatePosition() {
		if (this.dragging) {
			let worldMouse = createVector((mouseX - offsetX) / zoomLevel, (mouseY - offsetY) / zoomLevel);
			// @ts-ignore
			let newPos = p5.Vector.add(worldMouse, this.offset);
			// Snap to grid:
			newPos.x = round(newPos.x / gridSpacing) * gridSpacing;
			newPos.y = round(newPos.y / gridSpacing) * gridSpacing;
			this.worldX = newPos.x;
			this.worldY = newPos.y;
		}

		this.screenX = this.worldX * zoomLevel + offsetX;
		this.screenY = this.worldY * zoomLevel + offsetY;
		this.screenSize = this.size * zoomLevel;
	}

	// End dragging.
	endDrag() {
		this.dragging = false;
	}

	// Draw the shape (abstract method)
	draw() {
		// To be implemented by subclasses.
	}

	/**
	 * Determines whether a point (px, py) is inside a rectangle.
	 * The rectangle is defined by its top-left corner (rx, ry) and its width/height (rw, rh).
	 *
	 * @param {number} px - Point x-coordinate.
	 * @param {number} py - Point y-coordinate.
	 * @param {number} rx - Rectangle x-coordinate (top-left).
	 * @param {number} ry - Rectangle y-coordinate (top-left).
	 * @param {number} rw - Rectangle width.
	 * @param {number} rh - Rectangle height.
	 * @returns {boolean} True if the point is inside the rectangle.
	 */
	static collidePointRect(px, py, rx, ry, rw, rh) {
		return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
	}

	/**
	 * Determines whether a point (px, py) is inside an ellipse.
	 * The ellipse is defined by its center (ex, ey) and its width and height (ew, eh).
	 * Uses the standard ellipse equation: (x - ex)^2/(ew/2)^2 + (y - ey)^2/(eh/2)^2 <= 1.
	 *
	 * @param {number} px - Point x-coordinate.
	 * @param {number} py - Point y-coordinate.
	 * @param {number} ex - Ellipse center x-coordinate.
	 * @param {number} ey - Ellipse center y-coordinate.
	 * @param {number} ew - Ellipse total width.
	 * @param {number} eh - Ellipse total height.
	 * @returns {boolean} True if the point is inside the ellipse.
	 */
	static collidePointEllipse(px, py, ex, ey, ew, eh) {
		let dx = px - ex;
		let dy = py - ey;
		let rx = ew / 2;
		let ry = eh / 2;
		return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
	}

	/**
	 * Determines whether a point (px, py) is inside a circle.
	 * The circle is defined by its center (cx, cy) and its radius (r).
	 *
	 * @param {number} px - Point x-coordinate.
	 * @param {number} py - Point y-coordinate.
	 * @param {number} cx - Circle center x-coordinate.
	 * @param {number} cy - Circle center y-coordinate.
	 * @param {number} r - Circle radius.
	 * @returns {boolean} True if the point is inside the circle.
	 */
	static collidePointCircle(px, py, cx, cy, r) {
		let dx = px - cx;
		let dy = py - cy;
		return dx * dx + dy * dy <= r * r;
	}
}

class InputShape extends Shape {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} size
	 */
	constructor(x, y, size, value = 0) {
		super(x, y, size);
		this.allowedToToggle = true;
		this.value = value;
	}

	// Here we override isMouseOver() if needed:
	isMouseOver() {
		// Using circle collision on the input:
		return Shape.collidePointCircle(mouseX, mouseY, this.screenX, this.screenY, this.screenSize / 2);
	}

	draw() {
		// Draw the input (a circle)
		fill(this.isMouseOver() ? 200 : 100);
		ellipse(this.screenX, this.screenY, this.screenSize);

		// --- Text Rendering ---
		fill(0);
		textAlign(CENTER, BASELINE); // Align to baseline for precise vertical control
		textSize(floor(this.screenSize));
		textFont(font);
		// Manually calculate the vertical offset to perfectly center the text glyph.
		const yOffset = (textAscent() - textDescent()) / 2;
		text(this.value, this.screenX, this.screenY + yOffset);
	}
}

class OutputShape extends Shape {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} size
	 * @param {string} value
	 */
	constructor(x, y, size, value) {
		super(x, y, size);
		this.allowedToToggle = true;
		this.value = value;
	}

	draw() {
		fill(100);
		ellipse(this.screenX, this.screenY, this.screenSize);

		// --- Text Rendering ---
		fill(0);
		textAlign(CENTER, BASELINE); // Align to baseline for precise vertical control
		textSize(floor(this.screenSize));
		textFont(font);
		// Manually calculate the vertical offset to perfectly center the text glyph.
		const yOffset = (textAscent() - textDescent()) / 2;
		text(this.value, this.screenX, this.screenY + yOffset);
	}
}

class CircuitShape extends Shape {
	/**
	 * @param {number} x - World x-coordinate for the circuit's center.
	 * @param {number} y - World y-coordinate for the circuit's center.
	 * @param {number} size - World size (side length) of the circuit's square.
	 * @param {any} gate
	 */
	constructor(x, y, size, gate) {
		super(x, y, size);
		this.gate = gate;
		/**
		 * @type {{ worldY: number; }[]}
		 */
		this.inputShapes = [];
		/**
		 * @type {{ worldY: number; }[]}
		 */
		this.outputShapes = [];
	}

	// All calculations here use world units.
	updateInputLocations() {
		const numInputs = this.gate.inputLength;
		// The square is centered at (this.worldX, this.worldY) and has side length this.size.
		// Its left edge is at: leftEdge = this.worldX - (this.size / 2).
		// We want to place the input circles equidistantly along the left side.
		const spacingWorld = this.size / (numInputs + 1);

		// Define the input circle diameter in world units.
		const inputDiameterWorld = Math.min(this.size / 6, (this.size / numInputs) * 0.75);

		for (let i = 1; i <= numInputs; i++) {
			// Compute world y-position for the input circle's center.
			const cy = this.worldY - this.size / 2 + spacingWorld * i;
			// Compute world x-position: place the circle so its right edge touches the circuit's left edge.
			// The circuit's left edge is at (this.worldX - this.size/2) so we subtract half the input circle's diameter.
			const cx = this.worldX - this.size / 2 - inputDiameterWorld / 2;
			// Create an InputShape with these world coordinates and the determined diameter.
			if (this.inputShapes.length !== numInputs) this.inputShapes.push(new InputShape(cx, cy, inputDiameterWorld, 0));
			else {
				this.inputShapes[i - 1].worldX = cx;
				this.inputShapes[i - 1].worldY = cy;
			}
		}
	}

	updateOutputLocations() {
		// The square is centered at (this.worldX, this.worldY) and has side length this.size.
		// Its right edge is at: rightEdge = this.worldX + (this.size / 2).
		// We want to place the input circles equidistantly along the right side.
		const numOutputs = this.gate.outputLength;
		const spacingWorld = this.size / (numOutputs + 1);

		// Define the input circle diameter in world units.
		const outputDiameterWorld = Math.min(this.size / 6, (this.size / numOutputs) * 0.75);

		for (let i = 1; i <= numOutputs; i++) {
			// Compute world y-position for the input circle's center.
			const cy = this.worldY - this.size / 2 + spacingWorld * i;
			// Compute world x-position: place the circle so its left edge touches the circuit's right edge.
			// The circuit's right edge is at (this.worldX + this.size/2)

			// so we add half the input circle's diameter.
			const cx = this.worldX + this.size / 2 + outputDiameterWorld / 2;

			// Create an InputShape with these world coordinates and the determined diameter,
			// or update its position if already created.
			if (this.outputShapes.length !== numOutputs) {
				this.outputShapes.push(new OutputShape(cx, cy, outputDiameterWorld, "?"));
			} else {
				this.outputShapes[i - 1].worldX = cx;
				this.outputShapes[i - 1].worldY = cy;
			}
		}
	}

	updateOutputs() {
		const inputs = this.inputShapes.map((shape) => shape.value);
		const outputs = this.gate.tick(inputs);

		this.outputShapes.forEach((outputShape, i) => {
			outputShape.value = outputs[i];
		});
	}

	/**
	 * Draws the circuit shape and its input shapes.
	 */
	draw() {
		// Draw the main circuit square.
		fill(255, 0, 0);
		stroke(0);
		rect(this.screenX, this.screenY, this.screenSize, this.screenSize);

		fill(0);
		textAlign(CENTER, CENTER);
		textSize(floor(this.screenSize / 8));
		textWrap(CHAR);
		textFont(font);
		// Draw text centered in the box.
		text(`${this.gate.name}\nGate`, this.screenX, this.screenY);

		// Update and draw each input shape.
		for (let inputShape of this.inputShapes) {
			// It's important that each input shape updates its own screenX, screenY, and screenSize
			// based on its world coordinates, global offset, and zoomLevel.
			inputShape.draw();
		}

		for (let outputShape of this.outputShapes) {
			outputShape.draw();
		}
	}
}

//
// Global array to hold shapes
//
let shapes = [];

/**
 * @type {string | object}
 */
let font;

function preload() {
	font = loadFont("/fonts/ttf/JetBrainsMono-SemiBold.ttf");
}

function setup() {
	textFont(font);
	createCanvas(500, 500);

	rectMode(CENTER);
	// Create and add the D-Flip-Flop to the canvas
	const a = new InputNode(0);
	const b = new InputNode(1);

	const expr1 = new GateNode("OR", [a, b]);
	const expr2 = new GateNode("NOT", [new GateNode("AND", [a, b])]);
	const xor_output = new GateNode("AND", [expr1, expr2]);

	const XOR_Gate = new Circuit("XOR", [xor_output]);

	XOR_Gate.registerGate("OR", OR_FUNC);
	XOR_Gate.registerGate("NOT", NOT_FUNC);
	XOR_Gate.registerGate("AND", AND_FUNC);

  console.log(XOR_Gate.rootNodes[0].toString());
	shapes.push(new CircuitShape(width / 2, height / 2, 200, XOR_Gate));
}

function draw() {
	background(255);

	// Draw the grid in world coordinates.
	push();
	translate(offsetX, offsetY);
	scale(zoomLevel);
	drawGrid();
	pop();

	// Update and draw each shape.
	// Must be read backwards to allow first element to take Z priority
	for (let i = shapes.length - 1; i >= 0; i--) {
		let shape = shapes[i];
		// Always update screen positions based on world coordinates and current view (zoom/pan).
		shape.updatePosition();
		if (shape instanceof CircuitShape) {
			shape.updateInputLocations();
			shape.updateOutputLocations();
			for (const subShape of [...shape.inputShapes, ...shape.outputShapes]) {
				subShape.updatePosition();
			}
		}
		shape.draw();
	}

	// Optional: Display current offset and zoom for debugging.
	fill(0);
	textSize(16);
	textAlign(LEFT, TOP);
	if (shapes.length > 0) {
		text(`EDGE: ${shapes[0].gate.getEdgeTrigger()}`, 10, height - 50);
	}

	text(`Zoom: ${floor(zoomLevel * 100)}% Clock: ${shapes.length > 0 ? shapes[0].gate.clock : "N/A"}`, 10, height - 30);
}

// Draw grid lines (in world coordinates).
function drawGrid() {
	stroke(100);
	strokeWeight(1 / zoomLevel);

	let startX = -offsetX / zoomLevel;
	let startY = -offsetY / zoomLevel;
	let endX = (width - offsetX) / zoomLevel;
	let endY = (height - offsetY) / zoomLevel;

	let startGridX = floor(startX / gridSpacing) * gridSpacing;
	let startGridY = floor(startY / gridSpacing) * gridSpacing;

	// Vertical grid lines.
	for (let x = startGridX; x <= endX; x += gridSpacing) {
		line(x, startY, x, endY);
	}
	// Horizontal grid lines.
	for (let y = startGridY; y <= endY; y += gridSpacing) {
		line(startX, y, endX, y);
	}
}

let mouseIsReleased = true; // Legacy flag, can be useful
let potentialDragTarget = null; // The shape that might be dragged
let pressLocation = { x: 0, y: 0 }; // Where the mouse was initially pressed

// Mouse interaction for dragging shapes or panning the grid.
function mousePressed() {
	mouseIsReleased = false;
	potentialDragTarget = null;
	pressLocation = { x: mouseX, y: mouseY };

	let itemSelected = false;
	for (let i = 0; i < shapes.length; i++) {
		let parentShape = shapes[i];
		let shapeToDrag = null;

		// Check child input shapes first for CircuitShape
		if (parentShape instanceof CircuitShape) {
			for (const input of parentShape.inputShapes) {
				if (input.isMouseOver()) {
					shapeToDrag = input;
					break;
				}
			}
		}
		// If no input was clicked, check the main body
		if (!shapeToDrag && parentShape.isMouseOver()) {
			shapeToDrag = parentShape;
		}

		if (shapeToDrag) {
			itemSelected = true;
			potentialDragTarget = shapeToDrag;

			// If a CircuitShape was clicked, bring it to the front for rendering priority.
			const [movedShape] = shapes.splice(i, 1);
			shapes.unshift(movedShape);

			break;
		}
	}

	// If no shape is selected, start panning the grid.
	if (!itemSelected) {
		draggingGrid = true;
		gridPanOffset.x = mouseX - offsetX;
		gridPanOffset.y = mouseY - offsetY;
	}
}

function mouseDragged() {
	if (draggingGrid) {
		// Pan the grid
		offsetX = mouseX - gridPanOffset.x;
		offsetY = mouseY - gridPanOffset.y;
	} else if (potentialDragTarget && !potentialDragTarget.dragging) {
		// Check if the mouse has moved enough to be considered a drag
		const distSq = (mouseX - pressLocation.x) ** 2 + (mouseY - pressLocation.y) ** 2;
		if (distSq > 25) potentialDragTarget.startDrag(); // 5*5 pixels threshold
	}
}

function mouseReleased() {
	mouseIsReleased = true;

	if (potentialDragTarget && !potentialDragTarget.dragging) {
		// This was a click, not a drag.
		if (potentialDragTarget instanceof InputShape) {
			potentialDragTarget.value = 1 - potentialDragTarget.value; // Toggle 0 and 1
		}
	}

	// End any active drags
	for (const shape of shapes) {
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

	draggingGrid = false;
	potentialDragTarget = null;
}

function keyPressed() {
	if (key === " ") {
		if (shapes.length > 0) {
			shapes[0].updateOutputs();
		}
	}

	if (key === "ArrowUp") {
		if (shapes.length > 0) shapes[0].gate.setClock(1);
	}

	if (key === "ArrowDown") {
		if (shapes.length > 0) {
			shapes[0].gate.setClock(0);
		}
	}
}

// Zoom functionality with limits.
/**
 * @param {{ delta: number; }} event
 */
function mouseWheel(event) {
	// Only zoom if the mouse is within the canvas.
	if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
		return false;
	}

	let oldZoom = zoomLevel;
	let baseZoomFactor = 1.05;
	let zoomFactor;

	if (event.delta > 0) {
		// Zoom out (scroll down)
		zoomFactor = baseZoomFactor;
		zoomLevel /= zoomFactor; // Decrease zoom level
	} else {
		// Zoom in (scroll up)
		zoomFactor = baseZoomFactor;
		zoomLevel *= zoomFactor; // Increase zoom level
	}

	// Clamp zoom level between 0.15 and 4.
	zoomLevel = constrain(zoomLevel, 0.15, 4);

	// Adjust offsets so that the world point under the mouse remains fixed.
	let worldX = (mouseX - offsetX) / oldZoom;
	let worldY = (mouseY - offsetY) / oldZoom;
	offsetX = mouseX - worldX * zoomLevel;
	offsetY = mouseY - worldY * zoomLevel;

	return false;
}
