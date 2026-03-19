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
        this.sceneStack = [];

        // Inspector
        this.inspectorScene = null;
        this.inspectorCircuitName = '';

        // Save prompt
        this.savePromptActive = false;
        this.savePromptName = '';

        // Branch state
        this.branchParentWire = null;
        this.branchInsertIndex = -1;
        this.branchStartX = 0;
        this.branchStartY = 0;
        this.branchScreenX = 0;
        this.branchScreenY = 0;
    }

    // ── Scene Drill-In / Drill-Out ──────────────────────────────

    // NEW: A robust drill function that accepts raw circuit data
    // NEW: A robust drill function that accepts raw circuit data
    drillIntoCircuit(circuitRef, name) {
        if (!circuitRef?.rootNodes) return;

        // Push the current scene state (works for both ROOT and nested inspectors)
        this.sceneStack.push({
            crumbName: this.isInspecting() ? this.inspectorCircuitName : 'ROOT',
            state: this.state,
            components: this.components,
            wires: this.wires,
            inspectorScene: this.inspectorScene,
            inspectorCircuitName: this.inspectorCircuitName,
            panX: this.viewport.x,
            panY: this.viewport.y,
            zoom: this.viewport.zoom
        });

        // --- NEW: Calculate the full hierarchy path for node labels ---
        // --- NEW: Calculate the full hierarchy path for node labels ---
        let pathNames = [];
        for (let s of this.sceneStack) {
            // We ignore 'ROOT' so it doesn't say "ROOT > Full Adder"
            if (s.crumbName !== 'ROOT') {
                pathNames.push(s.crumbName);
            }
        }
        // Only append the current name if it exists to avoid trailing arrows
        if (name) pathNames.push(name);

        // Use a breadcrumb separator instead of a newline!
        const pathPrefix = pathNames.join(' > ');
        // -------------------------------------------------------------
        // -------------------------------------------------------------

        // Generate the new inspector view and pass the pathPrefix
        this.inspectorScene = new InspectorScene(circuitRef, this.gridSize, pathPrefix);
        this.inspectorCircuitName = name || 'SubCircuit';

        this.components = [];
        this.wires = [];

        this.viewport.x = 0;
        this.viewport.y = 0;
        this.viewport.zoom = 1;

        this.state = 'INSPECTING';
    }

    drillInto(comp) {
        if (!comp?.gate?.rootNodes) return;
        // Strictly use the instance name!
        this.drillIntoCircuit(comp.gate, comp.gate.name);
    }

    drillOut() {
        if (this.sceneStack.length === 0) return;

        // Pop the stack and perfectly restore the previous state
        const prev = this.sceneStack.pop();
        this.state = prev.state;
        this.components = prev.components;
        this.wires = prev.wires;
        this.inspectorScene = prev.inspectorScene;
        this.inspectorCircuitName = prev.inspectorCircuitName;
        this.viewport.x = prev.panX;
        this.viewport.y = prev.panY;
        this.viewport.zoom = prev.zoom;
    }

    isInspecting() {
        return this.state === 'INSPECTING';
    }

    // ── Serialization ───────────────────────────────────────────

    serialize() {
        const compsData = this.components.map((c, i) => {
            c._saveId = i;
            return {
                id: i,
                type: c.type,
                x: c.x,
                y: c.y,
                gridSize: c.gridSize,
                gate: c.gate,
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
            if (c.type === 'INPUT') c.outputNodes.forEach(n => (n.value = c.value));
            return c;
        });

        const newWires = data.wires.map(wd => {
            const startComp = newComps.find(c => c._saveId === wd.startCompId);
            const endComp = newComps.find(c => c._saveId === wd.endCompId);

            const startNode =
                wd.startNodeType === 'OUTPUT'
                    ? startComp.outputNodes[wd.startNodeIndex]
                    : startComp.inputNodes[wd.startNodeIndex];

            const endNode =
                wd.endNodeType === 'INPUT'
                    ? endComp.inputNodes[wd.endNodeIndex]
                    : endComp.outputNodes[wd.endNodeIndex];

            const w = new Wire(startNode, endNode, wd.waypoints);
            w.invertU = wd.invertU || 0;
            return w;
        });

        return { components: newComps, wires: newWires };
    }

    // ── Save / Load ─────────────────────────────────────────────

    promptSave() {
        const name = prompt('Name this circuit:', 'MyCircuit');
        if (!name?.trim()) return;
        const trimmed = name.trim();
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

        const restored = this.deserialize(snapshot);
        this.components = restored.components;
        this.wires = restored.wires;
        this.activeElement = null;
        this.state = 'IDLE';

        for (let wire of this.wires) wire.propagate();
        for (let comp of this.components) comp.updateLogic();

        console.log(`[Registry] Loaded "${name}"`);
    }

    // ── Wire Drawing ────────────────────────────────────────────

    finishWire(endNode) {
        let outNode = this.startNode.type === 'OUTPUT' ? this.startNode : endNode;
        let inNode = this.startNode.type === 'INPUT' ? this.startNode : endNode;

        // Guard: prevent duplicate wires (same out→in pair)
        const duplicate = this.wires.some(
            w => w.startNode === outNode && w.endNode === inNode
        );
        if (duplicate) {
            this.state = 'IDLE';
            this.startNode = null;
            this.waypoints = [];
            return;
        }

        // Guard: prevent multiple drivers on one input node
        const alreadyDriven = this.wires.some(w => w.endNode === inNode);
        if (alreadyDriven) {
            console.warn('[Wire] Input node already has a driver — connection refused.');
            this.state = 'IDLE';
            this.startNode = null;
            this.waypoints = [];
            return;
        }

        let finalWaypoints =
            this.startNode.type === 'INPUT'
                ? [...this.waypoints].reverse()
                : [...this.waypoints];

        let newWire = new Wire(outNode, inNode, finalWaypoints);

        if (finalWaypoints.length === 0) {
            const dx = Math.abs(outNode.worldX - inNode.worldX);
            const dy = Math.abs(outNode.worldY - inNode.worldY);
            if (dx > 2 && dy > 2) {
                newWire.waypoints = Wire.generateAutoWaypoints(
                    outNode.worldX, outNode.worldY,
                    inNode.worldX, inNode.worldY,
                    this.gridSize,
                    newWire.invertU
                );
            }
        }

        this.wires.push(newWire);
        this.state = 'IDLE';
        this.startNode = null;
        this.waypoints = [];
        this.branchParentWire = null;
        this.branchInsertIndex = -1;

        newWire.propagate();
        if (inNode.parent) inNode.parent.updateLogic();
    }

    cancelWireDraw() {
        if (this.state === 'DRAWING_WIRE' && this.branchParentWire) {
            let wire = this.branchParentWire;
            if (this.branchInsertIndex >= 0 && this.branchInsertIndex < wire.waypoints.length) {
                wire.waypoints.splice(this.branchInsertIndex, 1);

                if (wire.segmentFlips) {
                    let newFlips = {};
                    for (let key in wire.segmentFlips) {
                        let k = parseInt(key);
                        if (k > this.branchInsertIndex) newFlips[k - 1] = wire.segmentFlips[k];
                        else if (k < this.branchInsertIndex) newFlips[k] = wire.segmentFlips[k];
                    }
                    wire.segmentFlips = newFlips;
                }
            }
        }

        this.state = 'IDLE';
        this.startNode = null;
        this.waypoints = [];
        this.branchParentWire = null;
        this.branchInsertIndex = -1;
        this.activeElement = null;
    }

    // ── Draw ────────────────────────────────────────────────────

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
                this.branchParentWire ? this.branchInsertIndex : -1
            );

            const targetNode = this.getHoveredNode(worldMouse.x, worldMouse.y);
            if (
                targetNode &&
                targetNode !== this.startNode &&
                targetNode.type !== this.startNode.type
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

        if (this.inspectedComponent) {
            this.drawStatePopup(font);
        }

        this._drawHUD(font);
    }

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
        fill(30);
        noStroke();
        rect(0, 0, width, 40);

        fill(255);
        noStroke();
        textFont(font);
        textSize(13);
        textAlign(LEFT, CENTER);

        // UPDATE: Use crumbName so it renders deeply nested paths properly
        const crumbs = this.sceneStack.map(s => s.crumbName).join(' > ');
        const full = crumbs
            ? `${crumbs} > ${this.inspectorCircuitName}`
            : this.inspectorCircuitName;
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

    // ── Input Handling ──────────────────────────────────────────

    handleMouseDrag(mx, my) {
        if (this.isInspecting()) {
            this.viewport.updatePan(mx, my);
            return;
        }

        if (this.state === 'PREPARE_BRANCH' && this.activeElement instanceof Wire) {
            if (dist(mx, my, this.branchScreenX, this.branchScreenY) > 5) {
                const wire = this.activeElement;
                const insertIndex = wire.insertWaypointAt(this.branchStartX, this.branchStartY, this.gridSize);

                this.state = 'DRAWING_WIRE';
                this.startNode = wire.startNode;
                this.waypoints = wire.waypoints.slice(0, insertIndex + 1);

                this.branchParentWire = wire;
                this.branchInsertIndex = insertIndex;
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

    handleMousePress(mx, my) {
        if (mouseButton === RIGHT) {
            if (this.state === 'DRAWING_WIRE') this.cancelWireDraw();
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

        const worldPt = this.viewport.getWorldCoords(mx, my);
        const hitRadius = 10 / this.viewport.zoom;

        // If we are actively drawing a wire and we left click...
        if (this.state === 'DRAWING_WIRE') {
            const node = this.getHoveredNode(worldPt.x, worldPt.y, hitRadius);

            if (node && node !== this.startNode && node.type !== this.startNode.type) {
                this.finishWire(node);
            } else if (!node) {
                // If we clicked a wire while dragging backward from an INPUT, splice it!
                if (this.startNode.type === 'INPUT') {
                    for (let targetWire of this.wires) {
                        if (targetWire.isHit(worldPt.x, worldPt.y, this.viewport.zoom)) {
                            const snappedX = this.snap(worldPt.x);
                            const snappedY = this.snap(worldPt.y);

                            const outNode = targetWire.startNode;
                            const inNode = this.startNode;

                            const insertIndex = targetWire.insertWaypointAt(snappedX, snappedY, this.gridSize);
                            const parentPath = targetWire.waypoints.slice(0, insertIndex + 1);
                            const drawnPath = [...this.waypoints].reverse();
                            const finalWaypoints = [...parentPath, ...drawnPath];

                            const newWire = new Wire(outNode, inNode, finalWaypoints);
                            this.wires.push(newWire);

                            this.cancelWireDraw();

                            newWire.propagate();
                            if (inNode.parent) inNode.parent.updateLogic();
                            return;
                        }
                    }
                }

                // If no wire was hit, just drop a waypoint (Click-to-Route)
                this.waypoints.push({
                    x: this.snap(worldPt.x),
                    y: this.snap(worldPt.y)
                });
            }
            return;
        }

        // Start a brand new wire
        const node = this.getHoveredNode(worldPt.x, worldPt.y, hitRadius);
        if (node) {
            this.state = 'DRAWING_WIRE';
            this.startNode = node;
            this.waypoints = [];
            this.activeElement = null;
            this.branchParentWire = null;
            this.branchInsertIndex = -1;
            return;
        }

        // Component Dragging & Clocks
        for (let i = this.components.length - 1; i >= 0; i--) {
            const comp = this.components[i];

            if (comp.isClockHit(worldPt.x, worldPt.y)) {
                const nextClk = comp.gate.getClock() === 0 ? 1 : 0;
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

        // Wire Branches & Waypoints
        for (let wire of this.wires) {
            const wpIdx = wire.getHitWaypointIndex(worldPt.x, worldPt.y, this.viewport.zoom);
            if (wpIdx !== -1) {
                this.activeElement = wire;
                this.state = 'DRAGGING_WAYPOINT';
                this.activeWaypointIndex = wpIdx;
                return;
            }

            if (wire.isHit(worldPt.x, worldPt.y, this.viewport.zoom)) {
                this.activeElement = wire;
                if (keyIsDown(SHIFT)) {
                    this.activeWaypointIndex = wire.insertWaypointAt(
                        worldPt.x, worldPt.y, this.gridSize
                    );
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

        // Support Drag-and-Drop UX (letting go of the mouse button over a target)
        if (this.state === 'DRAWING_WIRE' && this.startNode) {
            let d = dist(this.startNode.worldX, this.startNode.worldY, worldPt.x, worldPt.y);

            // Only trigger drag-and-drop finish if they dragged at least 10px from the start pin
            if (d > 10) {
                let endNode = this.getHoveredNode(worldPt.x, worldPt.y);

                if (endNode && endNode !== this.startNode && endNode.type !== this.startNode.type) {
                    this.finishWire(endNode);
                    return;
                }

                // If they dragged an INPUT wire backward onto an existing wire and let go
                if (this.startNode.type === 'INPUT') {
                    for (let targetWire of this.wires) {
                        if (targetWire.isHit(worldPt.x, worldPt.y, this.viewport.zoom)) {
                            const snappedX = this.snap(worldPt.x);
                            const snappedY = this.snap(worldPt.y);

                            const outNode = targetWire.startNode;
                            const inNode = this.startNode;

                            const insertIndex = targetWire.insertWaypointAt(snappedX, snappedY, this.gridSize);
                            const parentPath = targetWire.waypoints.slice(0, insertIndex + 1);
                            const drawnPath = [...this.waypoints].reverse();
                            const finalWaypoints = [...parentPath, ...drawnPath];

                            const newWire = new Wire(outNode, inNode, finalWaypoints);
                            this.wires.push(newWire);

                            this.cancelWireDraw();

                            newWire.propagate();
                            if (inNode.parent) inNode.parent.updateLogic();
                            return;
                        }
                    }
                }
            }

            // If they just clicked or let go in empty space, do nothing so click-to-route continues!
            return;
        }

        if (
            this.state === 'DRAGGING_WAYPOINT' ||
            this.state === 'DRAGGING_COMP' ||
            this.state === 'PANNING' ||
            this.state === 'PREPARE_BRANCH'
        ) {
            this.state = 'IDLE';
            this.activeWaypointIndex = -1;
            this.activeElement = null;
            this.branchParentWire = null;
            this.branchInsertIndex = -1;
        }
    }

    handleDoubleClick(mx, my) {
        if (this.inspectedComponent) {
            this.inspectedComponent = null;
            return;
        }

        if (this.state === 'PREPARE_BRANCH' || this.state === 'DRAWING_WIRE') {
            if (this.state === 'DRAWING_WIRE') this.cancelWireDraw();
            else {
                this.state = 'IDLE';
                this.activeElement = null;
            }
        }

        const worldPt = this.viewport.getWorldCoords(mx, my);

        // ── NEW: Nested Inspecting ─────────────────────────────────────────
        if (this.isInspecting()) {
            if (this.inspectorScene) {
                for (let gn of this.inspectorScene.nodes) {
                    if (gn.isHit(worldPt.x, worldPt.y)) {
                        const ln = gn.logicNode;
                        // If this block is a CompositeNode holding a SubCircuit, drill down!
                        if (ln && ln.subCircuit && ln.subCircuit.rootNodes) {
                            // Strictly use the instance name!
                            this.drillIntoCircuit(ln.subCircuit, ln.name);
                        }
                        return;
                    }
                }
            }
            return; // Don't do wire logic while inspecting
        }

        // Remove double-clicked waypoints
        let hitWaypoints = [];
        for (let wire of this.wires) {
            const wpIdx = wire.getHitWaypointIndex(worldPt.x, worldPt.y, this.viewport.zoom);
            if (wpIdx !== -1) hitWaypoints.push({ wire, wpIdx });
        }

        if (hitWaypoints.length > 0) {
            for (let item of hitWaypoints) {
                const wire = item.wire;
                wire.waypoints.splice(item.wpIdx, 1);

                if (wire.segmentFlips) {
                    let newFlips = {};
                    for (let key in wire.segmentFlips) {
                        const k = parseInt(key);
                        if (k > item.wpIdx) newFlips[k - 1] = wire.segmentFlips[k];
                        else if (k < item.wpIdx) newFlips[k] = wire.segmentFlips[k];
                    }
                    wire.segmentFlips = newFlips;
                }
            }
            return;
        }

        // Flip double-clicked segment routing
        let hitSegments = [];
        for (let wire of this.wires) {
            const segIdx = wire.getHitSegmentIndex(worldPt.x, worldPt.y, this.viewport.zoom);
            if (segIdx !== -1) hitSegments.push({ wire, segIdx });
        }

        if (hitSegments.length > 0) {
            const firstWire = hitSegments[0].wire;
            const firstIdx = hitSegments[0].segIdx;
            const newState = firstWire.segmentFlips
                ? !firstWire.segmentFlips[firstIdx]
                : true;

            for (let item of hitSegments) {
                if (!item.wire.segmentFlips) item.wire.segmentFlips = {};
                item.wire.segmentFlips[item.segIdx] = newState;
            }
            return;
        }

        for (let comp of this.components) {
            if (comp.isHit(worldPt.x, worldPt.y)) {
                if (comp.type === 'CIRCUIT' && comp.gate?.rootNodes) {
                    // Strictly use the instance name!
                    this.drillIntoCircuit(comp.gate, comp.gate.name);
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
            if (keyCode === 27 || key === 'Escape') {
                this.cancelWireDraw();
                return;
            }
            if (keyCode === 32 || key === ' ') {
                const worldPt = this.viewport.getWorldCoords(mouseX, mouseY);
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
                this.cancelWireDraw();
            }
            this.activeElement = null;
        } else if (key === 'Backspace' || key === 'Delete') {
            if (this.activeElement) {
                if (this.activeElement instanceof Wire) {
                    // Reset the input node's value before removing the wire
                    this.activeElement.endNode.value = 0;
                    if (this.activeElement.endNode.parent) {
                        this.activeElement.endNode.parent.updateLogic();
                    }
                    this.wires = this.wires.filter(w => w !== this.activeElement);
                } else {
                    // Reset downstream nodes driven by this component's outputs
                    this.wires
                        .filter(w => w.startNode.parent === this.activeElement)
                        .forEach(w => {
                            w.endNode.value = 0;
                            if (w.endNode.parent) w.endNode.parent.updateLogic();
                        });

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
        // Enough passes for the longest logic chain + deep feedback chains
        const passes = Math.max(this.components.length * 2, 16);
        for (let i = 0; i < passes; i++) {
            for (let wire of this.wires) wire.propagate();
            for (let comp of this.components) comp.updateLogic();
        }
    }

    stepSimulation() {
        this.cascadeLogic();
    }

    // ── Helpers ─────────────────────────────────────────────────

    addComponent(type, x, y, gate = null) {
        const snappedX = this.snap(x);
        const snappedY = this.snap(y);
        this.components.push(
            new VisualComponent(type, snappedX, snappedY, this.gridSize, gate)
        );
    }

    snap(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    getHoveredNode(wx, wy, radiusOverride = null) {
        for (let comp of this.components) {
            const node = comp.getNodeAt(wx, wy, this.viewport.zoom, radiusOverride);
            if (node) return node;
        }
        return null;
    }

    // ── State Popup ─────────────────────────────────────────────

    drawStatePopup(font) {
        const comp = this.inspectedComponent;
        if (!comp?.gate) return;

        const feedbackNodes = [...new Set(comp.gate.feedbackNodes ?? [])];
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
            INPUT_H + inputNodes.length * rowH +
            MEMORY_H + feedbackNodes.length * rowH +
            OUTPUT_H + outputNodes.length * rowH +
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

        // INPUTS
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

            fill(i % 2 === 0 ? color(250, 247, 255) : color(243, 239, 252));
            stroke(200);
            strokeWeight(1);
            rect(px, cursor, colW, rowH);

            fill(40);
            noStroke();
            textSize(12);
            textAlign(LEFT, CENTER);
            text(n.name ?? `MEM${i}`, px + padding, cursor + rowH / 2);

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

        // OUTPUTS
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
                text('[ also saved as stored state ]', px + colW / 2, cursor + rowH / 2);
            }

            drawBadge(n.value ?? 0, badgeX, cursor + rowH / 2);
            cursor += rowH;
        }
    }
}