// ==========================================
// 🎮 ROBOT GUYS CO-OP - ANA OYUN
// (Harita.obj yerine kod içi 3D arena)
// ==========================================

let scene, camera, renderer;
let p1Mesh, p2Mesh, p1Body, p2Body;
let isGameStarted = false;
let loadedCount = 0;
const totalFilesToLoad = 3;
let lastTime = performance.now();
let finishMesh = null;

let p1Health = 100;
let p2Health = 100;
const MAX_HEALTH = 100;

let clashSound, fallSound;

const START_X = 0, START_Y = 5, START_Z = 0;

function updateLoadingProgress() {
    if (isGameStarted) return;
    loadedCount++;
    const percentage = Math.min(Math.floor((loadedCount / totalFilesToLoad) * 100), 100);
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');
    if (progressBar) progressBar.style.width = percentage + '%';
    if (loadingText) loadingText.innerText = `Yükleniyor... (%${percentage})`;
    if (loadedCount >= totalFilesToLoad) showPlayButton();
}

function showPlayButton() {
    document.getElementById('loading-text').style.display = 'none';
    document.getElementById('progress-container').style.display = 'none';
    document.getElementById('play-btn').style.display = 'block';
}

// =============================================
// 🏗️ 3D ARENA OLUŞTURMA (Harita.obj YERİNE)
// =============================================
function buildArena() {
    // 1. ZEMİN (Büyük platform)
    const groundGeo = new THREE.BoxGeometry(60, 1, 60);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x4a7c59,
        roughness: 0.8,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, -0.5, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    // Zemin fiziği
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Box(new CANNON.Vec3(30, 0.5, 30)));
    groundBody.position.set(0, -0.5, 0);
    world.addBody(groundBody);

    // 2. ARKA PLAN FOTOĞRAFI (images.jpeg)
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('assets/textures/images.jpeg', (texture) => {
        const bgGeo = new THREE.PlaneGeometry(60, 35);
        const bgMat = new THREE.MeshStandardMaterial({ 
            map: texture,
            side: THREE.DoubleSide
        });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.position.set(0, 15, -28);
        scene.add(bg);
    }, undefined, () => {
        // Yedek: fotoğraf yoksa renkli duvar
        const bgGeo = new THREE.PlaneGeometry(60, 35);
        const bgMat = new THREE.MeshStandardMaterial({ 
            color: 0x87CEEB,
            side: THREE.DoubleSide
        });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.position.set(0, 15, -28);
        scene.add(bg);
    });

    // 3. AĞAÇLAR (3D)
    function createTree(x, z, scale = 1) {
        const group = new THREE.Group();
        
        // Gövde (silindir)
        const trunkGeo = new THREE.CylinderGeometry(0.4 * scale, 0.6 * scale, 2.5 * scale, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.25 * scale;
        trunk.castShadow = true;
        group.add(trunk);

        // Yapraklar (3 katman küre)
        const leafMat = new THREE.MeshStandardMaterial({ 
            color: 0x2d8a4e, 
            roughness: 0.8,
            emissive: new THREE.Color(0x1a5c32),
            emissiveIntensity: 0.1
        });
        
        const leafPositions = [
            [0, 2.8 * scale, 0, 1.2 * scale],
            [0.6 * scale, 2.0 * scale, 0.6 * scale, 0.8 * scale],
            [-0.6 * scale, 2.0 * scale, -0.6 * scale, 0.8 * scale],
            [0.6 * scale, 2.0 * scale, -0.6 * scale, 0.8 * scale],
            [-0.6 * scale, 2.0 * scale, 0.6 * scale, 0.8 * scale]
        ];
        
        leafPositions.forEach(([x, y, z, r]) => {
            const leafGeo = new THREE.SphereGeometry(r, 6, 6);
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set(x, y, z);
            leaf.castShadow = true;
            group.add(leaf);
        });

        group.position.set(x, 0, z);
        scene.add(group);

        // Ağaçlara fizik ekleme (statik engel olarak)
        const treeBody = new CANNON.Body({ mass: 0 });
        treeBody.addShape(new CANNON.Cylinder(0.5 * scale, 0.7 * scale, 3 * scale, 8));
        treeBody.position.set(x, 1.5 * scale, z);
        world.addBody(treeBody);
    }

    // Ağaçları yerleştir (arkada ve yanlarda)
    const treePositions = [
        // Arka sıra
        [-20, -20], [0, -22], [20, -20],
        [-15, -18], [15, -18],
        // Sol
        [-28, -5], [-28, 5], [-26, -12], [-26, 12],
        // Sağ
        [28, -5], [28, 5], [26, -12], [26, 12],
        // Öne yakın
        [-18, 20], [18, 20], [0, 18]
    ];

    treePositions.forEach(([x, z]) => {
        const scale = 0.8 + Math.random() * 0.6;
        createTree(x, z, scale);
    });

    // 4. RAMPA / PLATFORMLAR (Zıplama için)
    function createPlatform(x, y, z, w, h, d, color = 0x8B7355) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        scene.add(mesh);

        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
        body.position.set(x, y, z);
        world.addBody(body);
    }

    // Platformlar (zıplayarak ulaşılacak)
    createPlatform(-10, 2.5, -10, 4, 1, 4, 0x6d8a7d);
    createPlatform(10, 2.5, -10, 4, 1, 4, 0x6d8a7d);
    createPlatform(-12, 5, -15, 3, 0.8, 3, 0x8a6d5d);
    createPlatform(12, 5, -15, 3, 0.8, 3, 0x8a6d5d);
    createPlatform(-8, 7.5, -20, 3, 0.8, 3, 0x5d8a6d);
    createPlatform(8, 7.5, -20, 3, 0.8, 3, 0x5d8a6d);

    // 5. BİTİŞ NOKTASI (Altın küp - yüksekte)
    const finishGeo = new THREE.BoxGeometry(2.5, 2.5, 2.5);
    const finishMat = new THREE.MeshStandardMaterial({ 
        color: 0xffaa00, 
        emissive: 0xff5500, 
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2
    });
    finishMesh = new THREE.Mesh(finishGeo, finishMat);
    finishMesh.position.set(0, 10, -25);
    finishMesh.castShadow = true;
    scene.add(finishMesh);

    // Bitiş fiziği (görünmez duvar)
    const finishBody = new CANNON.Body({ mass: 0 });
    finishBody.addShape(new CANNON.Box(new CANNON.Vec3(1.25, 1.25, 1.25)));
    finishBody.position.set(0, 10, -25);
    world.addBody(finishBody);
}

