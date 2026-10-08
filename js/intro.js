// PeptideScope: scroll-driven film intro (intro).
//
// export function mountIntro(host /* #intro */, { reducedMotion, onEnter, onFacts }) → { dispose() }
//
// The intro is a short "product film" that the visitor scrubs by scrolling, rendered live in WebGL:
//   01 the vial      a lifelike gray-market peptide vial on obsidian (no amount, no brand on the label)
//   02 the syringe   an insulin-type syringe beside it, a single drop at the needle tip (never mixing,
//                    drawing up, measuring, volumes or needle angles)
//   03 the site      a lifelike human body (real anatomy skin, close-up on the belly landmark)
//   04 under skin    a cut block of tissue: skin, the fat layer, muscle; the depot pooling in the fat
//   05 the blood     along a capillary that widens into a vein: red cells, the drug as champagne light
//   06 the body      pull back to the whole see-through body; the drug travels the real vessel paths to
//                    the heart and out to the organs that have its receptors, which light up
//   end              PeptideScope, the tagline, "Enter the body" / "Read the facts first", the safety line
//
// SCROLL. #intro is the scroll container (a full-screen sticky stage plus a tall, empty track), so the
// page behind never moves; the page's own scroll position is untouched and restored if anything moved
// it. Scroll position is smoothed with a critically damped follow, like a video scrub.
// KEYS. Space / PageDown / ArrowDown / ArrowRight: next chapter; Shift+Space / PageUp / ArrowUp /
// ArrowLeft: previous; Home / End; Enter (nothing focused) enters; Escape skips. Focusing a button of
// the end card jumps there, so keyboard users never tab onto an invisible control.
// REDUCED MOTION. No scrubbing and no ambient motion: the same chapters become still frames that change
// instantly at chapter boundaries (scroll, keys or the Back / Next buttons). It follows opts.reducedMotion
// at mount, then the bus event motion:change { reducedMotion } live (html[data-motion], then the media
// query, when the option is missing).
// FIRST FRAME. Everything that says what this is (kicker "Independent education · Not a seller", the
// title and tagline, the line "Education only · Nothing for sale · Not medical advice · No dosing
// guidance", Skip) is static HTML in index.html, visible before any script or 3D has loaded, over a
// CSS/SVG still. Without WebGL the intro stays that still title card (fully usable, no scroll track).
// TEARDOWN. dispose() stops the loop, frees every geometry, material, texture and render target, calls
// renderer.dispose() + forceContextLoss() and removes the canvas, so the 3D body never shares the GPU with
// a second live WebGL context. If nobody calls dispose(), rendering stops by itself ~1.2 s after leaving.
//
// Classes on #intro (css/intro.css): .intro--js, .intro--film (scroll film active), .intro--webgl (canvas
// shows), .intro--no-webgl (static still), .intro--still (reduced motion), .intro--end (end card),
// .intro--leaving. Per-frame values go into CSS custom properties on the elements themselves.
// Dev only: host.__intro = { seek(p, { instant }), state } and the returned object's `_state`.

import { bus } from './bus.js';

// ---------------------------------------------------------------------------------------------- film map
// All positions are fractions of the scroll track (0 = top, 1 = end card fully in).
const OPEN_OUT = [0.018, 0.058];       // opening title fades out
const END_IN = [0.9, 0.938];           // end card fades in
const CHAPTERS = [
  { id: 'vial', from: 0.052, to: 0.168, stop: 0.108 },
  { id: 'syringe', from: 0.178, to: 0.292, stop: 0.238 },
  { id: 'site', from: 0.33, to: 0.456, stop: 0.404 },
  { id: 'skin', from: 0.494, to: 0.606, stop: 0.556 },
  { id: 'blood', from: 0.646, to: 0.762, stop: 0.712 },
  { id: 'body', from: 0.8, to: 0.894, stop: 0.858 },
];
// keyboard / button stops and the reduced-motion still frames (0 = opening, last = end card)
const STOPS = [0, ...CHAPTERS.map((c) => c.stop), 1];
// shots: which 3D set is on screen; neighbours overlap during a dissolve
const SHOTS = [
  { set: 'studio', from: 0, to: 0.322 },
  { set: 'body', from: 0.296, to: 0.49 },
  { set: 'tissue', from: 0.462, to: 0.642 },
  { set: 'blood', from: 0.614, to: 0.798 },
  { set: 'glass', from: 0.772, to: 1.01 },
];
const SMOOTH = 5.2;                    // scroll follow rate (1/s); higher = snappier
const TEXT_DEADLINE_MS = 6000;         // if the 3D is not ready by then the still stays (text is static anyway)

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const window01 = (from, to, p, f = 0.022) => sstep(from - f * 0.2, from + f, p) * (1 - sstep(to - f, to + f * 0.2, p));

export function mountIntro(host, opts = {}) {
  const noop = { dispose() {} };
  if (!host || typeof host.querySelector !== 'function') return noop;
  const { onEnter, onFacts } = opts;
  const debug = opts.debug || null;
  let reducedMotion = typeof opts.reducedMotion === 'boolean' ? opts.reducedMotion : prefersReducedMotion();

  const $ = (sel) => host.querySelector(sel);
  const cleanups = [];
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); };

  let disposed = false;
  let leaving = false;
  let gl = null;
  const savedPageScroll = { x: window.scrollX || 0, y: window.scrollY || 0 };

  // ------------------------------------------------------------------------------------------- DOM
  const stage = $('.intro-stage') || host;
  let canvasHost = $('#intro-canvas-host');
  if (!canvasHost) {
    canvasHost = document.createElement('div');
    canvasHost.id = 'intro-canvas-host';
    canvasHost.className = 'intro-canvas-host';
    canvasHost.setAttribute('aria-hidden', 'true');
    stage.prepend(canvasHost);
  }
  let track = $('.intro-track');
  const createdTrack = !track;
  if (!track) {
    track = document.createElement('div');
    track.className = 'intro-track';
    track.setAttribute('aria-hidden', 'true');
    host.append(track);
  }
  const els = {
    card: $('.intro-card'),
    actions: $('.intro-actions'),
    cue: $('.intro-cue'),
    chapters: [...host.querySelectorAll('.intro-chapter')],
    progress: $('.intro-progress'),
    count: $('.intro-count-now'),
    prev: $('.intro-prev'),
    next: $('.intro-next'),
    labels: $('.intro-labels'),
    skip: $('#intro-skip'),
    enter: $('#intro-enter'),
    facts: $('#intro-facts'),
  };
  const endControls = [els.enter, els.facts].filter(Boolean);

  const webglLikely = !debug?.no3d && hasWebGL2();
  host.hidden = false;
  host.classList.add('intro--js');
  host.classList.toggle('intro--still', reducedMotion);
  if (webglLikely) host.classList.add('intro--film');
  else host.classList.add('intro--no-webgl');

  // ------------------------------------------------------------------------------------------- scroll
  const S = { target: 0, shown: 0, chapter: -1, stop: 0, endShown: false, lastDom: null };
  const maxScroll = () => Math.max(1, host.scrollHeight - host.clientHeight);
  const readTarget = () => { S.target = clamp01(host.scrollTop / maxScroll()); };
  host.scrollTop = 0;

  function stopIndexFor(p) {
    // reduced motion: the still shown is the last stop the visitor has scrolled to (midpoints switch)
    let i = 0;
    for (let k = 1; k < STOPS.length; k++) if (p >= (STOPS[k - 1] + STOPS[k]) / 2) i = k;
    return i;
  }
  function filmP() { return reducedMotion ? STOPS[stopIndexFor(S.target)] : S.shown; }

  function scrollToP(p, { instant = false } = {}) {
    const top = Math.round(clamp01(p) * maxScroll());
    host.scrollTo({ top, behavior: 'auto' });
    readTarget();
    if (instant || reducedMotion) S.shown = S.target;
    wake();
  }
  function step(dir) {
    const p = reducedMotion ? STOPS[stopIndexFor(S.target)] : S.target;
    let i = dir > 0 ? STOPS.findIndex((s) => s > p + 0.004) : findLastIndex(STOPS, (s) => s < p - 0.004);
    if (i < 0) i = dir > 0 ? STOPS.length - 1 : 0;
    scrollToP(STOPS[i]);
  }

  // ------------------------------------------------------------------------------------------- text
  // Per-frame: opacities of the opening card, captions and end card, the progress line and chapter count.
  // Writes go straight to element styles and only when a value changed.
  const domCache = new Map();
  const setVar = (el, name, v) => {
    if (!el) return;
    const key = el;
    let c = domCache.get(key);
    if (!c) { c = {}; domCache.set(key, c); }
    const r = Math.round(v * 1000) / 1000;
    if (c[name] === r) return;
    c[name] = r;
    el.style.setProperty(name, String(r));
    if (name === '--o') el.classList.toggle('is-off', r <= 0.001);
  };
  function updateText(p) {
    const still = reducedMotion;
    const idx = stopIndexFor(S.target);
    const open = still ? (idx === 0 ? 1 : 0) : 1 - sstep(OPEN_OUT[0], OPEN_OUT[1], p);
    const end = still ? (idx === STOPS.length - 1 ? 1 : 0) : sstep(END_IN[0], END_IN[1], p);
    setVar(els.card, '--o', Math.max(open, end));
    setVar(els.cue, '--o', still ? 0 : open * (1 - sstep(0.004, 0.03, p)));
    setVar(els.actions, '--o', end);
    host.classList.toggle('intro--end', end > 0.6);
    host.classList.toggle('intro--opening', open > 0.5);
    for (let i = 0; i < els.chapters.length; i++) {
      const c = CHAPTERS[i];
      const o = c ? (still ? (idx === i + 1 ? 1 : 0) : window01(c.from, c.to, p)) : 0;
      setVar(els.chapters[i], '--o', o);
      els.chapters[i].classList.toggle('is-on', o > 0.5);
    }
    let chapter = 0;
    for (let i = 0; i < CHAPTERS.length; i++) if (p >= CHAPTERS[i].from - 0.02) chapter = i + 1;
    if (p >= END_IN[0]) chapter = CHAPTERS.length;
    if (still) chapter = Math.min(CHAPTERS.length, Math.max(idx, 0));
    if (chapter !== S.chapter) {
      S.chapter = chapter;
      if (els.count) els.count.textContent = String(Math.max(1, chapter)).padStart(2, '0');
      host.dataset.chapter = String(chapter);
    }
    setVar(els.progress, '--p', still ? idx / (STOPS.length - 1) : p);
    if (els.prev) els.prev.disabled = (still ? idx : S.target) <= 0.001;
    if (els.next) els.next.disabled = (still ? idx === STOPS.length - 1 : S.target >= 0.999);
  }

  // ------------------------------------------------------------------------------------------- loop
  // One rAF loop drives the smoothing, the text and (once ready) the 3D. Without 3D it only runs while
  // the scroll is settling.
  let raf = 0;
  let lastNow = 0;
  let clock = 0;
  function wake() { if (!raf && !disposed && !document.hidden) { lastNow = 0; raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    if (disposed) return;
    const rawDt = lastNow ? (now - lastNow) / 1000 : 0;
    const dt = lastNow ? Math.min(0.1, rawDt) : 1 / 60;
    lastNow = now;
    if (!reducedMotion && !(debug && debug.freeze)) clock += dt;
    const before = S.shown;
    if (reducedMotion) S.shown = S.target;
    else {
      const k = 1 - Math.exp(-SMOOTH * dt);
      S.shown += (S.target - S.shown) * k;
      if (Math.abs(S.target - S.shown) < 0.00005) S.shown = S.target;
    }
    const p = filmP();
    updateText(p);
    let keep = Math.abs(S.shown - S.target) > 0 || S.shown !== before;
    if (gl && gl.ready) {
      gl.render(p, clock, dt, rawDt);
      keep = keep || (!reducedMotion && gl.animating && !(debug && debug.freeze));
    }
    if (keep && !leavingStopped) raf = requestAnimationFrame(frame);
  }
  let leavingStopped = false;

  on(host, 'scroll', () => { readTarget(); wake(); }, { passive: true });
  on(document, 'visibilitychange', () => { if (!document.hidden) wake(); });
  on(window, 'resize', () => { readTarget(); wake(); });

  // ------------------------------------------------------------------------------------------- leave
  function leave(reason) {
    if (leaving || disposed) return;
    leaving = true;
    host.classList.add('intro--leaving');
    gl?.beginExit();
    later(() => { leavingStopped = true; gl?.stop(); }, reducedMotion ? 0 : 1200);
    restorePageScroll();
    const cb = reason === 'facts' ? (onFacts || onEnter) : onEnter;
    try { cb?.({ reason }); } catch (err) { console.error('[intro] callback failed', err); }
  }
  function restorePageScroll() {
    if ((window.scrollY || 0) !== savedPageScroll.y || (window.scrollX || 0) !== savedPageScroll.x) {
      window.scrollTo(savedPageScroll.x, savedPageScroll.y);
    }
  }
  if (els.enter) on(els.enter, 'click', () => leave('enter'));
  if (els.facts) on(els.facts, 'click', () => leave('facts'));
  if (els.skip) on(els.skip, 'click', () => leave('skip'));
  if (els.prev) on(els.prev, 'click', () => step(-1));
  if (els.next) on(els.next, 'click', () => step(1));

  on(document, 'keydown', (e) => {
    if (leaving || disposed || host.hidden || e.defaultPrevented || e.isComposing) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    const interactive = t && t.closest && t.closest('button, a[href], input, select, textarea, summary, [contenteditable=""], [contenteditable="true"], [role="button"], [role="link"]');
    const typing = t && t.closest && t.closest('input, select, textarea, [contenteditable=""], [contenteditable="true"]');
    if (e.key === 'Escape') { leave('skip'); return; }
    if (e.shiftKey && e.key !== ' ') return;
    if (e.key === 'Enter') {
      if (interactive) return; // a focused control handles its own Enter
      e.preventDefault();
      leave('enter');
      return;
    }
    if (typing || !host.classList.contains('intro--film')) return;
    const next = (e.key === ' ' && !e.shiftKey && !interactive) || e.key === 'PageDown' || e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const prev = (e.key === ' ' && e.shiftKey && !interactive) || e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    if (next || prev) { e.preventDefault(); step(next ? 1 : -1); return; }
    if (e.key === 'Home') { e.preventDefault(); scrollToP(0); return; }
    if (e.key === 'End') { e.preventDefault(); scrollToP(1); }
  });
  // Keyboard focus on an end-card control (or any intro control while the card is hidden) jumps to the
  // end card, so focus never lands on something invisible.
  on(host, 'focusin', (e) => {
    if (!host.classList.contains('intro--film')) return;
    if (endControls.includes(e.target) && S.target < END_IN[1]) scrollToP(1, { instant: true });
  });

  // Live motion preference (header toggle, OS setting): still chapters ⇄ scrubbed film, never a restart.
  function setReducedMotion(rm) {
    rm = !!rm;
    if (rm === reducedMotion || leaving || disposed) return;
    reducedMotion = rm;
    host.classList.toggle('intro--still', rm);
    if (!rm) S.shown = S.target;
    gl?.setReducedMotion(rm);
    wake();
  }
  cleanups.push(bus.on('motion:change', (d) => setReducedMotion(d && d.reducedMotion)));

  // ------------------------------------------------------------------------------------------- 3D
  readTarget();
  updateText(filmP());
  if (webglLikely) {
    start3D().catch((err) => {
      if (disposed) return;
      console.warn('[intro] 3D unavailable, keeping the still title card.', err);
      fallbackToStill();
    });
    later(() => { if (!gl || !gl.ready) host.classList.add('intro--slow'); }, TEXT_DEADLINE_MS);
  }
  function fallbackToStill() {
    host.classList.remove('intro--film', 'intro--webgl');
    host.classList.add('intro--no-webgl');
    host.scrollTop = 0;
    readTarget();
    S.shown = 0;
    updateText(0);
  }

  async function start3D() {
    const [THREE, composerMod, bloomMod, passMod, syringeMod, vialMod, gltfMod, meshoptMod] = await Promise.all([
      import('three'),
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/Pass.js'),
      import('./scene/syringe.js'),
      import('./scene/vial.js'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    if (disposed || leaving) return;
    gl = createRuntime({
      THREE,
      EffectComposer: composerMod.EffectComposer,
      UnrealBloomPass: bloomMod.UnrealBloomPass,
      Pass: passMod.Pass,
      FullScreenQuad: passMod.FullScreenQuad,
      createSyringe: syringeMod.createSyringe,
      createVial: vialMod.createVial,
      GLTFLoader: gltfMod.GLTFLoader,
      MeshoptDecoder: meshoptMod.MeshoptDecoder,
    }, {
      canvasHost,
      labelsHost: els.labels,
      reducedMotion,
      quality: debug && Number.isFinite(debug.quality) ? debug.quality : null,
      onReady() {
        if (disposed) return;
        host.classList.add('intro--webgl');
        wake();
      },
      onLost() { if (!disposed) fallbackToStill(); },
      wake,
    });
  }

  if (debug && Number.isFinite(debug.p)) later(() => scrollToP(debug.p, { instant: true }), 0);

  const dev = {
    seek(p, o = {}) { scrollToP(p, { instant: o.instant !== false }); },
    get state() {
      return { target: +S.target.toFixed(4), shown: +S.shown.toFixed(4), chapter: S.chapter, reducedMotion,
        film: host.classList.contains('intro--film'), ...(gl ? gl.state() : { started: false }) };
    },
  };
  host.__intro = dev;

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* ignore */ } }
    try { gl?.dispose(); } catch (err) { console.warn('[intro] dispose failed', err); }
    gl = null;
    restorePageScroll();
    try { host.scrollTop = 0; } catch { /* detached */ }
    for (const [el] of domCache) { for (const n of ['--o', '--p']) el.style.removeProperty(n); el.classList.remove('is-off', 'is-on'); }
    host.classList.remove('intro--js', 'intro--film', 'intro--still', 'intro--webgl', 'intro--no-webgl', 'intro--leaving',
      'intro--end', 'intro--opening', 'intro--slow');
    delete host.dataset.chapter;
    if (createdTrack) track.remove();
    if (els.labels) els.labels.textContent = '';
    if (host.__intro === dev) delete host.__intro;
  }

  return {
    dispose,
    /** dev helper (not part of the contract) */
    get _state() { return dev.state; },
  };
}

