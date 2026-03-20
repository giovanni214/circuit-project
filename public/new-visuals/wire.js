// File: public/new-visuals/wire.js

export class Wire {
    /**
     * @param {Node} outNode  - OUTPUT node (source)
     * @param {Node} inNode   - INPUT node (destination)
     * @param {Array} waypoints - optional pre-built route
     */
    constructor(outNode, inNode, waypoints = null) {
        this.startNode = outNode;
        this.endNode = inNode;
        this.invertU = 0;

        // All corners are explicit — no implicit rendering math
        this.waypoints =
            waypoints !== null
                ? waypoints
                : Wire.autoRoute(
                    outNode.worldX,
                    outNode.worldY,
                    inNode.worldX,
                    inNode.worldY
                );

        // Enforce orthogonality immediately upon creation
        this._collapseInPlace();
    }

    // ── Signal propagation ──────────────────────────────────────

    propagate() {
        if (!this.startNode || !this.endNode) return;
        this.endNode.value = this.startNode.value ?? 0;
    }

    // ── Point list ──────────────────────────────────────────────

    /**
     * Full ordered point list: [startPin, ...waypoints, endPin]
     */
    getPoints() {
        return [
            { x: this.startNode.worldX, y: this.startNode.worldY },
            ...this.waypoints,
            { x: this.endNode.worldX, y: this.endNode.worldY },
        ];
    }

    /**
     * Orthogonal segment list derived directly from waypoints.
     * Each segment knows which waypoint index it starts at.
     */
    getSegments() {
        const pts = this.getPoints();
        const segs = [];
        for (let i = 0; i < pts.length - 1; i++) {
            segs.push({
                x1: pts[i].x,
                y1: pts[i].y,
                x2: pts[i + 1].x,
                y2: pts[i + 1].y,
                ptIndex: i, // index into getPoints() array
            });
        }
        return segs;
    }

    // ── Auto-routing ────────────────────────────────────────────

    static autoRoute(sx, sy, ex, ey, gridSize = 20, style = 0) {
        const stub = gridSize;
        const ox = sx + stub; // output stub tip
        const ix = ex - stub; // input stub tip

        let pts;

        if (ox <= ix) {
            // ── Forward flow ────────────────────────────────────
            const s = style % 3;
            if (s === 0) {
                const mid = Wire._snap((ox + ix) / 2, gridSize);
                pts = [
                    { x: ox, y: sy },
                    { x: mid, y: sy },
                    { x: mid, y: ey },
                    { x: ix, y: ey },
                ];
            } else if (s === 1) {
                pts = [
                    { x: ox, y: sy },
                    { x: ox, y: ey },
                    { x: ix, y: ey },
                ];
            } else {
                pts = [
                    { x: ox, y: sy },
                    { x: ix, y: sy },
                    { x: ix, y: ey },
                ];
            }
        } else {
            // ── Backward flow ───────────────────────────────────
            const s = style % 4;
            if (s === 0) {
                const safeY = Wire._snap(
                    Math.max(sy, ey) + gridSize * 3,
                    gridSize
                );
                pts = [
                    { x: ox, y: sy },
                    { x: ox, y: safeY },
                    { x: ix, y: safeY },
                    { x: ix, y: ey },
                ];
            } else if (s === 1) {
                const safeY = Wire._snap(
                    Math.min(sy, ey) - gridSize * 3,
                    gridSize
                );
                pts = [
                    { x: ox, y: sy },
                    { x: ox, y: safeY },
                    { x: ix, y: safeY },
                    { x: ix, y: ey },
                ];
            } else if (s === 2) {
                const midY = Wire._snap((sy + ey) / 2, gridSize);
                pts = [
                    { x: ox, y: sy },
                    { x: ox, y: midY },
                    { x: ix, y: midY },
                    { x: ix, y: ey },
                ];
            } else {
                const midX = Wire._snap((sx + ex) / 2, gridSize);
                pts = [
                    { x: ox, y: sy },
                    { x: midX, y: sy },
                    { x: midX, y: ey },
                    { x: ix, y: ey },
                ];
            }
        }

        return Wire._cleanCollinear(pts);
    }

