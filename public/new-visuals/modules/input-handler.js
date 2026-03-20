// File: public/new-visuals/modules/input-handler.js

import { Wire } from '../wire.js';

export class InputHandler {
    constructor(m) {
        this.m = m;
        // Fallback to ensure selectedWires is initialized
        if (!this.m.selectedWires) this.m.selectedWires = [];
    }

    handleMouseDrag(mx, my) {
        const m = this.m;

        // Panning works in both normal and inspecting mode
        if (m.state === 'PANNING' || m.state === 'INSPECTING_PAN') {
            m.viewport.updatePan(mx, my);
            return;
        }

        if (m.isInspecting()) return;

        if (m.state === 'DRAGGING_COMP' && m.activeElement) {
            const wp = m.viewport.getWorldCoords(mx, my);
            m.activeElement.x = m.snap(wp.x - m.activeElement.dragOffset.x);
            m.activeElement.y = m.snap(wp.y - m.activeElement.dragOffset.y);
            m.activeElement.updateNodes();
        } else if (
            m.state === 'DRAGGING_WAYPOINT' &&
            m.activeElement instanceof Wire
        ) {
            const wp = m.viewport.getWorldCoords(mx, my);
            m.activeElement.dragWaypoint(
                m.activeWaypointIndex,
                wp.x,
                wp.y,
                m.gridSize
            );
        } else if (
            m.state === 'DRAGGING_SEGMENT' &&
            m.activeElement instanceof Wire
        ) {
            const wp = m.viewport.getWorldCoords(mx, my);
            m.activeElement.dragSegment(
                m.activeWaypointIndex, // reused as segIndex
                wp.x,
                wp.y,
                m.gridSize
            );
        }
    }

    handleDoubleClick(mx, my) {
        const m = this.m;
        if (m.inspectedComponent) {
            m.inspectedComponent = null;
            return;
        }

        if (m.state === 'DRAWING_WIRE') {
            m.cancelWireDraw();
            return;
        }

        const worldPt = m.viewport.getWorldCoords(mx, my);

        if (m.isInspecting()) {
            if (m.inspectorScene) {
                for (const gn of m.inspectorScene.nodes) {
                    if (gn.isHit(worldPt.x, worldPt.y)) {
                        const ln = gn.logicNode;
                        if (ln?.subCircuit?.rootNodes)
                            m.drillIntoCircuit(ln.subCircuit, ln.name);
                        return;
                    }
                }
            }
            return;
        }

        // Double-click wire → flip corner
        for (const wire of m.wires) {
            if (wire.isHit(worldPt.x, worldPt.y, m.viewport.zoom)) {
                if (typeof wire.flipCorner === 'function') {
                    wire.flipCorner(worldPt.x, worldPt.y, m.viewport.zoom);
                }
                return;
            }
        }

        // Double-click component
        for (const comp of m.components) {
            if (comp.isHit(worldPt.x, worldPt.y)) {
                if (comp.type === 'CIRCUIT' && comp.gate?.rootNodes)
                    m.drillIntoCircuit(comp.gate, comp.gate.name);
                else comp.toggleState();
                return;
            }
        }
    }

