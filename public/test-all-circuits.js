/**
 * COMPREHENSIVE CIRCUIT TEST SUITE
 * =================================
 *
 * Tests all implemented digital circuits to verify correct operation.
 */

import { createHalfAdder } from "../examples/half-adder.js";
import { createFullAdder } from "./examples/full-adder.js";
import { create4BitRippleCarryAdder } from "./examples/ripple-carry-adder.js";
import { createDFlipFlop } from "./examples/d-flip-flop.js";
import { createTFlipFlop } from "./examples/t-flip-flop.js";
import { createJKFlipFlop } from "./examples/jk-flip-flop.js";
import { create2to1Mux, create4to1Mux } from "./examples/multiplexer.js";
import { create2to4Decoder } from "./examples/decoder.js";
import { create4BitCounter } from "./examples/counter.js";

// Test result tracking
let totalTests = 0;
let passedTests = 0;

function test(name, condition, expected, actual) {
	totalTests++;
	const passed = condition;
	if (passed) {
		passedTests++;
		console.log(`  ✓ ${name}`);
	} else {
		console.log(`  ✗ ${name}`);
		console.log(`    Expected: ${expected}`);
		console.log(`    Got: ${actual}`);
	}
}

function testSection(name) {
	console.log(`\n${"=".repeat(70)}`);
	console.log(name);
	console.log("=".repeat(70));
}

// ============================================================================
// HALF ADDER TESTS
// ============================================================================
testSection("HALF ADDER TESTS");

const ha = createHalfAdder();

test("0 + 0 = 0 carry 0", JSON.stringify(ha.tick([0, 0])) === JSON.stringify([0, 0]), "[0, 0]", ha.tick([0, 0]));

test("0 + 1 = 1 carry 0", JSON.stringify(ha.tick([0, 1])) === JSON.stringify([1, 0]), "[1, 0]", ha.tick([0, 1]));

test("1 + 0 = 1 carry 0", JSON.stringify(ha.tick([1, 0])) === JSON.stringify([1, 0]), "[1, 0]", ha.tick([1, 0]));

test("1 + 1 = 0 carry 1", JSON.stringify(ha.tick([1, 1])) === JSON.stringify([0, 1]), "[0, 1]", ha.tick([1, 1]));

// ============================================================================
// FULL ADDER TESTS
// ============================================================================
testSection("FULL ADDER TESTS");

const fa = createFullAdder();

test(
	"0 + 0 + 0 = 0 carry 0",
	JSON.stringify(fa.tick([0, 0, 0])) === JSON.stringify([0, 0]),
	"[0, 0]",
	fa.tick([0, 0, 0])
);

test(
	"0 + 0 + 1 = 1 carry 0",
	JSON.stringify(fa.tick([0, 0, 1])) === JSON.stringify([1, 0]),
	"[1, 0]",
	fa.tick([0, 0, 1])
);

test(
	"1 + 1 + 0 = 0 carry 1",
	JSON.stringify(fa.tick([1, 1, 0])) === JSON.stringify([0, 1]),
	"[0, 1]",
	fa.tick([1, 1, 0])
);

test(
	"1 + 1 + 1 = 1 carry 1",
	JSON.stringify(fa.tick([1, 1, 1])) === JSON.stringify([1, 1]),
	"[1, 1]",
	fa.tick([1, 1, 1])
);

// ============================================================================
// 4-BIT ADDER TESTS
// ============================================================================
testSection("4-BIT RIPPLE CARRY ADDER TESTS");

const adder4 = create4BitRippleCarryAdder();

function test4BitAdd(a, b, expectedSum, expectedCarry) {
	const aBits = [a & 1, (a >> 1) & 1, (a >> 2) & 1, (a >> 3) & 1];
	const bBits = [b & 1, (b >> 1) & 1, (b >> 2) & 1, (b >> 3) & 1];
	const inputs = [...aBits, ...bBits, 0];
	const result = adder4.tick(inputs);
	const sum = result[0] + result[1] * 2 + result[2] * 4 + result[3] * 8;
	const carry = result[4];

	test(
		`${a} + ${b} = ${expectedSum} (carry ${expectedCarry})`,
		sum === expectedSum && carry === expectedCarry,
		`sum=${expectedSum}, carry=${expectedCarry}`,
		`sum=${sum}, carry=${carry}`
	);
}

