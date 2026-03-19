import { Node } from "./node.js";

export class VisualComponent {
  constructor(type, x, y, gridSize, gate = null) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.gate = gate;
    this.value = 0;
    this.gridSize = gridSize;

    this.width = 0;
    this.height = 0;

    this.inputNodes = [];
    this.outputNodes = [];

    this.setupNodes();
    this.updateNodes();
  }

  setupNodes() {
    if (this.type === "CIRCUIT" && this.gate) {
      const maxPins = Math.max(this.gate.inputLength, this.gate.outputLength);
      let pinSpacing = this.gridSize * 2;

      this.height = Math.max(this.gridSize * 4, (maxPins + 1) * pinSpacing);

      // --- NEW: Dynamic Width Calculation ---
      let maxLabelLen = this.gate.name ? this.gate.name.length : 0;
      if (this.gate.rootNodes) {
        for (let i = 0; i < this.gate.outputLength; i++) {
          let rn = this.gate.rootNodes[i];
          let lbl = rn && rn.name ? rn.name : `OUT${i}`;
          // Estimate length of 'INx' + 'lbl' taking up space on the same row
          let rowLen = lbl.length + 6;
          if (rowLen > maxLabelLen) maxLabelLen = rowLen;
        }
      }

      // Assume ~8 pixels per character width + 40px of padding for the margins
      let estimatedTextWidth = maxLabelLen * 8 + 40;
      let minWidth = this.gridSize * 5; // Enforce at least 100px wide

      // Snap the calculated width to the nearest grid step!
      this.width = Math.max(
        minWidth,
        Math.ceil(estimatedTextWidth / this.gridSize) * this.gridSize,
      );
      // --------------------------------------

      let inStartY = -((this.gate.inputLength - 1) * pinSpacing) / 2;
      for (let i = 0; i < this.gate.inputLength; i++) {
        let offsetY = inStartY + i * pinSpacing;
        this.inputNodes.push(new Node(this, -this.width / 2, offsetY, "INPUT"));
      }

      let outStartY = -((this.gate.outputLength - 1) * pinSpacing) / 2;
      for (let i = 0; i < this.gate.outputLength; i++) {
        let offsetY = outStartY + i * pinSpacing;
        this.outputNodes.push(
          new Node(this, this.width / 2, offsetY, "OUTPUT"),
        );
      }
    } else if (this.type === "INPUT") {
      this.width = this.gridSize * 3;
      this.height = this.gridSize * 3;
      this.outputNodes.push(new Node(this, this.width / 2, 0, "OUTPUT"));
    } else if (this.type === "OUTPUT") {
      this.width = this.gridSize * 3;
      this.height = this.gridSize * 3;
      this.inputNodes.push(new Node(this, -this.width / 2, 0, "INPUT"));
    }
  }

  updateNodes() {
    for (let node of [...this.inputNodes, ...this.outputNodes]) {
      node.updateWorldPosition();
    }
  }

  toggleState() {
    if (this.type === "INPUT") {
      this.value = this.value === 0 ? 1 : 0;
    }
  }

  updateLogic() {
    if (this.type === "CIRCUIT" && this.gate) {
      let inValues = this.inputNodes.map((n) => n.value || 0);
      let outValues = this.gate.tick(inValues);

      this.outputNodes.forEach((n, i) => {
        n.value = outValues[i] || 0;
      });
    } else if (this.type === "OUTPUT") {
      this.value = this.inputNodes[0].value || 0;
    } else if (this.type === "INPUT") {
      this.outputNodes[0].value = this.value;
    }
  }

  isClockHit(wx, wy) {
    if (
      this.type === "CIRCUIT" &&
      this.gate &&
      typeof this.gate.clock !== "undefined"
    ) {
      let btnX = this.x;
      let btnY = this.y + this.height / 2 - 12;
      return (
        wx >= btnX - 30 && wx <= btnX + 30 && wy >= btnY - 10 && wy <= btnY + 10
      );
    }
    return false;
  }

  isHit(wx, wy) {
    return (
      wx >= this.x - this.width / 2 &&
      wx <= this.x + this.width / 2 &&
      wy >= this.y - this.height / 2 &&
      wy <= this.y + this.height / 2
    );
  }

  getNodeAt(worldX, worldY, zoom) {
    const hitRadius = 12 / zoom;
    for (let node of [...this.inputNodes, ...this.outputNodes]) {
      if (dist(worldX, worldY, node.worldX, node.worldY) <= hitRadius) {
        return node;
      }
    }
    return null;
  }

  draw(font, isActive) {
    push();
    translate(this.x, this.y);

    if (this.type === "INPUT" || this.type === "OUTPUT") {
      fill(this.value === 1 ? "#C8E6C9" : "#FFCDD2");
    } else {
      fill(255);
    }

    if (isActive) {
      stroke(0, 150, 255);
      strokeWeight(4);
    } else {
      stroke(0);
      strokeWeight(2);
    }

    rectMode(CENTER);
    rect(0, 0, this.width, this.height, 5);

    fill(0);
    noStroke();
    textAlign(CENTER, CENTER);

    if (this.type === "CIRCUIT" && this.gate) {
      textSize(12);
      text(`${this.gate.name}`, 0, -this.height / 2 + 15);

      textAlign(RIGHT, CENTER);
      for (let i = 0; i < this.outputNodes.length; i++) {
        let n = this.outputNodes[i];
        let rootNode = this.gate.rootNodes[i];
        let lbl = rootNode && rootNode.name ? rootNode.name : `OUT${i}`;
        fill(0);
        text(lbl, this.width / 2 - 8, n.offsetY);
      }

      textAlign(LEFT, CENTER);
      for (let i = 0; i < this.inputNodes.length; i++) {
        let n = this.inputNodes[i];
        fill(0);
        text(`IN${i}`, -this.width / 2 + 8, n.offsetY);
      }

      if (typeof this.gate.clock !== "undefined") {
        let clk = this.gate.clock;

        fill("#f5f5f5");
        stroke(200);
        strokeWeight(1);
        rectMode(CENTER);
        rect(0, this.height / 2 - 12, 60, 20, 3);

        fill(clk === 1 ? "#4CAF50" : "#F44336");
        noStroke();
        textAlign(CENTER, CENTER);
        text(clk === 1 ? "CLK: ↑" : "CLK: ↓", 0, this.height / 2 - 12);
      }
    } else {
      textSize(14);
      text(
        this.type === "INPUT" ? `IN: ${this.value}` : `OUT: ${this.value}`,
        0,
        0,
      );
    }

    pop();

    for (let node of [...this.inputNodes, ...this.outputNodes]) {
      node.draw();
    }
  }
}
