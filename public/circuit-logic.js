// class Circuit {
// 	/**
// 	 * @param {string} name
// 	 */
// 	constructor(name, ast = null) {
// 		this.name = name;
// 		this.ast = ast; // AST representing the circuit logic.
// 		this.context = {}; // Gate functions keyed by name.
// 		this.history = []; // A log for operations.
// 		/**
// 		 * @type {((inputs: any) => any) | null}
// 		 */
// 		this.customEvaluate = null; // Optional custom evaluator (used in chaining).
// 	}

// 	// --- AST Node Definition ---
// 	// The inner Node class represents nodes in the AST (inputs, literals, or gate calls).
// 	static Node = class {
// 		/**
// 		 * @param {string} type
// 		 * @param {string | number | null} value
// 		 * @param {Array} children
// 		 */
// 		constructor(type, value = null, children = []) {
// 			this.type = type; // E.g. "input", "literal", "gate"
// 			this.value = value; // For "input": index; for "gate": gate name; for "literal": constant value.
// 			this.children = children;
// 		}
// 	};

// 	/**
// 	 * Creates a deep clone of the AST.
// 	 * This function assumes that a "node" is not an array.
// 	 */
// 	static _cloneAST(node) {
// 		if (!node) return null;
// 		const newNode = new Circuit.Node(node.type, node.value, []);
// 		if (node.children && node.children.length > 0) {
// 			newNode.children = node.children.map((child) => Circuit._cloneAST(child));
// 		}
// 		return newNode;
// 	}

// 	/**
// 	 * Returns a deep clone of this Circuit, including its AST.
// 	 * If the AST is an array, each element is cloned.
// 	 */
// 	clone() {
// 		const clonedCircuit = new Circuit(this.name);
// 		// Handle the AST, which might be a single node or an array.
// 		if (Array.isArray(this.ast)) {
// 			clonedCircuit.ast = this.ast.map((node) => Circuit._cloneAST(node));
// 		} else {
// 			clonedCircuit.ast = this.ast ? Circuit._cloneAST(this.ast) : null;
// 		}
// 		// Shallow copy context (function references are immutable).
// 		clonedCircuit.context = { ...this.context };
// 		// Copy history array.
// 		clonedCircuit.history = this.history.slice();
// 		// Copy custom evaluator reference.
// 		clonedCircuit.customEvaluate = this.customEvaluate;
// 		return clonedCircuit;
// 	}

// 	// --- Context and AST Helpers ---

// 	// Registers a gate function with a given name into this circuit's context.
// 	/**
// 	 * @param {string} gateName
// 	 * @param {{ (...inputs: any[]): any; (...inputs: any[]): any; (input: any): number; }} func
// 	 */
// 	registerGate(gateName, func) {
// 		this.context[gateName] = func;
// 		this.history.push(`Registered gate: ${gateName}`);
// 	}

// 	// Sets the AST for this circuit.
// 	setAST(ast) {
// 		this.ast = ast;
// 		this.history.push(`AST set: ${JSON.stringify(ast)}`);
// 	}

// 	// Helper to create an input node that references the given input index.
// 	/**
// 	 * @param {number} index
// 	 */
// 	static createInputNode(index) {
// 		return new Circuit.Node("input", index);
// 	}

// 	// Helper to create a gate node with the provided gate name and child nodes.
// 	/**
// 	 * @param {string} gateName
// 	 */
// 	static createGateNode(gateName, ...children) {
// 		return new Circuit.Node("gate", gateName, children);
// 	}

// 	// Helper for literal nodes.
// 	/**
// 	 * @param {null | undefined} value
// 	 */
// 	static createLiteralNode(value) {
// 		return new Circuit.Node("literal", value);
// 	}

// 	// --- Automatic Input/Output Calculation ---

