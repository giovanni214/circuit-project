// File: public/new-visuals/modules/circuit-renderer.js

import { Wire } from '../wire.js';

export class CircuitRenderer {
    constructor(m) {
        this.m = m;
    }

    draw(font) {
        const m = this.m;
        if (m.isInspecting()) {
            this._drawInspector(font);
            return;
        }

        push();
        m.viewport.apply();
        m.viewport.drawGrid(m.gridSize);

        for (const comp of m.components)
            comp.draw(font, m.activeElement === comp);

        // Replace the Overlap Detection Setup section inside draw() with this:

        // --- Overlap Detection Setup ---
        const overlapChunks = new Map();
        const overlapWaypoints = new Map(); // Add waypoint tracker
        const getChunkKey = (x, y, isHoriz) => `${x},${y},${isHoriz ? 'H' : 'V'}`;

        for (const wire of m.wires) {
            const pts = wire.getPoints();
            for (let i = 0; i < pts.length - 1; i++) {
                const x1 = pts[i].x, y1 = pts[i].y;
                const x2 = pts[i + 1].x, y2 = pts[i + 1].y;
                if (Math.abs(y1 - y2) < 0.5) {
                    const startX = Math.min(x1, x2);
                    const endX = Math.max(x1, x2);
                    for (let x = startX; x < endX; x += m.gridSize) {
                        const key = getChunkKey(x, y1, true);
                        overlapChunks.set(key, (overlapChunks.get(key) || 0) + 1);
                    }
                } else if (Math.abs(x1 - x2) < 0.5) {
                    const startY = Math.min(y1, y2);
                    const endY = Math.max(y1, y2);
                    for (let y = startY; y < endY; y += m.gridSize) {
                        const key = getChunkKey(x1, y, false);
                        overlapChunks.set(key, (overlapChunks.get(key) || 0) + 1);
                    }
                }
            }

            // Tally waypoint overlaps (including dangling ends)
            for (const wp of wire.waypoints) {
                const key = `${wp.x},${wp.y}`;
                overlapWaypoints.set(key, (overlapWaypoints.get(key) || 0) + 1);
            }
            if (wire.startNode.isDangling) {
                const key = `${wire.startNode.worldX},${wire.startNode.worldY}`;
                overlapWaypoints.set(key, (overlapWaypoints.get(key) || 0) + 1);
            }
            if (wire.endNode.isDangling) {
                const key = `${wire.endNode.worldX},${wire.endNode.worldY}`;
                overlapWaypoints.set(key, (overlapWaypoints.get(key) || 0) + 1);
            }
        }

        for (const wire of m.wires)
            wire.draw(m.activeElement === wire, overlapChunks, overlapWaypoints, m.gridSize); // Pass overlapWaypoints

        if (m.state === 'DRAWING_WIRE' && m.startNode) {
            const worldMouse = m.viewport.getWorldCoords(mouseX, mouseY);
            Wire.drawPreview(
                m.startNode,
                worldMouse,
                m.gridSize,
                m.waypoints,
                m.branchParentWire ? m.branchInsertIndex : -1
            );

            const targetNode = m.getHoveredNode(
                worldMouse.x,
                worldMouse.y
            );
            if (
                targetNode &&
                targetNode !== m.startNode &&
                targetNode.type !== m.startNode.type
            ) {
                push();
                stroke(0, 150, 255, 200);
                strokeWeight(3);
                noFill();
                ellipse(targetNode.worldX, targetNode.worldY, 24);
                pop();
            }
        }

        pop();

        if (m.inspectedComponent) this.drawStatePopup(font);
        this._drawHUD(font);

        // --- NEW: Draw Sidebar UI on top of everything ---
        if (m.sidebar) {
            m.sidebar.draw(font);
        }
    }

    _drawInspector(font) {
        const m = this.m;
        background(245);
        push();
        m.viewport.apply();
        m.viewport.drawGrid(m.gridSize);
        pop();
        m.inspectorScene.draw(font, m.viewport);
        this._drawInspectorHUD(font);
    }

