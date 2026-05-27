/* ============================================================
   app.ustadz.js — Modul Data Ustadz, Jadwal & Honor
   Portal Pengurus Madrasah Diniyah DQLM

   Fitur:
   - CRUD data ustadz & pengurus
   - Jadwal mengajar per hari & kelas
   - Manajemen honor bulanan
   - Statistik: total aktif, mapel, honor terbayar
   - Export CSV
   ============================================================ */

'use strict';

/* ── KONSTANTA ───────────────────────────────────────────────── */
const HARI_LIST = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Ahad'];

const JABATAN_LIST = [
  'Kepala Madrasah','Wakil Kepala','Ustadz / Guru',
  'Bendahara','Sekretaris','Pengurus Harian','Wali Kelas',
];

const MAPEL_LIST = [
  'Al-Qur\'an / Tahfidz','Tajwid','Fiqih','Aqidah',
  'Akhlak','Hadits','Tafsir','Nahwu','Sharaf',
  'Bahasa Arab','Sejarah Islam','Imla\'',
];

const KELAS_LIST = [
  { val:'1', label:'Kelas 1 (Awwaliyah)'  },
  { val:'2', label:'Kelas 2 (Awwaliyah)'  },
  { val:'3', label:'Kelas 3 (Awwaliyah)'  },
  { val:'4', label:'Kelas 4 (Awwaliyah)'  },
];

const HONOR_DEFAULT = 500000; // Rp 500.000/bulan
const PAGE_SIZE_UST = 10;

/* ── STATE ───────────────────────────────────────────────────── */
const _us = {
  tab:          'data',     // 'data' | 'jadwal' | 'honor'
  searchQ:      '',
  filterStatus: '',
  filterJabatan:'',
  page:         1,
  cache:        [],         // semua ustadz
  jadwalCache:  [],         // semua jadwal
  honorCache:   [],         // honor bulan aktif
  bulanHonor:   _thisMonth(),
  editId:       null,
  viewId:       null,
  jadwalUstadzId: null,
};

