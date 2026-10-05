// ==========================================================================
// ADMIN REAL-TIME NOTIFICATIONS & PANEL INTERACTIVE CONTROLLERS
// ==========================================================================
let adminWs = null;
let activeVerifOrderId = null; // Menyimpan orderId yang sedang dilihat di modal bukti transfer

// ─── WebSocket Client & Live Updates ──────────────────────────────────────
function connectAdminWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  console.log('[WS] Menghubungkan ke:', wsUrl);
  adminWs = new WebSocket(wsUrl);
  
  adminWs.onopen = () => {
    console.log('[WS] Terhubung ke server notifikasi.');
    // Autentikasi sebagai admin
    adminWs.send(JSON.stringify({
      type: 'ADMIN_AUTH',
      adminId: `admin_session_${Date.now()}`
    }));
  };
  
  adminWs.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      handleLiveNotification(payload);
    } catch (e) {
      console.error('[WS] Gagal memproses pesan:', e);
    }
  };
  
  adminWs.onclose = () => {
    console.warn('[WS] Koneksi terputus. Menghubungkan ulang dalam 3 detik...');
    setTimeout(connectAdminWebSocket, 3000);
  };

  adminWs.onerror = (err) => {
    console.error('[WS] Error:', err);
  };
}

function handleLiveNotification(payload) {
  // 1. Pesan Chat Baru
  if (payload.type === 'NEW_CHAT_MESSAGE') {
    showLivePopup(
      '💬 Pesan Baru Masuk!',
      `Dari: ${payload.data.senderName}<br>Pesan: "${payload.data.message}"`,
      'chat'
    );
    playNotificationSound();
    
    // Update badge & list jika sedang di tab chat
    updateBadgeCounts();
    if (window.currentActiveTab === 'tab-chat') {
      loadChatMessages();
    }
  }
  
  // 2. Upload Bukti Transfer Baru
  if (payload.type === 'NEW_PAYMENT_PROOF') {
    showLivePopup(
      '💳 Bukti Transfer Masuk!',
      `Order: ${payload.data.orderId}<br>Nama: ${payload.data.customerName}<br>Total: ${payload.data.totalFormatted}`,
      'payment'
    );
    playNotificationSound();
    
    // Update badge & lists
    updateBadgeCounts();
    if (window.currentActiveTab === 'tab-verification') {
      loadPendingVerifications();
    }
    if (window.currentActiveTab === 'tab-orders') {
      loadOrders();
    }
  }
}

// Tampilkan Popup Toast Visual
function showLivePopup(title, htmlContent, type) {
  const popup = document.createElement('div');
  popup.className = `admin-notif-popup ${type}`;
  popup.innerHTML = `
    <div class="notif-icon">${type === 'chat' ? '💬' : '💳'}</div>
    <div class="notif-content">
      <strong>${title}</strong>
      <p>${htmlContent}</p>
    </div>
    <button onclick="this.parentElement.classList.remove('visible'); setTimeout(() => this.parentElement.remove(), 400);">×</button>
  `;
  document.body.appendChild(popup);
  
  // Trigger transition
  setTimeout(() => popup.classList.add('visible'), 100);
  
  // Auto dismiss setelah 8 detik
  setTimeout(() => {
    popup.classList.remove('visible');
    setTimeout(() => popup.remove(), 400);
  }, 8000);
}

// ─── Putar Suara Notifikasi ───────────────────────────────────────────────
function playNotificationSound() {
  const soundUrl = window.settingsData?.notificationSound;
  
  if (soundUrl) {
    // Putar file audio kustom yang diupload
    const audio = new Audio(soundUrl);
    audio.play().catch(err => {
      console.warn('[AUDIO] Gagal memutar file audio, fallback ke synthesizer browser.', err);
      playSynthesizedBeep();
    });
  } else {
    // Fallback: mainkan suara sintesis browser (Web Audio API)
    playSynthesizedBeep();
  }
}

// Beep berirama menggunakan AudioContext
function playSynthesizedBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    // Arpeggio ringtone pendek
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5
    osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.36); // C6
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.error('[AUDIO] Browser memblokir audio atau tidak mendukung AudioContext.', e);
  }
}

