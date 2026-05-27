/* ============================================================
   app.js — Portal Pengurus Madrasah Diniyah DQLM
   Tahap 2A: Sidebar Toggle, Accordion, SPA Navigation,
             Auth Shell, Toast & Modal Helpers
   ============================================================ */

'use strict';

/* ── SIDEBAR TOGGLE ──────────────────────────────────────────── */
const appShell       = document.getElementById('app-shell');
const sidebarEl      = document.getElementById('sidebar');
const sidebarBackdrop= document.getElementById('sidebar-backdrop');
const btnToggle      = document.getElementById('sidebar-toggle');

let isMobile = window.innerWidth <= 1024;

function updateMobileState() {
  isMobile = window.innerWidth <= 1024;
}

if (btnToggle) {
  btnToggle.addEventListener('click', () => {
    if (isMobile) {
      sidebarEl.classList.toggle('mobile-open');
      sidebarBackdrop.classList.toggle('show');
    } else {
      appShell.classList.toggle('collapsed');
    }
  });
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener('click', () => {
    sidebarEl.classList.remove('mobile-open');
    sidebarBackdrop.classList.remove('show');
  });
}

window.addEventListener('resize', () => {
  updateMobileState();
  if (!isMobile) {
    sidebarEl.classList.remove('mobile-open');
    sidebarBackdrop.classList.remove('show');
  }
});

/* ── SIDEBAR SUB-MENU ACCORDION ─────────────────────────────── */
document.querySelectorAll('.nav-link[data-toggle]').forEach(link => {
  link.addEventListener('click', () => {
    const grpId  = link.dataset.toggle;
    const grpEl  = document.getElementById(grpId);
    if (!grpEl) return;
    const isOpen = grpEl.classList.contains('open');

    // Tutup semua group yang terbuka
    document.querySelectorAll('.nav-item.open').forEach(el => el.classList.remove('open'));

    // Buka group yang diklik (jika sebelumnya tertutup)
    if (!isOpen) grpEl.classList.add('open');
  });
});

/* ── SPA NAVIGATION ──────────────────────────────────────────── */
/**
 * navigateTo(pageId)
 * Menampilkan view yang sesuai, memperbarui nav-link active,
 * menutup sidebar mobile, lalu memfire event 'madin:navigate'
 * agar modul lain (Charts, Firebase, dll.) bisa bereaksi.
 */
function navigateTo(pageId) {
  // Nonaktifkan semua view & nav link
  document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  // Aktifkan view target (fallback ke dashboard)
  const view = document.getElementById('view-' + pageId);
  if (view) {
    view.classList.add('active');
  } else {
    const dash = document.getElementById('view-dashboard');
    if (dash) dash.classList.add('active');
    pageId = 'dashboard';
  }

  // Highlight nav link yang aktif
  const navLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (navLink) {
    navLink.classList.add('active');
    // Buka parent submenu otomatis jika link ada di dalam submenu
    const parentUl = navLink.closest('.nav-submenu');
    if (parentUl) {
      const parentLi = parentUl.closest('.nav-item');
      if (parentLi) parentLi.classList.add('open');
    }
  }

  // Tutup sidebar mobile setelah navigasi
  if (isMobile) {
    sidebarEl.classList.remove('mobile-open');
    sidebarBackdrop.classList.remove('show');
  }

  // Update judul tab browser
  const titleEl = document.querySelector(`.nav-link[data-page="${pageId}"] .nav-text`);
  if (titleEl) {
    document.title = titleEl.textContent.trim() + ' — Portal Pengurus Madin';
  }

  // Scroll main content ke atas
  const mainContent = document.getElementById('main-content');
  if (mainContent) mainContent.scrollTop = 0;

  // Fire event agar modul lain bisa bereaksi (Charts, Firebase, dll.)
  window.dispatchEvent(new CustomEvent('madin:navigate', { detail: { page: pageId } }));
}

