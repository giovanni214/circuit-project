class Circuit {
  constructor(name, ast = null) {
    this.name = name;
    this.ast = ast;
    this.context = {};
    this.history = [];

    // Global clock and iteration info
    this.clock = 0;
    this.prevClock = 0;
    this.totalTicks = 0;

    // Persistent feedback array storing outputs across ticks
    this.feedbackState = [];
  }

  // A static helper to create a composite gate circuit in one go
  static createCompositeGate(name, astBuilder, gateRegs) {
    const c = new Circuit(name);
    for (const { gateName, func } of gateRegs) {
      c.registerGate(gateName, func);
    }
    const ast = astBuilder();
    c.ast = ast;
    return c;
  }

  // Basic AST Node
  static Node = class {
    constructor(type, value = null, children = []) {
      this.type = type; // e.g. "input", "clock", "literal", "gate", "feedback"
      this.value = value;
      this.children = children;
    }
  };

  // Helpers for building AST
  static createInputNode(index) {
    return new Circuit.Node("input", index);
  }
  static createClockNode() {
    return new Circuit.Node("clock");
  }
  static createLiteralNode(value) {
    return new Circuit.Node("literal", value);
  }
  static createGateNode(gateName, ...children) {
    return new Circuit.Node("gate", gateName, children);
  }
  static createFeedbackNode(outputIndex, targetInput) {
    // Ties outputIndex => feedbackState[targetInput]
    return new Circuit.Node("feedback", { outputIndex, targetInput });
  }

  registerGate(gateName, func) {
    this.context[gateName] = func;
    this.history.push(`Registered gate: ${gateName}`);
  }

  setAST(ast) {
    this.ast = ast;
    this.history.push("AST set.");
  }

  // Count how many input nodes exist in the AST
  _computeInputCount(node = this.ast) {
    if (!node) return 0;
    if (Array.isArray(node)) {
      return node.reduce(
        (max, n) => Math.max(max, this._computeInputCount(n)),
        0
      );
    }
    let c = 0;
    if (node.type === "input") c = node.value + 1;
    if (node.children) {
      for (const child of node.children) {
        c = Math.max(c, this._computeInputCount(child));
      }
    }
    return c;
  }

  get inputLength() {
    return this._computeInputCount();
  }

  // We'll do a single-pass evaluate that reads from this.feedbackState
  _singlePassEvaluate(inputs) {
    const evalNode = (node) => {
      switch (node.type) {
        case "input": {
          return inputs[node.value];
        }
        case "clock": {
          return this.clock;
        }
        case "literal": {
          return node.value;
        }
        case "feedback": {
          // read from the feedbackState array
          const { outputIndex, targetInput } = node.value;
          return this.feedbackState[targetInput] ?? 0;
        }
        case "gate": {
          const gateFunc = this.context[node.value];
          if (!gateFunc)
            throw new Error(`Gate '${node.value}' not found in context.`);
          const childVals = node.children.map((ch) => evalNode(ch));
          return gateFunc(...childVals);
        }
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    };

    let out = Array.isArray(this.ast)
      ? this.ast.map((n) => evalNode(n))
      : evalNode(this.ast);

    return Array.isArray(out) ? out : [out];
  }

  // Called each time step: single pass, store outputs
  tick(inputs, newClockValue = this.clock) {
    this.prevClock = this.clock;
    this.clock = newClockValue;
    this.totalTicks++;

    const outputs = this._singlePassEvaluate(inputs);
    this._updateFeedback(outputs);
    return outputs;
  }

  // Store the new outputs in feedbackState
  _updateFeedback(outputs) {
    const fbnodes = this._collectFeedbackNodes(this.ast);
    for (const { outputIndex, targetInput } of fbnodes) {
      this.feedbackState[targetInput] = outputs[outputIndex] ?? 0;
    }
  }

  _collectFeedbackNodes(node) {
    let arr = [];
    if (!node) return arr;
    if (Array.isArray(node)) {
      for (const n of node) {
        arr = arr.concat(this._collectFeedbackNodes(n));
      }
      return arr;
    }
    if (node.type === "feedback") {
      arr.push(node.value);
    }
    if (node.children) {
      for (const c of node.children) {
        arr = arr.concat(this._collectFeedbackNodes(c));
      }
    }
    return arr;
  }

  // Generate a truth table (only recommended for pure combinational or small circuits).
  generateTruthTable() {
    const table = [];
    const rowCount = 2 ** this.inputLength;
    for (let i = 0; i < rowCount; i++) {
      // If there's a clock, it's read from .clock, not from inputs
      // so this isn't truly correct for sequential circuits
      // but we'll do the naive approach
      const bits = i
        .toString(2)
        .padStart(this.inputLength, "0")
        .split("")
        .map(Number);
      const out = this._singlePassEvaluate(bits);
      table.push({ inputs: bits, outputs: out });
    }
    return table;
  }

  // Visualize the AST
  visualizeAST(node = this.ast, indent = 0) {
    const pad = "  ".repeat(indent);
    if (!node) return "";
    if (Array.isArray(node)) {
      return node.map((n) => this.visualizeAST(n, indent)).join("\n");
    }
    switch (node.type) {
      case "input":
        return `${pad}Input(${node.value})`;
      case "clock":
        return `${pad}ClockNode()`;
      case "literal":
        return `${pad}Literal(${node.value})`;
      case "feedback": {
        const { outputIndex, targetInput } = node.value;
        return `${pad}Feedback(out:${outputIndex} -> in:${targetInput})`;
      }
      case "gate": {
        const kids = node.children
          .map((ch) => this.visualizeAST(ch, indent + 1))
          .join("\n");
        return `${pad}Gate(${node.value})\n${kids}`;
      }
      default:
        return `${pad}Unknown(${node.type})`;
    }
  }

  // chainWith: connect this circuit's outputs to another circuit's inputs
  chainWith(other) {
    // in a simple form, we do single pass evaluate => feed into other
    const outLen = this.outputLength;
    const inLen = other.inputLength;
    if (outLen !== inLen) {
      throw new Error(
        `Mismatch: ${this.name} outputs ${outLen} bits, but ${other.name} needs ${inLen} inputs`
      );
    }
    const chained = new Circuit(`${this.name}_chained_${other.name}`);
    // Merge contexts
    chained.context = { ...this.context, ...other.context };
    // We define a custom single pass:
    chained._singlePassEvaluate = (inputs) => {
      const inter = this._singlePassEvaluate(inputs);
      return other._singlePassEvaluate(inter);
    };
    return chained;
  }

  // For quick logic: if there's no prior state, pass dummy inputs => evaluate => see how many outputs
  get outputLength() {
    const dummy = new Array(this.inputLength).fill(0);
    const out = this._singlePassEvaluate(dummy);
    return out.length;
  }

  // clone
  static _cloneAST(node) {
    if (!node) return null;
    const copy = new Circuit.Node(node.type, node.value, []);
    if (node.children && node.children.length > 0) {
      copy.children = node.children.map((ch) => Circuit._cloneAST(ch));
    }
    return copy;
  }

  clone() {
    const c = new Circuit(this.name);
    c.ast = Array.isArray(this.ast)
      ? this.ast.map((n) => Circuit._cloneAST(n))
      : Circuit._cloneAST(this.ast);
    c.context = { ...this.context };
    c.history = [...this.history];
    c.clock = this.clock;
    c.prevClock = this.prevClock;
    c.totalTicks = this.totalTicks;
    // feedbackState is part of the circuit's internal memory
    c.feedbackState = [...this.feedbackState];
    return c;
  }
}

///////////////////////////////////////////////////////////////
// Minimal example: a D-latch made from cross-coupled NOR gates
// using numeric feedback nodes, returned from a builder function
///////////////////////////////////////////////////////////////

function buildSimpleDLatchAST() {
  const D = Circuit.createInputNode(0);
  const CLK = Circuit.createClockNode();

  const notCLK = Circuit.createGateNode("NOT", CLK);
  const notD = Circuit.createGateNode("NOT", D);

  const S = Circuit.createGateNode("AND", D, notCLK);
  const R = Circuit.createGateNode("AND", notD, notCLK);

  // Q references output #1 => Q'
  const fbQ = Circuit.createFeedbackNode(1, 0);
  // Q' references output #0 => Q
  const fbQp = Circuit.createFeedbackNode(0, 1);

  const Q_node = Circuit.createGateNode("NOR", R, fbQ);
  const Qp_node = Circuit.createGateNode("NOR", S, fbQp);
  return [Q_node, Qp_node];
}

// Basic gates
const AND_GATE = (a, b) => a && b;
const NOT_GATE = (x) => Number(!x);
const NOR_GATE = (a, b) => Number(!(a || b));

// Build with createCompositeGate
const dLatchCircuit = Circuit.createCompositeGate(
  "SimpleDLatch",
  () => buildSimpleDLatchAST(),
  [
    { gateName: "AND", func: AND_GATE },
    { gateName: "NOT", func: NOT_GATE },
    { gateName: "NOR", func: NOR_GATE },
  ]
);
