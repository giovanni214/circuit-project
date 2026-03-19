export class Viewport {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.panStartX = 0;
        this.panStartY = 0;

        // Touch interaction properties
        this.initialPinchDist = null;
        this.zoomStart = 1;
    }

    apply() {
        translate(this.x, this.y);
        scale(this.zoom);
    }

    getWorldCoords(screenX, screenY) {
        return {
            x: (screenX - this.x) / this.zoom,
            y: (screenY - this.y) / this.zoom
        };
    }

    startPan(mx, my) {
        this.panStartX = mx - this.x;
        this.panStartY = my - this.y;
    }

    updatePan(mx, my) {
        this.x = mx - this.panStartX;
        this.y = my - this.panStartY;
    }

    handleZoom(event, mx, my) {
        let zoomAmount = event.deltaY > 0 ? 0.96 : 1.04;
        let prevZoom = this.zoom;
        this.zoom = constrain(this.zoom * zoomAmount, 0.2, 3);
        this.x = mx - (mx - this.x) * (this.zoom / prevZoom);
        this.y = my - (my - this.y) * (this.zoom / prevZoom);
    }

    handleTouchZoom(touches) {
        if (touches.length === 2) {
            let dx = touches[0].x - touches[1].x;
            let dy = touches[0].y - touches[1].y;
            let currentDist = Math.sqrt(dx * dx + dy * dy);

            let centerX = (touches[0].x + touches[1].x) / 2;
            let centerY = (touches[0].y + touches[1].y) / 2;

            if (this.initialPinchDist === null) {
                this.initialPinchDist = currentDist;
                this.zoomStart = this.zoom;
            } else {
                let prevZoom = this.zoom;
                this.zoom = constrain(this.zoomStart * (currentDist / this.initialPinchDist), 0.2, 3);

                this.x = centerX - (centerX - this.x) * (this.zoom / prevZoom);
                this.y = centerY - (centerY - this.y) * (this.zoom / prevZoom);
            }
        } else {
            this.initialPinchDist = null;
        }
    }

    endTouch() {
        this.initialPinchDist = null;
    }

    drawGrid(spacing) {
        stroke(220);
        strokeWeight(1 / this.zoom);
        let left = -this.x / this.zoom;
        let top = -this.y / this.zoom;
        let right = left + width / this.zoom;
        let bottom = top + height / this.zoom;
        let startX = Math.floor(left / spacing) * spacing;
        let startY = Math.floor(top / spacing) * spacing;
        for (let i = startX; i < right; i += spacing) {
            line(i, top, i, bottom);
        }
        for (let i = startY; i < bottom; i += spacing) {
            line(left, i, right, i);
        }
    }
}