// =============================================
// ANA OYUN BAŞLATMA
// =============================================

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Gökyüzü mavisi
    scene.fog = new THREE.Fog(0x87CEEB, 40, 70); // Uzakları hafif sisle

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 150);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Işıklandırma
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(30, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
    fillLight.position.set(-20, 10, -30);
    scene.add(fillLight);

    // Fizik
    initPhysics();
    p1Body = createPhysicsPlayer(START_X - 3, START_Y, START_Z);
    p2Body = createPhysicsPlayer(START_X + 3, START_Y, START_Z);

    // Sesler
    const audioLoader = new THREE.AudioLoader();
    clashSound = new THREE.Audio(new THREE.AudioListener());
    fallSound = new THREE.Audio(new THREE.AudioListener());
    try {
        audioLoader.load('assets/audio/dragon-studio-sword-clashhit-393837.mp3', (b) => {
            clashSound.setBuffer(b); clashSound.setVolume(0.4);
        });
        audioLoader.load('assets/audio/freesound_community-body-falling-to-ground-100474.mp3', (b) => {
            fallSound.setBuffer(b); fallSound.setVolume(0.4);
        });
    } catch(e) { console.warn('Ses yüklenemedi'); }

    // 3D Arena'yı oluştur (Harita.obj yerine)
    buildArena();

    // Oyuncu modellerini yükle
    const objLoader = new THREE.OBJLoader();
    const p1Mat = new THREE.MeshStandardMaterial({ color: 0x0044cc, roughness: 0.4, metalness: 0.2 });
    const p2Mat = new THREE.MeshStandardMaterial({ color: 0xcc1111, roughness: 0.4, metalness: 0.2 });

    objLoader.load('assets/models/puppet_1.obj', (obj) => {
        obj.traverse(c => { if (c.isMesh) { c.material = p1Mat; c.castShadow = true; } });
        p1Mesh = obj; p1Mesh.scale.set(4, 4, 4); scene.add(p1Mesh); updateLoadingProgress();
    }, undefined, () => { fallbackP1(p1Mat); });

    objLoader.load('assets/models/soviet_robot.obj', (obj) => {
        obj.traverse(c => { if (c.isMesh) { c.material = p2Mat; c.castShadow = true; } });
        p2Mesh = obj; p2Mesh.scale.set(2.5, 2.5, 2.5); scene.add(p2Mesh); updateLoadingProgress();
    }, undefined, () => { fallbackP2(p2Mat); });

    // Yedek yükleme (her ihtimale karşı)
    setTimeout(() => {
        if (loadedCount < totalFilesToLoad) {
            if (!p1Mesh) fallbackP1(p1Mat);
            if (!p2Mesh) fallbackP2(p2Mat);
            showPlayButton();
        }
    }, 3000);

    initControls();

    document.getElementById('play-btn').addEventListener('click', () => {
        isGameStarted = true;
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('p1-joystick-zone').style.display = 'block';
        document.getElementById('p1-action-btn').style.display = 'flex';
        document.getElementById('p2-joystick-zone').style.display = 'block';
        document.getElementById('p2-action-btn').style.display = 'flex';
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function fallbackP1(mat) { 
    if (!p1Mesh) { 
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1.5), mat); 
        p1Mesh.castShadow = true;
        scene.add(p1Mesh); 
        updateLoadingProgress(); 
    } 
}
function fallbackP2(mat) { 
    if (!p2Mesh) { 
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1.5), mat); 
        p2Mesh.castShadow = true;
        scene.add(p2Mesh); 
        updateLoadingProgress(); 
    } 
}

