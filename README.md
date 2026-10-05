# 🛒 Deksdigital E-Commerce Platform

Platform e-commerce berbasis **Node.js** yang terinspirasi Shopee, lengkap dengan **Dashboard Admin**, **Dashboard Mitra (Multi-Vendor)**, **AI Chatbot Gemini**, dan **Struk Digital Otomatis**.

---

## 🚀 Cara Menjalankan

```bash
# Opsi 1: Gunakan script starter (Direkomendasikan)
chmod +x start.sh
./start.sh

# Opsi 2: Jalankan langsung
/home/deka/node-local/bin/node server.js
```

Server akan berjalan di: **http://localhost:3000**

---

## 🌐 Daftar URL Akses

| Halaman | URL |
|---|---|
| 🛒 Toko Utama (Storefront) | `http://localhost:3000` |
| 🤝 Katalog Kemitraan | `http://localhost:3000/kemitraan.html` |
| 🛡️ Login Admin Dashboard | `http://localhost:3000/admin-dashboard/login.html` |
| 🏪 Login/Daftar Mitra | `http://localhost:3000/mitra-dashboard/login.html` |

---

## 🔑 Kredensial Default

### Admin
| Username | Password |
|---|---|
| `admin` | `admin123` |

> ⚠️ **Segera ubah password admin** setelah pertama kali masuk melalui menu pengaturan di Dashboard Admin.

---

## ✨ Fitur Lengkap

### 🛍️ Storefront (Sisi Pembeli)
- Katalog produk dinamis dengan filter kategori & pencarian
- Halaman detail produk dengan informasi stok dan toko penjual
- Keranjang belanja berbasis `localStorage`
- Checkout dengan pembayaran QRIS
- **Struk/Invoice Digital otomatis** (untuk cetak & kirim WhatsApp)
- **AI Chatbot Asisten Belanja** bertenaga Gemini AI
- Float Widget WhatsApp CS (dapat dinonaktifkan dari Admin)

### 🤝 Halaman Kemitraan
- Landing page khusus untuk produk-produk mitra (multi-vendor)
- Harga tampil sudah termasuk persentase komisi platform
- Klik produk diarahkan ke halaman detail & WhatsApp mitra yang bersangkutan

### 🛡️ Admin Dashboard (No-Code)
Panel kontrol penuh tanpa perlu menulis kode:

| Panel | Fungsi |
|---|---|
| **Pengaturan Toko** | Nama toko, pengumuman banner, nomor WA admin |
| **Manajemen Tema** | Ubah warna primary, secondary, accent secara live |
| **Toggle Fitur** | Aktif/nonaktifkan fitur: Chat AI, WA CS, Ulasan, dll |
| **Susun Layout** | Drag-and-drop urutan seksi halaman utama |
| **Manajemen QRIS** | Upload foto QRIS baru, atur nama merchant & NMID |
| **Kelola Produk** | CRUD produk resmi Deksdigital dengan upload gambar |
| **Manajemen Pesanan** | Lihat & ubah status semua transaksi (Admin + Mitra) |
| **Laporan Keuangan** | Total penjualan, komisi mitra, jumlah partner |
| **Pengaturan AI** | Input Gemini API Key secara langsung dari dashboard |
| **Manajemen Mitra** | Lihat daftar semua mitra yang terdaftar |

### 🏪 Mitra Dashboard (Multi-Vendor)
- Registrasi & login dengan akun terpisah dari admin
- Atur profil toko, nomor WhatsApp toko, dan **persentase biaya layanan** (min. 1%)
- CRUD produk kemitraan dengan upload gambar
- Pantau pesanan masuk khusus produk miliknya
- **Generator Deskripsi Produk AI** bertenaga Gemini

---

## 🏗️ Arsitektur Teknis

