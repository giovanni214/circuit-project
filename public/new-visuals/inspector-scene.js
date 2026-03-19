import { collectNodes, assignLayers, layoutNodes, nodeLabel, nodeKind } from './node-layout.js';
import { GraphNode } from './graph-visual-component.js';
import { FeedbackNode } from '../lib/nodes.js';

export class InspectorScene {
    constructor(circuit, gridSize) {
        this.circuit = circuit;
        this.gridSize = gridSize;
        this.nodes = [];
        this.edges = [];
        this.logicToGraph = new Map();
        this._build();
    }

    _build() {
        const rootNodes = this.circuit.rootNodes;
        const allNodes = collectNodes(rootNodes);
        const layers = assignLayers(rootNodes, allNodes);
        const positions = layoutNodes(layers, this.gridSize);
        const rootSet = new Set(rootNodes);
        const feedbackSet = new Set(this.circuit.feedbackNodes ?? []);

        for (const [logicNode, pos] of positions) {
            const gn = new GraphNode(
                logicNode,
                nodeLabel(logicNode),
                nodeKind(logicNode),
                pos.x, pos.y,
                this.gridSize,
                this.circuit
            );
            this.nodes.push(gn);
            this.logicToGraph.set(logicNode, gn);
        }

        for (const [logicNode, gn] of this.logicToGraph) {
            const addEdge = (srcLogic, inputIndex) => {
                const src = this.logicToGraph.get(srcLogic);
                if (!src) return;
                // A feedback edge goes right-to-left (or same column) in the layout
                const isFeedback = src.x >= gn.x;
                this.edges.push({ from: src, to: gn, inputIndex, isFeedback });
            };

            // Cover every property convention from nodes.js
            if (logicNode.inputNodes) {
                // GateNode, CompositeNode
                logicNode.inputNodes.forEach((inp, i) => addEdge(inp, i));
            }
            if (logicNode.inputs) {
                // legacy / custom nodes
                logicNode.inputs.forEach((inp, i) => addEdge(inp, i));
            }
            if (logicNode.inputNode) {
                // FeedbackNode
                addEdge(logicNode.inputNode, 0);
            }
            if (logicNode.compositeNode) {
                // SubCircuitOutputNode
                addEdge(logicNode.compositeNode, 0);
            }
        }

        this._rootSet = rootSet;
        this._feedbackSet = feedbackSet;
    }

    _drawForwardEdge(fromPin, toPin, val) {
        stroke(val === 1 ? '#4CAF50' : '#888888');
        strokeWeight(2.5);
        noFill();
        const midX = (fromPin.worldX + toPin.worldX) / 2;
        beginShape();
        vertex(fromPin.worldX, fromPin.worldY);
        vertex(midX, fromPin.worldY);
        vertex(midX, toPin.worldY);
        vertex(toPin.worldX, toPin.worldY);
        endShape();
    }

    _drawFeedbackEdge(fromPin, toPin, val) {
        const col = val === 1 ? '#4CAF50' : '#BB88FF';

        // Route the loop BELOW both nodes so it's visually distinct
        const loopY = Math.max(fromPin.worldY, toPin.worldY) + this.gridSize * 6;
        const stubOut = fromPin.worldX + this.gridSize * 3;
        const stubIn = toPin.worldX - this.gridSize * 3;

        stroke(col);
        strokeWeight(2.5);
        noFill();

        // Draw each segment manually — no beginShape so no strokeDash crash
        // Leg 1: exit source output pin rightward
        line(fromPin.worldX, fromPin.worldY, stubOut, fromPin.worldY);
        // Leg 2: drop down to loop level
        line(stubOut, fromPin.worldY, stubOut, loopY);
        // Leg 3: travel left under everything
        line(stubOut, loopY, stubIn, loopY);
        // Leg 4: rise back up to target input pin
        line(stubIn, loopY, stubIn, toPin.worldY);
        // Leg 5: enter target input pin
        line(stubIn, toPin.worldY, toPin.worldX, toPin.worldY);

        // Arrowhead pointing INTO the target pin
        fill(col);
        noStroke();
        triangle(
            toPin.worldX, toPin.worldY,
            toPin.worldX - 9, toPin.worldY - 6,
            toPin.worldX - 9, toPin.worldY + 6
        );

        // "feedback" label sitting on the bottom horizontal leg
        fill(col);
        noStroke();
        textSize(10);
        textAlign(CENTER, BOTTOM);
        text('feedback', (stubOut + stubIn) / 2, loopY - 4);
    }