    updateEndpoints(gridSize = 20) {
        const sx = this.startNode.worldX;
        const sy = this.startNode.worldY;
        const ex = this.endNode.worldX;
        const ey = this.endNode.worldY;
        const stub = gridSize;

        // If waypoints got lost entirely, reset the route safely
        if (this.waypoints.length < 2) {
            this.waypoints = Wire.autoRoute(sx, sy, ex, ey, gridSize);
            return;
        }

        // Move ONLY the output stub to follow the start pin
        this.waypoints[0].x = sx + stub;
        this.waypoints[0].y = sy;

        // Move ONLY the input stub to follow the end pin
        this.waypoints[this.waypoints.length - 1].x = ex - stub;
        this.waypoints[this.waypoints.length - 1].y = ey;

        // The orthogonalizer will automatically bridge the gap if the pin moved far away
        this._collapseInPlace(gridSize);
    }

    // ── Waypoint editing ────────────────────────────────────────

    /**
     * Drag a WAYPOINT (corner) to a new snapped position.
     */
    dragWaypoint(idx, wx, wy, gridSize) {
        if (idx < 0 || idx >= this.waypoints.length) return -1;
        const targetWp = this.waypoints[idx];

        const pts = this.getPoints(); // includes pin endpoints
        const wpOffset = 1; // waypoints start at pts[1]
        const ptsIdx = idx + wpOffset;

        const prev = pts[ptsIdx - 1];
        const curr = pts[ptsIdx];
        const next = pts[ptsIdx + 1];

        // Determine axis of each adjacent segment
        const prevIsH = Math.abs(prev.y - curr.y) < 1;
        const nextIsH = Math.abs(next.y - curr.y) < 1;

        // Snap the drag target
        const nx = Wire._snap(wx, gridSize);
        const ny = Wire._snap(wy, gridSize);

        if (prevIsH && nextIsH) {
            curr.y = ny;
            if (ptsIdx - 1 > 0) prev.y = curr.y;
            if (ptsIdx + 1 < pts.length - 1) next.y = curr.y;
        } else if (!prevIsH && !nextIsH) {
            curr.x = nx;
            if (ptsIdx - 1 > 0) prev.x = curr.x;
            if (ptsIdx + 1 < pts.length - 1) next.x = curr.x;
        } else {
            curr.x = nx;
            curr.y = ny;
            if (prevIsH) { if (ptsIdx - 1 > 0) prev.y = ny; } else { if (ptsIdx - 1 > 0) prev.x = nx; }
            if (nextIsH) { if (ptsIdx + 1 < pts.length - 1) next.y = ny; } else { if (ptsIdx + 1 < pts.length - 1) next.x = nx; }
        }

        // Safely write back points and track the target reference
        this._writeBackPts(pts);
        this._collapseInPlace(gridSize);

        return this.waypoints.indexOf(targetWp);
    }

