import { Shape } from "./shape.js";

export class ComponentOutput extends Shape {
	constructor(x, y) {
		super(x, y, 40);
		this.value = 0;
		this.isSnapTarget = true;
		this.label = "OUT";
	}

	draw(font) {
		push(); // FIX
		stroke(0);
		strokeWeight(2);

		if (this.value === 1) {
			fill(255, 100, 100);
			drawingContext.shadowBlur = 20;
			drawingContext.shadowColor = "red";
		} else {
			fill(50, 0, 0);
			drawingContext.shadowBlur = 0;
		}

		ellipse(this.screenX, this.screenY, this.screenSize);
		drawingContext.shadowBlur = 0;

		fill(255);
		noStroke();
		textAlign(CENTER, CENTER);
		textFont(font);
		textSize(14);
		text(this.value.toString(), this.screenX, this.screenY);
		pop(); // FIX
	}
}
