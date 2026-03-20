// File: public/new-visuals/modules/wire-handler.js

import { Wire } from '../wire.js';

export class WireHandler {
    constructor(m) {
        this.m = m;
    }

    finishWire(endNode) {
        const m = this.m;
        let outNode =
            m.startNode.type === 'OUTPUT' ? m.startNode : endNode;
        let inNode =
            m.startNode.type === 'INPUT' ? m.startNode : endNode;

        const duplicate = m.wires.some(
            w => w.startNode === outNode && w.endNode === inNode
        );
        if (duplicate) return this._resetWireState(m);

        const alreadyDriven = m.wires.some(w => w.endNode === inNode);
        if (alreadyDriven) {
            console.warn(
                '[Wire] Input node already has a driver — connection refused.'
            );
            return this._resetWireState(m);
        }

        const finalWaypoints =
            m.startNode.type === 'INPUT'
                ? [...m.waypoints].reverse()
                : [...m.waypoints];

        const newWire = new Wire(outNode, inNode, finalWaypoints);

        if (finalWaypoints.length === 0) {
            const dx = Math.abs(outNode.worldX - inNode.worldX);
            const dy = Math.abs(outNode.worldY - inNode.worldY);
            if (dx > 2 && dy > 2) {
                newWire.waypoints = Wire.generateAutoWaypoints(
                    outNode.worldX,
                    outNode.worldY,
                    inNode.worldX,
                    inNode.worldY,
                    m.gridSize,
                    newWire.invertU
                );
            }
        }

        m.wires.push(newWire);
        this._resetWireState(m);

        newWire.propagate();
        if (inNode.parent) inNode.parent.updateLogic();
    }

    cancelWireDraw() {
        const m = this.m;
        if (m.state === 'DRAWING_WIRE' && m.branchParentWire) {
            const wire = m.branchParentWire;
            if (
                m.branchInsertIndex >= 0 &&
                m.branchInsertIndex < wire.waypoints.length
            ) {
                wire.waypoints.splice(m.branchInsertIndex, 1);
                if (wire.segmentFlips) {
                    const newFlips = {};
                    for (const key in wire.segmentFlips) {
                        const k = parseInt(key);
                        if (k > m.branchInsertIndex)
                            newFlips[k - 1] = wire.segmentFlips[k];
                        else if (k < m.branchInsertIndex)
                            newFlips[k] = wire.segmentFlips[k];
                    }
                    wire.segmentFlips = newFlips;
                }
            }
        }
        m.state = 'IDLE';
        m.startNode = null;
        m.waypoints = [];
        m.branchParentWire = null;
        m.branchInsertIndex = -1;
        m.activeElement = null;
    }

    _resetWireState(m) {
        m.state = 'IDLE';
        m.startNode = null;
        m.waypoints = [];
        m.branchParentWire = null;
        m.branchInsertIndex = -1;
    }
}