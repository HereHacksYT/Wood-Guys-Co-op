// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let groundMesh, dirtMesh, skyWallMesh;
let finishMesh; 

let p1Health = 100, p2Health = 100;
let isGameStarted = false;
let currentLevel = 1;
let modelsLoadedCount = 0;
let levelObjects = []; 
let enemies = [];

// Hasar kontrolü için zamanlayıcılar (Saniyede en fazla 1 kez hasar alması için)
let p1LastDamageTime = 0;
let p2LastDamageTime = 0;

// Oyuncuların bitiş durum takipleri
let p1InsideFinish = false;
let p2InsideFinish = false;

let p1CarryMode = false;
let p2CarryMode = false;

const GROUP_PLAYER1 = 1 << 0;
const GROUP_PLAYER2 = 1 << 1;
const GROUP_STATIC = 1 << 2;
const GROUP_ENEMY = 1 << 3;

const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

const inputs = {
    p1: { moveX: 0, jump: false },
    p2: { moveX: 0, jump: false }
};

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

    // --- SOVIET ROBOTUN SÜRTÜNME SORUNUNUN ÇÖZÜMÜ ---
    // Sıfır sürtünmeli materyaller oluşturup dünyaya tanımlıyoruz
    const zeroFrictionMaterial = new CANNON.Material("zeroFriction");
    const contactMaterial = new CANNON.ContactMaterial(
        zeroFrictionMaterial,
        zeroFrictionMaterial,
        { friction: 0.0, restitution: 0.1 } // Sürtünmeyi tamamen sıfırladık
    );
    world.addContactMaterial(contactMaterial);

    // Ana Platform Zeminleri (Sürtünmesiz Materyal Atandı)
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(25, 0.2, 3)), material: zeroFrictionMaterial });
    groundBody.position.set(0, 0, 0);
    groundBody.collisionFilterGroup = GROUP_STATIC;
    groundBody.collisionFilterMask = GROUP_PLAYER1 | GROUP_PLAYER2 | GROUP_ENEMY;
    world.addBody(groundBody);

    const dirtBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(25, 1.5, 3)), material: zeroFrictionMaterial });
    dirtBody.position.set(0, -1.7, 0);
    dirtBody.collisionFilterGroup = GROUP_STATIC;
    dirtBody.collisionFilterMask = GROUP_PLAYER1 | GROUP_PLAYER2 | GROUP_ENEMY;
    world.addBody(dirtBody);

    // Çevre Görselleri
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

    // Bitiş Kapısı Tasarımı (Karakterler gibi YAN duracak şekilde rotation ayarlandı)
    const gateGroup = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.2, 3, 0.2);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
    
    const leftPost = new THREE.Mesh(postGeo, woodMat); leftPost.position.set(-1.2, 1.5, 0); gateGroup.add(leftPost);
    const rightPost = new THREE.Mesh(postGeo, woodMat); rightPost.position.set(1.2, 1.5, 0); gateGroup.add(rightPost);
    
    const boardGeo = new THREE.BoxGeometry(2.6, 0.8, 0.1);
    const boardMesh = new THREE.Mesh(boardGeo, woodMat); boardMesh.position.set(0, 2.6, 0); gateGroup.add(boardMesh);
    
    gateGroup.position.set(14, 0, 0);
    gateGroup.rotation.y = 0; // Karakterlerle aynı hizada yan profil durması sağlandı
    scene.add(gateGroup);
    finishMesh = gateGroup;

    // Oyuncu Gövdeleri (Sürtünmesiz Materyal Atandı)
    p1Body = createPhysicsPlayer(-10, 2, 0, zeroFrictionMaterial);
    p2Body = createPhysicsPlayer(-8, 2, 0, zeroFrictionMaterial);
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

    p2Body.addEventListener('collide', (e) => {
        if(e.body && e.body.isCrackable) {
            hitSound.play().catch(()=>{});
            removeLevelObject(e.body);
        }
    });

    document.getElementById('play-btn').addEventListener('click', startGame);
    setupCarryButtons();
    setupTouchControls();
    setupExitButtons();
    window.addEventListener('resize', onWindowResize);
    buildLevel(1);
    animate();
}

