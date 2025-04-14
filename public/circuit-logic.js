// ===========================
// 1) Event Scheduler
// ===========================
class Scheduler {
  constructor() {
    this.events = [];
  }

  /**
   * scheduleEvent: queue a callback to run at targetTick
   */
  scheduleEvent(targetTick, callback) {
    this.events.push({ targetTick, callback });
  }

  /**
   * consumeEventsForTick: remove and return all events for a given tick
   */
  consumeEventsForTick(tick) {
    const ready = this.events.filter((e) => e.targetTick === tick);
    this.events = this.events.filter((e) => e.targetTick !== tick);
    return ready;
  }

  /**
   * hasEventsForTick: does at least one event remain for this tick?
   */
  hasEventsForTick(tick) {
    return this.events.some((e) => e.targetTick === tick);
  }
}

// ===========================
// 2) AST Node Definitions
// ===========================

class Node {
  evaluate(circuit, inputs) {
    throw new Error("evaluate() not implemented for base Node.");
  }
}

/**
 * LiteralNode: always returns a fixed 0 or 1
 */
class LiteralNode extends Node {
  constructor(value) {
    super();
    this.value = value;
  }
  evaluate(circuit, inputs) {
    return this.value;
  }
}

/**
 * InputNode: returns inputs[this.index] or 0 if not defined
 */
class InputNode extends Node {
  constructor(index) {
    super();
    this.index = index;
  }
  evaluate(circuit, inputs) {
    return inputs[this.index] ?? 0;
  }
}

/**
 * ClockNode: returns circuit.clock
 */
class ClockNode extends Node {
  evaluate(circuit, inputs) {
    return circuit.clock;
  }
}

/**
 * GateNode: applies a registered gate function to child node outputs.
 * Optional "delay" => schedules updates for future ticks.
 */
class GateNode extends Node {
  constructor(gateType, inputNodes, delay = 0) {
    super();
    this.gateType = gateType;
    this.inputNodes = inputNodes;
    this.delay = delay;

    // lastValue holds the gate's visible output if there's a delay
    this.lastValue = 0;
  }

  evaluate(circuit, inputs) {
    // find the gate function
    const gateFunc = circuit.getGate(this.gateType);
    if (typeof gateFunc !== "function") {
      throw new Error(`Gate "${this.gateType}" is not registered.`);
    }
    // evaluate child nodes
    const childVals = this.inputNodes.map((n) => n.evaluate(circuit, inputs));
    const newValue = gateFunc(childVals);

    // if delayed, schedule the update
    if (this.delay > 0) {
      const targetTick = circuit.currentTick + this.delay;
      circuit.scheduler.scheduleEvent(targetTick, () => {
        this.lastValue = newValue;
      });
      return this.lastValue; // until it fires
    } else {
      // immediate update
      this.lastValue = newValue;
      return newValue;
    }
  }
}

/**
 * FeedbackNode: stores a "currentValue" that is updated
 * by computeFeedback() once per evaluate cycle (possibly delayed).
 */
class FeedbackNode extends Node {
  constructor(inputNode, initialValue = 0, delay = 0) {
    super();
    this.inputNode = inputNode;
    this.currentValue = initialValue;
    this.delay = delay;
  }

  evaluate(circuit, inputs) {
    return this.currentValue;
  }

  computeFeedback(circuit, inputs) {
    const newValue = this.inputNode
      ? this.inputNode.evaluate(circuit, inputs)
      : 0;
    if (this.delay > 0) {
      const targetTick = circuit.currentTick + this.delay;
      circuit.scheduler.scheduleEvent(targetTick, () => {
        this.currentValue = newValue;
      });
    } else {
      this.currentValue = newValue;
    }
  }
}

