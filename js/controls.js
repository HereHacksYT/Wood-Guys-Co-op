// ==========================================
// 🎮 ROBOT GUYS CO-OP - KONTROLLER
// ==========================================

const inputs = {
    p1: { moveX: 0, moveZ: 0, jump: false },
    p2: { moveX: 0, moveZ: 0, jump: false }
};

// --- KLAVYE ---
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ') { e.preventDefault(); inputs.p1.jump = true; }
    if (e.key === 'Enter') { e.preventDefault(); inputs.p2.jump = true; }
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

function updateKeyboardInputs() {
    // P1: A/D (sağ-sol)
    let x1 = 0;
    if (keys['a'] || keys['A']) x1 = -1;
    if (keys['d'] || keys['D']) x1 = 1;
    inputs.p1.moveX = x1;

    // P2: Ok tuşları (sağ-sol)
    let x2 = 0;
    if (keys['ArrowLeft']) x2 = -1;
    if (keys['ArrowRight']) x2 = 1;
    inputs.p2.moveX = x2;
}

// --- DOKUNMATİK JOYSTICK ---
let activeTouches = {};

function setupJoystick(zoneId, stickId, playerKey) {
    const zone = document.getElementById(zoneId);
    const stick = document.getElementById(stickId);
    if (!zone || !stick) return;

    zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        activeTouches[zoneId] = { id: t.identifier, x: t.clientX, y: t.clientY };
    });

    zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const tData = activeTouches[zoneId];
        if (!tData) return;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === tData.id) {
                let dx = e.touches[i].clientX - tData.x;
                let dy = e.touches[i].clientY - tData.y;
                const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 30);
                const angle = Math.atan2(dy, dx);
                dx = Math.cos(angle) * dist;
                dy = Math.sin(angle) * dist;
                stick.style.transform = `translate(${dx}px, ${dy}px)`;
                // Sadece X eksenini kullan (sağ-sol)
                inputs[playerKey].moveX = dx / 30;
                break;
            }
        }
    });

    const endHandle = () => {
        stick.style.transform = 'translate(0px, 0px)';
        inputs[playerKey].moveX = 0;
        delete activeTouches[zoneId];
    };
    zone.addEventListener('touchend', endHandle);
    zone.addEventListener('touchcancel', endHandle);
}

function setupActionButton(btnId, playerKey) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        inputs[playerKey].jump = true;
    });
}

function initControls() {
    setupJoystick('p1-joystick-zone', 'p1-joystick-stick', 'p1');
    setupJoystick('p2-joystick-zone', 'p2-joystick-stick', 'p2');
    setupActionButton('p1-action-btn', 'p1');
    setupActionButton('p2-action-btn', 'p2');
}