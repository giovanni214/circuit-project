/**
 * D FLIP-FLOP (Data/Delay Flip-Flop)
 * ==================================
 * 
 * PURPOSE:
 * The fundamental memory element in digital circuits. Stores one bit of data.
 * "D" stands for "Data" - it captures and holds the D input value.
 * 
 * BEHAVIOR:
 * - On RISING EDGE (0→1) of clock: Captures D input and stores it in Q
 * - Between clock edges: Q remains stable (holds its value)
 * - Q̄ (Q-bar) always outputs the opposite of Q
 * 
 * TIMING DIAGRAM:
 * 
 *      ┌─┐   ┌─┐   ┌─┐   ┌─┐
 * CLK: ┘ └───┘ └───┘ └───┘ └───
 *        ↑     ↑     ↑     ↑
 *        │     │     │     │
 *   D: ──┐ ┌───────┐ ┌─────────
 *        └─┘       └─┘
 *        
 *   Q: ──┐ ┌───────┐ ┌─────────  ← Q follows D on rising edges
 *        └─┘       └─┘
 * 
 * KEY FEATURES:
 * - Edge-triggered (not level-triggered like latches)
 * - Immune to D changes between clock edges
 * - Synchronous operation (tied to clock signal)
 * - Predictable, race-condition-free behavior
 * 
 * INPUTS:
 *   Input[0] = D   (data input - value to store)
 *   Circuit uses ClockNode for clock signal
 * 
 * OUTPUTS:
 *   Output[0] = Q   (stored data)
 *   Output[1] = Q̄   (inverted stored data)
 * 
 * PRACTICAL USES:
 * - CPU registers (holding operands, results)
 * - Pipeline registers (staging data between operations)
 * - State machines (remembering current state)
 * - Synchronizers (aligning async signals to clock)
 * - Shift registers (serial data storage)
 * - Memory cells (when arranged in arrays)
 * 
 * IMPLEMENTATION NOTES:
 * - Uses FeedbackNode to store Q state
 * - prevCLK FeedbackNode enables edge detection
 * - MUX logic: Q_next = risingEdge ? D : Q
 */

import { Circuit } from "../lib/circuit.js";
import { InputNode, GateNode, FeedbackNode, ClockNode } from "../lib/nodes.js";
import { STANDARD_GATES } from "../lib/common-gates.js";

export function createDFlipFlop(delay = 0) {
    // Input: D (data to store)
    const D = new InputNode(0);
    
    // Clock signal (managed by circuit.setClock())
    const CLK = new ClockNode();

    // MEMORY: Q feedback node stores the current state
    // Initialized to 0 (flip-flop starts in reset state)
    const Q = new FeedbackNode(null, 0, delay, "Q");

    // EDGE DETECTION: We need to detect rising edges (0→1 transitions)
    // Store the previous clock value to compare
    const prevCLK = new FeedbackNode(null, 0, delay, "prevCLK");

    // Rising edge occurs when:
    // - Current clock is 1 (CLK = 1), AND
    // - Previous clock was 0 (prevCLK = 0)
    // This gives us a single-tick pulse on 0→1 transitions
    const risingEdge = new GateNode(
        "AND",
        [
            CLK,
            new GateNode("NOT", [prevCLK], delay, "NOT_prevCLK")
        ],
        delay,
        "RisingEdge"
    );

    // CAPTURE LOGIC: Implement a 2-to-1 MUX
    // - If rising edge: capture new value from D
    // - If not rising edge: hold previous value in Q
    // 
    // MUX implementation using gates:
    // Output = (Sel AND A) OR (NOT Sel AND B)
    // where Sel = risingEdge, A = D, B = Q
    const nextQ = new GateNode(
        "OR",
        [
            // Path 1: Capture D when rising edge
            new GateNode("AND", [risingEdge, D], delay, "Capture_D"),
            
            // Path 2: Hold Q when not rising edge
            new GateNode(
                "AND",
                [new GateNode("NOT", [risingEdge], delay, "NOT_edge"), Q],
                delay,
                "Hold_Q"
            )
        ],
        delay,
        "NextQ"
    );

    // FEEDBACK CONNECTIONS:
    // Q feeds back the next value (creating memory)
    Q.inputNode = nextQ;
    
    // prevCLK feeds back current clock (for edge detection next cycle)
    prevCLK.inputNode = CLK;

    // COMPLEMENTARY OUTPUT: Q̄ (Q-bar/NOT Q)
    // Always the opposite of Q
    const Q_NOT = new GateNode("NOT", [Q], delay, "Q_NOT");

    // Create circuit with Q and Q̄ outputs
    const circuit = new Circuit("DFlipFlop", [Q, Q_NOT]);
    
    // Register gates
    circuit.registerGate("AND", STANDARD_GATES.AND);
    circuit.registerGate("OR", STANDARD_GATES.OR);
    circuit.registerGate("NOT", STANDARD_GATES.NOT);
    
    // Register feedback nodes for proper state management
    circuit.registerFeedbackNode(Q);
    circuit.registerFeedbackNode(prevCLK);

    return circuit;
}
