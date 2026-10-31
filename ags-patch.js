/* AGS PATCH v1 — taruh 1 baris sebelum </body> di index.html:
   <script src="ags-patch.js"></script>
   Isi: hapus Saham · Gold→Chart · Dashboard=Statistik · Statistics→Market Corner · tambah XAU AI (Gemini) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);

  /* ---------- storage (localStorage, fallback sessionStorage) ---------- */
  function lsGet(k) {
    try { const v = localStorage.getItem(k); if (v !== null) return v; } catch (e) {}
    try { return sessionStorage.getItem(k); } catch (e) {}
    return null;
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); return; } catch (e) {}
    try { sessionStorage.setItem(k, v); } catch (e) {}
  }

  /* ---------- 1. Hapus Saham ---------- */
  const nav = document.querySelector('.sidebar-nav');
  ['[data-page="saham"]'].forEach(s => { const n = nav.querySelector(s); if (n) n.remove(); });
  ['page-saham', 'saham-source-b64'].forEach(id => { const n = $(id); if (n) n.remove(); });

  /* ---------- 2. Rename menu ---------- */
  const navGold = nav.querySelector('[data-page="gold"]');
  navGold.innerHTML = '<span class="nav-icon">📈</span> Chart';
  const navStat = nav.querySelector('[data-page="statistics"]');
  navStat.innerHTML = '<span class="nav-icon">🌍</span> Market Corner';
  const navAI = document.createElement('div');
  navAI.className = 'nav-item';
  navAI.dataset.page = 'xauai';
  navAI.innerHTML = '<span class="nav-icon">🤖</span> XAU AI';
  navGold.after(navAI);

  /* ---------- 3. Tukar isi Dashboard <-> Statistics ---------- */
  const pd = $('page-dashboard'), ps = $('page-statistics');
  const missionCard = pd.querySelector('.dash-left-col > .card');
  const recentCard = $('recentJournal').closest('.card');
  const personal = document.createElement('div');
  personal.className = 'grid-2 mb-14';
  personal.append(missionCard, recentCard);

  const dKids = [...pd.children], sKids = [...ps.children];
  sKids.forEach(c => pd.appendChild(c));
  dKids.forEach(c => ps.appendChild(c));
  pd.prepend(personal);

  const sh = pd.querySelector('.stats-header > div');
  if (sh) sh.textContent = '🏠 Dashboard';
  const mcTitle = document.createElement('div');
  mcTitle.style.cssText = 'font-size:16px;font-weight:800;margin-bottom:14px;';
  mcTitle.textContent = '🌍 Market Corner';
  ps.prepend(mcTitle);

  const st = document.createElement('style');
  st.textContent = '@media(max-width:700px){.grid-2{grid-template-columns:1fr}}' +
    '.ai-wrap{display:flex;flex-direction:column;height:calc(100vh - 150px);min-height:420px}' +
    '.ai-chat{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:4px 2px 10px}' +
    '.ai-msg{max-width:92%;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-break:break-word}' +
    '.ai-msg.user{align-self:flex-end;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3)}' +
    '.ai-msg.ai{align-self:flex-start;background:var(--panel);border:1px solid var(--line)}' +
    '.ai-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}' +
    '.ai-chip{font-size:11px;padding:5px 10px;border-radius:20px;border:1px solid var(--line);background:var(--panel2);color:var(--muted);cursor:pointer;font-family:var(--sans)}' +
    '.ai-chip:hover{color:var(--green);border-color:var(--green)}' +
    '.ai-row{display:flex;gap:8px;align-items:flex-end}' +
    '.ai-row textarea{flex:1;min-height:42px;max-height:120px;resize:none}';
  document.head.appendChild(st);

  /* ---------- 4. Halaman XAU AI ---------- */
  const page = document.createElement('div');
  page.className = 'page';
  page.id = 'page-xauai';
  page.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
      <div style="font-size:16px;font-weight:800;">🤖 XAU AI <span id="aiKeyState" style="font-size:11px;font-weight:600;color:var(--muted);"></span></div>
      <button class="btn btn-ghost" id="aiSetBtn" style="padding:6px 12px;font-size:12px;">⚙️ Pengaturan</button>
    </div>
    <div class="card mb-14" id="aiSettings" style="display:none;">
      <div class="form-group" style="margin-bottom:8px;">
        <label class="form-label">GEMINI API KEY</label>
        <input class="form-input" id="aiKey" type="password" placeholder="AIza..." autocomplete="off">
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <label class="form-label">MODEL</label>
        <input class="form-input" id="aiModel" placeholder="gemini-2.5-flash">
      </div>
      <div style="font-size:10.5px;color:var(--muted);margin-bottom:10px;">Key dibuat gratis di aistudio.google.com/apikey (langganan Gemini Premium tidak otomatis jadi API key). Disimpan hanya di browser kamu.</div>
      <button class="btn btn-primary" id="aiSave">💾 Simpan</button>
    </div>
    <div class="ai-wrap">
      <div class="ai-chat" id="aiChat"></div>
      <div class="ai-chips" id="aiChips"></div>
      <label style="font-size:11px;color:var(--muted);margin-bottom:6px;display:flex;gap:6px;align-items:center;">
        <input type="checkbox" id="aiSearch" checked> Pakai Google Search (berita terbaru)
      </label>
      <div class="ai-row">
        <textarea class="form-input" id="aiInput" placeholder="Tanya signal, hitung lot, atau berita emas..."></textarea>
        <button class="btn btn-primary" id="aiSend">Kirim</button>
      </div>
    </div>`;
  $('page-gold').after(page);

  /* ---------- 5. Logika XAU AI ---------- */
  const KEY_LS = 'ags_gemini_key', MODEL_LS = 'ags_gemini_model';
  const DEFAULT_MODEL = 'gemini-2.5-flash';
  let history = [], busy = false;

  const SYSTEM = `Kamu XAU AI, asisten trading XAUUSD (emas) milik Azis di sistem AGS. Jawab Bahasa Indonesia, ringkas (cocok dibaca di HP), langsung ke poin.