function findLastIndex(arr, fn) { for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) return i; return -1; }

function prefersReducedMotion() {
  const m = document.documentElement.dataset.motion;
  if (m === 'reduce') return true;
  if (m === 'full') return false;
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function hasWebGL2() {
  if (/[?&]no3d(?:[=&]|$)/.test(location.search)) return false;
  return typeof window.WebGL2RenderingContext === 'function';
}

// ============================================================================================ 3D runtime

const BODY_URL = new URL('../assets/anatomy/body.glb', import.meta.url).href;
const LANDMARKS_URL = new URL('../assets/anatomy/landmarks.json', import.meta.url).href;

// Luxury palette in linear light (THREE.Color converts these sRGB hex values).
const HEX = {
  obsidian: 0x0a0a0b,
  champagne: 0xc8a96a,
  champagnePale: 0xe6d3a3,
  drug: 0xf1dda8,
  artery: 0xc4524a,
  vein: 0x5b7db8,
  ivory: 0xf3eee6,
};

function createRuntime(mods, cfg) {
  const { THREE, EffectComposer, UnrealBloomPass, Pass, FullScreenQuad } = mods;
  const { canvasHost, labelsHost } = cfg;
  let reducedMotion = cfg.reducedMotion;
  const t0 = performance.now();

  // ------------------------------------------------------------------------------------- renderer
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-canvas';
  canvasHost.prepend(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  } catch (err) {
    canvas.remove();
    throw err;
  }
  const size = () => {
    const r = canvasHost.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width || innerWidth)), h: Math.max(1, Math.round(r.height || innerHeight)) };
  };
  let { w: W, h: H } = size();
  const phone = Math.min(W, H) < 700;
  const basePR = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 1.6);
  // quality ladder: a device that cannot keep up steps down (sharpness first, then anti-aliasing), and
  // as a last resort stops the ambient motion so frames are only drawn while the visitor scrolls
  const QUALITY = [
    { pr: basePR, samples: phone ? 2 : 4 },
    { pr: Math.min(basePR, 1.25), samples: 2 },
    { pr: 1, samples: 0 },
    { pr: 0.75, samples: 0 },
  ];
  let qLevel = cfg.quality != null ? Math.max(0, Math.min(QUALITY.length - 1, cfg.quality)) : 0;
  const qPinned = cfg.quality != null;
  let pixelRatio = QUALITY[qLevel].pr;
  const samples = QUALITY[qLevel].samples;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 1);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // the final pass tone maps

  const disposables = new Set();
  const track = (x) => { if (x) disposables.add(x); return x; };

  // ------------------------------------------------------------------------------------- shared assets
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studioScene = buildStudio(THREE);
  const envRT = pmrem.fromScene(studioScene, 0, 0.1, 100, { size: 256 });
  disposeObject(studioScene);
  pmrem.dispose();
  const env = envRT.texture;
  const skinTex = track(makeSkinTexture(THREE, phone ? 384 : 512));
  skinTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const ctx = { THREE, mods, env, skinTex, track, phone, labels: [], makeLabel };

  // ------------------------------------------------------------------------------------- labels (DOM)
  function makeLabel(text, side = 'r', cls = '') {
    if (!labelsHost) return null;
    const el = document.createElement('span');
    el.className = `intro-label intro-label--${side}${cls ? ` ${cls}` : ''}`;
    el.innerHTML = '<i class="intro-label-dot"></i><i class="intro-label-line"></i><span class="intro-label-text"></span>';
    el.querySelector('.intro-label-text').textContent = text;
    labelsHost.append(el);
    return { el, o: -1, x: NaN, y: NaN };
  }
  const tmpV = new THREE.Vector3();
  function placeLabels(set, weight) {
    for (const lab of set.labels) {
      const o = weight * (lab.vis ? lab.vis() : 1);
      const L = lab.label;
      if (!L) continue;
      if (o <= 0.01) {
        if (L.o !== 0) { L.el.style.opacity = '0'; L.o = 0; }
        continue;
      }
      tmpV.copy(lab.anchor).applyMatrix4(lab.matrix || IDENTITY).project(set.camera);
      if (tmpV.z > 1 || tmpV.z < -1) { L.el.style.opacity = '0'; L.o = 0; continue; }
      const x = Math.round((tmpV.x * 0.5 + 0.5) * W * 10) / 10;
      const y = Math.round((-tmpV.y * 0.5 + 0.5) * H * 10) / 10;
      if (x !== L.x || y !== L.y) { L.el.style.transform = `translate3d(${x}px, ${y}px, 0)`; L.x = x; L.y = y; }
      const oo = Math.round(o * 100) / 100;
      if (oo !== L.o) { L.el.style.opacity = String(oo); L.o = oo; }
    }
  }
  function hideLabels(set) {
    for (const lab of set.labels) if (lab.label && lab.label.o !== 0) { lab.label.el.style.opacity = '0'; lab.label.o = 0; }
  }
  const IDENTITY = new THREE.Matrix4();

  // ------------------------------------------------------------------------------------- post
  const rt = new THREE.WebGLRenderTarget(W * pixelRatio, H * pixelRatio, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(W, H);
  const film = makeFilmPass(THREE, Pass, FullScreenQuad, W * pixelRatio, H * pixelRatio, samples);
  composer.addPass(film.pass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W * pixelRatio, H * pixelRatio), 0.55, 0.62, 0.92);
  composer.addPass(bloom);
  const finalPass = makeFinalPass(THREE, Pass, FullScreenQuad);
  composer.addPass(finalPass);

  // ------------------------------------------------------------------------------------- layout
  const L = { W, H, aspect: W / H, portrait: W / H < 0.85, fit: 1, sx: 0, sy: 0, phone };
  function computeLayout() {
    L.W = W; L.H = H; L.aspect = W / H; L.portrait = L.aspect < 0.85;
    L.fit = L.aspect >= 1.15 ? 1 : L.aspect >= 0.85 ? 1.12 : Math.min(1.75, 0.62 / L.aspect + 0.12);
  }
  computeLayout();
  function lensShift(p) {
    const card = Math.max(1 - sstep(0.02, 0.07, p), sstep(0.88, 0.93, p));
    const wide = sstep(0.85, 1.25, L.aspect); // 0 portrait … 1 landscape
    L.sx = wide * (0.1 + 0.095 * card);
    L.sy = (1 - wide) * (0.1 + 0.07 * card);
  }
  function applyCamera(cam, fov) {
    cam.aspect = W / H;
    if (fov) cam.fov = fov;
    cam.setViewOffset(W, H, -L.sx * W, L.sy * H, W, H);
    cam.updateProjectionMatrix();
  }
  ctx.L = L;
  ctx.applyCamera = applyCamera;
  ctx.pixelRatio = pixelRatio;

  // ------------------------------------------------------------------------------------- sets
  const sets = {};
  const order = ['studio', 'body', 'tissue', 'blood', 'glass'];
  sets.studio = createStudioSet(ctx);
  sets.tissue = createTissueSet(ctx);
  sets.blood = createBloodSet(ctx);
  // body + glass share the anatomy GLB, loaded in the background
  const bodyPromise = loadBody(THREE, mods).then((body) => {
    if (disposedRt) { disposeBodyData(body); return; }
    bodyData = body;
    sets.body = createBodySet(ctx, body);
    sets.glass = createGlassSet(ctx, body);
    return Promise.all([compileSet(sets.body), compileSet(sets.glass)]);
  }).catch((err) => { console.warn('[intro] anatomy unavailable; the film uses its other shots.', err); });
  let bodyData = null;

  async function compileSet(set) {
    if (!set || set.compiled) return;
    set.update(set.prime ?? 0.5, 0, 0, L);
    try {
      if (typeof renderer.compileAsync === 'function') await renderer.compileAsync(set.scene, set.camera);
      else renderer.compile(set.scene, set.camera);
    } catch { /* compile lazily */ }
    set.compiled = true;
  }

  function resolveSet(name) {
    // a shot whose set is not ready yet borrows the nearest earlier ready one
    let i = order.indexOf(name);
    while (i > 0 && !(sets[order[i]] && sets[order[i]].compiled)) i--;
    return sets[order[i]];
  }

  // ------------------------------------------------------------------------------------- render
  let exitAt = -1;
  let stopped = false;
  let disposedRt = false;
  let ready = false;
  let lastShot = { a: null, b: null };
  let frames = 0;
  let clockNow = 0;
  const state = { p: 0, a: '', b: '', mix: 0 };

  function shotFor(p) {
    let a = null, b = null, mix = 0;
    for (let i = 0; i < SHOTS.length; i++) {
      const s = SHOTS[i];
      if (p >= s.from && p < s.to) {
        const next = SHOTS[i + 1];
        a = s.set;
        if (next && p >= next.from) { b = next.set; mix = sstep(next.from, s.to, p); }
        break;
      }
    }
    if (!a) a = SHOTS[SHOTS.length - 1].set;
    return { a, b, mix };
  }

  let slowFrames = 0;
  let lowFps = false;
  function setQuality(level) {
    qLevel = level;
    const q = QUALITY[level];
    pixelRatio = q.pr;
    ctx.pixelRatio = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    for (const target of [composer.renderTarget1, composer.renderTarget2]) { target.samples = q.samples; target.dispose(); }
    composer.setPixelRatio(pixelRatio);
    composer.setSize(W, H);
    film.setSamples(q.samples);
    film.setSize(W * pixelRatio, H * pixelRatio);
  }
  function adapt(rawDt) {
    // only frames drawn back to back say anything about speed
    if (qPinned || !(rawDt > 0) || rawDt > 1.5 || frames < 8) return;
    if (rawDt > 0.05) slowFrames += rawDt > 0.2 ? 3 : 1; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames < 6) return;
    slowFrames = 0;
    if (qLevel < QUALITY.length - 1) setQuality(qLevel + 1);
    else if (rawDt > 0.12) lowFps = true;
  }

  function render(p, t, dt, rawDt) {
    if (stopped || disposedRt) return;
    adapt(rawDt);
    clockNow = t;
    lensShift(p);
    const shot = shotFor(p);
    let A = resolveSet(shot.a);
    let B = shot.b ? resolveSet(shot.b) : null;
    let mix = shot.mix;
    if (B === A) { B = null; mix = 0; }
    if (B && mix >= 0.995) { A = B; B = null; mix = 0; }
    const dts = reducedMotion ? 0 : dt;
    A.update(p, t, dts, L);
    if (B && mix > 0.002) B.update(p, t, dts, L);
    else B = null;
    film.shot.a = A; film.shot.b = B; film.shot.mix = mix;
    // exit: a short push and fade while main.js fades the overlay
    let fade = 1;
    if (exitAt >= 0) {
      const ke = Math.min(1, (performance.now() - exitAt) / 700);
      fade = 1 - ke * ke;
      bloom.strength = 0.55 + 0.6 * ke;
    }
    finalPass.uniforms.uFade.value = fade;
    finalPass.uniforms.uTime.value = t;
    finalPass.uniforms.uFadeIn.value = Math.min(1, frames / 6);
    bloom.strength = exitAt >= 0 ? bloom.strength : (A.bloom ?? 0.55) * (1 - mix) + (B ? (B.bloom ?? 0.55) * mix : 0);
    composer.render(dts);
    frames++;
    // labels follow the shot on screen
    for (const name of order) {
      const s = sets[name];
      if (!s) continue;
      if (s === A) placeLabels(s, B ? 1 - mix : 1);
      else if (s === B) placeLabels(s, mix);
      else hideLabels(s);
    }
    if (lastShot.a !== A) lastShot.a = A;
    state.p = p; state.a = A.name; state.b = B ? B.name : ''; state.mix = mix;
  }

  // ------------------------------------------------------------------------------------- resize / context
  let resizeQueued = 0;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = requestAnimationFrame(() => {
      resizeQueued = 0;
      const s = size();
      if (s.w === W && s.h === H) return;
      W = s.w; H = s.h;
      renderer.setSize(W, H, false);
      composer.setSize(W, H);
      film.setSize(W * pixelRatio, H * pixelRatio);
      computeLayout();
      cfg.wake?.();
    });
  }) : null;
  ro?.observe(canvasHost);
  const onLost = (e) => { e.preventDefault(); stopped = true; cfg.onLost?.(); };
  canvas.addEventListener('webglcontextlost', onLost);

  // ------------------------------------------------------------------------------------- prepare
  (async () => {
    await Promise.race([sets.studio.labelReady, new Promise((r) => setTimeout(r, 900))]);
    await compileSet(sets.studio);
    if (disposedRt) return;
    ready = true;
    readyMs = performance.now() - t0;
    cfg.onReady?.();
    await compileSet(sets.tissue);
    await compileSet(sets.blood);
    cfg.wake?.();
    await bodyPromise;
    cfg.wake?.();
  })().catch((err) => { console.warn('[intro] prepare failed', err); ready = true; cfg.onReady?.(); });
  let readyMs = -1;

  // ------------------------------------------------------------------------------------- teardown
  function dispose() {
    if (disposedRt) return;
    disposedRt = true;
    stopped = true;
    if (resizeQueued) cancelAnimationFrame(resizeQueued);
    canvas.removeEventListener('webglcontextlost', onLost);
    ro?.disconnect();
    for (const name of order) { try { sets[name]?.dispose(); } catch (err) { console.warn('[intro] set dispose', err); } }
    if (bodyData) disposeBodyData(bodyData);
    for (const d of disposables) { try { d.dispose(); } catch { /* gone */ } }
    disposables.clear();
    envRT.dispose();
    film.dispose();
    for (const p of composer.passes) p.dispose?.();
    composer.dispose?.();
    rt.dispose();
    renderer.renderLists?.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    if (labelsHost) labelsHost.textContent = '';
  }

  return {
    get ready() { return ready; },
    get animating() { return !reducedMotion && !stopped && !lowFps; },
    render,
    beginExit() { if (!reducedMotion) exitAt = performance.now(); },
    stop() { stopped = true; },
    setReducedMotion(rm) { reducedMotion = !!rm; },
    dispose,
    state: () => ({
      ready, frames, readyMs: Math.round(readyMs), shot: `${state.a}${state.b ? `→${state.b} ${state.mix.toFixed(2)}` : ''}`,
      sets: order.filter((n) => sets[n]?.compiled).join(','), px: `${W}x${H}@${pixelRatio}`, t: +clockNow.toFixed(2),
      quality: qLevel, lowFps,
    }),
  };
}

