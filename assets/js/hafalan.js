/* ============================================================
   app.hafalan.js — Modul Hafalan Al-Qur'an
   Portal Pengurus Madrasah Diniyah DQLM

   SOP: File ini HANYA berisi state, CRUD Supabase,
        event listeners, dan mapping data dinamis (<tr>/<option>).
        Tidak ada innerHTML struktur HTML halaman.
   ============================================================ */

'use strict';

/* ── KONSTANTA: DATA SURAH AL-QUR'AN ─────────────────────────── */
const SURAH_LIST = [
  { no:1,  nama:'Al-Fatihah',    juz:1,  ayat:7   },
  { no:2,  nama:'Al-Baqarah',    juz:1,  ayat:286 },
  { no:3,  nama:'Ali Imran',     juz:3,  ayat:200 },
  { no:4,  nama:'An-Nisa',       juz:4,  ayat:176 },
  { no:5,  nama:'Al-Maidah',     juz:6,  ayat:120 },
  { no:6,  nama:'Al-An\'am',     juz:7,  ayat:165 },
  { no:7,  nama:'Al-A\'raf',     juz:8,  ayat:206 },
  { no:8,  nama:'Al-Anfal',      juz:9,  ayat:75  },
  { no:9,  nama:'At-Taubah',     juz:10, ayat:129 },
  { no:10, nama:'Yunus',         juz:11, ayat:109 },
  { no:11, nama:'Hud',           juz:11, ayat:123 },
  { no:12, nama:'Yusuf',         juz:12, ayat:111 },
  { no:13, nama:'Ar-Ra\'d',      juz:13, ayat:43  },
  { no:14, nama:'Ibrahim',       juz:13, ayat:52  },
  { no:15, nama:'Al-Hijr',       juz:14, ayat:99  },
  { no:16, nama:'An-Nahl',       juz:14, ayat:128 },
  { no:17, nama:'Al-Isra',       juz:15, ayat:111 },
  { no:18, nama:'Al-Kahfi',      juz:15, ayat:110 },
  { no:19, nama:'Maryam',        juz:16, ayat:98  },
  { no:20, nama:'Ta-Ha',         juz:16, ayat:135 },
  { no:21, nama:'Al-Anbiya',     juz:17, ayat:112 },
  { no:22, nama:'Al-Hajj',       juz:17, ayat:78  },
  { no:23, nama:'Al-Mu\'minun',  juz:18, ayat:118 },
  { no:24, nama:'An-Nur',        juz:18, ayat:64  },
  { no:25, nama:'Al-Furqan',     juz:18, ayat:77  },
  { no:26, nama:'Asy-Syu\'ara',  juz:19, ayat:227 },
  { no:27, nama:'An-Naml',       juz:19, ayat:93  },
  { no:28, nama:'Al-Qasas',      juz:20, ayat:88  },
  { no:29, nama:'Al-Ankabut',    juz:20, ayat:69  },
  { no:30, nama:'Ar-Rum',        juz:21, ayat:60  },
  { no:31, nama:'Luqman',        juz:21, ayat:34  },
  { no:32, nama:'As-Sajdah',     juz:21, ayat:30  },
  { no:33, nama:'Al-Ahzab',      juz:21, ayat:73  },
  { no:34, nama:'Saba',          juz:22, ayat:54  },
  { no:35, nama:'Fatir',         juz:22, ayat:45  },
  { no:36, nama:'Ya-Sin',        juz:22, ayat:83  },
  { no:37, nama:'As-Saffat',     juz:23, ayat:182 },
  { no:38, nama:'Sad',           juz:23, ayat:88  },
  { no:39, nama:'Az-Zumar',      juz:23, ayat:75  },
  { no:40, nama:'Ghafir',        juz:24, ayat:85  },
  { no:41, nama:'Fussilat',      juz:24, ayat:54  },
  { no:42, nama:'Asy-Syura',     juz:25, ayat:53  },
  { no:43, nama:'Az-Zukhruf',    juz:25, ayat:89  },
  { no:44, nama:'Ad-Dukhan',     juz:25, ayat:59  },
  { no:45, nama:'Al-Jasiyah',    juz:25, ayat:37  },
  { no:46, nama:'Al-Ahqaf',      juz:26, ayat:35  },
  { no:47, nama:'Muhammad',      juz:26, ayat:38  },
  { no:48, nama:'Al-Fath',       juz:26, ayat:29  },
  { no:49, nama:'Al-Hujurat',    juz:26, ayat:18  },
  { no:50, nama:'Qaf',           juz:26, ayat:45  },
  { no:51, nama:'Az-Zariyat',    juz:26, ayat:60  },
  { no:52, nama:'At-Tur',        juz:27, ayat:49  },
  { no:53, nama:'An-Najm',       juz:27, ayat:62  },
  { no:54, nama:'Al-Qamar',      juz:27, ayat:55  },
  { no:55, nama:'Ar-Rahman',     juz:27, ayat:78  },
  { no:56, nama:'Al-Waqi\'ah',   juz:27, ayat:96  },
  { no:57, nama:'Al-Hadid',      juz:27, ayat:29  },
  { no:58, nama:'Al-Mujadilah',  juz:28, ayat:22  },
  { no:59, nama:'Al-Hasyr',      juz:28, ayat:24  },
  { no:60, nama:'Al-Mumtahanah', juz:28, ayat:13  },
  { no:61, nama:'As-Saf',        juz:28, ayat:14  },
  { no:62, nama:'Al-Jumu\'ah',   juz:28, ayat:11  },
  { no:63, nama:'Al-Munafiqun',  juz:28, ayat:11  },
  { no:64, nama:'At-Tagabun',    juz:28, ayat:18  },
  { no:65, nama:'At-Talaq',      juz:28, ayat:12  },
  { no:66, nama:'At-Tahrim',     juz:28, ayat:12  },
  { no:67, nama:'Al-Mulk',       juz:29, ayat:30  },
  { no:68, nama:'Al-Qalam',      juz:29, ayat:52  },
  { no:69, nama:'Al-Haqqah',     juz:29, ayat:52  },
  { no:70, nama:'Al-Ma\'arij',   juz:29, ayat:44  },
  { no:71, nama:'Nuh',           juz:29, ayat:28  },
  { no:72, nama:'Al-Jin',        juz:29, ayat:28  },
  { no:73, nama:'Al-Muzzammil',  juz:29, ayat:20  },
  { no:74, nama:'Al-Muddassir',  juz:29, ayat:56  },
  { no:75, nama:'Al-Qiyamah',    juz:29, ayat:40  },
  { no:76, nama:'Al-Insan',      juz:29, ayat:31  },
  { no:77, nama:'Al-Mursalat',   juz:29, ayat:50  },
  { no:78, nama:'An-Naba',       juz:30, ayat:40  },
  { no:79, nama:'An-Nazi\'at',   juz:30, ayat:46  },
  { no:80, nama:'\'Abasa',       juz:30, ayat:42  },
  { no:81, nama:'At-Takwir',     juz:30, ayat:29  },
  { no:82, nama:'Al-Infitar',    juz:30, ayat:19  },
  { no:83, nama:'Al-Mutaffifin', juz:30, ayat:36  },
  { no:84, nama:'Al-Insyiqaq',   juz:30, ayat:25  },
  { no:85, nama:'Al-Buruj',      juz:30, ayat:22  },
  { no:86, nama:'At-Tariq',      juz:30, ayat:17  },
  { no:87, nama:'Al-A\'la',      juz:30, ayat:19  },
  { no:88, nama:'Al-Ghasyiyah',  juz:30, ayat:26  },
  { no:89, nama:'Al-Fajr',       juz:30, ayat:30  },
  { no:90, nama:'Al-Balad',      juz:30, ayat:20  },
  { no:91, nama:'Asy-Syams',     juz:30, ayat:15  },
  { no:92, nama:'Al-Lail',       juz:30, ayat:21  },
  { no:93, nama:'Ad-Duha',       juz:30, ayat:11  },
  { no:94, nama:'Al-Insyirah',   juz:30, ayat:8   },
  { no:95, nama:'At-Tin',        juz:30, ayat:8   },
  { no:96, nama:'Al-\'Alaq',     juz:30, ayat:19  },
  { no:97, nama:'Al-Qadr',       juz:30, ayat:5   },
  { no:98, nama:'Al-Bayyinah',   juz:30, ayat:8   },
  { no:99, nama:'Az-Zalzalah',   juz:30, ayat:8   },
  { no:100,nama:'Al-\'Adiyat',   juz:30, ayat:11  },
  { no:101,nama:'Al-Qari\'ah',   juz:30, ayat:11  },
  { no:102,nama:'At-Takasur',    juz:30, ayat:8   },
  { no:103,nama:'Al-\'Asr',      juz:30, ayat:3   },
  { no:104,nama:'Al-Humazah',    juz:30, ayat:9   },
  { no:105,nama:'Al-Fil',        juz:30, ayat:5   },
  { no:106,nama:'Quraisy',       juz:30, ayat:4   },
  { no:107,nama:'Al-Ma\'un',     juz:30, ayat:7   },
  { no:108,nama:'Al-Kausar',     juz:30, ayat:3   },
  { no:109,nama:'Al-Kafirun',    juz:30, ayat:6   },
  { no:110,nama:'An-Nasr',       juz:30, ayat:3   },
  { no:111,nama:'Al-Masad',      juz:30, ayat:5   },
  { no:112,nama:'Al-Ikhlas',     juz:30, ayat:4   },
  { no:113,nama:'Al-Falaq',      juz:30, ayat:5   },
  { no:114,nama:'An-Nas',        juz:30, ayat:6   },
];

