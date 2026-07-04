const activeKeys = {};

window.addEventListener('keydown', (e) => {
    activeKeys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    activeKeys[e.code] = false;
});

export function handleControls(p1Body, p2Body) {
    const speed = 6;
    const jumpForce = 7;

    // ---- OYUNCU 1 (A - D - W) ----
    if (activeKeys['KeyA']) {
        p1Body.velocity.x = -speed;
    } else if (activeKeys['KeyD']) {
        p1Body.velocity.x = speed;
    } else {
        p1Body.velocity.x = 0;
    }

    if (activeKeys['KeyW'] && Math.abs(p1Body.velocity.y) < 0.05) {
        p1Body.velocity.y = jumpForce;
    }

    // ---- OYUNCU 2 (Yön Tuşları) ----
    if (activeKeys['ArrowLeft']) {
        p2Body.velocity.x = -speed;
    } else if (activeKeys['ArrowRight']) {
        p2Body.velocity.x = speed;
    } else {
        p2Body.velocity.x = 0;
    }

    if (activeKeys['ArrowUp'] && Math.abs(p2Body.velocity.y) < 0.05) {
        p2Body.velocity.y = jumpForce;
    }
}