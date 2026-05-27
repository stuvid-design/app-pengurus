/* ============================================================
   app.supabase.js — Core Database & Authentication
   Portal Pengurus Madrasah Diniyah DQLM

   SOP V2: File ini HANYA mengurus koneksi client Supabase, 
   Session/Auth Listener, Role-Based Access Control (RBAC), 
   dan helper Login/Logout. TIDAK ADA LOGIKA CRUD MODUL DISINI.
   ============================================================ */

'use strict';

/* ── KONFIGURASI ─────────────────────────────────────────────── */
const SUPABASE_URL    = 'https://vgoewipujbmjorpizcee.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnb2V3aXB1amJtam9ycGl6Y2VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODY3NzQsImV4cCI6MjA5NTQ2Mjc3NH0.4TmCCx4Hzr6FSFVIOI9WAf89ugO9GFlhXeKM7vzeK7I';

const ROLE_ACCESS = {
  kepala_madrasah: 'all',
  bendahara:       ['dashboard','kas-madrasah','syahriah-spp','infaq-donasi',
                    'pengeluaran','tunggakan','laporan-keuangan','pengaturan'],
  admin_data:      ['dashboard','data-santri','kelas-tingkatan','data-wali',
                    'riwayat-mutasi','absensi-santri','absensi-ustadz',
                    'rekap-absensi','izin-sakit','jadwal-mengajar',
                    'mata-pelajaran','nilai-santri','hafalan','ujian',
                    'raport','kenaikan-tingkat','data-ustadz',
                    'jadwal-mengajar-ustadz','pengumuman','pengaturan'],
  pengurus:        ['dashboard','data-santri','absensi-santri',
                    'rekap-absensi','pengumuman','pengaturan'],
};

/* ── LOAD SUPABASE CDN ───────────────────────────────────────── */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl:true,
  }
});

window.supabase = sb; // Expose agar modul lain bisa pakai

/* ── UTILITY AUTH ────────────────────────────────────────────── */
function _setLoginLoading(on) {
  const btn = document.getElementById('btn-login');
  if (btn) btn.classList.toggle('loading', on);
}

function _setLoginError(msg) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

function _clearLoginError() { _setLoginError(''); }

async function _fetchProfile(userId) {
  const { data, error } = await sb
    .from('profiles')
    .select('nama_lengkap, role, aktif')
    .eq('id', userId)
    .maybeSingle();
  if (error) console.warn('[Supabase] Gagal ambil profil:', error.message);
  return data;
}

/* ── AUTH LISTENER & INITIALIZATION ──────────────────────────── */
async function handleUserAccess(user) {
  try {
    const profile = await _fetchProfile(user.id);

    if (profile && profile.aktif === false) {
      await sb.auth.signOut();
      triggerShowLogin('Akun Anda dinonaktifkan admin.');
      return;
    }

    const userData = {
      uid:         user.id,
      email:       user.email,
      displayName: user.user_metadata?.full_name || user.email,
      namaLengkap: profile?.nama_lengkap || user.email,
      role:        profile?.role || 'pengurus',
    };

    window.currentUser = userData;

    if (typeof _applyRBAC === 'function') _applyRBAC(userData.role);
    
    // Panggil fungsi Global Load Santri jika modulnya sudah siap
    if (typeof window._loadSantriGlobal === 'function') {
      window._loadSantriGlobal().catch(console.warn);
    }

    const loadingEl = document.getElementById('auth-loading');
    const loginEl   = document.getElementById('page-login');
    const appShellEl= document.getElementById('app-shell');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (loginEl) loginEl.style.display = 'none';
    if (appShellEl) appShellEl.classList.remove('hidden');

    if (typeof window.showApp === 'function') window.showApp(userData);

  } catch (err) {
    console.error("Gagal memproses akses user:", err);
    triggerShowLogin('Terjadi kesalahan sistem.');
  }
}

function triggerShowLogin(errMsg = '') {
  const loadingEl = document.getElementById('auth-loading');
  const loginEl   = document.getElementById('page-login');
  const appShellEl= document.getElementById('app-shell');
  
  if (loadingEl) loadingEl.style.display = 'none';
  if (appShellEl) appShellEl.classList.add('hidden');
  if (loginEl) loginEl.style.display = 'flex';
  
  if (errMsg) {
    const errEl = document.getElementById('login-error');
    if (errEl) { errEl.textContent = errMsg; errEl.classList.remove('hidden'); }
  }
  if (typeof window.showLogin === 'function') window.showLogin(errMsg);
}

sb.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) handleUserAccess(session.user);
  else triggerShowLogin();
});

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) handleUserAccess(session.user);
  else if (event === 'SIGNED_OUT') { window.currentUser = null; triggerShowLogin(); }
});

