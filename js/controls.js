// Oyuncuların anlık girdi durumları
export const inputs = {
    p1: { moveX: 0, jump: false },
    p2: { moveX: 0, jump: false }
};

// Klavye Desteği (Test için kalması iyi olur)
const activeKeys = {};
window.addEventListener('keydown', (e) => { activeKeys[e.code] = true; });
window.addEventListener('keyup', (e) => { activeKeys[e.code] = false; });

export function setupTouchControls() {
    // ---- OYUNCU 1 JOYSTICK ----
    setupJoystick('p1-joystick-zone', 'p1-joystick-stick', (x) => { inputs.p1.moveX = x; });
    document.getElementById('p1-action-btn').addEventListener('touchstart', () => { inputs.p1.jump = true; });
    document.getElementById('p1-action-btn').addEventListener('touchend', () => { inputs.p1.jump = false; });

    // ---- OYUNCU 2 JOYSTICK ----
    setupJoystick('p2-joystick-zone', 'p2-joystick-stick', (x) => { inputs.p2.moveX = x; });
    document.getElementById('p2-action-btn').addEventListener('touchstart', () => { inputs.p2.jump = true; });
    document.getElementById('p2-action-btn').addEventListener('touchend', () => { inputs.p2.jump = false; });
}

function setupJoystick(zoneId, stickId, callback) {
    const zone = document.getElementById(zoneId);
    const stick = document.getElementById(stickId);
    let startX = 0;

    zone.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    });

    zone.addEventListener('touchmove', (e) => {
        const touchX = e.touches[0].clientX;
        let deltaX = touchX - startX;
        
        // Sınırlandırma (-25px ile 25px arası)
        deltaX = Math.max(-25, Math.min(25, deltaX));
        stick.style.transform = `translateX(${deltaX}px)`;

        // Oransal değer üret (-1 ile 1 arası)
        callback(deltaX / 25);
    });

    zone.addEventListener('touchend', () => {
        stick.style.transform = `translate(0px, 0px)`;
        callback(0);
    });
}

export function handleControls(p1Body, p2Body) {
    const speed = 6;
    const jumpForce = 7;

    // ---- Oyuncu 1 Fizik Uygulama ----
    if (inputs.p1.moveX !== 0) {
        p1Body.velocity.x = inputs.p1.moveX * speed;
    } else if (activeKeys['KeyA']) {
        p1Body.velocity.x = -speed;
    } else if (activeKeys['KeyD']) {
        p1Body.velocity.x = speed;
    } else {
        p1Body.velocity.x = 0;
    }

    if ((inputs.p1.jump || activeKeys['KeyW']) && Math.abs(p1Body.velocity.y) < 0.05) {
        p1Body.velocity.y = jumpForce;
        inputs.p1.jump = false; // Sürekli zıplamayı engelle
    }

    // ---- Oyuncu 2 Fizik Uygulama ----
    if (inputs.p2.moveX !== 0) {
        p2Body.velocity.x = inputs.p2.moveX * speed;
    } else if (activeKeys['ArrowLeft']) {
        p2Body.velocity.x = -speed;
    } else if (activeKeys['ArrowRight']) {
        p2Body.velocity.x = speed;
    } else {
        p2Body.velocity.x = 0;
    }

    if ((inputs.p2.jump || activeKeys['ArrowUp']) && Math.abs(p2Body.velocity.y) < 0.05) {
        p2Body.velocity.y = jumpForce;
        inputs.p2.jump = false;
    }
}