```
projek ecomers deksdigital/
├── server.js                  # Entry point & middleware utama
├── start.sh                   # Script starter
├── package.json
│
├── src/
│   ├── routes/
│   │   ├── store.js           # API publik (produk, checkout, QRIS)
│   │   ├── admin.js           # API Admin (CRUD, settings, laporan)
│   │   ├── mitra.js           # API Mitra (profil, produk, pesanan)
│   │   └── ai.js              # API AI (chatbot, generator deskripsi)
│   └── db/
│       ├── dbHelper.js        # Helper baca/tulis JSON database
│       ├── settings.json      # ⭐ Pusat konfigurasi no-code
│       ├── products.json      # Database produk
│       ├── users.json         # Database admin & mitra
│       └── orders.json        # Database pesanan
│
├── public/                    # Storefront (akses publik)
│   ├── index.html             # Beranda
│   ├── kemitraan.html         # Katalog mitra
│   ├── product.html           # Detail produk
│   ├── cart.html              # Keranjang & checkout
│   ├── receipt.html           # Struk digital
│   ├── css/style.css          # Desain sistem CSS
│   ├── js/app.js              # Logika frontend bersama
│   └── uploads/               # Gambar QRIS & produk
│
├── admin-views/               # Dashboard Admin (akses terlindungi)
│   ├── login.html
│   ├── index.html
│   ├── css/admin.css
│   └── js/admin.js
│
└── mitra-views/               # Dashboard Mitra (akses terlindungi)
    ├── login.html             # Login & Registrasi mitra (satu halaman)
    ├── index.html
    ├── css/mitra.css
    └── js/mitra.js
```

---

## 🔒 Keamanan

- **Sesi HTTP-Only Cookie**: Cookie sesi tidak dapat diakses oleh JavaScript sisi klien (proteksi XSS)
- **SameSite Strict**: Cookie hanya dikirim untuk request dari domain yang sama (proteksi CSRF)
- **bcryptjs**: Semua password di-hash sebelum disimpan ke database
- **Isolasi Role**: Middleware `isAdmin` dan `isMitra` memastikan tidak ada akses lintas role
- **Validasi Input**: Semua endpoint memvalidasi input sebelum memproses
- **API Key Aman**: Gemini API Key tidak pernah dikirim ke sisi client (dihapus dari public settings)

---

## 🤖 Konfigurasi AI Gemini

1. Dapatkan API Key gratis di: https://aistudio.google.com/apikey
2. Login ke **Admin Dashboard** → Panel **Pengaturan AI**
3. Masukkan API Key dan klik Simpan
4. Chatbot dan Generator Deskripsi Produk akan langsung aktif menggunakan Gemini

> Jika API Key kosong, sistem akan menggunakan **AI Fallback lokal** berdasarkan keyword matching.

---

## 💬 Integrasi WhatsApp

### WA Admin/CS
- Dikonfigurasi di Admin Dashboard → Pengaturan Toko
- Widget WA CS floating akan muncul di semua halaman storefront
- Dapat diaktifkan/nonaktifkan melalui Toggle Fitur

### WA Konfirmasi Pembayaran (Struk Otomatis)
- Setelah checkout, pembeli diarahkan ke halaman struk digital
- Terdapat tombol **"Konfirmasi via WhatsApp"** yang otomatis mengisi:
  - ID Pesanan, daftar produk, total bayar
  - Data pemesan (nama, telepon, alamat)
- **Routing Cerdas**: Jika semua produk dalam pesanan milik satu mitra, konfirmasi dikirim langsung ke **WhatsApp Mitra** tersebut. Jika campuran, diarahkan ke **WhatsApp Admin**.

---

## ⚙️ Sistem Komisi Mitra

1. Mitra mendaftar dan menentukan **persentase biaya layanan** (minimum 1%) untuk pemilik platform
2. Mitra menginput **harga dasar** produk di dashboard mereka
3. Di halaman kemitraan & detail produk, harga yang tampil adalah:  
   `Harga Jual = Harga Dasar + (Harga Dasar × % Biaya Layanan)`
4. Laporan Admin menampilkan total **komisi yang terkumpul** dari semua transaksi mitra

---

*Dibuat dengan ❤️ menggunakan Node.js, Express, Vanilla CSS, dan Gemini AI*
