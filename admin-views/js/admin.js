// State management dasbor
let settingsData = null;
let currentActiveTab = 'tab-reports';
let selectedProductImage = null;

// Map produk untuk akses data aman (hindari karakter khusus di onclick)
let productsCache = {};

// ==========================================================================
// AUTENTIKASI & INITIALISASI SESI
// ==========================================================================

async function checkAdminSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.loggedIn || data.user.role !== 'admin') {
      window.location.href = '/admin-dashboard/login.html';
      return;
    }
    
    // Inisialisasi data halaman
    await initDashboard();
  } catch (err) {
    window.location.href = '/admin-dashboard/login.html';
  }
}

async function initDashboard() {
  await loadSettings();
  await loadReports();
  await loadProducts();
  await loadOrders();
  lucide.createIcons();

  // Inisialisasi notifikasi SETELAH sesi terverifikasi
  if (typeof connectAdminWebSocket === 'function') {
    connectAdminWebSocket();
  }
  if (typeof updateBadgeCounts === 'function') {
    updateBadgeCounts();
    setInterval(updateBadgeCounts, 10000);
  }
}

async function handleLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari Admin Panel?')) return;
  
  try {
    const res = await fetch('/api/admin/logout', { method: 'POST' });
    if (res.ok) {
      window.location.href = '/admin-dashboard/login.html';
    }
  } catch (e) {
    alert('Gagal melakukan logout.');
  }
}

// ==========================================================================
// TABS CONTROLLER
// ==========================================================================

function switchTab(tabId) {
  currentActiveTab = tabId;
  
  // Update class active pada tombol sidebar
  document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    // Cari tombol yang memicu tabId ini
    if (btn.getAttribute('onclick').includes(tabId)) {
      btn.classList.add('active');
    }
  });

  // Tampilkan section tab yang aktif
  document.querySelectorAll('.panel-section').forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById(tabId).classList.add('active');

  // Trigger load data terbaru jika berpindah tab
  if (tabId === 'tab-reports') loadReports();
  if (tabId === 'tab-products') loadProducts();
  if (tabId === 'tab-orders') loadOrders();
  if (tabId === 'tab-coupons') loadDiscountCodes();
  if (tabId === 'tab-verification') {
    if (typeof loadPendingVerifications === 'function') loadPendingVerifications();
  }
  if (tabId === 'tab-chat') {
    if (typeof loadChatMessages === 'function') loadChatMessages();
  }
  if (tabId === 'tab-security') {
    // Kosongkan field password setiap kali tab dibuka untuk keamanan
    const fields = ['admin-old-password', 'admin-new-password', 'admin-confirm-password'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const wrap = document.getElementById('pwd-strength-wrap');
    if (wrap) wrap.style.display = 'none';
    const lbl = document.getElementById('pwd-match-label');
    if (lbl) lbl.textContent = '';
  }

  lucide.createIcons();
}

// ==========================================================================
// MANAGEMENT SETTINGS (No-Code Config)
// ==========================================================================

async function loadSettings() {
  try {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    settingsData = data;

    // 1. Toggles Fitur
    if (data.features) {
      document.getElementById('feat-promo-banner').checked = !!data.features.promoBanner;
      document.getElementById('feat-search-bar').checked = !!data.features.searchBar;
      document.getElementById('feat-stock-alert').checked = !!data.features.stockAlert;
      document.getElementById('feat-whatsapp-chat').checked = !!data.features.whatsappChat;
      document.getElementById('feat-reviews').checked = !!data.features.reviews;
    }

    // 2. Color Pickers
    if (data.theme) {
      document.getElementById('theme-primary').value = data.theme.primary || '#0a192f';
      document.getElementById('theme-secondary').value = data.theme.secondary || '#0f172a';
      document.getElementById('theme-accent').value = data.theme.accent || '#f97316';
      document.getElementById('theme-bg').value = data.theme.background || '#f8fafc';
    }

    // 3. Teks Global & Input parameters
    document.getElementById('shop-name-input').value = data.shopName || '';
    document.getElementById('announcement-input').value = data.announcement || '';
    document.getElementById('stock-threshold-input').value = data.stockThreshold || 5;
    document.getElementById('gemini-apikey-input').value = data.geminiApiKey || '';

    // 4. WhatsApp CS Configs
    document.getElementById('shop-wa-input').value = data.whatsappAdmin || '';
    document.getElementById('shop-wa-greeting-input').value = data.whatsappGreeting || '';
    document.getElementById('shop-wa-invoice-input').value = data.whatsappInvoiceTemplate || '';

    // 6. Tata Letak Section Beranda
    renderLayoutSorter(data.layout || ['hero', 'categories', 'products', 'newsletter']);

    // 7. Trust Badges Editor
    renderTrustBadgesEditor(data.trustBadges);

    // 8. Papan Iklan & Poster Promo Carousel
    renderPromoBannersAdmin(data.promoBanners);

    // 9. Form Informasi Penerima Kustom (No-Code Builder)
    renderCustomCustomerFieldsAdmin(data.customCustomerFields);

    // Populate email and sound settings
    if (typeof populateEmailAndSoundSettings === 'function') {
      populateEmailAndSoundSettings(data);
    }

  } catch (err) {
    console.error('Gagal mengambil settings:', err);
  }
}

// Simpan Saklar Toggle Fitur ke Server
async function saveFeatureToggles() {
  const payload = {
    features: {
      promoBanner: document.getElementById('feat-promo-banner').checked,
      searchBar: document.getElementById('feat-search-bar').checked,
      stockAlert: document.getElementById('feat-stock-alert').checked,
      whatsappChat: document.getElementById('feat-whatsapp-chat').checked,
      reviews: document.getElementById('feat-reviews').checked
    }
  };

  await updateSettingsAPI(payload, 'Fitur berhasil di-toggle!');
}

