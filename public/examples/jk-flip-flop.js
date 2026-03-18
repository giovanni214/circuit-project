/**
 * JK FLIP-FLOP
 * ============
 *
 * PURPOSE:
 * The most versatile flip-flop. Can SET, RESET, HOLD, or TOGGLE based on inputs.
 * "JK" stands for Jack Kilby, inventor of the integrated circuit.
 *
 * BEHAVIOR (on rising clock edge):
 * - J=0, K=0: Hold current state
 * - J=0, K=1: Reset (Q → 0)
 * - J=1, K=0: Set (Q → 1)
 * - J=1, K=1: Toggle (Q → NOT Q)
 *
 * TRUTH TABLE:
 * ┌───┬───┬─────────┬──────────┬─────────────┐
 * │ J │ K │ Q(now)  │ Q(next)  │ Operation   │
 * ├───┼───┼─────────┼──────────┼─────────────┤
 * │ 0 │ 0 │    0    │     0    │ Hold        │
 * │ 0 │ 0 │    1    │     1    │ Hold        │
 * │ 0 │ 1 │    X    │     0    │ Reset       │
 * │ 1 │ 0 │    X    │     1    │ Set         │
 * │ 1 │ 1 │    0    │     1    │ Toggle      │
 * │ 1 │ 1 │    1    │     0    │ Toggle      │
 * └───┴───┴─────────┴──────────┴─────────────┘
 *
 * CHARACTERISTIC EQUATION:
 * Q_next = (J AND NOT Q) OR (NOT K AND Q)
 *
 * This can be broken down as:
 * - (J AND NOT Q): Sets Q to 1 when J=1 and Q=0
 * - (NOT K AND Q): Keeps Q=1 when K=0 and Q=1
 *
 * INPUTS:
 *   Input[0] = J (set input)
 *   Input[1] = K (reset input)
 *   Circuit uses ClockNode for clock signal
 *
 * OUTPUTS:
 *   Output[0] = Q   (state output)
 *   Output[1] = Q̄   (inverted output)
 *
 * PRACTICAL USES:
 * - State machines (versatile state transitions)
 * - Synchronous counters (more control than T flip-flops)
 * - Data storage with reset capability
 * - Control logic requiring all four operations
 *
 * ADVANTAGES OVER OTHER FLIP-FLOPS:
 * - Can perform all operations (D-FF: store, T-FF: toggle)
 * - No invalid states (unlike SR latch with S=R=1)
 * - More flexible control in complex circuits
 */

import { Circuit } from "../lib/circuit.js";
import { InputNode, GateNode, FeedbackNode, ClockNode } from "../lib/nodes.js";
import { STANDARD_GATES } from "../lib/common-gates.js";

export function createJKFlipFlop(delay = 0) {
	// Inputs
	const J = new InputNode(0); // Set input
	const K = new InputNode(1); // Reset input
	const CLK = new ClockNode();

	// State storage
	const Q = new FeedbackNode(null, 0, delay, "Q");
	const prevCLK = new FeedbackNode(null, 0, delay, "prevCLK");

	// Rising edge detection
	const risingEdge = new GateNode("AND", [CLK, new GateNode("NOT", [prevCLK], delay)], delay, "RisingEdge");

	// JK LOGIC: Q_next = (J AND NOT Q) OR (NOT K AND Q)
	//
	// Break this down:
	// Part 1: J AND NOT Q - "Try to set"
	//   This is 1 when J=1 and Q=0 (trying to set from 0 to 1)
	const trySet = new GateNode("AND", [J, new GateNode("NOT", [Q], delay, "NOT_Q")], delay, "TrySet");

	// Part 2: NOT K AND Q - "Try to hold high"
	//   This is 1 when K=0 and Q=1 (trying to keep Q at 1)
	const tryHold = new GateNode("AND", [new GateNode("NOT", [K], delay, "NOT_K"), Q], delay, "TryHold");

	// Combine: Q is 1 if we're setting OR holding
	const nextQValue = new GateNode("OR", [trySet, tryHold], delay, "NextQValue");

	// Only update on rising edge (MUX: risingEdge ? nextQValue : Q)
	const nextQ = new GateNode(
		"OR",
		[
			new GateNode("AND", [risingEdge, nextQValue], delay, "Update"),
			new GateNode("AND", [new GateNode("NOT", [risingEdge], delay), Q], delay, "Hold")
		],
		delay,
		"NextQ"
	);

	// Connect feedback
	Q.inputNode = nextQ;
	prevCLK.inputNode = CLK;

	// Complementary output
	const Q_NOT = new GateNode("NOT", [Q], delay, "Q_NOT");

	const circuit = new Circuit("JKFlipFlop", [Q, Q_NOT]);
	circuit.registerGate("AND", STANDARD_GATES.AND);
	circuit.registerGate("OR", STANDARD_GATES.OR);
	circuit.registerGate("NOT", STANDARD_GATES.NOT);
	circuit.registerFeedbackNode(Q);
	circuit.registerFeedbackNode(prevCLK);

	return circuit;
}
