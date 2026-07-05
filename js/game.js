// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body, finishMesh; 
let isGameStarted = false;
let modelsLoadedCount = 0;
let levelObjects = []; 
let lastTime = performance.now();
let activeTouches = {};

// 100 Kat büyütülmüş dünyaya göre başlangıç noktaları
const START_X = 175.7;
const START_Y = 440.0; // Haritanın üzerine havadan düşüp tam oturmaları için Y yükseltildi
const START_Z = 2303.7;

const inputs = {
    p1: { moveX: 0, moveZ: 0, jump: false },
    p2: { moveX: 0, moveZ: 0, jump: false }
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
    scene.background = new THREE.Color(0x87ceeb); // Gökyüzü mavisi

    // Devasa dünya için görüş mesafesini (Far plane) 20000 yaptık ki uzaklar kararmasın
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Işıklandırma (Büyük dünyaya göre menzil ve pozisyon ölçeklendi)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(START_X + 500, START_Y + 1000, START_Z + 500);
    scene.add(dirLight);

    // 🔴 DÜZGÜN YERÇEKİMİ: Havaya uçmayı engellemek için net bir aşağı yönlü çekim (-35) verdik
    world = new CANNON.World();
    world.gravity.set(0, -35, 0);

    const playerMat = new CANNON.Material("playerMat");
    
    // 📐 Karakter fizik gövdelerini 100 kat büyütüyoruz (Genişlik: 40, Yükseklik: 80, Derinlik: 40)
    p1Body = createPhysicsPlayer(START_X - 50, START_Y, START_Z, playerMat);
    p2Body = createPhysicsPlayer(START_X + 50, START_Y, START_Z, playerMat);

    const loader = new THREE.GLTFLoader();
    
    // P1 Görsel Modelini 100 Kat Büyüt
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.scale.set(100, 100, 100); 
        scene.add(p1Mesh);
        checkModelsReady();
    }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 80, 40), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
        scene.add(p1Mesh); checkModelsReady();
    });

    // P2 Görsel Modelini 100 Kat Büyüt
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.scale.set(45, 45, 45); // Kendi ölçek yapısına göre 100 katına denk gelir
        scene.add(p2Mesh);
        checkModelsReady();
    }, undefined, () => {
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 80, 40), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
        scene.add(p2Mesh); checkModelsReady();
    });

    document.getElementById('play-btn').addEventListener('click', () => {
        isGameStarted = true;
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('p1-controls').style.display = 'block';
        document.getElementById('p1-action-btn').style.display = 'flex';
        document.getElementById('p2-controls').style.display = 'block';
        document.getElementById('p2-action-btn').style.display = 'flex';
    });

    loadGLBMap();
    setupTouchControls();
    animate();
}

// --- HARİTAYI DA 100 KAT BÜYÜTEREK YÜKLEME ---
function loadGLBMap() {
    const loader = new THREE.GLTFLoader();
    loader.load('assets/models/harita1.glb', (gltf) => {
        const map = gltf.scene;
        
        // 🛠️ KRİTİK AYAR: Haritanın kendisini de 100 kat büyütüyoruz ki karakterler altında ezilmesin
        map.scale.set(100, 100, 100);
        scene.add(map);
        map.position.set(0, 0, 0);

        map.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;

                // Büyütülmüş modelin üzerinden fizik sınırlarını hesapla
                const box = new THREE.Box3().setFromObject(child);
                const size = new THREE.Vector3(); box.getSize(size);
                const center = new THREE.Vector3(); box.getCenter(center);
                
                // Harita yüzeylerine basabilmemiz için statik (mass: 0) dev kutular
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

    // Bitiş alanını da devasa boyuta getirdik
    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(400, 200, 50), new THREE.MeshBasicMaterial({ visible: false }));
    finishMesh.position.set(START_X, START_Y, START_Z - 3000); 
    scene.add(finishMesh);
}

function createPhysicsPlayer(x, y, z, mat) {
    // Kütleyi büyüklüğe oranla arttırdık (mass: 300)
    const body = new CANNON.Body({ mass: 300, material: mat });
    // Çarpışma kutusu yarıçapı: Genişlik 20, Yükseklik 40, Derinlik 20 (Tam devasa boyutta)
    body.addShape(new CANNON.Box(new CANNON.Vec3(20, 40, 20)));
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
    p1Body.position.set(START_X - 50, START_Y, START_Z); p1Body.velocity.set(0,0,0);
    p2Body.position.set(START_X + 50, START_Y, START_Z); p2Body.velocity.set(0,0,0);
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
        
        // 🏃 HIZ DÜZENLEMESİ: Karakterlerin adımları devleştiği için yürüme hızını 400 yaptık
        const speed = 400;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;
        p2Body.velocity.z = inputs.p2.moveZ * speed;

        // Devasa zıplama ivmesi
        if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 2.0) { p1Body.velocity.y = 90; inputs.p1.jump = false; }
        if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 2.0) { p2Body.velocity.y = 90; inputs.p2.jump = false; }

        // Görsel modeli tam fizik merkezine oturtma (Y: Yüksekliğin yarısı kadar aşağı kaydırıldı)
        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 40; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 40; }

        // Haritadan aşağı uçurumdan düşme sınırı
        if (p1Body.position.y < START_Y - 400 || p2Body.position.y < START_Y - 400) {
            resetPlayerToStart();
        }
    }

    // 🎥 KAMERAYI DA DEV BOYUTLARA GÖRE ARKAYA ÇEKTİK
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, midX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, midY + 250, 0.05); // Devlerin 250 birim üzerinden bakar
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, midZ + 500, 0.05); // Devlerin 500 birim gerisinden takip eder

    camera.lookAt(midX, midY + 20, midZ - 50);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);
window.onload = init;