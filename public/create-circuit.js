// Import the main class to create a circuit
import { Circuit } from "../lib/circuit.js";

// Import only the Node types needed to build this specific circuit
import { InputNode, GateNode, CompositeNode, SubCircuitOutputNode } from "../lib/nodes.js";

// --- 1. Define the reusable Half-Adder Circuit ---
const ha_a = new InputNode(0);
const ha_b = new InputNode(1);

// Logic for Sum (A XOR B)
const notA = new GateNode("NOT", [ha_a]);
const notB = new GateNode("NOT", [ha_b]);
const sumTerm1 = new GateNode("AND", [ha_a, notB]);
const sumTerm2 = new GateNode("AND", [notA, ha_b]);
const sumOutput = new GateNode("OR", [sumTerm1, sumTerm2]);

// Logic for Carry (A AND B)
const carryOutput = new GateNode("AND", [ha_a, ha_b]);

// --- In your create-circuit.js file ---

// Create the circuit with TWO outputs: Output[0] = Sum, Output[1] = Carry
const halfAdderCircuit = new Circuit("HalfAdder", [sumOutput, carryOutput]);

// --- REPLACE the old gate registrations with these corrected versions ---
halfAdderCircuit.registerGate("AND", (inputs) => {
	return inputs.reduce((acc, bit) => acc & bit, 1);
});
halfAdderCircuit.registerGate("OR", (inputs) => {
	return inputs.reduce((acc, bit) => acc | bit, 0);
});
halfAdderCircuit.registerGate("NOT", (inputs) => {
	if (inputs.length !== 1) {
		throw new Error("NOT gate requires exactly one input");
	}
	return inputs[0] ? 0 : 1;
});

// --- 2. Build the Full-Adder using the Half-Adder component ---

// Define top-level inputs: A, B, and Carry-In (Cin)
const A = new InputNode(0);
const B = new InputNode(1);
const Cin = new InputNode(2);

// First Half-Adder (takes A and B)
const ha1 = new CompositeNode(halfAdderCircuit, [A, B]);

// Use SubCircuitOutputNode to tap into its outputs
const ha1_Sum = new SubCircuitOutputNode(ha1, 0); // Output 0 is Sum
const ha1_Carry = new SubCircuitOutputNode(ha1, 1); // Output 1 is Carry

// Second Half-Adder (takes the sum of the first one and Cin)
const ha2 = new CompositeNode(halfAdderCircuit, [ha1_Sum, Cin]);

// Tap into the second half-adder's outputs
const ha2_Sum = new SubCircuitOutputNode(ha2, 0); // This is our final Sum
const ha2_Carry = new SubCircuitOutputNode(ha2, 1);

// Final logic for Carry-Out: (ha1_Carry OR ha2_Carry)
const finalCarryOut = new GateNode("OR", [ha1_Carry, ha2_Carry]);

// --- In your create-circuit.js file ---

// Build the final Full-Adder circuit with its two outputs
const fullAdderCircuit = new Circuit("FullAdder", [ha2_Sum, finalCarryOut]);

// --- FIX: Register ALL gates the sub-circuits will need ---
fullAdderCircuit.registerGate("AND", (inputs) => {
	return inputs.reduce((acc, bit) => acc & bit, 1);
});
fullAdderCircuit.registerGate("OR", (inputs) => {
	return inputs.reduce((acc, bit) => acc | bit, 0);
});
fullAdderCircuit.registerGate("NOT", (inputs) => {
	if (inputs.length !== 1) {
		throw new Error("NOT gate requires exactly one input");
	}
	return inputs[0] ? 0 : 1;
});

// --- 3. Verification ---
console.log("Full-Adder Truth Table:");
const truthTable = fullAdderCircuit.generateTruthTable();
window.circuit = fullAdderCircuit;
console.table(
	truthTable.map((row) => ({
		A: row.inputs[0],
		B: row.inputs[1],
		Cin: row.inputs[2],
		Sum: row.outputs[0],
		Cout: row.outputs[1]
	}))
);

console.log("\nFull-Adder Structure:");
console.log(fullAdderCircuit.toString());

/**
 * A comprehensive test suite for a full-adder circuit.
 * This function takes a circuit instance and validates its output against all possible inputs.
 * @param {Circuit} fullAdder - The full-adder circuit instance to test.
 */
function runFullAdderTests(fullAdder) {
	if (!(fullAdder instanceof Circuit) || fullAdder.name !== "FullAdder") {
		console.error("Test Error: A valid 'FullAdder' circuit instance must be provided.");
		return;
	}

	console.log(`--- Running Verification for: ${fullAdder.name} ---`);

	// A full adder has 3 inputs (A, B, Cin), so there are 2^3 = 8 possible input combinations.
	const testCases = [
		// Inputs: [A, B, Cin], Expected Outputs: [Sum, Cout]
		{ inputs: [0, 0, 0], expected: [0, 0], description: "0 + 0 + 0 = 00" },
		{ inputs: [0, 0, 1], expected: [1, 0], description: "0 + 0 + 1 = 01" },
		{ inputs: [0, 1, 0], expected: [1, 0], description: "0 + 1 + 0 = 01" },
		{ inputs: [0, 1, 1], expected: [0, 1], description: "0 + 1 + 1 = 10" },
		{ inputs: [1, 0, 0], expected: [1, 0], description: "1 + 0 + 0 = 01" },
		{ inputs: [1, 0, 1], expected: [0, 1], description: "1 + 0 + 1 = 10" },
		{ inputs: [1, 1, 0], expected: [0, 1], description: "1 + 1 + 0 = 10" },
		{ inputs: [1, 1, 1], expected: [1, 1], description: "1 + 1 + 1 = 11" }
	];

	let passedCount = 0;

	testCases.forEach((test, index) => {
		const actualOutputs = fullAdder.evaluate(test.inputs);

		// Check if the actual output array matches the expected output array
		const isPass =
			actualOutputs.length === test.expected.length && actualOutputs.every((val, i) => val === test.expected[i]);

		if (isPass) {
			console.log(`✅ Test #${index}: PASSED | ${test.description}`);
			passedCount++;
		} else {
			console.error(`❌ Test #${index}: FAILED | ${test.description}`);
			console.error(`   Inputs:   [${test.inputs.join(", ")}]`);
			console.error(`   Expected: [${test.expected.join(", ")}]`);
			console.error(`   Actual:   [${actualOutputs.join(", ")}]`);
		}
	});

	console.log("\n--- Test Summary ---");
	if (passedCount === testCases.length) {
		console.log(`🎉 All ${testCases.length} tests passed! The circuit is working correctly.`);
	} else {
		console.error(`🔥 ${passedCount} out of ${testCases.length} tests passed.`);
	}
}
// runFullAdderTests(fullAdderCircuit);
