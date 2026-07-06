// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body, finishMesh; 
let isGameStarted = false;
let loadedCount = 0;
const totalFilesToLoad = 3; 
let levelObjects = []; 
let lastTime = performance.now();
let activeTouches = {};

// 📍 Kamera dedektöründen gelen tam koordinatlara göre doğma noktası
const START_X = 175.7;
const START_Y = 415.4; 
const START_Z = 2303.7;

const inputs = {
    p1: { moveX: 0, moveZ: 0, jump: false },
    p2: { moveX: 0, moveZ: 0, jump: false }
};

// 🟩 CANLI YÜKLENME BARI GÜNCELLEME
function updateLoadingProgress() {
    if (isGameStarted) return; // Oyun zaten başladıysa tetikleme
    
    loadedCount++;
    const percentage = Math.min(Math.floor((loadedCount / totalFilesToLoad) * 100), 100);
    
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');
    
    if(progressBar) progressBar.style.width = percentage + '%';
    if(loadingText) loadingText.innerText = `Modeller Hazırlanıyor... (%${percentage})`;

    if (loadedCount >= totalFilesToLoad) {
        forceStartGame();
    }
}

// 🛡️ NE OLURSA OLSUN OYUNU AÇAN ZORLA BAŞLATMA FONKSİYONU
function forceStartGame() {
    const loadingText = document.getElementById('loading-text');
    const progressCont = document.getElementById('progress-container');
    const playBtn = document.getElementById('play-btn');
    
    if(loadingText) loadingText.style.display = 'none';
    if(progressCont) progressCont.style.display = 'none';
    if(playBtn) playBtn.style.display = 'block';
}

// --- INITIALIZATION ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 15000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(START_X + 200, START_Y + 500, START_Z + 200);
    scene.add(dirLight);

    // Fizik Dünyası
    world = new CANNON.World();
    world.gravity.set(0, -35, 0); 

    const playerMat = new CANNON.Material("playerMat");
    
    p1Body = createPhysicsPlayer(START_X - 25, START_Y, START_Z, playerMat);
    p2Body = createPhysicsPlayer(START_X + 25, START_Y, START_Z, playerMat);

    // ⏱️ ZAMAN AŞIMI KORUMASI (4 Saniye içinde yüklenmezse zorla butonu aç)
    setTimeout(() => {
        if (loadedCount < totalFilesToLoad) {
            console.warn("Yükleme çok uzun sürdü, koruma modu devreye giriyor...");
            const progressBar = document.getElementById('progress-bar');
            if(progressBar) progressBar.style.width = '100%';
            forceStartGame();
        }
    }, 4000);

    const objLoader = new THREE.OBJLoader();
    const p1Mat = new THREE.MeshStandardMaterial({ color: 0x0055ff, roughness: 0.4 });
    const p2Mat = new THREE.MeshStandardMaterial({ color: 0xff2222, roughness: 0.4 });

    // 👤 1. Oyuncu OBJ Yükleme (Korumalı)
    try {
        objLoader.load('assets/models/puppet_1.obj', (obj) => {
            obj.traverse((child) => {
                if (child.isMesh) child.material = p1Mat;
            });
            p1Mesh = obj;
            p1Mesh.scale.set(35, 35, 35); 
            scene.add(p1Mesh);
            updateLoadingProgress();
        }, undefined, (error) => {
            console.error("p1 yükleme hatası:", error);
            fallbackP1(p1Mat);
        });
    } catch(e) {
        fallbackP1(p1Mat);
    }

    // 🤖 2. Oyuncu OBJ Yükleme (Korumalı)
    try {
        objLoader.load('assets/models/soviet_robot.obj', (obj) => {
            obj.traverse((child) => {
                if (child.isMesh) child.material = p2Mat;
            });
            p2Mesh = obj;
            p2Mesh.scale.set(20, 20, 20); 
            scene.add(p2Mesh);
            updateLoadingProgress();
        }, undefined, (error) => {
            console.error("p2 yükleme hatası:", error);
            fallbackP2(p2Mat);
        });
    } catch(e) {
        fallbackP2(p2Mat);
    }

    document.getElementById('play-btn').addEventListener('click', () => {
        isGameStarted = true;
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('p1-joystick-zone').style.display = 'block';
        document.getElementById('p1-action-btn').style.display = 'flex';
        document.getElementById('p2-joystick-zone').style.display = 'block';
        document.getElementById('p2-action-btn').style.display = 'flex';
    });

    loadGLBMap();
    setupTouchControls();
    animate();
}

