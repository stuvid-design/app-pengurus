/* ============================================================
   app.absensi.js — Modul Absensi Harian & Rekap Bulanan
   Portal Pengurus Madrasah Diniyah DQLM

   Fitur:
   - Input absensi harian per kelas (H/S/I/A/T)
   - Simpan & update batch ke Supabase
   - Rekap harian: tabel ringkasan per tanggal
   - Buku absen: tabel lengkap per bulan per kelas
   - Statistik: persentase kehadiran per santri
   ============================================================ */

'use strict';

/* ── KONSTANTA ───────────────────────────────────────────────── */
const STATUS_LABEL = {
  H: 'Hadir',
  S: 'Sakit',
  I: 'Izin',
  A: 'Alpha',
  T: 'Terlambat',
};

const STATUS_COLOR = {
  H: { bg:'rgba(34,197,94,.12)',  fg:'#15803d' },
  S: { bg:'rgba(245,158,11,.12)', fg:'#92400e' },
  I: { bg:'rgba(59,130,246,.12)', fg:'#1d4ed8' },
  A: { bg:'rgba(239,68,68,.12)',  fg:'#b91c1c' },
  T: { bg:'rgba(139,92,246,.12)', fg:'#6d28d9' },
};

const KELAS_LIST = [
  { val:'1', label:'Kelas 1 (Awwaliyah)'    },
  { val:'2', label:'Kelas 2 (Awwaliyah)'    },
  { val:'3', label:'Kelas 3 (Awwaliyah)'    },
  { val:'4', label:'Kelas 4 (Awwaliyah)'    },
];

/* ── STATE MODUL ─────────────────────────────────────────────── */
const _state = {
  tab:        'harian',     // 'harian' | 'rekap' | 'buku'
  tglHarian:  _today(),
  kelasHarian:'',
  bulanRekap: _thisMonth(),
  kelasRekap: '',
  bulanBuku:  _thisMonth(),
  kelasBuku:  '',
  absenCache: [],           // cache absensi yang sudah diload
  isSaving:   false,
};

let _isAbsensiWired = false; // KUNCI GUARD: Mencegah Memory Leak

/* ── UTILITAS TANGGAL ─────────────────────────────────────────── */
function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function _daysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function _formatTgl(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('id-ID', {
      weekday:'long', day:'numeric',
      month:'long', year:'numeric'
    });
}

function _formatTglShort(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('id-ID', {
      day:'numeric', month:'short', year:'numeric'
    });
}

function _isLibur(isoDate) {
  const day = new Date(isoDate + 'T00:00:00').getDay();
  return day === 0; // Minggu = libur (sesuaikan jika perlu)
}

/* ── SUPABASE: LOAD ABSENSI SATU HARI ───────────────────────── */
async function _loadAbsensiHarian(tanggal, kelas) {
  if (!window.supabase) return [];

  const { data, error } = await window.supabase
    .from('absensi')
    .select(`
      id, santri_id, tanggal, kelas,
      status, keterangan,
      santri:santri_id ( nis, nama )
    `)
    .eq('tanggal', tanggal)
    .eq('kelas',   kelas)
    .order('santri(nama)', { ascending: true });

  if (error) {
    console.error('[Absensi] Load harian error:', error.message);
    return [];
  }
  return data || [];
}

/* ── SUPABASE: LOAD ABSENSI SATU BULAN ──────────────────────── */
async function _loadAbsensiBulan(yearMonth, kelas) {
  if (!window.supabase) return [];

  const [y, m] = yearMonth.split('-').map(Number);
  const tglAwal = `${yearMonth}-01`;
  const tglAkhir = `${yearMonth}-${String(_daysInMonth(yearMonth)).padStart(2,'0')}`;

  let q = window.supabase
    .from('absensi')
    .select(`
      id, santri_id, tanggal, kelas,
      status, keterangan,
      santri:santri_id ( nis, nama )
    `)
    .gte('tanggal', tglAwal)
    .lte('tanggal', tglAkhir)
    .order('tanggal', { ascending: true });

  if (kelas) q = q.eq('kelas', kelas);

  const { data, error } = await q;

  if (error) {
    console.error('[Absensi] Load bulanan error:', error.message);
    return [];
  }
  return data || [];
}

