export class GraphNode {
    constructor(logicNode, label, kind, x, y, gridSize, circuit = null, pathPrefix = '') {
        this.logicNode = logicNode;
        this.label = label || 'NODE';
        this.kind = kind;
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.circuit = circuit;
        this.pathPrefix = pathPrefix || '';

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
        let sWeight = isFeedback ? 2.5 : 1.5;

        // Standardize the block's main color based on its first output
        const blockVal = valArray[0] ?? 0;
        const parsedBlockVal = blockVal === 1 ? 1 : 0;

        // Define the color based on the current state (Green for 1, Red for 0)
        const stateColor = parsedBlockVal === 1 ? color(76, 175, 80) : color(244, 67, 54);

        const subLabels = [];

        // Apply styles for Inputs
        if (this.kind === 'GRAPH_INPUT') {
            border = stateColor;
            sWeight = 3;
            subLabels.push({ text: '[input]', col: stateColor });
        } else if (this.kind === 'GRAPH_CLOCK') {
            bg = color(200, 220, 255);
        } else if (this.kind === 'GRAPH_FEEDBACK') {
            bg = color(230, 215, 255);
            border = color(120, 60, 180);
        } else if (this.kind === 'GRAPH_GATE') {
            bg = color(245, 245, 220); // Basic beige for standard gates!
        }

        // Apply styles for Outputs (Root Nodes)
        if (isRoot) {
            border = stateColor;
            sWeight = 3;
            subLabels.push({ text: '[output]', col: stateColor });
        }

        stroke(border);
        strokeWeight(sWeight);

        fill(bg);
        rectMode(CENTER);
        rect(0, 0, this.w, this.h, 5);

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

        // 1. Draw Output Pins & Value Badges
        if (!isRoot) {
            for (let i = 0; i < this.outputPins.length; i++) {
                const pin = this.outputPins[i];
                const py = pin.worldY - this.y;

                // Output Pin Dot
                fill(60);
                ellipse(this.w / 2, py, 8, 8);
            }
        }

        // 2. Draw Input Pins
        for (const pin of this.inputPins) {
            fill(60);
            ellipse(-this.w / 2, pin.worldY - this.y, 8, 8);
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