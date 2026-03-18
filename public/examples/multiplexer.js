/**
 * MULTIPLEXER (MUX)
 * =================
 *
 * PURPOSE:
 * A digital switch that selects one input from multiple inputs based on
 * selector signal(s). Like a railroad switch routing one track's signal.
 *
 * 2-TO-1 MULTIPLEXER:
 * -------------------
 * Selects between 2 inputs using 1 selector bit.
 *
 * TRUTH TABLE:
 * ┌─────┬────┬────┬────────┐
 * │ Sel │ I0 │ I1 │ Output │
 * ├─────┼────┼────┼────────┤
 * │  0  │ 0  │ X  │   0    │ ← Selects I0
 * │  0  │ 1  │ X  │   1    │ ← Selects I0
 * │  1  │ X  │ 0  │   0    │ ← Selects I1
 * │  1  │ X  │ 1  │   1    │ ← Selects I1
 * └─────┴────┴────┴────────┘
 *
 * LOGIC: Output = (NOT Sel AND I0) OR (Sel AND I1)
 *
 * 4-TO-1 MULTIPLEXER:
 * -------------------
 * Selects between 4 inputs using 2 selector bits.
 *
 * TRUTH TABLE:
 * ┌────┬────┬────┬────┬────┬────┬────────┐
 * │ S1 │ S0 │ I0 │ I1 │ I2 │ I3 │ Output │
 * ├────┼────┼────┼────┼────┼────┼────────┤
 * │ 0  │ 0  │ V  │ X  │ X  │ X  │   V    │ ← Selects I0
 * │ 0  │ 1  │ X  │ V  │ X  │ X  │   V    │ ← Selects I1
 * │ 1  │ 0  │ X  │ X  │ V  │ X  │   V    │ ← Selects I2
 * │ 1  │ 1  │ X  │ X  │ X  │ V  │   V    │ ← Selects I3
 * └────┴────┴────┴────┴────┴────┴────────┘
 *
 * PRACTICAL USES:
 * - Data routing (selecting which data source to use)
 * - ALU operation selection (choose between add/sub/and/or)
 * - Register file read ports (select which register to read)
 * - Memory addressing (select memory bank)
 * - Conditional execution (if-then-else in hardware)
 */

import { Circuit } from "../lib/circuit.js";
import { InputNode, GateNode } from "../lib/nodes.js";
import { STANDARD_GATES } from "../lib/common-gates.js";

/**
 * 2-TO-1 MULTIPLEXER
 *
 * INPUTS:
 *   Input[0] = I0  (input 0)
 *   Input[1] = I1  (input 1)
 *   Input[2] = Sel (selector: 0=I0, 1=I1)
 *
 * OUTPUTS:
 *   Output[0] = Selected input
 */
export function create2to1Mux(delay = 0) {
	const I0 = new InputNode(0);
	const I1 = new InputNode(1);
	const Sel = new InputNode(2);

	// When Sel=0: Pass I0 (NOT Sel AND I0)
	const path0 = new GateNode("AND", [new GateNode("NOT", [Sel], delay, "NOT_Sel"), I0], delay, "Path0");

	// When Sel=1: Pass I1 (Sel AND I1)
	const path1 = new GateNode("AND", [Sel, I1], delay, "Path1");

	// Combine paths (one will be 0, one will be the selected input)
	const output = new GateNode("OR", [path0, path1], delay, "Output");

	const circuit = new Circuit("Mux2to1", [output]);
	circuit.registerGate("AND", STANDARD_GATES.AND);
	circuit.registerGate("OR", STANDARD_GATES.OR);
	circuit.registerGate("NOT", STANDARD_GATES.NOT);

	return circuit;
}

/**
 * 4-TO-1 MULTIPLEXER
 *
 * INPUTS:
 *   Input[0] = I0 (input 0)
 *   Input[1] = I1 (input 1)
 *   Input[2] = I2 (input 2)
 *   Input[3] = I3 (input 3)
 *   Input[4] = S0 (selector bit 0, LSB)
 *   Input[5] = S1 (selector bit 1, MSB)
 *
 * OUTPUTS:
 *   Output[0] = Selected input
 *
 * Selection mapping:
 *   S1 S0 = 00 → I0
 *   S1 S0 = 01 → I1
 *   S1 S0 = 10 → I2
 *   S1 S0 = 11 → I3
 */
export function create4to1Mux(delay = 0) {
	const I0 = new InputNode(0);
	const I1 = new InputNode(1);
	const I2 = new InputNode(2);
	const I3 = new InputNode(3);
	const S0 = new InputNode(4);
	const S1 = new InputNode(5);

	// Each path is enabled when its corresponding selector pattern matches

	// Path 0: S1=0 AND S0=0 → select I0
	const enable0 = new GateNode(
		"AND",
		[new GateNode("NOT", [S1], delay, "NOT_S1_0"), new GateNode("NOT", [S0], delay, "NOT_S0_0")],
		delay,
		"Enable0"
	);
	const path0 = new GateNode("AND", [enable0, I0], delay, "Path0");

	// Path 1: S1=0 AND S0=1 → select I1
	const enable1 = new GateNode("AND", [new GateNode("NOT", [S1], delay, "NOT_S1_1"), S0], delay, "Enable1");
	const path1 = new GateNode("AND", [enable1, I1], delay, "Path1");

	// Path 2: S1=1 AND S0=0 → select I2
	const enable2 = new GateNode("AND", [S1, new GateNode("NOT", [S0], delay, "NOT_S0_2")], delay, "Enable2");
	const path2 = new GateNode("AND", [enable2, I2], delay, "Path2");

	// Path 3: S1=1 AND S0=1 → select I3
	const enable3 = new GateNode("AND", [S1, S0], delay, "Enable3");
	const path3 = new GateNode("AND", [enable3, I3], delay, "Path3");

	// Combine all paths (exactly one will be active)
	const temp = new GateNode("OR", [path0, path1], delay, "Temp01");
	const temp2 = new GateNode("OR", [path2, path3], delay, "Temp23");
	const output = new GateNode("OR", [temp, temp2], delay, "Output");

	const circuit = new Circuit("Mux4to1", [output]);
	circuit.registerGate("AND", STANDARD_GATES.AND);
	circuit.registerGate("OR", STANDARD_GATES.OR);
	circuit.registerGate("NOT", STANDARD_GATES.NOT);

	return circuit;
}
