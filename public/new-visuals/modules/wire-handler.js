// File: public/new-visuals/modules/wire-handler.js
import { Wire } from '../wire.js';

export class WireHandler {
    constructor(m) {
        this.m = m;
    }

    finishWire(endNode) {
        const m = this.m;

        let outNode = null;
        let inNode = null;

        // Resolve roles based on node types, falling back to treating it as output/input provider
        if (m.startNode.type === 'OUTPUT') outNode = m.startNode;
        else if (m.startNode.type === 'INPUT') inNode = m.startNode;
        else if (m.startNode.isJunction) outNode = m.startNode;
        else if (m.startNode.isDangling) outNode = m.startNode;

        if (endNode.type === 'OUTPUT') outNode = endNode;
        else if (endNode.type === 'INPUT') inNode = endNode;
        else if (endNode.isJunction) inNode = endNode;
        else if (endNode.isDangling) inNode = endNode;

        // Fallbacks if both are dangling or of matching types somehow
        if (!outNode) outNode = m.startNode;
        if (!inNode) inNode = endNode;

        // Skip duplicate checks if either end is dangling 
        if (!outNode.isDangling && !inNode.isDangling) {
            const duplicate = m.wires.some(w => w.startNode === outNode && w.endNode === inNode);
            if (duplicate) return this._resetWireState(m);
        }

        if (!inNode.isDangling && !inNode.isJunction) {
            const alreadyDriven = m.wires.some(w => w.endNode === inNode && !inNode.isJunction);
            if (alreadyDriven) {
                alert('This input is already driven by another output. Please disconnect it first.');
                console.warn('[Wire] Input already driven.');
                return this._resetWireState(m);
            }
        }

        // Pass waypoints to wire creation
        const newWire = new Wire(outNode, inNode, [...m.waypoints]);
        m.wires.push(newWire);

        newWire.propagate();
        if (inNode.parent) inNode.parent.updateLogic();

        this._resetWireState(m);
    }

    cancelWireDraw() {
        this._resetWireState(this.m);
    }

    _resetWireState(m) {
        m.state = 'IDLE';
        m.startNode = null;
        m.waypoints = [];
    }
}