const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const dbHelper = require('../db/dbHelper');

// ============================================
// PUBLIC ROUTE (Hanya Login & Logout)
// ============================================

// 1. Login Admin
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const users = dbHelper.readData('users');
  const adminUser = users.find(u => u.username === username && u.role === 'admin');

  if (!adminUser) {
    return res.status(401).json({ error: 'Username atau password Admin salah.' });
  }

  // Cocokkan hash password
  const isMatch = bcrypt.compareSync(password, adminUser.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Username atau password Admin salah.' });
  }

  // Buat sesi
  req.session.user = {
    id: adminUser.id,
    username: adminUser.username,
    role: 'admin',
    shopName: adminUser.shopName
  };

  res.json({ success: true, user: req.session.user });
});

// 2. Logout Admin
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Gagal melakukan logout.' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Berhasil keluar.' });
  });
});

// ============================================
// SECURED ROUTES (Semua rute di bawah dilindungi)
// ============================================
router.use((req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(401).json({ error: 'Akses ditolak. Anda harus login sebagai Admin.' });
});

// 3. Mengambil Pengaturan Toko Lengkap (Termasuk API Key)
router.get('/settings', (req, res) => {
  const settings = dbHelper.readData('settings');
  res.json(settings);
});

// 4. Memperbarui Pengaturan Toko Global
router.put('/settings', (req, res) => {
  const settings = dbHelper.readData('settings');
  const { 
    shopName, announcement, whatsappAdmin, whatsappGreeting, 
    whatsappInvoiceTemplate, stockThreshold, theme, features, layout, geminiApiKey 
  } = req.body;

  // Lakukan pembaruan
  if (shopName) settings.shopName = shopName;
  if (announcement !== undefined) settings.announcement = announcement;
  if (whatsappAdmin) settings.whatsappAdmin = whatsappAdmin;
  if (whatsappGreeting !== undefined) settings.whatsappGreeting = whatsappGreeting;
  if (whatsappInvoiceTemplate) settings.whatsappInvoiceTemplate = whatsappInvoiceTemplate;
  if (stockThreshold !== undefined) settings.stockThreshold = parseInt(stockThreshold) || 5;
  if (geminiApiKey !== undefined) settings.geminiApiKey = geminiApiKey;
  
  if (theme) {
    settings.theme = { ...settings.theme, ...theme };
  }
  if (features) {
    settings.features = { ...settings.features, ...features };
  }
  if (layout && Array.isArray(layout)) {
    settings.layout = layout;
  }

  dbHelper.writeData('settings', settings);
  res.json({ success: true, message: 'Pengaturan berhasil diperbarui.', settings });
});

// 7. Mengambil Daftar Semua Produk (Admin + Mitra) untuk Dikelola
router.get('/products', (req, res) => {
  const products = dbHelper.readData('products');
  res.json(products);
});

// 8. Menambahkan Produk Baru (Milik Admin)
router.post('/product', (req, res) => {
  const { name, description, category, price, stock, status, deliveryType, weight, originCity, originProvince } = req.body;
  if (!name || !price || stock === undefined) {
    return res.status(400).json({ error: 'Nama, harga, dan stok produk wajib diisi.' });
  }

  let imageUrl = '/uploads/default-product.jpg';

  // Proses gambar jika diunggah
  const saveAndCreate = (imagePath) => {
    const products = dbHelper.readData('products');
    const newProduct = {
      id: `prod_admin_${Date.now()}`,
      name,
      description: description || '',
      category: category || 'Umum',
      price: parseInt(price) || 0,
      stock: parseInt(stock) || 0,
      imageUrl: imagePath,
      status: status || 'aktif',
      ownerId: 'admin',
      deliveryType: deliveryType || 'digital',
      weight: parseInt(weight) || 0,
      originCity: originCity || '',
      originProvince: originProvince || '',
      createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    dbHelper.writeData('products', products);
    res.status(201).json({ success: true, message: 'Produk berhasil ditambahkan.', product: newProduct });
  };

  if (req.files && req.files.image) {
    const imgFile = req.files.image;
    const ext = path.extname(imgFile.name).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      const filename = `prod_admin_${Date.now()}${ext}`;
      const savePath = path.join(__dirname, '..', '..', 'public', 'uploads', filename);
      imgFile.mv(savePath, (err) => {
        if (err) return res.status(500).json({ error: 'Gagal mengunggah gambar.' });
        saveAndCreate(`/uploads/${filename}`);
      });
    } else {
      saveAndCreate(imageUrl);
    }
  } else {
    saveAndCreate(imageUrl);
  }
});