// Simpan Pilihan Warna Tema ke Server
async function saveDesignColors() {
  const payload = {
    theme: {
      primary: document.getElementById('theme-primary').value,
      secondary: document.getElementById('theme-secondary').value,
      accent: document.getElementById('theme-accent').value,
      background: document.getElementById('theme-bg').value,
      text: '#334155'
    }
  };

  await updateSettingsAPI(payload, 'Warna tema baru berhasil disimpan.');
}

// Simpan Tata Letak Urutan Beranda & Teks
async function saveLayoutAndTexts() {
  // Ambil urutan layout dari sorter list
  const layoutItems = document.querySelectorAll('.layout-sort-item');
  const layout = Array.from(layoutItems).map(item => item.getAttribute('data-layout-key'));

  const payload = {
    shopName: document.getElementById('shop-name-input').value.trim(),
    announcement: document.getElementById('announcement-input').value.trim(),
    stockThreshold: parseInt(document.getElementById('stock-threshold-input').value) || 5,
    geminiApiKey: document.getElementById('gemini-apikey-input').value.trim(),
    layout
  };

  await updateSettingsAPI(payload, 'Tata letak dan teks berhasil diperbarui!');
}

// Simpan Konfigurasi WhatsApp Admin
async function saveWaConfigs() {
  const payload = {
    whatsappAdmin: document.getElementById('shop-wa-input').value.trim(),
    whatsappGreeting: document.getElementById('shop-wa-greeting-input').value.trim(),
    whatsappInvoiceTemplate: document.getElementById('shop-wa-invoice-input').value.trim()
  };

  await updateSettingsAPI(payload, 'Konfigurasi pesan WhatsApp disimpan.');
}

// Helper fetch PUT untuk memperbarui settings di server
async function updateSettingsAPI(payload, successMsg) {
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (res.ok) {
      alert(successMsg);
      settingsData = data.settings;
    } else {
      alert(data.error || 'Gagal menyimpan konfigurasi.');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  }
}

// ==========================================================================
// TRUST BADGES EDITOR
// ==========================================================================

// Icon pilihan yang tersedia di Lucide
const TRUST_ICON_OPTIONS = [
  'shield-check', 'zap', 'headphones', 'truck', 'rotate-ccw',
  'star', 'heart', 'check-circle', 'award', 'gift',
  'clock', 'thumbs-up', 'lock', 'percent', 'tag'
];

