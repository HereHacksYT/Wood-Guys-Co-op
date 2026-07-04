// Basılı tutulan tüm tuşları hafızada tutacak obje
const activeKeys = {};

window.addEventListener('keydown', (e) => {
    activeKeys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    activeKeys[e.code] = false;
});

// Oyun döngüsü (Tick) içinde her karede bu fonksiyonu çağıracağız
export function handlePlayerControls(player1PhysicsBody, player2PhysicsBody) {
    // ---- 1. OYUNCU KONTROLLERİ (A - D - W) ----
    if (activeKeys['KeyA']) {
        // Sol tekerleğe geriye doğru tork veya kuvvet uygula
        player1PhysicsBody.angularVelocity.y = -5; 
    }
    if (activeKeys['KeyD']) {
        // Sağ tekerleğe ileri doğru kuvvet uygula
        player1PhysicsBody.angularVelocity.y = 5;
    }
    if (activeKeys['KeyW']) {
        // Silah sallama animasyonunu veya fiziğini tetikle
        player1WeaponStrike();
    }

    // ---- 2. OYUNCU KONTROLLERİ (Yön Tuşları) ----
    if (activeKeys['ArrowLeft']) {
        player2PhysicsBody.angularVelocity.y = -5;
    }
    if (activeKeys['ArrowRight']) {
        player2PhysicsBody.angularVelocity.y = 5;
    }
    if (activeKeys['ArrowUp']) {
        player2WeaponStrike();
    }
}

function player1WeaponStrike() {
    // 1. Oyuncunun elindeki kılıç/balta modeline fiziksel ivme kazandır
}

function player2WeaponStrike() {
    // 2. Oyuncunun elindeki kılıç/balta modeline fiziksel ivme kazandır
}
