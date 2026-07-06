// ==========================================
// 🛠️ ROBOT GUYS CO-OP - FİZİK MOTORU AYARLARI
// ==========================================

// 1. Fizik Dünyasını ve Yerçekimini Başlatma
function initPhysics() {
    world = new CANNON.World();
    
    // Dünyanın yerçekimi (Yeni boyutlara göre dengelendi)
    world.gravity.set(0, -35, 0); 
    
    // Performans için çakışma algılama algoritması (NaiveBroadphase yerine NaiveBroadphase veya SAPBroadphase)
    world.broadphase = new CANNON.NaiveBroadphase();
    
    // Sürtünme ve Esneklik Malzemeleri
    const playerMat = new CANNON.Material("playerMat");
    const groundMat = new CANNON.Material("groundMat");
    
    // Karakter ve zemin arasındaki sürtünme kuralları
    const contactMaterial = new CANNON.ContactMaterial(playerMat, groundMat, {
        friction: 0.1,     // Karakterlerin kaymaması için ideal sürtünme
        restitution: 0.0   // Zıplayıp yere düştüklerinde top gibi sekmemeleri için 0 yapıldı
    });
    world.addContactMaterial(contactMaterial);
}

// 2. Karakterler İçin Fiziksel Gövde (Hitbox) Oluşturma
function createPhysicsPlayer(x, y, z, mat) {
    // Kütle (Mass): Karakterlerin havada uçmaması ve yere sağlam basması için 450 yapıldı
    const body = new CANNON.Body({ 
        mass: 450, 
        material: mat 
    });
    
    // Üç boyutlu kutu şeklinde hitbox (Genişlik: 15, Yükseklik: 30, Derinlik: 15)
    // Cannon.js merkezden dışarı ölçü aldığı için değerleri yarıya (7.5 ve 15) bölüyoruz
    body.addShape(new CANNON.Box(new CANNON.Vec3(7.5, 15, 7.5))); 
    
    // Doğma koordinatları
    body.position.set(x, y, z);
    
    // 🛑 KRİTİK: Robotların çarpışınca sağa sola devrilmesini önler (Dik durmalarını sağlar)
    body.fixedRotation = true;
    body.updateMassProperties();
    
    world.addBody(body);
    return body;
}

// 3. Harita Objelerine Katı Fizik Ekleme (Mesh -> Cannon.js Box)
function addMapPhysics(child, size, center) {
    const body = new CANNON.Body({
        mass: 0 // Mass 0 = Statik Obje (Kıpırdamaz, duvar veya zemin görevi görür)
    });
    
    // Haritadaki her bir mesh'in boyutuna göre tam üzerine fizik kutusu kaplar
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    body.position.set(center.x, center.y, center.z);
    
    world.addBody(body);
    levelObjects.push({ mesh: child, body: body });
}

// 4. Ana Döngüde (Main Loop) Fiziği Tetikleme ve Mesh'leri Güncelleme
// Bu kısım animate() fonksiyonunun içinde her karede (frame) çalışır:
function updatePhysicsStep(dt) {
    if (isGameStarted) {
        // Fizik dünyasını 60 FPS hızında bir adım ileri taşı
        world.step(1 / 60, dt, 3);
        
        // 1. Oyuncu (Puppet) Görselini Fizik Kutusuyla Eşitle
        if (p1Mesh && p1Body) { 
            p1Mesh.position.copy(p1Body.position); 
            // Görsel modelin merkez noktasını fizik kutusunun tabanına eşitlemek için Y ekseninde kaydırma
            p1Mesh.position.y -= 15; 
        }
        
        // 2. Oyuncu (Robot) Görselini Fizik Kutusuyla Eşitle
        if (p2Mesh && p2Body) { 
            p2Mesh.position.copy(p2Body.position); 
            p2Mesh.position.y -= 15; 
        }
    }
}