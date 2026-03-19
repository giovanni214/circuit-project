export class GraphNode {
    constructor(logicNode, label, kind, x, y, gridSize, circuit = null) {
        this.logicNode = logicNode;
        this.label = label;
        this.kind = kind;
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.circuit = circuit;

        // Determine pin counts
        let outCount = 1;
        if (logicNode.subCircuit && typeof logicNode.subCircuit.outputLength === 'number') {
            outCount = logicNode.subCircuit.outputLength;
        }

        let inCount = 0;
        const inputArray = logicNode.inputNodes ?? logicNode.inputs ?? [];
        if (inputArray.length > 0) inCount = inputArray.length;
        else if (logicNode.inputNode || logicNode.compositeNode) inCount = 1;

        const maxPins = Math.max(inCount, outCount, 1);

        this.w = gridSize * 5;
        // Dynamically scale height to comfortably fit all pins!
        this.h = Math.max(gridSize * 3, maxPins * gridSize * 2);

        this.inputPins = this._buildInputPins(inCount);
        this.outputPins = this._buildOutputPins(outCount);
    }

    _buildInputPins(count) {
        const pins = [];
        if (count === 0) return pins;
        if (count === 1) {
            pins.push({ worldX: this.x - this.w / 2, worldY: this.y, index: 0, owner: this });
            return pins;
        }
        const spacing = this.gridSize * 2;
        const totalH = (count - 1) * spacing;
        for (let i = 0; i < count; i++) {
            pins.push({
                worldX: this.x - this.w / 2,
                worldY: this.y - totalH / 2 + i * spacing,
                index: i,
                owner: this,
            });
        }
        return pins;
    }

    _buildOutputPins(count) {
        const pins = [];
        if (count === 1) {
            pins.push({ worldX: this.x + this.w / 2, worldY: this.y, index: 0, owner: this });
            return pins;
        }
        const spacing = this.gridSize * 2;
        const totalH = (count - 1) * spacing;
        for (let i = 0; i < count; i++) {
            pins.push({
                worldX: this.x + this.w / 2,
                worldY: this.y - totalH / 2 + i * spacing,
                index: i,
                owner: this,
            });
        }
        return pins;
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

        const rawVal = this.getValue();
        // Force value into an array so we can map it to multiple output pins
        const valArray = Array.isArray(rawVal) ? rawVal : [rawVal];

        let bg = color(255);
        let border = color(0);
        let textCol = color(20);

        // Standardize the block's main color based on its first output
        const blockVal = valArray[0] ?? 0;
        const parsedBlockVal = blockVal === 1 ? 1 : 0;

        if (this.kind === 'GRAPH_INPUT') {
            bg = parsedBlockVal === 1 ? color(200, 235, 200) : color(255, 210, 210);
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

        // 1. Draw Output Pins & Value Badges
        for (let i = 0; i < this.outputPins.length; i++) {
            const pin = this.outputPins[i];
            const py = pin.worldY - this.y;

            const pinVal = valArray[i] ?? 0;
            const parsedVal = pinVal === 1 ? 1 : 0;

            // Colored Badge
            fill(parsedVal === 1 ? '#4CAF50' : '#888');
            ellipse(this.w / 2 - 10, py, 16, 16);

            fill(255);
            textSize(9);
            text(parsedVal, this.w / 2 - 10, py);

            // Output Pin Dot
            fill(60);
            ellipse(this.w / 2, py, 8, 8);
        }

        // 2. Draw Input Pins
        for (const pin of this.inputPins) {
            fill(60);
            ellipse(-this.w / 2, pin.worldY - this.y, 8, 8);
        }

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
    }
}