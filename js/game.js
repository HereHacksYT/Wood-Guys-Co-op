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

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('assets/textures/images.jpeg', (skyTex) => {
        scene.background = skyTex;
    }, undefined, () => {
        scene.background = new THREE.Color(0x87CEEB);
    });

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 11);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    setupTouchControls();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(5, 15, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    world = initPhysics();

    // 2. Çimen Üst Zemin
    const grassTex = textureLoader.load('assets/textures/aerial_grass_rock.png');
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.repeat.set(6, 1);
    groundMesh = new THREE.Mesh(new THREE.BoxGeometry(50, 0.4, 10), new THREE.MeshStandardMaterial({ map: grassTex }));
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 3. Toprak Alt Katman
    const dirtTex = textureLoader.load('assets/textures/rocky_trail_02.png');
    dirtTex.wrapS = THREE.RepeatWrapping;
    dirtTex.repeat.set(6, 0.5);
    dirtMesh = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 10), new THREE.MeshStandardMaterial({ map: dirtTex }));
    dirtMesh.position.y = -2.2;
    dirtMesh.receiveShadow = true;
    scene.add(dirtMesh);

    // 4. Arka Duvar Kaplaması
    const wallTex = textureLoader.load('assets/textures/exterior_wall_cladding_disp_1k.jpg');
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(8, 3);
    wallMesh = new THREE.Mesh(new THREE.BoxGeometry(50, 30, 1), new THREE.MeshStandardMaterial({ map: wallTex }));
    wallMesh.position.set(0, 13, -2);
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);

    // Oyuncuları Yarat
    p1Body = createPhysicsPlayer(-3, 2);
    p2Body = createPhysicsPlayer(3, 2);

    const loader = new GLTFLoader();

    // 1. Oyuncu: Tahta Kukla (puppet_1.glb)
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p1Mesh);
    }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        scene.add(p1Mesh);
    });

    // 2. Oyuncu: SOVIET ROBOT (soviet_robot.glb)
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p2Mesh);
    }, undefined, () => {
        // Yedek hata koruması
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        scene.add(p2Mesh);
    });

    // Çarpışma Sesleri
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

    // Görsel modeli fiziksel gövde merkezine eşitle (Yumuşatılmış kayma ofseti dahil)
    if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.quaternion.copy(p1Body.quaternion); }
    if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.quaternion.copy(p2Body.quaternion); }

    // Kamera Takibi
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