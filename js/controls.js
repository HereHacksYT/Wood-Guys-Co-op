// ==========================================
// 🎮 ROBOT GUYS CO-OP - KONTROLLER
// ==========================================

// Global input nesnesi (game.js ile paylaşılacak)
const inputs = {
    p1: { moveX: 0, moveZ: 0, jump: false },
    p2: { moveX: 0, moveZ: 0, jump: false }
};

// --- KLAVYE KONTROLLERİ ---
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    // P1 Zıplama (Space)
    if (e.key === ' ') { e.preventDefault(); inputs.p1.jump = true; }
    // P2 Zıplama (Enter)
    if (e.key === 'Enter') { e.preventDefault(); inputs.p2.jump = true; }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Her frame'de klavye girişlerini işle (game.js'de çağrılacak)
function updateKeyboardInputs() {
    // P1: WASD
    let x1 = 0, z1 = 0;
    if (keys['w'] || keys['W']) z1 = -1;
    if (keys['s'] || keys['S']) z1 = 1;
    if (keys['a'] || keys['A']) x1 = -1;
    if (keys['d'] || keys['D']) x1 = 1;
    // Normalize et
    const len1 = Math.sqrt(x1*x1 + z1*z1);
    if (len1 > 0) { x1 /= len1; z1 /= len1; }
    inputs.p1.moveX = x1;
    inputs.p1.moveZ = z1;

    // P2: Ok tuşları
    let x2 = 0, z2 = 0;
    if (keys['ArrowUp']) z2 = -1;
    if (keys['ArrowDown']) z2 = 1;
    if (keys['ArrowLeft']) x2 = -1;
    if (keys['ArrowRight']) x2 = 1;
    const len2 = Math.sqrt(x2*x2 + z2*z2);
    if (len2 > 0) { x2 /= len2; z2 /= len2; }
    inputs.p2.moveX = x2;
    inputs.p2.moveZ = z2;
}

// --- DOKUNMATİK (MOBİL) JOYSTICK ---
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
                const normX = dx / 30;
                const normZ = dy / 30;
                inputs[playerKey].moveX = normX;
                inputs[playerKey].moveZ = normZ;
                break;
            }
        }
    });

    const endHandle = () => {
        stick.style.transform = 'translate(0px, 0px)';
        inputs[playerKey].moveX = 0;
        inputs[playerKey].moveZ = 0;
        delete activeTouches[zoneId];
    };
    zone.addEventListener('touchend', endHandle);
    zone.addEventListener('touchcancel', endHandle);
}

// Butonlar için (Zıplama)
function setupActionButton(btnId, playerKey) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        inputs[playerKey].jump = true;
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        // jump false yapmıyoruz, game.js'de sıfırlanacak
    });
}

// Tüm kontrolleri başlat
function initControls() {
    setupJoystick('p1-joystick-zone', 'p1-joystick-stick', 'p1');
    setupJoystick('p2-joystick-zone', 'p2-joystick-stick', 'p2');
    setupActionButton('p1-action-btn', 'p1');
    setupActionButton('p2-action-btn', 'p2');
}