/* ============================================================
   app.nilai.js — Modul Nilai Santri
   Portal Pengurus Madrasah Diniyah DQLM

   SOP: File ini HANYA berisi state, CRUD Supabase,
        event listeners, dan mapping data dinamis (<tr>).
        Tidak ada innerHTML struktur HTML halaman.
   ============================================================ */

'use strict';

/* ── KONSTANTA ───────────────────────────────────────────────── */
const MAPEL_LIST_NILAI = [
  "Al-Qur'an / Tahfidz", 'Tajwid', 'Fiqih', 'Aqidah',
  'Akhlak', 'Hadits', 'Tafsir', 'Nahwu', 'Sharaf',
  'Bahasa Arab', 'Sejarah Islam', "Imla'",
];

const JENIS_UJIAN = ['Harian', 'UTS', 'UAS', 'Praktik'];

const KELAS_LABEL = {
  '1':'Kelas 1 (Awwaliyah)',   '2':'Kelas 2 (Awwaliyah)',
  '3':'Kelas 3 (Awwaliyah)',  '4':'Kelas 4 (Awwaliyah)',
};

// Rentang distribusi untuk chart
const DIST_RANGES = [
  { label:'< 40',    min:0,  max:39  },
  { label:'40–54',   min:40, max:54  },
  { label:'55–69',   min:55, max:69  },
  { label:'70–79',   min:70, max:79  },
  { label:'80–89',   min:80, max:89  },
  { label:'90–100',  min:90, max:100 },
];

/* ── STATE ───────────────────────────────────────────────────── */
const _nv = {
  tab:          'input',
  // Input panel
  inputKelas:   '',
  inputMapel:   '',
  inputJenis:   'UTS',
  inputPeriode: '',
  inputKKM:     70,
  inputCache:   [],   // { santriId, nis, nama, nilaiId|null, nilai, ket }
  // Rekap panel
  rekapKelas:   '',
  rekapJenis:   'UTS',
  rekapPeriode: '',
  rekapData:    [],   // raw rows dari Supabase
  // Statistik panel
  statKelas:    '',
  statMapel:    '',
  statJenis:    '',
  statPeriode:  '',
  statData:     [],
  // Modal edit individual
  modalSantriId: null,
  modalEditId:   null,
  // Chart instance
  chartDist:    null,
  // Global stat cache (untuk stat cards)
  allData:      [],
};

