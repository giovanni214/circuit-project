import { Shape } from './shape.js';

export class OutputShape extends Shape {
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

    draw(font) {
        fill(100);
        ellipse(this.screenX, this.screenY, this.screenSize);

        fill(0);
        textAlign(CENTER, BASELINE);
        textSize(floor(this.screenSize));
        textFont(font);
        const yOffset = (textAscent() - textDescent()) / 2;
        text(this.value, this.screenX, this.screenY + yOffset);
    }
}