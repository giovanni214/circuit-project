// OR‐gate over N inputs
function OR_FUNC(inputs) {
	const result = inputs.reduce((acc, bit) => acc | bit, 0);
	return result;
}

// AND‐gate over N inputs
function AND_FUNC(inputs) {
	const result = inputs.reduce((acc, bit) => acc & bit, 1);
	return result;
}

// NOT‐gate (expects exactly one input)
function NOT_FUNC(input) {
	if (input.length !== 1) {
		throw new Error("NOT gate requires exactly one input");
	}
	return input[0] ? 0 : 1;
}

/**
 * Creates a master-slave D flip-flop circuit.
 * This is a negative-edge-triggered flip-flop.
 * @returns {Circuit} A new Circuit instance representing the D flip-flop.
 */
function createDFlipFlop() {
	// Inputs: D (Data) at index 0, CLK (Clock) at index 1
	const D = new InputNode(0);
	const CLK = new ClockNode(); // Using a dedicated ClockNode

	// Internal feedback nodes for the master and slave latches
	const masterQ = new FeedbackNode(null, 0, 0, "masterQ");
	const slaveQ = new FeedbackNode(null, 0, 0, "slaveQ");

	// Master Latch Logic (transparent when CLK is HIGH)
	// masterQ_next = (D AND CLK) OR (masterQ AND NOT CLK)
	const notCLK = new GateNode("NOT", [CLK]);
	const masterTerm1 = new GateNode("AND", [D, CLK]);
	const masterTerm2 = new GateNode("AND", [masterQ, notCLK]);
	const masterQNext = new GateNode("OR", [masterTerm1, masterTerm2]);
	masterQ.inputNode = masterQNext; // Wire up the feedback

	// Slave Latch Logic (transparent when CLK is LOW)
	// slaveQ_next = (masterQ AND NOT CLK) OR (slaveQ AND CLK)
	const slaveTerm1 = new GateNode("AND", [masterQ, notCLK]);
	const slaveTerm2 = new GateNode("AND", [slaveQ, CLK]);
	const slaveQNext = new GateNode("OR", [slaveTerm1, slaveTerm2]);
	slaveQ.inputNode = slaveQNext; // Wire up the feedback

	// Create the circuit with slaveQ as the final output
	const dff = new Circuit("D-Flip-Flop", [slaveQ]);
	dff.registerFeedbackNode(masterQ);
	dff.registerFeedbackNode(slaveQ);
	return dff;
}

const a = new InputNode(0);
const b = new InputNode(1);
const c = new InputNode(2);

const notA = new GateNode("NOT", [a]);
const notB = new GateNode("NOT", [b]);
const notC = new GateNode("NOT", [c]);

const exp1 = new GateNode("AND", [a, b, notC]);
const exp2 = new GateNode("AND", [a, notB, notC]);
const exp3 = new GateNode("AND", [notA, b, c]);
const exp4 = new GateNode("AND", [notA, b, notC]);

const combined = new GateNode("OR", [exp1, exp2, exp3, exp4]);

const circuit = new Circuit("GIO", [combined]);
circuit.registerGate("OR", OR_FUNC);
circuit.registerGate("NOT", NOT_FUNC);
circuit.registerGate("AND", AND_FUNC);

const newCircuit = circuit.simplify();
console.log(circuit.rootNodes.toString());
console.log(newCircuit.rootNodes.toString());

function verifyTruthTables(table1, table2) {
	if (table1.length !== table2.length) {
		return false; // different number of rows
	}

	for (let i = 0; i < table1.length; i++) {
		const row1 = table1[i];
		const row2 = table2[i];

		// compare inputs
		if (row1.inputs.join() !== row2.inputs.join()) {
			console.error(`Mismatch at row ${i}: inputs differ`, row1.inputs, row2.inputs);
			return false;
		}

		// compare outputs
		if (row1.outputs.join() !== row2.outputs.join()) {
			console.error(`Mismatch at row ${i}: outputs differ`, row1.outputs, row2.outputs);
			return false;
		}
	}

	return true;
}

// Example usage:
const tableA = circuit.generateTruthTable();

const tableB = circuit.generateTruthTable();

console.log("Tables Table Vericiation: ", verifyTruthTables(tableA, tableB)); // true