function updateCollisionFilters() {
    // DÜŞMANIN İÇİNDEN GEÇEBİLME AYARI:
    // Maske listesinden GROUP_ENEMY çıkartıldı! Böylece oyuncular düşmana fiziksel olarak çarpmayacak, içinden geçebilecek.
    p1Body.collisionFilterGroup = GROUP_PLAYER1;
    p1Body.collisionFilterMask = GROUP_STATIC | (p2CarryMode ? GROUP_PLAYER2 : 0);

    p2Body.collisionFilterGroup = GROUP_PLAYER2;
    p2Body.collisionFilterMask = GROUP_STATIC | (p1CarryMode ? GROUP_PLAYER1 : 0);
}

function setupCarryButtons() {
    const btn1 = document.getElementById('p1-carry-btn');
    const btn2 = document.getElementById('p2-carry-btn');

    btn1.addEventListener('touchstart', (e) => {
        e.preventDefault(); p1CarryMode = !p1CarryMode;
        btn1.innerText = p1CarryMode ? "TAŞI: ON" : "TAŞI: OFF";
        btn1.classList.toggle('active', p1CarryMode); updateCollisionFilters();
    });

    btn2.addEventListener('touchstart', (e) => {
        e.preventDefault(); p2CarryMode = !p2CarryMode;
        btn2.innerText = p2CarryMode ? "TAŞI: ON" : "TAŞI: OFF";
        btn2.classList.toggle('active', p2CarryMode); updateCollisionFilters();
    });
}

// --- BİTİŞ ALANI VE TUŞLARIN CO-OP YÖNETİMİ ---
function handleInsideFinishLogic() {
    const finishX = finishMesh.position.x;
    
    // P1 Bitiş Alanı Kontrolü
    if (Math.abs(p1Body.position.x - finishX) < 1.0) {
        if (!p1InsideFinish) {
            p1InsideFinish = true;
            inputs.p1.moveX = 0; // Hareketi sıfırla
            document.getElementById('p1-controls').style.display = 'none'; // Tuşları gizle
            document.getElementById('p1-exit-btn').style.display = 'block'; // Çıkış butonunu göster
        }
    }

    // P2 Bitiş Alanı Kontrolü
    if (Math.abs(p2Body.position.x - finishX) < 1.0) {
        if (!p2InsideFinish) {
            p2InsideFinish = true;
            inputs.p2.moveX = 0;
            document.getElementById('p2-controls').style.display = 'none';
            document.getElementById('p2-exit-btn').style.display = 'block';
        }
    }

    // İKİ OYUNCU DA İÇERİDEYSE BÖLÜM GEÇ
    if (p1InsideFinish && p2InsideFinish) {
        p1InsideFinish = false; p2InsideFinish = false;
        currentLevel++;
        if(currentLevel > 3) currentLevel = 1;
        document.getElementById('level-num').innerText = currentLevel;
        
        resetPlayerToStart();
        buildLevel(currentLevel);
    }
}

function setupExitButtons() {
    // P1 Çıkış Butonu Aksiyonu (Bitişin biraz gerisine atar, tuşları geri getirir)
    document.getElementById('p1-exit-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        p1InsideFinish = false;
        p1Body.position.x = finishMesh.position.x - 3.5; // Biraz geriye atar
        p1Body.velocity.set(0,0,0);
        document.getElementById('p1-exit-btn').style.display = 'none';
        document.getElementById('p1-controls').style.display = 'block';
    });

    // P2 Çıkış Butonu Aksiyonu
    document.getElementById('p2-exit-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        p2InsideFinish = false;
        p2Body.position.x = finishMesh.position.x - 3.5;
        p2Body.velocity.set(0,0,0);
        document.getElementById('p2-exit-btn').style.display = 'none';
        document.getElementById('p2-controls').style.display = 'block';
    });
}