// Pasang click handler pada semua nav link yang punya data-page
document.querySelectorAll('.nav-link[data-page]').forEach(link => {
  link.addEventListener('click', () => navigateTo(link.dataset.page));
});

// ── ALIAS: halaman yang sudah tercakup di view lain ──────────
const PAGE_ALIAS = {
  'syahriah-spp':           'kas-madrasah',
  'jadwal-mengajar-ustadz': 'data-ustadz',
  'honor-ustadz':           'data-ustadz',
  'rekap-absensi':          'absensi-santri',
};

// Patch navigateTo agar alias diredirect
const _navBase = window.navigateTo;
window.navigateTo = function(pageId) {
  _navBase(PAGE_ALIAS[pageId] || pageId);
};

// Expose ke global agar bisa dipanggil dari modul lain
window.navigateTo = navigateTo;

/* ── TOPBAR & DASHBOARD DATE ─────────────────────────────────── */
function updateDate() {
  const now  = new Date();
  const greg = now.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Topbar
  const tbGreg  = document.getElementById('topbar-date-greg');
  const tbHijri = document.getElementById('topbar-date-hijri');
  if (tbGreg)  tbGreg.textContent  = greg;

  // Dashboard header
  const dhGreg  = document.getElementById('dash-date-greg');
  const dhHijri = document.getElementById('dash-date-hijri');
  if (dhGreg)  dhGreg.textContent  = greg;

  // Hijri approximation via Intl API
  try {
    const hijri = now.toLocaleDateString('ar-SA-u-ca-islamic', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    if (tbHijri) tbHijri.textContent = hijri;
    if (dhHijri) dhHijri.textContent = hijri;
  } catch {
    if (tbHijri) tbHijri.textContent = '';
    if (dhHijri) dhHijri.textContent = '';
  }
}

updateDate();
setInterval(updateDate, 60_000);

// Sinkronisasi nama user ke greeting dashboard saat navigate
window.addEventListener('madin:navigate', e => {
  if (e.detail.page !== 'dashboard') return;
  updateDate();
  const sn = document.getElementById('sidebar-user-name');
  const un = document.getElementById('dash-username');
  if (sn && un) un.textContent = sn.textContent.split(' ')[0];
});

/* ── MODAL HELPERS ───────────────────────────────────────────── */
/**
 * openModal(id)  — tambahkan class 'open' ke overlay modal
 * closeModal(id) — hapus class 'open'
 * Keduanya di-expose ke window agar bisa dipakai dari HTML onclick=""
 */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
}

window.openModal  = openModal;
window.closeModal = closeModal;

// Tutup modal saat klik area gelap (overlay)
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Pasang tombol X / tutup di semua modal
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const overlay = btn.closest('.modal-overlay');
    if (overlay) closeModal(overlay.id);
  });
});

// Tombol Batal / btn-outline di dalam modal
document.querySelectorAll('.modal-footer .btn-outline').forEach(btn => {
  btn.addEventListener('click', () => {
    const overlay = btn.closest('.modal-overlay');
    if (overlay) closeModal(overlay.id);
  });
});

// Tombol dengan atribut data-close-modal
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
});

/* ── CONFIRM DELETE HELPER ───────────────────────────────────── */
let _confirmCallback = null;

function confirmDelete(msg, onConfirm) {
  const msgEl = document.getElementById('modal-confirm-msg');
  if (msgEl) msgEl.textContent = msg || 'Data yang dihapus tidak dapat dipulihkan.';
  _confirmCallback = onConfirm;
  openModal('modal-confirm');
}

const btnConfirmOk     = document.getElementById('modal-confirm-ok');
const btnConfirmCancel = document.getElementById('modal-confirm-cancel');

