// ==============================================================================
// NEON POSTGRESQL MIGRATION & SEED SCRIPT
// ==============================================================================
// File: src/db/migrate.js
// Jalankan dengan: node src/db/migrate.js
// Otomatis membuat tabel dan data awal di Neon PostgreSQL.

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERROR: Environment variable DATABASE_URL belum diatur!');
  console.error('   Silakan jalankan script dengan command:');
  console.error('   DATABASE_URL="postgres://user:password@endpoint.neon.tech/neondb?sslmode=require" node src/db/migrate.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🚀 Memulai migrasi database Neon PostgreSQL...');
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');

    console.log('📦 Membuat struktur tabel (schema.sql)...');
    await pool.query(schemaSql);
    console.log('✅ Tabel berhasil dibuat!');

    console.log('🌱 Mengisi data awal (seed.sql)...');
    await pool.query(seedSql);
    console.log('✅ Data awal (Seed) berhasil dimasukkan!');

    console.log('🎉 Migrasi Neon PostgreSQL Selesai!');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
