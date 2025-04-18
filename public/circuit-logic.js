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

// ------------------------------
// Utility: Context & Circular Reference Check
// ------------------------------
function createDefaultContext() {
	return {
		visited: new Set()
	};
}

// ------------------------------
// 1) Base AST Node
// ------------------------------
class Node {
	evaluate(circuit, inputs) {
		throw new Error("evaluate() not implemented for base Node.");
	}
	toString(context = createDefaultContext()) {
		throw new Error("toString() not implemented for base Node.");
	}
}

// ------------------------------
// 2) AST Node Definitions
// ------------------------------

class LiteralNode extends Node {
	constructor(value) {
		super();
		this.value = value;
	}
	evaluate(circuit, inputs) {
		return this.value;
	}
	toString(context = createDefaultContext()) {
		return `${this.value}`;
	}
}

class InputNode extends Node {
	constructor(index) {
		super();
		this.index = index;
	}
	evaluate(circuit, inputs) {
		return inputs[this.index] ?? 0;
	}
	toString(context = createDefaultContext()) {
		return String.fromCharCode(65 + this.index); // A, B, C...
	}
}

class ClockNode extends Node {
	evaluate(circuit, inputs) {
		return circuit.clock;
	}
	toString(context = createDefaultContext()) {
		return "CLK";
	}
}

class GateNode extends Node {
	constructor(gateType, inputNodes, delay = 0) {
		super();
		this.gateType = gateType;
		this.inputNodes = inputNodes;
		this.delay = delay;
		this.lastValue = 0;
	}
	evaluate(circuit, inputs) {
		const gateFunc = circuit.getGate(this.gateType);
		if (typeof gateFunc !== "function") {
			throw new Error(`Gate "${this.gateType}" is not registered.`);
		}
		const childVals = this.inputNodes.map((n) => n.evaluate(circuit, inputs));
		const newValue = gateFunc(childVals);
		if (this.delay > 0) {
			const targetTick = circuit.currentTick + this.delay;
			circuit.scheduler.scheduleEvent(targetTick, () => {
				this.lastValue = newValue;
			});
			return this.lastValue;
		} else {
			this.lastValue = newValue;
			return newValue;
		}
	}
	toString(context = createDefaultContext()) {
		if (context.visited.has(this)) {
			return ""; // break recursion
		}
		context.visited.add(this);
		const childStrs = this.inputNodes.map((child) => child.toString(context));
		if (childStrs.length === 1) {
			return `${this.gateType}(${childStrs[0]})`;
		}

		return `(${childStrs.join(` ${this.gateType.toUpperCase()} `)})`;
	}
}