/* ── UTILITAS ─────────────────────────────────────────────────── */
function _thisMonth() {
  return new Date().toISOString().slice(0, 7);
}
function _today() {
  return new Date().toISOString().slice(0, 10);
}
function _x(str = '') {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}
function _formatTglShort(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('id-ID', {
      day:'numeric', month:'short', year:'numeric'
    });
}
function _formatBulan(ym) {
  if (!ym) return '—';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m-1, 1)
    .toLocaleDateString('id-ID', { month:'long', year:'numeric' });
}
function _formatRp(n) {
  return new Intl.NumberFormat('id-ID', {
    style:'currency', currency:'IDR', minimumFractionDigits:0
  }).format(n || 0);
}
function _ini(name = '') {
  return name.split(' ').filter(Boolean).slice(0,2)
    .map(w => w[0]).join('').toUpperCase() || '?';
}
function _skeletonRows(r, c) {
  return Array.from({ length:r }, () =>
    `<tr>${Array.from({ length:c }, () =>
      `<td><div style="height:16px;background:rgba(26,107,60,.07);
           border-radius:4px;animation:pulse 1.5s infinite;"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

const AVATAR_COLORS = [
  ['rgba(26,107,60,.13)',  '#1a6b3c'],
  ['rgba(239,68,68,.11)',  '#dc2626'],
  ['rgba(245,158,11,.12)', '#b45309'],
  ['rgba(59,130,246,.12)', '#1d4ed8'],
  ['rgba(139,92,246,.12)', '#7c3aed'],
  ['rgba(20,184,166,.12)', '#0f766e'],
];
function _color(seed = '') {
  return AVATAR_COLORS[
    seed.charCodeAt(seed.length - 1) % AVATAR_COLORS.length
  ];
}

/* ── DUMMY DATA ──────────────────────────────────────────────── */
function _dummyUstadz() {
  return [
    {
      id:'u1', nip:'UST001', nama:'KH. Ahmad Fauzi Ridwan',
      jk:'L', jabatan:'Kepala Madrasah', spesialisasi:'Fiqih & Aqidah',
      status:'Aktif', no_hp:'0812-1111-2222',
      tgl_bergabung:'2015-01-10', catatan:'',
      ttl_tempat:'Sukabumi', ttl_tgl:'1975-03-15',
      alamat:'Jl. Pesantren No. 1',
      created_at: new Date().toISOString(),
    },
    {
      id:'u2', nip:'UST002', nama:'Ustadz Ridwan Maulana',
      jk:'L', jabatan:'Ustadz / Guru', spesialisasi:'Tahfidz Al-Qur\'an',
      status:'Aktif', no_hp:'0813-3333-4444',
      tgl_bergabung:'2018-07-01', catatan:'',
      ttl_tempat:'Bogor', ttl_tgl:'1988-09-20',
      alamat:'Kp. Sawah No. 5',
      created_at: new Date().toISOString(),
    },
    {
      id:'u3', nip:'UST003', nama:'Ustadzah Siti Maryam',
      jk:'P', jabatan:'Wali Kelas', spesialisasi:'Nahwu & Sharaf',
      status:'Aktif', no_hp:'0856-5555-6666',
      tgl_bergabung:'2019-01-15', catatan:'',
      ttl_tempat:'Bandung', ttl_tgl:'1992-06-08',
      alamat:'Jl. Melati No. 3',
      created_at: new Date().toISOString(),
    },
    {
      id:'u4', nip:'UST004', nama:'Ustadz Zainul Abidin',
      jk:'L', jabatan:'Bendahara', spesialisasi:'Akhlak & Hadits',
      status:'Aktif', no_hp:'0821-7777-8888',
      tgl_bergabung:'2017-03-01', catatan:'',
      ttl_tempat:'Garut', ttl_tgl:'1985-12-25',
      alamat:'Perum Griya No. 7',
      created_at: new Date().toISOString(),
    },
    {
      id:'u5', nip:'UST005', nama:'Ustadzah Nur Halimah',
      jk:'P', jabatan:'Sekretaris', spesialisasi:'Bahasa Arab',
      status:'Cuti', no_hp:'0878-9999-0000',
      tgl_bergabung:'2020-08-10', catatan:'Cuti melahirkan',
      ttl_tempat:'Tasikmalaya', ttl_tgl:'1995-04-17',
      alamat:'Jl. Kenanga No. 9',
      created_at: new Date().toISOString(),
    },
  ];
}

function _dummyJadwal() {
  return [
    { id:'j1', ustadz_id:'u2', hari:'Senin',   jam_mulai:'13:00', jam_selesai:'14:30', kelas:'1', mapel:'Al-Qur\'an / Tahfidz', ruang:'Kelas A' },
    { id:'j2', ustadz_id:'u2', hari:'Rabu',    jam_mulai:'13:00', jam_selesai:'14:30', kelas:'2', mapel:'Al-Qur\'an / Tahfidz', ruang:'Kelas B' },
    { id:'j3', ustadz_id:'u3', hari:'Selasa',  jam_mulai:'14:00', jam_selesai:'15:30', kelas:'1', mapel:'Nahwu', ruang:'Kelas A' },
    { id:'j4', ustadz_id:'u3', hari:'Kamis',   jam_mulai:'14:00', jam_selesai:'15:30', kelas:'2', mapel:'Sharaf', ruang:'Kelas B' },
    { id:'j5', ustadz_id:'u4', hari:'Jumat',   jam_mulai:'13:30', jam_selesai:'15:00', kelas:'3', mapel:'Akhlak', ruang:'Aula' },
    { id:'j6', ustadz_id:'u1', hari:'Sabtu',   jam_mulai:'08:00', jam_selesai:'09:30', kelas:'4', mapel:'Fiqih', ruang:'Kelas C' },
    { id:'j7', ustadz_id:'u1', hari:'Ahad',    jam_mulai:'08:00', jam_selesai:'09:30', kelas:'5', mapel:'Aqidah', ruang:'Kelas C' },
  ];
}

/* ── SUPABASE: LOAD ──────────────────────────────────────────── */
async function _loadUstadz() {
  if (!window.supabase) return _dummyUstadz();
  const { data, error } = await window.supabase
    .from('ustadz').select('*')
    .order('nama', { ascending: true });
  if (error) {
    console.warn('[Ustadz] Load error:', error.message);
    return _dummyUstadz();
  }
  return data || [];
}

async function _loadJadwal(ustadzId = null) {
  if (!window.supabase) {
    const dummy = _dummyJadwal();
    return ustadzId ? dummy.filter(j => j.ustadz_id === ustadzId) : dummy;
  }
  let q = window.supabase
    .from('jadwal')
    .select(`*, ustadz:ustadz_id ( nama, jabatan )`)
    .order('hari').order('jam_mulai');
  if (ustadzId) q = q.eq('ustadz_id', ustadzId);
  const { data, error } = await q;
  if (error) { console.warn('[Jadwal] Load error:', error.message); return []; }
  return data || [];
}

async function _loadHonor(bulan) {
  if (!window.supabase) {
    return _us.cache.map(u => ({
      id: 'h-' + u.id, ustadz_id: u.id,
      bulan, nominal: HONOR_DEFAULT,
      status: 'Belum', tgl_bayar: null,
      ustadz: { nama: u.nama, jabatan: u.jabatan },
    }));
  }
  const { data, error } = await window.supabase
    .from('honor')
    .select(`*, ustadz:ustadz_id ( nama, jabatan, status )`)
    .eq('bulan', bulan)
    .order('ustadz(nama)', { ascending: true });
  if (error) { console.warn('[Honor] Load error:', error.message); return []; }
  return data || [];
}

/* ── SUPABASE: SAVE USTADZ ───────────────────────────────────── */
async function _saveUstadz(payload) {
  if (!window.supabase) {
    if (_us.editId) {
      const idx = _us.cache.findIndex(x => x.id === _us.editId);
      if (idx !== -1) _us.cache[idx] = { ..._us.cache[idx], ...payload };
    } else {
      _us.cache.unshift({
        id: 'local-' + Date.now(), ...payload,
        created_at: new Date().toISOString(),
      });
    }
    return true;
  }
  if (_us.editId) {
    const { error } = await window.supabase
      .from('ustadz').update(payload).eq('id', _us.editId);
    if (error) throw error;
  } else {
    const { error } = await window.supabase
      .from('ustadz').insert(payload);
    if (error) throw error;
  }
  return true;
}

/* ── SUPABASE: DELETE USTADZ ─────────────────────────────────── */
async function _deleteUstadz(id) {
  if (!window.supabase) {
    _us.cache = _us.cache.filter(x => x.id !== id); return true;
  }
  const { error } = await window.supabase
    .from('ustadz').delete().eq('id', id);
  if (error) { window.showToast('error','Gagal Hapus',error.message); return false; }
  return true;
}

/* ── SUPABASE: SAVE JADWAL ───────────────────────────────────── */
async function _saveJadwal(payload) {
  if (!window.supabase) {
    _us.jadwalCache.unshift({
      id: 'jlocal-' + Date.now(), ...payload
    }); return true;
  }
  const { error } = await window.supabase
    .from('jadwal').insert(payload);
  if (error) throw error;
  return true;
}

async function _deleteJadwal(id) {
  if (!window.supabase) {
    _us.jadwalCache = _us.jadwalCache.filter(x => x.id !== id); return true;
  }
  const { error } = await window.supabase
    .from('jadwal').delete().eq('id', id);
  if (error) { window.showToast('error','Gagal Hapus',error.message); return false; }
  return true;
}

/* ── SUPABASE: BAYAR HONOR ───────────────────────────────────── */
async function _bayarHonor(honorId, ustadzId, nominal, nama) {
  const today = _today();
  if (!window.supabase) {
    const idx = _us.honorCache.findIndex(x => x.id === honorId);
    if (idx !== -1) {
      _us.honorCache[idx].status    = 'Lunas';
      _us.honorCache[idx].tgl_bayar = today;
    }
    window.showToast('success','Honor Dibayar',
      `${nama} — ${_formatRp(nominal)}`);
    _renderHonorTable(); _renderHonorStatCards(); return;
  }

  // Catat ke kas
  try {
    await window.supabase.from('kas').insert({
      tanggal:      today,
      jenis:        'keluar',
      kategori:     'honor',
      keterangan:   `Honor ${_formatBulan(_us.bulanHonor)} — ${nama}`,
      nominal,
      dicatat_oleh: window.currentUser?.uid || null,
    });
  } catch (e) {
    console.warn('[Honor] Kas insert skip:', e.message);
  }

  // Update status honor
  const { error } = await window.supabase
    .from('honor')
    .update({ status:'Lunas', tgl_bayar: today })
    .eq('id', honorId);

  if (error) {
    window.showToast('error','Gagal Update', error.message); return;
  }
  window.showToast('success','Honor Dibayar',
    `${nama} — ${_formatRp(nominal)} berhasil dicatat.`);

  _us.honorCache = await _loadHonor(_us.bulanHonor);
  _renderHonorTable(); _renderHonorStatCards();
}

/* ── GENERATE HONOR BULANAN ──────────────────────────────────── */
async function _generateHonor(bulan) {
  const aktif = _us.cache.filter(u => u.status === 'Aktif');
  if (!aktif.length) {
    window.showToast('warning','Tidak Ada Data',
      'Tidak ada ustadz aktif.'); return 0;
  }

  if (!window.supabase) {
    const exists = new Set(_us.honorCache.map(h => h.ustadz_id));
    aktif.filter(u => !exists.has(u.id)).forEach(u => {
      _us.honorCache.push({
        id:'hlocal-'+Date.now()+u.id,
        ustadz_id: u.id, bulan,
        nominal: HONOR_DEFAULT, status:'Belum', tgl_bayar: null,
        ustadz: { nama: u.nama, jabatan: u.jabatan },
      });
    });
    return aktif.length;
  }

  const { data: existing } = await window.supabase
    .from('honor').select('ustadz_id').eq('bulan', bulan);
  const existIds = new Set((existing||[]).map(r => r.ustadz_id));
  const toInsert = aktif
    .filter(u => !existIds.has(u.id))
    .map(u => ({
      ustadz_id: u.id, bulan,
      nominal: HONOR_DEFAULT, status: 'Belum',
    }));

  if (!toInsert.length) {
    window.showToast('info','Sudah Ada',
      'Honor bulan ini sudah pernah di-generate.'); return 0;
  }
  const { error } = await window.supabase.from('honor').insert(toInsert);
  if (error) {
    window.showToast('error','Gagal Generate', error.message); return 0;
  }
  return toInsert.length;
}

/* ── RELOAD ──────────────────────────────────────────────────── */
async function _reload() {
  _us.cache      = await _loadUstadz();
  _us.jadwalCache= await _loadJadwal();
  _us.honorCache = await _loadHonor(_us.bulanHonor);
  _renderStatCards();
  _renderUstadzTable();
  _renderJadwalGrid();
  _renderHonorStatCards();
  _renderHonorTable();
}

/* ============================================================
   app.ustadz.js — Bagian 2: Render Stat Cards, Tabel Ustadz,
                   Jadwal Grid & Honor
   ============================================================ */

/* ── RENDER: STAT CARDS ──────────────────────────────────────── */
function _renderStatCards() {
  const el = document.getElementById('ust-stat-cards');
  if (!el) return;

  const all    = _us.cache;
  const aktif  = all.filter(u => u.status === 'Aktif').length;
  const cuti   = all.filter(u => u.status === 'Cuti').length;
  const nonAkt = all.filter(u => u.status === 'Non-Aktif').length;
  const mapels = new Set(
    _us.jadwalCache.map(j => j.mapel).filter(Boolean)
  ).size;
  const honorBulanIni = _us.honorCache
    .filter(h => h.status === 'Lunas')
    .reduce((s, h) => s + (h.nominal || 0), 0);

  el.innerHTML = `
    <div class="stat-grid" style="margin-bottom:20px;">

      <div class="stat-card green">
        <div class="stat-icon">
          <i class="ph-bold ph-users"></i>
        </div>
        <div class="stat-content">
          <p class="stat-label">Ustadz Aktif</p>
          <p class="stat-value">${aktif}</p>
          <p class="stat-change up">
            <i class="ph-bold ph-arrow-up"></i>
            dari ${all.length} total
          </p>
        </div>
      </div>

      <div class="stat-card blue">
        <div class="stat-icon">
          <i class="ph-bold ph-calendar-dots"></i>
        </div>
        <div class="stat-content">
          <p class="stat-label">Total Jadwal Mengajar</p>
          <p class="stat-value">${_us.jadwalCache.length}</p>
          <p class="stat-change up">
            <i class="ph-bold ph-book-open"></i>
            ${mapels} mata pelajaran
          </p>
        </div>
      </div>

      <div class="stat-card orange">
        <div class="stat-icon">
          <i class="ph-bold ph-money"></i>
        </div>
        <div class="stat-content">
          <p class="stat-label">Honor Terbayar Bulan Ini</p>
          <p class="stat-value money">${
            honorBulanIni >= 1e6
              ? 'Rp ' + (honorBulanIni/1e6).toFixed(1) + ' jt'
              : _formatRp(honorBulanIni)
          }</p>
          <p class="stat-change up">
            <i class="ph-bold ph-check-circle"></i>
            ${_us.honorCache.filter(h=>h.status==='Lunas').length} ustadz lunas
          </p>
        </div>
      </div>

      ${cuti > 0 ? `
      <div class="stat-card" style="--stat-accent:#f59e0b;
           --stat-accent-bg:rgba(245,158,11,.1);">
        <div class="stat-icon">
          <i class="ph-bold ph-clock"
             style="color:#f59e0b;"></i>
        </div>
        <div class="stat-content">
          <p class="stat-label">Sedang Cuti</p>
          <p class="stat-value">${cuti}</p>
          <p class="stat-change"
             style="color:var(--clr-warning);">
            Tidak mengajar sementara
          </p>
        </div>
      </div>` : ''}

    </div>`;
}

/* ── RENDER: TABEL USTADZ ────────────────────────────────────── */
function _renderUstadzTable() {
  const tbody = document.getElementById('tbody-ustadz');
  if (!tbody) return;

  let data = _us.cache;
  if (_us.filterStatus) {
    data = data.filter(u => u.status === _us.filterStatus);
  }
  if (_us.filterJabatan) {
    data = data.filter(u => u.jabatan === _us.filterJabatan);
  }
  if (_us.searchQ) {
    const q = _us.searchQ.toLowerCase();
    data = data.filter(u =>
      u.nama?.toLowerCase().includes(q) ||
      u.nip?.includes(q)                ||
      u.spesialisasi?.toLowerCase().includes(q) ||
      u.jabatan?.toLowerCase().includes(q)
    );
  }

  const total = data.length;
  const start = (_us.page - 1) * PAGE_SIZE_UST;
  const page  = data.slice(start, start + PAGE_SIZE_UST);

  const infoEl = document.getElementById('ust-count-info');
  if (infoEl) infoEl.textContent = total
    ? `${Math.min(start+1,total)}–${Math.min(start+PAGE_SIZE_UST,total)} dari ${total}`
    : 'Tidak ada data';

  const badgeMap = {
    Aktif:'success', Cuti:'warning', 'Non-Aktif':'danger'
  };

  if (!page.length) {
    tbody.innerHTML = `
      <tr><td colspan="7"
          style="text-align:center;padding:52px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-users"
           style="font-size:30px;display:block;
                  margin-bottom:10px;opacity:.3;"></i>
        ${_us.cache.length
          ? 'Tidak ada yang sesuai filter.'
          : 'Belum ada data ustadz. Klik "Tambah Ustadz".'}
      </td></tr>`;
    _renderUstadzPager(total);
    return;
  }

  tbody.innerHTML = page.map((u, i) => {
    const [bg, fg]    = _color(u.nip || u.id);
    const jadwalCount = _us.jadwalCache
      .filter(j => j.ustadz_id === u.id).length;

    return `
      <tr>
        <td style="width:36px;text-align:center;
                   color:var(--clr-text-muted);font-size:12px;">
          ${start + i + 1}
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;border-radius:50%;
                        background:${bg};color:${fg};
                        display:flex;align-items:center;
                        justify-content:center;font-size:13px;
                        font-weight:700;flex-shrink:0;">
              ${_ini(u.nama)}
            </div>
            <div>
              <div style="font-weight:600;font-size:13.5px;">
                ${_x(u.nama)}
              </div>
              <div style="font-size:11.5px;
                          color:var(--clr-text-muted);">
                ${_x(u.spesialisasi || '—')}
              </div>
            </div>
          </div>
        </td>
        <td>
          <code style="font-size:12px;
                       background:rgba(26,107,60,.07);
                       padding:2px 7px;border-radius:5px;">
            ${_x(u.nip || '—')}
          </code>
        </td>
        <td style="font-size:13px;">${_x(u.jabatan || '—')}</td>
        <td>
          <span style="display:inline-flex;align-items:center;
                       gap:5px;font-size:12px;font-weight:600;
                       padding:3px 10px;border-radius:99px;
                       background:rgba(59,130,246,.1);
                       color:var(--clr-info);">
            <i class="ph-bold ph-calendar"
               style="font-size:12px;"></i>
            ${jadwalCount} jadwal
          </span>
        </td>
        <td>
          <span class="badge ${badgeMap[u.status]||'neutral'}">
            <span class="badge-dot"></span>
            ${u.status}
          </span>
        </td>
        <td>
          <div class="tbl-actions"
               style="justify-content:center;">
            <button class="btn-tbl view"
                    title="Detail & Jadwal"
                    data-ust-view="${u.id}">
              <i class="ph-bold ph-eye"></i>
            </button>
            <button class="btn-tbl edit"
                    title="Edit"
                    data-ust-edit="${u.id}">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>
            <button class="btn-tbl"
                    title="Lihat Jadwal"
                    data-ust-jadwal="${u.id}"
                    style="background:rgba(139,92,246,.08);
                           color:#7c3aed;
                           border:1.5px solid rgba(139,92,246,.15);">
              <i class="ph-bold ph-calendar-dots"></i>
            </button>
            <button class="btn-tbl delete"
                    title="Hapus"
                    data-ust-del="${u.id}"
                    data-ust-nama="${_x(u.nama)}">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Wire tombol aksi
  tbody.querySelectorAll('[data-ust-view]').forEach(b =>
    b.addEventListener('click', () => _openDetail(b.dataset.ustView))
  );
  tbody.querySelectorAll('[data-ust-edit]').forEach(b =>
    b.addEventListener('click', () => _openEdit(b.dataset.ustEdit))
  );
  tbody.querySelectorAll('[data-ust-jadwal]').forEach(b =>
    b.addEventListener('click', () => _openJadwalUstadz(b.dataset.ustJadwal))
  );
  tbody.querySelectorAll('[data-ust-del]').forEach(b =>
    b.addEventListener('click', () =>
      _doHapus(b.dataset.ustDel, b.dataset.ustNama))
  );

  _renderUstadzPager(total);
}

/* ── PAGINASI USTADZ ─────────────────────────────────────────── */
function _renderUstadzPager(total) {
  const wrap = document.getElementById('ust-pager');
  if (!wrap) return;

  const tp = Math.max(1, Math.ceil(total / PAGE_SIZE_UST));
  if (tp <= 1) { wrap.innerHTML = ''; return; }

  let h = `<button class="page-btn" id="up-prev"
              ${_us.page===1?'disabled':''}>
             <i class="ph-bold ph-caret-left"></i>
           </button>`;
  const lo = Math.max(1, _us.page-2);
  const hi = Math.min(tp, _us.page+2);
  if (lo>1) h += `<button class="page-btn" data-up="1">1</button>`;
  if (lo>2) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  for (let p=lo; p<=hi; p++) {
    h += `<button class="page-btn${p===_us.page?' active':''}"
                  data-up="${p}">${p}</button>`;
  }
  if (hi<tp-1) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  if (hi<tp) h += `<button class="page-btn" data-up="${tp}">${tp}</button>`;
  h += `<button class="page-btn" id="up-next"
              ${_us.page===tp?'disabled':''}>
             <i class="ph-bold ph-caret-right"></i>
           </button>`;
  wrap.innerHTML = h;
  wrap.querySelectorAll('[data-up]').forEach(b =>
    b.addEventListener('click', () => {
      _us.page = +b.dataset.up; _renderUstadzTable();
    })
  );
  wrap.querySelector('#up-prev')
    ?.addEventListener('click', () => { _us.page--; _renderUstadzTable(); });
  wrap.querySelector('#up-next')
    ?.addEventListener('click', () => { _us.page++; _renderUstadzTable(); });
}

/* ── RENDER: JADWAL GRID (per hari) ──────────────────────────── */
function _renderJadwalGrid() {
  const wrap = document.getElementById('jadwal-grid-wrap');
  if (!wrap) return;

  if (!_us.jadwalCache.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="padding:48px;">
        <div class="empty-state-icon">
          <i class="ph-bold ph-calendar-dots"></i>
        </div>
        <p class="empty-state-title">Belum Ada Jadwal</p>
        <p class="empty-state-msg">
          Klik "Tambah Jadwal" untuk membuat jadwal mengajar.
        </p>
      </div>`;
    return;
  }

  // Grup per hari
  const byHari = {};
  HARI_LIST.forEach(h => { byHari[h] = []; });
  _us.jadwalCache.forEach(j => {
    if (byHari[j.hari]) byHari[j.hari].push(j);
  });
  HARI_LIST.forEach(h => {
    byHari[h].sort((a,b) => (a.jam_mulai||'').localeCompare(b.jam_mulai||''));
  });

  // Lookup nama ustadz
  const namaMap = {};
  _us.cache.forEach(u => { namaMap[u.id] = u.nama; });

  wrap.innerHTML = HARI_LIST.map(hari => {
    const items = byHari[hari];
    const klsLabel = { '1':'Kls 1','2':'Kls 2','3':'Kls 3',
                       '4':'Kls 4','5':'Kls 5' };
    return `
      <div class="card" style="break-inside:avoid;
                               margin-bottom:16px;">
        <div style="padding:12px 16px;
                    border-bottom:1px solid rgba(26,107,60,.08);
                    display:flex;align-items:center;
                    justify-content:space-between;">
          <p style="font-size:13.5px;font-weight:700;
                    color:var(--clr-primary);">
            <i class="ph-bold ph-calendar-blank"
               style="font-size:14px;margin-right:5px;"></i>
            ${hari}
          </p>
          <span style="font-size:12px;
                       color:var(--clr-text-muted);">
            ${items.length} sesi
          </span>
        </div>

        ${items.length ? items.map(j => {
          const [bg, fg] = _color(j.ustadz_id || '');
          const nama     = j.ustadz?.nama
                        || namaMap[j.ustadz_id] || '—';
          const klsLbl   = klsLabel[j.kelas] || `Kls ${j.kelas}`;
          return `
            <div style="padding:10px 16px;
                        border-bottom:1px solid rgba(26,107,60,.05);
                        display:flex;gap:12px;align-items:flex-start;">
              <!-- Waktu -->
              <div style="min-width:80px;text-align:center;
                          padding:6px 8px;
                          background:rgba(26,107,60,.07);
                          border-radius:8px;flex-shrink:0;">
                <div style="font-size:12.5px;font-weight:700;
                             color:var(--clr-primary);">
                  ${j.jam_mulai?.slice(0,5)||'—'}
                </div>
                <div style="font-size:10px;
                             color:var(--clr-text-muted);">
                  s/d ${j.jam_selesai?.slice(0,5)||'—'}
                </div>
              </div>
              <!-- Info -->
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;
                             margin-bottom:3px;">
                  ${_x(j.mapel)}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;
                             align-items:center;">
                  <span style="font-size:11.5px;
                               background:rgba(26,107,60,.08);
                               color:var(--clr-primary);
                               padding:1px 8px;border-radius:99px;
                               font-weight:600;">
                    ${klsLbl}
                  </span>
                  ${j.ruang ? `
                  <span style="font-size:11.5px;
                               color:var(--clr-text-muted);">
                    <i class="ph-bold ph-door"
                       style="font-size:11px;"></i>
                    ${_x(j.ruang)}
                  </span>` : ''}
                  <!-- Avatar ustadz -->
                  <span style="display:inline-flex;
                               align-items:center;gap:5px;
                               font-size:11.5px;">
                    <span style="width:18px;height:18px;
                                 border-radius:50%;
                                 background:${bg};color:${fg};
                                 font-size:9px;font-weight:700;
                                 display:inline-flex;
                                 align-items:center;
                                 justify-content:center;">
                      ${_ini(nama)}
                    </span>
                    ${_x(nama.split(' ').slice(0,2).join(' '))}
                  </span>
                </div>
              </div>
              <!-- Hapus -->
              <button class="btn-tbl delete"
                      style="flex-shrink:0;"
                      title="Hapus jadwal ini"
                      data-jadwal-del="${j.id}">
                <i class="ph-bold ph-trash"></i>
              </button>
            </div>`;
        }).join('') : `
          <div style="padding:24px;text-align:center;
                      color:var(--clr-text-muted);font-size:13px;">
            Tidak ada jadwal hari ini.
          </div>`}
      </div>`;
  }).join('');

  // Wire tombol hapus jadwal
  wrap.querySelectorAll('[data-jadwal-del]').forEach(b =>
    b.addEventListener('click', () => {
      window.confirmDelete(
        'Jadwal mengajar ini akan dihapus.',
        async () => {
          const ok = await _deleteJadwal(b.dataset.jadwalDel);
          if (!ok) return;
          _us.jadwalCache = _us.jadwalCache
            .filter(j => j.id !== b.dataset.jadwalDel);
          _renderJadwalGrid();
          _renderStatCards();
          window.showToast('success','Jadwal Dihapus',
            'Jadwal berhasil dihapus.');
        }
      );
    })
  );
}

/* ── RENDER: HONOR STAT CARDS ────────────────────────────────── */
function _renderHonorStatCards() {
  const el = document.getElementById('honor-stat-cards');
  if (!el) return;

  const data   = _us.honorCache;
  const lunas  = data.filter(h => h.status === 'Lunas').length;
  const belum  = data.filter(h => h.status === 'Belum').length;
  const total  = data.length;
  const totNom = data.filter(h => h.status === 'Lunas')
    .reduce((s,h) => s + (h.nominal||0), 0);
  const sisaNom= data.filter(h => h.status === 'Belum')
    .reduce((s,h) => s + (h.nominal||0), 0);
  const pct    = total ? Math.round((lunas/total)*100) : 0;

  el.innerHTML = `
    <div class="rekap-stats" style="margin-bottom:20px;">
      <div class="rekap-stat-card rsc-green">
        <div class="rsc-label">
          <i class="ph-bold ph-check-circle"></i> Sudah Dibayar
        </div>
        <div class="rsc-val">${lunas}</div>
        <div class="rsc-sub">${pct}% dari total</div>
      </div>
      <div class="rekap-stat-card rsc-red">
        <div class="rsc-label">
          <i class="ph-bold ph-clock"></i> Belum Dibayar
        </div>
        <div class="rsc-val">${belum}</div>
        <div class="rsc-sub">${_formatRp(sisaNom)} sisa</div>
      </div>
      <div class="rekap-stat-card"
           style="border-top:3px solid var(--clr-primary);">
        <div class="rsc-label">
          <i class="ph-bold ph-money"></i> Total Terbayar
        </div>
        <div class="rsc-val"
             style="font-size:16px;color:var(--clr-primary);">
          ${_formatRp(totNom)}
        </div>
        <div class="rsc-sub">Bulan ${_formatBulan(_us.bulanHonor)}</div>
      </div>
      <div class="rekap-stat-card rsc-blue">
        <div class="rsc-label">
          <i class="ph-bold ph-users"></i> Total Ustadz
        </div>
        <div class="rsc-val">${total}</div>
        <div class="rsc-sub">Tertagih bulan ini</div>
      </div>
    </div>`;
}

/* ── RENDER: TABEL HONOR ─────────────────────────────────────── */
function _renderHonorTable() {
  const tbody = document.getElementById('tbody-honor');
  if (!tbody) return;

  let data = _us.honorCache;

  // Filter status
  const stEl = document.getElementById('honor-filter-status');
  const stVal = stEl?.value || '';
  if (stVal) data = data.filter(h => h.status === stVal);

  // Search
  const q = document.getElementById('honor-search')
    ?.value.toLowerCase().trim() || '';
  if (q) data = data.filter(h =>
    h.ustadz?.nama?.toLowerCase().includes(q)
  );

  if (!data.length) {
    tbody.innerHTML = `
      <tr><td colspan="6"
          style="text-align:center;padding:48px;
                 color:var(--clr-text-muted);">
        ${_us.honorCache.length
          ? 'Tidak ada yang sesuai filter.'
          : 'Klik "Generate Honor" untuk membuat daftar honor bulan ini.'}
      </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((h, i) => {
    const isLunas = h.status === 'Lunas';
    const nama    = h.ustadz?.nama || '—';
    const jabatan = h.ustadz?.jabatan || '—';
    const [bg, fg]= _color(h.ustadz_id || '');

    return `
      <tr>
        <td style="text-align:center;font-size:12px;
                   color:var(--clr-text-muted);">${i+1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:50%;
                        background:${bg};color:${fg};
                        display:flex;align-items:center;
                        justify-content:center;font-size:12px;
                        font-weight:700;flex-shrink:0;">
              ${_ini(nama)}
            </div>
            <div>
              <div style="font-weight:600;font-size:13.5px;">
                ${_x(nama)}
              </div>
              <div style="font-size:11.5px;
                          color:var(--clr-text-muted);">
                ${_x(jabatan)}
              </div>
            </div>
          </div>
        </td>
        <td style="font-family:monospace;font-weight:700;
                   font-size:13.5px;">
          ${_formatRp(h.nominal)}
        </td>
        <td>
          <span class="badge ${isLunas?'success':'danger'}">
            <span class="badge-dot"></span>
            ${h.status}
          </span>
        </td>
        <td style="font-size:13px;color:var(--clr-text-sub);">
          ${h.tgl_bayar ? _formatTglShort(h.tgl_bayar) : '—'}
        </td>
        <td>
          ${!isLunas ? `
            <button class="btn btn-primary btn-sm"
                    data-honor-bayar="${h.id}"
                    data-honor-ust-id="${h.ustadz_id}"
                    data-honor-nominal="${h.nominal}"
                    data-honor-nama="${_x(nama)}">
              <i class="ph-bold ph-money"></i> Bayar
            </button>` : `
            <span style="font-size:12px;
                         color:var(--clr-text-muted);">
              <i class="ph-bold ph-check"
                 style="color:var(--clr-success);"></i>
              Lunas
            </span>`}
        </td>
      </tr>`;
  }).join('');

  // Wire tombol bayar
  tbody.querySelectorAll('[data-honor-bayar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id      = btn.dataset.honorBayar;
      const ustId   = btn.dataset.honorUstId;
      const nominal = parseInt(btn.dataset.honorNominal);
      const nama    = btn.dataset.honorNama;
      window.confirmDelete(
        `Catat pembayaran honor ${_formatBulan(_us.bulanHonor)} ` +
        `untuk ${nama} sejumlah ${_formatRp(nominal)}?`,
        () => _bayarHonor(id, ustId, nominal, nama)
      );
      requestAnimationFrame(() => {
        const ok  = document.getElementById('modal-confirm-ok');
        const ico = document.querySelector(
          '#modal-confirm .modal-confirm-icon i');
        if (ok) {
          ok.className = 'btn btn-primary';
          ok.innerHTML =
            '<i class="ph-bold ph-money"></i> Ya, Bayar';
        }
        if (ico) ico.className = 'ph-bold ph-money';
      });
    });
  });
}

/* ── AKSI: HAPUS USTADZ ──────────────────────────────────────── */
function _doHapus(id, nama) {
  window.confirmDelete(
    `Data ustadz "${nama}" beserta jadwalnya akan dihapus permanen.`,
    async () => {
      const ok = await _deleteUstadz(id);
      if (!ok) return;
      _us.cache       = _us.cache.filter(u => u.id !== id);
      _us.jadwalCache = _us.jadwalCache.filter(j => j.ustadz_id !== id);
      _us.honorCache  = _us.honorCache.filter(h => h.ustadz_id !== id);
      _renderStatCards();
      _renderUstadzTable();
      _renderJadwalGrid();
      _renderHonorStatCards();
      _renderHonorTable();
      window.showToast('success','Ustadz Dihapus',
        `${nama} berhasil dihapus dari sistem.`);
    }
  );
}

/* ── MODAL: DETAIL USTADZ ────────────────────────────────────── */
function _openDetail(id) {
  const u = _us.cache.find(x => x.id === id);
  if (!u) return;
  _us.viewId = id;

  const [bg, fg] = _color(u.nip || id);
  const jadwal   = _us.jadwalCache.filter(j => j.ustadz_id === id);
  const badgeMap = { Aktif:'success', Cuti:'warning', 'Non-Aktif':'danger' };

  const el = document.getElementById('ust-detail-body');
  if (!el) return;

  el.innerHTML = `
    <!-- Avatar & nama -->
    <div style="display:flex;gap:16px;align-items:flex-start;
                margin-bottom:20px;">
      <div style="width:56px;height:56px;border-radius:50%;
                  background:${bg};color:${fg};
                  display:flex;align-items:center;
                  justify-content:center;font-size:22px;
                  font-weight:700;flex-shrink:0;">
        ${_ini(u.nama)}
      </div>
      <div style="flex:1;">
        <p style="font-size:16px;font-weight:800;margin-bottom:6px;">
          ${_x(u.nama)}
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span class="badge ${badgeMap[u.status]||'neutral'}">
            <span class="badge-dot"></span>${u.status}
          </span>
          <span class="badge neutral">
            <span class="badge-dot"></span>
            ${_x(u.jabatan||'—')}
          </span>
        </div>
      </div>
    </div>

    <!-- Data pribadi -->
    <p class="modal-section-label">Data Pribadi</p>
    <div class="detail-grid" style="margin-bottom:16px;">
      <div>
        <p class="detail-label">NIP</p>
        <p class="detail-val">${_x(u.nip||'—')}</p>
      </div>
      <div>
        <p class="detail-label">Jenis Kelamin</p>
        <p class="detail-val">
          ${u.jk==='P' ? 'Perempuan' : 'Laki-laki'}
        </p>
      </div>
      <div>
        <p class="detail-label">No. HP</p>
        <p class="detail-val">${_x(u.no_hp||'—')}</p>
      </div>
      <div>
        <p class="detail-label">Bergabung</p>
        <p class="detail-val">
          ${_formatTglShort(u.tgl_bergabung)}
        </p>
      </div>
      <div>
        <p class="detail-label">Spesialisasi</p>
        <p class="detail-val">${_x(u.spesialisasi||'—')}</p>
      </div>
      <div>
        <p class="detail-label">Email</p>
        <p class="detail-val">${_x(u.email||'—')}</p>
      </div>
      ${u.alamat ? `
      <div style="grid-column:1/-1;">
        <p class="detail-label">Alamat</p>
        <p class="detail-val">${_x(u.alamat)}</p>
      </div>` : ''}
    </div>

    <!-- Jadwal mengajar -->
    <p class="modal-section-label">
      Jadwal Mengajar (${jadwal.length} sesi)
    </p>
    ${jadwal.length ? `
    <div style="display:flex;flex-direction:column;gap:6px;
                margin-bottom:12px;">
      ${jadwal.map(j => `
        <div style="display:flex;gap:10px;align-items:center;
                    padding:8px 12px;border-radius:8px;
                    background:rgba(26,107,60,.05);
                    border:1px solid rgba(26,107,60,.08);">
          <span style="font-size:12px;font-weight:700;
                       color:var(--clr-primary);min-width:52px;">
            ${j.hari}
          </span>
          <span style="font-size:12px;color:var(--clr-text-muted);
                       min-width:100px;">
            ${j.jam_mulai?.slice(0,5)||'—'} – ${j.jam_selesai?.slice(0,5)||'—'}
          </span>
          <span style="font-size:12.5px;font-weight:600;flex:1;">
            ${_x(j.mapel)}
          </span>
          <span style="font-size:11.5px;
                       background:rgba(26,107,60,.1);
                       color:var(--clr-primary);
                       padding:1px 8px;border-radius:99px;">
            Kls ${j.kelas}
          </span>
        </div>`).join('')}
    </div>` : `
    <p style="font-size:13px;color:var(--clr-text-muted);
              margin-bottom:12px;font-style:italic;">
      Belum ada jadwal mengajar.
    </p>`}

    ${u.catatan ? `
    <p class="modal-section-label">Catatan</p>
    <p style="font-size:13px;line-height:1.6;">
      ${_x(u.catatan)}
    </p>` : ''}
  `;

  window.openModal('modal-ust-detail');
}

/* ============================================================
   app.ustadz.js — Bagian 3: Form Modal, View HTML,
                   Wire Events & Init
   ============================================================ */

/* ── MODAL: FORM TAMBAH / EDIT USTADZ ───────────────────────── */
function _openTambah() {
  _us.editId = null;
  const titleEl = document.getElementById('modal-ust-title');
  const lblEl   = document.getElementById('btn-simpan-ust-label');
  const form    = document.getElementById('form-ust');
  if (titleEl) titleEl.textContent = 'Tambah Ustadz / Pengurus';
  if (lblEl)   lblEl.textContent   = 'Simpan';
  if (form)    form.reset();

  const tglEl = document.getElementById('ust-tgl-bergabung');
  if (tglEl)  tglEl.value = _today();

  window.openModal('modal-ust-form');
}

function _openEdit(id) {
  const u = _us.cache.find(x => x.id === id);
  if (!u) return;
  _us.editId = id;

  const titleEl = document.getElementById('modal-ust-title');
  const lblEl   = document.getElementById('btn-simpan-ust-label');
  if (titleEl) titleEl.textContent = 'Edit Data Ustadz';
  if (lblEl)   lblEl.textContent   = 'Update';

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  set('ust-nip',          u.nip);
  set('ust-nama',         u.nama);
  set('ust-jabatan',      u.jabatan);
  set('ust-spesialisasi', u.spesialisasi);
  set('ust-status',       u.status);
  set('ust-no-hp',        u.no_hp);
  set('ust-email',        u.email);
  set('ust-ttl-tempat',   u.ttl_tempat);
  set('ust-ttl-tgl',      u.ttl_tgl);
  set('ust-alamat',       u.alamat);
  set('ust-tgl-bergabung',u.tgl_bergabung);
  set('ust-catatan',      u.catatan);

  document.querySelectorAll('input[name="ust-jk"]')
    .forEach(r => { r.checked = r.value === u.jk; });

  window.openModal('modal-ust-form');
}

async function _submitForm() {
  const nama     = document.getElementById('ust-nama')?.value.trim();
  const jabatan  = document.getElementById('ust-jabatan')?.value;
  const status   = document.getElementById('ust-status')?.value || 'Aktif';

  if (!nama || !jabatan) {
    window.showToast('error','Validasi Gagal',
      'Nama dan Jabatan wajib diisi.'); return;
  }

  const jkEl   = document.querySelector('input[name="ust-jk"]:checked');
  const payload = {
    nip:          document.getElementById('ust-nip')?.value.trim()      || null,
    nama,
    jk:           jkEl?.value || 'L',
    jabatan,
    spesialisasi: document.getElementById('ust-spesialisasi')?.value.trim() || null,
    status,
    no_hp:        document.getElementById('ust-no-hp')?.value.trim()    || null,
    email:        document.getElementById('ust-email')?.value.trim()    || null,
    ttl_tempat:   document.getElementById('ust-ttl-tempat')?.value.trim()|| null,
    ttl_tgl:      document.getElementById('ust-ttl-tgl')?.value         || null,
    alamat:       document.getElementById('ust-alamat')?.value.trim()   || null,
    tgl_bergabung:document.getElementById('ust-tgl-bergabung')?.value   || null,
    catatan:      document.getElementById('ust-catatan')?.value.trim()  || null,
  };

  const btnSimpan = document.getElementById('btn-simpan-ust');
  if (btnSimpan) btnSimpan.disabled = true;

  try {
    await _saveUstadz(payload);
    window.showToast('success',
      _us.editId ? 'Data Diperbarui' : 'Ustadz Ditambahkan',
      `${nama} berhasil ${_us.editId ? 'diperbarui' : 'ditambahkan'}.`
    );
    window.closeModal('modal-ust-form');
    _us.editId = null;
    _us.cache  = await _loadUstadz();
    _renderStatCards();
    _renderUstadzTable();
  } catch (err) {
    window.showToast('error','Gagal Menyimpan',
      err?.message || 'Terjadi kesalahan.');
  } finally {
    if (btnSimpan) btnSimpan.disabled = false;
  }
}

/* ── MODAL: JADWAL USTADZ TERTENTU ──────────────────────────── */
function _openJadwalUstadz(ustadzId) {
  const u      = _us.cache.find(x => x.id === ustadzId);
  if (!u) return;
  _us.jadwalUstadzId = ustadzId;

  const titleEl = document.getElementById('modal-jadwal-title');
  if (titleEl) titleEl.textContent = `Jadwal — ${u.nama}`;

  const selEl = document.getElementById('jadwal-ust-select');
  if (selEl) selEl.value = ustadzId;

  _renderJadwalModalList(ustadzId);
  window.openModal('modal-jadwal');
}

function _renderJadwalModalList(ustadzId) {
  const wrap = document.getElementById('jadwal-modal-list');
  if (!wrap) return;

  const list = _us.jadwalCache
    .filter(j => j.ustadz_id === ustadzId)
    .sort((a,b) => {
      const hi = HARI_LIST.indexOf(a.hari) - HARI_LIST.indexOf(b.hari);
      return hi !== 0 ? hi : (a.jam_mulai||'').localeCompare(b.jam_mulai||'');
    });

  const klsLabel = { '1':'Kelas 1','2':'Kelas 2','3':'Kelas 3',
                     '4':'Kelas 4','5':'Kelas 5' };

  wrap.innerHTML = list.length ? list.map(j => `
    <div style="display:flex;gap:10px;align-items:center;
                padding:10px 14px;border-radius:8px;
                background:rgba(26,107,60,.04);
                border:1px solid rgba(26,107,60,.08);
                margin-bottom:8px;">
      <span style="min-width:52px;font-size:12px;font-weight:700;
                   color:var(--clr-primary);">${j.hari}</span>
      <span style="min-width:100px;font-size:12px;
                   color:var(--clr-text-muted);">
        ${j.jam_mulai?.slice(0,5)||'—'} – ${j.jam_selesai?.slice(0,5)||'—'}
      </span>
      <span style="flex:1;font-size:13px;font-weight:600;">
        ${_x(j.mapel)}
      </span>
      <span style="font-size:11.5px;background:rgba(26,107,60,.1);
                   color:var(--clr-primary);padding:1px 8px;
                   border-radius:99px;">
        ${klsLabel[j.kelas]||'Kls '+j.kelas}
      </span>
      ${j.ruang ? `
      <span style="font-size:11.5px;color:var(--clr-text-muted);">
        ${_x(j.ruang)}
      </span>` : ''}
      <button class="btn-tbl delete"
              style="flex-shrink:0;"
              data-jdl-del="${j.id}">
        <i class="ph-bold ph-trash"></i>
      </button>
    </div>`) .join('')
  : `<p style="text-align:center;padding:24px;
               color:var(--clr-text-muted);font-style:italic;">
       Belum ada jadwal untuk ustadz ini.
     </p>`;

  wrap.querySelectorAll('[data-jdl-del]').forEach(b =>
    b.addEventListener('click', async () => {
      const ok = await _deleteJadwal(b.dataset.jdlDel);
      if (!ok) return;
      _us.jadwalCache = _us.jadwalCache
        .filter(j => j.id !== b.dataset.jdlDel);
      _renderJadwalModalList(ustadzId);
      _renderJadwalGrid();
      _renderStatCards();
      window.showToast('success','Jadwal Dihapus','');
    })
  );
}

async function _submitJadwal() {
  const ustadzId  = document.getElementById('jadwal-ust-select')?.value;
  const hari      = document.getElementById('jadwal-hari')?.value;
  const jamMulai  = document.getElementById('jadwal-jam-mulai')?.value;
  const jamSls    = document.getElementById('jadwal-jam-selesai')?.value;
  const kelas     = document.getElementById('jadwal-kelas')?.value;
  const mapel     = document.getElementById('jadwal-mapel')?.value;
  const ruang     = document.getElementById('jadwal-ruang')?.value.trim();

  if (!ustadzId||!hari||!jamMulai||!jamSls||!kelas||!mapel) {
    window.showToast('error','Validasi Gagal',
      'Semua field wajib diisi.'); return;
  }
  if (jamMulai >= jamSls) {
    window.showToast('error','Jam Tidak Valid',
      'Jam selesai harus lebih besar dari jam mulai.'); return;
  }

  const payload = {
    ustadz_id:   ustadzId,
    hari, kelas, mapel,
    jam_mulai:   jamMulai,
    jam_selesai: jamSls,
    ruang:       ruang || null,
  };

  const btnSimpan = document.getElementById('btn-simpan-jadwal');
  if (btnSimpan) btnSimpan.disabled = true;

  try {
    await _saveJadwal(payload);

    // Update cache lokal
    const u = _us.cache.find(x => x.id === ustadzId);
    _us.jadwalCache.push({
      id:  'jlocal-' + Date.now(),
      ...payload,
      ustadz: { nama: u?.nama||'', jabatan: u?.jabatan||'' },
    });

    // Reset form tambah jadwal
    ['jadwal-hari','jadwal-jam-mulai','jadwal-jam-selesai',
     'jadwal-kelas','jadwal-mapel','jadwal-ruang'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    _renderJadwalModalList(ustadzId);
    _renderJadwalGrid();
    _renderStatCards();
    window.showToast('success','Jadwal Ditambahkan',
      `${mapel} — ${hari} ${jamMulai}–${jamSls}`);
  } catch (err) {
    window.showToast('error','Gagal Simpan',
      err?.message || 'Terjadi kesalahan.');
  } finally {
    if (btnSimpan) btnSimpan.disabled = false;
  }
}

/* ── EXPORT CSV ──────────────────────────────────────────────── */
function _exportCSV() {
  const data = _us.cache;
  if (!data.length) {
    window.showToast('warning','Tidak Ada Data',''); return;
  }
  const hdr  = ['Nama','NIP','Jabatan','Spesialisasi','Status',
                 'JK','No HP','Email','Tgl Bergabung','Alamat'];
  const rows = data.map(u => [
    u.nama, u.nip||'', u.jabatan||'', u.spesialisasi||'',
    u.status, u.jk==='P'?'Perempuan':'Laki-laki',
    u.no_hp||'', u.email||'',
    _formatTglShort(u.tgl_bergabung), u.alamat||'',
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));

  const csv  = [hdr,...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],
    { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ustadz-${_today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('success','Export Berhasil',
    `${data.length} data diekspor.`);
}

/* ── WIRE: EVENT LISTENERS ───────────────────────────────────── */
function _wireEvents() {

  // ── Tab switching ──────────────────────────────────── //
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-ust-tab]');
    if (!tab) return;
    _us.tab = tab.dataset.ustTab;
    document.querySelectorAll('[data-ust-tab]')
      .forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    ['data','jadwal','honor'].forEach(p => {
      const el = document.getElementById(`ust-panel-${p}`);
      if (el) el.style.display = p === _us.tab ? '' : 'none';
    });
  });

  // ── Tambah ustadz ──────────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-tambah-ust')) _openTambah();
  });

  // ── Submit form ustadz ─────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-simpan-ust')) _submitForm();
  });

  // ── Edit dari detail modal ─────────────────────────── //
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-edit-from-ust-detail')) return;
    window.closeModal('modal-ust-detail');
    if (_us.viewId) _openEdit(_us.viewId);
  });

  // ── Search & filter ustadz ─────────────────────────── //
  document.addEventListener('input', e => {
    if (e.target.id === 'ust-search') {
      _us.searchQ = e.target.value;
      _us.page = 1; _renderUstadzTable();
    }
    if (e.target.id === 'honor-search') _renderHonorTable();
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'ust-filter-status') {
      _us.filterStatus = e.target.value;
      _us.page = 1; _renderUstadzTable();
    }
    if (e.target.id === 'ust-filter-jabatan') {
      _us.filterJabatan = e.target.value;
      _us.page = 1; _renderUstadzTable();
    }
    if (e.target.id === 'honor-filter-status') _renderHonorTable();
    if (e.target.id === 'honor-filter-bulan') {
      _us.bulanHonor = e.target.value;
      _loadHonor(_us.bulanHonor).then(data => {
        _us.honorCache = data;
        _renderHonorStatCards();
        _renderHonorTable();
      });
    }
  });

  // ── Tambah jadwal global ───────────────────────────── //
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-tambah-jadwal-global')) return;
    _us.jadwalUstadzId = null;
    const titleEl = document.getElementById('modal-jadwal-title');
    if (titleEl) titleEl.textContent = 'Tambah Jadwal Mengajar';
    const wrap = document.getElementById('jadwal-modal-list');
    if (wrap) wrap.innerHTML = '';
    window.openModal('modal-jadwal');
  });

  // ── Submit jadwal ──────────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-simpan-jadwal')) _submitJadwal();
  });

  // ── Generate honor ─────────────────────────────────── //
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-generate-honor')) return;
    window.confirmDelete(
      `Generate honor ${_formatBulan(_us.bulanHonor)} ` +
      `untuk semua ustadz aktif?`,
      async () => {
        const count = await _generateHonor(_us.bulanHonor);
        if (count > 0) {
          window.showToast('success','Honor Di-generate',
            `${count} honor berhasil dibuat.`);
          _us.honorCache = await _loadHonor(_us.bulanHonor);
          _renderHonorStatCards(); _renderHonorTable();
        }
      }
    );
    requestAnimationFrame(() => {
      const ok  = document.getElementById('modal-confirm-ok');
      const ico = document.querySelector(
        '#modal-confirm .modal-confirm-icon i');
      if (ok) {
        ok.className = 'btn btn-primary';
        ok.innerHTML = '<i class="ph-bold ph-magic-wand"></i> Ya, Generate';
      }
      if (ico) ico.className = 'ph-bold ph-magic-wand';
    });
  });

  // ── Export CSV ─────────────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-export-ust')) _exportCSV();
  });

  // ── Tutup modal ────────────────────────────────────── //
  const modalIds = ['modal-ust-form','modal-ust-detail','modal-jadwal'];
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-close-modal]');
    if (btn && modalIds.includes(btn.dataset.closeModal)) {
      window.closeModal(btn.dataset.closeModal);
    }
    modalIds.forEach(id => {
      const overlay = document.getElementById(id);
      if (e.target === overlay) window.closeModal(id);
    });
  });
}

/* ── INIT MODUL ──────────────────────────────────────────────── */
(async function _init() {

  // 1. Jalankan pengikatan event listeners global sekali saja saat modul dimuat
  _wireEvents();

  // 2. Set nilai awal pada kolom filter bulan honorarium
  const honorBulanEl = document.getElementById('honor-filter-bulan');
  if (honorBulanEl) honorBulanEl.value = _thisMonth();

  // 3. Tangani siklus render ketika user beralih ke halaman Data Ustadz
  window.addEventListener('madin:navigate', async e => {
    if (e.detail.page !== 'data-ustadz') return;

    // Sinkronisasi status tab aktif agar kembali ke tab 'daftar' default
    document.querySelectorAll('[data-ust-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.ustTab === 'daftar');
    });
    
    // Pastikan panel daftar tampil dan panel lainnya tersembunyi
    const pDaftar = document.getElementById('ust-panel-daftar');
    if (pDaftar) pDaftar.style.display = '';
    ['jadwal', 'honor'].forEach(p => {
      const el = document.getElementById(`ust-panel-${p}`);
      if (el) el.style.display = 'none';
    });

    // Jalankan penarikan (fetch) data asinkronus dari Supabase
    tbody.innerHTML = _skeletonRows(5, 6); // render baris pemuatan sementara
    
    // Panggil fungsi penarik data dan mapping dinamis ke <tbody>
    await _loadAllDataUstadzAndRender();
  });

  console.log('[Madin] Ustadz module loaded ✓ (SOP V2 Applied)');

})();
