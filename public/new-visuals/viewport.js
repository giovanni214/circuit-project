// 6. public/visuals/Viewport.js
export class Viewport {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.panStartX = 0;
        this.panStartY = 0;
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