import { initPhysics, createPhysicsPlayer } from './physics.js';
import { handleControls } from './controls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body, arenaMesh;

// Ses Efektleri
const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

function init() {
    // 1. 3D Sahne Kurulumu
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Gökyüzü rengi

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 12);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Işıklar
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 2. Fizik Dünyası
    world = initPhysics();

    // 3. Oyuncuları Fiziksel Olarak Yarat
    p1Body = createPhysicsPlayer(-4, 3);
    p2Body = createPhysicsPlayer(4, 3);

    // 4. 3D Modelleri Yükle (.glb)
    const loader = new GLTFLoader();

    // Arena Modeli ve Zemin Dokusu Yükleme
    loader.load('assets/models/arena.glb', (gltf) => {
        arenaMesh = gltf.scene;
        arenaMesh.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true;
                // İsteğe bağlı: İndirdiğin zemin dokusunu arenaya uygula
                const textureLoader = new THREE.TextureLoader();
                child.material.map = textureLoader.load('assets/textures/aerial_grass_rock.png');
                child.material.needsUpdate = true;
            }
        });
        scene.add(arenaMesh);
    }, undefined, (error) => {
        console.log("Arena yüklenirken varsayılan zemin oluşturuldu.");
        // Eğer arena.glb boşsa hata vermemesi için koruma zemini
        const groundGeo = new THREE.BoxGeometry(40, 1, 10);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B });
        const fallbackGround = new THREE.Mesh(groundGeo, groundMat);
        fallbackGround.position.y = -0.5;
        scene.add(fallbackGround);
    });

    // 1. Oyuncu Kuklası
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p1Mesh);
    });

    // 2. Oyuncu Kuklası (veya soviet_robot.glb hangisini istersen ismi değiştirebilirsin)
    loader.load('assets/models/puppet_2.glb', (gltf) => {
        p2Mesh = gltf.scene;
        p2Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p2Mesh);
    });

    // Çarpışma Ses Tetikleyicileri
    p1Body.addEventListener('collide', (e) => {
        if(e.body.mass > 0) hitSound.play(); // Birbirlerine vururlarsa
        else fallSound.play(); // Yere düşerlerse
    });

    window.addEventListener('resize', onWindowResize);
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);
    handleControls(p1Body, p2Body);

    // 3D Modelleri fiziksel gövdelerin konumuna eşitle
    if (p1Mesh) {
        p1Mesh.position.copy(p1Body.position);
        p1Mesh.quaternion.copy(p1Body.quaternion);
    }
    if (p2Mesh) {
        p2Mesh.position.copy(p2Body.position);
        p2Mesh.quaternion.copy(p2Body.quaternion);
    }

    // Kamera Takibi (İki oyuncuyu da ekranda tutar)
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

init();