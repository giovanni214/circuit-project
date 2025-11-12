/**
 * 4-BIT BINARY COUNTER
 * ====================
 * 
 * (Same implementation as before, included for completeness)
 */

import { Circuit } from "../lib/circuit.js";
import { InputNode, GateNode, FeedbackNode, ClockNode } from "../lib/nodes.js";
import { STANDARD_GATES } from "../lib/common-gates.js";

export function create4BitCounter(delay = 0) {
    const ENABLE = new InputNode(0);
    const RESET = new InputNode(1);
    const CLK = new ClockNode();

    const Q0 = new FeedbackNode(null, 0, delay, "Q0");
    const Q1 = new FeedbackNode(null, 0, delay, "Q1");
    const Q2 = new FeedbackNode(null, 0, delay, "Q2");
    const Q3 = new FeedbackNode(null, 0, delay, "Q3");
    const prevCLK = new FeedbackNode(null, 0, delay, "prevCLK");

    const risingEdge = new GateNode(
        "AND",
        [CLK, new GateNode("NOT", [prevCLK], delay)],
        delay,
        "RisingEdge"
    );

    const countEnable = new GateNode("AND", [risingEdge, ENABLE], delay, "CountEnable");

    const nextQ0 = new GateNode("XOR", [Q0, countEnable], delay, "NextQ0");
    const toggle1 = new GateNode("AND", [countEnable, Q0], delay, "Toggle1");
    const nextQ1 = new GateNode("XOR", [Q1, toggle1], delay, "NextQ1");
    const toggle2 = new GateNode("AND", [countEnable, Q0, Q1], delay, "Toggle2");
    const nextQ2 = new GateNode("XOR", [Q2, toggle2], delay, "NextQ2");
    const toggle3 = new GateNode("AND", [countEnable, Q0, Q1, Q2], delay, "Toggle3");
    const nextQ3 = new GateNode("XOR", [Q3, toggle3], delay, "NextQ3");

    const finalQ0 = new GateNode("AND", [nextQ0, new GateNode("NOT", [RESET], delay)], delay, "FinalQ0");
    const finalQ1 = new GateNode("AND", [nextQ1, new GateNode("NOT", [RESET], delay)], delay, "FinalQ1");
    const finalQ2 = new GateNode("AND", [nextQ2, new GateNode("NOT", [RESET], delay)], delay, "FinalQ2");
    const finalQ3 = new GateNode("AND", [nextQ3, new GateNode("NOT", [RESET], delay)], delay, "FinalQ3");

    Q0.inputNode = finalQ0;
    Q1.inputNode = finalQ1;
    Q2.inputNode = finalQ2;
    Q3.inputNode = finalQ3;
    prevCLK.inputNode = CLK;

    const circuit = new Circuit("4BitCounter", [Q0, Q1, Q2, Q3]);
    circuit.registerGate("AND", STANDARD_GATES.AND);
    circuit.registerGate("OR", STANDARD_GATES.OR);
    circuit.registerGate("NOT", STANDARD_GATES.NOT);
    circuit.registerGate("XOR", STANDARD_GATES.XOR);
    circuit.registerFeedbackNode(Q0);
    circuit.registerFeedbackNode(Q1);
    circuit.registerFeedbackNode(Q2);
    circuit.registerFeedbackNode(Q3);
    circuit.registerFeedbackNode(prevCLK);

    return circuit;
}
