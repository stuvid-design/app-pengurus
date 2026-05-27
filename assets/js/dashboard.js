/* ============================================================
   app.js — Dashboard Charts
   ============================================================ */

/* ── DASHBOARD CHARTS ────────────────────────────────────────── */
(function initCharts() {

  // Tunggu Chart.js CDN selesai load
  function tryInit() {
    if (typeof Chart === 'undefined') { setTimeout(tryInit, 200); return; }
    buildCharts();
  }

  function buildCharts() {

    /* ── 1. Line Chart: Kehadiran 7 Hari Terakhir ─────────────── */
    const ctxK = document.getElementById('chart-kehadiran');
    if (!ctxK) return;

    const labels7    = ['14 Mei','15 Mei','16 Mei','17 Mei','18 Mei','19 Mei','20 Mei'];
    const dataHadir  = [108, 115, 110, 112, 105, 118, 112];
    const dataIzin   = [ 12,   8,   9,   7,   8,   5,   5];
    const dataAlpha  = [  8,   5,   9,   9,  15,   5,  11];

    new Chart(ctxK, {
      type: 'line',
      data: {
        labels: labels7,
        datasets: [
          {
            label: 'Hadir',
            data: dataHadir,
            borderColor: '#1a6b3c',
            backgroundColor: 'rgba(26,107,60,.10)',
            fill: true, tension: .42,
            pointBackgroundColor: '#1a6b3c',
            pointRadius: 5, pointHoverRadius: 7, borderWidth: 2.5,
          },
          {
            label: 'Izin',
            data: dataIzin,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,.08)',
            fill: true, tension: .42,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 5, pointHoverRadius: 7, borderWidth: 2,
          },
          {
            label: 'Alpha',
            data: dataAlpha,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,.08)',
            fill: true, tension: .42,
            pointBackgroundColor: '#ef4444',
            pointRadius: 5, pointHoverRadius: 7, borderWidth: 2,
          },
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2b1e',
            titleColor: '#fff',
            bodyColor: 'rgba(255,255,255,.75)',
            padding: 12, borderRadius: 10,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} santri`,
            }
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 12 }, color: '#94a89a' },
            border: { display: false },
          },
          y: {
            grid: { color: 'rgba(26,107,60,.06)' },
            ticks: { font: { size: 12 }, color: '#94a89a', stepSize: 30 },
            border: { display: false },
            min: 0, max: 135,
          }
        }
      }
    });

    /* ── 2. Bar Chart: Pemasukan vs Pengeluaran (6 Bulan) ─────── */
    const ctxKeu = document.getElementById('chart-keuangan');
    if (!ctxKeu) return;

    new Chart(ctxKeu, {
      type: 'bar',
      data: {
        labels: ['Des','Jan','Feb','Mar','Apr','Mei'],
        datasets: [
          {
            label: 'Pemasukan',
            data: [28500000, 29000000, 30200000, 31000000, 31800000, 32500000],
            backgroundColor: 'rgba(26,107,60,.75)',
            borderRadius: 6, borderSkipped: false,
          },
          {
            label: 'Pengeluaran',
            data: [6200000, 6800000, 7100000, 6900000, 7400000, 7750000],
            backgroundColor: 'rgba(239,68,68,.65)',
            borderRadius: 6, borderSkipped: false,
          }
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
              label: ctx => ` ${ctx.dataset.label}: ${
                new Intl.NumberFormat('id-ID', {
                  style: 'currency', currency: 'IDR', minimumFractionDigits: 0
                }).format(ctx.parsed.y)
              }`,
            }
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#94a89a' },
            border: { display: false },
          },
          y: {
            grid: { color: 'rgba(26,107,60,.06)' },
            ticks: {
              font: { size: 11 }, color: '#94a89a',
              callback: v => 'Rp ' + (v / 1e6).toFixed(0) + 'jt'
            },
            border: { display: false },
          }
        }
      }
    });

    /* ── 3. Donut Chart: Tingkat Hafalan ──────────────────────── */
    const ctxH = document.getElementById('chart-hafalan');
    if (!ctxH) return;

    new Chart(ctxH, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [72, 28],
          backgroundColor: ['#1a6b3c', 'rgba(26,107,60,.10)'],
          borderWidth: 0,
          hoverOffset: 4,
        }]
      },
      options: {
        cutout: '78%',
        responsive: false,
        plugins: {
          legend:  { display: false },
          tooltip: { enabled: false },
        },
      }
    });

  } // end buildCharts()

  tryInit();

  // Re-init chart setiap kali navigasi ke dashboard
  window.addEventListener('madin:navigate', e => {
    if (e.detail.page === 'dashboard') setTimeout(tryInit, 100);
  });

})();

/* ── CHART FILTER HANDLER ────────────────────────────────────── */
// Filter 7 / 14 / 30 hari pada grafik kehadiran
(function chartFilter() {
  const filterEl = document.getElementById('chart-kehadiran-filter');
  if (!filterEl) return;

  // Dataset dummy untuk berbagai rentang waktu
  const datasets = {
    '7':  {
      labels: ['14 Mei','15 Mei','16 Mei','17 Mei','18 Mei','19 Mei','20 Mei'],
      hadir: [108,115,110,112,105,118,112],
      izin:  [ 12,  8,  9,  7,  8,  5,  5],
      alpha: [  8,  5,  9,  9, 15,  5, 11],
    },
    '14': {
      labels: ['7 Mei','8 Mei','9 Mei','10 Mei','11 Mei','12 Mei','13 Mei','14 Mei','15 Mei','16 Mei','17 Mei','18 Mei','19 Mei','20 Mei'],
      hadir: [102,110,108,115,112,109,107,108,115,110,112,105,118,112],
      izin:  [ 10, 11, 12,  8, 10, 11,  9, 12,  8,  9,  7,  8,  5,  5],
      alpha: [ 16, 7,  8,  5,  6,  8, 12,  8,  5,  9,  9, 15,  5, 11],
    },
    '30': {
      labels: Array.from({length:30},(_,i)=>{ const d=new Date(2024,4,20-29+i); return d.getDate()+'/'+( d.getMonth()+1); }),
      hadir: [98,102,105,100,108,110,107,103,112,109,106,108,110,115,112,108,111,114,110,107,112,109,105,108,115,110,112,105,118,112],
      izin:  [ 14, 12, 10, 13, 11,  9, 10, 12,  8, 10, 11,  9, 10, 8,  9,  11, 10,  8,  9, 10,  7,  9, 11, 12,  8,  9,  7,  8,  5,  5],
      alpha: [ 16, 14, 13, 15, 9,   9, 11, 13,  8, 9,  11, 11,  8, 5,  7,   9,  7,  6,  9, 11,  9,  10,12,  8,  5,  9,  9, 15,  5, 11],
    }
  };

  filterEl.addEventListener('change', () => {
    const range = filterEl.value;
    const d     = datasets[range];
    if (!d) return;

    // Cari instance Chart yang terikat ke canvas chart-kehadiran
    const canvas    = document.getElementById('chart-kehadiran');
    const chartInst = canvas ? Chart.getChart(canvas) : null;
    if (!chartInst) return;

    chartInst.data.labels             = d.labels;
    chartInst.data.datasets[0].data   = d.hadir;
    chartInst.data.datasets[1].data   = d.izin;
    chartInst.data.datasets[2].data   = d.alpha;
    chartInst.update();
  });
})();
