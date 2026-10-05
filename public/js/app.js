// ==========================================================================
// PENGELOLAAN GLOBAL & STATE STOREFRONT
// ==========================================================================

let storeSettings = null;

// Menginisialisasi Halaman Depan
async function initStore() {
  await loadSettings();
  updateCartBadge();
  initAIChat();
  
  // Jika di halaman utama/kemitraan, muat produk
  if (typeof loadProducts === 'function') {
    loadProducts();
  }
  
  // Jika di halaman detail produk, muat detail
  if (typeof loadProductDetail === 'function') {
    loadProductDetail();
  }

  // Inisialisasi Hamburger Mobile Nav
  initMobileNav();

  // Jika di halaman keranjang, muat isi keranjang
  if (typeof initCartPage === 'function') {
    initCartPage();
  }

  // Jika di halaman struk, muat rincian struk
  if (typeof loadReceiptPage === 'function') {
    loadReceiptPage();
  }
}

// 1. Memuat Pengaturan dari Server & Menerapkan CSS Variables Tema Dinamis
async function loadSettings() {
  try {
    const res = await fetch('/api/store/settings');
    const data = await res.json();
    storeSettings = data;
    window.storeSettings = data;
    
    // Terapkan Warna Tema Secara Dinamis
    if (data.theme) {
      const root = document.documentElement;
      root.style.setProperty('--primary-color', data.theme.primary || '#0a192f');
      root.style.setProperty('--secondary-color', data.theme.secondary || '#0f172a');
      root.style.setProperty('--accent-color', data.theme.accent || '#f97316');
      root.style.setProperty('--bg-color', data.theme.background || '#f8fafc');
      root.style.setProperty('--text-color', data.theme.text || '#334155');
    }

    // Terapkan Judul & Teks Pengumuman Toko
    const shopTitleElements = document.querySelectorAll('.shop-name-text');
    shopTitleElements.forEach(el => {
      el.textContent = data.shopName || 'Deksdigital Store';
    });

    const announceBar = document.getElementById('announcement-text');
    if (announceBar) {
      if (data.features && data.features.promoBanner) {
        announceBar.textContent = data.announcement || '';
        announceBar.parentElement.style.display = 'block';
      } else {
        announceBar.parentElement.style.display = 'none';
      }
    }

    // Tampilkan/Sembunyikan Bilah Pencarian berdasarkan Toggle Fitur
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
      if (data.features && data.features.searchBar === false) {
        searchForm.style.display = 'none';
      } else {
        searchForm.style.display = 'block';
      }
    }

    // Tampilkan Widget WhatsApp CS jika diaktifkan
    const waFloat = document.getElementById('wa-cs-widget');
    if (waFloat) {
      if (data.features && data.features.whatsappChat) {
        waFloat.style.display = 'flex';
        const greeting = encodeURIComponent(data.whatsappGreeting || '');
        waFloat.href = `https://api.whatsapp.com/send?phone=${data.whatsappAdmin}&text=${greeting}`;
      } else {
        waFloat.style.display = 'none';
      }
    }

    // Render Trust Badges (Icon Bar Putih) dari Settings
    renderTrustBadges(data.trustBadges);

    // Render Papan Iklan & Poster Promo Carousel
    renderPromoCarousel(data.promoBanners);

    return data;
  } catch (err) {
    console.error('Gagal memuat pengaturan toko:', err);
  }
}

// Merender ulang Trust Badges dari data settings
function renderTrustBadges(badges) {
  const container = document.getElementById('trust-strip-container');
  if (!container) return;

  // Default fallback jika settings tidak punya trustBadges
  const defaultBadges = [
    { icon: 'shield-check', title: 'Garansi Resmi', desc: 'Produk 100% Original' },
    { icon: 'zap',          title: 'Proses Cepat',  desc: 'Order & proses instan' },
    { icon: 'headphones',   title: 'CS 24/7',       desc: 'Via WhatsApp & AI' },
    { icon: 'truck',        title: 'Pengiriman',    desc: 'Ke seluruh Indonesia' },
    { icon: 'rotate-ccw',   title: 'Retur Mudah',   desc: 'Produk tidak sesuai' }
  ];

  const items = (badges && badges.length > 0) ? badges : defaultBadges;

  container.innerHTML = items.map((b, idx) => {
    const divider = idx < items.length - 1 ? '<div class="trust-divider"></div>' : '';
    return `
      <div class="trust-item">
        <i data-lucide="${b.icon || 'shield-check'}"></i>
        <span>
          <strong>${b.title || ''}</strong>
          ${b.desc || ''}
        </span>
      </div>
      ${divider}
    `;
  }).join('');

  // Reinit Lucide icons setelah DOM diubah
  if (window.lucide) lucide.createIcons();
}