/* ── KONSTANTA: STATUS & WARNA ───────────────────────────────── */
const STATUS_HF = {
  Selesai:   { badge:'success', icon:'ph-check-circle',    color:'#15803d' },
  Proses:    { badge:'warning', icon:'ph-clock',           color:'#b45309' },
  Mengulang: { badge:'info',    icon:'ph-arrow-counter-clockwise', color:'#1d4ed8' },
};

const KELAS_LABEL_HF = {
  '1':'Kelas 1 (Ula)',   '2':'Kelas 2 (Wustho)',
  '3':'Kelas 3 (Ulya)',  '4':'Kelas 4',
  '5':'Kelas 5',
};

const PAGE_SIZE_HF = 12;

/* ── STATE ───────────────────────────────────────────────────── */
const _hf = {
  tab:           'ringkasan',
  // Ringkasan
  filterKelas:   '',
  filterMinJuz:  0,
  searchQ:       '',
  page:          1,
  ringkasanCache:[],   // data dari v_hafalan_santri
  // Detail
  detailSantriId:'',
  detailStatus:  '',
  detailCache:   [],   // hafalan rows santri tertentu
  // Progress chart
  chartKelas:    '',
  chartKelas_inst: null,
  chartStatus_inst:null,
  // Modal
  editId:        null,
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

// Surah berdasar nomor
function _surahNama(no) {
  if (!no) return '—';
  return SURAH_LIST.find(s => s.no === parseInt(no))?.nama || `Surah ${no}`;
}

// Surah dalam range juz tertentu
function _surahByJuz(juz) {
  return SURAH_LIST.filter(s => s.juz === parseInt(juz));
}

// Progress bar HTML
function _progressBar(selesai, total = 30, height = 8) {
  const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;
  const color = pct >= 80
    ? '#1a6b3c' : pct >= 50
    ? '#f59e0b' : pct >= 20
    ? '#3b82f6' : '#94a89a';
  return `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="flex:1;height:${height}px;
                  background:rgba(26,107,60,.1);
                  border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;
                    background:${color};
                    border-radius:99px;
                    transition:width .6s ease;"></div>
      </div>
      <span style="font-size:11.5px;font-weight:700;
                   color:${color};min-width:32px;">
        ${selesai}/30
      </span>
    </div>`;
}

/* ── SUPABASE: LOAD RINGKASAN ─────────────────────────────────── */
async function _loadRingkasan() {
  if (!window.supabase) return _dummyRingkasan();

  const { data, error } = await window.supabase
    .from('v_hafalan_santri')
    .select('*')
    .order('juz_selesai', { ascending: false });

  if (error) {
    console.warn('[Hafalan] Load ringkasan error:', error.message);
    return _dummyRingkasan();
  }
  return data || [];
}

/* ── SUPABASE: LOAD DETAIL PER SANTRI ────────────────────────── */
async function _loadDetail(santriId, status = '') {
  if (!window.supabase) return [];

  let q = window.supabase
    .from('hafalan')
    .select(`
      id, juz, surah_mulai, surah_selesai,
      ayat_mulai, ayat_selesai,
      status, nilai_hafalan, tgl_setor, catatan,
      musyrif:musyrif_id ( nama )
    `)
    .eq('santri_id', santriId)
    .order('juz', { ascending: true });

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    console.warn('[Hafalan] Load detail error:', error.message);
    return [];
  }
  return data || [];
}

