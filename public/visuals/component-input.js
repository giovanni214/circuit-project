import { Shape } from "./shape.js";

export class ComponentInput extends Shape {
	constructor(x, y) {
		super(x, y, 40);
		this.value = 0;
		this.isSnapTarget = true;
		this.label = "IN";
	}

	toggle() {
		this.value = 1 - this.value;
	}

	draw(font) {
		push(); // FIX
		stroke(0);
		strokeWeight(2);

		fill(this.value === 1 ? 255 : 240);
		rect(this.screenX, this.screenY, this.screenSize, this.screenSize, 8);

		if (this.value === 1) {
			fill(0, 255, 0);
			noStroke();
			ellipse(this.screenX, this.screenY - this.screenSize * 0.2, 10 * (this.screenSize / 40));
		} else {
			fill(50);
			noStroke();
			ellipse(this.screenX, this.screenY - this.screenSize * 0.2, 10 * (this.screenSize / 40));
		}

		fill(0);
		textAlign(CENTER, CENTER);
		textFont(font);
		textSize(12);
		text(this.value.toString(), this.screenX, this.screenY + this.screenSize * 0.2);
		pop(); // FIX
	}
}
