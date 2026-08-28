#!/usr/bin/env python3
"""
Dilara & Çağrı - Mektup Sunucusu
Yerel: SQLite (letters.db)
Render/Canlı: PostgreSQL (DATABASE_URL ortam değişkeni ile otomatik algılar)
"""

import http.server
import socketserver
import json
import os
import urllib.parse
from datetime import datetime

PORT = int(os.environ.get("PORT", 5500))
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

# Ortam değişkenine göre SQLite mi PostgreSQL mi kullanacağını seç
DATABASE_URL = os.environ.get("DATABASE_URL", None)

# PostgreSQL bağlantısı
def get_pg_conn():
    import psycopg2
    import psycopg2.extras
    url = DATABASE_URL
    # Render bazen postgres:// yerine postgresql:// gerektirir
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return psycopg2.connect(url)

# SQLite bağlantısı
def get_sqlite_conn():
    import sqlite3
    db_file = os.path.join(STATIC_DIR, "letters.db")
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    return conn

def use_pg():
    return DATABASE_URL is not None

# ─────────────────────────────────────────────
# VERİTABANI BAŞLATMA
# ─────────────────────────────────────────────
def init_db():
    if use_pg():
        conn = get_pg_conn()
        cur = conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS letters (
            id SERIAL PRIMARY KEY,
            sender TEXT NOT NULL,
            recipient TEXT NOT NULL,
            title TEXT NOT NULL,
            salutation TEXT,
            body TEXT NOT NULL,
            signature TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cur.execute("SELECT COUNT(*) FROM letters")
        count = cur.fetchone()[0]
        if count == 0:
            cur.execute("""
            INSERT INTO letters (sender, recipient, title, salutation, body, signature, is_read, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                'Çağrı', 'Dilara',
                'İlk Mektubum: İyi ki Geldin 💜',
                'Sevgilim Dilara,',
                '<p>4 Nisan 2026... Hayatımın en güzel, en huzurlu dönüm noktası seninle tanıştığım o gün oldu.</p><p>Gözlerinin içine her baktığımda, bana hissettirdiğin o derin güveni ve kalbimin ritmini değiştiren gülüşünü görüyorum. Bu mektup kutusu bizim küçük aşk dünyamız olsun; birbirimize söylemek istediğimiz tüm güzel duyguları buraya mühürleyelim.</p><p>İyi ki varsın, iyi ki hayatımdasın. Seni çok seviyorum...</p>',
                'Çağrı',
                False,
                '2026-04-04 12:00:00'
            ))
        conn.commit()
        conn.close()
        print("[*] PostgreSQL veritabanı hazır (Render/Bulut modu).")
    else:
        import sqlite3
        db_file = os.path.join(STATIC_DIR, "letters.db")
        conn = sqlite3.connect(db_file)
        cur = conn.cursor()
        cur.execute("""
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
        )
        """)
        cur.execute("SELECT COUNT(*) FROM letters")
        if cur.fetchone()[0] == 0:
            cur.execute("""
            INSERT INTO letters (sender, recipient, title, salutation, body, signature, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                'Çağrı', 'Dilara',
                'İlk Mektubum: İyi ki Geldin 💜',
                'Sevgilim Dilara,',
                '<p>4 Nisan 2026... Hayatımın en güzel, en huzurlu dönüm noktası seninle tanıştığım o gün oldu.</p><p>Gözlerinin içine her baktığımda, bana hissettirdiğin o derin güveni ve kalbimin ritmini değiştiren gülüşünü görüyorum. Bu mektup kutusu bizim küçük aşk dünyamız olsun; birbirimize söylemek istediğimiz tüm güzel duyguları buraya mühürleyelim.</p><p>İyi ki varsın, iyi ki hayatımdasın. Seni çok seviyorum...</p>',
                'Çağrı',
                0,
                '2026-04-04 12:00:00'
            ))
        conn.commit()
        conn.close()
        print(f"[*] SQLite veritabanı hazır: {db_file}")

