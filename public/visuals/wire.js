export class Wire {
	constructor(startX, startY, endX, endY) {
		this.startX = startX;
		this.startY = startY;
		this.endX = endX;
		this.endY = endY;
		this.draggingStart = false;
		this.draggingEnd = false;
		this.handleRadius = 8;

		this.startConnectedShape = null;
		this.endConnectedShape = null;

		const dx = Math.abs(endX - startX);
		const dy = Math.abs(endY - startY);
		this.horizontalFirst = dx >= dy;

		this.orientationLocked = false;
		this.isSelected = false;
	}

	propagate() {
		if (this.startConnectedShape && this.endConnectedShape) {
			if (this.startConnectedShape.value !== undefined) {
				this.endConnectedShape.value = this.startConnectedShape.value;
			}
		}
	}

	flipOrientation() {
		this.horizontalFirst = !this.horizontalFirst;
		this.orientationLocked = true;
	}

	isMouseOverLine(zoomLevel, offsetX, offsetY) {
		const sx = this.startX * zoomLevel + offsetX;
		const sy = this.startY * zoomLevel + offsetY;
		const ex = this.endX * zoomLevel + offsetX;
		const ey = this.endY * zoomLevel + offsetY;

		const hitDist = 8;

		let midX, midY;
		if (this.horizontalFirst) {
			midX = ex;
			midY = sy;
		} else {
			midX = sx;
			midY = ey;
		}

		const distToSegment = (p, v, w) => {
			const l2 = dist(v.x, v.y, w.x, w.y) ** 2;
			if (l2 === 0) return dist(p.x, p.y, v.x, v.y);
			let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
			t = Math.max(0, Math.min(1, t));
			return dist(p.x, p.y, v.x + t * (w.x - v.x), v.y + t * (w.y - v.y));
		};

		const mouseP = createVector(mouseX, mouseY);
		const startP = createVector(sx, sy);
		const midP = createVector(midX, midY);
		const endP = createVector(ex, ey);

		return distToSegment(mouseP, startP, midP) < hitDist || distToSegment(mouseP, midP, endP) < hitDist;
	}

	static findSnapTarget(worldX, worldY, shapes, threshold = 20) {
		for (const shape of shapes) {
			if (shape.inputShapes) {
				for (const input of shape.inputShapes) {
					if (dist(worldX, worldY, input.worldX, input.worldY) < threshold) return input;
				}
			}
			if (shape.outputShapes) {
				for (const output of shape.outputShapes) {
					if (dist(worldX, worldY, output.worldX, output.worldY) < threshold) return output;
				}
			}
			if (shape.isSnapTarget) {
				if (dist(worldX, worldY, shape.worldX, shape.worldY) < threshold) return shape;
			}
		}
		return null;
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

	updatePosition(offsetX, offsetY, zoomLevel, gridSpacing, shapes = []) {
		if (this.draggingStart) {
			let worldMouse = createVector((mouseX - offsetX) / zoomLevel, (mouseY - offsetY) / zoomLevel);
			const snapTarget = Wire.findSnapTarget(worldMouse.x, worldMouse.y, shapes);

			if (snapTarget) {
				this.startX = snapTarget.worldX;
				this.startY = snapTarget.worldY;
				this.startConnectedShape = snapTarget;
			} else {
				worldMouse.x = round(worldMouse.x / gridSpacing) * gridSpacing;
				worldMouse.y = round(worldMouse.y / gridSpacing) * gridSpacing;
				this.startX = worldMouse.x;
				this.startY = worldMouse.y;
				this.startConnectedShape = null;
			}
		}

		if (this.draggingEnd) {
			let worldMouse = createVector((mouseX - offsetX) / zoomLevel, (mouseY - offsetY) / zoomLevel);
			const snapTarget = Wire.findSnapTarget(worldMouse.x, worldMouse.y, shapes);

			if (snapTarget) {
				this.endX = snapTarget.worldX;
				this.endY = snapTarget.worldY;
				this.endConnectedShape = snapTarget;
			} else {
				worldMouse.x = round(worldMouse.x / gridSpacing) * gridSpacing;
				worldMouse.y = round(worldMouse.y / gridSpacing) * gridSpacing;
				this.endX = worldMouse.x;
				this.endY = worldMouse.y;
				this.endConnectedShape = null;
			}
		}
	}

	endDrag() {
		this.draggingStart = false;
		this.draggingEnd = false;
	}

	draw(zoomLevel, offsetX, offsetY) {
		push(); // FIX: Isolate State
		const sx = this.startX * zoomLevel + offsetX;
		const sy = this.startY * zoomLevel + offsetY;
		const ex = this.endX * zoomLevel + offsetX;
		const ey = this.endY * zoomLevel + offsetY;

		let wireColor = color(50);
		let weight = 2;

		if (this.startConnectedShape && this.startConnectedShape.value === 1) {
			wireColor = color(0, 200, 0);
			weight = 3;
		} else if (this.startConnectedShape && this.startConnectedShape.value === 0) {
			wireColor = color(100);
		}

		if (this.isSelected) {
			stroke(0, 100, 255, 100);
			strokeWeight(weight + 6);
			this.drawLines(sx, sy, ex, ey);
		}

		stroke(wireColor);
		strokeWeight(weight);
		this.drawLines(sx, sy, ex, ey);

		if (this.startConnectedShape) {
			fill(wireColor);
			noStroke();
			ellipse(sx, sy, 6 * zoomLevel);
		} else {
			fill(this.draggingStart || this.isMouseOverStart(zoomLevel, offsetX, offsetY) ? 255 : 200);
			stroke(0);
			strokeWeight(1);
			ellipse(sx, sy, this.handleRadius * 2 * zoomLevel);
		}

		if (this.endConnectedShape) {
			fill(wireColor);
			noStroke();
			ellipse(ex, ey, 6 * zoomLevel);
		} else {
			fill(this.draggingEnd || this.isMouseOverEnd(zoomLevel, offsetX, offsetY) ? 255 : 200);
			stroke(0);
			strokeWeight(1);
			ellipse(ex, ey, this.handleRadius * 2 * zoomLevel);
		}
		pop(); // FIX: Restore State
	}

	drawLines(sx, sy, ex, ey) {
		if (this.horizontalFirst) {
			line(sx, sy, ex, sy);
			line(ex, sy, ex, ey);
		} else {
			line(sx, sy, sx, ey);
			line(sx, ey, ex, ey);
		}
	}
}
