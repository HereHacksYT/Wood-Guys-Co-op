let world;

export function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0); // Yerçekimi

    // Platform (Zemin) Fiziği
    const groundMaterial = new CANNON.Material("groundMaterial");
    const groundBody = new CANNON.Body({
        mass: 0, // Kütle 0 = Sabit duran obje
        shape: new CANNON.Box(new CANNON.Vec3(20, 0.5, 5)),
        material: groundMaterial
    });
    groundBody.position.set(0, -0.5, 0);
    world.addBody(groundBody);

    return world;
}

export function createPhysicsPlayer(x, y) {
    const playerMaterial = new CANNON.Material("playerMaterial");
    const body = new CANNON.Body({
        mass: 2, // Ağırlık
        shape: new CANNON.Box(new CANNON.Vec3(0.6, 1.2, 0.6)), // Kukla boyutu
        material: playerMaterial
    });
    body.position.set(x, y, 0);
    body.fixedRotation = true; // Kuklanın dik durması için rotasyonu sabitliyoruz
    body.updateMassProperties();
    world.addBody(body);
    return body;
}