/* ── SUPABASE: LOAD SEMUA (untuk chart) ──────────────────────── */
async function _loadAllHafalan(kelas = '') {
  if (!window.supabase) return _dummyRingkasan();

  let q = window.supabase
    .from('v_hafalan_santri')
    .select('*');

  if (kelas) q = q.eq('kelas', kelas);

  const { data, error } = await q;
  if (error) { console.warn('[Hafalan] Load all error:', error.message); return []; }
  return data || [];
}

/* ── SUPABASE: UPSERT HAFALAN ─────────────────────────────────── */
async function _upsertHafalan(payload) {
  if (!window.supabase) {
    // Demo mode: update cache lokal
    const idx = _hf.detailCache.findIndex(
      r => r.id === _hf.editId
    );
    if (idx !== -1) {
      _hf.detailCache[idx] = { ..._hf.detailCache[idx], ...payload };
    } else {
      _hf.detailCache.push({
        id: 'local-' + Date.now(), ...payload,
        musyrif: null,
      });
    }
    return { ok: true };
  }

  const row = {
    ...(payload.id ? { id: payload.id } : {}),
    santri_id:    payload.santri_id,
    juz:          payload.juz,
    surah_mulai:  payload.surah_mulai   || null,
    surah_selesai:payload.surah_selesai || null,
    ayat_mulai:   payload.ayat_mulai    || null,
    ayat_selesai: payload.ayat_selesai  || null,
    status:       payload.status,
    nilai_hafalan:payload.nilai_hafalan || null,
    tgl_setor:    payload.tgl_setor     || null,
    musyrif_id:   payload.musyrif_id    || null,
    catatan:      payload.catatan       || null,
  };

  const { error } = await window.supabase
    .from('hafalan')
    .upsert(row, {
      onConflict: 'santri_id,juz',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('[Hafalan] Upsert error:', error.message);
    return { ok: false, msg: error.message };
  }
  return { ok: true };
}

/* ── SUPABASE: DELETE ─────────────────────────────────────────── */
async function _deleteHafalan(id) {
  if (!window.supabase) {
    _hf.detailCache = _hf.detailCache.filter(r => r.id !== id);
    return true;
  }
  const { error } = await window.supabase
    .from('hafalan').delete().eq('id', id);
  if (error) {
    window.showToast('error', 'Gagal Hapus', error.message);
    return false;
  }
  return true;
}

/* ── DUMMY DATA (fallback sebelum Supabase aktif) ────────────── */
function _dummyRingkasan() {
  return (window.santriCache || [])
    .filter(s => s.status === 'Aktif')
    .map(s => ({
      santri_id:          s._id,
      nis:                s.nis,
      nama:               s.nama,
      kelas:              s.kelas,
      total_juz:          0,
      juz_selesai:        0,
      juz_proses:         0,
      juz_mengulang:      0,
      rata_nilai:         null,
      tgl_setor_terakhir: null,
    }));
}

/* ── STAT CARDS GLOBAL ───────────────────────────────────────── */
function _updateStatCards(data) {
  const totalSelesai = data.reduce(
    (s, r) => s + (parseInt(r.juz_selesai) || 0), 0);
  const aktif        = data.length;
  const menghafal    = data.filter(r =>
    (parseInt(r.juz_selesai)||0) > 0 ||
    (parseInt(r.juz_proses)||0)  > 0).length;
  const nilaiList    = data
    .map(r => parseFloat(r.rata_nilai))
    .filter(v => !isNaN(v) && v > 0);
  const rataGlobal   = nilaiList.length
    ? (nilaiList.reduce((a,b) => a+b, 0) / nilaiList.length).toFixed(1)
    : '—';
  const juz30        = data.filter(
    r => parseInt(r.juz_selesai) >= 30).length;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('hf-sc-selesai',     totalSelesai);
  set('hf-sc-selesai-sub', `total juz dari ${aktif} santri`);
  set('hf-sc-aktif',       menghafal);
  set('hf-sc-aktif-sub',   `dari ${aktif} santri terdaftar`);
  set('hf-sc-nilai',       rataGlobal);
  set('hf-sc-juz30',       juz30);
  set('hf-sc-juz30-sub',   `santri tamat Juz 30`);
}

/* ── POPULATE SELECT OPTIONS ─────────────────────────────────── */
function _populateSelects() {

  // Opsi santri (untuk filter detail & form)
  const santriOpts = (window.santriCache || [])
    .filter(s => s.status === 'Aktif')
    .sort((a,b) => a.nama.localeCompare(b.nama))
    .map(s =>
      `<option value="${s._id}">${_x(s.nama)} — ${_x(s.nis)}</option>`
    ).join('');

  ['hf-detail-santri','hf-form-santri'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const first = el.options[0]?.outerHTML || '';
    el.innerHTML = first + santriOpts;
  });

  // Opsi juz 1–30
  const juzOpts = Array.from({ length: 30 }, (_, i) =>
    `<option value="${i+1}">Juz ${i+1}</option>`
  ).join('');

  const juzEl = document.getElementById('hf-form-juz');
  if (juzEl) {
    juzEl.innerHTML =
      '<option value="">— Pilih —</option>' + juzOpts;
  }

  // Opsi surah (semua)
  const surahOpts = SURAH_LIST.map(s =>
    `<option value="${s.no}">${s.no}. ${s.nama}</option>`
  ).join('');

  ['hf-form-surah-mulai','hf-form-surah-selesai'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML =
      '<option value="">— Pilih —</option>' + surahOpts;
  });

  // Opsi musyrif (dari cache ustadz jika ada)
  const musyrifOpts = (window.ustadzCache ||
    (window.santriCache ? [] : [])).length
    ? (window.ustadzCache || [])
        .filter(u => u.status === 'Aktif')
        .map(u => `<option value="${u.id}">${_x(u.nama)}</option>`)
        .join('')
    : '';

  const musyrifEl = document.getElementById('hf-form-musyrif');
  if (musyrifEl) {
    musyrifEl.innerHTML =
      '<option value="">— Pilih —</option>' + musyrifOpts;
  }
}

/* ============================================================
   app.hafalan.js — Batch 3: Render Functions
   (Ringkasan, Detail Juz, Grid Juz, Chart & Top 10)
   ============================================================ */

