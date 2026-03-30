export class Sidebar {
    constructor(m) {
        this.m = m;
        this.isOpen = false;
        this.width = 260;
        this.currentX = -this.width; // Start off-screen
        this.hamburgerRect = { x: 15, y: 15, w: 40, h: 40 };
        this.scrollOffset = 0;

        // Define our Scratch-like categories
        this.categories = [
            {
                name: 'INPUTS', color: '#4CAF50', items: [
                    { label: 'Toggle Switch', type: 'INPUT' },
                    { label: 'Clock', type: 'CLOCK' }
                ]
            },
            {
                name: 'OUTPUTS', color: '#F44336', items: [
                    { label: 'Light Bulb', type: 'OUTPUT' },
                    { label: '7-Segment', type: 'SEGMENT_DISPLAY' }
                ]
            },
            {
                name: 'GATES', color: '#2196F3', items: [
                    { label: 'AND Gate', type: 'AND' },
                    { label: 'OR Gate', type: 'OR' },
                    { label: 'NOT Gate', type: 'NOT' },
                    { label: 'XOR Gate', type: 'XOR' }
                ]
            }
        ];

        // We will calculate item hitboxes dynamically during draw
        this.itemHitboxes = [];
    }

    draw(font) {
        // Smooth slide animation
        const targetX = this.isOpen ? 0 : -this.width;
        this.currentX += (targetX - this.currentX) * 0.2;

        push();
        // Reset transformations to draw strictly in screen-space (UI layer)
        resetMatrix();

        // 1. Draw Hamburger Button (always visible)
        fill(40);
        noStroke();
        rect(this.hamburgerRect.x, this.hamburgerRect.y, this.hamburgerRect.w, this.hamburgerRect.h, 5);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text('≡', this.hamburgerRect.x + this.hamburgerRect.w / 2, this.hamburgerRect.y + this.hamburgerRect.h / 2 - 2);

        // 2. Draw Sidebar Panel
        if (this.currentX > -this.width + 1) {
            fill(245, 245, 250, 240); // Slightly transparent
            stroke(200);
            strokeWeight(1);
            rect(this.currentX, 0, this.width, height);

            // Draw Categories and Items
            textFont(font);
            this.itemHitboxes = []; // Reset hitboxes for this frame
            let cursorY = 70 + this.scrollOffset; // Start below the hamburger menu

            for (const cat of this.categories) {
                // Category Header
                fill(cat.color);
                noStroke();
                rect(this.currentX, cursorY, this.width, 30);
                fill(255);
                textSize(14);
                textAlign(LEFT, CENTER);
                text(cat.name, this.currentX + 15, cursorY + 15);
                cursorY += 40;

                // Items
                for (const item of cat.items) {
                    const itemRect = { x: this.currentX + 15, y: cursorY, w: this.width - 30, h: 36 };

                    // Hover effect
                    const isHovered = mouseX >= itemRect.x && mouseX <= itemRect.x + itemRect.w &&
                        mouseY >= itemRect.y && mouseY <= itemRect.y + itemRect.h;

                    fill(isHovered ? 255 : 250);
                    stroke(isHovered ? cat.color : 220);
                    strokeWeight(1);
                    rect(itemRect.x, itemRect.y, itemRect.w, itemRect.h, 4);

                    fill(40);
                    noStroke();
                    textSize(13);
                    text(item.label, itemRect.x + 10, itemRect.y + itemRect.h / 2);

                    // Save hitbox for clicking
                    this.itemHitboxes.push({ ...itemRect, type: item.type, label: item.label, color: cat.color });
                    cursorY += 44;
                }
                cursorY += 10;
            }
        }

        // 3. Draw Dragged Ghost Component
        if (this.m.state === 'DRAGGING_NEW_COMP' && this.m.draggedItemInfo) {
            fill(this.m.draggedItemInfo.color);
            stroke(40);
            strokeWeight(2);
            rectMode(CENTER);
            rect(mouseX, mouseY, 60, 40, 5);
            fill(255);
            noStroke();
            textAlign(CENTER, CENTER);
            textSize(10);
            text(this.m.draggedItemInfo.label, mouseX, mouseY);
            rectMode(CORNER); // Reset
        }
        pop();
    }

    // Returns true if the UI intercepted the click
    checkHit(mx, my) {
        // Check Hamburger
        if (mx >= this.hamburgerRect.x && mx <= this.hamburgerRect.x + this.hamburgerRect.w &&
            my >= this.hamburgerRect.y && my <= this.hamburgerRect.y + this.hamburgerRect.h) {
            this.isOpen = !this.isOpen;
            return true;
        }

        // Check inside open sidebar
        if (this.isOpen && mx <= this.width) {
            for (const box of this.itemHitboxes) {
                if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
                    // Start dragging a new component!
                    this.m.state = 'DRAGGING_NEW_COMP';
                    this.m.draggedItemInfo = { type: box.type, label: box.label, color: box.color };
                    return true;
                }
            }
            return true; // Clicked empty space in sidebar, still intercept
        }
        return false;
    }
}