// ============================================================================================ post passes

/** Renders the current shot (set A), and during a dissolve set B on top with a slow push-in. */
function makeFilmPass(THREE, Pass, FullScreenQuad, w, h, samples) {
  const rtB = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples });
  const material = new THREE.ShaderMaterial({
    name: 'IntroDissolve',
    uniforms: { tB: { value: rtB.texture }, uMix: { value: 0 }, uZoom: { value: 1 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tB;
      uniform float uMix;
      uniform float uZoom;
      varying vec2 vUv;
      void main() {
        vec2 uv = (vUv - 0.5) / uZoom + 0.5;
        gl_FragColor = vec4(texture2D(tB, uv).rgb, uMix);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(material);
  const pass = new Pass();
  pass.needsSwap = false;
  const shot = { a: null, b: null, mix: 0 };
  pass.render = function render(renderer, writeBuffer, readBuffer) {
    const { a, b, mix } = shot;
    if (!a) return;
    renderer.setRenderTarget(readBuffer);
    renderer.setClearColor(a.clear, 1);
    renderer.clear();
    renderer.render(a.scene, a.camera);
    if (b && mix > 0.002) {
      renderer.setRenderTarget(rtB);
      renderer.setClearColor(b.clear, 1);
      renderer.clear();
      renderer.render(b.scene, b.camera);
      renderer.setRenderTarget(readBuffer);
      const e = mix * mix * (3 - 2 * mix);
      material.uniforms.uMix.value = e;
      material.uniforms.uZoom.value = 1.0 + 0.07 * (1 - e) * (1 - e);
      quad.render(renderer);
    }
  };
  return {
    pass,
    shot,
    setSize(w2, h2) { rtB.setSize(w2, h2); },
    setSamples(n) { rtB.samples = n; rtB.dispose(); },
    dispose() { rtB.dispose(); material.dispose(); quad.dispose(); },
  };
}

/** Tone map (ACES), sRGB, a warm obsidian lift, vignette, fine grain and a hint of lens fringing. */
function makeFinalPass(THREE, Pass, FullScreenQuad) {
  const uniforms = {
    tDiffuse: { value: null },
    toneMappingExposure: { value: 1 },
    uTime: { value: 0 },
    uFade: { value: 1 },
    uFadeIn: { value: 0 },
    uVignette: { value: 0.46 },
    uGrain: { value: 0.03 },
    uCA: { value: 0.0012 },
  };
  const material = new THREE.RawShaderMaterial({
    name: 'IntroFinal',
    uniforms,
    defines: { SRGB_TRANSFER: '' },
    vertexShader: /* glsl */`
      precision highp float;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      attribute vec3 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uFade;
      uniform float uFadeIn;
      uniform float uVignette;
      uniform float uGrain;
      uniform float uCA;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void main() {
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        vec2 off = c * uCA * (0.3 + 2.0 * r2);
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + off).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - off).b;
        col = ACESFilmicToneMapping(col);
        vec4 o = sRGBTransferOETF(vec4(col, 1.0));
        // obsidian lift: blacks sit on a warm near-black, never pure #000
        o.rgb = o.rgb * (1.0 - vec3(0.034, 0.032, 0.03)) + vec3(0.034, 0.032, 0.03);
        float vig = 1.0 - uVignette * smoothstep(0.1, 0.78, r2 * 1.55);
        o.rgb = mix(vec3(0.02, 0.019, 0.018), o.rgb, vig);
        float g = hash(vUv * 1024.0 + fract(uTime * 7.13) * 91.7) - 0.5;
        o.rgb += g * uGrain * (0.4 + 0.6 * (1.0 - o.g));
        o.rgb = mix(vec3(0.039, 0.039, 0.043), o.rgb, uFade * uFadeIn);
        gl_FragColor = vec4(max(o.rgb, 0.0), 1.0);
      }`,
  });
  const quad = new FullScreenQuad(material);
  const pass = new Pass();
  pass.uniforms = uniforms;
  pass.render = function render(renderer, writeBuffer, readBuffer) {
    uniforms.tDiffuse.value = readBuffer.texture;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      quad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
      quad.render(renderer);
    }
  };
  pass.dispose = function dispose() { material.dispose(); quad.dispose(); };
  return pass;
}

// ============================================================================================ shared helpers

function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry && !o.userData.sharedGeometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (v && v.isTexture && !v.userData?.shared) v.dispose();
      }
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture && !u.value.userData?.shared) u.value.dispose();
      m.dispose();
    }
  });
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Monotone cubic keyframe track: keys = [[t, v0, v1, …], …] (t ascending). Returns (t, out) → out. */
function makeTrack(keys) {
  const n = keys.length;
  const dims = keys[0].length - 1;
  const T = keys.map((k) => k[0]);
  const slopes = [];
  for (let d = 0; d < dims; d++) {
    const v = keys.map((k) => k[d + 1]);
    const delta = [];
    for (let i = 0; i < n - 1; i++) delta.push((v[i + 1] - v[i]) / (T[i + 1] - T[i]));
    const m = new Array(n);
    m[0] = 0; m[n - 1] = 0; // ease in and out at the ends
    for (let i = 1; i < n - 1; i++) {
      if (delta[i - 1] * delta[i] <= 0) m[i] = 0;
      else {
        const w1 = 2 * (T[i + 1] - T[i]) + (T[i] - T[i - 1]);
        const w2 = (T[i + 1] - T[i]) + 2 * (T[i] - T[i - 1]);
        m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
      }
    }
    slopes.push(m);
  }
  return function evaluate(t, out) {
    let i = 0;
    if (t <= T[0]) { for (let d = 0; d < dims; d++) out[d] = keys[0][d + 1]; return out; }
    if (t >= T[n - 1]) { for (let d = 0; d < dims; d++) out[d] = keys[n - 1][d + 1]; return out; }
    while (i < n - 2 && t > T[i + 1]) i++;
    const h = T[i + 1] - T[i];
    const s = (t - T[i]) / h;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    for (let d = 0; d < dims; d++) {
      out[d] = h00 * keys[i][d + 1] + h10 * h * slopes[d][i] + h01 * keys[i + 1][d + 1] + h11 * h * slopes[d][i + 1];
    }
    return out;
  };
}

/** Orbit helper: position = target + dist · (direction from azimuth/elevation in the given basis). */
function orbit(out, target, dist, azDeg, elDeg, fwd, up, right) {
  const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
  const ce = Math.cos(el);
  out.copy(target)
    .addScaledVector(fwd, dist * ce * Math.cos(az))
    .addScaledVector(right, dist * ce * Math.sin(az))
    .addScaledVector(up, dist * Math.sin(el));
  return out;
}

/** Studio-on-black environment: soft strips and an overhead box; warm, never blue. */
function buildStudio(THREE) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x000000);
  const geo = new THREE.PlaneGeometry(1, 1);
  const panel = (x, y, z, w, h, color, intensity) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.scale.set(w, h, 1);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(-3.6, 0.8, -3.4, 1.0, 9, 0xfff3e2, 6.0);   // tall strip, left behind
  panel(3.9, 1.0, -3.0, 0.8, 9, 0xffe9cc, 7.5);    // tall strip, right behind
  panel(0.2, 6.0, -0.6, 6.5, 2.4, 0xfffaf2, 2.4);  // overhead softbox
  panel(-4.2, 1.6, 3.4, 2.2, 5.5, 0xfff4e6, 1.2);  // front-left key box
  panel(0, 1.0, 6.0, 9, 4, 0xf4e6d0, 0.16);        // faint front fill
  panel(3.0, -2.6, 1.6, 2.4, 1.4, 0xc8a96a, 0.7);  // low champagne kicker
  return s;
}

/** Warm three-point light rig for the sandbox product views. */
function addStudioLights(THREE, scene) {
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
  key.position.set(-0.35, 0.55, 0.5);
  const rimL = new THREE.DirectionalLight(0xfdf6ee, 2.4);
  rimL.position.set(-0.5, 0.25, -0.55);
  const rimR = new THREE.DirectionalLight(0xffe3bd, 3.0);
  rimR.position.set(0.55, 0.35, -0.45);
  const fill = new THREE.AmbientLight(0xfff6ea, 0.12);
  scene.add(key, rimL, rimR, fill);
  return { key, rimL, rimR, fill };
}

