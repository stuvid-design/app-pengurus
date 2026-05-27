/* ============================================================
   app.pdf.js — PDF Print Engine Controller
   ============================================================ */

'use strict';

/* ── STATE MODUL ─────────────────────────────────────────────── */
const _pdfState = {
  size: 'a4',       // a4 | f4
  orient: 'portrait'// portrait | landscape
};

/* ── CONTROLLER FUNGSI ───────────────────────────────────────── */

// 1. Membuka Modal PDF
function pdfModalOpen() {
  window.openModal('modal-pdf-export');
}

// 2. Menutup Modal PDF
function pdfModalClose() {
  window.closeModal('modal-pdf-export');
}

// 3. Engine Eksekusi Cetak (@page Injector)
function pdfDoExport() {
  // Ambil state terbaru dari form modal
  _pdfState.size = document.querySelector('input[name="pdf_size"]:checked').value;
  _pdfState.orient = document.querySelector('input[name="pdf_orient"]:checked').value;

  // Setel String Dimensi berdasarkan ISO A4 dan F4 (dalam mm)
  let pageSizeCss = '';
  if (_pdfState.size === 'a4') {
    pageSizeCss = '210mm 297mm';
  } else if (_pdfState.size === 'f4') {
    pageSizeCss = '210mm 330mm';
  }

  // Terapkan Orientasi (landscape membalik dimensi)
  if (_pdfState.orient === 'landscape') {
    pageSizeCss = 'landscape'; // Memanfaatkan direktif standar landscape browser
  }

  // Injeksi tag <style> secara dinamis
  const styleId = 'dynamic-pdf-style';
  let styleEl = document.getElementById(styleId);
  
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  // Tulis parameter @page
  styleEl.innerHTML = `
    @page {
      size: ${pageSizeCss};
      margin: 15mm 15mm 20mm 15mm;
    }
  `;

  // Set tanggal cetak di footer PDF
  const dateEl = document.getElementById('pdf-print-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Tutup Modal sebelum mencetak agar animasi selesai
  pdfModalClose();

  // Eksekusi print engine (timeout kecil untuk memberi waktu DOM render style)
  setTimeout(() => {
    window.print();
    
    // Pembersihan style dinamis setelah dialog print tertutup / dibatalkan
    setTimeout(() => {
      if (document.getElementById(styleId)) {
        document.getElementById(styleId).remove();
      }
    }, 1000);
  }, 300);
}

/* ── EVENT LISTENERS (INIT) ──────────────────────────────────── */
(function _initPdfEngine() {
  
  // Trigger Buka Modal dari FAB
  const fabBtn = document.getElementById('btn-fab-pdf');
  if (fabBtn) {
    fabBtn.addEventListener('click', pdfModalOpen);
  }

  // Eksekusi Cetak dari Modal
  const executeBtn = document.getElementById('btn-execute-pdf');
  if (executeBtn) {
    executeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      pdfDoExport();
    });
  }

  console.log('[Madin] PDF Export Engine loaded ✓');
})();