    handleMousePress(mx, my) {
        const m = this.m;
        if (m.isInspecting()) {
            if (mx >= width - 110 && mx <= width - 14 && my >= 8 && my <= 32) {
                m.drillOut();
                return;
            }
            m.state = 'INSPECTING_PAN';
            m.viewport.startPan(mx, my);
            return;
        }

        const worldPt = m.viewport.getWorldCoords(mx, my);
        const hitRadius = 10 / m.viewport.zoom;

        if (m.state === 'DRAWING_WIRE') {
            this._handleWirePress(worldPt, hitRadius);
            return;
        }

        // ── Node hit → start drawing ────────────────────────────
        const node = m.getHoveredNode(worldPt.x, worldPt.y, hitRadius);
        if (node) {
            m.state = 'DRAWING_WIRE';
            m.startNode = node;
            m.waypoints = [];
            m.activeElement = null;
            m.branchParentWire = null;
            m.branchInsertIndex = -1;

            // Clear selections
            m.wires.forEach(w => w.isSelected = false);
            m.selectedWires = [];
            return;
        }

        // ── Component hit ───────────────────────────────────────
        for (let i = m.components.length - 1; i >= 0; i--) {
            const comp = m.components[i];
            if (comp.isClockHit && comp.isClockHit(worldPt.x, worldPt.y)) {
                const nextClk = comp.gate.getClock() === 0 ? 1 : 0;
                comp.gate.setClock(nextClk);
                return;
            }
            if (comp.isHit(worldPt.x, worldPt.y)) {
                // Deselect wires when dragging a component
                m.wires.forEach(w => w.isSelected = false);
                m.selectedWires = [];

                m.state = 'DRAGGING_COMP';
                m.activeElement = comp;
                m.components.splice(i, 1);
                m.components.push(comp);
                comp.dragOffset = {
                    x: worldPt.x - comp.x,
                    y: worldPt.y - comp.y,
                };
                return;
            }
        }

        // ── Wire hit ────────────────────────────────────────────
        for (const wire of m.wires) {
            // Waypoint takes priority over segment
            const wpIdx = wire.getHitWaypointIndex(
                worldPt.x, worldPt.y, m.viewport.zoom
            );
            if (wpIdx !== -1) {
                // Apply Selection
                m.wires.forEach(w => w.isSelected = false);
                wire.isSelected = true;
                m.selectedWires = [wire];

                m.activeElement = wire;
                m.activeWaypointIndex = wpIdx;
                m.state = 'DRAGGING_WAYPOINT';
                return;
            }

            const segIdx = wire.getHitSegmentIndex(
                worldPt.x, worldPt.y, m.viewport.zoom
            );
            if (segIdx !== -1) {
                // Apply Selection
                m.wires.forEach(w => w.isSelected = false);
                wire.isSelected = true;
                m.selectedWires = [wire];

                m.activeElement = wire;
                m.activeWaypointIndex = segIdx;

                const isMacCmd = keyIsDown(91) || keyIsDown(93) || keyIsDown(224);

                if (keyIsDown(SHIFT)) {
                    // Shift+click → insert joint and drag it
                    const newIdx = wire.insertWaypointAt(
                        worldPt.x, worldPt.y, m.gridSize
                    );
                    m.activeWaypointIndex = newIdx;
                    m.state = 'DRAGGING_WAYPOINT';
                } else if (keyIsDown(CONTROL) || isMacCmd) {
                    // Ctrl/Cmd+click → drag segment
                    m.state = 'DRAGGING_SEGMENT';
                } else {
                    // Normal click → Start branching!
                    const junction = wire.createJunction(worldPt.x, worldPt.y, m.gridSize);
                    junction.updateLogic();

                    m.state = 'DRAWING_WIRE';
                    m.startNode = junction;
                    m.waypoints = [];
                    m.branchParentWire = wire;
                    m.branchInsertIndex = segIdx;
                }
                return;
            }
        }

        // ── Nothing hit → pan & deselect ────────────────────────
        m.wires.forEach(w => w.isSelected = false);
        m.selectedWires = [];
        m.activeElement = null;
        m.state = 'PANNING';
        m.viewport.startPan(mx, my);
    }

    handleMouseRelease() {
        const m = this.m;

        if (m.state === 'INSPECTING_PAN') {
            m.state = 'INSPECTING';
            return;
        }

        if (m.isInspecting()) return;

        const worldPt = m.viewport.getWorldCoords(mouseX, mouseY);

        if (m.state === 'DRAWING_WIRE' && m.startNode) {
            const d = dist(
                m.startNode.worldX, m.startNode.worldY,
                worldPt.x, worldPt.y
            );

            let didConnect = false;

            if (d > 10) {
                const endNode = m.getHoveredNode(worldPt.x, worldPt.y);
                if (
                    endNode &&
                    endNode !== m.startNode &&
                    endNode.type !== m.startNode.type
                ) {
                    m.finishWire(endNode);
                    didConnect = true;
                } else if (m.startNode.type === 'INPUT') {
                    if (this._tryConnectToWire(worldPt, m.startNode, m.waypoints)) {
                        didConnect = true;
                    }
                }
            }

            // If the user dropped the branch in empty space, clean up the junction
            if (!didConnect) {
                if (m.startNode.isJunction) {
                    const parentWire = m.startNode.parentWire;
                    parentWire.junctions = parentWire.junctions.filter(j => j !== m.startNode);
                }
                m.cancelWireDraw();
            }
            return;
        }

        if (
            ['DRAGGING_WAYPOINT', 'DRAGGING_SEGMENT',
                'DRAGGING_COMP', 'PANNING'].includes(m.state)
        ) {
            // Apply Orthogonal Cleanup ONLY on drop!
            if ((m.state === 'DRAGGING_WAYPOINT' || m.state === 'DRAGGING_SEGMENT') && m.activeElement instanceof Wire) {
                m.activeElement._collapseInPlace(m.gridSize);
            }
            else if (m.state === 'DRAGGING_COMP' && m.activeElement) {
                // Find all wires connected to the dropped component and clean them up
                for (const wire of m.wires) {
                    if (wire.startNode.parent === m.activeElement || wire.endNode.parent === m.activeElement) {
                        wire._collapseInPlace(m.gridSize);
                    }
                }
            }

            m.state = 'IDLE';
            m.activeWaypointIndex = -1;
            m.activeElement = null;
        }
    }