export const __dev = { buildStudio, addStudioLights };

/**
 * Tileable skin micro-relief (pores, fine furrows, gentle undulation), drawn once on the CPU.
 * RGBA8: rg = normal xy, b = cavity (1 flat, lower in pores and furrows), a = 1. One tile ≈ 10 mm of skin.
 */
function makeSkinTexture(THREE, N = 512) {
  const rnd = mulberry32(20261008);
  const h = new Float32Array(N * N);
  const cav = new Float32Array(N * N);
  // tileable value noise
  function lattice(P, seed) {
    const r = mulberry32(seed);
    const v = new Float32Array(P * P);
    for (let i = 0; i < v.length; i++) v[i] = r();
    return (x, y) => {
      const fx = (x / N) * P, fy = (y / N) * P;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = v[((iy % P) * P) + (ix % P)], b = v[((iy % P) * P) + ((ix + 1) % P)];
      const c = v[(((iy + 1) % P) * P) + (ix % P)], d = v[(((iy + 1) % P) * P) + ((ix + 1) % P)];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
  }
  const n1 = lattice(6, 3), n2 = lattice(13, 5), n3 = lattice(29, 7);
  // jittered feature points on tileable grids
  function points(G, seed) {
    const r = mulberry32(seed);
    const pts = new Float32Array(G * G * 3);
    for (let i = 0; i < G * G; i++) { pts[i * 3] = r(); pts[i * 3 + 1] = r(); pts[i * 3 + 2] = r(); }
    return pts;
  }
  const PG = 22, pores = points(PG, 11);   // pores ≈ 0.45 mm apart
  const FG = 7, furrows = points(FG, 13);  // furrow plateaus ≈ 1.4 mm
  const F2G = 15, furrows2 = points(F2G, 17);
  function worley(x, y, G, pts) {
    const cs = N / G;
    const cx = Math.floor(x / cs), cy = Math.floor(y / cs);
    let f1 = 1e9, f2 = 1e9, w = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const gx = cx + i, gy = cy + j;
        const wx = ((gx % G) + G) % G, wy = ((gy % G) + G) % G;
        const k = (wy * G + wx) * 3;
        const px = (gx + 0.15 + 0.7 * pts[k]) * cs, py = (gy + 0.15 + 0.7 * pts[k + 1]) * cs;
        const d = Math.hypot(px - x, py - y);
        if (d < f1) { f2 = f1; f1 = d; w = pts[k + 2]; } else if (d < f2) f2 = d;
      }
    }
    return [f1 / cs, f2 / cs, w];
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      let v = 0.5 * n1(x, y) + 0.3 * n2(x, y) + 0.2 * n3(x, y);
      v *= 0.55;
      const [p1, , pw] = worley(x, y, PG, pores);
      const pr = 0.13 + 0.09 * pw;
      const pore = p1 < pr ? Math.pow(1 - p1 / pr, 2) : 0;
      const [a1, a2] = worley(x, y, FG, furrows);
      const fur = Math.max(0, 1 - (a2 - a1) / 0.07);
      const [b1, b2] = worley(x, y, F2G, furrows2);
      const fur2 = Math.max(0, 1 - (b2 - b1) / 0.09);
      v -= 0.9 * pore + 0.42 * fur * fur + 0.18 * fur2 * fur2;
      h[i] = v;
      cav[i] = 1 - Math.min(1, 0.85 * pore + 0.35 * fur + 0.12 * fur2);
    }
  }
  const data = new Uint8Array(N * N * 4);
  const k = 2.6;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)];
      const dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
      let nx = -dx * k, ny = -dy * k;
      const l = Math.hypot(nx, ny, 1);
      nx /= l; ny /= l;
      data[i * 4] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i * 4 + 2] = Math.round(cav[i] * 255);
      data[i * 4 + 3] = 255;
    }
  }
  void rnd;
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.userData.shared = true;
  return tex;
}

const GLSL_NOISE = /* glsl */`
  float psH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float psN(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(psH(i), psH(i + vec3(1,0,0)), f.x), mix(psH(i + vec3(0,1,0)), psH(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(psH(i + vec3(0,0,1)), psH(i + vec3(1,0,1)), f.x), mix(psH(i + vec3(0,1,1)), psH(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  // cellular: x = F1, y = F2, z = cell id
  vec3 psV(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    float d1 = 8.0, d2 = 8.0, id = 0.0;
    for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = vec3(psH(i + g), psH(i + g + 19.1), psH(i + g + 37.7));
      float d = length(g + 0.15 + 0.7 * o - f);
      if (d < d1) { d2 = d1; d1 = d; id = psH(i + g + 71.3); } else if (d < d2) d2 = d;
    }
    return vec3(d1, d2, id);
  }`;

/**
 * Lifelike skin on a MeshPhysicalMaterial: triplanar micro-relief from the skin texture (world space,
 * `scale` = texture tiles per world unit), cavity darkening, soft mottling, a warm wrap-light term that
 * reads as light scattering under the skin, and an optional champagne reticle drawn on the surface.
 */
function makeSkinMaterial(THREE, skinTex, { scale, mottleScale, color = 0xc49377, reticle = false, envMapIntensity = 0.55 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    name: 'intro-skin',
    color,
    roughness: 0.5,
    metalness: 0,
    specularIntensity: 0.55,
    sheen: 0.5,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xf2c6b0),
    clearcoat: 0.08,
    clearcoatRoughness: 0.35,
    envMapIntensity,
  });
  const u = {
    uSkinMap: { value: skinTex },
    uSkinScale: { value: scale },
    uMottleScale: { value: mottleScale },
    uDetail: { value: 1.0 },
    uWrap: { value: 0.6 },
    uScatter: { value: new THREE.Color(1.0, 0.36, 0.22) },
    uSite: { value: new THREE.Vector3() },
    uSiteN: { value: new THREE.Vector3(0, 0, 1) },
    uSiteT: { value: new THREE.Vector3(1, 0, 0) },
    uReticle: { value: 0 },
    uRingR: { value: 0.009 },
    uRingW: { value: 0.00012 },
    uRingColor: { value: new THREE.Color(HEX.champagnePale).multiplyScalar(2.4) },
  };
  mat.userData.uniforms = u;
  mat.defines = { ...(mat.defines || {}), ...(reticle ? { SKIN_RETICLE: '' } : {}) };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvSkW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vSkW;
uniform sampler2D uSkinMap;
uniform float uSkinScale;
uniform float uMottleScale;
uniform float uDetail;
uniform float uWrap;
uniform vec3 uScatter;
uniform vec3 uSite;
uniform vec3 uSiteN;
uniform vec3 uSiteT;
uniform float uReticle;
uniform float uRingR;
uniform float uRingW;
uniform vec3 uRingColor;
${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float m1 = psN(vSkW * uMottleScale);
  float m2 = psN(vSkW * uMottleScale * 3.7 + 3.1);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(1.05, 0.9, 0.86), smoothstep(0.4, 0.85, m1) * 0.7);
  diffuseColor.rgb *= 0.95 + 0.1 * m2;
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
float skCav = 1.0;
{
  vec3 wN = inverseTransformDirection(normal, viewMatrix);
  vec3 bw = pow(abs(wN), vec3(4.0));
  bw /= (bw.x + bw.y + bw.z);
  vec3 q = vSkW * uSkinScale;
  vec4 tx = texture2D(uSkinMap, q.zy);
  vec4 ty = texture2D(uSkinMap, q.xz);
  vec4 tz = texture2D(uSkinMap, q.xy);
  vec2 dx = tx.xy * 2.0 - 1.0, dy = ty.xy * 2.0 - 1.0, dz = tz.xy * 2.0 - 1.0;
  vec3 pert = vec3(0.0, dx.y, dx.x) * bw.x + vec3(dy.x, 0.0, dy.y) * bw.y + vec3(dz.x, dz.y, 0.0) * bw.z;
  vec3 wNp = normalize(wN + pert * uDetail);
  normal = normalize((viewMatrix * vec4(wNp, 0.0)).xyz);
  skCav = mix(1.0, tx.z * bw.x + ty.z * bw.y + tz.z * bw.z, uDetail);
  diffuseColor.rgb *= mix(0.72, 1.0, skCav);
  roughnessFactor = clamp(roughnessFactor + (1.0 - skCav) * 0.25, 0.0, 1.0);
}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
{
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
    float nl = dot(normal, directionalLights[i].direction);
    float w = max(0.0, (nl + uWrap) / (1.0 + uWrap)) - max(0.0, nl);
    reflectedLight.directDiffuse += w * directionalLights[i].color * uScatter * material.diffuseColor * RECIPROCAL_PI * skCav;
  }
}
#endif
#ifdef SKIN_RETICLE
if (uReticle > 0.001) {
  vec3 dv = vSkW - uSite;
  float d = length(dv);
  float aa = max(fwidth(d), 1e-7);
  float wl = max(uRingW, aa * 0.9);
  float ring = 1.0 - smoothstep(wl, wl + aa * 1.5, abs(d - uRingR));
  vec3 B = normalize(cross(uSiteN, uSiteT));
  float ang = atan(dot(dv, B), dot(dv, uSiteT));
  float a01 = fract((ang + PI * 0.5) / (2.0 * PI));
  ring *= 1.0 - smoothstep(uReticle - 0.004, uReticle, a01);
  float rr = d - uRingR;
  float arc = abs(mod(ang + PI * 0.25, PI * 0.5) - PI * 0.25) * d;
  float tick = (1.0 - smoothstep(wl, wl + aa * 1.5, arc)) * step(uRingR * 0.16, rr) * step(rr, uRingR * 0.42);
  float inner = 1.0 - smoothstep(uRingR * 0.06, uRingR * 0.06 + aa * 1.5, d);
  float halo = exp(-d * d / (uRingR * uRingR * 0.035)) * 0.35;
  float k2 = smoothstep(0.55, 1.0, uReticle);
  totalEmissiveRadiance += uRingColor * (ring + tick * k2 + (inner + halo) * k2);
}
#endif`);
  };
  mat.customProgramCacheKey = () => `intro-skin${reticle ? '-r' : ''}`;
  return mat;
}

// ============================================================================================ small shaders

