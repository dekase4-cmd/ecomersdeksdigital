const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dbHelper = require('../db/dbHelper');

// 1. Endpoint AI Chatbot Belanja (Public Storefront)
router.post('/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Pesan wajib diisi.' });
  }

  const settings = dbHelper.readData('settings');
  const products = dbHelper.readData('products').filter(p => p.status === 'aktif');
  const users = dbHelper.readData('users');

  // Ambil data produk dengan harga jual storefront terhitung
  const catalog = products.map(p => {
    let price = p.price;
    let penjual = 'Deksdigital Store (Resmi)';
    if (p.ownerId !== 'admin') {
      const partner = users.find(u => u.id === p.ownerId);
      if (partner) {
        price = p.price;
        penjual = partner.shopName || 'Mitra Toko';
      }
    }
    return {
      nama: p.name,
      kategori: p.category,
      harga: `Rp ${price.toLocaleString('id-ID')}`,
      stok: p.stock,
      deskripsi: p.description,
      penjual: penjual
    };
  });

  const apiKey = settings.geminiApiKey;

  // Jika API Key tidak diset, gunakan Smart Local Fallback
  if (!apiKey || apiKey.trim() === '') {
    return res.json({ reply: getLocalFallbackReply(message, catalog) });
  }

  try {
    // Rancang System Instruction untuk memandu perilaku AI
    const systemInstruction = `
      Anda adalah AI Asisten Belanja resmi untuk toko online "Deksdigital Store" (dan platform Kemitraannya).
      Tugas Anda adalah melayani pelanggan dengan ramah, komunikatif, dan sopan dalam Bahasa Indonesia.
      Anda dibekali data katalog produk saat ini:
      ${JSON.stringify(catalog, null, 2)}
      
      Informasi Tambahan tentang Program Kemitraan (Partnership):
      1. Platform Deksdigital memiliki program Kemitraan resmi di mana merchant / penjual mitra dapat menjual produk mereka.
      2. Pembeli dapat menjelajahi dan membeli produk mitra di halaman Kemitraan: http://localhost:3000/kemitraan.html
      3. Calon Mitra Penjual baru bisa mendaftar secara GRATIS dengan mengklik tombol "Gabung Jadi Mitra Penjual" yang ada di banner atas halaman Kemitraan (http://localhost:3000/kemitraan.html), mendaftar langsung di http://localhost:3000/mitra-dashboard/register.html, atau masuk ke dasbor mitra di http://localhost:3000/mitra-dashboard/login.html
      4. Setelah menjadi mitra, mereka bisa mengunggah produk sendiri, melacak pesanan, dan mengelola profil toko mitra mereka di dashboard khusus mitra.
      5. Setiap penjualan produk mitra akan dikenakan biaya layanan komisi admin/platform yang diatur oleh Admin Utama.
      6. Semua transaksi kemitraan diproses secara aman menggunakan sistem pembayaran otomatis QRIS yang terintegrasi di Deksdigital Store.
      
      Aturan Tanggapan:
      1. Jawab pertanyaan seputar produk katalog (baik produk Resmi Deksdigital maupun produk Mitra Toko), cara berbelanja, status pesanan, pembayaran QRIS, informasi kontak toko, atau Program Kemitraan (seperti cara bergabung, keuntungan, dan tautan pendaftaran).
      2. Jika pembeli menanyakan produk yang tidak ada di katalog, katakan dengan sopan bahwa produk tersebut saat ini belum tersedia, lalu rekomendasikan alternatif produk yang ada di katalog.
      3. Jangan pernah memberikan informasi palsu tentang harga atau stok. Gunakan data harga, stok, dan nama penjual dari katalog yang disediakan di atas.
      4. Jawab secara ringkas, informatif, dan gunakan format markdown (seperti bullet points, bolding, list) agar mudah dibaca di widget chat.
      5. Jika pengguna menanyakan cara bergabung atau mendaftar kemitraan, beri tahu mereka secara jelas bahwa mereka dapat mengklik tombol "Gabung Jadi Mitra Penjual" di halaman Kemitraan (http://localhost:3000/kemitraan.html) sebagai alternatif pendaftaran langsung.
    `;

    const genAI = new GoogleGenerativeAI(apiKey);
    // Menggunakan model Gemini 2.5 Flash yang cepat dan andal
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: systemInstruction
    });

    // Susun riwayat chat untuk Gemini
    const chatHistory = [];
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        chatHistory.push({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        });
      });
    }

    const chat = model.startChat({
      history: chatHistory
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });
  } catch (error) {
    console.error('Error calling Gemini API for chat:', error);
    // Jika API Key salah/eror, kembalikan respon fallback
    res.json({ 
      reply: `[Mode AI Bermasalah: ${error.message}]\n\n` + getLocalFallbackReply(message, catalog) 
    });
  }
});

