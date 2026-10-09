// PeptideScope: intro (v4, "simpler, faster, for teens").
//
// export function mountIntro(host /* #intro */, { reducedMotion, onEnter, onFacts, onSkip }) → { dispose(), go(i) }
//
// A slow, simple chapter story with no WebGL: real photographs (vials, an insulin syringe with orange
// caps, a blood-cell micrograph) and our own renders of the anatomy, one short line per chapter, then
// "PeptideScope", the tagline and "Start exploring" / "Read the facts". The markup is static HTML in
// index.html (#intro); without this module it is a plain vertical story that already works.
//
// SCROLLY MODE (motion allowed). #intro is the scroll container: a sticky full-screen stage plus an
// empty track one viewport tall per chapter, with a snap point per chapter (one swipe or wheel step =
// one chapter). Crossing the halfway point between two chapters makes the next one active: it
// cross-fades in with CSS transitions (opacity and transform only). The only per-frame work is one
// transform on the progress hairline, done in requestAnimationFrame from a passive scroll listener.
// Pictures more than one chapter away are display:none, so their lazy images load one chapter ahead.
// STORY MODE (reduced motion). The same chapters as a simple vertical story; nothing animates.
// It follows opts.reducedMotion at mount, then the bus event motion:change { reducedMotion } live
// (html[data-motion], then the media query, when the option is missing), keeping the current chapter.
// KEYS. Space / PageDown / ArrowDown / ArrowRight: next chapter; Shift+Space / PageUp / ArrowUp /
// ArrowLeft: previous; Home / End; Enter (nothing focused) goes to the next chapter, and on the end card
// starts exploring. Escape and Skip are handled by main.js; pass onSkip to have the intro handle them
// (the dev sandbox does). A persistent "Next" button (.intro-next) sits by the dots on every chapter but
// the end card, with a "Space or ↓ for next" hint for keyboard users. In the scrolly story only the
// controls of the chapter on screen are in the Tab order, and when the chapter changes under a focused
// control, focus moves to "Next" (or to "Start exploring" on the end card), never to something hidden.
// EVENTS. intro:near-end (bus) when the story reaches its last two chapters: main.js may start the 3D
// downloads then (no WebGL while the intro shows).
// Classes on #intro: .intro--js, .intro--scrolly, .intro--instant; data-chapter = the active chapter id.
// Dev: host.__intro = { go(i, { instant }), state }.

import { bus } from './bus.js';

const SNAP_CLASS = 'intro-snap';

