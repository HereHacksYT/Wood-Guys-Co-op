// ==========================================
// 🎮 ROBOT GUYS CO-OP - 3D PLATFORMER
// (Wood Guy tarzı, sadece ileri-geri)
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

// Başlangıç pozisyonu
const START_X = 0, START_Y = 2, START_Z = -8;

// =============================================
// 📊 YÜKLEME EKRANI
// =============================================
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
// 🌳 3D ARENA (Wood Guy tarzı)
// =============================================
function buildArena() {
    // 1. GÖKYÜZÜ (gradient)
    const skyMat = new THREE.MeshStandardMaterial({
        color: 0x87CEEB,
        emissive: 0x4a8db7,
        emissiveIntensity: 0.3,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 32), skyMat);
    sky.position.set(0, 50, 0);
    scene.add(sky);

    // 2. ZEMİN (geniş)
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x4a8c5a,
        roughness: 0.9,
        metalness: 0.0
    });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 0.5, 60), groundMat);
    ground.position.set(0, -0.25, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Box(new CANNON.Vec3(30, 0.25, 30)));
    groundBody.position.set(0, -0.25, 0);
    world.addBody(groundBody);

    // 3. AĞAÇLAR (3D)
    function createTree(x, z, scale = 1) {
        const group = new THREE.Group();
        
        // Gövde
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3*scale, 0.5*scale, 2*scale, 6), trunkMat);
        trunk.position.y = 1*scale;
        trunk.castShadow = true;
        group.add(trunk);

        // Yapraklar (katmanlı)
        const leafMat = new THREE.MeshStandardMaterial({
            color: 0x2d8a4e,
            roughness: 0.8,
            emissive: new THREE.Color(0x1a5c32),
            emissiveIntensity: 0.1
        });
        
        const leafPos = [
            [0, 2.2*scale, 0, 1.2*scale],
            [0.5*scale, 1.6*scale, 0.5*scale, 0.8*scale],
            [-0.5*scale, 1.6*scale, -0.5*scale, 0.8*scale],
            [0.5*scale, 1.6*scale, -0.5*scale, 0.8*scale],
            [-0.5*scale, 1.6*scale, 0.5*scale, 0.8*scale]
        ];
        leafPos.forEach(([x, y, z, r]) => {
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 6), leafMat);
            leaf.position.set(x, y, z);
            leaf.castShadow = true;
            group.add(leaf);
        });

        group.position.set(x, 0, z);
        scene.add(group);

        // Ağaç fiziği (engel)
        const treeBody = new CANNON.Body({ mass: 0 });
        treeBody.addShape(new CANNON.Cylinder(0.4*scale, 0.6*scale, 2.5*scale, 6));
        treeBody.position.set(x, 1.2*scale, z);
        world.addBody(treeBody);
    }

    // Ağaçları yerleştir
    const treePos = [
        // Arka sıra
        [-20, -25], [0, -28], [20, -25],
        [-15, -22], [15, -22],
        // Sol
        [-27, -10], [-27, 0], [-27, 10],
        [-25, -18], [-25, 18],
        // Sağ
        [27, -10], [27, 0], [27, 10],
        [25, -18], [25, 18],
        // Ön
        [-18, 22], [0, 25], [18, 22],
        [-10, 20], [10, 20]
    ];
    treePos.forEach(([x, z]) => {
        createTree(x, z, 0.7 + Math.random() * 0.6);
    });

    // 4. PLATFORMLAR (Z ekseninde ilerlemek için)
    function createPlatform(x, y, z, w, h, d, color = 0x8a7a6a) {
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        scene.add(mesh);

        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
        body.position.set(x, y, z);
        world.addBody(body);
    }

    // Platformlar (Z ekseninde ilerleyen)
    const platforms = [
        [0, 1.5, -5, 4, 0.8, 3, 0x7a8a7a],
        [0, 3.0, -10, 3, 0.8, 3, 0x8a9a8a],
        [0, 4.5, -15, 3, 0.8, 3, 0x9aaa8a],
        [0, 6.0, -20, 3, 0.8, 3, 0xaa9a7a],
        [0, 7.5, -25, 3, 0.8, 3, 0xbaaa8a],
        [0, 9.0, -30, 3, 0.8, 3, 0xcaaa7a],
        [0, 10.5, -35, 3, 0.8, 3, 0xdaaa6a],
    ];
    platforms.forEach(([x, y, z, w, h, d, c]) => {
        createPlatform(x, y, z, w, h, d, c);
    });

    // 5. BİTİŞ NOKTASI (Altın küp)
    const finishMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff5500,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
    });
    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), finishMat);
    finishMesh.position.set(0, 11.5, -38);
    finishMesh.castShadow = true;
    scene.add(finishMesh);

    const finishBody = new CANNON.Body({ mass: 0 });
    finishBody.addShape(new CANNON.Box(new CANNON.Vec3(1, 1, 1)));
    finishBody.position.set(0, 11.5, -38);
    world.addBody(finishBody);

    // 6. DEKORATİF IŞIKLAR
    for (let z = -40; z < 20; z += 4) {
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 6, 6),
            new THREE.MeshStandardMaterial({
                color: 0x88bbff,
                emissive: 0x4488ff,
                emissiveIntensity: 0.2,
                transparent: true,
                opacity: 0.4
            })
        );
        glow.position.set(-25, 0.5, z);
        scene.add(glow);
        const glow2 = glow.clone();
        glow2.position.set(25, 0.5, z);
        scene.add(glow2);
    }
}