test4BitAdd(5, 3, 8, 0);
test4BitAdd(7, 8, 15, 0);
test4BitAdd(9, 7, 0, 1); // Overflow
test4BitAdd(15, 1, 0, 1); // Overflow

// ============================================================================
// D FLIP-FLOP TESTS
// ============================================================================
testSection("D FLIP-FLOP TESTS");

const dff = createDFlipFlop();

dff.setClock(0);
dff.tick([0]);
test("Initial state Q=0", dff.tick([0])[0] === 0, "0", dff.tick([0])[0]);

dff.setClock(1);
dff.tick([1]);
test("Rising edge with D=1 sets Q=1", dff.tick([1])[0] === 1, "1", dff.tick([1])[0]);

dff.setClock(1);
dff.tick([0]);
test("D changes but no edge, Q holds", dff.tick([0])[0] === 1, "1", dff.tick([0])[0]);

dff.setClock(0);
dff.tick([0]);
dff.setClock(1);
dff.tick([0]);
test("Rising edge with D=0 resets Q=0", dff.tick([0])[0] === 0, "0", dff.tick([0])[0]);

// ============================================================================
// T FLIP-FLOP TESTS
// ============================================================================
testSection("T FLIP-FLOP TESTS");

const tff = createTFlipFlop();

tff.setClock(0);
tff.tick([0]);
test("T-FF initial state Q=0", tff.tick([0])[0] === 0, "0", tff.tick([0])[0]);

tff.setClock(1);
tff.tick([1]);
test("T=1 rising edge toggles 0→1", tff.tick([1])[0] === 1, "1", tff.tick([1])[0]);

tff.setClock(0);
tff.tick([1]);
tff.setClock(1);
tff.tick([1]);
test("T=1 rising edge toggles 1→0", tff.tick([1])[0] === 0, "0", tff.tick([1])[0]);

tff.setClock(0);
tff.tick([0]);
tff.setClock(1);
tff.tick([0]);
test("T=0 rising edge holds Q", tff.tick([0])[0] === 0, "0", tff.tick([0])[0]);

// ============================================================================
// JK FLIP-FLOP TESTS
// ============================================================================
testSection("JK FLIP-FLOP TESTS");

const jkff = createJKFlipFlop();

jkff.setClock(0);
jkff.tick([0, 0]);
test("JK-FF initial state Q=0", jkff.tick([0, 0])[0] === 0, "0", jkff.tick([0, 0])[0]);

jkff.setClock(1);
jkff.tick([1, 0]);
test("J=1, K=0 sets Q=1", jkff.tick([1, 0])[0] === 1, "1", jkff.tick([1, 0])[0]);

jkff.setClock(0);
jkff.tick([0, 0]);
jkff.setClock(1);
jkff.tick([0, 0]);
test("J=0, K=0 holds Q=1", jkff.tick([0, 0])[0] === 1, "1", jkff.tick([0, 0])[0]);

jkff.setClock(0);
jkff.tick([0, 1]);
jkff.setClock(1);
jkff.tick([0, 1]);
test("J=0, K=1 resets Q=0", jkff.tick([0, 1])[0] === 0, "0", jkff.tick([0, 1])[0]);

jkff.setClock(0);
jkff.tick([1, 1]);
jkff.setClock(1);
jkff.tick([1, 1]);
test("J=1, K=1 toggles 0→1", jkff.tick([1, 1])[0] === 1, "1", jkff.tick([1, 1])[0]);

jkff.setClock(0);
jkff.tick([1, 1]);
jkff.setClock(1);
jkff.tick([1, 1]);
test("J=1, K=1 toggles 1→0", jkff.tick([1, 1])[0] === 0, "0", jkff.tick([1, 1])[0]);

// ============================================================================
// 2-TO-1 MULTIPLEXER TESTS
// ============================================================================
testSection("2-TO-1 MULTIPLEXER TESTS");

const mux2 = create2to1Mux();

