import { initPhysics, createPhysicsPlayer } from './physics.js';
import { handleControls, setupTouchControls } from './controls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let groundMesh, dirtMesh;

const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

function init() {
    scene = new THREE.Scene();

    // 1. Gökyüzü Doku Yüklemesi (Görseli doğrudan sahne arka planına bağlıyoruz)
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('assets/textures/images.jpeg', (skyTex) => {
        scene.background = skyTex;
    }, undefined, (err) => {
        console.error("Gökyüzü resmi yüklenemedi:", err);
        scene.background = new THREE.Color(0x87CEEB);
    });

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3, 12); // Görüş açısını daha iyi bir Co-op deneyimi için esnettik

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    setupTouchControls();

    // Işık Düzenlemeleri
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 18, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    world = initPhysics();

    // 2. Çimen Üst Zemin Giydirmesi
    const grassTex = textureLoader.load('assets/textures/aerial_grass_rock.png');
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.repeat.set(6, 1);
    groundMesh = new THREE.Mesh(new THREE.BoxGeometry(50, 0.4, 8), new THREE.MeshStandardMaterial({ map: grassTex }));
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 3. Toprak Alt Katman Giydirmesi
    const dirtTex = textureLoader.load('assets/textures/rocky_trail_02.png');
    dirtTex.wrapS = THREE.RepeatWrapping;
    dirtTex.repeat.set(6, 0.5);
    dirtMesh = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 8), new THREE.MeshStandardMaterial({ map: dirtTex }));
    dirtMesh.position.y = -2.2;
    dirtMesh.receiveShadow = true;
    scene.add(dirtMesh);

    // Fizik Gövdelerini Oluştur (Derinlik çakışmasını önlemek için Z eksenleri dengelendi)
    p1Body = createPhysicsPlayer(-4, 3, 0);
    p2Body = createPhysicsPlayer(4, 3, 0.1); 

    const loader = new GLTFLoader();

    // 4. Oyuncu 1: Mavi Kukla Yüklemesi
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.scale.set(1, 1, 1);
        p1Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p1Mesh);
    }, undefined, (err) => {
        console.warn("puppet_1.glb yüklenemedi, yedek mavi kutu devrede:", err);
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        scene.add(p1Mesh);
    });

    // 5. Oyuncu 2: Soviet Robot Yüklemesi
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.scale.set(1, 1, 1); // Model boyutuna göre gerekirse (0.8, 0.8, 0.8) yapılabilir
        p2Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p2Mesh);
    }, undefined, (err) => {
        console.warn("soviet_robot.glb yüklenemedi, yedek kırmızı kutu devrede:", err);
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        scene.add(p2Mesh);
    });

    // Ses Tetikleyicileri
    p1Body.addEventListener('collide', (e) => {
        if(e.body.mass > 0) { hitSound.currentTime = 0; hitSound.play(); }
        else { fallSound.currentTime = 0; fallSound.play(); }
    });

    window.addEventListener('resize', onWindowResize);
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);
    handleControls(p1Body, p2Body);

    // Fizik konumlarını mesh nesnelerine kusursuzca aktar
    if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.quaternion.copy(p1Body.quaternion); }
    if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.quaternion.copy(p2Body.quaternion); }

    // İki oyuncuyu da içine alan dinamik kamera takibi
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