// =============================================
// 🤖 DEMİR KARAKTER
// =============================================
function createMetalCharacter(color, isP1 = true) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.3,
        metalness: 0.8,
        emissive: new THREE.Color(color).multiplyScalar(0.1)
    });

    // Gövde
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.8), bodyMat);
    body.position.y = 1.2;
    body.castShadow = true;
    group.add(body);

    // Kafa
    const headMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.2,
        metalness: 0.9
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), headMat);
    head.position.y = 2.4;
    head.castShadow = true;
    group.add(head);

    // Gözler
    const eyeMat = new THREE.MeshStandardMaterial({
        color: isP1 ? 0x00ffcc : 0xff4400,
        emissive: isP1 ? 0x00ffcc : 0xff4400,
        emissiveIntensity: 0.5
    });
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), eyeMat);
    eye1.position.set(-0.25, 2.5, 0.5);
    group.add(eye1);
    const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), eyeMat);
    eye2.position.set(0.25, 2.5, 0.5);
    group.add(eye2);

    // Kollar
    const armMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.7
    });
    const armGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 6);
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.8, 1.4, 0);
    armL.rotation.z = 0.2;
    armL.castShadow = true;
    group.add(armL);
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.8, 1.4, 0);
    armR.rotation.z = -0.2;
    armR.castShadow = true;
    group.add(armR);

    // Bacaklar
    const legMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.5,
        metalness: 0.6
    });
    const legGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 6);
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.4, 0.4, 0);
    legL.castShadow = true;
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.4, 0.4, 0);
    legR.castShadow = true;
    group.add(legR);

    return group;
}

