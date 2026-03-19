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

    manager.load("FullAdder");
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

// In your global scope where CircuitManager is instantiated (e.g., let manager = new CircuitManager())

function touchStarted() {
    // Map p5 touch structure to simple x,y for the manager
    const t = touches.map(p => ({ x: p.x, y: p.y }));
    manager.handleTouchStart(t);
}

function touchMoved() {
    const t = touches.map(p => ({ x: p.x, y: p.y }));
    manager.handleTouchMove(t);
    return false; // Critical: stops the "pull-to-refresh" on Chrome/Safari
}

function touchEnded() {
    manager.handleTouchEnd();
}
