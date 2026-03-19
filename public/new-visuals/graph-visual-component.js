export class GraphNode {
    constructor(logicNode, label, kind, x, y, gridSize, circuit = null) {
        this.logicNode = logicNode;
        this.label = label;
        this.kind = kind;
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.circuit = circuit;   // <-- store it

        this.w = gridSize * 5;
        this.h = gridSize * 3;

        this.outputPin = {
            worldX: x + this.w / 2,
            worldY: y,
            owner: this,
        };

        this.inputPins = this._buildInputPins();
    }

    _buildInputPins() {
        const node = this.logicNode;
        const inputs = [];

        // GateNode / CompositeNode → .inputNodes
        // legacy / custom nodes   → .inputs
        const inputArray = node.inputNodes ?? node.inputs ?? [];

        if (inputArray.length > 0) {
            const count = inputArray.length;
            const spacing = this.gridSize * 2;
            const totalH = (count - 1) * spacing;
            for (let i = 0; i < count; i++) {
                inputs.push({
                    worldX: this.x - this.w / 2,
                    worldY: this.y - totalH / 2 + i * spacing,
                    index: i,
                    owner: this,
                });
            }
        } else if (node.inputNode || node.compositeNode) {
            // FeedbackNode (.inputNode) or SubCircuitOutputNode (.compositeNode)
            inputs.push({
                worldX: this.x - this.w / 2,
                worldY: this.y,
                index: 0,
                owner: this,
            });
        }

        return inputs;
    }

    getValue() {
        const n = this.logicNode;
        if (typeof n.currentValue !== 'undefined') return n.currentValue;
        if (typeof n.lastValue !== 'undefined') return n.lastValue;
        if (typeof n.value !== 'undefined') return n.value;
        if (this.circuit) {
            const last = this.circuit.history[this.circuit.history.length - 1];
            const lastInputs = last?.inputs ?? [];
            try {
                return n.evaluate(this.circuit, lastInputs);
            } catch {
                return 0;
            }
        }
        return 0;
    }

    isHit(wx, wy) {
        return (
            wx >= this.x - this.w / 2 &&
            wx <= this.x + this.w / 2 &&
            wy >= this.y - this.h / 2 &&
            wy <= this.y + this.h / 2
        );
    }

    draw(font, isRoot = false, isFeedback = false) {
        push();
        translate(this.x, this.y);

        const val = this.getValue();

        let bg = color(255);
        let border = color(0);
        let textCol = color(20);

        if (this.kind === 'GRAPH_INPUT') {
            bg = val === 1 ? color(200, 235, 200) : color(255, 210, 210);
        } else if (this.kind === 'GRAPH_CLOCK') {
            bg = color(200, 220, 255);
        } else if (this.kind === 'GRAPH_FEEDBACK') {
            bg = color(230, 215, 255);
            border = color(120, 60, 180);
        } else if (this.kind === 'GRAPH_GATE') {
            bg = color(245, 245, 220);
        }

        if (isRoot) {
            stroke(40, 160, 80);
            strokeWeight(3);
        } else {
            stroke(border);
            strokeWeight(isFeedback ? 2.5 : 1.5);
        }

        fill(bg);
        rectMode(CENTER);
        rect(0, 0, this.w, this.h, 5);

        fill(textCol);
        noStroke();
        textFont(font);
        textAlign(CENTER, CENTER);
        textSize(11);
        text(this.label, 0, -5);

        fill(val === 1 ? '#4CAF50' : '#888');
        ellipse(this.w / 2 - 10, 6, 16, 16);
        fill(255);
        textSize(9);
        text(val, this.w / 2 - 10, 6);

        const subLabels = [];
        if (isRoot) subLabels.push({ text: '[output]', col: color(40, 160, 80) });
        if (this.kind === 'GRAPH_FEEDBACK')
            subLabels.push({ text: '[stored]', col: color(120, 60, 180) });

        for (let i = 0; i < subLabels.length; i++) {
            fill(subLabels[i].col);
            noStroke();
            textSize(8);
            textAlign(CENTER, TOP);
            text(subLabels[i].text, 0, this.h / 2 + 2 + i * 11);
        }

        pop();

        fill(60);
        noStroke();
        ellipse(this.outputPin.worldX, this.outputPin.worldY, 8, 8);
        for (const pin of this.inputPins) {
            ellipse(pin.worldX, pin.worldY, 8, 8);
        }
    }
}