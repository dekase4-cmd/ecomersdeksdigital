// State management dasbor mitra
let profileData = null;
let currentActiveTab = 'tab-stats';

// ==========================================================================
// AUTENTIKASI & INITIALISASI SESI
// ==========================================================================

async function checkMitraSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.loggedIn || data.user.role !== 'mitra') {
      window.location.href = '/mitra-dashboard/login.html';
      return;
    }
    
    // Inisialisasi data halaman
    await initMitraDashboard();
  } catch (err) {
    window.location.href = '/mitra-dashboard/login.html';
  }
}

async function initMitraDashboard() {
  await loadProfile();
  await loadStats();
  await loadProducts();
  await loadOrders();
  lucide.createIcons();
}

async function handleLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari Mitra Panel?')) return;
  
  try {
    const res = await fetch('/api/mitra/logout', { method: 'POST' });
    if (res.ok) {
      window.location.href = '/mitra-dashboard/login.html';
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
  
  document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick').includes(tabId)) {
      btn.classList.add('active');
    }
  });

  document.querySelectorAll('.panel-section').forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById(tabId).classList.add('active');

  if (tabId === 'tab-stats') loadStats();
  if (tabId === 'tab-products') loadProducts();
  if (tabId === 'tab-orders') loadOrders();

  lucide.createIcons();
}

// ==========================================================================
// PROFILE CONFIGURATION
// ==========================================================================

async function loadProfile() {
  try {
    const res = await fetch('/api/mitra/profile');
    const data = await res.json();
    profileData = data;

    // Tampilkan nama toko di header top
    document.getElementById('r-top-shopname').textContent = data.shopName;

    // Isi Form Profil
    document.getElementById('m-shopname-input').value = data.shopName || '';
    document.getElementById('m-whatsapp-input').value = data.whatsapp || '';
    document.getElementById('m-fee-input').value = data.adminFeePercent || 5;

    // Set label persentase komisi preview
    document.getElementById('m-preview-fee-label').textContent = data.adminFeePercent || 5;

  } catch (err) {
    console.error('Gagal memuat profil mitra:', err);
  }
}

async function saveMitraProfile(event) {
  event.preventDefault();

  const shopName = document.getElementById('m-shopname-input').value.trim();
  const whatsapp = document.getElementById('m-whatsapp-input').value.trim();
  const adminFeePercent = document.getElementById('m-fee-input').value;

  try {
    const res = await fetch('/api/mitra/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopName, whatsapp, adminFeePercent })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert('Profil toko kemitraan berhasil diperbarui.');
      profileData = data.user;
      
      // Update top header nama toko
      document.getElementById('r-top-shopname').textContent = profileData.shopName;
      document.getElementById('m-preview-fee-label').textContent = profileData.adminFeePercent;
    } else {
      alert(data.error || 'Gagal menyimpan profil.');
    }
  } catch (e) {
    alert('Kesalahan jaringan.');
  }
}

// ==========================================================================
// RINGKASAN & STATISTIK VENDOR MITRA
// ==========================================================================

async function loadStats() {
  try {
    // 1. Ambil data produk
    const resProd = await fetch('/api/mitra/products');
    const products = await resProd.json();
    document.getElementById('stat-products-count').textContent = `${products.length} Produk`;

    // 2. Ambil data order khusus mitra
    const resOrd = await fetch('/api/mitra/orders');
    const orders = await resOrd.json();
    document.getElementById('stat-orders-count').textContent = `${orders.length} Transaksi`;

    // Hitung volume penjualan kotor barang milik mitra
    // Saring pesanan yang bukan Dibatalkan
    const activeOrders = orders.filter(o => o.status !== 'Dibatalkan');
    const totalGross = activeOrders.reduce((sum, order) => sum + order.partnerSubtotal, 0);
    
    document.getElementById('stat-sales-gross').textContent = 'Rp ' + totalGross.toLocaleString('id-ID');

  } catch (err) {
    console.error('Gagal mengambil statistik dasbor mitra:', err);
  }
}

// ==========================================================================
// CRUD PRODUK MITRA
// ==========================================================================

