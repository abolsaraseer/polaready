/* The client's design journey: polaready.com/design/#<private token>.
 * They choose everything themselves, step by step; each step saves a draft.
 * Nothing reaches the booth until PolaReady approves it. */
(() => {
  'use strict';
  const C = window.POLAREADY_CLOUD || {}; const P = window.PolaDesign; const G = window.gsap;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = P.esc;
  const token = (location.hash.slice(1) || '').replace(/[^A-Za-z0-9]/g, '');
  const box = $('#step'), nav = $('#nav'), side = $('#side'), prev = $('#prev'), wrap = $('.wrap');
  const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';

  let ev = null, files = {}, status = 'in_progress', at = 0;
  let d = { step: 0, booth: { mode: null }, details: {}, paper: { mode: null, photo_count: 4, bg: '#F5EFEB', ink: '#233345' } };

  const call = async (body) => {
    const r = await fetch(`${C.url}/functions/v1/design`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.key }, body: JSON.stringify({ token, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'HTTP ' + r.status), { code: j.error, status: r.status });
    return j;
  };

  /* ---------- the journey ---------- */
  const STEPS = {
    welcome: { title: 'Welcome', side: false },
    look: { title: 'Booth style', side: 'booth' },
    logo: { title: 'Your logo', side: 'booth', custom: true },
    colours: { title: 'Colours', side: 'booth', custom: true },
    words: { title: 'Words & font', side: 'booth', custom: true },
    details: { title: 'Your details', side: 'paper' },
    paper: { title: 'The paper', side: 'paper' },
    papercolour: { title: 'Paper colour', side: 'paper' },
    paperupload: { title: 'Your paper design', side: 'paper' },
    review: { title: 'Review', side: 'both' },
  };
  const flow = () => {
    const f = ['welcome', 'look'];
    if (d.booth.mode === 'custom') f.push('logo', 'colours', 'words');
    f.push('details', 'paper');
    f.push(d.paper.mode === 'template' ? 'paperupload' : 'papercolour');
    f.push('review');
    return f;
  };

  let saveT = null;
  const save = (now) => {
    clearTimeout(saveT);
    const go = async () => {
      $('#saved').textContent = 'Saving…';
      try { await call({ action: 'save', design: { ...d, step: at } }); $('#saved').textContent = 'Saved ✓'; }
      catch (e) { $('#saved').textContent = e.code === 'approved' ? 'Already approved' : 'Not saved: check your internet'; }
    };
    if (now) return go(); saveT = setTimeout(go, 700);
  };

  function preview(kind) {
    const k = kind === 'both' ? 'booth' : kind;
    if (!k) { side.hidden = true; wrap.classList.remove('two'); return; }
    side.hidden = false; wrap.classList.add('two');
    $('#sidelbl').textContent = kind === 'both' ? 'Your booth & paper' : k === 'booth' ? 'Your booth' : 'Your paper';
    prev.innerHTML = kind === 'both' ? P.boothHTML(d, files) + `<div style="height:16px"></div>` + P.paperHTML(d, files) : k === 'booth' ? P.boothHTML(d, files) : P.paperHTML(d, files);
    const m = $('.mprev', box); if (m) m.innerHTML = prev.innerHTML;
  }
  const refresh = () => preview(STEPS[flow()[at]].side);
  const pop = () => { if (G && !reduce) G.fromTo(prev.firstElementChild, { scale: 0.97 }, { scale: 1, duration: 0.5, ease: 'back.out(2.2)' }); };

  function render(dir = 1) {
    const f = flow(); at = Math.max(0, Math.min(at, f.length - 1));
    const key = f[at];
    $('#count').textContent = key === 'welcome' ? '' : `Step ${at} of ${f.length - 1}`;
    $('#prog').style.width = `${(at / (f.length - 1)) * 100}%`;
    nav.hidden = key === 'welcome';
    $('#back').hidden = at === 0;
    const next = $('#next');
    next.textContent = key === 'review' ? 'Send to PolaReady' : 'Next';
    next.className = key === 'review' ? 'btn gold' : 'btn';
    box.innerHTML = VIEWS[key]();
    refresh();
    (WIRE[key] || (() => {}))();
    validate();
    if (G && !reduce) {
      G.fromTo(box, { x: 30 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
      G.from($$('[data-a]', box), { y: 16, opacity: 0, duration: 0.55, stagger: 0.05, ease: 'power3.out', delay: 0.05 });
    }
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  // Can the client move on from this step?
  function validate() {
    const key = flow()[at]; let ok = true;
    if (key === 'look') ok = !!d.booth.mode;
    if (key === 'paper') ok = !!d.paper.mode;
    if (key === 'details') ok = !!(d.details.names || '').trim();
    if (key === 'paperupload') ok = !!(d.paper.template && (d.paper.windows || []).length);
    $('#next').disabled = !ok;
  }

  const choice = (k, v, cur, art, title, text) => `<button class="choice ${cur === v ? 'on' : ''}" data-${k}="${v}" data-a><span class="tick">${CHECK}</span><div class="art">${art}</div><b>${title}</b><span>${text}</span></button>`;
  const mprev = () => `<div class="mprev"></div>`;

  const VIEWS = {
    welcome: () => `<div style="max-width:640px">
        <div class="hello" data-a>Hello${ev.client_name ? ' ' + esc(ev.client_name) : ''},</div>
        <h1 data-a>Let's design your booth for <span class="serif">${esc(ev.name)}</span>.</h1>
        <p class="lead" data-a>${ev.starts_at ? new Date(ev.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (ev.venue ? ' · ' + esc(ev.venue) : '') + '. ' : ''}In a few short steps you'll choose how the booth looks and what your guests take home. You can come back to this link any time; everything saves as you go.</p>
        <button class="btn big" id="start" data-a>Let's begin →</button></div>`,
    look: () => `<div class="eyebrow mono" data-a>The booth</div><h1 data-a>How should the booth look?</h1>
      <p class="lead" data-a>This is the screen your guests see and tap all night.</p>
      <div class="choices">${choice('mode', 'default', d.booth.mode, `<div style="transform:scale(.55);width:180%">${P.boothHTML({ booth: { mode: 'default' } }, {})}</div>`, 'PolaReady classic', 'Our signature look: clean, warm and ready. Nothing to decide.')}
      ${choice('mode', 'custom', d.booth.mode, `<div style="display:flex;gap:6px">${['#111111', '#C9A66B', '#F3EBDD', '#4A0F1C', '#E3C08D'].map((c) => `<i style="width:28px;height:70px;border-radius:8px;background:${c}"></i>`).join('')}</div>`, 'Make it ours', 'Your logo, your colours, your words. The whole booth dressed for your night.')}</div>`,
    logo: () => `<div class="eyebrow mono" data-a>Make it ours · 1</div><h1 data-a>Your logo</h1>
      <p class="lead" data-a>It sits in the middle of the welcome screen. A PNG with a transparent background looks best.</p>
      <label class="upl" id="ul" data-a><input type="file" accept="image/png,image/jpeg" hidden id="uf">${d.booth.logo && files[d.booth.logo] ? `<img src="${files[d.booth.logo]}" alt="Your logo"><b>Looks great</b><small>Tap to change it</small>` : `<b>Upload your logo</b><small>PNG or JPG, up to 15 MB</small>`}</label>
      <label class="upl" id="ub" data-a style="min-height:120px"><input type="file" accept="image/png,image/jpeg" hidden id="bf">${d.booth.background && files[d.booth.background] ? `<img src="${files[d.booth.background]}" alt="Background"><small>Background picture · tap to change</small>` : `<b>Optional: a background picture</b><small>A photo or pattern behind the welcome screen</small>`}</label>
      <p class="hint" data-a>${d.booth.logo || d.booth.background ? '<button class="soft" id="clr" style="text-decoration:underline">Remove my pictures</button>' : 'No logo? Skip this step and we\'ll show the PolaReady bear.'}</p>${mprev()}`,
    colours: () => `<div class="eyebrow mono" data-a>Make it ours · 2</div><h1 data-a>Your colours</h1>
      <p class="lead" data-a>Pick three. We'll work out the rest so everything stays easy to read.</p>
      <div class="colors">${[['bg', 'Background'], ['text', 'Writing'], ['accent', 'Buttons']].map(([k, l]) => `<label class="color" data-a><input type="color" data-c="${k}" value="${d.booth[k] || P.DEFAULT[k]}"><b>${l}</b><small data-h="${k}">${(d.booth[k] || P.DEFAULT[k]).toUpperCase()}</small></label>`).join('')}</div>${mprev()}`,
    words: () => `<div class="eyebrow mono" data-a>Make it ours · 3</div><h1 data-a>Your words</h1>
      <label class="field" data-a><span>Welcome title</span><input class="inp" id="wt" maxlength="50" value="${esc(d.booth.welcome_title || '')}" placeholder="Welcome to ${esc(d.details.names || ev.name)}"></label>
      <label class="field" data-a><span>The line under it</span><input class="inp" id="ws" maxlength="50" value="${esc(d.booth.welcome_sub || '')}" placeholder="Step up, flash in 3, 2, 1"></label>
      <div class="field" data-a><span>Font</span></div>
      <div class="fonts" data-a>${Object.entries(P.FONTS).map(([k, [n, css]]) => `<button class="font ${(d.booth.font || 'fugaz') === k ? 'on' : ''}" data-f="${k}"><b style="font-family:${css}">Aa</b><small>${n}</small></button>`).join('')}</div>${mprev()}`,
    details: () => `<div class="eyebrow mono" data-a>On the paper</div><h1 data-a>Your details</h1>
      <p class="lead" data-a>These are printed on every guest's paper.</p>
      <label class="field" data-a><span>Names or title</span><input class="inp" id="nm" maxlength="40" value="${esc(d.details.names || '')}" placeholder="Sara & Omar"></label>
      <label class="field" data-a><span>Date</span><input class="inp" type="date" id="dt" value="${esc(d.details.date || (ev.starts_at ? ev.starts_at.slice(0, 10) : ''))}"></label>
      <label class="field" data-a><span>A short message (optional)</span><input class="inp" id="ms" maxlength="60" value="${esc(d.details.message ?? '')}" placeholder="Thank you for celebrating with us"></label>${mprev()}`,
    paper: () => `<div class="eyebrow mono" data-a>The paper</div><h1 data-a>What do your guests take home?</h1>
      <div class="choices">${choice('paper', 'color', d.paper.mode, `<div style="display:flex;gap:10px">${['#F3E6CF', '#233345', '#FFCCE0'].map((c) => `<div style="width:34px;height:100px;background:${c};box-shadow:0 6px 14px rgba(0,0,0,.15);padding:4px;display:flex;flex-direction:column;gap:3px">${'<i style="flex:1;background:#8FC2DF;display:block"></i>'.repeat(3)}</div>`).join('')}</div>`, 'Pick a colour', 'Our paper in your colours with your names and date. Choose 3, 4 or 5 photos.')}
      ${choice('paper', 'template', d.paper.mode, `<div style="font-family:'Instrument Serif';font-style:italic;font-size:30px">Your design</div>`, 'Upload our design', 'Have a designer? Upload your own paper and the photos drop into its windows.')}</div>`,
    papercolour: () => `<div class="eyebrow mono" data-a>The paper</div><h1 data-a>Your paper</h1>
      <div class="colors" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[['bg', 'Paper'], ['ink', 'Writing']].map(([k, l]) => `<label class="color" data-a><input type="color" data-p="${k}" value="${d.paper[k]}"><b>${l}</b><small data-ph="${k}">${d.paper[k].toUpperCase()}</small></label>`).join('')}</div>
      <div class="field" data-a><span>Photos on each paper</span></div><div class="seg" data-a id="pc">${[3, 4, 5].map((n) => `<button data-n="${n}" class="${d.paper.photo_count === n ? 'on' : ''}">${n}</button>`).join('')}</div>${mprev()}`,
    paperupload: () => `<div class="eyebrow mono" data-a>The paper</div><h1 data-a>Your paper design</h1>
      <ul class="rules" data-a><li><b>PNG</b>, exactly <b>600 × 1800 px</b> (a 2 × 6 inch strip)</li><li>Leave the photo spaces <b>empty and transparent</b>: the photos go there</li><li>2 to 8 photo spaces, as big as you like</li></ul>
      <label class="upl" id="pu" data-a><input type="file" accept="image/png" hidden id="pf">${d.paper.template && files[d.paper.template] ? `<img src="${files[d.paper.template]}" alt="Your paper design"><b>Tap to change it</b>` : `<b>Upload your paper design</b><small>PNG, 600 × 1800 px</small>`}</label>
      <p class="hint" id="pmsg" data-a>${d.paper.template ? ((d.paper.windows || []).length ? `<span class="ok">✓ We found ${d.paper.windows.length} photo spaces.</span> Each guest will take ${d.paper.windows.length} photos.` : '<span class="bad">We couldn\'t find any empty photo spaces in this design.</span>') : ''}</p>${mprev()}`,
    review: () => {
      const b = d.booth, p = d.paper, x = d.details;
      const row = (l, v, step) => `<div data-a><span>${l}</span><b>${v} <button data-go="${step}">Change</button></b></div>`;
      return `<div class="eyebrow mono" data-a>Almost done</div><h1 data-a>Here's your night.</h1>
      <p class="lead" data-a>Check everything, then send it to us. We'll prepare the booth and confirm with you.</p>
      <div class="sum">${row('Booth', b.mode === 'custom' ? 'Your own style' : 'PolaReady classic', 'look')}
      ${b.mode === 'custom' ? row('Logo', b.logo ? 'Uploaded' : 'PolaReady bear', 'logo') + row('Font', P.FONTS[b.font || 'fugaz'][0], 'words') : ''}
      ${row('Names', esc(x.names || ''), 'details')}${row('Date', esc(x.date_text || P.dateText(x.date) || '—'), 'details')}
      ${row('Paper', p.mode === 'template' ? `Your design · ${(p.windows || []).length} photos` : `Colour · ${p.photo_count} photos`, 'paper')}</div>${mprev()}`;
    },
  };

  const upload = async (file, kind, inputEl) => {
    if (!file) return null;
    if (file.size > 15 * 1024 * 1024) { alertBox('That file is over 15 MB.'); return null; }
    const ext = /png$/i.test(file.type) ? 'png' : 'jpg';
    const lbl = inputEl.closest('.upl'); const old = lbl.innerHTML;
    lbl.querySelector('b, img')?.insertAdjacentHTML('beforebegin', '<span class="spin"></span>');
    try {
      const { name, url } = await call({ action: 'upload', kind, ext });
      const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/' + ext, 'x-upsert': 'true' }, body: file });
      if (!r.ok) throw new Error('Upload failed');
      files[name] = URL.createObjectURL(file);
      return name;
    } catch (e) { lbl.innerHTML = old; alertBox('The upload didn\'t work. Check your internet and try again.'); return null; }
  };
  const alertBox = (m) => { const h = $('.hint', box) || $('#pmsg', box); if (h) h.innerHTML = `<span class="bad">${esc(m)}</span>`; };
  const dropify = (lbl, cb) => {
    ['dragenter', 'dragover'].forEach((k) => lbl.addEventListener(k, (e) => { e.preventDefault(); lbl.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((k) => lbl.addEventListener(k, (e) => { e.preventDefault(); lbl.classList.remove('over'); }));
    lbl.addEventListener('drop', (e) => cb(e.dataTransfer.files[0]));
  };

  const WIRE = {
    welcome: () => ($('#start').onclick = () => go(1)),
    look: () => $$('[data-mode]', box).forEach((b) => (b.onclick = () => {
      d.booth.mode = b.dataset.mode; $$('[data-mode]', box).forEach((x) => x.classList.toggle('on', x === b)); save(); refresh(); pop(); validate();
      if (G && !reduce) G.fromTo(b, { scale: 0.98 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    })),
    logo: () => {
      const handle = (kind, key) => async (f) => { const name = await upload(f, kind, $(kind === 'logo' ? '#uf' : '#bf', box)); if (name) { d.booth[key] = name; save(true); render(0); } };
      $('#uf', box).onchange = (e) => handle('logo', 'logo')(e.target.files[0]);
      $('#bf', box).onchange = (e) => handle('background', 'background')(e.target.files[0]);
      dropify($('#ul', box), handle('logo', 'logo')); dropify($('#ub', box), handle('background', 'background'));
      $('#clr', box)?.addEventListener('click', () => { d.booth.logo = null; d.booth.background = null; save(); render(0); });
    },
    colours: () => $$('[data-c]', box).forEach((i) => (i.oninput = () => { d.booth[i.dataset.c] = i.value.toUpperCase(); $(`[data-h="${i.dataset.c}"]`, box).textContent = i.value.toUpperCase(); save(); refresh(); })),
    words: () => {
      $('#wt', box).oninput = (e) => { d.booth.welcome_title = e.target.value; save(); refresh(); };
      $('#ws', box).oninput = (e) => { d.booth.welcome_sub = e.target.value; save(); refresh(); };
      $$('[data-f]', box).forEach((b) => (b.onclick = () => { d.booth.font = b.dataset.f; $$('[data-f]', box).forEach((x) => x.classList.toggle('on', x === b)); save(); refresh(); pop(); }));
    },
    details: () => {
      if (!d.details.date && ev.starts_at) { d.details.date = ev.starts_at.slice(0, 10); d.details.date_text = P.dateText(d.details.date); }
      $('#nm', box).oninput = (e) => { d.details.names = e.target.value; save(); refresh(); validate(); };
      $('#dt', box).oninput = (e) => { d.details.date = e.target.value; d.details.date_text = P.dateText(e.target.value); save(); refresh(); };
      $('#ms', box).oninput = (e) => { d.details.message = e.target.value; save(); refresh(); };
    },
    paper: () => $$('[data-paper]', box).forEach((b) => (b.onclick = () => {
      d.paper.mode = b.dataset.paper; $$('[data-paper]', box).forEach((x) => x.classList.toggle('on', x === b)); save(); refresh(); pop(); validate();
    })),
    papercolour: () => {
      $$('[data-p]', box).forEach((i) => (i.oninput = () => { d.paper[i.dataset.p] = i.value.toUpperCase(); $(`[data-ph="${i.dataset.p}"]`, box).textContent = i.value.toUpperCase(); save(); refresh(); }));
      $$('#pc button', box).forEach((b) => (b.onclick = () => {
        d.paper.photo_count = +b.dataset.n; $$('#pc button', box).forEach((x) => x.classList.toggle('on', x === b)); save(); refresh();
        if (G && !reduce) G.from($$('.pv-paper .shots i'), { scaleY: 0, transformOrigin: 'top', duration: 0.4, stagger: 0.05, ease: 'power3.out' });
      }));
    },
    paperupload: () => {
      const handle = async (f) => {
        if (!f) return;
        if (f.type !== 'image/png') return alertBox('Please upload a PNG: it needs see-through photo spaces.');
        const local = URL.createObjectURL(f);
        const found = await P.detectWindows(local).catch(() => null);
        if (!found) return alertBox('We couldn\'t read that file.');
        if (Math.abs(found.ratio - 1 / 3) > 0.02) return alertBox(`This design is ${found.width} × ${found.height} px. It needs to be 600 × 1800 px (a 2 × 6 inch strip).`);
        if (found.windows.length < 2) return alertBox('We couldn\'t find empty photo spaces. Leave 2 to 8 transparent areas where the photos go.');
        const name = await upload(f, 'paper', $('#pf', box)); if (!name) return;
        files[name] = local; d.paper.template = name; d.paper.windows = found.windows; save(true); render(0);
        if (G && !reduce) G.from($$('.pv-paper.tpl i'), { scale: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(2)' });
      };
      $('#pf', box).onchange = (e) => handle(e.target.files[0]); dropify($('#pu', box), handle);
    },
    review: () => $$('[data-go]', box).forEach((b) => (b.onclick = () => { at = flow().indexOf(b.dataset.go); render(-1); })),
  };

  function go(dir) {
    const f = flow();
    if (dir > 0 && f[at] === 'review') return submit();
    at += dir; save(); render(dir);
  }
  async function submit() {
    const b = $('#next'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Sending';
    try { await save(true); await call({ action: 'submit' }); status = 'submitted'; thanks(); }
    catch (e) { b.disabled = false; b.textContent = 'Send to PolaReady'; alertBox(e.code === 'approved' ? 'This design is already approved. Message us to change it.' : 'That didn\'t send. Check your internet and try again.'); }
  }
  function thanks() {
    nav.hidden = true; side.hidden = true; wrap.classList.remove('two'); $('#prog').style.width = '100%'; $('#count').textContent = '';
    box.innerHTML = `<div class="done"><div class="bearbig" data-a></div><div class="hello" data-a>Thank you${ev.client_name ? ', ' + esc(ev.client_name) : ''}.</div>
      <h1 data-a>Your booth is in our hands.</h1><p class="lead" data-a style="margin:12px auto 0">We'll prepare everything and send you a confirmation on WhatsApp. Want to change something? Open this link again.</p>
      <button class="btn ghost big" id="again" data-a>See my design again</button></div>`;
    if (G && !reduce) { G.from($$('[data-a]', box), { y: 20, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }); G.from('.bearbig', { scale: 0.3, rotate: -20, duration: 1, ease: 'back.out(2)' }); }
    $('#again').onclick = () => { at = flow().length - 1; render(-1); };
  }

  $('#back').onclick = () => go(-1);
  $('#next').onclick = () => go(1);

  async function boot() {
    box.innerHTML = `<div class="state"><div class="bearbig"></div></div>`;
    if (token.length < 24) { box.innerHTML = `<div class="state"><div class="bearbig"></div><h1>This link isn't complete</h1><p class="lead" style="margin:10px auto">Open the full link from your PolaReady message.</p></div>`; return; }
    try {
      const r = await call({ action: 'get' });
      ev = r.event; files = r.files || {}; status = r.status;
      const s = r.design || {};
      d = { step: s.step || 0, booth: { mode: null, ...(s.booth || {}) }, details: { ...(s.details || {}) }, paper: { mode: null, photo_count: 4, bg: '#F5EFEB', ink: '#233345', ...(s.paper || {}) } };
      if (!s.booth) d.booth.mode = null;
      if (!s.paper) d.paper.mode = null;
      if (status === 'approved') {
        box.innerHTML = `<div class="done"><div class="bearbig"></div><div class="hello">All set${ev.client_name ? ', ' + esc(ev.client_name) : ''}.</div><h1>Your design is approved.</h1><p class="lead" style="margin:12px auto 0">The booth is being prepared for ${esc(ev.name)}. To change anything now, message us on WhatsApp.</p></div>`;
        return;
      }
      at = Math.min(d.step || 0, flow().length - 1);
      render(1);
    } catch (e) {
      box.innerHTML = `<div class="state"><div class="bearbig"></div><h1>${e.status === 404 ? 'We can\'t find this design' : 'No connection'}</h1><p class="lead" style="margin:10px auto">${e.status === 404 ? 'The link may have changed. Ask PolaReady for a new one.' : 'Check your internet and refresh the page.'}</p></div>`;
    }
  }
  boot();
})();
