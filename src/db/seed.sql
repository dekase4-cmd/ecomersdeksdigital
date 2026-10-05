-- ==============================================================================
-- NEON POSTGRESQL DATA SEED - DEKSDIGITAL E-COMMERCE
-- ==============================================================================
-- File: src/db/seed.sql
-- Digunakan untuk mengisi data awal ke Neon PostgreSQL SQL Editor.

-- 1. SEED USERS
INSERT INTO users (id, username, password, role, shop_name, whatsapp, admin_fee_percent)
VALUES 
  ('admin', 'admin', '$2a$10$YL77Af0cIC2w838MRv2lWu/UCxdpNWYIrFnXXjfkHr2BAq0dz13hq', 'admin', 'Deksdigital Store', '628123456789', 0),
  ('mitra1', 'mitra1', '$2a$10$bYuRxH7iKNPXwoOAwKDZheBT2noFKgrZ5yD.hI6n2rlb5X6f0uZlW', 'mitra', 'Toko Sepatu Mitra', '628987654321', 5.0),
  ('mitra_1781943915504', 'mitrates1', '$2a$10$ZvIk4FHWqBnbctUOK8927O2/PihxBJZx1N7GB1d9ox9SS/fQ8rnrq', 'mitra', 'Toko Mitra Test', '081234567890', 5.0),
  ('mitra_1781945667441', 'desakemiri', '$2a$10$BrDpsSWgTqqTKdgCRgCFMeOV6/qqt6e9Rpg5Iytn28Fr5tclVBjZG', 'mitra', 'kemiri jaya', '6284665574', 1.0)
ON CONFLICT (id) DO NOTHING;

-- 2. SEED PRODUCTS
INSERT INTO products (id, name, description, category, price, stock, image_url, status, owner_id, delivery_type, weight, origin_city, origin_province)
VALUES
  ('prod_deks_001', 'canva premium', 'Tingkatkan produktivitas dan estetika meja kerja Anda dengan Mouse Wireless Deksdigital Premium.', 'Umum', 75000, 2, '/uploads/prod_edit_1781946816525.png', 'aktif', 'admin', 'digital', 0, 'Jakarta', ''),
  ('prod_deks_002', 'Keyboard Mechanical Deksdigital RGB', 'Keyboard mekanikal premium dengan switch biru yang tactile dan clicky.', 'Aksesoris', 250000, 2, '/uploads/default-keyboard.jpg', 'aktif', 'admin', 'fisik', 0, 'Bandar Lampung', ''),
  ('prod_deks_003', 'Mousepad Gaming Anti-Slip Deksdigital', 'Mousepad berukuran besar dengan permukaan kain tenun mikro.', 'Aksesoris', 45000, 15, '/uploads/default-mousepad.jpg', 'aktif', 'admin', 'fisik', 0, 'Jakarta', ''),
  ('prod_mitra_001', 'Sepatu Sneakers Casual Sport', 'Sepatu sneakers olahraga kasual yang ringan dan breathable.', 'Fashion', 150000, 25, '/uploads/default-sneakers.jpg', 'aktif', 'mitra1', 'fisik', 800, 'Bandung', 'Jawa Barat'),
  ('prod_mitra_002', 'Kaos Polo Premium Katun', 'Kaos polo lengan pendek buatan lokal berkualitas ekspor.', 'Fashion', 85000, 12, '/uploads/default-polo.jpg', 'aktif', 'mitra1', 'fisik', 300, 'Bandung', 'Jawa Barat')
ON CONFLICT (id) DO NOTHING;

-- 3. SEED DISCOUNT CODES
INSERT INTO discount_codes (code, type, value, status)
VALUES
  ('DEKSDIGITAL', 'percentage', 10, 'aktif'),
  ('DISKON50K', 'fixed', 50000, 'aktif')
ON CONFLICT (code) DO NOTHING;

-- 4. SEED SETTINGS
INSERT INTO settings (id, data)
VALUES (
  'main',
  '{
    "shopName": "Deksdigital",
    "promoBanners": [
      {
        "id": "banner_1",
        "imageUrl": "/uploads/hero-banner.png",
        "tag": "🔥 DISKON SPESIAL",
        "title": "Promo Aksesoris & Setup Gear",
        "desc": "Dapatkan penawaran harga terbaik untuk aksesoris gaming & kantor original Deksdigital.",
        "buttonText": "Cek Produk Diskon",
        "buttonLink": "#sec-products"
      }
    ],
    "trustBadges": [
      { "icon": "shield-check", "title": "Garansi Resmi", "desc": "Produk 100% Original" },
      { "icon": "zap", "title": "Proses Cepat", "desc": "Order & proses instan" }
    ],
    "announcement": "Selamat datang di Deksdigital Store!",
    "whatsappAdmin": "628123456789",
    "whatsappGreeting": "Halo Admin Deksdigital, saya ingin bertanya tentang produk Anda.",
    "whatsappInvoiceTemplate": "Halo Admin, saya ingin mengonfirmasi pembayaran untuk pesanan *{orderId}*.",
    "stockThreshold": 5,
    "theme": {
      "primary": "#0a192f",
      "secondary": "#1a6a74",
      "accent": "#f97316",
      "background": "#95b3d0",
      "text": "#334155"
    },
    "features": {
      "promoBanner": true,
      "reviews": true,
      "stockAlert": true,
      "whatsappChat": true,
      "newsletter": true,
      "searchBar": true,
      "aiChat": true
    },
    "qris": {
      "merchantName": "DEKSDIGITAL PAY",
      "nmid": "ID102030405060",
      "qrisImage": "/uploads/qris_1781945360045.jpg"
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
