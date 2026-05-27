/* ============================================================
   app.keuangan.js — Modul Kas Madrasah, SPP & Laporan
   Portal Pengurus Madrasah Diniyah DQLM

   Fitur:
   - Catat pemasukan & pengeluaran kas
   - Kalkulasi saldo otomatis
   - Tabel transaksi dengan filter & paginasi
   - Manajemen SPP: tagihan, pembayaran, tunggakan
   - Laporan bulanan: stat cards + chart tren 6 bulan
   - Export CSV per periode
   ============================================================ */

'use strict';

/* ── KONSTANTA ───────────────────────────────────────────────── */
const KAT_MASUK = [
  { val:'spp',          label:'SPP / Syahriah'      },
  { val:'infaq',        label:'Infaq & Donasi'       },
  { val:'pendaftaran',  label:'Biaya Pendaftaran'    },
  { val:'subsidi',      label:'Subsidi / Bantuan'    },
  { val:'usaha',        label:'Hasil Usaha Madrasah' },
  { val:'lainnya_masuk',label:'Lainnya'              },
];

const KAT_KELUAR = [
  { val:'honor',        label:'Honor Ustadz'         },
  { val:'operasional',  label:'Operasional Harian'   },
  { val:'sarana',       label:'Sarana & Prasarana'   },
  { val:'kegiatan',     label:'Kegiatan / Acara'     },
  { val:'konsumsi',     label:'Konsumsi'             },
  { val:'utilitas',     label:'Listrik / Air / Internet' },
  { val:'lainnya_keluar',label:'Lainnya'             },
];

const SPP_NOMINAL_DEFAULT = 75000; // Rp 75.000/bulan
const PAGE_SIZE_KAS       = 15;

/* ── STATE ───────────────────────────────────────────────────── */
const _ks = {
  tab:          'kas',       // 'kas' | 'spp' | 'laporan'
  bulanFilter:  _thisMonth(),
  jenisFilter:  '',
  katFilter:    '',
  searchQ:      '',
  page:         1,
  kasCache:     [],          // semua transaksi bulan aktif
  sppCache:     [],          // tagihan SPP bulan aktif
  bulanSPP:     _thisMonth(),
  bulanLaporan: _thisMonth(),
  editKasId:    null,
};

let _isKeuanganWired = false; // KUNCI GUARD: Mencegah Memory Leak/Hang

/* ── UTILITAS ─────────────────────────────────────────────────── */
function _thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _formatRp(nominal) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(nominal || 0);
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
  return new Date(y, m - 1, 1)
    .toLocaleDateString('id-ID', { month:'long', year:'numeric' });
}