/* ── LOGIN & LOGOUT ACTIONS ──────────────────────────────────── */
async function _doLogin(email, password) {
  if (!email || !password) { _setLoginError('Email dan password wajib diisi.'); return; }
  _clearLoginError();
  _setLoginLoading(true);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  _setLoginLoading(false);
  if (error) _setLoginError(_translateAuthError(error.message));
}

async function _doLogout() {
  window.confirmDelete('Anda akan keluar dari Portal Pengurus. Sesi akan diakhiri.', async () => {
    const { error } = await sb.auth.signOut();
    if (error) window.showToast('error', 'Gagal Logout', error.message);
  });
  
  const okBtn = document.getElementById('modal-confirm-ok');
  if (okBtn) {
    okBtn.innerHTML = '<i class="ph-bold ph-sign-out"></i> Ya, Keluar';
    okBtn.className = 'btn btn-primary';
  }
}

async function _doForgotPassword() {
  const emailEl = document.getElementById('login-email');
  const email   = emailEl?.value.trim();
  if (!email) { _setLoginError('Masukkan email Anda terlebih dahulu.'); return; }
  
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) _setLoginError(_translateAuthError(error.message));
  else window.showToast('success', 'Email Terkirim', `Link reset password dikirim ke ${email}.`);
}

function _translateAuthError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('credentials') || m.includes('password')) return 'Email atau password salah.';
  if (m.includes('not confirmed')) return 'Email belum dikonfirmasi.';
  if (m.includes('not found')) return 'Akun tidak ditemukan.';
  return msg || 'Terjadi kesalahan.';
}

/* ── WIRE LOGIN FORM ─────────────────────────────────────────── */
document.getElementById('btn-login')?.addEventListener('click', () => {
  _doLogin(document.getElementById('login-email')?.value.trim(), document.getElementById('login-password')?.value);
});
document.getElementById('login-password')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') _doLogin(document.getElementById('login-email')?.value.trim(), e.target.value);
});
document.getElementById('btn-forgot-pw')?.addEventListener('click', _doForgotPassword);
window.addEventListener('madin:logout', _doLogout);

/* ── RBAC ────────────────────────────────────────────────────── */
function _applyRBAC(role) {
  const allowed = ROLE_ACCESS[role];
  if (allowed === 'all') {
    document.querySelectorAll('[data-role-hide]').forEach(el => el.style.display = '');
    return;
  }
  document.querySelectorAll('[data-role-hide]').forEach(el => {
    if ((el.dataset.roleHide?.split(',') || []).includes(role)) el.style.display = 'none';
  });
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    if (!allowed.includes(link.dataset.page)) link.closest('.nav-item')?.style.setProperty('display', 'none');
  });
  
  const _originalNavigate = window.navigateTo;
  window.navigateTo = function(pageId) {
    const role  = window.currentUser?.role || 'pengurus';
    const perms = ROLE_ACCESS[role];
    if (perms !== 'all' && !perms.includes(pageId)) {
      window.showToast('warning', 'Akses Ditolak', 'Anda tidak memiliki izin.'); return;
    }
    _originalNavigate(pageId);
  };
}

/* ── UPDATE PASSWORD & PROFIL ────────────────────────────────── */
window.updatePassword = async function() {
  const newPw  = document.getElementById('setting-new-password')?.value;
  const confPw = document.getElementById('setting-confirm-password')?.value;
  if (!newPw || newPw !== confPw) { window.showToast('error','Gagal','Password tidak valid/cocok.'); return; }
  const { error } = await sb.auth.updateUser({ password: newPw });
  if (error) window.showToast('error', 'Gagal', error.message);
  else window.showToast('success', 'Sukses', 'Password diperbarui.');
};

window.updateProfile = async function() {
  const nama = document.getElementById('setting-nama')?.value.trim();
  const uid = window.currentUser?.uid;
  if (!nama || !uid) return;
  const { error } = await sb.from('profiles').update({ nama_lengkap: nama }).eq('id', uid);
  if (!error) window.showToast('success','Sukses','Profil diperbarui.');
};

/* ── STATUS KONEKSI ──────────────────────────────────────────── */
function _updateConnStatus() {
  const dot = document.querySelector('.conn-dot');
  if (!dot) return;
  if (navigator.onLine) { dot.classList.remove('offline'); dot.title = 'Online'; } 
  else { dot.classList.add('offline'); window.showToast('warning','Offline','Koneksi terputus.'); }
}
window.addEventListener('online',  _updateConnStatus);
window.addEventListener('offline', _updateConnStatus);
_updateConnStatus();

console.log('[Madin] Supabase Auth & Core loaded ✓ (SOP V2 Applied)');
