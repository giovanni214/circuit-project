// File: public/new-visuals/modules/wire-handler.js
import { Wire } from '../wire.js';

export class WireHandler {
    constructor(m) {
        this.m = m;
    }

    finishWire(endNode) {
        const m = this.m;

        let outNode = m.startNode.type === 'OUTPUT' ? m.startNode : endNode;
        let inNode = m.startNode.type === 'INPUT' ? m.startNode : endNode;

        const duplicate = m.wires.some(w => w.startNode === outNode && w.endNode === inNode);
        if (duplicate) return this._resetWireState(m);

        const alreadyDriven = m.wires.some(w => w.endNode === inNode && !inNode.isJunction);
        if (alreadyDriven) {
            alert('This input is already driven by another output. Please disconnect it first.');
            console.warn('[Wire] Input already driven.');
            return this._resetWireState(m);
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