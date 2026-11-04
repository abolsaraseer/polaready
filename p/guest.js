/* A guest's photos, opened from the QR code on their printed paper.
 * The code lives in the URL hash, so it never reaches any server log;
 * it's sent only to the PolaReady gallery function. */
(() => {
  'use strict';
  const C = window.POLAREADY_CLOUD || {};
  const main = document.getElementById('main');
  const code = (location.hash.slice(1) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  document.getElementById('code').textContent = code ? code.replace(/(.{5})/, '$1 ') : '';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>';

  const state = (title, text, wait) => {
    main.innerHTML = `<div class="state fade"><div class="bear"></div><h2>${title}</h2><p>${text}</p>${wait ? '<div class="dots"><i></i><i></i><i></i></div>' : ''}</div>`;
  };

  const call = async (body) => {
    const r = await fetch(`${C.url}/functions/v1/gallery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.key }, body: JSON.stringify(body),
    });
    if (r.status === 404) return { error: 'not_found' };
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };

  let tries = 0; let shown = 0; let painted = false;
  async function load() {
    if (!/^[A-Z2-9]{10}$/.test(code)) return state('Hmm, that code doesn’t look right', 'Try scanning the QR code on your paper again.');
    let d;
    try { d = await call({ code }); } catch { return state('No connection', 'Check your internet and refresh the page.', false); }
    if (d.error) return state('We can’t find these photos', 'They may have been removed after the event. Ask the PolaReady team if you need them.');
    if (d.state === 'pending') {
      state('Your photos are on their way', 'They’re still travelling from the booth. This page will fill in by itself, so keep it open.', true);
      if (tries++ < 60) setTimeout(load, 8000);
      return;
    }
    paint(d);
    if (d.items.length < d.expected && tries++ < 60) setTimeout(load, 8000);
  }

  function paint(d) {
    const strip = d.items.find((i) => i.kind === 'strip');
    const photos = d.items.filter((i) => i.kind === 'photo');
    const date = d.date ? new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    if (!painted) {
      painted = true;
      main.innerHTML = `
        <div class="fade"><div class="hi">Here you are,</div><h1>${esc(d.title)}</h1><div class="meta">${esc(date)}${d.message ? ' · ' + esc(d.message) : ''}</div></div>
        <div class="paperbox" id="pb"></div>
        <div id="acts"></div>
        <div class="sec"><span>Your photos</span><span id="cnt"></span></div>
        <div class="grid" id="grid"></div>`;
    }
    const pb = document.getElementById('pb');
    if (strip && !pb.firstChild) {
      const img = new Image(); img.className = 'paperimg develop'; img.alt = 'Your printed paper'; img.src = strip.url; pb.appendChild(img);
    } else if (!strip && !pb.firstChild) pb.innerHTML = '<div class="hint">Your paper is still uploading…</div>';

    const canShare = !!(navigator.canShare && window.File);
    document.getElementById('acts').innerHTML = `
      ${canShare ? `<button class="btn" id="share">${SHARE}Save to my phone</button>` : ''}
      ${strip ? `<a class="btn ${canShare ? 'ghost' : ''}" style="margin-top:10px" href="${strip.download}" data-dl>${DL}Download the paper</a>` : ''}
      <p class="hint">${canShare ? 'Tap “Save to my phone”, then “Save images”.' : 'Tap a photo’s button to save it.'}</p>`;
    document.getElementById('cnt').textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;

    const grid = document.getElementById('grid');
    photos.slice(shown).forEach((p, i) => {
      const el = document.createElement('div'); el.className = 'ph';
      el.innerHTML = `<img src="${p.url}" alt="Photo ${p.idx + 1}" loading="lazy"><a href="${p.download}" aria-label="Download photo ${p.idx + 1}" data-dl>${DL}</a>`;
      grid.appendChild(el);
      setTimeout(() => el.classList.add('in'), 1400 + i * 120);
    });
    shown = photos.length;

    document.querySelectorAll('[data-dl]').forEach((a) => a.addEventListener('click', () => call({ code, action: 'download' }).catch(() => {}), { once: true }));
    const share = document.getElementById('share');
    if (share) share.onclick = async () => {
      share.disabled = true; share.innerHTML = 'Getting your photos…';
      try {
        const all = [strip, ...photos].filter(Boolean);
        const files = await Promise.all(all.map(async (it, i) => {
          const b = await (await fetch(it.url)).blob();
          return new File([b], it.kind === 'strip' ? `PolaReady-${code}-paper.jpg` : `PolaReady-${code}-${it.idx + 1}.jpg`, { type: 'image/jpeg' });
        }));
        if (navigator.canShare({ files })) { await navigator.share({ files, title: d.title }); call({ code, action: 'download' }).catch(() => {}); }
        else throw new Error('share');
      } catch (e) { if (e.name !== 'AbortError') alertLess(); }
      share.disabled = false; share.innerHTML = `${SHARE}Save to my phone`;
    };
  }
  const alertLess = () => { const h = document.querySelector('.hint'); if (h) h.textContent = 'Saving didn’t work here. Use the buttons on each photo instead.'; };

  load();
})();
