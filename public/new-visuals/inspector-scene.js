import { collectNodes, assignLayers, layoutNodes, nodeLabel, nodeKind } from './node-layout.js';
import { GraphNode } from './graph-visual-component.js';
import { FeedbackNode, SubCircuitOutputNode } from '../lib/nodes.js';

export class InspectorScene {
    constructor(circuit, gridSize, pathPrefix = '') {
        this.circuit = circuit;
        this.gridSize = gridSize;
        this.pathPrefix = pathPrefix; // Save the path prefix
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

        // Build CompositeNode → { outputIndex → name } from SubCircuitOutputNodes
        const compositeOutputNames = new Map();
        for (const logicNode of allNodes) {
            if (logicNode instanceof SubCircuitOutputNode && logicNode.name) {
                if (!compositeOutputNames.has(logicNode.compositeNode)) {
                    compositeOutputNames.set(logicNode.compositeNode, new Map());
                }
                compositeOutputNames
                    .get(logicNode.compositeNode)
                    .set(logicNode.outputIndex, logicNode.name);
            }
        }

        for (const [logicNode, pos] of positions) {
            if (logicNode instanceof SubCircuitOutputNode && !rootSet.has(logicNode)) {
                continue;
            }

            // Derive input pin labels from the connected nodes' names
            const inputArr = logicNode.inputNodes ?? logicNode.inputs ?? [];
            const inputPinLabels = inputArr.map(n => n?.name || '');

            // Derive output pin labels from SubCircuitOutputNode names
            const outNameMap = compositeOutputNames.get(logicNode) ?? new Map();
            const outCount =
                logicNode.subCircuit &&
                    typeof logicNode.subCircuit.outputLength === 'number'
                    ? logicNode.subCircuit.outputLength
                    : 1;
            const outputPinLabels = Array.from(
                { length: outCount },
                (_, i) => outNameMap.get(i) || ''
            );

            const gn = new GraphNode(
                logicNode,
                nodeLabel(logicNode),
                nodeKind(logicNode),
                pos.x, pos.y,
                this.gridSize,
                this.circuit,
                this.pathPrefix,
                inputPinLabels,
                outputPinLabels
            );
            this.nodes.push(gn);
            this.logicToGraph.set(logicNode, gn);
        }

        // ... (The rest of the _build routing logic remains exactly the same)
        for (const [logicNode, gn] of this.logicToGraph) {
            // We now explicitly route edges to a specific outputIndex
            const addEdge = (srcLogic, inputIndex, outputIndex = 0) => {
                const src = this.logicToGraph.get(srcLogic);
                if (!src) return;
                const isFeedback = src.x >= gn.x;
                this.edges.push({ from: src, to: gn, inputIndex, outputIndex, isFeedback });
            };

            const inps = logicNode.inputNodes ?? logicNode.inputs ?? [];
            inps.forEach((inp, i) => {
                if (inp instanceof SubCircuitOutputNode) {
                    addEdge(inp.compositeNode, i, inp.outputIndex);
                } else {
                    addEdge(inp, i, 0);
                }
            });

            if (logicNode.inputNode) {
                if (logicNode.inputNode instanceof SubCircuitOutputNode) {
                    addEdge(logicNode.inputNode.compositeNode, 0, logicNode.inputNode.outputIndex);
                } else {
                    addEdge(logicNode.inputNode, 0, 0);
                }
            }
            if (logicNode.compositeNode) {
                addEdge(logicNode.compositeNode, 0, logicNode.outputIndex);
            }
        }

        this._rootSet = rootSet;
        this._feedbackSet = feedbackSet;
    }

    // ── Segment builders ─────────────────────────────────────────────────────

    _getEdgeValue(edge) {
        const rawVal = edge.from.getValue();
        const valArray = Array.isArray(rawVal) ? rawVal : [rawVal];

        // Directly grab the value for this specific edge's output pin
        const pinVal = valArray[edge.outputIndex] ?? 0;
        return pinVal === 1 ? 1 : 0;
    }