/* ── SUPABASE: SIMPAN BATCH ABSENSI ─────────────────────────── */
async function _saveAbsensiBatch(rows) {
  if (!window.supabase) {
    window.showToast('warning','Mode Demo','Supabase belum terhubung.'); return false;
  }

  // Upsert: update jika (santri_id, tanggal) sudah ada
  const { error } = await window.supabase
    .from('absensi')
    .upsert(rows, {
      onConflict:    'santri_id,tanggal',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('[Absensi] Upsert error:', error.message);
    window.showToast('error','Gagal Menyimpan', error.message);
    return false;
  }
  return true;
}

/* ── RENDER: FORM INPUT ABSENSI HARIAN ──────────────────────── */
async function _renderFormAbsensi() {
  const kelas  = _state.kelasHarian;
  const tanggal= _state.tglHarian;
  const tbody  = document.getElementById('tbody-absen-harian');
  const infoEl = document.getElementById('absen-hari-info');

  if (infoEl) {
    infoEl.textContent = tanggal
      ? _formatTgl(tanggal)
      : '—';
  }

  if (!tbody) return;

  if (!kelas || !tanggal) {
    tbody.innerHTML = `
      <tr><td colspan="5"
          style="text-align:center;padding:40px;color:var(--clr-text-muted);">
        <i class="ph-bold ph-arrow-up"
           style="font-size:24px;display:block;margin-bottom:8px;opacity:.3;"></i>
        Pilih kelas dan tanggal untuk memuat daftar santri.
      </td></tr>`;
    return;
  }

  // Tampilkan skeleton saat loading
  tbody.innerHTML = _skeletonRows(5, 5);

  // Ambil daftar santri aktif di kelas ini
  const santriKelas = (window.santriCache || [])
    .filter(s => s.kelas === kelas && s.status === 'Aktif')
    .sort((a, b) => a.nama.localeCompare(b.nama));

  if (!santriKelas.length) {
    tbody.innerHTML = `
      <tr><td colspan="5"
          style="text-align:center;padding:40px;color:var(--clr-text-muted);">
        Tidak ada santri aktif di kelas ini.
      </td></tr>`;
    return;
  }

  // Load absensi yang sudah tersimpan untuk tanggal + kelas ini
  const existing = await _loadAbsensiHarian(tanggal, kelas);
  const existMap = {};
  existing.forEach(r => { existMap[r.santri_id] = r; });

  // Render baris form
  tbody.innerHTML = santriKelas.map((s, i) => {
    const saved = existMap[s._id];
    const st    = saved?.status || 'H';
    const ket   = saved?.keterangan || '';
    const uid   = 'abs-' + s._id.replace(/-/g,'').slice(0,8);
    return `
      <tr data-santri-id="${s._id}">
        <td style="color:var(--clr-text-muted);font-size:12px;
                   width:32px;text-align:center;">${i + 1}</td>
        <td style="font-family:monospace;font-size:12px;
                   color:var(--clr-text-sub);">${s.nis}</td>
        <td style="font-weight:600;">${_x(s.nama)}</td>
        <td>
          <div class="att-group">
            ${['H','S','I','A','T'].map(v => `
              <input type="radio" name="${uid}"
                     id="${uid}${v}" value="${v}"
                     ${st === v ? 'checked' : ''}>
              <label class="att-pill att-pill-${v}"
                     for="${uid}${v}">${v}</label>`).join('')}
          </div>
        </td>
        <td>
          <input type="text"
                 class="form-control"
                 style="height:30px;font-size:12.5px;"
                 placeholder="Opsional…"
                 value="${_x(ket)}"
                 data-ket="1" />
        </td>
      </tr>`;
  }).join('');

  // Update counter
  _updateAbsenCounter(tbody, santriKelas.length);

  // Event: hitung ulang counter saat status berubah
  tbody.querySelectorAll('input[type="radio"]').forEach(r => {
    r.addEventListener('change', () =>
      _updateAbsenCounter(tbody, santriKelas.length));
  });
}

function _updateAbsenCounter(tbody, total) {
  const counts = { H:0, S:0, I:0, A:0, T:0 };
  tbody.querySelectorAll('tr[data-santri-id]').forEach(tr => {
    const checked = tr.querySelector('input[type="radio"]:checked');
    if (checked) counts[checked.value] = (counts[checked.value] || 0) + 1;
  });

  ['H','S','I','A','T'].forEach(s => {
    const el = document.getElementById(`abs-count-${s}`);
    if (el) el.textContent = counts[s];
  });

  const pct = total ? Math.round((counts.H / total) * 100) : 0;
  const el  = document.getElementById('abs-pct-hadir');
  if (el) {
    el.textContent = pct + '%';
    el.style.color = pct >= 80
      ? '#15803d' : pct >= 60 ? '#b45309' : '#b91c1c';
  }
}

/* ── SKELETON ROWS ────────────────────────────────────────────── */
function _skeletonRows(rows, cols) {
  return Array.from({ length: rows }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      `<td><div style="height:18px;background:rgba(26,107,60,.08);
           border-radius:4px;animation:pulse 1.5s infinite;"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

/* ── ESCAPE HTML ─────────────────────────────────────────────── */
function _x(str = '') {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/* ============================================================
   app.absensi.js — Bagian 2: Simpan Absensi,
                    Rekap Harian & Statistik
   ============================================================ */

/* ── SIMPAN ABSENSI HARIAN ───────────────────────────────────── */
async function _simpanAbsensi() {
  if (_state.isSaving) return;

  const kelas   = _state.kelasHarian;
  const tanggal = _state.tglHarian;
  const tbody   = document.getElementById('tbody-absen-harian');

  if (!kelas || !tanggal) {
    window.showToast('warning','Belum Lengkap',
      'Pilih kelas dan tanggal terlebih dahulu.'); return;
  }
  if (!tbody) return;

  const rows = [];
  const baris = tbody.querySelectorAll('tr[data-santri-id]');

  if (!baris.length) {
    window.showToast('warning','Tidak Ada Data',
      'Tidak ada santri yang bisa disimpan absensinya.'); return;
  }

  baris.forEach(tr => {
    const santriId = tr.dataset.santriId;
    const checked  = tr.querySelector('input[type="radio"]:checked');
    const ketEl    = tr.querySelector('input[data-ket]');
    if (!santriId || !checked) return;

    rows.push({
      santri_id:    santriId,
      tanggal:      tanggal,
      kelas:        kelas,
      status:       checked.value,
      keterangan:   ketEl?.value.trim() || null,
      dicatat_oleh: window.currentUser?.uid || null,
    });
  });

  if (!rows.length) {
    window.showToast('warning','Data Kosong',
      'Tidak ada baris absensi yang valid.'); return;
  }

  // Nonaktifkan tombol simpan
  _state.isSaving = true;
  const btnSimpan = document.getElementById('btn-simpan-absen');
  if (btnSimpan) {
    btnSimpan.disabled = true;
    btnSimpan.innerHTML =
      '<div style="width:16px;height:16px;border:2px solid rgba(255,255,255,.3);' +
      'border-top-color:#fff;border-radius:50%;' +
      'animation:spin .7s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px;"></div>' +
      ' Menyimpan…';
  }

  const ok = await _saveAbsensiBatch(rows);

  // Aktifkan kembali tombol
  _state.isSaving = false;
  if (btnSimpan) {
    btnSimpan.disabled = false;
    btnSimpan.innerHTML =
      '<i class="ph-bold ph-floppy-disk"></i> Simpan Absensi';
  }

  if (ok) {
    const hadir = rows.filter(r => r.status === 'H').length;
    const pct   = Math.round((hadir / rows.length) * 100);
    window.showToast(
      'success',
      'Absensi Tersimpan',
      `${rows.length} santri dicatat — Hadir: ${hadir} (${pct}%).`,
      5000
    );
  }
}

/* ── RENDER: REKAP HARIAN ─────────────────────────────────────── */
async function _renderRekapHarian() {
  const bulan  = _state.bulanRekap;
  const kelas  = _state.kelasRekap;
  const tbody  = document.getElementById('tbody-rekap-harian');
  const statEl = document.getElementById('rekap-stat-area');

  if (!tbody) return;

  if (!bulan) {
    tbody.innerHTML = `
      <tr><td colspan="8"
          style="text-align:center;padding:40px;
                 color:var(--clr-text-muted);">
        Pilih bulan untuk melihat rekap.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = _skeletonRows(7, 8);
  if (statEl) statEl.innerHTML = _skeletonStats();

  // Load data dari Supabase
  const data = await _loadAbsensiBulan(bulan, kelas);

  if (!data.length) {
    tbody.innerHTML = `
      <tr><td colspan="8"
          style="text-align:center;padding:40px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-clipboard-text"
           style="font-size:28px;display:block;margin-bottom:8px;opacity:.3;"></i>
        Belum ada data absensi untuk periode ini.
      </td></tr>`;
    if (statEl) statEl.innerHTML = '';
    return;
  }

  // ── Grup data per tanggal ──────────────────────────── //
  const byDate = {};
  data.forEach(r => {
    if (!byDate[r.tanggal]) byDate[r.tanggal] = [];
    byDate[r.tanggal].push(r);
  });

  const dates = Object.keys(byDate).sort();

  // ── Hitung total keseluruhan ───────────────────────── //
  let totH=0, totS=0, totI=0, totA=0, totT=0, totAll=0;

  tbody.innerHTML = dates.map(tgl => {
    const baris = byDate[tgl];
    const cnt   = { H:0, S:0, I:0, A:0, T:0 };
    baris.forEach(r => { if (cnt[r.status] !== undefined) cnt[r.status]++; });
    const tot = baris.length;
    const pct = tot ? Math.round((cnt.H / tot) * 100) : 0;

    totH += cnt.H; totS += cnt.S;
    totI += cnt.I; totA += cnt.A;
    totT += cnt.T; totAll += tot;

    const pctCls = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';
    const hari   = new Date(tgl + 'T00:00:00')
      .toLocaleDateString('id-ID', { weekday:'short' });

    return `
      <tr>
        <td style="white-space:nowrap;">
          <span style="font-size:11px;color:var(--clr-text-muted);
                       margin-right:4px;">${hari}</span>
          <strong>${_formatTglShort(tgl)}</strong>
        </td>
        <td style="text-align:center;">${tot}</td>
        <td style="text-align:center;">
          <span class="cel-H" style="display:inline-block;
                min-width:28px;padding:2px 6px;border-radius:4px;">
            ${cnt.H}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="cel-S" style="display:inline-block;
                min-width:28px;padding:2px 6px;border-radius:4px;">
            ${cnt.S}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="cel-I" style="display:inline-block;
                min-width:28px;padding:2px 6px;border-radius:4px;">
            ${cnt.I}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="cel-A" style="display:inline-block;
                min-width:28px;padding:2px 6px;border-radius:4px;">
            ${cnt.A}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="cel-T" style="display:inline-block;
                min-width:28px;padding:2px 6px;border-radius:4px;">
            ${cnt.T}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="col-pct ${pctCls}">${pct}%</span>
        </td>
      </tr>`;
  }).join('');

  // ── Baris Total ────────────────────────────────────── //
  const totPct = totAll
    ? Math.round((totH / totAll) * 100) : 0;
  const totPctCls = totPct >= 80 ? 'high' : totPct >= 60 ? 'mid' : 'low';

  tbody.innerHTML += `
    <tr style="background:rgba(26,107,60,.05);font-weight:700;
               border-top:2px solid rgba(26,107,60,.1);">
      <td>TOTAL (${dates.length} hari)</td>
      <td style="text-align:center;">${totAll}</td>
      <td style="text-align:center;color:#15803d;">${totH}</td>
      <td style="text-align:center;color:#92400e;">${totS}</td>
      <td style="text-align:center;color:#1d4ed8;">${totI}</td>
      <td style="text-align:center;color:#b91c1c;">${totA}</td>
      <td style="text-align:center;color:#6d28d9;">${totT}</td>
      <td style="text-align:center;">
        <span class="col-pct ${totPctCls}">${totPct}%</span>
      </td>
    </tr>`;

  // ── Render Stat Cards Rekap ────────────────────────── //
  if (statEl) {
    statEl.innerHTML = `
      <div class="rekap-stats">
        <div class="rekap-stat-card rsc-green">
          <div class="rsc-label">
            <i class="ph-bold ph-check-circle"></i> Hadir
          </div>
          <div class="rsc-val">${totH}</div>
          <div class="rsc-sub">${totPct}% rata-rata</div>
        </div>
        <div class="rekap-stat-card rsc-yellow">
          <div class="rsc-label">
            <i class="ph-bold ph-bandaids"></i> Sakit
          </div>
          <div class="rsc-val">${totS}</div>
          <div class="rsc-sub">${totAll
            ? Math.round(totS/totAll*100) : 0}% dari total</div>
        </div>
        <div class="rekap-stat-card rsc-blue">
          <div class="rsc-label">
            <i class="ph-bold ph-note"></i> Izin
          </div>
          <div class="rsc-val">${totI}</div>
          <div class="rsc-sub">${totAll
            ? Math.round(totI/totAll*100) : 0}% dari total</div>
        </div>
        <div class="rekap-stat-card rsc-red">
          <div class="rsc-label">
            <i class="ph-bold ph-x-circle"></i> Alpha
          </div>
          <div class="rsc-val">${totA}</div>
          <div class="rsc-sub">${totAll
            ? Math.round(totA/totAll*100) : 0}% dari total</div>
        </div>
        <div class="rekap-stat-card rsc-purple">
          <div class="rsc-label">
            <i class="ph-bold ph-clock"></i> Terlambat
          </div>
          <div class="rsc-val">${totT}</div>
          <div class="rsc-sub">${totAll
            ? Math.round(totT/totAll*100) : 0}% dari total</div>
        </div>
      </div>`;
  }
}

/* ── RENDER: STATISTIK PER SANTRI ────────────────────────────── */
async function _renderStatistikSantri() {
  const bulan = _state.bulanRekap;
  const kelas = _state.kelasRekap;
  const tbody = document.getElementById('tbody-statistik-santri');
  if (!tbody) return;

  if (!bulan) {
    tbody.innerHTML = `
      <tr><td colspan="8"
          style="text-align:center;padding:32px;
                 color:var(--clr-text-muted);">
        Pilih bulan untuk melihat statistik per santri.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = _skeletonRows(5, 8);

  const data = await _loadAbsensiBulan(bulan, kelas);

  if (!data.length) {
    tbody.innerHTML = `
      <tr><td colspan="8"
          style="text-align:center;padding:32px;
                 color:var(--clr-text-muted);">
        Belum ada data absensi untuk periode ini.
      </td></tr>`;
    return;
  }

  // ── Grup per santri ────────────────────────────────── //
  const bySantri = {};
  data.forEach(r => {
    const sid = r.santri_id;
    if (!bySantri[sid]) {
      bySantri[sid] = {
        nis:  r.santri?.nis  || '—',
        nama: r.santri?.nama || '—',
        H:0, S:0, I:0, A:0, T:0, total:0,
      };
    }
    bySantri[sid][r.status]++;
    bySantri[sid].total++;
  });

  // Urutkan berdasar % hadir tertinggi
  const sorted = Object.values(bySantri).sort((a, b) => {
    const pA = a.total ? (a.H / a.total) : 0;
    const pB = b.total ? (b.H / b.total) : 0;
    return pB - pA;
  });

  tbody.innerHTML = sorted.map((s, i) => {
    const pct    = s.total ? Math.round((s.H / s.total) * 100) : 0;
    const pctCls = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';
    return `
      <tr>
        <td style="color:var(--clr-text-muted);font-size:12px;
                   text-align:center;">${i + 1}</td>
        <td style="font-family:monospace;font-size:12px;
                   color:var(--clr-text-sub);">${_x(s.nis)}</td>
        <td style="font-weight:600;">${_x(s.nama)}</td>
        <td style="text-align:center;">${s.total}</td>
        <td style="text-align:center;">
          <span class="cel-H" style="display:inline-block;
                min-width:28px;padding:2px 6px;border-radius:4px;">
            ${s.H}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="cel-S" style="display:inline-block;
                min-width:28px;padding:2px 6px;border-radius:4px;">
            ${s.S}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="cel-I" style="display:inline-block;
                min-width:28px;padding:2px 6px;border-radius:4px;">
            ${s.I}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="cel-A" style="display:inline-block;
                min-width:28px;padding:2px 6px;border-radius:4px;">
            ${s.A}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="col-pct ${pctCls}">${pct}%</span>
        </td>
      </tr>`;
  }).join('');
}

/* ── EXPORT REKAP CSV ─────────────────────────────────────────── */
async function _exportRekapCSV() {
  const bulan = _state.bulanRekap;
  const kelas = _state.kelasRekap;

  if (!bulan) {
    window.showToast('warning','Pilih Bulan',
      'Pilih bulan terlebih dahulu sebelum export.'); return;
  }

  const data = await _loadAbsensiBulan(bulan, kelas);
  if (!data.length) {
    window.showToast('warning','Tidak Ada Data',
      'Tidak ada data absensi untuk diekspor.'); return;
  }

  const hdr  = ['Tanggal','Hari','NIS','Nama','Kelas','Status','Keterangan'];
  const rows = data.map(r => {
    const hari = new Date(r.tanggal + 'T00:00:00')
      .toLocaleDateString('id-ID', { weekday:'long' });
    return [
      r.tanggal,
      hari,
      r.santri?.nis  || '—',
      r.santri?.nama || '—',
      r.kelas,
      `${r.status} (${STATUS_LABEL[r.status] || r.status})`,
      r.keterangan   || '',
    ].map(v => `"${String(v).replace(/"/g,'""')}"`);
  });

  const csv  = [hdr, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv],
    { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `absensi-${kelas ? 'kelas'+kelas+'-' : ''}${bulan}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  window.showToast('success','Export Berhasil',
    `${data.length} baris absensi diekspor ke CSV.`);
}

/* ── SKELETON STATS ───────────────────────────────────────────── */
function _skeletonStats() {
  return `<div class="rekap-stats">
    ${Array.from({length:5}, () => `
      <div class="rekap-stat-card"
           style="background:rgba(26,107,60,.04);">
        <div style="height:12px;width:60px;border-radius:4px;
             background:rgba(26,107,60,.08);
             animation:pulse 1.5s infinite;margin-bottom:10px;"></div>
        <div style="height:28px;width:40px;border-radius:4px;
             background:rgba(26,107,60,.08);
             animation:pulse 1.5s infinite;"></div>
      </div>`).join('')}
  </div>`;
}

/* ============================================================
   app.absensi.js — Bagian 3: Buku Absen Bulanan,
                    Render HTML Views & Wire Event Listeners
   ============================================================ */

/* ── RENDER: BUKU ABSEN BULANAN ──────────────────────────────── */
async function _renderBukuAbsen() {
  const bulan = _state.bulanBuku;
  const kelas = _state.kelasBuku;
  const wrap  = document.getElementById('buku-absen-wrap');

  if (!wrap) return;

  if (!bulan || !kelas) {
    wrap.innerHTML = `
      <div class="empty-state" style="padding:56px 24px;">
        <div class="empty-state-icon">
          <i class="ph-bold ph-book-open-text"></i>
        </div>
        <p class="empty-state-title">Pilih Kelas & Bulan</p>
        <p class="empty-state-msg">
          Pilih kelas dan bulan di atas untuk menampilkan
          buku absen lengkap seluruh santri.
        </p>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div style="text-align:center;padding:40px;color:var(--clr-text-muted);">
      <div style="width:36px;height:36px;border:3px solid rgba(26,107,60,.2);
           border-top-color:var(--clr-primary);border-radius:50%;
           animation:spin .8s linear infinite;margin:0 auto 12px;"></div>
      Memuat buku absen…
    </div>`;

  // ── Ambil data ─────────────────────────────────────── //
  const data = await _loadAbsensiBulan(bulan, kelas);

  const days    = _daysInMonth(bulan);
  const [y, m]  = bulan.split('-').map(Number);

  // Daftar santri aktif di kelas ini
  const santriKelas = (window.santriCache || [])
    .filter(s => s.kelas === kelas && s.status === 'Aktif')
    .sort((a, b) => a.nama.localeCompare(b.nama));

  if (!santriKelas.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="padding:48px 24px;">
        <div class="empty-state-icon">
          <i class="ph-bold ph-users"></i>
        </div>
        <p class="empty-state-title">Tidak Ada Santri</p>
        <p class="empty-state-msg">
          Tidak ada santri aktif di kelas ini.
        </p>
      </div>`;
    return;
  }

  // ── Buat lookup: santriId → { tgl → status } ──────── //
  const lookup = {};
  data.forEach(r => {
    if (!lookup[r.santri_id]) lookup[r.santri_id] = {};
    const d = parseInt(r.tanggal.split('-')[2]);
    lookup[r.santri_id][d] = r.status;
  });

  // ── Nama bulan untuk judul ─────────────────────────── //
  const namaBulan = new Date(y, m - 1, 1)
    .toLocaleDateString('id-ID', { month:'long', year:'numeric' });

  const kelasLabel = { '1':'Kelas 1 (Awwaliyah)', '2':'Kelas 2 (Awwaliyah)',
    '3':'Kelas 3 (Awwaliyah)', '4':'Kelas 4 (Awwaliyah)' }[kelas]
    || `Kelas ${kelas}`;

  // ── Bangun header kolom tanggal ────────────────────── //
  const dayHeaders = Array.from({ length: days }, (_, i) => {
    const d   = i + 1;
    const iso = `${bulan}-${String(d).padStart(2,'0')}`;
    const libur = _isLibur(iso);
    const nm  = new Date(iso + 'T00:00:00')
      .toLocaleDateString('id-ID', { weekday:'narrow' });
    return `<th style="min-width:28px;padding:8px 4px;
                text-align:center;font-size:11px;
                ${libur ? 'color:var(--clr-danger);' : ''}">
              ${d}<br>
              <span style="font-weight:400;font-size:9px;
                           opacity:.7;">${nm}</span>
            </th>`;
  }).join('');

  // ── Bangun baris per santri ────────────────────────── //
  const bodyRows = santriKelas.map((s, i) => {
    const rec  = lookup[s._id] || {};
    let H=0, S=0, I=0, A=0, T=0, total=0;

    const cells = Array.from({ length: days }, (_, di) => {
      const d   = di + 1;
      const iso = `${bulan}-${String(d).padStart(2,'0')}`;
      if (_isLibur(iso)) {
        return `<td style="background:rgba(239,68,68,.04);
                    text-align:center;font-size:10px;
                    color:var(--clr-text-muted);">—</td>`;
      }
      const st = rec[d];
      if (!st) {
        return `<td style="text-align:center;
                    font-size:11px;color:var(--clr-text-muted);">·</td>`;
      }
      if (st === 'H') H++;
      else if (st === 'S') S++;
      else if (st === 'I') I++;
      else if (st === 'A') A++;
      else if (st === 'T') T++;
      total++;

      const c = STATUS_COLOR[st] || {};
      return `<td style="text-align:center;">
                <span style="display:inline-block;min-width:20px;
                             padding:2px 3px;border-radius:3px;
                             font-size:11px;font-weight:800;
                             background:${c.bg || '#eee'};
                             color:${c.fg || '#333'};">${st}</span>
              </td>`;
    }).join('');

    const pct    = (H + total) > 0
      ? Math.round((H / (H + S + I + A + T)) * 100) : 0;
    const pctCls = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';

    return `
      <tr>
        <td class="col-sticky col-s1"
            style="text-align:center;font-size:12px;
                   color:var(--clr-text-muted);">${i + 1}</td>
        <td class="col-sticky col-s2"
            style="font-family:monospace;font-size:11.5px;
                   color:var(--clr-text-sub);">${_x(s.nis)}</td>
        <td class="col-sticky col-s3 td-nama">${_x(s.nama)}</td>
        ${cells}
        <td class="col-sum" style="text-align:center;
            font-weight:700;color:#15803d;">${H}</td>
        <td class="col-sum" style="text-align:center;
            color:#92400e;">${S}</td>
        <td class="col-sum" style="text-align:center;
            color:#1d4ed8;">${I}</td>
        <td class="col-sum" style="text-align:center;
            color:#b91c1c;">${A}</td>
        <td class="col-sum" style="text-align:center;
            color:#6d28d9;">${T}</td>
        <td class="col-sum" style="text-align:center;">
          <span class="col-pct ${pctCls}">${pct}%</span>
        </td>
      </tr>`;
  }).join('');

  // ── Render HTML lengkap ────────────────────────────── //
  wrap.innerHTML = `

    <div style="margin-bottom:16px;display:flex;
                align-items:flex-start;
                justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <p style="font-size:15px;font-weight:800;color:var(--clr-text-main);">
          Buku Absen — ${_x(kelasLabel)}
        </p>
        <p style="font-size:13px;color:var(--clr-text-muted);margin-top:3px;">
          Periode: ${namaBulan} · ${santriKelas.length} santri aktif
        </p>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-print-buku">
        <i class="ph-bold ph-printer"></i> Cetak / PDF
      </button>
    </div>

    <div style="display:flex;gap:12px;flex-wrap:wrap;
                margin-bottom:14px;align-items:center;">
      <span style="font-size:12px;font-weight:600;
                   color:var(--clr-text-sub);">Keterangan:</span>
      ${Object.entries(STATUS_LABEL).map(([k, v]) => {
        const c = STATUS_COLOR[k] || {};
        return `<span style="display:inline-flex;align-items:center;
                             gap:5px;font-size:12px;">
                  <span style="background:${c.bg};color:${c.fg};
                               font-weight:800;padding:1px 6px;
                               border-radius:4px;font-size:11px;">${k}</span>
                  ${v}
                </span>`;
      }).join('')}
      <span style="display:inline-flex;align-items:center;
                   gap:5px;font-size:12px;">
        <span style="color:var(--clr-danger);font-weight:700;font-size:11px;">—</span>
        Libur / Minggu
      </span>
    </div>

    <div class="table-wrapper">
      <table class="tbl-buku-absen">
        <thead>
          <tr>
            <th class="col-sticky col-s1"
                style="text-align:center;">#</th>
            <th class="col-sticky col-s2">NIS</th>
            <th class="col-sticky col-s3">Nama Santri</th>
            ${dayHeaders}
            <th class="col-sum" style="text-align:center;color:#15803d;">H</th>
            <th class="col-sum" style="text-align:center;color:#92400e;">S</th>
            <th class="col-sum" style="text-align:center;color:#1d4ed8;">I</th>
            <th class="col-sum" style="text-align:center;color:#b91c1c;">A</th>
            <th class="col-sum" style="text-align:center;color:#6d28d9;">T</th>
            <th class="col-sum" style="text-align:center;">%</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;

  // Tombol cetak
  document.getElementById('btn-print-buku')
    ?.addEventListener('click', () => window.print());
}

/* ── WIRE: EVENT LISTENERS ───────────────────────────────────── */
function _wireEvents() {

  // ── Tab switching ──────────────────────────────────── //
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-absen-tab]');
    if (!tab) return;

    _state.tab = tab.dataset.absenTab;

    // Update tab aktif
    document.querySelectorAll('[data-absen-tab]')
      .forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Tampilkan panel yang sesuai
    ['harian','rekap','buku'].forEach(p => {
      const el = document.getElementById(`absen-panel-${p}`);
      if (el) el.style.display = p === _state.tab ? '' : 'none';
    });

    // Load data panel yang baru ditampilkan
    if (_state.tab === 'rekap') {
      _renderRekapHarian();
      _renderStatistikSantri();
    } else if (_state.tab === 'buku') {
      _renderBukuAbsen();
    }
  });

  // ── Filter harian ──────────────────────────────────── //
  document.addEventListener('change', e => {
    if (e.target.id === 'abs-tgl') {
      _state.tglHarian = e.target.value;
      if (_state.kelasHarian) _renderFormAbsensi();
    }
    if (e.target.id === 'abs-kelas') {
      _state.kelasHarian = e.target.value;
      _renderFormAbsensi();
    }
  });

  // ── Muat ulang ────────────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-muat-absen')) _renderFormAbsensi();
  });

  // ── Reset semua ke H ──────────────────────────────── //
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-reset-absen')) return;
    document.querySelectorAll(
      '#tbody-absen-harian tr[data-santri-id] input[value="H"]'
    ).forEach(r => { r.checked = true; });
    const tbody = document.getElementById('tbody-absen-harian');
    const total = tbody
      ?.querySelectorAll('tr[data-santri-id]').length || 0;
    if (tbody) _updateAbsenCounter(tbody, total);
  });

  // ── Simpan absensi ────────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-simpan-absen')) _simpanAbsensi();
  });

  // ── Tambah baris manual (Khusus visual cetak/tampil) ── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-tambah-baris-absen')) {
      const tbody = document.getElementById('tbody-absen-harian');
      if (!tbody) return;
      
      const emptyRow = tbody.querySelector('td[colspan]');
      if (emptyRow) tbody.innerHTML = ''; // Hapus pesan kosong

      const no  = tbody.querySelectorAll('tr').length + 1;
      const uid = 'abs-manual-' + Date.now();
      const tr  = document.createElement('tr');
      
      tr.innerHTML = `
        <td style="color:var(--clr-text-muted);font-size:12px;text-align:center;">${no}</td>
        <td style="font-family:monospace;font-size:12px;color:var(--clr-text-sub);"><span class="badge neutral">Manual</span></td>
        <td><input type="text" class="form-control" style="height:30px;font-size:12.5px;" placeholder="Nama Santri Baru..." /></td>
        <td>
          <div class="att-group">
            ${['H','S','I','A','T'].map(v => `
              <input type="radio" name="${uid}" id="${uid}${v}" value="${v}" ${v==='H'?'checked':''}>
              <label class="att-pill att-pill-${v}" for="${uid}${v}">${v}</label>
            `).join('')}
          </div>
        </td>
        <td><input type="text" class="form-control" style="height:30px;font-size:12.5px;" placeholder="Opsional..." /></td>
      `;
      tbody.appendChild(tr);
    }
  });

  // ── Filter rekap ──────────────────────────────────── //
  document.addEventListener('change', e => {
    if (e.target.id === 'rekap-bulan') {
      _state.bulanRekap = e.target.value;
      _renderRekapHarian();
      _renderStatistikSantri();
    }
    if (e.target.id === 'rekap-kelas') {
      _state.kelasRekap = e.target.value;
      _renderRekapHarian();
      _renderStatistikSantri();
    }
  });

  // ── Export rekap CSV ──────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-export-rekap')) _exportRekapCSV();
  });

  // ── Filter & tampilkan buku absen ─────────────────── //
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-tampil-buku')) return;
    _state.kelasBuku = document.getElementById('buku-kelas')?.value || '';
    _state.bulanBuku = document.getElementById('buku-bulan')?.value
      || _thisMonth();
    _renderBukuAbsen();
  });
}

/* ── INIT MODUL ──────────────────────────────────────────────── */
(async function _init() {

  // Tangani Siklus Navigasi SPA
  window.addEventListener('madin:navigate', async e => {
    if (e.detail.page !== 'absensi-santri') return;

    // Pasang event listener HANYA jika belum pernah dipasang (Mencegah Hang)
    if (!_isAbsensiWired) {
      _wireEvents();
      _isAbsensiWired = true; // Kunci rapat!
    }

    // 1. Injeksi nilai state awal ke dalam DOM Element
    const tglHarianEl = document.getElementById('abs-tgl');
    if (tglHarianEl) {
      tglHarianEl.value = _state.tglHarian;
      tglHarianEl.max = _today();
    }

    const blnRekapEl = document.getElementById('rekap-bulan');
    if (blnRekapEl) blnRekapEl.value = _state.bulanRekap;

    const blnBukuEl = document.getElementById('buku-bulan');
    if (blnBukuEl) blnBukuEl.value = _state.bulanBuku;

    // 2. Pulihkan Visual Tab Aktif
    document.querySelectorAll('[data-absen-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.absenTab === _state.tab);
    });
    ['harian', 'rekap', 'buku'].forEach(p => {
      const panel = document.getElementById(`absen-panel-${p}`);
      if (panel) panel.style.display = p === _state.tab ? '' : 'none';
    });
    
    // 3. Auto-load tab yang sedang aktif sesuai filter
    if (_state.tab === 'harian' && _state.kelasHarian) {
      const kelasEl = document.getElementById('abs-kelas');
      if (kelasEl) kelasEl.value = _state.kelasHarian;
      await _renderFormAbsensi();
    } else if (_state.tab === 'rekap' && _state.kelasRekap) {
      const rKelasEl = document.getElementById('rekap-kelas');
      if (rKelasEl) rKelasEl.value = _state.kelasRekap;
      await _renderRekapHarian();
      await _renderStatistikSantri();
    } else if (_state.tab === 'buku' && _state.kelasBuku) {
      const bKelasEl = document.getElementById('buku-kelas');
      if (bKelasEl) bKelasEl.value = _state.kelasBuku;
      await _renderBukuAbsen();
    }

  });

  console.log('[Madin] Absensi module loaded ✓ (SOP V2 + Business Logic Intact)');

})();
