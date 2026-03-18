export class Node {
    constructor(parent, offsetX, offsetY, type) {
        this.parent = parent;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.type = type; // 'INPUT' or 'OUTPUT'

        this.worldX = 0;
        this.worldY = 0;
        this.radius = 6; // Retained internally for click hit-detection radius
        this.value = 0;
    }

    updateWorldPosition() {
        this.worldX = this.parent.x + this.offsetX;
        this.worldY = this.parent.y + this.offsetY;
    }

    draw() {
        // Uniform color logic, removing the red/green fills
        fill(255);
        stroke(0);
        strokeWeight(2);

        push();
        translate(this.worldX, this.worldY);

        // Draw geometric arrows instead of circles.
        // Because signal flow is strictly Left-to-Right:
        // Input pins (Left side) point IN (Right). Output pins (Right side) point OUT (Right).
        beginShape();
        vertex(-5, -6);
        vertex(5, 0);
        vertex(-5, 6);
        endShape(CLOSE);

        pop();
    }
}