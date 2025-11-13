import { Shape } from './shape.js';

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
    }

    isMouseOver() {
        return Shape.collidePointCircle(mouseX, mouseY, this.screenX, this.screenY, this.screenSize / 2);
    }

    draw(font) {
        fill(this.isMouseOver() ? 200 : 100);
        ellipse(this.screenX, this.screenY, this.screenSize);

        fill(0);
        textAlign(CENTER, BASELINE);
        textSize(floor(this.screenSize));
        textFont(font);
        const yOffset = (textAscent() - textDescent()) / 2;
        text(this.value, this.screenX, this.screenY + yOffset);
    }
}