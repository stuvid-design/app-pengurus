/* ============================================================
   app.kelas.js — Modul Kelas/Tingkatan, Wali Santri
                  & Riwayat Mutasi
   Portal Pengurus Madrasah Diniyah DQLM

   SOP: File ini HANYA berisi state, CRUD Supabase,
        event listeners, dan mapping data dinamis (<tr>/<option>).
        Tidak ada innerHTML struktur HTML halaman.
   ============================================================ */

'use strict';

/* ── KONSTANTA ───────────────────────────────────────────────── */
const JENIS_MUTASI = ['Lulus','Pindah','Keluar','Aktif Kembali'];

const MUTASI_CFG = {
  Lulus:          { badge:'info',    icon:'ph-graduation-cap',      color:'#1d4ed8' },
  Pindah:         { badge:'warning', icon:'ph-arrows-left-right',   color:'#b45309' },
  Keluar:         { badge:'danger',  icon:'ph-sign-out',            color:'#b91c1c' },
  'Aktif Kembali':{ badge:'success', icon:'ph-arrow-u-up-left',     color:'#15803d' },
};

const KELAS_LABEL_KL = {
  '1':'Kelas 1 (Awwaliyah)',   '2':'Kelas 2 (Awwaliyah)',
  '3':'Kelas 3 (Awwaliyah)',  '4':'Kelas 4 (Awwaliyah)',
};

const PAGE_SIZE_KL = 12;

/* ── STATE ───────────────────────────────────────────────────── */
const _kl = {
  // Kelas
  kelasCache:    [],
  editKelasId:   null,
  // Wali
  waliCache:     [],
  waliSearch:    '',
  waliKelas:     '',
  waliHub:       '',
  waliPage:      1,
  // Mutasi
  mutasiCache:   [],
  mutasiJenis:   '',
  mutasiDari:    '',
  mutasiSampai:  '',
  mutasiSearch:  '',
  mutasiPage:    1,
  editMutasiId:  null,
};

