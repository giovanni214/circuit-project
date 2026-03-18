import { CircuitManager } from './new-visuals/circuit-manager.js';
import { createDFlipFlop } from "./examples/d-flip-flop.js"; 

let font;
const manager = new CircuitManager();

window.preload = function() {
    font = loadFont("/fonts/ttf/JetBrainsMono-SemiBold.ttf");
};

window.setup = function() {
    createCanvas(windowWidth, windowHeight);
    textFont(font);

    window.test = createDFlipFlop(); // ← TEST THE D-FLIP-FLOP CREATION FUNCTION

    // Spawn the D-Flip-Flop and test components
    manager.addComponent('CIRCUIT', 300, 200, createDFlipFlop());
    manager.addComponent('INPUT', 100, 180); // D
    manager.addComponent('OUTPUT', 500, 180); // Q
    manager.addComponent('OUTPUT', 500, 220); // Q-Not
};
// ... rest of sketch.js remains the same ...

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
    resizeCanvas(windowWidth, windowHeight);
};

