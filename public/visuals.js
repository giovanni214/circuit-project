import { CircuitManager } from './new-visuals/circuit-manager.js';
import {createFullAdder} from "./examples/full-adder.js"

let font;
const manager = new CircuitManager();
let lastTapTime = 0;

// p5.js 2.0 BREAKING CHANGE: preload() is deprecated. 
// We now use an async setup() function.
window.setup = async function () {
    const container = document.getElementById('canvas-container');

    let cvs = createCanvas(container.offsetWidth, container.offsetHeight);
    cvs.parent(container);

    // The Safari Nuke
    cvs.style('touch-action', 'none');
    cvs.style('-webkit-touch-callout', 'none');
    cvs.style('-webkit-user-select', 'none');
    cvs.style('user-select', 'none');
    cvs.style('outline', 'none');
    cvs.style('-webkit-tap-highlight-color', 'transparent');

    // p5.js 2.0 requires loading functions to be awaited!
    font = await loadFont("/fonts/ttf/JetBrainsMono-SemiBold.ttf");
    textFont(font);

    manager.viewport.x = width / 2;
    manager.viewport.y = height / 2;

    manager.load("FullAdder");
    manager.stepSimulation();

    const observer = new ResizeObserver(() => {
        window.windowResized();
    });
    observer.observe(container);

    document.addEventListener('contextmenu', event => event.preventDefault());

    // The Safari Insurance Policy (Passive: False)
    document.addEventListener('touchstart', function () { }, { passive: false });
};

window.draw = function () {
    background(245);
    manager.draw(font);
};

// --- Unified Pointer Events (p5.js 2.0 Native) ---
// Because p5 2.0 uses the modern Pointer API, these mouse functions naturally 
// and perfectly handle touches without Safari swallowing them!

window.mousePressed = function () {
    if (touches.length > 0) {
        let currentTime = millis();
        // Double-tap logic
        if (currentTime - lastTapTime > 0 && currentTime - lastTapTime < 300) {
            manager.handleDoubleClick(mouseX, mouseY);
            lastTapTime = 0;
            return false;
        }
        lastTapTime = currentTime;
    }

    manager.handleMousePress(mouseX, mouseY);
    return false;
};

window.mouseDragged = function () {
    // We still intercept for the 2-finger zoom
    if (touches.length === 2) {
        manager.viewport.handleTouchZoom(touches);
        return false;
    }

    manager.handleMouseDrag(mouseX, mouseY);
    return false;
};

window.mouseReleased = function () {
    manager.handleMouseRelease();
    manager.viewport.endTouch();
    return false;
};

window.doubleClicked = function () {
    manager.handleDoubleClick(mouseX, mouseY);
    return false;
};

// --- Standard Keyboard & Scroll Events ---

window.keyPressed = function () {
    manager.handleKeyDown(key, keyCode);
    if (key === ' ' || key === 'Backspace') {
        return false;
    }
};

window.mouseWheel = function (event) {
    manager.viewport.handleZoom(event, mouseX, mouseY);
    return false;
};

window.windowResized = function () {
    const container = document.getElementById('canvas-container');
    resizeCanvas(container.offsetWidth, container.offsetHeight);
};