    draw(font, viewport) {
        push();
        viewport.apply();

        // ── build segment data for all forward edges ──────────────────────────
        const fwdData = [];
        for (const edge of this.edges) {
            if (edge.isFeedback) continue;
            const fromPin = edge.from.outputPin;
            const toPin =
                edge.to.inputPins[edge.inputIndex] ?? edge.to.inputPins[0];
            if (!fromPin || !toPin) continue;

            // Stagger midX per input so wires to the same target don't overlap
            const inputCount = edge.to.inputPins.length || 1;
            const spread = this.gridSize * 1.5;
            const offset = (edge.inputIndex - (inputCount - 1) / 2) * spread;

            const baseMidX = (fromPin.worldX + toPin.worldX) / 2;
            const lo = Math.min(fromPin.worldX, toPin.worldX) + this.gridSize;
            const hi = Math.max(fromPin.worldX, toPin.worldX) - this.gridSize;
            const midX = Math.max(lo, Math.min(hi, baseMidX + offset));
            fwdData.push({
                edge, fromPin, toPin, midX,
                segs: [
                    {
                        x1: fromPin.worldX, y1: fromPin.worldY,
                        x2: midX, y2: fromPin.worldY
                    },
                    {
                        x1: midX, y1: fromPin.worldY,
                        x2: midX, y2: toPin.worldY
                    },
                    {
                        x1: midX, y1: toPin.worldY,
                        x2: toPin.worldX, y2: toPin.worldY
                    },
                ],
            });
        }


        // ── find crossing X positions for every horizontal segment ────────────
        // hopMap key: "edgeIdx-segIdx(0or2)"  value: sorted [] of X values
        const hopMap = new Map();
        for (let i = 0; i < fwdData.length; i++) {
            for (let j = 0; j < fwdData.length; j++) {
                if (i === j) continue;
                const vSeg = fwdData[j].segs[1]; // the vertical segment of j
                const vx = vSeg.x1;
                const vy1 = Math.min(vSeg.y1, vSeg.y2);
                const vy2 = Math.max(vSeg.y1, vSeg.y2);

                for (const si of [0, 2]) {
                    const h = fwdData[i].segs[si];
                    const hx1 = Math.min(h.x1, h.x2);
                    const hx2 = Math.max(h.x1, h.x2);
                    const hy = h.y1;

                    // strict inequality — don't hop on shared endpoints
                    if (vx > hx1 && vx < hx2 && hy > vy1 && hy < vy2) {
                        const key = `${i}-${si}`;
                        if (!hopMap.has(key)) hopMap.set(key, []);
                        hopMap.get(key).push(vx);
                    }
                }
            }
        }
        for (const xs of hopMap.values()) xs.sort((a, b) => a - b);
        // ── debug ─────────────────────────────────────────────────────────────────
        const totalHops = [...hopMap.values()].reduce((s, v) => s + v.length, 0);
        console.log('hops detected:', totalHops, [...hopMap.entries()]);

        // ── draw forward edges ────────────────────────────────────────────────
        for (let i = 0; i < fwdData.length; i++) {
            const { edge, fromPin, toPin, midX, segs } = fwdData[i];
            const val = edge.from.getValue();
            const col = val === 1 ? '#4CAF50' : '#888888';
            stroke(col);
            strokeWeight(2.5);
            noFill();

            this._drawHSegWithHops(segs[0], hopMap.get(`${i}-0`) ?? [], col);
            line(segs[1].x1, segs[1].y1, segs[1].x2, segs[1].y2);
            this._drawHSegWithHops(segs[2], hopMap.get(`${i}-2`) ?? [], col);
        }

        // ── feedback edges ────────────────────────────────────────────────────
        for (const edge of this.edges) {
            if (!edge.isFeedback) continue;
            const fromPin = edge.from.outputPin;
            const toPin =
                edge.to.inputPins[edge.inputIndex] ?? edge.to.inputPins[0];
            if (!fromPin || !toPin) continue;
            this._drawFeedbackEdge(fromPin, toPin, edge.from.getValue());
        }

        // ── nodes on top ──────────────────────────────────────────────────────
        for (const gn of this.nodes) {
            gn.draw(
                font,
                this._rootSet.has(gn.logicNode),
                this._feedbackSet.has(gn.logicNode),
            );
        }

        pop();
    }

    /** Draw a horizontal segment, jumping over each crossing with a small arc. */
    _drawHSegWithHops(seg, hopXs, col) {
        const R = 6;
        stroke(col);
        strokeWeight(2.5);
        noFill();

        const y = seg.y1;
        // normalise direction so we always travel left→right
        const x1 = Math.min(seg.x1, seg.x2);
        const x2 = Math.max(seg.x1, seg.x2);

        // filter hops that actually lie within this segment
        const hops = hopXs.filter(hx => hx > x1 + R && hx < x2 - R);

        let curX = x1;
        for (const hx of hops) {
            // line up to the hop
            if (hx - R > curX) line(curX, y, hx - R, y);
            // cubic bezier bowing upward (lower Y = up on screen)
            bezier(
                hx - R, y,
                hx - R, y - R * 2,
                hx + R, y - R * 2,
                hx + R, y
            );
            curX = hx + R;
        }
        // remaining tail
        if (curX < x2) line(curX, y, x2, y);
    }
}