/* ── UTILITAS ─────────────────────────────────────────────────── */
function _x(str = '') {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _formatTglShort(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('id-ID', {
      day:'numeric', month:'short', year:'numeric'
    });
}

function _skeletonTr(cols) {
  return `<tr>${Array.from({ length: cols }, () =>
    `<td><div style="height:14px;border-radius:4px;
         background:rgba(26,107,60,.07);
         animation:pulse 1.5s infinite;"></div></td>`
  ).join('')}</tr>`;
}

/* ── HITUNG SANTRI PER KELAS ─────────────────────────────────── */
function _countPerKelas() {
  const map = {};
  (window.santriCache || [])
    .filter(s => s.status === 'Aktif')
    .forEach(s => {
      map[s.kelas] = (map[s.kelas] || 0) + 1;
    });
  return map;
}

/* ══════════════════════════════════════════════════════════════
   SUPABASE: KELAS
══════════════════════════════════════════════════════════════ */

async function _loadKelas() {
  if (!window.supabase) return _dummyKelas();
  const { data, error } = await window.supabase
    .from('kelas')
    .select(`*, wali_kelas:wali_kelas_id ( nama )`)
    .order('tingkat', { ascending: true });
  if (error) {
    console.warn('[Kelas] Load error:', error.message);
    return _dummyKelas();
  }
  return data || [];
}

async function _saveKelas(payload) {
  if (!window.supabase) {
    if (_kl.editKelasId) {
      const idx = _kl.kelasCache.findIndex(k => k.id === _kl.editKelasId);
      if (idx !== -1) _kl.kelasCache[idx] = {
        ..._kl.kelasCache[idx], ...payload
      };
    } else {
      _kl.kelasCache.push({
        id: 'local-' + Date.now(), ...payload,
        wali_kelas: null,
      });
    }
    return true;
  }
  if (_kl.editKelasId) {
    const { error } = await window.supabase
      .from('kelas').update(payload).eq('id', _kl.editKelasId);
    if (error) throw error;
  } else {
    const { error } = await window.supabase
      .from('kelas').insert(payload);
    if (error) throw error;
  }
  return true;
}

async function _deleteKelas(id) {
  if (!window.supabase) {
    _kl.kelasCache = _kl.kelasCache.filter(k => k.id !== id);
    return true;
  }
  const { error } = await window.supabase
    .from('kelas').delete().eq('id', id);
  if (error) {
    window.showToast('error','Gagal Hapus', error.message);
    return false;
  }
  return true;
}

function _dummyKelas() {
  return [
    { id:'k1', kode:'KLS-1', nama:'Kelas 1 (Awwaliyah)',    tingkat:1, kapasitas:35, tahun_ajaran:'2025/2026', aktif:true, wali_kelas:null, deskripsi:'' },
    { id:'k2', kode:'KLS-2', nama:'Kelas 2 (Awwaliyah)', tingkat:2, kapasitas:35, tahun_ajaran:'2025/2026', aktif:true, wali_kelas:null, deskripsi:'' },
    { id:'k3', kode:'KLS-3', nama:'Kelas 3 (Awwaliyah)',   tingkat:3, kapasitas:30, tahun_ajaran:'2025/2026', aktif:true, wali_kelas:null, deskripsi:'' },
    { id:'k4', kode:'KLS-4', nama:'Kelas 4 (Awwaliyah)',   tingkat:4, kapasitas:30, tahun_ajaran:'2025/2026', aktif:true, wali_kelas:null, deskripsi:'' },
  ];
}

/* ══════════════════════════════════════════════════════════════
   SUPABASE: MUTASI
══════════════════════════════════════════════════════════════ */

async function _loadMutasi() {
  if (!window.supabase) return [];
  const { data, error } = await window.supabase
    .from('mutasi')
    .select(`
      id, jenis, dari_kelas, ke_kelas,
      tanggal, alasan, keterangan, created_at,
      santri:santri_id ( nis, nama, kelas )
    `)
    .order('tanggal', { ascending: false });
  if (error) {
    console.warn('[Mutasi] Load error:', error.message);
    return [];
  }
  return data || [];
}

async function _saveMutasi(payload) {
  if (!window.supabase) {
    const santri = (window.santriCache||[])
      .find(s => s._id === payload.santri_id);
    if (_kl.editMutasiId) {
      const idx = _kl.mutasiCache.findIndex(m => m.id === _kl.editMutasiId);
      if (idx !== -1) _kl.mutasiCache[idx] = {
        ..._kl.mutasiCache[idx], ...payload,
        santri: { nis: santri?.nis, nama: santri?.nama, kelas: santri?.kelas }
      };
    } else {
      _kl.mutasiCache.unshift({
        id: 'local-' + Date.now(), ...payload,
        santri: { nis: santri?.nis, nama: santri?.nama, kelas: santri?.kelas },
        created_at: new Date().toISOString(),
      });
    }
    return true;
  }

  const row = {
    ...payload,
    dicatat_oleh: window.currentUser?.uid || null,
  };

  if (_kl.editMutasiId) {
    const { error } = await window.supabase
      .from('mutasi').update(row).eq('id', _kl.editMutasiId);
    if (error) throw error;
  } else {
    const { error } = await window.supabase
      .from('mutasi').insert(row);
    if (error) throw error;

    // Update status santri sesuai jenis mutasi
    if (payload.santri_id) {
      const statusMap = {
        Lulus:          'Non-Aktif',
        Pindah:         'Non-Aktif',
        Keluar:         'Non-Aktif',
        'Aktif Kembali':'Aktif',
      };
      const newStatus = statusMap[payload.jenis];
      const updatePayload = { status: newStatus };

      // Jika pindah kelas, update kelas santri
      if (payload.jenis === 'Aktif Kembali' && payload.ke_kelas) {
        updatePayload.kelas = payload.ke_kelas;
      }

      await window.supabase
        .from('santri')
        .update(updatePayload)
        .eq('id', payload.santri_id);

      // Update santriCache lokal
      const idx = (window.santriCache||[])
        .findIndex(s => s._id === payload.santri_id);
      if (idx !== -1) {
        window.santriCache[idx].status = newStatus;
        if (updatePayload.kelas) {
          window.santriCache[idx].kelas = updatePayload.kelas;
        }
      }
    }
  }
  return true;
}

async function _deleteMutasi(id) {
  if (!window.supabase) {
    _kl.mutasiCache = _kl.mutasiCache.filter(m => m.id !== id);
    return true;
  }
  const { error } = await window.supabase
    .from('mutasi').delete().eq('id', id);
  if (error) {
    window.showToast('error','Gagal Hapus', error.message);
    return false;
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════
   STAT CARDS
══════════════════════════════════════════════════════════════ */

function _updateKelasStatCards() {
  const aktif    = _kl.kelasCache.filter(k => k.aktif).length;
  const countMap = _countPerKelas();
  const santriAktif = Object.values(countMap)
    .reduce((s,v) => s+v, 0);
  const avg      = aktif ? Math.round(santriAktif / aktif) : 0;
  const kapTotal = _kl.kelasCache
    .filter(k => k.aktif)
    .reduce((s,k) => s+(k.kapasitas||0), 0);
  const pctKap   = kapTotal
    ? Math.round((santriAktif/kapTotal)*100) : 0;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('kls-sc-total',       aktif);
  set('kls-sc-total-sub',   `${_kl.kelasCache.length} total kelas`);
  set('kls-sc-santri',      santriAktif);
  set('kls-sc-santri-sub',  `dari ${(window.santriCache||[]).length} terdaftar`);
  set('kls-sc-avg',         avg);
  set('kls-sc-kapasitas',   `${pctKap}%`);
}

function _updateMutasiStatCards() {
  const data = _kl.mutasiCache;
  const set  = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('mut-sc-lulus',  data.filter(m => m.jenis==='Lulus').length);
  set('mut-sc-pindah', data.filter(m => m.jenis==='Pindah').length);
  set('mut-sc-keluar', data.filter(m => m.jenis==='Keluar').length);
  set('mut-sc-aktif',  data.filter(m => m.jenis==='Aktif Kembali').length);
}

/* ══════════════════════════════════════════════════════════════
   POPULATE SELECTS
══════════════════════════════════════════════════════════════ */

function _populateSelects() {
  // Santri untuk form mutasi
  const santriOpts = (window.santriCache || [])
    .sort((a,b) => a.nama.localeCompare(b.nama))
    .map(s =>
      `<option value="${s._id}">${_x(s.nama)} — ${_x(s.nis)}</option>`
    ).join('');

  const mutSantriEl = document.getElementById('mut-form-santri');
  if (mutSantriEl) {
    mutSantriEl.innerHTML =
      '<option value="">— Pilih Santri —</option>' + santriOpts;
  }

  // Ustadz untuk wali kelas
  const ustadzOpts = (window.ustadzCache || [])
    .filter(u => u.status === 'Aktif')
    .map(u =>
      `<option value="${u.id}">${_x(u.nama)}</option>`
    ).join('');

  const waliKelasEl = document.getElementById('kls-wali-kelas');
  if (waliKelasEl) {
    waliKelasEl.innerHTML =
      '<option value="">— Pilih Ustadz —</option>' + ustadzOpts;
  }
}

/* ══════════════════════════════════════════════════════════════
   RELOAD
══════════════════════════════════════════════════════════════ */

async function _reloadAll() {
  const [kelas, mutasi] = await Promise.all([
    _loadKelas(),
    _loadMutasi(),
  ]);
  _kl.kelasCache  = kelas;
  _kl.mutasiCache = mutasi;
  _kl.waliCache   = _buildWaliCache();
}

// Bangun cache wali dari santriCache (denormalized)
function _buildWaliCache() {
  return (window.santriCache || [])
    .filter(s => s.status === 'Aktif' && s.waliNama)
    .map(s => ({
      santriId:   s._id,
      santriNama: s.nama,
      santriNis:  s.nis,
      kelas:      s.kelas,
      waliNama:   s.waliNama,
      waliHub:    s.waliHub,
      waliHp:     s.waliHp,
      waliKerja:  s.waliKerja,
    }))
    .sort((a,b) => a.waliNama.localeCompare(b.waliNama));
}

/* ============================================================
   app.kelas.js — Batch 3: Render Functions
   (Grid Kelas, Tabel Wali Santri & Tabel Mutasi)
   ============================================================ */

/* ══════════════════════════════════════════════════════════════
   RENDER: GRID KARTU KELAS
══════════════════════════════════════════════════════════════ */
function _renderKelasGrid() {
  const wrap = document.getElementById('kls-grid');
  if (!wrap) return;

  _updateKelasStatCards();

  if (!_kl.kelasCache.length) {
    wrap.innerHTML = `
      <div class="card" style="padding:48px;
           text-align:center;grid-column:1/-1;
           color:var(--clr-text-muted);">
        <i class="ph-bold ph-chalkboard-teacher"
           style="font-size:32px;display:block;
                  margin-bottom:10px;opacity:.3;"></i>
        Belum ada data kelas. Klik "Tambah Kelas".
      </div>`;
    return;
  }

  const countMap = _countPerKelas();

  wrap.innerHTML = _kl.kelasCache.map(k => {
    const jumlah   = countMap[String(k.tingkat)] || 0;
    const kapasitas= k.kapasitas || 30;
    const pct      = Math.min(100, Math.round((jumlah/kapasitas)*100));
    const pctColor = pct >= 90
      ? 'var(--clr-danger)' : pct >= 70
      ? 'var(--clr-warning)' : 'var(--clr-primary)';
    const waliNama = k.wali_kelas?.nama || '—';
    const statusBadge = k.aktif
      ? '<span class="badge success"><span class="badge-dot"></span>Aktif</span>'
      : '<span class="badge danger"><span class="badge-dot"></span>Non-Aktif</span>';

    return `
      <div class="card kls-card ${k.aktif ? '' : 'kls-card--nonaktif'}">

        <!-- Header kartu -->
        <div class="kls-card__header">
          <div class="kls-card__icon">
            <i class="ph-bold ph-chalkboard-teacher"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <p class="kls-card__nama">${_x(k.nama)}</p>
            <p class="kls-card__kode">${_x(k.kode)}</p>
          </div>
          ${statusBadge}
        </div>

        <!-- Stats -->
        <div class="kls-card__stats">
          <div class="kls-card__stat">
            <span class="kls-card__stat-label">Santri</span>
            <span class="kls-card__stat-val"
                  style="color:var(--clr-primary);">
              ${jumlah}
            </span>
          </div>
          <div class="kls-card__stat">
            <span class="kls-card__stat-label">Kapasitas</span>
            <span class="kls-card__stat-val">${kapasitas}</span>
          </div>
          <div class="kls-card__stat">
            <span class="kls-card__stat-label">T.A.</span>
            <span class="kls-card__stat-val"
                  style="font-size:12px;">
              ${_x(k.tahun_ajaran || '—')}
            </span>
          </div>
        </div>

        <!-- Progress kapasitas -->
        <div style="margin:10px 0 12px;">
          <div style="display:flex;justify-content:space-between;
                      font-size:11.5px;margin-bottom:5px;">
            <span style="color:var(--clr-text-muted);">
              Kapasitas terpakai
            </span>
            <span style="font-weight:700;color:${pctColor};">
              ${pct}%
            </span>
          </div>
          <div style="height:6px;background:rgba(26,107,60,.1);
                      border-radius:99px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;
                        background:${pctColor};
                        border-radius:99px;
                        transition:width .6s ease;"></div>
          </div>
        </div>

        <!-- Wali kelas -->
        <div style="display:flex;align-items:center;gap:7px;
                    padding:8px 0;border-top:1px solid
                    rgba(26,107,60,.08);font-size:12.5px;
                    color:var(--clr-text-sub);">
          <i class="ph-bold ph-user-circle"
             style="font-size:16px;color:var(--clr-primary);
                    flex-shrink:0;"></i>
          <span>Wali: <strong>${_x(waliNama)}</strong></span>
        </div>

        <!-- Aksi -->
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn btn-outline btn-sm"
                  style="flex:1;"
                  data-kls-edit="${k.id}">
            <i class="ph-bold ph-pencil-simple"></i> Edit
          </button>
          <button class="btn btn-sm"
                  style="flex:1;background:rgba(26,107,60,.08);
                         color:var(--clr-primary);
                         border:1.5px solid rgba(26,107,60,.2);"
                  data-kls-santri="${k.tingkat}">
            <i class="ph-bold ph-student"></i>
            Santri (${jumlah})
          </button>
          <button class="btn-tbl delete"
                  data-kls-del="${k.id}"
                  data-kls-nama="${_x(k.nama)}"
                  title="Hapus kelas ini">
            <i class="ph-bold ph-trash"></i>
          </button>
        </div>

      </div>`;
  }).join('');

  // Wire tombol aksi
  wrap.querySelectorAll('[data-kls-edit]').forEach(b =>
    b.addEventListener('click', () => _openEditKelas(b.dataset.klsEdit))
  );
  wrap.querySelectorAll('[data-kls-santri]').forEach(b =>
    b.addEventListener('click', () => {
      // Navigasi ke Data Santri dengan filter kelas
      window.navigateTo('data-santri');
      requestAnimationFrame(() => {
        const sel = document.getElementById('santri-filter-kelas');
        if (sel) {
          sel.value = b.dataset.klsSantri;
          sel.dispatchEvent(new Event('change'));
        }
      });
    })
  );
  wrap.querySelectorAll('[data-kls-del]').forEach(b =>
    b.addEventListener('click', () =>
      window.confirmDelete(
        `Kelas "${b.dataset.klsNama}" akan dihapus. Data santri di kelas ini tidak ikut terhapus.`,
        async () => {
          const ok = await _deleteKelas(b.dataset.klsDel);
          if (!ok) return;
          _kl.kelasCache = _kl.kelasCache.filter(k => k.id !== b.dataset.klsDel);
          _renderKelasGrid();
          window.showToast('success','Kelas Dihapus',
            `${b.dataset.klsNama} berhasil dihapus.`);
        }
      )
    )
  );
}

/* ══════════════════════════════════════════════════════════════
   RENDER: TABEL WALI SANTRI
══════════════════════════════════════════════════════════════ */
function _renderWaliTable() {
  const tbody = document.getElementById('tbody-wali');
  if (!tbody) return;

  // Rebuild cache setiap render (santriCache bisa berubah)
  _kl.waliCache = _buildWaliCache();

  let data = _kl.waliCache;

  if (_kl.waliKelas) {
    data = data.filter(w => w.kelas === _kl.waliKelas);
  }
  if (_kl.waliHub) {
    data = data.filter(w => w.waliHub === _kl.waliHub);
  }
  if (_kl.waliSearch) {
    const q = _kl.waliSearch.toLowerCase();
    data = data.filter(w =>
      w.waliNama?.toLowerCase().includes(q)    ||
      w.santriNama?.toLowerCase().includes(q)  ||
      w.waliHp?.includes(q)
    );
  }

  const total = data.length;
  const start = (_kl.waliPage - 1) * PAGE_SIZE_KL;
  const page  = data.slice(start, start + PAGE_SIZE_KL);

  const infoEl = document.getElementById('wali-pagination-info');
  if (infoEl) infoEl.textContent = total
    ? `${Math.min(start+1,total)}–${Math.min(start+PAGE_SIZE_KL,total)} dari ${total}`
    : 'Tidak ada data';

  const countEl = document.getElementById('wali-count-info');
  if (countEl) countEl.textContent =
    `${total} wali ditemukan`;

  if (!page.length) {
    tbody.innerHTML = `
      <tr><td colspan="8"
          style="text-align:center;padding:52px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-users"
           style="font-size:28px;display:block;
                  margin-bottom:10px;opacity:.3;"></i>
        ${_kl.waliCache.length
          ? 'Tidak ada yang sesuai filter.'
          : 'Belum ada data wali (dari santri aktif).'}
      </td></tr>`;
    _renderWaliPager(total);
    return;
  }

  tbody.innerHTML = page.map((w, i) => {
    const klsLabel = KELAS_LABEL_KL[w.kelas] || `Kelas ${w.kelas}`;
    return `
      <tr>
        <td style="text-align:center;font-size:12px;
                   color:var(--clr-text-muted);">
          ${start + i + 1}
        </td>
        <td>
          <div style="font-weight:700;font-size:13.5px;">
            ${_x(w.waliNama)}
          </div>
          ${w.waliKerja ? `
          <div style="font-size:11.5px;
                      color:var(--clr-text-muted);">
            ${_x(w.waliKerja)}
          </div>` : ''}
        </td>
        <td>
          <span class="badge neutral">
            <span class="badge-dot"></span>
            ${_x(w.waliHub || '—')}
          </span>
        </td>
        <td style="font-weight:600;">${_x(w.santriNama)}</td>
        <td style="text-align:center;">
          <span class="badge neutral">
            <span class="badge-dot"></span>
            ${_x(klsLabel)}
          </span>
        </td>
        <td>
          ${w.waliHp ? `
          <a href="https://wa.me/62${w.waliHp.replace(/^0/,'').replace(/\D/g,'')}"
             target="_blank"
             style="color:var(--clr-primary);font-weight:600;
                    text-decoration:none;display:flex;
                    align-items:center;gap:5px;font-size:13px;">
            <i class="ph-bold ph-whatsapp-logo"
               style="font-size:15px;color:#25d366;"></i>
            ${_x(w.waliHp)}
          </a>` : '—'}
        </td>
        <td style="font-size:13px;color:var(--clr-text-sub);">
          ${_x(w.waliKerja || '—')}
        </td>
        <td>
          <button class="btn-tbl view"
                  title="Lihat data santri"
                  data-wali-santri="${w.santriId}">
            <i class="ph-bold ph-eye"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  // Wire tombol lihat santri
  tbody.querySelectorAll('[data-wali-santri]').forEach(b =>
    b.addEventListener('click', () => {
      window.navigateTo('data-santri');
      requestAnimationFrame(() => {
        if (typeof window.viewSantri === 'function') {
          window.viewSantri(b.dataset.waliSantri);
        }
      });
    })
  );

  _renderWaliPager(total);
}