    _forwardSegments(edge) {
        // Use the specific output pin instead of defaulting to 0
        const fromPin = edge.from.outputPins[edge.outputIndex] ?? edge.from.outputPins[0];
        const toPin = edge.to.inputPins[edge.inputIndex] ?? edge.to.inputPins[0];
        if (!fromPin || !toPin) return null;

        const inputCount = edge.to.inputPins.length || 1;
        const spread = this.gridSize * 1.5;
        const offset = (edge.inputIndex - (inputCount - 1) / 2) * spread;

        const baseMidX = (fromPin.worldX + toPin.worldX) / 2;
        const lo = Math.min(fromPin.worldX, toPin.worldX) + this.gridSize;
        const hi = Math.max(fromPin.worldX, toPin.worldX) - this.gridSize;
        const midX = Math.max(lo, Math.min(hi, baseMidX + offset));

        const parsedVal = this._getEdgeValue(edge);
        const col = parsedVal === 1 ? '#4CAF50' : '#888888';

        return {
            col,
            isDashed: false,
            fromPin, toPin,
            hSegs: [
                { x1: fromPin.worldX, y1: fromPin.worldY, x2: midX, y2: fromPin.worldY },
                { x1: midX, y1: toPin.worldY, x2: toPin.worldX, y2: toPin.worldY },
            ],
            vSegs: [
                { x1: midX, y1: fromPin.worldY, x2: midX, y2: toPin.worldY },
            ],
            arrowTo: null,
            label: null,
        };
    }

    _feedbackSegments(edge) {
        // Use the specific output pin instead of defaulting to 0
        const fromPin = edge.from.outputPins[edge.outputIndex] ?? edge.from.outputPins[0];
        const toPin = edge.to.inputPins[edge.inputIndex] ?? edge.to.inputPins[0];
        if (!fromPin || !toPin) return null;

        const parsedVal = this._getEdgeValue(edge);
        const col = parsedVal === 1 ? '#4CAF50' : '#888888';

        const loopY = Math.max(fromPin.worldY, toPin.worldY) + this.gridSize * 6;
        const stubOut = fromPin.worldX + this.gridSize * 3;
        const stubIn = toPin.worldX - this.gridSize * 3;

        return {
            col,
            isDashed: true,
            fromPin, toPin,
            hSegs: [
                { x1: fromPin.worldX, y1: fromPin.worldY, x2: stubOut, y2: fromPin.worldY },
                { x1: stubOut, y1: loopY, x2: stubIn, y2: loopY },
                { x1: stubIn, y1: toPin.worldY, x2: toPin.worldX, y2: toPin.worldY },
            ],
            vSegs: [
                { x1: stubOut, y1: fromPin.worldY, x2: stubOut, y2: loopY },
                { x1: stubIn, y1: loopY, x2: stubIn, y2: toPin.worldY },
            ],
            arrowTo: toPin,
            label: { text: 'feedback', x: (stubOut + stubIn) / 2, y: loopY - 4 },
        };
    }

    // ── Main draw ─────────────────────────────────────────────────────────────

