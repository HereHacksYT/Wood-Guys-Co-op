let world;

export function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -12, 0); // Takılmaları azaltmak için yerçekimi biraz artırıldı

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

    // Sürtünmeleri sıfırlayarak takılmaları kesin olarak çözen malzeme ayarı
    const playerMaterial = new CANNON.Material("playerMat");
    const groundMaterial = new CANNON.Material("groundMat");

    groundBody.material = groundMaterial;
    dirtBody.material = groundMaterial;

    const contactMat = new CANNON.ContactMaterial(playerMaterial, groundMaterial, {
        friction: 0.0, // Sağa sola kayarken zemine takılmayı sıfırlar!
        restitution: 0.1
    });
    world.addContactMaterial(contactMat);

    return world;
}

export function createPhysicsPlayer(x, y) {
    // Takılmayı önlemek için alt kısmı küre gibi düşünen bir gövde kombinasyonu yapıyoruz
    const body = new CANNON.Body({
        mass: 4,
        material: new CANNON.Material("playerMat")
    });
    
    // Ana gövde kapsülü (silindir benzeri takılmayan kutu)
    const sphereShape = new CANNON.Sphere(0.6); // Alt kısım yuvarlak olunca takılma biter
    body.addShape(sphereShape, new CANNON.Vec3(0, -0.6, 0));
    
    const boxShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.6, 0.5));
    body.addShape(boxShape, new CANNON.Vec3(0, 0.4, 0));

    body.position.set(x, y, 0);
    body.fixedRotation = true; // Karakterlerin dik durması için
    body.updateMassProperties();
    world.addBody(body);
    return body;
}