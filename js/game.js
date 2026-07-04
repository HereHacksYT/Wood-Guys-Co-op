// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let groundMesh, dirtMesh, skyWallMesh;

// Ayrı Can Sistemleri
let p1Health = 100, p2Health = 100;

// Oyun Durumu ve Bölümler
let isGameStarted = false;
let currentLevel = 1;
let modelsLoadedCount = 0;
let levelObjects = []; // Bölüme özel nesneler
let enemies = [];

// Taşıma Modu Durumları
let p1CarryMode = false;
let p2CarryMode = false;

// Çarpışma Grupları (İçinden geçme mekaniği için)
const GROUP_PLAYER1 = 1 << 0;
const GROUP_PLAYER2 = 1 << 1;
const GROUP_STATIC = 1 << 2;
const GROUP_ENEMY = 1 << 3;

// Sesler
const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

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

// --- OYUN BAŞLANGICI ---
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

    // Fizik Dünyası
    world = new CANNON.World();
    world.gravity.set(0, -14, 0);

    // Zemin Tanımlamaları
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

    // Görseller
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

    // Oyuncu Fizik Gövdeleri
    p1Body = createPhysicsPlayer(-6, 2, 0);
    p2Body = createPhysicsPlayer(6, 2, 0);

    // Varsayılan Çarpışma Filtreleri: Normalde oyuncular birbirini es geçer (Maskede birbirleri yok)
    updateCollisionFilters();

    const loader = new THREE.GLTFLoader();

    // 1. OYUNCU (Puppet)
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

    // 2. OYUNCU (Soviet Robot)
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

    // Soviet Robot Duvar Kırma Algılayıcısı
    p2Body.addEventListener('collide', (e) => {
        if(e.body && e.body.isCrackable) {
            // Çatlak duvarı patlat
            hitSound.play().catch(()=>{});
            removeLevelObject(e.body);
        }
    });

    // Buton Dinleyicileri
    document.getElementById('play-btn').addEventListener('click', startGame);
    setupCarryButtons();

    setupTouchControls();
    window.addEventListener('resize', onWindowResize);
    buildLevel(1);
    animate();
}

// --- FİZİK FİLTRE GÜNCELLEME (İÇİNDEN GEÇME MANTIĞI) ---
function updateCollisionFilters() {
    // P1 Filtresi
    p1Body.collisionFilterGroup = GROUP_PLAYER1;
    // Eğer P2 taşı modundaysa P1 ona çarpabilir, değilse içinden geçer
    p1Body.collisionFilterMask = GROUP_STATIC | GROUP_ENEMY | (p2CarryMode ? GROUP_PLAYER2 : 0);

    // P2 Filtresi
    p2Body.collisionFilterGroup = GROUP_PLAYER2;
    // Eğer P1 taşı modundaysa P2 ona çarpabilir, değilse içinden geçer
    p2Body.collisionFilterMask = GROUP_STATIC | GROUP_ENEMY | (p1CarryMode ? GROUP_PLAYER1 : 0);
}

// --- TAŞI BUTONLARI TETİKLEME ---
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

