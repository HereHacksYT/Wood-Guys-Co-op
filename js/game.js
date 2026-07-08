// ==========================================
// 🎮 ROBOT GUYS CO-OP - 2.5D SIDE-SCROLLER
// (Tekerlekli karakterler, 3D ağaçlar, image.jpeg)
// ==========================================

let scene, camera, renderer;
let p1Mesh, p2Mesh, p1Body, p2Body;
let p1Wheel, p2Wheel; // Tekerlek görselleri
let isGameStarted = false;
let loadedCount = 0;
const totalFilesToLoad = 4; // 2 karakter + zemin + arka plan
let lastTime = performance.now();
let finishMesh = null;

let p1Health = 100;
let p2Health = 100;
const MAX_HEALTH = 100;

let clashSound, fallSound;

// Başlangıç pozisyonu
const START_X = -5, START_Y = 3, START_Z = 0;

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
// 🌳 2.5D ARENA (Side-scroller)
// =============================================
function buildArena() {
    // 1. ARKA PLAN FOTOĞRAFI (image.jpeg)
    const textureLoader = new THREE.TextureLoader();
    const bgTexture = textureLoader.load('assets/textures/images.jpeg');
    const bgMat = new THREE.MeshStandardMaterial({
        map: bgTexture,
        side: THREE.DoubleSide
    });
    const bgGeo = new THREE.PlaneGeometry(80, 40);
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, 15, -15);
    scene.add(bgMesh);
    updateLoadingProgress();

    // Yedek: fotoğraf yoksa renkli arka plan
    textureLoader.load('assets/textures/images.jpeg', 
        () => {},
        undefined,
        () => {
            const fallbackMat = new THREE.MeshStandardMaterial({
                color: 0x87CEEB,
                side: THREE.DoubleSide
            });
            const fallbackMesh = new THREE.Mesh(bgGeo, fallbackMat);
            fallbackMesh.position.set(0, 15, -15);
            scene.add(fallbackMesh);
        }
    );

    // 2. ZEMİN (geniş, Z ekseninde dar - side-scroller)
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x4a7c59,
        roughness: 0.9,
        metalness: 0.0
    });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 0.5, 6), groundMat);
    ground.position.set(0, -0.25, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Box(new CANNON.Vec3(30, 0.25, 3)));
    groundBody.position.set(0, -0.25, 0);
    world.addBody(groundBody);

    // 3. 3D AĞAÇLAR (Arka planda, Z ekseninde)
    function createTree3D(x, y, z, scale = 1) {
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

        group.position.set(x, y, z);
        scene.add(group);
        return group;
    }

    // Ağaçları arka plana yerleştir (Z ekseninde -4 ile -8 arası)
    const treePositions = [];
    for (let x = -25; x <= 25; x += 4 + Math.random() * 3) {
        for (let z = -8; z <= -4; z += 3 + Math.random() * 2) {
            if (Math.random() > 0.4) {
                treePositions.push({
                    x: x + (Math.random() - 0.5) * 2,
                    z: z + (Math.random() - 0.5) * 1.5,
                    scale: 0.6 + Math.random() * 0.8
                });
            }
        }
    }
    treePositions.forEach(pos => {
        createTree3D(pos.x, 0, pos.z, pos.scale);
    });

    // 4. PLATFORMLAR (Zıplama için)
    function createPlatform(x, y, w, h, color = 0x8a7a6a) {
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), mat);
        mesh.position.set(x, y, 0);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        scene.add(mesh);

        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, 2)));
        body.position.set(x, y, 0);
        world.addBody(body);
    }

    const platforms = [
        [-3, 2.5, 3, 0.8, 0x7a8a7a],
        [3, 4.0, 3, 0.8, 0x8a9a8a],
        [9, 5.5, 3, 0.8, 0x9aaa8a],
        [15, 7.0, 3, 0.8, 0xaa9a7a],
        [21, 8.5, 3, 0.8, 0xbaaa8a],
        [27, 10.0, 3, 0.8, 0xcaaa7a],
    ];
    platforms.forEach(([x, y, w, h, c]) => {
        createPlatform(x, y, w, h, c);
    });

    // 5. BİTİŞ NOKTASI
    const finishMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff5500,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
    });
    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), finishMat);
    finishMesh.position.set(33, 11, 0);
    finishMesh.castShadow = true;
    scene.add(finishMesh);

    const finishBody = new CANNON.Body({ mass: 0 });
    finishBody.addShape(new CANNON.Box(new CANNON.Vec3(1, 1, 2)));
    finishBody.position.set(33, 11, 0);
    world.addBody(finishBody);
}