/* ── UTILITAS ─────────────────────────────────────────────────── */
function _x(str = '') {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _nilaiColor(nilai, kkm = 70) {
  if (nilai === null || nilai === undefined || nilai === '') return '';
  const n = parseFloat(nilai);
  if (n >= kkm)  return '#15803d';
  if (n >= kkm - 15) return '#b45309';
  return '#b91c1c';
}

function _gradeBadge(nilai, kkm = 70) {
  if (nilai === null || nilai === undefined || nilai === '') {
    return '<span class="badge neutral"><span class="badge-dot"></span>Belum</span>';
  }
  const n = parseFloat(nilai);
  if (n >= kkm) {
    return '<span class="badge success"><span class="badge-dot"></span>Lulus</span>';
  }
  return '<span class="badge danger"><span class="badge-dot"></span>Remidi</span>';
}

function _gradeHuruf(nilai) {
  const n = parseFloat(nilai);
  if (isNaN(n)) return '—';
  if (n >= 90) return 'A';
  if (n >= 80) return 'B';
  if (n >= 70) return 'C';
  if (n >= 60) return 'D';
  return 'E';
}

function _skeletonTr(cols) {
  return `<tr>${Array.from({ length: cols }, () =>
    `<td><div style="height:14px;border-radius:4px;
         background:rgba(26,107,60,.07);
         animation:pulse 1.5s infinite;"></div></td>`
  ).join('')}</tr>`;
}

/* ── SUPABASE: LOAD NILAI ─────────────────────────────────────── */
async function _loadNilai({ kelas, mapel, jenis, periode }) {
  if (!window.supabase) return [];

  let q = window.supabase
    .from('nilai')
    .select(`
      id, santri_id, mapel, jenis_ujian,
      periode, nilai, kkm, keterangan,
      santri:santri_id ( nis, nama, kelas )
    `);

  if (jenis)   q = q.eq('jenis_ujian', jenis);
  if (periode) q = q.eq('periode', periode);
  if (mapel)   q = q.eq('mapel', mapel);

  // Filter kelas via santri (join)
  // Supabase tidak support filter pada relasi langsung —
  // kita filter client-side setelah fetch
  const { data, error } = await q
    .order('santri(nama)', { ascending: true });

  if (error) {
    console.error('[Nilai] Load error:', error.message);
    window.showToast('warning', 'Data Offline',
      'Gagal memuat nilai: ' + error.message);
    return [];
  }

  const rows = data || [];
  return kelas
    ? rows.filter(r => r.santri?.kelas === kelas)
    : rows;
}

/* ── SUPABASE: UPSERT NILAI (batch) ──────────────────────────── */
async function _upsertNilai(rows) {
  if (!window.supabase) return { ok: false, count: 0 };

  const payload = rows.map(r => ({
    ...(r.nilaiId ? { id: r.nilaiId } : {}),
    santri_id:   r.santriId,
    mapel:       r.mapel,
    jenis_ujian: r.jenis,
    periode:     r.periode,
    nilai:       r.nilai,
    kkm:         r.kkm,
    keterangan:  r.keterangan || null,
    dicatat_oleh: window.currentUser?.uid || null,
  }));

  const { data, error } = await window.supabase
    .from('nilai')
    .upsert(payload, {
      onConflict: 'santri_id,mapel,jenis_ujian,periode',
      ignoreDuplicates: false,
    })
    .select();

  if (error) {
    console.error('[Nilai] Upsert error:', error.message);
    return { ok: false, count: 0, msg: error.message };
  }
  return { ok: true, count: (data || []).length };
}

/* ── SUPABASE: DELETE NILAI ──────────────────────────────────── */
async function _deleteNilai(id) {
  if (!window.supabase) return false;
  const { error } = await window.supabase
    .from('nilai').delete().eq('id', id);
  if (error) {
    window.showToast('error', 'Gagal Hapus', error.message);
    return false;
  }
  return true;
}

/* ── SUPABASE: LOAD SEMUA NILAI (untuk stat cards global) ─────── */
async function _loadAllNilai() {
  if (!window.supabase) return [];
  const { data, error } = await window.supabase
    .from('nilai')
    .select('nilai, kkm, mapel, jenis_ujian, periode');
  if (error) return [];
  return data || [];
}

/* ── STAT CARDS GLOBAL ───────────────────────────────────────── */
async function _updateStatCards() {
  _nv.allData = await _loadAllNilai();
  const data  = _nv.allData;

  if (!data.length) {
    ['sc-nilai-rata','sc-nilai-lulus','sc-nilai-bl',
     'sc-nilai-total'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    return;
  }

  const vals  = data.map(r => parseFloat(r.nilai)).filter(v => !isNaN(v));
  const rata  = vals.reduce((s,v) => s+v, 0) / vals.length;
  const lulus = data.filter(r => parseFloat(r.nilai) >= (r.kkm || 70)).length;
  const bl    = data.length - lulus;
  const pctL  = Math.round((lulus / data.length) * 100);
  const pctBL = 100 - pctL;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('sc-nilai-rata',       rata.toFixed(1));
  set('sc-nilai-rata-info',  `dari ${data.length} data nilai`);
  set('sc-nilai-lulus',      lulus);
  set('sc-nilai-lulus-pct',  `↑ ${pctL}% dari total`);
  set('sc-nilai-bl',         bl);
  set('sc-nilai-bl-pct',     `↓ ${pctBL}% dari total`);
  set('sc-nilai-total',      data.length);
  set('sc-nilai-total-info', `${new Set(data.map(r=>r.mapel)).size} mata pelajaran`);
}

/* ============================================================
   app.nilai.js — Batch 3: Render Functions
   (Input Table, Live Counter, Rekap, Statistik & Chart)
   ============================================================ */

/* ── RENDER: TABEL INPUT NILAI ───────────────────────────────── */
async function _renderInputTable() {
  const tbody  = document.getElementById('tbody-input-nilai');
  if (!tbody) return;

  const kelas  = _nv.inputKelas;
  const mapel  = _nv.inputMapel;
  const jenis  = _nv.inputJenis;
  const periode= _nv.inputPeriode;
  const kkm    = _nv.inputKKM;

  if (!kelas || !mapel || !jenis || !periode) {
    tbody.innerHTML = `
      <tr><td colspan="8"
          style="text-align:center;padding:48px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-funnel"
           style="font-size:24px;display:block;
                  margin-bottom:8px;opacity:.3;"></i>
        Pilih kelas, mapel, jenis ujian &amp; periode,
        lalu klik "Muat".
      </td></tr>`;
    _updateInputCounter([]);
    return;
  }

  // Skeleton
  tbody.innerHTML = Array.from({ length: 5 }, () =>
    _skeletonTr(8)).join('');

  // Ambil santri aktif kelas ini
  const santriKelas = (window.santriCache || [])
    .filter(s => s.kelas === kelas && s.status === 'Aktif')
    .sort((a, b) => a.nama.localeCompare(b.nama));

  if (!santriKelas.length) {
    tbody.innerHTML = `
      <tr><td colspan="8"
          style="text-align:center;padding:40px;
                 color:var(--clr-text-muted);">
        Tidak ada santri aktif di kelas ini.
      </td></tr>`;
    _updateInputCounter([]);
    return;
  }

  // Ambil nilai yang sudah tersimpan
  const existing = await _loadNilai({ kelas, mapel, jenis, periode });
  const nilaiMap = {};
  existing.forEach(r => { nilaiMap[r.santri_id] = r; });

  // Bangun cache untuk simpan batch
  _nv.inputCache = santriKelas.map(s => {
    const saved = nilaiMap[s._id];
    return {
      santriId:  s._id,
      nis:       s.nis,
      nama:      s.nama,
      nilaiId:   saved?.id   || null,
      nilai:     saved?.nilai ?? '',
      keterangan:saved?.keterangan || '',
      mapel, jenis, periode, kkm,
    };
  });

  // Render baris
  tbody.innerHTML = _nv.inputCache.map((row, i) => `
    <tr data-idx="${i}">
      <td style="text-align:center;font-size:12px;
                 color:var(--clr-text-muted);">${i + 1}</td>
      <td style="font-weight:600;">${_x(row.nama)}</td>
      <td style="font-family:monospace;font-size:12px;
                 color:var(--clr-text-sub);">${_x(row.nis)}</td>
      <td style="text-align:center;">
        <input
          type="number"
          class="nilai-angka-input"
          data-idx="${i}"
          value="${row.nilai !== '' ? row.nilai : ''}"
          min="0" max="100" step="0.5"
          placeholder="—"
          style="color:${_nilaiColor(row.nilai, kkm)};"
        />
      </td>
      <td style="text-align:center;font-size:13px;
                 font-weight:600;color:var(--clr-text-sub);">
        ${kkm}
      </td>
      <td style="text-align:center;"
          id="status-cell-${i}">
        ${_gradeBadge(row.nilai, kkm)}
      </td>
      <td>
        <input
          type="text"
          class="nilai-ket-input"
          data-idx="${i}"
          value="${_x(row.keterangan)}"
          placeholder="Opsional"
          style="height:30px;font-size:12.5px;
                 width:100%;border:1.5px solid #d8e6dc;
                 border-radius:6px;padding:0 10px;
                 font-family:inherit;"
        />
      </td>
      <td style="text-align:center;">
        <button class="btn-tbl"
                style="background:rgba(26,107,60,.08);
                       color:var(--clr-primary);
                       border:1.5px solid rgba(26,107,60,.15);"
                title="Edit individual"
                data-open-modal="${i}">
          <i class="ph-bold ph-pencil-simple"></i>
        </button>
      </td>
    </tr>`).join('');

  // Wire: input nilai → update state + status cell + counter
  tbody.querySelectorAll('.nilai-angka-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.dataset.idx);
      const val = inp.value === '' ? '' : parseFloat(inp.value);
      _nv.inputCache[idx].nilai = val;
      inp.style.color = _nilaiColor(val, kkm);

      // Update status cell
      const cell = document.getElementById(`status-cell-${idx}`);
      if (cell) cell.innerHTML = _gradeBadge(val, kkm);

      _updateInputCounter(_nv.inputCache);
    });
  });

  // Wire: keterangan → update state
  tbody.querySelectorAll('.nilai-ket-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.dataset.idx);
      _nv.inputCache[idx].keterangan = inp.value;
    });
  });

  // Wire: buka modal edit individual
  tbody.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.openModal);
      _openModalIndividual(idx);
    });
  });

  _updateInputCounter(_nv.inputCache);
}

/* ── UPDATE LIVE COUNTER ─────────────────────────────────────── */
function _updateInputCounter(cache) {
  const filled = cache.filter(r => r.nilai !== '');
  const lulus  = filled.filter(r =>
    parseFloat(r.nilai) >= (r.kkm || 70)).length;
  const bl     = filled.length - lulus;
  const avg    = filled.length
    ? (filled.reduce((s,r) => s + parseFloat(r.nilai), 0)
       / filled.length).toFixed(1)
    : '—';

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('input-nilai-count',  cache.length);
  set('input-nilai-lulus',  lulus);
  set('input-nilai-bl',     bl);
  set('input-nilai-avg',    avg);
}

/* ── SIMPAN SEMUA NILAI (BATCH) ──────────────────────────────── */
async function _simpanSemuaNilai() {
  const toSave = _nv.inputCache.filter(r => r.nilai !== '');

  if (!toSave.length) {
    window.showToast('warning', 'Tidak Ada Data',
      'Belum ada nilai yang diisi.'); return;
  }

  const btn = document.getElementById('btn-simpan-semua-nilai');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<div style="width:16px;height:16px;border:2px solid ' +
      'rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;' +
      'animation:spin .7s linear infinite;display:inline-block;' +
      'vertical-align:middle;margin-right:6px;"></div>Menyimpan…';
  }

  const result = await _upsertNilai(toSave);

  if (btn) {
    btn.disabled = false;
    btn.innerHTML =
      '<i class="ph-bold ph-floppy-disk"></i> Simpan Semua';
  }

  if (result.ok) {
    window.showToast('success', 'Nilai Disimpan',
      `${toSave.length} nilai berhasil disimpan.`);
    await _updateStatCards();
  } else {
    window.showToast('error', 'Gagal Menyimpan',
      result.msg || 'Terjadi kesalahan.');
  }
}

/* ── RENDER: REKAP NILAI (tabel lintas mapel) ────────────────── */
async function _renderRekapNilai() {
  const kelas  = _nv.rekapKelas;
  const jenis  = _nv.rekapJenis;
  const periode= _nv.rekapPeriode;
  const thead  = document.getElementById('thead-rekap-nilai');
  const tbody  = document.getElementById('tbody-rekap-nilai');
  if (!thead || !tbody) return;

  if (!kelas || !periode) {
    thead.innerHTML = `<tr>
      <th>#</th><th>Nama Santri</th><th>NIS</th>
      <th colspan="99" style="text-align:center;
          color:var(--clr-text-muted);padding:20px;">
        Pilih kelas &amp; periode lalu klik "Tampilkan".
      </th></tr>`;
    tbody.innerHTML = '';
    return;
  }

  // Skeleton
  tbody.innerHTML = Array.from({ length: 5 },
    () => _skeletonTr(6)).join('');

  // Load data
  _nv.rekapData = await _loadNilai({ kelas, jenis, periode });

  if (!_nv.rekapData.length) {
    thead.innerHTML = `<tr>
      <th>#</th><th>Nama Santri</th><th>NIS</th>
      <th colspan="99" style="text-align:center;
          color:var(--clr-text-muted);padding:20px;">
        Belum ada nilai untuk filter ini.
      </th></tr>`;
    tbody.innerHTML = '';
    return;
  }

  // Ambil daftar mapel unik dari data
  const mapels = [...new Set(_nv.rekapData.map(r => r.mapel))].sort();

  // Kumpulkan data per santri
  const santriMap = {};
  _nv.rekapData.forEach(r => {
    const sid = r.santri_id;
    if (!santriMap[sid]) {
      santriMap[sid] = {
        nama:  r.santri?.nama || '—',
        nis:   r.santri?.nis  || '—',
        nilai: {},
        kkm:   {},
      };
    }
    santriMap[sid].nilai[r.mapel] = parseFloat(r.nilai);
    santriMap[sid].kkm[r.mapel]   = r.kkm || 70;
  });

  const santriList = Object.values(santriMap)
    .sort((a,b) => a.nama.localeCompare(b.nama));

  // ── Header kolom mapel ──────────────────────────────── //
  thead.innerHTML = `<tr>
    <th style="width:36px;text-align:center;">#</th>
    <th>Nama Santri</th>
    <th style="width:80px;">NIS</th>
    ${mapels.map(m => `
      <th style="text-align:center;min-width:80px;
                 font-size:11.5px;">${_x(m)}</th>`
    ).join('')}
    <th style="text-align:center;min-width:70px;">Rata-rata</th>
    <th style="text-align:center;min-width:80px;">Status</th>
  </tr>`;

  // ── Baris per santri ────────────────────────────────── //
  tbody.innerHTML = santriList.map((s, i) => {
    const vals = mapels
      .map(m => s.nilai[m])
      .filter(v => v !== undefined && !isNaN(v));
    const avg  = vals.length
      ? (vals.reduce((a,b) => a+b, 0) / vals.length)
      : null;
    const kkm  = 70; // default KKM untuk status keseluruhan
    const lulusAll = vals.length > 0 &&
      mapels.every(m => (s.nilai[m] ?? 0) >= (s.kkm[m] || kkm));

    return `
      <tr>
        <td style="text-align:center;font-size:12px;
                   color:var(--clr-text-muted);">${i+1}</td>
        <td style="font-weight:600;">${_x(s.nama)}</td>
        <td style="font-family:monospace;font-size:12px;
                   color:var(--clr-text-sub);">${_x(s.nis)}</td>
        ${mapels.map(m => {
          const v   = s.nilai[m];
          const k   = s.kkm[m] || kkm;
          const col = _nilaiColor(v, k);
          return `<td style="text-align:center;font-weight:700;
                              font-family:monospace;
                              color:${col};">
                    ${v !== undefined ? v.toFixed(1) : '—'}
                  </td>`;
        }).join('')}
        <td style="text-align:center;font-weight:700;
                   font-family:monospace;
                   color:${_nilaiColor(avg, kkm)};">
          ${avg !== null ? avg.toFixed(1) : '—'}
        </td>
        <td style="text-align:center;">
          ${vals.length === 0
            ? '<span class="badge neutral"><span class="badge-dot"></span>Belum</span>'
            : lulusAll
            ? '<span class="badge success"><span class="badge-dot"></span>Lulus</span>'
            : '<span class="badge danger"><span class="badge-dot"></span>Remidi</span>'
          }
        </td>
      </tr>`;
  }).join('');
}

/* ── RENDER: STATISTIK & CHART ───────────────────────────────── */
async function _renderStatistik() {
  const tbody = document.getElementById('tbody-statistik-nilai');
  if (!tbody) return;

  tbody.innerHTML = Array.from({ length: 5 },
    () => _skeletonTr(7)).join('');

  _nv.statData = await _loadNilai({
    kelas:   _nv.statKelas,
    mapel:   _nv.statMapel,
    jenis:   _nv.statJenis,
    periode: _nv.statPeriode,
  });

  if (!_nv.statData.length) {
    tbody.innerHTML = `
      <tr><td colspan="7"
          style="text-align:center;padding:40px;
                 color:var(--clr-text-muted);">
        Belum ada data untuk filter ini.
      </td></tr>`;
    _resetStatRingkasan();
    _renderDistChart([]);
    return;
  }

  // Sorting: tertinggi ke terendah
  const sorted = [..._nv.statData]
    .sort((a,b) => parseFloat(b.nilai) - parseFloat(a.nilai));

  // ── Ranking table ──────────────────────────────────── //
  tbody.innerHTML = sorted.map((r, i) => {
    const n   = parseFloat(r.nilai);
    const kkm = r.kkm || 70;
    const rankIcon = i === 0
      ? '🥇' : i === 1
      ? '🥈' : i === 2
      ? '🥉' : `${i+1}`;

    return `
      <tr>
        <td style="text-align:center;font-size:15px;">
          ${rankIcon}
        </td>
        <td style="font-weight:600;">
          ${_x(r.santri?.nama || '—')}
        </td>
        <td style="font-family:monospace;font-size:12px;
                   color:var(--clr-text-sub);">
          ${_x(r.santri?.nis || '—')}
        </td>
        <td style="text-align:center;font-weight:800;
                   font-size:15px;font-family:monospace;
                   color:${_nilaiColor(n, kkm)};">
          ${n.toFixed(1)}
        </td>
        <td style="text-align:center;font-size:13px;
                   color:var(--clr-text-muted);">
          ${kkm}
        </td>
        <td style="text-align:center;">
          ${_gradeBadge(n, kkm)}
        </td>
        <td style="font-size:13px;">
          ${_x(r.mapel)}
        </td>
      </tr>`;
  }).join('');

  // ── Ringkasan angka ────────────────────────────────── //
  const vals   = _nv.statData
    .map(r => parseFloat(r.nilai))
    .filter(v => !isNaN(v));
  const avg    = vals.reduce((s,v) => s+v, 0) / vals.length;
  const max    = Math.max(...vals);
  const min    = Math.min(...vals);
  const lulus  = _nv.statData
    .filter(r => parseFloat(r.nilai) >= (r.kkm||70)).length;
  const bl     = _nv.statData.length - lulus;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('stat-nilai-tertinggi', max.toFixed(1));
  set('stat-nilai-avg',       avg.toFixed(1));
  set('stat-nilai-terendah',  min.toFixed(1));
  set('stat-di-atas-kkm',
    `${lulus} santri (${Math.round(lulus/vals.length*100)}%)`);
  set('stat-di-bawah-kkm',
    `${bl} santri (${Math.round(bl/vals.length*100)}%)`);

  _renderDistChart(vals);
}

function _resetStatRingkasan() {
  ['stat-nilai-tertinggi','stat-nilai-avg',
   'stat-nilai-terendah','stat-di-atas-kkm',
   'stat-di-bawah-kkm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
}

/* ── RENDER: CHART DISTRIBUSI ────────────────────────────────── */
function _renderDistChart(vals) {
  const canvas = document.getElementById('chart-distribusi-nilai');
  if (!canvas || typeof Chart === 'undefined') return;

  // Hapus instance lama
  if (_nv.chartDist) { _nv.chartDist.destroy(); _nv.chartDist = null; }

  const counts = DIST_RANGES.map(range =>
    vals.filter(v => v >= range.min && v <= range.max).length
  );

  const colors = [
    'rgba(239,68,68,.75)',    // <40 merah
    'rgba(239,68,68,.5)',     // 40-54 merah muda
    'rgba(245,158,11,.7)',    // 55-69 kuning
    'rgba(26,107,60,.6)',     // 70-79 hijau muda
    'rgba(26,107,60,.8)',     // 80-89 hijau
    'rgba(26,107,60,1)',      // 90-100 hijau tua
  ];

  _nv.chartDist = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: DIST_RANGES.map(r => r.label),
      datasets: [{
        label: 'Jumlah Santri',
        data: counts,
        backgroundColor: colors,
        borderRadius: 6,
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
          bodyColor: 'rgba(255,255,255,.75)',
          padding: 10, borderRadius: 8,
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} santri`,
          }
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font:{ size:11 }, color:'#94a89a' },
          border: { display: false },
        },
        y: {
          grid: { color:'rgba(26,107,60,.06)' },
          ticks: {
            font:{ size:11 }, color:'#94a89a',
            stepSize: 1,
            callback: v => Number.isInteger(v) ? v : '',
          },
          border: { display: false },
          min: 0,
        }
      }
    }
  });
}

