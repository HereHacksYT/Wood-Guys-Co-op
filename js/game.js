// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let finishMesh; 

let isGameStarted = false;
let modelsLoadedCount = 0;
let levelObjects = []; // GLB Harita parçalarını tutacak

// Delta Zaman Sabitleyici (Tabletlerde / 120Hz ekranlarda hızı eşitler)
let lastTime = performance.now();

let p1InsideFinish = false;
let p2InsideFinish = false;

// Çarpışma Grupları
const GROUP_PLAYER1 = 1 << 0;
const GROUP_PLAYER2 = 1 << 1;
const GROUP_STATIC = 1 << 2;

let zeroFrictionMaterial;

const inputs = {
    p1: { moveX: 0, jump: false },
    p2: { moveX: 0, jump: false }
};

let activeTouches = {};

function checkModelsReady() {
    modelsLoadedCount++;
    // Sadece P1 ve P2 modelleri yüklenince oyunu başlatma butonunu aç
    if (modelsLoadedCount >= 2) {
        document.getElementById('loading-text').style.display = 'none';
        document.getElementById('play-btn').style.display = 'block';
    }
}

// --- INITIALIZATION ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a); // İstersen haritana göre gökyüzü rengi yapabilirsin

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3.5, 11);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Işıklandırma (Haritanın güzel görünmesi için)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(3, 12, 6);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Fizik Dünyası
    world = new CANNON.World();
    world.gravity.set(0, -14, 0);

    // Sürtünmesiz malzeme ayarı (Karakterlerin haritaya takılmasını önler)
    zeroFrictionMaterial = new CANNON.Material("zeroFriction");
    const contactMaterial = new CANNON.ContactMaterial(
        zeroFrictionMaterial,
        zeroFrictionMaterial,
        { friction: 0.0, restitution: 0.0 }
    );
    world.addContactMaterial(contactMaterial);

    // Oyuncu gövdelerini oluştur
    p1Body = createPhysicsPlayer(-10, 5, 0, zeroFrictionMaterial);
    p2Body = createPhysicsPlayer(-8, 5, 0, zeroFrictionMaterial);
    
    p1Body.collisionFilterGroup = GROUP_PLAYER1;
    p1Body.collisionFilterMask = GROUP_STATIC;
    p2Body.collisionFilterGroup = GROUP_PLAYER2;
    p2Body.collisionFilterMask = GROUP_STATIC;

    const loader = new THREE.GLTFLoader();

    // P1 Oyuncu Modelini Yükle
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.rotation.y = Math.PI / 2; 
        p1Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p1Mesh);
        checkModelsReady();
    }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        scene.add(p1Mesh); checkModelsReady();
    });

    // P2 Oyuncu Modelini Yükle
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.scale.set(0.5, 0.5, 0.5);
        p2Mesh.rotation.y = Math.PI / 2;
        p2Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p2Mesh);
        checkModelsReady();
    }, undefined, () => {
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        scene.add(p2Mesh); checkModelsReady();
    });

    document.getElementById('play-btn').addEventListener('click', startGame);
    setupTouchControls();
    window.addEventListener('resize', onWindowResize);
    
    // Haritayı yükle
    loadGLBMap();
    animate();
}

