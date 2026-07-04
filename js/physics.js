let world;

export function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);

    // Çimen Üst Tabaka Fiziği
    const groundBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(25, 0.2, 5))
    });
    groundBody.position.set(0, 0, 0);
    world.addBody(groundBody);

    // Toprak Alt Katman Fiziği
    const dirtBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(25, 2, 5))
    });
    dirtBody.position.set(0, -2.2, 0);
    world.addBody(dirtBody);

    // Koruma Duvarı Fiziği
    const wallBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(25, 15, 0.5))
    });
    wallBody.position.set(0, 5, -2);
    world.addBody(wallBody);

    return world;
}

export function createPhysicsPlayer(x, y) {
    const body = new CANNON.Body({
        mass: 3,
        shape: new CANNON.Box(new CANNON.Vec3(0.6, 1.2, 0.6))
    });
    body.position.set(x, y, 0);
    body.fixedRotation = true;
    body.updateMassProperties();
    world.addBody(body);
    return body;
}