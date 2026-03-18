// Helper function at the top of nodes.js
function createDefaultContext() {
  return {
    nodeStringCache: new Map()
  };
}

export class Node {
	evaluate(circuit, inputs) {
		throw new Error("evaluate() not implemented for base Node.");
	}
  
	// The signature is now clean, expecting the context to be passed in.
	toString(context = createDefaultContext) {
		throw new Error("toString() not implemented for base Node.");
	}
}

export class LiteralNode extends Node {
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

export class InputNode extends Node {
	constructor(index) {
		super();
		this.index = index;
	}

	evaluate(circuit, inputs) {
		return inputs[this.index] ?? 0;
	}

	toString(context = createDefaultContext()) {
		return `Input[${this.index}]`;
	}
}

export class ClockNode extends Node {
	evaluate(circuit, inputs) {
		return circuit.clock;
	}
	toString(context = createDefaultContext()) {
		return "CLK";
	}
}

export class GateNode extends Node {
	constructor(gateType, inputNodes, delay = 0, name) {
		super();
		this.gateType = gateType;
		this.inputNodes = inputNodes;
		this.delay = delay;
		this.lastValue = 0;
		this.name = name || `${gateType}_${Math.random().toString(36).substr(2, 5)}`; // Assign a random ID if no name is given
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
			const description = `Update gate '${this.name}' to value ${newValue}`;
			circuit.scheduler.scheduleEvent(
				targetTick,
				() => {
					this.lastValue = newValue;
				},
				description
			);
			return this.lastValue;
		} else {
			this.lastValue = newValue;
			return newValue;
		}
	}
	// CORRECTED toString using the cache
	toString(context = createDefaultContext()) {
		if (context.nodeStringCache.has(this)) return context.nodeStringCache.get(this);

		const childStrs = this.inputNodes.map((child) => child.toString(context));
		let result;
		if (this.gateType.toUpperCase() === "NOT") {
			result = `¬(${childStrs[0]})`;
		} else {
			result = childStrs.join(` ${this.gateType.toUpperCase()} `);
		}
		context.nodeStringCache.set(this, result);
		return result;
	}
}

export class CompositeNode extends Node {
	constructor(subCircuit, inputNodes) {
		super();
		// This check is now safer and avoids the circular import.
		if (!subCircuit || typeof subCircuit.clone !== "function") {
			throw new Error("CompositeNode requires a valid Circuit instance.");
		}
		this.subCircuit = subCircuit.clone();
		this.inputNodes = inputNodes;

		if (this.inputNodes.length !== this.subCircuit.inputLength) {
			throw new Error(
				`Input mismatch: The sub-circuit "${this.subCircuit.name}" expects ${this.subCircuit.inputLength} inputs, but was provided ${this.inputNodes.length}.`
			);
		}

		this.lastEvaluationTick = -1;
		this.cachedOutputs = [];
	}

	evaluate(parentCircuit, parentInputs) {
		if (this.lastEvaluationTick === parentCircuit.currentTick) {
			return this.cachedOutputs;
		}
		const subCircuitInputs = this.inputNodes.map((node) => node.evaluate(parentCircuit, parentInputs));
		this.cachedOutputs = this.subCircuit.evaluateUntilStable(subCircuitInputs);
		this.lastEvaluationTick = parentCircuit.currentTick;
		return this.cachedOutputs;
	}

	// CORRECTED toString using the cache
	toString(context = createDefaultContext()) {
		if (context.nodeStringCache.has(this)) {
			return context.nodeStringCache.get(this);
		}
		const childStrs = this.inputNodes.map((child) => child.toString(context));
		const result = `${this.subCircuit.name}(${childStrs.join(", ")})`;
		context.nodeStringCache.set(this, result);
		return result;
	}
}

export class SubCircuitOutputNode extends Node {
	constructor(compositeNode, outputIndex) {
		super();
		if (!(compositeNode instanceof CompositeNode)) {
			throw new Error("SubCircuitOutputNode requires a CompositeNode as its input.");
		}
		this.compositeNode = compositeNode;
		this.outputIndex = outputIndex;
	}

	evaluate(parentCircuit, parentInputs) {
		const subCircuitOutputs = this.compositeNode.evaluate(parentCircuit, parentInputs);
		if (this.outputIndex >= subCircuitOutputs.length) {
			throw new Error(
				`Output index ${this.outputIndex} is out of bounds for sub-circuit "${this.compositeNode.subCircuit.name}".`
			);
		}
		return subCircuitOutputs[this.outputIndex];
	}

	toString(context = createDefaultContext()) {
		return `${this.compositeNode.toString(context)}[${this.outputIndex}]`;
	}
}

export class FeedbackNode extends Node {
	constructor(inputNode, initialValue = 0, delay = 0, name = "Q") {
		super();
		this.inputNode = inputNode;
		this.initialValue = initialValue;
		this.currentValue = initialValue;
		this.delay = delay;
		this.name = name;
	}

	evaluate(circuit, inputs) {
		return this.currentValue;
	}

	computeFeedback(circuit, inputs) {
		if (!this.inputNode) return;
		const newValue = this.inputNode.evaluate(circuit, inputs);
		if (this.delay > 0) {
			const targetTick = circuit.currentTick + this.delay;
			const description = `Update gate '${this.name}' to value ${newValue}`;
			circuit.scheduler.scheduleEvent(
				targetTick,
				() => {
					this.currentValue = newValue;
				},
				description
			);
		} else {
			this.currentValue = newValue;
		}
	}

	// CORRECTED toString using the cache
	toString(context = createDefaultContext()) {
		if (context.nodeStringCache.has(this)) return context.nodeStringCache.get(this);

		// Mark ourselves as visited with our simple name.
		context.nodeStringCache.set(this, this.name);
		const expr = this.inputNode ? this.inputNode.toString(context) : "null";

		// The final string representation is the full equation.
		return `${this.name} = ${expr}`;
	}
}