// --- BÖLÜM TASARIMLARI (DÜŞMAN VE ENGELLER) ---
function buildLevel(lvl) {
    // Eski objeleri temizle
    levelObjects.forEach(obj => {
        scene.remove(obj.mesh);
        world.remove(obj.body);
    });
    levelObjects = [];
    enemies.forEach(en => {
        scene.remove(en.mesh);
        world.remove(en.body);
    });
    enemies = [];

    const loader = new THREE.GLTFLoader();

    if (lvl === 1) {
        // --- BÖLÜM 1: SOVIET İÇİN ÇATLAK DUVAR ---
        const wallGeo = new THREE.BoxGeometry(1, 3, 4);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b7e66, roughness: 0.9, wireframe: false });
        // Dokuda çatlak hissi yaratmak için basit çizgili materyal yardımı
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.set(0, 1.5, 0);
        scene.add(wallMesh);

        const wallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.5, 1.5, 2)) });
        wallBody.position.set(0, 1.5, 0);
        wallBody.isCrackable = true; // Kırılabilir işareti
        wallBody.collisionFilterGroup = GROUP_STATIC;
        wallBody.collisionFilterMask = GROUP_PLAYER1 | GROUP_PLAYER2;
        world.addBody(wallBody);

        levelObjects.push({ mesh: wallMesh, body: wallBody });

    } else if (lvl === 2) {
        // --- BÖLÜM 2: DÜŞMAN PUPPET (MAVİ) ---
        // Yolun ortasına bir tane yapay zeka düşman atıyoruz
        const enemyBody = new CANNON.Body({ mass: 2 });
        enemyBody.addShape(new CANNON.Box(new CANNON.Vec3(0.4, 1, 0.4)));
        enemyBody.position.set(0, 3, 0);
        enemyBody.collisionFilterGroup = GROUP_ENEMY;
        enemyBody.collisionFilterMask = GROUP_STATIC | GROUP_PLAYER1 | GROUP_PLAYER2;
        world.addBody(enemyBody);

        loader.load('assets/models/puppet_1.glb', (gltf) => {
            const eMesh = gltf.scene;
            // Düşmanı ayırt etmek için Koyu Mavi yapıyoruz
            eMesh.traverse(c => {
                if(c.isMesh) {
                    c.material = c.material.clone();
                    c.material.color.setHex(0x0a192f); // Gece mavisi / Koyu düşman rengi
                }
            });
            eMesh.position.y = -1.0;
            scene.add(eMesh);
            enemies.push({ mesh: eMesh, body: enemyBody, dir: 1 });
        }, undefined, () => {
            const eMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ color: 0x0a192f }));
            scene.add(eMesh);
            enemies.push({ mesh: eMesh, body: enemyBody, dir: 1 });
        });

    } else if (lvl === 3) {
        // --- BÖLÜM 3: TAKIM ÇALIŞMASI (YÜKSEK DUVAR) ---
        // Sadece üst üste çıkılarak (TAŞI moduyla) geçilebilen yüksek engel
        const highWallGeo = new THREE.BoxGeometry(1.5, 5, 5);
        const highWallMesh = new THREE.Mesh(highWallGeo, new THREE.MeshStandardMaterial({ color: 0x4a4a4a }));
        highWallMesh.position.set(0, 2.5, 0);
        scene.add(highWallMesh);

        const highWallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.75, 2.5, 2.5)) });
        highWallBody.position.set(0, 2.5, 0);
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

// --- OYUNU BAŞLATMA ---
function startGame() {
    isGameStarted = true;
    document.getElementById('menu-container').style.display = 'none';
    
    document.getElementById('level-indicator').style.display = 'block';
    document.getElementById('ui-container').style.display = 'block';
    
    const controls = document.querySelectorAll('.joystick-zone, .action-btn, .carry-btn');
    controls.forEach(el => el.style.display = 'block');

    if(p1Mesh) p1Mesh.rotation.y = Math.PI / 2;
    if(p2Mesh) p2Mesh.rotation.y = Math.PI / 2;
}

function nextLevel() {
    currentLevel++;
    if(currentLevel > 3) currentLevel = 1; // 3 bölümden sonra başa döner
    document.getElementById('level-num').innerText = currentLevel;
    
    p1Body.position.set(-6, 3, 0); p1Body.velocity.set(0, 0, 0);
    p2Body.position.set(6, 3, 0); p2Body.velocity.set(0, 0, 0);

    buildLevel(currentLevel);
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
        // Can biterse bölümü yeniden başlat
        p1Health = 100; p2Health = 100;
        document.getElementById('p1-health').style.width = "100%";
        document.getElementById('p2-health').style.width = "100%";
        currentLevel--; 
        nextLevel();
    }
}

// --- FİZİKSEL GÖVDE OLUŞTURUCU ---
function createPhysicsPlayer(x, y, z) {
    const body = new CANNON.Body({ mass: 4 });
    const sphereShape = new CANNON.Sphere(0.5);
    body.addShape(sphereShape, new CANNON.Vec3(0, -0.5, 0));
    const boxShape = new CANNON.Box(new CANNON.Vec3(0.45, 0.6, 0.45));
    body.addShape(boxShape, new CANNON.Vec3(0, 0.4, 0));
    body.position.set(x, y, z);
    body.fixedRotation = true;
    body.updateMassProperties();
    world.addBody(body);
    return body;
}