function resetPlayerToStart() {
    p1InsideFinish = false; p2InsideFinish = false;
    
    p1Body.position.set(-10, 3, 0); p1Body.velocity.set(0, 0, 0);
    p2Body.position.set(-8, 3, 0); p2Body.velocity.set(0, 0, 0);

    document.getElementById('p1-exit-btn').style.display = 'none';
    document.getElementById('p2-exit-btn').style.display = 'none';
    document.getElementById('p1-controls').style.display = 'block';
    document.getElementById('p2-controls').style.display = 'block';
}

function buildLevel(lvl) {
    levelObjects.forEach(obj => { scene.remove(obj.mesh); world.remove(obj.body); });
    levelObjects = [];
    enemies.forEach(en => { scene.remove(en.mesh); world.remove(en.body); });
    enemies = [];

    const loader = new THREE.GLTFLoader();

    if (lvl === 1) {
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
        // Düşman gövdesi oluşturulurken de içinden geçebilmesi için maske ayarlandı
        const enemyBody = new CANNON.Body({ mass: 5 });
        enemyBody.addShape(new CANNON.Box(new CANNON.Vec3(0.45, 1.1, 0.45)));
        enemyBody.position.set(1, 3, 0);
        enemyBody.fixedRotation = true;
        enemyBody.updateMassProperties();
        enemyBody.collisionFilterGroup = GROUP_ENEMY;
        enemyBody.collisionFilterMask = GROUP_STATIC; // Sadece zemine çarpar, oyuncuların içinden geçer!
        world.addBody(enemyBody);

        loader.load('assets/models/puppet_1.glb', (gltf) => {
            const eMesh = gltf.scene;
            eMesh.traverse(c => {
                if(c.isMesh) {
                    c.material = c.material.clone(); c.material.color.setHex(0x13294b);
                }
            });
            eMesh.position.y = -1.0; scene.add(eMesh);
            enemies.push({ mesh: eMesh, body: enemyBody });
        }, undefined, () => {
            const eMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0x13294b }));
            scene.add(eMesh); enemies.push({ mesh: eMesh, body: enemyBody });
        });

    } else if (lvl === 3) {
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
        scene.remove(levelObjects[index].mesh); world.remove(levelObjects[index].body);
        levelObjects.splice(index, 1);
    }
}

function startGame() {
    isGameStarted = true;
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('level-indicator').style.display = 'block';
    document.getElementById('p1-ui').style.display = 'block';
    document.getElementById('p2-ui').style.display = 'block';
    
    document.getElementById('p1-controls').style.display = 'block';
    document.getElementById('p2-controls').style.display = 'block';

    if(p1Mesh) p1Mesh.rotation.y = Math.PI / 2;
    if(p2Mesh) p2Mesh.rotation.y = Math.PI / 2;
}

function damagePlayer(playerNum, amount) {
    const now = performance.now();
    
    if(playerNum === 1) {
        if (now - p1LastDamageTime < 1000) return; // 1 saniye geçmeden tekrar hasar almaz
        p1LastDamageTime = now;
        p1Health = Math.max(0, p1Health - amount);
        document.getElementById('p1-health').style.width = p1Health + "%"; // Can barı düzgün küçülüyor
    } else {
        if (now - p2LastDamageTime < 1000) return;
        p2LastDamageTime = now;
        p2Health = Math.max(0, p2Health - amount);
        document.getElementById('p2-health').style.width = p2Health + "%";
    }

    if(p1Health <= 0 || p2Health <= 0) {
        p1Health = 100; p2Health = 100;
        document.getElementById('p1-health').style.width = "100%";
        document.getElementById('p2-health').style.width = "100%";
        resetPlayerToStart();
    }
}

