/* AGS CHART SIMPLE v1 — merapikan halaman Chart supaya fokus ke yang penting untuk keputusan.
   Pasang paling akhir, sebelum </body>:
   <script src="ags-chart-simple.js?v=1"></script>
   Ada tombol "Simple / Lengkap" di kanan atas kartu chart untuk balik ke tampilan penuh. */
(function () {
  'use strict';
  const f = document.getElementById('goldFrame');
  if (!f) return;
  const KEY = 'ags_chart_mode';
  const getMode = () => { try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || 'simple'; } catch (e) { return 'simple'; } };
  const setMode = m => { try { localStorage.setItem(KEY, m); } catch (e) { try { sessionStorage.setItem(KEY, m); } catch (e2) {} } };

  const CSS = `
  /* urutan kartu: Keputusan > Chart > Trend > Level > Risk */
  html.ags-simple .layout .col{display:contents}
  html.ags-simple .layout>.col:nth-child(3)>.card:nth-child(1){order:1}
  html.ags-simple .layout>.col:nth-child(2)>.chart-card{order:2}
  html.ags-simple .layout>.col:nth-child(1)>.card:nth-child(1){order:3}
  html.ags-simple .layout>.col:nth-child(1)>.card:nth-child(2){order:4}
  html.ags-simple .layout>.col:nth-child(3)>.card:nth-child(2){order:5}
  /* yang disembunyikan karena dobel / bikin penuh */
  html.ags-simple .layout>.col:nth-child(1)>.card:nth-child(3){display:none}   /* AI Score buy/sell (sudah ada di Final Decision) */
  html.ags-simple .chart-sub, html.ags-simple #sesBar, html.ags-simple #utcRow,
  html.ags-simple #sessionIndicator>div:first-child, html.ags-simple footer,
  html.ags-simple #trendUpdated, html.ags-simple #dklUpdated, html.ags-simple #rc-updated,
  html.ags-simple .setup-score-legend, html.ags-simple .fd-tip,
  html.ags-simple .ags-hide{display:none!important}
  html.ags-simple #sessionIndicator{margin-bottom:8px}
  /* ringkas kartu Market Validation: tabel detail disembunyikan, bisa dibuka lewat tombol Detail */
  html.ags-simple .layout>.col:nth-child(3)>.card:nth-child(1)>h3+div{display:none}
  html.ags-simple .mv-table{display:none}
  html.ags-simple.ags-detail .mv-table{display:table}
  html.ags-simple .setup-score-box{margin-top:6px}
  #agsDetailBtn,#agsModeBtn{font-size:10.5px;font-family:var(--sans);font-weight:700;padding:3px 10px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--muted);cursor:pointer;margin-left:auto;text-transform:none;letter-spacing:0}
  #agsDetailBtn:hover,#agsModeBtn:hover{color:var(--green);border-color:var(--green)}
  /* desktop: chart lebar di kiri, panel keputusan di kanan */
  @media(min-width:1101px){
    html.ags-simple .layout{grid-template-columns:minmax(0,1fr) 340px;align-items:start}
    html.ags-simple .layout>.col:nth-child(2)>.chart-card{grid-column:1;grid-row:1/span 4}
    html.ags-simple .layout>.col>.card:not(.chart-card){grid-column:2}
    html.ags-simple #tv_chart_container{height:calc(100vh - 250px);min-height:520px}
  }`;

  function apply() {
    const d = f.contentDocument;
    if (!d || !d.body || !d.getElementById('tv_chart_container') || d.getElementById('agsSimpleCss')) return;

    const st = d.createElement('style'); st.id = 'agsSimpleCss'; st.textContent = CSS;
    d.head.appendChild(st);

    // baris yang tidak penting untuk keputusan cepat
    ['trend-m5', 'dkl-r2', 'dkl-s2', 'rc-tp2', 'rc-profit2'].forEach(id => {
      const el = d.getElementById(id);
      const row = el && el.closest('.trend-row, .row');
      if (row) row.classList.add('ags-hide');
    });

    // tombol Detail di kartu Market Validation
    const mvTitle = d.querySelector('.layout>.col:nth-child(3)>.card:nth-child(1)>h3');
    if (mvTitle && !d.getElementById('agsDetailBtn')) {
      const b = d.createElement('button'); b.id = 'agsDetailBtn'; b.textContent = 'Detail ▾';
      b.onclick = () => {
        const on = d.documentElement.classList.toggle('ags-detail');
        b.textContent = on ? 'Detail ▴' : 'Detail ▾';
      };
      mvTitle.appendChild(b);
    }

    // tombol Simple / Lengkap (menggantikan teks "LIVE SESSION TRACKER")
    const head = d.querySelector('.chart-head');
    const right = head && head.lastElementChild;
    if (right && !d.getElementById('agsModeBtn')) {
      right.innerHTML = '';
      const b = d.createElement('button'); b.id = 'agsModeBtn';
      const refresh = () => { b.textContent = d.documentElement.classList.contains('ags-simple') ? 'Mode: Simple · klik untuk Lengkap' : 'Mode: Lengkap · klik untuk Simple'; };
      b.onclick = () => {
        const simple = d.documentElement.classList.toggle('ags-simple');
        setMode(simple ? 'simple' : 'full');
        refresh();
        try { f.contentWindow.dispatchEvent(new Event('resize')); } catch (e) {}
      };
      right.appendChild(b);
      right.dataset.refresh = '1';
      b._refresh = refresh;
    }

    if (getMode() === 'simple') d.documentElement.classList.add('ags-simple');
    const mb = d.getElementById('agsModeBtn'); if (mb && mb._refresh) mb._refresh();
    try { f.contentWindow.dispatchEvent(new Event('resize')); } catch (e) {}
  }

  f.addEventListener('load', apply);
  try { apply(); } catch (e) {}
})();