    _drawHUD(font) {
        fill(0);
        noStroke();
        textSize(14);
        textAlign(LEFT, TOP);
        text(
            `Zoom: ${Math.floor(this.m.viewport.zoom * 100)}%` +
            ` | [Space] Tick | [Shift+Click Wire] Add Joint` +
            ` | Dbl-Click line to flip route` +
            ` | Dbl-Click circuit to inspect` +
            ` | [S] Save  |  [L] Load`,
            10,
            height - 18
        );
    }

    _drawInspectorHUD(font) {
        const m = this.m;
        fill(30);
        noStroke();
        rect(0, 0, width, 40);

        fill(255);
        noStroke();
        textFont(font);
        textSize(13);
        textAlign(LEFT, CENTER);
        const crumbs = m.sceneStack.map(s => s.crumbName).join(' > ');
        const full = crumbs
            ? `${crumbs} > ${m.inspectorCircuitName}`
            : m.inspectorCircuitName;
        text(`Inspecting: ${full}`, 12, 20);

        fill(80, 80, 80);
        stroke(150);
        strokeWeight(1);
        rect(width - 124, 8, 124, 24, 4);

        fill(255);
        noStroke();
        textSize(12);
        textAlign(CENTER, CENTER);
        text('<< Back  [Esc]', width - 62, 20);

        fill(20, 20, 20, 220);
        textSize(11);
        textAlign(LEFT, BOTTOM);
        text(
            '[green border] = output pin   ' +
            '[purple border] = stored state (feedback)   ' +
            '[green wire] = HIGH   [grey wire] = LOW',
            12,
            height - 10
        );
    }

