// Import all the Node types it needs to know about
import {
	ClockNode,
	LiteralNode,
	InputNode,
	GateNode,
	FeedbackNode,
	CompositeNode,
	SubCircuitOutputNode
} from "./nodes.js";

// Import the helper classes and functions
import { Scheduler } from "./scheduler.js";
import { arraysEqual, createDefaultContext } from "./utils.js"; // Assuming arraysEqual is in utils.js
import { STANDARD_GATES } from "./common-gates.js";

export class Circuit {
	/**
	 * rootNodes can be a single Node or an array of Node objects.
	 */
	constructor(name, rootNodes) {
		this.name = name;
		this.rootNodes = Array.isArray(rootNodes) ? rootNodes : [rootNodes]; // timing
		this.totalTicks = 0;
		this.currentTick = 0;
		this.clock = 0;
		this.prevClock = 0; // feedback + gates
		this.feedbackNodes = [];
		this.gateRegistry = {};
		this.scheduler = new Scheduler();
		this.history = [];
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
	} // ----------------------------------------------------- // 4.2) Compute inputLength & outputLength // -----------------------------------------------------

	#computeInputLength(node, visited = new Set()) {
		if (!node || visited.has(node)) return -Infinity;
		visited.add(node);

		let highest = -1;
		if (node instanceof InputNode) {
			highest = node.index;
		} else if (node instanceof GateNode) {
			for (const child of node.inputNodes) {
				highest = Math.max(highest, this.#computeInputLength(child, visited));
			}
		} else if (node instanceof FeedbackNode) {
			if (node.inputNode) {
				highest = Math.max(highest, this.#computeInputLength(node.inputNode, visited));
			}
		} else if (node instanceof CompositeNode) {
			for (const child of node.inputNodes) {
				highest = Math.max(highest, this.#computeInputLength(child, visited));
			}
		} else if (node instanceof SubCircuitOutputNode) {
			highest = Math.max(highest, this.#computeInputLength(node.compositeNode, visited));
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

	// ... inside the Circuit class in circuit.js ...

	// ... inside the Circuit class in circuit.js ...

	evaluate(inputs = [], maxDeltaCycles = 50) {
		this.currentTick = this.totalTicks;
		const subHistory = [];

		// --- 1. Perform a single, initial evaluation to get a baseline state. ---
		// This is always necessary and will be our only step if the circuit is stable.
		let iteration = 1;
		const queueBefore = [...this.scheduler.events];
		const events = this.scheduler.consumeEventsForTick(this.currentTick);
		events.forEach((e) => e.callback());
		this.feedbackNodes.forEach((fb) => fb.computeFeedback(this, inputs));
		let oldOutputs = this.rootNodes.map((n) => n.evaluate(this, inputs));

		subHistory.push({
			deltaCycle: iteration,
			queueBefore,
			consumedEvents: events,
			queueAfter: [...this.scheduler.events],
			outputs: [...oldOutputs]
		});

		// --- 2. Only continue looping if the circuit is not yet stable. ---
		// This loop will not run at all if the initial state is already stable.
		while (this.scheduler.hasEventsForTick(this.currentTick) && iteration < maxDeltaCycles) {
			iteration++;
			const queueBeforeLoop = [...this.scheduler.events];
			const eventsLoop = this.scheduler.consumeEventsForTick(this.currentTick);
			eventsLoop.forEach((e) => e.callback());
			this.feedbackNodes.forEach((fb) => fb.computeFeedback(this, inputs));

			const newOutputs = this.rootNodes.map((n) => n.evaluate(this, inputs));

			subHistory.push({
				deltaCycle: iteration,
				queueBefore: queueBeforeLoop,
				consumedEvents: eventsLoop,
				queueAfter: [...this.scheduler.events],
				outputs: [...newOutputs]
			});

			// If the outputs stop changing, we can exit.
			if (arraysEqual(oldOutputs, newOutputs)) {
				break;
			}
			oldOutputs = newOutputs;
		}

		this.history.push({ tick: this.totalTicks, subHistory });
		this.totalTicks++;
		return oldOutputs;
	}

	// ... rest of the Circuit class ...

	// ... rest of the Circuit class ...

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
	} // ----------------------------------------------------- // 4.4) Cloning // -----------------------------------------------------

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
			copy = new GateNode(node.gateType, [], node.delay, node.name);

			nodeMap.set(node, copy);

			copy.inputNodes = node.inputNodes.map((c) => this.#cloneNode(c, nodeMap));

			copy.lastValue = node.lastValue;

			return copy;
		} else if (node instanceof FeedbackNode) {
			// THE FIX: Use node.initialValue instead of node.currentValue
			copy = new FeedbackNode(null, node.initialValue, node.delay, node.name);

			nodeMap.set(node, copy);

			copy.inputNode = this.#cloneNode(node.inputNode, nodeMap);

			return copy;
		} else if (node instanceof CompositeNode) {
			const clonedInputs = node.inputNodes.map((c) => this.#cloneNode(c, nodeMap));
			copy = new CompositeNode(node.subCircuit, clonedInputs);
		} else if (node instanceof SubCircuitOutputNode) {
			const clonedCompositeNode = this.#cloneNode(node.compositeNode, nodeMap);
			copy = new SubCircuitOutputNode(clonedCompositeNode, node.outputIndex);
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

	toString() {
		const lines = [];
		const context = createDefaultContext();

		// First, handle the definitions of any feedback nodes to populate the cache.
		this.feedbackNodes.forEach((fb) => {
			lines.push(fb.toString(context));
		});

		// Now, process the main output root nodes.
		this.rootNodes.forEach((node, i) => {
			lines.push(`Output[${i}] = ${node.toString(context)}`);
		});

		return lines.join("\n");
	}

	#numToBitArray(num, width) {
		return num
			.toString(2)
			.padStart(width, "0")
			.split("")
			.map((bit) => +bit);
	}

	generateTruthTable(clockLevel = null) {
		const truthTable = [];
		const n = this.inputLength;
		const combinations = 1 << n;

		for (let i = 0; i < combinations; i++) {
			const inputs = this.#numToBitArray(i, n);
			// A fresh, stateless clone is created for each row to ensure isolation.
			const testCircuit = this.clone();
			let finalOutputs;

			// If a clock level is specified, set it on the clone before evaluating.
			if (clockLevel === 0 || clockLevel === 1) {
				testCircuit.setClock(clockLevel);
			}

			// A single, stateless evaluation is performed.
			finalOutputs = testCircuit.evaluate(inputs);

			truthTable.push({ inputs, outputs: finalOutputs });
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
	} //XOR's each bit one by one and counts number of 1's

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
			const groups = this.#groupByOnes(implicants); // 2) merge every pair differing by exactly one bit
			const combined = this.#combineBitDifferences(groups); // 3) if nothing new could be merged, we’re done
			if (combined.length === 0) {
				return implicants;
			} // 4) otherwise, repeat on the newly formed terms
			implicants = combined;
		}
	}

	#findCoverValues(prime) {
		//clone array
		const bits = [...prime]; // 2) We'll build up our cover list one position at a time. //    Start with a single "empty" partial term:

		let results = [[]]; // 3) For each bit position, expand the partials:

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
			} // move on to the newly extended partials

			results = nextResults;
		}

		return results;
	}

	#findEssentialPrimes(primes, minterms) {
		// 1) Initialize a map: mintermKey → Set of prime indices that cover it
		const coverMap = new Map();
		for (const term of minterms) {
			coverMap.set(term.join(""), new Set());
		} // 2) For each prime implicant, mark which minterms it covers

		primes.forEach((prime, pIdx) => {
			// find all the concrete minterms covered by this prime
			const covered = this.#findCoverValues(prime);
			for (let mKey of covered) {
				mKey = mKey.join("");

				if (coverMap.has(mKey)) {
					coverMap.get(mKey).add(pIdx);
				}
			}
		}); // 3) Any minterm covered by exactly one prime → that prime is essential

		const essentialIdxs = new Set();
		for (const [mKey, pSet] of coverMap.entries()) {
			if (pSet.size === 1) {
				const [sole] = pSet; // the only prime covering this minterm
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

	/**
	 * Simplifies the logic for EACH output of the circuit using the Quine-McCluskey algorithm.
	 * Note: This only works for combinational logic.
	 * @returns {Circuit} A new, fully simplified Circuit instance with the same number of outputs.
	 */
	simplify() {
		const simplifiedNodes = [];

		// Loop through each output of the original circuit.
		for (let i = 0; i < this.outputLength; i++) {
			const truthTable = this.generateTruthTable();
			const minterms = this.#generateMinterms(truthTable, i);

			// Handle cases where the output is always 0 or always 1.
			if (minterms.length === 0) {
				simplifiedNodes.push(new LiteralNode(0));
				continue;
			}
			const combinations = 1 << this.inputLength;
			if (minterms.length === combinations) {
				simplifiedNodes.push(new LiteralNode(1));
				continue;
			}

			const primes = this.#findPrimeImplicants(minterms);
			const bestPrimes = this.#petrickMethod(minterms, primes);

			const inputNodes = Array.from({ length: this.inputLength }, (_, i) => new InputNode(i));

			const andGates = bestPrimes.map((prime) => {
				const inputsForAnd = [];
				prime.forEach((bit, j) => {
					if (bit === 0) inputsForAnd.push(new GateNode("NOT", [inputNodes[j]]));
					else if (bit === 1) inputsForAnd.push(inputNodes[j]);
				});
				if (inputsForAnd.length === 1) return inputsForAnd[0];
				return new GateNode("AND", inputsForAnd);
			});

			const simplifiedNode = andGates.length === 1 ? andGates[0] : new GateNode("OR", andGates);
			simplifiedNodes.push(simplifiedNode);
		}

		// Create the new circuit with all the simplified output nodes.
		const simplifiedCircuit = new Circuit(`${this.name}_simplified`, simplifiedNodes);
		simplifiedCircuit.registerGate("AND", STANDARD_GATES.AND);
		simplifiedCircuit.registerGate("OR", STANDARD_GATES.OR);
		simplifiedCircuit.registerGate("NOT", STANDARD_GATES.NOT);

		return simplifiedCircuit;
	}
}
