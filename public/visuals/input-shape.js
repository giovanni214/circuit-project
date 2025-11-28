import { Shape } from "./shape.js";

export class InputShape extends Shape {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} size
	 */
	constructor(x, y, size, value = 0) {
		super(x, y, size);
		this.allowedToToggle = true;
		this.value = value;
		this.isDriven = false;
	}

	isMouseOver() {
		return Shape.collidePointCircle(mouseX, mouseY, this.screenX, this.screenY, this.screenSize / 2);
	}

	draw(font) {
		push(); // FIX
		if (this.isDriven) {
			fill(this.isMouseOver() ? 220 : 200);
			stroke(100);
		} else {
			fill(this.isMouseOver() ? 200 : 100);
			stroke(0);
		}

		ellipse(this.screenX, this.screenY, this.screenSize);

		fill(0);
		textAlign(CENTER, BASELINE);
		textSize(floor(this.screenSize));
		textFont(font);
		const yOffset = (textAscent() - textDescent()) / 2;
		text(this.value, this.screenX, this.screenY + yOffset);
		pop(); // FIX
	}
}
