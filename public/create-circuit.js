// Create the D Flip-Flop

// D input is at index=0 (the user input array)
const D = new InputNode(0);

// We'll read the clock from the Circuit's .clock property
const CLK = new ClockNode();

// We'll need a NOT gate for the inverted clock
const notCLK = new GateNode("NOT", [CLK], 0);

// --------------- MASTER LATCH ---------------
// Qm_next = (D AND CLK) OR (Qm AND NOT CLK)

// We'll store the master output in a feedback node (Qm)
const masterFeedback = new FeedbackNode(
  /* inputNode= */ null,
  /* initial= */ 0,
  /* delay= */ 0
);

// Two partial terms:
const masterTerm1 = new GateNode("AND", [D, CLK], 0);
const masterTerm2 = new GateNode("AND", [masterFeedback, notCLK], 0);
// Combine with OR
const masterOR = new GateNode("OR", [masterTerm1, masterTerm2], 0);

// The master feedback node sees masterOR as input
masterFeedback.inputNode = masterOR;

// --------------- SLAVE LATCH ---------------
// Q_next = (Qm AND NOT CLK) OR (Q AND CLK)
const slaveFeedback = new FeedbackNode(null, 0, 0);
const slaveTerm1 = new GateNode("AND", [masterFeedback, notCLK], 0);
const slaveTerm2 = new GateNode("AND", [slaveFeedback, CLK], 0);
const slaveOR = new GateNode("OR", [slaveTerm1, slaveTerm2], 0);

slaveFeedback.inputNode = slaveOR;

// --------------- BUILD THE CIRCUIT ---------------
const dFlipFlop = new Circuit("D-FlipFlop (multi-delta)", [
  masterFeedback,
  slaveFeedback,
]);

// Register basic gates
dFlipFlop.registerGate("AND", (inputs) => Number(inputs[0] && inputs[1]));
dFlipFlop.registerGate("OR", (inputs) => Number(inputs[0] || inputs[1]));
dFlipFlop.registerGate("NOT", (inputs) => Number(!inputs[0]));

// Register feedback nodes
dFlipFlop.registerFeedbackNode(masterFeedback);
dFlipFlop.registerFeedbackNode(slaveFeedback);

// Let's do a small helper to print the output
function printState(step, clk, d, q) {
  console.log(`Step=${step}, CLK=${clk}, D=${d}, OUTPUT:[${q.toString()}]`);
}

// Start with CLK=0, D=0
dFlipFlop.setClock(0);
let out = dFlipFlop.tick([0]); // Evaluate with D=0
printState(1, dFlipFlop.getClock(), 0, out);

// Now set D=1, keep CLK=0 => no immediate change in Q
// But the master latch sees D=1 *only* when CLK=1
out = dFlipFlop.tick([1]);
printState(2, dFlipFlop.getClock(), 1, out);

// Next, set CLK=1 => master latch will capture D=1
// but slave latch still sees old data, so Q might remain 0 *until* we go CLK=0 again
dFlipFlop.setClock(1);
out = dFlipFlop.tick([1]);
printState(3, dFlipFlop.getClock(), 1, out);

// Now set CLK=0 => slave latch "opens" and takes the master’s data => Q=1
dFlipFlop.setClock(0);
out = dFlipFlop.tick([1]);
printState(4, dFlipFlop.getClock(), 1, out);

// Another cycle: We'll keep D=1, toggle CLK high again => Q should remain 1, etc.
dFlipFlop.setClock(1);
out = dFlipFlop.tick([0]);
printState(5, dFlipFlop.getClock(), 0, out);

dFlipFlop.setClock(0);
out = dFlipFlop.tick([1]);
printState(6, dFlipFlop.getClock(), 1, out);
