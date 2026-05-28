/* ============================================================
   app.data-santri.js — Modul Data Santri
   Portal Pengurus Madrasah Diniyah DQLM

   SOP V2: Terintegrasi penuh dengan Supabase. 
   Menangani Fetch, Insert, Update, Delete, Realtime Sync,
   serta UI DOM rendering (Tabel & Modal).
   ============================================================ */

'use strict';

/* ── KONSTANTA & STATE ───────────────────────────────────────── */
const KELAS_LABEL = {
  '1': 'Kelas 1 (Awwaliyah)', '2': 'Kelas 2 (Awwaliyah)',
  '3': 'Kelas 3 (Awwaliyah)', '4': 'Kelas 4 (Awwaliyah)',
};

const AVATAR_COLORS = [
  ['rgba(26,107,60,.13)', '#1a6b3c'], ['rgba(239,68,68,.11)', '#dc2626'],
  ['rgba(245,158,11,.12)','#b45309'], ['rgba(59,130,246,.12)','#1d4ed8'],
  ['rgba(139,92,246,.12)','#7c3aed'], ['rgba(20,184,166,.12)','#0f766e'],
];

const PAGE_SIZE = 10;

const _santriState = {
  editDocId: null,
  viewDocId: null,
  currentPage: 1
};

window.santriCache = []; // Global Cache agar dipakai modul Absensi & Nilai
let _isSantriWired = false; // Kunci Anti-Hang

/* ── HELPER DATA & UI ────────────────────────────────────────── */
function _ini(name = '') { return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'; }
function _color(seed = '') { return AVATAR_COLORS[seed.charCodeAt(seed.length - 1) % AVATAR_COLORS.length] || AVATAR_COLORS[0]; }
function _tgl(iso) { try { return iso ? new Date(iso).toLocaleDateString('id-ID', { month:'short', year:'numeric' }) : '—'; } catch { return iso; } }
function _x(str = '') { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

function _badge(status) {
  const map = { Aktif:'success', Cuti:'warning', Lulus:'info', 'Non-Aktif':'danger' };
  return `<span class="badge ${map[status] || 'neutral'}"><span class="badge-dot"></span>${status || '—'}</span>`;
}

/* ── MAPPING SUPABASE ↔ APP ──────────────────────────────────── */
function _dbToApp(row) {
  if (!row) return null;
  return {
    _id:        row.id,
    nis:        row.nis || '',
    nama:       row.nama || '',
    kelas:      row.kelas || '',
    jk:         row.jk || 'L',
    status:     row.status || 'Aktif',
    ttlTempat:  row.ttl_tempat || '',
    ttlTgl:     row.ttl_tgl || '',
    alamat:     row.alamat || '',
    tglMasuk:   row.tgl_masuk || '',
    nisn:       row.nisn || '',
    waliNama:   row.wali_nama || '',
    waliHub:    row.wali_hub || '',
    waliHp:     row.wali_hp || '',
    waliKerja:  row.wali_kerja || '',
    catatan:    row.catatan || '',
    kelasLabel: KELAS_LABEL[row.kelas] || (row.kelas ? `Kelas ${row.kelas}` : '—'),
  };
}

function _appToDB(s) {
  return {
    nis: s.nis, nama: s.nama, kelas: s.kelas, jk: s.jk, status: s.status || 'Aktif',
    ttl_tempat: s.ttlTempat || null, ttl_tgl: s.ttlTgl || null, alamat: s.alamat || null,
    tgl_masuk: s.tglMasuk || null, nisn: s.nisn || null, wali_nama: s.waliNama || null,
    wali_hub: s.waliHub || null, wali_hp: s.waliHp || null, wali_kerja: s.waliKerja || null, catatan: s.catatan || null,
  };
}

/* ── SUPABASE FETCH & REALTIME ───────────────────────────────── */
// Terekspos ke window agar dipanggil oleh app.supabase.js saat sukses Login
window._loadSantriGlobal = async function() {
  if (!window.supabase) return;
  const { data, error } = await window.supabase.from('santri').select('*').order('nama', { ascending: true });
  if (error) { console.error('Load santri error:', error.message); return; }
  
  window.santriCache = (data || []).map(_dbToApp);
  console.log(`[Supabase] ${window.santriCache.length} Santri dimuat ✓`);
  
  if (document.getElementById('view-data-santri')?.classList.contains('active')) { _render(); _syncTabs(); }
};

function _initRealtimeSantri() {
  if (!window.supabase) return;
  window.supabase.channel('realtime-santri')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'santri' }, payload => {
      const { eventType, new: newRow, old: oldRow } = payload;
      if (eventType === 'INSERT') {
        if (!window.santriCache.some(x => x._id === newRow.id)) window.santriCache.unshift(_dbToApp(newRow));
      } else if (eventType === 'UPDATE') {
        const idx = window.santriCache.findIndex(x => x._id === newRow.id);
        if (idx !== -1) window.santriCache[idx] = _dbToApp(newRow);
      } else if (eventType === 'DELETE') {
        window.santriCache = window.santriCache.filter(x => x._id !== oldRow.id);
      }
      if (document.getElementById('view-data-santri')?.classList.contains('active')) { _render(); _syncTabs(); }
    }).subscribe();
}