// =============================================
// 🤖 KARAKTER OLUŞTURMA (Tekerlekli)
// =============================================
function createCharacter(color, isP1 = true) {
    const group = new THREE.Group();

    // 1. TEKERLEK (ayak)
    const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.4,
        metalness: 0.8
    });
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), wheelMat);
    wheel.position.y = 0;
    wheel.castShadow = true;
    group.add(wheel);

    // Tekerlek jantı (dekoratif)
    const rimMat = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.3,
        metalness: 0.9
    });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8), rimMat);
    rim.position.y = 0;
    rim.rotation.x = Math.PI / 2;
    group.add(rim);

    // 2. GÖVDE
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

    // 3. KAFA
    const headMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.2,
        metalness: 0.9
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), headMat);
    head.position.y = 2.2;
    head.castShadow = true;
    group.add(head);

    // 4. GÖZLER (parlayan)
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

    // 5. KOLLAR
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

    // 6. KOL BAĞLANTILARI (tekerlek-gövde arası)
    const connectMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.5,
        metalness: 0.6
    });
    const connect = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6),
        connectMat
    );
    connect.position.y = 0.6;
    group.add(connect);

    return group;
}

// =============================================
// ANA OYUN
// =============================================
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 40, 60);

    // 2.5D Kamera (Side-scroller)
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 8, 14);
    camera.lookAt(0, 3, 0);

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
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 50;
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

    // Z eksenini kilitle
    p1Body.position.z = 0;
    p2Body.position.z = 0;

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

    // Yedek yükleme
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

function resetPlayer(body, x) {
    body.position.set(x, START_Y, 0);
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

        // Z eksenini sabit tut
        p1Body.position.z = 0;
        p2Body.position.z = 0;

        // Hareket (sadece X ekseninde)
        const speed = 60;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;

        // Zıplama
        if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.5) {
            p1Body.velocity.y = 70;
            inputs.p1.jump = false;
        }
        if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.5) {
            p2Body.velocity.y = 70;
            inputs.p2.jump = false;
        }

        // Görsel güncelle
        if (p1Mesh) {
            p1Mesh.position.copy(p1Body.position);
            // Tekerlek dönüşü (hareket yönünde)
            const wheel = p1Mesh.children[0];
            if (wheel && wheel.isMesh) {
                wheel.rotation.z += p1Body.velocity.x * dt * 2;
            }
            // Hareket yönüne dön
            if (p1Body.velocity.x > 0.5) p1Mesh.scale.x = 0.8;
            else if (p1Body.velocity.x < -0.5) p1Mesh.scale.x = -0.8;
        }
        if (p2Mesh) {
            p2Mesh.position.copy(p2Body.position);
            const wheel = p2Mesh.children[0];
            if (wheel && wheel.isMesh) {
                wheel.rotation.z += p2Body.velocity.x * dt * 2;
            }
            if (p2Body.velocity.x > 0.5) p2Mesh.scale.x = 0.8;
            else if (p2Body.velocity.x < -0.5) p2Mesh.scale.x = -0.8;
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
            const dir = p1Body.position.x < p2Body.position.x ? -1 : 1;
            p1Body.velocity.x = dir * 30;
            p2Body.velocity.x = -dir * 30;
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

    // 2.5D Kamera takibi (X ve Y ekseninde)
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2 + 3;
    
    camera.position.x += (midX - camera.position.x) * 0.04;
    camera.position.y += (midY + 5 - camera.position.y) * 0.04;
    camera.lookAt(midX, midY, 0);

    renderer.render(scene, camera);
}

window.onload = init;