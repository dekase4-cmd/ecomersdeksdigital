const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const dbHelper = require('../db/dbHelper');
const { broadcastToAdmins, sendEmailToAdmin } = require('../utils/notifier');

// 1. Mengambil Pengaturan Toko Publik (tanpa Gemini API Key & SMTP credentials)
router.get('/settings', (req, res) => {
  const settings = dbHelper.readData('settings');
  const publicSettings = { ...settings };
  delete publicSettings.geminiApiKey;
  delete publicSettings.emailNotifications; // Jangan expose kredensial SMTP ke publik
  res.json(publicSettings);
});

// 2. Mengambil Daftar Produk Aktif (dengan Filter Pencarian & Kategori)
router.get('/products', (req, res) => {
  const products = dbHelper.readData('products');
  const activeProducts = products.filter(p => p.status === 'aktif');
  
  const { category, q } = req.query;
  let filtered = [...activeProducts];
  
  if (category && category !== 'Semua') {
    filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
  
  if (q) {
    const searchVal = q.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchVal) || 
      p.description.toLowerCase().includes(searchVal)
    );
  }
  
  const users = dbHelper.readData('users');
  
  const processedProducts = filtered.map(product => {
    let finalPrice = product.price;
    let shopName = 'Deksdigital Store';
    
    if (product.ownerId !== 'admin') {
      const partner = users.find(u => u.id === product.ownerId);
      if (partner) {
        shopName = partner.shopName || 'Mitra Toko';
      }
    }
    
    return {
      ...product,
      price: finalPrice,
      originalPrice: product.price,
      shopName
    };
  });
  
  res.json(processedProducts);
});

// 3. Mengambil Detail Produk Spesifik berdasarkan ID
router.get('/product/:id', (req, res) => {
  const products = dbHelper.readData('products');
  const product = products.find(p => p.id === req.params.id);
  
  if (!product || product.status !== 'aktif') {
    return res.status(404).json({ error: 'Produk tidak ditemukan atau tidak aktif.' });
  }
  
  const users = dbHelper.readData('users');
  let finalPrice = product.price;
  let shopName = 'Deksdigital Store';
  let adminFeePercent = 0;
  
  if (product.ownerId !== 'admin') {
    const partner = users.find(u => u.id === product.ownerId);
    if (partner) {
      shopName = partner.shopName || 'Mitra Toko';
      adminFeePercent = partner.adminFeePercent || 0;
      finalPrice = product.price;
    }
  }
  
  res.json({
    ...product,
    price: finalPrice,
    originalPrice: product.price,
    adminFeePercent,
    shopName
  });
});

