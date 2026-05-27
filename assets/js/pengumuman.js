/* ============================================================
   app.pengumuman.js — Manajemen Pengumuman Madrasah
   Portal Pengurus Madrasah Diniyah DQLM

   Fitur:
   - CRUD pengumuman (judul, isi, kategori, prioritas)
   - Status: Draft → Tayang → Arsip
   - Filter kategori, prioritas, status & pencarian
   - Preview pengumuman sebelum tayang
   - Statistik: total, tayang, draft, views
   - Export daftar pengumuman ke CSV
   ============================================================ */

'use strict';

/* ── KONSTANTA ───────────────────────────────────────────────── */
const KATEGORI_MAP = {
  umum:      { label:'Umum',         icon:'ph-megaphone',         color:'#3b82f6', bg:'rgba(59,130,246,.1)'  },
  akademik:  { label:'Akademik',     icon:'ph-book-open',         color:'#1a6b3c', bg:'rgba(26,107,60,.1)'   },
  keuangan:  { label:'Keuangan',     icon:'ph-currency-circle-dollar', color:'#f59e0b', bg:'rgba(245,158,11,.1)' },
  kegiatan:  { label:'Kegiatan',     icon:'ph-calendar-dots',     color:'#8b5cf6', bg:'rgba(139,92,246,.1)'  },
  darurat:   { label:'Darurat',      icon:'ph-warning-octagon',   color:'#ef4444', bg:'rgba(239,68,68,.1)'   },
  libur:     { label:'Libur',        icon:'ph-flag-banner',       color:'#14b8a6', bg:'rgba(20,184,166,.1)'  },
};

const PRIORITAS_MAP = {
  normal:    { label:'Normal',    badge:'neutral', icon:'ph-minus'          },
  penting:   { label:'Penting',   badge:'warning', icon:'ph-star'           },
  mendesak:  { label:'Mendesak',  badge:'danger',  icon:'ph-warning-circle' },
};

const STATUS_MAP = {
  draft:   { label:'Draft',   badge:'neutral', icon:'ph-pencil-simple' },
  tayang:  { label:'Tayang',  badge:'success', icon:'ph-broadcast'     },
  arsip:   { label:'Arsip',   badge:'info',    icon:'ph-archive'       },
};

const PAGE_SIZE_PGM = 10;

/* ── STATE ───────────────────────────────────────────────────── */
const _pg = {
  tab:         'daftar',    // 'daftar' | 'buat' | 'arsip'
  filterStatus:'tayang',
  filterKat:   '',
  filterPrio:  '',
  searchQ:     '',
  page:        1,
  cache:       [],
  editId:      null,
  previewData: null,
  isSubmitting:false,
};