Aturan AGS: risk maksimal 1% per trade, min RR 1:2, SL wajib, hindari entry saat berita high impact, maksimal 2 trade/hari, tunggu candle close.
Untuk signal: beri bias (Buy/Sell/Wait), area entry, SL, TP1 (1:2), TP2 (1:4), alasan singkat dari data live, dan kondisi pembatalan. Pakai data live yang diberikan; jangan mengarang harga. Kalau setup kurang jelas, bilang WAIT.
Hitung lot XAUUSD: 1 lot = 100 oz, jadi risiko($) = lot x jarak SL(dolar) x 100. Tampilkan rumusnya.
Untuk berita, pakai Google Search bila tersedia dan sebutkan dampaknya ke emas (USD, yield, The Fed, geopolitik).
Ingatkan singkat bahwa ini bukan nasihat keuangan, keputusan tetap di tangan Azis.`;

  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

  function addMsg(role, text) {
    const d = document.createElement('div');
    d.className = 'ai-msg ' + role;
    d.innerHTML = fmt(text);
    $('aiChat').appendChild(d);
    $('aiChat').scrollTop = $('aiChat').scrollHeight;
    return d;
  }

  function refreshKeyState() {
    const has = !!lsGet(KEY_LS);
    $('aiKeyState').textContent = has ? '· ✅ terhubung Gemini' : '· ⚠️ belum ada API key';
    $('aiKeyState').style.color = has ? 'var(--green)' : 'var(--gold)';
  }

  /* indikator teknikal dari XAU/USD M15 (Twelve Data) */
  function ema(c, p) { const k = 2 / (p + 1); let e = c.slice(0, p).reduce((a, b) => a + b, 0) / p; for (let i = p; i < c.length; i++) e = c[i] * k + e * (1 - k); return e; }
  function rsi(c, p = 14) {
    let g = 0, l = 0;
    for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; d >= 0 ? g += d : l -= d; }
    g /= p; l /= p;
    for (let i = p + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (p - 1) + Math.max(d, 0)) / p; l = (l * (p - 1) + Math.max(-d, 0)) / p; }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  function atr(h, l, c, p = 14) {
    const tr = []; for (let i = 1; i < c.length; i++) tr.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
    let a = tr.slice(0, p).reduce((x, y) => x + y, 0) / p;
    for (let i = p; i < tr.length; i++) a = (a * (p - 1) + tr[i]) / p;
    return a;
  }

  async function getContext() {
    const now = new Date();
    let out = `Waktu: ${now.toISOString()} (UTC)`;
    try {
      const r = await fetch(`https://api.twelvedata.com/time_series?symbol=XAU%2FUSD&interval=15min&outputsize=100&apikey=${TD_KEY}`);
      const d = await r.json();
      if (!d.values) throw new Error(d.message || 'no data');
      const v = [...d.values].reverse();
      const c = v.map(x => +x.close), h = v.map(x => +x.high), l = v.map(x => +x.low);
      const p = c[c.length - 1], e50 = ema(c, 50), a = atr(h, l, c);
      out += `\nXAUUSD M15 live: harga ${p.toFixed(2)} | EMA50 ${e50.toFixed(2)} (${p > e50 ? 'di atas' : 'di bawah'}) | RSI14 ${rsi(c).toFixed(1)} | ATR14 ${a.toFixed(2)}` +
        `\nHigh/Low 100 candle M15: ${Math.max(...h).toFixed(2)} / ${Math.min(...l).toFixed(2)}` +
        `\n5 close terakhir: ${c.slice(-5).map(x => x.toFixed(2)).join(', ')}`;
    } catch (e) { out += '\n(Data live XAUUSD gagal diambil: ' + e.message + ')'; }
    try { if (marketSnapshot.usd) out += `\nUSD/IDR: ${marketSnapshot.usd.price.toFixed(0)}`; } catch (e) {}
    return out;
  }

  async function ask(q) {
    q = (q || '').trim();
    if (!q || busy) return;
    const key = lsGet(KEY_LS);
    if (!key) { $('aiSettings').style.display = 'block'; addMsg('ai', 'Isi API key Gemini dulu di ⚙️ Pengaturan ya.'); return; }
    busy = true; $('aiSend').disabled = true;
    addMsg('user', q);
    const wait = addMsg('ai', '⏳ Menganalisa...');
    history.push({ role: 'user', parts: [{ text: q }] });
    try {
      const ctx = await getContext();
      let arr = history.slice(-12);
      if (arr[0].role !== 'user') arr.shift();
      const body = {
        systemInstruction: { parts: [{ text: SYSTEM + '\n\nDATA PASAR LIVE:\n' + ctx }] },
        contents: arr,
        generationConfig: { temperature: 0.4, maxOutputTokens: 1500 }
      };
      if ($('aiSearch').checked) body.tools = [{ google_search: {} }];
      const model = lsGet(MODEL_LS) || DEFAULT_MODEL;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Gemini error');
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (!text) throw new Error('Jawaban kosong (mungkin diblokir filter). Coba ulangi dengan kalimat lain.');
      history.push({ role: 'model', parts: [{ text }] });
      wait.innerHTML = fmt(text);
    } catch (e) {
      history.pop();
      wait.innerHTML = fmt('❌ ' + e.message);
    }
    busy = false; $('aiSend').disabled = false;
    $('aiChat').scrollTop = $('aiChat').scrollHeight;
  }

  [
    ['📊 Signal sekarang', 'Kasih signal XAUUSD sekarang (Buy/Sell/Wait) lengkap entry, SL, TP1, TP2.'],
    ['🧮 Hitung lot', 'Hitung lot XAUUSD untuk balance $1000, risk 1%, dengan SL sesuai ATR sekarang.'],
    ['📰 Berita emas', 'Rangkum berita hari ini yang menggerakkan emas dan dampaknya.'],
    ['🧭 Bias hari ini', 'Bagaimana bias XAUUSD hari ini dan level penting yang harus dipantau?']
  ].forEach(([label, q]) => {
    const b = document.createElement('button');
    b.className = 'ai-chip'; b.textContent = label;
    b.onclick = () => ask(q);
    $('aiChips').appendChild(b);
  });

  $('aiSend').onclick = () => { const t = $('aiInput').value; $('aiInput').value = ''; ask(t); };
  $('aiInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('aiSend').click(); }
  });
  $('aiSetBtn').onclick = () => {
    const box = $('aiSettings');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
    $('aiModel').value = lsGet(MODEL_LS) || DEFAULT_MODEL;
  };
  $('aiSave').onclick = () => {
    const k = $('aiKey').value.trim();
    if (k) lsSet(KEY_LS, k);
    lsSet(MODEL_LS, $('aiModel').value.trim() || DEFAULT_MODEL);
    $('aiKey').value = '';
    $('aiSettings').style.display = 'none';
    refreshKeyState();
    showToast('Pengaturan XAU AI disimpan ✅');
  };
  refreshKeyState();
  addMsg('ai', 'Halo Azis 👋 Aku XAU AI. Tanya signal, hitung lot, atau minta rangkuman berita emas. Data harga XAUUSD live ikut kubaca tiap kamu bertanya.');

  /* ---------- 6. Override fungsi lama ---------- */
  window.switchPage = function (p) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === p));
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const t = $('page-' + p);
    if (t) t.classList.add('active');
    if (p === 'journal') loadJournalPage();
    if (p === 'dashboard') loadStats();
    if (p === 'calendar') loadEconomicCalendarWidget();
    if (p === 'statistics') { // = Market Corner: gambar ulang sparkline (tadinya tersembunyi)
      try {
        ['gold', 'usd'].forEach(k => {
          const s = marketSnapshot[k];
          if (s && s.closes) drawSparkline('spark-' + k, s.closes, s.chg >= 0 ? '#22c55e' : '#ef4444');
        });
        computeGoldIDR();
      } catch (e) {}
    }
  };

  const _loadDashboard = window.loadDashboard;
  window.loadDashboard = function () {
    const r = _loadDashboard.apply(this, arguments);
    try { loadStats(); } catch (e) {}
    return r;
  };

  // hanya muat Chart (Gold); Saham sudah dihapus
  window.loadEmbeddedSubApps = function () {
    const f = $('goldFrame'), src = $('gold-source-b64');
    if (!f || !src) return;
    f.addEventListener('load', () => {
      const t = document.documentElement.getAttribute('data-theme') || 'dark';
      try { f.contentWindow.postMessage({ type: 'ags-theme', theme: t }, '*'); } catch (e) {}
    });
    f.srcdoc = b64ToUtf8(src.textContent.trim());
  };
})();
