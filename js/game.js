import { initPhysics, createPhysicsPlayer } from './physics.js';
import { handleControls, setupTouchControls } from './controls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let groundMesh, dirtMesh, wallMesh;

const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Mobil dokunmatik dinleyicilerini başlat
    setupTouchControls();

    // Işıklandırma
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 15, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    world = initPhysics();

    // ---- DOKU VE MODEL YÜKLEMELERİ ----
    const textureLoader = new THREE.TextureLoader();

    // 1. Çimen Kaplamalı Üst Zemin
    const grassTex = textureLoader.load('assets/textures/aerial_grass_rock.png');
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.repeat.set(5, 1);
    const groundGeo = new THREE.BoxGeometry(50, 0.4, 10);
    const groundMat = new THREE.MeshStandardMaterial({ map: grassTex });
    groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 2. Toprak Kaplamalı Alt Zemin
    const dirtTex = textureLoader.load('assets/textures/rocky_trail_02.png');
    dirtTex.wrapS = THREE.RepeatWrapping;
    dirtTex.repeat.set(5, 0.5);
    const dirtGeo = new THREE.BoxGeometry(50, 4, 10);
    const dirtMat = new THREE.MeshStandardMaterial({ map: dirtTex });
    dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
    dirtMesh.position.y = -2.2;
    dirtMesh.receiveShadow = true;
    scene.add(dirtMesh);

    // 3. Arka Duvar Kaplaması
    const wallTex = textureLoader.load('assets/textures/exterior_wall_cladding_disp_1k.jpg');
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(10, 4);
    const wallGeo = new THREE.BoxGeometry(50, 30, 1);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex });
    wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(0, 13, -2);
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);

    // ---- KUKLA MODELLERİNİ YÜKLEME (.GLB) ----
    const loader = new GLTFLoader();

    p1Body = createPhysicsPlayer(-3, 2);
    p2Body = createPhysicsPlayer(3, 2);

    // Oyuncu 1: Tahta Kukla
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p1Mesh);
    }, undefined, () => {
        // Model yüklenemezse yedek mavi kutu
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        scene.add(p1Mesh);
    });

    // Oyuncu 2: Robot veya Diğer Kukla
    loader.load('assets/models/puppet_2.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p2Mesh);
    }, undefined, () => {
        // Model yüklenemezse yedek kırmızı kutu
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        scene.add(p2Mesh);
    });

    // Ses Tetikleyicileri
    p1Body.addEventListener('collide', (e) => {
        if(e.body.mass > 0) { hitSound.currentTime = 0; hitSound.play(); }
        else { fallSound.currentTime = 0; fallSound.play(); }
    });

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);
    handleControls(p1Body, p2Body);

    if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.quaternion.copy(p1Body.quaternion); }
    if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.quaternion.copy(p2Body.quaternion); }

    // Dinamik Kamera Takibi
    const midX = (p1Body.position.x + p2Body.position.x) / 2;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, midX, 0.05);
    camera.lookAt(midX, 2, 0);

    renderer.render(scene, camera);
}

window.onload = init;