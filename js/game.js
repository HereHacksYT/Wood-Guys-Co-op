// ==========================================
// 🎮 ROBOT GUYS CO-OP - 3D PLATFORMER
// (İleri-geri Z ekseninde, zıplama yok)
// ==========================================

let scene, camera, renderer;
let p1Mesh, p2Mesh, p1Body, p2Body;
let isGameStarted = false;
let loadedCount = 0;
const totalFilesToLoad = 4;
let lastTime = performance.now();
let finishMesh = null;

let p1Health = 100;
let p2Health = 100;
const MAX_HEALTH = 100;

let clashSound, fallSound;

// Başlangıç pozisyonu
const START_X = 0, START_Y = 1.5, START_Z = -20;

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
// 🌳 3D ARENA (Uzun zemin, ağaçlar yerde)
// =============================================
function buildArena() {
    // 1. ARKA PLAN FOTOĞRAFI (image.jpeg) - UZAKTA
    const textureLoader = new THREE.TextureLoader();
    const bgTexture = textureLoader.load('assets/textures/images.jpeg');
    const bgMat = new THREE.MeshStandardMaterial({
        map: bgTexture,
        side: THREE.DoubleSide
    });
    const bgGeo = new THREE.PlaneGeometry(100, 50);
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, 20, -60); // Uzağa koy
    scene.add(bgMesh);
    updateLoadingProgress();

    // Yedek
    textureLoader.load('assets/textures/images.jpeg', 
        () => {},
        undefined,
        () => {
            const fallbackMat = new THREE.MeshStandardMaterial({
                color: 0x87CEEB,
                side: THREE.DoubleSide
            });
            const fallbackMesh = new THREE.Mesh(bgGeo, fallbackMat);
            fallbackMesh.position.set(0, 20, -60);
            scene.add(fallbackMesh);
        }
    );

    // 2. ZEMİN (UZUN - Z ekseninde)
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x4a7c59,
        roughness: 0.9,
        metalness: 0.0
    });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 80), groundMat);
    ground.position.set(0, -0.25, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Box(new CANNON.Vec3(10, 0.25, 40)));
    groundBody.position.set(0, -0.25, 0);
    world.addBody(groundBody);

    // 3. 3D AĞAÇLAR (ZEMİNDE, Z ekseni boyunca)
    function createTree3D(x, z, scale = 1) {
        const group = new THREE.Group();
        
        // Gövde
        const trunkMat = new THREE.MeshStandardMaterial({ 
            color: 0x8B5A2B, 
            roughness: 0.9 
        });
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3*scale, 0.5*scale, 2*scale, 6),
            trunkMat
        );
        trunk.position.y = 1*scale;
        trunk.castShadow = true;
        group.add(trunk);

        // Yapraklar
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
        leafPos.forEach(([lx, ly, lz, r]) => {
            const leaf = new THREE.Mesh(
                new THREE.SphereGeometry(r, 6, 6),
                leafMat
            );
            leaf.position.set(lx, ly, lz);
            leaf.castShadow = true;
            group.add(leaf);
        });

        group.position.set(x, 0, z);
        scene.add(group);
        return group;
    }

    // Ağaçları Z ekseni boyunca yerleştir (her iki yana)
    for (let z = -35; z <= 35; z += 5 + Math.random() * 4) {
        // Sol tarafa
        const xLeft = -6 - Math.random() * 3;
        createTree3D(xLeft, z, 0.6 + Math.random() * 0.8);
        // Sağ tarafa
        const xRight = 6 + Math.random() * 3;
        createTree3D(xRight, z, 0.6 + Math.random() * 0.8);
        // Bazen ortaya yakın
        if (Math.random() > 0.7) {
            createTree3D((Math.random() - 0.5) * 4, z, 0.5 + Math.random() * 0.5);
        }
    }

    // 4. ENGELLER / PLATFORMLAR (Z ekseninde ilerlemek için)
    function createObstacle(x, z, w, h, d, color = 0x8a7a6a) {
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, h/2, z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        scene.add(mesh);

        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
        body.position.set(x, h/2, z);
        world.addBody(body);
    }

    // Z ekseninde engeller (üzerinden atlanamaz, sadece etrafından dolaşılır)
    const obstacles = [
        [-3, -10, 2, 1, 2, 0x7a8a7a],
        [3, -5, 2, 1.5, 2, 0x8a9a8a],
        [-4, 5, 2, 2, 2, 0x9aaa8a],
        [4, 12, 2, 1, 2, 0xaa9a7a],
        [-3, 20, 2, 1.5, 2, 0xbaaa8a],
        [3, 28, 2, 2, 2, 0xcaaa7a],
    ];
    obstacles.forEach(([x, z, w, h, d, c]) => {
        createObstacle(x, z, w, h, d, c);
    });

    // 5. BİTİŞ NOKTASI (Z ekseninin sonunda)
    const finishMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff5500,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
    });
    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), finishMat);
    finishMesh.position.set(0, 1.5, 38);
    finishMesh.castShadow = true;
    scene.add(finishMesh);

    const finishBody = new CANNON.Body({ mass: 0 });
    finishBody.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 1.5)));
    finishBody.position.set(0, 1.5, 38);
    world.addBody(finishBody);
}

