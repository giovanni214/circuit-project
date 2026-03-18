import { Viewport } from './viewport.js';
import { VisualComponent } from './visual-component.js';
import { Wire } from './wire.js';

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
    }

    addComponent(type, x, y, gate = null) {
        let snappedX = this.snap(x);
        let snappedY = this.snap(y);
        this.components.push(new VisualComponent(type, snappedX, snappedY, this.gridSize, gate));
    }

    snap(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    }



    draw(font) {
        push();
        this.viewport.apply();
        this.viewport.drawGrid(this.gridSize);

        for (let wire of this.wires) {
            wire.draw(this.activeElement === wire);
        }

        if (this.state === 'DRAWING_WIRE' && this.startNode) {
            Wire.drawPreview(this.startNode, this.viewport.getWorldCoords(mouseX, mouseY), this.gridSize, this.waypoints);
        }

        for (let comp of this.components) {
            comp.draw(font, this.activeElement === comp);
        }
        pop();

        fill(0);
        noStroke();
        textSize(16);
        textAlign(LEFT, TOP);
        text(`Zoom: ${Math.floor(this.viewport.zoom * 100)}% | [Space] Tick | [Shift+Click Wire] Add Joint | Dbl-Click Line to Flip Route`, 10, height - 30);
    }

    getHoveredNode(wx, wy) {
        for (let comp of this.components) {
            let node = comp.getNodeAt(wx, wy, this.viewport.zoom);
            if (node) return node;
        }
        return null;
    }

    // NEW: Extracts the wire propagation logic so it can be called independently
    cascadeLogic() {
        for (let i = 0; i < this.components.length + 2; i++) {
            for (let wire of this.wires) wire.propagate();
            for (let comp of this.components) comp.updateLogic();
        }
    }

    // UPDATE: Only toggles global clocks now, then calls the cascade
    stepSimulation() {
        this.cascadeLogic();
    }

    handleMousePress(mx, my) {
        let worldPt = this.viewport.getWorldCoords(mx, my);

        if (this.state === 'DRAWING_WIRE') {
            let node = this.getHoveredNode(worldPt.x, worldPt.y);
            if (node && node !== this.startNode && node.type !== this.startNode.type) {
                this.finishWire(node);
            } else if (!node) {
                this.waypoints.push({ x: this.snap(worldPt.x), y: this.snap(worldPt.y) });
            }
            return;
        }

        let node = this.getHoveredNode(worldPt.x, worldPt.y);
        if (node) {
            this.state = 'DRAWING_WIRE';
            this.startNode = node;
            this.waypoints = [];
            this.activeElement = null;
            return;
        }

        for (let i = this.components.length - 1; i >= 0; i--) {
            let comp = this.components[i];

            // NEW: Check if the user is clicking the clock button
            if (comp.isClockHit(worldPt.x, worldPt.y)) {
                // Flip ONLY this specific component's clock
                let nextClk = comp.gate.getClock() === 0 ? 1 : 0;
                comp.gate.setClock(nextClk);

                return; // Consume the click
            }

            // Normal component drag hit detection
            if (comp.isHit(worldPt.x, worldPt.y)) {
                this.state = 'DRAGGING_COMP';
                this.activeElement = comp;
                this.components.splice(i, 1);
                this.components.push(comp);
                comp.dragOffset = { x: worldPt.x - comp.x, y: worldPt.y - comp.y };
                return;
            }
        }

        // ... rest of handleMousePress (wire hit detection, panning) remains exactly the same
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
                    this.state = 'IDLE';
                }
                return;
            }
        }

        this.activeElement = null;
        this.state = 'PANNING';
        this.viewport.startPan(mx, my);
    }

    handleMouseDrag(mx, my) {
        if (this.state === 'PANNING') {
            this.viewport.updatePan(mx, my);
        } else if (this.state === 'DRAGGING_COMP' && this.activeElement) {
            let worldPt = this.viewport.getWorldCoords(mx, my);
            this.activeElement.x = this.snap(worldPt.x - this.activeElement.dragOffset.x);
            this.activeElement.y = this.snap(worldPt.y - this.activeElement.dragOffset.y);
            this.activeElement.updateNodes();

            for (let wire of this.wires) {
                if (wire.startNode.parent === this.activeElement || wire.endNode.parent === this.activeElement) {
                    wire.waypoints = Wire.generateAutoWaypoints(
                        wire.startNode.worldX, wire.startNode.worldY,
                        wire.endNode.worldX, wire.endNode.worldY,
                        this.gridSize,
                        wire.invertU // Preserves Above/Below choice during drag!
                    );
                }
            }
        } else if (this.state === 'DRAGGING_WAYPOINT' && this.activeElement instanceof Wire) {
            let worldPt = this.viewport.getWorldCoords(mx, my);
            this.activeElement.waypoints[this.activeWaypointIndex] = {
                x: this.snap(worldPt.x),
                y: this.snap(worldPt.y)
            };
        }
    }

    handleMouseRelease() {
        let worldPt = this.viewport.getWorldCoords(mouseX, mouseY);

        if (this.state === 'DRAWING_WIRE' && this.startNode) {
            let endNode = this.getHoveredNode(worldPt.x, worldPt.y);

            // 1. Drop on Pin
            let d = dist(this.startNode.worldX, this.startNode.worldY, worldPt.x, worldPt.y);
            if (endNode && endNode !== this.startNode && endNode.type !== this.startNode.type && d > 10) {
                this.finishWire(endNode);
                return;
            }

            // 2. Drop on Wire (Create Junction/Splitter)
            // You MUST be dragging FROM an Input pin TO an existing wire to split its signal
            if (this.startNode.type === 'INPUT') {
                for (let targetWire of this.wires) {
                    if (targetWire.isHit(worldPt.x, worldPt.y, this.viewport.zoom)) {
                        let snappedX = this.snap(worldPt.x);
                        let snappedY = this.snap(worldPt.y);

                        // The new wire inherits the source logic of the wire it was dropped on
                        let outNode = targetWire.startNode;
                        let inNode = this.startNode;

                        // Reverse custom waypoints since we drew backwards
                        let finalWaypoints = [...this.waypoints].reverse();

                        // Force the new wire to start rendering at the drop coordinates
                        finalWaypoints.unshift({ x: snappedX, y: snappedY });

                        this.wires.push(new Wire(outNode, inNode, finalWaypoints));

                        // Insert a physical joint dot on the target wire
                        targetWire.insertWaypointAt(snappedX, snappedY, this.gridSize);

                        this.state = 'IDLE';
                        this.startNode = null;
                        this.waypoints = [];
                        return;
                    }
                }
            }

            // Clicked empty space to add waypoint, stay in DRAWING_WIRE
            return;
        }

        if (this.state === 'DRAGGING_WAYPOINT' || this.state === 'DRAGGING_COMP' || this.state === 'PANNING') {
            this.state = 'IDLE';
            this.activeWaypointIndex = -1;
        }
    }

    finishWire(endNode) {
        let outNode = this.startNode.type === 'OUTPUT' ? this.startNode : endNode;
        let inNode = this.startNode.type === 'INPUT' ? this.startNode : endNode;
        let finalWaypoints = this.startNode.type === 'INPUT' ? [...this.waypoints].reverse() : [...this.waypoints];

        let newWire = new Wire(outNode, inNode, finalWaypoints);

        if (finalWaypoints.length === 0) {
            newWire.waypoints = Wire.generateAutoWaypoints(
                outNode.worldX, outNode.worldY,
                inNode.worldX, inNode.worldY,
                this.gridSize,
                newWire.invertU
            );
        }

        this.wires.push(newWire);
        this.state = 'IDLE';
        this.startNode = null;
        this.waypoints = [];
    }

    handleDoubleClick(mx, my) {
        let worldPt = this.viewport.getWorldCoords(mx, my);

        for (let wire of this.wires) {
            let wpIdx = wire.getHitWaypointIndex(worldPt.x, worldPt.y, this.viewport.zoom);
            if (wpIdx !== -1) {
                // Double click a joint to delete it
                wire.waypoints.splice(wpIdx, 1);
                return;
            } else if (wire.isHit(worldPt.x, worldPt.y, this.viewport.zoom)) {
                // Double click a line to flip orientation AND above/below U-Route flag
                wire.horizontalFirst = !wire.horizontalFirst;
                wire.invertU = !wire.invertU;

                // Regenerate the path to instantly show the new layout
                wire.waypoints = Wire.generateAutoWaypoints(
                    wire.startNode.worldX, wire.startNode.worldY,
                    wire.endNode.worldX, wire.endNode.worldY,
                    this.gridSize,
                    wire.invertU
                );
                return;
            }
        }

        for (let comp of this.components) {
            if (comp.isHit(worldPt.x, worldPt.y)) {
                comp.toggleState();
                return;
            }
        }
    }

    handleKeyDown(key, keyCode) {
        if (key === ' ') {
            this.stepSimulation();
        } else if (key === 'Escape') {
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
                    this.wires = this.wires.filter(w =>
                        w.startNode.parent !== this.activeElement &&
                        w.endNode.parent !== this.activeElement
                    );
                }
                this.activeElement = null;
            }
        }
    }
}