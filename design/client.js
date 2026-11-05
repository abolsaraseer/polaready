/* The client's page: polaready.com/design/#<private token>.
 * One page, two tabs. Design: it starts as the default booth and the client
 * changes only what they want; every change goes to the booth straight away.
 * "I approve" locks it. Photos: their night's photos (coming in step 2). */
(() => {
  'use strict';
  const C = window.POLAREADY_CLOUD || {}; const P = window.PolaDesign; const G = window.gsap;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = !!G && !reduce;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = P.esc;
  const token = (location.hash.slice(1) || '').replace(/[^A-Za-z0-9]/g, '');
  const app = $('#app');
  const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
  const CHEV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  let ev = null, files = {}, status = 'in_progress', hasBooth = false, tab = 'design', open = null, view = 'booth';
  let d = blank();

  function blank() {
    return {
      booth: { mode: 'default', logo: null, background: null, bg: P.DEFAULT.bg, text: P.DEFAULT.text, accent: P.DEFAULT.accent, font: 'fugaz', welcome_title: '', welcome_sub: '' },
      details: { names: '', date: '', date_text: '', message: '' },
      paper: { mode: 'color', bg: '#F5EFEB', ink: '#233345', photo_count: 4, template: null, windows: [] },
    };
  }
  const locked = () => status === 'approved';

  const call = async (body) => {
    const r = await fetch(`${C.url}/functions/v1/design`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.key }, body: JSON.stringify({ token, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'HTTP ' + r.status), { code: j.error, status: r.status });
    return j;
  };

  /* ---------- saving: every change goes to the booth ---------- */
  let saveT = null, chain = Promise.resolve();
  const savedText = () => (hasBooth ? 'Saved · on the booth ✓' : 'Saved ✓');
  function setSaved(txt, cls = '') { const s = $('#saved'); if (s) { s.textContent = txt; s.className = 'saved mono ' + cls; } }
  function save(now) {
    if (locked()) return Promise.resolve();
    deriveMode();
    clearTimeout(saveT); setSaved('Saving…');
    const go = () => (chain = chain.then(async () => {
      try { await call({ action: 'save', design: d }); setSaved(savedText(), 'ok'); }
      catch (e) {
        if (e.code === 'approved') { status = 'approved'; open = null; panel(false); return; }
        setSaved('Not saved · check your internet', 'bad');
      }
    }));
    if (now) return go();
    saveT = setTimeout(go, 600); return Promise.resolve();
  }
  // There's no "default or my own" question: the booth uses the client's own
  // theme as soon as anything in it differs from the default.
  const deriveMode = () => {
    const b = d.booth;
    b.mode = b.logo || b.background || !isDefault('colours') || b.welcome_title || b.welcome_sub || b.font !== 'fugaz' ? 'custom' : 'default';
  };

  /* ---------- the four rows ---------- */
  const ROWS = [
    ['logo', 'Logo', 'booth'], ['colours', 'Colours', 'booth'],
    ['words', 'Words & date', 'paper'], ['paper', 'Paper', 'paper'],
  ];
  const sw = (c) => `<i class="sw" style="background:${esc(c)}"></i>`;
  function summary(k) {
    const b = d.booth, p = d.paper, x = d.details;
    switch (k) {
      case 'logo': return b.logo ? (b.background ? 'Your logo + background' : 'Your logo') : b.background ? 'Default logo + your background' : 'Default';
      case 'colours': return `<span class="sws">${[b.bg, b.text, b.accent].map(sw).join('')}</span>${isDefault('colours') ? ' Default' : ''}`;
      case 'words': return esc([x.names || 'Add your names', x.date_text || P.dateText(x.date)].filter(Boolean).join(' · '));
      case 'paper': return p.mode === 'template' && p.template && (p.windows || []).length >= 2
        ? `Your design · ${p.windows.length} photos` : `<span class="sws">${sw(p.bg)}</span> Colour · ${p.photo_count} photos`;
    }
  }
  const isDefault = (k) => {
    const b = d.booth, p = d.paper;
    if (k === 'logo') return !b.logo && !b.background;
    if (k === 'colours') return b.bg === P.DEFAULT.bg && b.text === P.DEFAULT.text && b.accent === P.DEFAULT.accent;
    if (k === 'words') return !b.welcome_title && !b.welcome_sub && b.font === 'fugaz' && !d.details.message;
    if (k === 'paper') return p.mode === 'color' && p.bg === '#F5EFEB' && p.ink === '#233345' && p.photo_count === 4;
  };
  function reset(k) {
    const z = blank();
    if (k === 'logo') { d.booth.logo = null; d.booth.background = null; }
    if (k === 'colours') Object.assign(d.booth, { bg: z.booth.bg, text: z.booth.text, accent: z.booth.accent });
    if (k === 'words') { Object.assign(d.booth, { welcome_title: '', welcome_sub: '', font: 'fugaz' }); d.details.message = ''; }
    if (k === 'paper') d.paper = z.paper;
  }

  const note = (t) => `<p class="hint">${t}</p>`;
  const EDIT = {
    logo: () => `<label class="upl" id="ul"><input type="file" accept="image/png,image/jpeg" hidden id="uf">${d.booth.logo && files[d.booth.logo] ? `<img src="${files[d.booth.logo]}" alt="Your logo"><b>Tap to change it</b>` : `<b>Upload your logo</b><small>PNG with a see-through background looks best · up to 15 MB</small>`}</label>
      <label class="upl sm" id="ub"><input type="file" accept="image/png,image/jpeg" hidden id="bf">${d.booth.background && files[d.booth.background] ? `<img src="${files[d.booth.background]}" alt="Background"><small>Background picture · tap to change</small>` : `<b>Optional: a background picture</b><small>A photo or pattern behind the welcome screen</small>`}</label>
      <p class="hint" id="lmsg"></p>`,
    colours: () => `<div class="colors">${[['bg', 'Background'], ['text', 'Writing'], ['accent', 'Buttons']].map(([k, l]) => `<label class="color"><input type="color" data-c="${k}" value="${d.booth[k]}"><b>${l}</b><small data-h="${k}">${d.booth[k].toUpperCase()}</small></label>`).join('')}</div>
      ${note('Pick three. We work out the rest so everything stays easy to read.')}`,
    words: () => `<div class="grp mono soft">On the booth screen</div>
      <label class="field"><span>Welcome title</span><input class="inp" id="wt" maxlength="50" value="${esc(d.booth.welcome_title)}" placeholder="Welcome to ${esc(d.details.names || ev.name)}"></label>
      <label class="field"><span>The line under it</span><input class="inp" id="ws" maxlength="50" value="${esc(d.booth.welcome_sub)}" placeholder="Step up, flash in 3, 2, 1"></label>
      <div class="field"><span>Font</span></div>
      <div class="fonts">${Object.entries(P.FONTS).map(([k, [n, css]]) => `<button class="font ${d.booth.font === k ? 'on' : ''}" data-f="${k}"><b style="font-family:${css}">Aa</b><small>${n}</small></button>`).join('')}</div>
      <div class="grp mono soft" style="margin-top:26px">On the paper</div>
      <label class="field"><span>Names or title</span><input class="inp" id="nm" maxlength="40" value="${esc(d.details.names)}" placeholder="Sara & Omar"></label>
      <label class="field"><span>Date</span><input class="inp" type="date" id="dt" value="${esc(d.details.date)}"></label>
      <label class="field"><span>A short message (optional)</span><input class="inp" id="ms" maxlength="60" value="${esc(d.details.message)}" placeholder="Thank you for celebrating with us"></label>`,
    paper: () => `<div class="seg" id="pm"><button data-pm="color" class="${d.paper.mode === 'color' ? 'on' : ''}">Pick a colour</button><button data-pm="template" class="${d.paper.mode === 'template' ? 'on' : ''}">Upload my design</button></div>
      <div id="pbody">${d.paper.mode === 'template' ? paperUpload() : paperColour()}</div>`,
  };
  const paperColour = () => `<div class="colors two">${[['bg', 'Paper'], ['ink', 'Writing']].map(([k, l]) => `<label class="color"><input type="color" data-p="${k}" value="${d.paper[k]}"><b>${l}</b><small data-ph="${k}">${d.paper[k].toUpperCase()}</small></label>`).join('')}</div>
      <div class="field"><span>Photos on each paper</span></div><div class="seg" id="pc">${[3, 4, 5].map((n) => `<button data-n="${n}" class="${d.paper.photo_count === n ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const paperUpload = () => `<ul class="rules"><li><b>PNG</b>, <b>600 × 1800 px</b> (a 2 × 6 inch strip)</li><li>Leave the photo spaces <b>empty and see-through</b></li><li>2 to 8 photo spaces</li></ul>
      <label class="upl" id="pu"><input type="file" accept="image/png" hidden id="pf">${d.paper.template && files[d.paper.template] ? `<img src="${files[d.paper.template]}" alt="Your paper design"><b>Tap to change it</b>` : `<b>Upload your paper design</b><small>PNG, 600 × 1800 px</small>`}</label>
      <p class="hint" id="pmsg">${d.paper.template ? ((d.paper.windows || []).length >= 2 ? `<span class="ok">✓ We found ${d.paper.windows.length} photo spaces.</span> Each guest takes ${d.paper.windows.length} photos.` : '<span class="bad">We couldn\'t find the empty photo spaces in this design.</span>') : 'Until you upload one, the booth uses the colour paper.'}</p>`;

  /* ---------- page ---------- */
  function render() {
    const when = ev.starts_at ? new Date(ev.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    app.innerHTML = `<section class="hero">
        <div class="hello" data-a>Hello${ev.client_name ? ' ' + esc(ev.client_name) : ''},</div>
        <h1 data-a>${esc(ev.name)}</h1>
        ${when || ev.venue ? `<p class="lead" data-a>${esc([when, ev.venue].filter(Boolean).join(' · '))}</p>` : ''}
      </section>
      <nav class="tabs" data-a><span class="pill"></span><button data-tab="design">Design</button><button data-tab="photos">Photos</button></nav>
      <div id="panel"></div>`;
    $$('[data-tab]').forEach((b) => (b.onclick = () => { if (tab !== b.dataset.tab) { tab = b.dataset.tab; open = null; panel(true); } }));
    panel(false);
    if (anim) {
      app.classList.add('animating');
      G.fromTo($$('[data-a], .rw, .appr, .okcard, .pvcard', app), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.045, ease: 'power3.out', clearProps: 'transform,opacity', onComplete: () => app.classList.remove('animating') });
    }
  }
  function pill() {
    const nav = $('.tabs'), on = $(`[data-tab="${tab}"]`); if (!nav || !on) return;
    $$('[data-tab]').forEach((b) => b.classList.toggle('on', b === on));
    const p = $('.pill', nav); const x = on.offsetLeft, w = on.offsetWidth;
    if (anim && p.dataset.ready) G.to(p, { x, width: w, duration: 0.45, ease: 'power3.out' });
    else { if (G) G.set(p, { x, width: w }); else { p.style.width = w + 'px'; p.style.transform = `translateX(${x}px)`; } p.dataset.ready = 1; }
  }
  function panel(animate) {
    const el = $('#panel');
    el.innerHTML = tab === 'design' ? designHTML() : photosHTML();
    requestAnimationFrame(pill);
    if (tab === 'design') wireDesign();
    if (animate && anim) G.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', clearProps: 'transform,opacity' });
  }

  function designHTML() {
    const L = locked();
    return `<div class="dz">
      <div class="rows">
        <div class="bar2"><span class="soft">${L ? 'Your approved design' : 'It starts with the default look. Change only what you want.'}</span><span class="saved mono" id="saved"></span></div>
        <div class="pvm" id="pvm"></div>
        ${ROWS.map(([k, t], i) => `<section class="rw ${L ? 'ro' : ''}" data-row="${k}">
          <button class="rh" ${L ? 'disabled' : ''} aria-expanded="false"><span class="n">${i + 1}</span><span class="tx"><b>${t}</b><small data-sum="${k}">${summary(k)}</small></span>${L ? '' : `<span class="ch">Change ${CHEV}</span>`}</button>
          <div class="rb" hidden></div></section>`).join('')}
        ${L ? `<div class="okcard"><span class="okic">${CHECK}</span><div><b>Approved and locked</b><span>This is what your booth uses on the night. To change anything now, message PolaReady.</span></div></div>`
          : `<div class="appr"><div><b>Happy with it?</b><span>Approving locks your design so nothing changes by accident on the night.</span></div><button class="btn gold" id="approve">I approve, lock my design</button></div>
          <p class="hint" style="text-align:center"><button class="lnk" id="resetall">Put everything back to default</button></p>`}
      </div>
      <aside class="pvs"><div class="pvcard"><div class="seg" id="pvt"><button data-v="booth">Booth</button><button data-v="paper">Paper</button></div><div id="pv"></div>
        <p class="hint" style="text-align:center">${L ? 'Locked for your night.' : hasBooth ? 'Every change goes to your booth within seconds.' : 'PolaReady connects a booth to your event before the night.'}</p></div></aside>
    </div>`;
  }

  function photosHTML() {
    const day = ev.starts_at ? new Date(ev.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : 'the night';
    return `<div class="empty"><div class="bearbig"></div><h2>Your photos will be here</h2>
      <p class="lead">From ${esc(day)}, every photo your guests take shows up here, newest first. Afterwards you can download them all.</p></div>`;
  }

  /* ---------- preview ---------- */
  function preview(v, pop) {
    if (v) view = v;
    const html = view === 'paper' ? P.paperHTML(d, files) : P.boothHTML(d, files);
    const big = $('#pv'), small = $('#pvm');
    if (big) big.innerHTML = html;
    if (small) small.innerHTML = `<div class="seg" id="pvt2"><button data-v="booth">Booth</button><button data-v="paper">Paper</button></div><div class="pvin">${html}</div>`;
    $$('#pvt button, #pvt2 button').forEach((b) => { b.classList.toggle('on', b.dataset.v === view); b.onclick = () => preview(b.dataset.v, true); });
    if (pop && anim) $$('#pv > *, #pvm .pvin > *').forEach((n) => G.fromTo(n, { scale: 0.97, opacity: 0.6 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)', clearProps: 'transform,opacity' }));
  }
  function heads() {
    deriveMode();
    ROWS.forEach(([k]) => { const s = $(`[data-sum="${k}"]`); if (s) s.innerHTML = summary(k); });
    $$('.rw').forEach((r) => { const rs = $('.rs', r); if (rs) rs.hidden = isDefault(r.dataset.row); });
  }
  const changed = (pv) => { heads(); preview(pv); save(); };

  /* ---------- rows open in place ---------- */
  const bodyHTML = (k) => EDIT[k]() + `<p class="rs" ${isDefault(k) ? 'hidden' : ''}><button class="lnk" data-reset="${k}">Back to default</button></p>`;
  function toggle(k) {
    const was = open; open = open === k ? null : k;
    $$('.rw').forEach((r) => {
      const body = $('.rb', r), on = r.dataset.row === open, h = $('.rh', r);
      if (on && body.hidden) {
        body.innerHTML = bodyHTML(k);
        body.hidden = false; r.classList.add('open'); h.setAttribute('aria-expanded', 'true');
        WIRE[k](body); wireReset(body, k);
        if (anim) { r.classList.add('animating'); G.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'height,opacity', onComplete: () => r.classList.remove('animating') }); }
      } else if (!on && !body.hidden) {
        r.classList.remove('open'); h.setAttribute('aria-expanded', 'false');
        const done = () => { body.hidden = true; body.innerHTML = ''; };
        if (anim) G.to(body, { height: 0, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { done(); G.set(body, { clearProps: 'height,opacity' }); } }); else done();
      }
    });
    const row = ROWS.find((r) => r[0] === open);
    if (row) preview(row[2], true);
    if (open && was !== open) setTimeout(() => { const r = $(`[data-row="${open}"]`); if (r && r.getBoundingClientRect().top < 0) r.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }, anim ? 480 : 0);
  }
  function refill(k) {
    const body = $(`[data-row="${k}"] .rb`); if (!body || body.hidden) return;
    body.innerHTML = bodyHTML(k); WIRE[k](body); wireReset(body, k);
  }
  function wireReset(body, k) {
    $('[data-reset]', body).onclick = () => { reset(k); refill(k); changed(); preview(null, true); };
  }

  function wireDesign() {
    preview(view);
    heads();
    setSaved(locked() ? '' : savedText(), 'ok');
    if (locked()) return;
    $$('.rh').forEach((h) => (h.onclick = () => toggle(h.closest('.rw').dataset.row)));
    $('#approve').onclick = approveDialog;
    $('#resetall').onclick = () => {
      dialog('Back to default?', 'Your logo, colours, words and paper go back to the default look. Your names and date stay.', 'Put it back', () => {
        const keep = d.details; d = blank(); d.details = { ...keep, message: '' }; open = null; panel(false); preview(null, true); return save(true);
      });
    };
  }

  /* ---------- uploads ---------- */
  const upload = async (file, kind, lbl, msgEl) => {
    if (!file) return null;
    if (file.size > 15 * 1024 * 1024) { msg(msgEl, 'That file is over 15 MB.'); return null; }
    const ext = /png$/i.test(file.type) ? 'png' : 'jpg';
    const old = lbl.innerHTML;
    lbl.querySelector('b, img')?.insertAdjacentHTML('beforebegin', '<span class="spin"></span>');
    try {
      const { name, url } = await call({ action: 'upload', kind, ext });
      const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/' + ext, 'x-upsert': 'true' }, body: file });
      if (!r.ok) throw new Error('Upload failed');
      files[name] = URL.createObjectURL(file);
      return name;
    } catch (e) { lbl.innerHTML = old; msg(msgEl, e.code === 'approved' ? 'Your design is locked.' : 'The upload didn\'t work. Check your internet and try again.'); return null; }
  };
  const msg = (el, m) => { if (el) el.innerHTML = `<span class="bad">${esc(m)}</span>`; };
  const dropify = (lbl, cb) => {
    ['dragenter', 'dragover'].forEach((k) => lbl.addEventListener(k, (e) => { e.preventDefault(); lbl.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((k) => lbl.addEventListener(k, (e) => { e.preventDefault(); lbl.classList.remove('over'); }));
    lbl.addEventListener('drop', (e) => cb(e.dataTransfer.files[0]));
  };
  const segPick = (wrap, sel, cb) => $$(sel, wrap).forEach((b) => (b.onclick = () => { $$(sel, wrap).forEach((x) => x.classList.toggle('on', x === b)); cb(b); }));

  const WIRE = {
    logo: (r) => {
      const handle = (kind, key, input) => async (f) => {
        const name = await upload(f, kind, input.closest('.upl'), $('#lmsg', r));
        if (name) { d.booth[key] = name; refill('logo'); heads(); preview('booth', true); save(true); }
      };
      $('#uf', r).onchange = (e) => handle('logo', 'logo', e.target)(e.target.files[0]);
      $('#bf', r).onchange = (e) => handle('background', 'background', e.target)(e.target.files[0]);
      dropify($('#ul', r), handle('logo', 'logo', $('#uf', r))); dropify($('#ub', r), handle('background', 'background', $('#bf', r)));
    },
    colours: (r) => $$('[data-c]', r).forEach((i) => (i.oninput = () => {
      d.booth[i.dataset.c] = i.value.toUpperCase(); $(`[data-h="${i.dataset.c}"]`, r).textContent = i.value.toUpperCase();
      changed('booth');
    })),
    words: (r) => {
      $('#wt', r).oninput = (e) => { d.booth.welcome_title = e.target.value; changed('booth'); };
      $('#ws', r).oninput = (e) => { d.booth.welcome_sub = e.target.value; changed('booth'); };
      segPick(r, '[data-f]', (b) => { d.booth.font = b.dataset.f; changed('booth'); preview(null, true); });
      $('#nm', r).oninput = (e) => { d.details.names = e.target.value; changed('paper'); };
      $('#dt', r).oninput = (e) => { d.details.date = e.target.value; d.details.date_text = P.dateText(e.target.value); changed('paper'); };
      $('#ms', r).oninput = (e) => { d.details.message = e.target.value; changed('paper'); };
    },
    paper: (r) => {
      segPick(r, '[data-pm]', (b) => { d.paper.mode = b.dataset.pm; $('#pbody', r).innerHTML = d.paper.mode === 'template' ? paperUpload() : paperColour(); wirePaper(r); changed('paper'); preview(null, true); });
      wirePaper(r);
    },
  };
  function wirePaper(r) {
    $$('[data-p]', r).forEach((i) => (i.oninput = () => { d.paper[i.dataset.p] = i.value.toUpperCase(); $(`[data-ph="${i.dataset.p}"]`, r).textContent = i.value.toUpperCase(); changed('paper'); }));
    if ($('#pc', r)) segPick(r, '#pc button', (b) => {
      d.paper.photo_count = +b.dataset.n; changed('paper');
      if (anim) G.from($$('.pv-paper .shots i'), { scaleY: 0, transformOrigin: 'top', duration: 0.4, stagger: 0.05, ease: 'power3.out', clearProps: 'transform' });
    });
    const pf = $('#pf', r); if (!pf) return;
    const handle = async (f) => {
      if (!f) return;
      const pm = $('#pmsg', r);
      if (f.type !== 'image/png') return msg(pm, 'Please upload a PNG: it needs see-through photo spaces.');
      const local = URL.createObjectURL(f);
      const found = await P.detectWindows(local).catch(() => null);
      if (!found) return msg(pm, 'We couldn\'t read that file.');
      if (Math.abs(found.ratio - 1 / 3) > 0.02) return msg(pm, `This design is ${found.width} × ${found.height} px. It needs to be 600 × 1800 px (a 2 × 6 inch strip).`);
      if (found.windows.length < 2) return msg(pm, 'We couldn\'t find empty photo spaces. Leave 2 to 8 see-through areas where the photos go.');
      const name = await upload(f, 'paper', pf.closest('.upl'), pm); if (!name) return;
      files[name] = local; d.paper.template = name; d.paper.windows = found.windows;
      $('#pbody', r).innerHTML = paperUpload(); wirePaper(r); heads(); preview('paper'); save(true);
      if (anim) G.from($$('.pv-paper.tpl i'), { scale: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(2)', clearProps: 'transform' });
    };
    pf.onchange = (e) => handle(e.target.files[0]); dropify($('#pu', r), handle);
  }

  /* ---------- dialogs & approve ---------- */
  function dialog(title, text, yes, onYes, gold) {
    const m = document.createElement('div'); m.className = 'scrim';
    m.innerHTML = `<div class="dlg" role="dialog" aria-modal="true"><h2>${title}</h2><p class="lead">${text}</p><div class="acts"><button class="btn ghost" data-no>Not yet</button><button class="btn ${gold ? 'gold' : ''}" data-yes>${yes}</button></div></div>`;
    document.body.appendChild(m);
    const gone = () => { if (m.parentNode) m.parentNode.removeChild(m); };
    const close = () => { if (anim) G.to(m, { opacity: 0, duration: 0.2, onComplete: gone }); else gone(); };
    $('[data-no]', m).onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
    $('[data-yes]', m).onclick = async (e) => { e.currentTarget.disabled = true; await onYes(); close(); };
    if (anim) { G.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.25 }); G.fromTo($('.dlg', m), { y: 24, scale: 0.97 }, { y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.8)', clearProps: 'transform' }); }
  }
  function approveDialog() {
    dialog('Approve your design?', 'Your booth stays exactly like this for the night. After this, only PolaReady can open it for changes.', 'I approve', async () => {
      try {
        clearTimeout(saveT); await save(true); await chain; await call({ action: 'approve' }); status = 'approved'; open = null; panel(false);
        if (anim) G.fromTo('.okcard', { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2)', clearProps: 'transform,opacity' });
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      } catch (e) { setSaved('Not approved · check your internet', 'bad'); }
    }, true);
  }

  /* ---------- start ---------- */
  const stateHTML = (h, p) => `<div class="empty"><div class="bearbig"></div><h2>${h}</h2><p class="lead">${p}</p></div>`;
  async function boot() {
    app.innerHTML = `<div class="empty"><div class="bearbig"></div></div>`;
    if (token.length < 24) { app.innerHTML = stateHTML('This link isn\'t complete', 'Open the full link from your PolaReady message.'); return; }
    try {
      const r = await call({ action: 'get' });
      ev = r.event; files = r.files || {}; status = r.status; hasBooth = !!r.booth;
      const s = r.design || {}, z = blank();
      d = { booth: { ...z.booth, ...(s.booth || {}) }, details: { ...z.details, ...(s.details || {}) }, paper: { ...z.paper, ...(s.paper || {}) } };
      // A saved design that used the default look only kept leftover values
      // (the booth never used them), so start those from the default again.
      if (d.booth.mode !== 'custom') d.booth = z.booth;
      d.paper.mode = d.paper.mode === 'template' ? 'template' : 'color';
      d.paper.windows = d.paper.windows || [];
      if (!d.details.date && ev.starts_at) { d.details.date = ev.starts_at.slice(0, 10); d.details.date_text = P.dateText(d.details.date); }
      // On the day of the event and after, the page opens on the photos.
      const day = ev.starts_at ? new Date(ev.starts_at) : null;
      if (day) day.setHours(0, 0, 0, 0);
      tab = day && Date.now() >= day.getTime() ? 'photos' : 'design';
      render();
    } catch (e) {
      app.innerHTML = e.status === 404 ? stateHTML('We can\'t find this page', 'The link may have changed. Ask PolaReady for a new one.') : stateHTML('No connection', 'Check your internet and refresh the page.');
    }
  }
  window.addEventListener('resize', () => requestAnimationFrame(pill));
  boot();
})();