// =============================================
// 🤖 KARAKTER (Tekerlekli, metalik)
// =============================================
function createCharacter(color, isP1 = true) {
    const group = new THREE.Group();

    // Tekerlek (ayak)
    const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.4,
        metalness: 0.8
    });
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), wheelMat);
    wheel.position.y = 0;
    wheel.castShadow = true;
    group.add(wheel);

    // Jant
    const rimMat = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.3,
        metalness: 0.9
    });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8), rimMat);
    rim.position.y = 0;
    rim.rotation.x = Math.PI / 2;
    group.add(rim);

    // Gövde
    const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.3,
        metalness: 0.8,
        emissive: new THREE.Color(color).multiplyScalar(0.1)
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.8), bodyMat);
    body.position.y = 1.2;
    body.castShadow = true;
    group.add(body);

    // Kafa
    const headMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.2,
        metalness: 0.9
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), headMat);
    head.position.y = 2.2;
    head.castShadow = true;
    group.add(head);

    // Gözler
    const eyeMat = new THREE.MeshStandardMaterial({
        color: isP1 ? 0x00ffcc : 0xff4400,
        emissive: isP1 ? 0x00ffcc : 0xff4400,
        emissiveIntensity: 0.5
    });
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
    eye1.position.set(-0.2, 2.3, 0.5);
    group.add(eye1);
    const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
    eye2.position.set(0.2, 2.3, 0.5);
    group.add(eye2);

    // Kollar
    const armMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.7
    });
    const armGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.8, 6);
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.7, 1.3, 0);
    armL.rotation.z = 0.2;
    armL.castShadow = true;
    group.add(armL);
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.7, 1.3, 0);
    armR.rotation.z = -0.2;
    armR.castShadow = true;
    group.add(armR);

    return group;
}