// 9. Memperbarui Produk (Milik Admin atau Mitra - Admin berkuasa penuh)
router.put('/product/:id', (req, res) => {
  const products = dbHelper.readData('products');
  const prodIndex = products.findIndex(p => p.id === req.params.id);

  if (prodIndex === -1) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  const { name, description, category, price, stock, status, deliveryType, weight, originCity, originProvince } = req.body;
  const product = products[prodIndex];

  if (name) product.name = name;
  if (description !== undefined) product.description = description;
  if (category) product.category = category;
  if (price) product.price = parseInt(price) || 0;
  if (stock !== undefined) product.stock = parseInt(stock) || 0;
  if (status) product.status = status;
  if (deliveryType) product.deliveryType = deliveryType;
  if (weight !== undefined) product.weight = parseInt(weight) || 0;
  if (originCity !== undefined) product.originCity = originCity;
  if (originProvince !== undefined) product.originProvince = originProvince;

  // Proses unggah gambar baru jika ada
  const doUpdate = () => {
    products[prodIndex] = product;
    dbHelper.writeData('products', products);
    res.json({ success: true, message: 'Produk berhasil diperbarui.', product });
  };

  if (req.files && req.files.image) {
    const imgFile = req.files.image;
    const ext = path.extname(imgFile.name).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      const filename = `prod_edit_${Date.now()}${ext}`;
      const savePath = path.join(__dirname, '..', '..', 'public', 'uploads', filename);
      imgFile.mv(savePath, (err) => {
        if (err) return res.status(500).json({ error: 'Gagal mengunggah gambar.' });
        product.imageUrl = `/uploads/${filename}`;
        doUpdate();
      });
    } else {
      doUpdate();
    }
  } else {
    doUpdate();
  }
});

// 10. Menghapus Produk
router.delete('/product/:id', (req, res) => {
  const products = dbHelper.readData('products');
  const filtered = products.filter(p => p.id !== req.params.id);

  if (products.length === filtered.length) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  dbHelper.writeData('products', filtered);
  res.json({ success: true, message: 'Produk berhasil dihapus.' });
});

// 11. Mengambil Semua Riwayat Transaksi (Pesanan)
router.get('/orders', (req, res) => {
  const orders = dbHelper.readData('orders');
  res.json(orders);
});

// 12. Memperbarui Status Pesanan
router.put('/order/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status pesanan wajib diisi.' });
  }

  const orders = dbHelper.readData('orders');
  const orderIndex = orders.findIndex(o => o.orderId === req.params.id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
  }

  orders[orderIndex].status = status;
  dbHelper.writeData('orders', orders);

  res.json({ success: true, message: `Status pesanan berhasil diubah menjadi: ${status}.`, order: orders[orderIndex] });
});

// 13. Laporan Keuangan & Komisi Mitra
router.get('/reports', (req, res) => {
  const orders = dbHelper.readData('orders');
  const users = dbHelper.readData('users');
  
  const partners = users.filter(u => u.role === 'mitra');
  
  let totalSales = 0;
  let totalAdminFees = 0; // Komisi terkumpul
  
  orders.forEach(o => {
    // Hanya hitung pesanan yang bukan Dibatalkan
    if (o.status !== 'Dibatalkan') {
      totalSales += o.total;
      totalAdminFees += o.adminFees || 0;
    }
  });

  res.json({
    stats: {
      totalOrdersCount: orders.length,
      totalActiveOrdersCount: orders.filter(o => o.status !== 'Dibatalkan').length,
      totalSalesValue: totalSales,
      totalAdminCommission: totalAdminFees,
      partnersCount: partners.length
    },
    partners: partners.map(p => ({
      id: p.id,
      shopName: p.shopName,
      whatsapp: p.whatsapp,
      adminFeePercent: p.adminFeePercent
    })),
    orders: orders.map(o => ({
      orderId: o.orderId,
      customerName: o.customer.name,
      total: o.total,
      adminFees: o.adminFees || 0,
      status: o.status,
      createdAt: o.createdAt
    }))
  });
});

