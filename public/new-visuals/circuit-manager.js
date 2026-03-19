import { Viewport } from './viewport.js';
import { VisualComponent } from './visual-component.js';
import { Wire } from './wire.js';
import { InspectorScene } from './inspector-scene.js';
import { CircuitRegistry } from './circuit-registry.js';

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

        // Scene stack for drill-in navigation
        this.sceneStack = []; // { components, wires, name, viewport }

        // Inspector
        this.inspectorScene = null;  // active InspectorScene when drilling
        this.inspectorCircuitName = '';

        // Save prompt
        this.savePromptActive = false;
        this.savePromptName = '';
    }

    // ── Scene Drill-In / Drill-Out ──────────────────────────────

    drillInto(comp) {
        if (!comp?.gate?.rootNodes) return;

        // Push current scene
        this.sceneStack.push({
            components: this.components,
            wires: this.wires,
            name: 'ROOT',
            panX: this.viewport.x,
            panY: this.viewport.y,
            zoom: this.viewport.zoom
        });

        this.inspectorScene = new InspectorScene(comp.gate, this.gridSize);
        this.inspectorCircuitName = comp.gate.name;

        // Clear interactive components — inspector is read-only for now
        this.components = [];
        this.wires = [];

        // Reset viewport
        this.viewport.x = 0;
        this.viewport.y = 0;
        this.viewport.zoom = 1;

        this.state = 'INSPECTING';
    }

    drillOut() {
        if (this.sceneStack.length === 0) return;
        const prev = this.sceneStack.pop();
        this.components = prev.components;
        this.wires = prev.wires;
        this.viewport.x = prev.panX;
        this.viewport.y = prev.panY;
        this.viewport.zoom = prev.zoom;
        this.inspectorScene = null;
        this.inspectorCircuitName = '';
        this.state = 'IDLE';
    }

    isInspecting() {
        return this.state === 'INSPECTING';
    }

    // ── Save Circuit ────────────────────────────────────────────

    // Add these serialization helpers anywhere inside the CircuitManager class
    serialize() {
        const compsData = this.components.map((c, i) => {
            c._saveId = i;
            return {
                id: i,
                type: c.type,
                x: c.x,
                y: c.y,
                gridSize: c.gridSize,
                gate: c.gate, // Retain reference to the logic gate
                value: c.value
            };
        });

        const wiresData = this.wires.map(w => {
            const startComp = w.startNode.parent;
            const endComp = w.endNode.parent;

            const startIsOut = startComp.outputNodes.includes(w.startNode);
            const startNodeIndex = startIsOut
                ? startComp.outputNodes.indexOf(w.startNode)
                : startComp.inputNodes.indexOf(w.startNode);

            const endIsOut = endComp.outputNodes.includes(w.endNode);
            const endNodeIndex = endIsOut
                ? endComp.outputNodes.indexOf(w.endNode)
                : endComp.inputNodes.indexOf(w.endNode);

            return {
                startCompId: startComp._saveId,
                startNodeType: w.startNode.type,
                startNodeIndex,
                endCompId: endComp._saveId,
                endNodeType: w.endNode.type,
                endNodeIndex,
                waypoints: w.waypoints.map(wp => ({ x: wp.x, y: wp.y })),
                invertU: w.invertU
            };
        });

        return { components: compsData, wires: wiresData };
    }

    deserialize(data) {
        const newComps = data.components.map(cd => {
            const c = new VisualComponent(cd.type, cd.x, cd.y, cd.gridSize, cd.gate);
            c.value = cd.value;
            c._saveId = cd.id;
            // Restore initial output node states for inputs
            if (c.type === 'INPUT') c.outputNodes.forEach(n => n.value = c.value);
            return c;
        });

        const newWires = data.wires.map(wd => {
            const startComp = newComps.find(c => c._saveId === wd.startCompId);
            const endComp = newComps.find(c => c._saveId === wd.endCompId);

            const startNode = wd.startNodeType === 'OUTPUT'
                ? startComp.outputNodes[wd.startNodeIndex]
                : startComp.inputNodes[wd.startNodeIndex];

            const endNode = wd.endNodeType === 'INPUT'
                ? endComp.inputNodes[wd.endNodeIndex]
                : endComp.outputNodes[wd.endNodeIndex];

            const w = new Wire(startNode, endNode, wd.waypoints);
            w.invertU = wd.invertU || 0;
            return w;
        });

        return { components: newComps, wires: newWires };
    }

    // Update your promptSave and promptLoad methods to use the serializers:
    promptSave() {
        const name = prompt('Name this circuit:', 'MyCircuit');
        if (!name?.trim()) return;
        const trimmed = name.trim();

        // Serialize a deep clone instead of a shallow reference
        const snapshot = this.serialize();

        CircuitRegistry.save(trimmed, snapshot);
        alert(`Circuit "${trimmed}" saved! You can now load it from the registry.`);
    }

    promptLoad() {
        const names = CircuitRegistry.list();

        if (names.length === 0) {
            alert('Registry is empty. Save a circuit first with [S].');
            return;
        }

        const list = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
        const input = prompt(`Saved circuits:\n\n${list}\n\nEnter name or number to load:`);
        if (!input?.trim()) return;

        let name = input.trim();
        const asIndex = parseInt(name, 10);
        if (!isNaN(asIndex) && asIndex >= 1 && asIndex <= names.length) {
            name = names[asIndex - 1];
        }

        const snapshot = CircuitRegistry.load(name);
        if (!snapshot) {
            alert(`No circuit found named "${name}".`);
            return;
        }

        // Deserialize to recreate the layout properly
        const restored = this.deserialize(snapshot);
        this.components = restored.components;
        this.wires = restored.wires;
        this.activeElement = null;
        this.state = 'IDLE';

        // Ensure all logic paths match their new states without running a full simulation tick
        for (let wire of this.wires) wire.propagate();
        for (let comp of this.components) comp.updateLogic();

        console.log(`[Registry] Loaded "${name}"`);
    }

    // Update finishWire to push the signal into the connected component instantly
    finishWire(endNode) {
        let outNode = this.startNode.type === 'OUTPUT' ? this.startNode : endNode;
        let inNode = this.startNode.type === 'INPUT' ? this.startNode : endNode;
        let finalWaypoints =
            this.startNode.type === 'INPUT'
                ? [...this.waypoints].reverse()
                : [...this.waypoints];

        let newWire = new Wire(outNode, inNode, finalWaypoints);
        if (finalWaypoints.length === 0) {
            const dx = Math.abs(outNode.worldX - inNode.worldX);
            const dy = Math.abs(outNode.worldY - inNode.worldY);

            if (dx > 2 && dy > 2) {
                // Only auto-route true diagonal connections
                newWire.waypoints = Wire.generateAutoWaypoints(
                    outNode.worldX, outNode.worldY,
                    inNode.worldX, inNode.worldY,
                    this.gridSize,
                    newWire.invertU
                );
            }
            // dx ≈ 0 → vertical straight line, dy ≈ 0 → horizontal straight line
            // both cases: getSegments() draws clean with no waypoints
        }

        this.wires.push(newWire);
        this.state = 'IDLE';
        this.startNode = null;
        this.waypoints = [];

        // Propagate only the newly connected wire's signal into its direct target
        newWire.propagate();
        if (inNode.parent) {
            inNode.parent.updateLogic();
        }
    }



    // ── Main Draw ───────────────────────────────────────────────

    // ── Main Draw ───────────────────────────────────────────────



    _drawInspector(font) {
        background(245);

        push();
        this.viewport.apply();
        this.viewport.drawGrid(this.gridSize);
        pop();

        this.inspectorScene.draw(font, this.viewport);

        this._drawInspectorHUD(font);
    }

    _drawHUD(font) {
        fill(0);
        noStroke();
        textSize(14);
        textAlign(LEFT, TOP);
        text(
            `Zoom: ${Math.floor(this.viewport.zoom * 100)}%` +
            ` | [Space] Tick | [Shift+Click Wire] Add Joint` +
            ` | Dbl-Click line to flip route | Dbl-Click circuit to inspect` +
            ` | [S] Save  |  [L] Load`,
            10,
            height - 18
        );
    }

    _drawInspectorHUD(font) {
        // Breadcrumb bar
        fill(30);
        noStroke();
        rect(0, 0, width, 40);

        fill(255);
        noStroke();
        textFont(font);
        textSize(13);
        textAlign(LEFT, CENTER);

        const crumbs = this.sceneStack.map(s => s.name).join(' > ');
        const full = crumbs ? `${crumbs} > ${this.inspectorCircuitName}` : this.inspectorCircuitName;
        text(`Inspecting: ${full}`, 12, 20);

        // Back button
        fill(80, 80, 80);
        stroke(150);
        strokeWeight(1);
        rect(width - 124, 8, 124, 24, 4);

        fill(255);
        noStroke();
        textSize(12);
        textAlign(CENTER, CENTER);
        text('<< Back  [Esc]', width - 62, 20);

        // Legend
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

    // handleMouseDrag — PREPARE_BRANCH block only
    handleMouseDrag(mx, my) {
        if (this.isInspecting()) {
            this.viewport.updatePan(mx, my);
            return;
        }

        if (this.state === 'PREPARE_BRANCH' && this.activeElement instanceof Wire) {
            if (dist(mx, my, this.branchScreenX, this.branchScreenY) > 5) {
                const wire = this.activeElement;

                this.state = 'DRAWING_WIRE';
                this.startNode = wire.startNode;
                // Junction point becomes the first (and only) waypoint to start from
                this.waypoints = [{ x: this.branchStartX, y: this.branchStartY }];
                this.branchParentWire = wire; // remember for preview hint only
                this.activeElement = null;
            }
        }

        if (this.state === 'PANNING') {
            this.viewport.updatePan(mx, my);
        } else if (this.state === 'DRAGGING_COMP' && this.activeElement) {
            const worldPt = this.viewport.getWorldCoords(mx, my);
            this.activeElement.x = this.snap(worldPt.x - this.activeElement.dragOffset.x);
            this.activeElement.y = this.snap(worldPt.y - this.activeElement.dragOffset.y);
            this.activeElement.updateNodes();
        } else if (this.state === 'DRAGGING_WAYPOINT' && this.activeElement instanceof Wire) {
            const worldPt = this.viewport.getWorldCoords(mx, my);
            const wp = this.activeElement.waypoints[this.activeWaypointIndex];
            if (wp) {
                wp.x = this.snap(worldPt.x);
                wp.y = this.snap(worldPt.y);
            }
        }
    }

    // cancelWireDraw — no parent healing needed anymore
    cancelWireDraw() {
        this.state = 'IDLE';
        this.startNode = null;
        this.waypoints = [];
        this.branchParentWire = null;
        this.branchInsertIndex = -1;
        this.activeElement = null;
    }

    draw(font) {
        if (this.isInspecting()) {
            this._drawInspector(font);
            return;
        }

        push();
        this.viewport.apply();
        this.viewport.drawGrid(this.gridSize);

        for (let comp of this.components) {
            comp.draw(font, this.activeElement === comp);
        }

        for (let wire of this.wires) {
            wire.draw(this.activeElement === wire);
        }

        if (this.state === 'DRAWING_WIRE' && this.startNode) {
            const worldMouse = this.viewport.getWorldCoords(mouseX, mouseY);

            Wire.drawPreview(
                this.startNode,
                worldMouse,
                this.gridSize,
                this.waypoints,
                !!this.branchParentWire  // simple boolean: are we branching?
            );

            const targetNode = this.getHoveredNode(worldMouse.x, worldMouse.y);
            if (targetNode && targetNode !== this.startNode && targetNode.type !== this.startNode.type) {
                push();
                stroke(0, 150, 255, 200);
                strokeWeight(3);
                noFill();
                ellipse(targetNode.worldX, targetNode.worldY, 24);
                pop();
            }
        }

        pop();

        if (this.inspectedComponent) {
            this.drawStatePopup(font);
        }

        this._drawHUD(font);
    }

    handleMousePress(mx, my) {
        if (mouseButton === RIGHT) {
            if (this.state === 'DRAWING_WIRE') {
                this.cancelWireDraw();
            }
            return;
        }

        if (this.isInspecting()) {
            if (mx >= width - 110 && mx <= width - 14 && my >= 8 && my <= 32) {
                this.drillOut();
                return;
            }
            this.state = 'INSPECTING';
            this.viewport.startPan(mx, my);
            return;
        }

        let worldPt = this.viewport.getWorldCoords(mx, my);

        if (this.state === 'DRAWING_WIRE') {
            let node = this.getHoveredNode(worldPt.x, worldPt.y);
            if (node && node !== this.startNode && node.type !== this.startNode.type) {
                this.finishWire(node);
                this.branchParentWire = null;
                this.branchInsertIndex = -1;
            } else if (!node) {
                this.waypoints.push({
                    x: this.snap(worldPt.x),
                    y: this.snap(worldPt.y)
                });
            }
            return;
        }

        let node = this.getHoveredNode(worldPt.x, worldPt.y, 10 / this.viewport.zoom);
        if (node) {
            this.state = 'DRAWING_WIRE';
            this.startNode = node;
            this.waypoints = [];
            this.activeElement = null;
            this.branchParentWire = null;
            this.branchInsertIndex = -1;
            return;
        }

        for (let i = this.components.length - 1; i >= 0; i--) {
            let comp = this.components[i];

            if (comp.isClockHit(worldPt.x, worldPt.y)) {
                let nextClk = comp.gate.getClock() === 0 ? 1 : 0;
                comp.gate.setClock(nextClk);
                this.cascadeLogic();
                return;
            }

            if (comp.isHit(worldPt.x, worldPt.y)) {
                this.state = 'DRAGGING_COMP';
                this.activeElement = comp;
                this.components.splice(i, 1);
                this.components.push(comp);
                comp.dragOffset = {
                    x: worldPt.x - comp.x,
                    y: worldPt.y - comp.y
                };
                return;
            }
        }

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
                    this.state = 'PREPARE_BRANCH';
                    this.branchStartX = this.snap(worldPt.x);
                    this.branchStartY = this.snap(worldPt.y);
                    this.branchScreenX = mx;
                    this.branchScreenY = my;
                }
                return;
            }
        }

        this.activeElement = null;
        this.state = 'PANNING';
        this.viewport.startPan(mx, my);
    }


    handleMouseRelease() {
        if (this.isInspecting()) return;

        let worldPt = this.viewport.getWorldCoords(mouseX, mouseY);

        if (this.state === 'DRAWING_WIRE' && this.startNode) {
            let endNode = this.getHoveredNode(worldPt.x, worldPt.y);
            let d = dist(this.startNode.worldX, this.startNode.worldY, worldPt.x, worldPt.y);

            if (endNode && endNode !== this.startNode && endNode.type !== this.startNode.type && d > 10) {
                this.finishWire(endNode);
                this.branchParentWire = null;
                this.branchInsertIndex = -1;
                return;
            }

            if (this.startNode.type === 'INPUT') {
                for (let targetWire of this.wires) {
                    if (targetWire.isHit(worldPt.x, worldPt.y, this.viewport.zoom)) {
                        let snappedX = this.snap(worldPt.x);
                        let snappedY = this.snap(worldPt.y);

                        let outNode = targetWire.startNode;
                        let inNode = this.startNode;

                        let insertIndex = targetWire.insertWaypointAt(snappedX, snappedY, this.gridSize);
                        let parentPath = targetWire.waypoints.slice(0, insertIndex + 1);
                        let drawnPath = [...this.waypoints].reverse();
                        let finalWaypoints = [...parentPath, ...drawnPath];

                        let newWire = new Wire(outNode, inNode, finalWaypoints);
                        this.wires.push(newWire);

                        this.state = 'IDLE';
                        this.startNode = null;
                        this.waypoints = [];
                        this.branchParentWire = null;
                        this.branchInsertIndex = -1;

                        newWire.propagate();
                        if (inNode.parent) {
                            inNode.parent.updateLogic();
                        }
                        return;
                    }
                }
            }


            return;
        }

        if (this.state === 'DRAGGING_WAYPOINT' || this.state === 'DRAGGING_COMP' || this.state === 'PANNING' || this.state === 'PREPARE_BRANCH') {
            this.state = 'IDLE';
            this.activeWaypointIndex = -1;
            this.activeElement = null;
            this.branchParentWire = null;
            this.branchInsertIndex = -1;
        }
    }

    handleDoubleClick(mx, my) {
        if (this.isInspecting()) return;

        if (this.inspectedComponent) {
            this.inspectedComponent = null;
            return;
        }

        // NEW: Safely abort drag on double click
        if (this.state === 'PREPARE_BRANCH' || this.state === 'DRAWING_WIRE') {
            if (this.state === 'DRAWING_WIRE') this.cancelWireDraw();
            else {
                this.state = 'IDLE';
                this.activeElement = null;
            }
        }

        let worldPt = this.viewport.getWorldCoords(mx, my);

        // ... rest of the method logic remains exactly the same
        let hitWaypoints = [];
        for (let wire of this.wires) {
            let wpIdx = wire.getHitWaypointIndex(worldPt.x, worldPt.y, this.viewport.zoom);
            if (wpIdx !== -1) hitWaypoints.push({ wire, wpIdx });
        }

        if (hitWaypoints.length > 0) {
            for (let item of hitWaypoints) {
                let wire = item.wire;
                wire.waypoints.splice(item.wpIdx, 1);

                if (wire.segmentFlips) {
                    let newFlips = {};
                    for (let key in wire.segmentFlips) {
                        let k = parseInt(key);
                        if (k > item.wpIdx) newFlips[k - 1] = wire.segmentFlips[k];
                        else if (k < item.wpIdx) newFlips[k] = wire.segmentFlips[k];
                    }
                    wire.segmentFlips = newFlips;
                }
            }
            return;
        }

        let hitSegments = [];
        for (let wire of this.wires) {
            let segIdx = wire.getHitSegmentIndex(worldPt.x, worldPt.y, this.viewport.zoom);
            if (segIdx !== -1) hitSegments.push({ wire, segIdx });
        }

        if (hitSegments.length > 0) {
            let firstWire = hitSegments[0].wire;
            let firstIdx = hitSegments[0].segIdx;
            let newState = firstWire.segmentFlips ? !firstWire.segmentFlips[firstIdx] : true;

            for (let item of hitSegments) {
                let wire = item.wire;
                if (!wire.segmentFlips) wire.segmentFlips = {};
                wire.segmentFlips[item.segIdx] = newState;
            }
            return;
        }

        for (let comp of this.components) {
            if (comp.isHit(worldPt.x, worldPt.y)) {
                if (comp.type === 'CIRCUIT' && comp.gate?.rootNodes) {
                    this.drillInto(comp);
                } else {
                    comp.toggleState();
                }
                return;
            }
        }
    }

    handleKeyDown(key, keyCode) {
        if (this.isInspecting()) {
            if (key === 'Escape') this.drillOut();
            return;
        }

        if (this.state === 'DRAWING_WIRE') {
            // Escape key cancels the wire
            if (keyCode === 27 || key === 'Escape') {
                this.cancelWireDraw();
                return;
            }

            // Spacebar drops a joint at your current mouse position
            if (keyCode === 32 || key === ' ') {
                let worldPt = this.viewport.getWorldCoords(mouseX, mouseY);
                this.waypoints.push({
                    x: this.snap(worldPt.x),
                    y: this.snap(worldPt.y)
                });
                return;
            }
        }

        if (key === ' ') {
            this.stepSimulation();
        } else if (key === 's' || key === 'S') {
            this.promptSave();
        } else if (key === 'l' || key === 'L') {
            this.promptLoad();
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
                    this.wires = this.wires.filter(
                        w =>
                            w.startNode.parent !== this.activeElement &&
                            w.endNode.parent !== this.activeElement
                    );
                }
                this.activeElement = null;
            }
        }
    }

    // ── Simulation ──────────────────────────────────────────────

    cascadeLogic() {
        for (let i = 0; i < this.components.length + 2; i++) {
            for (let wire of this.wires) wire.propagate();
            for (let comp of this.components) comp.updateLogic();
        }
    }

    stepSimulation() {
        this.cascadeLogic();
    }

    // ── Helpers ─────────────────────────────────────────────────

    addComponent(type, x, y, gate = null) {
        let snappedX = this.snap(x);
        let snappedY = this.snap(y);
        this.components.push(
            new VisualComponent(type, snappedX, snappedY, this.gridSize, gate)
        );
    }

    snap(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    // Locate this helper near the bottom of circuit-manager.js and replace it
    getHoveredNode(wx, wy, radiusOverride = null) {
        for (let comp of this.components) {
            let node = comp.getNodeAt(wx, wy, this.viewport.zoom, radiusOverride);
            if (node) return node;
        }
        return null;
    }



    // ── State Popup (unchanged from before) ────────────────────

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
}