import {
    InputNode, ClockNode, FeedbackNode,
    GateNode, CompositeNode, SubCircuitOutputNode,
} from '../lib/nodes.js';

/**
 * Normalize every node's child-input convention into one array.
 */
function getChildNodes(node) {
    const children = [];
    if (node.inputNodes) children.push(...node.inputNodes);
    if (node.inputs) children.push(...node.inputs);
    if (node.inputNode) children.push(node.inputNode);
    if (node.compositeNode) children.push(node.compositeNode);
    return children;
}

export function collectNodes(rootNodes) {
    const all = new Set();
    const queue = [...rootNodes];
    while (queue.length > 0) {
        const node = queue.shift();
        if (all.has(node)) continue;
        all.add(node);
        for (const child of getChildNodes(node)) {
            if (!all.has(child)) queue.push(child);
        }
    }
    return all;
}

export function assignLayers(rootNodes, allNodes) {
    const layer = new Map();

    const visit = (node, depth) => {
        if (!layer.has(node) || layer.get(node) < depth) {
            layer.set(node, depth);
        } else {
            return;
        }
        for (const child of getChildNodes(node)) {
            visit(child, depth - 1);
        }
    };

    for (const root of rootNodes) visit(root, 0);

    const min = Math.min(...layer.values());
    const normalized = new Map();
    for (const [node, l] of layer) normalized.set(node, l - min);
    return normalized;
}

export function layoutNodes(layers, gridSize) {
    const byLayer = new Map();
    for (const [node, l] of layers) {
        if (!byLayer.has(l)) byLayer.set(l, []);
        byLayer.get(l).push(node);
    }

    const colSpacing = gridSize * 9;
    const rowSpacing = gridSize * 6;
    const positions = new Map();

    for (const [l, nodes] of byLayer) {
        const x = 120 + l * colSpacing;
        const totalH = (nodes.length - 1) * rowSpacing;
        nodes.forEach((node, i) => {
            positions.set(node, { x, y: 200 + i * rowSpacing - totalH / 2 });
        });
    }

    return positions;
}

export function nodeLabel(node) {
    // 1. Always prioritize the explicit human-readable name if it exists!
    if (node.name) {
        // NEW: If it's a SubCircuitOutputNode, show origin
        if (node instanceof SubCircuitOutputNode && node.compositeNode) {
            const originName = node.compositeNode.name || node.compositeNode.subCircuit.name;
            return `${originName}\n(${node.name})`;
        }

        // NEW: If it's a GateNode, show Gate Type + Instance Name
        if (node instanceof GateNode) {
            return `${node.gateType} Gate\n(${node.name})`;
        }

        return node.name;
    }

    // 2. Generic fallbacks for basic types
    if (node instanceof InputNode) return `INPUT ${node.index}`;
    if (node instanceof ClockNode) return 'CLK';
    if (node instanceof FeedbackNode) return 'MEM';
    if (node instanceof GateNode) return node.gateType ?? 'GATE';

    // 3. Fallback for Output Nodes if name is missing
    if (node instanceof SubCircuitOutputNode) {
        const parentName = node.compositeNode?.name || "COMP";
        return `${parentName}\nOUT[${node.outputIndex}]`;
    }

    if (node instanceof CompositeNode) return node.name || node.subCircuit.name || 'COMP';

    return 'NODE';
}

export function nodeKind(node) {
    if (node instanceof InputNode) return 'GRAPH_INPUT';
    if (node instanceof ClockNode) return 'GRAPH_CLOCK';
    if (node instanceof FeedbackNode) return 'GRAPH_FEEDBACK';
    if (node instanceof GateNode) return 'GRAPH_GATE';
    if (node instanceof SubCircuitOutputNode) return 'GRAPH_SUBCIRCUIT_OUTPUT';
    if (node instanceof CompositeNode) return 'GRAPH_COMPOSITE';
    return 'GRAPH_NODE';
}