/* ── RENDER: TABEL RINGKASAN ─────────────────────────────────── */
async function _renderRingkasan() {
  const tbody = document.getElementById('tbody-hf-ringkasan');
  if (!tbody) return;

  tbody.innerHTML = Array.from({ length: 6 },
    () => _skeletonTr(9)).join('');

  _hf.ringkasanCache = await _loadRingkasan();
  _updateStatCards(_hf.ringkasanCache);

  // Terapkan filter
  let data = _hf.ringkasanCache;

  if (_hf.filterKelas) {
    data = data.filter(r => r.kelas === _hf.filterKelas);
  }
  if (_hf.filterMinJuz > 0) {
    data = data.filter(r =>
      (parseInt(r.juz_selesai) || 0) >= _hf.filterMinJuz);
  }
  if (_hf.searchQ) {
    const q = _hf.searchQ.toLowerCase();
    data = data.filter(r =>
      r.nama?.toLowerCase().includes(q) ||
      r.nis?.includes(q)
    );
  }

  // Paginasi
  const total = data.length;
  const start = (_hf.page - 1) * PAGE_SIZE_HF;
  const page  = data.slice(start, start + PAGE_SIZE_HF);

  // Update info
  const infoEl = document.getElementById('hf-pagination-info');
  if (infoEl) infoEl.textContent = total
    ? `${Math.min(start+1,total)}–${Math.min(start+PAGE_SIZE_HF,total)} dari ${total} santri`
    : 'Tidak ada data';

  if (!page.length) {
    tbody.innerHTML = `
      <tr><td colspan="9"
          style="text-align:center;padding:56px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-book-open"
           style="font-size:30px;display:block;
                  margin-bottom:10px;opacity:.3;"></i>
        ${_hf.ringkasanCache.length
          ? 'Tidak ada yang sesuai filter.'
          : 'Belum ada data hafalan.'}
      </td></tr>`;
    _renderPager(total);
    return;
  }

  tbody.innerHTML = page.map((r, i) => {
    const selesai   = parseInt(r.juz_selesai)   || 0;
    const proses    = parseInt(r.juz_proses)    || 0;
    const mengulang = parseInt(r.juz_mengulang) || 0;
    const klsLabel  = KELAS_LABEL_HF[r.kelas] || `Kelas ${r.kelas}`;
    const nilai     = r.rata_nilai
      ? parseFloat(r.rata_nilai).toFixed(1) : '—';
    const nilaiColor = r.rata_nilai
      ? (parseFloat(r.rata_nilai) >= 80
          ? '#15803d' : parseFloat(r.rata_nilai) >= 70
          ? '#b45309' : '#b91c1c')
      : 'var(--clr-text-muted)';

    return `
      <tr>
        <td style="text-align:center;font-size:12px;
                   color:var(--clr-text-muted);">
          ${start + i + 1}
        </td>
        <td style="font-weight:600;min-width:160px;">
          ${_x(r.nama)}
        </td>
        <td style="font-family:monospace;font-size:12px;
                   color:var(--clr-text-sub);">
          ${_x(r.nis)}
        </td>
        <td style="text-align:center;">
          <span class="badge neutral">
            <span class="badge-dot"></span>
            ${_x(klsLabel)}
          </span>
        </td>
        <td style="text-align:center;font-size:16px;
                   font-weight:800;color:var(--clr-primary);">
          ${selesai}
          <span style="font-size:11px;font-weight:500;
                       color:var(--clr-text-muted);">/30</span>
        </td>
        <td style="min-width:160px;">
          ${_progressBar(selesai)}
          ${proses > 0 || mengulang > 0 ? `
          <div style="display:flex;gap:8px;margin-top:4px;
                      font-size:11px;">
            ${proses > 0 ? `
            <span style="color:#b45309;">
              <i class="ph-bold ph-clock"
                 style="font-size:10px;"></i>
              ${proses} proses
            </span>` : ''}
            ${mengulang > 0 ? `
            <span style="color:#1d4ed8;">
              <i class="ph-bold ph-arrow-counter-clockwise"
                 style="font-size:10px;"></i>
              ${mengulang} mengulang
            </span>` : ''}
          </div>` : ''}
        </td>
        <td style="text-align:center;font-weight:700;
                   font-family:monospace;color:${nilaiColor};">
          ${nilai}
        </td>
        <td style="text-align:center;font-size:12.5px;
                   color:var(--clr-text-sub);">
          ${_formatTglShort(r.tgl_setor_terakhir)}
        </td>
        <td>
          <div class="tbl-actions"
               style="justify-content:center;">
            <button class="btn-tbl view"
                    title="Lihat Detail Juz"
                    data-hf-detail="${r.santri_id}">
              <i class="ph-bold ph-eye"></i>
            </button>
            <button class="btn-tbl edit"
                    title="Tambah/Edit Hafalan"
                    data-hf-tambah="${r.santri_id}"
                    data-hf-nama="${_x(r.nama)}">
              <i class="ph-bold ph-plus"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Wire tombol aksi
  tbody.querySelectorAll('[data-hf-detail]').forEach(b =>
    b.addEventListener('click', () => {
      _hf.tab = 'detail';
      _switchTab('detail');
      // Set select santri di panel detail
      const sel = document.getElementById('hf-detail-santri');
      if (sel) {
        sel.value = b.dataset.hfDetail;
        _hf.detailSantriId = b.dataset.hfDetail;
      }
      _renderDetailJuz();
    })
  );

  tbody.querySelectorAll('[data-hf-tambah]').forEach(b =>
    b.addEventListener('click', () =>
      _openModal(b.dataset.hfTambah, b.dataset.hfNama))
  );

  _renderPager(total);
}

/* ── RENDER: PAGINASI ─────────────────────────────────────────── */
function _renderPager(total) {
  const wrap = document.getElementById('hf-pager');
  if (!wrap) return;

  const tp = Math.max(1, Math.ceil(total / PAGE_SIZE_HF));
  if (tp <= 1) { wrap.innerHTML = ''; return; }

  let h = `<button class="page-btn" id="hfp-prev"
              ${_hf.page===1?'disabled':''}>
             <i class="ph-bold ph-caret-left"></i>
           </button>`;
  const lo = Math.max(1, _hf.page-2);
  const hi = Math.min(tp, _hf.page+2);
  if (lo>1) h += `<button class="page-btn" data-hfp="1">1</button>`;
  if (lo>2) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  for (let p=lo; p<=hi; p++) {
    h += `<button class="page-btn${p===_hf.page?' active':''}"
                  data-hfp="${p}">${p}</button>`;
  }
  if (hi<tp-1) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  if (hi<tp) h += `<button class="page-btn" data-hfp="${tp}">${tp}</button>`;
  h += `<button class="page-btn" id="hfp-next"
              ${_hf.page===tp?'disabled':''}>
             <i class="ph-bold ph-caret-right"></i>
           </button>`;
  wrap.innerHTML = h;
  wrap.querySelectorAll('[data-hfp]').forEach(b =>
    b.addEventListener('click', () => {
      _hf.page = +b.dataset.hfp; _renderRingkasan();
    })
  );
  wrap.querySelector('#hfp-prev')
    ?.addEventListener('click', () => { _hf.page--; _renderRingkasan(); });
  wrap.querySelector('#hfp-next')
    ?.addEventListener('click', () => { _hf.page++; _renderRingkasan(); });
}

/* ── RENDER: GRID JUZ (30 kotak) ─────────────────────────────── */
function _renderJuzGrid(detailRows) {
  const wrap = document.getElementById('hf-juz-grid');
  if (!wrap) return;

  // Map juz → data
  const juzMap = {};
  detailRows.forEach(r => { juzMap[r.juz] = r; });

  // 30 kotak juz
  wrap.innerHTML = Array.from({ length: 30 }, (_, i) => {
    const juz  = i + 1;
    const data = juzMap[juz];
    const st   = data?.status;
    const cfg  = STATUS_HF[st] || null;

    let boxStyle = '';
    let label    = `<span class="hf-juz-num">${juz}</span>`;
    let badge    = '';

    if (!data) {
      // Belum ada data
      boxStyle = 'background:rgba(26,107,60,.05);border:1.5px dashed rgba(26,107,60,.15);';
      label    = `<span class="hf-juz-num"
                       style="color:var(--clr-text-muted);">${juz}</span>`;
    } else if (st === 'Selesai') {
      boxStyle = 'background:rgba(26,107,60,.12);border:1.5px solid rgba(26,107,60,.3);';
      badge    = `<i class="ph-bold ph-check-circle"
                     style="font-size:13px;color:#15803d;
                            position:absolute;top:4px;right:4px;"></i>`;
    } else if (st === 'Proses') {
      boxStyle = 'background:rgba(245,158,11,.1);border:1.5px solid rgba(245,158,11,.3);';
      badge    = `<i class="ph-bold ph-clock"
                     style="font-size:13px;color:#b45309;
                            position:absolute;top:4px;right:4px;"></i>`;
    } else if (st === 'Mengulang') {
      boxStyle = 'background:rgba(59,130,246,.1);border:1.5px solid rgba(59,130,246,.3);';
      badge    = `<i class="ph-bold ph-arrow-counter-clockwise"
                     style="font-size:13px;color:#1d4ed8;
                            position:absolute;top:4px;right:4px;"></i>`;
    }

    const nilai = data?.nilai_hafalan
      ? `<span style="font-size:10px;font-weight:700;
                      color:${cfg?.color||'inherit'};">
           ${parseFloat(data.nilai_hafalan).toFixed(0)}
         </span>` : '';

    return `
      <div class="hf-juz-box" title="Juz ${juz}${st ? ' — ' + st : ''}"
           style="${boxStyle}" data-juz="${juz}">
        ${badge}
        ${label}
        <span class="hf-juz-label">Juz ${juz}</span>
        ${nilai}
      </div>`;
  }).join('');
}