// 	// Recursively traverses the AST to compute the required number of inputs.
// 	_computeInputCount(node = this.ast) {
// 		if (!node) return 0;
// 		if (Array.isArray(node)) {
// 			// Compute input count for each node and return the maximum.
// 			return node.reduce((max, n) => Math.max(max, this._computeInputCount(n)), 0);
// 		}
// 		let count = 0;
// 		if (node.type === "input") {
// 			count = node.value + 1;
// 		}
// 		if (node.children && node.children.length > 0) {
// 			for (let child of node.children) {
// 				count = Math.max(count, this._computeInputCount(child));
// 			}
// 		}
// 		return count;
// 	}
// 	// Getter for input count based on the AST.
// 	get inputLength() {
// 		return this._computeInputCount();
// 	}

// 	// Getter for output count.
// 	// We attempt a dummy evaluation (using zeros) and then check if the result is an array.
// 	get outputLength() {
// 		try {
// 			// Create a dummy input vector of zeros. (If there are no inputs, assume an empty array.)
// 			const dummyInputs = new Array(this.inputLength).fill(0);
// 			const result = this.evaluate(dummyInputs);
// 			return Array.isArray(result) ? result.length : 1;
// 		} catch (e) {
// 			// If evaluation fails (e.g., because the circuit isn't fully set up), assume 0 outputs.
// 			return 0;
// 		}
// 	}

// 	// --- Evaluation and Truth Table Generation ---

// 	evaluate(inputs) {
// 		if (this.customEvaluate) {
// 			const customResult = this.customEvaluate(inputs);
// 			return Array.isArray(customResult) ? customResult : [customResult];
// 		}
// 		if (!this.ast) {
// 			throw new Error(`No AST set for circuit "${this.name}"`);
// 		}
// 		// Recursive evaluation function.
// 		const evalNode = (node) => {
// 			switch (node.type) {
// 				case "input":
// 					return inputs[node.value];
// 				case "literal":
// 					return node.value;
// 				case "gate": {
// 					const gateFunc = this.context[node.value];
// 					if (!gateFunc) {
// 						throw new Error(`Gate "${node.value}" not registered in circuit "${this.name}"`);
// 					}
// 					const childVals = node.children.map((child) => evalNode(child));
// 					return gateFunc(...childVals);
// 				}
// 				default:
// 					throw new Error(`Unknown node type: ${node.type}`);
// 			}
// 		};

// 		// Evaluate the AST. If it's an array, evaluate each node, otherwise evaluate once.
// 		let result;
// 		if (Array.isArray(this.ast)) {
// 			result = this.ast.map((node) => evalNode(node));
// 		} else {
// 			result = evalNode(this.ast);
// 		}

// 		// Ensure that the result is an array.
// 		return Array.isArray(result) ? result : [result];
// 	}

// 	/**
// 	 *@param {InstanceType<typeof Circuit.Node>} node
// 	 */
// 	visualizeASTInline(node, isRoot = true) {
// 		if (isRoot === true) node = this.ast;

// 		if (node.type === "input") {
// 			// Convert input index to a letter (0 => A, 1 => B, etc.)
// 			return String.fromCharCode(65 + node.value);
// 		}

// 		if (node.type === "literal") {
// 			return node.value.toString();
// 		}

// 		if (node.type === "gate") {
// 			const op = node.value;
// 			if (node.children.length === 1) {
// 				// For a unary gate, simply output "OP child"
// 				const childStr = this.visualizeASTInline(node.children[0], false);
// 				return `${op} ${childStr}`;
// 			} else if (node.children.length >= 2) {
// 				// For binary (or multi-input) gates, join the children with the operator in between (A OR B OR C).
// 				const childStrs = node.children.map((/** @type {any} */ child) => this.visualizeASTInline(child, false));
// 				const expr = childStrs.join(` ${op} `);
// 				// Only wrap in parentheses if this is not the top-level node.
// 				return isRoot ? expr : `(${expr})`;
// 			}
// 		}

// 		return "";
// 	}

// 	// Generates a truth table by iterating over every possible input combination.
// 	generateTruthTable() {
// 		const table = [];
// 		const numRows = 2 ** this.inputLength;
// 		for (let i = 0; i < numRows; i++) {
// 			const inputs = i.toString(2).padStart(this.inputLength, "0").split("").map(Number);
// 			const output = this.evaluate(inputs);
// 			table.push({ inputs, output });
// 		}
// 		return table;
// 	}