// =============================================
// ANA OYUN
// =============================================
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 40, 60);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 150);
    camera.position.set(8, 6, 0);
    camera.lookAt(0, 2, -15);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Işık
    const ambient = new THREE.AmbientLight(0x8899bb, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x88bbff, 0.3);
    fillLight.position.set(-10, 10, -20);
    scene.add(fillLight);

    // Fizik
    initPhysics();
    p1Body = createPhysicsPlayer(START_X - 1.5, START_Y, START_Z);
    p2Body = createPhysicsPlayer(START_X + 1.5, START_Y, START_Z);

    // Sesler
    const audioLoader = new THREE.AudioLoader();
    clashSound = new THREE.Audio(new THREE.AudioListener());
    fallSound = new THREE.Audio(new THREE.AudioListener());
    try {
        audioLoader.load('assets/audio/dragon-studio-sword-clashhit-393837.mp3', (b) => {
            clashSound.setBuffer(b); clashSound.setVolume(0.3);
        });
        audioLoader.load('assets/audio/freesound_community-body-falling-to-ground-100474.mp3', (b) => {
            fallSound.setBuffer(b); fallSound.setVolume(0.3);
        });
    } catch(e) {}

    // Arena
    buildArena();

    // Karakterler
    const p1Model = createMetalCharacter(0x4488cc, true);
    p1Model.scale.set(0.8, 0.8, 0.8);
    p1Mesh = p1Model;
    scene.add(p1Mesh);
    updateLoadingProgress();

    const p2Model = createMetalCharacter(0xcc4444, false);
    p2Model.scale.set(0.8, 0.8, 0.8);
    p2Mesh = p2Model;
    scene.add(p2Mesh);
    updateLoadingProgress();

    // Yedek
    setTimeout(() => {
        if (loadedCount < totalFilesToLoad) showPlayButton();
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

function resetPlayer(body, x, z) {
    body.position.set(x, START_Y, z || START_Z);
    body.velocity.set(0, 0, 0);
}

// =============================================
// OYUN DÖNGÜSÜ
// =============================================
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    let dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (isGameStarted) {
        updateKeyboardInputs();
        stepPhysics(dt);

        // Wood Guy hızı (yavaş ve kontrollü)
        const speed = 35;
        const turnSpeed = 3;

        // P1: Sadece Z ekseninde hareket
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p1Body.velocity.x = 0;
        // Sağ-sol tuşları karakteri döndürsün
        if (inputs.p1.moveX > 0.5) {
            if (p1Mesh) p1Mesh.rotation.y += 0.05;
        } else if (inputs.p1.moveX < -0.5) {
            if (p1Mesh) p1Mesh.rotation.y -= 0.05;
        }

        // P2: Sadece Z ekseninde hareket
        p2Body.velocity.z = inputs.p2.moveZ * speed;
        p2Body.velocity.x = 0;
        if (inputs.p2.moveX > 0.5) {
            if (p2Mesh) p2Mesh.rotation.y += 0.05;
        } else if (inputs.p2.moveX < -0.5) {
            if (p2Mesh) p2Mesh.rotation.y -= 0.05;
        }

        // Zıplama (Wood Guy gibi hafif)
        if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.5) {
            p1Body.velocity.y = 40;
            inputs.p1.jump = false;
        }
        if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.5) {
            p2Body.velocity.y = 40;
            inputs.p2.jump = false;
        }

        // Görsel güncelle
        if (p1Mesh) {
            p1Mesh.position.copy(p1Body.position);
            p1Mesh.position.y -= 0.5;
            // Hareket yönüne göre hafif eğim
            if (p1Body.velocity.z > 2) p1Mesh.rotation.x = -0.05;
            else if (p1Body.velocity.z < -2) p1Mesh.rotation.x = 0.05;
            else p1Mesh.rotation.x = 0;
        }
        if (p2Mesh) {
            p2Mesh.position.copy(p2Body.position);
            p2Mesh.position.y -= 0.5;
            if (p2Body.velocity.z > 2) p2Mesh.rotation.x = -0.05;
            else if (p2Body.velocity.z < -2) p2Mesh.rotation.x = 0.05;
            else p2Mesh.rotation.x = 0;
        }

        // Düşme
        if (p1Body.position.y < -10) {
            p1Health = Math.max(0, p1Health - 10);
            resetPlayer(p1Body, START_X - 1.5);
            if (fallSound) fallSound.play();
        }
        if (p2Body.position.y < -10) {
            p2Health = Math.max(0, p2Health - 10);
            resetPlayer(p2Body, START_X + 1.5);
            if (fallSound) fallSound.play();
        }

        // Çarpışma
        const dist = p1Body.position.distanceTo(p2Body.position);
        if (dist < 1.5) {
            const dir = new CANNON.Vec3().copy(p2Body.position).vsub(p1Body.position);
            const push = dir.z > 0 ? -1 : 1;
            p1Body.velocity.z = push * 20;
            p2Body.velocity.z = -push * 20;
            if (clashSound) clashSound.play();
        }

        // Bitiş
        if (finishMesh) {
            if (p1Body.position.distanceTo(finishMesh.position) < 1.5 ||
                p2Body.position.distanceTo(finishMesh.position) < 1.5) {
                alert('🎉 Tebrikler! Bitişe ulaştınız!');
                resetPlayer(p1Body, START_X - 1.5);
                resetPlayer(p2Body, START_X + 1.5);
                p1Health = MAX_HEALTH;
                p2Health = MAX_HEALTH;
            }
        }

        // UI
        document.getElementById('p1-health').style.width = (p1Health / MAX_HEALTH * 100) + '%';
        document.getElementById('p2-health').style.width = (p2Health / MAX_HEALTH * 100) + '%';
    }

    // Kamera takibi (3. şahıs)
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2 + 3;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;

    camera.position.x += (midX + 6 - camera.position.x) * 0.04;
    camera.position.y += (midY + 4 - camera.position.y) * 0.04;
    camera.position.z += (midZ - 8 - camera.position.z) * 0.04;
    camera.lookAt(midX, midY, midZ);

    renderer.render(scene, camera);
}

window.onload = init;