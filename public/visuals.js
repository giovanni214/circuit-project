import { CircuitManager } from './new-visuals/circuit-manager.js';
import { createFullAdder } from "./examples/full-adder.js";

let font;
const manager = new CircuitManager();

window.preload = function () {
    font = loadFont("/fonts/ttf/JetBrainsMono-SemiBold.ttf");
};

window.setup = function () {
    const container = document.getElementById('canvas-container');

    // Initial creation
    createCanvas(container.offsetWidth, container.offsetHeight).parent(container);
    textFont(font);

    manager.viewport.x = width / 2;
    manager.viewport.y = height / 2;

    window.test = createFullAdder(); // ← TEST THE FULL-ADDER CREATION FUNCTION

    // Spawn the Full Adder and test components
    manager.addComponent('CIRCUIT', 0, 0, createFullAdder());
    manager.addComponent('INPUT', -200, 0); // A
    manager.addComponent('INPUT', -200, 40); // B
    manager.addComponent('INPUT', -200, 80); // Cin
    manager.addComponent('OUTPUT', 200, -40); // S
    manager.addComponent('OUTPUT', 200, 30); // Q-Not

    manager.stepSimulation();

    // NEW: Automatically sync canvas size whenever the container's layout settles or shifts
    const observer = new ResizeObserver(() => {
        window.windowResized();
    });
    observer.observe(container);
};

window.draw = function () {
    background(245);
    manager.draw(font);
};

window.mousePressed = function () {
    manager.handleMousePress(mouseX, mouseY);
};

window.mouseDragged = function () {
    manager.handleMouseDrag(mouseX, mouseY);
};

window.mouseReleased = function () {
    manager.handleMouseRelease();
};

window.doubleClicked = function () {
    manager.handleDoubleClick(mouseX, mouseY);
};

window.keyPressed = function () {
    manager.handleKeyDown(key, keyCode);

    // Prevent default browser behaviors for space and backspace
    if (key === ' ' || key === 'Backspace') {
        return false;
    }
};

window.mouseWheel = function (event) {
    manager.viewport.handleZoom(event, mouseX, mouseY);
    return false; // This disables the default browser scrolling!
};

window.windowResized = function () {
    const container = document.getElementById('canvas-container');
    resizeCanvas(container.offsetWidth, container.offsetHeight);
};

