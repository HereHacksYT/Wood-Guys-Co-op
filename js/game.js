// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body, finishMesh; 
let isGameStarted = false;
let modelsLoadedCount = 0;
let levelObjects = []; 
let lastTime = performance.now();
let activeTouches = {};

// 📍 DÜNYA MERKEZİ: Her şey tam 0,0,0 noktasında buluşacak
const START_X = 0;
const START_Y = 80;  // Karakterlerin boyu devasa (80 birim) olduğu için havada kalmasınlar, 80 ideal
const START_Z = 0;

const inputs = {
    p1: { moveX: 0, moveZ: 0, jump: false },
    p2: { moveX: 0, moveZ: 0, jump: false }
};

// 🛠️ JOYSTICK VE DÜĞME ZORLAYICI (HTML/CSS hatası varsa arayüzü kodla garantiye alıyoruz)
function forceUIElements() {
    const p1Cont = document.getElementById('p1-controls');
    const p1Act = document.getElementById('p1-action-btn');
    const p2Cont = document.getElementById('p2-controls');
    const p2Act = document.getElementById('p2-action-btn');
    
    if(p1Cont) p1Cont.style.setProperty('display', 'block', 'important');
    if(p1Act) p1Act.style.setProperty('display', 'flex', 'important');
    if(p2Cont) p2Cont.style.setProperty('display', 'block', 'important');
    if(p2Act) p2Act.style.setProperty('display', 'flex', 'important');
}

function checkModelsReady() {
    modelsLoadedCount++;
    if (modelsLoadedCount >= 2) {
        const loadingText = document.getElementById('loading-text');
        const playBtn = document.getElementById('play-btn');
        if(loadingText) loadingText.style.display = 'none';
        if(playBtn) playBtn.style.display = 'block';
    }
}

// --- INITIALIZATION ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Gökyüzü mavisi

    // Görüş mesafesini 30000 yaparak ufkun kararmasını engelledik
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 30000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Devasa dünyaya uygun güçlü aydınlatma
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(0, 3000, 1500);
    scene.add(dirLight);

    // Fizik Dünyası Ayarları
    world = new CANNON.World();
    world.gravity.set(0, -40, 0); // Karakterlerin yere sağlam basması için ağırlık -40 yapıldı

    const playerMat = new CANNON.Material("playerMat");
    
    // Devasa karakter fizik gövdeleri (Genişlik: 40, Yükseklik: 80, Derinlik: 40)
    p1Body = createPhysicsPlayer(START_X - 60, START_Y, START_Z, playerMat);
    p2Body = createPhysicsPlayer(START_X + 60, START_Y, START_Z, playerMat);

    const loader = new THREE.GLTFLoader();
    
    // P1 100 Kat Büyük Görsel Model
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.scale.set(100, 100, 100); 
        scene.add(p1Mesh);
        checkModelsReady();
    }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 80, 40), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
        scene.add(p1Mesh); checkModelsReady();
    });

    // P2 100 Kat Büyük Görsel Model
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.scale.set(45, 45, 45); 
        scene.add(p2Mesh);
        checkModelsReady();
    }, undefined, () => {
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 80, 40), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
        scene.add(p2Mesh); checkModelsReady();
    });

    document.getElementById('play-btn').addEventListener('click', () => {
        isGameStarted = true;
        const menu = document.getElementById('menu-container');
        if(menu) menu.style.display = 'none';
        forceUIElements(); // Oyna butonuna basıldığı an tuşları zorla ekrana getirir
    });

    loadGLBMap();
    setupTouchControls();
    animate();
}

// --- HARİTAYI EKSENİNE GÖRE SIFIRLAYARAK YÜKLEME ---
function loadGLBMap() {
    const loader = new THREE.GLTFLoader();
    loader.load('assets/models/harita1.glb', (gltf) => {
        const map = gltf.scene;
        map.scale.set(100, 100, 100);
        
        // 🛠️ YENİ DÜZELTME: Senin çektiğin ekran görüntüsündeki kameranın tam karşısında durması için 
        // haritayı karakterlerin doğduğu koordinatın (0,0,0) tam altına çektik.
        map.position.set(-175.7 * 100, -415.4 * 100, -2303.7 * 100); 
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
    }, undefined, (e) => {
        console.log("Harita yüklenemedi!");
    });

    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(600, 300, 50), new THREE.MeshBasicMaterial({ visible: false }));
    finishMesh.position.set(START_X, START_Y, START_Z - 5000); 
    scene.add(finishMesh);
}

function createPhysicsPlayer(x, y, z, mat) {
    const body = new CANNON.Body({ mass: 350, material: mat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(20, 40, 20)));
    body.position.set(x, y, z);
    body.fixedRotation = true;
    world.addBody(body);
    return body;
}

function setupTouchControls() {
    setupJoystick('p1-joystick-zone', 'p1-joystick-stick', (x, z) => { inputs.p1.moveX = x; inputs.p1.moveZ = z; });
    setupJoystick('p2-joystick-zone', 'p2-joystick-stick', (x, z) => { inputs.p2.moveX = x; inputs.p2.moveZ = z; });
    
    const btn1 = document.getElementById('p1-action-btn');
    const btn2 = document.getElementById('p2-action-btn');
    if(btn1) btn1.addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p1.jump = true; });
    if(btn2) btn2.addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p2.jump = true; });
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
    p1Body.position.set(START_X - 60, START_Y, START_Z); p1Body.velocity.set(0,0,0);
    p2Body.position.set(START_X + 60, START_Y, START_Z); p2Body.velocity.set(0,0,0);
}

// --- MAIN LOOP ---
function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now();
    let dt = (time - lastTime) / 1000;
    lastTime = time;
    if(dt > 0.1) dt = 0.1;

    if (isGameStarted) {
        world.step(1/60, dt, 3);
        
        // Devasa boyutlara göre yürüme hızı dengelendi
        const speed = 500;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;
        p2Body.velocity.z = inputs.p2.moveZ * speed;

        if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 2.0) { p1Body.velocity.y = 105; inputs.p1.jump = false; }
        if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 2.0) { p2Body.velocity.y = 105; inputs.p2.jump = false; }

        // Görsel mesh objelerini tam fizik gövde merkezine oturtma
        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 40; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 40; }

        // Eğer haritadan aşağı boşluğa düşerlerse canlanma noktası
        if (p1Body.position.y < -400 || p2Body.position.y < -400) {
            resetPlayerToStart();
        }
    }

    // 🎥 ARKA KAMERA SABİTLEMESİ (Karakterlerin tam 600 birim gerisinden ve 300 birim yukarısından takip)
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, midX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, midY + 300, 0.05); 
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, midZ + 600, 0.05); 

    camera.lookAt(midX, midY + 40, midZ - 100);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);
window.onload = init;