// =============================================
// ANA OYUN
// =============================================
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 80);

    // 3D Kamera (arkadan ve yukarıdan)
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 10, 15);
    camera.lookAt(0, 1, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Işıklandırma
    const ambient = new THREE.AmbientLight(0x8899bb, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -10;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x88bbff, 0.3);
    fillLight.position.set(-10, 10, -10);
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
    const p1Model = createCharacter(0x4488cc, true);
    p1Model.scale.set(0.8, 0.8, 0.8);
    p1Mesh = p1Model;
    scene.add(p1Mesh);
    updateLoadingProgress();

    const p2Model = createCharacter(0xcc4444, false);
    p2Model.scale.set(0.8, 0.8, 0.8);
    p2Mesh = p2Model;
    scene.add(p2Mesh);
    updateLoadingProgress();

    // Yedek
    setTimeout(() => {
        if (loadedCount < totalFilesToLoad) {
            while (loadedCount < totalFilesToLoad) updateLoadingProgress();
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

function resetPlayer(body, x, z) {
    body.position.set(x, START_Y, z || START_Z);
    body.velocity.set(0, 0, 0);
}

// =============================================
// OYUN DÖNGÜSÜ (ZIPLAMA YOK)
// =============================================
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    let dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (isGameStarted) {
        updateKeyboardInputs();
        stepPhysics(dt);

        // HAREKET: W/S -> Z ekseni (ileri-geri), A/D -> X ekseni (sağ-sol)
        const speed = 50;
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p2Body.velocity.z = inputs.p2.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;

        // Zıplama yok - jump tuşları pasif
        inputs.p1.jump = false;
        inputs.p2.jump = false;

        // Görsel güncelle
        if (p1Mesh) {
            p1Mesh.position.copy(p1Body.position);
            // Tekerlek dönüşü
            const wheel = p1Mesh.children[0];
            if (wheel && wheel.isMesh) {
                const totalSpeed = Math.sqrt(p1Body.velocity.x*p1Body.velocity.x + p1Body.velocity.z*p1Body.velocity.z);
                wheel.rotation.x += totalSpeed * dt * 3;
            }
            // Hareket yönüne dön
            if (p1Body.velocity.z > 0.5) p1Mesh.rotation.y = 0;
            else if (p1Body.velocity.z < -0.5) p1Mesh.rotation.y = Math.PI;
        }
        if (p2Mesh) {
            p2Mesh.position.copy(p2Body.position);
            const wheel = p2Mesh.children[0];
            if (wheel && wheel.isMesh) {
                const totalSpeed = Math.sqrt(p2Body.velocity.x*p2Body.velocity.x + p2Body.velocity.z*p2Body.velocity.z);
                wheel.rotation.x += totalSpeed * dt * 3;
            }
            if (p2Body.velocity.z > 0.5) p2Mesh.rotation.y = 0;
            else if (p2Body.velocity.z < -0.5) p2Mesh.rotation.y = Math.PI;
        }

        // Düşme (zıplama olmadığı için sadece zeminden düşme)
        if (p1Body.position.y < -10) {
            p1Health = Math.max(0, p1Health - 10);
            resetPlayer(p1Body, START_X - 1.5, START_Z);
            if (fallSound) fallSound.play();
        }
        if (p2Body.position.y < -10) {
            p2Health = Math.max(0, p2Health - 10);
            resetPlayer(p2Body, START_X + 1.5, START_Z);
            if (fallSound) fallSound.play();
        }

        // Çarpışma
        const dist = p1Body.position.distanceTo(p2Body.position);
        if (dist < 1.5) {
            const dir = new CANNON.Vec3().copy(p2Body.position).vsub(p1Body.position);
            dir.normalize();
            p1Body.velocity.vadd(dir.scale(-20), p1Body.velocity);
            p2Body.velocity.vadd(dir.scale(20), p2Body.velocity);
            if (clashSound) clashSound.play();
        }

        // Bitiş
        if (finishMesh) {
            if (p1Body.position.distanceTo(finishMesh.position) < 2 ||
                p2Body.position.distanceTo(finishMesh.position) < 2) {
                alert('🎉 Tebrikler! Bitişe ulaştınız!');
                resetPlayer(p1Body, START_X - 1.5, START_Z);
                resetPlayer(p2Body, START_X + 1.5, START_Z);
                p1Health = MAX_HEALTH;
                p2Health = MAX_HEALTH;
            }
        }

        // UI
        document.getElementById('p1-health').style.width = (p1Health / MAX_HEALTH * 100) + '%';
        document.getElementById('p2-health').style.width = (p2Health / MAX_HEALTH * 100) + '%';
    }

    // Kamera takibi (karakterlerin ortasını)
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2 + 2;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;

    camera.position.x += (midX - camera.position.x) * 0.04;
    camera.position.y += (midY + 8 - camera.position.y) * 0.04;
    camera.position.z += (midZ + 12 - camera.position.z) * 0.04;
    camera.lookAt(midX, midY, midZ);

    renderer.render(scene, camera);
}

window.onload = init;