function makeBackdrop(THREE, radius, { base, haze, hazeY = 0.02, hazeW = 5, back = 0.45 }) {
  const mat = new THREE.ShaderMaterial({
    name: 'intro-backdrop',
    uniforms: { uBase: { value: new THREE.Color(base) }, uHaze: { value: new THREE.Color(haze) }, uY: { value: hazeY }, uW: { value: hazeW }, uBack: { value: back } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBase; uniform vec3 uHaze; uniform float uY; uniform float uW; uniform float uBack;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = exp(-pow((d.y - uY) * uW, 2.0)) * ((1.0 - uBack) + uBack * max(0.0, -d.z));
        gl_FragColor = vec4(uBase + uHaze * h, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

/** Fresnel glow for glass skin, vessels and bones (additive, drawn after the opaque organs). */
function makeGlowMaterial(THREE, { color, core = 0.25, rim = 0.6, power = 2.5, intensity = 1, side = THREE.FrontSide }) {
  return new THREE.ShaderMaterial({
    name: 'intro-glow',
    uniforms: { uColor: { value: new THREE.Color(color) }, uCore: { value: core }, uRim: { value: rim }, uPow: { value: power }, uI: { value: intensity } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uCore; uniform float uRim; uniform float uPow; uniform float uI;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float f = pow(1.0 - ndv, uPow);
        gl_FragColor = vec4(uColor * (uCore * pow(ndv, 0.7) + uRim * f) * uI, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side,
  });
}

/** Soft glowing points (the drug as champagne light). Size in world units, clamped in pixels. */
function makeParticleMaterial(THREE, { color, minPx = 1.6, maxPx = 12, intensity = 1 }) {
  return new THREE.ShaderMaterial({
    name: 'intro-particles',
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(intensity) }, uResY: { value: 900 }, uMinPx: { value: minPx }, uMaxPx: { value: maxPx } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aAlpha;
      uniform float uResY; uniform float uMinPx; uniform float uMaxPx;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = aSize * projectionMatrix[1][1] * 0.5 * uResY / max(-mv.z, 1e-5);
        gl_PointSize = clamp(s, uMinPx, uMaxPx);
        vA = aAlpha * clamp(s / uMinPx, 0.25, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; varying float vA;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(q, q);
        if (r2 > 1.0 || vA <= 0.002) discard;
        float a = exp(-r2 * 3.2) + 0.6 * exp(-r2 * 18.0);
        gl_FragColor = vec4(uColor * a * vA, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function makePoints(THREE, count, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  return pts;
}

/** Polyline with arc-length sampling (no allocations per sample). */
function makePolyline(points) {
  const n = points.length;
  const xyz = new Float32Array(n * 3);
  const cum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xyz[i * 3] = points[i][0]; xyz[i * 3 + 1] = points[i][1]; xyz[i * 3 + 2] = points[i][2];
    if (i > 0) cum[i] = cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
  }
  const len = cum[n - 1] || 1e-6;
  return {
    len,
    sample(u, out) {
      const s = Math.min(1, Math.max(0, u)) * len;
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
      const seg = cum[hi] - cum[lo] || 1e-6;
      const f = (s - cum[lo]) / seg;
      out.set(xyz[lo * 3] + (xyz[hi * 3] - xyz[lo * 3]) * f, xyz[lo * 3 + 1] + (xyz[hi * 3 + 1] - xyz[lo * 3 + 1]) * f, xyz[lo * 3 + 2] + (xyz[hi * 3 + 2] - xyz[lo * 3 + 2]) * f);
      return out;
    },
  };
}

function easeOutBack(x) { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

// ============================================================================================ set: studio (vial + syringe)

function createStudioSet(ctx) {
  const { THREE, mods, env, track } = ctx;
  const V3 = THREE.Vector3;
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.85;
  const camera = new THREE.PerspectiveCamera(26, 1, 0.002, 30);

  const vial = mods.createVial(THREE, { envMapIntensity: 1 });
  scene.add(vial.group);

  const syr = mods.createSyringe(THREE, { tickColor: 0xcdbf9f, liquidColor: 0xf3ead8 });
  syr.setCapOn(false);
  syr.setPlunger(0.3);
  syr.setLiquid(0.22);
  syr.setGlow(0.05);
  const syrRoot = new THREE.Group();
  syrRoot.add(syr.group);
  scene.add(syrRoot);
  const TIP = new V3(0.037, 0.0135, 0.016);
  const AXIS = new V3(0.2, 0.975, 0.07).normalize();
  const qAxis = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), AXIS);
  const qSpin = new THREE.Quaternion();
  const Y = new V3(0, 1, 0);

  // a single drop at the needle tip, and its glint
  const dropMat = track(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, ior: 1.333, thickness: 0.0016,
    attenuationColor: new THREE.Color(0xfff6e4), attenuationDistance: 0.02, envMapIntensity: 2.2, specularIntensity: 1,
  }));
  const drop = new THREE.Mesh(track(new THREE.SphereGeometry(1, 40, 28)), dropMat);
  drop.visible = false;
  scene.add(drop);
  const glintTex = track(radialTexture(THREE));
  const glint = new THREE.Sprite(track(new THREE.SpriteMaterial({
    map: glintTex, color: new THREE.Color(HEX.champagnePale).multiplyScalar(1.6), blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, depthTest: false, opacity: 0,
  })));
  glint.renderOrder = 50;
  scene.add(glint);

  // floor: black lacquer, a contact shadow under the vial and a warm pool of light, fading into the dark
  const floorMat = track(new THREE.MeshPhysicalMaterial({
    color: 0x0c0b0c, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.55, specularIntensity: 0.5,
  }));
  floorMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFw;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvFw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFw;')
      .replace('#include <dithering_fragment>', `
        float fr = length(vFw.xz);
        float contact = mix(0.22, 1.0, smoothstep(0.0058, 0.016, fr));
        float pool = exp(-fr * fr / 0.0065) * 0.016;
        gl_FragColor.rgb = gl_FragColor.rgb * contact * (1.0 - smoothstep(0.14, 0.7, fr)) + vec3(1.0, 0.84, 0.6) * pool * (1.0 - smoothstep(0.0, 0.009, 0.009 - fr) * 0.8);
        #include <dithering_fragment>`);
  };
  floorMat.customProgramCacheKey = () => 'intro-floor';
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2)), floorMat);
  scene.add(floor);
  scene.add(makeBackdrop(THREE, 6, { base: 0x050405, haze: 0x2a2112, hazeY: 0.03, hazeW: 4.5, back: 0.7 }));

  const lights = addStudioLights(THREE, scene);
  lights.key.intensity = 2.0;

  const keys = makeTrack([
    // a      tx      ty       tz     dist   az   el   fov
    [0.00, 0.010, 0.0215, 0.0, 0.205, -26, 8.0, 26],
    [0.14, 0.006, 0.0210, 0.0, 0.180, -18, 6.5, 26],
    [0.33, 0.000, 0.0195, 0.0, 0.098, 0, 3.5, 26],
    [0.47, 0.002, 0.0210, 0.0, 0.092, 11, 4.0, 26],
    [0.63, 0.022, 0.0450, 0.006, 0.255, 17, 6.0, 26],
    [0.79, 0.027, 0.0430, 0.008, 0.220, 21, 5.0, 26],
    [0.93, 0.0372, 0.0124, 0.016, 0.042, 24, 2.0, 24],
    [1.00, 0.0372, 0.0118, 0.016, 0.017, 25, 1.0, 22],
  ]);
  const k = new Array(7);
  const target = new V3(), fwd = new V3(0, 0, 1), up = new V3(0, 1, 0), right = new V3(1, 0, 0);
  const tipW = new V3();

  function update(p, t, dt, L) {
    const a = clamp01(p / 0.322);
    keys(a, k);
    target.set(k[0], k[1], k[2]);
    const wideK = 1 - sstep(0.84, 0.97, a); // close-ups keep their framing on phones
    orbit(camera.position, target, k[3] * (1 + (L.fit - 1) * wideK), k[4], k[5], fwd, up, right);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    ctx.applyCamera(camera, k[6]);

    // syringe: descends into place beside the vial, turning to show its graduations (lines only)
    const kIn = sstep(0.48, 0.7, a);
    const e = easeOutCubic(kIn);
    syrRoot.visible = a > 0.47;
    const bob = Math.sin(t * 0.8) * 0.0006;
    syrRoot.position.copy(TIP).add(tipW.set(0.004 * (1 - e), 0.13 * (1 - e) + bob, -0.03 * (1 - e)));
    qSpin.setFromAxisAngle(Y, 1.5 * (1 - e) + 0.32 + Math.sin(t * 0.33) * 0.12);
    syrRoot.quaternion.copy(qAxis).multiply(qSpin);
    syrRoot.updateMatrixWorld(true);

    // the drop beads at the tip (gravity pulls it below the bevel)
    const kDrop = sstep(0.66, 0.85, a);
    drop.visible = syrRoot.visible && kDrop > 0.001;
    if (drop.visible) {
      tipW.copy(syr.tip).applyMatrix4(syr.group.matrixWorld);
      const rd = 0.00092 * (0.15 + 0.85 * easeOutBack(kDrop));
      const wob = 1 + 0.05 * Math.sin(t * 9.0) * (1 - kDrop);
      drop.scale.set(rd / wob, rd * 1.12 * wob, rd / wob);
      drop.position.copy(tipW).add(target.set(0, -rd * 0.95, 0));
      const flare = Math.exp(-(((a - 0.86) / 0.035) ** 2));
      glint.material.opacity = Math.min(1, 0.75 * flare + 0.28 * sstep(0.84, 0.95, a) * (0.85 + 0.15 * Math.sin(t * 1.9)));
      glint.scale.setScalar(rd * (4 + 6 * flare));
      glint.position.copy(drop.position).add(target.set(-rd * 0.3, rd * 0.4, rd * 1.1));
    } else glint.material.opacity = 0;
  }

  return {
    name: 'studio', scene, camera, clear: new THREE.Color(0x050405), bloom: 0.5, labels: [], prime: 0.25,
    labelReady: vial.labelReady,
    update,
    dispose() {
      vial.dispose();
      syr.dispose();
      disposeObject(scene);
    },
  };
}

function radialTexture(THREE, stops = [[0, 1], [0.18, 0.55], [0.45, 0.12], [1, 0]]) {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, a] of stops) grd.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ============================================================================================ anatomy (shared by body + glass)

async function loadBody(THREE, mods) {
  const loader = new mods.GLTFLoader();
  loader.setMeshoptDecoder(mods.MeshoptDecoder);
  const [gltf, landmarks] = await Promise.all([
    loader.loadAsync(BODY_URL),
    fetch(LANDMARKS_URL).then((r) => { if (!r.ok) throw new Error(`landmarks ${r.status}`); return r.json(); }),
  ]);
  gltf.scene.updateMatrixWorld(true);
  const meshes = {};
  gltf.scene.traverse((o) => { if (o.isMesh) meshes[o.name] = o; });
  if (!meshes.skin) throw new Error('body.glb has no skin mesh');
  for (const m of Object.values(meshes)) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mt of mats) mt?.dispose?.();
  }
  return { meshes, landmarks, scene: gltf.scene };
}

function disposeBodyData(body) {
  for (const m of Object.values(body.meshes)) m.geometry?.dispose();
}

/** A new mesh that shares the GLB geometry and bakes the node's world transform. */
function shareMesh(THREE, src, material) {
  const m = new THREE.Mesh(src.geometry, material);
  m.matrixAutoUpdate = false;
  m.matrix.copy(src.matrixWorld);
  m.matrixWorldNeedsUpdate = true;
  m.userData.sharedGeometry = true;
  m.name = src.name;
  return m;
}

function siteFrame(THREE, landmarks) {
  const s = landmarks.sites?.abdomen || { point: [0.05, 1.01, 0.148], normal: [0.25, -0.1, 0.96] };
  const S = new THREE.Vector3(...s.point);
  const N = new THREE.Vector3(...s.normal).normalize();
  const U = new THREE.Vector3(0, 1, 0).addScaledVector(N, -N.y).normalize();
  const X = new THREE.Vector3().crossVectors(U, N).normalize();
  return { S, N, U, X };
}

// ============================================================================================ set: body (lifelike skin)

function createBodySet(ctx, body) {
  const { THREE, skinTex } = ctx;
  const V3 = THREE.Vector3;
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.003, 30);
  const skinMat = makeSkinMaterial(THREE, skinTex, { scale: 1 / 0.01, mottleScale: 28, reticle: true, color: 0xc28f73 });
  const skin = shareMesh(THREE, body.meshes.skin, skinMat);
  skin.frustumCulled = false;
  scene.add(skin);
  scene.add(makeBackdrop(THREE, 12, { base: 0x040304, haze: 0x1d170e, hazeY: 0.1, hazeW: 3.2, back: 0.6 }));

  const F = siteFrame(THREE, body.landmarks);
  const u = skinMat.userData.uniforms;
  u.uSite.value.copy(F.S);
  u.uSiteN.value.copy(F.N);
  u.uSiteT.value.copy(F.X);

  // low-key portrait light: warm key from the upper left, champagne rims outline the torso
  const key = new THREE.DirectionalLight(0xffeedd, 2.6);
  key.position.set(-0.75, 1.85, 1.5);
  key.target.position.set(0, 1.05, 0);
  const fill = new THREE.DirectionalLight(0xf2ece4, 0.35);
  fill.position.set(1.2, 1.0, 1.0);
  fill.target.position.set(0, 1.05, 0);
  const rimL = new THREE.DirectionalLight(0xfff0dc, 2.2);
  rimL.position.set(-1.4, 1.5, -0.9);
  rimL.target.position.set(0, 1.05, 0);
  const rimR = new THREE.DirectionalLight(0xe9cf9e, 2.6);
  rimR.position.set(1.5, 1.3, -0.6);
  rimR.target.position.set(0, 1.05, 0);
  scene.add(key, key.target, fill, fill.target, rimL, rimL.target, rimR, rimR.target);

  const keys = makeTrack([
    // b     dist   az   el   up     fov
    [0.00, 0.60, -26, 9.0, 0.085, 30],
    [0.22, 0.44, -16, 7.0, 0.050, 30],
    [0.52, 0.17, -5, 3.0, 0.008, 29],
    [0.74, 0.07, -1, 1.0, 0.000, 28],
    [1.00, 0.012, 0, 0.0, 0.000, 28],
  ]);
  const k = new Array(5);
  const target = new V3();
  const siteLabel = ctx.makeLabel('Injection site: the belly', 'r');
  const labels = [{ label: siteLabel, anchor: F.S.clone(), vis: () => labelVis }];
  let labelVis = 0;

  function update(p, t, dt, L) {
    const b = clamp01((p - 0.296) / (0.49 - 0.296));
    keys(b, k);
    target.copy(F.S).addScaledVector(F.U, k[3]);
    orbit(camera.position, target, k[0], k[1], k[2], F.N, F.U, F.X);
    camera.up.copy(F.U);
    camera.lookAt(target);
    ctx.applyCamera(camera, k[4]);
    u.uReticle.value = sstep(0.42, 0.72, b);
    u.uRingR.value = 0.009;
    u.uDetail.value = 1;
    labelVis = sstep(0.6, 0.72, b) * (1 - sstep(0.86, 0.94, b));
  }

  return {
    name: 'body', scene, camera, clear: new THREE.Color(0x040304), bloom: 0.45, labels, prime: 0.4,
    update,
    dispose() { disposeObject(scene); },
  };
}

// ============================================================================================ set: glass body (pull back)

const ORGAN_TONES = {
  brain: 0xc4a29a, thyroid: 0x9c5a52, heart: 0x8e3a36, lungs: 0xb58f88, liver: 0x6c372d, gallbladder: 0x8a6a3e,
  stomach: 0xb58676, pancreas: 0xc29c74, spleen: 0x6a3138, small_intestine: 0xb08a7b, large_intestine: 0x9e7a68,
  kidneys: 0x7a3832, bladder: 0xbca089,
};
// organs the drug acts on (data/retatrutide.js targets with a mesh), the path that reaches each, and when it lights
const TARGETS = [
  { organ: 'heart', path: 'to_heart_muscle', label: 'Heart', at: 0.42 },
  { organ: 'liver', path: 'to_liver', label: 'Liver', at: 0.5 },
  { organ: 'stomach', path: 'to_stomach', label: 'Stomach', at: 0.56 },
  { organ: 'pancreas', path: 'to_pancreas', label: 'Pancreas', at: 0.62 },
  { organ: 'brain', path: 'to_brain', label: 'Brain', at: 0.7 },
];

