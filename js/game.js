// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let groundMesh, dirtMesh, skyWallMesh;
let finishMesh; // Bitiş Kapısı Görseli

// Can Değerleri
let p1Health = 100, p2Health = 100;

// Oyun Durum Yönetimi
let isGameStarted = false;
let currentLevel = 1;
let modelsLoadedCount = 0;
let levelObjects = []; 
let enemies = [];

// Taşıma Modları
let p1CarryMode = false;
let p2CarryMode = false;

// Çarpışma Maskeleme Katmanları
const GROUP_PLAYER1 = 1 << 0;
const GROUP_PLAYER2 = 1 << 1;
const GROUP_STATIC = 1 << 2;
const GROUP_ENEMY = 1 << 3;

// Sesler
const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

// Kontroller verisi
const inputs = {
    p1: { moveX: 0, jump: false },
    p2: { moveX: 0, jump: false }
};
const activeKeys = {};

window.addEventListener('keydown', (e) => { activeKeys[e.code] = true; });
window.addEventListener('keyup', (e) => { activeKeys[e.code] = false; });

function checkModelsReady() {
    modelsLoadedCount++;
    if (modelsLoadedCount >= 2) {
        document.getElementById('loading-text').style.display = 'none';
        document.getElementById('play-btn').style.display = 'block';
    }
}

// --- INITIALIZATION ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3.5, 11);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(3, 12, 6);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Fizik Altyapısı
    world = new CANNON.World();
    world.gravity.set(0, -14, 0);

    // Ana Platform Zeminleri
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(25, 0.2, 3)) });
    groundBody.position.set(0, 0, 0);
    groundBody.collisionFilterGroup = GROUP_STATIC;
    groundBody.collisionFilterMask = GROUP_PLAYER1 | GROUP_PLAYER2 | GROUP_ENEMY;
    world.addBody(groundBody);

    const dirtBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(25, 1.5, 3)) });
    dirtBody.position.set(0, -1.7, 0);
    dirtBody.collisionFilterGroup = GROUP_STATIC;
    dirtBody.collisionFilterMask = GROUP_PLAYER1 | GROUP_PLAYER2 | GROUP_ENEMY;
    world.addBody(dirtBody);

    // Çevre Modelleri Doku Yüklemesi
    const textureLoader = new THREE.TextureLoader();
    const skyTex = textureLoader.load('assets/textures/images.jpeg');
    skyWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(50, 18), new THREE.MeshStandardMaterial({ map: skyTex, roughness: 0.6 }));
    skyWallMesh.position.set(0, 8, -4); 
    scene.add(skyWallMesh);

    const grassTex = textureLoader.load('assets/textures/aerial_grass_rock.png');
    grassTex.wrapS = THREE.RepeatWrapping; grassTex.repeat.set(5, 1);
    groundMesh = new THREE.Mesh(new THREE.BoxGeometry(50, 0.4, 6), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 }));
    groundMesh.position.y = 0; groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const dirtTex = textureLoader.load('assets/textures/rocky_trail_02.png');
    dirtTex.wrapS = THREE.RepeatWrapping; dirtTex.repeat.set(5, 0.5);
    dirtMesh = new THREE.Mesh(new THREE.BoxGeometry(50, 3, 6), new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.8 }));
    dirtMesh.position.y = -1.7; dirtMesh.receiveShadow = true;
    scene.add(dirtMesh);

    // Bitiş Kapısı Tasarımı (Finish Gate - Sağ uca yerleştirildi)
    const gateGroup = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.2, 3, 0.2);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
    
    const leftPost = new THREE.Mesh(postGeo, woodMat); leftPost.position.set(-1.5, 1.5, 0); gateGroup.add(leftPost);
    const rightPost = new THREE.Mesh(postGeo, woodMat); rightPost.position.set(1.5, 1.5, 0); gateGroup.add(rightPost);
    
    const boardGeo = new THREE.BoxGeometry(3.2, 0.8, 0.1);
    const boardMesh = new THREE.Mesh(boardGeo, woodMat); boardMesh.position.set(0, 2.6, 0); gateGroup.add(boardMesh);
    
    gateGroup.position.set(14, 0, 0); // Sağ taraftaki bitiş noktası koordinatı
    scene.add(gateGroup);
    finishMesh = gateGroup;

    // Oyuncu Gövdeleri
    p1Body = createPhysicsPlayer(-10, 2, 0);
    p2Body = createPhysicsPlayer(-8, 2, 0);
    updateCollisionFilters();

    const loader = new THREE.GLTFLoader();

    // Player 1 (Puppet) GLB Yükleme
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.rotation.y = Math.PI / 2; 
        p1Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        p1Mesh.position.y = -1.0; 
        scene.add(p1Mesh);
        checkModelsReady();
    }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        scene.add(p1Mesh); checkModelsReady();
    });

    // Player 2 (Soviet Robot) GLB Yükleme
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.scale.set(0.5, 0.5, 0.5);
        p2Mesh.rotation.y = Math.PI / 2;
        p2Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        p2Mesh.position.y = -1.0;
        scene.add(p2Mesh);
        checkModelsReady();
    }, undefined, () => {
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        scene.add(p2Mesh); checkModelsReady();
    });

    // Soviet Çatlak Duvar Kırma Tetikleyicisi
    p2Body.addEventListener('collide', (e) => {
        if(e.body && e.body.isCrackable) {
            hitSound.play().catch(()=>{});
            removeLevelObject(e.body);
        }
    });

    document.getElementById('play-btn').addEventListener('click', startGame);
    setupCarryButtons();
    setupTouchControls();
    window.addEventListener('resize', onWindowResize);
    buildLevel(1);
    animate();
}

