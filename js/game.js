// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world, controls;
let p1Mesh, p2Mesh, p1Body, p2Body, finishMesh; 
let isGameStarted = false;
let modelsLoadedCount = 0;
let levelObjects = []; 
let lastTime = performance.now();
let activeTouches = {};

const inputs = {
    p1: { moveX: 0, moveZ: 0, jump: false },
    p2: { moveX: 0, moveZ: 0, jump: false }
};

// Ekrandaki Koordinat Paneli
let coordDiv;
function createMobileUI() {
    coordDiv = document.createElement('div');
    coordDiv.style = "position:absolute; top:10px; left:10px; color:white; background:rgba(0,0,0,0.7); padding:12px; border-radius:6px; font-size:13px; z-index:9999; pointer-events:none; font-family:monospace; line-height:1.5;";
    coordDiv.innerHTML = "Kamera koordinatları bekleniyor...";
    document.body.appendChild(coordDiv);
}

function checkModelsReady() {
    modelsLoadedCount++;
    if (modelsLoadedCount >= 2) {
        document.getElementById('loading-text').style.display = 'none';
        document.getElementById('play-btn').style.display = 'block';
    }
}

// --- INITIALIZATION ---
function init() {
    createMobileUI();
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Gökyüzü mavisi

    // 1. DÜZELTME: Görüş mesafesini (uzaktaki nesneleri yükleme sınırını) 2000'den 5000'e çıkardık.
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(0, 40, 80); // Haritayı daha da geniş görebilmek için kamerayı daha uzakta başlattık

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // 📱 MOBİL PARMAK KONTROLÜ
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Uzaklaşma sınırını da arttırdık ki parmağınla ekranı kıstığında çok daha geriye gidebil
    controls.maxDistance = 3000; 

    // Işıklar
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    // 🌐 BÜYÜTÜLMÜŞ YARDIMCI IZGARA
    // Haritayı uzaktan ararken yönünü kaybetme diye kılavuz çizgilerin boyutunu 1000 yaptık
    const grid = new THREE.GridHelper(1000, 100, 0xffffff, 0x555555);
    grid.position.y = -0.05;
    scene.add(grid);

    // Fizik Dünyası
    world = new CANNON.World();
    world.gravity.set(0, -15, 0);

    const playerMat = new CANNON.Material("playerMat");
    
    p1Body = createPhysicsPlayer(-2, 8, 0, playerMat);
    p2Body = createPhysicsPlayer(2, 8, 0, playerMat);

    const loader = new THREE.GLTFLoader();
    
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        scene.add(p1Mesh);
        checkModelsReady();
    }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
        scene.add(p1Mesh); checkModelsReady();
    });

    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.scale.set(0.5, 0.5, 0.5);
        scene.add(p2Mesh);
        checkModelsReady();
    }, undefined, () => {
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
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

function loadGLBMap() {
    const loader = new THREE.GLTFLoader();
    loader.load('assets/models/harita1.glb', (gltf) => {
        const map = gltf.scene;
        scene.add(map);
        map.position.set(0, 0, 0);

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
        console.log("Harita bulunamadı! assets/models/harita1.glb yolunu kontrol et.");
    });
}

function createPhysicsPlayer(x, y, z, mat) {
    const body = new CANNON.Body({ mass: 5, material: mat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5)));
    body.position.set(x, y, z);
    body.fixedRotation = true;
    world.addBody(body);
    return body;
}

function setupTouchControls() {
    setupJoystick('p1-joystick-zone', 'p1-joystick-stick', (x, z) => {
        inputs.p1.moveX = x; inputs.p1.moveZ = z;
    });
    setupJoystick('p2-joystick-zone', 'p2-joystick-stick', (x, z) => {
        inputs.p2.moveX = x; inputs.p2.moveZ = z;
    });

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
                
                dx = Math.cos(angle) * dist;
                dy = Math.sin(angle) * dist;
                
                stick.style.transform = `translate(${dx}px, ${dy}px)`;
                cb(dx/30, dy/30);
                break;
            }
        }
    });

    const endHandle = (e) => {
        stick.style.transform = `translate(0px, 0px)`;
        cb(0, 0);
        delete activeTouches[zId];
    };
    zone.addEventListener('touchend', endHandle);
    zone.addEventListener('touchcancel', endHandle);
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
        
        const speed = 7.5;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;
        p2Body.velocity.z = inputs.p2.moveZ * speed;

        if(inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.1) { p1Body.velocity.y = 9.5; inputs.p1.jump = false; }
        if(inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.1) { p2Body.velocity.y = 9.5; inputs.p2.jump = false; }

        if(p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 1; }
        if(p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 1; }

        if(p1Body.position.y < -100 || p2Body.position.y < -100) {
            p1Body.position.set(-2, 8, 0); p1Body.velocity.set(0,0,0);
            p2Body.position.set(2, 8, 0); p2Body.velocity.set(0,0,0);
        }
    }

    // 2. DÜZELTME: Artık panelde karakterin değil, bizzat aktif KAMERANIN koordinatları yazıyor
    if(coordDiv && camera) {
        coordDiv.innerHTML = `
            <b>🎥 KAMERA DEDEKTÖRÜ</b><br>
            Kamera X: ${camera.position.x.toFixed(1)}<br>
            Kamera Y: ${camera.position.y.toFixed(1)} (Yükseklik)<br>
            Kamera Z: ${camera.position.z.toFixed(1)}<br>
            <span style="color:#00ff00; font-size:11px;">* Parmağını kaydırdıkça kameranın yerini görebilirsin.</span>
        `;
    }

    if(controls) controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);
window.onload = init;