const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const dbHelper = require('../db/dbHelper');

// ============================================
// PUBLIC ROUTES (Registrasi, Login, & Logout)
// ============================================

// 1. Registrasi Mitra Baru
router.post('/register', (req, res) => {
  const { username, password, shopName, whatsapp, adminFeePercent } = req.body;
  
  if (!username || !password || !shopName || !whatsapp) {
    return res.status(400).json({ error: 'Username, password, nama toko, dan nomor WhatsApp wajib diisi.' });
  }

  const users = dbHelper.readData('users');
  const userExists = users.some(u => u.username.toLowerCase() === username.toLowerCase());

  if (userExists) {
    return res.status(400).json({ error: 'Username sudah digunakan.' });
  }

  const fee = adminFeePercent !== undefined ? parseFloat(adminFeePercent) : 1;
  if (isNaN(fee) || fee < 0 || fee > 100) {
    return res.status(400).json({ error: 'Biaya layanan admin harus angka antara 0% hingga 100%.' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newMitra = {
    id: `mitra_${Date.now()}`,
    username,
    password: hashedPassword,
    role: 'mitra',
    shopName,
    whatsapp,
    adminFeePercent: fee
  };

  users.push(newMitra);
  dbHelper.writeData('users', users);

  res.status(201).json({ success: true, message: 'Registrasi kemitraan berhasil! Silakan masuk.' });
});

// 2. Login Mitra
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const users = dbHelper.readData('users');
  const user = users.find(u => u.username === username && u.role === 'mitra');

  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  // Buat sesi
  req.session.user = {
    id: user.id,
    username: user.username,
    role: 'mitra',
    shopName: user.shopName
  };

  res.json({ success: true, user: req.session.user });
});

// 3. Logout Mitra
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
// SECURED ROUTES (Hanya diakses Mitra Terautentikasi)
// ============================================
router.use((req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'mitra') {
    return next();
  }
  res.status(401).json({ error: 'Akses ditolak. Silakan login sebagai Mitra.' });
});

// 4. Mengambil Profil Mitra
router.get('/profile', (req, res) => {
  const users = dbHelper.readData('users');
  const user = users.find(u => u.id === req.session.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'Profil tidak ditemukan.' });
  }

  const profile = { ...user };
  delete profile.password;
  res.json(profile);
});

// 5. Memperbarui Profil Mitra (Ubah nama toko, WA, dan Persen Komisi)
router.put('/profile', (req, res) => {
  const users = dbHelper.readData('users');
  const userIndex = users.findIndex(u => u.id === req.session.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'Profil tidak ditemukan.' });
  }

  const { shopName, whatsapp, adminFeePercent } = req.body;
  const user = users[userIndex];

  if (shopName) {
    user.shopName = shopName;
    req.session.user.shopName = shopName; // Update sesi
  }
  if (whatsapp) user.whatsapp = whatsapp;
  
  if (adminFeePercent !== undefined) {
    const fee = parseFloat(adminFeePercent);
    if (isNaN(fee) || fee < 0 || fee > 100) {
      return res.status(400).json({ error: 'Biaya layanan admin harus angka antara 0% hingga 100%.' });
    }
    user.adminFeePercent = fee;
  }

  users[userIndex] = user;
  dbHelper.writeData('users', users);

  res.json({ success: true, message: 'Profil kemitraan berhasil diperbarui.', user });
});

// 6. Mengambil Produk Milik Mitra yang Bersangkutan
router.get('/products', (req, res) => {
  const products = dbHelper.readData('products');
  const partnerProducts = products.filter(p => p.ownerId === req.session.user.id);
  res.json(partnerProducts);
});

