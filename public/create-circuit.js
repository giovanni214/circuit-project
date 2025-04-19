// OR‐gate over N inputs
function OR_FUNC(inputs) {
	const result = inputs.reduce((acc, bit) => acc | bit, 0);
	return result;
}

// AND‐gate over N inputs
function AND_FUNC(inputs) {
	const result = inputs.reduce((acc, bit) => acc & bit, 1);
	return result;
}

// NOT‐gate (expects exactly one input)
function NOT_FUNC(input) {
	if (input.length !== 1) {
		throw new Error("NOT gate requires exactly one input");
	}
	return input[0] ? 0 : 1;
}

const a = new InputNode(0);
const b = new InputNode(1);
const c = new InputNode(2);

const notA = new GateNode("NOT", [a]);
const notB = new GateNode("NOT", [b]);
const notC = new GateNode("NOT", [c]);

const exp1 = new GateNode("AND", [a, b, notC]);
const exp2 = new GateNode("AND", [a, notB, notC]);
const exp3 = new GateNode("AND", [notA, b, c]);
const exp4 = new GateNode("AND", [notA, b, notC]);

const combined = new GateNode("OR", [exp1, exp2, exp3, exp4]);

const circuit = new Circuit("mystery", [combined]);
circuit.registerGate("OR", OR_FUNC);
circuit.registerGate("NOT", NOT_FUNC);
circuit.registerGate("AND", AND_FUNC);

const table = circuit.simplify();
console.log(table);