// 13.5. Memperbarui Persentase Komisi Admin Toko Mitra
router.put('/partner/:id/fee', (req, res) => {
  const { adminFeePercent } = req.body;
  const fee = parseFloat(adminFeePercent);
  if (isNaN(fee) || fee < 0 || fee > 100) {
    return res.status(400).json({ error: 'Persentase komisi admin harus angka antara 0% hingga 100%.' });
  }

  const users = dbHelper.readData('users');
  const partnerIndex = users.findIndex(u => u.id === req.params.id && u.role === 'mitra');

  if (partnerIndex === -1) {
    return res.status(404).json({ error: 'Mitra tidak ditemukan.' });
  }

  users[partnerIndex].adminFeePercent = fee;
  dbHelper.writeData('users', users);

  res.json({
    success: true,
    message: `Persentase komisi admin untuk toko "${users[partnerIndex].shopName}" berhasil diubah menjadi ${fee}%.`,
    partner: {
      id: users[partnerIndex].id,
      shopName: users[partnerIndex].shopName,
      adminFeePercent: fee
    }
  });
});

// 14. Mengunggah Gambar Hero Banner Utama
router.post('/upload-hero', (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0 || !req.files.heroFile) {
    return res.status(400).json({ error: 'Tidak ada gambar banner yang diunggah.' });
  }

  const heroFile = req.files.heroFile;
  const ext = path.extname(heroFile.name).toLowerCase();
  
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return res.status(400).json({ error: 'Format berkas harus berupa gambar (png, jpg, jpeg, webp).' });
  }

  const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
  const filename = `hero_${Date.now()}${ext}`;
  const savePath = path.join(uploadsDir, filename);

  heroFile.mv(savePath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Gagal menyimpan berkas di server.' });
    }

    const settings = dbHelper.readData('settings');
    settings.heroImage = `/uploads/${filename}`;
    dbHelper.writeData('settings', settings);

    res.json({ success: true, heroImage: `/uploads/${filename}`, settings });
  });
});

// ============================================
// ENDPOINT BARU: MANAJEMEN PEMBAYARAN MANUAL
// ============================================

// 15. Filter Pesanan yang Menunggu Verifikasi Bukti Transfer
router.get('/orders/pending-verification', (req, res) => {
  const orders = dbHelper.readData('orders');
  const pending = orders
    .filter(o => o.statusPembayaranManual === 'menunggu_verifikasi')
    .sort((a, b) => new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt));
  res.json(pending);
});

// 16. Admin Verifikasi Bukti Transfer (Approve / Tolak)
router.put('/order/:id/verify-payment', (req, res) => {
  const { action } = req.body; // 'approve' atau 'reject'
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action harus berupa "approve" atau "reject".' });
  }

  const orders = dbHelper.readData('orders');
  const orderIndex = orders.findIndex(o => o.orderId === req.params.id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  }

  const order = orders[orderIndex];
  const adminUsername = req.session.user.username;

  if (action === 'approve') {
    orders[orderIndex].statusPembayaranManual = 'terverifikasi';
    orders[orderIndex].status = 'Dibayar';
    orders[orderIndex].verifiedAt = new Date().toISOString();
    orders[orderIndex].verifiedBy = adminUsername;
  } else {
    orders[orderIndex].statusPembayaranManual = 'ditolak';
    orders[orderIndex].status = 'Pembayaran Ditolak';
    orders[orderIndex].rejectedAt = new Date().toISOString();
    orders[orderIndex].rejectedBy = adminUsername;
    orders[orderIndex].rejectionReason = req.body.reason || 'Bukti transfer tidak valid';
  }

  dbHelper.writeData('orders', orders);

  const statusLabel = action === 'approve' ? 'DISETUJUI' : 'DITOLAK';
  res.json({
    success: true,
    message: `Pembayaran pesanan ${req.params.id} berhasil ${statusLabel}.`,
    order: orders[orderIndex]
  });
});

// ============================================
// ENDPOINT BARU: MANAJEMEN PESAN CHAT
// ============================================

// 17. Ambil Semua Pesan Chat "Tanya Admin"
router.get('/chat/messages', (req, res) => {
  const dbHelper2 = require('../db/dbHelper');
  const messages = dbHelper2.readData('chat_messages');
  messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(messages);
});

// 18. Tandai Semua Pesan Chat Sudah Dibaca
router.put('/chat/read-all', (req, res) => {
  const messages = dbHelper.readData('chat_messages');
  messages.forEach(m => { m.isRead = true; });
  dbHelper.writeData('chat_messages', messages);
  res.json({ success: true, count: messages.length });
});

