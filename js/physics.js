let world;

export function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0); // Dünya yerçekimi standardı

    // Zemin Fiziği (Düşmeyi engeller)
    const groundMaterial = new CANNON.Material("groundMaterial");
    const groundBody = new CANNON.Body({
        mass: 0, // 0 kütle = Sabit, sarsılmaz zemin
        shape: new CANNON.Box(new CANNON.Vec3(25, 0.5, 5)),
        material: groundMaterial
    });
    groundBody.position.set(0, -0.5, 0);
    world.addBody(groundBody);

    // Oyuncuların birbirine sürtünme katsayısı
    const contactMaterial = new CANNON.ContactMaterial(groundMaterial, groundMaterial, {
        friction: 0.4,
        restitution: 0.2 // Hafif zıplama esnekliği
    });
    world.addContactMaterial(contactMaterial);

    return world;
}

export function createPhysicsPlayer(x, y) {
    const playerShape = new CANNON.Box(new CANNON.Vec3(0.6, 1.2, 0.6));
    const body = new CANNON.Body({
        mass: 3, // Kukla ağırlığı (İtilme dengesi için ideal)
        shape: playerShape
    });
    body.position.set(x, y, 0);
    body.fixedRotation = true; // Kuklanın yere dik durması devrilmemesi için
    body.updateMassProperties();
    world.addBody(body);
    return body;
}