    /**
     * Drag a SEGMENT perpendicular to itself.
     */
    dragSegment(segIdx, wx, wy, gridSize) {
        const segs = this.getSegments();
        const seg = segs[segIdx];
        if (!seg) return -1;

        const isH = Math.abs(seg.y2 - seg.y1) < 1;

        const nx = Wire._snap(wx, gridSize);
        const ny = Wire._snap(wy, gridSize);

        const pts = this.getPoints();
        const i = seg.ptIndex;

        // Move the endpoints of the dragged segment
        if (isH) {
            if (i > 0) pts[i].y = ny;
            if (i + 1 < pts.length - 1) pts[i + 1].y = ny;
            // Ensure neighbors stay orthogonal
            if (i > 0 && i - 1 > 0) pts[i - 1].x = pts[i].x;
            if (i + 2 < pts.length - 1) pts[i + 2].x = pts[i + 1].x;
        } else {
            if (i > 0) pts[i].x = nx;
            if (i + 1 < pts.length - 1) pts[i + 1].x = nx;
            if (i > 0 && i - 1 > 0) pts[i - 1].y = pts[i].y;
            if (i + 2 < pts.length - 1) pts[i + 2].y = pts[i + 1].y;
        }

        // Apply new geometry
        this._writeBackPts(pts);
        this._collapseInPlace(gridSize);

        // Positional Tracker: Find the newly generated segment under the mouse
        // so we don't drop the drag when arrays change size!
        const newSegs = this.getSegments();
        let bestPtIndex = -1;
        let closestDist = Infinity;

        for (const s of newSegs) {
            const sIsH = Math.abs(s.y2 - s.y1) < 1;

            // Only look at segments parallel to our drag axis
            if (isH === sIsH) {
                const isCollinear = isH ? Math.abs(s.y1 - ny) < 1 : Math.abs(s.x1 - nx) < 1;

                if (isCollinear) {
                    const d = Wire.distToSegment(wx, wy, s.x1, s.y1, s.x2, s.y2);
                    if (d < closestDist) {
                        closestDist = d;
                        bestPtIndex = s.ptIndex;
                    }
                }
            }
        }

        // Return the active segment's index, or -1 if it was absorbed into a straight line
        return closestDist < gridSize * 2 ? bestPtIndex : -1;
    }
    insertWaypointAt(wx, wy, gridSize) {
        const segs = this.getSegments();
        const sx = Wire._snap(wx, gridSize);
        const sy = Wire._snap(wy, gridSize);

        let bestDist = Infinity;
        let bestSeg = segs[0];

        for (const seg of segs) {
            const d = Wire.distToSegment(wx, wy, seg.x1, seg.y1, seg.x2, seg.y2);
            if (d < bestDist) {
                bestDist = d;
                bestSeg = seg;
            }
        }

        const insertAt = bestSeg.ptIndex;
        this.waypoints.splice(insertAt, 0, { x: sx, y: sy });
        return insertAt;
    }

    removeWaypoint(idx) {
        this.waypoints.splice(idx, 1);
    }

    // ── Hit testing ─────────────────────────────────────────────

    getHitWaypointIndex(wx, wy, zoom) {
        const hitR = 12 / zoom;
        for (let i = 0; i < this.waypoints.length; i++) {
            if (dist(wx, wy, this.waypoints[i].x, this.waypoints[i].y) < hitR)
                return i;
        }
        return -1;
    }