/* ── UTILITAS ─────────────────────────────────────────────────── */
function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _x(str = '') {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _formatTgl(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
}

function _formatTglShort(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
}

function _timeAgo(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const m    = Math.floor(diff / 60000);
  const h    = Math.floor(m / 60);
  const d    = Math.floor(h / 24);
  if (d > 30)  return _formatTglShort(isoString.slice(0, 10));
  if (d > 0)   return `${d} hari lalu`;
  if (h > 0)   return `${h} jam lalu`;
  if (m > 0)   return `${m} menit lalu`;
  return 'Baru saja';
}

function _isKadaluarsa(tgl) {
  if (!tgl) return false;
  return new Date(tgl + 'T00:00:00') < new Date();
}

function _skeletonRows(r, c) {
  return Array.from({ length: r }, () =>
    `<tr>${Array.from({ length: c }, () =>
      `<td><div style="height:16px;background:rgba(26,107,60,.07);
           border-radius:4px;animation:pulse 1.5s infinite;"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

/* ── SUPABASE: LOAD PENGUMUMAN ───────────────────────────────── */
async function _loadPengumuman(status = '') {
  if (!window.supabase) return _dummyData();

  let q = window.supabase
    .from('pengumuman')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    console.error('[Pengumuman] Load error:', error.message);
    window.showToast('warning', 'Data Offline',
      'Menggunakan data cache lokal.');
    return _dummyData();
  }
  return data || [];
}

/* ── DUMMY DATA (fallback sebelum Supabase aktif) ────────────── */
function _dummyData() {
  return [
    {
      id: 'pgm-1', judul: 'Libur Hari Raya Idul Adha 1446 H',
      isi: 'Madrasah Diniyah diliburkan tanggal 7–9 Juni 2025 dalam rangka peringatan Hari Raya Idul Adha 1446 H. Kegiatan mengaji diliburkan selama 3 hari. Santri diharapkan tetap menjaga semangat belajar di rumah masing-masing. Jadwal normal kembali dimulai pada hari Senin, 10 Juni 2025.',
      kategori: 'libur', prioritas: 'penting', status: 'tayang',
      tgl_tayang: '2025-05-20', tgl_kadaluarsa: '2025-06-09',
      penulis_nama: 'Kepala Madrasah', views: 45,
      created_at: new Date(Date.now() - 3*24*60*60*1000).toISOString(),
    },
    {
      id: 'pgm-2', judul: 'Jadwal Imtihan Akhir Tahun 1446 H',
      isi: 'Imtihan akhir tahun ajaran 1446 H akan dilaksanakan mulai tanggal 20–25 Juni 2025. Seluruh santri diwajibkan hadir dan mempersiapkan diri dengan baik. Materi imtihan mencakup seluruh pelajaran semester ini. Orang tua/wali santri diharapkan mendampingi proses belajar di rumah.',
      kategori: 'akademik', prioritas: 'penting', status: 'tayang',
      tgl_tayang: '2025-05-15', tgl_kadaluarsa: '2025-06-25',
      penulis_nama: 'Admin Data', views: 62,
      created_at: new Date(Date.now() - 8*24*60*60*1000).toISOString(),
    },
    {
      id: 'pgm-3', judul: 'Pembukaan Pendaftaran Santri Baru 2025/2026',
      isi: 'Pendaftaran santri baru tahun ajaran 2025/2026 resmi dibuka mulai 1 Juni 2025. Kuota terbatas, segera daftarkan putra-putri Anda. Persyaratan: fotokopi KK, akta lahir, dan foto 3x4. Pendaftaran dilayani setiap hari Senin–Jumat pukul 08.00–14.00 WIB.',
      kategori: 'umum', prioritas: 'normal', status: 'tayang',
      tgl_tayang: '2025-05-10', tgl_kadaluarsa: '2025-07-31',
      penulis_nama: 'Admin Data', views: 88,
      created_at: new Date(Date.now() - 13*24*60*60*1000).toISOString(),
    },
    {
      id: 'pgm-4', judul: 'Rapat Wali Santri — Draft',
      isi: 'Akan diadakan rapat wali santri semester genap. Agenda: evaluasi akademik, pembahasan kegiatan akhir tahun, dan sosialisasi kebijakan baru madrasah.',
      kategori: 'kegiatan', prioritas: 'normal', status: 'draft',
      tgl_tayang: null, tgl_kadaluarsa: null,
      penulis_nama: 'Admin Data', views: 0,
      created_at: new Date(Date.now() - 1*24*60*60*1000).toISOString(),
    },
    {
      id: 'pgm-5', judul: 'Pengumuman Pembayaran SPP April 2025',
      isi: 'Diinformasikan kepada seluruh wali santri bahwa batas akhir pembayaran SPP bulan April 2025 adalah tanggal 15 April 2025. Bagi yang belum melunasi harap segera menghubungi bendahara madrasah.',
      kategori: 'keuangan', prioritas: 'penting', status: 'arsip',
      tgl_tayang: '2025-04-01', tgl_kadaluarsa: '2025-04-15',
      penulis_nama: 'Bendahara', views: 34,
      created_at: new Date(Date.now() - 45*24*60*60*1000).toISOString(),
    },
  ];
}

/* ── SUPABASE: SIMPAN PENGUMUMAN ─────────────────────────────── */
async function _savePengumuman(payload) {
  if (!window.supabase) {
    // Mode demo: simpan ke cache lokal
    if (_pg.editId) {
      const idx = _pg.cache.findIndex(x => x.id === _pg.editId);
      if (idx !== -1) _pg.cache[idx] = { ..._pg.cache[idx], ...payload };
    } else {
      _pg.cache.unshift({
        id: 'local-' + Date.now(), ...payload,
        views: 0,
        created_at: new Date().toISOString(),
      });
    }
    return true;
  }

  const row = {
    ...payload,
    penulis_id:  window.currentUser?.uid   || null,
    penulis_nama:window.currentUser?.namaLengkap
                 || window.currentUser?.displayName || 'Pengurus',
  };

  if (_pg.editId) {
    const { error } = await window.supabase
      .from('pengumuman').update(row).eq('id', _pg.editId);
    if (error) throw error;
  } else {
    const { error } = await window.supabase
      .from('pengumuman').insert(row);
    if (error) throw error;
  }
  return true;
}

/* ── SUPABASE: UPDATE STATUS ─────────────────────────────────── */
async function _updateStatus(id, status) {
  const update = {
    status,
    ...(status === 'tayang' && { tgl_tayang: _today() }),
  };

  if (!window.supabase) {
    const idx = _pg.cache.findIndex(x => x.id === id);
    if (idx !== -1) Object.assign(_pg.cache[idx], update);
    return true;
  }

  const { error } = await window.supabase
    .from('pengumuman').update(update).eq('id', id);
  if (error) {
    window.showToast('error', 'Gagal Update', error.message);
    return false;
  }
  return true;
}

/* ── SUPABASE: HAPUS ─────────────────────────────────────────── */
async function _deletePengumuman(id) {
  if (!window.supabase) {
    _pg.cache = _pg.cache.filter(x => x.id !== id);
    return true;
  }
  const { error } = await window.supabase
    .from('pengumuman').delete().eq('id', id);
  if (error) {
    window.showToast('error', 'Gagal Hapus', error.message);
    return false;
  }
  return true;
}

/* ── SUPABASE: INCREMENT VIEWS ───────────────────────────────── */
async function _incrementViews(id) {
  if (!window.supabase) return;
  await window.supabase.rpc('increment_views', { pgm_id: id })
    .catch(() => {
      // Fallback manual update jika RPC belum dibuat
      window.supabase.from('pengumuman')
        .update({ views: (_pg.cache.find(x => x.id === id)?.views || 0) + 1 })
        .eq('id', id);
    });
}

/* ── RELOAD CACHE ─────────────────────────────────────────────── */
async function _reload() {
  _pg.cache = await _loadPengumuman();
  _renderStatCards();
  _renderTable();
}

/* ============================================================
   app.pengumuman.js — Bagian 2: Render Stat Cards, Tabel,
                       Modal Form & Preview
   ============================================================ */

/* ── RENDER: STAT CARDS ──────────────────────────────────────── */
function _renderStatCards() {
  const el = document.getElementById('pgm-stat-cards');
  if (!el) return;

  const all      = _pg.cache;
  const tayang   = all.filter(x => x.status === 'tayang').length;
  const draft    = all.filter(x => x.status === 'draft').length;
  const arsip    = all.filter(x => x.status === 'arsip').length;
  const totalViews = all.reduce((s, x) => s + (x.views || 0), 0);
  const kadaluarsa = all.filter(x =>
    x.status === 'tayang' && _isKadaluarsa(x.tgl_kadaluarsa)
  ).length;

  el.innerHTML = `
    <div class="rekap-stats" style="margin-bottom:20px;">

      <div class="rekap-stat-card"
           style="border-top:3px solid var(--clr-primary);
                  cursor:pointer;"
           onclick="_filterTab('tayang')">
        <div class="rsc-label">
          <i class="ph-bold ph-broadcast"></i> Sedang Tayang
        </div>
        <div class="rsc-val"
             style="color:var(--clr-primary);">${tayang}</div>
        <div class="rsc-sub">Pengumuman aktif</div>
      </div>

      <div class="rekap-stat-card rsc-yellow"
           style="cursor:pointer;"
           onclick="_filterTab('draft')">
        <div class="rsc-label">
          <i class="ph-bold ph-pencil-simple"></i> Draft
        </div>
        <div class="rsc-val">${draft}</div>
        <div class="rsc-sub">Belum ditayangkan</div>
      </div>

      <div class="rekap-stat-card rsc-blue"
           style="cursor:pointer;"
           onclick="_filterTab('arsip')">
        <div class="rsc-label">
          <i class="ph-bold ph-archive"></i> Diarsipkan
        </div>
        <div class="rsc-val">${arsip}</div>
        <div class="rsc-sub">Sudah tidak aktif</div>
      </div>

      <div class="rekap-stat-card"
           style="border-top:3px solid #8b5cf6;">
        <div class="rsc-label">
          <i class="ph-bold ph-eye"></i> Total Dilihat
        </div>
        <div class="rsc-val"
             style="color:#7c3aed;">${totalViews}</div>
        <div class="rsc-sub">Akumulasi semua pengumuman</div>
      </div>

      ${kadaluarsa > 0 ? `
      <div class="rekap-stat-card rsc-red">
        <div class="rsc-label">
          <i class="ph-bold ph-warning-circle"></i> Kadaluarsa
        </div>
        <div class="rsc-val">${kadaluarsa}</div>
        <div class="rsc-sub">Perlu diarsipkan</div>
      </div>` : ''}

    </div>`;
}

/* ── FILTER TAB HELPER ───────────────────────────────────────── */
window._filterTab = function(status) {
  _pg.filterStatus = status;
  _pg.page = 1;

  document.querySelectorAll('[data-pgm-tab]').forEach(t => {
    t.classList.toggle('active', t.dataset.pgmTab === status);
  });
  _renderTable();
};

/* ── RENDER: TABEL PENGUMUMAN ────────────────────────────────── */
function _renderTable() {
  const tbody = document.getElementById('tbody-pgm');
  if (!tbody) return;

  // Terapkan filter
  let data = _pg.cache;

  if (_pg.filterStatus) {
    data = data.filter(x => x.status === _pg.filterStatus);
  }
  if (_pg.filterKat) {
    data = data.filter(x => x.kategori === _pg.filterKat);
  }
  if (_pg.filterPrio) {
    data = data.filter(x => x.prioritas === _pg.filterPrio);
  }
  if (_pg.searchQ) {
    const q = _pg.searchQ.toLowerCase();
    data = data.filter(x =>
      x.judul?.toLowerCase().includes(q) ||
      x.isi?.toLowerCase().includes(q)   ||
      x.penulis_nama?.toLowerCase().includes(q)
    );
  }

  // Paginasi
  const total = data.length;
  const start = (_pg.page - 1) * PAGE_SIZE_PGM;
  const page  = data.slice(start, start + PAGE_SIZE_PGM);

  // Update info
  const infoEl = document.getElementById('pgm-pagination-info');
  if (infoEl) {
    infoEl.textContent = total
      ? `${Math.min(start+1,total)}–${Math.min(start+PAGE_SIZE_PGM,total)} dari ${total}`
      : 'Tidak ada pengumuman';
  }

  if (!page.length) {
    tbody.innerHTML = `
      <tr><td colspan="7"
          style="text-align:center;padding:56px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-megaphone"
           style="font-size:32px;display:block;
                  margin-bottom:10px;opacity:.3;"></i>
        ${_pg.cache.length
          ? 'Tidak ada yang sesuai filter.'
          : 'Belum ada pengumuman. Klik "Buat Pengumuman" untuk memulai.'}
      </td></tr>`;
    _renderPager(total);
    return;
  }

  tbody.innerHTML = page.map(r => {
    const kat   = KATEGORI_MAP[r.kategori]  || KATEGORI_MAP.umum;
    const prio  = PRIORITAS_MAP[r.prioritas]|| PRIORITAS_MAP.normal;
    const st    = STATUS_MAP[r.status]      || STATUS_MAP.draft;
    const kdlrs = _isKadaluarsa(r.tgl_kadaluarsa);

    // Cuplikan isi (80 karakter)
    const snippet = (r.isi || '').replace(/<[^>]*>/g, '').slice(0, 80)
      + ((r.isi || '').length > 80 ? '…' : '');

    return `
      <tr ${kdlrs ? 'style="opacity:.7;"' : ''}>

        <!-- Kategori icon -->
        <td style="width:44px;text-align:center;">
          <div style="width:38px;height:38px;border-radius:8px;
                      background:${kat.bg};display:flex;
                      align-items:center;justify-content:center;
                      margin:0 auto;">
            <i class="ph-bold ${kat.icon}"
               style="font-size:18px;color:${kat.color};"></i>
          </div>
        </td>

        <!-- Judul & snippet -->
        <td style="max-width:280px;">
          <div style="font-weight:700;font-size:13.5px;
                      line-height:1.35;margin-bottom:4px;">
            ${_x(r.judul)}
            ${kdlrs
              ? `<span style="font-size:10px;font-weight:600;
                              color:var(--clr-danger);margin-left:6px;
                              background:rgba(239,68,68,.1);
                              padding:1px 6px;border-radius:99px;">
                   Kadaluarsa
                 </span>` : ''}
          </div>
          <p style="font-size:12px;color:var(--clr-text-muted);
                    line-height:1.4;">${_x(snippet)}</p>
        </td>

        <!-- Kategori badge -->
        <td>
          <span style="display:inline-flex;align-items:center;
                       gap:5px;padding:3px 10px;border-radius:99px;
                       font-size:11.5px;font-weight:600;
                       background:${kat.bg};color:${kat.color};">
            <i class="ph-bold ${kat.icon}"
               style="font-size:12px;"></i>
            ${kat.label}
          </span>
        </td>

        <!-- Prioritas -->
        <td>
          <span class="badge ${prio.badge}">
            <span class="badge-dot"></span>
            ${prio.label}
          </span>
        </td>

        <!-- Status -->
        <td>
          <span class="badge ${st.badge}">
            <span class="badge-dot"></span>
            ${st.label}
          </span>
        </td>

        <!-- Tanggal & penulis -->
        <td style="white-space:nowrap;">
          <div style="font-size:12.5px;font-weight:600;">
            ${_formatTglShort(r.tgl_tayang || r.created_at?.slice(0,10))}
          </div>
          <div style="font-size:11.5px;color:var(--clr-text-muted);
                      margin-top:2px;">
            <i class="ph-bold ph-user"
               style="font-size:11px;"></i>
            ${_x(r.penulis_nama || '—')}
          </div>
          <div style="font-size:11px;color:var(--clr-text-muted);">
            <i class="ph-bold ph-eye"
               style="font-size:11px;"></i>
            ${r.views || 0}×
          </div>
        </td>

        <!-- Aksi -->
        <td>
          <div class="tbl-actions" style="justify-content:center;">

            <!-- Preview -->
            <button class="btn-tbl view"
                    title="Preview"
                    data-pgm-preview="${r.id}">
              <i class="ph-bold ph-eye"></i>
            </button>

            <!-- Edit -->
            <button class="btn-tbl edit"
                    title="Edit"
                    data-pgm-edit="${r.id}">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>

            <!-- Toggle Status -->
            ${r.status === 'draft'
              ? `<button class="btn-tbl"
                         style="background:rgba(26,107,60,.08);
                                color:var(--clr-primary);
                                border:1.5px solid rgba(26,107,60,.15);"
                         title="Tayangkan"
                         data-pgm-tayang="${r.id}">
                   <i class="ph-bold ph-broadcast"></i>
                 </button>`
              : r.status === 'tayang'
              ? `<button class="btn-tbl"
                         style="background:rgba(59,130,246,.08);
                                color:var(--clr-info);
                                border:1.5px solid rgba(59,130,246,.15);"
                         title="Arsipkan"
                         data-pgm-arsip="${r.id}">
                   <i class="ph-bold ph-archive"></i>
                 </button>`
              : `<button class="btn-tbl"
                         style="background:rgba(245,158,11,.08);
                                color:var(--clr-warning);
                                border:1.5px solid rgba(245,158,11,.15);"
                         title="Tayangkan Ulang"
                         data-pgm-tayang="${r.id}">
                   <i class="ph-bold ph-arrow-counter-clockwise"></i>
                 </button>`
            }

            <!-- Hapus -->
            <button class="btn-tbl delete"
                    title="Hapus"
                    data-pgm-del="${r.id}"
                    data-pgm-judul="${_x(r.judul)}">
              <i class="ph-bold ph-trash"></i>
            </button>

          </div>
        </td>
      </tr>`;
  }).join('');

  // Wire event tombol aksi
  tbody.querySelectorAll('[data-pgm-preview]').forEach(b =>
    b.addEventListener('click', () => _openPreview(b.dataset.pgmPreview))
  );
  tbody.querySelectorAll('[data-pgm-edit]').forEach(b =>
    b.addEventListener('click', () => _openEdit(b.dataset.pgmEdit))
  );
  tbody.querySelectorAll('[data-pgm-tayang]').forEach(b =>
    b.addEventListener('click', () => _doTayang(b.dataset.pgmTayang))
  );
  tbody.querySelectorAll('[data-pgm-arsip]').forEach(b =>
    b.addEventListener('click', () => _doArsip(b.dataset.pgmArsip))
  );
  tbody.querySelectorAll('[data-pgm-del]').forEach(b =>
    b.addEventListener('click', () =>
      _doHapus(b.dataset.pgmDel, b.dataset.pgmJudul))
  );

  _renderPager(total);
}

/* ── RENDER: PAGINASI ────────────────────────────────────────── */
function _renderPager(total) {
  const wrap = document.getElementById('pgm-pager');
  if (!wrap) return;

  const tp = Math.max(1, Math.ceil(total / PAGE_SIZE_PGM));
  if (tp <= 1) { wrap.innerHTML = ''; return; }

  let h = `<button class="page-btn" id="pp-prev"
              ${_pg.page===1?'disabled':''}>
             <i class="ph-bold ph-caret-left"></i>
           </button>`;
  const lo = Math.max(1, _pg.page-2);
  const hi = Math.min(tp, _pg.page+2);
  if (lo>1) h += `<button class="page-btn" data-pp="1">1</button>`;
  if (lo>2) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  for (let p=lo; p<=hi; p++) {
    h += `<button class="page-btn${p===_pg.page?' active':''}"
                  data-pp="${p}">${p}</button>`;
  }
  if (hi<tp-1) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  if (hi<tp) h += `<button class="page-btn" data-pp="${tp}">${tp}</button>`;
  h += `<button class="page-btn" id="pp-next"
              ${_pg.page===tp?'disabled':''}>
             <i class="ph-bold ph-caret-right"></i>
           </button>`;
  wrap.innerHTML = h;
  wrap.querySelectorAll('[data-pp]').forEach(b =>
    b.addEventListener('click', () => { _pg.page=+b.dataset.pp; _renderTable(); })
  );
  wrap.querySelector('#pp-prev')
    ?.addEventListener('click', () => { _pg.page--; _renderTable(); });
  wrap.querySelector('#pp-next')
    ?.addEventListener('click', () => { _pg.page++; _renderTable(); });
}

/* ── AKSI: TAYANGKAN ─────────────────────────────────────────── */
async function _doTayang(id) {
  const ok = await _updateStatus(id, 'tayang');
  if (!ok) return;
  const idx = _pg.cache.findIndex(x => x.id === id);
  if (idx !== -1) {
    _pg.cache[idx].status     = 'tayang';
    _pg.cache[idx].tgl_tayang = _today();
  }
  _renderStatCards();
  _renderTable();
  window.showToast('success','Pengumuman Ditayangkan',
    'Pengumuman berhasil dipublikasikan.');
}

/* ── AKSI: ARSIPKAN ──────────────────────────────────────────── */
async function _doArsip(id) {
  const ok = await _updateStatus(id, 'arsip');
  if (!ok) return;
  const idx = _pg.cache.findIndex(x => x.id === id);
  if (idx !== -1) _pg.cache[idx].status = 'arsip';
  _renderStatCards();
  _renderTable();
  window.showToast('info','Pengumuman Diarsipkan',
    'Pengumuman dipindahkan ke arsip.');
}

/* ── AKSI: HAPUS ─────────────────────────────────────────────── */
function _doHapus(id, judul) {
  window.confirmDelete(
    `Pengumuman "${judul}" akan dihapus permanen.`,
    async () => {
      const ok = await _deletePengumuman(id);
      if (!ok) return;
      _pg.cache = _pg.cache.filter(x => x.id !== id);
      _renderStatCards();
      _renderTable();
      window.showToast('success','Dihapus',
        'Pengumuman berhasil dihapus.');
    }
  );
}

/* ── MODAL: PREVIEW PENGUMUMAN ───────────────────────────────── */
function _openPreview(id) {
  const r = _pg.cache.find(x => x.id === id);
  if (!r) return;

  _incrementViews(id);
  const idx = _pg.cache.findIndex(x => x.id === id);
  if (idx !== -1) _pg.cache[idx].views = (r.views || 0) + 1;

  const kat  = KATEGORI_MAP[r.kategori]  || KATEGORI_MAP.umum;
  const prio = PRIORITAS_MAP[r.prioritas]|| PRIORITAS_MAP.normal;
  const st   = STATUS_MAP[r.status]      || STATUS_MAP.draft;

  const el = document.getElementById('pgm-preview-body');
  if (!el) return;

  el.innerHTML = `
    <!-- Header preview -->
    <div style="display:flex;gap:14px;
                align-items:flex-start;margin-bottom:20px;">
      <div style="width:52px;height:52px;border-radius:12px;
                  background:${kat.bg};display:flex;
                  align-items:center;justify-content:center;
                  flex-shrink:0;">
        <i class="ph-bold ${kat.icon}"
           style="font-size:26px;color:${kat.color};"></i>
      </div>
      <div style="flex:1;">
        <h2 style="font-size:17px;font-weight:800;
                   line-height:1.3;margin-bottom:8px;">
          ${_x(r.judul)}
        </h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span style="background:${kat.bg};color:${kat.color};
                       font-size:11.5px;font-weight:600;
                       padding:2px 10px;border-radius:99px;">
            ${kat.label}
          </span>
          <span class="badge ${prio.badge}">
            <span class="badge-dot"></span>${prio.label}
          </span>
          <span class="badge ${st.badge}">
            <span class="badge-dot"></span>${st.label}
          </span>
        </div>
      </div>
    </div>

    <!-- Meta info -->
    <div style="display:flex;gap:20px;flex-wrap:wrap;
                padding:12px 16px;border-radius:10px;
                background:rgba(26,107,60,.05);
                border:1px solid rgba(26,107,60,.08);
                margin-bottom:20px;font-size:12.5px;">
      <div>
        <span style="color:var(--clr-text-muted);
                     margin-right:4px;">Penulis:</span>
        <strong>${_x(r.penulis_nama || '—')}</strong>
      </div>
      <div>
        <span style="color:var(--clr-text-muted);
                     margin-right:4px;">Dibuat:</span>
        <strong>${_timeAgo(r.created_at)}</strong>
      </div>
      ${r.tgl_tayang ? `
      <div>
        <span style="color:var(--clr-text-muted);
                     margin-right:4px;">Tayang:</span>
        <strong>${_formatTgl(r.tgl_tayang)}</strong>
      </div>` : ''}
      ${r.tgl_kadaluarsa ? `
      <div>
        <span style="color:var(--clr-text-muted);
                     margin-right:4px;">Kadaluarsa:</span>
        <strong style="color:${
          _isKadaluarsa(r.tgl_kadaluarsa)
            ? 'var(--clr-danger)' : 'inherit'};">
          ${_formatTgl(r.tgl_kadaluarsa)}
        </strong>
      </div>` : ''}
      <div>
        <span style="color:var(--clr-text-muted);
                     margin-right:4px;">
          <i class="ph-bold ph-eye"
             style="font-size:12px;"></i>
        </span>
        <strong>${r.views || 0} kali dilihat</strong>
      </div>
    </div>

    <!-- Isi pengumuman -->
    <div style="font-size:14px;line-height:1.8;
                color:var(--clr-text-main);
                white-space:pre-wrap;
                border-left:3px solid ${kat.color};
                padding-left:16px;">
      ${_x(r.isi)}
    </div>`;

  window.openModal('modal-pgm-preview');
}

/* ── MODAL: FORM TAMBAH / EDIT ───────────────────────────────── */
function _openTambah() {
  _pg.editId = null;
  const titleEl = document.getElementById('modal-pgm-title');
  const form    = document.getElementById('form-pgm');
  const lblEl   = document.getElementById('btn-simpan-pgm-label');
  if (titleEl) titleEl.textContent = 'Buat Pengumuman Baru';
  if (lblEl)   lblEl.textContent   = 'Simpan';
  if (form)    form.reset();

  // Set tanggal tayang default hari ini
  const tglEl = document.getElementById('pgm-tgl-tayang');
  if (tglEl) tglEl.value = _today();

  window.openModal('modal-pgm-form');
}

function _openEdit(id) {
  const r = _pg.cache.find(x => x.id === id);
  if (!r) return;
  _pg.editId = id;

  const titleEl = document.getElementById('modal-pgm-title');
  const lblEl   = document.getElementById('btn-simpan-pgm-label');
  if (titleEl) titleEl.textContent = 'Edit Pengumuman';
  if (lblEl)   lblEl.textContent   = 'Update';

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  set('pgm-judul',         r.judul);
  set('pgm-isi',           r.isi);
  set('pgm-kategori',      r.kategori);
  set('pgm-prioritas',     r.prioritas);
  set('pgm-status',        r.status);
  set('pgm-tgl-tayang',    r.tgl_tayang);
  set('pgm-tgl-kadaluarsa',r.tgl_kadaluarsa);

  window.openModal('modal-pgm-form');
}

/* ── SUBMIT FORM ─────────────────────────────────────────────── */
async function _submitForm() {
  if (_pg.isSubmitting) return;

  const judul    = document.getElementById('pgm-judul')?.value.trim();
  const isi      = document.getElementById('pgm-isi')?.value.trim();
  const kategori = document.getElementById('pgm-kategori')?.value;
  const prioritas= document.getElementById('pgm-prioritas')?.value || 'normal';
  const status   = document.getElementById('pgm-status')?.value    || 'draft';

  if (!judul || !isi || !kategori) {
    window.showToast('error','Validasi Gagal',
      'Judul, Isi, dan Kategori wajib diisi.'); return;
  }

  const payload = {
    judul, isi, kategori, prioritas, status,
    tgl_tayang:     document.getElementById('pgm-tgl-tayang')?.value    || null,
    tgl_kadaluarsa: document.getElementById('pgm-tgl-kadaluarsa')?.value|| null,
    penulis_nama:   window.currentUser?.namaLengkap
                    || window.currentUser?.displayName || 'Pengurus',
  };

  const btnSimpan = document.getElementById('btn-simpan-pgm');
  _pg.isSubmitting = true;
  if (btnSimpan) btnSimpan.disabled = true;

  try {
    await _savePengumuman(payload);
    window.showToast('success',
      _pg.editId ? 'Pengumuman Diperbarui' : 'Pengumuman Disimpan',
      `"${judul}" berhasil ${_pg.editId ? 'diperbarui' : 'disimpan'}.`
    );
    window.closeModal('modal-pgm-form');
    _pg.editId = null;
    await _reload();
  } catch (err) {
    window.showToast('error','Gagal Menyimpan',
      err?.message || 'Terjadi kesalahan.');
  } finally {
    _pg.isSubmitting = false;
    if (btnSimpan) btnSimpan.disabled = false;
  }
}

/* ── EXPORT CSV ──────────────────────────────────────────────── */
function _exportCSV() {
  const data = _pg.cache;
  if (!data.length) {
    window.showToast('warning','Tidak Ada Data',
      'Tidak ada pengumuman untuk diekspor.'); return;
  }
  const hdr  = ['Judul','Kategori','Prioritas','Status',
                 'Tgl Tayang','Tgl Kadaluarsa','Penulis','Views'];
  const rows = data.map(r => [
    r.judul,
    KATEGORI_MAP[r.kategori]?.label   || r.kategori,
    PRIORITAS_MAP[r.prioritas]?.label || r.prioritas,
    STATUS_MAP[r.status]?.label       || r.status,
    r.tgl_tayang     || '',
    r.tgl_kadaluarsa || '',
    r.penulis_nama   || '',
    r.views          || 0,
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));

  const csv  = [hdr,...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pengumuman-${_today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('success','Export Berhasil',
    `${data.length} pengumuman diekspor ke CSV.`);
}

/* ============================================================
   app.pengumuman.js — Bagian 3: Render View HTML,
                       Wire Events & Init
   ============================================================ */

/* ── WIRE: EVENT LISTENERS ───────────────────────────────────── */
function _wireEvents() {

  // ── Buat pengumuman baru ───────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-buat-pgm')) _openTambah();
  });

  // ── Simpan form (tayangkan) ────────────────────────── //
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-simpan-pgm')) return;
    // Pastikan status sesuai pilihan select
    _submitForm();
  });

  // ── Simpan sebagai draft ───────────────────────────── //
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-simpan-draft')) return;
    const statusEl = document.getElementById('pgm-status');
    if (statusEl) statusEl.value = 'draft';
    _submitForm();
  });

  // ── Cetak preview ──────────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-print-pgm')) window.print();
  });

  // ── Export CSV ─────────────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-export-pgm')) _exportCSV();
  });

  // ── Tab filter status ──────────────────────────────── //
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-pgm-tab]');
    if (!tab) return;

    document.querySelectorAll('[data-pgm-tab]')
      .forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    _pg.filterStatus = tab.dataset.pgmTab;
    _pg.page = 1;
    _renderTable();
  });

  // ── Filter kategori & prioritas ────────────────────── //
  document.addEventListener('change', e => {
    if (e.target.id === 'pgm-filter-kat') {
      _pg.filterKat = e.target.value;
      _pg.page = 1; _renderTable();
    }
    if (e.target.id === 'pgm-filter-prio') {
      _pg.filterPrio = e.target.value;
      _pg.page = 1; _renderTable();
    }
  });

  // ── Search ─────────────────────────────────────────── //
  document.addEventListener('input', e => {
    if (e.target.id !== 'pgm-search') return;
    _pg.searchQ = e.target.value;
    _pg.page    = 1;
    _renderTable();
  });

  // ── Close modal via data-close-modal ──────────────── //
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-close-modal]');
    if (!btn) return;
    const target = btn.dataset.closeModal;
    if (['modal-pgm-form','modal-pgm-preview'].includes(target)) {
      window.closeModal(target);
    }
  });

  // ── Klik overlay untuk tutup modal ────────────────── //
  ['modal-pgm-form','modal-pgm-preview'].forEach(id => {
    document.addEventListener('click', e => {
      const overlay = document.getElementById(id);
      if (e.target === overlay) window.closeModal(id);
    });
  });

  // ── Enter di form (kecuali textarea) ──────────────── //
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.closest('#form-pgm') &&
        e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      _submitForm();
    }
  });

}