/* ── MODAL: INPUT INDIVIDUAL ─────────────────────────────────── */
function _openModalIndividual(idx) {
  const row = _nv.inputCache[idx];
  if (!row) return;

  _nv.modalSantriId = row.santriId;
  _nv.modalEditId   = row.nilaiId;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };

  const titleEl = document.getElementById('modal-nilai-title');
  if (titleEl) titleEl.textContent = `Nilai — ${row.nama}`;

  const labelEl = document.getElementById('btn-simpan-nilai-label');
  if (labelEl) labelEl.textContent =
    row.nilaiId ? 'Update Nilai' : 'Simpan Nilai';

  set('nilai-santri-id',      row.santriId);
  set('nilai-edit-id',        row.nilaiId || '');
  set('nilai-santri-nama',    row.nama);
  set('nilai-mapel-modal',    row.mapel);
  set('nilai-jenis-modal',    row.jenis);
  set('nilai-periode-modal',  row.periode);
  set('nilai-kkm-modal',      row.kkm);
  set('nilai-angka-modal',    row.nilai !== '' ? row.nilai : '');
  set('nilai-keterangan-modal', row.keterangan || '');

  // Update preview status
  _updateModalStatusPreview(row.nilai, row.kkm);

  window.openModal('modal-nilai-form');
}

