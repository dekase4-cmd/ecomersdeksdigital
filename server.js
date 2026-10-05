const express = require('express');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Pastikan folder uploads ada (dalam mode serverless disesuaikan dengan /tmp jika perlu)
try {
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const mockQrisPath = path.join(uploadsDir, 'default-qris.png');
  if (!fs.existsSync(mockQrisPath)) {
    fs.writeFileSync(mockQrisPath, 'Dummy QRIS Image Data');
  }
} catch (e) {
  console.log('Skipping local file writing on serverless environment');
}

// Middleware Dasar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 10 * 1024 * 1024 }, // Batasi 10MB (naik dari 5MB untuk bukti transfer)
}));

// Konfigurasi Sesi Aman
app.use(session({
  secret: 'deksdigital_ecomers_super_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set ke true jika menggunakan HTTPS
    httpOnly: true, // Mencegah akses dari client-side JS (XSS protection)
    sameSite: 'strict', // Proteksi dari CSRF
    maxAge: 24 * 60 * 60 * 1000 // Sesi bertahan 1 hari
  }
}));

// API Endpoint untuk mengecek sesi aktif (Current User)
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  res.json({ loggedIn: false });
});

// Proteksi Rute Statis Dashboard Admin (/admin-dashboard)
app.use('/admin-dashboard', (req, res, next) => {
  const publicPaths = ['/login.html'];
  const reqPath = req.path;
  
  if (publicPaths.includes(reqPath) || reqPath.startsWith('/css/') || reqPath.startsWith('/js/')) {
    return next(); // Izinkan akses halaman login dan aset visual dashboard tanpa login
  }
  
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next(); // Izinkan jika sudah login sebagai admin
  }
  
  res.redirect('/admin-dashboard/login.html');
}, express.static(path.join(__dirname, 'admin-views')));

// Proteksi Rute Statis Dashboard Mitra (/mitra-dashboard)
app.use('/mitra-dashboard', (req, res, next) => {
  const publicPaths = ['/login.html', '/register.html'];
  const reqPath = req.path;
  
  if (publicPaths.includes(reqPath) || reqPath.startsWith('/css/') || reqPath.startsWith('/js/')) {
    return next(); // Izinkan akses halaman login, register, dan aset visual mitra
  }
  
  if (req.session && req.session.user && req.session.user.role === 'mitra') {
    return next(); // Izinkan jika sudah login sebagai mitra
  }
  
  res.redirect('/mitra-dashboard/login.html');
}, express.static(path.join(__dirname, 'mitra-views')));

// Rute Statis untuk Storefront Publik (Halaman Pembeli)
app.use(express.static(path.join(__dirname, 'public')));

// Impor Controller Rute API
const storeRoutes = require('./src/routes/store');
const adminRoutes = require('./src/routes/admin');
const mitraRoutes = require('./src/routes/mitra');
const aiRoutes = require('./src/routes/ai');
const shippingRoutes = require('./src/routes/shipping');
const chatRoutes = require('./src/routes/chat');

// Hubungkan Rute API
app.use('/api/store', storeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mitra', mitraRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/chat', chatRoutes);

// ==========================================================================
// WEBSOCKET SERVER — Notifikasi Real-Time untuk Admin
// ==========================================================================
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map: adminId → koneksi WebSocket aktif
const adminConnections = new Map();

// Daftarkan Map ke notifier utility agar bisa broadcast dari route manapun
const notifier = require('./src/utils/notifier');
notifier.setAdminConnections(adminConnections);

wss.on('connection', (ws) => {
  let clientAdminId = null;

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());

      // Admin mengirim pesan AUTH untuk mendaftarkan diri
      if (msg.type === 'ADMIN_AUTH' && msg.adminId) {
        clientAdminId = msg.adminId;
        adminConnections.set(clientAdminId, ws);
        ws.send(JSON.stringify({
          type: 'AUTH_OK',
          message: 'Terhubung ke server notifikasi real-time.'
        }));
        console.log(`[WS] Admin terhubung: ${clientAdminId} (Total: ${adminConnections.size})`);
      }
    } catch (e) {
      // Abaikan pesan yang bukan JSON valid
    }
  });

  ws.on('close', () => {
    if (clientAdminId) {
      adminConnections.delete(clientAdminId);
      console.log(`[WS] Admin terputus: ${clientAdminId} (Sisa: ${adminConnections.size})`);
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] Error koneksi:', err.message);
  });
});

// Jalankan Server (HTTP + WebSocket) jika dijalankan secara langsung (Local Node.js)
if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(` Server E-Commerce Deksdigital berjalan di:`);
    console.log(` http://localhost:${PORT}`);
    console.log(` WebSocket aktif untuk notifikasi admin.`);
    console.log(`=================================================`);
  });
}

module.exports = app;

