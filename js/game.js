import { initPhysics, createPhysicsPlayer } from './physics.js';
import { handleControls, setupTouchControls } from './controls.js';

let scene, camera, renderer, world;
let p1Mesh, p2Mesh, p1Body, p2Body;
let groundMesh, dirtMesh, skyWallMesh;

// 1. SES EFEKTLERİ TANIMLAMALARI
const hitSound = new Audio('assets/audio/dragon-studio-sword-clashhit-393837.mp3');
const fallSound = new Audio('assets/audio/freesound_community-body-falling-to-ground-1004474.mp3');

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3.5, 11);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    setupTouchControls();

    // Işık gücünü robotun metalik kaplamasının parlaması ve görünmesi için artırdık
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 15, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    world = initPhysics();

    const textureLoader = new THREE.TextureLoader();

    // 2. GÖKYÜZÜNÜN DUVAR OLMASI
    const skyTex = textureLoader.load('assets/textures/images.jpeg');
    skyWallMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(35, 18),
        new THREE.MeshStandardMaterial({ map: skyTex, side: THREE.DoubleSide })
    );
    skyWallMesh.position.set(0, 8, -4); 
    scene.add(skyWallMesh);

    // 3. Çimen Üst Zemin
    const grassTex = textureLoader.load('assets/textures/aerial_grass_rock.png');
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.repeat.set(4, 1);
    groundMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 6), new THREE.MeshStandardMaterial({ map: grassTex }));
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 4. Toprak Alt Katman
    const dirtTex = textureLoader.load('assets/textures/rocky_trail_02.png');
    dirtTex.wrapS = THREE.RepeatWrapping;
    dirtTex.repeat.set(4, 0.5);
    dirtMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 3, 6), new THREE.MeshStandardMaterial({ map: dirtTex }));
    dirtMesh.position.y = -1.7;
    dirtMesh.receiveShadow = true;
    scene.add(dirtMesh);

    // Oyuncuların başlangıç pozisyonları (Z ekseni tamamen sıfırlandı)
    p1Body = createPhysicsPlayer(-3, 4, 0);
    p2Body = createPhysicsPlayer(3, 4, 0); 

    const loader = new THREE.GLTFLoader();

    // 1. Oyuncu Model Yüklemesi: puppet_1.glb
    loader.load('assets/models/puppet_1.glb', (gltf) => {
        p1Mesh = gltf.scene;
        p1Mesh.traverse(c => { if(c.isMesh) c.castShadow = true; });
        scene.add(p1Mesh);
    }, undefined, () => {
        // Hata durumunda koruma küpü
        p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        scene.add(p1Mesh);
    });

    // 2. Oyuncu Model Yüklemesi: SOVIET_ROBOT.GLB (Görünme ve Pivot Sorunları Düzeltildi)
    loader.load('assets/models/soviet_robot.glb', (gltf) => {
        p2Mesh = gltf.scene;
        
        // Robotun sahne içinde kaybolmasını önlemek için modelin merkezini (bounding box) otomatik hizalıyoruz
        const box = new THREE.Box3().setFromObject(p2Mesh);
        const center = box.getCenter(new THREE.Vector3());
        p2Mesh.position.sub(center); // Modeli kendi merkezine çekiyoruz
        
        p2Mesh.scale.set(1.2, 1.2, 1.2); // Boyutu küçükse biraz büyütüp görünür kılıyoruz
        p2Mesh.traverse(c => { 
            if(c.isMesh) {
                c.castShadow = true;
                c.material.depthWrite = true; // Saydamlık/görünmezlik hatasını engeller
            }
        });
        scene.add(p2Mesh);
    }, undefined, (err) => {
        console.error("Robot yüklenirken hata oluştu, yedek kırmızı model devrede:", err);
        // Kesinlikle görünmesi için parlak kırmızı bir yedek küp
        p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2 }));
        scene.add(p2Mesh);
    });

    // 5. SES EFEKTLERİNİN FİZİK DÜNYASINDA TETİKLENMESİ
    p1Body.addEventListener('collide', (e) => {
        if(e.body.mass > 0) { 
            // Başka bir oyuncuya/nesneye vurunca kılıç sesi
            hitSound.currentTime = 0; 
            hitSound.play().catch(err => console.log("Ses oynatılamadı:", err)); 
        } else { 
            // Zemine (kütlesi 0 olan her yere) çarpınca düşme sesi
            fallSound.currentTime = 0; 
            fallSound.play().catch(err => console.log("Ses oynatılamadı:", err)); 
        }
    });

    p2Body.addEventListener('collide', (e) => {
        if(e.body.mass > 0) { 
            hitSound.currentTime = 0; 
            hitSound.play().catch(err => console.log("Ses oynatılamadı:", err)); 
        } else { 
            fallSound.currentTime = 0; 
            fallSound.play().catch(err => console.log("Ses oynatılamadı:", err)); 
        }
    });

    window.addEventListener('resize', onWindowResize);
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);
    handleControls(p1Body, p2Body);

    // Fizik dünyasındaki koordinatları modellerle kusursuzca eşle
    if (p1Mesh) { p1Mesh.position.copy(p1Body.position); p1Mesh.quaternion.copy(p1Body.quaternion); }
    if (p2Mesh) { p2Mesh.position.copy(p2Body.position); p2Mesh.quaternion.copy(p2Body.quaternion); }

    // Kamera takibi
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