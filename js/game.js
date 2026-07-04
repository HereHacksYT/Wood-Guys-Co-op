import { initPhysics, createPhysicsPlayer } from './physics.js';
import { handleControls, setupTouchControls } from './controls.js';

let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let groundMesh, dirtMesh, skyWallMesh;

const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
// Ses dosyasının adı tam olarak güncellendi
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0e0e); // Sahne dışı boşluk rengi

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3.5, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    setupTouchControls();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(4, 12, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);

    world = initPhysics();

    const textureLoader = new THREE.TextureLoader();

    // 1. GÖKYÜZÜNÜN DUVAR OLMASI (O bahsettiğin arka plan panel yapısı)
    const skyTex = textureLoader.load('assets/textures/images.jpeg');
    skyWallMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(32, 16),
        new THREE.MeshStandardMaterial({ map: skyTex, side: THREE.DoubleSide })
    );
    skyWallMesh.position.set(0, 7.5, -3); // Karakterlerin arkasında dikey duracak
    scene.add(skyWallMesh);

    // 2. Çimen Üst Zemin
    const grassTex = textureLoader.load('assets/textures/aerial_grass_rock.png');
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.repeat.set(4, 1);
    groundMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 6), new THREE.MeshStandardMaterial({ map: grassTex }));
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 3. Toprak Alt Katman
    const dirtTex = textureLoader.load('assets/textures/rocky_trail_02.png');
    dirtTex.wrapS = THREE.RepeatWrapping;
    dirtTex.repeat.set(4, 0.5);
    dirtMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 3, 6), new THREE.MeshStandardMaterial({ map: dirtTex }));
    dirtMesh.position.y = -1.7;
    dirtMesh.receiveShadow = true;
    scene.add(dirtMesh);

    // Fizik gövdelerini Z ekseninde tamamen hizalayarak çakışmayı sıfırladık
    p1Body = createPhysicsPlayer(-3, 3, 0);
    p2Body = createPhysicsPlayer(3, 3, 0); 

    // HTML içinde global tanımladığımız uyumlu GLTFLoader'ı çağırıyoruz
    const loader = new THREE.GLTFLoader();

    // 1. Oyuncu: puppet_1.glb
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p1Mesh);
    }, undefined, () => {
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        scene.add(p1Mesh);
    });

    // 2. Oyuncu: soviet_robot.glb
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p2Mesh);
    }, undefined, () => {
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        scene.add(p2Mesh);
    });

    // Çarpışma ve Yere Düşme Ses Dinleyicisi
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

    if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.quaternion.copy(p1Body.quaternion); }
    if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.quaternion.copy(p2Body.quaternion); }

    // İki oyuncunun ortasını bulan akıllı kamera
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