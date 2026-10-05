// ==========================================================================
// NOTIFIER UTILITY — WebSocket Broadcast + Email (Nodemailer)
// ==========================================================================
const nodemailer = require('nodemailer');
const dbHelper = require('../db/dbHelper');

// Referensi ke Map koneksi admin WebSocket — diisi dari server.js
let _adminConnections = null;

function setAdminConnections(map) {
  _adminConnections = map;
}

/**
 * Kirim pesan JSON ke semua admin yang sedang terkoneksi via WebSocket
 * @param {object} payload — objek yang akan di-JSON.stringify dan dikirim
 */
function broadcastToAdmins(payload) {
  if (!_adminConnections) return;
  const message = JSON.stringify(payload);
  _adminConnections.forEach((ws) => {
    try {
      if (ws.readyState === 1) { // WebSocket.OPEN = 1
        ws.send(message);
      }
    } catch (e) {
      console.error('[WS] Gagal mengirim ke admin:', e.message);
    }
  });
}

/**
 * Kirim email notifikasi ke admin
 * @param {string} subject — Judul email
 * @param {string} htmlBody — Isi email dalam format HTML
 */
async function sendEmailToAdmin(subject, htmlBody) {
  const settings = dbHelper.readData('settings');

  if (!settings.emailNotifications || !settings.emailNotifications.enabled) {
    return; // Email dinonaktifkan
  }

  const { smtpUser, smtpPass } = settings.emailNotifications;
  const adminEmail = settings.adminEmail;

  if (!smtpUser || !smtpPass || !adminEmail) {
    console.warn('[EMAIL] Konfigurasi email belum lengkap, notifikasi email dilewati.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  try {
    await transporter.sendMail({
      from: `"Deksdigital Store 🛒" <${smtpUser}>`,
      to: adminEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
          <div style="background: #0a192f; padding: 24px 32px;">
            <h1 style="color: #f97316; margin: 0; font-size: 20px;">🛒 Deksdigital Store</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0 0; font-size: 13px;">Notifikasi Admin Panel</p>
          </div>
          <div style="padding: 32px; background: white;">
            ${htmlBody}
          </div>
          <div style="padding: 16px 32px; background: #f1f5f9; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2026 Deksdigital Store · Pesan ini dikirim otomatis oleh sistem.</p>
          </div>
        </div>
      `
    });
    console.log(`[EMAIL] Notifikasi terkirim ke: ${adminEmail}`);
  } catch (err) {
    console.error('[EMAIL] Gagal mengirim email:', err.message);
  }
}

module.exports = { broadcastToAdmins, sendEmailToAdmin, setAdminConnections };
