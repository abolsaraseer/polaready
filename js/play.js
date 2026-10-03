/* ==========================================================================
   PolaReady — the interactive bits
   Toys, not scroll choreography (that's motion.js / home.js). Each one only
   switches on if its markup is on the page, so one file serves the home
   page, the story and the brand kit:
     - bears whose eyes follow the pointer      [data-eyes]
     - snow that scatters from the pointer      .snow (story, brand kit)
     - the polaroid you shoot and throw         .pcard (story)
     - the filter lens you drag                 .sci-fig (story)
     - Pola and Ready, throwable                .pr (story)
     - shuffle + copy for the caption cards     .says (story)
     - contrast lab, type tester, mark
       playground, caption slot machine         .cl / .tt / .mp / .cs (brand kit)
   Pointer-only flourishes stay off for touch and reduced motion; the
   practical tools (contrast lab, type tester...) work everywhere.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  var gsap = window.gsap || null;
  if (gsap) {
    if (window.Draggable) gsap.registerPlugin(window.Draggable);
    if (window.InertiaPlugin) gsap.registerPlugin(window.InertiaPlugin);
    if (window.Flip) gsap.registerPlugin(window.Flip);
  }
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var PR = function () { return window.PolaReady || {}; };
  var copy = function (text) { if (PR().copy) PR().copy(text); };

  /* --------------------------------------------------------------- flash
     A page-wide camera flash, used by the polaroid. */
  var flashEl = null;
  function flash() {
    if (reduced) return;
    if (!flashEl) { flashEl = doc.createElement('div'); flashEl.className = 'pageflash'; flashEl.setAttribute('aria-hidden', 'true'); doc.body.appendChild(flashEl); }
    flashEl.classList.remove('pop'); void flashEl.offsetWidth; flashEl.classList.add('pop');
  }

  /* --------------------------------------------------------------- burst
     A puff of coloured dots from a point - snow, confetti, paint. */
  function burst(x, y, colours, n) {
    if (reduced || !gsap) return;
    n = n || 18;
    for (var i = 0; i < n; i++) {
      var d = doc.createElement('i');
      d.className = 'burstdot';
      d.style.background = colours[i % colours.length];
      var s = 5 + Math.random() * 9;
      d.style.width = d.style.height = s + 'px';
      d.style.left = x + 'px'; d.style.top = y + 'px';
      doc.body.appendChild(d);
      var a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 110;
      gsap.fromTo(d, { x: 0, y: 0, scale: 1, opacity: 1 }, {
        x: Math.cos(a) * r, y: Math.sin(a) * r + 30, scale: 0, opacity: 0.2, duration: 0.8 + Math.random() * 0.6, ease: 'power3.out',
        onComplete: (function (el) { return function () { el.remove(); }; })(d)
      });
    }
  }

  /* ---------------------------------------------------------------- eyes
     The mark is a CSS mask, so nothing can be drawn inside it. Instead an
     overlay the same size, offset and transform sits on top of it carrying
     two catchlights placed on the mark's eyes (measured from the logo: 38.8%
     and 60.8% across, 48.9% down), which slide toward the pointer. */
  var EYES = [[0.388, 0.489], [0.608, 0.489]];
  var watchers = [];
  function setupEyes() {
    if (!fine || reduced || !gsap) return;
    $$('[data-eyes]').forEach(function (mark) {
      var host = mark.parentNode;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      var ov = doc.createElement('span');
      ov.className = 'eyes'; ov.setAttribute('aria-hidden', 'true');
      ov.style.setProperty('--catch', mark.getAttribute('data-eyes') === 'navy' ? '#2f4156' : '#f5efeb');
      ov.innerHTML = '<i></i><i></i>';
      host.insertBefore(ov, mark.nextSibling);
      var pupils = $$('i', ov).map(function (p) { return { x: gsap.quickTo(p, 'x', { duration: 0.35, ease: 'power3' }), y: gsap.quickTo(p, 'y', { duration: 0.35, ease: 'power3' }) }; });
      watchers.push({ mark: mark, ov: ov, pupils: pupils, live: true });
    });
    if (!watchers.length) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { watchers.forEach(function (w) { if (w.mark === e.target) w.live = e.isIntersecting; }); }); });
      watchers.forEach(function (w) { io.observe(w.mark); });
    }
    var px = innerWidth / 2, py = innerHeight / 2;
    window.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; }, { passive: true });
    gsap.ticker.add(function () {
      watchers.forEach(function (w) {
        if (!w.live) return;
        var m = w.mark, cs = getComputedStyle(m);
        w.ov.style.left = m.offsetLeft + 'px'; w.ov.style.top = m.offsetTop + 'px';
        w.ov.style.width = m.offsetWidth + 'px'; w.ov.style.height = m.offsetHeight + 'px';
        w.ov.style.transform = cs.transform === 'none' ? '' : cs.transform;
        w.ov.style.opacity = cs.opacity;
        var r = w.ov.getBoundingClientRect();
        EYES.forEach(function (eye, i) {
          var ex = r.left + r.width * eye[0], ey = r.top + r.height * eye[1];
          var dx = px - ex, dy = py - ey, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
          w.pupils[i].x(dx / d * k * r.width * 0.022);
          w.pupils[i].y(dy / d * k * r.height * 0.014);
        });
      });
    });
  }

  /* ---------------------------------------------------------------- snow
     The hero snow, redrawn on a canvas so each flake can react: they drift
     down, slide away from the pointer, and a click in empty space throws a
     fresh puff of them. Only runs while the hero is on screen. */
  function setupSnow() {
    var host = $('.snow');
    if (!host || reduced) return;
    var sec = host.parentNode, cv = doc.createElement('canvas'), ctx = cv.getContext('2d');
    host.classList.add('live'); host.appendChild(cv);
    var W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), flakes = [], on = true, px = -999, py = -999;
    function size() { W = host.offsetWidth; H = host.offsetHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function flake(x, y, vx, vy) { return { x: x, y: y, vx: vx || 0, vy: vy || 0, r: 1.4 + Math.random() * 3.6, s: 0.25 + Math.random() * 0.7, ph: Math.random() * 6.28, a: 0.18 + Math.random() * 0.4 }; }
    size();
    for (var i = 0; i < 130; i++) flakes.push(flake(Math.random() * W, Math.random() * H));
    window.addEventListener('resize', size);
    sec.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; });
    sec.addEventListener('pointerleave', function () { px = py = -999; });
    sec.addEventListener('click', function (e) {
      if (e.target.closest('a, button, .pcard, .pdrag')) return;
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (var k = 0; k < 36; k++) { var a = Math.random() * 6.28, v = 2 + Math.random() * 5; flakes.push(flake(x, y, Math.cos(a) * v, Math.sin(a) * v - 2)); }
      if (flakes.length > 400) flakes.splice(0, flakes.length - 400);
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; }).observe(sec);
    var t = 0;
    (function loop() {
      requestAnimationFrame(loop);
      if (!on) return;
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      for (var i = flakes.length - 1; i >= 0; i--) {
        var f = flakes[i];
        var dx = f.x - px, dy = f.y - py, d2 = dx * dx + dy * dy;
        if (d2 < 15000) { var d = Math.sqrt(d2) || 1, push = (1 - d / 122) * 1.6; f.vx += dx / d * push; f.vy += dy / d * push; }
        f.vx *= 0.94; f.vy = f.vy * 0.94 + 0.02;
        f.x += f.vx + Math.sin(t * f.s * 2 + f.ph) * 0.35; f.y += f.vy + f.s;
        if (f.y > H + 10) { if (flakes.length > 130) { flakes.splice(i, 1); continue; } f.y = -10; f.x = Math.random() * W; f.vx = f.vy = 0; }
        if (f.x < -10) f.x = W + 10; else if (f.x > W + 10) f.x = -10;
        ctx.globalAlpha = f.a; ctx.fillStyle = '#3f7a9c';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
    })();
  }

  /* ------------------------------------------------------------ polaroid
     Tap it: the flash fires and the print develops again from white, onto
     a new sky. Drag it: it comes along, tilting with the throw, and springs
     back to the table when let go. */
  var SKIES = [
    { sky: '#d7e6ec', far: '#b6cdd9', near: '#8db0c4' },
    { sky: '#f3d9c4', far: '#e0b79a', near: '#c48f77' },
    { sky: '#e3d9f2', far: '#c4b3e0', near: '#9d86c4' },
    { sky: '#d9f0e3', far: '#aed8bf', near: '#7fb897' },
    { sky: '#2b3a52', far: '#4c6585', near: '#7b97b8', sun: '#ffd98a' },
    { sky: '#ffe2d6', far: '#f5b9a3', near: '#e08b74' }
  ];
  function setupPolaroid() {
    var drag = $('.pdrag'), card = $('.pcard'), svg = card && $('.photo svg', card);
    if (!drag || !card || !gsap) return;
    var n = 0;
    function shoot() {
      flash();
      n = (n + 1) % SKIES.length;
      var s = SKIES[n];
      ['sky', 'far', 'near', 'sun'].forEach(function (k) { if (s[k]) svg.style.setProperty('--' + k, s[k]); else svg.style.removeProperty('--' + k); });
      $$('.veil, .peek', card).forEach(function (el) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
      if (!reduced) gsap.fromTo(card, { scale: 0.94 }, { scale: 1, duration: 0.6, ease: 'back.out(3)', clearProps: 'scale' });
    }
    if (window.Draggable && !reduced) {
      window.Draggable.create(drag, {
        type: 'x,y', inertia: false, zIndexBoost: false,
        onPress: function () { gsap.killTweensOf(drag); },
        onDrag: function () { gsap.set(drag, { rotation: clamp(this.x * 0.06, -24, 24) }); },
        onRelease: function () { if (this.isDragging || Math.abs(this.x) + Math.abs(this.y) > 4) gsap.to(drag, { x: 0, y: 0, rotation: 0, duration: 1.3, ease: 'elastic.out(1,0.45)' }); },
        onClick: shoot
      });
    } else drag.addEventListener('click', shoot);
    drag.setAttribute('role', 'button'); drag.setAttribute('tabindex', '0');
    drag.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); shoot(); } });
  }

  /* ----------------------------------------------------------------- lens
     The glare/no-glare figure follows the scroll on its own (site.js); grab
     it and the lens is yours until you scroll the figure away again. */
  function setupLens() {
    var fig = $('.sci-fig');
    if (!fig) return;
    var down = false;
    function put(e) {
      var r = fig.getBoundingClientRect(), p = clamp((e.clientX - r.left) / r.width, 0, 1);
      fig.dataset.user = '1';
      fig.style.setProperty('--x', (p * 100).toFixed(1) + '%');
      fig.style.setProperty('--p', p.toFixed(3));
      fig.classList.add('touched');
    }
    fig.addEventListener('pointerdown', function (e) { down = true; fig.setPointerCapture(e.pointerId); put(e); });
    fig.addEventListener('pointermove', function (e) { if (down) put(e); });
    fig.addEventListener('pointerup', function () { down = false; });
    fig.addEventListener('pointercancel', function () { down = false; });
    fig.style.touchAction = 'pan-y';
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { if (!es[0].isIntersecting) delete fig.dataset.user; }).observe(fig);
  }

  /* ------------------------------------------------------- Pola + Ready
     Throw the two halves of the name around; they spring home, and the plus
     spins every time they land. Switched on only once the words have flown
     in, so dragging never fights their entrance. */
  function setupName() {
    var pr = $('.pr');
    if (!pr || !gsap || !window.Draggable || reduced) return;
    var parts = [$('.pola', pr), $('.ready', pr)], plus = $('.plus', pr), made = false;
    function make() {
      if (made) return; made = true;
      parts.forEach(function (el) {
        el.style.transition = 'none';
        el.setAttribute('data-cursor', 'p_throw');
        window.Draggable.create(el, {
          type: 'x,y', inertia: !!window.InertiaPlugin,
          onDrag: function () { gsap.set(el, { rotation: clamp(this.x * 0.08, -30, 30) }); },
          onRelease: function () { gsap.to(el, { x: 0, y: 0, rotation: 0, duration: 1.4, delay: 0.25, ease: 'elastic.out(1,0.35)', overwrite: 'auto' }); },
          onThrowComplete: function () { gsap.to(el, { x: 0, y: 0, rotation: 0, duration: 1.2, ease: 'elastic.out(1,0.35)' }); }
        });
        el.addEventListener('pointerup', function () { if (plus) { plus.style.transition = 'none'; gsap.fromTo(plus, { rotation: 0 }, { rotation: 360, duration: 0.9, ease: 'back.out(2)' }); } });
      });
    }
    var check = function () { if (pr.classList.contains('in')) setTimeout(make, 1500); else requestAnimationFrame(check); };
    check();
  }

  /* -------------------------------------------------- caption cards
     Every card copies its line on click; Shuffle deals them into a new
     order (the wide pitch line stays last) with a FLIP so each card travels
     from where it was to where it lands. */
  function setupSays() {
    var grid = $('.says');
    if (!grid) return;
    $$('.say', grid).forEach(function (c) {
      c.setAttribute('data-cursor', 'p_copy'); c.setAttribute('role', 'button'); c.setAttribute('tabindex', '0');
      var go = function (e) {
        var x = $('.x', c); copy(x ? x.textContent.trim() : '');
        var r = c.getBoundingClientRect();
        burst(e && e.clientX ? e.clientX : r.left + r.width / 2, e && e.clientY ? e.clientY : r.top + r.height / 2, ['#2f4156', '#3f7a9c', '#8fc2df', '#f5efeb'], 14);
      };
      c.addEventListener('click', go);
      c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    var btn = $('.shuffle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var cards = $$('.say:not(.wide)', grid), wide = $('.say.wide', grid);
      var state = window.Flip && !reduced ? window.Flip.getState($$('.say', grid)) : null;
      for (var i = cards.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = cards[i]; cards[i] = cards[j]; cards[j] = t; }
      cards.forEach(function (c) { grid.appendChild(c); });
      if (wide) grid.appendChild(wide);
      if (state) window.Flip.from(state, { duration: 0.85, ease: 'power3.inOut', stagger: 0.03, rotate: true, onEnter: null });
      var ic = $('.ic', btn); if (ic && gsap) gsap.fromTo(ic, { rotation: 0 }, { rotation: 360, duration: 0.7, ease: 'power3.out' });
    });
  }

  /* ========================================================= BRAND KIT */

  /* --------------------------------------------------------- contrast lab
     WCAG 2 relative luminance and contrast, computed live for whichever two
     palette colours are picked; the badges say exactly which uses pass. */
  function lum(hex) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b) { var la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
  function setupContrast() {
    var lab = $('.cl');
    if (!lab) return;
    var prev = $('.cl-prev', lab), num = $('.cl-num', lab), badges = $$('.cl-badges [data-min]', lab), verdict = $('.cl-verdict', lab);
    var pick = { fg: '#2f4156', bg: '#f5efeb' }, shown = { v: ratio(pick.fg, pick.bg) };
    function apply() {
      var r = ratio(pick.fg, pick.bg);
      prev.style.background = pick.bg; prev.style.color = pick.fg;
      badges.forEach(function (b) { b.classList.toggle('pass', r >= parseFloat(b.getAttribute('data-min'))); });
      verdict.textContent = r >= 7 ? 'Body text, any size' : r >= 4.5 ? 'Body text' : r >= 3 ? 'Large text and UI only' : pick.fg === pick.bg ? 'Same colour twice' : 'Decoration only';
      if (gsap && !reduced) gsap.to(shown, { v: r, duration: 0.6, ease: 'power3.out', onUpdate: function () { num.textContent = shown.v.toFixed(1); } });
      else num.textContent = r.toFixed(1);
    }
    $$('.cl-sw', lab).forEach(function (row) {
      var role = row.getAttribute('data-role');
      $$('button', row).forEach(function (b) {
        b.addEventListener('click', function () {
          pick[role] = b.getAttribute('data-c');
          $$('button', row).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          apply();
        });
      });
    });
    var swap = $('.cl-swap', lab);
    if (swap) swap.addEventListener('click', function () {
      var t = pick.fg; pick.fg = pick.bg; pick.bg = t;
      ['fg', 'bg'].forEach(function (role) { $$('.cl-sw[data-role="' + role + '"] button', lab).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-c') === pick[role])); }); });
      if (gsap && !reduced) gsap.fromTo(swap, { rotation: 0 }, { rotation: 180, duration: 0.5, ease: 'power3.out' });
      apply();
    });
    apply();
  }

  /* ---------------------------------------------------------- type tester */
  function setupType() {
    var tt = $('.tt');
    if (!tt) return;
    var stage = $('.tt-stage', tt), range = $('.tt-size input', tt), out = $('.tt-size output', tt);
    $$('.tt-fonts button', tt).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.tt-fonts button', tt).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        stage.style.fontFamily = b.getAttribute('data-f');
        stage.style.fontWeight = b.getAttribute('data-w') || '400';
        stage.dir = b.hasAttribute('data-rtl') ? 'rtl' : 'auto';
        if (b.hasAttribute('data-sample') && !stage.dataset.typed) stage.textContent = b.getAttribute('data-sample');
        if (gsap && !reduced) gsap.fromTo(stage, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' });
      });
    });
    stage.addEventListener('input', function () { stage.dataset.typed = '1'; });
    function sz() { stage.style.fontSize = range.value + 'px'; if (out) out.textContent = range.value + 'px'; }
    range.addEventListener('input', sz); sz();
  }

  /* ------------------------------------------------------ mark playground */
  function setupMarkPlay() {
    var mp = $('.mp');
    if (!mp) return;
    var stage = $('.mp-stage', mp), mark = $('.mp-mark', mp), range = $('.mp-size input', mp), space = $('.mp-space input', mp);
    $$('.mp-grounds button', mp).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.mp-grounds button', mp).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        stage.setAttribute('data-ground', b.getAttribute('data-g'));
        var w = $('.eyes', stage); if (w) w.style.setProperty('--catch', b.getAttribute('data-catch'));
        if (gsap && !reduced) gsap.fromTo(mark, { scale: 0.8, rotation: -10 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2)', clearProps: 'scale,rotation' });
      });
    });
    function sz() { stage.style.setProperty('--ms', range.value + '%'); }
    range.addEventListener('input', sz); sz();
    space.addEventListener('change', function () { stage.classList.toggle('show-space', space.checked); });
    var spin = $('.mp-spin', mp);
    if (spin) spin.addEventListener('click', function () { if (gsap && !reduced) gsap.fromTo(mark, { rotationY: 0 }, { rotationY: 360, duration: 1.1, ease: 'power3.inOut', clearProps: 'rotationY' }); });
  }

  /* ------------------------------------------------- caption slot machine */
  function setupSlots() {
    var cs = $('.cs');
    if (!cs) return;
    var reel = $('.cs-reel', cs), spin = $('.cs-spin', cs), cp = $('.cs-copy', cs);
    var lines = $$('.lib .line').map(function (l) { return l.getAttribute('data-copy'); }).filter(function (t) { return t && t.length < 100; });
    var current = lines[0];
    function fill(list) { reel.innerHTML = list.map(function (t) { var d = doc.createElement('div'); d.className = 'cs-line'; d.textContent = t; return d.outerHTML; }).join(''); }
    fill([current]);
    spin.addEventListener('click', function () {
      var pickI = Math.floor(Math.random() * lines.length);
      if (lines[pickI] === current) pickI = (pickI + 1) % lines.length;
      var list = [current];
      for (var i = 0; i < 16; i++) list.push(lines[Math.floor(Math.random() * lines.length)]);
      list.push(lines[pickI]);
      fill(list);
      current = lines[pickI];
      var h = $('.cs-line', reel).offsetHeight;
      if (gsap && !reduced) {
        gsap.fromTo(reel, { y: 0 }, { y: -h * (list.length - 1), duration: 1.8, ease: 'power4.out', onComplete: function () { fill([current]); gsap.set(reel, { y: 0 }); } });
        gsap.fromTo(spin, { rotation: -4 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.4)' });
      } else fill([current]);
    });
    cp.addEventListener('click', function (e) { copy(current); burst(e.clientX, e.clientY, ['#2f4156', '#3f7a9c', '#8fc2df'], 14); });
  }

  /* ---------------------------------------------- swatch paint splashes */
  function setupSwatches() {
    $$('.swatch').forEach(function (s) {
      s.addEventListener('click', function (e) { var c = s.getAttribute('data-copy'); burst(e.clientX, e.clientY, [c, c, '#3f7a9c'], 22); });
    });
  }

  function init() {
    setupEyes(); setupSnow(); setupPolaroid(); setupLens(); setupName(); setupSays();
    setupContrast(); setupType(); setupMarkPlay(); setupSlots(); setupSwatches();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
