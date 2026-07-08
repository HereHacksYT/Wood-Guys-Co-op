// ==========================================
// 🎮 ROBOT GUYS CO-OP - 2D PLATFORMER
// (Wood Guy tarzı, demir karakterler)
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
const START_X = -8, START_Y = 3, START_Z = 0;

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
// 🏗️ 2D ARENA (Yandan görünüm)
// =============================================
function buildArena() {
    // 1. ZEMİN
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x3a3a4a,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 6), groundMat);
    ground.position.set(0, -0.5, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Box(new CANNON.Vec3(20, 0.5, 3)));
    groundBody.position.set(0, -0.5, 0);
    world.addBody(groundBody);

    // 2. ARKA PLAN (Gradient gökyüzü)
    const bgMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a2e,
        emissive: 0x2a2a4e,
        emissiveIntensity: 0.3,
        side: THREE.BackSide
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), bgMat);
    bg.position.set(0, 15, -5);
    scene.add(bg);

    // 3. PLATFORMLAR (Zıplayarak ilerle)
    function createPlatform(x, y, w, h, color = 0x6d6d7d) {
        const mat = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.6,
            metalness: 0.3
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

    // Platform dizilimi (ilerledikçe yükselen)
    const platforms = [
        [-5, 1.5, 3, 0.8, 0x6d7d8d],
        [0, 2.5, 3, 0.8, 0x7d8d9d],
        [5, 4.0, 3, 0.8, 0x8d9dad],
        [10, 5.5, 3, 0.8, 0x9dadbd],
        [15, 7.0, 3, 0.8, 0xadbdcb],
        [20, 8.5, 3, 0.8, 0xbdcddb],
        [25, 10.0, 3, 0.8, 0xcdddeb],
        [30, 11.5, 3, 0.8, 0xddcdaa],
        [35, 13.0, 3, 0.8, 0xeecdaa],
    ];

    platforms.forEach(([x, y, w, h, c]) => {
        createPlatform(x, y, w, h, c);
    });

    // 4. BİTİŞ NOKTASI (Altın küp)
    const finishMat = new THREE.MeshStandardMaterial({ 
        color: 0xffaa00,
        emissive: 0xff6600,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
    });
    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), finishMat);
    finishMesh.position.set(38, 14, 0);
    finishMesh.castShadow = true;
    scene.add(finishMesh);

    // Bitiş fiziği (görünmez)
    const finishBody = new CANNON.Body({ mass: 0 });
    finishBody.addShape(new CANNON.Box(new CANNON.Vec3(1, 1, 2)));
    finishBody.position.set(38, 14, 0);
    world.addBody(finishBody);

    // 5. DEKORATİF UÇURUM IŞIKLARI (Wood Guy tarzı)
    for (let i = -15; i < 40; i += 2) {
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0x445566,
            emissive: 0x223344,
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), glowMat);
        glow.position.set(i, -1, 0);
        scene.add(glow);
    }
}