/* ── ARSIPKAN OTOMATIS YANG KADALUARSA ───────────────────────── */
async function _autoArsipKadaluarsa() {
  const kadaluarsa = _pg.cache.filter(x =>
    x.status === 'tayang' && _isKadaluarsa(x.tgl_kadaluarsa)
  );
  if (!kadaluarsa.length) return;

  console.log(`[Pengumuman] Auto-arsip ${kadaluarsa.length} pengumuman kadaluarsa…`);

  for (const r of kadaluarsa) {
    await _updateStatus(r.id, 'arsip');
    const idx = _pg.cache.findIndex(x => x.id === r.id);
    if (idx !== -1) _pg.cache[idx].status = 'arsip';
  }

  if (kadaluarsa.length > 0) {
    window.showToast('info','Auto-Arsip',
      `${kadaluarsa.length} pengumuman kadaluarsa otomatis diarsipkan.`,
      6000);
    _renderStatCards();
    _renderTable();
  }
}

/* ── INIT MODUL ──────────────────────────────────────────────── */
(async function _init() {

  // 1. Pasang event listeners global untuk Modul Pengumuman
  _wireEvents();

  // 2. Re-render & load data setiap navigasi (routing) ke halaman Pengumuman
  window.addEventListener('madin:navigate', async e => {
    if (e.detail.page !== 'pengumuman') return;

    // Reset kelas aktif pada Tab Filter sesuai state terakhir (_pg.filterStatus)
    document.querySelectorAll('[data-pgm-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.pgmTab === _pg.filterStatus);
    });

    // Injeksi nilai Tanggal default di dalam modal (jika elemennya ada)
    const tglTayangEl = document.getElementById('pgm-tgl-tayang');
    if (tglTayangEl && !tglTayangEl.value) {
      tglTayangEl.value = _today();
    }

    // Load data dari Supabase / Dummy Cache
    _pg.cache = await _loadPengumuman();

    // Arsipkan yang kadaluarsa secara otomatis
    await _autoArsipKadaluarsa();

    // Render Data Dinamis (Hanya merekayasa innerHTML pada Tbody & Area StatCards)
    _renderStatCards();
    _renderTable();
  });

  console.log('[Madin] Pengumuman module loaded ✓ (SOP V2 Applied)');

})();
