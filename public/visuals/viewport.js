export class Viewport {
    constructor() {
        this.offsetX = 0;
        this.offsetY = 0;
        this.zoomLevel = 1;
        this.gridSpacing = 50;
        this.draggingGrid = false;
        this.gridPanOffset = { x: 0, y: 0 };
    }

    drawGrid() {
        stroke(100);
        strokeWeight(1 / this.zoomLevel);

        let startX = -this.offsetX / this.zoomLevel;
        let startY = -this.offsetY / this.zoomLevel;
        let endX = (width - this.offsetX) / this.zoomLevel;
        let endY = (height - this.offsetY) / this.zoomLevel;

        let startGridX = floor(startX / this.gridSpacing) * this.gridSpacing;
        let startGridY = floor(startY / this.gridSpacing) * this.gridSpacing;

        for (let x = startGridX; x <= endX; x += this.gridSpacing) {
            line(x, startY, x, endY);
        }
        for (let y = startGridY; y <= endY; y += this.gridSpacing) {
            line(startX, y, endX, y);
        }
    }

    startGridPan() {
        this.draggingGrid = true;
        this.gridPanOffset.x = mouseX - this.offsetX;
        this.gridPanOffset.y = mouseY - this.offsetY;
    }

    updateGridPan() {
        this.offsetX = mouseX - this.gridPanOffset.x;
        this.offsetY = mouseY - this.gridPanOffset.y;
    }

    endGridPan() {
        this.draggingGrid = false;
    }

    handleZoom(event) {
        if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
            return false;
        }

        let oldZoom = this.zoomLevel;
        let baseZoomFactor = 1.05;
        let zoomFactor;

        if (event.delta > 0) {
            zoomFactor = baseZoomFactor;
            this.zoomLevel /= zoomFactor;
        } else {
            zoomFactor = baseZoomFactor;
            this.zoomLevel *= zoomFactor;
        }

        this.zoomLevel = constrain(this.zoomLevel, 0.15, 4);

        let worldX = (mouseX - this.offsetX) / oldZoom;
        let worldY = (mouseY - this.offsetY) / oldZoom;
        this.offsetX = mouseX - worldX * this.zoomLevel;
        this.offsetY = mouseY - worldY * this.zoomLevel;

        return false;
    }
}