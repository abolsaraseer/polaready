/* ==========================================================================
   PolaReady — home page choreography
   GSAP + ScrollTrigger + SplitText drive every scroll scene on the home page;
   site.js still owns language, nav, cursor, smooth scrolling (Lenis), the
   intro and the On Paper configurator. Everything is built inside one
   gsap.matchMedia() so a breakpoint change, or a language switch (which
   rewrites the text these scenes have split into letters), can revert the
   whole lot cleanly and build it again.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* no library, or motion turned off: drop .anim and the page simply stays in
     its fully readable static layout */
  if (reduced || !window.gsap || !window.ScrollTrigger) { root.classList.remove('anim'); return; }

  var gsap = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText || null;
  gsap.registerPlugin(ST);
  if (Split) gsap.registerPlugin(Split);
  ST.config({ ignoreMobileResize: true });

  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var isAR = function () { return root.getAttribute('lang') === 'ar'; };
  var dir = function () { return root.getAttribute('dir') === 'rtl' ? -1 : 1; };
  var fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  var mm = null, entered = false;

  /* letters for Latin; whole words for Arabic, whose letters join and must
     never be split apart */
  function split(el, extra) {
    if (!Split || !el) return null;
    return Split.create(el, Object.assign({
      type: isAR() ? 'words,lines' : 'chars,words,lines',
      mask: 'lines', linesClass: 'ln', aria: 'auto'
    }, extra || {}));
  }
  function units(s) { return s ? (isAR() || !s.chars.length ? s.words : s.chars) : []; }

  /* run fn once the intro's flash has handed over (site.js adds .go) */
  function onGo(fn) {
    if (root.classList.contains('go')) { fn(); return; }
    var mo = new MutationObserver(function () { if (root.classList.contains('go')) { mo.disconnect(); fn(); } });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  /* ------------------------------------------------------------------ hero */
  var FAN = [ { x: -1.12, r: -16, y: 34 }, { x: -0.38, r: -5.5, y: 6 }, { x: 0.38, r: 5.5, y: 6 }, { x: 1.12, r: 16, y: 34 } ];
  var DEPTH = [1.5, 0.8, 1.1, 1.8];

  function hero(desk, offs) {
    var sec = $('.hx'), title = $('.hx-title'), cards = $$('.hx-card');
    if (!sec || !cards.length) return;
    var s = split(title);
    var cw = cards[0].offsetWidth * (desk ? 0.74 : 0.7);

    cards.forEach(function (c, i) {
      gsap.set(c, { xPercent: -50, x: FAN[i].x * cw, y: FAN[i].y, rotation: FAN[i].r, transformOrigin: '50% 125%' });
    });

    var tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    tl.from(units(s), { yPercent: 115, rotation: isAR() ? 0 : 7, duration: 1.25, stagger: isAR() ? 0.08 : 0.024 }, 0)
      .from('.hx-up', { y: 28, autoAlpha: 0, duration: 1.1, stagger: 0.09 }, 0.35)
      .from(cards, { y: window.innerHeight * 0.9, x: 0, rotation: function (i) { return (i - 1.5) * -22; }, duration: 1.5, stagger: 0.1, ease: 'expo.out' }, 0.15)
      .from('.hx-badge', { scale: 0, rotation: -120, duration: 1.2, ease: 'back.out(1.6)' }, 0.8)
      .from('.hx-glow', { scale: 0.6, autoAlpha: 0, duration: 2, ease: 'power2.out' }, 0);
    if (entered) tl.progress(1);
    else onGo(function () { entered = true; tl.play(); });

    /* scrolling away throws the hand up and out faster than the page moves,
       each card at its own speed, while the copy lags slightly behind - real
       depth, with the next section arriving underneath the whole time */
    var out = gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: 0.8 }
    });
    out.to('.hx-s', {
      y: function (i) { return -window.innerHeight * (0.55 + DEPTH[i] * 0.2); },
      rotation: function (i) { return (i - 1.5) * 18; },
      x: function (i) { return (i - 1.5) * 110; },
      ease: 'power1.in'
    }, 0)
      .to('.hx-copy', { yPercent: desk ? 22 : 8, autoAlpha: 0.15, ease: 'none' }, 0)
      .to('.hx-glow', { scale: 1.4, autoAlpha: 0, ease: 'none' }, 0)
      .to('.hx-badge', { rotation: 200, scale: 0.6, autoAlpha: 0, ease: 'none' }, 0);

    /* depth: each card leans toward the pointer by a different amount */
    if (fine) {
      var qs = cards.map(function (c) {
        var m = $('.hx-m', c);
        return { x: gsap.quickTo(m, 'x', { duration: 0.9, ease: 'power3' }), y: gsap.quickTo(m, 'y', { duration: 0.9, ease: 'power3' }),
                 r: gsap.quickTo(m, 'rotationY', { duration: 1.1, ease: 'power3' }) };
      });
      var tq = { x: gsap.quickTo(title, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(title, 'y', { duration: 1.2, ease: 'power3' }) };
      var move = function (e) {
        var nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
        qs.forEach(function (q, i) { q.x(nx * 46 * DEPTH[i]); q.y(ny * 30 * DEPTH[i]); q.r(nx * 14); });
        tq.x(nx * -14); tq.y(ny * -8);
      };
      sec.addEventListener('pointermove', move);
      offs.push(function () { sec.removeEventListener('pointermove', move); });
    }

    /* fit the badge's ring text exactly once round the circle, any language */
    $$('.hx-badge textPath, .brief-ring textPath').forEach(function (tp) {
      var text = tp.parentNode, path = doc.getElementById(tp.getAttribute('href').slice(1));
      text.style.fontSize = '';
      var C = path.getTotalLength(), base = tp.textContent, len = tp.getComputedTextLength(), reps = 1;
      if (!(len > 0)) return;
      /* a short phrase (the Arabic ones are) repeats round the ring rather
         than being blown up to an oversized font to fill it */
      while (C / len > 1.2 && reps < 4) { reps++; tp.textContent = new Array(reps + 1).join(base); len = tp.getComputedTextLength(); }
      text.style.fontSize = (parseFloat(getComputedStyle(text).fontSize) * (C * 0.985) / len).toFixed(2) + 'px';
    });
  }

  /* --------------------------------------------------------------- marquee
     Driven from the ticker rather than a looping tween so scroll velocity can
     speed it up, flip its direction with the scroll, and lean it into a skew. */
  function marquee(offs) {
    var tracks = $$('.vmq-track');
    if (!tracks.length) return;
    var rows = tracks.map(function (t, i) {
      return { set: gsap.quickSetter(t, 'xPercent'), sk: gsap.quickSetter(t, 'skewX', 'deg'), x: i % 2 ? -50 : 0, d: i % 2 ? 1 : -1 };
    });
    var wrap = gsap.utils.wrap(-50, 0), boost = 0, way = 1, skew = 0, skewTo = 0, live = false;
    var st = ST.create({
      trigger: '.vmq', start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { live = self.isActive; },
      onUpdate: function (self) {
        var v = self.getVelocity();
        way = self.direction;
        boost = Math.min(Math.abs(v) / 90, 26);
        skewTo = gsap.utils.clamp(-9, 9, -v / 260);
      }
    });
    live = st.isActive;
    var tick = function (t, dt) {
      if (!live) return;
      var step = (dt / 1000) * (2.1 + boost);
      boost *= 0.93; skewTo *= 0.9; skew += (skewTo - skew) * 0.12;
      rows.forEach(function (r) { r.x = wrap(r.x + r.d * way * step); r.set(r.x); r.sk(skew); });
    };
    gsap.ticker.add(tick);
    offs.push(function () { gsap.ticker.remove(tick); });
  }

  /* ------------------------------------------------------------- the looks */
  function looks(desk, offs) {
    var sec = $('.looks'), track = $('.lk-track'), cards = $$('.lk-card'), head = $('.lk-head');
    if (!sec || !track) return;
    var count = $('.lk-count'), meter = $('.lk-meter b'), n = cards.length;
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    var strips = cards.map(function (c) { var s = $('.lk-strip, .lk-ghost', c); return s ? { r: gsap.quickSetter(s, 'rotation', 'deg'), x: gsap.quickSetter(s, 'x', 'px') } : null; });
    var START = { bg: '#f5efeb', fg: '#2f4156', dark: false };
    var tones = cards.map(function (c) { return { bg: c.dataset.sbg, fg: c.dataset.sfg, dark: c.dataset.dark === '1' }; });
    var cur = -2;

    function tone(i) {
      if (i === cur) return; cur = i;
      var t = i < 0 ? START : tones[i];
      gsap.to(sec, { '--lk-bg': t.bg, '--lk-fg': t.fg, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
      if (t.dark) sec.setAttribute('data-dark', 'always'); else sec.removeAttribute('data-dark');
      if (count) count.textContent = ('0' + Math.max(1, i + 1)).slice(-2) + ' / ' + ('0' + n).slice(-2);
    }
    function nearest() {
      var mid = window.innerWidth / 2, best = 0, bd = Infinity;
      cards.forEach(function (c, i) {
        var r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bd) { bd = d; best = i; }
        var off = gsap.utils.clamp(-1.2, 1.2, (r.left + r.width / 2 - mid) / window.innerWidth);
        if (strips[i]) { strips[i].r(-5 + off * -16); strips[i].x(off * -50); }
      });
      return best;
    }

    gsap.set(sec, { '--lk-bg': START.bg, '--lk-fg': START.fg });
    sec.removeAttribute('data-dark');
    gsap.to(track, {
      x: function () { return -dir() * dist(); },
      ease: 'none',
      scrollTrigger: {
        trigger: sec, pin: true, start: 'top top', end: function () { return '+=' + dist(); },
        scrub: 0.9, invalidateOnRefresh: true, anticipatePin: 1,
        onEnter: function () { tone(nearest()); },
        onEnterBack: function () { tone(nearest()); },
        onLeaveBack: function () { tone(-1); },
        onUpdate: function (self) {
          var i = nearest();
          if (self.isActive) tone(i);
          if (meter) meter.parentNode.style.setProperty('--lp', self.progress.toFixed(3));
        }
      }
    });
    nearest();

    /* heading + cards rise in as the section arrives */
    var s = split($('.lk-title'));
    gsap.from(units(s), { yPercent: 110, duration: 1, stagger: isAR() ? 0.05 : 0.014, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 75%' } });
    gsap.from('.lk-side', { y: 30, autoAlpha: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 70%' } });
    /* tied to scroll position rather than played once, so the cards are in
       the right pose however the visitor arrives (a jump link, a reload) */
    gsap.fromTo(cards.slice(0, 3), { y: 160, rotation: function (i) { return 5 + i * 2; } }, {
      y: 0, rotation: 0, stagger: 0.08, ease: 'power2.out',
      scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top top', scrub: 0.6 }
    });

    /* pointer: the strip in the hovered card leans toward the cursor */
    if (fine) cards.forEach(function (c) {
      var art = $('.lk-art', c);
      if (!art) return;
      var rx = gsap.quickTo(art, 'rotationX', { duration: 0.6, ease: 'power3' }), ry = gsap.quickTo(art, 'rotationY', { duration: 0.6, ease: 'power3' });
      var mv = function (e) { var r = c.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 22); rx(((e.clientY - r.top) / r.height - 0.5) * -16); };
      var lv = function () { rx(0); ry(0); };
      c.addEventListener('pointermove', mv); c.addEventListener('pointerleave', lv);
      offs.push(function () { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerleave', lv); });
    });
  }

  /* ---------------------------------------------------------- why: manifesto */
  function manifesto() {
    var el = $('.mf-text');
    if (!el) return;
    var s = Split ? Split.create(el, { type: 'words', aria: 'auto' }) : null;
    if (s) gsap.fromTo(s.words, { opacity: 0.12 }, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 42%', scrub: true }
    });
    gsap.from('.mf-eb', { x: -40 * dir(), autoAlpha: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.mf', start: 'top 80%' } });
    gsap.from('.mf-lede', { y: 50, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.mf-lede', start: 'top 88%' } });
  }

  /* ------------------------------------------------------- why: card stack */
  function stack() {
    var cards = $$('.sc');
    cards.forEach(function (c, i) {
      gsap.from($$('.sc-copy > *, .sc-vis > *', c), {
        y: 60, autoAlpha: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out',
        scrollTrigger: { trigger: c, start: 'top 78%' }
      });
      var next = cards[i + 1];
      if (!next) return;
      gsap.to(c, {
        scale: 0.9 + i * 0.012, '--dim': 0.38, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: function () { return 'top ' + (parseFloat(getComputedStyle(next).top) || 100) + 'px'; }, scrub: true, invalidateOnRefresh: true }
      });
    });
  }

  /* ---------------------------------------------------------------- on paper */
  function paper(offs) {
    var sec = $('.op2');
    if (!sec) return;
    var s = split($('.op2-head h2'));
    gsap.from(units(s), { yPercent: 110, duration: 1, stagger: isAR() ? 0.05 : 0.016, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 72%' } });
    gsap.from('.op2-head .lede', { y: 30, autoAlpha: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 68%' } });
    gsap.from('.op-scene', { scale: 0.7, rotation: -10 * dir(), autoAlpha: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.op-layout', start: 'top 78%' } });
    gsap.from('.op-picker', { x: 60 * dir(), autoAlpha: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.op-layout', start: 'top 74%' } });
    gsap.from('.op-btn, .op-filter-btn, .op-color-btn', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.04, ease: 'power3.out', scrollTrigger: { trigger: '.op-layout', start: 'top 70%' } });
    if (fine) {
      /* the light table's glow follows the pointer, eased through a plain
         object and written out as the --lx/--ly the CSS gradient reads */
      var light = $('.op2-light'), p = { x: 70, y: 45 };
      var put = function () { light.style.setProperty('--lx', p.x.toFixed(1) + '%'); light.style.setProperty('--ly', p.y.toFixed(1) + '%'); };
      var lx = gsap.quickTo(p, 'x', { duration: 0.8, ease: 'power3', onUpdate: put }), ly = gsap.quickTo(p, 'y', { duration: 0.8, ease: 'power3', onUpdate: put });
      var mv = function (e) { var r = sec.getBoundingClientRect(); lx((e.clientX - r.left) / r.width * 100); ly((e.clientY - r.top) / r.height * 100); };
      sec.addEventListener('pointermove', mv);
      offs.push(function () { sec.removeEventListener('pointermove', mv); light.style.removeProperty('--lx'); light.style.removeProperty('--ly'); });
    }
  }

  /* -------------------------------------------------------------- countdown */
  function how() {
    var sec = $('.how2'), steps = $$('.how-steps li'), roll = $('.how-roll'), bars = $$('.how-bar i'), flash = $('.how-flash');
    if (!sec || !steps.length || !roll) return;
    var n = steps.length;
    gsap.set(steps, { autoAlpha: 0, y: 50 });
    gsap.set(steps[0], { autoAlpha: 1, y: 0 });
    /* the flash is a moment, not a position: it fires once on the way past
       the last step (and again if you come back up and through it), rather
       than being scrubbed, which would leave the screen grey if you stopped
       scrolling halfway through it */
    var flashed = false;
    var pop = function () { gsap.fromTo(flash, { opacity: 0.95 }, { opacity: 0, duration: 0.75, ease: 'power2.out', overwrite: true }); };
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: sec, pin: true, start: 'top top', end: '+=' + (n * 85) + '%', scrub: 0.7,
        onUpdate: function (self) {
          if (self.progress > 0.94 && self.direction > 0 && !flashed) { flashed = true; pop(); }
          if (self.progress < 0.85) flashed = false;
        }
      }
    });
    for (var i = 0; i < n; i++) {
      tl.fromTo(bars[i], { '--f': 0 }, { '--f': 1, duration: 1, ease: 'none' });
      if (i < n - 1) {
        tl.to(roll, { yPercent: -100 * (i + 1) / n, duration: 0.5, ease: 'power3.inOut' })
          .to(steps[i], { autoAlpha: 0, y: -50, duration: 0.3, ease: 'power2.in' }, '<')
          .to(steps[i + 1], { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, '<0.15');
      }
    }
    tl.to({}, { duration: 0.4 });   /* a beat of rest on step 4 before the pin lets go */
    var s = split($('.how-head h2'));
    gsap.from(units(s), { yPercent: 110, duration: 1, stagger: isAR() ? 0.05 : 0.02, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 70%' } });
    gsap.from('.how-num', { yPercent: 30, autoAlpha: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 65%' } });
  }

  /* ---------------------------------------------------------------- contact */
  function cta(offs) {
    var sec = $('.cta2'), orb = $('.orb');
    if (!sec) return;
    var s = split($('.cta2-title'));
    gsap.from(units(s), { yPercent: 115, rotation: isAR() ? 0 : 6, duration: 1.2, stagger: isAR() ? 0.06 : 0.018, ease: 'expo.out', scrollTrigger: { trigger: '.cta2-title', start: 'top 82%' } });
    gsap.from('.cta2-chip', { y: 20, autoAlpha: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 75%' } });
    gsap.from('.cta2-copy > *', { y: 36, autoAlpha: 0, duration: 1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.cta2-row', start: 'top 85%' } });
    if (orb) {
      gsap.from(orb, { scale: 0, rotation: -40, duration: 1.4, ease: 'elastic.out(1,0.6)', scrollTrigger: { trigger: '.cta2-row', start: 'top 85%' } });
      if (fine) {
        /* a wide magnetic field: the orb drifts toward the pointer from well
           outside its own edge, and snaps home when the pointer leaves */
        var ox = gsap.quickTo(orb, 'x', { duration: 0.7, ease: 'power3' }), oy = gsap.quickTo(orb, 'y', { duration: 0.7, ease: 'power3' });
        var mv = function (e) {
          var r = orb.getBoundingClientRect(), cx = r.left + r.width / 2 - (gsap.getProperty(orb, 'x') || 0), cy = r.top + r.height / 2 - (gsap.getProperty(orb, 'y') || 0);
          var dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy), R = r.width * 1.3;
          if (d < R) { ox(dx * 0.35); oy(dy * 0.35); } else { ox(0); oy(0); }
        };
        var lv = function () { ox(0); oy(0); };
        sec.addEventListener('pointermove', mv); sec.addEventListener('pointerleave', lv);
        offs.push(function () { sec.removeEventListener('pointermove', mv); sec.removeEventListener('pointerleave', lv); });
      }
    }
  }

  /* ------------------------------------------------------------ story brief */
  function brief() {
    var s = split($('.brief-copy h2'));
    gsap.from(units(s), { yPercent: 110, duration: 1, stagger: isAR() ? 0.05 : 0.02, ease: 'expo.out', scrollTrigger: { trigger: '.brief2', start: 'top 75%' } });
    gsap.from('.brief-copy .lede, .brief-copy .btn', { y: 30, autoAlpha: 0, duration: 1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.brief2', start: 'top 70%' } });
    gsap.from('.brief-mark', { scale: 0.4, rotation: 90 * dir(), autoAlpha: 0, duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: '.brief2', start: 'top 70%' } });
    gsap.fromTo('.brief-disc .mark', { yPercent: 40 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.brief2', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ---------------------------------------------------------------- footer */
  function foot() {
    var letters = $$('.foot-word span');
    if (!letters.length) return;
    gsap.fromTo(letters, { yPercent: 100 }, {
      yPercent: 0, stagger: 0.06, ease: 'power3.out',
      scrollTrigger: { trigger: '.foot-word', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 }
    });
  }

  /* ----------------------------------------------------------- the build */
  function build() {
    mm = gsap.matchMedia();
    mm.add({ desk: '(min-width: 960px)', mob: '(max-width: 959px)' }, function (c) {
      var desk = c.conditions.desk, offs = [];
      hero(desk, offs);
      marquee(offs);
      looks(desk, offs);
      manifesto();
      stack();
      paper(offs);
      how();
      cta(offs);
      brief();
      foot();
      root.classList.add('built');
      return function () { offs.forEach(function (f) { f(); }); };
    });
    ST.refresh();
  }
  function teardown() { if (mm) { mm.revert(); mm = null; } }

  /* the language switch rewrites every [data-i18n] element's text, which
     would orphan the letters split out of it: revert to the original markup
     just before, rebuild just after */
  doc.addEventListener('polaready:beforelang', function () { if (started) teardown(); });
  doc.addEventListener('polaready:lang', function () { if (started && !mm) build(); });

  /* a looks card picks its template in the configurator once you land there */
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pick]');
    if (!a) return;
    var btn = $('.op-btn[data-src="' + a.getAttribute('data-pick') + '"]');
    if (btn) setTimeout(function () { btn.click(); }, 1300);
  });

  /* letters must be split with the real fonts in place or the line breaks
     come out wrong; never leave the hero hidden if fonts take too long */
  var started = false;
  function start() { if (started) return; started = true; build(); }
  /* site.js sets the saved language on DOMContentLoaded (its listener was
     registered first, so it runs first); splitting has to come after that */
  function ready() {
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(start);
    setTimeout(start, 1500);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready); else ready();
  window.addEventListener('load', function () { ST.refresh(); });
})();
