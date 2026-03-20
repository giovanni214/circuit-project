// File: public/new-visuals/junction-node.js

export class JunctionNode {
    constructor(parentWire, x, y) {
        this.parentWire = parentWire;
        this.worldX = x;
        this.worldY = y;
        this.type = 'OUTPUT';
        this.value = 0;
        this.parent = null;
        this.isJunction = true;
    }

    updateLogic() {
        this.value = this.parentWire.startNode ? this.parentWire.startNode.value : 0;
    }
}