function createPhysicsPlayer(x, y, z, physicsMaterial) {
    const body = new CANNON.Body({ mass: 4, material: physicsMaterial });
    body.addShape(new CANNON.Sphere(0.5), new CANNON.Vec3(0, -0.5, 0));
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.45, 0.6, 0.45)), new CANNON.Vec3(0, 0.4, 0));
    body.position.set(x, y, z);
    body.fixedRotation = true;
    body.updateMassProperties();
    world.addBody(body);
    return body;
}

function handleGameControls() {
    if (!isGameStarted) return;

    // P1 (İçerideyse hareket kilitlenir)
    const p1Speed = 7;
    if (!p1InsideFinish && inputs.p1.moveX !== 0) {
        p1Body.velocity.x = inputs.p1.moveX * p1Speed;
        if(p1Mesh) p1Mesh.rotation.y = inputs.p1.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
        p1Body.velocity.x = 0;
    }
    if (!p1InsideFinish && inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.02) {
        p1Body.velocity.y = 9.5; inputs.p1.jump = false;
    }

    // P2 (İçerideyse hareket kilitlenir)
    const p2Speed = 4.8;
    if (!p2InsideFinish && inputs.p2.moveX !== 0) {
        p2Body.velocity.x = inputs.p2.moveX * p2Speed;
        if(p2Mesh) p2Mesh.rotation.y = inputs.p2.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
        p2Body.velocity.x = 0;
    }
    if (!p2InsideFinish && inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.02) {
        p2Body.velocity.y = 5.5; inputs.p2.jump = false;
    }

    if (p1Body.position.y < -5 || p2Body.position.y < -5) {
        resetPlayerToStart();
    }

    handleInsideFinishLogic();
}

function setupTouchControls() {
    setupSingleJoystick('p1-joystick-zone', 'p1-joystick-stick', (x) => { if(!p1InsideFinish) inputs.p1.moveX = x; });
    document.getElementById('p1-action-btn').addEventListener('touchstart', () => { if(!p1InsideFinish) inputs.p1.jump = true; });

    setupSingleJoystick('p2-joystick-zone', 'p2-joystick-stick', (x) => { if(!p2InsideFinish) inputs.p2.moveX = x; });
    document.getElementById('p2-action-btn').addEventListener('touchstart', () => { if(!p2InsideFinish) inputs.p2.jump = true; });
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

function animate() {
    requestAnimationFrame(animate);

    if (isGameStarted) {
        world.step(1 / 60);
        handleGameControls();

        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 1.0; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 1.0; }

        // --- AKILLI DÜŞMAN TAKİBİ VE HASAR SİSTEMİ ---
        enemies.forEach(en => {
            if(en.mesh && en.body) {
                en.mesh.position.copy(en.body.position);
                en.mesh.position.y -= 1.0;

                const distToP1 = Math.abs(p1Body.position.x - en.body.position.x);
                const distToP2 = Math.abs(p2Body.position.x - en.body.position.x);
                const targetBody = (distToP1 < distToP2) ? p1Body : p2Body;

                const diffX = targetBody.position.x - en.body.position.x;
                en.body.velocity.x = Math.sign(diffX) * 2.3; 
                en.mesh.rotation.y = en.body.velocity.x > 0 ? Math.PI / 2 : -Math.PI / 2;

                // Gerçek Hasar Verme Tetikleyicisi (Temas algılandığında canları düşürür)
                if(Math.abs(p1Body.position.x - en.body.position.x) < 0.7 && Math.abs(p1Body.position.y - en.body.position.y) < 1.0) {
                    damagePlayer(1, 15); // Vurduğunda 15 hasar verir
                }
                if(Math.abs(p2Body.position.x - en.body.position.x) < 0.7 && Math.abs(p2Body.position.y - en.body.position.y) < 1.0) {
                    damagePlayer(2, 15);
                }
            }
        });

    } else {
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