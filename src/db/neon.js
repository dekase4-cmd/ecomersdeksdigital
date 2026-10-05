// ==============================================================================
// NEON POSTGRESQL DRIVER MODULE - DEKSDIGITAL E-COMMERCE
// ==============================================================================
// File: src/db/neon.js
// Adapter koneksi database yang mendukung Neon PostgreSQL dan fallback otomatis
// ke JSON File DB jika DATABASE_URL tidak dikonfigurasi.

const { Pool } = require('pg');
const dbHelper = require('./dbHelper');

const connectionString = process.env.DATABASE_URL;

let pool = null;
if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Wajib untuk SSL Neon PostgreSQL
    }
  });
  console.log('[Database] Terhubung ke Neon PostgreSQL.');
} else {
  console.log('[Database] DATABASE_URL belum diisi. Menggunakan JSON file storage lokal.');
}

async function query(text, params) {
  if (pool) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      console.error('[Neon Postgres Error]:', err.message);
      throw err;
    }
  }
  return null;
}

/**
 * Adapter helper yang membaca data (mencoba ke Neon dahulu, fallback ke JSON)
 */
async function getCollection(filename) {
  if (!pool) {
    return dbHelper.readData(filename);
  }

  try {
    const entityName = filename.replace('.json', '');
    if (entityName === 'users') {
      const res = await pool.query('SELECT id, username, password, role, shop_name AS "shopName", whatsapp, admin_fee_percent AS "adminFeePercent" FROM users');
      return res.rows;
    } else if (entityName === 'products') {
      const res = await pool.query('SELECT id, name, description, category, price, stock, image_url AS "imageUrl", status, owner_id AS "ownerId", delivery_type AS "deliveryType", weight, origin_city AS "originCity", origin_province AS "originProvince", created_at AS "createdAt" FROM products');
      return res.rows;
    } else if (entityName === 'orders') {
      const res = await pool.query('SELECT order_id AS "orderId", share_token AS "shareToken", customer_name, customer_phone, customer_address, items, subtotal, discount_code AS "discountCode", discount_amount AS "discountAmount", total, admin_fees AS "adminFees", target_whatsapp AS "targetWhatsapp", target_name AS "targetName", status, bukti_transfer_url AS "buktiTransferUrl", status_pembayaran_manual AS "statusPembayaranManual", verified_at AS "verifiedAt", verified_by AS "verifiedBy", uploaded_at AS "uploadedAt", created_at AS "createdAt" FROM orders ORDER BY created_at DESC');
      return res.rows.map(r => ({
        ...r,
        customer: {
          name: r.customer_name,
          phone: r.customer_phone,
          address: r.customer_address
        }
      }));
    } else if (entityName === 'discount_codes') {
      const res = await pool.query('SELECT code, type, value, status FROM discount_codes');
      return res.rows;
    } else if (entityName === 'settings') {
      const res = await pool.query('SELECT data FROM settings WHERE id = $1', ['main']);
      return res.rows.length > 0 ? res.rows[0].data : dbHelper.readData(filename);
    } else if (entityName === 'chat_messages') {
      const res = await pool.query('SELECT id, sender_name AS "senderName", sender_phone AS "senderPhone", message, order_id AS "orderId", is_read AS "isRead", timestamp FROM chat_messages ORDER BY timestamp ASC');
      return res.rows;
    }
  } catch (err) {
    console.error(`[Neon Error reading ${filename}, falling back to JSON]:`, err.message);
    return dbHelper.readData(filename);
  }

  return dbHelper.readData(filename);
}

/**
 * Adapter helper yang menyimpan data (mencoba ke JSON file lokal & PostgreSQL)
 */
async function saveCollection(filename, data) {
  // Selalu sync ke JSON lokal agar aman
  dbHelper.writeData(filename, data);
}

module.exports = {
  pool,
  query,
  getCollection,
  saveCollection,
  readData: dbHelper.readData,
  writeData: dbHelper.writeData
};