// ===========================
// 3) Utility: arraysEqual
// ===========================
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ===========================
// 4) The Circuit Class
// ===========================
class Circuit {
  /**
   * rootNodes can be a single Node or an array of Node objects.
   */
  constructor(name, rootNodes) {
    this.name = name;
    this.rootNodes = Array.isArray(rootNodes) ? rootNodes : [rootNodes];

    // We track "time" in discrete ticks
    this.totalTicks = 0;
    // currentTick is used for multi-delta cycles within the same "time"
    this.currentTick = 0;

    this.clock = 0;
    this.prevClock = 0;

    // For feedback nodes
    this.feedbackNodes = [];
    // For gate functions
    this.gateRegistry = {};

    // Our event scheduler
    this.scheduler = new Scheduler();

    this.history = [];
  }

  // -----------------------------------------------------
  // 4.1) Basic Circuit Accessors
  // -----------------------------------------------------
  setClock(value) {
    this.prevClock = this.clock;
    this.clock = value;
  }
  getClock() {
    return this.clock;
  }

  getEdgeTrigger() {
    if (this.clock === this.prevClock) {
      return "SAME";
    } else if (this.clock > this.prevClock) {
      return "POSITIVE EDGE TRIGGER";
    } else {
      return "NEGATIVE EDGE TRIGGER";
    }
  }

  registerGate(name, funcOrCircuit) {
    // If we wanted sub-circuits, we could wrap them, etc.
    this.gateRegistry[name] = funcOrCircuit;
  }

  getGate(name) {
    return this.gateRegistry[name];
  }

  registerFeedbackNode(node) {
    if (!(node instanceof FeedbackNode)) {
      throw new Error("Feedback node must be instance of FeedbackNode.");
    }
    this.feedbackNodes.push(node);
  }

  // -----------------------------------------------------
  // 4.2) Compute inputLength & outputLength
  // -----------------------------------------------------
  #computeInputLength(node, visited = new Set()) {
    // Avoid infinite loops if there's feedback
    if (visited.has(node)) {
      return -Infinity;
    }
    visited.add(node);

    let highest = -1;
    if (node instanceof InputNode) {
      highest = node.index;
    } else if (node instanceof GateNode && Array.isArray(node.inputNodes)) {
      for (const child of node.inputNodes) {
        highest = Math.max(highest, this.#computeInputLength(child, visited));
      }
    } else if (node instanceof FeedbackNode && node.inputNode) {
      highest = Math.max(
        highest,
        this.#computeInputLength(node.inputNode, visited)
      );
    }
    return highest;
  }

