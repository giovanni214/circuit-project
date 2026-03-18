export class Wire {
    constructor(outNode, inNode, waypoints = []) {
        this.startNode = outNode;
        this.endNode = inNode;
        this.waypoints = waypoints;
        this.horizontalFirst = true;
        this.routeStyle = 0;
        this.invertU = 0; // ← ADD THIS (was undefined, broke generateAutoWaypoints)
    }

    propagate() {
        this.endNode.value = this.startNode.value || 0;
    }

    static generateAutoWaypoints(sx, sy, ex, ey, gridSize, routeStyle = 0) {
        let stub = gridSize;

        // FORWARD FLOW (Destination is to the right)
        if (sx + stub <= ex - stub) {
            let style = routeStyle % 3;

            if (style === 0) {
                // Center Drop
                let midX = Math.round((sx + (ex - sx) / 2) / gridSize) * gridSize;
                return [{ x: midX, y: sy }, { x: midX, y: ey }];
            } else if (style === 1) {
                // Early Drop
                return [{ x: sx + stub, y: sy }, { x: sx + stub, y: ey }];
            } else {
                // Late Drop
                return [{ x: ex - stub, y: sy }, { x: ex - stub, y: ey }];
            }
        }
        // BACKWARD FLOW (Destination is to the left or directly above/below)
        else {
            let style = routeStyle % 4; // Expanded to 4 options for backwards routing!

            if (style === 0) {
                // 1. Safety Loop Below (Default)
                let safeY = Math.round((Math.max(sy, ey) + gridSize * 3) / gridSize) * gridSize;
                return [
                    { x: sx + stub, y: sy }, { x: sx + stub, y: safeY },
                    { x: ex - stub, y: safeY }, { x: ex - stub, y: ey }
                ];
            } else if (style === 1) {
                // 2. Safety Loop Above
                let safeY = Math.round((Math.min(sy, ey) - gridSize * 3) / gridSize) * gridSize;
                return [
                    { x: sx + stub, y: sy }, { x: sx + stub, y: safeY },
                    { x: ex - stub, y: safeY }, { x: ex - stub, y: ey }
                ];
            } else if (style === 2) {
                // 3. Tight S-Curve (Direct Mid-Y wrap)
                let midY = Math.round((sy + (ey - sy) / 2) / gridSize) * gridSize;
                return [
                    { x: sx + stub, y: sy }, { x: sx + stub, y: midY },
                    { x: ex - stub, y: midY }, { x: ex - stub, y: ey }
                ];
            } else {
                // 4. "Just Turn Left" (Direct Z-Route overriding component safety)
                let midX = Math.round((sx + (ex - sx) / 2) / gridSize) * gridSize;
                return [{ x: midX, y: sy }, { x: midX, y: ey }];
            }
        }
    }

    getSegments() {
        let segments = [];
        let pts = [
            { x: this.startNode.worldX, y: this.startNode.worldY },
            ...this.waypoints,
            { x: this.endNode.worldX, y: this.endNode.worldY }
        ];

        for (let i = 0; i < pts.length - 1; i++) {
            let sx = pts[i].x, sy = pts[i].y;
            let ex = pts[i + 1].x, ey = pts[i + 1].y;
            let hFirst = this.horizontalFirst;

            if (i === 0) hFirst = true;
            if (i === pts.length - 2 && pts.length > 2) hFirst = false;

            let midX = hFirst ? ex : sx;
            let midY = hFirst ? sy : ey;

            if (sx !== midX || sy !== midY) segments.push({ x1: sx, y1: sy, x2: midX, y2: midY, ptIndex: i });
            if (midX !== ex || midY !== ey) segments.push({ x1: midX, y1: midY, x2: ex, y2: ey, ptIndex: i });
        }
        return segments;
    }

    draw(isActive) {
        let segments = this.getSegments();

        if (isActive) {
            stroke(0, 150, 255, 80);
            strokeWeight(12);
            noFill();

            beginShape();
            if (segments.length > 0) {
                vertex(segments[0].x1, segments[0].y1);
                for (let seg of segments) vertex(seg.x2, seg.y2);
            }
            endShape();

            fill(0, 150, 255);
            noStroke();
            for (let wp of this.waypoints) {
                ellipse(wp.x, wp.y, 10);
            }
        }

        let val = this.startNode.value || 0;
        stroke(val === 1 ? '#4CAF50' : '#444444');
        strokeWeight(4);
        noFill();

        beginShape();
        if (segments.length > 0) {
            vertex(segments[0].x1, segments[0].y1);
            for (let seg of segments) vertex(seg.x2, seg.y2);
        }
        endShape();

        if (this.waypoints.length > 0) {
            fill(val === 1 ? '#4CAF50' : '#444444');
            noStroke();
            for (let wp of this.waypoints) {
                ellipse(wp.x, wp.y, 8);
            }
        }
    }

    getHitWaypointIndex(wx, wy, zoom) {
        let hitRadius = 12 / zoom;
        for (let i = 0; i < this.waypoints.length; i++) {
            if (dist(wx, wy, this.waypoints[i].x, this.waypoints[i].y) < hitRadius) return i;
        }
        return -1;
    }

    insertWaypointAt(wx, wy, gridSize) {
        let segments = this.getSegments();
        let snappedX = Math.round(wx / gridSize) * gridSize;
        let snappedY = Math.round(wy / gridSize) * gridSize;

        let bestDist = Infinity;
        let insertIndex = 0;

        for (let seg of segments) {
            let d = Wire.distToSegment(wx, wy, seg.x1, seg.y1, seg.x2, seg.y2);
            if (d < bestDist) {
                bestDist = d;
                insertIndex = seg.ptIndex;
            }
        }

        this.waypoints.splice(insertIndex, 0, { x: snappedX, y: snappedY });
        return insertIndex;
    }

    isHit(wx, wy, zoom) {
        let segments = this.getSegments();
        let hitDist = 8 / zoom;

        for (let seg of segments) {
            if (Wire.distToSegment(wx, wy, seg.x1, seg.y1, seg.x2, seg.y2) < hitDist) {
                return true;
            }
        }
        return false;
    }

    static distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return dist(px, py, x1, y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return dist(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1));
    }

    // UPDATE: Radically simplified preview dragging
    static drawPreview(startNode, worldMouse, gridSize, waypoints) {
        let ex = Math.round(worldMouse.x / gridSize) * gridSize;
        let ey = Math.round(worldMouse.y / gridSize) * gridSize;

        let pts = [
            { x: startNode.worldX, y: startNode.worldY },
            ...waypoints,
            { x: ex, y: ey }
        ];

        push();
        stroke(150, 150, 150, 150);
        strokeWeight(4);
        noFill();

        for (let i = 0; i < pts.length - 1; i++) {
            let sx = pts[i].x, sy = pts[i].y;
            let nx = pts[i + 1].x, ny = pts[i + 1].y;

            // Simple L-Shape right angles for the preview. No crazy loops!
            let hFirst = Math.abs(nx - sx) >= Math.abs(ny - sy);
            if (i === 0 && startNode.type === 'OUTPUT') hFirst = true;

            let midX = hFirst ? nx : sx;
            let midY = hFirst ? sy : ny;

            beginShape();
            vertex(sx, sy);
            vertex(midX, midY);
            vertex(nx, ny);
            endShape();
        }
        pop();
    }
}