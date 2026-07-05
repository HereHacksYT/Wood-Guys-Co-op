// --- GLOBAL DEĞİŞKENLER ---
let scene, camera, renderer, world, controls;
let p1Mesh, p2Mesh, p1Body, p2Body, finishMesh; 
let isGameStarted = false;
let modelsLoadedCount = 0;
let levelObjects = []; 
let lastTime = performance.now();
let activeTouches = {};

// Koordinat paneli
let coordDiv;
function createMobileUI() {
    coordDiv = document.createElement('div');
    coordDiv.style = "position:absolute; top:10px; left:10px; color:white; background:rgba(0,0,0,0.6); padding:10px; border-radius:5px; font-size:12px; z-index:1000; pointer-events:none; font-family:sans-serif;";
    coordDiv.innerHTML = "Harita aranıyor...";
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
    scene.background = new THREE.Color(0x87ceeb); // Gökyüzü mavisi (Siyah boşluktan kurtulduk)

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 20, 40); // Haritayı geniş görmek için yüksekten başla

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 📱 DOKUNMATİK KAMERA KONTROLÜ
    // Ekranda parmağını kaydırınca kamera döner, iki parmakla zoom yapar.
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    // ızgara (Zemini görmene yardım eder)
    const grid = new THREE.GridHelper(500, 50, 0xffffff, 0x444444);
    scene.add(grid);

    world = new CANNON.World();
    world.gravity.set(0, -15, 0);

    const mat = new CANNON.Material();
    p1Body = createPhysicsPlayer(-2, 10, 0, mat);
    p2Body = createPhysicsPlayer(2, 10, 0, mat);

    const loader = new THREE.GLTFLoader();
    
    // Modeller (Burada hata almamak için yedek küpler ekledim)
    loader.load('assets/models/puppet_1.glb', (g) => { p1Mesh = g.scene; scene.add(p1Mesh); checkModelsReady(); }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshStandardMaterial({color:0x0000ff})); scene.add(p1Mesh); checkModelsReady();
    });
    loader.load('assets/models/soviet_robot.glb', (g) => { p2Mesh = g.scene; p2Mesh.scale.set(0.5,0.5,0.5); scene.add(p2Mesh); checkModelsReady(); }, undefined, () => {
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshStandardMaterial({color:0xff0000})); scene.add(p2Mesh); checkModelsReady();
    });

    document.getElementById('play-btn').addEventListener('click', () => {
        isGameStarted = true;
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('p1-controls').style.display = 'block';
        document.getElementById('p2-controls').style.display = 'block';
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
        map.traverse((child) => {
            if (child.isMesh) {
                const box = new THREE.Box3().setFromObject(child);
                const size = new THREE.Vector3(); box.getSize(size);
                const center = new THREE.Vector3(); box.getCenter(center);
                const body = new CANNON.Body({
                    mass: 0,
                    shape: new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2))
                });
                body.position.set(center.x, center.y, center.z);
                world.addBody(body);
                levelObjects.push({mesh:child, body:body});
            }
        });
    }, undefined, (e) => console.log("Harita bulunamadı, assets/models/harita1.glb yolunu kontrol et!"));
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
    // Joystick ve zıplama kodları (Multi-touch)
    const joy1 = (x, z) => { inputs.p1.moveX = x; inputs.p1.moveZ = z; };
    const joy2 = (x, z) => { inputs.p2.moveX = x; inputs.p2.moveZ = z; };
    setupJoystick('p1-joystick-zone', 'p1-joystick-stick', joy1);
    setupJoystick('p2-joystick-zone', 'p2-joystick-stick', joy2);
    document.getElementById('p1-action-btn').addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p1.jump = true; });
    document.getElementById('p2-action-btn').addEventListener('touchstart', (e) => { e.preventDefault(); inputs.p2.jump = true; });
}

function setupJoystick(zId, sId, cb) {
    const zone = document.getElementById(zId);
    const stick = document.getElementById(sId);
    zone.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        activeTouches[zId] = { id: t.identifier, x: t.clientX, y: t.clientY };
    });
    zone.addEventListener('touchmove', (e) => {
        const tData = activeTouches[zId];
        if(!tData) return;
        for(let i=0; i<e.touches.length; i++){
            if(e.touches[i].identifier === tData.id){
                let dx = e.touches[i].clientX - tData.x;
                let dy = e.touches[i].clientY - tData.y;
                const dist = Math.min(Math.sqrt(dx*dx+dy*dy), 30);
                const angle = Math.atan2(dy, dx);
                dx = Math.cos(angle) * dist; dy = Math.sin(angle) * dist;
                stick.style.transform = `translate(${dx}px, ${dy}px)`;
                cb(dx/30, dy/30);
            }
        }
    });
    zone.addEventListener('touchend', (e) => { stick.style.transform = `translate(0,0)`; cb(0,0); delete activeTouches[zId]; });
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    let dt = (time - lastTime) / 1000;
    lastTime = time;
    if(dt > 0.1) dt = 0.1;

    if (isGameStarted) {
        world.step(1/60, dt, 3);
        const speed = 8;
        p1Body.velocity.x = inputs.p1.moveX * speed;
        p1Body.velocity.z = inputs.p1.moveZ * speed;
        p2Body.velocity.x = inputs.p2.moveX * speed;
        p2Body.velocity.z = inputs.p2.moveZ * speed;
        if(inputs.p1.jump && Math.abs(p1Body.velocity.y) < 0.1) { p1Body.velocity.y = 10; inputs.p1.jump = false; }
        if(inputs.p2.jump && Math.abs(p2Body.velocity.y) < 0.1) { p2Body.velocity.y = 10; inputs.p2.jump = false; }

        if(p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.position.y -= 1; }
        if(p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.position.y -= 1; }
    }

    // 🔴 KOORDİNAT PANELİ GÜNCELLEME
    if(coordDiv && p1Body) {
        coordDiv.innerHTML = `
            <b>WOOD GUYS DEDEKTÖR</b><br>
            Oyuncu: X:${p1Body.position.x.toFixed(1)} Y:${p1Body.position.y.toFixed(1)} Z:${p1Body.position.z.toFixed(1)}<br>
            <span style="color:#0f0">Parmakla Ekranı Çevir Haritayı Ara!</span>
        `;
    }

    if(controls) controls.update();
    renderer.render(scene, camera);
}

window.onload = init;
function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', onWindowResize);