    handleKeyDown(key, keyCode) {
        const m = this.m;

        if (m.state === 'INSPECTING_PAN' || m.state === 'INSPECTING') {
            if (key === 'Escape') m.drillOut();
            return;
        }

        if (m.state === 'DRAWING_WIRE') {
            if (keyCode === 27 || key === 'Escape') {
                // Clean up junction if canceled mid-draw
                if (m.startNode && m.startNode.isJunction) {
                    const parentWire = m.startNode.parentWire;
                    parentWire.junctions = parentWire.junctions.filter(j => j !== m.startNode);
                }
                m.cancelWireDraw();
                return;
            }
            if (keyCode === 32 || key === ' ') {
                const wp = m.viewport.getWorldCoords(mouseX, mouseY);
                m.waypoints.push({
                    x: m.snap(wp.x),
                    y: m.snap(wp.y),
                });
                return;
            }
        }

        if (key === ' ') {
            m.stepSimulation();
        } else if (key === 's' || key === 'S') {
            m.promptSave();
        } else if (key === 'l' || key === 'L') {
            m.promptLoad();
        } else if (key === 'Escape') {
            if (m.inspectedComponent) {
                m.inspectedComponent = null;
                return;
            }
            if (m.state === 'DRAWING_WIRE') m.cancelWireDraw();
            m.activeElement = null;
            m.wires.forEach(w => w.isSelected = false);
            m.selectedWires = [];
        } else if (key === 'Backspace' || key === 'Delete') {
            this._handleDelete();
        }
    }

    // ── Private ─────────────────────────────────────────────────

    _handleWirePress(worldPt, hitRadius) {
        const m = this.m;
        const node = m.getHoveredNode(worldPt.x, worldPt.y, hitRadius);
        if (
            node &&
            node !== m.startNode &&
            node.type !== m.startNode.type
        ) {
            m.finishWire(node);
            return;
        }
        if (!node) {
            if (m.startNode.type === 'INPUT') {
                if (this._tryConnectToWire(worldPt, m.startNode, m.waypoints))
                    return;
            }
            m.waypoints.push({
                x: m.snap(worldPt.x),
                y: m.snap(worldPt.y),
            });
        }
    }

    _tryConnectToWire(worldPt, inNode, waypoints) {
        const m = this.m;
        for (const targetWire of m.wires) {
            if (!targetWire.isHit(worldPt.x, worldPt.y, m.viewport.zoom))
                continue;

            const snappedX = m.snap(worldPt.x);
            const snappedY = m.snap(worldPt.y);
            const outNode = targetWire.startNode;

            const insertIndex = targetWire.insertWaypointAt(
                snappedX, snappedY, m.gridSize, true
            );
            const parentPath = targetWire.waypoints.slice(0, insertIndex + 1);
            const drawnPath = [...waypoints].reverse();
            const finalWaypoints = [...parentPath, ...drawnPath];

            const newWire = new Wire(outNode, inNode, finalWaypoints);
            m.wires.push(newWire);
            m.cancelWireDraw();
            newWire.propagate();
            if (inNode.parent) inNode.parent.updateLogic();
            return true;
        }
        return false;
    }

    _handleDelete() {
        const m = this.m;

        // 1. Delete selected wires
        if (m.selectedWires && m.selectedWires.length > 0) {
            for (const wire of m.selectedWires) {
                wire.endNode.value = 0;
                if (wire.endNode.parent) wire.endNode.parent.updateLogic();
                m.wires = m.wires.filter(w => w !== wire);
            }
            m.selectedWires = [];
            return;
        }

        // 2. Delete selected component
        if (m.activeElement && !(m.activeElement instanceof Wire)) {
            m.wires
                .filter(w => w.startNode.parent === m.activeElement)
                .forEach(w => {
                    w.endNode.value = 0;
                    if (w.endNode.parent) w.endNode.parent.updateLogic();
                });
            m.components = m.components.filter(c => c !== m.activeElement);
            m.wires = m.wires.filter(
                w =>
                    w.startNode.parent !== m.activeElement &&
                    w.endNode.parent !== m.activeElement
            );
            m.activeElement = null;
        }
    }
}