// =============================================
// 🤖 DEMİR KARAKTER OLUŞTURMA
// =============================================
function createMetalCharacter(color, isP1 = true) {
    const group = new THREE.Group();

    // Gövde (Metalik)
    const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.3,
        metalness: 0.8,
        emissive: new THREE.Color(color).multiplyScalar(0.1)
    });

    // Ana gövde
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1), bodyMat);
    body.position.y = 1.2;
    body.castShadow = true;
    group.add(body);

    // Kafa (küre)
    const headMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.2,
        metalness: 0.9,
        emissive: new THREE.Color(color).multiplyScalar(0.1)
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), headMat);
    head.position.y = 2.4;
    head.castShadow = true;
    group.add(head);

    // Gözler (parlayan)
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

    // Kollar (silindir)
    const armMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.7
    });
    const armGeo = new THREE.CylinderGeometry(0.15, 0.2, 1, 6);
    
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.8, 1.4, 0);
    armL.rotation.z = 0.3;
    armL.castShadow = true;
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.8, 1.4, 0);
    armR.rotation.z = -0.3;
    armR.castShadow = true;
    group.add(armR);

    // Bacaklar
    const legMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.5,
        metalness: 0.6
    });
    const legGeo = new THREE.CylinderGeometry(0.2, 0.25, 1, 6);
    
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
    // Sahne (2D yandan görünüm)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);

    camera = new THREE.OrthographicCamera(
        -25, 25, // left, right
        15, -15, // top, bottom
        0.1, 100
    );
    camera.position.set(0, 8, 15);
    camera.lookAt(0, 5, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Işıklandırma
    const ambient = new THREE.AmbientLight(0x446688, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 25;
    dirLight.shadow.camera.bottom = -10;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x88bbff, 0.3);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    // Fizik (2D için Z ekseni kilitli)
    initPhysics();
    p1Body = createPhysicsPlayer(START_X, START_Y, START_Z);
    p2Body = createPhysicsPlayer(START_X + 1.5, START_Y, START_Z);

    // Hareket kısıtlaması (Z ekseninde sabit)
    p1Body.velocity.z = 0;
    p2Body.velocity.z = 0;

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
    } catch(e) { console.warn('Ses yüklenemedi'); }

    // 2D Arena
    buildArena();

    // Oyuncu modelleri (DEMİR)
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

    // Yedek yükleme
    setTimeout(() => {
        if (loadedCount < totalFilesToLoad) {
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
        const aspect = window.innerWidth / window.innerHeight;
        const viewSize = 15;
        if (aspect > 1) {
            camera.left = -viewSize * aspect;
            camera.right = viewSize * aspect;
            camera.top = viewSize;
            camera.bottom = -viewSize;
        } else {
            camera.left = -viewSize;
            camera.right = viewSize;
            camera.top = viewSize / aspect;
            camera.bottom = -viewSize / aspect;
        }
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function resetPlayer(body, x) {
    body.position.set(x, START_Y, START_Z);
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

        // Sadece X ekseninde hareket (Z sabit)
        const speed = 80;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p1Body.velocity.z = 0;
        p2Body.velocity.x = inputs.p2.moveX * speed;
        p2Body.velocity.z = 0;

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
            p1Mesh.position.y -= 0.5;
            // Hareket yönüne göre dönüş
            if (p1Body.velocity.x > 0.5) p1Mesh.rotation.y = 0;
            else if (p1Body.velocity.x < -0.5) p1Mesh.rotation.y = Math.PI;
        }
        if (p2Mesh) {
            p2Mesh.position.copy(p2Body.position);
            p2Mesh.position.y -= 0.5;
            if (p2Body.velocity.x > 0.5) p2Mesh.rotation.y = 0;
            else if (p2Body.velocity.x < -0.5) p2Mesh.rotation.y = Math.PI;
        }

        // Düşme
        if (p1Body.position.y < -10) {
            p1Health = Math.max(0, p1Health - 10);
            resetPlayer(p1Body, START_X);
            if (fallSound) fallSound.play();
        }
        if (p2Body.position.y < -10) {
            p2Health = Math.max(0, p2Health - 10);
            resetPlayer(p2Body, START_X + 1.5);
            if (fallSound) fallSound.play();
        }

        // Oyuncu çarpışması
        const dist = p1Body.position.distanceTo(p2Body.position);
        if (dist < 1.5) {
            const dir = new CANNON.Vec3().copy(p2Body.position).vsub(p1Body.position);
            dir.x = dir.x > 0 ? 1 : -1;
            p1Body.velocity.x = -30 * dir.x;
            p2Body.velocity.x = 30 * dir.x;
            if (clashSound) clashSound.play();
        }

        // Bitiş
        if (finishMesh) {
            if (p1Body.position.distanceTo(finishMesh.position) < 1.5 ||
                p2Body.position.distanceTo(finishMesh.position) < 1.5) {
                alert('🎉 Tebrikler! Bitişe ulaştınız!');
                resetPlayer(p1Body, START_X);
                resetPlayer(p2Body, START_X + 1.5);
                p1Health = MAX_HEALTH;
                p2Health = MAX_HEALTH;
            }
        }

        // UI
        document.getElementById('p1-health').style.width = (p1Health / MAX_HEALTH * 100) + '%';
        document.getElementById('p2-health').style.width = (p2Health / MAX_HEALTH * 100) + '%';
    }

    // Kamera takibi (ortalamayı takip et)
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2 + 2;
    camera.position.x += (midX - camera.position.x) * 0.04;
    camera.position.y += (midY - camera.position.y) * 0.04;
    camera.lookAt(midX, midY, 0);

    renderer.render(scene, camera);
}

window.onload = init;