// ==========================================================================
// MERENDER & MENGELOLA CAROUSEL PAPAN IKLAN / POSTER PROMO
// ==========================================================================
let promoCarouselTimer = null;
let currentPromoSlideIndex = 0;

function renderPromoCarousel(banners) {
  const container = document.getElementById('promo-carousel-container');
  if (!container) return;

  const defaultBanners = [
    {
      id: 'banner_1',
      imageUrl: '/uploads/hero-banner.png',
      tag: '🔥 PROMO SPESIAL HARI INI',
      title: 'Diskon Aksesoris & Gaming Gear',
      desc: 'Dapatkan harga promo terbaik untuk produk pilihan dengan garansi resmi Deksdigital.',
      buttonText: 'Cek Produk Promo',
      buttonLink: '#sec-products'
    },
    {
      id: 'banner_2',
      imageUrl: '/uploads/default-product.jpg',
      tag: '🤝 PROGRAM KEMITRAAN',
      title: 'Bergabung Jadi Mitra Deksdigital',
      desc: 'Mulai berjualan online tanpa modal dengan komisi langsung setiap penjualan.',
      buttonText: 'Daftar Mitra Gratis',
      buttonLink: '/kemitraan.html'
    }
  ];

  const items = (banners && banners.length > 0) ? banners : defaultBanners;

  // Clear existing timer if re-rendered
  if (promoCarouselTimer) clearInterval(promoCarouselTimer);
  currentPromoSlideIndex = 0;

  // Build Track Slides HTML
  const slidesHTML = items.map(b => `
    <div class="promo-slide-item">
      <div class="promo-slide-content">
        <span class="promo-slide-tag">${b.tag || '🔥 PROMO SPESIAL'}</span>
        <h2 class="promo-slide-title">${b.title || 'Promo Menarik'}</h2>
        <p class="promo-slide-desc">${b.desc || ''}</p>
        <a href="${b.buttonLink || '#sec-products'}" class="promo-slide-btn">
          ${b.buttonText || 'Cek Produk'}
          <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i>
        </a>
      </div>
      <div class="promo-slide-image">
        <img src="${b.imageUrl}" alt="${b.title}" onerror="this.onerror=null; this.src='/uploads/hero-banner.png'">
      </div>
    </div>
  `).join('');

  // Build Dots HTML
  const dotsHTML = items.map((_, i) => `
    <span class="promo-dot ${i === 0 ? 'active' : ''}" onclick="goToPromoSlide(${i})"></span>
  `).join('');

  // Only show nav buttons if more than 1 slide
  const navButtonsHTML = items.length > 1 ? `
    <button class="promo-carousel-nav-btn prev" onclick="prevPromoSlide()" aria-label="Poster Sebelumnya">
      <i data-lucide="chevron-left" style="width: 20px; height: 20px;"></i>
    </button>
    <button class="promo-carousel-nav-btn next" onclick="nextPromoSlide()" aria-label="Poster Selanjutnya">
      <i data-lucide="chevron-right" style="width: 20px; height: 20px;"></i>
    </button>
  ` : '';

  container.innerHTML = `
    <div class="promo-slides-track" id="promo-slides-track">
      ${slidesHTML}
    </div>
    <div class="promo-carousel-dots" id="promo-carousel-dots">
      ${dotsHTML}
    </div>
    ${navButtonsHTML}
  `;

  if (window.lucide) lucide.createIcons();

  // Start Auto Slide (jika lebih dari 1 poster)
  if (items.length > 1) {
    promoCarouselTimer = setInterval(() => {
      nextPromoSlide();
    }, 5000);
  }
}

