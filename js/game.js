// ==========================================
// 🎮 ROBOT GUYS CO-OP - ANA OYUN (TAM)
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

const START_X = 0, START_Y = 20, START_Z = 0;

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

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x6ba5d6);
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 15000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(200, 500, 200);
    scene.add(dirLight);

    initPhysics();
    p1Body = createPhysicsPlayer(START_X - 5, START_Y, START_Z);
    p2Body = createPhysicsPlayer(START_X + 5, START_Y, START_Z);

    // Sesler
    const audioLoader = new THREE.AudioLoader();
    clashSound = new THREE.Audio(new THREE.AudioListener());
    fallSound = new THREE.Audio(new THREE.AudioListener());
    try {
        audioLoader.load('assets/audio/dragon-studio-sword-clashhit-393837.mp3', (b) => {
            clashSound.setBuffer(b); clashSound.setVolume(0.5);
        });
        audioLoader.load('assets/audio/freesound_community-body-falling-to-ground-100474.mp3', (b) => {
            fallSound.setBuffer(b); fallSound.setVolume(0.5);
        });
    } catch(e) { console.warn('Ses yüklenemedi'); }

    const objLoader = new THREE.OBJLoader();
    const p1Mat = new THREE.MeshStandardMaterial({ color: 0x0044cc, roughness: 0.5 });
    const p2Mat = new THREE.MeshStandardMaterial({ color: 0xcc1111, roughness: 0.5 });

    objLoader.load('assets/models/puppet_1.obj', (obj) => {
        obj.traverse(c => { if (c.isMesh) c.material = p1Mat; });
        p1Mesh = obj; p1Mesh.scale.set(5,5,5); scene.add(p1Mesh); updateLoadingProgress();
    }, undefined, () => { fallbackP1(p1Mat); });

    objLoader.load('assets/models/soviet_robot.obj', (obj) => {
        obj.traverse(c => { if (c.isMesh) c.material = p2Mat; });
        p2Mesh = obj; p2Mesh.scale.set(3,3,3); scene.add(p2Mesh); updateLoadingProgress();
    }, undefined, () => { fallbackP2(p2Mat); });

    loadOBJMap();
    createFinishPoint();

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

function fallbackP1(mat) { if (!p1Mesh) { p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(2,4,2), mat); scene.add(p1Mesh); updateLoadingProgress(); } }
function fallbackP2(mat) { if (!p2Mesh) { p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(2,4,2), mat); scene.add(p2Mesh); updateLoadingProgress(); } }

function createFinishPoint() {
    const geo = new THREE.BoxGeometry(3, 3, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff5500, emissiveIntensity: 0.5 });
    finishMesh = new THREE.Mesh(geo, mat);
    finishMesh.position.set(30, 5, 0);
    scene.add(finishMesh);
}

function loadOBJMap() {
    const objLoader = new THREE.OBJLoader();
    objLoader.load('assets/models/Harita.obj', (obj) => {
        scene.add(obj);
        obj.traverse(child => {
            if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
                const box = new THREE.Box3().setFromObject(child);
                const size = new THREE.Vector3(); box.getSize(size);
                const center = new THREE.Vector3(); box.getCenter(center);
                if (size.length() > 0.5) {
                    addStaticPhysics(child, size, center);
                }
            }
        });
        updateLoadingProgress();
    }, undefined, () => {
        createFallbackGround();
        updateLoadingProgress();
    });
}

function createFallbackGround() {
    const geo = new THREE.BoxGeometry(500, 2, 500);
    const mat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -1, 0);
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(250, 1, 250)));
    body.position.set(0, -1, 0);
    world.addBody(body);
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

        const speed = 120;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;
        p2Body.velocity.z = inputs.p2.moveZ * speed;

        if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 1.0) {
            p1Body.velocity.y = 90;
            inputs.p1.jump = false;
        }
        if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 1.0) {
            p2Body.velocity.y = 90;
            inputs.p2.jump = false;
        }

        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 2; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 2; }

        // Düşme ve can
        if (p1Body.position.y < -50) {
            p1Health = Math.max(0, p1Health - 10);
            resetPlayer(p1Body, START_X - 5);
            if (fallSound) fallSound.play();
        }
        if (p2Body.position.y < -50) {
            p2Health = Math.max(0, p2Health - 10);
            resetPlayer(p2Body, START_X + 5);
            if (fallSound) fallSound.play();
        }

        // Oyuncu çarpışması (itme + ses)
        const dist = p1Body.position.distanceTo(p2Body.position);
        if (dist < 3.0) {
            const dir = new CANNON.Vec3().copy(p2Body.position).vsub(p1Body.position);
            dir.normalize();
            p1Body.velocity.vadd(dir.scale(-50), p1Body.velocity);
            p2Body.velocity.vadd(dir.scale(50), p2Body.velocity);
            if (clashSound) clashSound.play();
        }

        // Bitiş
        if (finishMesh) {
            if (p1Body.position.distanceTo(finishMesh.position) < 3 ||
                p2Body.position.distanceTo(finishMesh.position) < 3) {
                alert('🎉 Tebrikler! Kazandınız!');
                resetPlayer(p1Body, START_X - 5);
                resetPlayer(p2Body, START_X + 5);
                p1Health = MAX_HEALTH;
                p2Health = MAX_HEALTH;
            }
        }

        // UI güncelle
        document.getElementById('p1-health').style.width = (p1Health / MAX_HEALTH * 100) + '%';
        document.getElementById('p2-health').style.width = (p2Health / MAX_HEALTH * 100) + '%';
    }

    // Kamera
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2 + 10;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;
    camera.position.x += (midX - camera.position.x) * 0.05;
    camera.position.y += (midY + 25 - camera.position.y) * 0.05;
    camera.position.z += (midZ + 60 - camera.position.z) * 0.05;
    camera.lookAt(midX, midY + 5, midZ);

    renderer.render(scene, camera);
}

window.onload = init;