async function loadProducts() {
  const container = document.getElementById('mitra-products-list');
  if (!container) return;

  try {
    const res = await fetch('/api/mitra/products');
    const products = await res.json();
    
    if (products.length === 0) {
      container.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">Belum ada produk terdaftar.</td></tr>`;
      return;
    }

    const feePercent = profileData ? profileData.adminFeePercent : 5;

    container.innerHTML = '';
    products.forEach(p => {
      const priceText = 'Rp ' + p.price.toLocaleString('id-ID');
      
      // Hitung estimasi pendapatan bersih setelah dipotong komisi admin
      const netEarnings = Math.round(p.price * (1 - feePercent / 100));
      const netEarningsText = 'Rp ' + netEarnings.toLocaleString('id-ID');
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${p.imageUrl}" alt="${p.name}" style="width:45px; height:45px; object-fit:cover; border-radius:8px; border:1px solid var(--border-color);" onerror="this.src='/uploads/default-product.jpg'"></td>
        <td style="font-weight:600; max-width:220px;">${p.name}</td>
        <td>${p.category}</td>
        <td style="text-align: right; font-weight:700; color:var(--secondary-color);">${priceText}</td>
        <td style="text-align: right; font-weight:700; color:#22c55e;">${netEarningsText}</td>
        <td style="text-align: center; font-weight:600;">${p.stock}</td>
        <td style="text-align: center;">
          <span style="background-color: ${p.status === 'aktif' ? '#dcfce7' : '#fee2e2'}; color: ${p.status === 'aktif' ? '#15803d' : '#b91c1c'}; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:10px;">
            ${p.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-row" style="justify-content: flex-end;">
            <button class="btn-admin edit" onclick="openEditProductModal('${p.id}', '${p.name}', '${p.category}', ${p.price}, ${p.stock}, '${p.status}', '${p.imageUrl}', \`${p.description.replace(/`/g, '\\`').replace(/"/g, '&quot;')}\`, '${p.deliveryType || 'digital'}', ${p.weight || 0}, '${p.originCity || 'Jakarta'}')">
              <i data-lucide="edit-2" style="width:14px; height:14px;"></i> Sunting
            </button>
            <button class="btn-admin delete" onclick="deleteProduct('${p.id}')">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </td>
      `;
      container.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat katalog produk.</td></tr>`;
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
  document.getElementById('modal-product-title').textContent = 'Tambah Produk Kemitraan';
  document.getElementById('p-id-field').value = '';
  document.getElementById('p-name-field').value = '';
  document.getElementById('p-category-field').value = 'Fashion';
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
  
  calculateStorefrontPricePreview();

  document.getElementById('product-modal').style.display = 'flex';
  lucide.createIcons();
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

  calculateStorefrontPricePreview();

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

// Preview Hitung Harga Akhir di Form CRUD
function calculateStorefrontPricePreview() {
  const basePriceInput = document.getElementById('p-price-field');
  const previewEl = document.getElementById('m-preview-final-price');
  
  const basePrice = parseFloat(basePriceInput.value) || 0;
  const feePercent = profileData ? profileData.adminFeePercent : 5;
  
  const finalPrice = Math.round(basePrice * (1 - feePercent / 100));
  previewEl.textContent = 'Rp ' + finalPrice.toLocaleString('id-ID');
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

// Submit Form CRUD Produk Mitra
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

  let url = '/api/mitra/product';
  let method = 'POST';

  if (id) {
    url = `/api/mitra/product/${id}`;
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
      alert(data.message || 'Produk kemitraan berhasil disimpan.');
      closeProductModal();
      loadProducts();
    } else {
      alert(data.error || 'Gagal menyimpan produk.');
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Produk';
    alert('Eror koneksi saat mengirim data.');
  }
}

// Menghapus Produk Mitra
async function deleteProduct(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus produk kemitraan ini dari katalog?')) return;

  try {
    const res = await fetch(`/api/mitra/product/${id}`, {
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
// ORDERS VIEW PANEL (Pesanan Khusus Barang Milik Mitra)
// ==========================================================================

async function loadOrders() {
  const container = document.getElementById('mitra-orders-list');
  if (!container) return;

  try {
    const res = await fetch('/api/mitra/orders');
    const orders = await res.json();
    
    if (orders.length === 0) {
      container.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748b;">Belum ada pesanan masuk untuk barang Anda.</td></tr>`;
      return;
    }

    container.innerHTML = '';
    orders.reverse().forEach(o => {
      // Susun list barang milik mitra ini saja
      let itemsListText = o.items.map(item => `- ${item.name} (${item.qty}x)`).join('<br>');
      
      const dateObj = new Date(o.createdAt);
      const formattedDate = dateObj.toLocaleDateString('id-ID') + ' ' + String(dateObj.getHours()).padStart(2,'0') + ':' + String(dateObj.getMinutes()).padStart(2,'0');

      let customFieldsText = '';
      if (o.customer && o.customer.customFields) {
        customFieldsText = Object.entries(o.customer.customFields)
          .map(([k, v]) => `<span style="font-size:0.75rem; color:#3b82f6; display:block;">🔹 <strong>${k}</strong>: ${v}</span>`)
          .join('');
      }

      // Tentukan label status warna
      let statusColor = 'pending';
      if (o.status === 'Paid' || o.status === 'Dibayar') statusColor = 'paid';
      if (o.status === 'Dikirim') statusColor = 'shipped';
      if (o.status === 'Dibatalkan') statusColor = 'cancelled';

      const waBtnHtml = o.customer.waLink ? `
        <a href="${o.customer.waLink}" target="_blank" class="btn-admin primary" style="background:#25D366; color:white; border:none; padding:6px 12px; font-size:0.78rem; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; margin-right:4px;">
          <i data-lucide="message-circle" style="width:14px; height:14px;"></i> Chat WA Pembeli
        </a>
      ` : '';

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
        <td style="text-align: right; font-weight:700; color:var(--accent-color);">Rp ${o.partnerSubtotal.toLocaleString('id-ID')}</td>
        <td style="text-align: center;">
          <span class="badge-status ${statusColor}">${o.status}</span>
        </td>
        <td style="text-align: right;">
          <div style="display:flex; justify-content:flex-end; gap:4px; flex-wrap:nowrap;">
            ${waBtnHtml}
            <button class="btn-admin primary" onclick="window.open('/receipt.html?orderId=${o.orderId}', '_blank')">
              <i data-lucide="printer" style="width:14px; height:14px;"></i> Struk
            </button>
          </div>
        </td>
      `;
      container.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat daftar pesanan.</td></tr>`;
  }
}

// Jalankan pengecekan sesi saat halaman dibuka
document.addEventListener('DOMContentLoaded', checkMitraSession);
