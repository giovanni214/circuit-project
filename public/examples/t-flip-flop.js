/**
 * T FLIP-FLOP (Toggle Flip-Flop)
 * ===============================
 * 
 * PURPOSE:
 * A flip-flop that toggles (inverts) its output when triggered.
 * Essential for counters and frequency division.
 * 
 * BEHAVIOR:
 * - When T=1 on rising clock edge: Q toggles (0→1 or 1→0)
 * - When T=0 on rising clock edge: Q holds its value
 * 
 * TRUTH TABLE (for rising edge):
 * ┌───┬─────────┬───────────┐
 * │ T │ Q(now)  │ Q(next)   │
 * ├───┼─────────┼───────────┤
 * │ 0 │    0    │     0     │ ← Hold
 * │ 0 │    1    │     1     │ ← Hold
 * │ 1 │    0    │     1     │ ← Toggle
 * │ 1 │    1    │     0     │ ← Toggle
 * └───┴─────────┴───────────┘
 * 
 * TIMING DIAGRAM:
 * 
 *      ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐
 * CLK: ┘ └─┘ └─┘ └─┘ └─┘ └─
 *        ↑   ↑   ↑   ↑   ↑
 *   T: ────────────────────  (T=1 always)
 *        
 *   Q: ──┐   ┌───┐   ┌───┐  ← Toggles every rising edge
 *        └───┘   └───┘   └
 * 
 * FREQUENCY DIVISION:
 * When T=1, output frequency is half the clock frequency.
 * Chain multiple T flip-flops to divide by 4, 8, 16, etc.
 * 
 * INPUTS:
 *   Input[0] = T (toggle enable: 1=toggle, 0=hold)
 *   Circuit uses ClockNode for clock signal
 * 
 * OUTPUTS:
 *   Output[0] = Q (toggling output)
 * 
 * PRACTICAL USES:
 * - Frequency dividers (divide clock by 2^n)
 * - Ripple counters (each T-FF is one counter bit)
 * - Clock prescalers (reducing clock frequency)
 * - Binary sequence generators
 */

import { Circuit } from "../lib/circuit.js";
import { InputNode, GateNode, FeedbackNode, ClockNode } from "../lib/nodes.js";
import { STANDARD_GATES } from "../lib/common-gates.js";

export function createTFlipFlop(delay = 0) {
    // Input: T (toggle control)
    const T = new InputNode(0);
    const CLK = new ClockNode();

    // State storage
    const Q = new FeedbackNode(null, 0, delay, "Q");
    const prevCLK = new FeedbackNode(null, 0, delay, "prevCLK");

    // Rising edge detection (same as D flip-flop)
    const risingEdge = new GateNode(
        "AND",
        [CLK, new GateNode("NOT", [prevCLK], delay)],
        delay,
        "RisingEdge"
    );

    // Toggle signal: Only toggle when BOTH rising edge AND T=1
    const toggleSignal = new GateNode(
        "AND",
        [risingEdge, T],
        delay,
        "ToggleSignal"
    );

    // TOGGLE LOGIC: Q_next = Q XOR toggleSignal
    // XOR truth table shows this implements toggle:
    // - Q=0, toggle=0 → 0 (hold)
    // - Q=0, toggle=1 → 1 (toggle)
    // - Q=1, toggle=0 → 1 (hold)
    // - Q=1, toggle=1 → 0 (toggle)
    const nextQ = new GateNode("XOR", [Q, toggleSignal], delay, "NextQ");

    // Connect feedback
    Q.inputNode = nextQ;
    prevCLK.inputNode = CLK;

    const circuit = new Circuit("TFlipFlop", [Q]);
    circuit.registerGate("AND", STANDARD_GATES.AND);
    circuit.registerGate("NOT", STANDARD_GATES.NOT);
    circuit.registerGate("XOR", STANDARD_GATES.XOR);
    circuit.registerFeedbackNode(Q);
    circuit.registerFeedbackNode(prevCLK);

    return circuit;
}