// 19. Hapus Satu Pesan Chat
router.delete('/chat/message/:id', (req, res) => {
  const messages = dbHelper.readData('chat_messages');
  const filtered = messages.filter(m => m.id !== req.params.id);
  if (filtered.length === messages.length) {
    return res.status(404).json({ error: 'Pesan tidak ditemukan.' });
  }
  dbHelper.writeData('chat_messages', filtered);
  res.json({ success: true });
});

// ============================================
// ENDPOINT BARU: UPLOAD SUARA NOTIFIKASI
// ============================================

// 20. Upload File Suara Notifikasi Admin
router.post('/upload-notification-sound', (req, res) => {
  if (!req.files || !req.files.soundFile) {
    return res.status(400).json({ error: 'Tidak ada file suara yang diunggah.' });
  }

  const soundFile = req.files.soundFile;
  const ext = path.extname(soundFile.name).toLowerCase();

  if (!['.mp3', '.wav', '.ogg', '.aac'].includes(ext)) {
    return res.status(400).json({ error: 'Format file harus audio (mp3, wav, ogg, aac).' });
  }

  const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
  const filename = `notif_sound_${Date.now()}${ext}`;
  const savePath = path.join(uploadsDir, filename);

  soundFile.mv(savePath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Gagal menyimpan file suara.' });
    }

    const settings = dbHelper.readData('settings');
    settings.notificationSound = `/uploads/${filename}`;
    dbHelper.writeData('settings', settings);

    res.json({ success: true, soundUrl: `/uploads/${filename}` });
  });
});

// ============================================
// ENDPOINT BARU: KONFIGURASI EMAIL NOTIFIKASI
// ============================================

// 21. Update Konfigurasi Email Admin
router.put('/settings/email', (req, res) => {
  const { adminEmail, smtpUser, smtpPass, enabled } = req.body;
  const settings = dbHelper.readData('settings');

  if (adminEmail !== undefined) settings.adminEmail = adminEmail;
  if (!settings.emailNotifications) settings.emailNotifications = {};
  if (smtpUser !== undefined) settings.emailNotifications.smtpUser = smtpUser;
  if (smtpPass !== undefined) settings.emailNotifications.smtpPass = smtpPass;
  if (enabled !== undefined) settings.emailNotifications.enabled = !!enabled;

  dbHelper.writeData('settings', settings);
  res.json({ success: true, message: 'Konfigurasi email berhasil diperbarui.' });
});

// 22. Mengambil semua kode diskon
router.get('/discount-codes', (req, res) => {
  const codes = dbHelper.readData('discount_codes');
  res.json(codes);
});

// 23. Menambah kode diskon baru
router.post('/discount-code', (req, res) => {
  const { code, type, value, status, category, minPurchase } = req.body;
  if (!code || !type || value === undefined) {
    return res.status(400).json({ error: 'Kode, tipe, dan nilai diskon wajib diisi.' });
  }

  const codes = dbHelper.readData('discount_codes');
  const uppercaseCode = code.trim().toUpperCase();

  if (codes.find(c => c.code.toUpperCase() === uppercaseCode)) {
    return res.status(400).json({ error: 'Kode diskon tersebut sudah terdaftar.' });
  }

  const newDiscount = {
    code: uppercaseCode,
    type,
    value: parseFloat(value) || 0,
    status: status || 'aktif',
    category: category || 'all',        // 'all' = berlaku semua produk, atau nama kategori spesifik
    minPurchase: parseFloat(minPurchase) || 0 // minimum total belanja agar kupon valid
  };

  codes.push(newDiscount);
  dbHelper.writeData('discount_codes', codes);
  res.status(201).json({ success: true, message: 'Kode diskon berhasil ditambahkan.', discount: newDiscount });
});

// 24. Memperbarui status / nilai kode diskon
router.put('/discount-code/:code', (req, res) => {
  const { status, type, value, category, minPurchase } = req.body;
  const codes = dbHelper.readData('discount_codes');
  const codeIndex = codes.findIndex(c => c.code.toUpperCase() === req.params.code.toUpperCase());

  if (codeIndex === -1) {
    return res.status(404).json({ error: 'Kode diskon tidak ditemukan.' });
  }

  if (status !== undefined) codes[codeIndex].status = status;
  if (type !== undefined) codes[codeIndex].type = type;
  if (value !== undefined) codes[codeIndex].value = parseFloat(value) || 0;
  if (category !== undefined) codes[codeIndex].category = category;
  if (minPurchase !== undefined) codes[codeIndex].minPurchase = parseFloat(minPurchase) || 0;

  dbHelper.writeData('discount_codes', codes);
  res.json({ success: true, message: 'Kode diskon berhasil diperbarui.', discount: codes[codeIndex] });
});