function resetPlayer(body, x) {
    body.position.set(x, START_Y, START_Z);
    body.velocity.set(0, 0, 0);
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    let dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (isGameStarted) {
        updateKeyboardInputs();
        stepPhysics(dt);

        const speed = 100;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;
        p2Body.velocity.z = inputs.p2.moveZ * speed;

        if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 1.0) {
            p1Body.velocity.y = 80;
            inputs.p1.jump = false;
        }
        if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 1.0) {
            p2Body.velocity.y = 80;
            inputs.p2.jump = false;
        }

        if (p1Mesh) { 
            p1Mesh.position.copy(p1Body.position); 
            p1Mesh.position.y -= 1.5;
        }
        if (p2Mesh) { 
            p2Mesh.position.copy(p2Body.position); 
            p2Mesh.position.y -= 1.5;
        }

        // Düşme kontrolü
        if (p1Body.position.y < -20) {
            p1Health = Math.max(0, p1Health - 10);
            resetPlayer(p1Body, START_X - 3);
            if (fallSound) fallSound.play();
        }
        if (p2Body.position.y < -20) {
            p2Health = Math.max(0, p2Health - 10);
            resetPlayer(p2Body, START_X + 3);
            if (fallSound) fallSound.play();
        }

        // Oyuncu çarpışması
        const dist = p1Body.position.distanceTo(p2Body.position);
        if (dist < 2.5) {
            const dir = new CANNON.Vec3().copy(p2Body.position).vsub(p1Body.position);
            dir.normalize();
            p1Body.velocity.vadd(dir.scale(-40), p1Body.velocity);
            p2Body.velocity.vadd(dir.scale(40), p2Body.velocity);
            if (clashSound) clashSound.play();
        }

        // Bitiş kontrolü
        if (finishMesh) {
            if (p1Body.position.distanceTo(finishMesh.position) < 2.5 ||
                p2Body.position.distanceTo(finishMesh.position) < 2.5) {
                alert('🎉 Tebrikler! Kazandınız!');
                resetPlayer(p1Body, START_X - 3);
                resetPlayer(p2Body, START_X + 3);
                p1Health = MAX_HEALTH;
                p2Health = MAX_HEALTH;
            }
        }

        // UI güncelle
        document.getElementById('p1-health').style.width = (p1Health / MAX_HEALTH * 100) + '%';
        document.getElementById('p2-health').style.width = (p2Health / MAX_HEALTH * 100) + '%';
    }

    // Kamera (Yandan takip - platformer stili)
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2 + 5;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;
    
    camera.position.x += (midX - camera.position.x) * 0.04;
    camera.position.y += (midY + 20 - camera.position.y) * 0.04;
    camera.position.z += (midZ + 35 - camera.position.z) * 0.04;
    camera.lookAt(midX, midY + 3, midZ);

    renderer.render(scene, camera);
}

window.onload = init;