function prefersReducedMotion() {
  const m = document.documentElement.dataset.motion;
  if (m === 'reduce') return true;
  if (m === 'full') return false;
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function mountIntro(host, opts = {}) {
  if (!host || typeof host.querySelector !== 'function') return { dispose() {}, go() {} };
  const { onEnter, onFacts, onSkip } = opts;
  const slides = [...host.querySelectorAll('.intro-ch')];
  const N = slides.length;
  if (!N) return { dispose() {}, go() {} };

  const bar = host.querySelector('.intro-progress > span');
  const dotsHost = host.querySelector('.intro-dots');
  const nextBtn = host.querySelector('.intro-next');
  const enterBtn = host.querySelector('#intro-enter');
  let nearEndSent = false;
  const track = host.querySelector('.intro-track');
  const barEl = host.querySelector('.intro-bar');

  const offs = [];
  const on = (target, type, fn, o) => {
    if (!target) return;
    target.addEventListener(type, fn, o);
    offs.push(() => target.removeEventListener(type, fn, o));
  };

  // Story mode (the plain vertical story) for reduced motion, and for very short viewports such as a
  // laptop at 400% zoom, where a full-screen chapter cannot fit (a11y review: reflow).
  const SHORT = 320;
  let motionReduced = typeof opts.reducedMotion === 'boolean' ? opts.reducedMotion : prefersReducedMotion();
  const tooShort = () => (window.innerHeight || SHORT) < SHORT;
  let reduced = motionReduced || tooShort();
  let active = -1;
  let prevActive = -1;
  let H = host.clientHeight || window.innerHeight;
  let raf = 0;
  let instantRaf = 0;
  let left = false;
  let disposed = false;
  const decoded = new WeakSet();

  // ---------------------------------------------------------------- generated furniture (scrolly only)
  const dots = [];
  if (dotsHost) {
    dotsHost.textContent = '';
    for (let i = 0; i < N; i++) {
      const d = document.createElement('span');
      d.className = 'intro-dot';
      dotsHost.append(d);
      dots.push(d);
    }
  }
  const snaps = [];
  for (let i = 0; i < N; i++) {
    const s = document.createElement('div');
    s.className = SNAP_CLASS;
    s.setAttribute('aria-hidden', 'true');
    s.style.top = `${i * 100}%`;
    snaps.push(s);
  }

  // a picture that fails to load shows its calm frame instead of a broken-image icon
  for (const img of host.querySelectorAll('.intro-frame img')) {
    const frame = img.closest('.intro-frame');
    const broken = () => frame.classList.add('is-broken');
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) broken();
    on(img, 'error', broken);
    on(img, 'load', () => frame.classList.remove('is-broken'));
  }

  // ---------------------------------------------------------------- modes
  function applyMode() {
    host.classList.toggle('intro--scrolly', !reduced);
    if (!reduced) {
      if (track) track.style.height = `${(N - 1) * 100}%`;
      for (const s of snaps) if (!s.isConnected) host.append(s);
    } else {
      if (track) track.style.height = '';
      for (const s of snaps) s.remove();
    }
  }

  function storyIndex() {
    // the last chapter whose top has passed the upper third of the screen
    const top = host.getBoundingClientRect().top + (barEl ? barEl.offsetHeight : 0);
    let idx = 0;
    for (let i = 0; i < N; i++) {
      if (slides[i].getBoundingClientRect().top - top <= H * 0.34) idx = i;
    }
    return idx;
  }

  function currentIndex() {
    if (!reduced) return clampIndex(Math.round(host.scrollTop / Math.max(1, H)));
    return storyIndex();
  }

  function clampIndex(i) { return i < 0 ? 0 : i > N - 1 ? N - 1 : i; }

  function setReducedMotion(next) {
    motionReduced = !!next;
    next = motionReduced || tooShort();
    if (next === reduced || disposed) return;
    const idx = active >= 0 ? active : currentIndex();
    reduced = next;
    instant();
    applyMode();
    H = host.clientHeight || window.innerHeight;
    go(idx, { instant: true });
    activate(idx, true);
    frame();
  }

  // one frame without transitions (mount, mode switch, jumps)
  function instant() {
    host.classList.add('intro--instant');
    cancelAnimationFrame(instantRaf);
    instantRaf = requestAnimationFrame(() => {
      instantRaf = requestAnimationFrame(() => { instantRaf = 0; host.classList.remove('intro--instant'); });
    });
  }

  // ---------------------------------------------------------------- chapters
  // Scrolly story: only the controls in the chapter on screen can take focus (Tab never lands on a
  // control that is faded out, and never jumps the story to another chapter).
  const CONTROLS = 'button, a[href], summary, input, select, textarea';
  function syncTabOrder() {
    for (let k = 0; k < N; k++) {
      for (const c of slides[k].querySelectorAll(CONTROLS)) {
        if (!reduced && k !== active) {
          if (!c.hasAttribute('data-intro-tab')) c.setAttribute('data-intro-tab', c.getAttribute('tabindex') ?? '');
          c.setAttribute('tabindex', '-1');
        } else if (c.hasAttribute('data-intro-tab')) {
          const was = c.getAttribute('data-intro-tab');
          if (was) c.setAttribute('tabindex', was); else c.removeAttribute('tabindex');
          c.removeAttribute('data-intro-tab');
        }
      }
    }
    if (nextBtn) nextBtn.hidden = active >= N - 1;
  }

  function activate(i, force = false) {
    if (i === active && !force) return;
    if (i !== active) prevActive = active;
    active = i;
    if (!nearEndSent && i >= N - 2) { nearEndSent = true; try { bus.emit('intro:near-end', {}); } catch { /* ignore */ } }
    for (let k = 0; k < N; k++) {
      const s = slides[k];
      const near = Math.abs(k - i) <= 1 || k === prevActive;
      s.classList.toggle('is-active', k === i);
      s.classList.toggle('is-near', near);
      if (dots[k]) {
        dots[k].classList.toggle('is-active', k === i);
        dots[k].classList.toggle('is-done', k < i);
      }
    }
    host.dataset.chapter = slides[i].dataset.ch || String(i);
    const openCredits = host.querySelector('.intro-credits[open]');
    if (openCredits && !slides[i].contains(openCredits)) openCredits.open = false;
    // focus must never sit on a chapter that is fading out (or on Next once it hides on the end card):
    // it moves to a control that stays visible
    const f = document.activeElement;
    syncTabOrder();
    if (!reduced && f && f !== host && host.contains(f)) {
      const owner = f.closest('.intro-ch');
      const leaving = (owner && owner !== slides[i]) || (f === nextBtn && nextBtn.hidden);
      if (leaving) {
        const to = i >= N - 1 ? enterBtn : nextBtn;
        if (to && !to.hidden) to.focus({ preventScroll: true }); else host.focus({ preventScroll: true });
      }
    }
    // decode the neighbours' pictures ahead of their cross-fade
    for (const k of [i + 1, i - 1]) {
      const img = slides[k]?.querySelector('.intro-frame img');
      if (img && !decoded.has(img) && typeof img.decode === 'function') {
        decoded.add(img);
        // runs once the image has loaded (display:none until now, so a lazy image starts here)
        requestAnimationFrame(() => { if (!disposed) img.decode().catch(() => {}); });
      }
    }
  }

  function frame() {
    raf = 0;
    if (disposed) return;
    if (reduced) {
      const i = storyIndex();
      if (i !== active) activate(i);
      return;
    }
    const f = Math.min(N - 1, Math.max(0, host.scrollTop / Math.max(1, H)));
    const i = clampIndex(Math.round(f));
    if (i !== active) activate(i);
    if (bar) bar.style.transform = `scaleX(${(f / (N - 1)).toFixed(4)})`;
  }

  function onScroll() {
    if (!raf) raf = requestAnimationFrame(frame);
    if (settleTimer) armSettle();
  }

  // the chapter a smooth scroll is heading for, so quick repeated key presses add up (PageDown twice =
  // two chapters) instead of restarting from the chapter still showing
  let target = -1;
  let targetAt = 0;
  function go(i, { instant: now = false } = {}) {
    i = clampIndex(i);
    target = now ? -1 : i;
    targetAt = performance.now();
    if (!reduced) {
      const behavior = now ? 'instant' : 'smooth';
      host.scrollTo({ top: i * H, behavior });
      if (now) { instant(); activate(i); frame(); }
      return;
    }
    // story mode: centre the chapter between the sticky bar and the disclaimer bar, instantly (nothing
    // animates here); a chapter taller than that space starts just under the bar
    const barH = barEl ? barEl.offsetHeight : 0;
    const discH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--disclaimer-h')) || 40;
    const r = slides[i].getBoundingClientRect();
    const room = H - barH - discH;
    const offset = barH + Math.max(0, (room - r.height) / 2);
    const top = i === 0 ? 0 : host.scrollTop + r.top - host.getBoundingClientRect().top - offset;
    host.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    activate(i);
  }

  function step(dir) {
    const heading = !reduced && target >= 0 && performance.now() - targetAt < 900;
    const from = heading ? target : active >= 0 ? active : currentIndex();
    go(from + dir);
  }

  // ---------------------------------------------------------------- leaving
  function leave(kind) {
    if (left || disposed) return;
    left = true;
    const fn = kind === 'facts' ? onFacts : kind === 'skip' ? onSkip : onEnter;
    if (typeof fn === 'function') fn({ reason: kind });
  }

  // ---------------------------------------------------------------- input
  function isControl(t) {
    return !!(t && t !== host && t !== document.body && t.closest &&
      t.closest('button, a[href], summary, input, select, textarea, [contenteditable=""], [contenteditable="true"]'));
  }

  function onKey(e) {
    if (disposed || left || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.documentElement.dataset.intro && document.documentElement.dataset.intro !== 'show') return;
    const control = isControl(e.target);
    switch (e.key) {
      case 'Escape':
        if (typeof onSkip === 'function') { e.preventDefault(); leave('skip'); }
        return;
      case 'Enter':
        if (control) return;
        e.preventDefault();
        // only the end card leaves the story; elsewhere Enter means "next"
        if (active >= N - 1) leave('enter'); else step(1);
        return;
      case ' ':
      case 'Spacebar':
        if (control) return;
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
        return;
      case 'PageDown':
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        step(1);
        return;
      case 'PageUp':
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        step(-1);
        return;
      case 'Home':
        e.preventDefault();
        go(0);
        return;
      case 'End':
        e.preventDefault();
        go(N - 1);
        return;
      default:
    }
  }

  function onFocusIn(e) {
    if (reduced) return;
    const owner = e.target.closest?.('.intro-ch');
    if (!owner) return;
    const k = slides.indexOf(owner);
    // (controls of other chapters are out of the Tab order; this only catches a programmatic focus)
    if (k >= 0 && k !== active) go(k, { instant: true });
  }

  // Directional settle. CSS snapping (mandatory, snap-stop: always) does the paging, but browsers
  // treat a small wheel step or a short, slow swipe as "go back to where you were". If a gesture
  // ends on the chapter it started from, move one chapter in the gesture's direction instead.
  // Passive listeners only; nothing here blocks or replaces the browser's own scrolling.
  let gestureFrom = 0;
  let gestureDelta = 0;
  let gestureAt = 0;
  let settleTimer = 0;
  let touchY = null;
  function noteGesture(delta) {
    const now = performance.now();
    if (now - gestureAt > 450) { gestureDelta = 0; gestureFrom = active; }
    gestureDelta += delta;
    gestureAt = now;
    armSettle();
  }
  function armSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 200);
  }
  function settle() {
    settleTimer = 0;
    if (reduced || disposed || left || !gestureDelta) return;
    if (performance.now() - gestureAt > 1500) { gestureDelta = 0; return; }
    const atRest = Math.abs(host.scrollTop - active * H) < 2;
    if (!atRest) { armSettle(); return; } // still moving (a snap settling): look again shortly
    const dir = Math.sign(gestureDelta);
    const from = gestureFrom;
    gestureDelta = 0;
    if (active === from) go(active + dir); // the browser put us back where we started
  }
  function onWheel(e) {
    if (reduced || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? H : 1;
    noteGesture(e.deltaY * unit);
  }
  function onTouchStart(e) {
    touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
    gestureFrom = active;
    gestureDelta = 0;
  }
  function onTouchEnd(e) {
    if (touchY == null || reduced) return;
    const t = e.changedTouches[0];
    const dy = t ? touchY - t.clientY : 0;
    touchY = null;
    if (Math.abs(dy) < 36) return; // a tap or a tiny drag
    const from = gestureFrom;
    noteGesture(dy);
    gestureFrom = from;
  }

  let resizeObs = null;
  function onResize() {
    if ((motionReduced || tooShort()) !== reduced) { setReducedMotion(motionReduced); return; }
    const h = host.clientHeight || window.innerHeight;
    if (h === H) return;
    H = h;
    if (!reduced && active >= 0) {
      host.scrollTo({ top: active * H, behavior: 'instant' });
      frame();
    }
  }

  // ---------------------------------------------------------------- wire up
  host.classList.add('intro--js');
  instant();
  applyMode();
  H = host.clientHeight || window.innerHeight;
  activate(currentIndex(), true);
  frame();

  on(host, 'scroll', onScroll, { passive: true });
  on(host, 'scrollend', () => { if (gestureDelta) settle(); }, { passive: true });
  on(host, 'wheel', onWheel, { passive: true });
  on(host, 'touchstart', onTouchStart, { passive: true });
  on(host, 'touchend', onTouchEnd, { passive: true });
  on(document, 'keydown', onKey);
  on(host, 'focusin', onFocusIn);
  on(host.querySelector('#intro-enter'), 'click', () => leave('enter'));
  on(host.querySelector('#intro-facts'), 'click', () => leave('facts'));
  on(host.querySelector('.intro-cue'), 'click', () => step(1));
  on(nextBtn, 'click', () => step(1));
  if (typeof onSkip === 'function') on(host.querySelector('#intro-skip'), 'click', () => leave('skip'));
  // the credits disclosure floats over the end card: a click elsewhere or Escape closes it (Escape
  // stops there, so it does not also skip the intro)
  const credits = host.querySelector('.intro-credits');
  if (credits) {
    on(host, 'pointerdown', (e) => { if (credits.open && !credits.contains(e.target)) credits.open = false; });
    on(credits, 'keydown', (e) => {
      if (e.key === 'Escape' && credits.open) {
        e.preventDefault();
        e.stopPropagation();
        credits.open = false;
        credits.querySelector('summary')?.focus();
      }
    });
    // ... and it closes when focus leaves it, so it never hides the control that now has focus
    on(credits, 'focusout', (e) => { if (credits.open && !credits.contains(e.relatedTarget)) credits.open = false; });
  }
  if ('ResizeObserver' in window) {
    resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(host);
  } else {
    on(window, 'resize', onResize, { passive: true });
  }
  const offMotion = bus.on('motion:change', (d) => setReducedMotion(d && d.reducedMotion));
  offs.push(offMotion);

  const dev = {
    go: (i, o) => go(i, o),
    get state() {
      return { active, chapter: slides[active]?.dataset.ch, count: N, reducedMotion: reduced, height: H, scrollTop: host.scrollTop };
    },
  };
  host.__intro = dev;

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(instantRaf);
    clearTimeout(settleTimer);
    for (const off of offs.splice(0)) { try { off(); } catch { /* already gone */ } }
    resizeObs?.disconnect();
    for (const s of snaps) s.remove();
    if (dotsHost) dotsHost.textContent = '';
    if (track) track.style.height = '';
    reduced = true; // restore every control's tab order
    syncTabOrder();
    if (host.__intro === dev) delete host.__intro;
  }

  return { dispose, go: (i) => go(i) };
}
