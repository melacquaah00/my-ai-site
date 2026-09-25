/* 720: Soul Protocol — tap-to-enlarge full-screen comic viewer.
   Vanilla JS, no libraries. Pinch / double-tap zoom, drag-to-pan,
   swipe to flip, swipe down / Esc / backdrop / X to close. */
(function () {
  "use strict";

  var TOTAL = 10;
  var BASE = "assets/comics/issue1/page-";
  var VER = ".png?v=4";
  var MAX_SCALE = 5;
  var DOUBLE_TAP_SCALE = 2.5;
  var reader = document.getElementById("issue1-reader");
  if (reader) {
    var t = parseInt(reader.getAttribute("data-total") || "10", 10);
    if (t > 0) TOTAL = t;
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function src(n) { return BASE + pad(n) + VER; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ICON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  // ---------- Build DOM ----------
  var root = document.createElement("div");
  root.className = "cv";
  root.id = "comic-viewer";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Issue #1 comic page viewer");
  root.hidden = true;
  root.innerHTML =
    '<div class="cv-stage" id="cv-stage">' +
      '<img class="cv-img" id="cv-img" alt="" width="1280" height="720" draggable="false" />' +
    '</div>' +
    '<span class="cv-count" id="cv-count" aria-live="polite">1 / ' + TOTAL + '</span>' +
    '<button type="button" class="cv-btn cv-close" id="cv-close" aria-label="Close viewer">' + ICON_X + '</button>' +
    '<button type="button" class="cv-btn cv-prev" id="cv-prev" aria-label="Previous page">' + ICON_L + '</button>' +
    '<button type="button" class="cv-btn cv-next" id="cv-next" aria-label="Next page">' + ICON_R + '</button>' +
    '<div class="cv-hint" id="cv-hint" role="status">' +
      '<span class="cv-hint-icon" aria-hidden="true">&#8635;</span>' +
      '<span>Rotate phone for bigger view</span>' +
      '<button type="button" class="cv-btn cv-hint-close" id="cv-hint-close" aria-label="Dismiss rotate hint">' + ICON_X + '</button>' +
    '</div>' +
    '<p class="cv-help" id="cv-help">Pinch or double-tap to zoom &middot; swipe to flip</p>';
  document.body.appendChild(root);

  var stage = root.querySelector("#cv-stage");
  var img = root.querySelector("#cv-img");
  var countEl = root.querySelector("#cv-count");
  var btnClose = root.querySelector("#cv-close");
  var btnPrev = root.querySelector("#cv-prev");
  var btnNext = root.querySelector("#cv-next");
  var hint = root.querySelector("#cv-hint");
  var hintClose = root.querySelector("#cv-hint-close");
  var help = root.querySelector("#cv-help");

  // ---------- State ----------
  var isOpen = false;
  var page = 1;
  var scale = 1, tx = 0, ty = 0;
  var savedScroll = 0;
  var returnFocus = null;
  var onCloseCb = null;
  var pushedHistory = false;
  var hintTimer = null, helpTimer = null;
  var preloaded = {};

  // ---------- Geometry ----------
  function stageSize() {
    return { w: stage.clientWidth || window.innerWidth, h: stage.clientHeight || window.innerHeight };
  }
  function contentSize() {
    var s = stageSize();
    var nw = img.naturalWidth || 1280, nh = img.naturalHeight || 720;
    var fit = Math.min(s.w / nw, s.h / nh);
    return { w: nw * fit, h: nh * fit, sw: s.w, sh: s.h };
  }
  function clampPan() {
    var c = contentSize();
    var mx = Math.max(0, (c.w * scale - c.sw) / 2);
    var my = Math.max(0, (c.h * scale - c.sh) / 2);
    tx = clamp(tx, -mx, mx);
    ty = clamp(ty, -my, my);
  }
  function apply(animate) {
    img.classList.toggle("cv-animate", !!animate);
    img.style.transform = "translate3d(" + tx + "px," + ty + "px,0) scale(" + scale + ")";
    root.classList.toggle("cv-zoomed", scale > 1.01);
  }
  // Zoom so the point (px,py) (relative to stage centre) stays under the finger.
  function zoomAt(newScale, px, py) {
    newScale = clamp(newScale, 1, MAX_SCALE);
    var k = newScale / scale;
    tx = px - (px - tx) * k;
    ty = py - (py - ty) * k;
    scale = newScale;
    if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; }
    clampPan();
  }
  function resetZoom(animate) {
    scale = 1; tx = 0; ty = 0;
    apply(animate);
  }
  function toStage(clientX, clientY) {
    var r = stage.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  }
  function pointOnContent(clientX, clientY) {
    var p = toStage(clientX, clientY);
    var c = contentSize();
    var hw = (c.w * scale) / 2, hh = (c.h * scale) / 2;
    return Math.abs(p.x - tx) <= hw && Math.abs(p.y - ty) <= hh;
  }

  // ---------- Pages ----------
  function preload(n) {
    if (n < 1 || n > TOTAL || preloaded[n]) return;
    var im = new Image();
    im.decoding = "async";
    im.src = src(n);
    preloaded[n] = im;
  }
  function show(n) {
    page = clamp(n, 1, TOTAL);
    resetZoom(false);
    img.classList.add("cv-loading");
    img.onload = function () { img.classList.remove("cv-loading"); };
    img.onerror = function () { img.classList.remove("cv-loading"); };
    img.src = src(page);
    if (img.complete && img.naturalWidth) img.classList.remove("cv-loading");
    img.alt = "720: Soul Protocol Issue #1 — page " + page + " of " + TOTAL;
    countEl.textContent = page + " / " + TOTAL;
    btnPrev.disabled = page <= 1;
    btnNext.disabled = page >= TOTAL;
    preload(page + 1);
    preload(page - 1);
    preload(page + 2);
  }
  function go(delta) {
    var n = page + delta;
    if (n < 1 || n > TOTAL) {
      // little bump so the reader knows it's the end
      tx = delta * -24; apply(true);
      setTimeout(function () { tx = 0; apply(true); }, 160);
      return;
    }
    show(n);
  }

  // ---------- Rotate hint ----------
  function hintDismissed() {
    try { return sessionStorage.getItem("cvHintOff") === "1"; } catch (e) { return false; }
  }
  function maybeShowHint() {
    clearTimeout(hintTimer);
    hint.classList.remove("cv-show", "cv-fade");
    var portraitNarrow = window.innerHeight > window.innerWidth && window.innerWidth < 700;
    if (!portraitNarrow || hintDismissed()) return;
    hint.classList.add("cv-show");
    hintTimer = setTimeout(function () {
      hint.classList.add("cv-fade");
      hintTimer = setTimeout(function () { hint.classList.remove("cv-show", "cv-fade"); }, 650);
    }, 4000);
  }
  function hideHint(remember) {
    clearTimeout(hintTimer);
    hint.classList.remove("cv-show", "cv-fade");
    if (remember) { try { sessionStorage.setItem("cvHintOff", "1"); } catch (e) {} }
  }

  // ---------- Open / close ----------
  function lockScroll() {
    savedScroll = window.pageYOffset || document.documentElement.scrollTop || 0;
    var b = document.body.style;
    b.position = "fixed";
    b.top = -savedScroll + "px";
    b.left = "0";
    b.right = "0";
    b.width = "100%";
    document.documentElement.classList.add("cv-lock");
    document.body.classList.add("cv-lock");
  }
  function unlockScroll() {
    var b = document.body.style;
    b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = "";
    document.documentElement.classList.remove("cv-lock");
    document.body.classList.remove("cv-lock");
    var html = document.documentElement;
    var prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, savedScroll);
    html.style.scrollBehavior = prevBehavior;
  }

  function open(n, fromEl, onClose) {
    if (isOpen) { show(n); return; }
    isOpen = true;
    returnFocus = fromEl || document.activeElement;
    onCloseCb = typeof onClose === "function" ? onClose : null;
    lockScroll();
    root.hidden = false;
    show(n || 1);
    // force reflow for fade-in
    void root.offsetWidth;
    root.classList.add("cv-open");
    try { btnClose.focus({ preventScroll: true }); } catch (e) { btnClose.focus(); }
    maybeShowHint();
    help.style.opacity = "1";
    clearTimeout(helpTimer);
    helpTimer = setTimeout(function () { help.style.opacity = "0"; }, 3500);
    try {
      history.pushState({ comicViewer: true }, "");
      pushedHistory = true;
    } catch (e) { pushedHistory = false; }
  }

  function close(fromPopState) {
    if (!isOpen) return;
    isOpen = false;
    pointers = {};
    gesture = null;
    hideHint(false);
    clearTimeout(helpTimer);
    root.classList.remove("cv-open", "cv-zoomed", "cv-dragging");
    root.hidden = true;
    resetZoom(false);
    unlockScroll();
    if (pushedHistory && !fromPopState) {
      pushedHistory = false;
      ignoreNextPop = true;
      try { history.back(); } catch (e) { ignoreNextPop = false; }
    }
    pushedHistory = false;
    if (returnFocus && returnFocus.focus) {
      try { returnFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    if (onCloseCb) { try { onCloseCb(page); } catch (e) {} }
    onCloseCb = null;
    // browsers may try to restore scroll after history.back(); pin it
    var y = savedScroll;
    setTimeout(function () { if (!isOpen && Math.abs(window.pageYOffset - y) > 2) window.scrollTo(0, y); }, 60);
  }

  var ignoreNextPop = false;
  window.addEventListener("popstate", function () {
    if (ignoreNextPop) { ignoreNextPop = false; return; }
    if (isOpen) { pushedHistory = false; close(true); }
  });

  // ---------- Buttons ----------
  btnClose.addEventListener("click", function () { close(false); });
  btnPrev.addEventListener("click", function () { go(-1); });
  btnNext.addEventListener("click", function () { go(1); });
  hintClose.addEventListener("click", function () { hideHint(true); });

  // ---------- Keyboard ----------
  document.addEventListener("keydown", function (e) {
    if (!isOpen) return;
    var k = e.key;
    if (k === "Escape" || k === "Esc") { e.preventDefault(); close(false); }
    else if (k === "ArrowRight" || k === "PageDown") { e.preventDefault(); if (scale > 1.01) { tx -= 80; clampPan(); apply(true); } else go(1); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); if (scale > 1.01) { tx += 80; clampPan(); apply(true); } else go(-1); }
    else if (k === "ArrowUp" && scale > 1.01) { e.preventDefault(); ty += 80; clampPan(); apply(true); }
    else if (k === "ArrowDown" && scale > 1.01) { e.preventDefault(); ty -= 80; clampPan(); apply(true); }
    else if (k === "+" || k === "=") { e.preventDefault(); zoomAt(scale * 1.5, 0, 0); apply(true); }
    else if (k === "-" || k === "_") { e.preventDefault(); zoomAt(scale / 1.5, 0, 0); apply(true); }
    else if (k === "0") { e.preventDefault(); resetZoom(true); }
    else if (k === "Tab") {
      // focus trap
      var f = Array.prototype.filter.call(root.querySelectorAll("button"), function (b) {
        return !b.disabled && b.offsetParent !== null;
      });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      var nx = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === -1 || i === f.length - 1 ? 0 : i + 1);
      f[nx].focus();
    }
  });

  // ---------- Pointer gestures (touch + mouse + pen) ----------
  var pointers = {};
  var gesture = null;
  var lastTap = { t: 0, x: 0, y: 0 };

  function ptList() {
    var a = [];
    for (var id in pointers) if (Object.prototype.hasOwnProperty.call(pointers, id)) a.push(pointers[id]);
    return a;
  }
  function startSingle(p) {
    gesture = {
      type: scale > 1.01 ? "pan" : "swipe",
      sx: p.x, sy: p.y, stx: tx, sty: ty,
      t0: Date.now(), moved: false, multi: gesture && gesture.multi
    };
  }
  function startPinch() {
    var a = ptList();
    var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
    var mid = toStage((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2);
    gesture = { type: "pinch", d0: d, s0: scale, m0: mid, tx0: tx, ty0: ty, multi: true, moved: true };
  }

  stage.addEventListener("pointerdown", function (e) {
    if (!isOpen) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var n = ptList().length;
    if (n === 1) startSingle(pointers[e.pointerId]);
    else if (n === 2) startPinch();
    root.classList.add("cv-dragging");
  });

  stage.addEventListener("pointermove", function (e) {
    if (!isOpen || !pointers[e.pointerId] || !gesture) return;
    e.preventDefault();
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var a = ptList();
    if (gesture.type === "pinch" && a.length >= 2) {
      var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
      var mid = toStage((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2);
      var ns = clamp(gesture.s0 * d / gesture.d0, 1, MAX_SCALE);
      // zoom about the initial midpoint, then follow midpoint movement
      var k = ns / gesture.s0;
      tx = gesture.m0.x - (gesture.m0.x - gesture.tx0) * k + (mid.x - gesture.m0.x);
      ty = gesture.m0.y - (gesture.m0.y - gesture.ty0) * k + (mid.y - gesture.m0.y);
      scale = ns;
      clampPan();
      apply(false);
      return;
    }
    var p = pointers[e.pointerId];
    var dx = p.x - gesture.sx, dy = p.y - gesture.sy;
    if (!gesture.moved && Math.hypot(dx, dy) > 8) gesture.moved = true;
    if (!gesture.moved) return;
    if (gesture.type === "pan") {
      tx = gesture.stx + dx;
      ty = gesture.sty + dy;
      clampPan();
      apply(false);
    } else if (gesture.type === "swipe") {
      // visual feedback: follow the finger horizontally, or downward to dismiss
      if (Math.abs(dx) >= Math.abs(dy)) {
        tx = dx * 0.6; ty = 0;
        root.style.backgroundColor = "";
      } else if (dy > 0) {
        tx = 0; ty = dy * 0.8;
        root.style.backgroundColor = "rgba(3,2,8," + Math.max(0.35, 1 - dy / 500) + ")";
      }
      apply(false);
    }
  });

  function endPointer(e) {
    if (!pointers[e.pointerId]) return;
    var p = pointers[e.pointerId];
    delete pointers[e.pointerId];
    try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
    var remaining = ptList();
    if (!gesture) return;

    if (gesture.type === "pinch") {
      if (remaining.length === 1) {
        // continue as pan with the remaining finger
        startSingle(remaining[0]);
        gesture.type = scale > 1.01 ? "pan" : "none";
        gesture.moved = true;
        gesture.multi = true;
      } else if (remaining.length === 0) {
        if (scale < 1.05) resetZoom(true);
        gesture = null;
        root.classList.remove("cv-dragging");
      }
      return;
    }
    if (remaining.length > 0) return;
    root.classList.remove("cv-dragging");
    var g = gesture;
    gesture = null;
    if (e.type === "pointercancel") {
      if (g.type === "swipe") { tx = 0; ty = 0; root.style.backgroundColor = ""; apply(true); }
      return;
    }
    var dx = p.x - g.sx, dy = p.y - g.sy;
    var dt = Date.now() - g.t0;

    if (g.type === "swipe" && g.moved && !g.multi) {
      root.style.backgroundColor = "";
      var ax = Math.abs(dx), ay = Math.abs(dy);
      var fast = dt < 350;
      if (ax > ay && (ax > 60 || (fast && ax > 30))) {
        tx = 0; ty = 0; apply(false);
        go(dx < 0 ? 1 : -1);
        return;
      }
      if (dy > 0 && ay > ax && (dy > 90 || (fast && dy > 45))) {
        swallowGhostClick();
        close(false);
        return;
      }
      tx = 0; ty = 0; apply(true);
      return;
    }
    if (g.moved || g.multi) return;

    // ---- it's a tap ----
    var now = Date.now();
    var onContent = pointOnContent(p.x, p.y);
    if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) {
      lastTap.t = 0;
      if (scale > 1.01) resetZoom(true);
      else {
        var sp = toStage(p.x, p.y);
        zoomAt(DOUBLE_TAP_SCALE, sp.x, sp.y);
        apply(true);
      }
      return;
    }
    lastTap = { t: now, x: p.x, y: p.y };
    if (!onContent && scale <= 1.01) {
      // backdrop tap closes (no need to wait for a double-tap there)
      swallowGhostClick();
      close(false);
    }
  }
  // After closing from a touch, the browser still fires a synthetic click at the
  // same spot on whatever is now underneath (e.g. another comic page). Eat it.
  var ghostUntil = 0;
  function swallowGhostClick() { ghostUntil = Date.now() + 500; }
  document.addEventListener("click", function (e) {
    if (Date.now() < ghostUntil) {
      ghostUntil = 0;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  }, true);
  root.addEventListener("touchend", function (e) {
    if (Date.now() < ghostUntil && e.cancelable) e.preventDefault();
  }, { passive: false });

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  // Mouse wheel / trackpad zoom on desktop
  stage.addEventListener("wheel", function (e) {
    if (!isOpen) return;
    e.preventDefault();
    var sp = toStage(e.clientX, e.clientY);
    var factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
    zoomAt(scale * factor, sp.x, sp.y);
    apply(false);
  }, { passive: false });

  // Stop the browser's own pinch-zoom / scrolling fighting the viewer (esp. iOS Safari)
  ["touchstart", "touchmove"].forEach(function (type) {
    root.addEventListener(type, function (e) {
      if (!isOpen) return;
      if (type === "touchmove" || e.touches.length > 1) e.preventDefault();
    }, { passive: false });
  });
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (type) {
    root.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
  });
  root.addEventListener("dblclick", function (e) { e.preventDefault(); });
  root.addEventListener("contextmenu", function (e) {
    if (e.target === stage || e.target === img) e.preventDefault();
  });

  window.addEventListener("resize", function () {
    if (!isOpen) return;
    clampPan();
    apply(false);
    if (window.innerHeight <= window.innerWidth) hideHint(false);
  });

  // ---------- Hook up Issue #1 page images ----------
  function makeOpener(el, n, onClose) {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Open Issue #1 page " + n + " full screen");
    el.setAttribute("aria-haspopup", "dialog");
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(typeof n === "function" ? n() : n, el, onClose);
      }
    });
  }

  var scrollImgs = document.querySelectorAll("#issue1-scroll .comic-scroll-page img");
  Array.prototype.forEach.call(scrollImgs, function (el, i) {
    var n = i + 1;
    var m = /page-(\d+)\.png/.exec(el.getAttribute("src") || "");
    if (m) n = parseInt(m[1], 10);
    el.setAttribute("data-page", String(n));
    makeOpener(el, n);
    el.addEventListener("click", function (e) {
      e.preventDefault();
      open(n, el);
    });
  });

  // Flip-through reader image: its inline onclick calls window.comicTap(),
  // which now opens this viewer at the reader's current page.
  var readerImg = document.getElementById("comic-page-img");
  if (readerImg) {
    makeOpener(readerImg, function () { return window.comicPage ? window.comicPage() : 1; }, function (p) {
      if (window.comicSetPage) window.comicSetPage(p);
    });
    readerImg.setAttribute("aria-label", "Open current Issue #1 page full screen");
  }

  window.comicViewer = {
    open: open,
    close: function () { close(false); },
    isOpen: function () { return isOpen; },
    page: function () { return page; }
  };
})();
