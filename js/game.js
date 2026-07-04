// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let groundMesh, dirtMesh, skyWallMesh;

// Sesler
const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

// Kontroller verisi
const inputs = {
    p1: { moveX: 0, jump: false },
    p2: { moveX: 0, jump: false }
};
const activeKeys = {};

// --- KLAVYE DİNLEYİCİLERİ ---
window.addEventListener('keydown', (e) => { activeKeys[e.code] = true; });
window.addEventListener('keyup', (e) => { activeKeys[e.code] = false; });

// --- OYUN BAŞLANGICI ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3.5, 11);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Net ve Parlamayan Işık Düzeni
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(3, 12, 6);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Fizik Dünyası (Cannon.js)
    world = new CANNON.World();
    world.gravity.set(0, -14, 0);

    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(20, 0.2, 3)) });
    groundBody.position.set(0, 0, 0);
    world.addBody(groundBody);

    const dirtBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(20, 1.5, 3)) });
    dirtBody.position.set(0, -1.7, 0);
    world.addBody(dirtBody);

    const playerMaterial = new CANNON.Material("playerMat");
    const groundMaterial = new CANNON.Material("groundMat");
    groundBody.material = groundMaterial;
    dirtBody.material = groundMaterial;

    const contactMat = new CANNON.ContactMaterial(playerMaterial, groundMaterial, { friction: 0.0, restitution: 0.02 });
    world.addContactMaterial(contactMat);

    // Görsel Nesneler (Three.js)
    const textureLoader = new THREE.TextureLoader();

    // Arka Gökyüzü Duvarı
    const skyTex = textureLoader.load('assets/textures/images.jpeg');
    skyWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(35, 18), new THREE.MeshStandardMaterial({ map: skyTex, roughness: 0.6 }));
    skyWallMesh.position.set(0, 8, -4); 
    scene.add(skyWallMesh);

    // Çimen Üst Katman
    const grassTex = textureLoader.load('assets/textures/aerial_grass_rock.png');
    grassTex.wrapS = THREE.RepeatWrapping; grassTex.repeat.set(4, 1);
    groundMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 6), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 }));
    groundMesh.position.y = 0; groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Toprak Alt Katman
    const dirtTex = textureLoader.load('assets/textures/rocky_trail_02.png');
    dirtTex.wrapS = THREE.RepeatWrapping; dirtTex.repeat.set(4, 0.5);
    dirtMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 3, 6), new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.8 }));
    dirtMesh.position.y = -1.7; dirtMesh.receiveShadow = true;
    scene.add(dirtMesh);

    // Oyuncuları Yarat (Fizik Kapsülleri)
    p1Body = createPhysicsPlayer(-3, 3, 0, playerMaterial);
    p2Body = createPhysicsPlayer(3, 3, 0, playerMaterial);

    const loader = new THREE.GLTFLoader();

    // --- 1. OYUNCU (Mavi - Puppet 1) ---
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        
        // Sağ tarafa dönmesi için Y ekseninde 90 derece döndürdük (Radyan cinsinden)
        p1Mesh.rotation.y = Math.PI / 2; 

        // Modelin alt noktasını merkeze alıp tam fizik kutusunun tabanına (yere) oturttuk
        const box = new THREE.Box3().setFromObject(p1Mesh);
        const lowestY = box.min.y;
        p1Mesh.traverse(c => { 
            if(c.isMesh) {
                c.castShadow = true;
                c.position.y -= lowestY; // Altındaki boşluğu yok et
            }
        });
        
        // Pivot kaymasını engellemek için ana sahneye eklemeden önce hizalama
        p1Mesh.position.y = -1.1; 

        scene.add(p1Mesh);
    }, undefined, () => {
        // Yedek Mavi Küp
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 }));
        p1Mesh.castShadow = true; scene.add(p1Mesh);
    });

    // --- 2. OYUNCU (Kırmızı - Soviet Robot) ---
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        
        // BOYUTUNU YARIYA İNDİRME (Scale ayarı 0.5 yapıldı)
        p2Mesh.scale.set(0.5, 0.5, 0.5);
        
        // Sağ tarafa bakması için Y ekseninde 90 derece döndürdük
        p2Mesh.rotation.y = Math.PI / 2;

        // Küçültülmüş modelin alt noktasını hesaplayıp tam yere sıfırlıyoruz
        const box = new THREE.Box3().setFromObject(p2Mesh);
        const lowestY = box.min.y;
        
        p2Mesh.traverse(c => { 
            if(c.isMesh) {
                c.castShadow = true;
            }
        });
        
        // Robotun havada asılı kalmasını önlemek için merkez noktasını tabana çekiyoruz
        p2Mesh.position.y = -1.1;

        scene.add(p2Mesh);
    }, undefined, () => {
        // Yedek Kırmızı Küp
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 }));
        p2Mesh.castShadow = true; scene.add(p2Mesh);
    });

    // Ses Tetikleyicileri
    p1Body.addEventListener('collide', (e) => {
        if(e.body.mass > 0) { hitSound.currentTime = 0; hitSound.play().catch(()=>{}); }
        else { fallSound.currentTime = 0; fallSound.play().catch(()=>{}); }
    });
    p2Body.addEventListener('collide', (e) => {
        if(e.body.mass > 0) { hitSound.currentTime = 0; hitSound.play().catch(()=>{}); }
        else { fallSound.currentTime = 0; fallSound.play().catch(()=>{}); }
    });

    setupTouchControls();
    window.addEventListener('resize', onWindowResize);
    animate();
}

