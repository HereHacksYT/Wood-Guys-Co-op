// ==========================================
// ⚙️ ROBOT GUYS CO-OP - FİZİK MOTORU
// ==========================================

let world;
let levelObjects = [];

function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -350, 0);
    world.broadphase = new CANNON.NaiveBroadphase();

    const playerMat = new CANNON.Material('playerMat');
    const groundMat = new CANNON.Material('groundMat');

    const contactMat = new CANNON.ContactMaterial(playerMat, groundMat, {
        friction: 0.5,
        restitution: 0.0
    });
    world.addContactMaterial(contactMat);

    // Oyuncu – oyuncu çarpışması
    const playerPlayerMat = new CANNON.ContactMaterial(playerMat, playerMat, {
        friction: 0.1,
        restitution: 0.1
    });
    world.addContactMaterial(playerPlayerMat);
}

function createPhysicsPlayer(x, y, z) {
    const mat = new CANNON.Material('playerMat');
    const body = new CANNON.Body({ mass: 100, material: mat });
    
    // Ana gövde (kutu)
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.6, 1.2, 0.6)));
    
    // Tekerlek (küre - ayak görevi)
    const wheelShape = new CANNON.Sphere(0.5);
    body.addShape(wheelShape, new CANNON.Vec3(0, -1.0, 0));
    
    body.position.set(x, y, z);
    body.fixedRotation = true;
    body.linearDamping = 0.1;
    body.angularDamping = 0.1;
    world.addBody(body);
    return body;
}

function addStaticPhysics(mesh, size, center) {
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    body.position.set(center.x, center.y, center.z);
    world.addBody(body);
    levelObjects.push({ mesh, body });
}

function stepPhysics(dt) {
    world.step(1 / 60, dt, 3);
}