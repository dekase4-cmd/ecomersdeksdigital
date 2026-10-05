// ==========================================================================
// ROUTE: /api/chat — Fitur "Tanya Admin"
// ==========================================================================
const express = require('express');
const router = express.Router();
const dbHelper = require('../db/dbHelper');
const { broadcastToAdmins, sendEmailToAdmin } = require('../utils/notifier');

// ─── POST /api/chat/send ──────────────────────────────────────────────────
// User mengirim pertanyaan ke admin (tidak perlu login)
router.post('/send', (req, res) => {
  const { senderName, senderPhone, message, orderId } = req.body;

  if (!senderName || !message) {
    return res.status(400).json({ error: 'Nama dan pesan wajib diisi.' });
  }

  if (message.trim().length < 3) {
    return res.status(400).json({ error: 'Pesan terlalu pendek.' });
  }

  const newMsg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    senderName: senderName.trim(),
    senderPhone: (senderPhone || '').trim(),
    message: message.trim(),
    timestamp: new Date().toISOString(),
    isRead: false,
    orderId: orderId || null
  };

  // Simpan ke database
  const messages = dbHelper.readData('chat_messages');
  messages.push(newMsg);
  dbHelper.writeData('chat_messages', messages);

  // ① Broadcast WebSocket real-time ke semua admin yang terhubung
  broadcastToAdmins({
    type: 'NEW_CHAT_MESSAGE',
    data: {
      id: newMsg.id,
      senderName: newMsg.senderName,
      senderPhone: newMsg.senderPhone,
      message: newMsg.message,
      timestamp: newMsg.timestamp,
      orderId: newMsg.orderId
    }
  });

  // ② Kirim email notifikasi ke admin (async, tidak menunggu)
  const waLink = newMsg.senderPhone
    ? `<a href="https://api.whatsapp.com/send?phone=${newMsg.senderPhone.replace(/[^0-9]/g, '')}&text=Halo%20${encodeURIComponent(newMsg.senderName)}%2C%20merespons%20pertanyaan%20Anda..." style="display:inline-block;padding:10px 20px;background:#25D366;color:white;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">💬 Balas via WhatsApp</a>`
    : '';

  sendEmailToAdmin(
    `💬 Pertanyaan Baru dari ${newMsg.senderName} — Deksdigital Store`,
    `
    <h2 style="color:#0a192f; margin:0 0 16px 0;">Ada pertanyaan baru masuk!</h2>
    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <tr>
        <td style="padding:8px 0; color:#64748b; width:120px;"><strong>Dari</strong></td>
        <td style="padding:8px 0; color:#1e293b;">${newMsg.senderName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0; color:#64748b;"><strong>No. WhatsApp</strong></td>
        <td style="padding:8px 0; color:#1e293b;">${newMsg.senderPhone || '(tidak disertakan)'}</td>
      </tr>
      <tr>
        <td style="padding:8px 0; color:#64748b; vertical-align:top;"><strong>Pesan</strong></td>
        <td style="padding:8px 0; color:#1e293b;">${newMsg.message}</td>
      </tr>
      <tr>
        <td style="padding:8px 0; color:#64748b;"><strong>Waktu</strong></td>
        <td style="padding:8px 0; color:#1e293b;">${new Date(newMsg.timestamp).toLocaleString('id-ID')}</td>
      </tr>
    </table>
    <div style="margin-top:24px; padding:16px; background:#f8fafc; border-left:4px solid #f97316; border-radius:4px;">
      <p style="margin:0; font-size:13px; color:#64748b;">"${newMsg.message}"</p>
    </div>
    ${waLink}
    <div style="margin-top:24px;">
      <a href="http://localhost:3000/admin-dashboard/" style="display:inline-block;padding:10px 20px;background:#0a192f;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">🖥️ Buka Dashboard Admin</a>
    </div>
    `
  );

  res.json({
    success: true,
    message: 'Pertanyaan Anda telah dikirim ke admin. Kami akan segera merespons!'
  });
});

// ─── GET /api/chat/messages ───────────────────────────────────────────────
// Admin: ambil semua pesan (dilindungi sesi)
router.get('/messages', (req, res) => {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Akses ditolak.' });
  }
  const messages = dbHelper.readData('chat_messages');
  // Urutkan dari terbaru
  messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(messages);
});

// ─── PUT /api/chat/message/:id/read ──────────────────────────────────────
// Admin: tandai pesan sudah dibaca
router.put('/message/:id/read', (req, res) => {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Akses ditolak.' });
  }
  const messages = dbHelper.readData('chat_messages');
  const idx = messages.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Pesan tidak ditemukan.' });

  messages[idx].isRead = true;
  dbHelper.writeData('chat_messages', messages);
  res.json({ success: true });
});

// ─── PUT /api/chat/read-all ───────────────────────────────────────────────
// Admin: tandai semua pesan sudah dibaca
router.put('/read-all', (req, res) => {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Akses ditolak.' });
  }
  const messages = dbHelper.readData('chat_messages');
  messages.forEach(m => { m.isRead = true; });
  dbHelper.writeData('chat_messages', messages);
  res.json({ success: true, count: messages.length });
});

module.exports = router;
