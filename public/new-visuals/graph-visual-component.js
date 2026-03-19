export class GraphNode {
    constructor(logicNode, label, kind, x, y, gridSize, circuit = null, pathPrefix = '', inputPinLabels = [], outputPinLabels = []) {
        this.logicNode = logicNode;
        this.label = label || 'NODE';
        this.kind = kind;
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.circuit = circuit;
        this.pathPrefix = pathPrefix || '';
        this.inputPinLabels = inputPinLabels;
        this.outputPinLabels = outputPinLabels;

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
        const valArray = Array.isArray(rawVal) ? rawVal : [rawVal];

        // Determine state
        const blockVal = valArray[0] ?? 0;
        const isActive = blockVal === 1;

        // Define Colors
        let bg = color(255);
        let border = color(180); // Default grey border
        let textCol = color(20);
        let sWeight = isFeedback ? 2.5 : 1.5;

        const stateColor = isActive ? color(76, 175, 80) : color(244, 67, 54);

        const subLabels = [];

        // Styling logic
        if (this.kind === 'GRAPH_INPUT') {
            border = stateColor;
            sWeight = 3;
            subLabels.push({ text: '[input]', col: stateColor });
        } else if (this.kind === 'GRAPH_GATE') {
            // If you want gates to show color when active:
            border = isActive ? stateColor : color(100);
        } else if (this.kind === 'GRAPH_CLOCK') {
            bg = isActive ? color(150, 200, 255) : color(200, 220, 255);
        }

        if (isRoot) {
            border = stateColor;
            sWeight = 3;
            subLabels.push({ text: '[output]', col: stateColor });
        }

        // DRAW BOX
        stroke(border);
        strokeWeight(sWeight);
        fill(bg);
        rectMode(CENTER);
        rect(0, 0, this.w, this.h, 5);

        // DRAW TEXT
        fill(textCol);
        noStroke();
        textFont(font);
        textAlign(CENTER, CENTER);

        // Split by newline to handle the "Origin Name" logic
        let lines = this.label.split('\n');

        // Dynamic Text Size Logic
        let defaultLabelSize = lines.length > 1 ? 9 : 11;
        textSize(defaultLabelSize);

        let maxLineWidth = 0;
        lines.forEach(l => {
            let tw = textWidth(l);
            if (tw > maxLineWidth) maxLineWidth = tw;
        });

        let maxTitleWidth = this.w - 10;
        if (maxLineWidth > maxTitleWidth) {
            textSize(Math.max(5, defaultLabelSize * (maxTitleWidth / maxLineWidth)));
        }

        // Draw the label (this automatically handles \n in p5.js)
        if (this.pathPrefix && this.pathPrefix.length > 0) {
            text(this.label, 0, 5); // Shift down for breadcrumb

            fill(130);
            textSize(7);
            let displayPath = this.pathPrefix;
            if (textWidth(displayPath) > maxTitleWidth) {
                while (textWidth('...' + displayPath) > maxTitleWidth && displayPath.length > 0) {
                    displayPath = displayPath.substring(1);
                }
                displayPath = '...' + displayPath;
            }
            text(displayPath, 0, -12);
        } else {
            text(this.label, 0, 0); // Center-aligned
        }

        // 1. Draw Output Pins & Labels
        if (!isRoot) {
            for (let i = 0; i < this.outputPins.length; i++) {
                const pin = this.outputPins[i];
                const py = pin.worldY - this.y;

                fill(60);
                ellipse(this.w / 2, py, 8, 8);

                const lbl = this.outputPinLabels[i];
                if (lbl) {
                    fill(50);
                    noStroke();
                    textSize(7);
                    textAlign(RIGHT, CENTER);
                    text(lbl, this.w / 2 - 6, py);
                }
            }
        }

        // 2. Draw Input Pins + Labels
        for (let i = 0; i < this.inputPins.length; i++) {
            const pin = this.inputPins[i];
            const py = pin.worldY - this.y;
            fill(60);
            ellipse(-this.w / 2, py, 8, 8);

            const lbl = this.inputPinLabels[i];
            if (lbl) {
                fill(50);
                noStroke();
                textSize(7);
                textAlign(LEFT, CENTER);
                text(lbl, -this.w / 2 + 6, py);
            }
        }

        // Handle Feedback labels
        if (this.kind === 'GRAPH_FEEDBACK') {
            subLabels.push({ text: '[stored]', col: color(120, 60, 180) });
        }

        // Draw all sub-labels at the bottom
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