/* AGS VISION v2 — lampiran foto/screenshot untuk XAU AI.
   Pasang SETELAH ags-patch.js, sebelum </body>:
   <script src="ags-patch.js?v=8"></script>
   <script src="ags-vision.js?v=1"></script>
   Cara pakai: klik 📎, atau Ctrl+V (paste screenshot), atau tarik gambar ke area chat. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const GROQ_VISION = 'meta-llama/llama-4-scout-17b-16e-instruct'; // model Groq yang bisa membaca gambar
  if (!$('page-xauai') || !document.querySelector('#page-xauai .ai-row')) { console.warn('[AGS Vision] halaman XAU AI tidak ditemukan; pastikan ags-vision.js dipasang setelah ags-patch.js'); return; }

  let pending = null;        // gambar yang menunggu dikirim
  let active = null;         // gambar untuk request yang sedang berjalan (dipakai ulang saat auto-retry)

  /* ---------- UI ---------- */
  const st = document.createElement('style');
  st.textContent = '.ai-prev{display:none;align-items:center;gap:10px;margin-bottom:6px;padding:6px 8px;border:1px dashed var(--green);border-radius:10px;background:rgba(34,197,94,.06);font-size:11.5px}' +
    '.ai-prev.show{display:flex}.ai-prev img{height:52px;border-radius:6px;border:1px solid var(--line)}.ai-prev .x{margin-left:auto;cursor:pointer;color:var(--muted);font-size:15px;padding:2px 6px}' +
    '.ai-prev .x:hover{color:var(--red)}.ai-msg img.shot{max-width:min(320px,100%);border-radius:8px;display:block;margin-bottom:6px;border:1px solid var(--line)}' +
    '.ai-wrap.drag{outline:2px dashed var(--green);outline-offset:-4px}';
  document.head.appendChild(st);

  const row = document.querySelector('#page-xauai .ai-row');
  const input = $('aiInput');

  const attach = document.createElement('button');
  attach.className = 'btn btn-ghost'; attach.type = 'button'; attach.title = 'Lampirkan foto / screenshot'; attach.textContent = '📎';
  attach.style.cssText = 'padding:9px 12px;font-size:16px;';
  row.prepend(attach);

  const file = document.createElement('input');
  file.type = 'file'; file.accept = 'image/*'; file.style.display = 'none';
  document.body.appendChild(file);

  const prev = document.createElement('div');
  prev.className = 'ai-prev'; prev.id = 'aiPrev';
  row.before(prev);

  const btLabel = document.createElement('label');
  btLabel.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:6px;display:flex;gap:6px;align-items:center;';
  btLabel.innerHTML = '<input type="checkbox" id="aiBt"> Mode backtest (abaikan harga live, untuk screenshot chart lama)';
  row.before(btLabel);

  function renderPrev() {
    if (!pending) { prev.classList.remove('show'); prev.innerHTML = ''; return; }
    prev.innerHTML = `<img src="${pending.url}"><span>Screenshot siap dikirim bersama pertanyaanmu</span><span class="x" title="Hapus">✕</span>`;
    prev.classList.add('show');
    prev.querySelector('.x').onclick = () => { pending = null; renderPrev(); };
  }

  /* ---------- proses gambar: kecilkan supaya ringan dikirim ---------- */
  function loadImg(f) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(f), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); res(im); };
      im.onerror = () => rej(new Error('Gambar tidak bisa dibaca'));
      im.src = u;
    });
  }
  async function setImage(f) {
    if (!f || !/^image\//.test(f.type)) { showToast('File harus berupa gambar', true); return; }
    try {
      const im = await loadImg(f);
      const MAX = 1400, k = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
      const url = c.toDataURL('image/jpeg', 0.85);
      pending = { mime: 'image/jpeg', b64: url.split(',')[1], url };
      renderPrev();
      input.focus();
    } catch (e) { showToast(e.message, true); }
  }

  attach.onclick = () => { file.value = ''; file.click(); };
  file.onchange = () => setImage(file.files[0]);
  document.addEventListener('paste', e => {
    if (!$('page-xauai').classList.contains('active')) return;
    const it = [...(e.clipboardData && e.clipboardData.items || [])].find(i => i.type.startsWith('image/'));
    if (it) { e.preventDefault(); setImage(it.getAsFile()); }
  });
  const wrap = document.querySelector('#page-xauai .ai-wrap');
  ['dragenter', 'dragover'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.remove('drag'); }));
  wrap.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) setImage(f); });

  // kirim gambar tanpa mengetik apa-apa -> isi pertanyaan standar
  $('aiSend').addEventListener('click', () => {
    if (pending && !input.value.trim()) {
      input.value = $('aiBt').checked
        ? 'Ini screenshot chart XAUUSD (data lama untuk backtest). Beri keputusan Buy/Sell/Wait lengkap entry, SL, TP1, TP2, dan alasannya.'
        : 'Analisa screenshot chart XAUUSD ini: bias, level penting, dan signal (Buy/Sell/Wait) lengkap entry, SL, TP1, TP2.';
    }
  }, true);

  function showThumb(img) {
    const bubbles = document.querySelectorAll('#aiChat .ai-msg.user');
    const last = bubbles[bubbles.length - 1];
    if (last && !last.querySelector('img.shot')) last.insertAdjacentHTML('afterbegin', `<img class="shot" src="${img.url}">`);
  }

  /* ---------- sisipkan gambar ke request AI (Groq / Gemini) ---------- */
  function patchSystem(text, bt, img) {
    let t = String(text || '');
    if (bt) {
      const i = t.indexOf('DATA PASAR LIVE:');
      if (i >= 0) t = t.slice(0, i);
      t += '\n\nMODE BACKTEST: Abaikan waktu, harga, dan berita saat ini. Screenshot adalah kondisi historis. Analisa HANYA dari gambar, dan anggap candle terakhir di gambar adalah candle saat ini. Jangan memakai data live.';
    }
    if (img) t += '\n\nPANDUAN SCREENSHOT: Baca pair, timeframe, tren, level support/resistance, pola candle, dan indikator yang terlihat di gambar. Beri bias, area entry, SL, TP1, TP2, dan kondisi batal. Jika gambar kurang jelas atau bukan XAUUSD, katakan terus terang. Jangan mengarang angka yang tidak terbaca di gambar.';
    return t;
  }

  const _fetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    try {
      const u = String(url);
      const isGroq = u.includes('api.groq.com'), isGem = u.includes('generativelanguage.googleapis.com');
      if ((isGroq || isGem) && opts && typeof opts.body === 'string') {
        const key = opts.body, body = JSON.parse(key);
        const bt = !!($('aiBt') && $('aiBt').checked);
        let img = null;
        if (pending) { img = pending; pending = null; renderPrev(); active = { key, img }; showThumb(img); }
        else if (active && active.key === key) img = active.img; // auto-retry request yang sama
        if (bt || img) {
          if (isGroq) {
            const sys = body.messages && body.messages[0];
            if (sys && sys.role === 'system') sys.content = patchSystem(sys.content, bt, img);
            if (img) {
              const last = body.messages[body.messages.length - 1];
              last.content = [{ type: 'text', text: String(last.content || '') },
                { type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.b64}` } }];
              body.model = GROQ_VISION;
              delete body.reasoning_effort;
            }
          } else {
            if (body.systemInstruction) body.systemInstruction.parts[0].text = patchSystem(body.systemInstruction.parts[0].text, bt, img);
            if (img) {
              const last = body.contents[body.contents.length - 1];
              last.parts.push({ inline_data: { mime_type: img.mime, data: img.b64 } });
            }
            if (bt) delete body.tools;
          }
          opts = Object.assign({}, opts, { body: JSON.stringify(body) });
        }
      }
    } catch (e) { console.warn('[AGS Vision]', e); }
    return _fetch(url, opts);
  };

  /* ---------- tinggi area chat menyesuaikan layar HP: kolom input menempel di bawah, tanpa ruang kosong ---------- */
  function fitAi() {
    const w = document.querySelector('#page-xauai .ai-wrap'), pg = $('page-xauai');
    if (!w || !pg || !pg.classList.contains('active')) return;
    if (!window.matchMedia('(max-width:900px)').matches) { w.style.height = ''; w.style.minHeight = ''; return; }
    const nav = document.querySelector('.sidebar');
    const navH = nav ? nav.getBoundingClientRect().height : 0;
    const top = w.getBoundingClientRect().top + window.scrollY;
    w.style.minHeight = '0';
    w.style.height = Math.max(320, window.innerHeight - top - navH - 10) + 'px';
    const chat = $('aiChat'); if (chat) chat.scrollTop = chat.scrollHeight;
  }
  window.addEventListener('resize', fitAi);
  window.addEventListener('orientationchange', () => setTimeout(fitAi, 300));
  new MutationObserver(() => setTimeout(fitAi, 50)).observe($('page-xauai'), { attributes: true, attributeFilter: ['class'] });
  setTimeout(fitAi, 300);

  window.__agsVision = { setPending: p => { pending = p; renderPrev(); } }; // untuk pengujian
})();