/* ── FILTER & RENDER TABEL ───────────────────────────────────── */
function _filtered() {
  const q  = (document.getElementById('santri-search')?.value || '').toLowerCase().trim();
  const kl = document.getElementById('santri-filter-kelas')?.value || '';
  const st = document.getElementById('santri-filter-status')?.value || '';
  const jk = document.getElementById('santri-filter-jk')?.value || '';

  return window.santriCache.filter(s =>
    (!q || s.nama?.toLowerCase().includes(q) || s.nis?.includes(q) || s.waliNama?.toLowerCase().includes(q)) &&
    (!kl || s.kelas === kl) && (!st || s.status === st) && (!jk || s.jk === jk)
  );
}

function _render() {
  const data = _filtered();
  const total = data.length;
  const start = (_santriState.currentPage - 1) * PAGE_SIZE;
  const page  = data.slice(start, start + PAGE_SIZE);
  const tbody = document.getElementById('santri-tbody');
  
  if (!tbody) return;
  document.getElementById('santri-count-shown') && (document.getElementById('santri-count-shown').textContent = total);
  document.getElementById('santri-count-total') && (document.getElementById('santri-count-total').textContent = window.santriCache.length);

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:52px 0;color:var(--clr-text-muted);">Tidak ada data santri.</td></tr>`;
    _renderPager(total); return;
  }

  tbody.innerHTML = page.map((s, i) => {
    const [bg, fg] = _color(s.nis || s._id);
    return `
      <tr>
        <td style="color:var(--clr-text-muted);font-size:12px;width:36px;">${start + i + 1}</td>
        <td>
          <div class="santri-name-cell">
            <div class="santri-avatar" style="background:${bg};color:${fg};">${_ini(s.nama)}</div>
            <div class="santri-name-info"><strong>${_x(s.nama)}</strong><span>Masuk: ${_tgl(s.tglMasuk)}</span></div>
          </div>
        </td>
        <td><code style="font-size:12.5px;background:rgba(26,107,60,.07);padding:2px 7px;border-radius:5px;">${_x(s.nis)}</code></td>
        <td><span class="badge neutral"><span class="badge-dot"></span>${_x(s.kelasLabel)}</span></td>
        <td style="font-size:13px;">${s.jk === 'P' ? 'Perempuan' : 'Laki-laki'}</td>
        <td style="font-size:13px;">${_x(s.waliNama)} <span style="color:var(--clr-text-muted);font-size:11px;">(${_x(s.waliHub)})</span></td>
        <td>${_badge(s.status)}</td>
        <td>
          <div class="tbl-actions" style="justify-content:center;">
            <button class="btn-tbl view" data-st-view="${s._id}"><i class="ph-bold ph-eye"></i></button>
            <button class="btn-tbl edit" data-st-edit="${s._id}"><i class="ph-bold ph-pencil-simple"></i></button>
            <button class="btn-tbl delete" data-st-del="${s._id}" data-nama="${_x(s.nama)}"><i class="ph-bold ph-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');

  _renderPager(total);
}

function _renderPager(total) {
  const pages = document.querySelector('.pagination-pages');
  const info  = document.querySelector('.pagination-info');
  if (!pages || !info) return;

  const tp = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const s  = Math.min((_santriState.currentPage - 1) * PAGE_SIZE + 1, total || 1);
  const e  = Math.min(_santriState.currentPage * PAGE_SIZE, total);
  info.textContent = total ? `Menampilkan ${s}–${e} dari ${total} santri` : '';

  let h = `<button class="page-btn" id="pg-prev" ${_santriState.currentPage === 1 ? 'disabled' : ''}><i class="ph-bold ph-caret-left"></i></button>`;
  for (let p = 1; p <= tp; p++) {
    h += `<button class="page-btn${p === _santriState.currentPage ? ' active' : ''}" data-pg="${p}">${p}</button>`;
  }
  h += `<button class="page-btn" id="pg-next" ${_santriState.currentPage === tp ? 'disabled' : ''}><i class="ph-bold ph-caret-right"></i></button>`;
  
  pages.innerHTML = h;
  pages.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => { _santriState.currentPage = +b.dataset.pg; _render(); }));
  pages.querySelector('#pg-prev')?.addEventListener('click', () => { _santriState.currentPage--; _render(); });
  pages.querySelector('#pg-next')?.addEventListener('click', () => { _santriState.currentPage++; _render(); });
}

function _syncTabs() {
  const aktif = window.santriCache.filter(s => s.status === 'Aktif').length;
  const cuti = window.santriCache.filter(s => s.status === 'Cuti').length;
  const lulus = window.santriCache.filter(s => s.status === 'Lulus').length;
  const nonAktif = window.santriCache.filter(s => s.status === 'Non-Aktif').length;

  document.querySelectorAll('#view-data-santri .page-tab').forEach(t => {
    const map = { 
      all: `Semua Santri (${window.santriCache.length})`, 
      aktif: `Aktif (${aktif})`,
      cuti: `Cuti (${cuti})`,
      lulus: `Lulus (${lulus})`,
      nonaktif: `Non-Aktif (${nonAktif})`
    };
    if (map[t.dataset.subtab]) t.textContent = map[t.dataset.subtab];
  });

  if (document.getElementById('dash-total-santri')) {
    document.getElementById('dash-total-santri').textContent = aktif;
  }
}
/* ── MODAL & CRUD ACTIONS ────────────────────────────────────── */
function _openTambahSantri() {
  _santriState.editDocId = null;
  document.getElementById('form-santri')?.reset();
  document.getElementById('modal-santri-title').textContent = 'Tambah Data Santri';
  document.getElementById('btn-submit-santri-label').textContent = 'Simpan Data';
  const tglEl = document.getElementById('santri-tgl-masuk');
  if (tglEl) tglEl.value = new Date().toISOString().slice(0, 10);
  if(window.openModal) window.openModal('modal-santri');
}

function _editSantri(id) {
  const s = window.santriCache.find(x => x._id === id);
  if (!s) return;
  _santriState.editDocId = id;
  document.getElementById('modal-santri-title').textContent = 'Edit Data Santri';
  document.getElementById('btn-submit-santri-label').textContent = 'Update Data';

const f = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val || ''; };
  
  f('santri-nama', s.nama); 
  f('santri-nis', s.nis); 
  f('santri-kelas', s.kelas); 
  f('santri-status', s.status);
  f('santri-alamat', s.alamat);
  f('santri-tgl-masuk', s.tglMasuk);
  f('santri-wali-nama', s.waliNama); 
  f('santri-wali-hub', s.waliHub);
  f('santri-ttl-tempat', s.ttlTempat);
  f('santri-ttl-tgl', s.ttlTgl);
  
  // 👇 TAMBAHKAN 4 BARIS INI (wali-hp sebenarnya sudah ada di kode awal Anda) 👇
  f('santri-nisn', s.nisn);
  f('santri-wali-hp', s.waliHp);
  f('santri-wali-kerja', s.waliKerja);
  f('santri-catatan', s.catatan);
  // (Isi field lainnya yang diperlukan...)

  if(window.openModal) window.openModal('modal-santri');
}

function _viewSantri(id) {
  const s = window.santriCache.find(x => x._id === id);
  if (!s) return;
  _santriState.viewDocId = id;

  const set = (eid, val) => { const el = document.getElementById(eid); if (el) el.textContent = val || '—'; };
  
  // 1. Data Utama & Akademik
  set('detail-nama', s.nama); 
  set('detail-nis', s.nis); 
  set('detail-nisn', s.nisn);
  set('detail-kelas', s.kelasLabel);
  
  // 2. TTL, Jenis Kelamin, Alamat
  // Gabungkan Tempat dan Tanggal Lahir (menggunakan fungsi _tgl bawaan Anda)
  const ttl = (s.ttlTempat || s.ttlTgl) ? `${s.ttlTempat || '—'}, ${_tgl(s.ttlTgl) || '—'}` : '—';
  set('detail-ttl', ttl);
  
  set('detail-jk', s.jk === 'P' ? 'Perempuan' : (s.jk === 'L' ? 'Laki-laki' : '—'));
  set('detail-alamat', s.alamat);
  set('detail-tgl-masuk', _tgl(s.tglMasuk));
  
  // 3. Data Wali & Catatan
  set('detail-wali-nama', `${s.waliNama || '—'} (${s.waliHub || '—'})`); 
  set('detail-wali-hp', s.waliHp);
  set('detail-catatan', s.catatan);

  // 4. Update Avatar (Warna & Inisial)
  const avatarEl = document.getElementById('detail-avatar');
  if (avatarEl) {
    const [bg, fg] = _color(s.nis || s._id); // Pakai fungsi warna bawaan
    avatarEl.style.background = bg;
    avatarEl.style.color = fg;
    avatarEl.textContent = _ini(s.nama); // Pakai fungsi inisial bawaan
  }

  // 5. Update Badge Status (Warna Label Status)
  const statusEl = document.getElementById('detail-status');
  if (statusEl) {
    const map = { Aktif:'success', Cuti:'warning', Lulus:'info', 'Non-Aktif':'danger' };
    statusEl.className = `badge ${map[s.status] || 'neutral'}`;
    statusEl.innerHTML = `<span class="badge-dot"></span>${s.status || '—'}`;
  }

  if(window.openModal) window.openModal('modal-detail-santri');
}

async function _submitForm() {
  if (!window.supabase) return;
const payload = _appToDB({
    nama: document.getElementById('santri-nama')?.value.trim(),
    nis: document.getElementById('santri-nis')?.value.trim(),
    kelas: document.getElementById('santri-kelas')?.value,
    status: document.getElementById('santri-status')?.value || 'Aktif',
    jk: document.querySelector('input[name="santri-jk"]:checked')?.value || 'L',
    alamat: document.getElementById('santri-alamat')?.value.trim(),
    tglMasuk: document.getElementById('santri-tgl-masuk')?.value,
    waliNama: document.getElementById('santri-wali-nama')?.value.trim(),
    waliHub: document.getElementById('santri-wali-hub')?.value.trim(), // <- Koma ini yang kemungkinan terlewat sebelumnya
    ttlTempat: document.getElementById('santri-ttl-tempat')?.value.trim(),
    ttlTgl: document.getElementById('santri-ttl-tgl')?.value,
    nisn: document.getElementById('santri-nisn')?.value.trim(),
    waliHp: document.getElementById('santri-wali-hp')?.value.trim(),
    waliKerja: document.getElementById('santri-wali-kerja')?.value.trim(),
    catatan: document.getElementById('santri-catatan')?.value.trim()
  });

  console.log("Cek Payload yang mau dikirim:", payload);

  if (!payload.nama || !payload.nis || !payload.kelas) {
    if(window.showToast) window.showToast('error', 'Validasi Gagal', 'Nama, NIS, dan Kelas wajib diisi.'); return;
  }

  const btnSubmit = document.getElementById('btn-submit-santri');
  if (btnSubmit) btnSubmit.disabled = true;

  try {
    if (_santriState.editDocId) {
      const { error } = await window.supabase.from('santri').update(payload).eq('id', _santriState.editDocId);
      if (error) throw error;
      const idx = window.santriCache.findIndex(x => x._id === _santriState.editDocId);
      if (idx !== -1) window.santriCache[idx] = _dbToApp({ id: _santriState.editDocId, ...payload });
      if(window.showToast) window.showToast('success', 'Diperbarui', 'Data santri berhasil diupdate.');
    } else {
      const { data, error } = await window.supabase.from('santri').insert(payload).select().single();
      if (error) throw error;
      window.santriCache.unshift(_dbToApp(data));
      if(window.showToast) window.showToast('success', 'Tersimpan', 'Santri baru berhasil didaftarkan.');
    }
    _render(); _syncTabs();
    if(window.closeModal) window.closeModal('modal-santri');
  } catch (err) {
    if(window.showToast) window.showToast('error', 'Gagal', err.message);
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

function _deleteSantri(id, nama) {
  if(window.confirmDelete) {
    window.confirmDelete(`Hapus permanen data santri "${nama}" dari sistem?`, async () => {
      const { error } = await window.supabase.from('santri').delete().eq('id', id);
      if (error) { window.showToast('error', 'Gagal Menghapus', error.message); return; }
      window.santriCache = window.santriCache.filter(x => x._id !== id);
      _render(); _syncTabs();
      window.showToast('success', 'Dihapus', `${nama} berhasil dihapus.`);
    });
  }
}

/* ── WIRE EVENTS (Controller) ────────────────────────────────── */
function _wireEvents() {
  // Filter & Search
  ['santri-search','santri-filter-kelas','santri-filter-status','santri-filter-jk'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { _santriState.currentPage = 1; _render(); });
    document.getElementById(id)?.addEventListener('change',() => { _santriState.currentPage = 1; _render(); });
  });

// Tab Filter Status
  document.querySelectorAll('#view-data-santri .page-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#view-data-santri .page-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // PERUBAHAN: Pisahkan lulus dan nonaktif sesuai dengan nilai <option>
      const map = { all:'', aktif:'Aktif', cuti:'Cuti', lulus:'Lulus', nonaktif:'Non-Aktif' };
      const sel = document.getElementById('santri-filter-status');
      if (sel) sel.value = map[tab.dataset.subtab] || '';
      
      _santriState.currentPage = 1; 
      _render();
    });
  });

  // Tombol Modal & Action
  document.getElementById('btn-tambah-santri')?.addEventListener('click', _openTambahSantri);
  document.getElementById('btn-submit-santri')?.addEventListener('click', _submitForm);
  document.getElementById('btn-edit-from-detail')?.addEventListener('click', () => {
    if(window.closeModal) window.closeModal('modal-detail-santri');
    if (_santriState.viewDocId) _editSantri(_santriState.viewDocId);
  });

  // Event Delegation Tabel Action
  document.getElementById('santri-tbody')?.addEventListener('click', e => {
    const btnView = e.target.closest('[data-st-view]');
    const btnEdit = e.target.closest('[data-st-edit]');
    const btnDel  = e.target.closest('[data-st-del]');
    if (btnView) _viewSantri(btnView.dataset.stView);
    if (btnEdit) _editSantri(btnEdit.dataset.stEdit);
    if (btnDel)  _deleteSantri(btnDel.dataset.stDel, btnDel.dataset.nama);
  });
}

/* ── INIT MODUL ──────────────────────────────────────────────── */
(function _init() {
  window.addEventListener('madin:navigate', e => {
    if (e.detail.page !== 'data-santri') return;
    
    if (!_isSantriWired) {
      _wireEvents();
      _initRealtimeSantri();
      _isSantriWired = true;
    }
    _santriState.currentPage = 1;
    _render();
    _syncTabs();
  });

  console.log('[Madin] Data Santri module loaded ✓ (SOP V2 + Supabase Integrated)');
})();
