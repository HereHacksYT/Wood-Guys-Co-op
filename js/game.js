// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let finishMesh; 

let isGameStarted = false;
let modelsLoadedCount = 0;
let levelObjects = []; 

let lastTime = performance.now();
let p1InsideFinish = false;
let p2InsideFinish = false;

const GROUP_PLAYER1 = 1 << 0;
const GROUP_PLAYER2 = 1 << 1;
const GROUP_STATIC = 1 << 2;

let zeroFrictionMaterial;

// Kontrolleri İleri-Geri (moveZ) ve Sağa-Sola (moveX) olarak güncelledik
const inputs = {
    p1: { moveX: 0, moveZ: 0, jump: false },
    p2: { moveX: 0, moveZ: 0, jump: false }
};

let activeTouches = {};

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
    // 1. DÜZELTME: Siyah boşluk hissini yok etmek için gökyüzünü tatlı bir Orman Mavisi yapıyoruz
    scene.background = new THREE.Color(0xa3d2e2); 

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Kamerayı oyuncuların arkasına ve yukarısına konumlandırıyoruz (3D Takip Açısı)
    camera.position.set(0, 6, 12);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Işıklandırma (Orman haritasının renklerini canlı göstermek için güçlendirildi)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    world = new CANNON.World();
    world.gravity.set(0, -16, 0);

    zeroFrictionMaterial = new CANNON.Material("zeroFriction");
    const contactMaterial = new CANNON.ContactMaterial(
        zeroFrictionMaterial,
        zeroFrictionMaterial,
        { friction: 0.1, restitution: 0.0 }
    );
    world.addContactMaterial(contactMaterial);

    // 2. DÜZELTME: Karakterleri haritanın başlangıç noktasına (0, 2, 0) yerleştiriyoruz ki boşluğa düşmesinler
    p1Body = createPhysicsPlayer(-1, 3, 0, zeroFrictionMaterial);
    p2Body = createPhysicsPlayer(1, 3, 0, zeroFrictionMaterial);
    
    p1Body.collisionFilterGroup = GROUP_PLAYER1;
    p1Body.collisionFilterMask = GROUP_STATIC;
    p2Body.collisionFilterGroup = GROUP_PLAYER2;
    p2Body.collisionFilterMask = GROUP_STATIC;

    const loader = new THREE.GLTFLoader();

    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p1Mesh);
        checkModelsReady();
    }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        scene.add(p1Mesh); checkModelsReady();
    });

    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.scale.set(0.45, 0.45, 0.45);
        p2Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p2Mesh);
        checkModelsReady();
    }, undefined, () => {
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        scene.add(p2Mesh); checkModelsReady();
    });

    document.getElementById('play-btn').addEventListener('click', startGame);
    setupTouchControls();
    window.addEventListener('resize', onWindowResize);
    
    loadGLBMap();
    animate();
}

// --- .GLB ORMAN HARİTASINI YÜKLEME VE 3D FİZİĞE DÖKME ---
function loadGLBMap() {
    levelObjects.forEach(obj => { scene.remove(obj.mesh); world.remove(obj.body); });
    levelObjects = [];
    if(finishMesh) scene.remove(finishMesh);

    const loader = new THREE.GLTFLoader();

    // Sketchfab'dan indirdiğin harita dosyasının adı assets/models/harita1.glb olmalı
    loader.load('assets/models/harita1.glb', (gltf) => {
        const mapMesh = gltf.scene;
        scene.add(mapMesh);

        // Harita konumunu sıfırlıyoruz
        mapMesh.position.set(0, 0, 0);

        // Haritanın tüm kıvrımlı zemin ve duvarlarını 3 boyutlu fizik gövdesine dönüştürüyoruz
        mapMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                const box = new THREE.Box3().setFromObject(child);
                const size = new THREE.Vector3();
                box.getSize(size);
                const center = new THREE.Vector3();
                box.getCenter(center);

                // Gerçek 3D genişlik, yükseklik ve derinlik (BoxShape)
                const mapBody = new CANNON.Body({
                    mass: 0, 
                    shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
                    material: zeroFrictionMaterial
                });
                
                mapBody.position.set(center.x, center.y, center.z);
                mapBody.collisionFilterGroup = GROUP_STATIC;
                mapBody.collisionFilterMask = GROUP_PLAYER1 | GROUP_PLAYER2;
                
                world.addBody(mapBody);
                levelObjects.push({ mesh: child, body: mapBody });
            }
        });

    }, undefined, (err) => {
        console.error("3D Harita yüklenirken hata:", err);
    });

    // 3. DÜZELTME: Yol ileriye gittiği için bitiş çizgisini Z ekseninin sonuna koyuyoruz (Örn: Z = -50 derinliği)
    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 2), new THREE.MeshBasicMaterial({ visible: false }));
    finishMesh.position.set(0, 2, -50); 
    scene.add(finishMesh);
}

function handleInsideFinishLogic() {
    if (!finishMesh) return;
    const finishZ = finishMesh.position.z;
    
    // Z ekseninde bitişe varış kontrolü
    if (Math.abs(p1Body.position.z - finishZ) < 2.0) p1InsideFinish = true;
    if (Math.abs(p2Body.position.z - finishZ) < 2.0) p2InsideFinish = true;

    if (p1InsideFinish && p2InsideFinish) {
        p1InsideFinish = false; p2InsideFinish = false;
        resetPlayerToStart();
        loadGLBMap(); 
    }
}