/* ── RENDER: TABEL DETAIL JUZ ────────────────────────────────── */
async function _renderDetailJuz() {
  const santriId = _hf.detailSantriId;
  const tbody    = document.getElementById('tbody-hf-detail');
  const titleEl  = document.getElementById('hf-detail-title');
  const gridEl   = document.getElementById('hf-juz-grid');
  if (!tbody) return;

  if (!santriId) {
    tbody.innerHTML = `
      <tr><td colspan="8"
          style="text-align:center;padding:32px;
                 color:var(--clr-text-muted);">
        Pilih santri di atas.
      </td></tr>`;
    if (gridEl) gridEl.innerHTML = '';
    return;
  }

  tbody.innerHTML = Array.from({ length: 4 },
    () => _skeletonTr(8)).join('');
  if (gridEl) gridEl.innerHTML = Array.from({ length: 10 },
    () => `<div class="hf-juz-box hf-juz-skeleton"></div>`
  ).join('');

  // Cari nama santri
  const santri = (window.santriCache||[])
    .find(s => s._id === santriId);
  if (titleEl && santri) {
    titleEl.textContent = `Detail Hafalan — ${santri.nama}`;
  }

  // Load data
  _hf.detailCache = await _loadDetail(santriId, _hf.detailStatus);

  // Render grid juz
  _renderJuzGrid(_hf.detailCache);

  if (!_hf.detailCache.length) {
    tbody.innerHTML = `
      <tr><td colspan="8"
          style="text-align:center;padding:40px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-book-open"
           style="font-size:26px;display:block;
                  margin-bottom:8px;opacity:.3;"></i>
        Belum ada catatan hafalan untuk santri ini.
        <br>
        <button class="btn btn-primary btn-sm"
                style="margin-top:12px;"
                data-open-modal-ust="${santriId}"
                data-nama="${_x(santri?.nama||'')}">
          <i class="ph-bold ph-plus"></i> Catat Hafalan
        </button>
      </td></tr>`;

    // Wire tombol di empty state
    tbody.querySelector('[data-open-modal-ust]')
      ?.addEventListener('click', e => {
        const btn = e.currentTarget;
        _openModal(btn.dataset.openModalUst, btn.dataset.nama);
      });
    return;
  }

  // Filter status
  let rows = _hf.detailCache;
  if (_hf.detailStatus) {
    rows = rows.filter(r => r.status === _hf.detailStatus);
  }

  tbody.innerHTML = rows.map(r => {
    const cfg    = STATUS_HF[r.status] || {};
    const nilai  = r.nilai_hafalan !== null
      ? parseFloat(r.nilai_hafalan).toFixed(1) : '—';
    const surahRange = [
      r.surah_mulai   ? _surahNama(r.surah_mulai)   : null,
      r.surah_selesai ? _surahNama(r.surah_selesai) : null,
    ].filter(Boolean).join(' – ') || '—';

    return `
      <tr>
        <td style="text-align:center;font-weight:800;
                   font-size:16px;color:var(--clr-primary);">
          ${r.juz}
        </td>
        <td style="font-size:13px;">
          <div style="font-weight:500;">${surahRange}</div>
          ${r.ayat_mulai && r.ayat_selesai ? `
          <div style="font-size:11.5px;
                      color:var(--clr-text-muted);">
            Ayat ${r.ayat_mulai} – ${r.ayat_selesai}
          </div>` : ''}
        </td>
        <td style="text-align:center;">
          <span class="badge ${cfg.badge||'neutral'}">
            <span class="badge-dot"></span>
            ${r.status}
          </span>
        </td>
        <td style="text-align:center;font-weight:700;
                   font-family:monospace;
                   color:${r.nilai_hafalan !== null
                     ? (parseFloat(r.nilai_hafalan) >= 80
                       ? '#15803d' : parseFloat(r.nilai_hafalan) >= 70
                       ? '#b45309' : '#b91c1c')
                     : 'var(--clr-text-muted)'};">
          ${nilai}
        </td>
        <td style="text-align:center;font-size:12.5px;">
          ${_formatTglShort(r.tgl_setor)}
        </td>
        <td style="font-size:13px;">
          ${_x(r.musyrif?.nama || '—')}
        </td>
        <td style="font-size:12.5px;
                   color:var(--clr-text-sub);
                   max-width:150px;">
          ${_x(r.catatan || '—')}
        </td>
        <td>
          <div class="tbl-actions"
               style="justify-content:center;">
            <button class="btn-tbl edit"
                    title="Edit"
                    data-hf-edit-row="${r.id}">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>
            <button class="btn-tbl delete"
                    title="Hapus"
                    data-hf-del="${r.id}"
                    data-juz="${r.juz}">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Wire edit & hapus
  tbody.querySelectorAll('[data-hf-edit-row]').forEach(b =>
    b.addEventListener('click', () => _openModalEdit(b.dataset.hfEditRow))
  );
  tbody.querySelectorAll('[data-hf-del]').forEach(b =>
    b.addEventListener('click', () =>
      window.confirmDelete(
        `Hapus catatan Juz ${b.dataset.juz} dari santri ini?`,
        async () => {
          const ok = await _deleteHafalan(b.dataset.hfDel);
          if (!ok) return;
          await _renderDetailJuz();
          window.showToast('success','Dihapus',
            `Juz ${b.dataset.juz} berhasil dihapus.`);
        }
      )
    )
  );
}

/* ── RENDER: CHART & TOP 10 ──────────────────────────────────── */
async function _renderProgres() {
  const kelas = _hf.chartKelas;
  const data  = await _loadAllHafalan(kelas);

  _updateStatCards(data.length ? data : _hf.ringkasanCache);

  // ── Top 10 ─────────────────────────────────────────── //
  const tbody10 = document.getElementById('tbody-hf-top10');
  if (tbody10) {
    const sorted = [...data]
      .sort((a,b) =>
        (parseInt(b.juz_selesai)||0) -
        (parseInt(a.juz_selesai)||0))
      .slice(0, 10);

    if (!sorted.length) {
      tbody10.innerHTML = `
        <tr><td colspan="7"
            style="text-align:center;padding:32px;
                   color:var(--clr-text-muted);">
          Belum ada data hafalan.
        </td></tr>`;
    } else {
      tbody10.innerHTML = sorted.map((r, i) => {
        const selesai  = parseInt(r.juz_selesai) || 0;
        const klsLabel = KELAS_LABEL_HF[r.kelas] || r.kelas;
        const nilai    = r.rata_nilai
          ? parseFloat(r.rata_nilai).toFixed(1) : '—';
        const rankIcon = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`;
        return `
          <tr>
            <td style="text-align:center;font-size:16px;">
              ${rankIcon}
            </td>
            <td style="font-weight:600;">${_x(r.nama)}</td>
            <td style="font-family:monospace;font-size:12px;
                       color:var(--clr-text-sub);">
              ${_x(r.nis)}
            </td>
            <td style="text-align:center;">
              <span class="badge neutral">
                <span class="badge-dot"></span>
                ${_x(klsLabel)}
              </span>
            </td>
            <td style="text-align:center;font-weight:800;
                       font-size:16px;color:var(--clr-primary);">
              ${selesai}
              <span style="font-size:11px;font-weight:500;
                           color:var(--clr-text-muted);">/30</span>
            </td>
            <td style="min-width:140px;">
              ${_progressBar(selesai)}
            </td>
            <td style="text-align:center;font-weight:700;
                       font-family:monospace;">
              ${nilai}
            </td>
          </tr>`;
      }).join('');
    }
  }

  // ── Donut status ───────────────────────────────────── //
  const totSelesai   = data.reduce((s,r)=>s+(parseInt(r.juz_selesai)||0),0);
  const totProses    = data.reduce((s,r)=>s+(parseInt(r.juz_proses)||0),0);
  const totMengulang = data.reduce((s,r)=>s+(parseInt(r.juz_mengulang)||0), 0);
  const totBelum     = data.reduce((s,r)=>{
    const t=parseInt(r.total_juz)||0;
    const s2=parseInt(r.juz_selesai)||0;
    const p=parseInt(r.juz_proses)||0;
    const m=parseInt(r.juz_mengulang)||0;
    return s+(t-s2-p-m<0?0:0);
  },0);
  const grandTotal   = totSelesai+totProses+totMengulang || 1;
  const pct = Math.round((totSelesai/grandTotal)*100);

  const set = (id,val) => {
    const el=document.getElementById(id);
    if(el) el.textContent=val;
  };
  set('hf-donut-pct',     pct+'%');
  set('hf-leg-selesai',   totSelesai+' juz');
  set('hf-leg-proses',    totProses+' juz');
  set('hf-leg-mengulang', totMengulang+' juz');
  set('hf-leg-belum',     '—');

  // ── Donut chart ─────────────────────────────────────── //
  const ctxD = document.getElementById('chart-hf-status');
  if (ctxD && typeof Chart !== 'undefined') {
    if (_hf.chartStatus_inst) {
      _hf.chartStatus_inst.destroy();
      _hf.chartStatus_inst = null;
    }
    _hf.chartStatus_inst = new Chart(ctxD, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [totSelesai, totProses, totMengulang,
                 Math.max(0, grandTotal-totSelesai-totProses-totMengulang)],
          backgroundColor: [
            '#1a6b3c',
            '#f59e0b',
            '#8b5cf6',
            'rgba(26,107,60,.1)',
          ],
          borderWidth: 0,
          hoverOffset: 4,
        }]
      },
      options: {
        cutout: '76%',
        responsive: false,
        plugins: {
          legend:  { display: false },
          tooltip: { enabled: false },
        },
      }
    });
  }

  // ── Bar chart: rata-rata juz per kelas ──────────────── //
  const kelasList  = ['1','2','3','4','5'];
  const avgPerKelas = kelasList.map(kl => {
    const rows = data.filter(r => r.kelas === kl);
    if (!rows.length) return 0;
    return parseFloat(
      (rows.reduce((s,r) =>
        s+(parseInt(r.juz_selesai)||0), 0) / rows.length
      ).toFixed(1)
    );
  });
  const klsLabels  = kelasList.map(k =>
    KELAS_LABEL_HF[k]?.replace(' (Ula)','')
      .replace(' (Wustho)','')
      .replace(' (Ulya)','') || `Kls ${k}`
  );

  const ctxK = document.getElementById('chart-hf-kelas');
  if (ctxK && typeof Chart !== 'undefined') {
    if (_hf.chartKelas_inst) {
      _hf.chartKelas_inst.destroy();
      _hf.chartKelas_inst = null;
    }
    _hf.chartKelas_inst = new Chart(ctxK, {
      type: 'bar',
      data: {
        labels: klsLabels,
        datasets: [{
          label: 'Rata-rata Juz Selesai',
          data:  avgPerKelas,
          backgroundColor: [
            'rgba(26,107,60,.7)',
            'rgba(26,107,60,.75)',
            'rgba(26,107,60,.8)',
            'rgba(26,107,60,.85)',
            'rgba(26,107,60,.9)',
          ],
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2b1e',
            titleColor: '#fff',
            bodyColor:  'rgba(255,255,255,.75)',
            padding: 10, borderRadius: 8,
            callbacks: {
              label: ctx =>
                ` Rata-rata: ${ctx.parsed.y} juz`,
            }
          },
        },
        scales: {
          x: {
            grid:   { display: false },
            ticks:  { font:{ size:12 }, color:'#94a89a' },
            border: { display: false },
          },
          y: {
            max:    30,
            grid:   { color:'rgba(26,107,60,.06)' },
            ticks:  { font:{ size:11 }, color:'#94a89a', stepSize:5 },
            border: { display: false },
          }
        }
      }
    });
  }
}