function _renderWaliPager(total) {
  const wrap = document.getElementById('wali-pager');
  if (!wrap) return;
  const tp = Math.max(1, Math.ceil(total / PAGE_SIZE_KL));
  if (tp <= 1) { wrap.innerHTML = ''; return; }

  let h = `<button class="page-btn" id="wp-prev"
              ${_kl.waliPage===1?'disabled':''}>
             <i class="ph-bold ph-caret-left"></i>
           </button>`;
  const lo = Math.max(1, _kl.waliPage-2);
  const hi = Math.min(tp, _kl.waliPage+2);
  if (lo>1) h += `<button class="page-btn" data-wp="1">1</button>`;
  if (lo>2) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  for (let p=lo; p<=hi; p++) {
    h += `<button class="page-btn${p===_kl.waliPage?' active':''}"
                  data-wp="${p}">${p}</button>`;
  }
  if (hi<tp-1) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  if (hi<tp) h += `<button class="page-btn" data-wp="${tp}">${tp}</button>`;
  h += `<button class="page-btn" id="wp-next"
              ${_kl.waliPage===tp?'disabled':''}>
             <i class="ph-bold ph-caret-right"></i>
           </button>`;
  wrap.innerHTML = h;
  wrap.querySelectorAll('[data-wp]').forEach(b =>
    b.addEventListener('click', () => {
      _kl.waliPage = +b.dataset.wp; _renderWaliTable();
    })
  );
  wrap.querySelector('#wp-prev')
    ?.addEventListener('click', () => { _kl.waliPage--; _renderWaliTable(); });
  wrap.querySelector('#wp-next')
    ?.addEventListener('click', () => { _kl.waliPage++; _renderWaliTable(); });
}

