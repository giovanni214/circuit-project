import { Shape } from './shape.js';
import { InputShape } from './input-shape.js';
import { OutputShape } from './output-shape.js';

export class CircuitShape extends Shape {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} size
     * @param {any} gate
     */
    constructor(x, y, size, gate) {
        super(x, y, size);
        this.gate = gate;
        this.inputShapes = [];
        this.outputShapes = [];
    }

    updateInputLocations() {
        const numInputs = this.gate.inputLength;
        const spacingWorld = this.size / (numInputs + 1);
        const inputDiameterWorld = Math.min(this.size / 6, (this.size / numInputs) * 0.75);

        for (let i = 1; i <= numInputs; i++) {
            const cy = this.worldY - this.size / 2 + spacingWorld * i;
            const cx = this.worldX - this.size / 2 - inputDiameterWorld / 2;
            
            if (this.inputShapes.length !== numInputs) {
                this.inputShapes.push(new InputShape(cx, cy, inputDiameterWorld, 0));
            } else {
                this.inputShapes[i - 1].worldX = cx;
                this.inputShapes[i - 1].worldY = cy;
            }
        }
    }

    updateOutputLocations() {
        const numOutputs = this.gate.outputLength;
        const spacingWorld = this.size / (numOutputs + 1);
        const outputDiameterWorld = Math.min(this.size / 6, (this.size / numOutputs) * 0.75);

        for (let i = 1; i <= numOutputs; i++) {
            const cy = this.worldY - this.size / 2 + spacingWorld * i;
            const cx = this.worldX + this.size / 2 + outputDiameterWorld / 2;

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

    updateChildPositions(offsetX, offsetY, zoomLevel) {
        for (const subShape of [...this.inputShapes, ...this.outputShapes]) {
            subShape.updatePosition(offsetX, offsetY, zoomLevel, 50);
        }
    }

    draw(font) {
        fill(255, 0, 0);
        stroke(0);
        rect(this.screenX, this.screenY, this.screenSize, this.screenSize);

        fill(0);
        textAlign(CENTER, CENTER);
        textSize(floor(this.screenSize / 8));
        textWrap(CHAR);
        textFont(font);
        text(`${this.gate.name}\nGate`, this.screenX, this.screenY);

        for (let inputShape of this.inputShapes) {
            inputShape.draw(font);
        }

        for (let outputShape of this.outputShapes) {
            outputShape.draw(font);
        }
    }
}