class FeedbackNode extends Node {
	constructor(inputNode, initialValue = 0, delay = 0, name = "Q") {
		super();
		this.inputNode = inputNode;
		this.currentValue = initialValue;
		this.delay = delay;
		this.name = name;
	}
	evaluate(circuit, inputs) {
		return this.currentValue;
	}
	computeFeedback(circuit, inputs) {
		const newValue = this.inputNode.evaluate(circuit, inputs);
		if (this.delay > 0) {
			const targetTick = circuit.currentTick + this.delay;
			circuit.scheduler.scheduleEvent(targetTick, () => {
				this.currentValue = newValue;
			});
		} else {
			this.currentValue = newValue;
		}
	}
	toString(context = createDefaultContext()) {
		if (context.visited.has(this)) {
			return `feedbackFrom(${this.name})`;
		}
		context.visited.add(this);
		const expr = this.inputNode.toString(context);
		return `${this.name} = ${expr}`;
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

		// timing
		this.totalTicks = 0;
		this.currentTick = 0;
		this.clock = 0;
		this.prevClock = 0;

		// feedback + gates
		this.feedbackNodes = [];
		this.gateRegistry = {};
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

	registerGate(name, func) {
		this.gateRegistry[name] = func;
	}
	getGate(name) {
		return this.gateRegistry[name];
	}
	registerFeedbackNode(node) {
		this.feedbackNodes.push(node);
	}

	// -----------------------------------------------------
	// 4.2) Compute inputLength & outputLength
	// -----------------------------------------------------
	#computeInputLength(node, visited = new Set()) {
		if (visited.has(node)) return -Infinity;
		visited.add(node);

		let highest = -1;
		if (node instanceof InputNode) {
			highest = node.index;
		} else if (node instanceof GateNode) {
			for (const child of node.inputNodes) {
				highest = Math.max(highest, this.#computeInputLength(child, visited));
			}
		} else if (node instanceof FeedbackNode) {
			highest = Math.max(highest, this.#computeInputLength(node.inputNode, visited));
		}
		return highest;
	}

	get inputLength() {
		let highest = -1;
		for (const node of this.rootNodes) {
			highest = Math.max(highest, this.#computeInputLength(node));
		}
		return highest < 0 ? 0 : highest + 1;
	}
	get outputLength() {
		return this.rootNodes.length;
	}

	// -----------------------------------------------------
	// 4.3) Evaluate & Tick (Multi-Delta Implementation)
	// -----------------------------------------------------
	evaluate(inputs = [], maxDeltaCycles = 50) {
		this.currentTick = this.totalTicks;
		const subHistory = [];
		let oldOutputs = null;

		for (let iteration = 1; iteration <= maxDeltaCycles; iteration++) {
			const queueBefore = [...this.scheduler.events];
			const events = this.scheduler.consumeEventsForTick(this.currentTick);
			events.forEach((e) => e.callback());
			this.feedbackNodes.forEach((fb) => fb.computeFeedback(this, inputs));
			const newOutputs = this.rootNodes.map((n) => n.evaluate(this, inputs));
			subHistory.push({
				deltaCycle: iteration,
				queueBefore,
				consumedEvents: events,
				queueAfter: [...this.scheduler.events],
				outputs: [...newOutputs]
			});
			const stable = oldOutputs !== null && arraysEqual(oldOutputs, newOutputs);
			const moreEvents = this.scheduler.hasEventsForTick(this.currentTick);
			oldOutputs = newOutputs;
			if (stable && !moreEvents) break;
		}

		this.history.push({ tick: this.totalTicks, subHistory });
		this.totalTicks++;
		return oldOutputs;
	}
	tick(inputs = []) {
		return this.evaluate(inputs);
	}
	evaluateUntilStable(inputs = [], maxOuter = 100) {
		let old = null;
		for (let i = 0; i < maxOuter; i++) {
			const out = this.tick(inputs);
			if (old !== null && arraysEqual(old, out)) return out;
			old = out;
		}
		return old;
	}

	// -----------------------------------------------------
	// 4.4) Cloning
	// -----------------------------------------------------
	#cloneNode(node, nodeMap) {
		if (nodeMap.has(node)) return nodeMap.get(node);

		let copy;
		if (node instanceof LiteralNode) {
			copy = new LiteralNode(node.value);
		} else if (node instanceof InputNode) {
			copy = new InputNode(node.index);
		} else if (node instanceof ClockNode) {
			copy = new ClockNode();
		} else if (node instanceof GateNode) {
			copy = new GateNode(node.gateType, [], node.delay);
			nodeMap.set(node, copy);
			copy.inputNodes = node.inputNodes.map((c) => this.#cloneNode(c, nodeMap));
			copy.lastValue = node.lastValue;
			return copy;
		} else if (node instanceof FeedbackNode) {
			copy = new FeedbackNode(null, node.currentValue, node.delay, node.name);
			nodeMap.set(node, copy);
			copy.inputNode = this.#cloneNode(node.inputNode, nodeMap);
			return copy;
		} else {
			throw new Error("Unsupported node type during clone.");
		}

		nodeMap.set(node, copy);
		return copy;
	}

	clone() {
		const nodeMap = new Map();
		const roots = this.rootNodes.map((n) => this.#cloneNode(n, nodeMap));
		const c = new Circuit(this.name, roots);
		c.clock = this.clock;
		c.prevClock = this.prevClock;
		c.gateRegistry = { ...this.gateRegistry };
		c.feedbackNodes = this.feedbackNodes.map((n) => this.#cloneNode(n, nodeMap));
		c.scheduler = new Scheduler();
		c.history = [];
		c.totalTicks = this.totalTicks;
		return c;
	}

	// -----------------------------------------------------
	// 4.5) Human-readable toString (using Set to guard recursion)
	// -----------------------------------------------------
	toString() {
		const lines = [];

		// 1) feedbackNodes in order
		for (let i = 0; i < this.feedbackNodes.length; i++) {
			const fb = this.feedbackNodes[i];
			const ctx = createDefaultContext();

			// pre‑mark every feedback node printed *before* this one
			for (let j = 0; j < i; j++) {
				ctx.visited.add(this.feedbackNodes[j]);
			}

			// now toString will inline THIS fb, but will render any earlier fb as feedbackFrom(...)
			lines.push(fb.toString(ctx));
		}

		// 2) (optional) if you have non‑feedback outputs, do the same trick:
		// for (const node of this.rootNodes) { ... }

		return lines.join("\n");
	}
}
