// File: public/new-visuals/wire.js

export class Wire {
    /**
     * @param {Node} outNode  - OUTPUT node (source)
     * @param {Node} inNode   - INPUT node (destination)
     * @param {Array} waypoints - optional pre-built route
     */
    constructor(outNode, inNode, waypoints = []) {
        this.startNode = outNode;
        this.endNode = inNode;
        this.invertU = 0;

        // All corners are explicit — no implicit rendering math
        this.waypoints =
            waypoints.length > 0
                ? waypoints
                : Wire.autoRoute(
                    outNode.worldX,
                    outNode.worldY,
                    inNode.worldX,
                    inNode.worldY
                );
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

    /**
     * Generates a clean orthogonal route. Every corner is an
     * explicit waypoint. Returns only the middle waypoints
     * (not the pin positions themselves).
     *
     * @param {number} sx - start X (output pin world position)
     * @param {number} sy
     * @param {number} ex - end X (input pin world position)
     * @param {number} ey
     * @param {number} gridSize
     * @param {number} style - 0..3 routing variants
     */
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

    /**
     * Called by VisualComponent.updateNodes() after a component moves.
     * Repairs only the stub segments at each end so the middle of the
     * route is preserved as much as possible.
     */
    updateEndpoints(gridSize = 20) {
        const sx = this.startNode.worldX;
        const sy = this.startNode.worldY;
        const ex = this.endNode.worldX;
        const ey = this.endNode.worldY;
        const stub = gridSize;

        // ── Repair output-side stub ─────────────────────────────
        if (this.waypoints.length >= 1) {
            const first = this.waypoints[0];
            // Keep stub X fixed relative to pin; only slide Y
            first.x = sx + stub;
            first.y = sy;
            // If 2nd waypoint shares Y with old first, align it too
            if (this.waypoints.length >= 2) {
                const second = this.waypoints[1];
                if (second.x === first.x) {
                    // vertical segment after stub — leave X, it moves with first
                } else {
                    second.y = sy; // was horizontal — keep it on same row
                }
            }
        }

        // ── Repair input-side stub ──────────────────────────────
        if (this.waypoints.length >= 1) {
            const last = this.waypoints[this.waypoints.length - 1];
            last.x = ex - stub;
            last.y = ey;
            if (this.waypoints.length >= 2) {
                const prev =
                    this.waypoints[this.waypoints.length - 2];
                if (prev.x === last.x) {
                    // vertical into stub — ok
                } else {
                    prev.y = ey;
                }
            }
        }

        this._collapseInPlace(gridSize);
    }

    // ── Waypoint editing ────────────────────────────────────────

    /**
     * Drag a WAYPOINT (corner) to a new snapped position.
     * Maintains orthogonality by adjusting the immediate
     * neighbors along their constrained axis.
     *
     * @param {number} idx - index into this.waypoints
     * @param {number} wx  - new world X (already snapped)
     * @param {number} wy  - new world Y (already snapped)
     * @param {number} gridSize
     */
    dragWaypoint(idx, wx, wy, gridSize) {
        const pts = this.getPoints(); // includes pin endpoints
        const wpOffset = 1; // waypoints start at pts[1]
        const ptsIdx = idx + wpOffset;

        const prev = pts[ptsIdx - 1];
        const curr = pts[ptsIdx];
        const next = pts[ptsIdx + 1];

        // Determine axis of each adjacent segment
        const prevIsH =
            prev && Math.abs(prev.y - curr.y) < 1; // horizontal
        const nextIsH =
            next && Math.abs(next.y - curr.y) < 1;

        // Snap the drag target
        const nx = Wire._snap(wx, gridSize);
        const ny = Wire._snap(wy, gridSize);

        if (prevIsH && nextIsH) {
            // Both neighbours on horizontal segments: only move Y
            curr.y = ny;
            // Insert vertical stubs to maintain orthogonality
            if (prev.y !== ny) prev.y = curr.y;
            if (next.y !== ny) next.y = curr.y;
        } else if (!prevIsH && !nextIsH) {
            // Both vertical: only move X
            curr.x = nx;
            if (prev.x !== nx) prev.x = curr.x;
            if (next.x !== nx) next.x = curr.x;
        } else {
            // Mixed — free move, rebuild intermediate corner
            curr.x = nx;
            curr.y = ny;
            // Constrain prev segment
            if (prevIsH) {
                prev.y = ny;
            } else {
                prev.x = nx;
            }
            // Constrain next segment
            if (nextIsH) {
                next.y = ny;
            } else {
                next.x = nx;
            }
        }

        // Write back (pins are read-only, skip them)
        for (let i = 1; i < pts.length - 1; i++) {
            this.waypoints[i - 1] = pts[i];
        }

        this._collapseInPlace(gridSize);
    }

    /**
     * Drag a SEGMENT perpendicular to itself.
     * This is the primary editing gesture — pull a line.
     *
     * @param {number} segIdx - index into getSegments()
     * @param {number} wx
     * @param {number} wy
     * @param {number} gridSize
     */
    dragSegment(segIdx, wx, wy, gridSize) {
        const segs = this.getSegments();
        const seg = segs[segIdx];
        if (!seg) return;

        const isH =
            Math.abs(seg.y2 - seg.y1) < 1; // horizontal segment

        const nx = Wire._snap(wx, gridSize);
        const ny = Wire._snap(wy, gridSize);

        const pts = this.getPoints();
        const i = seg.ptIndex; // pts[i] → pts[i+1]

        if (isH) {
            // Move both endpoints to new Y
            pts[i].y = ny;
            pts[i + 1].y = ny;
            // Fix neighbours for orthogonality
            if (i > 0) pts[i - 1].y === pts[i].y || (pts[i - 1].x = pts[i].x);
            if (i + 2 < pts.length)
                pts[i + 2].y === pts[i + 1].y ||
                    (pts[i + 2].x = pts[i + 1].x);
        } else {
            // Vertical — move both endpoints to new X
            pts[i].x = nx;
            pts[i + 1].x = nx;
            if (i > 0)
                pts[i - 1].x === pts[i].x ||
                    (pts[i - 1].y = pts[i].y);
            if (i + 2 < pts.length)
                pts[i + 2].x === pts[i + 1].x ||
                    (pts[i + 2].y = pts[i + 1].y);
        }

        // Write back (skip pin endpoints)
        for (let j = 1; j < pts.length - 1; j++) {
            this.waypoints[j - 1] = { ...pts[j] };
        }

        this._collapseInPlace(gridSize);
    }

    /**
     * Insert a waypoint on the segment closest to (wx, wy).
     * Used for T-junctions and Shift+Click joint insertion.
     * Returns the inserted waypoint index.
     */
    insertWaypointAt(wx, wy, gridSize) {
        const segs = this.getSegments();
        const sx = Wire._snap(wx, gridSize);
        const sy = Wire._snap(wy, gridSize);

        let bestDist = Infinity;
        let bestSeg = segs[0];

        for (const seg of segs) {
            const d = Wire.distToSegment(
                wx, wy, seg.x1, seg.y1, seg.x2, seg.y2
            );
            if (d < bestDist) {
                bestDist = d;
                bestSeg = seg;
            }
        }

        // ptIndex is the index in getPoints(); waypoints = pts[1..n-1]
        // So waypoint insert index = ptIndex (insert AFTER pts[ptIndex])
        const insertAt = bestSeg.ptIndex; // inserts between pts[i] and pts[i+1]
        this.waypoints.splice(insertAt, 0, { x: sx, y: sy });
        return insertAt;
    }

    /**
     * Remove a waypoint by index.
     */
    removeWaypoint(idx) {
        this.waypoints.splice(idx, 1);
    }

    // ── Hit testing ─────────────────────────────────────────────

    getHitWaypointIndex(wx, wy, zoom) {
        const hitR = 12 / zoom;
        for (let i = 0; i < this.waypoints.length; i++) {
            if (
                dist(wx, wy, this.waypoints[i].x, this.waypoints[i].y) <
                hitR
            )
                return i;
        }
        return -1;
    }

    getHitSegmentIndex(wx, wy, zoom) {
        const hitDist = 8 / zoom;
        for (const seg of this.getSegments()) {
            if (
                Wire.distToSegment(
                    wx, wy, seg.x1, seg.y1, seg.x2, seg.y2
                ) < hitDist
            )
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

        // ── Active glow ─────────────────────────────────────────
        if (isActive) {
            stroke(0, 150, 255, 70);
            strokeWeight(14);
            noFill();
            this._drawPolyline(segs);

            // Highlight all draggable waypoints
            for (const wp of this.waypoints) {
                fill(0, 150, 255, 200);
                noStroke();
                ellipse(wp.x, wp.y, 12);
            }
        }

        // ── Wire line ───────────────────────────────────────────
        const val = this.startNode.value || 0;
        const col = val === 1 ? '#4CAF50' : '#555555';
        stroke(col);
        strokeWeight(3);
        noFill();
        this._drawPolyline(segs);

        // ── Corner dots ─────────────────────────────────────────
        fill(col);
        noStroke();
        for (const wp of this.waypoints) {
            ellipse(wp.x, wp.y, 7);
        }

        // ── Junction dot at start (T-junction indicator) ────────
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

        push();
        stroke(120, 120, 200, 180);
        strokeWeight(3);
        strokeDash && strokeDash([6, 4]); // p5 extension if available
        noFill();

        beginShape();
        for (const p of pts) vertex(p.x, p.y);
        endShape();

        // Waypoint dots
        fill(120, 120, 200, 220);
        noStroke();
        const start = branchInsertIndex >= 0 ? 1 : 0;
        for (let i = start; i < waypoints.length; i++) {
            ellipse(waypoints[i].x, waypoints[i].y, 8);
        }

        // Cursor snap dot
        fill(80, 80, 220, 200);
        ellipse(ex, ey, 10);

        pop();
    }

    // ── Cleanup ─────────────────────────────────────────────────

    /**
     * Remove collinear/duplicate waypoints in-place.
     */
    _collapseInPlace(gridSize) {
        const pts = this.getPoints();
        const cleaned = Wire._cleanCollinear(pts);
        // Write back only interior points
        this.waypoints = cleaned.slice(1, cleaned.length - 1);
    }

    /**
     * Remove collinear and duplicate points from a full point array
     * (including pin endpoints). Returns cleaned array.
     */
    static _cleanCollinear(pts) {
        if (pts.length <= 2) return pts;
        const out = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            const prev = out[out.length - 1];
            const curr = pts[i];
            const next = pts[i + 1];
            // Skip if collinear on X or Y axis
            const sameX =
                Math.abs(prev.x - curr.x) < 0.5 &&
                Math.abs(curr.x - next.x) < 0.5;
            const sameY =
                Math.abs(prev.y - curr.y) < 0.5 &&
                Math.abs(curr.y - next.y) < 0.5;
            // Skip if duplicate of previous
            const dup =
                Math.abs(prev.x - curr.x) < 0.5 &&
                Math.abs(prev.y - curr.y) < 0.5;
            if (!sameX && !sameY && !dup) out.push({ ...curr });
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    // ── Helpers ─────────────────────────────────────────────────

    _drawPolyline(segs) {
        beginShape();
        vertex(segs[0].x1, segs[0].y1);
        for (const seg of segs) vertex(seg.x2, seg.y2);
        endShape();
    }

    _drawJunctions(segs, val) {
        // Draw a filled circle wherever this wire's path
        // touches the start node (makes T-junctions visible)
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

    /**
     * Kept for backward compatibility with serialized data.
     * @deprecated Use autoRoute instead.
     */
    static generateAutoWaypoints(sx, sy, ex, ey, gridSize, style = 0) {
        return Wire.autoRoute(sx, sy, ex, ey, gridSize, style);
    }
}