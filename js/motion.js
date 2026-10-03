/* ==========================================================================
   PolaReady — scroll choreography for the inner pages (story, brand kit)
   The same vocabulary as the home page's home.js, applied by selector so
   each page only gets the scenes it has markup for: split headlines that
   rise letter by letter, staggered card entrances, a scroll-velocity
   marquee, parallax, and the footer wordmark. The story page's two pinned
   films (myth, booth) are left to site.js's own scroll engine.
   Built inside one gsap.matchMedia() so a language switch can revert the
   split text and build it again.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !window.gsap || !window.ScrollTrigger) { root.classList.remove('anim'); return; }

  var gsap = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText || null;
  gsap.registerPlugin(ST);
  if (Split) gsap.registerPlugin(Split);
  ST.config({ ignoreMobileResize: true });
  /* a play-once entrance that gets scrolled straight past (a jump link, a
     fast fling) finishes instantly instead of being left half-way */
  ST.defaults({ fastScrollEnd: true });

  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var isAR = function () { return root.getAttribute('lang') === 'ar'; };
  var dir = function () { return root.getAttribute('dir') === 'rtl' ? -1 : 1; };
  var mm = null, entered = false, started = false;
  var CLEAR = 'transform,opacity,visibility';

  function split(el) {
    if (!Split || !el) return null;
    return Split.create(el, { type: isAR() ? 'words,lines' : 'chars,words,lines', mask: 'lines', linesClass: 'ln', aria: 'auto' });
  }
  function units(s) { return s ? (isAR() || !s.chars.length ? s.words : s.chars) : []; }
  /* elements handed over to GSAP leave site.js's IntersectionObserver reveal,
     whose CSS would otherwise hold them at opacity 0 */
  function adopt(els) { els.forEach(function (e) { e.classList.remove('reveal'); }); return els; }
  function onGo(fn) {
    if (root.classList.contains('go')) { fn(); return; }
    var mo = new MutationObserver(function () { if (root.classList.contains('go')) { mo.disconnect(); fn(); } });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  /* ------------------------------------------------------------------ hero */
  function hero() {
    var sec = $('.hero, .kit-hero'), h1 = sec && $('h1', sec);
    if (!h1) return;
    var s = split(h1);
    var rest = $$('.eyebrow, .lede, .ctas, .meta, .meta + p', sec);
    var tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    tl.from(units(s), { yPercent: 115, rotation: isAR() ? 0 : 7, duration: 1.25, stagger: isAR() ? 0.08 : 0.026 }, 0)
      .from(rest, { y: 28, autoAlpha: 0, duration: 1.1, stagger: 0.09 }, 0.3);
    var bear = $('.kit-bear', sec);
    if (bear) tl.from(bear, { scale: 0.6, rotation: -25 * dir(), autoAlpha: 0, duration: 1.8 }, 0.1);
    if (entered) tl.progress(1); else onGo(function () { entered = true; tl.play(); });

    /* scrolling away: the copy sinks and fades while the art keeps moving */
    var copy = $('.grid > div:first-child', sec) || $('.wrap', sec);
    gsap.to(copy, { yPercent: 16, autoAlpha: 0.2, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: 0.6 } });
    if (bear) gsap.to(bear, { yPercent: -30, rotation: 18 * dir(), ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: 0.8 } });
  }

  /* -------------------------------------------------------------- headings */
  function headings() {
    adopt($$('main h2.display, main h3.display, main .eyebrow').filter(function (h) { return !h.closest('.hero, .kit-hero, .myth, .booth'); }));
    $$('main h2.display, main h3.display').filter(function (h) { return !h.closest('.hero, .kit-hero, .myth, .booth'); }).forEach(function (h) {
      var s = split(h);
      gsap.from(units(s), { yPercent: 112, rotation: isAR() ? 0 : 5, duration: 1.15, stagger: isAR() ? 0.05 : 0.018, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 86%' } });
    });
    $$('main .eyebrow').filter(function (e) { return !e.closest('.hero, .kit-hero, .myth, .booth'); }).forEach(function (e) {
      gsap.from(e, { x: -36 * dir(), autoAlpha: 0, duration: 1, ease: 'expo.out', clearProps: CLEAR, scrollTrigger: { trigger: e, start: 'top 88%' } });
    });
  }

  /* ----------------------------------------------------------------- cards */
  function cards() {
    /* timeline frames swing down into place like prints dropping onto a table */
    var frames = adopt($$('.tl .frame'));
    if (frames.length) gsap.from(frames, {
      y: 90, rotationX: -60, transformPerspective: 900, transformOrigin: '50% 0%', autoAlpha: 0,
      duration: 1.3, stagger: 0.14, ease: 'expo.out', clearProps: CLEAR,
      scrollTrigger: { trigger: '.tl', start: 'top 80%' }
    });

    /* everything card-like lands with a small tilt, in batches as it arrives */
    var loose = adopt($$('.vcard, .say, .mean, .spec, .app, .ground'));
    if (loose.length) {
      gsap.set(loose, { y: 80, rotation: function (i) { return (i % 2 ? 2.5 : -2.5) * dir(); }, autoAlpha: 0 });
      ST.batch(loose, {
        start: 'top 90%',
        onEnter: function (batch) { gsap.to(batch, { y: 0, rotation: 0, autoAlpha: 1, duration: 1.1, stagger: 0.1, ease: 'expo.out', clearProps: CLEAR, overwrite: true }); }
      });
    }

    /* the palette rises colour by colour */
    $$('.swatches').forEach(function (row) {
      adopt([row]);
      gsap.from($$('.swatch', row), { yPercent: 70, autoAlpha: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out', clearProps: CLEAR, scrollTrigger: { trigger: row, start: 'top 85%' } });
    });

    /* table rows and copy lines slide in from the reading edge */
    $$('.tbl').forEach(function (t) {
      adopt([t.parentNode]);
      gsap.from($$('tbody tr', t), { x: -40 * dir(), autoAlpha: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out', clearProps: CLEAR, scrollTrigger: { trigger: t, start: 'top 85%' } });
    });
    $$('.lib > div').forEach(function (g) {
      adopt([g]);
      gsap.from([$('h3', g)].concat($$('.line, .tags button', g)), { x: -50 * dir(), autoAlpha: 0, duration: 0.9, stagger: 0.06, ease: 'power3.out', clearProps: CLEAR, scrollTrigger: { trigger: g, start: 'top 86%' } });
    });
  }

  /* -------------------------------------------------------------- parallax */
  function parallax() {
    var lock = $('.lockup');
    if (lock) {
      adopt([lock]);
      gsap.fromTo(lock, { y: 80, rotation: 9 * dir() }, { y: -60, rotation: -3 * dir(), ease: 'none', scrollTrigger: { trigger: lock, start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
    }
    $$('.ground .mark').forEach(function (m) {
      gsap.fromTo(m, { scale: 0.55, rotation: -18 * dir() }, { scale: 1, rotation: 0, ease: 'none', scrollTrigger: { trigger: m.parentNode, start: 'top bottom', end: 'center center', scrub: 0.8 } });
    });
    $$('.sci-sticky').forEach(function (f) { adopt([f]); gsap.from(f, { scale: 0.85, autoAlpha: 0, duration: 1.3, ease: 'expo.out', clearProps: CLEAR, scrollTrigger: { trigger: f, start: 'top 85%' } }); });
    $$('.callout').forEach(function (c) { adopt([c]); gsap.from(c, { scale: 0.9, rotation: -2 * dir(), autoAlpha: 0, duration: 1.2, ease: 'expo.out', clearProps: CLEAR, scrollTrigger: { trigger: c, start: 'top 85%' } }); });
  }

  /* --------------------------------------------------------------- marquee
     The same scroll-velocity marquee as the home page: faster with a fling,
     reversing with the scroll direction, leaning into a skew. */
  function marquee(offs) {
    var tracks = $$('.marq .track');
    if (!tracks.length) return;
    root.classList.add('vmarq');
    var rows = tracks.map(function (t) {
      var rev = t.parentNode.classList.contains('rev');
      return { set: gsap.quickSetter(t, 'xPercent'), sk: gsap.quickSetter(t, 'skewX', 'deg'), x: rev ? -50 : 0, d: rev ? 1 : -1 };
    });
    var wrap = gsap.utils.wrap(-50, 0), boost = 0, way = 1, skew = 0, skewTo = 0, live = false;
    var host = tracks[0].closest('section') || tracks[0].parentNode;
    var st = ST.create({
      trigger: host, start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { live = self.isActive; },
      onUpdate: function (self) { var v = self.getVelocity(); way = self.direction; boost = Math.min(Math.abs(v) / 90, 26); skewTo = gsap.utils.clamp(-9, 9, -v / 260); }
    });
    live = st.isActive;
    var tick = function (t, dt) {
      if (!live) return;
      var step = (dt / 1000) * (2.1 + boost);
      boost *= 0.93; skewTo *= 0.9; skew += (skewTo - skew) * 0.12;
      rows.forEach(function (r) { r.x = wrap(r.x + r.d * way * step); r.set(r.x); r.sk(skew); });
    };
    gsap.ticker.add(tick);
    offs.push(function () { gsap.ticker.remove(tick); root.classList.remove('vmarq'); });
  }

  /* ---------------------------------------------------------------- footer */
  function foot() {
    var letters = $$('.foot-word span');
    if (letters.length) gsap.fromTo(letters, { yPercent: 100 }, {
      yPercent: 0, stagger: 0.06, ease: 'power3.out',
      scrollTrigger: { trigger: '.foot-word', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 }
    });
  }

  function build() {
    mm = gsap.matchMedia();
    mm.add('all', function () {
      var offs = [];
      hero(); headings(); cards(); parallax(); marquee(offs); foot();
      root.classList.add('built');
      return function () { offs.forEach(function (f) { f(); }); };
    });
    ST.refresh();
  }
  function teardown() { if (mm) { mm.revert(); mm = null; } }

  doc.addEventListener('polaready:beforelang', function () { if (started) teardown(); });
  doc.addEventListener('polaready:lang', function () { if (started && !mm) build(); });

  function start() { if (started) return; started = true; build(); }
  function ready() {
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(start);
    setTimeout(start, 1500);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready); else ready();
  window.addEventListener('load', function () { ST.refresh(); });
})();
