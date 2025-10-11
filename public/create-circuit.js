// Import the main class to create a circuit
import { Circuit } from "../lib/circuit.js";

// Import only the Node types needed to build this specific circuit
import { InputNode, GateNode, CompositeNode, SubCircuitOutputNode } from "../lib/nodes.js";

// --- 1. Define the reusable Half-Adder Circuit with Delays and Names ---
const ha_a = new InputNode(0);
const ha_b = new InputNode(1);

// Add a unique name as the 4th argument to each GateNode constructor.
const notA = new GateNode("NOT", [ha_a], 1, "ha_notA");
const notB = new GateNode("NOT", [ha_b], 1, "ha_notB");
const sumTerm1 = new GateNode("AND", [ha_a, notB], 2, "ha_sumTerm1_AND");
const sumTerm2 = new GateNode("AND", [notA, ha_b], 2, "ha_sumTerm2_AND");
const carryOutput = new GateNode("AND", [ha_a, ha_b], 2, "ha_Carry_AND");
const sumOutput = new GateNode("OR", [sumTerm1, sumTerm2], 2, "ha_Sum_OR");

// Create the circuit with TWO outputs: Output[0] = Sum, Output[1] = Carry
const halfAdderCircuit = new Circuit("HalfAdder", [sumOutput, carryOutput]);
halfAdderCircuit.registerGate("AND", (inputs) => inputs.reduce((acc, bit) => acc & bit, 1));
halfAdderCircuit.registerGate("OR", (inputs) => inputs.reduce((acc, bit) => acc | bit, 0));
halfAdderCircuit.registerGate("NOT", (inputs) => (inputs[0] ? 0 : 1));

// --- 2. Build the Full-Adder using the Half-Adder component ---
const A = new InputNode(0);
const B = new InputNode(1);
const Cin = new InputNode(2);

const ha1 = new CompositeNode(halfAdderCircuit, [A, B]);
const ha1_Sum = new SubCircuitOutputNode(ha1, 0);
const ha1_Carry = new SubCircuitOutputNode(ha1, 1);

const ha2 = new CompositeNode(halfAdderCircuit, [ha1_Sum, Cin]);
const ha2_Sum = new SubCircuitOutputNode(ha2, 0);
const ha2_Carry = new SubCircuitOutputNode(ha2, 1);

// Add a delay and a name to the final OR gate as well
const finalCarryOut = new GateNode("OR", [ha1_Carry, ha2_Carry], 2, "fa_Cout_OR");

const fullAdderCircuit = new Circuit("FullAdder", [ha2_Sum, finalCarryOut]);
fullAdderCircuit.registerGate("AND", (inputs) => inputs.reduce((acc, bit) => acc & bit, 1));
fullAdderCircuit.registerGate("OR", (inputs) => inputs.reduce((acc, bit) => acc | bit, 0));
fullAdderCircuit.registerGate("NOT", (inputs) => (inputs[0] ? 0 : 1));

// --- 3. RUN A SIMULATION TO OBSERVE THE DELAYS ---
const simulationSteps = [
	{ inputs: [0, 0, 0], clock: 0 }, // Tick 1: Start with all inputs at 0.
	{ inputs: [1, 1, 0], clock: 0 }, // Tick 2: A and B go high. The change starts to propagate.
	{ inputs: [1, 1, 0], clock: 0 }, // Tick 3: Hold inputs steady.
	{ inputs: [1, 1, 0], clock: 0 }, // Tick 4: ...
	{ inputs: [1, 1, 0], clock: 0 }, // Tick 5: ...
	{ inputs: [1, 1, 0], clock: 0 }, // Tick 6: ...
	{ inputs: [1, 1, 0], clock: 0 } // Tick 7: By now, the circuit should be stable.
];

// --- MODIFICATION: Perform the simulation manually ---
const simulationHistory = [];
// Create a single clone to maintain state throughout the simulation.
const simCircuit = fullAdderCircuit.clone();

simulationSteps.forEach((step, index) => {
	// Set the clock for this step
	simCircuit.setClock(step.clock);
	// Run one tick of the simulation and get the outputs
	const outputs = simCircuit.tick(step.inputs);
	// Record the results
	simulationHistory.push({
		step: index + 1,
		inputs: step.inputs,
		clock: simCircuit.getClock(),
		outputs: [...outputs]
	});
});

console.log("--- Full-Adder Delay Simulation ---");
console.table(simulationHistory);

// --- 4. VIEW THE DETAILED HISTORY ---
// You can inspect this object in the browser's developer console.
console.log("--- Full-Adder Detailed History Object ---");
// The history is now on the clone, not the original circuit.
console.log(simCircuit.history);

// Expose to console for debugging
window.circuits = {
	halfAdder: halfAdderCircuit,
	fullAdder: fullAdderCircuit
};