// 4. Proses Checkout Belanja — Menghasilkan Order + Shareable Token
router.post('/checkout', (req, res) => {
  // Dukung dua format: {customer: {...}, items} atau {name, phone, address, items}
  let name, phone, address, customFields;
  if (req.body.customer) {
    ({ name, phone, address, customFields } = req.body.customer);
  } else {
    ({ name, phone, address, customFields } = req.body);
  }
  const { items, discountCode } = req.body;
  
  if (!name || !phone || !address || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Mohon lengkapi data pemesan dan item belanja.' });
  }

  // Validasi field kustom yang wajib diisi (jika dikonfigurasi admin)
  const settings = dbHelper.readData('settings');
  if (settings.customCustomerFields && Array.isArray(settings.customCustomerFields)) {
    for (const fieldCfg of settings.customCustomerFields) {
      if (fieldCfg.required) {
        const userVal = customFields ? customFields[fieldCfg.label] || customFields[fieldCfg.id] : null;
        if (!userVal || !String(userVal).trim()) {
          return res.status(400).json({ error: `Mohon isi kolom "${fieldCfg.label}".` });
        }
      }
    }
  }

  const products = dbHelper.readData('products');
  const users = dbHelper.readData('users');
  const orders = dbHelper.readData('orders');
  
  let totalOrder = 0;
  let totalAdminFees = 0;
  const purchasedItems = [];
  
  // Validasi produk, stok, dan hitung harga akhir
  for (const item of items) {
    const qty = parseInt(item.qty || item.quantity) || 1;
    const dbProduct = products.find(p => p.id === item.productId);
    if (!dbProduct || dbProduct.status !== 'aktif') {
      return res.status(404).json({ error: `Produk dengan ID ${item.productId} tidak tersedia.` });
    }
    
    if (dbProduct.stock < qty) {
      return res.status(400).json({ error: `Stok produk "${dbProduct.name}" tidak mencukupi. Tersedia: ${dbProduct.stock}.` });
    }
    
    let finalPrice = dbProduct.price;
    let adminFeeEarned = 0;
    
    if (dbProduct.ownerId !== 'admin') {
      const partner = users.find(u => u.id === dbProduct.ownerId);
      if (partner) {
        const feePercent = partner.adminFeePercent || 0;
        finalPrice = dbProduct.price;
        adminFeeEarned = Math.round(dbProduct.price * (feePercent / 100)) * qty;
      }
    }
    
    const subtotal = finalPrice * qty;
    totalOrder += subtotal;
    totalAdminFees += adminFeeEarned;
    
    purchasedItems.push({
      productId: dbProduct.id,
      name: dbProduct.name,
      qty,
      price: finalPrice,
      originalPrice: dbProduct.price,
      subtotal,
      ownerId: dbProduct.ownerId
    });
    
    // Kurangi stok barang
    dbProduct.stock -= qty;
  }
  
  // Hitung potongan diskon jika ada kode kupon
  let discountAmount = 0;
  let appliedCode = null;
  let couponError = null;
  if (discountCode) {
    const discountCodes = dbHelper.readData('discount_codes');
    const discount = discountCodes.find(d => d.code.toUpperCase() === discountCode.toUpperCase() && d.status === 'aktif');
    if (discount) {
      // Cek kategori kupon
      const couponCategory = (discount.category || 'all').toLowerCase();
      if (couponCategory !== 'all') {
        // Cek apakah ada item di keranjang yang kategorinya cocok
        const matchingItems = purchasedItems.filter(item => {
          const dbProd = products.find(p => p.id === item.productId);
          return dbProd && dbProd.category && dbProd.category.toLowerCase() === couponCategory;
        });
        if (matchingItems.length === 0) {
          couponError = `Kupon "${discount.code}" hanya berlaku untuk produk kategori "${discount.category}". Keranjang Anda tidak memiliki produk kategori tersebut.`;
        } else {
          // Hitung subtotal hanya untuk item kategori yang cocok
          const eligibleSubtotal = matchingItems.reduce((sum, item) => sum + item.subtotal, 0);
          // Cek minimum belanja (jika ada)
          const minPurchase = discount.minPurchase || 0;
          if (minPurchase > 0 && eligibleSubtotal < minPurchase) {
            couponError = `Kupon "${discount.code}" memerlukan minimum belanja produk "${discount.category}" sebesar Rp ${minPurchase.toLocaleString('id-ID')}.`;
          } else {
            appliedCode = discount.code;
            if (discount.type === 'percentage') {
              discountAmount = Math.round(eligibleSubtotal * (discount.value / 100));
            } else if (discount.type === 'fixed') {
              discountAmount = discount.value;
            }
          }
        }
      } else {
        // Kupon berlaku untuk semua produk
        const minPurchase = discount.minPurchase || 0;
        if (minPurchase > 0 && totalOrder < minPurchase) {
          couponError = `Kupon "${discount.code}" memerlukan minimum total belanja sebesar Rp ${minPurchase.toLocaleString('id-ID')}.`;
        } else {
          appliedCode = discount.code;
          if (discount.type === 'percentage') {
            discountAmount = Math.round(totalOrder * (discount.value / 100));
          } else if (discount.type === 'fixed') {
            discountAmount = discount.value;
          }
        }
      }
      if (discountAmount > totalOrder) discountAmount = totalOrder;
    } else {
      couponError = 'Kode diskon tidak valid atau tidak aktif.';
    }
  }
  
  const finalTotal = totalOrder - discountAmount;
  
  // Tentukan rute WhatsApp tujuan konfirmasi
  let targetWhatsapp = settings.whatsappAdmin;
  let targetName = settings.shopName;
  
  const uniqueOwners = [...new Set(purchasedItems.map(item => item.ownerId))];
  
  if (uniqueOwners.length === 1 && uniqueOwners[0] !== 'admin') {
    const partnerId = uniqueOwners[0];
    const partner = users.find(u => u.id === partnerId);
    if (partner && partner.whatsapp) {
      targetWhatsapp = partner.whatsapp;
      targetName = partner.shopName;
    }
  }
  
  // Buat ID Invoice & Shareable Token unik
  const dateObj = new Date();
  const dateStr = dateObj.getFullYear() +
                  String(dateObj.getMonth() + 1).padStart(2, '0') +
                  String(dateObj.getDate()).padStart(2, '0');
  const randStr = Math.floor(1000 + Math.random() * 9000);
  const orderId = `INV-${dateStr}-${randStr}`;
  const shareToken = crypto.randomUUID(); // UUID v4 yang unik dan tidak bisa ditebak
  
  const newOrder = {
    orderId,
    shareToken,                          // Token untuk shareable cart link
    buktiTransferUrl: null,              // Path file bukti transfer (diisi saat upload)
    statusPembayaranManual: 'belum_upload', // Status: belum_upload | menunggu_verifikasi | terverifikasi | ditolak
    verifiedAt: null,
    verifiedBy: null,
    customer: { 
      name, 
      phone, 
      address,
      customFields: customFields || {} 
    },
    items: purchasedItems,
    subtotal: totalOrder,
    discountCode: appliedCode,
    discountAmount: discountAmount,
    total: finalTotal,
    adminFees: totalAdminFees,
    targetWhatsapp,
    targetName,
    status: 'Menunggu Pembayaran',
    createdAt: dateObj.toISOString()
  };
  
  // Simpan pesanan & perbarui stok produk
  orders.push(newOrder);
  dbHelper.writeData('orders', orders);
  dbHelper.writeData('products', products);
  
  res.json({
    success: true,
    orderId,
    shareToken,
    shareableLink: `/cart-preview.html?token=${shareToken}`,
    subtotal: totalOrder,
    discountCode: appliedCode,
    discountAmount: discountAmount,
    couponError: couponError || null,
    total: finalTotal,
    targetWhatsapp,
    targetName,
    invoiceTemplate: settings.whatsappInvoiceTemplate
  });
});