function _x(str = '') {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function _skeletonRows(r, c) {
  return Array.from({ length: r }, () =>
    `<tr>${Array.from({ length: c }, () =>
      `<td><div style="height:16px;background:rgba(26,107,60,.07);
           border-radius:4px;animation:pulse 1.5s infinite;"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

/* ── SUPABASE: LOAD KAS ───────────────────────────────────────── */
async function _loadKas(bulan) {
  if (!window.supabase) return [];

  const tglAwal  = `${bulan}-01`;
  const lastDay  = new Date(
    parseInt(bulan.split('-')[0]),
    parseInt(bulan.split('-')[1]), 0
  ).getDate();
  const tglAkhir = `${bulan}-${String(lastDay).padStart(2,'0')}`;

  const { data, error } = await window.supabase
    .from('kas')
    .select(`
      id, tanggal, jenis, kategori,
      keterangan, nominal, saldo_setelah,
      dicatat_oleh, created_at,
      santri:ref_santri_id ( nis, nama )
    `)
    .gte('tanggal', tglAwal)
    .lte('tanggal', tglAkhir)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Kas] Load error:', error.message);
    window.showToast('warning','Data Offline',
      'Gagal memuat data kas. Periksa koneksi.');
    return [];
  }
  return data || [];
}

/* ── SUPABASE: LOAD KAS MULTI-BULAN (untuk laporan tren) ──────── */
async function _loadKasTren(bulanAkhir, jumlahBulan = 6) {
  if (!window.supabase) return [];

  const [y, m]   = bulanAkhir.split('-').map(Number);
  const startDate = new Date(y, m - jumlahBulan, 1);
  const tglAwal   = startDate.toISOString().slice(0, 10);
  const lastDay   = new Date(y, m, 0).getDate();
  const tglAkhir  = `${bulanAkhir}-${String(lastDay).padStart(2,'0')}`;

  const { data, error } = await window.supabase
    .from('kas')
    .select('tanggal, jenis, nominal')
    .gte('tanggal', tglAwal)
    .lte('tanggal', tglAkhir)
    .order('tanggal', { ascending: true });

  if (error) {
    console.error('[Kas] Tren load error:', error.message);
    return [];
  }
  return data || [];
}

/* ── SUPABASE: SIMPAN TRANSAKSI KAS ──────────────────────────── */
async function _saveKas(payload) {
  if (!window.supabase) return null;

  // Hitung saldo terkini sebelum insert
  const { data: lastRow } = await window.supabase
    .from('kas')
    .select('saldo_setelah')
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const saldoSebelum = lastRow?.saldo_setelah || 0;
  const saldoSetelah = payload.jenis === 'masuk'
    ? saldoSebelum + payload.nominal
    : saldoSebelum - payload.nominal;

  const row = {
    ...payload,
    saldo_setelah: saldoSetelah,
    dicatat_oleh:  window.currentUser?.uid || null,
  };

  if (_ks.editKasId) {
    const { data, error } = await window.supabase
      .from('kas')
      .update(row)
      .eq('id', _ks.editKasId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await window.supabase
      .from('kas')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

/* ── SUPABASE: HAPUS TRANSAKSI KAS ───────────────────────────── */
async function _deleteKas(id) {
  if (!window.supabase) return false;
  const { error } = await window.supabase
    .from('kas').delete().eq('id', id);
  if (error) { console.error('[Kas] Delete error:', error.message); return false; }
  return true;
}

/* ── SUPABASE: LOAD SPP ───────────────────────────────────────── */
async function _loadSPP(bulan) {
  if (!window.supabase) return [];

  const { data, error } = await window.supabase
    .from('spp')
    .select(`
      id, bulan, nominal, status,
      tgl_bayar, catatan,
      santri:santri_id ( id, nis, nama, kelas )
    `)
    .eq('bulan', bulan)
    .order('santri(nama)', { ascending: true });

  if (error) {
    console.error('[SPP] Load error:', error.message);
    return [];
  }
  return data || [];
}

/* ── SUPABASE: GENERATE TAGIHAN SPP BULANAN ───────────────────── */
async function _generateTagihanSPP(bulan) {
  if (!window.supabase) return 0;

  const santriAktif = (window.santriCache || [])
    .filter(s => s.status === 'Aktif');

  if (!santriAktif.length) {
    window.showToast('warning','Data Kosong',
      'Tidak ada santri aktif untuk di-generate tagihannya.'); return 0;
  }

  // Cek tagihan yang sudah ada bulan ini
  const { data: existing } = await window.supabase
    .from('spp').select('santri_id').eq('bulan', bulan);

  const existIds = new Set((existing || []).map(r => r.santri_id));
  const toInsert = santriAktif
    .filter(s => !existIds.has(s._id))
    .map(s => ({
      santri_id: s._id,
      bulan,
      nominal:   SPP_NOMINAL_DEFAULT,
      status:    'Belum',
    }));

  if (!toInsert.length) {
    window.showToast('info','Sudah Ada',
      'Tagihan SPP bulan ini sudah pernah di-generate.'); return 0;
  }

  const { error } = await window.supabase.from('spp').insert(toInsert);
  if (error) {
    window.showToast('error','Gagal Generate', error.message); return 0;
  }
  return toInsert.length;
}

/* ── SUPABASE: BAYAR SPP ──────────────────────────────────────── */
async function _bayarSPP(sppId, santriId, nominal, santriNama) {
  if (!window.supabase) return;

  const today = _today();

  // 1. Catat ke tabel kas
  const kasRow = {
    tanggal:      today,
    jenis:        'masuk',
    kategori:     'spp',
    keterangan:   `SPP ${_formatBulan(_ks.bulanSPP)} — ${santriNama}`,
    nominal:      nominal,
    ref_santri_id: santriId,
  };

  let kasId = null;
  try {
    const saved = await _saveKas(kasRow);
    kasId = saved?.id || null;
  } catch (err) {
    console.error('[SPP] Kas insert error:', err.message);
  }

  // 2. Update status SPP → Lunas
  const { error } = await window.supabase
    .from('spp')
    .update({
      status:    'Lunas',
      tgl_bayar: today,
      kas_id:    kasId,
    })
    .eq('id', sppId);

  if (error) {
    window.showToast('error','Gagal Update SPP', error.message); return;
  }

  window.showToast('success','Pembayaran Dicatat',
    `SPP ${santriNama} — ${_formatRp(nominal)} berhasil dicatat.`);

  // Reload data
  await _reloadKasDanSPP();
}

/* ── RELOAD CACHE ─────────────────────────────────────────────── */
async function _reloadKasDanSPP() {
  _ks.kasCache = await _loadKas(_ks.bulanFilter);
  _ks.sppCache = await _loadSPP(_ks.bulanSPP);
  _renderKasTable();
  _renderKasStatCards();
  _renderSPPTable();
  _renderSPPStatCards();
}

/* ============================================================
   app.keuangan.js — Bagian 2: Render Tabel Kas, Stat Cards,
                     SPP & Form Modal
   ============================================================ */

/* ── RENDER: STAT CARDS KAS ──────────────────────────────────── */
function _renderKasStatCards() {
  const data    = _ks.kasCache;
  const masuk   = data.filter(r => r.jenis === 'masuk')
    .reduce((s, r) => s + (r.nominal || 0), 0);
  const keluar  = data.filter(r => r.jenis === 'keluar')
    .reduce((s, r) => s + (r.nominal || 0), 0);
  const saldo   = _ks.kasCache[0]?.saldo_setelah ?? (masuk - keluar);
  const jmlTrx  = data.length;

  const el = document.getElementById('keu-stat-cards');
  if (!el) return;

  el.innerHTML = `
    <div class="keu-cards">

      <div class="keu-card masuk">
        <i class="ph-bold ph-arrow-down-left kc-icon"></i>
        <div class="kc-label">
          <i class="ph-bold ph-arrow-down-left"></i>
          Pemasukan Bulan Ini
        </div>
        <div class="kc-val">${_formatRp(masuk)}</div>
        <div class="kc-sub">${
          data.filter(r => r.jenis === 'masuk').length
        } transaksi</div>
      </div>

      <div class="keu-card keluar">
        <i class="ph-bold ph-arrow-up-right kc-icon"></i>
        <div class="kc-label">
          <i class="ph-bold ph-arrow-up-right"></i>
          Pengeluaran Bulan Ini
        </div>
        <div class="kc-val">${_formatRp(keluar)}</div>
        <div class="kc-sub">${
          data.filter(r => r.jenis === 'keluar').length
        } transaksi</div>
      </div>

      <div class="keu-card saldo">
        <i class="ph-bold ph-wallet kc-icon"></i>
        <div class="kc-label">
          <i class="ph-bold ph-wallet"></i>
          Saldo Kas
        </div>
        <div class="kc-val">${_formatRp(saldo)}</div>
        <div class="kc-sub">Total ${jmlTrx} transaksi bulan ini</div>
      </div>

    </div>`;
}

/* ── RENDER: TABEL KAS ───────────────────────────────────────── */
function _renderKasTable() {
  const tbody = document.getElementById('tbody-kas');
  if (!tbody) return;

  // Terapkan filter
  let data = _ks.kasCache;

  if (_ks.jenisFilter) {
    data = data.filter(r => r.jenis === _ks.jenisFilter);
  }
  if (_ks.katFilter) {
    data = data.filter(r => r.kategori === _ks.katFilter);
  }
  if (_ks.searchQ) {
    const q = _ks.searchQ.toLowerCase();
    data = data.filter(r =>
      r.keterangan?.toLowerCase().includes(q) ||
      r.kategori?.toLowerCase().includes(q)   ||
      r.santri?.nama?.toLowerCase().includes(q)
    );
  }

  // Paginasi
  const total = data.length;
  const start = (_ks.page - 1) * PAGE_SIZE_KAS;
  const page  = data.slice(start, start + PAGE_SIZE_KAS);

  // Update info
  const infoEl = document.getElementById('kas-pagination-info');
  if (infoEl) {
    const s = Math.min(start + 1, total || 1);
    const e = Math.min(start + PAGE_SIZE_KAS, total);
    infoEl.textContent = total
      ? `${s}–${e} dari ${total} transaksi`
      : 'Tidak ada transaksi';
  }

  if (!page.length) {
    tbody.innerHTML = `
      <tr><td colspan="7"
          style="text-align:center;padding:48px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-receipt"
           style="font-size:28px;display:block;
                  margin-bottom:8px;opacity:.3;"></i>
        Belum ada transaksi${_ks.jenisFilter || _ks.searchQ
          ? ' yang sesuai filter' : ' bulan ini'}.
      </td></tr>`;
    _renderKasPager(total);
    return;
  }

  // Lookup label kategori
  const allKat = [...KAT_MASUK, ...KAT_KELUAR];
  const katLabel = (val) =>
    allKat.find(k => k.val === val)?.label || val;

  tbody.innerHTML = page.map(r => {
    const isMasuk = r.jenis === 'masuk';
    const sign    = isMasuk ? '+' : '−';
    const color   = isMasuk ? '#15803d' : '#b91c1c';
    const bgBadge = isMasuk
      ? 'rgba(34,197,94,.1)'  : 'rgba(239,68,68,.1)';

    return `
      <tr id="kas-row-${r.id}">
        <td>
          <div style="font-size:12.5px;font-weight:600;">
            ${_formatTglShort(r.tanggal)}
          </div>
        </td>
        <td>
          <span style="display:inline-block;padding:3px 10px;
                       border-radius:99px;font-size:11.5px;
                       font-weight:600;background:${bgBadge};
                       color:${color};">
            ${isMasuk ? 'Pemasukan' : 'Pengeluaran'}
          </span>
        </td>
        <td style="font-size:13px;">
          ${_x(katLabel(r.kategori))}
        </td>
        <td>
          <div style="font-size:13.5px;font-weight:500;
                      max-width:220px;line-height:1.4;">
            ${_x(r.keterangan)}
            ${r.santri?.nama
              ? `<span style="display:block;font-size:11px;
                              color:var(--clr-text-muted);margin-top:2px;">
                   <i class="ph-bold ph-student"
                      style="font-size:11px;"></i>
                   ${_x(r.santri.nama)}
                 </span>` : ''}
          </div>
        </td>
        <td class="td-nominal ${isMasuk ? 'masuk' : 'keluar'}"
            style="text-align:right;white-space:nowrap;">
          ${sign} ${_formatRp(r.nominal)}
        </td>
        <td style="text-align:right;font-size:13px;
                   white-space:nowrap;color:var(--clr-text-sub);">
          ${_formatRp(r.saldo_setelah)}
        </td>
        <td>
          <div class="tbl-actions" style="justify-content:center;">
            <button class="btn-tbl view" 
                    title="Lihat Detail" data-keu-view="${r.id}">
              <i class="ph-bold ph-eye"></i>
            </button>
            <button class="btn-tbl edit"
                    title="Edit" data-kas-edit="${r.id}">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>
            <button class="btn-tbl delete"
                    title="Hapus" data-kas-del="${r.id}"
                    data-ket="${_x(r.keterangan)}">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Event tombol edit & hapus
  tbody.querySelectorAll('[data-kas-edit]').forEach(btn => {
    btn.addEventListener('click', () => _openEditKas(btn.dataset.kasEdit));
  });
  tbody.querySelectorAll('[data-kas-del]').forEach(btn => {
    btn.addEventListener('click', () =>
      _hapusKas(btn.dataset.kasDel, btn.dataset.ket));
  });

  _renderKasPager(total);
}

/* ── RENDER: PAGINASI KAS ─────────────────────────────────────── */
function _renderKasPager(total) {
  const wrap = document.getElementById('kas-pager');
  if (!wrap) return;

  const tp = Math.max(1, Math.ceil(total / PAGE_SIZE_KAS));
  if (tp <= 1) { wrap.innerHTML = ''; return; }

  let h = `<button class="page-btn" id="kp-prev"
              ${_ks.page === 1 ? 'disabled' : ''}>
             <i class="ph-bold ph-caret-left"></i>
           </button>`;

  const lo = Math.max(1, _ks.page - 2);
  const hi = Math.min(tp, _ks.page + 2);
  if (lo > 1) h += `<button class="page-btn" data-kp="1">1</button>`;
  if (lo > 2) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  for (let p = lo; p <= hi; p++) {
    h += `<button class="page-btn${p === _ks.page ? ' active' : ''}"
                  data-kp="${p}">${p}</button>`;
  }
  if (hi < tp - 1) h += `<span style="line-height:34px;padding:0 4px;">…</span>`;
  if (hi < tp) h += `<button class="page-btn" data-kp="${tp}">${tp}</button>`;
  h += `<button class="page-btn" id="kp-next"
              ${_ks.page === tp ? 'disabled' : ''}>
             <i class="ph-bold ph-caret-right"></i>
           </button>`;

  wrap.innerHTML = h;
  wrap.querySelectorAll('[data-kp]').forEach(b =>
    b.addEventListener('click', () => {
      _ks.page = +b.dataset.kp; _renderKasTable();
    })
  );
  wrap.querySelector('#kp-prev')
    ?.addEventListener('click', () => { _ks.page--; _renderKasTable(); });
  wrap.querySelector('#kp-next')
    ?.addEventListener('click', () => { _ks.page++; _renderKasTable(); });
}

/* ── RENDER: STAT CARDS SPP ──────────────────────────────────── */
function _renderSPPStatCards() {
  const data   = _ks.sppCache;
  const lunas  = data.filter(r => r.status === 'Lunas').length;
  const belum  = data.filter(r => r.status === 'Belum').length;
  const cicil  = data.filter(r => r.status === 'Cicil').length;
  const total  = data.length;
  const totNom = data.filter(r => r.status === 'Lunas')
    .reduce((s, r) => s + (r.nominal || 0), 0);
  const pct    = total ? Math.round((lunas / total) * 100) : 0;

  const el = document.getElementById('spp-stat-cards');
  if (!el) return;

  el.innerHTML = `
    <div class="rekap-stats" style="margin-bottom:20px;">
      <div class="rekap-stat-card rsc-green">
        <div class="rsc-label">
          <i class="ph-bold ph-check-circle"></i> Lunas
        </div>
        <div class="rsc-val">${lunas}</div>
        <div class="rsc-sub">${pct}% dari total</div>
      </div>
      <div class="rekap-stat-card rsc-red">
        <div class="rsc-label">
          <i class="ph-bold ph-warning-circle"></i> Belum Bayar
        </div>
        <div class="rsc-val">${belum}</div>
        <div class="rsc-sub">Perlu ditagih</div>
      </div>
      <div class="rekap-stat-card rsc-yellow">
        <div class="rsc-label">
          <i class="ph-bold ph-clock"></i> Cicilan
        </div>
        <div class="rsc-val">${cicil}</div>
        <div class="rsc-sub">Belum lunas penuh</div>
      </div>
      <div class="rekap-stat-card rsc-blue">
        <div class="rsc-label">
          <i class="ph-bold ph-users"></i> Total Santri
        </div>
        <div class="rsc-val">${total}</div>
        <div class="rsc-sub">Tertagih bulan ini</div>
      </div>
      <div class="rekap-stat-card"
           style="border-top:3px solid var(--clr-primary);">
        <div class="rsc-label">
          <i class="ph-bold ph-money"></i> Terkumpul
        </div>
        <div class="rsc-val"
             style="font-size:16px;color:var(--clr-primary);">
          ${_formatRp(totNom)}
        </div>
        <div class="rsc-sub">Dari SPP lunas</div>
      </div>
    </div>`;
}

/* ── RENDER: TABEL SPP ───────────────────────────────────────── */
function _renderSPPTable() {
  const tbody = document.getElementById('tbody-spp');
  if (!tbody) return;

  let data = _ks.sppCache;

  // Filter status
  const stFilter = document.getElementById('spp-filter-status')?.value || '';
  if (stFilter) data = data.filter(r => r.status === stFilter);

  // Filter kelas
  const klFilter = document.getElementById('spp-filter-kelas')?.value || '';
  if (klFilter) data = data.filter(r => r.santri?.kelas === klFilter);

  // Search
  const q = document.getElementById('spp-search')?.value.toLowerCase().trim() || '';
  if (q) data = data.filter(r =>
    r.santri?.nama?.toLowerCase().includes(q) ||
    r.santri?.nis?.includes(q)
  );

  if (!data.length) {
    tbody.innerHTML = `
      <tr><td colspan="7"
          style="text-align:center;padding:48px;
                 color:var(--clr-text-muted);">
        <i class="ph-bold ph-receipt-x"
           style="font-size:28px;display:block;
                  margin-bottom:8px;opacity:.3;"></i>
        ${_ks.sppCache.length
          ? 'Tidak ada data yang sesuai filter.'
          : 'Klik "Generate Tagihan" untuk membuat tagihan SPP bulan ini.'}
      </td></tr>`;
    return;
  }

  const badgeMap = {
    Lunas: 'success', Belum: 'danger', Cicil: 'warning'
  };

  tbody.innerHTML = data.map((r, i) => {
    const bs  = badgeMap[r.status] || 'neutral';
    const klsLabel = {
      '1':'Kelas 1','2':'Kelas 2','3':'Kelas 3',
      '4':'Kelas 4','5':'Kelas 5'
    }[r.santri?.kelas] || `Kls ${r.santri?.kelas || '?'}`;

    return `
      <tr>
        <td style="color:var(--clr-text-muted);
                   font-size:12px;text-align:center;">
          ${i + 1}
        </td>
        <td>
          <div style="font-weight:600;font-size:13.5px;">
            ${_x(r.santri?.nama || '—')}
          </div>
          <span style="font-family:monospace;font-size:11.5px;
                       color:var(--clr-text-muted);">
            ${_x(r.santri?.nis || '—')}
          </span>
        </td>
        <td>
          <span class="badge neutral">
            <span class="badge-dot"></span>${klsLabel}
          </span>
        </td>
        <td style="font-family:monospace;font-weight:700;
                   font-size:13.5px;">
          ${_formatRp(r.nominal)}
        </td>
        <td>
          <span class="badge ${bs}">
            <span class="badge-dot"></span>${r.status}
          </span>
        </td>
        <td style="font-size:13px;color:var(--clr-text-sub);">
          ${r.tgl_bayar ? _formatTglShort(r.tgl_bayar) : '—'}
        </td>
        <td>
          ${r.status !== 'Lunas'
            ? `<button class="btn btn-primary btn-sm"
                       data-spp-bayar="${r.id}"
                       data-spp-santri-id="${r.santri?.id}"
                       data-spp-nominal="${r.nominal}"
                       data-spp-nama="${_x(r.santri?.nama)}">
                 <i class="ph-bold ph-money"></i> Bayar
               </button>`
            : `<span style="font-size:12px;color:var(--clr-text-muted);">
                 <i class="ph-bold ph-check"
                    style="color:var(--clr-success);"></i> Lunas
               </span>`
          }
        </td>
      </tr>`;
  }).join('');

  // Event tombol bayar
  tbody.querySelectorAll('[data-spp-bayar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sppId   = btn.dataset.sppBayar;
      const santriId= btn.dataset.sppSantriId;
      const nominal = parseInt(btn.dataset.sppNominal);
      const nama    = btn.dataset.sppNama;
      window.confirmDelete(
        `Catat pembayaran SPP ${_formatBulan(_ks.bulanSPP)} ` +
        `atas nama ${nama} sejumlah ${_formatRp(nominal)}?`,
        () => _bayarSPP(sppId, santriId, nominal, nama)
      );
      // Sesuaikan teks tombol konfirmasi
      requestAnimationFrame(() => {
        const ok  = document.getElementById('modal-confirm-ok');
        const ico = document.querySelector(
          '#modal-confirm .modal-confirm-icon i');
        if (ok) {
          ok.className   = 'btn btn-primary';
          ok.innerHTML   =
            '<i class="ph-bold ph-money"></i> Ya, Catat Bayar';
        }
        if (ico) ico.className = 'ph-bold ph-money';
      });
    });
  });
}

/* ── MODAL: FORM TAMBAH / EDIT TRANSAKSI KAS ─────────────────── */
function _openTambahKas(jenis = 'masuk') {
  _ks.editKasId = null;
  const titleEl = document.getElementById('modal-kas-title');
  const lblEl   = document.getElementById('btn-simpan-kas-label');
  const form    = document.getElementById('form-kas');
  if (titleEl) titleEl.textContent =
    jenis === 'masuk' ? 'Catat Pemasukan' : 'Catat Pengeluaran';
  if (lblEl)   lblEl.textContent = 'Simpan';
  if (form)    form.reset();

  // Set tanggal hari ini
  const tglEl = document.getElementById('kas-tanggal');
  if (tglEl) tglEl.value = _today();

  // Set jenis & update pilihan kategori
  const jenisEl = document.getElementById('kas-jenis');
  if (jenisEl) { jenisEl.value = jenis; _updateKatOptions(jenis); }

  // Warna header modal sesuai jenis
  const iconWrap = document.querySelector('#modal-kas .modal-header-icon');
  const iconEl   = document.querySelector('#modal-kas .modal-header-icon i');
  if (iconWrap) iconWrap.style.background =
    jenis === 'masuk' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)';
  if (iconEl) {
    iconEl.className = jenis === 'masuk'
      ? 'ph-bold ph-arrow-down-left'
      : 'ph-bold ph-arrow-up-right';
    iconEl.style.color = jenis === 'masuk'
      ? 'var(--clr-success)' : 'var(--clr-danger)';
  }

  window.openModal('modal-kas');
}

function _openEditKas(kasId) {
  const r = _ks.kasCache.find(x => x.id === kasId);
  if (!r) {
    window.showToast('warning','Tidak Ditemukan',
      'Data transaksi tidak ada di cache. Coba refresh halaman.'); return;
  }
  _ks.editKasId = kasId;

  const titleEl = document.getElementById('modal-kas-title');
  const lblEl   = document.getElementById('btn-simpan-kas-label');
  if (titleEl) titleEl.textContent = 'Edit Transaksi';
  if (lblEl)   lblEl.textContent   = 'Update';

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  set('kas-tanggal',   r.tanggal);
  set('kas-keterangan',r.keterangan);
  set('kas-nominal',   r.nominal);
  set('kas-catatan',   r.catatan || '');

  const jenisEl = document.getElementById('kas-jenis');
  if (jenisEl) { jenisEl.value = r.jenis; _updateKatOptions(r.jenis); }
  const katEl = document.getElementById('kas-kategori');
  if (katEl) katEl.value = r.kategori;

  window.openModal('modal-kas');
}

function _updateKatOptions(jenis) {
  const katEl = document.getElementById('kas-kategori');
  if (!katEl) return;
  const opts  = jenis === 'masuk' ? KAT_MASUK : KAT_KELUAR;
  katEl.innerHTML =
    `<option value="">— Pilih Kategori —</option>` +
    opts.map(k =>
      `<option value="${k.val}">${k.label}</option>`
    ).join('');
}

async function _submitKas() {
  const tanggal   = document.getElementById('kas-tanggal')?.value;
  const jenis     = document.getElementById('kas-jenis')?.value;
  const kategori  = document.getElementById('kas-kategori')?.value;
  const keterangan= document.getElementById('kas-keterangan')?.value.trim();
  const nominalRaw= document.getElementById('kas-nominal')?.value;

  if (!tanggal || !jenis || !kategori || !keterangan || !nominalRaw) {
    window.showToast('error','Validasi Gagal',
      'Semua field wajib diisi.'); return;
  }
  const nominal = parseInt(nominalRaw);
  if (isNaN(nominal) || nominal <= 0) {
    window.showToast('error','Nominal Tidak Valid',
      'Masukkan nominal lebih dari 0.'); return;
  }

  const btnSimpan = document.getElementById('btn-simpan-kas');
  if (btnSimpan) btnSimpan.disabled = true;

  try {
    await _saveKas({ tanggal, jenis, kategori, keterangan, nominal });
    window.showToast('success',
      _ks.editKasId ? 'Transaksi Diperbarui' : 'Transaksi Dicatat',
      `${_formatRp(nominal)} berhasil disimpan.`);
    window.closeModal('modal-kas');
    _ks.editKasId = null;
    _ks.page      = 1;
    await _reloadKasDanSPP();
  } catch (err) {
    window.showToast('error','Gagal Menyimpan',
      err?.message || 'Terjadi kesalahan.');
  } finally {
    if (btnSimpan) btnSimpan.disabled = false;
  }
}

async function _hapusKas(kasId, ket) {
  window.confirmDelete(
    `Transaksi "${ket}" akan dihapus permanen dari kas madrasah.`,
    async () => {
      const ok = await _deleteKas(kasId);
      if (!ok) return;
      _ks.kasCache = _ks.kasCache.filter(r => r.id !== kasId);
      _renderKasTable();
      _renderKasStatCards();
      window.showToast('success','Transaksi Dihapus',
        'Data berhasil dihapus dari kas.');
    }
  );
}

/* ── EXPORT KAS CSV ───────────────────────────────────────────── */
function _exportKasCSV() {
  const data = _ks.kasCache;
  if (!data.length) {
    window.showToast('warning','Tidak Ada Data',
      'Tidak ada transaksi untuk diekspor.'); return;
  }
  const allKat  = [...KAT_MASUK, ...KAT_KELUAR];
  const katLabel = (val) =>
    allKat.find(k => k.val === val)?.label || val;

  const hdr  = ['Tanggal','Jenis','Kategori','Keterangan',
                 'Nominal','Saldo Setelah','Santri'];
  const rows = data.map(r => [
    r.tanggal,
    r.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
    katLabel(r.kategori),
    r.keterangan,
    r.nominal,
    r.saldo_setelah || '',
    r.santri?.nama || '',
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`));

  const csv  = [hdr, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv],
    { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `kas-madrasah-${_ks.bulanFilter}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('success','Export Berhasil',
    `${data.length} transaksi diekspor.`);
}

/* ============================================================
   app.keuangan.js — Bagian 3: Laporan Bulanan, Chart Tren,
                     Render View HTML & Wire Event Listeners
   ============================================================ */

/* ── RENDER: LAPORAN BULANAN ─────────────────────────────────── */
async function _renderLaporan() {
  const bulan  = _ks.bulanLaporan;
  const wrap   = document.getElementById('laporan-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="text-align:center;padding:48px;
                color:var(--clr-text-muted);">
      <div style="width:36px;height:36px;
           border:3px solid rgba(26,107,60,.2);
           border-top-color:var(--clr-primary);
           border-radius:50%;margin:0 auto 12px;
           animation:spin .8s linear infinite;"></div>
      Memuat laporan ${_formatBulan(bulan)}…
    </div>`;

  // Load data transaksi bulan ini & tren 6 bulan
  const [dataBulan, dataTren] = await Promise.all([
    _loadKas(bulan),
    _loadKasTren(bulan, 6),
  ]);

  const masuk  = dataBulan.filter(r => r.jenis === 'masuk')
    .reduce((s, r) => s + r.nominal, 0);
  const keluar = dataBulan.filter(r => r.jenis === 'keluar')
    .reduce((s, r) => s + r.nominal, 0);
  const saldo  = masuk - keluar;
  const saldoAkhir = dataBulan[0]?.saldo_setelah ?? saldo;

  // ── Rekap per kategori ─────────────────────────────── //
  const rekapKat = {};
  dataBulan.forEach(r => {
    if (!rekapKat[r.kategori]) {
      rekapKat[r.kategori] = { masuk:0, keluar:0, count:0 };
    }
    if (r.jenis === 'masuk') rekapKat[r.kategori].masuk += r.nominal;
    else rekapKat[r.kategori].keluar += r.nominal;
    rekapKat[r.kategori].count++;
  });

  const allKat   = [...KAT_MASUK, ...KAT_KELUAR];
  const katLabel = (val) =>
    allKat.find(k => k.val === val)?.label || val;

  // ── Bangun tren 6 bulan ────────────────────────────── //
  const trenByMonth = {};
  dataTren.forEach(r => {
    const ym = r.tanggal.slice(0, 7);
    if (!trenByMonth[ym]) trenByMonth[ym] = { masuk:0, keluar:0 };
    if (r.jenis === 'masuk') trenByMonth[ym].masuk += r.nominal;
    else trenByMonth[ym].keluar += r.nominal;
  });

  const trenMonths = Object.keys(trenByMonth).sort().slice(-6);
  const trenMasuk  = trenMonths.map(m => trenByMonth[m]?.masuk  || 0);
  const trenKeluar = trenMonths.map(m => trenByMonth[m]?.keluar || 0);
  const trenLabels = trenMonths.map(m => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1, 1)
      .toLocaleDateString('id-ID', { month:'short', year:'2-digit' });
  });

  wrap.innerHTML = `

    <div style="display:flex;align-items:flex-start;
                justify-content:space-between;
                flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <div>
        <p style="font-size:16px;font-weight:800;">
          Laporan Keuangan — ${_formatBulan(bulan)}
        </p>
        <p style="font-size:13px;color:var(--clr-text-muted);
                  margin-top:3px;">
          ${dataBulan.length} transaksi tercatat
        </p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-export pdf" id="btn-print-laporan">
          <i class="ph-bold ph-printer"></i> Cetak
        </button>
        <button class="btn-export excel" id="btn-export-laporan-csv">
          <i class="ph-bold ph-file-csv"></i> Export CSV
        </button>
      </div>
    </div>

    <div class="keu-cards" style="margin-bottom:24px;">
      <div class="keu-card masuk">
        <i class="ph-bold ph-arrow-down-left kc-icon"></i>
        <div class="kc-label">
          <i class="ph-bold ph-arrow-down-left"></i>
          Total Pemasukan
        </div>
        <div class="kc-val">${_formatRp(masuk)}</div>
        <div class="kc-sub">
          ${dataBulan.filter(r => r.jenis === 'masuk').length}
          transaksi masuk
        </div>
      </div>
      <div class="keu-card keluar">
        <i class="ph-bold ph-arrow-up-right kc-icon"></i>
        <div class="kc-label">
          <i class="ph-bold ph-arrow-up-right"></i>
          Total Pengeluaran
        </div>
        <div class="kc-val">${_formatRp(keluar)}</div>
        <div class="kc-sub">
          ${dataBulan.filter(r => r.jenis === 'keluar').length}
          transaksi keluar
        </div>
      </div>
      <div class="keu-card saldo">
        <i class="ph-bold ph-wallet kc-icon"></i>
        <div class="kc-label">
          <i class="ph-bold ph-wallet"></i>
          Saldo Akhir Bulan
        </div>
        <div class="kc-val">${_formatRp(saldoAkhir)}</div>
        <div class="kc-sub">
          Selisih: ${saldo >= 0 ? '+' : ''}${_formatRp(saldo)}
        </div>
      </div>
    </div>

    <div class="card card-padded" style="margin-bottom:20px;">
      <div class="chart-header">
        <div>
          <p class="chart-title">Tren Keuangan 6 Bulan Terakhir</p>
          <p style="font-size:12px;color:var(--clr-text-muted);
                    margin-top:2px;">
            Pemasukan vs Pengeluaran per bulan
          </p>
        </div>
      </div>
      <div class="chart-legend" style="margin-bottom:12px;">
        <div class="chart-legend-item">
          <span class="chart-legend-dot"
                style="background:rgba(26,107,60,.75);"></span>
          Pemasukan
        </div>
        <div class="chart-legend-item">
          <span class="chart-legend-dot"
                style="background:rgba(239,68,68,.65);"></span>
          Pengeluaran
        </div>
      </div>
      <canvas id="chart-tren-laporan" height="180"></canvas>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div style="padding:16px 20px;
                  border-bottom:1px solid rgba(26,107,60,.07);">
        <p style="font-size:14px;font-weight:700;">
          Rekap per Kategori
        </p>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Kategori</th>
              <th style="text-align:right;color:#15803d;">
                Pemasukan
              </th>
              <th style="text-align:right;color:#b91c1c;">
                Pengeluaran
              </th>
              <th style="text-align:center;">Trx</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(rekapKat).length
              ? Object.entries(rekapKat)
                  .sort((a, b) =>
                    (b[1].masuk + b[1].keluar) -
                    (a[1].masuk + a[1].keluar))
                  .map(([kat, val]) => `
                    <tr>
                      <td style="font-weight:500;">
                        ${_x(katLabel(kat))}
                      </td>
                      <td style="text-align:right;
                                 font-family:monospace;
                                 font-weight:700;
                                 color:#15803d;">
                        ${val.masuk ? _formatRp(val.masuk) : '—'}
                      </td>
                      <td style="text-align:right;
                                 font-family:monospace;
                                 font-weight:700;
                                 color:#b91c1c;">
                        ${val.keluar ? _formatRp(val.keluar) : '—'}
                      </td>
                      <td style="text-align:center;
                                 color:var(--clr-text-muted);
                                 font-size:13px;">
                        ${val.count}
                      </td>
                    </tr>`).join('')
              : `<tr><td colspan="4"
                        style="text-align:center;padding:32px;
                               color:var(--clr-text-muted);">
                   Belum ada transaksi bulan ini.
                 </td></tr>`
            }
          </tbody>
          ${Object.entries(rekapKat).length ? `
          <tfoot>
            <tr style="font-weight:800;
                       background:rgba(26,107,60,.04);
                       border-top:2px solid rgba(26,107,60,.1);">
              <td>TOTAL</td>
              <td style="text-align:right;
                         font-family:monospace;
                         color:#15803d;">${_formatRp(masuk)}</td>
              <td style="text-align:right;
                         font-family:monospace;
                         color:#b91c1c;">${_formatRp(keluar)}</td>
              <td style="text-align:center;">
                ${dataBulan.length}
              </td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
    </div>

    <div class="card">
      <div style="padding:16px 20px;
                  border-bottom:1px solid rgba(26,107,60,.07);">
        <p style="font-size:14px;font-weight:700;">
          Daftar Transaksi Lengkap
        </p>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th>Kategori</th>
              <th>Keterangan</th>
              <th style="text-align:right;">Nominal</th>
              <th style="text-align:right;">Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${dataBulan.length
              ? dataBulan.map(r => {
                  const isMasuk = r.jenis === 'masuk';
                  const sign    = isMasuk ? '+' : '−';
                  const color   = isMasuk ? '#15803d' : '#b91c1c';
                  return `
                    <tr>
                      <td style="white-space:nowrap;font-size:13px;">
                        ${_formatTglShort(r.tanggal)}
                      </td>
                      <td>
                        <span style="font-size:12px;font-weight:600;
                                     color:${color};">
                          ${isMasuk ? '↓ Masuk' : '↑ Keluar'}
                        </span>
                      </td>
                      <td style="font-size:12.5px;">
                        ${_x(katLabel(r.kategori))}
                      </td>
                      <td style="font-size:13px;max-width:200px;">
                        ${_x(r.keterangan)}
                        ${r.santri?.nama
                          ? `<span style="display:block;font-size:11px;
                                          color:var(--clr-text-muted);">
                               ${_x(r.santri.nama)}
                             </span>` : ''}
                      </td>
                      <td style="text-align:right;
                                 font-family:monospace;
                                 font-weight:700;
                                 color:${color};
                                 white-space:nowrap;">
                        ${sign} ${_formatRp(r.nominal)}
                      </td>
                      <td style="text-align:right;
                                 font-family:monospace;
                                 font-size:12.5px;
                                 color:var(--clr-text-sub);
                                 white-space:nowrap;">
                        ${_formatRp(r.saldo_setelah)}
                      </td>
                    </tr>`;
                }).join('')
              : `<tr><td colspan="6"
                        style="text-align:center;padding:32px;
                               color:var(--clr-text-muted);">
                   Belum ada transaksi bulan ini.
                 </td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>`;

  // ── Build chart tren ─────────────────────────────── //
  const ctxTren = document.getElementById('chart-tren-laporan');
  if (ctxTren && typeof Chart !== 'undefined') {
    // Hapus instance lama jika ada
    const old = Chart.getChart(ctxTren);
    if (old) old.destroy();

    new Chart(ctxTren, {
      type: 'bar',
      data: {
        labels: trenLabels,
        datasets: [
          {
            label: 'Pemasukan',
            data: trenMasuk,
            backgroundColor: 'rgba(26,107,60,.75)',
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Pengeluaran',
            data: trenKeluar,
            backgroundColor: 'rgba(239,68,68,.65)',
            borderRadius: 6,
            borderSkipped: false,
          },
        ]
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
              label: ctx =>
                ` ${ctx.dataset.label}: ${_formatRp(ctx.parsed.y)}`,
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
              font: { size:11 }, color:'#94a89a',
              callback: v =>
                'Rp ' + (v >= 1e6
                  ? (v/1e6).toFixed(0)+'jt'
                  : (v/1e3).toFixed(0)+'rb'),
            },
            border: { display: false },
          }
        }
      }
    });
  }

  // Event tombol cetak & export CSV laporan
  document.getElementById('btn-print-laporan')
    ?.addEventListener('click', () => window.print());

  document.getElementById('btn-export-laporan-csv')
    ?.addEventListener('click', () => {
      _ks.kasCache = dataBulan;
      _exportKasCSV();
    });
}

/* ── WIRE: EVENT LISTENERS ───────────────────────────────────── */
function _wireEvents() {

  // ── Tab switching ──────────────────────────────────── //
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-keu-tab]');
    if (!tab) return;
    _ks.tab = tab.dataset.keuTab;
    document.querySelectorAll('[data-keu-tab]')
      .forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    ['kas','spp','laporan'].forEach(p => {
      const el = document.getElementById(`keu-panel-${p}`);
      if (el) el.style.display = p === _ks.tab ? '' : 'none';
    });
    if (_ks.tab === 'laporan') _renderLaporan();
  });

  // ── Buka modal transaksi ───────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-catat-pemasukan2'))
      _openTambahKas('masuk');
    if (e.target.closest('#btn-catat-pengeluaran2'))
      _openTambahKas('keluar');
    // Tombol di index.html (view kas-madrasah) juga dikaitkan
    if (e.target.closest('#btn-catat-pemasukan'))
      _openTambahKas('masuk');
    if (e.target.closest('#btn-catat-pengeluaran'))
      _openTambahKas('keluar');
  });

  // ── Filter jenis → update opsi kategori di modal ──── //
  document.addEventListener('change', e => {
    if (e.target.id === 'kas-jenis')
      _updateKatOptions(e.target.value);
  });

  // ── Simpan transaksi kas ───────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-simpan-kas')) _submitKas();
  });

  // ── [INTEGRASI BARU DARI KEUANGAN1.JS] Klik Detail Transaksi ── //
  document.addEventListener('click', e => {
    const btnView = e.target.closest('[data-keu-view]');
    if (btnView) {
      const row   = btnView.closest('tr');
      const cells = row.querySelectorAll('td');
      const get   = (i, sel) => cells[i]?.querySelector(sel)?.textContent.trim() || cells[i]?.textContent.trim() || '—';

      const tgl     = get(0, 'div'); 
      const ket     = get(3, 'div'); 
      const nominal = cells[4]?.textContent.trim() || '—';
      const saldo   = cells[5]?.textContent.trim() || '—';
      const isKeluar= nominal.includes('−') || nominal.includes('-');

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
      
      set('dtl-tgl',      tgl);
      set('dtl-ket',      ket);
      set('dtl-saldo',    saldo);
      set('dtl-id',       'TRX-' + Date.now().toString().slice(-6));
      set('dtl-kategori', isKeluar ? 'Pengeluaran' : 'Pemasukan');
      set('dtl-oleh',     'Admin Utama');

      const nomEl   = document.getElementById('dtl-nominal');
      const badgeEl = document.getElementById('dtl-jenis-badge');
      
      if (nomEl) { 
        nomEl.textContent = nominal; 
        nomEl.style.color = isKeluar ? 'var(--clr-danger)' : 'var(--clr-success)'; 
      }
      if (badgeEl) {
        badgeEl.innerHTML = isKeluar 
          ? '<span class="badge danger">Pengeluaran</span>' 
          : '<span class="badge success">Pemasukan</span>';
      }

      if(window.openModal) window.openModal('modal-detail-transaksi');
    }
  });

  // ── Filter bulan kas ───────────────────────────────── //
  document.addEventListener('change', e => {
    if (e.target.id === 'kas-filter-bulan') {
      _ks.bulanFilter = e.target.value;
      _ks.page = 1;
      _loadKas(_ks.bulanFilter).then(data => {
        _ks.kasCache = data;
        _renderKasTable();
        _renderKasStatCards();
      });
    }
    if (e.target.id === 'kas-filter-jenis') {
      _ks.jenisFilter = e.target.value;
      _ks.page = 1; _renderKasTable();
    }
  });

  // ── Search kas ─────────────────────────────────────── //
  document.addEventListener('input', e => {
    if (e.target.id === 'kas-search') {
      _ks.searchQ = e.target.value;
      _ks.page = 1; _renderKasTable();
    }
    if (e.target.id === 'spp-search') _renderSPPTable();
  });

  // ── Filter SPP ─────────────────────────────────────── //
  document.addEventListener('change', e => {
    if (['spp-filter-bulan','spp-filter-kelas',
         'spp-filter-status'].includes(e.target.id)) {
      if (e.target.id === 'spp-filter-bulan') {
        _ks.bulanSPP = e.target.value;
        _loadSPP(_ks.bulanSPP).then(data => {
          _ks.sppCache = data;
          _renderSPPTable();
          _renderSPPStatCards();
        });
      } else {
        _renderSPPTable();
      }
    }
  });

  // ── Generate tagihan SPP ───────────────────────────── //
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-generate-spp')) return;
    window.confirmDelete(
      `Generate tagihan SPP ${_formatBulan(_ks.bulanSPP)} ` +
      `untuk semua santri aktif?`,
      async () => {
        const count = await _generateTagihanSPP(_ks.bulanSPP);
        if (count > 0) {
          window.showToast('success','Tagihan Di-generate',
            `${count} tagihan SPP berhasil dibuat.`);
          _ks.sppCache = await _loadSPP(_ks.bulanSPP);
          _renderSPPTable();
          _renderSPPStatCards();
        }
      }
    );
    requestAnimationFrame(() => {
      const ok  = document.getElementById('modal-confirm-ok');
      const ico = document.querySelector(
        '#modal-confirm .modal-confirm-icon i');
      if (ok) {
        ok.className = 'btn btn-primary';
        ok.innerHTML =
          '<i class="ph-bold ph-magic-wand"></i> Ya, Generate';
      }
      if (ico) ico.className = 'ph-bold ph-magic-wand';
    });
  });

  // ── Export kas CSV ─────────────────────────────────── //
  document.addEventListener('click', e => {
    if (e.target.closest('#btn-export-kas')) _exportKasCSV();
  });

  // ── Tampilkan laporan ──────────────────────────────── //
  document.addEventListener('click', e => {
    if (!e.target.closest('#btn-tampil-laporan')) return;
    _ks.bulanLaporan =
      document.getElementById('laporan-bulan')?.value
      || _thisMonth();
    _renderLaporan();
  });

  // ── Close modal kas (via data-close-modal) ─────────── //
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-close-modal="modal-kas"]');
    if (btn) window.closeModal('modal-kas');
  });
}