function createGlassSet(ctx, body) {
  const { THREE } = ctx;
  const V3 = THREE.Vector3;
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 60);
  const M = body.meshes;
  const lm = body.landmarks;
  const F = siteFrame(THREE, lm);

  const organMats = {};
  for (const [id, hex] of Object.entries(ORGAN_TONES)) {
    if (!M[id]) continue;
    const lungs = id === 'lungs';
    const mat = new THREE.MeshPhysicalMaterial({
      color: hex, roughness: 0.48, metalness: 0, sheen: 0.7, sheenRoughness: 0.5,
      sheenColor: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.35), clearcoat: 0.35, clearcoatRoughness: 0.3,
      envMapIntensity: 0.6, emissive: 0x000000,
      transparent: lungs, opacity: lungs ? 0.32 : 1, depthWrite: !lungs,
    });
    organMats[id] = mat;
    const mesh = shareMesh(THREE, M[id], mat);
    if (lungs) mesh.renderOrder = 1;
    scene.add(mesh);
  }
  const artMat = makeGlowMaterial(THREE, { color: HEX.artery, core: 0.55, rim: 0.7, power: 2.0, intensity: 1.15 });
  const veinMat = makeGlowMaterial(THREE, { color: HEX.vein, core: 0.55, rim: 0.7, power: 2.0, intensity: 1.1 });
  const boneMat = makeGlowMaterial(THREE, { color: HEX.ivory, core: 0.0, rim: 0.5, power: 2.2, intensity: 0.08 });
  const skinMat = makeGlowMaterial(THREE, { color: HEX.champagnePale, core: 0.025, rim: 0.62, power: 2.6, intensity: 1 });
  const addGlow = (id, mat, order) => { if (!M[id]) return; const m = shareMesh(THREE, M[id], mat); m.renderOrder = order; m.frustumCulled = false; scene.add(m); };
  addGlow('arteries', artMat, 2);
  addGlow('veins', veinMat, 2);
  addGlow('skeleton', boneMat, 3);
  addGlow('skin', skinMat, 4);
  scene.add(makeBackdrop(THREE, 30, { base: 0x040304, haze: 0x19140c, hazeY: 0.05, hazeW: 2.4, back: 0.5 }));

  const key = new THREE.DirectionalLight(0xfff0e0, 2.0);
  key.position.set(-1.2, 2.4, 2.0);
  const rim = new THREE.DirectionalLight(0xe9cf9e, 1.6);
  rim.position.set(1.4, 1.6, -1.6);
  const fill = new THREE.AmbientLight(0xfff4e8, 0.25);
  scene.add(key, rim, fill);

  // ---- the drug's route: belly → heart → lungs → heart → out along the arteries to each target organ
  const P = lm.paths || {};
  const base = [...(P.abdomen_to_heart || []), ...(P.heart_to_lungs || []), ...(P.lungs_to_heart || [])];
  const routes = TARGETS.filter((T) => P[T.path] && M[T.organ]).map((T) => ({ ...T, line: makePolyline([...base, ...P[T.path]]) }));
  const count = routes.length ? (ctx.phone ? 520 : 900) : 0;
  const rnd = mulberry32(42);
  const pMat = makeParticleMaterial(THREE, { color: HEX.drug, intensity: 3.2, minPx: 1.4, maxPx: 9 });
  const pts = makePoints(THREE, Math.max(1, count), pMat);
  pts.renderOrder = 5;
  scene.add(pts);
  const parts = [];
  for (let i = 0; i < count; i++) {
    parts.push({
      r: routes[i % routes.length], launch: rnd() * 0.42, phase: rnd(), speed: 0.035 + rnd() * 0.03,
      jx: (rnd() - 0.5) * 0.006, jy: (rnd() - 0.5) * 0.006, jz: (rnd() - 0.5) * 0.006,
    });
    pts.geometry.attributes.aSize.array[i] = 0.004 + rnd() * 0.003;
  }
  pts.geometry.attributes.aSize.needsUpdate = true;

  const labels = [];
  const glow = {};
  for (const T of TARGETS) {
    const c = lm.organs?.[T.organ]?.center;
    if (!c || !M[T.organ]) continue;
    labels.push({ label: ctx.makeLabel(T.label, 'r', 'intro-label--organ'), anchor: new V3(...c), vis: () => (glow[T.organ] || 0) * labelGate });
  }
  let labelGate = 0;
  const siteDot = new V3().copy(F.S);

  const keys = makeTrack([
    // g     dist   az    el   ty      fov
    [0.00, 0.34, 8, 3.0, F.S.y, 32],
    [0.10, 0.56, 5, 3.0, 1.03, 32],
    [0.42, 2.45, -9, 4.0, 0.98, 32],
    [0.56, 3.30, -14, 5.0, 0.94, 32],
    [1.00, 3.45, 16, 5.0, 0.94, 32],
  ]);
  const k = new Array(5);
  const target = new V3(), fwd = new V3(0, 0, 1), up = new V3(0, 1, 0), right = new V3(1, 0, 0);
  const tmp = new V3();
  const champ = new THREE.Color(HEX.champagne);

  function update(p, t, dt, L) {
    const g = clamp01((p - 0.772) / (1 - 0.772));
    keys(g, k);
    const kc = sstep(0, 0.42, g);
    target.set(F.S.x * (1 - kc), k[3], F.S.z * (1 - kc) + 0.02 * kc);
    const dist = k[0] * (1 + (L.fit - 1) * sstep(0.1, 0.42, g));
    const drift = Math.sin(t * 0.09) * 1.2 * sstep(0.4, 0.6, g);
    orbit(camera.position, target, dist, k[1] + drift, k[2], fwd, up, right);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    ctx.applyCamera(camera, k[4]);
    pMat.uniforms.uResY.value = L.H * ctx.pixelRatio;

    // released with the scroll, flowing with time
    const q = clamp01((p - 0.79) / (0.905 - 0.79));
    const pos = pts.geometry.attributes.position.array;
    const alpha = pts.geometry.attributes.aAlpha.array;
    for (let i = 0; i < count; i++) {
      const P1 = parts[i];
      const front = clamp01((q - P1.launch) / 0.5);
      if (front <= 0) { alpha[i] = 0; continue; }
      let s = (P1.phase + t * P1.speed) % 1;
      s *= front;
      P1.r.line.sample(s, tmp);
      pos[i * 3] = tmp.x + P1.jx; pos[i * 3 + 1] = tmp.y + P1.jy; pos[i * 3 + 2] = tmp.z + P1.jz;
      alpha[i] = sstep(0, 0.015, s) * (1 - sstep(0.95, 1, s));
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.geometry.attributes.aAlpha.needsUpdate = true;

    for (const T of TARGETS) {
      const m = organMats[T.organ];
      const gk = sstep(T.at, T.at + 0.2, q);
      glow[T.organ] = gk;
      if (m) m.emissive.copy(champ).multiplyScalar(0.32 * gk * (0.88 + 0.12 * Math.sin(t * 1.7 + T.at * 9)));
    }
    labelGate = sstep(0.45, 0.6, q) * (L.portrait ? 1 - sstep(0.88, 0.93, p) : 1);
    void siteDot;
  }

  return {
    name: 'glass', scene, camera, clear: new THREE.Color(0x040304), bloom: 0.6, labels, prime: 0.95,
    update,
    dispose() { disposeObject(scene); },
  };
}

// ============================================================================================ set: tissue (under the skin)
// Units: millimetres. A block of belly tissue cut open: skin on top (y = 0), the front face (z = +10) and
// the right face (x = +14) show the layers. Thicknesses are illustrative (labelled "not to scale").

const DEPOT_C = [-2.0, -6.2, 10.0];
const DEPOT_R = [3.2, 1.9, 2.4];

const TISSUE_GLSL = /* glsl */`
  uniform float uDepot;
  uniform vec3 uDepotC;
  uniform vec3 uDepotR;
  varying vec3 vTw;
  varying vec3 vTn;
  ${GLSL_NOISE}
  float tsDisc(vec2 p, vec2 c, float r) { return length(p - c) - r; }
  // returns colour; writes roughness, a height for the bump and an emissive amount
  vec3 tissue(vec3 p, out float rough, out float hgt, out float glow) {
    bool front = abs(vTn.z) > 0.5;
    float u = front ? p.x : 24.0 - p.z;
    float y = p.y;
    float nA = psN(vec3(u * 0.9, 0.3, p.z * 0.4));
    float yE = -0.24 - 0.11 * (0.5 + 0.5 * sin(u * 6.3 + nA * 3.0));
    float yD = -2.5 + 0.55 * (psN(vec3(u * 0.25, 1.7, 0.0)) - 0.5);
    float yF = -12.4 + 0.8 * (psN(vec3(u * 0.18, 4.2, 0.0)) - 0.5);
    float yM = yF - 0.42;
    vec3 col;
    rough = 0.5; hgt = 0.0; glow = 0.0;
    if (y > yE) {
      float k = clamp((y - yE) / (0.0 - yE), 0.0, 1.0);
      col = mix(vec3(0.24, 0.13, 0.085), vec3(0.6, 0.43, 0.33), smoothstep(0.0, 0.4, k));
      col = mix(col, vec3(0.72, 0.58, 0.44), smoothstep(0.78, 0.96, k));
      rough = 0.62;
    } else if (y > yD) {
      float fib = psN(vec3(u * 2.2, y * 9.0, p.z * 2.2)) * 0.6 + psN(vec3(u * 6.0, y * 20.0, 1.3)) * 0.4;
      col = mix(vec3(0.6, 0.31, 0.28), vec3(0.74, 0.44, 0.39), smoothstep(yE - 0.6, yE - 0.05, y));
      col *= 0.84 + 0.26 * fib;
      rough = 0.55; hgt = fib * 0.12;
    } else if (y > yF) {
      vec3 v = psV(p * vec3(0.78, 0.9, 0.78));
      float e = v.y - v.x;
      vec3 lob = mix(vec3(0.78, 0.55, 0.19), vec3(0.87, 0.67, 0.29), v.z);
      vec3 cells = psV(p * 9.0);
      float ce = smoothstep(0.0, 0.14, cells.y - cells.x);
      lob *= 0.8 + 0.2 * ce;
      float sept = 1.0 - smoothstep(0.03, 0.1, e);
      col = mix(lob, vec3(0.66, 0.4, 0.36), sept);
      // a fine vessel runs in some septa
      col = mix(col, vec3(0.42, 0.06, 0.05), (1.0 - smoothstep(0.006, 0.016, e)) * step(0.62, psN(p * 1.3)));
      rough = mix(0.24, 0.42, sept);
      hgt = smoothstep(0.0, 0.32, e) * 0.9 + ce * 0.06;
    } else if (y > yM) {
      col = vec3(0.78, 0.72, 0.66) * (0.92 + 0.08 * psN(vec3(u * 4.0, y * 30.0, 0.0)));
      rough = 0.2; hgt = 0.25;
    } else {
      vec3 mv = psV(vec3(u * 0.16, y * 1.15, p.z * 1.15 + 3.0));
      float per = 1.0 - smoothstep(0.02, 0.08, mv.y - mv.x);
      float fib = 0.82 + 0.18 * sin(y * 70.0 + psN(vec3(u * 3.0, y * 5.0, 0.0)) * 6.0);
      col = mix(vec3(0.42, 0.07, 0.055) * fib * (0.88 + 0.24 * mv.z), vec3(0.7, 0.58, 0.52), per * 0.75);
      rough = 0.38; hgt = (1.0 - per) * 0.45 + fib * 0.08;
    }
    if (front) {
      vec2 q = vec2(u, y);
      // hair follicles slanting down from the surface, with their bulbs
      for (int i = 0; i < 3; i++) {
        float u0 = i == 0 ? -10.2 : (i == 1 ? -4.8 : 8.6);
        float yb = -2.25;
        if (y > yb - 0.2 && y < 0.02) {
          float cu = u0 + y * 0.55;
          float d = abs(u - cu) * 0.87;
          float sheath = 1.0 - smoothstep(0.07, 0.09, d);
          float shaft = 1.0 - smoothstep(0.022, 0.032, d);
          col = mix(col, vec3(0.5, 0.32, 0.25), sheath * step(yb, y));
          col = mix(col, vec3(0.1, 0.065, 0.05), shaft * step(yb + 0.1, y));
        }
        float bulb = tsDisc(q, vec2(u0 + yb * 0.55, yb), 0.15);
        col = mix(col, vec3(0.36, 0.17, 0.12), 1.0 - smoothstep(0.0, 0.02, bulb));
      }
      // vessels cut across: an artery and its vein in the fat, small ones in the deep dermis
      for (int i = 0; i < 6; i++) {
        vec4 v = i == 0 ? vec4(4.2, -9.4, 0.42, 0.0) : i == 1 ? vec4(5.45, -9.75, 0.56, 1.0) : i == 2 ? vec4(-7.4, -2.3, 0.12, 0.0) :
                 i == 3 ? vec4(-6.85, -2.34, 0.15, 1.0) : i == 4 ? vec4(9.6, -2.2, 0.1, 0.0) : vec4(-10.4, -11.4, 0.3, 1.0);
        float d = tsDisc(q, v.xy, v.z);
        if (d < 0.0) {
          float wall = v.w < 0.5 ? v.z * 0.3 : v.z * 0.13;
          vec3 wc = v.w < 0.5 ? vec3(0.62, 0.24, 0.21) : vec3(0.36, 0.28, 0.38);
          vec3 lumen = v.w < 0.5 ? vec3(0.3, 0.02, 0.02) : vec3(0.15, 0.03, 0.05);
          col = mix(lumen, wc, smoothstep(-wall - 0.015, -wall + 0.015, d));
          rough = 0.18; hgt = d > -wall ? 0.5 : -0.4;
        }
      }
      // the depot, cut through: a champagne-wet pool in the fat
      vec3 dq = (p - uDepotC) / uDepotR;
      float dd = length(dq);
      float inside = (1.0 - smoothstep(0.94, 1.0, dd)) * uDepot;
      col = mix(col, vec3(0.95, 0.8, 0.52), inside * 0.75);
      rough = mix(rough, 0.1, inside);
      glow = inside * (0.35 + 0.65 * (1.0 - dd)) + (1.0 - smoothstep(0.0, 0.08, abs(dd - 1.0))) * uDepot * 0.6;
    }
    return col;
  }`;

