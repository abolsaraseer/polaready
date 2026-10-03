/* ==========================================================================
   PolaReady — test booth staging (decoration only)
   demo.js runs the booth and is not touched by this file. fx.js only watches
   what demo.js already does - the flash element popping, the app's state,
   the current edit step, the rendered strip - and stages the room around it:
     - the softbox fires and the room flashes with every shot
     - each frame drops onto a pile in the corner as it's taken
     - the step tabs get a sliding pill
     - the preview develops in each time the strip is re-rendered
     - on Review, the finished strip feeds out of the printer slot
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var app = $('#app'), flashEl = $('#flashEl'), video = $('#video'), tray = $('.tray');
  var softbox = $('.softbox'), printer = $('.printer'), printImg = $('.print-out img'), finalImg = $('#finalImg'), steps = $('#editSteps');
  if (!app) return;

  /* ------------------------------------------------- the shot: light + pile */
  var room = document.createElement('div'); room.className = 'roomflash'; room.setAttribute('aria-hidden', 'true'); document.body.appendChild(room);
  function snap() {
    if (!video || !video.videoWidth) return;
    var side = Math.min(video.videoWidth, video.videoHeight), cv = document.createElement('canvas');
    cv.width = cv.height = 180;
    var x = cv.getContext('2d');
    x.translate(180, 0); x.scale(-1, 1);
    x.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, 180, 180);
    var card = document.createElement('div');
    card.className = 'snap';
    card.style.setProperty('--r', (Math.random() * 18 - 9).toFixed(1) + 'deg');
    card.innerHTML = '<img alt="" src="' + cv.toDataURL('image/jpeg', 0.8) + '">';
    tray.appendChild(card);
    var cards = $$('.snap:not(.gone)', tray);
    if (cards.length > 5) cards[0].remove();
  }
  function clearPile() { $$('.snap', tray).forEach(function (c) { c.classList.add('gone'); setTimeout(function () { c.remove(); }, 520); }); }
  if (flashEl) new MutationObserver(function () {
    if (!flashEl.classList.contains('pop')) return;
    if (!reduced) {
      room.classList.remove('pop'); void room.offsetWidth; room.classList.add('pop');
      if (softbox) { softbox.classList.remove('fire'); void softbox.offsetWidth; softbox.classList.add('fire'); }
    }
    snap();
  }).observe(flashEl, { attributes: true, attributeFilter: ['class'] });

  /* ------------------------------------------------- app state changes */
  var lastState = app.getAttribute('data-state');
  new MutationObserver(function () {
    var st = app.getAttribute('data-state');
    if (st === lastState) return;
    if (st === 'intro') { clearPile(); retract(); }
    if (lastState === 'edit' && st !== 'edit') retract();
    lastState = st;
  }).observe(app, { attributes: true, attributeFilter: ['data-state'] });

  /* ------------------------------------------------- step pill */
  var pill = null;
  function placePill() {
    if (!steps) return;
    var on = $('span.on', steps);
    if (!on) return;
    if (!pill) { pill = document.createElement('i'); pill.className = 'step-pill'; steps.insertBefore(pill, steps.firstChild); steps.classList.add('has-pill'); }
    pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px';
    pill.style.top = on.offsetTop + 'px'; pill.style.height = on.offsetHeight + 'px';
    if (on.getAttribute('data-step') === 'review') printOut(); else retract();
  }
  if (steps) {
    new MutationObserver(placePill).observe(steps, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', placePill);
  }

  /* ------------------------------------------------- preview develops in */
  if (finalImg) new MutationObserver(function () {
    if (reduced) return;
    finalImg.classList.remove('dev'); void finalImg.offsetWidth; finalImg.classList.add('dev');
    if (printer && printer.classList.contains('printing')) printImg.src = finalImg.src;
  }).observe(finalImg, { attributes: true, attributeFilter: ['src'] });

  /* ------------------------------------------------- the printer */
  function printOut() {
    if (!printer || !finalImg || !finalImg.src) return;
    printImg.onload = function () {
      var h = printImg.offsetWidth * (printImg.naturalHeight / printImg.naturalWidth);
      printer.style.setProperty('--ph', Math.round(h) + 'px');
      app.style.setProperty('--ph', Math.round(h) + 'px');
      requestAnimationFrame(function () { printer.classList.add('printing'); app.classList.add('printing'); });
    };
    if (printImg.src === finalImg.src && printImg.complete) printImg.onload(); else printImg.src = finalImg.src;
  }
  function retract() {
    if (!printer) return;
    printer.classList.remove('printing'); app.classList.remove('printing');
  }
})();
