let world;

export function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -14, 0); 

    // Çimenlik Alan Fiziği
    const groundBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(20, 0.2, 3))
    });
    groundBody.position.set(0, 0, 0);
    world.addBody(groundBody);

    // Toprak Alan Fiziği
    const dirtBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(20, 1.5, 3))
    });
    dirtBody.position.set(0, -1.7, 0);
    world.addBody(dirtBody);

    const playerMaterial = new CANNON.Material("playerMat");
    const groundMaterial = new CANNON.Material("groundMat");

    groundBody.material = groundMaterial;
    dirtBody.material = groundMaterial;

    const contactMat = new CANNON.ContactMaterial(playerMaterial, groundMaterial, {
        friction: 0.0,
        restitution: 0.02
    });
    world.addContactMaterial(contactMat);

    return world;
}

export function createPhysicsPlayer(x, y, z) {
    const body = new CANNON.Body({
        mass: 4,
        material: new CANNON.Material("playerMat")
    });
    
    // Takılma önleyici alt küre tabanı
    const sphereShape = new CANNON.Sphere(0.5);
    body.addShape(sphereShape, new CANNON.Vec3(0, -0.5, 0));
    
    const boxShape = new CANNON.Box(new CANNON.Vec3(0.45, 0.6, 0.45));
    body.addShape(boxShape, new CANNON.Vec3(0, 0.4, 0));

    body.position.set(x, y, z); // Tam hizalanma sağlandı
    body.fixedRotation = true;
    body.updateMassProperties();
    world.addBody(body);
    return body;
}