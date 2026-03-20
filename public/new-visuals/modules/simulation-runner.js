// File: public/new-visuals/modules/simulation-runner.js

export class SimulationRunner {
    constructor(m) {
        this.m = m;
    }

    cascadeLogic() {
        const m = this.m;
        const passes = Math.max(m.components.length * 2, 16);
        for (let i = 0; i < passes; i++) {
            for (const wire of m.wires) wire.propagate();
            for (const comp of m.components) comp.updateLogic();
        }
    }

    stepSimulation() {
        this.cascadeLogic();
    }
}