// 25. Menghapus kode diskon
router.delete('/discount-code/:code', (req, res) => {
  const codes = dbHelper.readData('discount_codes');
  const filtered = codes.filter(c => c.code.toUpperCase() !== req.params.code.toUpperCase());

  if (codes.length === filtered.length) {
    return res.status(404).json({ error: 'Kode diskon tidak ditemukan.' });
  }

  dbHelper.writeData('discount_codes', filtered);
  res.json({ success: true, message: 'Kode diskon berhasil dihapus.' });
});

// 26.5 Ganti Password Admin
router.put('/change-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Password lama dan password baru wajib diisi.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
  }

  const adminId = req.session.user.id;
  const users = dbHelper.readData('users');
  const adminIndex = users.findIndex(u => u.id === adminId && u.role === 'admin');

  if (adminIndex === -1) {
    return res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
  }

  // Verifikasi password lama
  const isMatch = bcrypt.compareSync(oldPassword, users[adminIndex].password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Password lama tidak sesuai. Silakan coba lagi.' });
  }

  // Hash dan simpan password baru
  users[adminIndex].password = bcrypt.hashSync(newPassword, 10);
  users[adminIndex].passwordUpdatedAt = new Date().toISOString();
  dbHelper.writeData('users', users);

  res.json({ success: true, message: '✅ Password admin berhasil diperbarui!' });
});

// 27. Memperbarui Trust Badges (Icon Bar Info Toko)
router.put('/trust-badges', (req, res) => {
  const { trustBadges } = req.body;
  if (!Array.isArray(trustBadges) || trustBadges.length === 0) {
    return res.status(400).json({ error: 'Data trust badges harus berupa array.' });
  }

  const settings = dbHelper.readData('settings');
  settings.trustBadges = trustBadges.map(b => ({
    icon: (b.icon || 'shield-check').trim(),
    title: (b.title || '').trim(),
    desc: (b.desc || '').trim()
  }));

  dbHelper.writeData('settings', settings);
  res.json({ success: true, message: 'Trust badges berhasil diperbarui.', trustBadges: settings.trustBadges });
});

// 27. Memperbarui & Mengelola Papan Iklan Slide (Promo Banners)
router.post('/upload-promo-banner', (req, res) => {
  const settings = dbHelper.readData('settings');
  if (!settings.promoBanners) settings.promoBanners = [];

  let imageUrl = '/uploads/hero-banner.png';

  if (req.files && req.files.bannerImage) {
    const file = req.files.bannerImage;
    const ext = path.extname(file.name) || '.jpg';
    const filename = `promo_banner_${Date.now()}${ext}`;
    const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
    const savePath = path.join(uploadsDir, filename);

    file.mv(savePath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Gagal menyimpan file gambar promo.' });
      }
      imageUrl = `/uploads/${filename}`;
      saveBannerData(imageUrl);
    });
  } else {
    saveBannerData(req.body.imageUrl || imageUrl);
  }

  function saveBannerData(img) {
    const newBanner = {
      id: `banner_${Date.now()}`,
      imageUrl: img,
      tag: (req.body.tag || '🔥 PROMO SPESIAL').trim(),
      title: (req.body.title || 'Promo Menarik Hari Ini').trim(),
      desc: (req.body.desc || 'Dapatkan penawaran harga terbaik untuk produk pilihan.').trim(),
      buttonText: (req.body.buttonText || 'Cek Produk').trim(),
      buttonLink: (req.body.buttonLink || '#sec-products').trim()
    };

    settings.promoBanners.push(newBanner);
    dbHelper.writeData('settings', settings);
    res.json({ success: true, message: 'Poster promo berhasil ditambahkan.', banner: newBanner, promoBanners: settings.promoBanners });
  }
});

router.delete('/promo-banner/:id', (req, res) => {
  const { id } = req.params;
  const settings = dbHelper.readData('settings');
  if (!settings.promoBanners) settings.promoBanners = [];

  settings.promoBanners = settings.promoBanners.filter(b => b.id !== id);
  dbHelper.writeData('settings', settings);
  res.json({ success: true, message: 'Poster promo berhasil dihapus.', promoBanners: settings.promoBanners });
});

module.exports = router;
