// File: public/new-visuals/wire.js

import { JunctionNode } from "./junction-node.js";
// Lightweight inline JunctionNode to avoid import dependency issues

export class Wire {
    constructor(outNode, inNode, waypoints = null) {
        this.startNode = outNode;
        this.endNode = inNode;
        this.junctions = [];
        this.isSelected = false;

        this.waypoints = waypoints !== null
            ? waypoints
            : Wire.autoRoute(outNode.worldX, outNode.worldY, inNode.worldX, inNode.worldY);

        this._collapseInPlace();
    }

    // ── Signal propagation ──────────────────────────────────────

    propagate() {
        if (!this.startNode || !this.endNode) return;
        const val = this.startNode.value ?? 0;
        this.endNode.value = val;

        if (this.junctions) {
            for (const j of this.junctions) {
                j.value = val;
            }
        }
    }

    // ── Point list ──────────────────────────────────────────────

    getPoints() {
        return [
            { x: this.startNode.worldX, y: this.startNode.worldY, isPin: true },
            ...this.waypoints,
            { x: this.endNode.worldX, y: this.endNode.worldY, isPin: true },
        ];
    }

    getSegments() {
        const pts = this.getPoints();
        const segs = [];
        for (let i = 0; i < pts.length - 1; i++) {
            segs.push({
                x1: pts[i].x,
                y1: pts[i].y,
                x2: pts[i + 1].x,
                y2: pts[i + 1].y,
                ptIndex: i,
            });
        }
        return segs;
    }

    // ── Auto-routing ────────────────────────────────────────────

    static autoRoute(sx, sy, ex, ey, gridSize = 20) {
        const snap = v => Math.round(v / gridSize) * gridSize;

        const ox = snap(sx + gridSize * 2);
        const ix = snap(ex - gridSize * 2);
        const midX = snap((ox + ix) / 2);

        return [
            { x: ox, y: snap(sy) },
            { x: midX, y: snap(sy) },
            { x: midX, y: snap(ey) },
            { x: ix, y: snap(ey) },
        ];
    }
    updateEndpoints(gridSize = 20) {

    }

    // ── Waypoint editing ────────────────────────────────────────

    insertWaypointAt(wx, wy, gridSize) {
        const nx = Math.round(wx / gridSize) * gridSize;
        const ny = Math.round(wy / gridSize) * gridSize;

        const segs = this.getSegments();
        let bestDist = Infinity;
        let bestSeg = segs[0];

        for (const seg of segs) {
            const d = Wire.distToSegment(nx, ny, seg.x1, seg.y1, seg.x2, seg.y2);
            if (d < bestDist) {
                bestDist = d;
                bestSeg = seg;
            }
        }

        const insertAt = bestSeg.ptIndex;
        // isCustom prevents it from being auto-deleted if it becomes a straight line
        this.waypoints.splice(insertAt, 0, { x: nx, y: ny, isCustom: true });
        this._collapseInPlace(gridSize);
        return insertAt;
    }

    removeWaypoint(idx) {
        if (idx >= 0 && idx < this.waypoints.length) {
            this.waypoints.splice(idx, 1);
            this._collapseInPlace();
        }
    }

    dragWaypoint(idx, wx, wy, gridSize) {
        if (idx < 0 || idx >= this.waypoints.length) return -1;

        const nx = Math.round(wx / gridSize) * gridSize;
        const ny = Math.round(wy / gridSize) * gridSize;

        let pts = this.getPoints();
        const pIdx = idx + 1;

        const prev = pts[pIdx - 1];
        const curr = pts[pIdx];
        const next = pts[pIdx + 1];

        // Determine orientation before move
        const prevIsH = Math.abs(prev.y - curr.y) < 1;
        const nextIsH = Math.abs(next.y - curr.y) < 1;

        curr.x = nx;
        curr.y = ny;

        // Move adjacent points to stretch lines without breaking right angles
        if (!prev.isPin) {
            if (prevIsH) prev.y = ny; else prev.x = nx;
        }
        if (!next.isPin) {
            if (nextIsH) next.y = ny; else next.x = nx;
        }

        this.waypoints = pts.slice(1, -1);

        // Array length does not change, index stays the same
        return idx;
    }

