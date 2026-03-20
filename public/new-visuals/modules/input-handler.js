// File: public/new-visuals/modules/input-handler.js

import { Wire } from '../wire.js';

export class InputHandler {
    constructor(m) {
        this.m = m;
    }

    handleMouseDrag(mx, my) {
        const m = this.m;
        if (m.isInspecting()) {
            m.viewport.updatePan(mx, my);
            return;
        }

        if (m.state === 'PANNING') {
            m.viewport.updatePan(mx, my);
        } else if (m.state === 'DRAGGING_COMP' && m.activeElement) {
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

    handleMousePress(mx, my) {
        const m = this.m;
        if (m.isInspecting()) {
            if (mx >= width - 110 && mx <= width - 14 && my >= 8 && my <= 32) {
                m.drillOut();
                return;
            }
            m.state = 'INSPECTING';
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
            return;
        }

        // ── Component hit ───────────────────────────────────────
        for (let i = m.components.length - 1; i >= 0; i--) {
            const comp = m.components[i];
            if (comp.isClockHit(worldPt.x, worldPt.y)) {
                const nextClk = comp.gate.getClock() === 0 ? 1 : 0;
                comp.gate.setClock(nextClk);
                m.cascadeLogic();
                return;
            }
            if (comp.isHit(worldPt.x, worldPt.y)) {
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
                m.activeElement = wire;
                m.activeWaypointIndex = wpIdx;
                m.state = 'DRAGGING_WAYPOINT';
                return;
            }

            const segIdx = wire.getHitSegmentIndex(
                worldPt.x, worldPt.y, m.viewport.zoom
            );
            if (segIdx !== -1) {
                m.activeElement = wire;
                m.activeWaypointIndex = segIdx; // reused as segIndex

                if (keyIsDown(SHIFT)) {
                    // Shift+click → insert joint and drag it
                    const newIdx = wire.insertWaypointAt(
                        worldPt.x, worldPt.y, m.gridSize
                    );
                    m.activeWaypointIndex = newIdx;
                    m.state = 'DRAGGING_WAYPOINT';
                } else {
                    m.state = 'DRAGGING_SEGMENT';
                }
                return;
            }
        }

        // ── Nothing hit → pan ───────────────────────────────────
        m.activeElement = null;
        m.state = 'PANNING';
        m.viewport.startPan(mx, my);
    }

    handleMouseRelease() {
        const m = this.m;
        if (m.isInspecting()) return;

        const worldPt = m.viewport.getWorldCoords(mouseX, mouseY);

        if (m.state === 'DRAWING_WIRE' && m.startNode) {
            const d = dist(
                m.startNode.worldX, m.startNode.worldY,
                worldPt.x, worldPt.y
            );
            if (d > 10) {
                const endNode = m.getHoveredNode(worldPt.x, worldPt.y);
                if (
                    endNode &&
                    endNode !== m.startNode &&
                    endNode.type !== m.startNode.type
                ) {
                    m.finishWire(endNode);
                    return;
                }
                if (m.startNode.type === 'INPUT') {
                    if (this._tryConnectToWire(worldPt, m.startNode, m.waypoints))
                        return;
                }
            }
            return;
        }

        if (
            ['DRAGGING_WAYPOINT', 'DRAGGING_SEGMENT',
                'DRAGGING_COMP', 'PANNING'].includes(m.state)
        ) {
            m.state = 'IDLE';
            m.activeWaypointIndex = -1;
            m.activeElement = null;
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

        // Double-click waypoint → remove it
        for (const wire of m.wires) {
            const wpIdx = wire.getHitWaypointIndex(
                worldPt.x, worldPt.y, m.viewport.zoom
            );
            if (wpIdx !== -1) {
                wire.removeWaypoint(wpIdx);
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

    handleKeyDown(key, keyCode) {
        const m = this.m;
        if (m.isInspecting()) {
            if (key === 'Escape') m.drillOut();
            return;
        }

        if (m.state === 'DRAWING_WIRE') {
            if (keyCode === 27 || key === 'Escape') {
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
                snappedX, snappedY, m.gridSize
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
        if (!m.activeElement) return;

        if (m.activeElement instanceof Wire) {
            m.activeElement.endNode.value = 0;
            if (m.activeElement.endNode.parent)
                m.activeElement.endNode.parent.updateLogic();
            m.wires = m.wires.filter(w => w !== m.activeElement);
        } else {
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
        }
        m.activeElement = null;
    }
}