/* ══════════════════════════════════════════════════════════════
   RENDER: TABEL MUTASI
══════════════════════════════════════════════════════════════ */
function _renderMutasiTable() {
  const tbody = document.getElementById('tbody-mutasi');
  if (!tbody) return;

  _updateMutasiStatCards();

  let data = _kl.mutasiCache;

  if (_kl.mutasiJenis) {
    data = data.filter(m => m.jenis === _kl.mutasiJenis);
  }
  if (_kl.mutasiDari) {
    data = data.filter(m => m.tanggal >= _kl.mutasiDari);
  }
  if (_kl.mutasiSampai) {
    data = data.filter(m => m.tanggal <= _kl.mutasiSampai);
  }
  if (_kl.mutasiSearch) {
    const q = _kl.mutasiSearch.toLowerCase();
    data = data.filter(m =>
      m.santri?.nama?.toLowerCase().includes(q) ||
      m.santri?.nis?.includes(q)
    );
  }

  const total = data.length;
  const start = (_kl.mutasiPage - 1) * PAGE_SIZE_KL;
  const page  = data.slice(start, start + PAGE_SIZE_KL);

  const infoEl = document.getElementById('mut-pagination-info');
  if (infoEl) infoEl.textContent = total
    ? `${Math.min(start+1,total)}–${Math.min(start+PAGE_SIZE_KL,total)} dari ${total}`
    : 'Tidak ada riwayat mutasi';

  if (!page.length) {
    tbody.innerHTML = `
      <tr><td colspan="9"
          style="text-align:center;padding:52px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-arrows-left-right"
           style="font-size:28px;display:block;
                  margin-bottom:10px;opacity:.3;"></i>
        ${_kl.mutasiCache.length
          ? 'Tidak ada yang sesuai filter.'
          : 'Belum ada riwayat mutasi.'}
      </td></tr>`;
    _renderMutasiPager(total);
    return;
  }

  tbody.innerHTML = page.map((m, i) => {
    const cfg      = MUTASI_CFG[m.jenis] || {};
    const klsLabel = k => KELAS_LABEL_KL[k]
      ? KELAS_LABEL_KL[k].split(' ')[0]+' '+KELAS_LABEL_KL[k].split(' ')[1]
      : (k ? `Kelas ${k}` : '—');

    return `
      <tr>
        <td style="text-align:center;font-size:12px;
                   color:var(--clr-text-muted);">
          ${start + i + 1}
        </td>
        <td>
          <div style="font-weight:600;font-size:13.5px;">
            ${_x(m.santri?.nama || '—')}
          </div>
        </td>
        <td style="font-family:monospace;font-size:12px;
                   color:var(--clr-text-sub);">
          ${_x(m.santri?.nis || '—')}
        </td>
        <td style="text-align:center;">
          <span class="badge ${cfg.badge||'neutral'}">
            <span class="badge-dot"></span>
            ${_x(m.jenis)}
          </span>
        </td>
        <td style="text-align:center;font-size:13px;">
          ${klsLabel(m.dari_kelas)}
        </td>
        <td style="text-align:center;font-size:13px;">
          ${klsLabel(m.ke_kelas)}
        </td>
        <td style="text-align:center;font-size:12.5px;
                   white-space:nowrap;">
          ${_formatTglShort(m.tanggal)}
        </td>
        <td style="font-size:13px;color:var(--clr-text-sub);
                   max-width:180px;">
          ${_x(m.alasan || m.keterangan || '—')}
        </td>
        <td>
          <div class="tbl-actions"
               style="justify-content:center;">
            <button class="btn-tbl edit"
                    title="Edit"
                    data-mut-edit="${m.id}">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>
            <button class="btn-tbl delete"
                    title="Hapus"
                    data-mut-del="${m.id}"
                    data-mut-nama="${_x(m.santri?.nama||'')}">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Wire edit & hapus
  tbody.querySelectorAll('[data-mut-edit]').forEach(b =>
    b.addEventListener('click', () => _openEditMutasi(b.dataset.mutEdit))
  );
  tbody.querySelectorAll('[data-mut-del]').forEach(b =>
    b.addEventListener('click', () =>
      window.confirmDelete(
        `Riwayat mutasi "${b.dataset.mutNama}" akan dihapus.`,
        async () => {
          const ok = await _deleteMutasi(b.dataset.mutDel);
          if (!ok) return;
          _kl.mutasiCache = _kl.mutasiCache
            .filter(m => m.id !== b.dataset.mutDel);
          _renderMutasiTable();
          window.showToast('success','Dihapus',
            'Riwayat mutasi berhasil dihapus.');
        }
      )
    )
  );

  _renderMutasiPager(total);
}

function _renderMutasiPager(total) {
  const wrap = document.getElementById('mut-pager');
  if (!wrap) return;
  const tp = Math.max(1, Math.ceil(total / PAGE_SIZE_KL));
  if (tp <= 1) { wrap.innerHTML = ''; return; }

  let h = `<button class="page-btn" id="mp-prev"
              ${_kl.mutasiPage===1?'disabled':''}>
             <i class="ph-bold ph-caret-left"></i>
           </button>`;
  const lo = Math.max(1, _kl.mutasiPage-2);
  const hi = Math.min(tp, _kl.mutasiPage+2);
  if (lo>1) h += `<button class="page-btn" data-mp="1">1</button>`;
  if (lo>2) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  for (let p=lo; p<=hi; p++) {
    h += `<button class="page-btn${p===_kl.mutasiPage?' active':''}"
                  data-mp="${p}">${p}</button>`;
  }
  if (hi<tp-1) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  if (hi<tp) h += `<button class="page-btn" data-mp="${tp}">${tp}</button>`;
  h += `<button class="page-btn" id="mp-next"
              ${_kl.mutasiPage===tp?'disabled':''}>
             <i class="ph-bold ph-caret-right"></i>
           </button>`;
  wrap.innerHTML = h;
  wrap.querySelectorAll('[data-mp]').forEach(b =>
    b.addEventListener('click', () => {
      _kl.mutasiPage = +b.dataset.mp; _renderMutasiTable();
    })
  );
  wrap.querySelector('#mp-prev')
    ?.addEventListener('click', () => { _kl.mutasiPage--; _renderMutasiTable(); });
  wrap.querySelector('#mp-next')
    ?.addEventListener('click', () => { _kl.mutasiPage++; _renderMutasiTable(); });
}

/* ══════════════════════════════════════════════════════════════
   EXPORT CSV WALI
══════════════════════════════════════════════════════════════ */
function _exportWaliCSV() {
  const data = _kl.waliCache;
  if (!data.length) {
    window.showToast('warning','Tidak Ada Data',''); return;
  }
  const hdr  = ['Nama Wali','Hubungan','No HP',
                 'Pekerjaan','Nama Santri','NIS','Kelas'];
  const rows = data.map(w => [
    w.waliNama, w.waliHub||'', w.waliHp||'',
    w.waliKerja||'', w.santriNama, w.santriNis,
    KELAS_LABEL_KL[w.kelas]||w.kelas,
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));

  const csv  = [hdr,...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],
    { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `wali-santri-${_today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('success','Export Berhasil',
    `${data.length} data wali diekspor.`);
}

/* ══════════════════════════════════════════════════════════════
   EXPORT CSV MUTASI
══════════════════════════════════════════════════════════════ */
function _exportMutasiCSV() {
  const data = _kl.mutasiCache;
  if (!data.length) {
    window.showToast('warning','Tidak Ada Data',''); return;
  }
  const hdr  = ['Nama Santri','NIS','Jenis','Dari Kelas',
                 'Ke Kelas','Tanggal','Alasan','Keterangan'];
  const rows = data.map(m => [
    m.santri?.nama||'—', m.santri?.nis||'—', m.jenis,
    m.dari_kelas ? `Kelas ${m.dari_kelas}` : '—',
    m.ke_kelas   ? `Kelas ${m.ke_kelas}`   : '—',
    _formatTglShort(m.tanggal),
    m.alasan||'', m.keterangan||'',
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));

  const csv  = [hdr,...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],
    { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `mutasi-santri-${_today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('success','Export Berhasil',
    `${data.length} data mutasi diekspor.`);
}

/* ============================================================
   app.kelas.js — Batch 4: Modal Forms, Wire Events & Init
   ============================================================ */

/* ══════════════════════════════════════════════════════════════
   MODAL: TAMBAH / EDIT KELAS
══════════════════════════════════════════════════════════════ */
function _openTambahKelas() {
  _kl.editKelasId = null;
  const titleEl = document.getElementById('modal-kls-title');
  const lblEl   = document.getElementById('btn-simpan-kls-label');
  const form    = document.getElementById('form-kelas');
  if (titleEl) titleEl.textContent = 'Tambah Kelas';
  if (lblEl)   lblEl.textContent   = 'Simpan';
  if (form)    form.reset();

  // Default radio aktif
  const radioAktif = document.querySelector(
    'input[name="kls-aktif"][value="true"]');
  if (radioAktif) radioAktif.checked = true;

  window.openModal('modal-kelas-form');
}

function _openEditKelas(id) {
  const k = _kl.kelasCache.find(x => x.id === id);
  if (!k) return;
  _kl.editKelasId = id;

  const titleEl = document.getElementById('modal-kls-title');
  const lblEl   = document.getElementById('btn-simpan-kls-label');
  if (titleEl) titleEl.textContent = `Edit Kelas — ${k.nama}`;
  if (lblEl)   lblEl.textContent   = 'Update';

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };
  set('kls-kode',        k.kode);
  set('kls-nama',        k.nama);
  set('kls-tingkat',     k.tingkat);
  set('kls-kapasitas',   k.kapasitas || 30);
  set('kls-tahun-ajaran',k.tahun_ajaran || '');
  set('kls-wali-kelas',  k.wali_kelas_id || '');
  set('kls-deskripsi',   k.deskripsi || '');

  const radioVal = k.aktif ? 'true' : 'false';
  const radio    = document.querySelector(
    `input[name="kls-aktif"][value="${radioVal}"]`);
  if (radio) radio.checked = true;

  window.openModal('modal-kelas-form');
}

async function _submitKelas() {
  const kode    = document.getElementById('kls-kode')?.value.trim();
  const nama    = document.getElementById('kls-nama')?.value.trim();
  const tingkat = parseInt(document.getElementById('kls-tingkat')?.value);

  if (!kode || !nama || !tingkat) {
    window.showToast('error','Validasi Gagal',
      'Kode, Nama, dan Tingkat wajib diisi.'); return;
  }

  const aktifRadio = document.querySelector(
    'input[name="kls-aktif"]:checked');
  const payload = {
    kode,
    nama,
    tingkat,
    kapasitas:     parseInt(document.getElementById('kls-kapasitas')?.value) || 30,
    tahun_ajaran:  document.getElementById('kls-tahun-ajaran')?.value.trim() || null,
    wali_kelas_id: document.getElementById('kls-wali-kelas')?.value || null,
    deskripsi:     document.getElementById('kls-deskripsi')?.value.trim() || null,
    aktif:         aktifRadio?.value === 'true',
  };

  const btn = document.getElementById('btn-simpan-kelas');
  if (btn) btn.disabled = true;

  try {
    await _saveKelas(payload);
    window.showToast('success',
      _kl.editKelasId ? 'Kelas Diperbarui' : 'Kelas Ditambahkan',
      `${nama} berhasil disimpan.`
    );
    window.closeModal('modal-kelas-form');
    _kl.editKelasId = null;
    _kl.kelasCache  = await _loadKelas();
    _renderKelasGrid();
  } catch (err) {
    window.showToast('error','Gagal Menyimpan',
      err?.message || 'Terjadi kesalahan.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════════
   MODAL: CATAT / EDIT MUTASI
══════════════════════════════════════════════════════════════ */
function _openTambahMutasi() {
  _kl.editMutasiId = null;
  const titleEl = document.getElementById('modal-mut-title');
  const lblEl   = document.getElementById('btn-simpan-mut-label');
  const form    = document.getElementById('form-mutasi');
  if (titleEl) titleEl.textContent = 'Catat Mutasi Santri';
  if (lblEl)   lblEl.textContent   = 'Simpan';
  if (form)    form.reset();

  const editId = document.getElementById('mut-edit-id');
  if (editId) editId.value = '';

  const tglEl = document.getElementById('mut-form-tgl');
  if (tglEl) tglEl.value = _today();

  window.openModal('modal-mutasi-form');
}

function _openEditMutasi(id) {
  const m = _kl.mutasiCache.find(x => x.id === id);
  if (!m) return;
  _kl.editMutasiId = id;

  const titleEl = document.getElementById('modal-mut-title');
  const lblEl   = document.getElementById('btn-simpan-mut-label');
  if (titleEl) titleEl.textContent = `Edit Mutasi — ${m.santri?.nama || ''}`;
  if (lblEl)   lblEl.textContent   = 'Update';

  const editId = document.getElementById('mut-edit-id');
  if (editId) editId.value = id;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };
  set('mut-form-santri', m.santri_id || '');
  set('mut-form-jenis',  m.jenis);
  set('mut-form-tgl',    m.tanggal);
  set('mut-form-dari',   m.dari_kelas || '');
  set('mut-form-ke',     m.ke_kelas   || '');
  set('mut-form-alasan', m.alasan     || '');
  set('mut-form-ket',    m.keterangan || '');

  window.openModal('modal-mutasi-form');
}

async function _submitMutasi() {
  const santriId = document.getElementById('mut-form-santri')?.value;
  const jenis    = document.getElementById('mut-form-jenis')?.value;
  const tanggal  = document.getElementById('mut-form-tgl')?.value;

  if (!santriId || !jenis || !tanggal) {
    window.showToast('error','Validasi Gagal',
      'Santri, Jenis, dan Tanggal wajib diisi.'); return;
  }

  const payload = {
    santri_id:   santriId,
    jenis,
    tanggal,
    dari_kelas:  document.getElementById('mut-form-dari')?.value || null,
    ke_kelas:    document.getElementById('mut-form-ke')?.value   || null,
    alasan:      document.getElementById('mut-form-alasan')?.value.trim() || null,
    keterangan:  document.getElementById('mut-form-ket')?.value.trim()    || null,
  };

  const santri  = (window.santriCache||[])
    .find(s => s._id === santriId);
  const btn     = document.getElementById('btn-simpan-mutasi');
  if (btn) btn.disabled = true;

  try {
    await _saveMutasi(payload);
    window.showToast('success',
      _kl.editMutasiId ? 'Mutasi Diperbarui' : 'Mutasi Dicatat',
      `${santri?.nama || 'Santri'} — ${jenis} berhasil dicatat.`
    );
    window.closeModal('modal-mutasi-form');
    _kl.editMutasiId = null;
    _kl.mutasiCache  = await _loadMutasi();
    _renderMutasiTable();
  } catch (err) {
    window.showToast('error','Gagal Menyimpan',
      err?.message || 'Terjadi kesalahan.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════════
   WIRE: EVENT LISTENERS
══════════════════════════════════════════════════════════════ */
function _wireKelasEvents() {

  // Tambah kelas
  document.getElementById('btn-tambah-kelas')
    ?.addEventListener('click', _openTambahKelas);

  // Simpan kelas
  document.getElementById('btn-simpan-kelas')
    ?.addEventListener('click', _submitKelas);

  // Enter di form kelas
  document.getElementById('form-kelas')
    ?.addEventListener('keydown', e => {
      if (e.key === 'Enter' &&
          e.target.tagName !== 'TEXTAREA') {
        e.preventDefault(); _submitKelas();
      }
    });

  // Tutup modal kelas
  document.querySelectorAll('[data-close-modal="modal-kelas-form"]')
    .forEach(b => b.addEventListener('click', () =>
      window.closeModal('modal-kelas-form')));
  document.getElementById('modal-kelas-form')
    ?.addEventListener('click', e => {
      if (e.target.id === 'modal-kelas-form')
        window.closeModal('modal-kelas-form');
    });
}

function _wireWaliEvents() {

  // Search wali
  document.getElementById('wali-search')
    ?.addEventListener('input', e => {
      _kl.waliSearch = e.target.value;
      _kl.waliPage   = 1;
      _renderWaliTable();
    });

  // Filter kelas wali
  document.getElementById('wali-filter-kelas')
    ?.addEventListener('change', e => {
      _kl.waliKelas = e.target.value;
      _kl.waliPage  = 1;
      _renderWaliTable();
    });

  // Filter hubungan wali
  document.getElementById('wali-filter-hub')
    ?.addEventListener('change', e => {
      _kl.waliHub  = e.target.value;
      _kl.waliPage = 1;
      _renderWaliTable();
    });

  // Export wali CSV
  document.getElementById('btn-export-wali')
    ?.addEventListener('click', _exportWaliCSV);
}

function _wireMutasiEvents() {

  // Tambah mutasi
  document.getElementById('btn-tambah-mutasi')
    ?.addEventListener('click', _openTambahMutasi);

  // Simpan mutasi
  document.getElementById('btn-simpan-mutasi')
    ?.addEventListener('click', _submitMutasi);

  // Enter di form mutasi
  document.getElementById('form-mutasi')
    ?.addEventListener('keydown', e => {
      if (e.key === 'Enter' &&
          e.target.tagName !== 'TEXTAREA') {
        e.preventDefault(); _submitMutasi();
      }
    });

  // Filter mutasi
  document.getElementById('mut-filter-jenis')
    ?.addEventListener('change', e => {
      _kl.mutasiJenis = e.target.value;
      _kl.mutasiPage  = 1;
      _renderMutasiTable();
    });

  document.getElementById('mut-filter-dari')
    ?.addEventListener('change', e => {
      _kl.mutasiDari = e.target.value;
      _kl.mutasiPage = 1;
      _renderMutasiTable();
    });

  document.getElementById('mut-filter-sampai')
    ?.addEventListener('change', e => {
      _kl.mutasiSampai = e.target.value;
      _kl.mutasiPage   = 1;
      _renderMutasiTable();
    });

  document.getElementById('mut-search')
    ?.addEventListener('input', e => {
      _kl.mutasiSearch = e.target.value;
      _kl.mutasiPage   = 1;
      _renderMutasiTable();
    });

  // Export mutasi CSV
  document.getElementById('btn-export-mutasi')
    ?.addEventListener('click', _exportMutasiCSV);

  // Tutup modal mutasi
  document.querySelectorAll('[data-close-modal="modal-mutasi-form"]')
    .forEach(b => b.addEventListener('click', () =>
      window.closeModal('modal-mutasi-form')));
  document.getElementById('modal-mutasi-form')
    ?.addEventListener('click', e => {
      if (e.target.id === 'modal-mutasi-form')
        window.closeModal('modal-mutasi-form');
    });

  // Jenis mutasi berubah → tampilkan/sembunyikan ke-kelas
  document.getElementById('mut-form-jenis')
    ?.addEventListener('change', e => {
      const keEl   = document.getElementById('mut-form-ke');
      const keWrap = keEl?.closest('.form-group');
      if (!keWrap) return;
      // Tampilkan "ke kelas" hanya untuk Pindah & Aktif Kembali
      const show = ['Pindah','Aktif Kembali'].includes(e.target.value);
      keWrap.style.display = show ? '' : 'none';
    });
}

/* ══════════════════════════════════════════════════════════════
   INIT MODUL
══════════════════════════════════════════════════════════════ */
(async function _init() {

  _wireKelasEvents();
  _wireWaliEvents();
  _wireMutasiEvents();
  _populateSelects();

  // ── Navigasi ke Kelas/Tingkatan ───────────────────── //
  window.addEventListener('madin:navigate', async e => {
    if (e.detail.page === 'kelas-tingkatan') {
      _wireKelasEvents();
      _populateSelects();
      _kl.kelasCache = await _loadKelas();
      _renderKelasGrid();
    }

    // ── Navigasi ke Wali Santri ──────────────────────── //
    if (e.detail.page === 'data-wali') {
      _wireWaliEvents();
      _kl.waliCache = _buildWaliCache();
      _renderWaliTable();
    }

    // ── Navigasi ke Riwayat Mutasi ───────────────────── //
    if (e.detail.page === 'riwayat-mutasi') {
      _wireMutasiEvents();
      _populateSelects();
      _kl.mutasiCache = await _loadMutasi();
      _renderMutasiTable();
    }
  });

  console.log('[Madin] Kelas module loaded ✓');

})();
