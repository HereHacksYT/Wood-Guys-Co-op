// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body; 
let isGameStarted = false;
let loadedCount = 0;
const totalFilesToLoad = 3; // puppet, soviet ve harita
let levelObjects = []; 
let lastTime = performance.now();
let activeTouches = {};

// Doğma sıfır noktaları
const START_X = 0;
const START_Y = 20; 
const START_Z = 0;

const inputs = {
    p1: { moveX: 0, moveZ: 0, jump: false },
    p2: { moveX: 0, moveZ: 0, jump: false }
};

function updateLoadingProgress() {
    if (isGameStarted) return;
    loadedCount++;
    const percentage = Math.min(Math.floor((loadedCount / totalFilesToLoad) * 100), 100);
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');
    
    if(progressBar) progressBar.style.width = percentage + '%';
    if(loadingText) loadingText.innerText = `Modeller Yükleniyor... (%${percentage})`;

    if (loadedCount >= totalFilesToLoad) { showPlayButton(); }
}

function showPlayButton() {
    const loadingText = document.getElementById('loading-text');
    const progressCont = document.getElementById('progress-container');
    const playBtn = document.getElementById('play-btn');
    if(loadingText) loadingText.style.display = 'none';
    if(progressCont) progressCont.style.display = 'none';
    if(playBtn) playBtn.style.display = 'block';
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c); // Arka plan koyu tema yapıldı

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 15000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(START_X + 200, START_Y + 500, START_Z + 200);
    scene.add(dirLight);

    world = new CANNON.World();
    world.gravity.set(0, -350, 0); 

    const playerMat = new CANNON.Material("playerMat");
    p1Body = createPhysicsPlayer(START_X - 5, START_Y, START_Z, playerMat);
    p2Body = createPhysicsPlayer(START_X + 5, START_Y, START_Z, playerMat);

    // Güvenlik kilidi (Her ihtimale karşı donmayı engeller)
    setTimeout(() => {
        if (loadedCount < totalFilesToLoad) {
            showPlayButton();
        }
    }, 3000);

    const objLoader = new THREE.OBJLoader();
    const p1Mat = new THREE.MeshStandardMaterial({ color: 0x0055ff, roughness: 0.4 }); 
    const p2Mat = new THREE.MeshStandardMaterial({ color: 0xff2222, roughness: 0.4 });

    // P1 Yükle
    try {
        objLoader.load('assets/models/puppet_1.obj', (obj) => {
            obj.traverse((child) => { if (child.isMesh) child.material = p1Mat; });
            p1Mesh = obj; p1Mesh.scale.set(5, 5, 5); scene.add(p1Mesh); updateLoadingProgress();
        }, undefined, () => { updateLoadingProgress(); });
    } catch(e) { updateLoadingProgress(); }

    // P2 Yükle
    try {
        objLoader.load('assets/models/soviet_robot.obj', (obj) => {
            obj.traverse((child) => { if (child.isMesh) child.material = p2Mat; });
            p2Mesh = obj; p2Mesh.scale.set(3, 3, 3); scene.add(p2Mesh); updateLoadingProgress();
        }, undefined, () => { updateLoadingProgress(); });
    } catch(e) { updateLoadingProgress(); }

    document.getElementById('play-btn').addEventListener('click', () => {
        isGameStarted = true;
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('p1-joystick-zone').style.display = 'block';
        document.getElementById('p1-action-btn').style.display = 'flex';
        document.getElementById('p2-joystick-zone').style.display = 'block';
        document.getElementById('p2-action-btn').style.display = 'flex';
    });

    loadOBJMap();
    setupTouchControls();
    animate();
}