function updatePromoSlidePosition() {
  const track = document.getElementById('promo-slides-track');
  const dots = document.querySelectorAll('#promo-carousel-dots .promo-dot');
  if (!track) return;

  track.style.transform = `translateX(-${currentPromoSlideIndex * 100}%)`;

  dots.forEach((dot, idx) => {
    if (idx === currentPromoSlideIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

function goToPromoSlide(index) {
  const track = document.getElementById('promo-slides-track');
  if (!track) return;
  const totalSlides = track.children.length;
  currentPromoSlideIndex = (index + totalSlides) % totalSlides;
  updatePromoSlidePosition();
}

function nextPromoSlide() {
  const track = document.getElementById('promo-slides-track');
  if (!track) return;
  const totalSlides = track.children.length;
  currentPromoSlideIndex = (currentPromoSlideIndex + 1) % totalSlides;
  updatePromoSlidePosition();
}

function prevPromoSlide() {
  const track = document.getElementById('promo-slides-track');
  if (!track) return;
  const totalSlides = track.children.length;
  currentPromoSlideIndex = (currentPromoSlideIndex - 1 + totalSlides) % totalSlides;
  updatePromoSlidePosition();
}

// ==========================================================================
// MANAJEMEN KERANJANG BELANJA (CART)
// ==========================================================================

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('deks_cart')) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('deks_cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId, qty = 1) {
  const cart = getCart();
  const existing = cart.find(item => item.productId === productId);
  
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ productId, qty });
  }
  
  saveCart(cart);
  showToast('Produk ditambahkan ke keranjang!');
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) {
    const cart = getCart();
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? 'block' : 'none';
  }
  const mobileBadge = document.getElementById('mobile-cart-badge');
  if (mobileBadge) {
    const cart = getCart();
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    mobileBadge.textContent = totalQty;
    mobileBadge.style.display = totalQty > 0 ? 'inline-block' : 'none';
  }
}

