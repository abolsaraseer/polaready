/* ==========================================================================
   PolaReady — the real booth, in the browser.
   Mirrors the actual app's own flow: live view with a Start capsule, the same
   "How many photos?" confirm card, the same Retake -> Filter -> Layout ->
   Paper -> Message -> Review steps with a Back/Next bar. The only thing
   skipped is the app's network/camera-hardware setup screen, which has no
   meaning here - a website visitor has no Sony camera or printer to find.

   Nothing captured here ever leaves the tab: no upload, no server call, only
   local canvas work and a browser download.

   Paper and filter values are ported directly from StripDesign.swift, and the
   button/chip shapes from Theme.swift's LuxButtonStyle/LuxChipStyle, so this
   genuinely runs the same options the app ships, styled the same way.
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var app = $('#app');
  var LABELS = { intro: 'Live demo', denied: 'Camera', live: 'Shooting', edit: 'Editing' };
  function setState(s) { app.setAttribute('data-state', s); $('#stepLabel').textContent = LABELS[s] || 'Live demo'; }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------------------------------------------------------------- data
     Ported 1:1 from PaperStyle.colors/.ink and PhotoFilter in
     StripDesign.swift - the same nine papers and ten filters the app ships. */
  var PAPERS = [
    { k: 'classic', name: 'White', bg: ['#ffffff'], ink: '#000000' },
    { k: 'noir', name: 'Noir', bg: ['#1a1a1f'], ink: '#ffffff' },
    { k: 'vintage', name: 'Cream', bg: ['#f2e6c7'], ink: '#73542e' },
    { k: 'bubblegum', name: 'Pink', bg: ['#ffcce0'], ink: '#bf3373' },
    { k: 'ocean', name: 'Blue', bg: ['#c7e6fa'], ink: '#1a5999' },
    { k: 'mint', name: 'Mint', bg: ['#ccf5db'], ink: '#1a734d' },
    { k: 'lavender', name: 'Lavender', bg: ['#e0d4fa'], ink: '#6640a6' },
    { k: 'sunset', name: 'Sunset', bg: ['#ffbf8c', '#ff8cb3'], ink: '#8c2640' },
    { k: 'sky', name: 'Sky', bg: ['#a6d9ff', '#d9f2ff'], ink: '#1a5999' }
  ];
  var FILTERS = [
    { k: 'original', name: 'Original', css: 'none' },
    { k: 'bw', name: 'B&W', css: 'grayscale(1) contrast(1.1)' },
    { k: 'sepia', name: 'Sepia', css: 'sepia(.9)' },
    { k: 'vintage', name: 'Vintage', css: 'sepia(.4) contrast(.92) saturate(.8)' },
    { k: 'fade', name: 'Fade', css: 'contrast(.86) brightness(1.1) saturate(.75)' },
    { k: 'cool', name: 'Cool', css: 'hue-rotate(-14deg) saturate(1.1) brightness(1.03)' },
    { k: 'crisp', name: 'Crisp', css: 'contrast(1.22) saturate(1.12)' },
    { k: 'instant', name: 'Instant', css: 'saturate(1.3) contrast(1.05) brightness(1.06) sepia(.12)' },
    { k: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.45)' },
    { k: 'pop', name: 'Pop', css: 'saturate(1.9) contrast(1.15)' }
  ];
  /* Layouts adapt to how many photos were shot, same as StripLayout does -
     polaroid and player use one photo, the rest use up to four. */
  var LAYOUTS = [
    { k: 'strip', name: 'Strip', max: 4 },
    { k: 'grid', name: 'Grid', max: 4 },
    { k: 'polaroid', name: 'Polaroid', max: 1 },
    { k: 'player', name: 'Player', max: 1 },
    { k: 'ticket', name: 'Ticket', max: 3 }
  ];
  var MESSAGES = ['Happy Birthday! 🎂', 'Best day ever ✨', 'Love you! ❤️', 'Squad goals 😎', 'Making memories 📸', 'Party time! 🎉'];
  var EDIT_STEPS = ['retake', 'filter', 'layout', 'paper', 'message', 'review'];

  /* ------------------------------------------------------------- state */
  var shotCount = 3, photos = [], order = [], stream = null;
  var retakeTarget = null;      // set while the live view is re-shooting one photo
  var state = { layout: 'strip', paper: 'classic', filter: 'original', message: '' };
  var editIndex = 0;

  /* --------------------------------------------------------- intro step */
  $('#startCam').addEventListener('click', startCamera);
  $('#retryCam').addEventListener('click', startCamera);
  $('#useSample').addEventListener('click', useSample);
  $('#useSample2').addEventListener('click', useSample);

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $('#deniedReason').textContent = "This browser can't access a camera. Try Safari, Chrome or Edge.";
      setState('denied');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false })
      .then(function (s) {
        stream = s;
        var v = $('#video');
        v.srcObject = s;
        v.play().catch(function () {});
        // Dimensions aren't known until metadata arrives; capture() needs a
        // real videoWidth/videoHeight to crop correctly, so live only opens
        // once that has actually happened rather than assuming it beat the
        // guest to the shutter.
        if (v.readyState >= 1) goLiveIdle();
        else v.addEventListener('loadedmetadata', goLiveIdle, { once: true });
      })
      .catch(function (err) {
        var msg = "Camera access was blocked, or no camera is available on this device.";
        if (err && err.name === 'NotAllowedError') msg = "Camera access was declined. Allow it in your browser's address-bar controls, then try again.";
        if (err && err.name === 'NotFoundError') msg = "No camera was found on this device.";
        $('#deniedReason').textContent = msg;
        setState('denied');
      });
  }
  function goLiveIdle() {
    $('#liveStart').style.display = '';
    app.classList.remove('shooting');
    setState('live');
  }

  /* -------------------------------------------- sample-photo fallback
     For anyone who declines the camera, or has none - a flat illustrated
     scene stands in, so the whole Retake/Filter/Layout/Paper/Message/Review
     flow is still genuinely usable end to end. */
  function useSample() {
    photos = [];
    var scenes = [
      { sky: '#cfd9ea', far: '#a7b7d3', near: '#7f93b8' },
      { sky: '#f3d9c4', far: '#e0b79a', near: '#c48f77' },
      { sky: '#e8f3ea', far: '#bcdcc4', near: '#7fbf8f' },
      { sky: '#2b1f4a', far: '#6a3fa0', near: '#c23fae', sun: '#ffd166' },
      { sky: '#f7e3d8', far: '#eec9ae', near: '#dba17e' }
    ];
    shotCount = 3;
    for (var i = 0; i < shotCount; i++) photos.push(sampleFrame(scenes[i % scenes.length]));
    finishShooting();
  }
  function sampleFrame(c) {
    var s = 640, cv = document.createElement('canvas'); cv.width = s; cv.height = s;
    var x = cv.getContext('2d');
    x.fillStyle = c.sky || '#d7e6ec'; x.fillRect(0, 0, s, s);
    x.fillStyle = c.sun || '#fff'; x.beginPath(); x.arc(s * .74, s * .2, s * .09, 0, 7); x.fill();
    x.fillStyle = c.far; x.beginPath();
    x.moveTo(0, s * .55); x.lineTo(s * .2, s * .38); x.lineTo(s * .35, s * .5); x.lineTo(s * .58, s * .28);
    x.lineTo(s * .79, s * .5); x.lineTo(s, s * .4); x.lineTo(s, s * .78); x.lineTo(0, s * .78); x.fill();
    x.fillStyle = c.near; x.beginPath();
    x.moveTo(0, s * .68); x.lineTo(s * .26, s * .53); x.lineTo(s * .46, s * .63); x.lineTo(s * .7, s * .48);
    x.lineTo(s, s * .66); x.lineTo(s, s * .82); x.lineTo(0, s * .82); x.fill();
    x.fillStyle = '#f5efeb'; x.fillRect(0, s * .78, s, s * .22);
    x.fillStyle = '#2f4156'; x.beginPath(); x.arc(s * .5, s * .58, s * .07, 0, 7); x.fill();
    x.beginPath(); x.moveTo(s * .38, s * .95); x.quadraticCurveTo(s * .5, s * .74, s * .62, s * .95); x.fill();
    return cv.toDataURL('image/png');
  }

  /* --------------------------------------------------- confirm card
     "How many photos?" - overlays the live view, exactly like the app's own
     confirmCard, rather than being its own page. */
  var pendingCount = 3;
  $('#liveStart').addEventListener('click', function () { $('#confirmScrim').hidden = false; });
  $('#confirmScrim').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });
  $('#confirmCancel').addEventListener('click', function () { $('#confirmScrim').hidden = true; });
  $$('#countCircles button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#countCircles button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      pendingCount = parseInt(b.getAttribute('data-n'), 10);
    });
  });
  $('#confirmBegin').addEventListener('click', function () {
    $('#confirmScrim').hidden = true;
    shotCount = pendingCount;
    photos = [];
    beginShootFlow();
  });

  /* ----------------------------------------------------------- shooting */
  var cdEl = $('#cdNum'), smileEl = $('#smileText'), flashEl = $('#flashEl'), dotsEl = $('#shotDots'), startBtn = $('#liveStart');

  function beginShootFlow() {
    dotsEl.innerHTML = '';
    for (var i = 0; i < shotCount; i++) { var d = document.createElement('i'); dotsEl.appendChild(d); }
    startBtn.style.display = 'none';
    app.classList.add('shooting');
    shootOne(0);
  }

  /// Re-shoots exactly one photo, in place, for the Retake step's ↺ button.
  function retakeOne(idx) {
    retakeTarget = idx;
    dotsEl.innerHTML = ''; startBtn.style.display = 'none';
    app.classList.add('shooting');
    setState('live');
    runCountdown(function () {
      captureInto(retakeTarget);
      retakeTarget = null;
      finishShooting();
    });
  }

  function shootOne(i) {
    // The stream is kept alive here on purpose: the Retake step's own ↺ can
    // ask for another shot later, and re-granting camera permission mid-edit
    // would be a bad surprise. It only stops on a real session end.
    if (i >= shotCount) { finishShooting(); return; }
    runCountdown(function () {
      captureInto(photos.length);
      var d = dotsEl.children[i]; if (d) d.classList.add('done');
      shootOne(i + 1);
    });
  }

  function runCountdown(onShot) {
    var n = 3;
    (function tick() {
      cdEl.textContent = n; cdEl.classList.add('show');
      setTimeout(function () { cdEl.classList.remove('show'); }, 650);
      if (n > 1) { n--; setTimeout(tick, 800); }
      else setTimeout(function () {
        smileEl.classList.add('show');
        setTimeout(function () {
          smileEl.classList.remove('show');
          flashEl.classList.add('pop');
          onShot();
          setTimeout(function () { flashEl.classList.remove('pop'); }, 650);
        }, 750);
      }, 800);
    })();
  }

  function captureInto(index) {
    var v = $('#video'), cv = $('#capCanvas');
    // videoWidth/Height are 0 until metadata has loaded; the caller already
    // waits for that, but if this is ever reached first, sx/sy below would go
    // negative and crop garbage - a plain square beats that.
    var side = (v.videoWidth && v.videoHeight) ? Math.min(v.videoWidth, v.videoHeight) : 640;
    cv.width = side; cv.height = side;
    var ctx = cv.getContext('2d');
    var sx = Math.max(0, (v.videoWidth - side) / 2), sy = Math.max(0, (v.videoHeight - side) / 2);
    ctx.save();
    ctx.translate(side, 0); ctx.scale(-1, 1);   // mirror, matching what the guest saw live
    ctx.drawImage(v, sx, sy, side, side, 0, 0, side, side);
    ctx.restore();
    var url = cv.toDataURL('image/jpeg', 0.92);
    if (index < photos.length) photos[index] = url; else photos.push(url);
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }

  function finishShooting() {
    if (order.length !== photos.length) order = photos.map(function (_, i) { return i; });
    // A layout that can no longer hold this many shots falls back to one that can.
    var okNow = LAYOUTS.filter(function (l) { return photos.length <= l.max; }).map(function (l) { return l.k; });
    if (okNow.indexOf(state.layout) === -1) state.layout = photos.length === 1 ? 'polaroid' : 'strip';
    editIndex = 0;
    setState('edit');
    renderEditStep();
  }

  /* ============================================================= EDIT
     Retake -> Filter -> Layout -> Paper -> Message -> Review, the same order
     and the same Back/Next bar as the app's own editingScreen. */
  var backBtn = $('#backBtn'), nextBtn = $('#nextBtn');
  backBtn.addEventListener('click', function () { if (editIndex > 0) { editIndex--; renderEditStep(); } });
  nextBtn.addEventListener('click', function () { if (editIndex < EDIT_STEPS.length - 1) { editIndex++; renderEditStep(); } });

  function renderEditStep() {
    var step = EDIT_STEPS[editIndex];
    $$('#editSteps span').forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-step') === step); });
    backBtn.style.visibility = editIndex === 0 ? 'hidden' : 'visible';
    nextBtn.style.display = step === 'review' ? 'none' : '';

    var panel = $('#editPanel');
    panel.innerHTML = '';
    STEP_BUILDERS[step](panel);
    render();
  }

  function h5(panel, text) { var e = document.createElement('h5'); e.textContent = text; panel.appendChild(e); }
  function hint(panel, text) { var e = document.createElement('p'); e.className = 'hintline'; e.textContent = text; panel.appendChild(e); }

  var STEP_BUILDERS = {
    retake: function (panel) {
      h5(panel, 'Check your photos');
      hint(panel, 'Reorder them, or retake any one.');
      var list = document.createElement('div'); list.className = 'retake-list';
      order.forEach(function (idx, pos) {
        var row = document.createElement('div'); row.className = 'retake-row';
        row.innerHTML = '<b>' + (pos + 1) + '</b><img src="' + photos[idx] + '" alt="">';
        var btns = document.createElement('div'); btns.className = 'rowbtns';
        var up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.disabled = pos === 0;
        up.addEventListener('click', function () { swapOrder(pos, pos - 1); });
        var down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.disabled = pos === order.length - 1;
        down.addEventListener('click', function () { swapOrder(pos, pos + 1); });
        var retake = document.createElement('button'); retake.type = 'button'; retake.textContent = '↺'; retake.title = 'Retake this photo';
        retake.addEventListener('click', function () { retakeOne(idx); });
        btns.appendChild(up); btns.appendChild(down); btns.appendChild(retake);
        row.appendChild(btns);
        list.appendChild(row);
      });
      panel.appendChild(list);
    },
    filter: function (panel) {
      h5(panel, 'Choose a filter');
      var wrap = document.createElement('div'); wrap.className = 'opts'; panel.appendChild(wrap);
      group(wrap, FILTERS, state.filter, function (b, it) { b.className = 'lux-chip'; b.textContent = it.name; }, function (it) { state.filter = it.k; render(); });
    },
    layout: function (panel) {
      h5(panel, 'Choose a layout');
      var wrap = document.createElement('div'); wrap.className = 'opts'; panel.appendChild(wrap);
      group(wrap, LAYOUTS, state.layout, function (b, it) {
        b.className = 'lux-chip'; b.textContent = it.name;
        if (photos.length > it.max) b.disabled = true;
      }, function (it) { state.layout = it.k; render(); });
    },
    paper: function (panel) {
      h5(panel, 'Paper colour');
      var wrap = document.createElement('div'); wrap.className = 'opts'; panel.appendChild(wrap);
      group(wrap, PAPERS, state.paper, function (b, it) {
        b.className = 'lux-sw';
        b.style.background = it.bg.length > 1 ? 'linear-gradient(160deg,' + it.bg.join(',') + ')' : it.bg[0];
        b.title = it.name; b.setAttribute('aria-label', it.name);
      }, function (it) { state.paper = it.k; render(); });
    },
    message: function (panel) {
      h5(panel, 'Add a message');
      var input = document.createElement('input');
      input.type = 'text'; input.className = 'msg-input'; input.placeholder = 'Type your message…'; input.maxLength = 40;
      input.value = state.message;
      input.addEventListener('input', function () { state.message = this.value; render(); });
      panel.appendChild(input);
      var wrap = document.createElement('div'); wrap.className = 'opts'; wrap.style.marginTop = '10px';
      panel.appendChild(wrap);
      group(wrap, MESSAGES.map(function (m) { return { k: m, name: m }; }), state.message, function (b, it) { b.className = 'lux-chip'; b.textContent = it.name; },
        function (it) { state.message = (state.message === it.k) ? '' : it.k; input.value = state.message; render(); });
    },
    review: function (panel) {
      h5(panel, 'Ready');
      hint(panel, 'This is the real print layout — nothing more happens to it besides paper in a real booth.');
      var save = document.createElement('button'); save.type = 'button'; save.className = 'lux-btn filled'; save.style.width = '100%';
      save.textContent = 'Save your photo ↓';
      save.addEventListener('click', doSave);
      panel.appendChild(save);
      var again = document.createElement('button'); again.type = 'button'; again.className = 'lux-btn'; again.style.width = '100%';
      again.textContent = 'Start a new session';
      again.addEventListener('click', function () { stopCamera(); photos = []; order = []; setState('intro'); });
      panel.appendChild(again);
    }
  };

  function swapOrder(a, b) {
    var t = order[a]; order[a] = order[b]; order[b] = t;
    renderEditStep();
  }
  function group(host, items, current, decorate, onPick) {
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-pressed', String(it.k === current));
      decorate(b, it);
      if (!b.disabled) b.addEventListener('click', function () {
        $$('button', host).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        onPick(it);
      });
      host.appendChild(b);
    });
  }

  function doSave() {
    var btn = $('#editPanel .lux-btn.filled'), was = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparing…';
    render(4, function (url) {                 // wait for the real composite, not a guess
      var a = document.createElement('a');
      a.href = url; a.download = 'polaready-test-' + Date.now() + '.jpg';
      document.body.appendChild(a); a.click(); a.remove();
      btn.disabled = false; btn.textContent = was;
      toast('Saved — check your downloads');
    });
  }

  /* ------------------------------------------------------- the render
     One canvas pipeline for both the on-screen preview and the download, so
     what a visitor sees is exactly the file they get - never two versions
     drifting apart. Callback-based, deliberately: the source photos need
     decoding first (async, even for a data: URL) and the brand fonts need to
     be ready (async on a first load), so there is nothing worth returning
     synchronously. */
  function loadAll(list, cb) {
    var imgs = [], left = list.length;
    if (!left) { cb([]); return; }
    list.forEach(function (src, i) {
      var im = new Image();
      im.onload = function () { imgs[i] = im; if (--left === 0) cb(imgs); };
      im.src = src;
    });
  }

  var renderToken = 0;
  function render(scale, onDone) {
    scale = scale || 1;
    var myToken = ++renderToken;   // a control clicked twice discards the stale render
    var paper = PAPERS.filter(function (p) { return p.k === state.paper; })[0];
    var filter = FILTERS.filter(function (f) { return f.k === state.filter; })[0];
    var layout = state.layout;
    var ordered = order.length ? order.map(function (i) { return photos[i]; }) : photos;
    var n = Math.min(ordered.length, (LAYOUTS.filter(function (l) { return l.k === layout; })[0] || {}).max || 4);
    var draw = layoutDrawFns[layout] || layoutDrawFns.strip;
    var size = draw(null, null, n, true);           // dry run: ask for the size

    Promise.all([
      new Promise(function (res) { loadAll(ordered.slice(0, n), res); }),
      document.fonts ? document.fonts.ready : Promise.resolve()
    ]).then(function (results) {
      if (myToken !== renderToken) return;          // a newer render has already started
      var imgs = results[0];
      var cv = document.createElement('canvas');
      var ctx = cv.getContext('2d');
      cv.width = Math.round(size.w * scale); cv.height = Math.round(size.h * scale);
      ctx.scale(scale, scale);
      ctx.fillStyle = paper.bg[0]; ctx.fillRect(0, 0, size.w, size.h);
      if (paper.bg.length > 1) {
        var g = ctx.createLinearGradient(0, 0, 0, size.h);
        g.addColorStop(0, paper.bg[0]); g.addColorStop(1, paper.bg[1]);
        ctx.fillStyle = g; ctx.fillRect(0, 0, size.w, size.h);
      }
      draw(ctx, imgs, n, false, paper, filter, state.message);
      var url = cv.toDataURL('image/jpeg', 0.94);
      $('#finalImg').src = url;
      if (onDone) onDone(url);
    });
  }

  function withFilter(ctx, css, fn) { ctx.save(); ctx.filter = css; fn(); ctx.restore(); }
  function wordmark(ctx, x, y, size, colour) {
    ctx.fillStyle = colour; ctx.font = "400 " + size + "px 'Fugaz One'";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PolaReady', x, y);
  }
  function messageLine(ctx, x, y, size, colour, text) {
    if (!text) return;
    ctx.fillStyle = colour; ctx.font = "700 " + size + "px 'Nunito Sans'";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }
  function coverDraw(ctx, img, x, y, w, h) {
    var s = Math.max(w / img.width, h / img.height);
    var dw = img.width * s, dh = img.height * s;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  }

  var layoutDrawFns = {
    strip: function (ctx, imgs, n, dry, paper, filter, msg) {
      var m = 60, cell = 460, gap = 26, footer = 190;
      var w = cell + m * 2, h = m + n * cell + (n - 1) * gap + footer;
      if (dry) return { w: w, h: h };
      var y = m;
      imgs.forEach(function (img) {
        withFilter(ctx, filter.css, function () { coverDraw(ctx, img, m, y, cell, cell); });
        y += cell + gap;
      });
      wordmark(ctx, w / 2, h - footer / 2 + 24, 44, paper.ink);
      messageLine(ctx, w / 2, h - footer + 40, 30, paper.ink, msg);
      return { w: w, h: h };
    },
    grid: function (ctx, imgs, n, dry, paper, filter, msg) {
      var m = 56, cell = 300, gap = 22, rows = Math.ceil(n / 2), footer = 160;
      var w = m * 2 + cell * 2 + gap, h = m + rows * cell + (rows - 1) * gap + footer;
      if (dry) return { w: w, h: h };
      imgs.forEach(function (img, i) {
        var r = Math.floor(i / 2), c = i % 2;
        var x = m + c * (cell + gap), y = m + r * (cell + gap);
        withFilter(ctx, filter.css, function () { coverDraw(ctx, img, x, y, cell, cell); });
      });
      wordmark(ctx, w / 2, h - footer / 2 + 20, 42, paper.ink);
      messageLine(ctx, w / 2, h - footer + 36, 28, paper.ink, msg);
      return { w: w, h: h };
    },
    polaroid: function (ctx, imgs, n, dry, paper, filter, msg) {
      var cell = 640, border = 42, bottom = 150, m = 60;
      var w = cell + border * 2, h = cell + border + bottom + m * 2;
      if (dry) return { w: w, h: h };
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
      ctx.fillStyle = '#fff'; ctx.fillRect(m, m, w - m * 2, h - m * 2);
      ctx.restore();
      if (imgs[0]) withFilter(ctx, filter.css, function () { coverDraw(ctx, imgs[0], m + border, m + border, cell, cell); });
      wordmark(ctx, w / 2, h - m - bottom / 2 + 14, 40, '#2f4156');
      messageLine(ctx, w / 2, h - m - 30, 26, '#5b6777', msg);
      return { w: w, h: h };
    },
    player: function (ctx, imgs, n, dry, paper, filter, msg) {
      var cell = 640, m = 50, bar = 130;
      var w = cell + m * 2, h = cell + m * 2 + bar + 30;
      if (dry) return { w: w, h: h };
      if (imgs[0]) withFilter(ctx, filter.css, function () {
        ctx.save(); ctx.beginPath();
        var r = 18, x = m, y = m, ww = cell, hh = cell;
        ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r);
        ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath(); ctx.clip();
        coverDraw(ctx, imgs[0], m, m, cell, cell); ctx.restore();
      });
      var by = m + cell + 30 + bar / 2;
      ctx.fillStyle = paper.ink; ctx.beginPath();
      ctx.moveTo(m + 10, by - 14); ctx.lineTo(m + 10, by + 14); ctx.lineTo(m + 34, by); ctx.closePath(); ctx.fill();
      ctx.fillStyle = paper.ink; ctx.globalAlpha = .25; ctx.fillRect(m + 60, by - 3, cell - 140, 6); ctx.globalAlpha = 1;
      ctx.fillRect(m + 60, by - 3, (cell - 140) * .6, 6);
      messageLine(ctx, w - m - 70, by, 24, paper.ink, msg ? msg.slice(0, 16) : 'PolaReady');
      return { w: w, h: h };
    },
    ticket: function (ctx, imgs, n, dry, paper, filter, msg) {
      var m = 46, cell = 300, gap = 20, stub = 220;
      var w = m * 2 + n * cell + (n - 1) * gap + 30 + stub, h = cell + m * 2;
      if (dry) return { w: w, h: h };
      imgs.forEach(function (img, i) {
        var x = m + i * (cell + gap);
        withFilter(ctx, filter.css, function () { coverDraw(ctx, img, x, m, cell, cell); });
      });
      var lineX = m + n * cell + (n - 1) * gap + 15;
      ctx.strokeStyle = paper.ink; ctx.globalAlpha = .4; ctx.setLineDash([10, 10]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lineX, 10); ctx.lineTo(lineX, h - 10); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      var sx = lineX + 30 + stub / 2;
      ctx.fillStyle = paper.ink; ctx.font = "700 20px 'Nunito Sans'"; ctx.textAlign = 'center';
      ctx.fillText('ADMIT ONE', sx, m + 30);
      wordmark(ctx, sx, h / 2, 38, paper.ink);
      messageLine(ctx, sx, h - m - 20, 22, paper.ink, msg);
      return { w: w, h: h };
    }
  };

  // A camera left on after the visitor navigates away is a real privacy
  // concern, not just tidiness - not every browser stops it for you.
  window.addEventListener('pagehide', stopCamera);

  setState('intro');
})();