// --- CO-OP İÇİNDEN GEÇME KONTROLLERİ ---
function updateCollisionFilters() {
    p1Body.collisionFilterGroup = GROUP_PLAYER1;
    p1Body.collisionFilterMask = GROUP_STATIC | GROUP_ENEMY | (p2CarryMode ? GROUP_PLAYER2 : 0);

    p2Body.collisionFilterGroup = GROUP_PLAYER2;
    p2Body.collisionFilterMask = GROUP_STATIC | GROUP_ENEMY | (p1CarryMode ? GROUP_PLAYER1 : 0);
}

function setupCarryButtons() {
    const btn1 = document.getElementById('p1-carry-btn');
    const btn2 = document.getElementById('p2-carry-btn');

    btn1.addEventListener('touchstart', (e) => {
        e.preventDefault();
        p1CarryMode = !p1CarryMode;
        btn1.innerText = p1CarryMode ? "TAŞI: ON" : "TAŞI: OFF";
        btn1.classList.toggle('active', p1CarryMode);
        updateCollisionFilters();
    });

    btn2.addEventListener('touchstart', (e) => {
        e.preventDefault();
        p2CarryMode = !p2CarryMode;
        btn2.innerText = p2CarryMode ? "TAŞI: ON" : "TAŞI: OFF";
        btn2.classList.toggle('active', p2CarryMode);
        updateCollisionFilters();
    });
}

// --- DİNAMİK CO-OP BÖLÜM KURUCU ---
function buildLevel(lvl) {
    levelObjects.forEach(obj => { scene.remove(obj.mesh); world.remove(obj.body); });
    levelObjects = [];
    enemies.forEach(en => { scene.remove(en.mesh); world.remove(en.body); });
    enemies = [];

    const loader = new THREE.GLTFLoader();

    if (lvl === 1) {
        // Bölüm 1: Soviet Kırılabilir Engeli
        const wallGeo = new THREE.BoxGeometry(1.2, 3.2, 4);
        const wallMesh = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0x7a6b58, roughness: 0.9 }));
        wallMesh.position.set(2, 1.6, 0); scene.add(wallMesh);

        const wallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.6, 1.6, 2)) });
        wallBody.position.set(2, 1.6, 0);
        wallBody.isCrackable = true;
        wallBody.collisionFilterGroup = GROUP_STATIC;
        wallBody.collisionFilterMask = GROUP_PLAYER1 | GROUP_PLAYER2;
        world.addBody(wallBody);

        levelObjects.push({ mesh: wallMesh, body: wallBody });

    } else if (lvl === 2) {
        // Bölüm 2: Yakındaki Oyuncuyu Seçen Akıllı Düşman (Zıplaması Kilitli)
        const enemyBody = new CANNON.Body({ mass: 5 });
        enemyBody.addShape(new CANNON.Box(new CANNON.Vec3(0.45, 1.1, 0.45)));
        enemyBody.position.set(1, 3, 0);
        enemyBody.fixedRotation = true; // Dönüp devrilmesini önler
        enemyBody.updateMassProperties();
        enemyBody.collisionFilterGroup = GROUP_ENEMY;
        enemyBody.collisionFilterMask = GROUP_STATIC | GROUP_PLAYER1 | GROUP_PLAYER2;
        world.addBody(enemyBody);

        loader.load('assets/models/puppet_1.glb', (gltf) => {
            const eMesh = gltf.scene;
            eMesh.traverse(c => {
                if(c.isMesh) {
                    c.material = c.material.clone();
                    c.material.color.setHex(0x13294b); // Belirgin Koyu Lacivert Düşman Tonu
                }
            });
            eMesh.position.y = -1.0; scene.add(eMesh);
            enemies.push({ mesh: eMesh, body: enemyBody });
        }, undefined, () => {
            const eMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0x13294b }));
            scene.add(eMesh); enemies.push({ mesh: eMesh, body: enemyBody });
        });

    } else if (lvl === 3) {
        // Bölüm 3: Sadece Kafa Kafaya Vererek Aşılabilen Büyük Duvar
        const highWallGeo = new THREE.BoxGeometry(1.5, 4.8, 5);
        const highWallMesh = new THREE.Mesh(highWallGeo, new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.7 }));
        highWallMesh.position.set(0, 2.4, 0); scene.add(highWallMesh);

        const highWallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.75, 2.4, 2.5)) });
        highWallBody.position.set(0, 2.4, 0);
        highWallBody.collisionFilterGroup = GROUP_STATIC;
        highWallBody.collisionFilterMask = GROUP_PLAYER1 | GROUP_PLAYER2;
        world.addBody(highWallBody);

        levelObjects.push({ mesh: highWallMesh, body: highWallBody });
    }
}