// 7. Menambahkan Produk Kemitraan Baru
router.post('/product', (req, res) => {
  const { name, description, category, price, stock, status, deliveryType, weight, originCity, originProvince } = req.body;
  if (!name || !price || stock === undefined) {
    return res.status(400).json({ error: 'Nama, harga dasar, dan stok wajib diisi.' });
  }

  let imageUrl = '/uploads/default-product.jpg';

  // Unggah gambar jika dikirim
  const saveAndCreate = (imagePath) => {
    const products = dbHelper.readData('products');
    const newProduct = {
      id: `prod_mitra_${Date.now()}`,
      name,
      description: description || '',
      category: category || 'Umum',
      price: parseInt(price) || 0,
      stock: parseInt(stock) || 0,
      imageUrl: imagePath,
      status: status || 'aktif',
      ownerId: req.session.user.id,
      deliveryType: deliveryType || 'digital',
      weight: parseInt(weight) || 0,
      originCity: originCity || '',
      originProvince: originProvince || '',
      createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    dbHelper.writeData('products', products);
    res.status(201).json({ success: true, message: 'Produk kemitraan berhasil ditambahkan.', product: newProduct });
  };

  if (req.files && req.files.image) {
    const imgFile = req.files.image;
    const ext = path.extname(imgFile.name).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      const filename = `prod_mitra_${Date.now()}${ext}`;
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

// 8. Memperbarui Produk Kemitraan (Hanya bisa edit produk miliknya)
router.put('/product/:id', (req, res) => {
  const products = dbHelper.readData('products');
  const prodIndex = products.findIndex(p => p.id === req.params.id);

  if (prodIndex === -1) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  const product = products[prodIndex];
  if (product.ownerId !== req.session.user.id) {
    return res.status(403).json({ error: 'Akses ditolak. Produk ini bukan milik toko Anda.' });
  }

  const { name, description, category, price, stock, status, deliveryType, weight, originCity, originProvince } = req.body;

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

  const doUpdate = () => {
    products[prodIndex] = product;
    dbHelper.writeData('products', products);
    res.json({ success: true, message: 'Produk kemitraan berhasil diperbarui.', product });
  };

  if (req.files && req.files.image) {
    const imgFile = req.files.image;
    const ext = path.extname(imgFile.name).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      const filename = `prod_mitra_edit_${Date.now()}${ext}`;
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

// 9. Menghapus Produk Kemitraan (Hanya bisa hapus produk miliknya)
router.delete('/product/:id', (req, res) => {
  const products = dbHelper.readData('products');
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  if (product.ownerId !== req.session.user.id) {
    return res.status(403).json({ error: 'Akses ditolak. Produk ini bukan milik toko Anda.' });
  }

  const filtered = products.filter(p => p.id !== req.params.id);
  dbHelper.writeData('products', filtered);

  res.json({ success: true, message: 'Produk kemitraan berhasil dihapus.' });
});

// 10. Mengambil Daftar Pesanan Masuk Khusus Produk Milik Mitra
router.get('/orders', (req, res) => {
  const orders = dbHelper.readData('orders');
  const partnerId = req.session.user.id;
  
  // Saring transaksi yang mengandung setidaknya satu item milik mitra ini
  const partnerOrders = orders.filter(order => 
    order.items.some(item => item.ownerId === partnerId)
  );

  // Bersihkan data item milik vendor lain dan sediakan WA Direct Link khusus pesanan milik mitra ini
  const processedOrders = partnerOrders.map(order => {
    const partnerItems = order.items.filter(item => item.ownerId === partnerId);
    
    // Hitung total belanja khusus barang milik mitra ini
    const partnerSubtotal = partnerItems.reduce((sum, item) => sum + item.subtotal, 0);
    
    // Format nomor WA untuk link direct chat
    let rawPhone = (order.customer.phone || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '62' + rawPhone.substring(1);
    }
    const waLink = `https://wa.me/${rawPhone}?text=${encodeURIComponent(`Halo Kak ${order.customer.name}, terima kasih telah memesan produk dari toko kami di Deksdigital Store (No. Order: ${order.orderId}). Berikut informasi pesanan Anda.`)}`;

    return {
      orderId: order.orderId,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address,
        customFields: order.customer.customFields || {},
        waLink
      },
      items: partnerItems, // Hanya barang milik mitra ini
      partnerSubtotal,
      status: order.status,
      createdAt: order.createdAt
    };
  });

  res.json(processedOrders);
});

module.exports = router;
