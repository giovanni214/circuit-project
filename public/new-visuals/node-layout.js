export function nodeLabel(node) {
    // 1. Always prioritize the explicit human-readable name if it exists!
    if (node.name) return node.name;

    // 2. Generic fallbacks just in case
    if (node instanceof InputNode) return `INPUT ${node.index}`;
    if (node instanceof ClockNode) return 'CLK';
    if (node instanceof FeedbackNode) return 'MEM';
    if (node instanceof GateNode) return node.gateType ?? 'GATE';

    if (node instanceof SubCircuitOutputNode) {
        return `${node.compositeNode.subCircuit.name}[${node.outputIndex}]`;
    }

    if (node instanceof CompositeNode) return node.subCircuit.name ?? 'COMP';

    return 'NODE';
}