function removeLevelObject(body) {
    const index = levelObjects.findIndex(obj => obj.body === body);
    if(index !== -1) {
        scene.remove(levelObjects[index].mesh);
        world.remove(levelObjects[index].body);
        levelObjects.splice(index, 1);
    }
}

function startGame() {
    isGameStarted = true;
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('level-indicator').style.display = 'block';
    document.getElementById('p1-ui').style.display = 'block';
    document.getElementById('p2-ui').style.display = 'block';
    
    document.querySelectorAll('.joystick-zone, .action-btn, .carry-btn').forEach(el => el.style.display = 'block');

    if(p1Mesh) p1Mesh.rotation.y = Math.PI / 2;
    if(p2Mesh) p2Mesh.rotation.y = Math.PI / 2;
}

// --- BÖLÜM GEÇİŞ VE KONTROL SİSTEMİ ---
function checkLevelComplete() {
    // İki oyuncu birden kapıya (X: 14 koordinatına) yeterince yakın mı?
    const p1Dist = Math.abs(p1Body.position.x - finishMesh.position.x);
    const p2Dist = Math.abs(p2Body.position.x - finishMesh.position.x);

    if (p1Dist < 1.5 && p2Dist < 1.5) {
        currentLevel++;
        if(currentLevel > 3) currentLevel = 1; 
        document.getElementById('level-num').innerText = currentLevel;
        
        // Pozisyonları en sola çekerek sıfırla
        p1Body.position.set(-10, 3, 0); p1Body.velocity.set(0, 0, 0);
        p2Body.position.set(-8, 3, 0); p2Body.velocity.set(0, 0, 0);

        buildLevel(currentLevel);
    }
}

function damagePlayer(playerNum, amount) {
    if(playerNum === 1) {
        p1Health = Math.max(0, p1Health - amount);
        document.getElementById('p1-health').style.width = p1Health + "%";
    } else {
        p2Health = Math.max(0, p2Health - amount);
        document.getElementById('p2-health').style.width = p2Health + "%";
    }

    if(p1Health <= 0 || p2Health <= 0) {
        // Ölen olursa canları tazele ve bölüm başına at
        p1Health = 100; p2Health = 100;
        document.getElementById('p1-health').style.width = "100%";
        document.getElementById('p2-health').style.width = "100%";
        p1Body.position.set(-10, 3, 0); p2Body.position.set(-8, 3, 0);
    }
}

function createPhysicsPlayer(x, y, z) {
    const body = new CANNON.Body({ mass: 4 });
    body.addShape(new CANNON.Sphere(0.5), new CANNON.Vec3(0, -0.5, 0));
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.45, 0.6, 0.45)), new CANNON.Vec3(0, 0.4, 0));
    body.position.set(x, y, z);
    body.fixedRotation = true;
    body.updateMassProperties();
    world.addBody(body);
    return body;
}

