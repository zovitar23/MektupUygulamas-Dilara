-- ===================================================================
-- Dilara & Çağrı - SQLite Veritabanı Şeması (letters.db)
-- ===================================================================

CREATE TABLE IF NOT EXISTS letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    title TEXT NOT NULL,
    salutation TEXT,
    body TEXT NOT NULL,
    signature TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Başlangıç mektubu (4 Nisan 2026)
INSERT INTO letters (sender, recipient, title, salutation, body, signature, is_read, created_at)
VALUES (
    'Çağrı',
    'Dilara',
    'İlk Mektubum: İyi ki Geldin 💜',
    'Sevgilim Dilara,',
    '<p>4 Nisan 2026... Hayatımın en güzel, en huzurlu dönüm noktası seninle tanıştığım o gün oldu.</p><p>Gözlerinin içine her baktığımda, bana hissettirdiğin o derin güveni ve kalbimin ritmini değiştiren gülüşünü görüyorum. Bu mektup kutusu bizim küçük aşk dünyamız olsun; birbirimize söylemek istediğimiz tüm güzel duyguları buraya mühürleyelim.</p><p>İyi ki varsın, iyi ki hayatımdasın. Seni çok seviyorum...</p>',
    'Çağrı',
    0,
    '2026-04-04 12:00:00'
);
