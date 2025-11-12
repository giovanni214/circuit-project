/**
 * HALF ADDER
 * ==========
 *
 * PURPOSE:
 * Adds two single bits together, producing a sum and carry output.
 * The most basic arithmetic circuit - building block for all adders.
 *
 * TRUTH TABLE:
 * ┌───┬───┬─────┬───────┐
 * │ A │ B │ Sum │ Carry │
 * ├───┼───┼─────┼───────┤
 * │ 0 │ 0 │  0  │   0   │
 * │ 0 │ 1 │  1  │   0   │
 * │ 1 │ 0 │  1  │   0   │
 * │ 1 │ 1 │  0  │   1   │  ← Both inputs = 1 produces carry
 * └───┴───┴─────┴───────┘
 *
 * LOGIC:
 * - Sum = A XOR B    (1 if inputs differ)
 * - Carry = A AND B  (1 only if both inputs are 1)
 *
 * INPUTS:
 *   Input[0] = A (first bit)
 *   Input[1] = B (second bit)
 *
 * OUTPUTS:
 *   Output[0] = Sum   (A ⊕ B)
 *   Output[1] = Carry (A ∧ B)
 *
 * PRACTICAL USES:
 * - Building block for full adders
 * - Simple bit addition without carry-in
 * - XOR gate replacement (when carry not needed)
 */

import { Circuit } from "../lib/circuit.js";
import { InputNode, GateNode } from "../lib/nodes.js";
import { STANDARD_GATES } from "../lib/common-gates.js";

export function createHalfAdder(delay = 0) {
	// Input bits to add
	const A = new InputNode(0);
	const B = new InputNode(1);

	// Sum output: 1 when exactly one input is 1
	// XOR gives us this behavior naturally
	const Sum = new GateNode("XOR", [A, B], delay, "HalfAdder_Sum");

	// Carry output: 1 only when BOTH inputs are 1
	// AND gate gives us this behavior
	const Carry = new GateNode("AND", [A, B], delay, "HalfAdder_Carry");

	// Create circuit with Sum as first output, Carry as second
	const circuit = new Circuit("HalfAdder", [Sum, Carry]);

	// Register the gates we use
	circuit.registerGate("XOR", STANDARD_GATES.XOR);
	circuit.registerGate("AND", STANDARD_GATES.AND);

	return circuit;
}
