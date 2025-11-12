import { Circuit } from "../lib/circuit.js";
import { InputNode, GateNode, FeedbackNode, ClockNode, CompositeNode, SubCircuitOutputNode } from "../lib/nodes.js";
import { STANDARD_GATES } from "../lib/common-gates.js";

/**
 * D FLIP-FLOP (Data/Delay Flip-Flop)
 *
 * PRACTICAL USE: Memory storage element - the fundamental building block
 * of all computer memory (RAM, registers, caches).
 *
 * BEHAVIOR:
 * - On RISING EDGE of clock: Captures the value of D and stores it in Q
 * - Q remains stable until the next rising edge
 * - Q̄ (not Q) is the inverted output
 *
 * INPUTS:
 *   Input[0] = D     (data input)
 *   Input[1] = CLK   (clock signal, use ClockNode for actual clock)
 *
 * OUTPUTS:
 *   Output[0] = Q    (stored data)
 *   Output[1] = Q̄    (inverted stored data)
 *
 * REAL-WORLD USAGE:
 * - CPU registers (storing instruction operands)
 * - Pipeline registers (holding intermediate computation results)
 * - State machines (remembering current state)
 * - Synchronization (aligning asynchronous signals to clock)
 */
export function createDFlipFlop(delay = 0) {
	const D = new InputNode(0);
	const CLK = new ClockNode();

	// Create feedback node Q with initial value 0
	// This is the STORED STATE - it remembers the last captured D value
	const Q = new FeedbackNode(null, 0, delay, "Q");

	// EDGE DETECTION: Detect rising edge of clock
	// prevCLK stores the clock value from the previous evaluation
	const prevCLK = new FeedbackNode(null, 0, delay, "prevCLK");

	// Rising edge occurs when: current clock is 1 AND previous clock was 0
	const risingEdge = new GateNode(
		"AND",
		[CLK, new GateNode("NOT", [prevCLK], delay, "NOT_prevCLK")],
		delay,
		"RisingEdge"
	);

	// CAPTURE LOGIC: Q updates to D only on rising edge
	// If rising edge: Q = D
	// If not rising edge: Q = Q (holds previous value)
	// This is a MUX: risingEdge ? D : Q
	const nextQ = new GateNode(
		"OR",
		[
			new GateNode("AND", [risingEdge, D], delay, "Capture_D"),
			new GateNode("AND", [new GateNode("NOT", [risingEdge], delay, "NOT_edge"), Q], delay, "Hold_Q")
		],
		delay,
		"NextQ"
	);

	// Connect feedback: Q feeds back nextQ, prevCLK feeds back CLK
	Q.inputNode = nextQ;
	prevCLK.inputNode = CLK;

	// Q̄ is the inverted output
	const Q_NOT = new GateNode("NOT", [Q], delay, "Q_NOT");

	const circuit = new Circuit("DFlipFlop", [Q, Q_NOT]);
	circuit.registerGate("AND", STANDARD_GATES.AND);
	circuit.registerGate("OR", STANDARD_GATES.OR);
	circuit.registerGate("NOT", STANDARD_GATES.NOT);
	circuit.registerFeedbackNode(Q);
	circuit.registerFeedbackNode(prevCLK);

	return circuit;
}

/**
 * T FLIP-FLOP (Toggle Flip-Flop)
 *
 * PRACTICAL USE: Frequency divider, counter building block
 *
 * BEHAVIOR:
 * - On RISING EDGE when T=1: Q toggles (0→1 or 1→0)
 * - On RISING EDGE when T=0: Q holds its value
 *
 * INPUTS:
 *   Input[0] = T (toggle enable)
 *
 * OUTPUTS:
 *   Output[0] = Q (toggling output)
 *
 * REAL-WORLD USAGE:
 * - Frequency dividers (each T flip-flop divides frequency by 2)
 * - Ripple counters
 * - Clock prescalers
 */
export function createTFlipFlop(delay = 0) {
	const T = new InputNode(0);
	const CLK = new ClockNode();

	const Q = new FeedbackNode(null, 0, delay, "Q");
	const prevCLK = new FeedbackNode(null, 0, delay, "prevCLK");

	// Rising edge detection
	const risingEdge = new GateNode("AND", [CLK, new GateNode("NOT", [prevCLK], delay)], delay, "RisingEdge");

	// Toggle logic: If (rising edge AND T), then Q = NOT(Q), else Q = Q
	// Simplified: Q_next = Q XOR (rising edge AND T)
	const toggleSignal = new GateNode("AND", [risingEdge, T], delay, "ToggleSignal");
	const nextQ = new GateNode("XOR", [Q, toggleSignal], delay, "NextQ");

	Q.inputNode = nextQ;
	prevCLK.inputNode = CLK;

	const circuit = new Circuit("TFlipFlop", [Q]);
	circuit.registerGate("AND", STANDARD_GATES.AND);
	circuit.registerGate("OR", STANDARD_GATES.OR);
	circuit.registerGate("NOT", STANDARD_GATES.NOT);
	circuit.registerGate("XOR", STANDARD_GATES.XOR);
	circuit.registerFeedbackNode(Q);
	circuit.registerFeedbackNode(prevCLK);

	return circuit;
}