/* ============================================================
   app.hafalan.js — Batch 4: Modal, Export, Wire Events & Init
   ============================================================ */

/* ── SWITCH TAB HELPER ───────────────────────────────────────── */
function _switchTab(tabId) {
  document.querySelectorAll('[data-hf-tab]').forEach(t => {
    t.classList.toggle('active', t.dataset.hfTab === tabId);
  });
  ['ringkasan','detail','progres'].forEach(p => {
    const el = document.getElementById(`hf-panel-${p}`);
    if (el) el.style.display = p === tabId ? '' : 'none';
  });
  _hf.tab = tabId;
}

/* ── MODAL: BUKA (tambah baru) ───────────────────────────────── */
function _openModal(santriId = '', santriNama = '') {
  _hf.editId = null;

  const titleEl = document.getElementById('modal-hf-title');
  const lblEl   = document.getElementById('btn-simpan-hf-label');
  const form    = document.getElementById('form-hafalan');
  if (titleEl) titleEl.textContent = 'Catat Hafalan';
  if (lblEl)   lblEl.textContent   = 'Simpan';
  if (form)    form.reset();

  // Set santri & tanggal default
  const santriEl = document.getElementById('hf-form-santri');
  if (santriEl && santriId) santriEl.value = santriId;

  const tglEl = document.getElementById('hf-form-tgl');
  if (tglEl) tglEl.value = _today();

  const editId = document.getElementById('hf-edit-id');
  if (editId) editId.value = '';

  window.openModal('modal-hafalan-form');
}