function makeTissueMaterial(THREE, uniforms) {
  const mat = new THREE.MeshPhysicalMaterial({
    name: 'intro-tissue', color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.26,
    sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffe6d8), envMapIntensity: 0.7, specularIntensity: 0.7,
  });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTw;\nvarying vec3 vTn;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvTw = (modelMatrix * vec4(transformed, 1.0)).xyz;\n\tvTn = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${TISSUE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float tsRough, tsH, tsGlow;
vec3 tsCol = tissue(vTw, tsRough, tsH, tsGlow);
diffuseColor.rgb = tsCol;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = tsRough;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float hx = dFdx(tsH), hy = dFdy(tsH);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (hx * r1 + hy * r2);
  normal = normalize(abs(det) * normal - grad * 0.06);
}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
totalEmissiveRadiance += vec3(1.0, 0.82, 0.5) * tsGlow * 0.55;`);
  };
  mat.customProgramCacheKey = () => 'intro-tissue';
  return mat;
}

function makeTubeColors(THREE, geo, from, to) {
  const uv = geo.attributes.uv;
  const col = new Float32Array(uv.count * 3);
  const a = new THREE.Color(from), b = new THREE.Color(to), c = new THREE.Color();
  for (let i = 0; i < uv.count; i++) {
    c.copy(a).lerp(b, sstep(0.25, 0.8, uv.getX(i)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function createTissueSet(ctx) {
  const { THREE, track, skinTex } = ctx;
  const V3 = THREE.Vector3;
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.65;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 600);

  const uniforms = {
    uDepot: { value: 0 },
    uDepotC: { value: new V3(...DEPOT_C) },
    uDepotR: { value: new V3(...DEPOT_R) },
  };
  const cutMat = makeTissueMaterial(THREE, uniforms);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(28, 18, 1, 1).translate(0, -9, 10), cutMat);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(20, 18, 1, 1).rotateY(Math.PI / 2).translate(14, -9, 0), cutMat);
  const skinMat = makeSkinMaterial(THREE, skinTex, { scale: 0.1, mottleScale: 0.03, color: 0xc28f73, envMapIntensity: 0.6 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(28, 20, 1, 1).rotateX(-Math.PI / 2), skinMat);
  scene.add(front, right, top);

  // fine hairs on the skin (vellus), a few darker ones
  {
    const rnd = mulberry32(5);
    const n = 70;
    const hairGeo = new THREE.CylinderGeometry(0.008, 0.022, 1, 5, 1, true).translate(0, 0.5, 0);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.5, metalness: 0 });
    const hairs = new THREE.InstancedMesh(hairGeo, hairMat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3(), p = new V3();
    for (let i = 0; i < n; i++) {
      p.set(-13 + rnd() * 26, 0, -9 + rnd() * 18.5);
      e.set(0.6 + rnd() * 0.5, rnd() * Math.PI * 2, 0, 'YXZ');
      q.setFromEuler(e);
      const len = 0.8 + rnd() * 2.2;
      s.set(1, len, 1);
      m.compose(p, q, s);
      hairs.setMatrixAt(i, m);
    }
    hairs.instanceMatrix.needsUpdate = true;
    scene.add(hairs);
  }

  // capillaries exposed along the cut face (half embedded), red → blue
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.8, emissive: 0x1a0303 });
  const heroCurve = new THREE.CatmullRomCurve3([
    [-0.6, -4.5], [0.2, -3.9], [1.2, -3.05], [2.1, -2.5], [3.3, -2.35], [4.4, -2.55], [5.3, -3.1], [6.2, -3.9], [7.4, -5.2], [8.6, -6.9], [9.6, -8.6], [10.1, -9.5],
  ].map(([x, y]) => new V3(x, y, 10.02)), false, 'centripetal');
  const heroGeo = makeTubeColors(THREE, new THREE.TubeGeometry(heroCurve, 160, 0.13, 14, false), 0x8a1c18, 0x2c3a6e);
  scene.add(new THREE.Mesh(heroGeo, capMat));
  const loops = [
    [[-12, -2.6], [-11.4, -1.0], [-10.9, -0.62], [-10.4, -1.0], [-9.9, -2.4]],
    [[-6.2, -2.7], [-5.8, -1.1], [-5.3, -0.66], [-4.8, -1.1], [-4.3, -2.6]],
    [[10.6, -2.6], [11.1, -1.0], [11.6, -0.62], [12.1, -1.05], [12.6, -2.5]],
    [[-9.0, -9.6], [-7.6, -7.4], [-6.0, -8.8], [-5.2, -10.8]],
  ];
  for (const L of loops) {
    const c = new THREE.CatmullRomCurve3(L.map(([x, y]) => new V3(x, y, 10.01)), false, 'centripetal');
    scene.add(new THREE.Mesh(makeTubeColors(THREE, new THREE.TubeGeometry(c, 60, 0.065, 8, false), 0x8a1c18, 0x2c3a6e), capMat));
  }

  // the depot: a champagne pool in the fat, half exposed by the cut
  const depotMat = new THREE.ShaderMaterial({
    name: 'intro-depot',
    uniforms: { uColor: { value: new THREE.Color(HEX.drug) }, uI: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uI; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      ${GLSL_NOISE}
      void main() {
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float n = psN(vP * 2.4 + vec3(0.0, uTime * 0.25, uTime * 0.1));
        float core = pow(ndv, 1.5);
        float rim = pow(1.0 - ndv, 3.0);
        gl_FragColor = vec4(uColor * (core * (0.55 + 0.6 * n) + rim * 0.35) * uI, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const depot = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), depotMat);
  depot.position.set(...DEPOT_C);
  depot.scale.set(...DEPOT_R);
  depot.renderOrder = 4;
  scene.add(depot);

  // drug particles: in the pool, then seeping into the capillary and away with the blood
  const rnd = mulberry32(77);
  const nIn = ctx.phone ? 110 : 170, nOut = ctx.phone ? 120 : 190;
  const pMat = makeParticleMaterial(THREE, { color: HEX.drug, intensity: 3.0, minPx: 1.5, maxPx: 8 });
  const pts = makePoints(THREE, nIn + nOut, pMat);
  pts.renderOrder = 5;
  scene.add(pts);
  const inP = [];
  for (let i = 0; i < nIn; i++) {
    let x, y, z;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd(); } while (x * x + y * y + z * z > 1);
    inP.push({ x, y, z: z * 0.35, ph: rnd() * 6.28, sp: 0.4 + rnd() * 0.6 });
    pts.geometry.attributes.aSize.array[i] = 0.05 + rnd() * 0.04;
  }
  const seep = new THREE.CatmullRomCurve3([new V3(-0.9, -4.6, 10.25), new V3(-0.7, -4.45, 10.12), ...heroCurve.points.slice(1).map((v) => v.clone().setZ(10.14))], false, 'centripetal');
  const seepLine = makePolyline(seep.getSpacedPoints(200).map((v) => [v.x, v.y, v.z]));
  const outP = [];
  for (let i = 0; i < nOut; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    outP.push({ release: 0.42 + rnd() * 0.5, sx: -2.0 + Math.cos(a) * 2.6 * r, sy: -6.2 + Math.sin(a) * 1.5 * r, ph: rnd(), sp: 0.03 + rnd() * 0.03, j: (rnd() - 0.5) * 0.12 });
    pts.geometry.attributes.aSize.array[nIn + i] = 0.045 + rnd() * 0.03;
  }
  pts.geometry.attributes.aSize.needsUpdate = true;

  scene.add(makeBackdrop(THREE, 300, { base: 0x050405, haze: 0x1e170d, hazeY: 0.0, hazeW: 2.0, back: 0.6 }));
  const key = new THREE.DirectionalLight(0xfff0e0, 2.4);
  key.position.set(-6, 14, 12);
  const fill = new THREE.DirectionalLight(0xf3ece6, 0.6);
  fill.position.set(12, 3, 10);
  const rim = new THREE.DirectionalLight(0xe9cf9e, 1.8);
  rim.position.set(10, 8, -12);
  scene.add(key, fill, rim);

  const labels = [];
  const L1 = (text, anchor, side, from, to) => labels.push({ label: ctx.makeLabel(text, side, 'intro-label--tissue'), anchor: new V3(...anchor), vis: () => sstep(from, from + 0.06, cNow) * (1 - sstep(to - 0.06, to, cNow)) });
  L1('Skin', [-12.6, -1.25, 10.05], 'r', 0.3, 0.7);
  L1('Fat under the skin', [-12.6, -6.4, 10.05], 'r', 0.32, 0.7);
  L1('Muscle', [-12.6, -15.0, 10.05], 'r', 0.34, 0.7);
  L1('Depot: the drug pools here', [0.9, -5.0, 11.2], 'r', 0.38, 0.86);
  L1('Capillary', [3.3, -2.35, 10.18], 'r', 0.62, 0.9);
  let cNow = 0;

  const keys = makeTrack([
    // c      px     py     pz      tx     ty     tz    fov
    [0.00, -1.6, 8.5, 7.25, -1.6, 0.0, 6.6, 30],
    [0.10, -1.0, 11.5, 9.8, -1.0, -0.6, 6.0, 30],
    [0.34, 21.0, 9.5, 36.0, -0.5, -7.5, 3.0, 30],
    [0.62, 13.0, 2.5, 27.0, -0.8, -6.0, 8.0, 30],
    [0.84, 2.8, -2.4, 15.4, 0.6, -3.5, 10.0, 30],
    [1.00, 1.3, -3.05, 10.7, 1.15, -3.08, 10.02, 30],
  ]);
  const k = new Array(7);
  const target = new V3(), tmp = new V3();
  const upA = new V3(0, 0, -1), upB = new V3(0, 1, 0);

  function update(p, t, dt, L) {
    const c = clamp01((p - 0.462) / (0.642 - 0.462));
    cNow = c;
    keys(c, k);
    target.set(k[3], k[4], k[5]);
    camera.position.set(k[0], k[1], k[2]);
    const fit = 1 + (L.fit - 1) * sstep(0.05, 0.3, c) * (1 - sstep(0.7, 0.95, c));
    camera.position.sub(target).multiplyScalar(fit).add(target);
    camera.up.copy(upA).lerp(upB, sstep(0.02, 0.28, c)).normalize();
    camera.lookAt(target);
    ctx.applyCamera(camera, k[6]);
    pMat.uniforms.uResY.value = L.H * ctx.pixelRatio;

    const form = sstep(0.12, 0.42, c);
    const drain = sstep(0.6, 1.0, c);
    uniforms.uDepot.value = form * (1 - 0.3 * drain);
    depotMat.uniforms.uI.value = 0.9 * form * (1 - 0.35 * drain);
    depotMat.uniforms.uTime.value = t;
    depot.scale.set(DEPOT_R[0] * (0.55 + 0.45 * form), DEPOT_R[1] * (0.55 + 0.45 * form), DEPOT_R[2] * (0.55 + 0.45 * form));

    const pos = pts.geometry.attributes.position.array;
    const alpha = pts.geometry.attributes.aAlpha.array;
    for (let i = 0; i < nIn; i++) {
      const P1 = inP[i];
      const w = 0.06;
      pos[i * 3] = DEPOT_C[0] + (P1.x + Math.sin(t * P1.sp + P1.ph) * w) * DEPOT_R[0] * 0.85 * (0.55 + 0.45 * form);
      pos[i * 3 + 1] = DEPOT_C[1] + (P1.y + Math.cos(t * P1.sp * 1.3 + P1.ph) * w) * DEPOT_R[1] * 0.85 * (0.55 + 0.45 * form);
      pos[i * 3 + 2] = DEPOT_C[2] + 0.05 + P1.z * DEPOT_R[2];
      alpha[i] = form * (1 - 0.4 * drain) * 0.8;
    }
    for (let i = 0; i < nOut; i++) {
      const P1 = outP[i];
      const j = nIn + i;
      const go = clamp01((c - P1.release) / 0.22);
      if (go <= 0) {
        pos[j * 3] = P1.sx; pos[j * 3 + 1] = P1.sy; pos[j * 3 + 2] = DEPOT_C[2] + 0.3;
        alpha[j] = form * 0.7;
        continue;
      }
      // leaves the pool, joins the capillary, then flows on with the blood
      const s = Math.min(1, go * 0.18 + (go >= 1 ? ((P1.ph + t * P1.sp) % 1) * 0.82 : 0));
      seepLine.sample(s, tmp);
      const kx = 1 - sstep(0, 0.18, s);
      pos[j * 3] = tmp.x + (P1.sx - tmp.x) * kx * (1 - go);
      pos[j * 3 + 1] = tmp.y + (P1.sy - tmp.y) * kx * (1 - go) + P1.j * 0.3;
      pos[j * 3 + 2] = tmp.z;
      alpha[j] = 0.9 * (1 - sstep(0.94, 1, s));
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.geometry.attributes.aAlpha.needsUpdate = true;
  }

  return {
    name: 'tissue', scene, camera, clear: new THREE.Color(0x050405), bloom: 0.5, labels, prime: 0.5,
    update,
    dispose() { disposeObject(scene); },
  };
}

// ============================================================================================ set: blood (capillary → vein)
// Units: micrometres. A capillary (red cells in single file) widens into a vein. Not to scale in time:
// the flow is slowed down so it can be followed.

function createBloodSet(ctx) {
  const { THREE } = ctx;
  const V3 = THREE.Vector3;
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.3;
  const fogColor = new THREE.Color(0x0b0305);
  scene.fog = new THREE.FogExp2(fogColor, 0.0105);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.08, 800);

  // ---- the vessel: one smooth path, a narrow capillary flaring into a vein
  const curve = new THREE.CatmullRomCurve3([
    [-30, 0, 0], [40, 5, -3], [110, -3, 5], [180, 6, 1], [250, -5, -6], [320, 3, 4], [390, 0, -2], [460, -6, 4],
  ].map((a) => new V3(...a)), false, 'centripetal');
  const NR = 360, NS = ctx.phone ? 28 : 40;
  const frames = curve.computeFrenetFrames(NR, false);
  const C = curve.getSpacedPoints(NR);
  const len = curve.getLength();
  const radius = (u) => 4.6 + 21.4 * sstep(0.17, 0.42, u);
  // smooth, twist-free frames (parallel transport from the Frenet start)
  const Tn = frames.tangents, Nn = frames.normals, Bn = frames.binormals;
  const pos = new Float32Array((NR + 1) * (NS + 1) * 3);
  const nor = new Float32Array((NR + 1) * (NS + 1) * 3);
  const aU = new Float32Array((NR + 1) * (NS + 1));
  const idx = [];
  for (let i = 0; i <= NR; i++) {
    const u = i / NR, r = radius(u);
    for (let j = 0; j <= NS; j++) {
      const th = (j / NS) * Math.PI * 2;
      const cx = Math.cos(th), sx = Math.sin(th);
      const nx = Nn[i].x * cx + Bn[i].x * sx, ny = Nn[i].y * cx + Bn[i].y * sx, nz = Nn[i].z * cx + Bn[i].z * sx;
      const k = i * (NS + 1) + j;
      pos[k * 3] = C[i].x + nx * r; pos[k * 3 + 1] = C[i].y + ny * r; pos[k * 3 + 2] = C[i].z + nz * r;
      nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
      aU[k] = u;
      if (i < NR && j < NS) {
        const a = k, b = k + NS + 1, c = b + 1, d = a + 1;
        idx.push(a, b, d, b, c, d);
      }
    }
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  wallGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  wallGeo.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  wallGeo.setIndex(idx);
  const wallMat = new THREE.ShaderMaterial({
    name: 'intro-vessel-wall',
    uniforms: {
      uCap: { value: new THREE.Color(0xb0605a) }, uVein: { value: new THREE.Color(HEX.vein) },
      uFogC: { value: fogColor }, uFog: { value: 0.0105 },
    },
    vertexShader: /* glsl */`
      attribute float aU;
      varying float vU; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vU = aU; vN = normalize(normalMatrix * normal); vV = -mv.xyz; vW = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCap; uniform vec3 uVein; uniform vec3 uFogC; uniform float uFog;
      varying float vU; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      ${GLSL_NOISE}
      void main() {
        vec3 v = psV(vW * vec3(0.07, 0.15, 0.15));   // endothelial cells, long along the flow
        float edge = smoothstep(0.0, 0.07, v.y - v.x);
        float nuc = 1.0 - smoothstep(0.1, 0.22, v.x);
        vec3 base = mix(uCap, uVein, smoothstep(0.17, 0.42, vU)) * (0.85 + 0.3 * v.z);
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float fres = pow(1.0 - ndv, 2.0);
        vec3 col = base * (0.22 + 1.1 * fres) * (0.7 + 0.3 * edge) + base * nuc * 0.28 + base * (1.0 - edge) * fres * 0.5;
        float a = clamp(0.08 + 0.8 * fres, 0.0, 0.9) * (0.8 + 0.2 * (1.0 - edge));
        float d = length(vV);
        float f = exp(-pow(d * uFog, 2.0));
        gl_FragColor = vec4(mix(uFogC, col, f), a * mix(0.4, 1.0, f));
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.renderOrder = 3;
  wall.frustumCulled = false;
  scene.add(wall);

  const sample = (u, out) => {
    const f = clamp01(u) * NR;
    const i = Math.min(NR - 1, Math.floor(f));
    const k2 = f - i;
    out.p.lerpVectors(C[i], C[i + 1], k2);
    out.t.lerpVectors(Tn[i], Tn[i + 1], k2).normalize();
    out.n.lerpVectors(Nn[i], Nn[i + 1], k2).normalize();
    out.b.lerpVectors(Bn[i], Bn[i + 1], k2).normalize();
    return out;
  };
  const fr = { p: new V3(), t: new V3(), n: new V3(), b: new V3() };

  // ---- red cells: a biconcave disc (Evans–Fung profile), instanced
  const R0 = 3.9;
  const prof = [];
  const NP = 18;
  for (let i = 0; i <= NP; i++) {
    const r = R0 * Math.sin((i / NP) * Math.PI / 2);
    const x = r / R0;
    const th = 0.5 * Math.sqrt(Math.max(0, 1 - x * x)) * (0.81 + 7.83 * x * x - 4.39 * x * x * x * x) * (3.91 / 3.91);
    prof.push(new THREE.Vector2(r, th));
  }
  const pts = [...prof.map((v) => v.clone()), ...prof.slice(0, -1).reverse().map((v) => new THREE.Vector2(v.x, -v.y))];
  const rbcGeo = new THREE.LatheGeometry(pts.map((v) => new THREE.Vector2(Math.max(0, v.x), v.y)).reverse(), ctx.phone ? 22 : 30);
  rbcGeo.computeVertexNormals();
  const rbcMat = new THREE.MeshPhysicalMaterial({
    color: 0x8e1712, roughness: 0.42, metalness: 0, sheen: 1, sheenColor: new THREE.Color(0xff6a52), sheenRoughness: 0.42,
    clearcoat: 0.25, clearcoatRoughness: 0.35, emissive: new THREE.Color(0x2b0404), envMapIntensity: 0.4,
  });
  const nCap = 18, nVein = ctx.phone ? 420 : 820;
  const cells = new THREE.InstancedMesh(rbcGeo, rbcMat, nCap + nVein);
  cells.frustumCulled = false;
  scene.add(cells);
  const rnd = mulberry32(31);
  const cellData = [];
  for (let i = 0; i < nCap; i++) cellData.push({ cap: true, u0: i / nCap, rho: 0, th: rnd() * 6.28, ax: new V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), w: 0.2 + rnd() * 0.3, ph: rnd() * 6.28 });
  for (let i = 0; i < nVein; i++) {
    let u;
    do { u = 0.3 + rnd() * 0.7; } while (rnd() > (radius(u) / 26) ** 2);
    cellData.push({ cap: false, u0: (u - 0.3) / 0.7, rho: Math.sqrt(rnd()) * 0.86, th: rnd() * 6.28, ax: new V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), w: 0.15 + rnd() * 0.5, ph: rnd() * 6.28, sp: 0.85 + rnd() * 0.3 });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), sc = new V3(), pp = new V3(), Y = new V3(0, 1, 0);

  // ---- the drug: seeping through the capillary wall, then flowing with the blood
  const nSeep = ctx.phone ? 90 : 150, nFlow = ctx.phone ? 160 : 300;
  const pMat = makeParticleMaterial(THREE, { color: HEX.drug, intensity: 3.4, minPx: 1.6, maxPx: 10 });
  const drug = makePoints(THREE, nSeep + nFlow, pMat);
  drug.renderOrder = 6;
  scene.add(drug);
  const drugData = [];
  for (let i = 0; i < nSeep; i++) drugData.push({ seep: true, u: 0.02 + rnd() * 0.24, th: rnd() * 6.28, ph: rnd(), sp: 0.05 + rnd() * 0.05 });
  for (let i = 0; i < nFlow; i++) drugData.push({ seep: false, u0: rnd(), rho: Math.sqrt(rnd()) * 0.92, th: rnd() * 6.28, sp: 0.9 + rnd() * 0.4 });
  for (let i = 0; i < drugData.length; i++) drug.geometry.attributes.aSize.array[i] = 0.16 + rnd() * 0.12;
  drug.geometry.attributes.aSize.needsUpdate = true;

  const head = new THREE.PointLight(0xffe2cf, 2.2, 0, 0);
  const key = new THREE.DirectionalLight(0xfff0e0, 1.0);
  key.position.set(0.3, 1, 0.4);
  scene.add(head, key);

  const labels = [];
  const capAnchor = new V3(), cellAnchor = new V3();
  labels.push({ label: ctx.makeLabel('Capillary wall', 'r', 'intro-label--micro'), anchor: capAnchor, vis: () => sstep(0.08, 0.16, dNow) * (1 - sstep(0.3, 0.38, dNow)) });
  labels.push({ label: ctx.makeLabel('Red blood cell', 'r', 'intro-label--micro'), anchor: cellAnchor, vis: () => sstep(0.12, 0.2, dNow) * (1 - sstep(0.34, 0.4, dNow)) });
  let dNow = 0;

  const keys = makeTrack([
    // d     u      rho    th   du     lookRho fov
    [0.00, 0.045, 15.0, 70, 0.045, 0.0, 40],
    [0.30, 0.150, 12.5, 76, 0.050, 0.0, 42],
    [0.50, 0.300, 8.0, 82, 0.070, 1.5, 50],
    [0.75, 0.470, 6.0, 88, 0.080, 2.5, 58],
    [1.00, 0.620, 4.0, 92, 0.090, 3.0, 60],
  ]);
  const k = new Array(6);
  const target = new V3(), tmp = new V3(), off = new V3();
  const flowT = { v: 0 };

  function update(p, t, dt, L) {
    const d = clamp01((p - 0.614) / (0.798 - 0.614));
    dNow = d;
    keys(d, k);
    sample(k[0], fr);
    const th = k[2] * Math.PI / 180;
    off.copy(fr.n).multiplyScalar(Math.cos(th)).addScaledVector(fr.b, Math.sin(th));
    camera.position.copy(fr.p).addScaledVector(off, k[1]);
    sample(k[0] + k[3], fr);
    target.copy(fr.p).addScaledVector(off, k[4]);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    ctx.applyCamera(camera, k[5]);
    head.position.copy(camera.position);
    pMat.uniforms.uResY.value = L.H * ctx.pixelRatio;

    flowT.v = t;
    // red cells
    for (let i = 0; i < cellData.length; i++) {
      const c = cellData[i];
      let u, rho, s = 1;
      if (c.cap) {
        u = ((c.u0 + t * 0.03) % 1) * 0.34;
        rho = 0;
        s = sstep(0, 0.02, u) * (1 - sstep(0.31, 0.34, u));
      } else {
        u = 0.3 + ((c.u0 + t * 0.012 * c.sp) % 1) * 0.7;
        rho = c.rho * Math.max(0, radius(u) - 4.4);
        s = sstep(0.3, 0.34, u) * (1 - sstep(0.97, 1, u));
      }
      sample(u, fr);
      const a = c.th + t * 0.05;
      pp.copy(fr.p).addScaledVector(fr.n, Math.cos(a) * rho).addScaledVector(fr.b, Math.sin(a) * rho);
      if (c.cap) {
        // in a capillary a cell travels edge-on, folded like a parachute
        q.setFromUnitVectors(Y, fr.t);
        q2.setFromAxisAngle(fr.t, c.ph + t * c.w);
        q.premultiply(q2);
        sc.set(s * 0.92, s * 1.25, s * 0.92);
      } else {
        q.setFromAxisAngle(c.ax, c.ph + t * c.w);
        sc.set(s, s, s);
      }
      m4.compose(pp, q, sc);
      cells.setMatrixAt(i, m4);
      if (i === 7) cellAnchor.copy(pp);
    }
    cells.instanceMatrix.needsUpdate = true;
    sample(0.11, fr);
    capAnchor.copy(fr.p).addScaledVector(fr.n, Math.cos(1.2) * 4.6).addScaledVector(fr.b, Math.sin(1.2) * 4.6);

    // drug
    const P = drug.geometry.attributes.position.array;
    const A = drug.geometry.attributes.aAlpha.array;
    for (let i = 0; i < drugData.length; i++) {
      const g = drugData[i];
      let u, rho, a;
      if (g.seep) {
        const life = (g.ph + t * g.sp) % 1;
        const inK = sstep(0, 0.55, life);
        u = g.u + 0.07 * sstep(0.5, 1, life);
        rho = 13 - 12.4 * inK;
        a = sstep(0, 0.12, life) * (1 - sstep(0.85, 1, life));
      } else {
        u = (g.u0 + t * 0.016 * g.sp) % 1;
        rho = g.rho * Math.max(0.6, radius(u) - 1.2);
        a = sstep(0, 0.03, u) * (1 - sstep(0.96, 1, u)) * (u < 0.3 ? 0.5 : 1);
      }
      sample(u, fr);
      const ang = g.th + t * 0.07;
      tmp.copy(fr.p).addScaledVector(fr.n, Math.cos(ang) * rho).addScaledVector(fr.b, Math.sin(ang) * rho);
      P[i * 3] = tmp.x; P[i * 3 + 1] = tmp.y; P[i * 3 + 2] = tmp.z;
      A[i] = a;
    }
    drug.geometry.attributes.position.needsUpdate = true;
    drug.geometry.attributes.aAlpha.needsUpdate = true;
    void len;
  }

  return {
    name: 'blood', scene, camera, clear: fogColor.clone(), bloom: 0.55, labels, prime: 0.6,
    update,
    dispose() { disposeObject(scene); },
  };
}
