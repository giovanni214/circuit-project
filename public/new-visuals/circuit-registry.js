const registry = new Map();

export const CircuitRegistry = {
    save(name, factory) {
        registry.set(name, factory);
        console.log(`[Registry] Saved circuit: "${name}"`);
    },

    load(name) {
        return registry.get(name) ?? null;
    },

    list() {
        return [...registry.keys()];
    },

    has(name) {
        return registry.has(name);
    },

    delete(name) {
        registry.delete(name);
    }
};