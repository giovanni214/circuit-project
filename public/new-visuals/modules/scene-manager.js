// File: public/new-visuals/modules/scene-manager.js

import { InspectorScene } from '../inspector-scene.js';

export class SceneManager {
    constructor(m) {
        this.m = m;
    }

    isInspecting() {
        // Return true for both the idle inspect state and the panning inspect state
        return this.m.state === 'INSPECTING' || this.m.state === 'INSPECTING_PAN';
    }

    drillIntoCircuit(circuitRef, name) {
        const m = this.m;
        if (!circuitRef?.rootNodes) return;

        m.sceneStack.push({
            crumbName: this.isInspecting()
                ? m.inspectorCircuitName
                : 'ROOT',
            state: m.state,
            components: m.components,
            wires: m.wires,
            inspectorScene: m.inspectorScene,
            inspectorCircuitName: m.inspectorCircuitName,
            panX: m.viewport.x,
            panY: m.viewport.y,
            zoom: m.viewport.zoom,
        });

        const pathNames = m.sceneStack
            .filter(s => s.crumbName !== 'ROOT')
            .map(s => s.crumbName);
        if (name) pathNames.push(name);

        m.inspectorScene = new InspectorScene(
            circuitRef,
            m.gridSize,
            pathNames.join(' > ')
        );
        m.inspectorCircuitName = name || 'SubCircuit';

        m.components = [];
        m.wires = [];
        m.viewport.x = 0;
        m.viewport.y = 0;
        m.viewport.zoom = 1;
        m.state = 'INSPECTING';
    }

    drillInto(comp) {
        if (!comp?.gate?.rootNodes) return;
        this.drillIntoCircuit(comp.gate, comp.gate.name);
    }

    drillOut() {
        const m = this.m;
        if (m.sceneStack.length === 0) return;
        const prev = m.sceneStack.pop();

        // Ensure we don't accidentally restore an 'INSPECTING_PAN' state if we back out mid-drag
        m.state = prev.state === 'INSPECTING_PAN' ? 'INSPECTING' : prev.state;

        m.components = prev.components;
        m.wires = prev.wires;
        m.inspectorScene = prev.inspectorScene;
        m.inspectorCircuitName = prev.inspectorCircuitName;
        m.viewport.x = prev.panX;
        m.viewport.y = prev.panY;
        m.viewport.zoom = prev.zoom;
    }
}