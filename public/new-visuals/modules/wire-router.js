// File: public/new-visuals/modules/wire-router.js

export class WireRouter {
    /**
     * Calculates the full orthogonal path for a wire.
     * @param {Object} startNode 
     * @param {Object} endNode 
     * @param {Array} anchors - List of user-defined {x, y, flipState}
     * @param {Number} gridSize 
     */
    static calculatePath(startNode, endNode, anchors, gridSize) {
        if (!startNode || !endNode) return [];

        const sx = startNode.worldX;
        const sy = startNode.worldY;
        const ex = endNode.worldX;
        const ey = endNode.worldY;

        // Create stubs to ensure lines come out straight from the pins
        const startDir = startNode.type === 'OUTPUT' ? 1 : -1;
        const endDir = endNode.type === 'INPUT' ? -1 : 1;

        const startStub = { x: sx + (gridSize * startDir), y: sy };
        const endStub = { x: ex + (gridSize * endDir), y: ey };

        // Full list of critical points to connect
        const controlPoints = [
            { x: sx, y: sy },
            startStub,
            ...anchors,
            endStub,
            { x: ex, y: ey }
        ];

        const path = [controlPoints[0]];

        for (let i = 0; i < controlPoints.length - 1; i++) {
            const current = controlPoints[i];
            const next = controlPoints[i + 1];

            // Use the anchor's flipState if available, otherwise default to 0
            const flipState = anchors[i - 1]?.flipState || 0;

            if (Math.abs(current.x - next.x) > 0.1 && Math.abs(current.y - next.y) > 0.1) {
                // Diagonal requires an orthogonal corner
                if (flipState === 0) {
                    path.push({ x: next.x, y: current.y }); // H-then-V
                } else {
                    path.push({ x: current.x, y: next.y }); // V-then-H
                }
            }
            path.push(next);
        }

        return this._cleanCollinear(path);
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

            if (!sameX && !sameY && !dup) out.push(curr);
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    static distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }
}