// 5. Upload Bukti Transfer Screenshot
router.post('/upload-bukti/:orderId', (req, res) => {
  const { orderId } = req.params;

  if (!req.files || !req.files.buktiTransfer) {
    return res.status(400).json({ error: 'File bukti transfer wajib diunggah.' });
  }

  const orders = dbHelper.readData('orders');
  const orderIndex = orders.findIndex(o => o.orderId === orderId);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  }

  // Cek apakah sudah pernah upload sebelumnya
  if (orders[orderIndex].statusPembayaranManual === 'terverifikasi') {
    return res.status(400).json({ error: 'Pembayaran pesanan ini sudah terverifikasi.' });
  }

  const file = req.files.buktiTransfer;
  const ext = path.extname(file.name).toLowerCase();

  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return res.status(400).json({ error: 'Format file harus gambar (png, jpg, jpeg, webp).' });
  }

  const filename = `bukti_${orderId}_${Date.now()}${ext}`;
  const savePath = path.join(__dirname, '..', '..', 'public', 'uploads', filename);

  file.mv(savePath, (err) => {
    if (err) {
      console.error('[UPLOAD] Gagal menyimpan file bukti transfer:', err);
      return res.status(500).json({ error: 'Gagal menyimpan file bukti transfer.' });
    }

    // Update order: set buktiTransferUrl dan ubah status ke menunggu_verifikasi
    orders[orderIndex].buktiTransferUrl = `/uploads/${filename}`;
    orders[orderIndex].statusPembayaranManual = 'menunggu_verifikasi';
    orders[orderIndex].status = 'Menunggu Verifikasi';
    orders[orderIndex].uploadedAt = new Date().toISOString();
    dbHelper.writeData('orders', orders);

    const order = orders[orderIndex];
    const totalFormatted = 'Rp ' + parseInt(order.total).toLocaleString('id-ID');

    // ① Broadcast notifikasi WebSocket real-time ke admin yang login
    broadcastToAdmins({
      type: 'NEW_PAYMENT_PROOF',
      data: {
        orderId,
        customerName: order.customer.name,
        total: order.total,
        totalFormatted,
        timestamp: new Date().toISOString()
      }
    });

    // ② Kirim email notifikasi ke admin (async)
    sendEmailToAdmin(
      `💳 Bukti Transfer Baru — Order ${orderId} dari ${order.customer.name}`,
      `
      <h2 style="color:#0a192f; margin:0 0 16px 0;">Ada bukti transfer baru yang perlu diverifikasi!</h2>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr>
          <td style="padding:8px 0; color:#64748b; width:140px;"><strong>No. Invoice</strong></td>
          <td style="padding:8px 0; color:#1e293b; font-weight:bold;">${orderId}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b;"><strong>Nama Pelanggan</strong></td>
          <td style="padding:8px 0; color:#1e293b;">${order.customer.name}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b;"><strong>Nomor WA</strong></td>
          <td style="padding:8px 0; color:#1e293b;">${order.customer.phone}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b;"><strong>Total Bayar</strong></td>
          <td style="padding:8px 0; color:#f97316; font-size:18px; font-weight:bold;">${totalFormatted}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#64748b;"><strong>Waktu Upload</strong></td>
          <td style="padding:8px 0; color:#1e293b;">${new Date().toLocaleString('id-ID')}</td>
        </tr>
      </table>
      <div style="margin-top:24px; padding:16px; background:#fef3c7; border-left:4px solid #f59e0b; border-radius:4px;">
        <p style="margin:0; font-size:13px; color:#92400e;">⚠️ Segera verifikasi bukti transfer ini di dashboard admin Anda.</p>
      </div>
      <div style="margin-top:24px;">
        <a href="http://localhost:3000/admin-dashboard/" style="display:inline-block;padding:12px 24px;background:#f97316;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">🔍 Verifikasi Sekarang</a>
      </div>
      `
    );

    res.json({
      success: true,
      message: 'Bukti transfer berhasil diunggah. Pesanan Anda sedang menunggu verifikasi admin.',
      orderId,
      statusPembayaranManual: 'menunggu_verifikasi',
      invoiceUrl: `/receipt.html?orderId=${orderId}`
    });
  });
});