function _updateModalStatusPreview(nilai, kkm) {
  const wrap = document.getElementById('nilai-status-preview');
  if (!wrap) return;
  if (nilai === '' || nilai === null || nilai === undefined) {
    wrap.style.display = 'none'; return;
  }
  const n = parseFloat(nilai);
  const k = parseFloat(kkm) || 70;
  wrap.style.display = 'flex';
  wrap.style.cssText +=
    ';align-items:center;gap:10px;padding:8px 12px;' +
    'border-radius:8px;font-size:13px;font-weight:600;';

  if (n >= k) {
    wrap.style.background = 'rgba(34,197,94,.1)';
    wrap.style.color      = '#15803d';
    wrap.innerHTML =
      `<i class="ph-bold ph-check-circle" style="font-size:18px;"></i>
       Lulus — Nilai ${n} ≥ KKM ${k} &nbsp;|&nbsp;
       Grade: <strong>${_gradeHuruf(n)}</strong>`;
  } else {
    wrap.style.background = 'rgba(239,68,68,.1)';
    wrap.style.color      = '#b91c1c';
    wrap.innerHTML =
      `<i class="ph-bold ph-warning-circle" style="font-size:18px;"></i>
       Remidi — Nilai ${n} &lt; KKM ${k} &nbsp;|&nbsp;
       Grade: <strong>${_gradeHuruf(n)}</strong>`;
  }
}