// Yedek Küp Fonksiyonları
function fallbackP1(mat) {
    p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(15, 30, 15), mat);
    scene.add(p1Mesh); 
    updateLoadingProgress();
}
function fallbackP2(mat) {
    p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(15, 30, 15), mat);
    scene.add(p2Mesh); 
    updateLoadingProgress();
}

// --- HARİTA YÜKLEME ---
function loadGLBMap() {
    const loader = new THREE.GLTFLoader();
    loader.load('assets/models/harita1.glb', (gltf) => {
        const map = gltf.scene;
        map.scale.set(1, 1, 1); 
        map.position.set(0, 0, 0);
        scene.add(map);

        map.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;

                const box = new THREE.Box3().setFromObject(child);
                const size = new THREE.Vector3(); box.getSize(size);
                const center = new THREE.Vector3(); box.getCenter(center);
                
                const body = new CANNON.Body({
                    mass: 0,
                    shape: new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2))
                });
                body.position.set(center.x, center.y, center.z);
                world.addBody(body);
                levelObjects.push({ mesh: child, body: body });
            }
        });
        updateLoadingProgress(); 
    }, undefined, (e) => {
        console.error("Harita yüklenemedi:", e);
        updateLoadingProgress();
    });

    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(150, 80, 20), new THREE.MeshBasicMaterial({ visible: false }));
    finishMesh.position.set(START_X, START_Y, START_Z - 1500); 
    scene.add(finishMesh);
}

function createPhysicsPlayer(x, y, z, mat) {
    const body = new CANNON.Body({ mass: 450, material: mat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(7.5, 15, 7.5))); 
    body.position.set(x, y, z);
    body.fixedRotation = true;
    world.addBody(body);
    return body;
}

function setupTouchControls() {
    setupJoystick('p1-joystick-zone', 'p1-joystick-stick', (x, z) => { inputs.p1.moveX = x; inputs.p1.moveZ = z; });
    setupJoystick('p2-joystick-zone', 'p2-joystick-stick', (x, z) => { inputs.p2.moveX = x; inputs.p2.moveZ = z; });
    document.getElementById('p1-action-btn').addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p1.jump = true; });
    document.getElementById('p2-action-btn').addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p2.jump = true; });
}

function setupJoystick(zId, sId, cb) {
    const zone = document.getElementById(zId);
    const stick = document.getElementById(sId);
    if(!zone || !stick) return;

    zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        activeTouches[zId] = { id: t.identifier, x: t.clientX, y: t.clientY };
    });

    zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const tData = activeTouches[zId];
        if(!tData) return;

        for(let i=0; i<e.touches.length; i++) {
            if(e.touches[i].identifier === tData.id) {
                let dx = e.touches[i].clientX - tData.x;
                let dy = e.touches[i].clientY - tData.y;
                const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 30);
                const angle = Math.atan2(dy, dx);
                dx = Math.cos(angle) * dist; dy = Math.sin(angle) * dist;
                stick.style.transform = `translate(${dx}px, ${dy}px)`;
                cb(dx/30, dy/30);
                break;
            }
        }
    });

    const endHandle = (e) => { stick.style.transform = `translate(0px, 0px)`; cb(0, 0); delete activeTouches[zId]; };
    zone.addEventListener('touchend', endHandle); zone.addEventListener('touchcancel', endHandle);
}

function resetPlayerToStart() {
    p1Body.position.set(START_X - 25, START_Y, START_Z); p1Body.velocity.set(0,0,0);
    p2Body.position.set(START_X + 25, START_Y, START_Z); p2Body.velocity.set(0,0,0);
}

function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now();
    let dt = (time - lastTime) / 1000;
    lastTime = time;
    if(dt > 0.1) dt = 0.1;

    if (isGameStarted) {
        world.step(1/60, dt, 3);
        
        const speed = 180;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;
        p2Body.velocity.z = inputs.p2.moveZ * speed;

        if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.5) { p1Body.velocity.y = 45; inputs.p1.jump = false; }
        if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.5) { p2Body.velocity.y = 45; inputs.p2.jump = false; }

        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 15; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 15; }

        if (p1Body.position.y < START_Y - 200 || p2Body.position.y < START_Y - 200) {
            resetPlayerToStart();
        }
    }

    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, midX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, midY + 90, 0.05); 
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, midZ + 180, 0.05); 

    camera.lookAt(midX, midY + 15, midZ - 20);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);
window.onload = init;