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

// Create the circuit with TWO outputs: Output[0] = Sum, Output[1] = Carry
const halfAdderCircuit = new Circuit("HalfAdder", [sumOutput, carryOutput]);
halfAdderCircuit.registerGate("AND", (inputs) => Number(inputs[0] && inputs[1]));
halfAdderCircuit.registerGate("OR", (inputs) => Number(inputs[0] || inputs[1]));
halfAdderCircuit.registerGate("NOT", (inputs) => Number(!inputs[0]));

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

// Build the final Full-Adder circuit with its two outputs
const fullAdderCircuit = new Circuit("FullAdder", [ha2_Sum, finalCarryOut]);
fullAdderCircuit.registerGate("OR", (inputs) => Number(inputs[0] || inputs[1])); // Only needs OR

// --- 3. Verification ---
console.log("Full-Adder Truth Table:");
const truthTable = fullAdderCircuit.generateTruthTable();
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