/* ── SIMPAN NILAI DARI MODAL INDIVIDUAL ──────────────────────── */
async function _simpanNilaiModal() {
  const santriId = document.getElementById('nilai-santri-id')?.value;
  const editId   = document.getElementById('nilai-edit-id')?.value;
  const mapel    = document.getElementById('nilai-mapel-modal')?.value;
  const jenis    = document.getElementById('nilai-jenis-modal')?.value;
  const periode  = document.getElementById('nilai-periode-modal')?.value.trim();
  const kkm      = parseInt(document.getElementById('nilai-kkm-modal')?.value) || 70;
  const nilaiRaw = document.getElementById('nilai-angka-modal')?.value;
  const ket      = document.getElementById('nilai-keterangan-modal')?.value.trim();

  if (!santriId || !mapel || !jenis || !periode || nilaiRaw === '') {
    window.showToast('error', 'Validasi Gagal',
      'Semua field wajib diisi.'); return;
  }
  const nilai = parseFloat(nilaiRaw);
  if (isNaN(nilai) || nilai < 0 || nilai > 100) {
    window.showToast('error', 'Nilai Tidak Valid',
      'Nilai harus antara 0 sampai 100.'); return;
  }

  const btn = document.getElementById('btn-simpan-nilai-modal');
  if (btn) btn.disabled = true;

  const result = await _upsertNilai([{
    santriId, nilaiId: editId || null,
    mapel, jenis, periode, kkm, nilai,
    keterangan: ket,
  }]);

  if (btn) btn.disabled = false;

  if (result.ok) {
    window.showToast('success', 'Nilai Disimpan',
      `Nilai ${nilai} berhasil disimpan.`);
    window.closeModal('modal-nilai-form');

    // Sinkronisasi ke inputCache
    const idx = _nv.inputCache.findIndex(r => r.santriId === santriId);
    if (idx !== -1) {
      _nv.inputCache[idx].nilai      = nilai;
      _nv.inputCache[idx].keterangan = ket;

      // Update baris di tabel input tanpa re-render penuh
      const inp = document.querySelector(
        `[data-idx="${idx}"].nilai-angka-input`);
      if (inp) {
        inp.value = nilai;
        inp.style.color = _nilaiColor(nilai, kkm);
      }
      const cell = document.getElementById(`status-cell-${idx}`);
      if (cell) cell.innerHTML = _gradeBadge(nilai, kkm);
      _updateInputCounter(_nv.inputCache);
    }
    await _updateStatCards();
  } else {
    window.showToast('error', 'Gagal Menyimpan',
      result.msg || 'Terjadi kesalahan.');
  }
}