    getHitSegmentIndex(wx, wy, zoom) {
        const hitDist = 8 / zoom;
        for (const seg of this.getSegments()) {
            if (Wire.distToSegment(wx, wy, seg.x1, seg.y1, seg.x2, seg.y2) < hitDist)
                return seg.ptIndex;
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

        if (isActive) {
            stroke(0, 150, 255, 70);
            strokeWeight(14);
            noFill();
            this._drawPolyline(segs);

            for (const wp of this.waypoints) {
                fill(0, 150, 255, 200);
                noStroke();
                ellipse(wp.x, wp.y, 12);
            }
        }

        const val = this.startNode.value || 0;
        const col = val === 1 ? '#4CAF50' : '#555555';
        stroke(col);
        strokeWeight(3);
        noFill();
        this._drawPolyline(segs);

        fill(col);
        noStroke();
        for (const wp of this.waypoints) {
            ellipse(wp.x, wp.y, 7);
        }

        this._drawJunctions(segs, val);
    }

    static drawPreview(
        startNode,
        worldMouse,
        gridSize,
        waypoints,
        branchInsertIndex = -1
    ) {
        const ex = Wire._snap(worldMouse.x, gridSize);
        const ey = Wire._snap(worldMouse.y, gridSize);

        let pts;
        if (branchInsertIndex >= 0 && waypoints.length > 0) {
            pts = [...waypoints, { x: ex, y: ey }];
        } else {
            const startX =
                startNode.worldX +
                (startNode.type === 'OUTPUT' ? 6 : -6);
            pts = [
                { x: startX, y: startNode.worldY },
                ...waypoints,
                { x: ex, y: ey },
            ];
        }

        pts = Wire._orthogonalize(pts);

        push();
        stroke(120, 120, 200, 180);
        strokeWeight(3);
        if (typeof strokeDash !== 'undefined') {
            strokeDash([6, 4]);
        }
        noFill();

        beginShape();
        for (const p of pts) vertex(p.x, p.y);
        endShape();

        fill(120, 120, 200, 220);
        noStroke();
        const start = branchInsertIndex >= 0 ? 1 : 0;
        for (let i = start; i < waypoints.length; i++) {
            ellipse(waypoints[i].x, waypoints[i].y, 8);
        }

        fill(80, 80, 220, 200);
        ellipse(ex, ey, 10);

        pop();
    }

    // ── Cleanup ─────────────────────────────────────────────────

    _collapseInPlace(gridSize) {
        let pts = this.getPoints();
        pts = Wire._orthogonalize(pts);
        const cleaned = Wire._cleanCollinear(pts);
        this.waypoints = cleaned.slice(1, cleaned.length - 1);
    }

    static _cleanCollinear(pts) {
        if (pts.length <= 2) return pts;
        const out = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            const prev = out[out.length - 1];
            const curr = pts[i];
            const next = pts[i + 1];

            const sameX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
            const sameY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
            const dup = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(prev.y - curr.y) < 0.5;

            // DO NOT CLONE. Return original reference so indexOf keeps working!
            if (!sameX && !sameY && !dup) out.push(curr);
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    static _orthogonalize(pts) {
        if (pts.length < 2) return pts;
        const out = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
            const prev = out[out.length - 1];
            const curr = pts[i];
            const dx = Math.abs(prev.x - curr.x);
            const dy = Math.abs(prev.y - curr.y);

            // If the pin disconnects, insert a new joint rather than skewing diagonal
            if (dx > 0.5 && dy > 0.5) {
                out.push({ x: curr.x, y: prev.y });
            }
            out.push(curr); // DO NOT CLONE
        }
        return out;
    }

    _writeBackPts(pts) {
        const newWaypoints = [];

        // Protect Start Pin Gap
        if (Math.abs(pts[0].x - pts[1].x) > 0.5 && Math.abs(pts[0].y - pts[1].y) > 0.5) {
            newWaypoints.push({ x: pts[1].x, y: pts[0].y });
        }

        // Read Back Middle
        for (let i = 1; i < pts.length - 1; i++) {
            newWaypoints.push(pts[i]); // Keep original references
        }

        // Protect End Pin Gap
        const last = pts.length - 1;
        if (Math.abs(pts[last].x - pts[last - 1].x) > 0.5 && Math.abs(pts[last].y - pts[last - 1].y) > 0.5) {
            newWaypoints.push({ x: pts[last - 1].x, y: pts[last].y });
        }

        this.waypoints = newWaypoints;
    }

    // ── Helpers ─────────────────────────────────────────────────

    _drawPolyline(segs) {
        beginShape();
        vertex(segs[0].x1, segs[0].y1);
        for (const seg of segs) vertex(seg.x2, seg.y2);
        endShape();
    }

    _drawJunctions(segs, val) {
        const col = val === 1 ? '#4CAF50' : '#555555';
        fill(col);
        noStroke();
        ellipse(
            this.startNode.worldX,
            this.startNode.worldY,
            9
        );
    }

    static _snap(val, gridSize = 20) {
        return Math.round(val / gridSize) * gridSize;
    }

    static distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return dist(px, py, x1, y1);
        const t = Math.max(
            0,
            Math.min(
                1,
                ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
            )
        );
        return dist(
            px, py,
            x1 + t * (x2 - x1),
            y1 + t * (y2 - y1)
        );
    }
}