if (btnConfirmOk) {
  btnConfirmOk.addEventListener('click', () => {
    if (typeof _confirmCallback === 'function') _confirmCallback();
    closeModal('modal-confirm');
    _confirmCallback = null;
  });
}
if (btnConfirmCancel) {
  btnConfirmCancel.addEventListener('click', () => closeModal('modal-confirm'));
}

window.confirmDelete = confirmDelete;

/* ── TOAST NOTIFICATIONS ─────────────────────────────────────── */
/**
 * showToast(type, title, msg, duration)
 * type: 'success' | 'error' | 'warning' | 'info'
 */
function showToast(type = 'success', title = '', msg = '', duration = 4000) {
  const icons = {
    success: 'ph-check-circle',
    error:   'ph-x-circle',
    warning: 'ph-warning-circle',
    info:    'ph-info',
  };
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="ph-bold ${icons[type] || icons.info}"></i>
    </div>
    <div>
      <p class="toast-title">${title}</p>
      <p class="toast-msg">${msg}</p>
    </div>`;
  container.appendChild(toast);

  // Trigger animasi slide-in
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

  // Auto dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

window.showToast = showToast;

/* ── AUTH SHELL HELPERS ──────────────────────────────────────── */
/**
 * showApp(profile)
 * Dipanggil oleh modul Firebase setelah login berhasil.
 * profile: { displayName, email, role, namaLengkap }
 */
window.showApp = function(profile) {
  document.getElementById('page-login').style.display  = 'none';
  document.getElementById('auth-loading').style.display= 'none';
  appShell.classList.remove('hidden');

  const displayName = profile.namaLengkap || profile.displayName || profile.email || 'Pengurus';
  const initials    = displayName.split(' ')
                        .filter(Boolean).slice(0, 2)
                        .map(w => w[0]).join('').toUpperCase() || 'PG';
  const roleMap = {
    kepala_madrasah: 'Kepala Madrasah',
    bendahara:       'Bendahara',
    admin_data:      'Admin Data',
    pengurus:        'Pengurus',
  };
  const roleLabel = roleMap[profile.role] || 'Pengurus';

  // Isi elemen UI dengan data profil
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sidebar-avatar-initials', initials);
  set('topbar-avatar-initials',  initials);
  set('sidebar-user-name',       displayName);
  set('sidebar-user-role',       roleLabel);
  set('topbar-user-name',        displayName);
  set('topbar-user-role',        roleLabel);
  set('dash-username',           displayName.split(' ')[0]);

  navigateTo('dashboard');
};

/**
 * showLogin(errMsg)
 * Dipanggil saat logout atau sesi tidak ditemukan.
 */
window.showLogin = function(errMsg) {
  document.getElementById('page-login').style.display  = 'flex';
  document.getElementById('auth-loading').style.display= 'none';
  appShell.classList.add('hidden');

  if (errMsg) {
    const el = document.getElementById('login-error');
    if (el) {
      el.textContent = errMsg;
      el.classList.remove('hidden');
    }
  }
};

/* ── LOGIN UI HELPERS ────────────────────────────────────────── */
// Toggle show/hide password
const btnTogglePw = document.getElementById('btn-toggle-pw');
if (btnTogglePw) {
  btnTogglePw.addEventListener('click', () => {
    const pwInput  = document.getElementById('login-password');
    const eyeIcon  = document.getElementById('pw-eye-icon');
    if (!pwInput) return;
    const isHidden = pwInput.type === 'password';
    pwInput.type   = isHidden ? 'text' : 'password';
    if (eyeIcon) {
      eyeIcon.className = isHidden ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye';
    }
  });
}

// Logout button
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    // Event ini akan ditangkap oleh modul Firebase (app.firebase.js)
    window.dispatchEvent(new CustomEvent('madin:logout'));
  });
}

// ── MODE DEMO (hapus ini setelah Firebase aktif) ──
window.showApp({
  displayName: 'Admin Demo',
  namaLengkap: 'Admin Utama',
  email:       'admin@madin.id',
  role:        'kepala_madrasah',
});
