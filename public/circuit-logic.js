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

	#numToBitArray(num, width) {
		return num
			.toString(2)
			.padStart(width, "0")
			.split("")
			.map((bit) => +bit);
	}

	generateTruthTable() {
		let truthTable = [];
		const n = this.inputLength;
		const combinations = 1 << n;

		//Generate all possible inputs and put them into an array
		for (let i = 0; i < combinations; i++) {
			const inputs = this.#numToBitArray(i, n);
			const outputs = this.evaluate(inputs);
			truthTable.push({ inputs, outputs });
		}

		return truthTable;
	}

	#generateMinterms(truthTable, index) {
		let terms = [];
		for (let term of truthTable) {
			if (term.outputs[index] === 1) terms.push(term.inputs);
		}

		return terms;
	}

	#groupByOnes(terms) {
		if (!terms.length) return [];

		const width = terms[0].length;
		const groups = Array.from({ length: width + 1 }, () => []);

		for (const term of terms) {
			const ones = term.reduce((sum, bit) => sum + (bit === "-" ? 0 : bit), 0);
			groups[ones].push(term);
		}

		return groups;
	}

	//XOR's each bit one by one and counts number of 1's
	#computeHammingDistance(a, b) {
		if (a.length !== b.length) {
			throw new Error("Length mismatch");
		}
		let diffs = 0;
		for (let i = 0; i < a.length; i++) {
			if (a[i] === b[i]) continue;
			diffs++;
			if (diffs > 1) return diffs;
		}
		return diffs;
	}

	#combineTerms(a, b, hole = "-") {
		return a.map((bit, i) => (bit === b[i] ? bit : hole));
	}

	#combineBitDifferences(groupsByOnes) {
		const combined = [];

		for (let i = 0; i < groupsByOnes.length - 1; i++) {
			const current = groupsByOnes[i];
			const next = groupsByOnes[i + 1];

			if (!current.length || !next.length) continue;

			for (const term1 of current) {
				for (const term2 of next) {
					if (this.#computeHammingDistance(term1, term2) === 1) {
						combined.push(this.#combineTerms(term1, term2));
					}
				}
			}
		}

		return combined;
	}

	#findPrimeImplicants(minTerms) {
		let implicants = minTerms;

		while (true) {
			// 1) bucket by count of 1s (ignoring “–”)
			const groups = this.#groupByOnes(implicants);
			// 2) merge every pair differing by exactly one bit
			const combined = this.#combineBitDifferences(groups);
			// 3) if nothing new could be merged, we’re done
			if (combined.length === 0) {
				return implicants;
			}
			// 4) otherwise, repeat on the newly formed terms
			implicants = combined;
		}
	}

	#findCoverValues(prime) {
		//clone array
		const bits = [...prime];

		// 2) We'll build up our cover list one position at a time.
		//    Start with a single "empty" partial term:
		let results = [[]];

		// 3) For each bit position, expand the partials:
		for (const bit of bits) {
			const nextResults = [];

			if (bit === "-") {
				// “don’t care”: each partial forks into a 0‑branch and a 1‑branch
				for (const seq of results) {
					nextResults.push([...seq, 0]);
					nextResults.push([...seq, 1]);
				}
			} else {
				// fixed bit (string '0' or '1'): just append to every partial
				const b = Number(bit);
				for (const seq of results) {
					nextResults.push([...seq, b]);
				}
			}

			// move on to the newly extended partials
			results = nextResults;
		}

		return results;
	}

	#findEssentialPrimes(primes, minterms) {
		// 1) Initialize a map: mintermKey → Set of prime indices that cover it
		const coverMap = new Map();
		for (const term of minterms) {
			coverMap.set(term.join(""), new Set());
		}

		// 2) For each prime implicant, mark which minterms it covers
		primes.forEach((prime, pIdx) => {
			// find all the concrete minterms covered by this prime
			const covered = this.#findCoverValues(prime);
			for (let mKey of covered) {
				mKey = mKey.join("");
				if (coverMap.has(mKey)) {
					coverMap.get(mKey).add(pIdx);
				}
			}
		});

		// 3) Any minterm covered by exactly one prime → that prime is essential
		const essentialIdxs = new Set();
		for (const [mKey, pSet] of coverMap.entries()) {
			if (pSet.size === 1) {
				const [sole] = pSet; // the only prime covering this minterm
				console.log(sole);
				essentialIdxs.add(sole);
			}
		}

		return Array.from(essentialIdxs).map((i) => primes[i]);
	}

	#arrayEquals(a, b) {
		if (a.length !== b.length) return false;
		return a.every((val, i) => val === b[i]);
	}

	#multiplySums(P, Q) {
		const result = [];
		for (const p of P) {
			for (const q of Q) {
				const merged = [...new Set([...p, ...q])].sort();
				result.push(merged);
			}
		}
		return result;
	}

	#selectFinalPrimeCover(essentials, selectedIndices, allPrimes) {
		const final = [...essentials];

		for (const i of selectedIndices) {
			const candidate = allPrimes[i];
			const alreadyIncluded = final.some((ep) => this.#arrayEquals(ep, candidate));
			if (!alreadyIncluded) {
				final.push(candidate);
			}
		}

		return final;
	}

	#findMinimalPrimeCover(clauses) {
		let petrick = clauses[0].map((x) => [x]);

		for (let i = 1; i < clauses.length; i++) {
			const next = clauses[i].map((x) => [x]);
			petrick = this.#multiplySums(petrick, next);
		}

		let minLength = Math.min(...petrick.map((p) => p.length));
		const minimalCovers = petrick.filter((p) => p.length === minLength);

		if (minimalCovers.length === 0) {
			throw new Error("Petrick's method failed: No minimal cover found.");
		}

		return minimalCovers[0];
	}

	#buildPrimeCoverMatrix(minterms, primes, essentialPrimes) {
		return minterms.map((minterm) => {
			const mKey = minterm.join("");
			const clause = [];

			primes.forEach((prime, idx) => {
				if (essentialPrimes.some((ep) => this.#arrayEquals(ep, prime))) return;

				for (const covered of this.#findCoverValues(prime)) {
					if (covered.join("") === mKey) {
						clause.push(idx);
						break;
					}
				}
			});

			return clause;
		});
	}

	#filterUncoveredMinterms(minterms, coveredSet) {
		return minterms.filter((m) => !coveredSet.has(m.join("")));
	}

	#getCoveredMintermsFromPrimes(primes) {
		const covered = new Set();
		for (const prime of primes) {
			for (const minterm of this.#findCoverValues(prime)) {
				covered.add(minterm.join(""));
			}
		}
		return covered;
	}

	#petrickMethod(minterms, primes) {
		const essentialPrimes = this.#findEssentialPrimes(primes, minterms);

		const mintermsCoveredByEssentials = this.#getCoveredMintermsFromPrimes(essentialPrimes);
		const uncoveredMinterms = this.#filterUncoveredMinterms(minterms, mintermsCoveredByEssentials);

		if (uncoveredMinterms.length === 0) {
			return essentialPrimes;
		}

		const primeCoverMatrix = this.#buildPrimeCoverMatrix(uncoveredMinterms, primes, essentialPrimes);
		if (primeCoverMatrix.some((c) => c.length === 0)) {
			throw new Error("Unsolvable: Some minterms are not covered by any remaining prime implicants.");
		}

		const minimalPrimeIndices = this.#findMinimalPrimeCover(primeCoverMatrix);
		const finalPrimes = this.#selectFinalPrimeCover(essentialPrimes, minimalPrimeIndices, primes);

		return finalPrimes;
	}

	#formatImplicant(bits) {
		return bits
			.map((bit, i) => {
				if (bit === "-") return "";
				const name = String.fromCharCode(65 + i); // A, B, C...
				return bit === 1 ? name : `¬${name}`;
			})
			.filter(Boolean)
			.join("·");
	}

	//Simplifying using Quine–McCluskey algorithm
	simplify() {
		const truthTable = this.generateTruthTable();
		const minterms = this.#generateMinterms(truthTable, 0);
		const primes = this.#findPrimeImplicants(minterms);
		const bestPrimes = this.#petrickMethod(minterms, primes);

		return bestPrimes.map((p) => this.#formatImplicant(p));
	}
}
