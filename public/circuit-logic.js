// ===========================
// AST Node Definitions (Array-Based)
// ===========================

// Base Node – every node implements evaluate(circuit, inputs)
class Node {
	evaluate(circuit, inputs) {
		throw new Error("Evaluate not implemented");
	}
}

// LiteralNode returns a fixed binary value (0 or 1).
class LiteralNode extends Node {
	constructor(value) {
		super();
		this.value = value;
	}
	evaluate(circuit, inputs) {
		return this.value;
	}
}

// InputNode retrieves a value from the input array by its index.
class InputNode extends Node {
	constructor(index) {
		super();
		this.index = index;
	}
	evaluate(circuit, inputs) {
		return inputs[this.index] !== undefined ? inputs[this.index] : 0;
	}
}

// ClockNode reads the clock value from the Circuit.
class ClockNode extends Node {
	evaluate(circuit, inputs) {
		return circuit.clock;
	}
}

// GateNode collects its child nodes’ evaluations (as an array)
// and calls the registered gate function with that array.
class GateNode extends Node {
	constructor(gateType, inputNodes) {
		super();
		this.gateType = gateType;
		this.inputNodes = inputNodes; // array of Node instances
	}

	evaluate(circuit, inputs) {
		const evaluatedInputs = this.inputNodes.map((node) => node.evaluate(circuit, inputs));
		const gateFunc = circuit.getGate(this.gateType);
		if (typeof gateFunc !== "function") {
			throw new Error(`Gate "${this.gateType}" is not registered.`);
		}
		return gateFunc(evaluatedInputs, circuit);
	}
}

// FeedbackNode holds a value (for example, a latch state).
// When evaluated, it returns its stored value.
// Later, its computeFeedback() method computes a new value (based on the current state)
// and update() sets its stored value to that newly computed value.
class FeedbackNode extends Node {
	constructor(inputNode, initialValue = 0) {
		super();
		this.inputNode = inputNode; // Driving expression node.
		this.currentValue = initialValue; // Stored value.
	}
	evaluate(circuit, inputs) {
		return this.currentValue;
	}
	computeFeedback(circuit, inputs) {
		// Compute new value based on current state of the circuit.
		this.currentValue = this.inputNode.evaluate(circuit, inputs);
	}
}

// ===========================
// Helper Function: Array Equality Checker
// ===========================
function arraysEqual(arr1, arr2) {
	if (arr1.length !== arr2.length) return false;
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
}

// ===========================
// Circuit Class with Updated evaluate(), evaluateUntilStable(), and tick()
// ===========================
class Circuit {
	/**
	 * @param {Node|Array.<Node>} rootNodes - The output node or an array of output nodes.
	 */
	constructor(rootNodes) {
		this.rootNodes = Array.isArray(rootNodes) ? rootNodes : [rootNodes];
		this.clock = 0; // The clock state (externally controlled).
		this.prevClock = this.clock;
		this.feedbackNodes = []; // Feedback nodes that need updating.
		this.gateRegistry = {}; // Registered gate functions or sub-circuits.
	}

	#computeInputLength(node, visited = new Set()) {
		// If the node has been visited already, return -Infinity so it doesn't affect the maximum.
		if (visited.has(node)) {
			return -Infinity;
		}
		visited.add(node);

		let highest = -1;

		// If the node is an InputNode, record its index.
		if (node instanceof InputNode) {
			highest = node.index;
		}

		// For a GateNode, traverse its child nodes.
		if (node instanceof GateNode && Array.isArray(node.inputNodes)) {
			for (let child of node.inputNodes) {
				highest = Math.max(highest, this.#computeInputLength(child, visited));
			}
		}

		// For a FeedbackNode, traverse its driving expression if available.
		if (node instanceof FeedbackNode && node.inputNode) {
			highest = Math.max(highest, this.#computeInputLength(node.inputNode, visited));
		}

		return highest;
	}

	get inputLength() {
		let highest = -1;
		for (const node of this.rootNodes) {
			highest = Math.max(highest, this.#computeInputLength(node));
		}
		return highest + 1; // +1 because input indices are zero-based.
	}

	get outputLength() {
		return this.rootNodes.length;
	}

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
			return "POSITIVE EDGE TRGGER";
		} else return "NEGATIVE EDGE TRIGGER";
	}

	/**
	 * evaluate() performs one update cycle:
	 *  - It first updates all feedback nodes (computeFeedback() then update()).
	 *  - Then it re‑evaluates the root nodes after the update.
	 * It returns the outputs computed after updating the feedback nodes.
	 */
	evaluate(inputs = []) {
		// First, update all feedback nodes.
		for (const fb of this.feedbackNodes) {
			fb.computeFeedback(this, inputs);
		}
		// Now, re-read outputs after feedback update.
		const outputs = this.rootNodes.map((node) => node.evaluate(this, inputs));
		return outputs;
	}

	/**
	 * evaluateUntilStable() repeatedly calls evaluate() until the outputs stop changing.
	 * The clock state remains fixed during this iteration.
	 */
	evaluateUntilStable(inputs = [], maxIterations = 100, clockValue = this.clock) {
		this.clock = clockValue;
		let outputs = this.evaluate(inputs);
		let iterations = 0;
		while (iterations < maxIterations) {
			const newOutputs = this.evaluate(inputs);
			if (arraysEqual(newOutputs, outputs)) {
				break;
			}
			outputs = newOutputs;
			iterations++;
		}
		return outputs;
	}

	/**
	 * tick() performs one update cycle (using evaluate()) and returns the new outputs.
	 * The clock state is not toggled automatically.
	 */
	tick(inputs = []) {
		return this.evaluate(inputs);
	}

	/**
	 * registerGate accepts a gate function or a Circuit instance.
	 * (If a Circuit is passed, it is automatically wrapped so that its evaluate() method is called.)
	 */
	registerGate(name, funcOrCircuit) {
		if (funcOrCircuit instanceof Circuit) {
			const subCircuit = funcOrCircuit;
			if (subCircuit.rootNodes.length > 1) {
				funcOrCircuit = (evaluatedInputs) => {
					return subCircuit.evaluate(evaluatedInputs);
				};
			} else {
				funcOrCircuit = (evaluatedInputs) => {
					return subCircuit.evaluate(evaluatedInputs)[0];
				};
			}
		}

		this.gateRegistry[name] = funcOrCircuit;
	}

	getGate(name) {
		return this.gateRegistry[name];
	}

	// Register a FeedbackNode.
	registerFeedbackNode(node) {
		if (!(node instanceof FeedbackNode)) {
			throw new Error("Feedback node must be an instance of FeedbackNode.");
		}
		this.feedbackNodes.push(node);
	}
}