// --- DENGE VE HAREKET KONTROLÜ ---
function handleGameControls() {
    if (!isGameStarted) return;

    // P1 Puppet Mekanikleri
    const p1Speed = 7;
    const p1JumpForce = 9.5; 

    if (inputs.p1.moveX !== 0) {
        p1Body.velocity.x = inputs.p1.moveX * p1Speed;
        if(p1Mesh) p1Mesh.rotation.y = inputs.p1.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
        p1Body.velocity.x = 0;
    }
    if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.02) {
        p1Body.velocity.y = p1JumpForce; inputs.p1.jump = false;
    }

    // P2 Soviet Robot Mekanikleri (Ağır ve Güçlü)
    const p2Speed = 4.8;
    const p2JumpForce = 5.5; 

    if (inputs.p2.moveX !== 0) {
        p2Body.velocity.x = inputs.p2.moveX * p2Speed;
        if(p2Mesh) p2Mesh.rotation.y = inputs.p2.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
        p2Body.velocity.x = 0;
    }
    if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.02) {
        p2Body.velocity.y = p2JumpForce; inputs.p2.jump = false;
    }

    // Haritadan Düşme Kontrolü
    if (p1Body.position.y < -5 || p2Body.position.y < -5) {
        p1Body.position.set(-10, 3, 0); p2Body.position.set(-8, 3, 0);
    }

    checkLevelComplete();
}

// --- DOKUNMATİK JOSTICK ALTYAPISI ---
function setupTouchControls() {
    setupSingleJoystick('p1-joystick-zone', 'p1-joystick-stick', (x) => { inputs.p1.moveX = x; });
    document.getElementById('p1-action-btn').addEventListener('touchstart', () => { inputs.p1.jump = true; });
    document.getElementById('p1-action-btn').addEventListener('touchend', () => { inputs.p1.jump = false; });

    setupSingleJoystick('p2-joystick-zone', 'p2-joystick-stick', (x) => { inputs.p2.moveX = x; });
    document.getElementById('p2-action-btn').addEventListener('touchstart', () => { inputs.p2.jump = true; });
    document.getElementById('p2-action-btn').addEventListener('touchend', () => { inputs.p2.jump = false; });
}

function setupSingleJoystick(zoneId, stickId, callback) {
    const zone = document.getElementById(zoneId);
    const stick = document.getElementById(stickId);
    if(!zone || !stick) return;
    let startX = 0;

    zone.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; });
    zone.addEventListener('touchmove', (e) => {
        let deltaX = e.touches[0].clientX - startX;
        deltaX = Math.max(-28, Math.min(28, deltaX));
        stick.style.transform = `translateX(${deltaX}px)`;
        callback(deltaX / 28);
    });
    zone.addEventListener('touchend', () => { stick.style.transform = `translate(0px,0px)`; callback(0); });
}

// --- ANA DÖNGÜ (ANIMATE) ---
function animate() {
    requestAnimationFrame(animate);

    if (isGameStarted) {
        world.step(1 / 60);
        handleGameControls();

        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 1.0; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 1.0; }

        // --- AKILLI DÜŞMAN YAPAY ZEKASI (EN YAKIN HEDEFİ SEÇME) ---
        enemies.forEach(en => {
            if(en.mesh && en.body) {
                en.mesh.position.copy(en.body.position);
                en.mesh.position.y -= 1.0;

                // İki oyuncuya olan mesafeyi ölç ve en yakın olanı seç
                const distToP1 = Math.abs(p1Body.position.x - en.body.position.x);
                const distToP2 = Math.abs(p2Body.position.x - en.body.position.x);
                const targetBody = (distToP1 < distToP2) ? p1Body : p2Body;
                const targetNum = (distToP1 < distToP2) ? 1 : 2;

                // Seçilen en yakın oyuncuya doğru yatay ilerleme (Zıplama engelli, Y hızı elenmedi)
                const diffX = targetBody.position.x - en.body.position.x;
                en.body.velocity.x = Math.sign(diffX) * 2.3; 
                en.mesh.rotation.y = en.body.velocity.x > 0 ? Math.PI / 2 : -Math.PI / 2;

                // Yakın temas hasar denetimi
                if(Math.abs(p1Body.position.x - en.body.position.x) < 0.8 && Math.abs(p1Body.position.y - en.body.position.y) < 1.2) damagePlayer(1, 0.4);
                if(Math.abs(p2Body.position.x - en.body.position.x) < 0.8 && Math.abs(p2Body.position.y - en.body.position.y) < 1.2) damagePlayer(2, 0.4);
            }
        });

    } else {
        if (p1Mesh) p1Mesh.rotation.y += 0.02;
        if (p2Mesh) p2Mesh.rotation.y += 0.02;
    }

    // Kamera Takip Mekanizması
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, midX, 0.05);
    camera.lookAt(midX, 2, 0);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;