// --- HAREKET KONTROLLERİ ---
function handleGameControls() {
    if (!isGameStarted) return;

    // Oyuncu 1 (Puppet) Denge Ayarları
    const p1Speed = 7;
    const p1JumpForce = 9.5; // Daha yüksek zıplama gücü verildi!

    if (inputs.p1.moveX !== 0) {
        p1Body.velocity.x = inputs.p1.moveX * p1Speed;
        if(p1Mesh) p1Mesh.rotation.y = inputs.p1.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
        p1Body.velocity.x = 0;
    }

    if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.02) {
        p1Body.velocity.y = p1JumpForce;
        inputs.p1.jump = false;
    }

    // Oyuncu 2 (Soviet Robot) Denge Ayarları
    const p2Speed = 4.8; // Daha da yavaşlatıldı (Ağır kütle hissi)
    const p2JumpForce = 5.5; // Zıplama gücü düşürüldü!

    if (inputs.p2.moveX !== 0) {
        p2Body.velocity.x = inputs.p2.moveX * p2Speed;
        if(p2Mesh) p2Mesh.rotation.y = inputs.p2.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
        p2Body.velocity.x = 0;
    }

    if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.02) {
        p2Body.velocity.y = p2JumpForce;
        inputs.p2.jump = false;
    }

    // Dünyadan aşağı düşme kontrolü
    if (p1Body.position.y < -5 || p2Body.position.y < -5) {
        nextLevel();
    }
}

// --- DOKUNMATİK JOSTICK KURULUMLARI ---
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
        const touchX = e.touches[0].clientX;
        let deltaX = touchX - startX;
        deltaX = Math.max(-28, Math.min(28, deltaX));
        stick.style.transform = `translateX(${deltaX}px)`;
        callback(deltaX / 28);
    });
    zone.addEventListener('touchend', () => { stick.style.transform = `translate(0px,0px)`; callback(0); });
}

// --- MOTOR DÖNGÜSÜ ---
function animate() {
    requestAnimationFrame(animate);

    if (isGameStarted) {
        world.step(1 / 60);
        handleGameControls();

        // Model senkronizasyonu (0.1 yükseltilmiş tam basma konumu)
        if (p1Mesh) { 
            p1Mesh.position.x = p1Body.position.x;
            p1Mesh.position.z = p1Body.position.z;
            p1Mesh.position.y = p1Body.position.y - 1.0; 
        }
        if (p2Mesh) { 
            p2Mesh.position.x = p2Body.position.x;
            p2Mesh.position.z = p2Body.position.z;
            p2Mesh.position.y = p2Body.position.y - 1.0; 
        }

        // --- YAPAY ZEKA DÜŞMAN HAREKETLERİ (Bölüm 2) ---
        enemies.forEach(en => {
            if(en.mesh && en.body) {
                en.mesh.position.x = en.body.position.x;
                en.mesh.position.y = en.body.position.y - 1.0;
                en.mesh.position.z = en.body.position.z;

                // Basit yapay zeka: En yakın oyuncuya doğru yürür
                const targetX = p1Body.position.x; 
                const diffX = targetX - en.body.position.x;
                en.body.velocity.x = Math.sign(diffX) * 2.5;
                en.mesh.rotation.y = en.body.velocity.x > 0 ? Math.PI / 2 : -Math.PI / 2;

                // Oyuncuya çok yaklaşırsa can azaltma
                if(Math.abs(p1Body.position.x - en.body.position.x) < 0.8) damagePlayer(1, 0.5);
                if(Math.abs(p2Body.position.x - en.body.position.x) < 0.8) damagePlayer(2, 0.5);
            }
        });

    } else {
        // Menüde dönme animasyonu
        if (p1Mesh) p1Mesh.rotation.y += 0.02;
        if (p2Mesh) p2Mesh.rotation.y += 0.02;
    }

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