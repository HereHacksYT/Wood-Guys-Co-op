const activeKeys = {};

window.addEventListener('keydown', (e) => {
    activeKeys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    activeKeys[e.code] = false;
});

export function handleControls(p1Body, p2Body) {
    const speed = 5;

    // Oyuncu 1: A ve D tuşları (Sağa-Sola İlerleme)
    if (activeKeys['KeyA']) p1Body.velocity.x = -speed;
    else if (activeKeys['KeyD']) p1Body.velocity.x = speed;
    else p1Body.velocity.x = 0;

    // Oyuncu 1: W tuşu (Zıplama / Saldırı)
    if (activeKeys['KeyW'] && Math.abs(p1Body.velocity.y) < 0.1) {
        p1Body.velocity.y = 8;
    }

    // Oyuncu 2: Sol ve Sağ Yön Tuşları
    if (activeKeys['ArrowLeft']) p2Body.velocity.x = -speed;
    else if (activeKeys['ArrowRight']) p2Body.velocity.x = speed;
    else p2Body.velocity.x = 0;

    // Oyuncu 2: Yukarı Yön Tuşu
    if (activeKeys['ArrowUp'] && Math.abs(p2Body.velocity.y) < 0.1) {
        p2Body.velocity.y = 8;
    }
}