function resetPlayerToStart() {
    p1InsideFinish = false; p2InsideFinish = false;
    // Boşluğa düşen oyuncular başlangıç patikasına geri ışınlanır
    p1Body.position.set(-1, 4, 0); p1Body.velocity.set(0, 0, 0);
    p2Body.position.set(1, 4, 0); p2Body.velocity.set(0, 0, 0);
}

function startGame() {
    isGameStarted = true;
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('p1-controls').style.display = 'block';
    document.getElementById('p2-controls').style.display = 'block';
}

function createPhysicsPlayer(x, y, z, physicsMaterial) {
    const body = new CANNON.Body({ mass: 5, material: physicsMaterial });
    // Alt kısma tam küre yerleştirerek basamakları rahat tırmanmasını sağlıyoruz
    body.addShape(new CANNON.Sphere(0.45), new CANNON.Vec3(0, -0.5, 0));
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.4, 0.5, 0.4)), new CANNON.Vec3(0, 0.3, 0));
    body.position.set(x, y, z);
    body.fixedRotation = true;
    body.updateMassProperties();
    world.addBody(body);
    return body;
}

function handleGameControls() {
    if (!isGameStarted) return;

    const speedMultiplier = 6.5;

    // --- OYUNCU 1 HAREKET HESAPLAMA (3D) ---
    p1Body.velocity.x = inputs.p1.moveX * speedMultiplier;
    p1Body.velocity.z = inputs.p1.moveZ * speedMultiplier; // Derinlemesine hareket

    if ((inputs.p1.moveX !== 0 || inputs.p1.moveZ !== 0) && p1Mesh) {
        // Karakterin baktığı yönü hareket yönüne göre çevirir
        p1Mesh.rotation.y = Math.atan2(inputs.p1.moveX, inputs.p1.moveZ);
    }
    if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.1) {
        p1Body.velocity.y = 8.5; inputs.p1.jump = false;
    }

    // --- OYUNCU 2 HAREKET HESAPLAMA (3D) ---
    p2Body.velocity.x = inputs.p2.moveX * speedMultiplier;
    p2Body.velocity.z = inputs.p2.moveZ * speedMultiplier;

    if ((inputs.p2.moveX !== 0 || inputs.p2.moveZ !== 0) && p2Mesh) {
        p2Mesh.rotation.y = Math.atan2(inputs.p2.moveX, inputs.p2.moveZ);
    }
    if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.1) {
        p2Body.velocity.y = 8.5; inputs.p2.jump = false;
    }

    // Haritadan aşağı düşme sınırı
    if (p1Body.position.y < -12 || p2Body.position.y < -12) {
        resetPlayerToStart();
    }

    handleInsideFinishLogic();
}

// 4. DÜZELTME: Dokunmatik analogları hem X (sağ-sol) hem Y/Z (ileri-geri) yönünü algılayacak şekilde 360 dereceye uyarladık
function setupTouchControls() {
    setupJoystick3D('p1-joystick-zone', 'p1-joystick-stick', (x, z) => {
        inputs.p1.moveX = x;
        inputs.p1.moveZ = z; 
    });
    setupJoystick3D('p2-joystick-zone', 'p2-joystick-stick', (x, z) => {
        inputs.p2.moveX = x;
        inputs.p2.moveZ = z;
    });

    document.getElementById('p1-action-btn').addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p1.jump = true; });
    document.getElementById('p2-action-btn').addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p2.jump = true; });
}

function setupJoystick3D(zoneId, stickId, callback) {
    const zone = document.getElementById(zoneId);
    const stick = document.getElementById(stickId);
    if(!zone || !stick) return;

    zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        activeTouches[zoneId] = { id: touch.identifier, startX: touch.clientX, startY: touch.clientY };
    });

    zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touchData = activeTouches[zoneId];
        if (!touchData) return;

        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === touchData.id) {
                let deltaX = e.touches[i].clientX - touchData.startX;
                let deltaY = e.touches[i].clientY - touchData.startY;
                
                const distance = Math.sqrt(deltaX*deltaX + deltaY*deltaY);
                const maxRadius = 28;

                if (distance > maxRadius) {
                    deltaX = (deltaX / distance) * maxRadius;
                    deltaY = (deltaY / distance) * maxRadius;
                }

                stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                
                // Ekranda parmak yukarı gidince eksi koordinat üretir, bu da 3D dünyada ileri (-Z) gitmek demektir
                callback(deltaX / maxRadius, deltaY / maxRadius);
                break;
            }
        }
    });

    const handleTouchEnd = (e) => {
        const touchData = activeTouches[zoneId];
        if (!touchData) return;

        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchData.id) {
                stick.style.transform = `translate(0px, 0px)`;
                callback(0, 0);
                delete activeTouches[zoneId];
                break;
            }
        }
    };

    zone.addEventListener('touchend', handleTouchEnd);
    zone.addEventListener('touchcancel', handleTouchEnd);
}

// --- MAIN LOOP ---
function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    let dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    if (dt > 0.1) dt = 0.1; 

    if (isGameStarted) {
        world.step(1 / 60, dt, 3);
        handleGameControls();

        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 0.9; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 0.9; }
    }

    // 5. DÜZELTME: Kamera artık yandan bakmıyor, iki oyuncunun tam arkasına geçip orman patikasını takip ediyor
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    const midZ = (p1Body.position.z + p2Body.position.z) / 2;
    const midY = (p1Body.position.y + p2Body.position.y) / 2;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, midX, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, midZ + 11, 0.05); // Oyuncuların 11 birim gerisinde durur
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, midY + 5.5, 0.05); // Oyuncuların 5.5 birim yukarısından bakar

    camera.lookAt(midX, midY + 1, midZ - 3); // İleriye doğru bakar

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;