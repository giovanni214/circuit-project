export class State {
	constructor() {
		this.shapes = [];
		this.wires = [];
		this.mouseIsReleased = true;
		this.potentialDragTarget = null;
		this.potentialWireTarget = null;
		this.pressLocation = { x: 0, y: 0 };
		this.creatingWire = false;
		this.wireStartPoint = null;
		this.wirePreview = null;
	}

	bringToFront(shape) {
		const index = this.shapes.indexOf(shape);
		if (index > -1) {
			this.shapes.splice(index, 1);
			this.shapes.unshift(shape);
		}
	}

	bringWireToFront(wire) {
		const index = this.wires.indexOf(wire);
		if (index > -1) {
			this.wires.splice(index, 1);
			this.wires.push(wire);
		}
	}

	resetDragState() {
		this.mouseIsReleased = true;
		this.potentialDragTarget = null;
		this.potentialWireTarget = null;
	}
}