// 	// --- Chaining Circuits ---
// 	// Chains the output of this circuit into another circuit's input.
// 	/**
// 	 * @param {{ inputLength: number; name: any; context: {}; evaluate: (arg0: any[]) => any; history: any; }} otherCircuit
// 	 */
// 	chainWith(otherCircuit) {
// 		// For chaining, we expect the output of one circuit to match the input count of the other.
// 		if (this.outputLength !== otherCircuit.inputLength) {
// 			throw new Error(`Mismatch between "${this.name}" outputs and "${otherCircuit.name}" inputs.`);
// 		}
// 		const chainedCircuit = new Circuit(`${this.name}_chained_${otherCircuit.name}`);
// 		// Merge contexts from both circuits.
// 		chainedCircuit.context = { ...otherCircuit.context, ...this.context };
// 		chainedCircuit.customEvaluate = (/** @type {any} */ inputs) => {
// 			const intermediate = this.evaluate(inputs);
// 			const nextInputs = Array.isArray(intermediate) ? intermediate : [intermediate];
// 			return otherCircuit.evaluate(nextInputs);
// 		};
// 		chainedCircuit.history = [
// 			...this.history,
// 			...otherCircuit.history,
// 			`Chained "${this.name}" with "${otherCircuit.name}"`
// 		];
// 		return chainedCircuit;
// 	}

// 	// --- Composite Gate Creation ---
// 	// Creates a composite gate by building an AST and registering relevant gate functions.
// 	/**
// 	 * @param {string} name
// 	 * @param {{ gateName: any; func: any; }[]} contextRegs
// 	 */
// 	static createCompositeGate(name, astBuilder, contextRegs) {
// 		const circuit = new Circuit(name);
// 		// Register all gate functions.
// 		contextRegs.forEach(({ gateName, func }) => circuit.registerGate(gateName, func));
// 		const ast = astBuilder();
// 		circuit.setAST(ast);
// 		return circuit;
// 	}
// }

///////////////////////////////////////////////////////////////
// Full Circuit Class with:
//
// 1) createCompositeGate builder
// 2) Single-pass evaluate with a global clock
// 3) Feedback state stored between clock ticks
// 4) chainWith, generateTruthTable, visualizeAST, clone
///////////////////////////////////////////////////////////////

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
			return node.reduce((max, n) => Math.max(max, this._computeInputCount(n)), 0);
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
					if (!gateFunc) throw new Error(`Gate '${node.value}' not found in context.`);
					const childVals = node.children.map((ch) => evalNode(ch));
					return gateFunc(...childVals);
				}
				default:
					throw new Error(`Unknown node type: ${node.type}`);
			}
		};

		let out = Array.isArray(this.ast) ? this.ast.map((n) => evalNode(n)) : evalNode(this.ast);

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
			const bits = i.toString(2).padStart(this.inputLength, "0").split("").map(Number);
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
				const kids = node.children.map((ch) => this.visualizeAST(ch, indent + 1)).join("\n");
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
			throw new Error(`Mismatch: ${this.name} outputs ${outLen} bits, but ${other.name} needs ${inLen} inputs`);
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
		c.ast = Array.isArray(this.ast) ? this.ast.map((n) => Circuit._cloneAST(n)) : Circuit._cloneAST(this.ast);
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
const dLatchCircuit = Circuit.createCompositeGate("SimpleDLatch", () => buildSimpleDLatchAST(), [
	{ gateName: "AND", func: AND_GATE },
	{ gateName: "NOT", func: NOT_GATE },
	{ gateName: "NOR", func: NOR_GATE }
]);

// We'll test with single pass each tick
function showQ(outputs) {
	const [Q, Qp] = outputs;
	return `Q=${Q}, Q'=${Qp}`;
}

// Testing:
console.log("Clock=0, D=1 => Q should become 1");
let out = dLatchCircuit.tick(0, [1]);
console.log("Outputs =>", showQ(out));

console.log("Clock=1 => Q holds => even if D=0 => no change");
out = dLatchCircuit.tick(1, [0]);
console.log("Outputs =>", showQ(out));