    draw(font, viewport) {
        push();
        viewport.apply();

        const allData = [];
        for (const edge of this.edges) {
            const d = edge.isFeedback
                ? this._feedbackSegments(edge)
                : this._forwardSegments(edge);
            if (d) allData.push({ ...d, edge });
        }

        allData.sort((a, b) => {
            const va = this._getEdgeValue(a.edge);
            const vb = this._getEdgeValue(b.edge);
            return va - vb;
        });

        const allVerts = [];
        for (let i = 0; i < allData.length; i++) {
            for (const vs of allData[i].vSegs) {
                allVerts.push({
                    x: vs.x1,
                    y1: Math.min(vs.y1, vs.y2),
                    y2: Math.max(vs.y1, vs.y2),
                    dataIndex: i,
                });
            }
        }

        const hopMap = new Map();
        for (let i = 0; i < allData.length; i++) {
            const di = allData[i];
            for (let hi = 0; hi < di.hSegs.length; hi++) {
                const h = di.hSegs[hi];
                const hx1 = Math.min(h.x1, h.x2);
                const hx2 = Math.max(h.x1, h.x2);
                const hy = h.y1;

                const crossings = new Set();
                for (const v of allVerts) {
                    if (v.dataIndex === i) continue;
                    const dj = allData[v.dataIndex];
                    const sameFrom = di.fromPin.worldX === dj.fromPin.worldX && di.fromPin.worldY === dj.fromPin.worldY;
                    const sameTo = di.toPin.worldX === dj.toPin.worldX && di.toPin.worldY === dj.toPin.worldY;
                    if (sameFrom || sameTo) continue;

                    if (v.x > hx1 && v.x < hx2 && hy > v.y1 && hy < v.y2) {
                        crossings.add(v.x);
                    }
                }
                if (crossings.size > 0) {
                    const key = `${i}-h${hi}`;
                    hopMap.set(key, [...crossings].sort((a, b) => a - b));
                }
            }
        }

        // ── PASS 1: all vertical segments ─────────────────────────────────────
        for (const d of allData) {
            stroke(d.col);
            strokeWeight(2.5);
            noFill();

            if (d.isDashed) drawingContext.setLineDash([8, 6]);
            else drawingContext.setLineDash([]);

            for (const vs of d.vSegs) {
                line(vs.x1, vs.y1, vs.x2, vs.y2);
            }
        }

        // ── PASS 2: all horizontal segments (flat lines) ──────────────────────
        for (const d of allData) {
            stroke(d.col);
            strokeWeight(2.5);
            noFill();

            if (d.isDashed) drawingContext.setLineDash([8, 6]);
            else drawingContext.setLineDash([]);

            for (const hs of d.hSegs) {
                if (hs.x1 !== hs.x2 || hs.y1 !== hs.y2)
                    line(hs.x1, hs.y1, hs.x2, hs.y2);
            }
        }

        // ── PASS 3: hop arcs on top of everything ─────────────────────────────
        for (let i = 0; i < allData.length; i++) {
            const d = allData[i];
            for (let hi = 0; hi < d.hSegs.length; hi++) {
                const hops = hopMap.get(`${i}-h${hi}`);
                if (hops?.length) this._drawHopsOnly(d.hSegs[hi], hops, d.col, d.isDashed);
            }
        }

        drawingContext.setLineDash([]);

        // ── PASS 4: feedback arrowheads + labels ──────────────────────────────
        for (const d of allData) {
            if (!d.arrowTo) continue;

            fill(d.col);
            noStroke();
            triangle(
                d.arrowTo.worldX, d.arrowTo.worldY,
                d.arrowTo.worldX - 9, d.arrowTo.worldY - 6,
                d.arrowTo.worldX - 9, d.arrowTo.worldY + 6
            );

            if (d.label) {
                fill(d.col);
                noStroke();
                textSize(10);
                textAlign(CENTER, BOTTOM);
                text(d.label.text, d.label.x, d.label.y);
            }
        }

        // ── PASS 5: nodes on top of everything ────────────────────────────────
        for (const gn of this.nodes) {
            gn.draw(
                font,
                this._rootSet.has(gn.logicNode),
                this._feedbackSet.has(gn.logicNode),
            );
        }

        pop();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _drawHopsOnly(seg, hopXs, col, isDashed) {
        const R = 6;
        const y = seg.y1;
        const x1 = Math.min(seg.x1, seg.x2);
        const x2 = Math.max(seg.x1, seg.x2);
        const hops = hopXs.filter(hx => hx > x1 + R && hx < x2 - R);
        if (hops.length === 0) return;

        for (const hx of hops) {
            drawingContext.setLineDash([]);
            stroke(245);
            strokeWeight(5);
            line(hx - R, y, hx + R, y);

            if (isDashed) drawingContext.setLineDash([8, 6]);
            stroke(col);
            strokeWeight(2.5);
            noFill();
            bezier(
                hx - R, y,
                hx - R, y - R * 2,
                hx + R, y - R * 2,
                hx + R, y
            );
        }

        drawingContext.setLineDash([]);
    }
}