    dragSegment(segIdx, wx, wy, gridSize) {
        let pts = this.getPoints();
        if (segIdx < 0 || segIdx >= pts.length - 1) return -1;

        const curr = pts[segIdx];
        const next = pts[segIdx + 1];

        const nx = Math.round(wx / gridSize) * gridSize;
        const ny = Math.round(wy / gridSize) * gridSize;

        const isH = Math.abs(curr.y - next.y) < 1;

        // Move the segment; adjacent segments will naturally stretch
        if (isH) {
            if (!curr.isPin) curr.y = ny;
            if (!next.isPin) next.y = ny;
        } else {
            if (!curr.isPin) curr.x = nx;
            if (!next.isPin) next.x = nx;
        }

        this.waypoints = pts.slice(1, -1);

        // Array length does not change, index stays the same
        return segIdx;
    }

    flipCorner(wx, wy, zoom) {
        const hitR = 15 / zoom;
        let closestIdx = -1;
        let bestDist = hitR;

        for (let i = 0; i < this.waypoints.length; i++) {
            const d = dist(wx, wy, this.waypoints[i].x, this.waypoints[i].y);
            if (d < bestDist) {
                bestDist = d;
                closestIdx = i;
            }
        }

        if (closestIdx !== -1) {
            let pts = this.getPoints();
            const pIdx = closestIdx + 1;
            const prev = pts[pIdx - 1];
            const curr = pts[pIdx];
            const next = pts[pIdx + 1];

            // Invert L-shape
            if (Math.abs(curr.x - prev.x) < 1 && Math.abs(curr.y - next.y) < 1) {
                curr.x = next.x; curr.y = prev.y;
            } else if (Math.abs(curr.y - prev.y) < 1 && Math.abs(curr.x - next.x) < 1) {
                curr.x = prev.x; curr.y = next.y;
            }

            this.waypoints = pts.slice(1, -1);
            this._collapseInPlace();
        }
    }

    createJunction(wx, wy, gridSize = 20) {
        const nx = Math.round(wx / gridSize) * gridSize;
        const ny = Math.round(wy / gridSize) * gridSize;
        const junction = new JunctionNode(this, nx, ny);
        if (!this.junctions) this.junctions = [];
        this.junctions.push(junction);
        return junction;
    }

    // ── Geometry Engine ─────────────────────────────────────────

    _writeBackPts(pts) {
        const newWaypoints = [];
        const gridSize = 20;
        const snap = v => Math.round(v / gridSize) * gridSize;  // ADD THIS

        // 1. Reinject Output Stub if missing
        const startStubX = snap(pts[0].x + gridSize * 2);           // SNAP
        if (Math.abs(pts[1].x - startStubX) > 0.5 || Math.abs(pts[1].y - pts[0].y) > 0.5) {
            newWaypoints.push({ x: startStubX, y: snap(pts[0].y) });  // SNAP
        }

        // 2. Process existing middle waypoints
        for (let i = 1; i < pts.length - 1; i++) {
            const p = pts[i];
            newWaypoints.push({ ...p, x: snap(p.x), y: snap(p.y) });  // SNAP
        }

        // 3. Reinject Input Stub if missing
        const last = pts.length - 1;
        const endStubX = snap(pts[last].x - gridSize * 2);          // SNAP
        if (Math.abs(pts[last - 1].x - endStubX) > 0.5 || Math.abs(pts[last - 1].y - pts[last].y) > 0.5) {
            newWaypoints.push({ x: endStubX, y: snap(pts[last].y) });  // SNAP
        }

        this.waypoints = newWaypoints;
    }

    _collapseInPlace(gridSize = 20) {
        this._writeBackPts(this.getPoints());
        this._orthogonalize();
        this._cleanCollinear();
    }