// 2. Endpoint AI Generator Deskripsi Produk (Admin & Mitra)
router.post('/generate-description', async (req, res) => {
  const { name, category } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Nama produk wajib diisi.' });
  }

  const settings = dbHelper.readData('settings');
  const apiKey = settings.geminiApiKey;

  // Fallback lokal jika API Key kosong
  if (!apiKey || apiKey.trim() === '') {
    return res.json({ description: getLocalDescriptionFallback(name, category) });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      Tuliskan deskripsi produk yang persuasif, profesional, dan menarik untuk katalog e-commerce dalam Bahasa Indonesia.
      Detail Produk:
      - Nama Produk: ${name}
      - Kategori: ${category || 'Umum'}

      Spesifikasi Keluaran:
      - Tulis 2 paragraf deskripsi penjualan. Paragraf pertama tentang keunggulan utama dan gaya, paragraf kedua tentang kenyamanan/spesifikasi dan ajakan membeli (Call to Action).
      - Jangan menyertakan label seperti "Paragraf 1" atau judul lain. Cukup kembalikan teks deskripsi bersih.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    res.json({ description: text });
  } catch (error) {
    console.error('Error calling Gemini API for description:', error);
    res.json({ 
      description: getLocalDescriptionFallback(name, category) 
    });
  }
});

// ============================================
// HELPER FUNCTIONS (Logika Fallback Lokal)
// ============================================

// Fungsi pencarian kata kunci lokal
function getLocalFallbackReply(message, catalog) {
  const query = message.toLowerCase();
  
  // Deteksi kata kunci pencarian produk
  const matchedProducts = catalog.filter(p => 
    query.includes(p.nama.toLowerCase()) || 
    query.includes(p.kategori.toLowerCase()) ||
    (query.includes('cari') && p.nama.toLowerCase().split(' ').some(word => query.includes(word))) ||
    (query.includes('jual') && p.nama.toLowerCase().split(' ').some(word => query.includes(word)))
  );

  if (matchedProducts.length > 0) {
    let reply = `Halo! Saya menemukan beberapa produk di toko kami yang sesuai dengan pencarian Anda:\n\n`;
    matchedProducts.forEach(p => {
      reply += `* **${p.nama}**\n`;
      reply += `  Harga: ${p.harga} | Kategori: ${p.kategori} | Stok: ${p.stok}\n`;
      reply += `  _${p.deskripsi.substring(0, 80)}..._\n\n`;
    });
    reply += `Anda dapat menambahkan produk tersebut langsung ke keranjang untuk melakukan checkout! Ada yang ingin ditanyakan lagi?`;
    return reply;
  }

  // Respon standar berdasarkan kategori pertanyaan umum
  if (query.includes('halo') || query.includes('hai') || query.includes('pagi') || query.includes('siang') || query.includes('sore') || query.includes('malam')) {
    return `Halo! Selamat datang di Deksdigital Store. Saya adalah AI Asisten Belanja Anda. Anda bisa menanyakan daftar produk, harga, stok, atau merekomendasikan produk menarik. Ada yang bisa saya bantu hari ini?`;
  }
  
  if (query.includes('bayar') || query.includes('qris') || query.includes('pembayaran') || query.includes('transfer')) {
    return `Untuk pembayaran di toko kami, Anda bisa memilih metode **QRIS** pada halaman checkout. Cukup scan barcode QRIS yang tampil di layar, selesaikan transaksi di e-wallet/mobile banking Anda, lalu klik tombol "Konfirmasi Pembayaran" untuk memverifikasi bukti bayar via WhatsApp Admin/CS.`;
  }

  if (query.includes('kirim') || query.includes('ongkir') || query.includes('kurir') || query.includes('alamat')) {
    return `Kami melayani pengiriman ke seluruh wilayah Indonesia. Saat checkout, silakan isi detail nama, nomor telepon, dan alamat pengiriman Anda dengan lengkap. Barang Anda akan diproses dan dikirim setelah bukti transfer diverifikasi.`;
  }

  if (query.includes('rekomendasi') || query.includes('bagus') || query.includes('laris') || query.includes('terbaik')) {
    const popular = catalog.slice(0, 2);
    let reply = `Berikut adalah beberapa produk yang sangat kami rekomendasikan untuk Anda:\n\n`;
    popular.forEach(p => {
      reply += `* **${p.nama}** (${p.harga}) - _${p.deskripsi.substring(0, 60)}..._\n`;
    });
    reply += `\nSilakan klik produk di halaman beranda untuk melihat spesifikasi lengkap dan menambahkannya ke keranjang belanja!`;
    return reply;
  }

  // Default response
  return `Saya mengerti pertanyaan Anda. Saat ini modul AI Gemini sedang dinonaktifkan (API Key kosong) sehingga saya menggunakan mode pencarian lokal. Anda bisa bertanya tentang:
- Pencarian barang (misal: "apakah ada mouse?")
- Cara bayar (misal: "bagaimana metode pembayarannya?")
- Pengiriman (misal: "pengiriman lewat apa?")
- Katalog Rekomendasi (misal: "tampilkan rekomendasi produk")`;
}

// Fungsi deskripsi template lokal
function getLocalDescriptionFallback(name, category) {
  return `Miliki segera "${name}" kualitas premium terbaik untuk menunjang aktivitas harian Anda! Produk kategori ${category || 'Umum'} ini dirancang khusus menggunakan material pilihan berkualitas tinggi sehingga memberikan kenyamanan maksimal, daya tahan ekstra yang tangguh, serta tampilan modern yang elegan.

Sangat cocok digunakan untuk melengkapi kebutuhan gaya hidup Anda atau sebagai kado spesial untuk orang terdekat. Dapatkan penawaran harga terbaik eksklusif hanya di toko kami. Stok produk terbatas, beli sekarang sebelum kehabisan!`;
}

module.exports = router;
