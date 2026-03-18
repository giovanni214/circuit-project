/**
 * FULL ADDER
 * ==========
 * 
 * PURPOSE:
 * Adds THREE bits: A, B, and Carry-In, producing Sum and Carry-Out.
 * Essential for multi-bit addition where carry propagates between bit positions.
 * 
 * TRUTH TABLE:
 * ┌───┬───┬─────┬─────┬──────┐
 * │ A │ B │ Cin │ Sum │ Cout │
 * ├───┼───┼─────┼─────┼──────┤
 * │ 0 │ 0 │  0  │  0  │  0   │
 * │ 0 │ 0 │  1  │  1  │  0   │
 * │ 0 │ 1 │  0  │  1  │  0   │
 * │ 0 │ 1 │  1  │  0  │  1   │ ← Two 1's = carry out
 * │ 1 │ 0 │  0  │  1  │  0   │
 * │ 1 │ 0 │  1  │  0  │  1   │ ← Two 1's = carry out
 * │ 1 │ 1 │  0  │  0  │  1   │ ← Two 1's = carry out
 * │ 1 │ 1 │  1  │  1  │  1   │ ← Three 1's = sum AND carry
 * └───┴───┴─────┴─────┴──────┘
 * 
 * ARCHITECTURE (using two half adders):
 * 
 *   A ────┐
 *         ├─[Half Adder 1]─┬─ Sum1 ──┐
 *   B ────┘                 │         ├─[Half Adder 2]── Sum (final)
 *                           └─Carry1  │
 *   Cin ────────────────────────────┘
 *                                     └─ Carry2
 *                                          │
 *   Carry1 ──┐                             │
 *            ├─[OR]─── Cout (final)        │
 *   Carry2 ──┘                             │
 * 
 * LOGIC EXPLANATION:
 * 1. First half adder: Adds A + B
 *    - Produces intermediate sum (Sum1) and carry (Carry1)
 * 2. Second half adder: Adds Sum1 + Cin
 *    - Produces final sum and second carry (Carry2)
 * 3. OR gate: Combines both carries
 *    - Cout = 1 if EITHER half adder produced a carry
 * 
 * INPUTS:
 *   Input[0] = A   (first bit)
 *   Input[1] = B   (second bit)
 *   Input[2] = Cin (carry from previous bit position)
 * 
 * OUTPUTS:
 *   Output[0] = Sum  (final sum bit)
 *   Output[1] = Cout (carry to next bit position)
 * 
 * PRACTICAL USES:
 * - Multi-bit adders (chaining multiple full adders)
 * - ALU arithmetic operations
 * - Binary calculators
 * - CPU arithmetic units
 */

import { Circuit } from "../lib/circuit.js";
import { InputNode, GateNode, CompositeNode, SubCircuitOutputNode } from "../lib/nodes.js";
import { STANDARD_GATES } from "../lib/common-gates.js";
import { createHalfAdder } from "./half-adder.js";

export function createFullAdder(delay = 0) {
    // Get the half adder circuit template
    const halfAdder = createHalfAdder(delay);

    // Define our three inputs
    const A = new InputNode(0);
    const B = new InputNode(1);
    const Cin = new InputNode(2);

    // STAGE 1: First half adder adds A and B
    // This gives us A+B in two outputs: sum and carry
    const halfAdder1 = new CompositeNode(halfAdder, [A, B]);
    
    // Extract the outputs from first half adder:
    const Sum1 = new SubCircuitOutputNode(halfAdder1, 0);   // A XOR B
    const Carry1 = new SubCircuitOutputNode(halfAdder1, 1); // A AND B

    // STAGE 2: Second half adder adds the result (Sum1) with Cin
    // This completes the three-input addition
    const halfAdder2 = new CompositeNode(halfAdder, [Sum1, Cin]);
    
    // Extract outputs from second half adder:
    const Sum = new SubCircuitOutputNode(halfAdder2, 0);   // Final sum: (A XOR B) XOR Cin
    const Carry2 = new SubCircuitOutputNode(halfAdder2, 1); // Second carry: (A XOR B) AND Cin

    // STAGE 3: Combine the two possible carry outputs
    // We get a carry out if EITHER:
    // - Both A and B were 1 (Carry1), OR
    // - Exactly one of A,B was 1 AND Cin was 1 (Carry2)
    const Cout = new GateNode("OR", [Carry1, Carry2], delay, "FullAdder_Cout");

    // Create the circuit with Sum and Cout as outputs
    const circuit = new Circuit("FullAdder", [Sum, Cout]);
    circuit.registerGate("OR", STANDARD_GATES.OR);

    return circuit;
}
