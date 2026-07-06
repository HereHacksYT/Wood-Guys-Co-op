// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body, finishMesh; 
let isGameStarted = false;
let modelsLoadedCount = 0;
let levelObjects = []; 
let lastTime = performance.now();
let activeTouches = {};

// 📍 Devasa boyutlara göre başlangıç yüksekliği ayarlandı (Y: 4500)
const START_X = 175.7;
const START_Y = 4500.0; 
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
    scene.background = new THREE.Color(0x87ceeb);

    // 🪐 Görüş mesafesini (far plane) 300.000 yaptık ki devasa karakterler etrafı görebilsin!
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 300000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(START_X + 5000, START_Y + 10000, START_Z + 5000);
    scene.add(dirLight);

    // Fizik Dünyası ve Yerçekimi (Devasa kütleler için aşağı çekim artırıldı)
    world = new CANNON.World();
    world.gravity.set(0, -150, 0); 

    const playerMat = new CANNON.Material("playerMat");
    
    // 📐 FİZİK KUTULARI 10.000 KAT BÜYÜDÜ: (Genişlik: 2000, Yükseklik: 4000, Derinlik: 2000)
    p1Body = createPhysicsPlayer(START_X - 3000, START_Y, START_Z, playerMat);
    p2Body = createPhysicsPlayer(START_X + 3000, START_Y, START_Z, playerMat);

    const loader = new THREE.GLTFLoader();
    
    // P1 Görsel Model (10.000 Kat Büyük)
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.scale.set(10000, 10000, 10000); 
        scene.add(p1Mesh);
        checkModelsReady();
    }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(2000, 4000, 2000), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
        scene.add(p1Mesh); checkModelsReady();
    });

    // P2 Görsel Model (10.000 Kat Büyük)
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.scale.set(4500, 4500, 4500); 
        scene.add(p2Mesh);
        checkModelsReady();
    }, undefined, () => {
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(2000, 4000, 2000), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
        scene.add(p2Mesh); checkModelsReady();
    });

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

// --- HARİTA AYNI KALDI ---
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
                    shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2))
                });
                body.position.set(center.x, center.y, center.z);
                world.addBody(body);
                levelObjects.push({ mesh: child, body: body });
            }
        });
    }, undefined, (e) => {
        console.log("Harita yüklenemedi!");
    });

    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(10000, 5000, 500), new THREE.MeshBasicMaterial({ visible: false }));
    finishMesh.position.set(START_X, START_Y, START_Z - 50000); 
    scene.add(finishMesh);
}

function createPhysicsPlayer(x, y, z, mat) {
    // Kütle süper dev boyut için inanılmaz artırıldı (Mass: 50.000)
    const body = new CANNON.Body({ mass: 50000, material: mat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(1000, 2000, 1000))); 
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
    p1Body.position.set(START_X - 1500, START_Y, START_Z); p1Body.velocity.set(0,0,0);
    p2Body.position.set(START_X + 1500, START_Y, START_Z); p2Body.velocity.set(0,0,0);
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
        
        // 🏃 Yavaşlamayı çözmek için hızı 400'den 12.000'e çıkardım!
        const speed = 12000;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;
        p2Body.velocity.z = inputs.p2.moveZ * speed;

        // Süper dev zıplama ivmesi
        if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 5.0) { p1Body.velocity.y = 1200; inputs.p1.jump = false; }
        if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 5.0) { p2Body.velocity.y = 1200; inputs.p2.jump = false; }

        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 2000; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 2000; }

        if (p1Body.position.y < START_Y - 15000 || p2Body.position.y < START_Y - 15000) {
            resetPlayerToStart();
        }
    }

    // 🎥 KAMERA TAKİBİ: Karakterler galaktik boyuta ulaştığı için kamera çok daha geriye çekildi
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, midX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, midY + 12000, 0.05); // Karakterlerin üstten bakışı
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, midZ + 25000, 0.05); // Karakterlerin arkasından takip mesafesi

    camera.lookAt(midX, midY + 1000, midZ - 2000);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);
window.onload = init;