  get inputLength() {
    let highest = -1;
    for (const node of this.rootNodes) {
      highest = Math.max(highest, this.#computeInputLength(node));
    }
    return highest === -Infinity ? 0 : highest + 1;
  }

  get outputLength() {
    return this.rootNodes.length;
  }

  // -----------------------------------------------------
  // 4.3) Evaluate & Tick (Multi-Delta Implementation)
  // -----------------------------------------------------

  /**
   * evaluate(inputs) => run one "time step" at this.currentTick,
   * but do multiple "delta cycles" until stable or out of sub-iterations.
   */
  evaluate(inputs = [], maxDeltaCycles = 50) {
    this.currentTick = this.totalTicks;

    const subHistory = []; // We'll store all micro-tick info here

    let oldOutputs = null;
    let iteration = 0;

    while (iteration < maxDeltaCycles) {
      iteration++;

      // ADDED: snapshot the queue before we consume anything
      //        You can store a deep copy, or just references. Up to you.
      const queueBefore = [...this.scheduler.events];

      // 1) consume events
      const events = this.scheduler.consumeEventsForTick(this.currentTick);

      // 2) fire each event callback
      for (const evt of events) {
        evt.callback();
      }

      // 3) update feedback
      for (const fb of this.feedbackNodes) {
        fb.computeFeedback(this, inputs);
      }

      // 4) evaluate root nodes => final outputs
      const newOutputs = this.rootNodes.map((n) => n.evaluate(this, inputs));

      // ADDED: record some info about this delta cycle
      subHistory.push({
        deltaCycle: iteration,
        queueBefore: queueBefore, // the queue before we consumed
        consumedEvents: events, // what we just consumed
        queueAfter: [...this.scheduler.events], // new snapshot after consumption & possible new scheduling
        outputs: [...newOutputs],
      });

      // Check stability
      if (oldOutputs === null) {
        oldOutputs = newOutputs;
        if (!this.scheduler.hasEventsForTick(this.currentTick)) {
          break;
        }
      } else {
        const stableOutputs = arraysEqual(oldOutputs, newOutputs);
        const moreEvents = this.scheduler.hasEventsForTick(this.currentTick);
        if (stableOutputs && !moreEvents) {
          oldOutputs = newOutputs;
          break;
        }
        oldOutputs = newOutputs;
      }
    }

    // push subHistory into a top-level history array
    this.history.push({
      tick: this.totalTicks,
      subHistory,
    });

    // end of multi-delta for this tick
    this.totalTicks++;

    return oldOutputs;
  }

  /**
   * tick(inputs) => shorthand for evaluate(inputs)
   */
  tick(inputs = []) {
    return this.evaluate(inputs);
  }

  /**
   * Optional: evaluateUntilStable across multiple ticks
   * (If you have multi-tick delays or want to see final, final stable.)
   */
  evaluateUntilStable(inputs = [], maxOuterIterations = 100) {
    let oldOutputs = null;
    let iteration = 0;

    while (iteration < maxOuterIterations) {
      const newOutputs = this.tick(inputs);
      // compare oldOutputs & newOutputs
      if (arraysEqual(oldOutputs ?? [], newOutputs)) {
        // no change => stable across ticks
        return newOutputs;
      }
      oldOutputs = newOutputs;
      iteration++;
    }
    return oldOutputs;
  }

  // -----------------------------------------------------
  // 4.4) Cloning
  // -----------------------------------------------------
  #cloneNode(node, nodeMap = new Map()) {
    if (nodeMap.has(node)) {
      return nodeMap.get(node);
    }

    let newNode;
    if (node instanceof LiteralNode) {
      newNode = new LiteralNode(node.value);
    } else if (node instanceof InputNode) {
      newNode = new InputNode(node.index);
    } else if (node instanceof ClockNode) {
      newNode = new ClockNode();
    } else if (node instanceof GateNode) {
      const clonedInputs = node.inputNodes.map((child) =>
        this.#cloneNode(child, nodeMap)
      );
      newNode = new GateNode(node.gateType, clonedInputs, node.delay);
      newNode.lastValue = node.lastValue;
    } else if (node instanceof FeedbackNode) {
      // create a placeholder first to handle cycles
      newNode = new FeedbackNode(null, node.currentValue, node.delay);
      nodeMap.set(node, newNode);
      // now set its input
      newNode.inputNode = this.#cloneNode(node.inputNode, nodeMap);
      return newNode;
    } else {
      throw new Error("Unsupported node type during clone.");
    }

    nodeMap.set(node, newNode);
    return newNode;
  }

  clone() {
    // clone root nodes
    const newRootNodes = this.rootNodes.map((n) => this.#cloneNode(n));

    // create new circuit
    const newCircuit = new Circuit(this.name, newRootNodes);
    newCircuit.clock = this.clock;
    newCircuit.prevClock = this.prevClock;

    // copy gate registry
    for (const key in this.gateRegistry) {
      const gate = this.gateRegistry[key];
      newCircuit.gateRegistry[key] = gate;
    }

    // clone feedback nodes
    newCircuit.feedbackNodes = this.feedbackNodes.map((n) =>
      this.#cloneNode(n)
    );

    // new circuit has a fresh scheduler
    newCircuit.scheduler = new Scheduler();

    // copy totalTicks if you want them in sync
    newCircuit.totalTicks = this.totalTicks;

    return newCircuit;
  }
}