    _orthogonalize() {
        let pts = this.getPoints();
        if (pts.length < 2) return;

        let out = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
            const prev = out[out.length - 1];
            const curr = pts[i];

            // If diagonal gap exists, mathematically insert the missing L-corner
            if (Math.abs(prev.x - curr.x) > 0.5 && Math.abs(prev.y - curr.y) > 0.5) {
                out.push({ x: curr.x, y: prev.y, isCustom: false });
            }
            out.push(curr);
        }
        this.waypoints = out.slice(1, -1);
    }

    _cleanCollinear() {
        let pts = this.getPoints();
        if (pts.length <= 2) return;

        let out = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            const prev = out[out.length - 1];
            const curr = pts[i];
            const next = pts[i + 1];

            const sameX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
            const sameY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
            const dup = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(prev.y - curr.y) < 0.5;

            // Delete useless points, but protect points explicitly Shift+Clicked by user
            if ((sameX || sameY || dup) && !curr.isCustom) {
                continue;
            }
            out.push(curr);
        }
        out.push(pts[pts.length - 1]);
        this.waypoints = out.slice(1, -1);
    }

    // ── Hit testing ─────────────────────────────────────────────

    getHitWaypointIndex(wx, wy, zoom) {
        const hitR = 12 / zoom;
        for (let i = 0; i < this.waypoints.length; i++) {
            if (dist(wx, wy, this.waypoints[i].x, this.waypoints[i].y) < hitR) return i;
        }
        return -1;
    }

    getHitSegmentIndex(wx, wy, zoom) {
        const hitDist = 8 / zoom;
        for (const seg of this.getSegments()) {
            if (Wire.distToSegment(wx, wy, seg.x1, seg.y1, seg.x2, seg.y2) < hitDist) {
                return seg.ptIndex;
            }
        }
        return -1;
    }

    isHit(wx, wy, zoom) {
        return this.getHitSegmentIndex(wx, wy, zoom) !== -1;
    }

    // ── Drawing ─────────────────────────────────────────────────

    draw(isActive) {
        const segs = this.getSegments();
        if (segs.length === 0) return;

        if (isActive || this.isSelected) {
            stroke(0, 150, 255, 100);
            strokeWeight(12);
            noFill();
            this._drawPolyline(segs);
        }

        const val = this.startNode.value || 0;
        const col = val === 1 ? '#4CAF50' : '#555555';

        stroke(col);
        strokeWeight(3);
        noFill();
        this._drawPolyline(segs);

        // Draw waypoints
        for (const wp of this.waypoints) {
            fill(wp.isCustom ? '#FF5722' : (this.isSelected ? '#0096FF' : col));
            noStroke();
            ellipse(wp.x, wp.y, wp.isCustom ? 7 : 7);
        }

        // Draw junctions
        if (this.junctions) {
            fill(col);
            noStroke();
            for (const j of this.junctions) {
                ellipse(j.worldX, j.worldY, 10);
            }
        }
    }

    static drawPreview(startNode, worldMouse, gridSize, waypoints = [], branchInsertIndex = -1) {
        const ex = Math.round(worldMouse.x / gridSize) * gridSize;
        const ey = Math.round(worldMouse.y / gridSize) * gridSize;

        let pts = [
            { x: startNode.worldX, y: startNode.worldY },
            ...waypoints,
            { x: ex, y: ey }
        ];

        let out = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
            const prev = out[out.length - 1];
            const curr = pts[i];
            if (Math.abs(prev.x - curr.x) > 0.5 && Math.abs(prev.y - curr.y) > 0.5) {
                out.push({ x: curr.x, y: prev.y });
            }
            out.push(curr);
        }

        push();
        stroke(120, 120, 200, 180);
        strokeWeight(3);
        if (typeof strokeDash !== 'undefined') strokeDash([6, 4]);
        noFill();

        beginShape();
        for (const p of out) vertex(p.x, p.y);
        endShape();

        fill(80, 80, 220, 200);
        noStroke();
        ellipse(ex, ey, 10);
        pop();
    }

    _drawPolyline(segs) {
        beginShape();
        vertex(segs[0].x1, segs[0].y1);
        for (const seg of segs) vertex(seg.x2, seg.y2);
        endShape();
    }

    static distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return dist(px, py, x1, y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2));
        return dist(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1));
    }
}