// 6. Ambil Data Order via Shareable Cart Token (Publik, tanpa login)
router.get('/cart-preview/:token', (req, res) => {
  const orders = dbHelper.readData('orders');
  const order = orders.find(o => o.shareToken === req.params.token);

  if (!order) {
    return res.status(404).json({ error: 'Link keranjang tidak valid atau sudah kadaluarsa.' });
  }

  const settings = dbHelper.readData('settings');
  
  res.json({
    orderId: order.orderId,
    shareToken: order.shareToken,
    items: order.items,
    total: order.total,
    customer: order.customer,
    status: order.status,
    statusPembayaranManual: order.statusPembayaranManual,
    createdAt: order.createdAt,
    targetWhatsapp: order.targetWhatsapp,
    targetName: order.targetName,
    invoiceTemplate: settings.whatsappInvoiceTemplate
  });
});

// 7. Mengambil data pesanan spesifik berdasarkan ID (untuk receipt)
router.get('/order/:orderId', (req, res) => {
  const orders = dbHelper.readData('orders');
  const order = orders.find(o => o.orderId === req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  }
  res.json(order);
});

// 8. Validasi Kode Diskon (Kupon)
router.post('/validate-discount', (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Kode diskon wajib diisi.' });
  }

  const discountCodes = dbHelper.readData('discount_codes');
  const discount = discountCodes.find(d => d.code.toUpperCase() === code.trim().toUpperCase() && d.status === 'aktif');

  if (!discount) {
    return res.status(400).json({ error: 'Kode diskon tidak valid atau tidak aktif.' });
  }

  res.json({
    valid: true,
    code: discount.code,
    type: discount.type,
    value: discount.value,
    category: discount.category || 'all',       // 'all' atau nama kategori spesifik
    minPurchase: discount.minPurchase || 0       // minimum belanja (0 = tidak ada syarat)
  });
});

module.exports = router;
