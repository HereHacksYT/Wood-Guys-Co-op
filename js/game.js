import { initPhysics, createPhysicsPlayer } from './physics.js';
import { handleControls, setupTouchControls } from './controls.js';

let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let groundMesh, dirtMesh, skyWallMesh;

const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3.5, 11);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    setupTouchControls();

    // 1. IŞIK GÜÇLERİ DÜŞÜRÜLDÜ (Parlama Tamamen Engellendi)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight.position.set(5, 15, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);

    world = initPhysics();

    const textureLoader = new THREE.TextureLoader();

    // Gökyüzü Duvarı Giydirmesi
    const skyTex = textureLoader.load('assets/textures/images.jpeg');
    skyWallMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(35, 18),
        new THREE.MeshStandardMaterial({ map: skyTex, roughness: 0.6, metalness: 0.1 })
    );
    skyWallMesh.position.set(0, 8, -4); 
    scene.add(skyWallMesh);

    // Çimen Üst Zemin
    const grassTex = textureLoader.load('assets/textures/aerial_grass_rock.png');
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.repeat.set(4, 1);
    groundMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 6), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 }));
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Toprak Alt Katman
    const dirtTex = textureLoader.load('assets/textures/rocky_trail_02.png');
    dirtTex.wrapS = THREE.RepeatWrapping;
    dirtTex.repeat.set(4, 0.5);
    dirtMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 3, 6), new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.9 }));
    dirtMesh.position.y = -1.7;
    dirtMesh.receiveShadow = true;
    scene.add(dirtMesh);

    // 2. FİZİKSEL OYUNCULAR (Aynı eksende çarpışacak şekilde konumlandırıldı)
    p1Body = createPhysicsPlayer(-3, 3, 0);
    p2Body = createPhysicsPlayer(3, 3, 0); 

    // 3. MODEL YÜKLEME İPTAL EDİLDİ - SAF KUTU MODELLERİ AKTİF
    // Mavi Oyuncu (Oyuncu 1)
    p1Mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2.2, 1), 
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5, metalness: 0.1 })
    );
    p1Mesh.castShadow = true;
    scene.add(p1Mesh);

    // Kırmızı Oyuncu (Oyuncu 2 - Artık Kesinlikle Görünür)
    p2Mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2.2, 1), 
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5, metalness: 0.1 })
    );
    p2Mesh.castShadow = true;
    scene.add(p2Mesh);

    // Çarpışma ve Yere Düşme Ses Kontrolleri
    p1Body.addEventListener('collide', (e) => {
        if(e.body.mass > 0) { hitSound.currentTime = 0; hitSound.play().catch(()=>{}); }
        else { fallSound.currentTime = 0; fallSound.play().catch(()=>{}); }
    });

    p2Body.addEventListener('collide', (e) => {
        if(e.body.mass > 0) { hitSound.currentTime = 0; hitSound.play().catch(()=>{}); }
        else { fallSound.currentTime = 0; fallSound.play().catch(()=>{}); }
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