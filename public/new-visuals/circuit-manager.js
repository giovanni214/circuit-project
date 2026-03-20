// File: public/new-visuals/circuit-manager.js

import { Viewport } from './viewport.js';
import { VisualComponent } from './visual-component.js';
import { SceneManager } from './modules/scene-manager.js';
import { WireHandler } from './modules/wire-handler.js';
import { InputHandler } from './modules/input-handler.js';
import { SimulationRunner } from './modules/simulation-runner.js';
import { Serializer } from './modules/serializer.js';
import { CircuitRenderer } from './modules/circuit-renderer.js';

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

        this.sceneStack = [];
        this.inspectorScene = null;
        this.inspectorCircuitName = '';

        this.savePromptActive = false;
        this.savePromptName = '';

        this.branchParentWire = null;
        this.branchInsertIndex = -1;
        this.branchStartX = 0;
        this.branchStartY = 0;
        this.branchScreenX = 0;
        this.branchScreenY = 0;

        this._scene = new SceneManager(this);
        this._wire = new WireHandler(this);
        this._input = new InputHandler(this);
        this._sim = new SimulationRunner(this);
        this._serial = new Serializer(this);
        this._renderer = new CircuitRenderer(this);
    }

    // ── Scene ───────────────────────────────────────────────────
    isInspecting() { return this._scene.isInspecting(); }
    drillIntoCircuit(ref, name) { this._scene.drillIntoCircuit(ref, name); }
    drillInto(comp) { this._scene.drillInto(comp); }
    drillOut() { this._scene.drillOut(); }

    // ── Wire ────────────────────────────────────────────────────
    finishWire(endNode) { this._wire.finishWire(endNode); }
    cancelWireDraw() { this._wire.cancelWireDraw(); }

    // ── Input ───────────────────────────────────────────────────
    handleMouseDrag(mx, my) { this._input.handleMouseDrag(mx, my); }
    handleMousePress(mx, my) { this._input.handleMousePress(mx, my); }
    handleMouseRelease() { this._input.handleMouseRelease(); }
    handleDoubleClick(mx, my) { this._input.handleDoubleClick(mx, my); }
    handleKeyDown(key, keyCode) { this._input.handleKeyDown(key, keyCode); }

    // ── Simulation ──────────────────────────────────────────────
    cascadeLogic() { this._sim.cascadeLogic(); }
    stepSimulation() { this._sim.stepSimulation(); }

    // ── Serialization ───────────────────────────────────────────
    serialize() { return this._serial.serialize(); }
    deserialize(data) { return this._serial.deserialize(data); }
    promptSave() { this._serial.promptSave(); }
    promptLoad() { this._serial.promptLoad(); }
    load(name) { this._serial.load(name); }

    // ── Draw ────────────────────────────────────────────────────
    draw(font) { this._renderer.draw(font); }

    // ── Helpers ─────────────────────────────────────────────────
    addComponent(type, x, y, gate = null) {
        this.components.push(
            new VisualComponent(
                type,
                this.snap(x),
                this.snap(y),
                this.gridSize,
                gate
            )
        );
    }

    snap(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    getHoveredNode(wx, wy, radiusOverride = null) {
        for (const comp of this.components) {
            const node = comp.getNodeAt(
                wx, wy, this.viewport.zoom, radiusOverride
            );
            if (node) return node;
        }
        return null;
    }
}