// ─── Update Badges Count ──────────────────────────────────────────────────
async function updateBadgeCounts() {
  try {
    // 1. Verifikasi pending count
    const verifRes = await fetch('/api/admin/orders/pending-verification');
    const verifData = await verifRes.json();
    const verifBadge = document.getElementById('badge-verification');
    if (verifBadge) {
      verifBadge.textContent = verifData.length;
      verifBadge.style.display = verifData.length > 0 ? 'inline-block' : 'none';
    }
    
    // 2. Chat unread count
    const chatRes = await fetch('/api/admin/chat/messages');
    const chats = await chatRes.json();
    const unreadChats = chats.filter(c => !c.isRead).length;
    const chatBadge = document.getElementById('badge-chat');
    if (chatBadge) {
      chatBadge.textContent = unreadChats;
      chatBadge.style.display = unreadChats > 0 ? 'inline-block' : 'none';
    }
  } catch (e) {
    console.error('Gagal memperbarui badges count:', e);
  }
}

// ─── Verifikasi Pembayaran Manual (Tab) ───────────────────────────────
async function loadPendingVerifications() {
  const container = document.getElementById('admin-pending-verification-list');
  if (!container) return;
  
  try {
    const res = await fetch('/api/admin/orders/pending-verification');
    const pending = await res.json();
    
    if (pending.length === 0) {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">Tidak ada pesanan menunggu verifikasi bukti transfer.</td></tr>`;
      return;
    }
    
    container.innerHTML = '';
    pending.forEach(o => {
      const dateObj = new Date(o.uploadedAt || o.createdAt);
      const formattedDate = dateObj.toLocaleDateString('id-ID') + ' ' + String(dateObj.getHours()).padStart(2,'0') + ':' + String(dateObj.getMinutes()).padStart(2,'0');
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:700; font-family:monospace;">${o.orderId}</td>
        <td>${formattedDate}</td>
        <td>
          <strong style="color:var(--secondary-color);">${o.customer.name}</strong><br>
          <span style="font-size:0.8rem; color:#64748b;">${o.customer.phone}</span>
        </td>
        <td style="text-align: right; font-weight:700; color:var(--accent-color);">Rp ${o.total.toLocaleString('id-ID')}</td>
        <td style="text-align: center;">
          <img src="${o.buktiTransferUrl}" alt="Bukti Transfer" class="proof-thumbnail" onclick="openProofModal('${o.orderId}', '${o.buktiTransferUrl}')">
        </td>
        <td style="text-align: right;">
          <div class="action-btn-row" style="justify-content: flex-end; gap: 8px;">
            <button class="btn-admin primary" style="background:#22c55e; border-color:#22c55e; padding:6px 12px; font-size:0.8rem;" onclick="verifyManualPayment('${o.orderId}', 'approve')">
              Setujui
            </button>
            <button class="btn-admin delete" style="background:#ef4444; border-color:#ef4444; color:white; padding:6px 12px; font-size:0.8rem;" onclick="promptRejectionReason('${o.orderId}')">
              Tolak
            </button>
          </div>
        </td>
      `;
      container.appendChild(tr);
    });
    
    lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat daftar verifikasi.</td></tr>`;
  }
}

async function verifyManualPayment(orderId, action, reason = '') {
  const confirmMsg = action === 'approve' 
    ? `Setujui pembayaran untuk pesanan ${orderId}? Status order akan berubah menjadi "Dibayar".`
    : `Tolak pembayaran untuk pesanan ${orderId}?`;
    
  if (!confirm(confirmMsg)) return;
  
  try {
    const res = await fetch(`/api/admin/order/${orderId}/verify-payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      // Reload views & badges
      loadPendingVerifications();
      updateBadgeCounts();
      loadReports();
    } else {
      alert(data.error || 'Gagal memproses verifikasi.');
    }
  } catch (e) {
    alert('Terjadi kesalahan jaringan.');
  }
}

function promptRejectionReason(orderId) {
  const reason = prompt('Masukkan alasan penolakan bukti transfer:', 'Bukti transfer tidak valid / tidak terbaca');
  if (reason === null) return; // Batal
  verifyManualPayment(orderId, 'reject', reason);
}

// ─── Modal Bukti Transfer ────────────────────────────────────────────────
function openProofModal(orderId, imgUrl) {
  activeVerifOrderId = orderId;
  document.getElementById('proof-modal-image').src = imgUrl;
  document.getElementById('proof-overlay').classList.add('open');
  lucide.createIcons();
}

function closeProofModal(e) {
  document.getElementById('proof-overlay').classList.remove('open');
  activeVerifOrderId = null;
}

function verifyPaymentFromModal(action) {
  if (!activeVerifOrderId) return;
  verifyManualPayment(activeVerifOrderId, action);
  closeProofModal();
}

function openRejectionReasonPrompt() {
  if (!activeVerifOrderId) return;
  const reason = prompt('Masukkan alasan penolakan bukti transfer:', 'Bukti transfer tidak valid / tidak terbaca');
  if (reason === null) return;
  verifyManualPayment(activeVerifOrderId, 'reject', reason);
  closeProofModal();
}

// ─── Tanya Admin (Chat) ───────────────────────────────────────────────────
async function loadChatMessages() {
  const container = document.getElementById('admin-chats-list');
  if (!container) return;
  
  try {
    const res = await fetch('/api/admin/chat/messages');
    const messages = await res.json();
    
    if (messages.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b; background:white; border-radius:16px; border:1px solid #e2e8f0;">
        <i data-lucide="message-square-off" style="width:48px;height:48px;margin:0 auto 12px;opacity:0.4;display:block;"></i>
        Belum ada pesan masuk dari customer.
      </div>`;
      lucide.createIcons();
      return;
    }
    
    container.innerHTML = '';
    messages.forEach(m => {
      const isUnread = !m.isRead;
      const dateObj = new Date(m.timestamp);
      const formattedTime = dateObj.toLocaleDateString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
      
      const card = document.createElement('div');
      card.className = `chat-msg-card ${isUnread ? 'unread' : ''}`;
      card.id = `chat-${m.id}`;
      
      // WhatsApp link untuk membalas chat
      let replyWaBtn = '';
      if (m.senderPhone) {
        const cleanPhone = m.senderPhone.replace(/[^0-9]/g, '');
        const messageText = `Halo ${m.senderName}, saya admin dari Deksdigital Store. Mengenai pertanyaan Anda: "${m.message}"`;
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`;
        replyWaBtn = `<a href="${waUrl}" target="_blank" class="chat-reply-wa-btn" onclick="markChatAsRead('${m.id}')">
          <i data-lucide="phone" style="width:14px;height:14px;"></i> Balas via WA
        </a>`;
      }
      
      card.innerHTML = `
        <div class="chat-card-header">
          <div>
            <span class="chat-card-sender">${m.senderName}</span>
            <div class="chat-card-phone">${m.senderPhone || '(No WA tidak dilampirkan)'}</div>
          </div>
          <span class="chat-card-time">${formattedTime}</span>
        </div>
        <div class="chat-card-body">${m.message}</div>
        <div class="chat-card-actions">
          ${replyWaBtn}
          ${isUnread ? `<button class="btn-admin primary" style="padding:6px 12px; font-size:0.75rem;" onclick="markChatAsRead('${m.id}')">Tandai Dibaca</button>` : ''}
          <button class="btn-admin delete" style="background:#fee2e2; border-color:#fee2e2; color:#ef4444; padding:6px 12px; font-size:0.75rem;" onclick="deleteChat('${m.id}')">
            Hapus
          </button>
        </div>
      `;
      container.appendChild(card);
    });
    
    lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat pesan chat.</div>`;
  }
}

async function markChatAsRead(id) {
  try {
    const res = await fetch(`/api/chat/message/${id}/read`, { method: 'PUT' });
    if (res.ok) {
      const card = document.getElementById(`chat-${id}`);
      if (card) {
        card.classList.remove('unread');
        // Hapus tombol "Tandai Dibaca"
        const btn = card.querySelector('.chat-card-actions button.primary');
        if (btn) btn.remove();
      }
      updateBadgeCounts();
    }
  } catch (e) {
    console.error('Gagal menandai pesan dibaca:', e);
  }
}

async function readAllChats() {
  if (!confirm('Tandai semua pesan sudah dibaca?')) return;
  try {
    const res = await fetch('/api/chat/read-all', { method: 'PUT' });
    if (res.ok) {
      loadChatMessages();
      updateBadgeCounts();
    }
  } catch (e) {
    alert('Gagal memperbarui status pesan.');
  }
}

async function deleteChat(id) {
  if (!confirm('Hapus pesan pertanyaan ini dari riwayat?')) return;
  try {
    const res = await fetch(`/api/admin/chat/message/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const card = document.getElementById(`chat-${id}`);
      if (card) card.remove();
      updateBadgeCounts();
    }
  } catch (e) {
    alert('Gagal menghapus pesan.');
  }
}

// ─── Settings: Notifikasi Email & Suara ───────────────────────────────
function populateEmailAndSoundSettings(settings) {
  const emailEnabled = document.getElementById('email-notif-enabled');
  const adminEmail = document.getElementById('email-admin-input');
  const smtpUser = document.getElementById('email-smtp-user');
  const smtpPass = document.getElementById('email-smtp-pass');
  const soundLabel = document.getElementById('current-sound-label');

  if (settings.emailNotifications) {
    emailEnabled.checked = !!settings.emailNotifications.enabled;
    smtpUser.value = settings.emailNotifications.smtpUser || '';
    smtpPass.value = settings.emailNotifications.smtpPass ? '••••••••••••' : '';
  }

  adminEmail.value = settings.adminEmail || '';

  if (settings.notificationSound) {
    const filename = settings.notificationSound.split('/').pop();
    soundLabel.textContent = `Suara: ${filename}`;
  } else {
    soundLabel.textContent = 'Suara: Bunyi Sintesis Browser (Default)';
  }
}

async function saveEmailSettings() {
  const enabled = document.getElementById('email-notif-enabled').checked;
  const adminEmail = document.getElementById('email-admin-input').value.trim();
  const smtpUser = document.getElementById('email-smtp-user').value.trim();
  const smtpPass = document.getElementById('email-smtp-pass').value.trim();

  const payload = {
    enabled,
    adminEmail,
    smtpUser
  };

  // Jangan kirim placeholder password ke server
  if (smtpPass && smtpPass !== '••••••••••••') {
    payload.smtpPass = smtpPass;
  }

  try {
    const res = await fetch('/api/admin/settings/email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      // Reload settingsData locally
      if (!window.settingsData) window.settingsData = {};
      window.settingsData.adminEmail = adminEmail;
      if (!window.settingsData.emailNotifications) window.settingsData.emailNotifications = {};
      window.settingsData.emailNotifications.enabled = enabled;
      window.settingsData.emailNotifications.smtpUser = smtpUser;
      
      console.log('Email settings updated.');
    }
  } catch (err) {
    console.error('Gagal menyimpan konfigurasi email:', err);
  }
}

async function uploadNotificationSound() {
  const fileInput = document.getElementById('sound-file-input');
  if (!fileInput.files || fileInput.files.length === 0) return;

  const formData = new FormData();
  formData.append('soundFile', fileInput.files[0]);

  try {
    const res = await fetch('/api/admin/upload-notification-sound', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    if (res.ok) {
      alert('Suara notifikasi kustom berhasil diperbarui!');
      if (!window.settingsData) window.settingsData = {};
      window.settingsData.notificationSound = data.soundUrl;
      
      const filename = data.soundUrl.split('/').pop();
      document.getElementById('current-sound-label').textContent = `Suara: ${filename}`;
      fileInput.value = '';
    } else {
      alert(data.error || 'Gagal mengunggah file suara.');
    }
  } catch (err) {
    alert('Eror koneksi saat mengunggah.');
  }
}

// Catatan: connectAdminWebSocket() dan updateBadgeCounts() dipanggil
// dari initDashboard() di admin.js SETELAH sesi admin terverifikasi.
// Jangan panggil di sini untuk menghindari request 401 sebelum login.