    drawStatePopup(font) {
        const m = this.m;
        const comp = m.inspectedComponent;
        if (!comp?.gate) return;

        const feedbackNodes = [
            ...new Set(comp.gate.feedbackNodes ?? []),
        ];
        const inputNodes = comp.inputNodes;
        const outputNodes = comp.outputNodes;
        const outputNames = new Set(
            comp.gate.rootNodes?.map(n => n?.name).filter(Boolean)
        );

        const padding = 16;
        const rowH = 30;
        const colW = 380;
        const headerH = 58;
        const INPUT_H = 26;
        const MEMORY_H = 72;
        const OUTPUT_H = 26;

        const totalH =
            headerH +
            INPUT_H +
            inputNodes.length * rowH +
            MEMORY_H +
            feedbackNodes.length * rowH +
            OUTPUT_H +
            outputNodes.length * rowH +
            padding;

        const px = width / 2 - colW / 2;
        const py = Math.max(10, height / 2 - totalH / 2);

        noStroke();
        fill(0, 0, 0, 120);
        rect(0, 0, width, height);

        fill(0, 0, 0, 40);
        rect(px + 4, py + 4, colW, totalH, 10);

        fill(255);
        stroke(200);
        strokeWeight(1);
        rect(px, py, colW, totalH, 8);

        textFont(font);
        fill(40);
        stroke(220);
        strokeWeight(1);
        rect(px, py, colW, headerH, 8, 8, 0, 0);

        fill(255);
        noStroke();
        textSize(13);
        textAlign(LEFT, TOP);
        text(
            `${comp.gate.name} -- Signal Inspector`,
            px + padding,
            py + 12
        );

        fill(160);
        textSize(10);
        text('Double-click or Esc to close', px + padding, py + 34);

        let cursor = py + headerH;
        const badgeX = px + colW - padding - 12;

        const drawBadge = (val, x, y) => {
            fill(val === 1 ? '#4CAF50' : '#F44336');
            noStroke();
            ellipse(x, y, 24, 24);
            fill(255);
            textSize(12);
            textAlign(CENTER, CENTER);
            text(val, x, y);
        };

        // INPUTS
        cursor = this._drawPopupSection(
            cursor,
            px,
            colW,
            INPUT_H,
            color(50, 80, 130),
            '>> INPUTS  --  signals entering the circuit'
        );
        for (let i = 0; i < inputNodes.length; i++) {
            const n = inputNodes[i];
            fill(i % 2 === 0 ? 255 : 248);
            stroke(230);
            strokeWeight(1);
            rect(px, cursor, colW, rowH);
            fill(40);
            noStroke();
            textSize(12);
            textAlign(LEFT, CENTER);
            text(`IN${i}`, px + padding, cursor + rowH / 2);
            drawBadge(n.value ?? 0, badgeX, cursor + rowH / 2);
            cursor += rowH;
        }

        // STORED STATE
        fill(color(85, 50, 120));
        stroke(170);
        strokeWeight(1);
        rect(px, cursor, colW, MEMORY_H);
        fill(255);
        noStroke();
        textSize(11);
        textAlign(LEFT, TOP);
        text(
            '[STORED STATE]  --  this is how the circuit remembers',
            px + padding,
            cursor + 8
        );
        fill(190);
        textSize(9);
        text(
            'Each value below was COMPUTED last tick and SAVED.',
            px + padding,
            cursor + 26
        );
        text(
            'This tick, they are READ BACK as inputs to the logic gates,',
            px + padding,
            cursor + 39
        );
        text(
            'letting the circuit base decisions on its own past output.',
            px + padding,
            cursor + 52
        );
        cursor += MEMORY_H;

        for (let i = 0; i < feedbackNodes.length; i++) {
            const n = feedbackNodes[i];
            const val = n.currentValue ?? 0;
            const isOutput = outputNames.has(n.name);
            fill(
                i % 2 === 0
                    ? color(250, 247, 255)
                    : color(243, 239, 252)
            );
            stroke(200);
            strokeWeight(1);
            rect(px, cursor, colW, rowH);
            fill(40);
            noStroke();
            textSize(12);
            textAlign(LEFT, CENTER);
            text(
                n.name ?? `MEM${i}`,
                px + padding,
                cursor + rowH / 2
            );
            fill(
                isOutput ? color(40, 110, 70) : color(100, 70, 150)
            );
            textSize(9);
            textAlign(CENTER, CENTER);
            text(
                isOutput
                    ? '[ output pin + stored ]'
                    : '[ internal only + stored ]',
                px + colW / 2,
                cursor + rowH / 2
            );
            drawBadge(val, badgeX, cursor + rowH / 2);
            cursor += rowH;
        }

        // OUTPUTS
        cursor = this._drawPopupSection(
            cursor,
            px,
            colW,
            OUTPUT_H,
            color(35, 110, 65),
            '<< OUTPUTS  --  signals leaving the circuit this tick'
        );
        for (let i = 0; i < outputNodes.length; i++) {
            const n = outputNodes[i];
            const rootNode = comp.gate.rootNodes?.[i];
            const name = rootNode?.name ?? `OUT${i}`;
            const isStoredToo = feedbackNodes.some(
                fn => fn.name === name
            );
            fill(i % 2 === 0 ? 255 : 248);
            stroke(230);
            strokeWeight(1);
            rect(px, cursor, colW, rowH);
            fill(40);
            noStroke();
            textSize(12);
            textAlign(LEFT, CENTER);
            text(name, px + padding, cursor + rowH / 2);
            if (isStoredToo) {
                fill(color(100, 70, 150));
                textSize(9);
                textAlign(CENTER, CENTER);
                text(
                    '[ also saved as stored state ]',
                    px + colW / 2,
                    cursor + rowH / 2
                );
            }
            drawBadge(n.value ?? 0, badgeX, cursor + rowH / 2);
            cursor += rowH;
        }
    }

    _drawPopupSection(cursor, px, colW, sectionH, bgColor, label) {
        fill(bgColor);
        stroke(170);
        strokeWeight(1);
        rect(px, cursor, colW, sectionH);
        fill(255);
        noStroke();
        textSize(11);
        textAlign(LEFT, CENTER);
        text(label, px + 16, cursor + sectionH / 2);
        return cursor + sectionH;
    }
}