/**
 * 4-BIT BINARY COUNTER
 *
 * PRACTICAL USE: One of the most common circuits in digital systems
 *
 * BEHAVIOR:
 * - Counts from 0000 to 1111 (0 to 15 in decimal)
 * - Increments by 1 on each rising clock edge
 * - Wraps around to 0 after reaching 15
 *
 * INPUTS:
 *   Input[0] = ENABLE (1 = count, 0 = hold)
 *   Input[1] = RESET  (1 = reset to 0, 0 = normal operation)
 *
 * OUTPUTS:
 *   Output[0-3] = Q0, Q1, Q2, Q3 (4-bit count, LSB to MSB)
 *
 * REAL-WORLD USAGE:
 * - Program Counter in CPUs (tracks which instruction to execute next)
 * - Timer circuits (generating delays, timeouts)
 * - Address generators (for memory access)
 * - Frequency measurement (count pulses in a time window)
 * - Event counting (count sensor triggers, button presses)
 * - PWM generation (pulse width modulation for motor control)
 */
/**
 * 4-BIT BINARY COUNTER - FIXED VERSION
 */
export function create4BitCounter(delay = 0) {
	const ENABLE = new InputNode(0);
	const RESET = new InputNode(1);
	const CLK = new ClockNode();

	// Create 4 feedback nodes for the 4 bits (LSB to MSB)
	const Q0 = new FeedbackNode(null, 0, delay, "Q0");
	const Q1 = new FeedbackNode(null, 0, delay, "Q1");
	const Q2 = new FeedbackNode(null, 0, delay, "Q2");
	const Q3 = new FeedbackNode(null, 0, delay, "Q3");

	const prevCLK = new FeedbackNode(null, 0, delay, "prevCLK");

	// Rising edge detection
	const risingEdge = new GateNode("AND", [CLK, new GateNode("NOT", [prevCLK], delay)], delay, "RisingEdge");

	// Count enable: rising edge AND enable
	const countEnable = new GateNode("AND", [risingEdge, ENABLE], delay, "CountEnable");

	// COUNTER LOGIC: Each bit toggles when all lower bits are 1
	// Q0 toggles on every count (unconditional when countEnable=1)
	// Q1 toggles when Q0 = 1 and counting
	// Q2 toggles when Q0 = 1 AND Q1 = 1 and counting
	// Q3 toggles when Q0 = 1 AND Q1 = 1 AND Q2 = 1 and counting

	// FIX: Q0 should simply XOR with countEnable, like the other bits
	const nextQ0 = new GateNode("XOR", [Q0, countEnable], delay, "NextQ0");

	const toggle1 = new GateNode("AND", [countEnable, Q0], delay, "Toggle1");
	const nextQ1 = new GateNode("XOR", [Q1, toggle1], delay, "NextQ1");

	const toggle2 = new GateNode("AND", [countEnable, Q0, Q1], delay, "Toggle2");
	const nextQ2 = new GateNode("XOR", [Q2, toggle2], delay, "NextQ2");

	const toggle3 = new GateNode("AND", [countEnable, Q0, Q1, Q2], delay, "Toggle3");
	const nextQ3 = new GateNode("XOR", [Q3, toggle3], delay, "NextQ3");

	// RESET LOGIC: If reset is active, force all outputs to 0
	// Otherwise, use the computed next values
	const finalQ0 = new GateNode("AND", [nextQ0, new GateNode("NOT", [RESET], delay)], delay, "FinalQ0");
	const finalQ1 = new GateNode("AND", [nextQ1, new GateNode("NOT", [RESET], delay)], delay, "FinalQ1");
	const finalQ2 = new GateNode("AND", [nextQ2, new GateNode("NOT", [RESET], delay)], delay, "FinalQ2");
	const finalQ3 = new GateNode("AND", [nextQ3, new GateNode("NOT", [RESET], delay)], delay, "FinalQ3");

	// Connect feedback
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

// ============================================================================
// TESTING AND DEMONSTRATION
// ============================================================================

console.log("=".repeat(70));
console.log("D FLIP-FLOP DEMONSTRATION");
console.log("=".repeat(70));

const dff = createDFlipFlop();

console.log("\nD Flip-Flop stores data on rising clock edge:");
console.log("Tick | CLK | D | Q | Q̄ | Event");
console.log("-----|-----|---|---|---|----------------------------------");

const dffTests = [
	{ clk: 0, d: 0, desc: "Initial state" },
	{ clk: 0, d: 1, desc: "D=1, but no rising edge yet" },
	{ clk: 1, d: 1, desc: "RISING EDGE: Q captures D=1" },
	{ clk: 1, d: 0, desc: "D changes to 0, but Q holds 1" },
	{ clk: 0, d: 0, desc: "Falling edge, Q still holds 1" },
	{ clk: 1, d: 0, desc: "RISING EDGE: Q captures D=0" },
	{ clk: 0, d: 1, desc: "D changes to 1, Q holds 0" },
	{ clk: 1, d: 1, desc: "RISING EDGE: Q captures D=1" }
];

dffTests.forEach(({ clk, d, desc }, i) => {
	dff.setClock(clk);
	const result = dff.tick([d]);
	console.log(`  ${i}  |  ${clk}  | ${d} | ${result[0]} | ${result[1]} | ${desc}`);
});

console.log("\n" + "=".repeat(70));
console.log("4-BIT BINARY COUNTER DEMONSTRATION");
console.log("=".repeat(70));

const counter = create4BitCounter();

console.log("\nCounter demonstration (ENABLE=1, RESET=0):");
console.log("Tick | CLK | Count (Binary) | Decimal | Event");
console.log("-----|-----|----------------|---------|------------------------");

// Count from 0 to 20 to show wrap-around
for (let i = 0; i < 20; i++) {
	// Toggle clock: 0 → 1 (rising edge) → 0
	counter.setClock(0);
	counter.tick([1, 0]); // ENABLE=1, RESET=0

	counter.setClock(1);
	const result = counter.tick([1, 0]);

	const binary = `${result[3]}${result[2]}${result[1]}${result[0]}`;
	const decimal = result[0] + result[1] * 2 + result[2] * 4 + result[3] * 8;

	let event = "";
	if (i === 0) event = "Started counting";
	if (decimal === 15) event = "Maximum count reached";
	if (decimal === 0 && i > 0) event = "Wrapped around to 0";

	console.log(
		`  ${i.toString().padStart(2)}  |  1  |      ${binary}      |    ${decimal.toString().padStart(2)}   | ${event}`
	);
}

console.log("\n" + "=".repeat(70));
console.log("COUNTER WITH ENABLE AND RESET");
console.log("=".repeat(70));

const counter2 = create4BitCounter();

console.log("\nDemonstrating ENABLE and RESET controls:");
console.log("Tick | CLK | EN | RST | Count | Decimal | Event");
console.log("-----|-----|----|----|-------|---------|------------------------");

const counterTests = [
	{ en: 1, rst: 0, desc: "Count: 0→1" },
	{ en: 1, rst: 0, desc: "Count: 1→2" },
	{ en: 1, rst: 0, desc: "Count: 2→3" },
	{ en: 0, rst: 0, desc: "DISABLED: Hold at 3" },
	{ en: 0, rst: 0, desc: "DISABLED: Still 3" },
	{ en: 1, rst: 0, desc: "ENABLED: 3→4" },
	{ en: 1, rst: 0, desc: "Count: 4→5" },
	{ en: 1, rst: 1, desc: "RESET: 5→0" },
	{ en: 1, rst: 0, desc: "Count: 0→1" }
];

counterTests.forEach(({ en, rst, desc }, i) => {
	counter2.setClock(0);
	counter2.tick([en, rst]);

	counter2.setClock(1);
	const result = counter2.tick([en, rst]);

	const binary = `${result[3]}${result[2]}${result[1]}${result[0]}`;
	const decimal = result[0] + result[1] * 2 + result[2] * 4 + result[3] * 8;

	console.log(`  ${i}  |  1  | ${en}  |  ${rst}  |  ${binary} |    ${decimal}    | ${desc}`);
});

console.log("\n" + "=".repeat(70));
console.log("REAL-WORLD APPLICATION: SIMPLE TIMER");
console.log("=".repeat(70));

console.log("\nSimulating a 1-second timer using a counter:");
console.log("(Assume each clock tick = 62.5ms, so 16 ticks = 1 second)");
console.log("\nTick | Time (ms) | Count | Status");
console.log("-----|-----------|-------|--------------------------------");

const timer = create4BitCounter();
const targetCount = 15; // Count to 15 (16 clock edges)

for (let tick = 0; tick <= 16; tick++) {
	timer.setClock(0);
	timer.tick([1, 0]);

	timer.setClock(1);
	const result = timer.tick([1, 0]);

	const count = result[0] + result[1] * 2 + result[2] * 4 + result[3] * 8;
	const timeMs = tick * 62.5;

	let status = "Counting...";
	if (count === targetCount) {
		status = "⏰ TIMER EXPIRED! (1 second elapsed)";
	}
	if (count === 0 && tick > 0) {
		status = "Reset for next timing cycle";
	}

	console.log(
		` ${tick.toString().padStart(2)}  |  ${timeMs.toString().padStart(6)}   |  ${count.toString().padStart(2)}   | ${status}`
	);
}

console.log("\n✓ Practical feedback circuits demonstrated!");
console.log("✓ These circuits form the foundation of:");
console.log("  - Computer memory (D flip-flops)");
console.log("  - CPU program counters (binary counters)");
console.log("  - Timers and delays (counters)");
console.log("  - State machines (flip-flops + logic)");