// ==========================================================================
// INISIALISASI HAMBURGER MENU MOBILE DINAMIS
// ==========================================================================
function initMobileNav() {
  const navContainer = document.querySelector('.nav-container');
  if (!navContainer || document.getElementById('mobile-menu-toggle')) return;

  // 1. Tambah Tombol Hamburger ke Header
  const hamburgerBtn = document.createElement('button');
  hamburgerBtn.className = 'hamburger-btn';
  hamburgerBtn.id = 'mobile-menu-toggle';
  hamburgerBtn.setAttribute('aria-label', 'Buka Menu Mobile');
  hamburgerBtn.innerHTML = `<i data-lucide="menu"></i>`;
  navContainer.appendChild(hamburgerBtn);

  // 2. Buat Overlay dan Drawer di document.body jika belum ada
  if (!document.getElementById('mobile-nav-drawer')) {
    const overlay = document.createElement('div');
    overlay.className = 'mobile-nav-overlay';
    overlay.id = 'mobile-nav-overlay';

    const currentPath = window.location.pathname;

    const drawer = document.createElement('div');
    drawer.className = 'mobile-nav-drawer';
    drawer.id = 'mobile-nav-drawer';
    drawer.innerHTML = `
      <div class="mobile-nav-header">
        <div class="logo" style="font-size: 1.15rem;">
          <i data-lucide="shopping-bag" style="width: 20px; height: 20px;"></i>
          <span class="shop-name-text">${storeSettings ? storeSettings.shopName : 'Deksdigital'}</span>
        </div>
        <button class="mobile-nav-close" id="mobile-nav-close" aria-label="Tutup Menu">
          <i data-lucide="x" style="width: 18px; height: 18px;"></i>
        </button>
      </div>
      <div class="mobile-nav-links">
        <a href="/" class="mobile-nav-link ${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">
          <i data-lucide="home" style="width: 18px; height: 18px;"></i> Beranda
        </a>
        <a href="/kemitraan.html" class="mobile-nav-link ${currentPath.includes('kemitraan') ? 'active' : ''}">
          <i data-lucide="users" style="width: 18px; height: 18px;"></i> Kemitraan
        </a>
        <a href="/cart.html" class="mobile-nav-link ${currentPath.includes('cart') ? 'active' : ''}">
          <i data-lucide="shopping-cart" style="width: 18px; height: 18px;"></i> Keranjang 
          <span id="mobile-cart-badge" style="display:none; background:var(--accent-color); color:white; font-size:0.75rem; padding:2px 8px; border-radius:10px; margin-left:auto; font-weight:700;">0</span>
        </a>
      </div>
      <div class="mobile-nav-footer">
        <p>&copy; 2026 Deksdigital Store.</p>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    // 3. Event Listener Toggle Open/Close
    const closeBtn = drawer.querySelector('#mobile-nav-close');

    function openMobileMenu() {
      overlay.style.display = 'block';
      drawer.style.display = 'flex';
      setTimeout(() => {
        overlay.classList.add('open');
        drawer.classList.add('open');
      }, 10);
      document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
      overlay.classList.remove('open');
      drawer.classList.remove('open');
      setTimeout(() => {
        overlay.style.display = 'none';
        drawer.style.display = 'none';
        document.body.style.overflow = '';
      }, 350);
    }

    hamburgerBtn.addEventListener('click', openMobileMenu);
    closeBtn.addEventListener('click', closeMobileMenu);
    overlay.addEventListener('click', closeMobileMenu);
  }

  if (window.lucide) lucide.createIcons();
}

// Toast Notifikasi Sederhana
function showToast(message) {
  let toast = document.getElementById('store-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'store-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '110px';
    toast.style.left = '30px';
    toast.style.backgroundColor = '#1e293b';
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '30px';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
    toast.style.zIndex = '9999';
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 3000);
}

// Format Angka ke Rupiah
function formatRupiah(number) {
  return 'Rp ' + parseInt(number).toLocaleString('id-ID');
}

// ==========================================================================
// AI CHATBOT ASISTEN BELANJA
// ==========================================================================

let chatHistory = [];

function initAIChat() {
  const chatToggle = document.getElementById('ai-chat-toggle');
  const chatBox = document.getElementById('ai-chat-box');
  const chatClose = document.getElementById('ai-chat-close');
  const sendBtn = document.getElementById('ai-send-btn');
  const chatInput = document.getElementById('ai-chat-input');
  
  if (!chatToggle || !chatBox) return;

  // Toggle Tampilkan Chat
  chatToggle.addEventListener('click', () => {
    const isVisible = chatBox.style.display === 'flex';
    chatBox.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      chatInput.focus();
      // Kirim salam pembuka bot jika pesan masih kosong
      const msgsContainer = document.getElementById('ai-messages');
      if (msgsContainer.children.length === 0) {
        appendChatMessage('bot', `Halo! Selamat datang di Deksdigital Store. 💖\nAda yang bisa saya bantu hari ini? Anda bisa menanyakan produk, harga, stok, atau tata cara pemesanan.`);
      }
    }
  });

  // Tutup Chat
  chatClose.addEventListener('click', () => {
    chatBox.style.display = 'none';
  });

  // Kirim Pesan via Tombol Klik
  sendBtn.addEventListener('click', () => {
    sendUserMessage();
  });

  // Kirim Pesan via Enter
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendUserMessage();
    }
  });
}

// Mengirim Pesan Pembeli ke Backend AI Gemini
async function sendUserMessage() {
  const input = document.getElementById('ai-chat-input');
  const text = input.value.trim();
  if (!text) return;

  // Tampilkan pesan user di chat widget
  appendChatMessage('user', text);
  input.value = '';

  // Tambahkan loading bubble dari AI
  const loadingId = appendChatMessage('bot', 'Mengetik...', true);

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: chatHistory
      })
    });
    const data = await res.json();
    
    // Hapus bubble loading
    removeLoadingBubble(loadingId);
    
    // Tampilkan balasan AI
    appendChatMessage('bot', data.reply);
    
    // Simpan ke riwayat lokal chat
    chatHistory.push({ sender: 'user', text: text });
    chatHistory.push({ sender: 'bot', text: data.reply });
  } catch (err) {
    removeLoadingBubble(loadingId);
    appendChatMessage('bot', 'Maaf, saya sedang mengalami kendala koneksi. Silakan coba kembali nanti.');
  }
}

// Menampilkan balon chat baru di widget obrolan
function appendChatMessage(sender, text, isLoading = false) {
  const msgsContainer = document.getElementById('ai-messages');
  if (!msgsContainer) return;

  const bubble = document.createElement('div');
  const uniqueId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  bubble.id = uniqueId;
  bubble.className = `chat-message ${sender}`;
  
  if (isLoading) {
    bubble.classList.add('loading-msg');
  }

  // Konversi teks markdown sederhana (\n dan *) ke HTML untuk bot
  if (sender === 'bot') {
    bubble.innerHTML = parseSimpleMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  msgsContainer.appendChild(bubble);
  msgsContainer.scrollTop = msgsContainer.scrollHeight;

  return uniqueId;
}

function removeLoadingBubble(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// Parser Markdown sederhana untuk teks bot
function parseSimpleMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Konversi list bullet point (* teks)
  html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
  // Bungkus li ke dalam ul
  html = html.replace(/(<li>.+<\/li>)/s, '<ul>$1</ul>');
  
  // Konversi teks tebal (**teks**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Konversi ganti baris (\n)
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Muat data saat halaman dibuka
document.addEventListener('DOMContentLoaded', initStore);