// --- .GLB HARİTAYI YÜKLEME VE FİZİĞE DÖKME ---
function loadGLBMap() {
    // Eski harita parçaları varsa temizle
    levelObjects.forEach(obj => { scene.remove(obj.mesh); world.remove(obj.body); });
    levelObjects = [];
    if(finishMesh) scene.remove(finishMesh);

    const loader = new THREE.GLTFLoader();

    // Harita model dosyanın yolunu buraya yazıyorsun
    loader.load('assets/models/harita1.glb', (gltf) => {
        const mapMesh = gltf.scene;
        scene.add(mapMesh);

        // Haritanın merkezini ayarla (Gerekirse konumlandır)
        mapMesh.position.set(0, 0, 0);

        // Harita içindeki her bir mesh parçası için otomatik katı fizik kutusu oluşturma
        mapMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // Mesh'in gerçek sınır boyutlarını otomatik hesapla
                const box = new THREE.Box3().setFromObject(child);
                const size = new THREE.Vector3();
                box.getSize(size);
                const center = new THREE.Vector3();
                box.getCenter(center);

                // Hesaplanan boyutlara göre Cannon.js gövdesi
                const mapBody = new CANNON.Body({
                    mass: 0, // 0 = Hareket etmeyen sabit zemin/duvar
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
        console.error("GLB Harita yüklenirken hata:", err);
    });

    // Bitiş Kapısı Alanı (Örn: Haritanın sonu X: 25 koordinatındaysa oraya görünmez tetikleyici koyuyoruz)
    finishMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshBasicMaterial({ visible: false }));
    finishMesh.position.set(25, 2, 0); 
    scene.add(finishMesh);
}

function handleInsideFinishLogic() {
    if (!finishMesh) return;
    const finishX = finishMesh.position.x;
    
    if (Math.abs(p1Body.position.x - finishX) < 1.5) p1InsideFinish = true;
    if (Math.abs(p2Body.position.x - finishX) < 1.5) p2InsideFinish = true;

    // İki oyuncu da haritanın sonuna varınca harita baştan yüklensin veya sonraki haritaya geçsin
    if (p1InsideFinish && p2InsideFinish) {
        p1InsideFinish = false; p2InsideFinish = false;
        resetPlayerToStart();
        loadGLBMap(); // İleride buraya sırayla harita2.glb, harita3.glb yükleme mantığı kurulabilir
    }
}

function resetPlayerToStart() {
    p1InsideFinish = false; p2InsideFinish = false;
    // Haritanın başlangıç noktası neresiyse oyuncuları orada doğurt (Örn: X: -10, Y: 5)
    p1Body.position.set(-10, 5, 0); p1Body.velocity.set(0, 0, 0);
    p2Body.position.set(-8, 5, 0); p2Body.velocity.set(0, 0, 0);
}

function startGame() {
    isGameStarted = true;
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('p1-controls').style.display = 'block';
    document.getElementById('p2-controls').style.display = 'block';
}

function createPhysicsPlayer(x, y, z, physicsMaterial) {
    const body = new CANNON.Body({ mass: 4, material: physicsMaterial });
    body.addShape(new CANNON.Sphere(0.5), new CANNON.Vec3(0, -0.5, 0));
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.45, 0.6, 0.45)), new CANNON.Vec3(0, 0.4, 0));
    body.position.set(x, y, z);
    body.fixedRotation = true;
    body.updateMassProperties();
    world.addBody(body);
    return body;
}

function handleGameControls() {
    if (!isGameStarted) return;

    // Oyuncu 1 Hareketi (Mavi - Hızlı)
    const p1Speed = 7;
    if (inputs.p1.moveX !== 0) {
        p1Body.velocity.x = inputs.p1.moveX * p1Speed;
        if(p1Mesh) p1Mesh.rotation.y = inputs.p1.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
        p1Body.velocity.x = 0;
    }
    if (inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.05) {
        p1Body.velocity.y = 9.5; inputs.p1.jump = false;
    }

    // Oyuncu 2 Hareketi (Şişman/Kırmızı - Dengeli)
    const p2Speed = 4.8;
    if (inputs.p2.moveX !== 0) {
        p2Body.velocity.x = inputs.p2.moveX * p2Speed;
        if(p2Mesh) p2Mesh.rotation.y = inputs.p2.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
        p2Body.velocity.x = 0;
    }
    if (inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.05) {
        p2Body.velocity.y = 7.5; inputs.p2.jump = false;
    }

    // Boşluğa düşme kontrolü
    if (p1Body.position.y < -10 || p2Body.position.y < -10) {
        resetPlayerToStart();
    }

    handleInsideFinishLogic();
}

// Mobil / APK Multi-touch Kontrolleri
function setupTouchControls() {
    setupJoystickMultiTouch('p1-joystick-zone', 'p1-joystick-stick', (x) => { inputs.p1.moveX = x; });
    setupJoystickMultiTouch('p2-joystick-zone', 'p2-joystick-stick', (x) => { inputs.p2.moveX = x; });

    document.getElementById('p1-action-btn').addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p1.jump = true; });
    document.getElementById('p2-action-btn').addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p2.jump = true; });
}

function setupJoystickMultiTouch(zoneId, stickId, callback) {
    const zone = document.getElementById(zoneId);
    const stick = document.getElementById(stickId);
    if(!zone || !stick) return;

    zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        activeTouches[zoneId] = { id: touch.identifier, startX: touch.clientX };
    });

    zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touchData = activeTouches[zoneId];
        if (!touchData) return;

        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === touchData.id) {
                let deltaX = e.touches[i].clientX - touchData.startX;
                deltaX = Math.max(-28, Math.min(28, deltaX));
                stick.style.transform = `translateX(${deltaX}px)`;
                callback(deltaX / 28);
                break;
            }
        }
    });

    const handleTouchEnd = (e) => {
        const touchData = activeTouches[zoneId];
        if (!touchData) return;

        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchData.id) {
                stick.style.transform = `translate(0px,0px)`;
                callback(0);
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

        // Modelleri fizik gövdeleriyle eşitle
        if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 1.0; }
        if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 1.0; }
    }

    // Kamera takibi (İki oyuncunun ortasına odaklanır)
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, midX, 0.05);
    camera.lookAt(midX, 2, 0);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;