/* ── MODAL: BUKA (edit) ──────────────────────────────────────── */
function _openModalEdit(rowId) {
  const row = _hf.detailCache.find(r => r.id === rowId);
  if (!row) return;
  _hf.editId = rowId;

  const titleEl = document.getElementById('modal-hf-title');
  const lblEl   = document.getElementById('btn-simpan-hf-label');
  if (titleEl) titleEl.textContent = `Edit Hafalan — Juz ${row.juz}`;
  if (lblEl)   lblEl.textContent   = 'Update';

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };

  const editId = document.getElementById('hf-edit-id');
  if (editId) editId.value = rowId;

  // Set santri dari state
  const santriEl = document.getElementById('hf-form-santri');
  if (santriEl) santriEl.value = _hf.detailSantriId;

  set('hf-form-juz',          row.juz);
  set('hf-form-surah-mulai',  row.surah_mulai   || '');
  set('hf-form-surah-selesai',row.surah_selesai || '');
  set('hf-form-status',       row.status);
  set('hf-form-nilai',        row.nilai_hafalan !== null
    ? row.nilai_hafalan : '');
  set('hf-form-tgl',          row.tgl_setor     || _today());
  set('hf-form-musyrif',      row.musyrif_id    || '');
  set('hf-form-catatan',      row.catatan       || '');

  window.openModal('modal-hafalan-form');
}

/* ── SUBMIT FORM HAFALAN ─────────────────────────────────────── */
async function _submitHafalan() {
  const santriId    = document.getElementById('hf-form-santri')?.value;
  const juz         = parseInt(document.getElementById('hf-form-juz')?.value);
  const status      = document.getElementById('hf-form-status')?.value;
  const nilaiRaw    = document.getElementById('hf-form-nilai')?.value;
  const tgl         = document.getElementById('hf-form-tgl')?.value;
  const musyrifId   = document.getElementById('hf-form-musyrif')?.value;
  const catatan     = document.getElementById('hf-form-catatan')?.value.trim();
  const surahMulai  = parseInt(document.getElementById('hf-form-surah-mulai')?.value) || null;
  const surahSelesai= parseInt(document.getElementById('hf-form-surah-selesai')?.value) || null;
  const editId      = document.getElementById('hf-edit-id')?.value || null;

  // Validasi
  if (!santriId || !juz || !status) {
    window.showToast('error','Validasi Gagal',
      'Santri, Juz, dan Status wajib diisi.'); return;
  }
  if (juz < 1 || juz > 30) {
    window.showToast('error','Juz Tidak Valid',
      'Juz harus antara 1 sampai 30.'); return;
  }
  const nilai = nilaiRaw !== '' && nilaiRaw !== undefined
    ? parseFloat(nilaiRaw) : null;
  if (nilai !== null && (isNaN(nilai) || nilai < 0 || nilai > 100)) {
    window.showToast('error','Nilai Tidak Valid',
      'Nilai harus antara 0 sampai 100.'); return;
  }

  const btnSimpan = document.getElementById('btn-simpan-hafalan');
  if (btnSimpan) btnSimpan.disabled = true;

  const payload = {
    ...(editId ? { id: editId } : {}),
    santri_id:     santriId,
    juz,
    surah_mulai:   surahMulai,
    surah_selesai: surahSelesai,
    status,
    nilai_hafalan: nilai,
    tgl_setor:     tgl     || null,
    musyrif_id:    musyrifId|| null,
    catatan:       catatan || null,
  };

  const result = await _upsertHafalan(payload);

  if (btnSimpan) btnSimpan.disabled = false;

  if (result.ok) {
    const santri = (window.santriCache||[])
      .find(s => s._id === santriId);
    window.showToast('success',
      editId ? 'Hafalan Diperbarui' : 'Hafalan Dicatat',
      `Juz ${juz} — ${santri?.nama || ''} berhasil disimpan.`
    );
    window.closeModal('modal-hafalan-form');

    // Reload data relevan
    await _renderRingkasan();
    if (_hf.tab === 'detail' && _hf.detailSantriId === santriId) {
      await _renderDetailJuz();
    }
  } else {
    window.showToast('error','Gagal Menyimpan',
      result.msg || 'Terjadi kesalahan.');
  }
}

