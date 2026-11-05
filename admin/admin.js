/* PolaReady admin dashboard.
 *
 * One page, hash routes:
 *   #/events  #/calendar  #/event/<id>/<tab>  #/booths  #/templates
 * Data comes from Supabase with row level security: only accounts listed in
 * public.admins can read anything, so this file holds no secrets.
 */
(() => {
  'use strict';
  const CFG = window.POLAREADY_CLOUD || {};
  const app = document.getElementById('app');
  if (!CFG.url || !CFG.key || CFG.url.includes('YOUR-')) {
    app.innerHTML = `<div class="login"><div class="lcard"><div class="mk"></div><h1>Almost there</h1><p>The dashboard isn't connected to Supabase yet. Add the project URL and key to <b>admin/config.js</b>.</p></div></div>`;
    return;
  }
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, storageKey: 'polaready-admin' } });

  /* ---------------- helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.gsap;
  const fmt = (n) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('en-US'));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dOf = (iso) => (iso ? new Date(iso) : null);
  const dateLong = (d) => d ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'No date yet';
  const timeShort = (d) => d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  const ago = (iso) => {
    if (!iso) return 'never';
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} days ago`;
  };
  const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
  const icon = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const IC = {
    events: icon('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
    cal: icon('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 13h2M12 13h2M16 13h0M8 17h2M12 17h2"/>'),
    booth: icon('<rect x="6" y="2" width="12" height="20" rx="2"/><circle cx="12" cy="9" r="3"/><path d="M10 17h4"/>'),
    tpl: icon('<rect x="4" y="3" width="7" height="18" rx="1.5"/><rect x="13" y="3" width="7" height="8" rx="1.5"/><rect x="13" y="13" width="7" height="8" rx="1.5"/>'),
    back: icon('<path d="M15 18l-6-6 6-6"/>'), go: icon('<path d="M9 18l6-6-6-6"/>'),
    plus: icon('<path d="M12 5v14M5 12h14"/>'), dl: icon('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  };
  const FILTERS = ['Original', 'B&W', 'Sepia', 'Vintage', 'Fade', 'Cool', 'Crisp', 'Instant', 'Mono', 'Pop'];
  const PAPERS = [
    { n: 'PolaReady', bg: '#F5EFEB', ink: '#233345' }, { n: 'Polar Night', bg: '#233345', ink: '#F5EFEB' },
    { n: 'White', bg: '#FFFFFF', ink: '#111111' }, { n: 'Cream', bg: '#F2E6C7', ink: '#73542E' },
    { n: 'Pink', bg: '#FFCCE0', ink: '#BF3373' }, { n: 'Blue', bg: '#C7E5FA', ink: '#1A5999' },
    { n: 'Mint', bg: '#CCF5DB', ink: '#1A734D' }, { n: 'Lavender', bg: '#E0D4FA', ink: '#6640A6' },
    { n: 'Noir', bg: '#1A1A1F', ink: '#FFFFFF' },
  ];
  const DEF = () => ({ title: '', date_text: '', message: 'Thank you for coming!', photo_count: 4, lock_count: true,
    paper: { bg: '#F5EFEB', ink: '#233345' }, lock_paper: false, voice: true, countdown: 3, filters: FILTERS.slice(), overlay: null });
  const CHECK = ['Paper loaded and counted', 'Test print done', 'Camera battery charged + spare', 'System file loaded on the iPad',
    'Backdrop and lights set up', 'Internet: venue Wi-Fi or phone hotspot', 'Host briefed on the night'];
  const STATUS = [['design', 'Design'], ['ready', 'Ready'], ['live', 'Live'], ['done', 'Done']];

  /* ---------------- motion ---------------- */
  const enter = (root = app) => {
    if (!G || reduce) return;
    const els = $$('[data-a]', root);
    if (els.length) G.fromTo(els, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.045, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
  };
  const countUp = (el, to, flash) => {
    if (to == null || isNaN(to)) { el.textContent = '–'; return; }
    const from = Number(el.dataset.v ?? 0);
    el.dataset.v = to;
    if (!G || reduce || from === to) { el.textContent = fmt(to); return; }
    const o = { v: from };
    G.to(o, { v: to, duration: from === 0 ? 1.1 : 0.7, ease: 'power2.out', onUpdate: () => (el.textContent = fmt(Math.round(o.v))) });
    if (flash) {
      const f = el.closest('.kpi')?.querySelector('.flash');
      if (f) G.fromTo(f, { opacity: 0.28 }, { opacity: 0, duration: 1.2, ease: 'power2.out' });
      G.fromTo(el, { scale: 1.12 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' });
    }
  };
  const growBars = (root) => { if (G && !reduce) G.from($$('.bar i', root), { scaleY: 0, duration: 0.8, stagger: 0.04, ease: 'power3.out' }); };
  const movePill = (wrap, active) => {
    const pill = $('.pill', wrap); if (!pill || !active) return;
    if (wrap.classList.contains('tabs')) { pill.style.width = active.offsetWidth + 'px'; pill.style.transform = `translateX(${active.offsetLeft}px)`; }
    else { pill.style.height = active.offsetHeight + 'px'; pill.style.transform = `translateY(${active.offsetTop}px)`; }
  };
  let toastT;
  const toast = (msg) => {
    $('.toast')?.remove(); clearTimeout(toastT);
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i></i>${esc(msg)}`; document.body.appendChild(t);
    if (G && !reduce) G.from(t, { y: 30, autoAlpha: 0, duration: 0.45, ease: 'back.out(2)' });
    toastT = setTimeout(() => { if (G && !reduce) G.to(t, { y: 20, autoAlpha: 0, duration: 0.3, onComplete: () => t.remove() }); else t.remove(); }, 2600);
  };
  const modal = (html, { wide = false } = {}) => {
    const s = document.createElement('div'); s.className = 'scrim';
    s.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(s);
    const m = $('.modal', s);
    if (G && !reduce) { G.from(s, { opacity: 0, duration: 0.25 }); G.from(m, { y: 24, scale: 0.97, opacity: 0, duration: 0.45, ease: 'power3.out' }); }
    const close = () => {
      document.removeEventListener('keydown', onKey);
      if (G && !reduce) { G.to(m, { y: 14, scale: 0.98, opacity: 0, duration: 0.22, ease: 'power2.in' }); G.to(s, { opacity: 0, duration: 0.25, delay: 0.05, onComplete: () => s.remove() }); }
      else s.remove();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-close]')) close(); });
    setTimeout(() => $('input,select,textarea', m)?.focus(), 60);
    return { el: m, close };
  };
  const busy = (btn, on, label) => {
    if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spin"></span>${label || ''}`; btn.disabled = true; }
    else { btn.innerHTML = btn.dataset.label || btn.innerHTML; btn.disabled = false; }
  };
  const fail = (e) => { console.error(e); toast(e?.message || 'Something went wrong'); };

  /* ---------------- state ---------------- */
  let user = null;
  let live = null; // realtime channel for the open event
  let pollT = null;

  const cleanup = () => { if (live) { sb.removeChannel(live); live = null; } clearInterval(pollT); pollT = null; };

  /* ---------------- auth ---------------- */
  function renderLogin(msg = '') {
    cleanup();
    app.innerHTML = `
      <main class="login">
        <form class="lcard" id="lf" autocomplete="on">
          <div class="mk" data-a></div>
          <h1 data-a>Welcome back</h1>
          <p data-a>Sign in to the PolaReady dashboard.</p>
          <label class="field" data-a><span>Email</span><input class="inp" type="email" name="email" autocomplete="username" required></label>
          <label class="field" data-a><span>Password</span><input class="inp" type="password" name="password" autocomplete="current-password" required></label>
          <button class="btn full" data-a>Sign in</button>
          <div class="err" id="lerr">${esc(msg)}</div>
        </form>
      </main>`;
    if (G && !reduce) {
      G.from('.lcard', { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out' });
      G.from('.lcard .mk', { scale: 0.4, rotate: -20, opacity: 0, duration: 0.9, ease: 'back.out(2.2)', delay: 0.15 });
      G.from($$('.lcard [data-a]:not(.mk)'), { y: 12, opacity: 0, duration: 0.5, stagger: 0.05, delay: 0.25, ease: 'power3.out' });
    }
    $('#lf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target); const b = $('button', e.target);
      busy(b, true, 'Signing in');
      const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
      busy(b, false);
      if (error) {
        $('#lerr').textContent = error.message === 'Invalid login credentials' ? 'That email and password don\'t match.' : error.message;
        if (G && !reduce) G.fromTo('.lcard', { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,0.3)' });
      }
    });
  }

  /* ---------------- shell ---------------- */
  function shell(route) {
    if (!$('.app')) {
      app.innerHTML = `
        <div class="app">
          <aside class="side">
            <div class="brand"><i></i><div>PolaReady<small>Dashboard</small></div></div>
            <nav class="nav"><span class="pill"></span>
              <a href="#/events" data-r="events">${IC.events}<span>Events</span></a>
              <a href="#/calendar" data-r="calendar">${IC.cal}<span>Calendar</span></a>
              <a href="#/booths" data-r="booths">${IC.booth}<span>Booths</span></a>
              <a href="#/templates" data-r="templates">${IC.tpl}<span>Templates</span></a>
            </nav>
            <div class="grow"></div>
            <div class="who"><span>${esc(user?.email || '')}</span><button id="out">Sign out</button></div>
          </aside>
          <main class="main" id="view"></main>
        </div>`;
      $('#out').onclick = () => sb.auth.signOut();
      if (G && !reduce) G.from('.side', { x: -30, opacity: 0, duration: 0.7, ease: 'power3.out' });
    }
    const key = route === 'event' ? 'events' : route;
    $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === key));
    requestAnimationFrame(() => movePill($('.nav'), $('.nav a.on')));
    return $('#view');
  }

  /* ---------------- data ---------------- */
  async function loadEvents() {
    const [{ data: ev, error }, { data: st }] = await Promise.all([
      sb.from('events').select('*').order('starts_at', { ascending: false, nullsFirst: true }),
      sb.from('event_stats').select('*'),
    ]);
    if (error) throw error;
    const byId = Object.fromEntries((st || []).map((s) => [s.event_id, s]));
    return (ev || []).map((e) => ({ ...e, stats: byId[e.id] || {} }));
  }

  /* ---------------- events list ---------------- */
  let evFilter = 'all';
  async function viewEvents() {
    const v = shell('events');
    v.innerHTML = `<div class="top"><div><h1 data-a>Events</h1><div class="sub" data-a>Every night, from first message to last print.</div></div>
      <div class="acts" data-a><button class="btn" id="newev">${IC.plus.replace('<svg', '<svg width="18" height="18"')}New event</button></div></div>
      <div class="kpis">${[0, 1, 2, 3].map(() => '<div class="kpi skel" style="height:96px"></div>').join('')}</div>
      <div class="evlist">${[0, 1, 2].map(() => '<div class="skel" style="height:88px"></div>').join('')}</div>`;
    enter(v);
    $('#newev').onclick = newEventModal;
    let events;
    try { events = await loadEvents(); } catch (e) { return fail(e); }
    if (!location.hash.startsWith('#/events') && location.hash !== '' && location.hash !== '#/') return;
    const now = new Date(); const m0 = new Date(now.getFullYear(), now.getMonth(), 1); const m1 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const month = events.filter((e) => e.starts_at && new Date(e.starts_at) >= m0 && new Date(e.starts_at) < m1);
    const sum = (k) => month.reduce((a, e) => a + Number(e.stats[k] || 0), 0);
    const upcoming = events.filter((e) => e.starts_at && new Date(e.starts_at) > now && e.status !== 'done').length;
    $('.kpis', v).outerHTML = `<div class="kpis">
      <div class="kpi dark" data-a><span class="flash"></span><small>Events in ${MONTHS[now.getMonth()]}</small><b data-n="${month.length}">0</b><em>${upcoming} upcoming</em></div>
      <div class="kpi" data-a><span class="flash"></span><small>Guests this month</small><b data-n="${sum('guests')}">0</b><em>booth visits</em></div>
      <div class="kpi" data-a><span class="flash"></span><small>Photos this month</small><b data-n="${sum('photos')}">0</b><em>${month.length ? `avg ${fmt(Math.round(sum('photos') / month.length))} per event` : '&nbsp;'}</em></div>
      <div class="kpi" data-a><span class="flash"></span><small>Papers this month</small><b data-n="${sum('papers')}">0</b><em>${fmt(sum('reprints'))} reprints</em></div></div>`;
    const counts = { all: events.length }; STATUS.forEach(([k]) => (counts[k] = events.filter((e) => e.status === k).length));
    const list = () => {
      const rows = events.filter((e) => evFilter === 'all' || e.status === evFilter);
      if (!rows.length) return `<div class="card empty" data-a><div class="mk"></div><b>${events.length ? 'Nothing here' : 'No events yet'}</b>${events.length ? 'Try another filter.' : 'Tap “New event” to add your first night.'}</div>`;
      return rows.map((e) => {
        const d = dOf(e.starts_at);
        return `<a class="ev" href="#/event/${e.id}/overview" data-a>
          <div class="date">${d ? `<b>${d.getDate()}</b><small>${MONTHS[d.getMonth()]}</small>` : '<small>TBD</small>'}</div>
          <div class="nm"><b>${esc(e.name)}</b><span>${esc([e.venue, d && timeShort(d), e.client_name].filter(Boolean).join(' · ') || 'Add the details')}</span></div>
          <div><span class="st ${e.status}">${STATUS.find((s) => s[0] === e.status)?.[1]}</span></div>
          <div class="n"><b>${fmt(e.stats.guests)}</b><small>Guests</small></div>
          <div class="n"><b>${fmt(e.stats.photos)}</b><small>Photos</small></div>
          <div class="n"><b>${fmt(e.stats.papers)}</b><small>Papers</small></div>
          <div class="go">${IC.go}</div></a>`;
      }).join('');
    };
    $('.evlist', v).outerHTML = `<div><div class="chips" data-a>${[['all', 'All'], ...STATUS].map(([k, l]) => `<button class="chip ${evFilter === k ? 'on' : ''}" data-f="${k}">${l}<span>${counts[k]}</span></button>`).join('')}</div><div class="evlist">${list()}</div></div>`;
    $$('.chip', v).forEach((c) => (c.onclick = () => {
      evFilter = c.dataset.f; $$('.chip', v).forEach((x) => x.classList.toggle('on', x === c));
      $('.evlist', v).innerHTML = list();
      if (G && !reduce) G.from($$('.evlist > *', v), { y: 10, opacity: 0, duration: 0.4, stagger: 0.03, ease: 'power2.out' });
    }));
    enter(v);
    $$('[data-n]', v).forEach((b) => countUp(b, Number(b.dataset.n)));
  }

  async function newEventModal() {
    const [{ data: tpls }, { data: booths }] = await Promise.all([
      sb.from('templates').select('id,name,config').order('created_at', { ascending: false }),
      sb.from('booths').select('id,name,active_event_id').order('created_at'),
    ]);
    const m = modal(`<h2>New event</h2><div class="sub">You can fill in everything else later.</div>
      <form id="nf">
        <label class="field"><span>Event name</span><input class="inp" name="name" placeholder="Sara & Omar · Wedding" required></label>
        <div class="f2"><label class="field"><span>Starts</span><input class="inp" type="datetime-local" name="starts"></label>
        <label class="field"><span>Ends</span><input class="inp" type="datetime-local" name="ends"></label></div>
        <div class="f2"><label class="field"><span>Venue</span><input class="inp" name="venue"></label>
        <label class="field"><span>Client name</span><input class="inp" name="client"></label></div>
        <label class="field"><span>Start from</span><select class="inp" name="tpl"><option value="">The standard PolaReady setup</option>${(tpls || []).map((t) => `<option value="${t.id}">Template: ${esc(t.name)}</option>`).join('')}</select></label>
        ${(booths || []).length ? `<label class="field"><span>Booth</span><select class="inp" name="booth"><option value="">Choose later</option>${booths.map((b) => `<option value="${b.id}">${esc(b.name)}${b.active_event_id ? ' (moves from another event)' : ''}</option>`).join('')}</select></label>` : ''}
        <div class="acts"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Create event</button></div></form>`);
    $('#nf', m.el).onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target); const b = $('button:last-child', e.target); busy(b, true, 'Creating');
      const tpl = (tpls || []).find((t) => t.id === f.get('tpl'));
      const config = { ...DEF(), ...(tpl?.config || {}) };
      if (!tpl) config.title = String(f.get('name')).split('·')[0].trim();
      const starts = fromLocalInput(f.get('starts'));
      if (starts && !config.date_text) { const d = new Date(starts); config.date_text = `${String(d.getDate()).padStart(2, '0')} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${d.getFullYear()}`; }
      const { data, error } = await sb.from('events').insert({ name: f.get('name'), starts_at: starts, ends_at: fromLocalInput(f.get('ends')), venue: f.get('venue') || null, client_name: f.get('client') || null, config }).select().single();
      if (error) { busy(b, false); return fail(error); }
      if (f.get('booth')) {
        const { error: be } = await sb.from('booths').update({ active_event_id: data.id }).eq('id', f.get('booth'));
        if (be) fail(be);
      }
      m.close(); toast('Event created'); location.hash = `#/event/${data.id}/setup`;
    };
  }

  /* ---------------- calendar ---------------- */
  let calMonth = new Date(); calMonth.setDate(1);
  async function viewCalendar() {
    const v = shell('calendar');
    let events; try { events = await loadEvents(); } catch (e) { return fail(e); }
    const draw = () => {
      const y = calMonth.getFullYear(), mo = calMonth.getMonth();
      const first = new Date(y, mo, 1); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
      const today = new Date().toDateString();
      let cells = '';
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        if (i >= 35 && d.getMonth() !== mo) break;
        const evs = events.filter((e) => e.starts_at && new Date(e.starts_at).toDateString() === d.toDateString());
        cells += `<div class="d ${d.getMonth() !== mo ? 'out' : ''} ${d.toDateString() === today ? 'today' : ''}"><b>${d.getDate()}</b>${evs.map((e) => `<a href="#/event/${e.id}/overview" class="st ${e.status}" title="${esc(e.name)}">${esc(e.name)}</a>`).join('')}</div>`;
      }
      v.innerHTML = `<div class="top"><div><h1 data-a>${MONTHS[mo]} ${y}</h1><div class="sub" data-a>Never double-book the booth.</div></div>
        <div class="acts" data-a><button class="btn ghost sm" id="pm">${IC.back.replace('<svg', '<svg width="16" height="16"')}</button><button class="btn ghost sm" id="tm">Today</button><button class="btn ghost sm" id="nm">${IC.go.replace('<svg', '<svg width="16" height="16"')}</button></div></div>
        <div class="cal">${DAYS.map((d) => `<div class="dh">${d}</div>`).join('')}${cells}</div>`;
      $('#pm').onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); draw(); };
      $('#nm').onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); draw(); };
      $('#tm').onclick = () => { calMonth = new Date(); calMonth.setDate(1); draw(); };
      if (G && !reduce) G.from($$('.cal .d', v), { opacity: 0, y: 8, duration: 0.35, stagger: { each: 0.008, from: 'start' }, ease: 'power2.out' });
    };
    draw(); enter(v);
  }

  /* ---------------- one event ---------------- */
  const TABS = [['overview', 'Overview'], ['photos', 'Photos'], ['setup', 'Setup & files'], ['client', 'Client & payment'], ['checklist', 'Checklist']];
  async function viewEvent(id, tab = 'overview') {
    const v = shell('event');
    const sameEvent = v.dataset.event === id;
    v.dataset.event = id;
    if (!sameEvent) v.innerHTML = `<div class="skel" style="height:120px;margin-bottom:20px"></div><div class="skel" style="height:300px"></div>`;
    const { data: ev, error } = await sb.from('events').select('*').eq('id', id).maybeSingle();
    if (error) return fail(error);
    if (!ev) { v.innerHTML = `<div class="card empty"><div class="mk"></div><b>Event not found</b><a href="#/events">Back to events</a></div>`; return; }
    ev.config = { ...DEF(), ...(ev.config || {}) };
    const d = dOf(ev.starts_at);
    const headHTML = `<a class="crumb" href="#/events">${IC.back.replace('<svg', '<svg width="16" height="16"')}All events</a>
      <div class="top"><div><h1 data-a>${esc(ev.name)}</h1><div class="sub" data-a>${esc([dateLong(d), d && `${timeShort(d)}${ev.ends_at ? '–' + timeShort(dOf(ev.ends_at)) : ''}`, ev.venue, ev.host_name && 'Host: ' + ev.host_name].filter(Boolean).join(' · '))}</div></div>
      <div class="steps" data-a>${STATUS.map(([k, l], i) => `<button data-s="${k}" class="${ev.status === k ? 'on' : STATUS.findIndex((s) => s[0] === ev.status) > i ? 'done' : ''}">${l}</button>`).join('')}</div></div>
      <div id="bbox" data-a></div>
      <nav class="tabs" data-a><span class="pill"></span>${TABS.map(([k, l]) => `<a href="#/event/${id}/${k}" data-t="${k}">${l}</a>`).join('')}</nav>
      <div id="tab"></div>`;
    if (!sameEvent || !$('#tab', v)) { v.innerHTML = headHTML; enter(v); }
    drawBoothBox($('#bbox', v), ev);
    $$('.steps button', v).forEach((b) => (b.onclick = async () => {
      const { error: e } = await sb.from('events').update({ status: b.dataset.s }).eq('id', id);
      if (e) return fail(e);
      const idx = STATUS.findIndex((s) => s[0] === b.dataset.s);
      $$('.steps button', v).forEach((x, i) => { x.className = i === idx ? 'on' : i < idx ? 'done' : ''; });
      toast(`Marked as ${STATUS[idx][1]}`);
    }));
    $$('.tabs a', v).forEach((a) => a.classList.toggle('on', a.dataset.t === tab));
    requestAnimationFrame(() => movePill($('.tabs', v), $('.tabs a.on', v)));
    cleanup();
    const t = $('#tab', v);
    if (G && !reduce && sameEvent) G.fromTo(t, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
    const fn = { overview: tabOverview, photos: tabPhotos, setup: tabSetup, client: tabClient, checklist: tabChecklist }[tab] || tabOverview;
    try { await fn(t, ev); } catch (e) { fail(e); }
  }

  /* ---- overview ---- */
  async function tabOverview(t, ev) {
    t.innerHTML = `<div class="kpis" id="k"></div>
      <div class="grid2" style="margin-bottom:16px"><div class="card" data-a><h3>Visits per hour <span class="mono soft" id="busy"></span></h3><div class="bars" id="bars"></div></div>
      <div class="card" data-a><h3>Booth <span id="bstate"></span></h3><div class="rows" id="brows"></div></div></div>
      <div class="card" data-a style="margin-bottom:16px"><h3>Latest papers <a class="btn ghost sm" href="#/event/${ev.id}/photos">See all</a></h3><div class="latest" id="lat"></div></div>
      <div class="card" data-a><h3>Problems</h3><div class="rows" id="probs"></div></div>`;
    const tiles = [
      ['guests', 'Guests', 'booth visits'], ['photos', 'Photos taken', ''], ['papers', 'Papers printed', ''],
      ['paper_left', 'Paper left', ''], ['avg', 'Avg. visit', ''], ['problems', 'Problems', ''], ['last', 'Last visit', ''],
    ];
    $('#k', t).innerHTML = tiles.map(([k, l]) => `<div class="kpi" data-k="${k}" data-a><span class="flash"></span><small>${l}</small><b>–</b><em>&nbsp;</em></div>`).join('');
    enter(t);
    let first = true;
    const refresh = async () => {
      const [{ data: st }, { data: visits }, { data: probs }, { data: booths }] = await Promise.all([
        sb.from('event_stats').select('*').eq('event_id', ev.id).maybeSingle(),
        sb.from('visits').select('id,code,started_at,has_strip,photo_count').eq('event_id', ev.id).order('started_at', { ascending: false }).limit(2000),
        sb.from('problems').select('*').eq('event_id', ev.id).order('at', { ascending: false }).limit(20),
        sb.from('booths').select('*').eq('active_event_id', ev.id),
      ]);
      const s = st || {};
      const set = (k, val, sub, cls) => {
        const el = $(`[data-k="${k}"]`, t); if (!el) return;
        const b = $('b', el);
        if (typeof val === 'number') countUp(b, val, !first); else b.textContent = val;
        $('em', el).innerHTML = sub || '&nbsp;';
        el.classList.toggle('warn', cls === 'warn'); el.classList.toggle('bad', cls === 'bad');
      };
      set('guests', Number(s.guests || 0), 'booth visits');
      set('photos', Number(s.photos || 0), s.guests ? `${(s.photos / s.guests).toFixed(1)} per visit` : '');
      set('papers', Number(s.papers || 0), `${fmt(s.reprints || 0)} reprints${s.failed_prints ? ` · ${s.failed_prints} failed` : ''}`);
      // Pace of the last hour decides how long the paper lasts.
      const hourAgo = Date.now() - 3600e3; const lastHour = (visits || []).filter((x) => new Date(x.started_at) > hourAgo).length;
      if (s.paper_left == null) set('paper_left', '–', 'enter the start count in Client');
      else set('paper_left', Number(s.paper_left), lastHour ? `≈ ${Math.max(0, s.paper_left / lastHour).toFixed(1)} h at this pace` : 'sheets', s.paper_left < 40 ? 'warn' : '');
      set('avg', s.avg_secs ? `${Math.floor(s.avg_secs / 60)}m ${String(Math.round(s.avg_secs % 60)).padStart(2, '0')}s` : '–', 'Start to print');
      set('problems', Number(s.problems || 0) + Number(s.failed_prints || 0), s.problems || s.failed_prints ? 'see below' : 'all good', s.problems || s.failed_prints ? 'bad' : '');
      set('last', s.last_visit ? timeShort(new Date(s.last_visit)) : '–', s.last_visit ? ago(s.last_visit) : 'no guests yet');

      // Hours across the night, empty hours included so gaps show.
      // Buckets run in real time from the first visit's hour, so a party that
      // goes past midnight reads 8p 9p … 12a 1a instead of wrapping round.
      const times = (visits || []).map((x) => new Date(x.started_at).getTime()).sort((a, b) => a - b);
      const barsEl = $('#bars', t);
      if (!times.length) barsEl.innerHTML = `<div class="soft" style="align-self:center;margin:auto">The chart fills in as guests use the booth.</div>`;
      else {
        const h0 = new Date(times[0]); h0.setMinutes(0, 0, 0);
        const n = Math.max(6, Math.floor((times[times.length - 1] - h0) / 3600e3) + 1);
        const counts = Array(Math.min(n, 24)).fill(0);
        times.forEach((ms) => { const i = Math.floor((ms - h0) / 3600e3); if (i < counts.length) counts[i]++; });
        const max = Math.max(...counts); const top = counts.indexOf(max);
        const lab = (i) => { const h = (h0.getHours() + i) % 24; return `${(h + 11) % 12 + 1}${h < 12 ? 'a' : 'p'}`; };
        const html = counts.map((c, i) => `<div class="bar ${i === top ? 'top' : ''}"><span>${c || ''}</span><i style="height:${(c / max) * 100}%"></i><small>${lab(i)}</small></div>`);
        const sig = counts.join(); const changed = barsEl.dataset.sig !== sig; barsEl.dataset.sig = sig;
        if (changed) { barsEl.innerHTML = html.join(''); if (first) growBars(barsEl); }
        const th = (h0.getHours() + top) % 24;
        $('#busy', t).textContent = `Busiest: ${(th + 11) % 12 + 1} ${th < 12 ? 'am' : 'pm'}`;
      }
      // Booth status
      const on = (b) => b.last_seen && Date.now() - new Date(b.last_seen) < 3 * 60e3;
      $('#bstate', t).innerHTML = (booths || []).some(on) ? '<span class="st live">Online</span>' : '';
      $('#brows', t).innerHTML = (booths || []).length ? booths.map((b) => `<div class="row"><div class="l"><b><span class="dot ${on(b) ? 'on' : ''}"></span>${esc(b.name)}</b><small>Last seen ${ago(b.last_seen)}${b.app_version ? ' · app ' + esc(b.app_version) : ''}</small></div></div>`).join('')
        : `<div class="row"><div class="l"><b>No booth assigned</b><small>Open <a href="#/event/${ev.id}/setup">Setup &amp; files</a> and tap “Send to booth”.</small></div></div>`;
      // Latest strips
      const lat = (visits || []).filter((x) => x.has_strip).slice(0, 6);
      const latEl = $('#lat', t);
      const sig = lat.map((x) => x.id).join();
      if (latEl.dataset.sig !== sig) {
        latEl.dataset.sig = sig;
        latEl.innerHTML = lat.length ? lat.map((x) => `<div class="sp" data-v="${x.id}"><div class="ph">…</div></div>`).join('') : `<div class="soft" style="grid-column:1/-1">Printed papers appear here a few seconds after they upload.</div>`;
        if (lat.length) await fillStrips(latEl, ev.id, lat, true);
      }
      $('#probs', t).innerHTML = (probs || []).length ? probs.map((p) => `<div class="row"><div class="l"><b class="bad">${p.kind === 'captureFail' ? 'A photo failed' : esc(p.kind)}</b><small>${esc(p.detail || '')}</small></div><span class="mono soft">${timeShort(new Date(p.at))}</span></div>`).join('')
        : `<div class="row"><div class="l"><b class="ok">No problems</b><small>Failed shots and prints show up here with their time.</small></div></div>`;
      first = false;
    };
    await refresh();
    // Live: refresh on any change for this event; a slow poll covers a dropped socket.
    let pending = null; const soon = () => { clearTimeout(pending); pending = setTimeout(refresh, 400); };
    live = sb.channel('ev-' + ev.id);
    ['visits', 'prints', 'scans', 'problems'].forEach((tb) => live.on('postgres_changes', { event: '*', schema: 'public', table: tb, filter: `event_id=eq.${ev.id}` }, soon));
    live.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'booths' }, soon).subscribe();
    pollT = setInterval(refresh, 30000);
  }

  // Paint strip thumbnails for visits into .sp[data-v] slots.
  async function fillStrips(root, eventId, visits, pop) {
    const paths = visits.map((x) => `${eventId}/${x.id}/strip.jpg`);
    const { data } = await sb.storage.from('photos').createSignedUrls(paths, 3600);
    (data || []).forEach((r, i) => {
      const slot = $(`.sp[data-v="${visits[i].id}"]`, root); if (!slot || !r.signedUrl) return;
      const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.src = r.signedUrl;
      img.onload = () => { $('.ph', slot)?.remove(); img.classList.add('in'); if (pop && G && !reduce) G.from(slot, { scale: 0.9, rotate: -2, duration: 0.6, ease: 'back.out(2)' }); };
      slot.prepend(img);
    });
  }

  /* ---- photos ---- */
  async function tabPhotos(t, ev) {
    const { data: visits, error } = await sb.from('visits').select('*').eq('event_id', ev.id).order('started_at', { ascending: false });
    if (error) throw error;
    const total = (visits || []).reduce((a, x) => a + x.photos_uploaded + (x.has_strip ? 1 : 0), 0);
    t.innerHTML = `<div class="card" data-a style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div><b>${fmt(visits.length)} visits · ${fmt(total)} files online</b><div class="soft" style="font-size:13.5px">Tap a paper to see its photos.</div></div>
        <button class="btn" id="zip" ${total ? '' : 'disabled'}>${IC.dl.replace('<svg', '<svg width="18" height="18"')}Download all (.zip)</button></div>
      ${visits.length ? `<div class="strips">${visits.map((x) => `<button class="sp" data-v="${x.id}" data-a><div class="ph">${x.has_strip ? '…' : 'Paper not<br>uploaded yet'}</div><span class="tag"><span>${timeShort(new Date(x.started_at))}</span><span>${x.photos_uploaded}/${x.photo_count}</span></span></button>`).join('')}</div>`
        : `<div class="card empty" data-a><div class="mk"></div><b>No photos yet</b>They arrive here while the event is running.</div>`}`;
    enter(t);
    // Thumbnails in batches so a 300-guest night doesn't ask for 300 links at once.
    const withStrip = visits.filter((x) => x.has_strip);
    for (let i = 0; i < withStrip.length; i += 60) await fillStrips(t, ev.id, withStrip.slice(i, i + 60), false);
    $$('.sp', t).forEach((b) => (b.onclick = () => visitModal(ev, visits.find((x) => x.id === b.dataset.v))));
    $('#zip', t)?.addEventListener('click', (e) => zipAll(e.currentTarget, ev, visits));
  }

  async function visitModal(ev, x) {
    const { data: rows } = await sb.from('photos').select('kind,idx,path').eq('visit_id', x.id).order('kind').order('idx');
    const { data: urls } = await sb.storage.from('photos').createSignedUrls((rows || []).map((r) => r.path), 3600);
    const strip = (rows || []).findIndex((r) => r.kind === 'strip');
    const ph = (rows || []).map((r, i) => ({ ...r, url: urls?.[i]?.signedUrl })).filter((r) => r.kind === 'photo');
    modal(`<h2>Visit at ${timeShort(new Date(x.started_at))}</h2><div class="sub">${x.photo_count} photos${x.secs ? ` · ${Math.round(x.secs)}s` : ''}</div>
      <div class="lb">${strip >= 0 && urls?.[strip]?.signedUrl ? `<img class="big" src="${urls[strip].signedUrl}" alt="Printed paper">` : '<div class="big skel" style="height:420px"></div>'}
      <div><div class="ph4">${ph.map((p) => `<a href="${p.url}" target="_blank" rel="noopener"><img src="${p.url}" alt="Photo ${p.idx + 1}" loading="lazy"></a>`).join('') || '<div class="soft">Photos are still uploading.</div>'}</div>
      </div></div>
      <div class="acts"><button class="btn ghost" data-close>Close</button></div>`, { wide: true });
  }

  async function zipAll(btn, ev, visits) {
    if (!window.JSZip) return toast('Zip tool not loaded');
    busy(btn, true, 'Preparing');
    try {
      const { data: rows } = await sb.from('photos').select('visit_id,kind,idx,path').eq('event_id', ev.id);
      const zip = new JSZip(); const byVisit = Object.fromEntries(visits.map((x) => [x.id, x]));
      let done = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const { data: urls } = await sb.storage.from('photos').createSignedUrls(chunk.map((r) => r.path), 3600);
        await Promise.all(chunk.map(async (r, j) => {
          const res = await fetch(urls[j].signedUrl); const blob = await res.blob();
          const v = byVisit[r.visit_id]; const tm = v ? new Date(v.started_at) : new Date();
          const folder = `${String(tm.getHours()).padStart(2, '0')}${String(tm.getMinutes()).padStart(2, '0')}-${v?.code || r.visit_id.slice(0, 6)}`;
          zip.file(r.kind === 'strip' ? `papers/${folder}.jpg` : `photos/${folder}/photo-${r.idx + 1}.jpg`, blob);
          btn.innerHTML = `<span class="spin"></span>${++done} / ${rows.length}`;
        }));
      }
      btn.innerHTML = '<span class="spin"></span>Zipping';
      const out = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(out); a.download = `PolaReady - ${ev.name}.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Download started');
    } catch (e) { fail(e); }
    busy(btn, false);
  }

  /* ---- setup & files ---- */
  async function tabSetup(t, ev) {
    let c = JSON.parse(JSON.stringify(ev.config)); const saved = JSON.stringify(c);
    const [{ data: files }, { data: booths }, { data: tpls }] = await Promise.all([
      sb.storage.from('event-files').list(ev.id), sb.from('booths').select('*').order('created_at'), sb.from('templates').select('id,name,config').order('created_at', { ascending: false }),
    ]);
    const fileList = (files || []).filter((f) => f.name !== '.emptyFolderPlaceholder');
    const pngs = fileList.filter((f) => /\.png$/i.test(f.name));
    let overlayURL = null;
    if (c.overlay && pngs.some((f) => f.name === c.overlay)) overlayURL = (await sb.storage.from('event-files').createSignedUrl(`${ev.id}/${c.overlay}`, 3600)).data?.signedUrl;
    const assigned = (booths || []).filter((b) => b.active_event_id === ev.id);

    t.innerHTML = `<div class="setup"><div>
      <div class="card" data-a>
        <div class="sec">The paper</div>
        <div class="line"><span>Photos per paper<small>Every guest gets this many shots.</small></span><div class="seg" id="pc">${[3, 4, 5].map((n) => `<button data-n="${n}" class="${c.photo_count === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="line"><span>Guests can change it<small>Off keeps every paper the same.</small></span><button class="tog ${c.lock_count ? '' : 'on'}" id="lc" aria-label="Guests can change photo count"></button></div>
        <div class="line" style="align-items:flex-start;flex-direction:column"><span>Paper colour<small>Pick one, or set exact colours from the invitation.</small></span>
          <div class="sws" id="sws">${PAPERS.map((p, i) => `<button class="sw" data-i="${i}" title="${p.n}" style="background:${p.bg}"></button>`).join('')}</div>
          <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:4px"><label class="colorin"><input type="color" id="cbg"><input class="inp" id="tbg" maxlength="7"><small class="soft">Paper</small></label>
          <label class="colorin"><input type="color" id="cink"><input class="inp" id="tink" maxlength="7"><small class="soft">Writing</small></label></div></div>
        <div class="line"><span>Only this paper colour<small>Hide the other colours from guests.</small></span><button class="tog ${c.lock_paper ? 'on' : ''}" id="lp" aria-label="Only this paper colour"></button></div>
        <div class="sec">The words</div>
        <label class="field"><span>Names / title</span><input class="inp" id="ti" value="${esc(c.title)}" maxlength="40" placeholder="Sara & Omar"></label>
        <div class="f2"><label class="field"><span>Date on paper</span><input class="inp" id="dt" value="${esc(c.date_text)}" maxlength="24" placeholder="07 · 11 · 2026"></label>
        <label class="field"><span>Message</span><input class="inp" id="ms" value="${esc(c.message)}" maxlength="60"></label></div>
        <div class="sec">The booth</div>
        <div class="line"><span>Voice says “Smile!”</span><button class="tog ${c.voice ? 'on' : ''}" id="vo" aria-label="Voice"></button></div>
        <div class="line"><span>Countdown</span><div class="seg" id="cd">${[3, 5].map((n) => `<button data-n="${n}" class="${c.countdown === n ? 'on' : ''}">${n}s</button>`).join('')}</div></div>
        <div class="line" style="align-items:flex-start;flex-direction:column"><span>Filters guests can pick</span><div class="fl" id="fl">${FILTERS.map((f) => `<button data-f="${esc(f)}" class="${c.filters.includes(f) ? 'on' : ''}">${esc(f)}</button>`).join('')}</div></div>
      </div>
      <div class="card" data-a style="margin-top:16px">
        <h3>Files <span class="mono soft">${fileList.length} file${fileList.length === 1 ? '' : 's'}</span></h3>
        <div class="files" id="files">${fileList.map((f) => `<div class="file"><span class="ic">${(f.name.split('.').pop() || '').toUpperCase()}</span><div class="t"><b>${esc(f.name)}</b><small>${f.metadata?.size ? Math.round(f.metadata.size / 1024) + ' KB' : ''}${c.overlay === f.name ? ' · on the paper' : ''}</small></div>
          ${/\.png$/i.test(f.name) ? `<button class="btn ghost sm" data-ov="${esc(f.name)}">${c.overlay === f.name ? 'Remove from paper' : 'Use on paper'}</button>` : ''}<button class="btn danger sm" data-del="${esc(f.name)}">Delete</button></div>`).join('')}</div>
        <label class="drop" id="drop" style="margin-top:10px;display:block"><input type="file" id="fi" multiple hidden accept="image/png,image/jpeg,application/pdf">Drop a file here or tap to upload<br><small>A transparent PNG at 600 × 1800 px can be laid over the whole paper.</small></label>
      </div></div>
      <div class="prev"><div class="card" data-a><h3>Preview <span class="mono soft">v${ev.config_version}</span></h3>
        <div class="stage"><div class="paper" id="pp"></div></div>
        <div class="acts" style="margin-top:14px"><button class="btn gold" id="send">Send to booth</button><button class="btn ghost" id="sys">${IC.dl.replace('<svg', '<svg width="17" height="17"')}System file</button></div>
        <div class="soft" style="font-size:13px;margin-top:10px" id="assigned">${assigned.length ? 'On booth: ' + assigned.map((b) => esc(b.name)).join(', ') + '. The iPad picks up changes on its welcome screen within a minute.' : 'Not on a booth yet.'}</div>
        <div class="acts" style="margin-top:12px">${(tpls || []).length ? `<select class="inp" id="tsel" style="flex:1;min-width:150px"><option value="">Use a template…</option>${tpls.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>` : ''}<button class="btn ghost sm" id="savet">Save as template</button></div>
      </div></div></div>
      <div class="savebar" id="sb"><span>You have unsaved changes</span><div class="acts"><button class="btn ghost sm" id="undo" style="background:transparent;color:var(--cream);box-shadow:inset 0 0 0 1.5px rgba(245,239,235,.3)">Undo</button><button class="btn gold sm" id="save">Save</button></div></div>`;
    enter(t);

    const pp = $('#pp', t);
    const draw = () => {
      pp.style.background = c.paper.bg; pp.style.color = c.paper.ink;
      pp.innerHTML = `<div class="shots">${'<i></i>'.repeat(c.photo_count)}</div>
        <div class="ft"><div class="t">${c.message ? `<em>${esc(c.message)}</em>` : ''}<b>${esc(c.title || 'PolaReady')}</b><small>${esc(c.date_text)}</small></div></div>
        ${overlayURL ? `<img class="ov" src="${overlayURL}" alt="">` : ''}`;
      $('#cbg', t).value = c.paper.bg; $('#tbg', t).value = c.paper.bg.toUpperCase();
      $('#cink', t).value = c.paper.ink; $('#tink', t).value = c.paper.ink.toUpperCase();
      $$('#sws .sw', t).forEach((s) => s.classList.toggle('on', PAPERS[s.dataset.i].bg.toLowerCase() === c.paper.bg.toLowerCase() && PAPERS[s.dataset.i].ink.toLowerCase() === c.paper.ink.toLowerCase()));
      $('#sb', t).classList.toggle('show', JSON.stringify(c) !== saved);
    };
    const bump = () => { if (G && !reduce) G.fromTo(pp, { scale: 0.97 }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' }); };
    draw();
    $$('#pc button', t).forEach((b) => (b.onclick = () => { c.photo_count = +b.dataset.n; $$('#pc button', t).forEach((x) => x.classList.toggle('on', x === b)); draw(); bump(); if (G && !reduce) G.from($$('.shots i', pp), { scaleY: 0, transformOrigin: 'top', duration: 0.4, stagger: 0.05, ease: 'power3.out' }); }));
    $$('#cd button', t).forEach((b) => (b.onclick = () => { c.countdown = +b.dataset.n; $$('#cd button', t).forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
    const tog = (id, fn) => ($(id, t).onclick = (e) => { e.currentTarget.classList.toggle('on'); fn(e.currentTarget.classList.contains('on')); draw(); bump(); });
    tog('#lc', (on) => (c.lock_count = !on)); tog('#lp', (on) => (c.lock_paper = on)); tog('#vo', (on) => (c.voice = on));
    $$('#sws .sw', t).forEach((s) => (s.onclick = () => { const p = PAPERS[s.dataset.i]; c.paper = { bg: p.bg, ink: p.ink }; draw(); bump(); }));
    const hex = (v) => /^#[0-9a-f]{6}$/i.test(v);
    $('#cbg', t).oninput = (e) => { c.paper.bg = e.target.value; draw(); };
    $('#cink', t).oninput = (e) => { c.paper.ink = e.target.value; draw(); };
    $('#tbg', t).onchange = (e) => { if (hex(e.target.value)) { c.paper.bg = e.target.value; draw(); } };
    $('#tink', t).onchange = (e) => { if (hex(e.target.value)) { c.paper.ink = e.target.value; draw(); } };
    [['#ti', 'title'], ['#dt', 'date_text'], ['#ms', 'message']].forEach(([id, k]) => ($(id, t).oninput = (e) => { c[k] = e.target.value; draw(); }));
    $$('#fl button', t).forEach((b) => (b.onclick = () => {
      const f = b.dataset.f; const on = c.filters.includes(f);
      if (on && c.filters.length === 1) return toast('Keep at least one filter');
      c.filters = on ? c.filters.filter((x) => x !== f) : FILTERS.filter((x) => c.filters.includes(x) || x === f);
      b.classList.toggle('on', !on); draw();
    }));
    $('#undo', t).onclick = () => viewEvent(ev.id, 'setup');
    const save = async () => {
      const b = $('#save', t); busy(b, true);
      const { error } = await sb.from('events').update({ config: c, config_version: ev.config_version + 1 }).eq('id', ev.id);
      busy(b, false);
      if (error) return fail(error);
      toast('Saved. Booths update on their welcome screen.'); viewEvent(ev.id, 'setup');
    };
    $('#save', t).onclick = save;
    $('#sys', t).onclick = () => {
      const file = { polaready: 'system-file', version: ev.config_version, event: { id: ev.id, name: ev.name, starts_at: ev.starts_at }, config: c, files: fileList.map((f) => f.name) };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
      a.download = `${ev.name.replace(/[^\w\- ]+/g, '').trim() || 'event'} - system file.json`; a.click();
    };
    $('#send', t).onclick = () => sendToBooth(ev, booths || []);
    $('#savet', t).onclick = async () => {
      const m = modal(`<h2>Save as template</h2><div class="sub">Reuse this setup for the next client in seconds.</div><form id="tf"><label class="field"><span>Template name</span><input class="inp" name="n" value="${esc(ev.name)}" required></label><div class="acts"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save template</button></div></form>`);
      $('#tf', m.el).onsubmit = async (e) => {
        e.preventDefault(); const cfg = { ...c, title: '', date_text: '', overlay: null };
        const { error } = await sb.from('templates').insert({ name: new FormData(e.target).get('n'), config: cfg });
        if (error) return fail(error); m.close(); toast('Template saved');
      };
    };
    $('#tsel', t)?.addEventListener('change', (e) => {
      const tp = (tpls || []).find((x) => x.id === e.target.value); if (!tp) return;
      c = { ...DEF(), ...tp.config, title: c.title, date_text: c.date_text, overlay: c.overlay };
      t.querySelectorAll('.seg button,.tog,#fl button').forEach(() => {});
      $$('#pc button', t).forEach((x) => x.classList.toggle('on', +x.dataset.n === c.photo_count));
      $$('#cd button', t).forEach((x) => x.classList.toggle('on', +x.dataset.n === c.countdown));
      $('#lc', t).classList.toggle('on', !c.lock_count); $('#lp', t).classList.toggle('on', c.lock_paper); $('#vo', t).classList.toggle('on', c.voice);
      $$('#fl button', t).forEach((x) => x.classList.toggle('on', c.filters.includes(x.dataset.f)));
      $('#ms', t).value = c.message; draw(); bump(); toast(`Template “${tp.name}” applied. Save to keep it.`);
    });
    // files
    const upload = async (list) => {
      for (const f of list) {
        if (f.size > 15 * 1024 * 1024) { toast(`${f.name} is over 15 MB`); continue; }
        const name = f.name.replace(/[^\w.\- ]+/g, '_');
        toast(`Uploading ${name}…`);
        const { error } = await sb.storage.from('event-files').upload(`${ev.id}/${name}`, f, { upsert: true, contentType: f.type || undefined });
        if (error) return fail(error);
      }
      await sb.from('events').update({ config_version: ev.config_version + 1 }).eq('id', ev.id);
      toast('Uploaded'); viewEvent(ev.id, 'setup');
    };
    $('#fi', t).onchange = (e) => upload([...e.target.files]);
    const drop = $('#drop', t);
    ['dragenter', 'dragover'].forEach((k) => drop.addEventListener(k, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((k) => drop.addEventListener(k, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => upload([...e.dataTransfer.files]));
    $$('[data-del]', t).forEach((b) => (b.onclick = async () => {
      const n = b.dataset.del;
      const m = modal(`<h2>Delete ${esc(n)}?</h2><div class="sub">The booth will stop using it the next time it updates.</div><div class="acts"><button class="btn ghost" data-close>Keep it</button><button class="btn danger" id="yes">Delete</button></div>`);
      $('#yes', m.el).onclick = async () => {
        const { error } = await sb.storage.from('event-files').remove([`${ev.id}/${n}`]); if (error) return fail(error);
        const patch = { config_version: ev.config_version + 1 }; if (c.overlay === n) patch.config = { ...ev.config, overlay: null };
        await sb.from('events').update(patch).eq('id', ev.id); m.close(); toast('Deleted'); viewEvent(ev.id, 'setup');
      };
    }));
    $$('[data-ov]', t).forEach((b) => (b.onclick = async () => {
      const n = b.dataset.ov; const cfg = { ...ev.config, overlay: ev.config.overlay === n ? null : n };
      const { error } = await sb.from('events').update({ config: cfg, config_version: ev.config_version + 1 }).eq('id', ev.id);
      if (error) return fail(error); toast(cfg.overlay ? 'Laid over the paper' : 'Removed from the paper'); viewEvent(ev.id, 'setup');
    }));
  }

  // Which booth works this event, right under the event's name: the booths on
  // it (online or not, removable) and a picker to add another.
  async function drawBoothBox(box, ev) {
    if (!box) return;
    const { data: booths } = await sb.from('booths').select('*').order('created_at');
    const on = (b) => b.last_seen && Date.now() - new Date(b.last_seen) < 3 * 60e3;
    const mine = (booths || []).filter((b) => b.active_event_id === ev.id);
    const others = (booths || []).filter((b) => b.active_event_id !== ev.id);
    box.className = 'bbox';
    box.innerHTML = `<span class="mono soft">Booth</span>
      ${mine.length ? mine.map((b) => `<span class="bchip"><span class="dot ${on(b) ? 'on' : ''}"></span>${esc(b.name)}<small>${on(b) ? 'online' : b.last_seen ? 'seen ' + ago(b.last_seen) : 'not connected yet'}</small><button data-off="${b.id}" aria-label="Take ${esc(b.name)} off this event">×</button></span>`).join('')
        : '<span class="soft">No booth on this event yet</span>'}
      ${(booths || []).length ? (others.length ? `<select class="inp bsel" aria-label="Add a booth"><option value="">${mine.length ? '+ Add another booth' : 'Choose a booth…'}</option>${others.map((b) => `<option value="${b.id}">${esc(b.name)}${b.active_event_id ? ' (moves from another event)' : ''}</option>`).join('')}</select>` : '')
        : '<a class="btn ghost sm" href="#/booths">Add your first booth</a>'}`;
    $$('[data-off]', box).forEach((x) => (x.onclick = async () => {
      const b = booths.find((y) => y.id === x.dataset.off);
      const { error } = await sb.from('booths').update({ active_event_id: null }).eq('id', b.id);
      if (error) return fail(error); toast(`${b.name} is free`); drawBoothBox(box, ev);
    }));
    $('.bsel', box)?.addEventListener('change', async (e) => {
      const b = booths.find((y) => y.id === e.target.value); if (!b) return;
      const { error } = await sb.from('booths').update({ active_event_id: ev.id }).eq('id', b.id);
      if (error) return fail(error);
      if (ev.status === 'design') { await sb.from('events').update({ status: 'ready' }).eq('id', ev.id); ev.status = 'ready'; }
      toast(`${b.name} is on this event. The iPad switches on its welcome screen.`);
      drawBoothBox(box, ev);
      if (G && !reduce) G.from($$('.bchip', box).pop(), { scale: 0.8, opacity: 0, duration: 0.5, ease: 'back.out(2.5)' });
    });
  }

  function sendToBooth(ev, booths) {
    if (!booths.length) {
      const m = modal(`<h2>No booths yet</h2><div class="sub">Add your iPad as a booth first. It takes a minute.</div><div class="acts"><button class="btn ghost" data-close>Later</button><a class="btn" href="#/booths" data-close>Add a booth</a></div>`);
      return m;
    }
    const m = modal(`<h2>Send to booth</h2><div class="sub">The booth switches to <b>${esc(ev.name)}</b> on its welcome screen, never in the middle of a guest's photos.</div>
      <div class="rows">${booths.map((b) => `<div class="row"><div class="l"><b>${esc(b.name)}</b><small>${b.active_event_id === ev.id ? 'Already on this event' : b.active_event_id ? 'On another event' : 'Free'} · seen ${ago(b.last_seen)}</small></div>
      <button class="btn sm ${b.active_event_id === ev.id ? 'ghost' : ''}" data-b="${b.id}">${b.active_event_id === ev.id ? 'Take off' : 'Send'}</button></div>`).join('')}</div>
      <div class="acts"><button class="btn ghost" data-close>Done</button></div>`);
    $$('[data-b]', m.el).forEach((b) => (b.onclick = async () => {
      const booth = booths.find((x) => x.id === b.dataset.b); const off = booth.active_event_id === ev.id;
      busy(b, true);
      const { error } = await sb.from('booths').update({ active_event_id: off ? null : ev.id }).eq('id', booth.id);
      if (error) { busy(b, false); return fail(error); }
      if (!off && ev.status !== 'live' && ev.status !== 'done') await sb.from('events').update({ status: 'ready' }).eq('id', ev.id);
      m.close(); toast(off ? `${booth.name} is free` : `Sent to ${booth.name}`); route();
    }));
  }

  /* ---- client & payment ---- */
  async function tabClient(t, ev) {
    t.innerHTML = `<form class="grid2" id="cf">
      <div class="card" data-a><h3>The event</h3>
        <label class="field"><span>Event name</span><input class="inp" name="name" value="${esc(ev.name)}" required></label>
        <div class="f2"><label class="field"><span>Starts</span><input class="inp" type="datetime-local" name="starts_at" value="${toLocalInput(ev.starts_at)}"></label>
        <label class="field"><span>Ends</span><input class="inp" type="datetime-local" name="ends_at" value="${toLocalInput(ev.ends_at)}"></label></div>
        <label class="field"><span>Venue</span><input class="inp" name="venue" value="${esc(ev.venue)}"></label>
        <div class="f2"><label class="field"><span>Booth host</span><input class="inp" name="host_name" value="${esc(ev.host_name)}"></label>
        <label class="field"><span>Paper loaded (sheets)</span><input class="inp" type="number" min="0" name="paper_start" value="${ev.paper_start ?? ''}" placeholder="e.g. 300"></label></div>
        <label class="field"><span>Notes</span><textarea class="inp" name="notes">${esc(ev.notes)}</textarea></label></div>
      <div class="card" data-a><h3>Client &amp; payment</h3>
        <label class="field"><span>Client name</span><input class="inp" name="client_name" value="${esc(ev.client_name)}"></label>
        <label class="field"><span>Phone / WhatsApp</span><input class="inp" type="tel" name="client_phone" value="${esc(ev.client_phone)}"></label>
        <div class="f2"><label class="field"><span>Price (JD)</span><input class="inp" type="number" min="0" step="1" name="price" value="${ev.price}"></label>
        <label class="field"><span>Deposit paid (JD)</span><input class="inp" type="number" min="0" step="1" name="deposit" value="${ev.deposit}"></label></div>
        <div class="line"><span>Fully paid</span><button type="button" class="tog ${ev.paid ? 'on' : ''}" id="pd" aria-label="Fully paid"></button></div>
        <div class="kpi dark" style="margin-top:12px"><small>Still to collect</small><b id="due">${fmt(ev.paid ? 0 : Math.max(0, ev.price - ev.deposit))} JD</b></div>
        ${ev.client_phone ? `<a class="btn ghost full" style="margin-top:12px" target="_blank" rel="noopener" href="https://wa.me/${esc(String(ev.client_phone).replace(/\D/g, ''))}">Message on WhatsApp</a>` : ''}
        <button class="btn full" style="margin-top:10px">Save</button></div></form>`;
    enter(t);
    let paid = ev.paid; const f = $('#cf', t);
    const due = () => { const p = +f.price.value || 0, d = +f.deposit.value || 0; $('#due', t).textContent = `${fmt(paid ? 0 : Math.max(0, p - d))} JD`; };
    f.price.oninput = due; f.deposit.oninput = due;
    $('#pd', t).onclick = (e) => { paid = !paid; e.currentTarget.classList.toggle('on', paid); due(); };
    f.onsubmit = async (e) => {
      e.preventDefault(); const d = new FormData(f); const b = $('button.btn.full:last-child', f); busy(b, true);
      const patch = { name: d.get('name'), starts_at: fromLocalInput(d.get('starts_at')), ends_at: fromLocalInput(d.get('ends_at')), venue: d.get('venue') || null, host_name: d.get('host_name') || null,
        paper_start: d.get('paper_start') === '' ? null : +d.get('paper_start'), notes: d.get('notes') || null, client_name: d.get('client_name') || null, client_phone: d.get('client_phone') || null,
        price: +d.get('price') || 0, deposit: +d.get('deposit') || 0, paid };
      const { error } = await sb.from('events').update(patch).eq('id', ev.id); busy(b, false);
      if (error) return fail(error); toast('Saved'); $('#view').dataset.event = ''; viewEvent(ev.id, 'client');
    };
  }

  /* ---- checklist ---- */
  async function tabChecklist(t, ev) {
    const ck = { ...(ev.checklist || {}) };
    const pct = () => Math.round((CHECK.filter((x) => ck[x]).length / CHECK.length) * 100);
    t.innerHTML = `<div class="card" data-a style="max-width:640px"><h3>Event-night checklist <span class="mono soft" id="pct">${pct()}%</span></h3>
      <div class="progress"><i style="width:${pct()}%"></i></div>
      <div style="margin-top:10px">${CHECK.map((x) => `<div class="chk ${ck[x] ? 'on' : ''}" data-c="${esc(x)}" role="checkbox" aria-checked="${!!ck[x]}" tabindex="0"><span class="bx">${IC.check}</span><span>${esc(x)}</span></div>`).join('')}</div></div>`;
    enter(t);
    $$('.chk', t).forEach((r) => {
      const go = async () => {
        const k = r.dataset.c; ck[k] = !ck[k]; r.classList.toggle('on', ck[k]); r.setAttribute('aria-checked', ck[k]);
        if (ck[k] && G && !reduce) G.fromTo($('.bx', r), { scale: 0.7 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
        $('#pct', t).textContent = pct() + '%'; $('.progress i', t).style.width = pct() + '%';
        if (pct() === 100) toast('All set for tonight 🎉');
        const { error } = await sb.from('events').update({ checklist: ck }).eq('id', ev.id); if (error) fail(error);
      };
      r.onclick = go; r.onkeydown = (e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), go());
    });
  }

  /* ---------------- booths ---------------- */
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newKey = () => { const b = crypto.getRandomValues(new Uint8Array(20)); return [...b].map((x) => ALPHA[x % 32]).join(''); };
  const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const groupKey = (k) => k.match(/.{1,5}/g).join('-');

  async function viewBooths() {
    const v = shell('booths');
    const [{ data: booths, error }, { data: evs }] = await Promise.all([sb.from('booths').select('*').order('created_at'), sb.from('events').select('id,name,status')]);
    if (error) return fail(error);
    const evName = (id) => evs?.find((e) => e.id === id)?.name;
    const on = (b) => b.last_seen && Date.now() - new Date(b.last_seen) < 3 * 60e3;
    v.innerHTML = `<div class="top"><div><h1 data-a>Booths</h1><div class="sub" data-a>Each iPad gets its own key. Type it once in the booth's Settings → Cloud.</div></div>
      <div class="acts" data-a><button class="btn" id="add">${IC.plus.replace('<svg', '<svg width="18" height="18"')}Add a booth</button></div></div>
      ${(booths || []).length ? `<div class="grid3">${booths.map((b) => `<div class="card" data-a><h3><span><span class="dot ${on(b) ? 'on' : ''}"></span>${esc(b.name)}</span>${on(b) ? '<span class="st live">Online</span>' : ''}</h3>
        <div class="rows"><div class="row"><div class="l"><small>Event</small><b>${b.active_event_id ? `<a href="#/event/${b.active_event_id}/overview">${esc(evName(b.active_event_id) || 'Unknown')}</a>` : 'None'}</b></div></div>
        <div class="row"><div class="l"><small>Last seen</small><b>${ago(b.last_seen)}</b></div></div>
        <div class="row"><div class="l"><small>App</small><b>${esc(b.app_version || '–')}</b></div></div></div>
        <div class="acts" style="margin-top:12px"><button class="btn ghost sm" data-rk="${b.id}">New key</button><button class="btn danger sm" data-rm="${b.id}">Remove</button></div></div>`).join('')}</div>`
        : `<div class="card empty" data-a><div class="mk"></div><b>No booths yet</b>Add your iPad, then send an event to it.</div>`}`;
    enter(v);
    const showKey = (name, key) => {
      const m = modal(`<h2>${esc(name)}'s key</h2><div class="sub">On the iPad open <b>Settings → Cloud</b> and type this key. It's shown only once, but you can make a new one any time.</div>
        <div class="key">${groupKey(key)}</div><div class="acts"><button class="btn ghost" id="ck">Copy</button><button class="btn" data-close>Done</button></div>`);
      if (G && !reduce) G.from($('.key', m.el), { letterSpacing: '0.4em', opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.15 });
      $('#ck', m.el).onclick = () => { navigator.clipboard?.writeText(groupKey(key)); toast('Key copied'); };
      return m;
    };
    $('#add', v).onclick = () => {
      const m = modal(`<h2>Add a booth</h2><div class="sub">Give this iPad a name you'll recognise.</div><form id="bf"><label class="field"><span>Name</span><input class="inp" name="n" value="Booth ${(booths || []).length + 1}" required></label>
        <div class="acts"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Create key</button></div></form>`);
      $('#bf', m.el).onsubmit = async (e) => {
        e.preventDefault(); const name = new FormData(e.target).get('n'); const key = newKey();
        const { error: er } = await sb.from('booths').insert({ name, token_hash: await sha256(key) });
        if (er) return fail(er); m.close(); viewBooths(); setTimeout(() => showKey(name, key), 250);
      };
    };
    $$('[data-rk]', v).forEach((b) => (b.onclick = async () => {
      const booth = booths.find((x) => x.id === b.dataset.rk);
      const m = modal(`<h2>Make a new key?</h2><div class="sub">${esc(booth.name)} stops syncing until you type the new key on its iPad.</div><div class="acts"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="yes">New key</button></div>`);
      $('#yes', m.el).onclick = async () => { const key = newKey(); const { error: er } = await sb.from('booths').update({ token_hash: await sha256(key) }).eq('id', booth.id); if (er) return fail(er); m.close(); setTimeout(() => showKey(booth.name, key), 250); };
    }));
    $$('[data-rm]', v).forEach((b) => (b.onclick = () => {
      const booth = booths.find((x) => x.id === b.dataset.rm);
      const m = modal(`<h2>Remove ${esc(booth.name)}?</h2><div class="sub">Its photos stay. The iPad just stops syncing.</div><div class="acts"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="yes">Remove</button></div>`);
      $('#yes', m.el).onclick = async () => { const { error: er } = await sb.from('booths').delete().eq('id', booth.id); if (er) return fail(er); m.close(); toast('Removed'); viewBooths(); };
    }));
  }

  /* ---------------- templates ---------------- */
  async function viewTemplates() {
    const v = shell('templates');
    const { data: tpls, error } = await sb.from('templates').select('*').order('created_at', { ascending: false });
    if (error) return fail(error);
    v.innerHTML = `<div class="top"><div><h1 data-a>Templates</h1><div class="sub" data-a>Save a setup from any event and start the next one from it.</div></div></div>
      ${(tpls || []).length ? `<div class="strips" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">${tpls.map((x) => { const c = { ...DEF(), ...x.config }; return `<div class="card" data-a style="padding:14px">
        <div class="stage" style="min-height:0;padding:16px"><div class="paper" style="width:70px;height:210px;padding:4px 4px 0;gap:3px;background:${esc(c.paper.bg)};color:${esc(c.paper.ink)}"><div class="shots" style="gap:3px">${'<i></i>'.repeat(c.photo_count)}</div><div class="ft" style="height:30px"><b style="font-size:7px">Names</b></div></div></div>
        <b style="display:block;margin-top:10px">${esc(x.name)}</b><small class="soft">${c.photo_count} photos per paper</small>
        <div class="acts" style="margin-top:8px"><button class="btn danger sm" data-rm="${x.id}">Delete</button></div></div>`; }).join('')}</div>`
        : `<div class="card empty" data-a><div class="mk"></div><b>No templates yet</b>Open an event's Setup &amp; files and tap “Save as template”.</div>`}`;
    enter(v);
    $$('[data-rm]', v).forEach((b) => (b.onclick = async () => { const { error: er } = await sb.from('templates').delete().eq('id', b.dataset.rm); if (er) return fail(er); toast('Template deleted'); viewTemplates(); }));
  }

  /* ---------------- router ---------------- */
  async function route() {
    // A dialog belongs to the screen that opened it.
    $$('.scrim').forEach((x) => x.parentNode.removeChild(x));
    if (!user) return renderLogin();
    const [, r, id, tab] = (location.hash || '#/events').split('/');
    if (r !== 'event' && $('#view')) $('#view').dataset.event = '';
    cleanup();
    if (r === 'event' && id) return viewEvent(id, tab);
    if (r === 'calendar') return viewCalendar();
    if (r === 'booths') return viewBooths();
    if (r === 'templates') return viewTemplates();
    return viewEvents();
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { movePill($('.nav'), $('.nav a.on')); const tb = $('.tabs'); if (tb) movePill(tb, $('.tabs a.on')); });

  // Supabase warns against awaiting its own calls inside this callback (it can
  // deadlock the auth lock), so the real work runs on the next tick.
  let checked = null; let loginMsg = '';
  sb.auth.onAuthStateChange((_e, session) => setTimeout(async () => {
    const next = session?.user || null;
    if (next?.id === user?.id && checked !== null) return;
    user = next;
    if (!user) { checked = null; app.innerHTML = ''; renderLogin(loginMsg); loginMsg = ''; return; }
    const { data: isAdmin } = await sb.rpc('is_admin');
    checked = !!isAdmin;
    if (!isAdmin) { loginMsg = 'This account isn’t a PolaReady admin.'; user = null; checked = null; await sb.auth.signOut(); renderLogin(loginMsg); return; }
    app.innerHTML = ''; route();
  }, 0));
})();