# ─────────────────────────────────────────────
# MEKTUP LİSTESİ ÇEKME
# ─────────────────────────────────────────────
def fetch_letters():
    if use_pg():
        conn = get_pg_conn()
        cur = conn.cursor()
        cur.execute("SELECT id, sender, recipient, title, salutation, body, signature, is_read, created_at FROM letters ORDER BY created_at DESC")
        rows = cur.fetchall()
        conn.close()
        result = []
        for row in rows:
            result.append({
                "id": row[0],
                "from": row[1],
                "to": row[2],
                "title": row[3],
                "salutation": row[4],
                "body": row[5],
                "signature": row[6],
                "isRead": bool(row[7]),
                "date": str(row[8]),
                "createdAt": int(row[8].timestamp() * 1000) if row[8] else 0
            })
        return result
    else:
        import sqlite3
        db_file = os.path.join(STATIC_DIR, "letters.db")
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM letters ORDER BY created_at DESC")
        rows = cur.fetchall()
        conn.close()
        result = []
        for row in rows:
            try:
                ts = int(datetime.fromisoformat(str(row["created_at"]).replace(" ", "T")).timestamp() * 1000)
            except Exception:
                ts = 0
            result.append({
                "id": row["id"],
                "from": row["sender"],
                "to": row["recipient"],
                "title": row["title"],
                "salutation": row["salutation"],
                "body": row["body"],
                "signature": row["signature"],
                "isRead": bool(row["is_read"]),
                "date": row["created_at"],
                "createdAt": ts
            })
        return result

# ─────────────────────────────────────────────
# YENİ MEKTUP KAYDET
# ─────────────────────────────────────────────
def insert_letter(payload):
    sender    = payload.get('from', 'Çağrı')
    recipient = payload.get('to', 'Dilara')
    title     = payload.get('title', 'Yeni Mektup')
    salutation = payload.get('salutation', 'Sevgilim,')
    body      = payload.get('body', '')
    signature = payload.get('signature', sender)

    if use_pg():
        conn = get_pg_conn()
        cur = conn.cursor()
        cur.execute("""
        INSERT INTO letters (sender, recipient, title, salutation, body, signature)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (sender, recipient, title, salutation, body, signature))
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
    else:
        import sqlite3
        db_file = os.path.join(STATIC_DIR, "letters.db")
        conn = sqlite3.connect(db_file)
        cur = conn.cursor()
        cur.execute("""
        INSERT INTO letters (sender, recipient, title, salutation, body, signature)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (sender, recipient, title, salutation, body, signature))
        new_id = cur.lastrowid
        conn.commit()
        conn.close()
    return new_id

# ─────────────────────────────────────────────
# MEKTUBU OKUNDU YAP
# ─────────────────────────────────────────────
def mark_read(letter_id):
    if use_pg():
        conn = get_pg_conn()
        cur = conn.cursor()
        cur.execute("UPDATE letters SET is_read = TRUE WHERE id = %s", (letter_id,))
        conn.commit()
        conn.close()
    else:
        import sqlite3
        db_file = os.path.join(STATIC_DIR, "letters.db")
        conn = sqlite3.connect(db_file)
        cur = conn.cursor()
        cur.execute("UPDATE letters SET is_read = 1 WHERE id = ?", (letter_id,))
        conn.commit()
        conn.close()

# ─────────────────────────────────────────────
# HTTP SUNUCU
# ─────────────────────────────────────────────
class LetterboxHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/letters':
            data = fetch_letters()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_cors()
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        try:
            payload = json.loads(post_data) if post_data else {}
        except Exception:
            payload = {}

        if parsed.path == '/api/letters':
            new_id = insert_letter(payload)
            self.send_response(201)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "id": new_id}, ensure_ascii=False).encode('utf-8'))
            return

        if parsed.path.startswith('/api/letters/') and parsed.path.endswith('/read'):
            parts = parsed.path.strip('/').split('/')
            letter_id = parts[2]
            mark_read(letter_id)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"status": "updated", "id": letter_id}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass  # Gereksiz log çıktılarını kapat

if __name__ == '__main__':
    init_db()
    mod = "PostgreSQL (Bulut)" if use_pg() else "SQLite (Yerel)"
    print(f"\n💜 Dilara & Çağrı Sunucusu Başladı! [{mod}]")
    print(f"👉 http://localhost:{PORT}\n")
    with socketserver.TCPServer(("", PORT), LetterboxHandler) as httpd:
        httpd.serve_forever()