// --- 🛠️ MAP YÜKLEYİCİ (FOTOĞRAF DETAYLI) ---
function loadOBJMap() {
    const textureLoader = new THREE.TextureLoader();
    
    // GitHub'da duran boşluklu tam dosya adı yazıldı
    textureLoader.load('assets/textures/PNG görüntüsü.png', (mapTexture) => {
        
        mapTexture.wrapS = THREE.RepeatWrapping;
        mapTexture.wrapT = THREE.RepeatWrapping;

        const mapMat = new THREE.MeshStandardMaterial({ 
            map: mapTexture,
            roughness: 0.8
        });

        const objLoader = new THREE.OBJLoader();
        objLoader.load('assets/models/Harita.obj', (obj) => {
            scene.add(obj);
            obj.traverse((child) => {
                if (child.isMesh) {
                    child.material = mapMat; 
                    child.receiveShadow = true; 
                    child.castShadow = true;

                    const meshName = child.name.toLowerCase();
                    if (meshName.includes('tree') || meshName.includes('leaf') || meshName.includes('agac')) return;

                    const box = new THREE.Box3().setFromObject(child);
                    const size = new THREE.Vector3(); box.getSize(size);
                    const center = new THREE.Vector3(); box.getCenter(center);
                    
                    const body = new CANNON.Body({ mass: 0 });
                    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2)));
                    body.position.set(center.x, center.y, center.z);
                    world.addBody(body);
                    levelObjects.push({ mesh: child, body: body });
                }
            });
            updateLoadingProgress();
        }, undefined, () => { handleMapError(); });

    }, undefined, () => {
        console.warn("Doku resmi bulunamadı, düz renk yeşile dönülüyor.");
        const objLoader = new THREE.OBJLoader();
        objLoader.load('assets/models/Harita.obj', (obj) => {
            scene.add(obj);
            obj.traverse((child) => {
                if(child.isMesh) child.material = new THREE.MeshStandardMaterial({ color: 0x3b6e22 });
            });
            updateLoadingProgress();
        }, undefined, () => { handleMapError(); });
    });
}

function handleMapError() {
    createFallbackGround();
    updateLoadingProgress();
}

function createFallbackGround() {
    const groundGeo = new THREE.BoxGeometry(1000, 2, 1000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3b6e22 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, -1, 0);
    scene.add(groundMesh);

    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Box(new CANNON.Vec3(500, 1, 500)));
    groundBody.position.set(0, -1, 0);
    world.addBody(groundBody);
}

function createPhysicsPlayer(x, y, z, mat) {
    const body = new CANNON.Body({ mass: 300, material: mat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(1, 2, 1))); 
    body.position.set(x, y, z);
    body.fixedRotation = true;
    body.linearDamping = 0.1;
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

    const endHandle = () => { stick.style.transform = `translate(0px, 0px)`; cb(0, 0); delete activeTouches[zId]; };
    zone.addEventListener('touchend', endHandle); zone.addEventListener('touchcancel', endHandle);
}

function resetPlayerToStart() {
    p1Body.position.set(START_X - 5, START_Y, START_Z); p1Body.velocity.set(0,0,0);
    p2Body.position.set(START_X + 5, START_Y, START_Z); p2Body.velocity.set(0,0,0);
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    let dt = (time - lastTime) / 1000;
    lastTime = time;
    if(dt > 0.1) dt = 0.1;

    if (isGameStarted) {
        world.step(1/60, dt, 3);
        const speed = 120; 
        p1Body.velocity.x = inputs.p1.moveX * speed; p1Body.velocity.z = inputs.p1.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed; p2Body.velocity.z = inputs.p2.moveZ * speed;

        if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 1.0) { p1Body.velocity.y = 90; inputs.p1.jump = false; }
        if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 1.0) { p2Body.velocity.y = 90; inputs.p2.jump = false; }

        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 2; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 2; }

        if (p1Body.position.y < START_Y - 100 || p2Body.position.y < START_Y - 100) { resetPlayerToStart(); }
    }

    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, midX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, midY + 25, 0.05); 
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, midZ + 60, 0.05); 

    camera.lookAt(midX, midY + 5, midZ);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
window.onload = init;