/* ── EXPORT CSV ──────────────────────────────────────────────── */
async function _exportCSV() {
  window.showToast('info', 'Memproses…',
    'Mengambil data untuk export.', 2000);

  const data = await _loadNilai({
    kelas:   _nv.statKelas   || _nv.rekapKelas  || _nv.inputKelas,
    mapel:   _nv.statMapel   || _nv.inputMapel,
    jenis:   _nv.statJenis   || _nv.rekapJenis  || _nv.inputJenis,
    periode: _nv.statPeriode || _nv.rekapPeriode|| _nv.inputPeriode,
  });

  if (!data.length) {
    window.showToast('warning', 'Tidak Ada Data',
      'Tidak ada nilai untuk diekspor.'); return;
  }

  const hdr  = ['Nama','NIS','Kelas','Mata Pelajaran',
                 'Jenis Ujian','Periode','Nilai','KKM',
                 'Grade','Status','Keterangan'];
  const rows = data.map(r => {
    const n   = parseFloat(r.nilai);
    const kkm = r.kkm || 70;
    return [
      r.santri?.nama    || '—',
      r.santri?.nis     || '—',
      KELAS_LABEL[r.santri?.kelas] || r.santri?.kelas || '—',
      r.mapel, r.jenis_ujian, r.periode,
      n.toFixed(1), kkm,
      _gradeHuruf(n),
      n >= kkm ? 'Lulus' : 'Remidi',
      r.keterangan || '',
    ].map(v => `"${String(v).replace(/"/g,'""')}"`);
  });

  const csv  = [hdr, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv],
    { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `nilai-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('success', 'Export Berhasil',
    `${data.length} data nilai diekspor.`);
}

/* ============================================================
   app.nilai.js — Batch 4: Event Listeners & Init
   ============================================================ */

/* ── WIRE: TAB SWITCHING ─────────────────────────────────────── */
function _wireTabs() {
  document.querySelectorAll('[data-nilai-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      _nv.tab = tab.dataset.nilaiTab;

      document.querySelectorAll('[data-nilai-tab]')
        .forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      ['input','rekap','statistik'].forEach(p => {
        const el = document.getElementById(`nilai-panel-${p}`);
        if (el) el.style.display = p === _nv.tab ? '' : 'none';
      });

      // Auto-render saat switch tab
      if (_nv.tab === 'statistik') _renderStatistik();
    });
  });
}

/* ── WIRE: PANEL INPUT ───────────────────────────────────────── */
function _wireInput() {

  // Tombol Muat
  document.getElementById('btn-muat-nilai')
    ?.addEventListener('click', async () => {
      _nv.inputKelas   = document.getElementById('input-nilai-kelas')?.value   || '';
      _nv.inputMapel   = document.getElementById('input-nilai-mapel')?.value   || '';
      _nv.inputJenis   = document.getElementById('input-nilai-jenis')?.value   || 'UTS';
      _nv.inputPeriode = document.getElementById('input-nilai-periode')?.value.trim() || '';
      _nv.inputKKM     = parseInt(document.getElementById('input-nilai-kkm')?.value) || 70;

      if (!_nv.inputKelas || !_nv.inputMapel ||
          !_nv.inputJenis  || !_nv.inputPeriode) {
        window.showToast('warning', 'Filter Belum Lengkap',
          'Isi semua filter sebelum memuat data.'); return;
      }
      await _renderInputTable();
    });

  // Tombol Simpan Semua
  document.getElementById('btn-simpan-semua-nilai')
    ?.addEventListener('click', _simpanSemuaNilai);

  // Sync state saat filter berubah (tanpa auto-load)
  ['input-nilai-kelas','input-nilai-mapel',
   'input-nilai-jenis'].forEach(id => {
    document.getElementById(id)
      ?.addEventListener('change', e => {
        const key = {
          'input-nilai-kelas':  'inputKelas',
          'input-nilai-mapel':  'inputMapel',
          'input-nilai-jenis':  'inputJenis',
        }[id];
        if (key) _nv[key] = e.target.value;
      });
  });

  document.getElementById('input-nilai-periode')
    ?.addEventListener('input', e => {
      _nv.inputPeriode = e.target.value.trim();
    });

  document.getElementById('input-nilai-kkm')
    ?.addEventListener('input', e => {
      _nv.inputKKM = parseInt(e.target.value) || 70;
    });
}

/* ── WIRE: PANEL REKAP ───────────────────────────────────────── */
function _wireRekap() {

  // Tombol Tampilkan
  document.getElementById('btn-tampil-rekap')
    ?.addEventListener('click', async () => {
      _nv.rekapKelas   = document.getElementById('rekap-nilai-kelas')?.value   || '';
      _nv.rekapJenis   = document.getElementById('rekap-nilai-jenis')?.value   || 'UTS';
      _nv.rekapPeriode = document.getElementById('rekap-nilai-periode')?.value.trim() || '';

      if (!_nv.rekapKelas || !_nv.rekapPeriode) {
        window.showToast('warning', 'Filter Belum Lengkap',
          'Pilih kelas dan isi periode terlebih dahulu.'); return;
      }
      await _renderRekapNilai();
    });

  // Export Rekap CSV
  document.getElementById('btn-export-rekap-nilai')
    ?.addEventListener('click', _exportCSV);
}

/* ── WIRE: PANEL STATISTIK ───────────────────────────────────── */
function _wireStatistik() {

  // Auto-render saat filter berubah
  const triggerStat = async () => {
    _nv.statKelas   = document.getElementById('stat-nilai-kelas')?.value  || '';
    _nv.statMapel   = document.getElementById('stat-nilai-mapel')?.value  || '';
    _nv.statJenis   = document.getElementById('stat-nilai-jenis')?.value  || '';
    _nv.statPeriode = document.getElementById('stat-nilai-periode')?.value.trim() || '';
    await _renderStatistik();
  };

  ['stat-nilai-kelas','stat-nilai-mapel',
   'stat-nilai-jenis'].forEach(id => {
    document.getElementById(id)
      ?.addEventListener('change', triggerStat);
  });

  document.getElementById('stat-nilai-periode')
    ?.addEventListener('change', triggerStat);
}

/* ── WIRE: MODAL NILAI INDIVIDUAL ────────────────────────────── */
function _wireModal() {

  // Live preview status saat nilai berubah di modal
  document.getElementById('nilai-angka-modal')
    ?.addEventListener('input', e => {
      const kkm = parseInt(
        document.getElementById('nilai-kkm-modal')?.value) || 70;
      _updateModalStatusPreview(e.target.value, kkm);
    });

  // Update preview saat KKM berubah
  document.getElementById('nilai-kkm-modal')
    ?.addEventListener('input', e => {
      const nilai = document.getElementById('nilai-angka-modal')?.value;
      _updateModalStatusPreview(nilai, e.target.value);
    });

  // Tombol Simpan di modal
  document.getElementById('btn-simpan-nilai-modal')
    ?.addEventListener('click', _simpanNilaiModal);

  // Enter di form modal (kecuali textarea)
  document.getElementById('form-nilai')
    ?.addEventListener('keydown', e => {
      if (e.key === 'Enter' &&
          e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        _simpanNilaiModal();
      }
    });

  // Tutup modal
  document.querySelectorAll('[data-close-modal="modal-nilai-form"]')
    .forEach(btn => {
      btn.addEventListener('click', () =>
        window.closeModal('modal-nilai-form'));
    });

  // Klik overlay untuk tutup
  document.getElementById('modal-nilai-form')
    ?.addEventListener('click', e => {
      if (e.target.id === 'modal-nilai-form')
        window.closeModal('modal-nilai-form');
    });
}

/* ── WIRE: EXPORT GLOBAL ─────────────────────────────────────── */
function _wireExport() {
  document.getElementById('btn-export-nilai')
    ?.addEventListener('click', _exportCSV);
}

/* ── INIT MODUL ──────────────────────────────────────────────── */
// 1. Buat variabel penanda (kunci) agar event tidak diduplikasi
let _isWired = false; 

(async function _init() {

  // 2. Tangani siklus saat user membuka halaman Nilai
  window.addEventListener('madin:navigate', async e => {
    if (e.detail.page !== 'nilai-santri') return;

    // 3. Pasang event listener HANYA jika belum pernah dipasang sebelumnya
    if (!_isWired) {
      _wireTabs();
      _wireInput();
      _wireRekap();
      _wireStatistik();
      _wireModal();
      _wireExport();
      _isWired = true; // Kunci pintunya! (Mencegah hang akibat duplikasi)
    }

    // 4. Pulihkan visual tab yang terakhir aktif
    document.querySelectorAll('[data-nilai-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.nilaiTab === _nv.tab);
    });
    
    ['input','rekap','statistik'].forEach(p => {
      const el = document.getElementById(`nilai-panel-${p}`);
      if (el) el.style.display = p === _nv.tab ? '' : 'none';
    });

    // 5. Load stat cards global di bagian atas halaman
    await _updateStatCards();

    // 6. Khusus Statistik: Auto-render jika periode sudah terpilih
    if (_nv.tab === 'statistik' && _nv.statPeriode) {
      await _renderStatistik();
    }
  });

  console.log('[Madin] Nilai module loaded ✓ (SOP V2 Applied)');

})();
