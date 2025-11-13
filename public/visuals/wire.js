export class Wire {
	constructor(startX, startY, endX, endY) {
		this.startX = startX;
		this.startY = startY;
		this.endX = endX;
		this.endY = endY;
		this.draggingStart = false;
		this.draggingEnd = false;
		this.handleRadius = 8;
	}

	isMouseOverStart(zoomLevel, offsetX, offsetY) {
		const handleX = this.startX * zoomLevel + offsetX;
		const handleY = this.startY * zoomLevel + offsetY;
		return dist(mouseX, mouseY, handleX, handleY) < this.handleRadius * zoomLevel;
	}

	isMouseOverEnd(zoomLevel, offsetX, offsetY) {
		const handleX = this.endX * zoomLevel + offsetX;
		const handleY = this.endY * zoomLevel + offsetY;
		return dist(mouseX, mouseY, handleX, handleY) < this.handleRadius * zoomLevel;
	}

	startDrag(isStartHandle) {
		if (isStartHandle) this.draggingStart = true;
		else this.draggingEnd = true;
	}

	updatePosition(offsetX, offsetY, zoomLevel, gridSpacing) {
		if (this.draggingStart) {
			let worldMouse = createVector((mouseX - offsetX) / zoomLevel, (mouseY - offsetY) / zoomLevel);
			worldMouse.x = round(worldMouse.x / gridSpacing) * gridSpacing;
			worldMouse.y = round(worldMouse.y / gridSpacing) * gridSpacing;
			this.startX = worldMouse.x;
			this.startY = worldMouse.y;
		}

		if (this.draggingEnd) {
			let worldMouse = createVector((mouseX - offsetX) / zoomLevel, (mouseY - offsetY) / zoomLevel);
			worldMouse.x = round(worldMouse.x / gridSpacing) * gridSpacing;
			worldMouse.y = round(worldMouse.y / gridSpacing) * gridSpacing;
			this.endX = worldMouse.x;
			this.endY = worldMouse.y;
		}
	}

	endDrag() {
		this.draggingStart = false;
		this.draggingEnd = false;
	}

	draw(zoomLevel, offsetX, offsetY) {
		const sx = this.startX * zoomLevel + offsetX;
		const sy = this.startY * zoomLevel + offsetY;
		const ex = this.endX * zoomLevel + offsetX;
		const ey = this.endY * zoomLevel + offsetY;

		stroke(0);
		strokeWeight(2);

		// Manhattan routing using Pythagorean theorem
		const dx = abs(ex - sx);
		const dy = abs(ey - sy);

		if (dx > dy) {
			line(sx, sy, ex, sy);
			line(ex, sy, ex, ey);
		} else {
			line(sx, sy, sx, ey);
			line(sx, ey, ex, ey);
		}

		// Draw handles
		fill(this.draggingStart || this.isMouseOverStart(zoomLevel, offsetX, offsetY) ? 255 : 100);
		ellipse(sx, sy, this.handleRadius * 2 * zoomLevel);

		fill(this.draggingEnd || this.isMouseOverEnd(zoomLevel, offsetX, offsetY) ? 255 : 100);
		ellipse(ex, ey, this.handleRadius * 2 * zoomLevel);
	}
}