/* ── INIT MODUL ──────────────────────────────────────────────── */
(async function _init() {

  // Tangani Siklus Navigasi SPA
  window.addEventListener('madin:navigate', async e => {
    if (e.detail.page !== 'kas-madrasah') return;

    // Pasang event listener HANYA jika belum pernah dipasang (Mencegah Hang/Freeze)
    if (!_isKeuanganWired) {
      _wireEvents();
      _isKeuanganWired = true; // Kunci rapat!
    }

    // 1. Injeksi State Default ke Elemen HTML
    const kasBulanEl = document.getElementById('kas-filter-bulan');
    if (kasBulanEl && !kasBulanEl.value) kasBulanEl.value = _ks.bulanFilter;

    const sppBulanEl = document.getElementById('spp-filter-bulan');
    if (sppBulanEl && !sppBulanEl.value) sppBulanEl.value = _ks.bulanSPP;

    const lapBulanEl = document.getElementById('laporan-bulan');
    if (lapBulanEl && !lapBulanEl.value) lapBulanEl.value = _ks.bulanLaporan;

    const kasTglEl = document.getElementById('kas-tanggal'); // Default tgl di modal input
    if (kasTglEl && !kasTglEl.value) kasTglEl.value = _today();

    // 2. Pulihkan Visual Tab Aktif
    document.querySelectorAll('[data-keu-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.keuTab === _ks.tab);
    });
    
    ['kas', 'spp', 'laporan'].forEach(p => {
      const panel = document.getElementById(`keu-panel-${p}`);
      if (panel) panel.style.display = p === _ks.tab ? 'block' : 'none';
    });

    _updateKatOptions('masuk');

    // 3. Tarik data dan Render Tab yang Sedang Aktif
    if (_ks.tab === 'kas') {
       _ks.kasCache = await _loadKas(_ks.bulanFilter);
       _renderKasStatCards();
       _renderKasTable();
    } else if (_ks.tab === 'spp') {
       _ks.sppCache = await _loadSPP(_ks.bulanSPP);
       _renderSPPStatCards();
       _renderSPPTable();
    } else if (_ks.tab === 'laporan') {
       await _renderLaporan();
    }

  });

  console.log('[Madin] Keuangan module loaded ✓ (SOP V2 + Business Logic Intact)');

})();
