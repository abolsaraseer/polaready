/* ==========================================================================
   PolaReady — site behaviour
   One small scroll engine drives every animation: each animated section gets a
   0..1 progress number, and the CSS reads it. No animation library.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var mixRGB = function (a, b, t) { return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(lerp(a[i], b[i], t)); }).join(',') + ')'; };

  var CREAM = [245, 239, 235], NAVY = [47, 65, 86], WHITE = [255, 255, 255];
  var lang = 'en';

  /* ------------------------------------------------------------------ i18n
     English lives in the HTML itself. Arabic is looked up by data-i18n key;
     the English original is remembered on first swap so switching back is exact. */
  function T(key) {
    var d = window.I18N || {};
    return (lang === 'ar' && d.ar && d.ar[key] != null) ? d.ar[key] : (d.en && d.en[key]) || key;
  }
  function applyLang(next, persist) {
    /* scenes that split text into letters (home.js) undo that first */
    doc.dispatchEvent(new CustomEvent('polaready:beforelang', { detail: next }));
    lang = next;
    var ar = window.I18N && window.I18N.ar;
    $$('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (el.dataset.en == null) el.dataset.en = el.innerHTML;
      el.innerHTML = (next === 'ar' && ar && ar[k] != null) ? ar[k] : el.dataset.en;
      /* the text was just replaced, so any earlier word-split source is stale */
      if (el.hasAttribute('data-hw') || el.hasAttribute('data-words')) delete el.dataset.src;
    });
    $$('[data-i18n-attr]').forEach(function (el) {
      var pairs = el.getAttribute('data-i18n-attr').split(',');
      pairs.forEach(function (p) {
        var a = p.split(':'), attr = a[0], k = a[1], keep = 'data-en-' + attr;
        /* plain attributes, not dataset: 'aria-label' is not a legal dataset name */
        if (!el.hasAttribute(keep)) el.setAttribute(keep, el.getAttribute(attr) || '');
        el.setAttribute(attr, (next === 'ar' && ar && ar[k] != null) ? ar[k] : el.getAttribute(keep));
      });
    });
    root.setAttribute('lang', next);
    root.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
    var title = next === 'ar' ? (doc.body.dataset.titleAr || (ar && ar.page_title) || doc.title)
                                : (doc.body.dataset.title || doc.title);
    doc.title = title;
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === next)); });
    if (persist) { try { localStorage.setItem('polaready-lang', next); } catch (e) {} }
    splitWords();
    measure();
    update();
    doc.dispatchEvent(new CustomEvent('polaready:lang', { detail: next }));
  }

  /* ------------------------------------------------------- word splitting */
  function wrapWords(node, cls, counter) {
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var parts = n.nodeValue.split(/(\s+)/);
        var frag = doc.createDocumentFragment();
        parts.forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(doc.createTextNode(p)); return; }
          var w = doc.createElement('span');
          w.className = cls;
          if (cls === 'hw') { var i = doc.createElement('i'); i.textContent = p; w.appendChild(i); w.style.setProperty('--i', counter.n++); }
          else { w.textContent = p; counter.n++; }
          frag.appendChild(w);
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') wrapWords(n, cls, counter);
    });
  }
  function splitWords() {
    $$('[data-hw]').forEach(function (el) {
      if (el.dataset.src == null) el.dataset.src = el.innerHTML; else el.innerHTML = el.dataset.src;
      wrapWords(el, 'hw', { n: 0 });
    });
    $$('[data-words]').forEach(function (el) {
      if (el.dataset.src == null) el.dataset.src = el.innerHTML; else el.innerHTML = el.dataset.src;
      wrapWords(el, 'w', { n: 0 });
    });
  }

  /* ------------------------------------------------------------- reveals */
  var io = null;
  function setupReveal() {
    var items = $$('.reveal');
    if (reduced || !('IntersectionObserver' in window)) { items.forEach(function (e) { e.classList.add('in'); }); return; }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); if (en.target.hasAttribute('data-count-host')) countUp(en.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (e) { io.observe(e); });
    $$('.pr').forEach(function (e) { io.observe(e); });
  }
  function countUp(host) {
    $$('[data-count]', host).forEach(function (el) {
      var to = parseInt(el.getAttribute('data-count'), 10), from = to - 46, t0 = null;
      if (reduced) { el.textContent = to; return; }
      function step(ts) {
        if (t0 == null) t0 = ts;
        var p = clamp((ts - t0) / 1500, 0, 1), e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(lerp(from, to, e));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* --------------------------------------------------------- scroll engine */
  var vh = window.innerHeight, docH = 1;
  var secs = [];          // sections that need per-scroll work
  function measure() {
    vh = window.innerHeight;
    docH = Math.max(1, doc.documentElement.scrollHeight - vh);
  }
  function rectOf(el) { return el.getBoundingClientRect(); }
  function pinProgress(el) { var r = rectOf(el); return clamp(-r.top / Math.max(1, r.height - vh), 0, 1); }
  function viewProgress(el) { var r = rectOf(el); return clamp((vh - r.top) / (vh + r.height), 0, 1); }

  var myth = null, booth = null, lastBoothState = '', navEl = null, lastY = 0;

  function update() {
    var y = window.scrollY || window.pageYOffset;
    root.style.setProperty('--sp', clamp(y / docH, 0, 1).toFixed(4));

    /* nav: hide when scrolling down past the hero, show when scrolling up */
    if (navEl) {
      navEl.classList.toggle('hide', y > 420 && y > lastY + 4 && !navEl.matches(':focus-within'));
      if (y < lastY - 4 || y < 200) navEl.classList.remove('hide');
    }
    lastY = y;

    var darkNow = false;
    $$('[data-dark="always"]').forEach(function (s) { var r = rectOf(s); if (r.top <= 34 && r.bottom >= 34) darkNow = true; });

    if (myth) {
      var p = pinProgress(myth.el);
      /* the page whites out (cream -> white), then develops (white -> navy) */
      var bg, e;
      if (p < 0.1) bg = mixRGB(CREAM, WHITE, smooth(p / 0.1));
      else if (p < 0.2) bg = 'rgb(255,255,255)';
      else { e = smooth((p - 0.2) / 0.12); bg = mixRGB(WHITE, NAVY, e); }
      myth.el.style.setProperty('--mbg', bg);
      myth.el.style.setProperty('--mfg', p < 0.26 ? 'rgb(47,65,86)' : 'rgb(245,239,235)');
      myth.el.style.setProperty('--dev', smooth((p - 0.24) / 0.1).toFixed(3));
      myth.beats.forEach(function (b) {
        var v = (b.first ? 1 : smooth((p - b.a) / 0.035)) * (b.last ? 1 : 1 - smooth((p - (b.z - 0.035)) / 0.035));
        b.el.style.setProperty('--b', v.toFixed(3));
        b.el.style.pointerEvents = v > 0.5 ? 'auto' : 'none';
        var words = b.el.querySelectorAll('.big .w');
        if (words.length) {
          var lp = clamp((p - b.a) / (b.z - b.a), 0, 1), n = words.length;
          for (var wi = 0; wi < n; wi++) words[wi].style.setProperty('--wv', clamp((lp - 0.12) / 0.55 * n - wi, 0, 1).toFixed(2));
        }
      });
      if (p > 0.3 && p < 1 && rectOf(myth.el).top <= 34) darkNow = true;
    }

    if (booth) {
      var bp = pinProgress(booth.el), st;
      st = bp < 0.13 ? 'idle' : bp < 0.25 ? 'c3' : bp < 0.37 ? 'c2' : bp < 0.49 ? 'c1' : bp < 0.60 ? 'smile' : bp < 0.80 ? 'result' : 'print';
      if (st !== lastBoothState) { booth.rig.setAttribute('data-state', st); lastBoothState = st; }
      var fl = bp > 0.585 && bp < 0.7 ? (bp < 0.6 ? (bp - 0.585) / 0.015 : 1 - (bp - 0.6) / 0.1) : 0;
      booth.flash.style.opacity = clamp(fl, 0, 1).toFixed(3);
      booth.rig.style.setProperty('--print', smooth((bp - 0.74) / 0.22).toFixed(3));
      var step = bp < 0.13 ? 0 : bp < 0.66 ? 1 : bp < 0.8 ? 2 : 3;
      booth.steps.forEach(function (li, i) { li.classList.toggle('on', i === step); });
    }

    secs.forEach(function (s) {
      var r = rectOf(s.el);
      if (r.bottom < -200 || r.top > vh + 200) return;
      s.fn(s.el, r);
    });

    /* which chapter are we in */
    var mid = vh * 0.4, cur = null;
    $$('[data-sec]').forEach(function (s) { var r = rectOf(s); if (r.top <= mid && r.bottom > mid) cur = s.id; });
    $$('.dots a,.nav ul a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + cur); });

    if (navEl) navEl.classList.toggle('dark', darkNow);
    doc.body.classList.toggle('on-dark', darkNow);
  }

  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }

  function setupSections() {
    var hero = $('.hero');
    if (hero && !reduced) secs.push({ el: hero, fn: function (el, r) {
      el.style.setProperty('--hp', clamp(-r.top / vh, 0, 1).toFixed(3));
    } });
    var tl = $('.tl');
    if (tl) secs.push({ el: tl, fn: function (el, r) {
      var p = clamp((vh * 0.82 - r.top) / (r.height * 0.9 + vh * 0.1), 0, 1);
      el.style.setProperty('--p', p.toFixed(3));
    } });
    var sci = $('.sci');
    if (sci) secs.push({ el: sci, fn: function (el, r) {
      var fig = $('.sci-fig', el);
      /* a visitor dragging the lens (play.js) owns it until they scroll away */
      if (fig.dataset.user) return;
      /* starts as the figure settles, finishes as the last paragraph passes */
      var p = clamp((vh * 0.3 - r.top) / Math.max(1, r.height - vh * 0.55), 0, 1);
      fig.style.setProperty('--x', (smooth(p) * 100).toFixed(1) + '%');
      fig.style.setProperty('--p', p.toFixed(3));
    } });
    var lock = $('.lockup');
    if (lock) secs.push({ el: lock, fn: function (el, r) {
      el.style.setProperty('--rise', smooth((vh * 0.9 - r.top) / (vh * 0.55)).toFixed(3));
    } });
    var foot = $('.foot');
    if (foot) secs.push({ el: foot, fn: function (el) { el.style.setProperty('--p', viewProgress(el).toFixed(3)); } });
    $$('[data-words-view]').forEach(function (el) {
      secs.push({ el: el, fn: function (e, r) {
        var words = $$('.w', e), p = clamp((vh * 0.85 - r.top) / (vh * 0.5), 0, 1);
        words.forEach(function (w, i) { w.style.setProperty('--wv', clamp(p * words.length * 1.15 - i, 0, 1).toFixed(2)); });
      } });
    });

    var m = $('.myth');
    if (m) myth = { el: m, beats: $$('.beat', m).map(function (b) {
      var win = b.getAttribute('data-win').split(',');
      return { el: b, a: parseFloat(win[0]), z: parseFloat(win[1]), first: b.hasAttribute('data-first'), last: b.hasAttribute('data-last') };
    }) };
    var bo = $('.booth');
    if (bo) booth = { el: bo, rig: $('.rig', bo), flash: $('.fl', bo), steps: $$('.steps li', bo) };
  }

  /* ---------------------------------------------------------------- hero */
  function setupHero() {
    var snow = $('.snow');
    if (snow && !reduced) {
      for (var i = 0; i < 30; i++) {
        var b = doc.createElement('b'), z = 3 + Math.random() * 7;
        b.style.cssText = '--x:' + (Math.random() * 100).toFixed(1) + '%;--z:' + z.toFixed(1) + 'px;--o:' + (0.1 + Math.random() * 0.22).toFixed(2) +
          ';--t:' + (16 + Math.random() * 22).toFixed(1) + 's;--dl:-' + (Math.random() * 30).toFixed(1) + 's;--sw:' + (Math.random() * 70 - 35).toFixed(0);
        snow.appendChild(b);
      }
    }
    var host = $('.stagecard'), card = $('.pcard');
    if (host && card && !reduced && window.matchMedia('(hover:hover)').matches) {
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', (x * 16).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-y * 14).toFixed(2) + 'deg');
      });
      host.addEventListener('pointerleave', function () { card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); });
    }
  }

  /* ------------------------------------------------------------- cursor
     A dot that tracks the pointer exactly (no CSS transition on its
     transform - any lag there would fight the eye) and a ring that
     trails it via a rAF lerp, the same easing-toward-a-target technique
     setupOnPaper already uses for the card's idle sway. Skipped entirely
     on touch/no-hover devices and under reduced-motion, in which case
     the native cursor is left completely alone. */
  function setupCursor() {
    if (reduced || !window.matchMedia || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var dot = doc.createElement('div'); dot.className = 'cursor-dot'; doc.body.appendChild(dot);
    var ring = doc.createElement('div'); ring.className = 'cursor-ring'; doc.body.appendChild(ring);
    var label = doc.createElement('span'); label.className = 'cursor-label'; ring.appendChild(label);
    doc.body.classList.add('cursor-on');
    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, seen = false;
    doc.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0) translate(-50%,-50%)';
      if (!seen) { rx = mx; ry = my; seen = true; } /* snap the ring in on the very first move, don't let it swoop in from centre */
    });
    function loop() {
      rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    /* [data-cursor] elements swap the ring for a filled disc carrying a
       short label (an i18n key, so it follows the language); anything else
       clickable just swells the ring */
    var hoverables = 'a, button, .op-btn, .op-filter-btn, .op-color-btn, input, .swatch, .line';
    doc.addEventListener('mouseover', function (e) {
      var lab = e.target.closest('[data-cursor]');
      if (lab) { label.textContent = T(lab.getAttribute('data-cursor')); doc.body.classList.add('cursor-labeled'); doc.body.classList.remove('cursor-hover'); return; }
      if (e.target.closest(hoverables)) doc.body.classList.add('cursor-hover');
    });
    doc.addEventListener('mouseout', function (e) {
      var to = e.relatedTarget;
      var lab = e.target.closest('[data-cursor]');
      if (lab && !(to && lab.contains(to))) doc.body.classList.remove('cursor-labeled');
      var h = e.target.closest(hoverables);
      if (h && !(to && h.contains(to))) doc.body.classList.remove('cursor-hover');
    });
    doc.addEventListener('mousedown', function () { doc.body.classList.add('cursor-down'); });
    doc.addEventListener('mouseup', function () { doc.body.classList.remove('cursor-down'); });
    doc.addEventListener('mouseleave', function () { dot.style.opacity = ring.style.opacity = '0'; });
    doc.addEventListener('mouseenter', function () { dot.style.opacity = ring.style.opacity = ''; });
  }

  /* --------------------------------------------------------- smooth scroll
     Lenis eases the wheel into an inertial glide. It moves the real window
     scroll position, so sticky sections, the scroll engine above and
     ScrollTrigger all keep reading ordinary scrollY. Where GSAP is on the
     page it drives Lenis from its own ticker so the two never disagree about
     the current frame. Touch keeps native scrolling. */
  var lenis = null;
  function setupSmooth() {
    if (reduced || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToEl(t) {
    var y = t.getBoundingClientRect().top + window.scrollY - 4;
    if (lenis) lenis.scrollTo(y, { duration: 1.5 });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------------- curtain
     Leaving for another page on this site drops a navy curtain carrying the
     bear; the next page starts with it down (an inline head script sets
     html.curtain-in from the session flag before first paint) and lifts it.
     Skipped for new tabs, modified clicks, downloads, other origins and
     in-page anchors, and under reduced motion. */
  var curtain = null;
  function makeCurtain() {
    curtain = doc.createElement('div');
    curtain.className = 'curtain';
    curtain.setAttribute('aria-hidden', 'true');
    curtain.innerHTML = '<span class="mark"></span>';
    doc.body.appendChild(curtain);
  }
  function setupCurtain() {
    if (reduced) { root.classList.remove('curtain-in'); return; }
    makeCurtain();
    var arriving = root.classList.contains('curtain-in');
    try { sessionStorage.removeItem('polaready-curtain'); } catch (e) {}
    if (arriving) {
      curtain.classList.add('cover', 'still');
      root.classList.remove('curtain-in');
      void curtain.offsetWidth;
      curtain.classList.remove('still');
      requestAnimationFrame(function () { curtain.classList.add('lift'); });
      /* park it back below the screen without animating across it */
      setTimeout(function () {
        curtain.classList.add('still'); curtain.classList.remove('cover', 'lift');
        void curtain.offsetWidth; curtain.classList.remove('still');
      }, 1100);
    }
    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
      e.preventDefault();
      try { sessionStorage.setItem('polaready-curtain', '1'); } catch (err) {}
      curtain.classList.remove('lift');
      curtain.classList.add('cover');
      setTimeout(function () { location.href = url.href; }, 620);
    });
    /* coming back through the back/forward cache: the page is restored with
       the curtain still down, so put it away */
    window.addEventListener('pageshow', function (e) { if (e.persisted) curtain.classList.remove('cover', 'lift'); });
  }

  /* ---------------------------------------------------------- magnetic
     .btn owns its hover-lift, magnetic pull and press-scale as one inline
     transform instead of fighting the CSS :hover/:active rules - an
     inline style always wins over those regardless of specificity, so
     splitting the effect between JS and CSS would just mean the CSS half
     silently stops applying. Reduced-motion skips this entirely and the
     plain CSS :hover/:active rules are what that visitor gets instead. */
  function setupMagnetic() {
    if (reduced) return;
    $$('.btn').forEach(function (btn) {
      var tx = 0, ty = 0, pressed = false;
      function apply() { btn.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + (ty - 3).toFixed(1) + 'px) scale(' + (pressed ? 0.97 : 1) + ')'; }
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * 0.25;
        ty = (e.clientY - (r.top + r.height / 2)) * 0.25;
        apply();
      });
      btn.addEventListener('mousedown', function () { pressed = true; apply(); });
      btn.addEventListener('mouseup', function () { pressed = false; apply(); });
      btn.addEventListener('mouseleave', function () { pressed = false; btn.style.transform = ''; });
    });
  }

  /* ---------------------------------------------------------- spotlight
     Cards read the cursor position back as --mx/--my (set here) to
     position a radial-gradient glow in their own ::before - see .perk in
     site.css. Purely a custom-property writer; the glow's fade in/out is
     a plain CSS opacity transition on :hover, so this still degrades
     gracefully (no glow, but nothing broken) if reduced-motion skips it. */
  function setupSpotlight() {
    if (reduced) return;
    $$('.perk, .op-btn').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* --------------------------------------------------------------- intro */
  function runIntro() {
    var skip = reduced || !doc.body.hasAttribute('data-intro');
    try { if (sessionStorage.getItem('polaready-intro')) skip = true; } catch (e) {}
    if (new URLSearchParams(location.search).has('nointro')) skip = true;
    if (skip) { root.classList.add('go'); return; }
    try { sessionStorage.setItem('polaready-intro', '1'); } catch (e) {}
    var el = doc.createElement('div');
    el.className = 'intro';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="num"></div><div class="cap">' + T('intro_cap') + '</div><button class="skipbtn" type="button">' + T('intro_skip') + '</button><div class="white"></div>';
    doc.body.appendChild(el);
    doc.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    var num = $('.num', el), timers = [], finished = false;
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function show(n) { num.textContent = n; num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop'); }
    function finish() {
      if (finished) return; finished = true;
      timers.forEach(clearTimeout);
      root.classList.add('go');
      el.classList.add('done');
      doc.body.style.overflow = '';
      if (lenis) lenis.start();
      setTimeout(function () { el.remove(); }, 60);
    }
    show(3); later(function () { show(2); }, 520); later(function () { show(1); }, 1040);
    later(function () { el.classList.add('flash'); num.style.display = 'none'; }, 1560);
    later(function () { root.classList.add('go'); }, 1700);
    later(finish, 2650);
    el.addEventListener('click', finish);
    doc.addEventListener('keydown', function k(e) { if (!finished) finish(); doc.removeEventListener('keydown', k); });
  }

  /* --------------------------------------------------------- clipboard */
  var toastEl = null, toastT = null;
  function toast(msg) {
    if (!toastEl) { toastEl = doc.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); doc.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1700);
  }
  function copy(text) {
    var done = function () { toast((T('copied') || 'Copied') + ' · ' + text); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else { var t = doc.createElement('textarea'); t.value = text; doc.body.appendChild(t); t.select(); try { doc.execCommand('copy'); } catch (e) {} t.remove(); done(); }
  }
  function setupCopy() {
    doc.addEventListener('click', function (e) {
      var t = e.target.closest('[data-copy]');
      if (t) copy(t.getAttribute('data-copy') || t.textContent.trim());
    });
  }

  /* ---------------------------------------------------------- on-paper card
     A flat plane in 3D space is all "tilted paper" needs - no model file, no
     WebGL. Idle sway, hover-follow and the template-switch spin all drive the
     SAME transform property, so they're run as one continuous
     requestAnimationFrame loop that eases the current angle toward whatever
     the current mode wants, rather than as separate CSS animations swapped in
     and out by class. That swap approach was tried first and dropped: turning
     a CSS animation off snaps the element to its static base transform
     instantly, so leaving hover produced a visible pop back to a different
     angle instead of a smooth handoff. Easing one continuous value avoids
     that by construction - the rendered angle only ever moves a fraction of
     the way to its target each frame, never jumps, no matter how the target
     itself changes underneath it.

     The template switch swings to SPIN_Y and back rather than to 90deg: a
     flat plane at 90deg is edge-on - a hairline sliver, which reads as the
     card vanishing rather than spinning. Stopping well short of that keeps
     the face visible (just steeply tilted) for the whole motion, and the
     image swaps at the peak of the swing rather than at an invisible instant. */
  /* Filter and Colour reach different, non-overlapping layers, so there's
     never a seam to misalign:
       - .op-bg is the original print, always shown true-to-source.
       - .op-fill is a plain solid-color sheet on top of it: transparent
         for Classic (the real pattern shows through), opaque for
         Blush/Sage, replacing the frame with a flat colour outright
         rather than tinting the existing pattern.
       - three .op-photo copies of the same source image sit above both,
         each clip-path'd down to just one photo window (OP_RECTS below,
         measured once per template in its native 236x708 px), so the
         fill never covers the couple's photos and Filter only ever
         reaches these.
     The photo layers share the .op-bg <img src>, so a template swap never
     needs the rects and the pixels to line back up - they're the same
     pixels. */
  var OP_CANVAS = { w: 236, h: 708 };
  var OP_RECTS = {
    'assets/templates/wedding-1.png?v=2': [[89, 39, 212, 216], [89, 266, 212, 442], [89, 493, 212, 669]],
    'assets/templates/wedding-2.png?v=2': [[49, 66, 186, 159], [49, 247, 186, 332], [49, 426, 186, 527]],
    'assets/templates/wedding-3.png?v=3': [[27, 40, 209, 168], [27, 201, 209, 328], [27, 363, 209, 490]],
    'assets/templates/business-1.png?v=1': [[24, 116, 211, 246], [24, 263, 211, 394], [24, 411, 211, 541]]
  };
  var OP_FILTERS = { original: 'none', bw: 'grayscale(1) contrast(1.1)', warm: 'sepia(.4) saturate(1.3) contrast(1.05)' };
  var OP_FILL = { original: 'transparent', blush: '#c95a6e', sage: '#587854' };

  function setupOnPaper() {
    var scene = $('.op-scene'), tilt = $('#opTilt'), bg = $('#opBg'), fill = $('#opFill'), photos = $$('.op-photo');
    var btns = $$('.op-btn'), filterBtns = $$('.op-filter-btn'), colorBtns = $$('.op-color-btn');
    if (!scene || !tilt || !btns.length) return;
    var REST_X = 6, REST_Y = -11, SPIN_Y = 46;

    function labelFor(b) {
      var h = b.querySelector('b'), s = b.querySelector('span');
      return (h ? h.textContent : '') + (s ? ' — ' + s.textContent : '');
    }
    function applyRects(src) {
      var rects = OP_RECTS[src] || [];
      photos.forEach(function (p, i) {
        var r = rects[i];
        p.style.clipPath = r
          ? 'inset(' + (r[1] / OP_CANVAS.h * 100) + '% ' + ((OP_CANVAS.w - r[2]) / OP_CANVAS.w * 100) + '% ' +
            ((OP_CANVAS.h - r[3]) / OP_CANVAS.h * 100) + '% ' + (r[0] / OP_CANVAS.w * 100) + '%)'
          : 'inset(100%)';
      });
    }
    var currentSrc = btns[0].getAttribute('data-src');
    function applyColor() {
      var on = colorBtns.filter(function (b) { return b.classList.contains('on'); })[0];
      var color = on ? on.getAttribute('data-color') : 'original';
      fill.style.background = OP_FILL[color] || 'transparent';
    }
    function swapTo(b) {
      currentSrc = b.getAttribute('data-src');
      bg.src = currentSrc; bg.alt = labelFor(b);
      photos.forEach(function (p) { p.src = currentSrc; });
      applyRects(currentSrc);
      applyColor(); /* re-resolve the current swatch against the new template's own hue map */
    }
    bg.alt = labelFor(btns[0]);
    applyRects(currentSrc);

    function group(all, cls, apply) {
      all.forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.classList.contains('on')) return;
          all.forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
          apply(b);
        });
      });
    }
    group(filterBtns, 'op-filter-btn', function (b) {
      var f = OP_FILTERS[b.getAttribute('data-filter')] || 'none';
      photos.forEach(function (p) { p.style.filter = f; });
    });
    group(colorBtns, 'op-color-btn', function () { applyColor(); });

    if (reduced) {
      tilt.style.transform = 'rotateX(' + REST_X + 'deg) rotateY(' + REST_Y + 'deg)';
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.classList.contains('on')) return;
          btns.forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
          swapTo(b);
        });
      });
      return;
    }

    var rx = REST_X, ry = REST_Y;      // the rendered angle, eased every frame
    var tx = REST_X, ty = REST_Y;      // what it's currently chasing
    var hovering = false, phase = 'idle', busy = false;

    /* Only the render loop lives on requestAnimationFrame, which a browser is
       free to fully suspend for a backgrounded tab - fine for a visual sway,
       since it just picks up the easing again whenever the tab is next
       painted. The flip's own timing (when the image actually swaps, when
       the button unlocks) runs on setTimeout instead, which keeps firing
       (throttled, not suspended) even while hidden - tying that to "has the
       eased value visually arrived yet" would leave a click permanently
       stuck mid-flip if a frame never came to notice it had arrived. */
    function tick() {
      if (phase === 'idle' && !hovering) { tx = REST_X; ty = REST_Y + Math.sin(Date.now() / 3400) * 11; }
      rx += (tx - rx) * 0.12; ry += (ty - ry) * 0.12;
      tilt.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    scene.addEventListener('mouseenter', function () { hovering = true; });
    scene.addEventListener('mousemove', function (e) {
      if (phase !== 'idle') return;
      var r = scene.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      tx = lerp(16, -4, clamp(py, 0, 1)); ty = lerp(-16, 16, clamp(px, 0, 1));
    });
    scene.addEventListener('mouseleave', function () { hovering = false; });

    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (busy || b.classList.contains('on')) return;
        busy = true;
        btns.forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        phase = 'spin'; tx = rx; ty = SPIN_Y;
        setTimeout(function () {
          swapTo(b);
          phase = 'settle'; tx = REST_X; ty = REST_Y;
          setTimeout(function () { phase = 'idle'; busy = false; }, 420);
        }, 320);
      });
    });
  }

  /* -------------------------------------------------------------- boot */
  function init() {
    navEl = $('.nav');
    var saved = null, q = new URLSearchParams(location.search).get('lang');
    try { saved = localStorage.getItem('polaready-lang'); } catch (e) {}
    var want = q === 'ar' || q === 'en' ? q : saved;
    doc.body.dataset.title = doc.title;
    $$('.lang button').forEach(function (b) { b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang'), true); }); });

    setupSmooth(); setupCurtain();
    setupSections(); setupReveal(); setupHero(); setupCopy(); setupOnPaper(); setupCursor(); setupMagnetic(); setupSpotlight();
    lang = want === 'ar' && window.I18N ? 'ar' : 'en';
    applyLang(lang, false);   /* also splits the words, once, in the right language */
    $$('.marq .track').forEach(function (t) { t.innerHTML += t.innerHTML; });
    measure(); update();
    runIntro();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { measure(); update(); });
    window.addEventListener('load', function () { measure(); update(); });
    /* smooth in-page links that account for the pinned sections */
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]'); if (!a) return;
      var t = $(a.getAttribute('href')); if (!t) return;
      e.preventDefault();
      scrollToEl(t);
    });
  }
  /* a small hook so the page can be driven and checked without a real scroll */
  window.PolaReady = {
    lenis: function () { return lenis; },
    copy: function (text) { copy(text); },
    toast: function (msg) { toast(msg); },
    t: function (key) { return T(key); },
    update: function () { measure(); update(); },
    revealAll: function () { $$('.reveal,.pr').forEach(function (e) { e.classList.add('in'); }); $$('[data-count]').forEach(function (e) { e.textContent = e.getAttribute('data-count'); }); }
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
