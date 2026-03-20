// File: public/new-visuals/visual-component.js

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
    this.inputLabels = []; // Added to cache input labels

    // Must be set externally via setCircuitManager()
    this._circuitManager = null;

    this.setupNodes();
    this.updateNodes();
  }

  // ── Called by CircuitManager.addComponent() after construction ──
  setCircuitManager(cm) {
    this._circuitManager = cm;
  }

  setupNodes() {
    if (this.type === "CIRCUIT" && this.gate) {
      const maxPins = Math.max(
        this.gate.inputLength,
        this.gate.outputLength
      );
      const pinSpacing = this.gridSize * 2;

      const headerPadding = 30;
      const footerPadding =
        typeof this.gate.clock !== "undefined" ? 30 : 15;

      this.height = Math.max(
        this.gridSize * 5,
        (maxPins - 1) * pinSpacing + headerPadding + footerPadding
      );

      const titleLen = this.gate.name ? this.gate.name.length : 0;

      // Calculate output label lengths
      let maxOutLen = 0;
      if (this.gate.rootNodes) {
        for (let i = 0; i < this.gate.outputLength; i++) {
          const rn = this.gate.rootNodes[i];
          const lbl = rn && rn.name ? rn.name : `OUT${i}`;
          if (lbl.length > maxOutLen) maxOutLen = lbl.length;
        }
      }

      // Calculate input label lengths & cache names
      let maxInLen = 0;
      this.inputLabels = [];
      if (typeof this.gate.getInputNames === "function") {
        this.inputLabels = this.gate.getInputNames();
        for (const lbl of this.inputLabels) {
          if (lbl.length > maxInLen) maxInLen = lbl.length;
        }
      } else {
        for (let i = 0; i < this.gate.inputLength; i++) {
          const lbl = `IN${i}`;
          this.inputLabels.push(lbl);
          if (lbl.length > maxInLen) maxInLen = lbl.length;
        }
      }

      // Dynamically calculate width based on Title, Input, and Output Name lengths
      const requiredCharsWidth = Math.max(titleLen, maxInLen + maxOutLen + 4);
      const estimatedTextWidth = requiredCharsWidth * 8 + 40;
      const minWidth = this.gridSize * 6;

      this.width = Math.max(
        minWidth,
        Math.ceil(estimatedTextWidth / this.gridSize) * this.gridSize
      );

      const pinCenterOffsetY = (headerPadding - footerPadding) / 2;

      const inStartY =
        -((this.gate.inputLength - 1) * pinSpacing) / 2 +
        pinCenterOffsetY;
      for (let i = 0; i < this.gate.inputLength; i++) {
        const offsetY = inStartY + i * pinSpacing;
        this.inputNodes.push(
          new Node(this, -this.width / 2, offsetY, "INPUT")
        );
      }

      const outStartY =
        -((this.gate.outputLength - 1) * pinSpacing) / 2 +
        pinCenterOffsetY;
      for (let i = 0; i < this.gate.outputLength; i++) {
        const offsetY = outStartY + i * pinSpacing;
        this.outputNodes.push(
          new Node(this, this.width / 2, offsetY, "OUTPUT")
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
    for (const node of [...this.inputNodes, ...this.outputNodes]) {
      node.updateWorldPosition();
    }

    if (this._circuitManager) {
      for (const wire of this._circuitManager.wires) {
        if (
          wire.startNode.parent === this ||
          wire.endNode.parent === this
        ) {
          wire.updateEndpoints(this.gridSize);
        }
      }
    }
  }

  toggleState() {
    if (this.type === "INPUT") {
      this.value = this.value === 0 ? 1 : 0;
    }
  }

  updateLogic() {
    if (this.type === "CIRCUIT" && this.gate) {
      const inValues = this.inputNodes.map((n) => n.value || 0);
      const outValues = this.gate.tick(inValues);
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
      const btnX = this.x;
      const btnY = this.y + this.height / 2 - 12;
      return (
        wx >= btnX - 30 &&
        wx <= btnX + 30 &&
        wy >= btnY - 10 &&
        wy <= btnY + 10
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

  getNodeAt(worldX, worldY, zoom, radiusOverride = null) {
    const hitRadius =
      radiusOverride != null ? radiusOverride : 12 / zoom;
    for (const node of [...this.inputNodes, ...this.outputNodes]) {
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
      // Title
      const defaultTitleSize = 12;
      textSize(defaultTitleSize);
      const titleTw = textWidth(`${this.gate.name}`);
      const maxTitleWidth = this.width - 10;
      if (titleTw > maxTitleWidth) {
        textSize(
          Math.max(6, defaultTitleSize * (maxTitleWidth / titleTw))
        );
      }
      text(`${this.gate.name}`, 0, -this.height / 2 + 15);

      // Output labels
      textAlign(RIGHT, CENTER);
      for (let i = 0; i < this.outputNodes.length; i++) {
        const n = this.outputNodes[i];
        const rootNode = this.gate.rootNodes[i];
        const lbl = rootNode && rootNode.name ? rootNode.name : `OUT${i}`;
        fill(0);
        const defaultLblSize = 12;
        textSize(defaultLblSize);
        const lblTw = textWidth(lbl);
        const maxLblWidth = this.width / 2 - 12;
        if (lblTw > maxLblWidth) {
          textSize(
            Math.max(5, defaultLblSize * (maxLblWidth / lblTw))
          );
        }
        text(lbl, this.width / 2 - 8, n.offsetY);
      }

      // Input labels
      textAlign(LEFT, CENTER);
      for (let i = 0; i < this.inputNodes.length; i++) {
        const n = this.inputNodes[i];
        // Use the dynamically cached names!
        const lbl = this.inputLabels && this.inputLabels[i] ? this.inputLabels[i] : `IN${i}`;
        fill(0);
        const defaultLblSize = 12;
        textSize(defaultLblSize);
        const lblTw = textWidth(lbl);
        const maxLblWidth = this.width / 2 - 12;
        if (lblTw > maxLblWidth) {
          textSize(
            Math.max(5, defaultLblSize * (maxLblWidth / lblTw))
          );
        }
        text(lbl, -this.width / 2 + 8, n.offsetY);
      }

      // Clock button
      if (typeof this.gate.clock !== "undefined") {
        const clk = this.gate.clock;
        fill("#f5f5f5");
        stroke(200);
        strokeWeight(1);
        rectMode(CENTER);
        rect(0, this.height / 2 - 12, 60, 20, 3);

        fill(clk === 1 ? "#4CAF50" : "#F44336");
        noStroke();
        textAlign(CENTER, CENTER);

        const clkText = clk === 1 ? "CLK: ↑" : "CLK: ↓";
        const defaultClkSize = 12;
        textSize(defaultClkSize);
        const clkTw = textWidth(clkText);
        if (clkTw > 50) {
          textSize(Math.max(6, defaultClkSize * (50 / clkTw)));
        }
        text(clkText, 0, this.height / 2 - 12);
      }
    } else {
      const valText =
        this.type === "INPUT"
          ? `IN: ${this.value}`
          : `OUT: ${this.value}`;
      const defaultValSize = 14;
      textSize(defaultValSize);
      const valTw = textWidth(valText);
      const maxValWidth = this.width - 10;
      if (valTw > maxValWidth) {
        textSize(
          Math.max(6, defaultValSize * (maxValWidth / valTw))
        );
      }
      text(valText, 0, 0);
    }

    pop();

    for (const node of [...this.inputNodes, ...this.outputNodes]) {
      node.draw();
    }
  }
}