// --- FİZİKSEL GÖVDE OLUŞTURUCU ---
function createPhysicsPlayer(x, y, z, mat) {
    const body = new CANNON.Body({ mass: 4, material: mat });
    const sphereShape = new CANNON.Sphere(0.5);
    body.addShape(sphereShape, new CANNON.Vec3(0, -0.5, 0));
    const boxShape = new CANNON.Box(new CANNON.Vec3(0.45, 0.6, 0.45));
    body.addShape(boxShape, new CANNON.Vec3(0, 0.4, 0));
    body.position.set(x, y, z);
    body.fixedRotation = true;
    body.updateMassProperties();
    world.addBody(body);
    return body;
}

// --- DOKUNMATİK JOSTICK AYARLARI ---
function setupTouchControls() {
    setupSingleJoystick('p1-joystick-zone', 'p1-joystick-stick', (x) => { inputs.p1.moveX = x; });
    document.getElementById('p1-action-btn').addEventListener('touchstart', () => { inputs.p1.jump = true; });
    document.getElementById('p1-action-btn').addEventListener('touchend', () => { inputs.p1.jump = false; });

    setupSingleJoystick('p2-joystick-zone', 'p2-joystick-stick', (x) => { inputs.p2.moveX = x; });
    document.getElementById('p2-action-btn').addEventListener('touchstart', () => { inputs.p2.jump = true; });
    document.getElementById('p2-action-btn').addEventListener('touchend', () => { inputs.p2.jump = false; });
}

function setupSingleJoystick(zoneId, stickId, callback) {
    const zone = document.getElementById(zoneId);
    const stick = document.getElementById(stickId);
    if(!zone || !stick) return;
    let startX = 0;

    zone.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; });
    zone.addEventListener('touchmove', (e) => {
        const touchX = e.touches[0].clientX;
        let deltaX = touchX - startX;
        deltaX = Math.max(-28, Math.min(28, deltaX));
        stick.style.transform = `translateX(${deltaX}px)`;
        callback(deltaX / 28);
    });
    zone.addEventListener('touchend', () => { stick.style.transform = `translate(0px,0px)`; callback(0); });
}

// --- HAREKET VE HIZ YÖNETİMİ ---
function handleGameControls() {
    const speed = 7;
    const jumpForce = 7.5;

    // Oyuncu 1
    if (inputs.p1.moveX !== 0) {
        p1Body.velocity.x = inputs.p1.moveX * speed;
        if(p1Mesh) p1Mesh.rotation.y = inputs.p1.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    else if (activeKeys['KeyA']) {
        p1Body.velocity.x = -speed;
        if(p1Mesh) p1Mesh.rotation.y = -Math.PI / 2;
    }
    else if (activeKeys['KeyD']) {
        p1Body.velocity.x = speed;
        if(p1Mesh) p1Mesh.rotation.y = Math.PI / 2;
    }
    else {
        p1Body.velocity.x = 0;
    }

    if ((inputs.p1.jump || activeKeys['KeyW']) && Math.abs(p1Body.velocity.y) < 0.01) {
        p1Body.velocity.y = jumpForce;
        inputs.p1.jump = false;
    }

    // Oyuncu 2
    if (inputs.p2.moveX !== 0) {
        p2Body.velocity.x = inputs.p2.moveX * speed;
        if(p2Mesh) p2Mesh.rotation.y = inputs.p2.moveX > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    else if (activeKeys['ArrowLeft']) {
        p2Body.velocity.x = -speed;
        if(p2Mesh) p2Mesh.rotation.y = -Math.PI / 2;
    }
    else if (activeKeys['ArrowRight']) {
        p2Body.velocity.x = speed;
        if(p2Mesh) p2Mesh.rotation.y = Math.PI / 2;
    }
    else {
        p2Body.velocity.x = 0;
    }

    if ((inputs.p2.jump || activeKeys['ArrowUp']) && Math.abs(p2Body.velocity.y) < 0.01) {
        p2Body.velocity.y = jumpForce;
        inputs.p2.jump = false;
    }
}

// --- MOTOR DÖNGÜSÜ ---
function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);
    handleGameControls();

    // Görsel modelleri fizik gövdelerinin pozisyonuna eşitliyoruz
    if (p1Mesh) { 
        p1Mesh.position.x = p1Body.position.x;
        p1Mesh.position.z = p1Body.position.z;
        p1Mesh.position.y = p1Body.position.y - 1.1; // Fizik merkezinden aşağı indirerek zemine basmasını sağladık
    }
    if (p2Mesh) { 
        p2Mesh.position.x = p2Body.position.x;
        p2Mesh.position.z = p2Body.position.z;
        p2Mesh.position.y = p2Body.position.y - 1.1; // Robotun zemine tam oturma ayarı
    }

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