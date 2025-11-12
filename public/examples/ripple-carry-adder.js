/**
 * 4-BIT RIPPLE CARRY ADDER
 * ========================
 *
 * PURPOSE:
 * Adds two 4-bit binary numbers together, producing a 4-bit sum and carry out.
 * Called "ripple carry" because the carry "ripples" from LSB to MSB.
 *
 * EXAMPLE ADDITION:
 *     A:  1011  (11 in decimal)
 *   + B:  0110  (6 in decimal)
 *   ─────────
 *   Sum:  0001  (1 in decimal - lower 4 bits)
 *  Cout:  1     (overflow bit - result is 17, needs 5 bits)
 *
 * ARCHITECTURE:
 *
 *   A[0] B[0]      A[1] B[1]      A[2] B[2]      A[3] B[3]
 *     │   │          │   │          │   │          │   │
 *     └─┬─┘          └─┬─┘          └─┬─┘          └─┬─┘
 *   Cin─┤FA0├──Carry──┤FA1├──Carry──┤FA2├──Carry──┤FA3├──Cout
 *       └─┬─┘          └─┬─┘          └─┬─┘          └─┬─┘
 *         │              │              │              │
 *       Sum[0]         Sum[1]         Sum[2]         Sum[3]
 *        (LSB)                                        (MSB)
 *
 * HOW IT WORKS:
 * 1. Each full adder adds one bit position: A[i] + B[i] + Carry[i-1]
 * 2. The carry output of each adder feeds into the next higher bit
 * 3. This creates a "ripple" effect from bit 0 to bit 3
 * 4. Final carry out indicates overflow (result > 15)
 *
 * TIMING CONSIDERATION:
 * The ripple carry causes delay - bit 3's sum must wait for carries
 * from bits 0, 1, and 2 to propagate. For faster addition, use
 * "carry lookahead" adders (not implemented here).
 *
 * INPUTS:
 *   Input[0-3] = A[0-3]  (first 4-bit number, LSB to MSB)
 *   Input[4-7] = B[0-3]  (second 4-bit number, LSB to MSB)
 *   Input[8]   = Cin     (carry in, usually 0)
 *
 * OUTPUTS:
 *   Output[0-3] = Sum[0-3] (4-bit sum, LSB to MSB)
 *   Output[4]   = Cout     (carry out / overflow flag)
 *
 * PRACTICAL USES:
 * - CPU ALUs (arithmetic logic units)
 * - Binary calculators
 * - Address computation
 * - Counter circuits
 */

import { Circuit } from "../lib/circuit.js";
import { InputNode, CompositeNode, SubCircuitOutputNode } from "../lib/nodes.js";
import { createFullAdder } from "./full-adder.js";

export function create4BitRippleCarryAdder(delay = 0) {
	// Get the full adder circuit template
	const fullAdder = createFullAdder(delay);

	// Define inputs: A[0-3], B[0-3], Cin
	// LSB (least significant bit) is at index 0

	// BIT 0 (LSB): First full adder
	// Adds A[0] + B[0] + Cin
	const adder0 = new CompositeNode(fullAdder, [
		new InputNode(0), // A[0] - LSB of first number
		new InputNode(4), // B[0] - LSB of second number
		new InputNode(8) // Cin - initial carry in (usually 0)
	]);

	// BIT 1: Second full adder
	// Adds A[1] + B[1] + (carry from bit 0)
	const adder1 = new CompositeNode(fullAdder, [
		new InputNode(1), // A[1]
		new InputNode(5), // B[1]
		new SubCircuitOutputNode(adder0, 1) // Carry from adder0
	]);

	// BIT 2: Third full adder
	// Adds A[2] + B[2] + (carry from bit 1)
	const adder2 = new CompositeNode(fullAdder, [
		new InputNode(2), // A[2]
		new InputNode(6), // B[2]
		new SubCircuitOutputNode(adder1, 1) // Carry from adder1
	]);

	// BIT 3 (MSB): Fourth full adder
	// Adds A[3] + B[3] + (carry from bit 2)
	const adder3 = new CompositeNode(fullAdder, [
		new InputNode(3), // A[3] - MSB of first number
		new InputNode(7), // B[3] - MSB of second number
		new SubCircuitOutputNode(adder2, 1) // Carry from adder2
	]);

	// Collect all outputs:
	// - Sum bits 0-3 (the 4-bit result)
	// - Final carry out (overflow indicator)
	const circuit = new Circuit("4BitRippleCarryAdder", [
		new SubCircuitOutputNode(adder0, 0), // Sum[0] - LSB
		new SubCircuitOutputNode(adder1, 0), // Sum[1]
		new SubCircuitOutputNode(adder2, 0), // Sum[2]
		new SubCircuitOutputNode(adder3, 0), // Sum[3] - MSB
		new SubCircuitOutputNode(adder3, 1) // Cout - overflow flag
	]);

	return circuit;
}
