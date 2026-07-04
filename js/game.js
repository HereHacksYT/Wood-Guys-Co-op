import { initPhysics, createPhysicsPlayer } from './physics.js';
import { handleControls } from './controls.js';

let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;

function init() {
    // 1. 3D Sahne Kurulumu
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Bulutlu gökyüzü rengi

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 12);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Işıklar
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // 2. Fizik Dünyasını Başlat
    world = initPhysics();

    // 3. Görsel Platform (Zemin) oluştur
    const groundGeo = new THREE.BoxGeometry(40, 1, 10);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B }); // Kahverengi ahşap
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = -0.5;
    scene.add(groundMesh);

    // 4. Oyuncuları Oluştur (Fizik + Görsel)
    p1Body = createPhysicsPlayer(-3, 3);
    p2Body = createPhysicsPlayer(3, 3);

    const p1Geo = new THREE.BoxGeometry(1.2, 2.4, 1.2);
    const p1Mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 }); // Mavi Kukla
    p1Mesh = new THREE.Mesh(p1Geo, p1Mat);
    scene.add(p1Mesh);

    const p2Geo = new THREE.BoxGeometry(1.2, 2.4, 1.2);
    const p2Mat = new THREE.MeshStandardMaterial({ color: 0xef4444 }); // Kırmızı Kukla
    p2Mesh = new THREE.Mesh(p2Geo, p2Mat);
    scene.add(p2Mesh);

    window.addEventListener('resize', onWindowResize);
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    // Fiziği güncelle
    world.step(1 / 60);

    // Kontrolleri işlet
    handleControls(p1Body, p2Body);

    // Görsel kutuları fizik kutularının pozisyonuna eşitle
    p1Mesh.position.copy(p1Body.position);
    p2Mesh.position.copy(p2Body.position);

    // Dinamik Kamera (İki oyuncunun ortasına odaklanır)
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    camera.position.x = midX;
    camera.lookAt(midX, 2, 0);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();