/* ── EXPORT CSV ──────────────────────────────────────────────── */
async function _exportCSV() {
  const data = await _loadRingkasan();
  if (!data.length) {
    window.showToast('warning','Tidak Ada Data',''); return;
  }

  const hdr  = ['Nama','NIS','Kelas','Juz Selesai',
                 'Juz Proses','Juz Mengulang',
                 'Rata Nilai','Tgl Setor Terakhir'];
  const rows = data.map(r => [
    r.nama, r.nis,
    KELAS_LABEL_HF[r.kelas] || r.kelas,
    r.juz_selesai   || 0,
    r.juz_proses    || 0,
    r.juz_mengulang || 0,
    r.rata_nilai    || '—',
    r.tgl_setor_terakhir
      ? _formatTglShort(r.tgl_setor_terakhir) : '—',
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));

  const csv  = [hdr,...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],
    { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `hafalan-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('success','Export Berhasil',
    `${data.length} data diekspor.`);
}

/* ── WIRE: SEMUA EVENT LISTENERS ─────────────────────────────── */
function _wireEvents() {

  // ── Tab switching ──────────────────────────────────── //
  document.querySelectorAll('[data-hf-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      _switchTab(tab.dataset.hfTab);
      if (_hf.tab === 'progres') _renderProgres();
      if (_hf.tab === 'detail')  _renderDetailJuz();
    });
  });

  // ── Filter ringkasan ───────────────────────────────── //
  document.getElementById('hf-filter-kelas')
    ?.addEventListener('change', e => {
      _hf.filterKelas = e.target.value;
      _hf.page = 1; _renderRingkasan();
    });

  document.getElementById('hf-filter-min-juz')
    ?.addEventListener('change', e => {
      _hf.filterMinJuz = parseInt(e.target.value) || 0;
      _hf.page = 1; _renderRingkasan();
    });

  document.getElementById('hf-search')
    ?.addEventListener('input', e => {
      _hf.searchQ = e.target.value;
      _hf.page = 1; _renderRingkasan();
    });

  // ── Filter detail ──────────────────────────────────── //
  document.getElementById('hf-detail-santri')
    ?.addEventListener('change', e => {
      _hf.detailSantriId = e.target.value;
      _renderDetailJuz();
    });

  document.getElementById('hf-detail-status')
    ?.addEventListener('change', e => {
      _hf.detailStatus = e.target.value;
      _renderDetailJuz();
    });

  // ── Filter chart ───────────────────────────────────── //
  document.getElementById('hf-chart-kelas')
    ?.addEventListener('change', e => {
      _hf.chartKelas = e.target.value;
      _renderProgres();
    });

  // ── Tombol Catat Hafalan (header) ──────────────────── //
  document.getElementById('btn-tambah-hafalan')
    ?.addEventListener('click', () => _openModal());

  // ── Export CSV ─────────────────────────────────────── //
  document.getElementById('btn-export-hafalan')
    ?.addEventListener('click', _exportCSV);

  // ── Tombol Simpan modal ────────────────────────────── //
  document.getElementById('btn-simpan-hafalan')
    ?.addEventListener('click', _submitHafalan);

  // ── Enter di form (kecuali textarea) ──────────────── //
  document.getElementById('form-hafalan')
    ?.addEventListener('keydown', e => {
      if (e.key === 'Enter' &&
          e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        _submitHafalan();
      }
    });

  // ── Juz berubah → filter surah otomatis ───────────── //
  document.getElementById('hf-form-juz')
    ?.addEventListener('change', e => {
      const juz    = parseInt(e.target.value);
      if (!juz) return;

      const surahJuz = _surahByJuz(juz);
      const opts     = surahJuz.map(s =>
        `<option value="${s.no}">${s.no}. ${s.nama}</option>`
      ).join('');
      const allOpts  = '<option value="">— Pilih —</option>' +
        SURAH_LIST.map(s =>
          `<option value="${s.no}">${s.no}. ${s.nama}</option>`
        ).join('');

      // Surah mulai: filter sesuai juz
      const mulaiEl = document.getElementById('hf-form-surah-mulai');
      if (mulaiEl) {
        mulaiEl.innerHTML =
          '<option value="">— Pilih —</option>' + opts;
        if (surahJuz.length) mulaiEl.value = surahJuz[0].no;
      }
      // Surah selesai: semua surah (juz bisa lintas surah)
      const selesaiEl = document.getElementById('hf-form-surah-selesai');
      if (selesaiEl) {
        selesaiEl.innerHTML = allOpts;
        if (surahJuz.length) {
          selesaiEl.value =
            surahJuz[surahJuz.length - 1].no;
        }
      }
    });

  // ── Tutup modal ────────────────────────────────────── //
  document.querySelectorAll('[data-close-modal="modal-hafalan-form"]')
    .forEach(btn => btn.addEventListener('click', () =>
      window.closeModal('modal-hafalan-form')));

  document.getElementById('modal-hafalan-form')
    ?.addEventListener('click', e => {
      if (e.target.id === 'modal-hafalan-form')
        window.closeModal('modal-hafalan-form');
    });
}

/* ── INIT MODUL ──────────────────────────────────────────────── */
(async function _init() {

  _wireEvents();
  _populateSelects();

  window.addEventListener('madin:navigate', async e => {
    if (e.detail.page !== 'hafalan') return;

    // Re-wire & repopulate setiap navigasi
    _wireEvents();
    _populateSelects();

    // Restore tab aktif
    _switchTab(_hf.tab);

    // Load data awal
    _hf.ringkasanCache = await _loadRingkasan();
    _updateStatCards(_hf.ringkasanCache);

    if (_hf.tab === 'ringkasan') await _renderRingkasan();
    if (_hf.tab === 'detail')    await _renderDetailJuz();
    if (_hf.tab === 'progres')   await _renderProgres();
  });

  console.log('[Madin] Hafalan module loaded ✓');

})();