test("Sel=0 selects I0=0", mux2.tick([0, 1, 0])[0] === 0, "0", mux2.tick([0, 1, 0])[0]);
test("Sel=0 selects I0=1", mux2.tick([1, 0, 0])[0] === 1, "1", mux2.tick([1, 0, 0])[0]);
test("Sel=1 selects I1=0", mux2.tick([1, 0, 1])[0] === 0, "0", mux2.tick([1, 0, 1])[0]);
test("Sel=1 selects I1=1", mux2.tick([0, 1, 1])[0] === 1, "1", mux2.tick([0, 1, 1])[0]);

// ============================================================================
// 4-TO-1 MULTIPLEXER TESTS
// ============================================================================
testSection("4-TO-1 MULTIPLEXER TESTS");

const mux4 = create4to1Mux();

test("S=00 selects I0", mux4.tick([1, 0, 0, 0, 0, 0])[0] === 1, "1", mux4.tick([1, 0, 0, 0, 0, 0])[0]);
test("S=01 selects I1", mux4.tick([0, 1, 0, 0, 1, 0])[0] === 1, "1", mux4.tick([0, 1, 0, 0, 1, 0])[0]);
test("S=10 selects I2", mux4.tick([0, 0, 1, 0, 0, 1])[0] === 1, "1", mux4.tick([0, 0, 1, 0, 0, 1])[0]);
test("S=11 selects I3", mux4.tick([0, 0, 0, 1, 1, 1])[0] === 1, "1", mux4.tick([0, 0, 0, 1, 1, 1])[0]);

// ============================================================================
// 2-TO-4 DECODER TESTS
// ============================================================================
testSection("2-TO-4 DECODER TESTS");

const decoder = create2to4Decoder();

test(
	"Input 00 activates O0",
	JSON.stringify(decoder.tick([0, 0])) === JSON.stringify([1, 0, 0, 0]),
	"[1,0,0,0]",
	decoder.tick([0, 0])
);

test(
	"Input 01 activates O1",
	JSON.stringify(decoder.tick([1, 0])) === JSON.stringify([0, 1, 0, 0]),
	"[0,1,0,0]",
	decoder.tick([1, 0])
);

test(
	"Input 10 activates O2",
	JSON.stringify(decoder.tick([0, 1])) === JSON.stringify([0, 0, 1, 0]),
	"[0,0,1,0]",
	decoder.tick([0, 1])
);

test(
	"Input 11 activates O3",
	JSON.stringify(decoder.tick([1, 1])) === JSON.stringify([0, 0, 0, 1]),
	"[0,0,0,1]",
	decoder.tick([1, 1])
);

// ============================================================================
// 4-BIT COUNTER TESTS
// ============================================================================
testSection("4-BIT COUNTER TESTS");

const counter = create4BitCounter();

counter.setClock(0);
counter.tick([1, 1]); // Reset
counter.setClock(1);
counter.tick([1, 1]);
test(
	"Counter after reset = 0",
	JSON.stringify(counter.tick([1, 0])) === JSON.stringify([0, 0, 0, 0]),
	"[0,0,0,0]",
	counter.tick([1, 0])
);

// Count to 3
counter.setClock(0);
counter.tick([1, 0]);
counter.setClock(1);
counter.tick([1, 0]);
counter.setClock(0);
counter.tick([1, 0]);
counter.setClock(1);
counter.tick([1, 0]);
counter.setClock(0);
counter.tick([1, 0]);
counter.setClock(1);
const count3 = counter.tick([1, 0]);
test("Counter counts to 3", JSON.stringify(count3) === JSON.stringify([1, 1, 0, 0]), "[1,1,0,0]", count3);

// Test hold
counter.setClock(0);
counter.tick([0, 0]);
counter.setClock(1);
const held = counter.tick([0, 0]);
test("Counter holds when disabled", JSON.stringify(held) === JSON.stringify([1, 1, 0, 0]), "[1,1,0,0]", held);

// ============================================================================
// SUMMARY
// ============================================================================
console.log(`\n${"=".repeat(70)}`);
console.log("TEST SUMMARY");
console.log("=".repeat(70));
console.log(`Total tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
	console.log("\n🎉 ALL TESTS PASSED! 🎉");
} else {
	console.log("\n⚠️  Some tests failed. Review output above.");
}