function renderTrustBadgesEditor(badges) {
  const container = document.getElementById('trust-badges-editor');
  if (!container) return;

  const defaultBadges = [
    { icon: 'shield-check', title: 'Garansi Resmi', desc: 'Produk 100% Original' },
    { icon: 'zap',          title: 'Proses Cepat',  desc: 'Order & proses instan' },
    { icon: 'headphones',   title: 'CS 24/7',       desc: 'Via WhatsApp & AI' },
    { icon: 'truck',        title: 'Pengiriman',    desc: 'Ke seluruh Indonesia' },
    { icon: 'rotate-ccw',   title: 'Retur Mudah',   desc: 'Produk tidak sesuai' }
  ];

  const items = (badges && badges.length > 0) ? badges : defaultBadges;

  container.innerHTML = items.map((b, i) => {
    const iconOptions = TRUST_ICON_OPTIONS.map(ic =>
      `<option value="${ic}" ${ic === b.icon ? 'selected' : ''}>${ic}</option>`
    ).join('');

    return `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px 20px;">
        <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; margin-bottom:12px;">
          Badge #${i + 1}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; align-items:end;">
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.8rem;">Icon (Lucide)</label>
            <select class="form-control" id="badge-icon-${i}" style="height:40px; font-size:0.85rem;">
              ${iconOptions}
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.8rem;">Judul Badge</label>
            <input type="text" class="form-control" id="badge-title-${i}" value="${b.title || ''}" placeholder="Judul badge..." style="height:40px;">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.8rem;">Deskripsi Badge</label>
            <input type="text" class="form-control" id="badge-desc-${i}" value="${b.desc || ''}" placeholder="Deskripsi singkat..." style="height:40px;">
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

async function saveTrustBadges() {
  const container = document.getElementById('trust-badges-editor');
  if (!container) return;

  // Hitung jumlah badge dari rows yang ada
  const trustBadges = [];
  let i = 0;
  while (document.getElementById(`badge-icon-${i}`) !== null) {
    trustBadges.push({
      icon:  document.getElementById(`badge-icon-${i}`).value.trim(),
      title: document.getElementById(`badge-title-${i}`).value.trim(),
      desc:  document.getElementById(`badge-desc-${i}`).value.trim()
    });
    i++;
  }

  if (trustBadges.length === 0) {
    alert('Tidak ada data badge untuk disimpan.');
    return;
  }

  try {
    const res = await fetch('/api/admin/trust-badges', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trustBadges })
    });

    const data = await res.json();
    if (res.ok) {
      alert('✅ Icon Bar berhasil diperbarui! Perubahan langsung tampil di halaman toko.');
      settingsData.trustBadges = data.trustBadges;
    } else {
      alert(data.error || 'Gagal menyimpan badge.');
    }
  } catch (err) {
    alert('Kesalahan jaringan saat menyimpan badge.');
  }
}

// ==========================================================================
// PAPAN IKLAN & POSTER PROMO CAROUSEL (ADMIN)
// ==========================================================================

function renderPromoBannersAdmin(banners) {
  const container = document.getElementById('promo-banners-list-admin');
  if (!container) return;

  const defaultBanners = [
    {
      id: 'banner_1',
      imageUrl: '/uploads/hero-banner.png',
      tag: '🔥 DISKON SPESIAL',
      title: 'Promo Aksesoris & Setup Gear',
      desc: 'Dapatkan penawaran harga terbaik untuk aksesoris gaming & kantor.',
      buttonText: 'Cek Produk Diskon',
      buttonLink: '#sec-products'
    }
  ];

  const items = (banners && banners.length > 0) ? banners : defaultBanners;

  container.innerHTML = items.map((b, idx) => `
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
      <div style="position: relative; height: 120px; background: #0a192f;">
        <img src="${b.imageUrl}" alt="${b.title}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" onerror="this.onerror=null; this.src='/uploads/hero-banner.png'">
        <span style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.6); color: #fdba74; font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; backdrop-filter: blur(4px);">
          ${b.tag || 'PROMO'}
        </span>
      </div>
      <div style="padding: 12px 14px; flex: 1; display: flex; flex-direction: column;">
        <strong style="font-size: 0.88rem; color: var(--secondary-color); margin-bottom: 4px; display: block; line-height: 1.3;">${b.title}</strong>
        <p style="font-size: 0.78rem; color: #64748b; margin-bottom: 12px; flex: 1; line-height: 1.4;">${b.desc}</p>
        
        <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 10px;">
          Tombol: <strong style="color: var(--accent-color);">${b.buttonText || 'Cek Produk'}</strong> &rarr; <span style="font-family: monospace;">${b.buttonLink || '#'}</span>
        </div>

        <button class="btn-admin delete" style="width: 100%; justify-content: center; padding: 6px; font-size: 0.78rem; background: #fee2e2; border-color: #fca5a5; color: #ef4444;" onclick="deletePromoBannerAdmin('${b.id}')">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Hapus Poster Ini
        </button>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

async function uploadPromoBannerAdmin() {
  const fileInput = document.getElementById('promo-banner-file-input');
  const tag = document.getElementById('promo-tag-input').value.trim();
  const title = document.getElementById('promo-title-input').value.trim();
  const desc = document.getElementById('promo-desc-input').value.trim();
  const buttonText = document.getElementById('promo-btn-text-input').value.trim();
  const buttonLink = document.getElementById('promo-btn-link-input').value.trim();

  if (!title) {
    alert('Mohon isi judul poster promo.');
    return;
  }

  const formData = new FormData();
  if (fileInput.files && fileInput.files.length > 0) {
    formData.append('bannerImage', fileInput.files[0]);
  }
  formData.append('tag', tag);
  formData.append('title', title);
  formData.append('desc', desc);
  formData.append('buttonText', buttonText);
  formData.append('buttonLink', buttonLink);

  try {
    const res = await fetch('/api/admin/upload-promo-banner', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (res.ok) {
      alert('✅ Poster promo baru berhasil ditambahkan!');
      if (settingsData) settingsData.promoBanners = data.promoBanners;
      renderPromoBannersAdmin(data.promoBanners);

      // Reset form
      fileInput.value = '';
      document.getElementById('promo-title-input').value = '';
      document.getElementById('promo-desc-input').value = '';
    } else {
      alert(data.error || 'Gagal mengunggah poster promo.');
    }
  } catch (err) {
    alert('Kesalahan jaringan saat mengunggah poster promo.');
  }
}

async function deletePromoBannerAdmin(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus poster promo ini?')) return;

  try {
    const res = await fetch(`/api/admin/promo-banner/${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    if (res.ok) {
      alert('Poster promo berhasil dihapus.');
      if (settingsData) settingsData.promoBanners = data.promoBanners;
      renderPromoBannersAdmin(data.promoBanners);
    } else {
      alert(data.error || 'Gagal menghapus poster promo.');
    }
  } catch (err) {
    alert('Kesalahan jaringan saat menghapus poster promo.');
  }
}

// ==========================================================================
// FORM INFORMASI PENERIMA KUSTOM (NO-CODE BUILDER)
// ==========================================================================
let currentCustomFieldsState = [];

function renderCustomCustomerFieldsAdmin(fields) {
  const container = document.getElementById('custom-fields-crud-list');
  if (!container) return;

  const defaultFields = [
    { id: 'field_device_name', label: 'Nama / Tipe Device (HP / Laptop)', type: 'text', placeholder: 'Contoh: iPhone 14 Pro, Samsung S23...', required: false },
    { id: 'field_device_brand', label: 'Merek Device', type: 'text', placeholder: 'Contoh: Apple, Samsung, Xiaomi...', required: false }
  ];

  currentCustomFieldsState = (fields && fields.length > 0) ? [...fields] : defaultFields;

  container.innerHTML = currentCustomFieldsState.map((field, idx) => `
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong style="font-size: 0.9rem; color: var(--secondary-color);">${field.label}</strong>
          ${field.required ? '<span style="background:#fee2e2; color:#ef4444; font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:6px;">Wajib</span>' : '<span style="background:#f1f5f9; color:#64748b; font-size:0.7rem; padding:2px 6px; border-radius:6px;">Opsional</span>'}
        </div>
        <p style="font-size: 0.78rem; color: #64748b; margin: 4px 0 0 0;">Placeholder: <em>${field.placeholder || '(Kosong)'}</em></p>
      </div>

      <button class="btn-admin delete" style="padding: 6px 12px; font-size: 0.78rem;" onclick="deleteCustomCustomerFieldAdmin(${idx})">
        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Hapus
      </button>
    </div>
  `).join('');

  lucide.createIcons();
}

function addCustomCustomerFieldAdmin() {
  const labelInput = document.getElementById('new-cf-label');
  const placeholderInput = document.getElementById('new-cf-placeholder');
  const reqCheckbox = document.getElementById('new-cf-required');

  const label = labelInput.value.trim();
  const placeholder = placeholderInput.value.trim();
  const required = reqCheckbox.checked;

  if (!label) {
    alert('Mohon isi nama label untuk kolom kustom.');
    return;
  }

  const newField = {
    id: `field_custom_${Date.now()}`,
    label,
    type: 'text',
    placeholder,
    required
  };

  currentCustomFieldsState.push(newField);
  renderCustomCustomerFieldsAdmin(currentCustomFieldsState);

  // Reset inputs
  labelInput.value = '';
  placeholderInput.value = '';
  reqCheckbox.checked = false;
}

function deleteCustomCustomerFieldAdmin(index) {
  if (index < 0 || index >= currentCustomFieldsState.length) return;
  currentCustomFieldsState.splice(index, 1);
  renderCustomCustomerFieldsAdmin(currentCustomFieldsState);
}

async function saveCustomCustomerFieldsAdmin() {
  const payload = {
    customCustomerFields: currentCustomFieldsState
  };

  await updateSettingsAPI(payload, '✅ Kolom kustom Informasi Penerima berhasil disimpan!');
}


// Render Panel Urutan Beranda (Layout Sorter)
function renderLayoutSorter(layoutArray) {
  const container = document.getElementById('layout-sortable-container');
  if (!container) return;

  container.innerHTML = '';
  
  const labels = {
    'hero': 'Hero Slider & Banner Promo',
    'categories': 'Filter Kategori',
    'products': 'Katalog Produk Resmi',
    'newsletter': 'Seksi Berlangganan Newsletter'
  };

  layoutArray.forEach((key, index) => {
    const item = document.createElement('div');
    item.className = 'layout-sort-item';
    item.setAttribute('data-layout-key', key);
    item.innerHTML = `
      <span style="font-weight:600;"><i data-lucide="grip-vertical" style="width:14px; height:14px; display:inline-block; margin-right:8px; vertical-align:middle; color:#94a3b8;"></i>${labels[key] || key}</span>
      <div class="layout-sort-actions">
        <button class="sort-arrow-btn" onclick="moveLayoutItem(${index}, -1)" ${index === 0 ? 'disabled' : ''}>
          <i data-lucide="chevron-up" style="width:16px; height:16px;"></i>
        </button>
        <button class="sort-arrow-btn" onclick="moveLayoutItem(${index}, 1)" ${index === layoutArray.length - 1 ? 'disabled' : ''}>
          <i data-lucide="chevron-down" style="width:16px; height:16px;"></i>
        </button>
      </div>
    `;
    container.appendChild(item);
  });
  
  lucide.createIcons();
}

function moveLayoutItem(index, direction) {
  const layout = settingsData.layout || ['hero', 'categories', 'products', 'newsletter'];
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= layout.length) return;

  // Swap
  const temp = layout[index];
  layout[index] = layout[newIndex];
  layout[newIndex] = temp;

  settingsData.layout = layout;
  renderLayoutSorter(layout);
}

// ==========================================================================

// ==========================================================================
// REPORTS & FINANSIAL STATISTICS
// ==========================================================================

async function loadReports() {
  try {
    const res = await fetch('/api/admin/reports');
    const data = await res.json();

    // Set value stat cards
    document.getElementById('stat-sales').textContent = 'Rp ' + data.stats.totalSalesValue.toLocaleString('id-ID');
    document.getElementById('stat-commission').textContent = 'Rp ' + data.stats.totalAdminCommission.toLocaleString('id-ID');
    document.getElementById('stat-partners').textContent = `${data.stats.partnersCount} Toko Mitra`;
    document.getElementById('stat-orders').textContent = `${data.stats.totalOrdersCount} Pesanan`;

    // Render daftar mitra
    const partnersContainer = document.getElementById('reports-partners-list');
    partnersContainer.innerHTML = '';
    
    if (data.partners.length === 0) {
      partnersContainer.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b;">Belum ada mitra terdaftar.</td></tr>`;
    } else {
      data.partners.forEach(partner => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:600;"><i data-lucide="store" style="width:12px; height:12px; display:inline-block; margin-right:4px;"></i>${partner.shopName}</td>
          <td>${partner.whatsapp}</td>
          <td style="text-align: right;">
            <input type="number" id="partner-fee-input-${partner.id}" value="${partner.adminFeePercent !== undefined ? partner.adminFeePercent : 5}" min="0" max="100" style="width:65px; text-align:center; padding:4px 6px; border-radius:8px; border:1px solid #cbd5e1; font-weight:700; color:var(--accent-color);"> %
          </td>
          <td style="text-align: right;">
            <button class="btn-admin primary" style="padding:4px 10px; font-size:0.78rem;" onclick="updatePartnerFeeAdmin('${partner.id}', '${partner.shopName}')">
              Simpan
            </button>
          </td>
        `;
        partnersContainer.appendChild(tr);
      });
    }

    // Render daftar pembagian biaya layanan
    const feesContainer = document.getElementById('reports-fees-list');
    feesContainer.innerHTML = '';
    
    const validOrders = data.orders.filter(o => o.adminFees > 0);
    
    if (validOrders.length === 0) {
      feesContainer.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#64748b;">Belum ada pendapatan komisi mitra.</td></tr>`;
    } else {
      validOrders.slice(0, 8).forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:600; font-family:monospace;">${order.orderId}</td>
          <td>${order.customerName}</td>
          <td style="text-align: right; font-weight:700; color:#22c55e;">+ Rp ${order.adminFees.toLocaleString('id-ID')}</td>
        `;
        feesContainer.appendChild(tr);
      });
    }

    lucide.createIcons();
  } catch (err) {
    console.error('Gagal memuat laporan finansial:', err);
  }
}

// Simpan Persentase Komisi Admin Baru per Toko Mitra
async function updatePartnerFeeAdmin(partnerId, shopName) {
  const input = document.getElementById(`partner-fee-input-${partnerId}`);
  if (!input) return;
  const fee = parseFloat(input.value);

  if (isNaN(fee) || fee < 0 || fee > 100) {
    alert('Persentase komisi admin harus angka antara 0% hingga 100%.');
    return;
  }

  try {
    const res = await fetch(`/api/admin/partner/${partnerId}/fee`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminFeePercent: fee })
    });

    const data = await res.json();
    if (res.ok) {
      alert(`✅ ${data.message}`);
      loadReports();
    } else {
      alert(data.error || 'Gagal merubah persentase komisi.');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  }
}

// ==========================================================================
// PRODUCT CRUD (Products Management)
// ==========================================================================

async function loadProducts() {
  const container = document.getElementById('admin-products-list');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/products');
    const products = await res.json();
    
    if (products.length === 0) {
      container.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">Tidak ada data katalog produk.</td></tr>`;
      return;
    }

    container.innerHTML = '';
    // Reset cache produk
    productsCache = {};

    products.forEach(p => {
      // Simpan data produk ke cache agar tidak perlu di-encode di onclick
      productsCache[p.id] = p;

      const isOfficial = p.ownerId === 'admin';
      const ownerLabel = isOfficial 
        ? `<span style="font-weight:600; color:var(--primary-color);">Deksdigital</span>` 
        : `<span style="font-weight:600; color:var(--accent-color);"><i data-lucide="store" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:3px;"></i>Mitra</span>`;

      const priceText = 'Rp ' + p.price.toLocaleString('id-ID');
      // Escape nama produk untuk HTML attribute agar tidak XSS
      const safeProductName = p.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${p.imageUrl}" alt="${safeProductName}" style="width:45px; height:45px; object-fit:cover; border-radius:8px; border:1px solid var(--border-color);" onerror="this.onerror=null; this.src='/uploads/default-product.jpg'"></td>
        <td style="font-weight:600; max-width:200px;">${safeProductName}</td>
        <td>${p.category}</td>
        <td style="text-align: right; font-weight:700; color:var(--secondary-color);">${priceText}</td>
        <td>${ownerLabel}</td>
        <td style="text-align: center; font-weight:600;">${p.stock}</td>
        <td style="text-align: center;">
          <span style="background-color: ${p.status === 'aktif' ? '#dcfce7' : '#fee2e2'}; color: ${p.status === 'aktif' ? '#15803d' : '#b91c1c'}; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:10px;">
            ${p.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-row" style="justify-content: flex-end;">
            <button class="btn-admin edit" data-product-id="${p.id}" onclick="openEditProductModalById(this.dataset.productId)">
              <i data-lucide="edit-2" style="width:14px; height:14px;"></i> Sunting
            </button>
            <button class="btn-admin delete" data-product-id="${p.id}" data-is-official="${isOfficial}" onclick="deleteProduct(this.dataset.productId, this.dataset.isOfficial === 'true')">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </td>
      `;
      container.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat produk.</td></tr>`;
  }
}

function toggleShippingFields() {
  const type = document.getElementById('p-delivery-type-field').value;
  const weightGroup = document.getElementById('p-weight-group');
  const originGroup = document.getElementById('p-shipping-origin-group');
  
  if (type === 'fisik') {
    weightGroup.style.display = 'block';
    originGroup.style.display = 'block';
  } else {
    weightGroup.style.display = 'none';
    originGroup.style.display = 'none';
  }
}

function openAddProductModal() {
  document.getElementById('modal-product-title').textContent = 'Tambah Produk Baru';
  document.getElementById('p-id-field').value = '';
  document.getElementById('p-name-field').value = '';
  document.getElementById('p-category-field').value = 'Aksesoris';
  document.getElementById('p-price-field').value = '';
  document.getElementById('p-stock-field').value = '';
  document.getElementById('p-desc-field').value = '';
  document.getElementById('p-status-field').value = 'aktif';
  document.getElementById('p-delivery-type-field').value = 'digital';
  document.getElementById('p-weight-field').value = '0';
  document.getElementById('p-origin-city-field').value = 'Jakarta';
  toggleShippingFields();
  document.getElementById('p-img-preview').src = '/uploads/default-product.jpg';
  document.getElementById('p-file-input').value = '';
  selectedProductImage = null;
  
  document.getElementById('product-modal').style.display = 'flex';
  lucide.createIcons();
}

// Fungsi baru: buka modal edit menggunakan cache data produk (aman dari karakter khusus)
function openEditProductModalById(id) {
  const p = productsCache[id];
  if (!p) {
    alert('Data produk tidak ditemukan. Coba muat ulang halaman.');
    return;
  }
  openEditProductModal(p.id, p.name, p.category, p.price, p.stock, p.status, p.imageUrl, p.description, p.deliveryType, p.weight, p.originCity);
}

function openEditProductModal(id, name, category, price, stock, status, imageUrl, description, deliveryType, weight, originCity) {
  document.getElementById('modal-product-title').textContent = 'Sunting Data Produk';
  document.getElementById('p-id-field').value = id;
  document.getElementById('p-name-field').value = name;
  document.getElementById('p-category-field').value = category;
  document.getElementById('p-price-field').value = price;
  document.getElementById('p-stock-field').value = stock;
  document.getElementById('p-desc-field').value = description;
  document.getElementById('p-status-field').value = status;
  document.getElementById('p-delivery-type-field').value = deliveryType || 'digital';
  document.getElementById('p-weight-field').value = weight || '0';
  document.getElementById('p-origin-city-field').value = originCity || 'Jakarta';
  toggleShippingFields();
  document.getElementById('p-img-preview').src = imageUrl || '/uploads/default-product.jpg';
  document.getElementById('p-file-input').value = '';
  selectedProductImage = null;

  document.getElementById('product-modal').style.display = 'flex';
  lucide.createIcons();
}

function closeProductModal() {
  document.getElementById('product-modal').style.display = 'none';
}

function previewProductImage() {
  const fileInput = document.getElementById('p-file-input');
  const preview = document.getElementById('p-img-preview');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
}

// Integrasi AI Generator Deskripsi Produk
async function generateDescriptionAI() {
  const name = document.getElementById('p-name-field').value.trim();
  const category = document.getElementById('p-category-field').value;
  const descTextarea = document.getElementById('p-desc-field');

  if (!name) {
    alert('Silakan isi Nama Produk terlebih dahulu sebelum membuat deskripsi AI.');
    return;
  }

  descTextarea.value = 'AI sedang menulis deskripsi produk persuasif... Mohon tunggu...';

  try {
    const res = await fetch('/api/ai/generate-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category })
    });
    
    const data = await res.json();
    if (res.ok) {
      descTextarea.value = data.description;
    } else {
      descTextarea.value = 'Gagal memanggil AI. Silakan tulis deskripsi secara manual.';
    }
  } catch (err) {
    descTextarea.value = 'Kesalahan koneksi AI. Silakan tulis secara manual.';
  }
}

// Mengirim Form CRUD Produk (Add/Edit)
async function saveProductSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('p-id-field').value;
  const name = document.getElementById('p-name-field').value.trim();
  const category = document.getElementById('p-category-field').value;
  const price = document.getElementById('p-price-field').value;
  const stock = document.getElementById('p-stock-field').value;
  const description = document.getElementById('p-desc-field').value.trim();
  const status = document.getElementById('p-status-field').value;
  const deliveryType = document.getElementById('p-delivery-type-field').value;
  const weight = document.getElementById('p-weight-field').value;
  const originCity = document.getElementById('p-origin-city-field').value;
  const fileInput = document.getElementById('p-file-input');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('category', category);
  formData.append('price', price);
  formData.append('stock', stock);
  formData.append('description', description);
  formData.append('status', status);
  formData.append('deliveryType', deliveryType);
  formData.append('weight', weight);
  formData.append('originCity', originCity);
  formData.append('originProvince', ''); // Backend maps this from city

  if (fileInput.files && fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  }

  let url = '/api/admin/product';
  let method = 'POST';

  if (id) {
    url = `/api/admin/product/${id}`;
    method = 'PUT'; // Edit mode
  }

  const submitBtn = document.getElementById('modal-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyimpan...';

  try {
    const res = await fetch(url, {
      method: method,
      body: formData
    });
    
    const data = await res.json();
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Produk';

    if (res.ok) {
      alert(data.message || 'Produk berhasil disimpan.');
      closeProductModal();
      loadProducts();
    } else {
      alert(data.error || 'Terjadi kesalahan saat menyimpan produk.');
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Produk';
    alert('Eror koneksi saat mengirim data.');
  }
}

// Menghapus Produk
async function deleteProduct(id, isOfficial) {
  const ownerMsg = isOfficial 
    ? 'Hapus produk resmi Deksdigital ini?' 
    : 'Peringatan! Produk ini milik mitra penjual. Menghapus produk ini akan mengeluarkannya dari katalog kemitraan secara sepihak. Lanjutkan?';

  if (!confirm(ownerMsg)) return;

  try {
    const res = await fetch(`/api/admin/product/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      alert('Produk berhasil dihapus.');
      loadProducts();
    } else {
      alert(data.error || 'Gagal menghapus produk.');
    }
  } catch (e) {
    alert('Kesalahan jaringan.');
  }
}

// ==========================================================================
// ORDERS CONTROL PANEL
// ==========================================================================

async function loadOrders() {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/orders');
    const orders = await res.json();
    
    if (orders.length === 0) {
      container.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748b;">Belum ada riwayat pesanan masuk.</td></tr>`;
      return;
    }

    container.innerHTML = '';
    orders.reverse().forEach(o => {
      // Susun list ringkasan barang
      let itemsListText = o.items.map(item => `- ${item.name} (${item.qty}x)`).join('<br>');
      
      const dateObj = new Date(o.createdAt);
      const formattedDate = dateObj.toLocaleDateString('id-ID') + ' ' + String(dateObj.getHours()).padStart(2,'0') + ':' + String(dateObj.getMinutes()).padStart(2,'0');

      let customFieldsText = '';
      if (o.customer && o.customer.customFields) {
        customFieldsText = Object.entries(o.customer.customFields)
          .map(([k, v]) => `<span style="font-size:0.75rem; color:#f97316; display:block;">🔹 <strong>${k}</strong>: ${v}</span>`)
          .join('');
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:700; font-family:monospace;">${o.orderId}</td>
        <td>${formattedDate}</td>
        <td>
          <strong style="color:var(--secondary-color);">${o.customer.name}</strong><br>
          <span style="font-size:0.8rem; color:#64748b;">${o.customer.phone}</span>
          ${customFieldsText}
        </td>
        <td style="font-size:0.85rem; max-width:220px; line-height:1.4;">${itemsListText}</td>
        <td style="text-align: right; font-weight:700; color:var(--accent-color);">Rp ${o.total.toLocaleString('id-ID')}</td>
        <td style="text-align: center;">
          <select class="form-control" style="height:35px; padding:2px 8px; font-size:0.8rem; font-weight:700; border-radius:10px; width:150px;" onchange="changeOrderStatus('${o.orderId}', this)">
            <option value="Menunggu Pembayaran" ${o.status === 'Menunggu Pembayaran' ? 'selected' : ''}>Menunggu Bayar</option>
            <option value="Menunggu Verifikasi" ${o.status === 'Menunggu Verifikasi' ? 'selected' : ''}>Menunggu Verif</option>
            <option value="Dibayar" ${o.status === 'Dibayar' ? 'selected' : ''}>Dibayar (Lunas)</option>
            <option value="Dikirim" ${o.status === 'Dikirim' ? 'selected' : ''}>Dikirim (Resi)</option>
            <option value="Selesai" ${o.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
            <option value="Dibatalkan" ${o.status === 'Dibatalkan' ? 'selected' : ''}>Dibatalkan</option>
          </select>
        </td>
        <td style="text-align: right;">
          <button class="btn-admin primary" onclick="window.open('/receipt.html?orderId=${o.orderId}', '_blank')">
            <i data-lucide="printer" style="width:14px; height:14px;"></i> Struk
          </button>
        </td>
      `;
      container.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat daftar pesanan.</td></tr>`;
  }
}

async function changeOrderStatus(orderId, selectEl) {
  const newStatus = selectEl.value;
  
  try {
    const res = await fetch(`/api/admin/order/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert(`Pesanan ${orderId} berhasil diubah ke: ${newStatus}`);
      // Muat ulang ringkasan statistik
      loadReports();
    } else {
      alert(data.error || 'Gagal merubah status pesanan.');
    }
  } catch (e) {
    alert('Gagal mengirim pembaruan status.');
  }
}

// ==========================================================================
// KODE DISKON / KUPON MANAGEMENT
// ==========================================================================

let couponsCache = {};

// Fungsi hint deskripsi kategori kupon saat dropdown berubah
function updateCouponCategoryHint() {
  const catEl = document.getElementById('coupon-category-field');
  const hintEl = document.getElementById('coupon-category-hint');
  if (!catEl || !hintEl) return;
  const cat = catEl.value;
  if (cat === 'all') {
    hintEl.style.background = '#f0fdf4';
    hintEl.style.borderLeftColor = '#22c55e';
    hintEl.innerHTML = '&#9989; Kupon ini berlaku untuk <strong>semua produk</strong> tanpa terkecuali.';
  } else {
    hintEl.style.background = '#fffbeb';
    hintEl.style.borderLeftColor = '#f59e0b';
    hintEl.innerHTML = `&#127919; Kupon ini <strong>hanya berlaku</strong> untuk produk kategori <strong style="color:#b45309;">${cat}</strong>. Pembeli harus punya produk ${cat} di keranjang.`;
  }
}

async function loadDiscountCodes() {
  const container = document.getElementById('admin-coupons-list');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/discount-codes');
    const coupons = await res.json();
    
    if (coupons.length === 0) {
      container.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748b;">Belum ada kode diskon terdaftar.</td></tr>`;
      return;
    }

    container.innerHTML = '';
    couponsCache = {};

    coupons.forEach(c => {
      couponsCache[c.code] = c;
      const statusLabel = c.status === 'aktif' ? 'Aktif' : 'Nonaktif';
      const statusColor = c.status === 'aktif' ? '#22c55e' : '#ef4444';
      const statusBg = c.status === 'aktif' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
      
      const typeLabel = c.type === 'percentage' ? 'Persentase' : 'Potongan Tetap';
      const valueText = c.type === 'percentage' ? `${c.value}%` : 'Rp ' + c.value.toLocaleString('id-ID');
      const minBuyText = (c.minPurchase && c.minPurchase > 0)
        ? 'Rp ' + c.minPurchase.toLocaleString('id-ID')
        : '<span style="color:#94a3b8; font-size:0.8rem;">Tidak ada</span>';

      // Badge kategori
      const cat = c.category || 'all';
      let catBadge;
      if (cat === 'all') {
        catBadge = `<span style="background:#dbeafe; color:#1d4ed8; padding:3px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">🌐 Semua Produk</span>`;
      } else {
        catBadge = `<span style="background:#fef3c7; color:#b45309; padding:3px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">🎯 ${cat}</span>`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:700; font-family:monospace; font-size:1.05rem; color:var(--primary-color);">${c.code}</td>
        <td>${catBadge}</td>
        <td>${typeLabel}</td>
        <td style="text-align: right; font-weight:700;">${valueText}</td>
        <td style="text-align: right;">${minBuyText}</td>
        <td style="text-align: center;">
          <button class="badge-status" style="border:none; cursor:pointer; background:${statusBg}; color:${statusColor}; font-weight:700; padding:6px 12px; border-radius:20px;" onclick="toggleCouponStatus('${c.code}', '${c.status}')">
            ${statusLabel}
          </button>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-row" style="justify-content: flex-end;">
            <button class="btn-admin delete" onclick="deleteCoupon('${c.code}')">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i> Hapus
            </button>
          </div>
        </td>
      `;
      container.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat daftar kupon.</td></tr>`;
  }
}

function openAddCouponModal() {
  document.getElementById('modal-coupon-title').textContent = 'Tambah Kupon Baru';
  document.getElementById('coupon-code-field').value = '';
  document.getElementById('coupon-code-field').disabled = false;
  document.getElementById('coupon-category-field').value = 'all';
  document.getElementById('coupon-type-field').value = 'percentage';
  document.getElementById('coupon-value-field').value = '';
  document.getElementById('coupon-min-purchase-field').value = '0';
  document.getElementById('coupon-status-field').value = 'aktif';
  updateCouponCategoryHint();
  
  document.getElementById('coupon-modal').style.display = 'flex';
  lucide.createIcons();
}

function closeCouponModal() {
  document.getElementById('coupon-modal').style.display = 'none';
}

async function saveCouponSubmit(event) {
  event.preventDefault();

  const code = document.getElementById('coupon-code-field').value.trim().toUpperCase();
  const category = document.getElementById('coupon-category-field').value;
  const type = document.getElementById('coupon-type-field').value;
  const value = document.getElementById('coupon-value-field').value;
  const minPurchase = parseFloat(document.getElementById('coupon-min-purchase-field').value) || 0;
  const status = document.getElementById('coupon-status-field').value;

  if (!code || value === '') {
    alert('Mohon lengkapi seluruh field kupon.');
    return;
  }

  const payload = { code, category, type, value: parseFloat(value), minPurchase, status };
  
  const submitBtn = document.getElementById('coupon-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyimpan...';

  try {
    const res = await fetch('/api/admin/discount-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Kupon';

    if (res.ok) {
      alert(data.message || 'Kupon berhasil disimpan.');
      closeCouponModal();
      loadDiscountCodes();
    } else {
      alert(data.error || 'Gagal menyimpan kupon.');
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Kupon';
    alert('Terjadi kesalahan jaringan.');
  }
}

async function toggleCouponStatus(code, currentStatus) {
  const newStatus = currentStatus === 'aktif' ? 'nonaktif' : 'aktif';
  try {
    const res = await fetch(`/api/admin/discount-code/${code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      loadDiscountCodes();
    } else {
      const data = await res.json();
      alert(data.error || 'Gagal mengubah status kupon.');
    }
  } catch (err) {
    alert('Kesalahan koneksi saat mengubah status.');
  }
}

async function deleteCoupon(code) {
  if (!confirm(`Apakah Anda yakin ingin menghapus kupon "${code}"?`)) return;

  try {
    const res = await fetch(`/api/admin/discount-code/${code}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('Kupon berhasil dihapus.');
      loadDiscountCodes();
    } else {
      const data = await res.json();
      alert(data.error || 'Gagal menghapus kupon.');
    }
  } catch (err) {
    alert('Kesalahan jaringan.');
  }
}

// ==========================================================================
// KEAMANAN AKUN: GANTI PASSWORD ADMIN
// ==========================================================================

// Toggle show/hide password input
function togglePwdVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  // Ganti icon
  const icon = btn.querySelector('i');
  if (icon) {
    icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
    lucide.createIcons();
  }
}

// Cek kekuatan password baru (live indicator)
function checkPasswordStrength() {
  const pwd = document.getElementById('admin-new-password').value;
  const wrap = document.getElementById('pwd-strength-wrap');
  const bar  = document.getElementById('pwd-strength-bar');
  const lbl  = document.getElementById('pwd-strength-label');

  if (!pwd) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';

  let score = 0;
  if (pwd.length >= 6)  score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const levels = [
    { pct: '20%',  color: '#ef4444', text: '🔴 Sangat Lemah' },
    { pct: '40%',  color: '#f97316', text: '🟠 Lemah' },
    { pct: '60%',  color: '#eab308', text: '🟡 Sedang' },
    { pct: '80%',  color: '#22c55e', text: '🟢 Kuat' },
    { pct: '100%', color: '#16a34a', text: '✅ Sangat Kuat' },
  ];
  const lvl = levels[Math.min(score - 1, 4)] || levels[0];
  bar.style.width = lvl.pct;
  bar.style.background = lvl.color;
  lbl.style.color = lvl.color;
  lbl.textContent = lvl.text;

  // Update konfirmasi juga jika sudah diisi
  checkPasswordMatch();
}

// Cek apakah password baru dan konfirmasi cocok
function checkPasswordMatch() {
  const newPwd  = document.getElementById('admin-new-password').value;
  const confPwd = document.getElementById('admin-confirm-password').value;
  const lbl     = document.getElementById('pwd-match-label');
  if (!lbl) return;

  if (!confPwd) {
    lbl.textContent = '';
    return;
  }
  if (newPwd === confPwd) {
    lbl.style.color = '#22c55e';
    lbl.textContent = '✅ Password cocok';
  } else {
    lbl.style.color = '#ef4444';
    lbl.textContent = '❌ Password tidak cocok';
  }
}

// Kirim permintaan ganti password ke server
async function changeAdminPassword() {
  const oldPwd  = document.getElementById('admin-old-password').value.trim();
  const newPwd  = document.getElementById('admin-new-password').value;
  const confPwd = document.getElementById('admin-confirm-password').value;

  if (!oldPwd || !newPwd || !confPwd) {
    alert('Mohon lengkapi semua field password.');
    return;
  }
  if (newPwd.length < 6) {
    alert('Password baru minimal 6 karakter.');
    return;
  }
  if (newPwd !== confPwd) {
    alert('Password baru dan konfirmasi tidak cocok. Periksa kembali.');
    document.getElementById('admin-confirm-password').focus();
    return;
  }

  const btn = event.currentTarget || document.querySelector('[onclick="changeAdminPassword()"]');
  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;animation:spin 1s linear infinite;"></i> Menyimpan...';
  }

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
    });

    const data = await res.json();

    if (res.ok) {
      // Kosongkan semua field setelah sukses
      document.getElementById('admin-old-password').value = '';
      document.getElementById('admin-new-password').value = '';
      document.getElementById('admin-confirm-password').value = '';
      document.getElementById('pwd-strength-wrap').style.display = 'none';
      document.getElementById('pwd-match-label').textContent = '';
      alert(data.message || '✅ Password berhasil diubah!');
    } else {
      alert('❌ ' + (data.error || 'Gagal mengubah password.'));
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan. Coba lagi.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
      lucide.createIcons();
    }
  }
}

// Jalankan Pengecekan Sesi saat Halaman Dibuka
document.addEventListener('DOMContentLoaded', checkAdminSession);
