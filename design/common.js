/* Shared by the client's design journey and the owner's dashboard, so both
 * show the same previews and turn a design into the same system file. */
(function (root) {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Headline fonts every iPad has. key -> [friendly name, browser preview stack, matching text font]
  const FONTS = {
    fugaz: ['PolaReady', "'Fugaz One',sans-serif", 'nunito'],
    didot: ['Elegant', "Didot,'Bodoni 72','Bodoni Moda',serif", 'avenir'],
    baskerville: ['Classic', "Baskerville,'Libre Baskerville',Georgia,serif", 'avenir'],
    snell: ['Script', "'Snell Roundhand','Segoe Script','Brush Script MT',cursive", 'avenir'],
    futura: ['Modern', "Futura,'Century Gothic','Trebuchet MS',sans-serif", 'avenir'],
    noteworthy: ['Handwritten', "Noteworthy,'Comic Sans MS',cursive", 'avenir'],
  };
  const BODY = { nunito: "'Nunito Sans',sans-serif", avenir: "'Avenir Next',Avenir,'Segoe UI',sans-serif" };
  const DEFAULT = { bg: '#F5EFEB', text: '#2F4156', accent: '#3F7A9C' };

  // ---- colour helpers: three colours in, a whole theme out ----
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
  const lum = (h) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  /** The full booth theme from the client's three colours. */
  function themeFrom(b) {
    const bg = b.bg || DEFAULT.bg, text = b.text || DEFAULT.text, accent = b.accent || DEFAULT.accent;
    const dark = lum(bg) < 0.4;
    const onAccent = [bg, '#FFFFFF', '#111111'].sort((x, y) => contrast(y, accent) - contrast(x, accent))[0];
    const f = FONTS[b.font] ? b.font : 'fugaz';
    return {
      bg, bg2: bg, card: dark ? mix(bg, '#FFFFFF', 0.08) : mix(bg, '#FFFFFF', 0.7),
      text, muted: mix(text, bg, 0.35), line: mix(text, bg, 0.8), accent, on_accent: onAccent,
      font_display: f, font_body: FONTS[f][2],
      welcome_title: b.welcome_title || '', welcome_sub: b.welcome_sub || '',
      welcome_bg: b.background || null, logo: b.logo || null,
    };
  }

  /** The approved draft -> the booth's system file fields. */
  function compile(design, base) {
    const d = design || {}, b = d.booth || {}, p = d.paper || {}, x = d.details || {};
    const c = { ...(base || {}) };
    c.title = x.names || c.title || '';
    c.date_text = x.date_text || c.date_text || '';
    c.message = x.message ?? c.message ?? '';
    c.theme = b.mode === 'custom' ? themeFrom(b) : null;
    if (p.mode === 'template' && p.template && (p.windows || []).length) {
      c.paper_template = p.template;
      c.paper_windows = p.windows;
      c.photo_count = p.windows.length;
      c.lock_count = true;
    } else {
      c.paper_template = null; c.paper_windows = null;
      c.paper = { bg: p.bg || '#F5EFEB', ink: p.ink || '#233345' };
      c.photo_count = p.photo_count || 4;
      c.lock_count = true;
      c.lock_paper = true;
    }
    c.overlay = null;
    return c;
  }

  const dateText = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d} · ${m} · ${y}`; };

  /** Find the transparent photo windows in an uploaded paper design. */
  async function detectWindows(url) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const ratio = img.naturalWidth / img.naturalHeight;
    const W = 160, H = Math.round(W / ratio);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
    const a = g.getImageData(0, 0, W, H).data;
    const clear = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) clear[i] = a[i * 4 + 3] < 40 ? 1 : 0;
    const seen = new Uint8Array(W * H); const boxes = [];
    for (let s = 0; s < W * H; s++) {
      if (!clear[s] || seen[s]) continue;
      let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0; const stack = [s]; seen[s] = 1;
      while (stack.length) {
        const k = stack.pop(); const x = k % W, y = (k / W) | 0; n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const q of [k - 1, k + 1, k - W, k + W]) {
          if (q < 0 || q >= W * H || seen[q] || !clear[q]) continue;
          if ((q === k - 1 && x === 0) || (q === k + 1 && x === W - 1)) continue;
          seen[q] = 1; stack.push(q);
        }
      }
      if (n > W * H * 0.01) boxes.push([x0 / W, y0 / H, (x1 - x0 + 1) / W, (y1 - y0 + 1) / H].map((v) => Math.round(v * 10000) / 10000));
    }
    boxes.sort((p, q) => (Math.abs(p[1] - q[1]) > 0.03 ? p[1] - q[1] : p[0] - q[0]));
    return { windows: boxes.slice(0, 8), width: img.naturalWidth, height: img.naturalHeight, ratio };
  }

  const SAMPLE = ['#8FC2DF', '#3F7A9C', '#B8D8EA', '#5E93B3', '#A9CDE2', '#4D86A8', '#C4E0EF', '#2F6A8C'];
  /** Paper preview: either the colour paper or the uploaded design with sample photos in its windows. */
  function paperHTML(design, files) {
    const p = (design || {}).paper || {}, x = (design || {}).details || {};
    if (p.mode === 'template' && p.template && files?.[p.template]) {
      return `<div class="pv-paper tpl">${(p.windows || []).map((w, i) => `<i style="left:${w[0] * 100}%;top:${w[1] * 100}%;width:${w[2] * 100}%;height:${w[3] * 100}%;background:${SAMPLE[i % 8]}"></i>`).join('')}<img src="${files[p.template]}" alt=""></div>`;
    }
    const n = p.photo_count || 4; const bo = (design || {}).booth || {};
    const D = FONTS[bo.mode === 'custom' && FONTS[bo.font] ? bo.font : 'fugaz'][1];
    return `<div class="pv-paper" style="background:${p.bg || '#F5EFEB'};color:${p.ink || '#233345'};--pd:${D}"><div class="shots">${Array.from({ length: n }, (_, i) => `<i style="background:${SAMPLE[i]}"></i>`).join('')}</div>
      <div class="ft">${x.message ? `<em>${esc(x.message)}</em>` : ''}<b>${esc(x.names || 'Your names')}</b><small>${esc(x.date_text || dateText(x.date) || 'Your date')}</small></div></div>`;
  }

  /** Booth preview: the iPad welcome screen plus a strip of the booth's buttons. */
  function boothHTML(design, files) {
    const b = (design || {}).booth || {};
    const th = b.mode === 'custom' ? themeFrom(b) : { ...themeFrom(DEFAULT), font_display: 'fugaz' };
    const D = FONTS[th.font_display][1], B = BODY[th.font_body] || BODY.nunito;
    const custom = b.mode === 'custom' && (b.logo || b.welcome_title);
    const bgImg = b.mode === 'custom' && b.background && files?.[b.background];
    return `<div class="pv-ipad"><div class="pv-scr" style="background:${th.bg};color:${th.text}">
      ${bgImg ? `<img class="wbg" src="${bgImg}" alt=""><span class="veil" style="background:${th.bg}"></span>` : `<span class="glow" style="background:radial-gradient(closest-side,${th.accent}30,transparent)"></span>`}
      <div class="wc">${b.mode === 'custom' && b.logo && files?.[b.logo] ? `<img class="logo" src="${files[b.logo]}" alt="">` : `<i class="bear" style="background:${th.text}"></i>`}
      <b style="font-family:${D}">${esc(custom ? (b.welcome_title || '') : 'PolaReady')}</b>${custom ? '' : `<small class="tag" style="font-family:${B}">MADE FOR THE WHITEOUT</small>`}
      <i class="rl" style="background:${th.text}"></i><small style="font-family:${B};color:${th.muted}">${esc((b.mode === 'custom' && b.welcome_sub) || 'STEP UP — FLASH IN 3, 2, 1')}</small></div></div></div>
      <div class="pv-ui" style="background:${th.bg};color:${th.text}"><div class="c" style="background:${th.card};box-shadow:inset 0 0 0 1px ${th.line}"><b style="font-family:${B}">Choose a filter</b><small style="color:${th.muted};font-family:${B}">10 looks</small></div>
      <span class="btn1" style="background:${th.accent};color:${th.on_accent};font-family:${B}">Print</span><b class="cd" style="font-family:${D};color:${th.accent}">3</b></div>`;
  }

  root.PolaDesign = { FONTS, BODY, DEFAULT, themeFrom, compile, detectWindows, paperHTML, boothHTML, dateText, esc };
})(window);
