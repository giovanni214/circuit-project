import { Viewport } from './viewport.js';
import { VisualComponent } from './visual-component.js';
import { Wire } from './wire.js';

export class CircuitManager {
    constructor() {
        this.viewport = new Viewport();
        this.components = [];
        this.wires = [];

        this.state = 'IDLE';
        this.activeElement = null;
        this.startNode = null;
        this.waypoints = [];
        this.activeWaypointIndex = -1;

        this.gridSize = 20;
        this.inspectedComponent = null;
    }

    addComponent(type, x, y, gate = null) {
        let snappedX = this.snap(x);
        let snappedY = this.snap(y);
        this.components.push(new VisualComponent(type, snappedX, snappedY, this.gridSize, gate));
    }

    snap(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    drawStatePopup(font) {
        const comp = this.inspectedComponent;
        if (!comp?.gate) return;

        const feedbackNodes = [...new Set(comp.gate.feedbackNodes ?? [])];
        const inputNodes = comp.inputNodes;
        const outputNodes = comp.outputNodes;

        // Find which feedback nodes also appear as visible outputs
        const outputNames = new Set(
            comp.gate.rootNodes?.map(n => n?.name).filter(Boolean)
        );

        const padding = 16;
        const rowH = 30;
        const colW = 380;
        const headerH = 58;

        const INPUT_H = 26;
        const MEMORY_H = 72; // taller — holds explanation text
        const OUTPUT_H = 26;

        const totalH =
            headerH +
            INPUT_H + inputNodes.length * rowH +
            MEMORY_H + feedbackNodes.length * rowH +
            OUTPUT_H + outputNodes.length * rowH +
            padding;

        const px = width / 2 - colW / 2;
        const py = Math.max(10, height / 2 - totalH / 2);

        // Backdrop
        noStroke();
        fill(0, 0, 0, 120);
        rect(0, 0, width, height);

        // Panel shadow
        fill(0, 0, 0, 40);
        rect(px + 4, py + 4, colW, totalH, 10);

        // Panel bg
        fill(255);
        stroke(200);
        strokeWeight(1);
        rect(px, py, colW, totalH, 8);

        textFont(font);

        // Title bar
        fill(40);
        stroke(220);
        strokeWeight(1);
        rect(px, py, colW, headerH, 8, 8, 0, 0);

        fill(255);
        noStroke();
        textSize(13);
        textAlign(LEFT, TOP);
        text(`${comp.gate.name} -- Signal Inspector`, px + padding, py + 12);

        fill(160);
        textSize(10);
        text('Double-click or Esc to close', px + padding, py + 34);

        let cursor = py + headerH;

        const drawBadge = (val, x, y) => {
            fill(val === 1 ? '#4CAF50' : '#F44336');
            noStroke();
            ellipse(x, y, 24, 24);
            fill(255);
            textSize(12);
            textAlign(CENTER, CENTER);
            text(val, x, y);
        };

        const badgeX = px + colW - padding - 12;

        // ── INPUTS ────────────────────────────────────────────────
        fill(color(50, 80, 130));
        stroke(170);
        strokeWeight(1);
        rect(px, cursor, colW, INPUT_H);

        fill(255);
        noStroke();
        textSize(11);
        textAlign(LEFT, CENTER);
        text('>> INPUTS  --  signals entering the circuit', px + padding, cursor + INPUT_H / 2);
        cursor += INPUT_H;

        for (let i = 0; i < inputNodes.length; i++) {
            const n = inputNodes[i];
            fill(i % 2 === 0 ? 255 : 248); stroke(230); strokeWeight(1);
            rect(px, cursor, colW, rowH);

            fill(40); noStroke(); textSize(12);
            textAlign(LEFT, CENTER);
            text(`IN${i}`, px + padding, cursor + rowH / 2);

            drawBadge(n.value ?? 0, badgeX, cursor + rowH / 2);
            cursor += rowH;
        }

        // ── STORED STATE ──────────────────────────────────────────
        fill(color(85, 50, 120));
        stroke(170);
        strokeWeight(1);
        rect(px, cursor, colW, MEMORY_H);

        fill(255);
        noStroke();
        textSize(11);
        textAlign(LEFT, TOP);
        text('[STORED STATE]  --  this is how the circuit remembers', px + padding, cursor + 8);

        fill(190);
        textSize(9);
        text('Each value below was COMPUTED last tick and SAVED.', px + padding, cursor + 26);
        text('This tick, they are READ BACK as inputs to the logic gates,', px + padding, cursor + 39);
        text('letting the circuit base decisions on its own past output.', px + padding, cursor + 52);
        cursor += MEMORY_H;

        for (let i = 0; i < feedbackNodes.length; i++) {
            const n = feedbackNodes[i];
            const val = n.currentValue ?? 0;
            const isOutput = outputNames.has(n.name);

            // Subtle purple tint to distinguish from plain rows
            fill(i % 2 === 0 ? color(250, 247, 255) : color(243, 239, 252));
            stroke(200); strokeWeight(1);
            rect(px, cursor, colW, rowH);

            // Name
            fill(40); noStroke(); textSize(12);
            textAlign(LEFT, CENTER);
            text(n.name ?? `MEM${i}`, px + padding, cursor + rowH / 2);

            // Role tag — center column
            const tag = isOutput
                ? '[ output pin + stored ]'
                : '[ internal only + stored ]';
            fill(isOutput ? color(40, 110, 70) : color(100, 70, 150));
            textSize(9);
            textAlign(CENTER, CENTER);
            text(tag, px + colW / 2, cursor + rowH / 2);

            drawBadge(val, badgeX, cursor + rowH / 2);
            cursor += rowH;
        }

        // ── OUTPUTS ───────────────────────────────────────────────
        fill(color(35, 110, 65));
        stroke(170);
        strokeWeight(1);
        rect(px, cursor, colW, OUTPUT_H);

        fill(255);
        noStroke();
        textSize(11);
        textAlign(LEFT, CENTER);
        text('<< OUTPUTS  --  signals leaving the circuit this tick', px + padding, cursor + OUTPUT_H / 2);
        cursor += OUTPUT_H;

        for (let i = 0; i < outputNodes.length; i++) {
            const n = outputNodes[i];
            const rootNode = comp.gate.rootNodes?.[i];
            const name = rootNode?.name ?? `OUT${i}`;
            const isStoredToo = feedbackNodes.some(fn => fn.name === name);

            fill(i % 2 === 0 ? 255 : 248); stroke(230); strokeWeight(1);
            rect(px, cursor, colW, rowH);

            fill(40); noStroke(); textSize(12);
            textAlign(LEFT, CENTER);
            text(name, px + padding, cursor + rowH / 2);

            if (isStoredToo) {
                fill(color(100, 70, 150));
                textSize(9);
                textAlign(CENTER, CENTER);
                text('[ also saved as stored state ]', px + colW / 2, cursor + rowH / 2);
            }

            drawBadge(n.value ?? 0, badgeX, cursor + rowH / 2);
            cursor += rowH;
        }
    }

    draw(font) {
        push();
        this.viewport.apply();
        this.viewport.drawGrid(this.gridSize);

        for (let wire of this.wires) {
            wire.draw(this.activeElement === wire);
        }

        if (this.state === 'DRAWING_WIRE' && this.startNode) {
            Wire.drawPreview(this.startNode, this.viewport.getWorldCoords(mouseX, mouseY), this.gridSize, this.waypoints);
        }

        for (let comp of this.components) {
            comp.draw(font, this.activeElement === comp);
        }
        pop();

        fill(0);
        noStroke();
        textSize(16);
        textAlign(LEFT, TOP);
        text(`Zoom: ${Math.floor(this.viewport.zoom * 100)}% | [Space] Tick | [Shift+Click Wire] Add Joint | Dbl-Click Line to Flip Route`, 10, height - 30);

        if (this.inspectedComponent) {
            this.drawStatePopup(font);
        }
    }

    getHoveredNode(wx, wy) {
        for (let comp of this.components) {
            let node = comp.getNodeAt(wx, wy, this.viewport.zoom);
            if (node) return node;
        }
        return null;
    }

    // NEW: Extracts the wire propagation logic so it can be called independently
    cascadeLogic() {
        for (let i = 0; i < this.components.length + 2; i++) {
            for (let wire of this.wires) wire.propagate();
            for (let comp of this.components) comp.updateLogic();
        }
    }

    // UPDATE: Only toggles global clocks now, then calls the cascade
    stepSimulation() {
        this.cascadeLogic();
    }

    handleMousePress(mx, my) {
        let worldPt = this.viewport.getWorldCoords(mx, my);

        if (this.state === 'DRAWING_WIRE') {
            let node = this.getHoveredNode(worldPt.x, worldPt.y);
            if (node && node !== this.startNode && node.type !== this.startNode.type) {
                this.finishWire(node);
            } else if (!node) {
                this.waypoints.push({ x: this.snap(worldPt.x), y: this.snap(worldPt.y) });
            }
            return;
        }

        let node = this.getHoveredNode(worldPt.x, worldPt.y);
        if (node) {
            this.state = 'DRAWING_WIRE';
            this.startNode = node;
            this.waypoints = [];
            this.activeElement = null;
            return;
        }

        for (let i = this.components.length - 1; i >= 0; i--) {
            let comp = this.components[i];

            // NEW: Check if the user is clicking the clock button
            if (comp.isClockHit(worldPt.x, worldPt.y)) {
                // Flip ONLY this specific component's clock
                let nextClk = comp.gate.getClock() === 0 ? 1 : 0;
                comp.gate.setClock(nextClk);
                // this.cascadeLogic(); // ← ADD THIS
                return; // Consume the click
            }

            // Normal component drag hit detection
            if (comp.isHit(worldPt.x, worldPt.y)) {
                this.state = 'DRAGGING_COMP';
                this.activeElement = comp;
                this.components.splice(i, 1);
                this.components.push(comp);
                comp.dragOffset = { x: worldPt.x - comp.x, y: worldPt.y - comp.y };
                return;
            }
        }

        // ... rest of handleMousePress (wire hit detection, panning) remains exactly the same
        for (let wire of this.wires) {
            let wpIdx = wire.getHitWaypointIndex(worldPt.x, worldPt.y, this.viewport.zoom);
            if (wpIdx !== -1) {
                this.activeElement = wire;
                this.state = 'DRAGGING_WAYPOINT';
                this.activeWaypointIndex = wpIdx;
                return;
            }

            if (wire.isHit(worldPt.x, worldPt.y, this.viewport.zoom)) {
                this.activeElement = wire;
                if (keyIsDown(SHIFT)) {
                    this.activeWaypointIndex = wire.insertWaypointAt(worldPt.x, worldPt.y, this.gridSize);
                    this.state = 'DRAGGING_WAYPOINT';
                } else {
                    this.state = 'IDLE';
                }
                return;
            }
        }

        this.activeElement = null;
        this.state = 'PANNING';
        this.viewport.startPan(mx, my);
    }

    handleMouseDrag(mx, my) {
        if (this.state === 'PANNING') {
            this.viewport.updatePan(mx, my);
        } else if (this.state === 'DRAGGING_COMP' && this.activeElement) {
            let worldPt = this.viewport.getWorldCoords(mx, my);
            this.activeElement.x = this.snap(worldPt.x - this.activeElement.dragOffset.x);
            this.activeElement.y = this.snap(worldPt.y - this.activeElement.dragOffset.y);
            this.activeElement.updateNodes();

            for (let wire of this.wires) {
                if (wire.startNode.parent === this.activeElement || wire.endNode.parent === this.activeElement) {
                    wire.waypoints = Wire.generateAutoWaypoints(
                        wire.startNode.worldX, wire.startNode.worldY,
                        wire.endNode.worldX, wire.endNode.worldY,
                        this.gridSize,
                        wire.invertU // Preserves Above/Below choice during drag!
                    );
                }
            }
        } else if (this.state === 'DRAGGING_WAYPOINT' && this.activeElement instanceof Wire) {
            let worldPt = this.viewport.getWorldCoords(mx, my);
            this.activeElement.waypoints[this.activeWaypointIndex] = {
                x: this.snap(worldPt.x),
                y: this.snap(worldPt.y)
            };
        }
    }

    handleMouseRelease() {
        let worldPt = this.viewport.getWorldCoords(mouseX, mouseY);

        if (this.state === 'DRAWING_WIRE' && this.startNode) {
            let endNode = this.getHoveredNode(worldPt.x, worldPt.y);

            // 1. Drop on Pin
            let d = dist(this.startNode.worldX, this.startNode.worldY, worldPt.x, worldPt.y);
            if (endNode && endNode !== this.startNode && endNode.type !== this.startNode.type && d > 10) {
                this.finishWire(endNode);
                return;
            }

            // 2. Drop on Wire (Create Junction/Splitter)
            // You MUST be dragging FROM an Input pin TO an existing wire to split its signal
            if (this.startNode.type === 'INPUT') {
                for (let targetWire of this.wires) {
                    if (targetWire.isHit(worldPt.x, worldPt.y, this.viewport.zoom)) {
                        let snappedX = this.snap(worldPt.x);
                        let snappedY = this.snap(worldPt.y);

                        // The new wire inherits the source logic of the wire it was dropped on
                        let outNode = targetWire.startNode;
                        let inNode = this.startNode;

                        // Reverse custom waypoints since we drew backwards
                        let finalWaypoints = [...this.waypoints].reverse();

                        // Force the new wire to start rendering at the drop coordinates
                        finalWaypoints.unshift({ x: snappedX, y: snappedY });

                        this.wires.push(new Wire(outNode, inNode, finalWaypoints));

                        // Insert a physical joint dot on the target wire
                        targetWire.insertWaypointAt(snappedX, snappedY, this.gridSize);

                        this.state = 'IDLE';
                        this.startNode = null;
                        this.waypoints = [];
                        return;
                    }
                }
            }

            // Clicked empty space to add waypoint, stay in DRAWING_WIRE
            return;
        }

        if (this.state === 'DRAGGING_WAYPOINT' || this.state === 'DRAGGING_COMP' || this.state === 'PANNING') {
            this.state = 'IDLE';
            this.activeWaypointIndex = -1;
        }
    }

    finishWire(endNode) {
        let outNode = this.startNode.type === 'OUTPUT' ? this.startNode : endNode;
        let inNode = this.startNode.type === 'INPUT' ? this.startNode : endNode;
        let finalWaypoints = this.startNode.type === 'INPUT' ? [...this.waypoints].reverse() : [...this.waypoints];

        let newWire = new Wire(outNode, inNode, finalWaypoints);

        if (finalWaypoints.length === 0) {
            newWire.waypoints = Wire.generateAutoWaypoints(
                outNode.worldX, outNode.worldY,
                inNode.worldX, inNode.worldY,
                this.gridSize,
                newWire.invertU
            );
        }

        this.wires.push(newWire);
        this.state = 'IDLE';
        this.startNode = null;
        this.waypoints = [];
    }

    handleDoubleClick(mx, my) {
        // Close popup on any double click
        if (this.inspectedComponent) {
            this.inspectedComponent = null;
            return;
        }


        let worldPt = this.viewport.getWorldCoords(mx, my);

        for (let wire of this.wires) {
            let wpIdx = wire.getHitWaypointIndex(worldPt.x, worldPt.y, this.viewport.zoom);
            if (wpIdx !== -1) {
                // Double click a joint to delete it
                wire.waypoints.splice(wpIdx, 1);
                return;
            } else if (wire.isHit(worldPt.x, worldPt.y, this.viewport.zoom)) {
                // Double click a line to flip orientation AND above/below U-Route flag
                wire.horizontalFirst = !wire.horizontalFirst;
                wire.invertU = (wire.invertU + 1) % 4;

                // Regenerate the path to instantly show the new layout
                wire.waypoints = Wire.generateAutoWaypoints(
                    wire.startNode.worldX, wire.startNode.worldY,
                    wire.endNode.worldX, wire.endNode.worldY,
                    this.gridSize,
                    wire.invertU
                );
                return;
            }
        }

        for (let comp of this.components) {
            if (comp.isHit(worldPt.x, worldPt.y)) {
                if (comp.type === 'CIRCUIT' && comp.gate?.feedbackNodes?.length > 0) {
                    this.inspectedComponent = comp;
                } else {
                    comp.toggleState();
                }
                return;
            }
        }
    }

    handleKeyDown(key, keyCode) {
        if (key === ' ') {
            this.stepSimulation();
        } else if (key === 'Escape') {
            if (this.inspectedComponent) {
                this.inspectedComponent = null;
                return;
            }
            if (this.state === 'DRAWING_WIRE') {
                this.state = 'IDLE';
                this.startNode = null;
                this.waypoints = [];
            }
            this.activeElement = null;
        } else if (key === 'Backspace' || key === 'Delete') {
            if (this.activeElement) {
                if (this.activeElement instanceof Wire) {
                    this.wires = this.wires.filter(w => w !== this.activeElement);
                } else {
                    this.components = this.components.filter(c => c !== this.activeElement);
                    this.wires = this.wires.filter(w =>
                        w.startNode.parent !== this.activeElement &&
                        w.endNode.parent !== this.activeElement
                    );
                }
                this.activeElement = null;
            }
        }
    }
}