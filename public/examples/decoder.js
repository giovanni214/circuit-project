/**
 * DECODER
 * =======
 *
 * PURPOSE:
 * Converts binary input to one-hot output (exactly one output is 1).
 * Opposite of an encoder.
 *
 * 2-TO-4 DECODER:
 * ---------------
 * Takes 2 input bits and activates 1 of 4 outputs.
 *
 * TRUTH TABLE:
 * ┌────┬────┬────┬────┬────┬────┐
 * │ I1 │ I0 │ O0 │ O1 │ O2 │ O3 │
 * ├────┼────┼────┼────┼────┼────┤
 * │ 0  │ 0  │ 1  │ 0  │ 0  │ 0  │ ← Output 0 active
 * │ 0  │ 1  │ 0  │ 1  │ 0  │ 0  │ ← Output 1 active
 * │ 1  │ 0  │ 0  │ 0  │ 1  │ 0  │ ← Output 2 active
 * │ 1  │ 1  │ 0  │ 0  │ 0  │ 1  │ ← Output 3 active
 * └────┴────┴────┴────┴────┴────┘
 *
 * LOGIC:
 * O0 = NOT I1 AND NOT I0
 * O1 = NOT I1 AND I0
 * O2 = I1 AND NOT I0
 * O3 = I1 AND I0
 *
 * PRACTICAL USES:
 * - Memory address decoding (select which chip/row)
 * - Instruction decoding in CPUs
 * - Demultiplexer enable signals
 * - One-hot state machine encoding
 * - Device selection (chip select signals)
 */

import { Circuit } from "../lib/circuit.js";
import { InputNode, GateNode } from "../lib/nodes.js";
import { STANDARD_GATES } from "../lib/common-gates.js";

/**
 * 2-TO-4 DECODER
 *
 * INPUTS:
 *   Input[0] = I0 (LSB)
 *   Input[1] = I1 (MSB)
 *
 * OUTPUTS:
 *   Output[0] = O0 (active when input = 00)
 *   Output[1] = O1 (active when input = 01)
 *   Output[2] = O2 (active when input = 10)
 *   Output[3] = O3 (active when input = 11)
 */
export function create2to4Decoder(delay = 0) {
	const I0 = new InputNode(0);
	const I1 = new InputNode(1);

	// Create NOT versions of inputs (used by multiple outputs)
	const NOT_I0 = new GateNode("NOT", [I0], delay, "NOT_I0");
	const NOT_I1 = new GateNode("NOT", [I1], delay, "NOT_I1");

	// Output 0: Active when I1=0 AND I0=0
	const O0 = new GateNode("AND", [NOT_I1, NOT_I0], delay, "O0");

	// Output 1: Active when I1=0 AND I0=1
	const O1 = new GateNode("AND", [NOT_I1, I0], delay, "O1");

	// Output 2: Active when I1=1 AND I0=0
	const O2 = new GateNode("AND", [I1, NOT_I0], delay, "O2");

	// Output 3: Active when I1=1 AND I0=1
	const O3 = new GateNode("AND", [I1, I0], delay, "O3");

	const circuit = new Circuit("Decoder2to4", [O0, O1, O2, O3]);
	circuit.registerGate("AND", STANDARD_GATES.AND);
	circuit.registerGate("NOT", STANDARD_GATES.NOT);

	return circuit;
}
