let world;

export function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -13, 0); // Karakterlerin havada süzülmesini engellemek için optimize edildi

    // Çimenlik Alan Fiziği
    const groundBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(25, 0.2, 4))
    });
    groundBody.position.set(0, 0, 0);
    world.addBody(groundBody);

    // Toprak Alan Fiziği
    const dirtBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(25, 2, 4))
    });
    dirtBody.position.set(0, -2.2, 0);
    world.addBody(dirtBody);

    // Sürtünme Materyal Yapılandırması (Karakterlerin takılma sorununu tamamen ortadan kaldırır)
    const playerMaterial = new CANNON.Material("playerMat");
    const groundMaterial = new CANNON.Material("groundMat");

    groundBody.material = groundMaterial;
    dirtBody.material = groundMaterial;

    const contactMat = new CANNON.ContactMaterial(playerMaterial, groundMaterial, {
        friction: 0.0,
        restitution: 0.05
    });
    world.addContactMaterial(contactMat);

    return world;
}

export function createPhysicsPlayer(x, y, z) {
    const body = new CANNON.Body({
        mass: 4,
        material: new CANNON.Material("playerMat")
    });
    
    // Alt kısım için takılmayı önleyen küre geometrisi
    const sphereShape = new CANNON.Sphere(0.55);
    body.addShape(sphereShape, new CANNON.Vec3(0, -0.55, 0));
    
    // Üst gövde kutusu
    const boxShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.6, 0.5));
    body.addShape(boxShape, new CANNON.Vec3(0, 0.4, 0));

    body.position.set(x, y, z);
    body.fixedRotation = true;
    body.updateMassProperties();
    world.addBody(body);
    return body;
}