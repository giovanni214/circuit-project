// File: public/new-visuals/modules/serializer.js

import { VisualComponent } from '../visual-component.js';
import { Wire } from '../wire.js';
import { CircuitRegistry } from '../circuit-registry.js';

export class Serializer {
    constructor(m) {
        this.m = m;
    }

    serialize() {
        const m = this.m;
        const compsData = m.components.map((c, i) => {
            c._saveId = i;
            return {
                id: i,
                type: c.type,
                x: c.x,
                y: c.y,
                gridSize: c.gridSize,
                gate: c.gate,
                value: c.value,
            };
        });

        const wiresData = m.wires.map(w => {
            const sc = w.startNode.parent;
            const ec = w.endNode.parent;
            const startIsOut = sc.outputNodes.includes(w.startNode);
            const endIsOut = ec.outputNodes.includes(w.endNode);
            return {
                startCompId: sc._saveId,
                startNodeType: w.startNode.type,
                startNodeIndex: startIsOut
                    ? sc.outputNodes.indexOf(w.startNode)
                    : sc.inputNodes.indexOf(w.startNode),
                endCompId: ec._saveId,
                endNodeType: w.endNode.type,
                endNodeIndex: endIsOut
                    ? ec.outputNodes.indexOf(w.endNode)
                    : ec.inputNodes.indexOf(w.endNode),
                waypoints: w.waypoints.map(wp => ({
                    x: wp.x,
                    y: wp.y,
                })),
                invertU: w.invertU,
            };
        });

        return { components: compsData, wires: wiresData };
    }

    deserialize(data) {
        const newComps = data.components.map(cd => {
            const c = new VisualComponent(
                cd.type,
                cd.x,
                cd.y,
                cd.gridSize,
                cd.gate
            );
            c.value = cd.value;
            c._saveId = cd.id;
            if (c.type === 'INPUT')
                c.outputNodes.forEach(n => (n.value = c.value));
            return c;
        });

        const newWires = data.wires.map(wd => {
            const sc = newComps.find(c => c._saveId === wd.startCompId);
            const ec = newComps.find(c => c._saveId === wd.endCompId);
            const startNode =
                wd.startNodeType === 'OUTPUT'
                    ? sc.outputNodes[wd.startNodeIndex]
                    : sc.inputNodes[wd.startNodeIndex];
            const endNode =
                wd.endNodeType === 'INPUT'
                    ? ec.inputNodes[wd.endNodeIndex]
                    : ec.outputNodes[wd.endNodeIndex];
            const w = new Wire(startNode, endNode, wd.waypoints);
            w.invertU = wd.invertU || 0;
            return w;
        });

        return { components: newComps, wires: newWires };
    }

    promptSave() {
        const name = prompt('Name this circuit:', 'MyCircuit');
        if (!name?.trim()) return;
        const trimmed = name.trim();
        const snapshot = this.serialize();
        CircuitRegistry.save(trimmed, snapshot);
        console.log(snapshot);
        alert(`Circuit "${trimmed}" saved!`);
    }

    promptLoad() {
        const names = CircuitRegistry.list();
        if (names.length === 0) {
            alert('Registry is empty. Save a circuit first with [S].');
            return;
        }
        const list = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
        const input = prompt(
            `Saved circuits:\n\n${list}\n\nEnter name or number to load:`
        );
        if (!input?.trim()) return;

        let name = input.trim();
        const idx = parseInt(name, 10);
        if (!isNaN(idx) && idx >= 1 && idx <= names.length)
            name = names[idx - 1];

        this.load(name);
    }

    load(name) {
        const m = this.m;
        const snapshot = CircuitRegistry.load(name);
        if (!snapshot) {
            alert(`No circuit found named "${name}".`);
            return;
        }
        const restored = this.deserialize(snapshot);
        m.components = restored.components;
        m.wires = restored.wires;
        m.activeElement = null;
        m.state = 'IDLE';
        for (const wire of m.wires) wire.propagate();
        for (const comp of m.components) comp.updateLogic();
        console.log(`[Registry] Loaded "${name}"`);
    }
}