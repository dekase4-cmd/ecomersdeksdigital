-- ==============================================================================
-- NEON POSTGRESQL DATABASE SCHEMA - DEKSDIGITAL E-COMMERCE
-- ==============================================================================
-- File: src/db/schema.sql
-- Digunakan untuk inisialisasi tabel pada database Neon PostgreSQL.

-- 1. TABEL USERS (Admin & Mitra)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(100) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'mitra', -- 'admin' atau 'mitra'
  shop_name VARCHAR(150),
  whatsapp VARCHAR(50),
  admin_fee_percent NUMERIC(5, 2) DEFAULT 5.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABEL PRODUCTS (Produk Deksdigital & Produk Mitra)
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'Umum',
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'aktif', -- 'aktif' atau 'nonaktif'
  owner_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  delivery_type VARCHAR(50) DEFAULT 'fisik', -- 'fisik' atau 'digital'
  weight INT DEFAULT 0, -- dalam gram
  origin_city VARCHAR(100),
  origin_province VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABEL ORDERS (Transaksi Pembeli)
CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(100) PRIMARY KEY,
  share_token VARCHAR(100) UNIQUE,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  customer_address TEXT NOT NULL,
  items JSONB NOT NULL, -- Menyimpan array item {productId, name, qty, price, originalPrice, subtotal, ownerId}
  subtotal NUMERIC(12, 2) DEFAULT 0,
  discount_code VARCHAR(50),
  discount_amount NUMERIC(12, 2) DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  admin_fees NUMERIC(12, 2) DEFAULT 0,
  target_whatsapp VARCHAR(50),
  target_name VARCHAR(150),
  status VARCHAR(50) DEFAULT 'Menunggu Pembayaran',
  bukti_transfer_url TEXT,
  status_pembayaran_manual VARCHAR(50) DEFAULT 'belum_upload',
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by VARCHAR(100),
  uploaded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABEL DISCOUNT CODES (Kode Kupon)
CREATE TABLE IF NOT EXISTS discount_codes (
  code VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage' atau 'fixed'
  value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'aktif',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABEL SETTINGS (Pengaturan Toko No-Code, Tema, QRIS, Gemini AI, Banner)
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'main',
  data JSONB NOT NULL
);

-- 6. TABEL CHAT MESSAGES (Pesan Live Chat / CS)
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(100) PRIMARY KEY,
  sender_name VARCHAR(150),
  sender_phone VARCHAR(50),
  message TEXT NOT NULL,
  order_id VARCHAR(100),
  is_read BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes untuk performa kueri yang cepat
CREATE INDEX IF NOT EXISTS idx_products_owner ON products(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
