export class Shape {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} size
	 */
	constructor(x, y, size) {
		this.worldX = x;
		this.worldY = y;
		this.size = size;

		this.screenSize = size;
		this.screenX = x;
		this.screenY = y;
		this.dragging = false;
		this.offset = createVector(0, 0);

		// New: Selection state
		this.isSelected = false;
	}

	updateScreenPosition(offsetX, offsetY, zoomLevel) {
		this.screenX = this.worldX * zoomLevel + offsetX;
		this.screenY = this.worldY * zoomLevel + offsetY;
		this.screenSize = this.size * zoomLevel;
	}

	isMouseOver() {
		let sx = this.screenX;
		let sy = this.screenY;
		let halfSize = this.screenSize / 2;
		return mouseX >= sx - halfSize && mouseX <= sx + halfSize && mouseY >= sy - halfSize && mouseY <= sy + halfSize;
	}

	startDrag(offsetX, offsetY, zoomLevel) {
		this.dragging = true;
		let worldMouse = createVector((mouseX - offsetX) / zoomLevel, (mouseY - offsetY) / zoomLevel);
		this.offset = createVector(this.worldX - worldMouse.x, this.worldY - worldMouse.y);
	}

	updatePosition(offsetX, offsetY, zoomLevel, gridSpacing) {
		if (this.dragging) {
			let worldMouse = createVector((mouseX - offsetX) / zoomLevel, (mouseY - offsetY) / zoomLevel);
			// @ts-ignore
			let newPos = p5.Vector.add(worldMouse, this.offset);
			newPos.x = round(newPos.x / gridSpacing) * gridSpacing;
			newPos.y = round(newPos.y / gridSpacing) * gridSpacing;
			this.worldX = newPos.x;
			this.worldY = newPos.y;
		}
		this.updateScreenPosition(offsetX, offsetY, zoomLevel);
	}

	endDrag() {
		this.dragging = false;
	}

	/**
	 * Draws a blue selection ring around the shape if isSelected is true.
	 */
	drawSelection() {
		if (this.isSelected) {
			push();
			noFill();
			stroke(0, 120, 255); // Selection Blue
			strokeWeight(3);
			rectMode(CENTER);
			// Draw slightly larger than the component
			rect(this.screenX, this.screenY, this.screenSize + 10, this.screenSize + 10, 5);
			pop();
		}
	}

	draw() {
		// To be implemented by subclasses
	}

	static collidePointRect(px, py, rx, ry, rw, rh) {
		return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
	}

	static collidePointEllipse(px, py, ex, ey, ew, eh) {
		let dx = px - ex;
		let dy = py - ey;
		let rx = ew / 2;
		let ry = eh / 2;
		return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
	}

	static collidePointCircle(px, py, cx, cy, r) {
		let dx = px - cx;
		let dy = py - cy;
		return dx * dx + dy * dy <= r * r;
	}
}
