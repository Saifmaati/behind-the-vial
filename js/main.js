// PeptideScope: boot, theme, motion, routing, lazy loading and wiring (shell, v4).
//
// v4 layout: a 3-step stepper (Pick a peptide · Pick a spot · Watch) beside one big 3D body, one
// sentence of narration, the plain-text timeline and the side effects; then the Learn cards, each
// opening a <dialog> panel that holds the js/ui [data-render] host for that topic.
// Every other module is loaded with a guarded dynamic import, so a missing or failing module only
// shows a small notice in its own host and never blanks the page. See docs/ARCHITECTURE.md.
//
// Performance: no work on scroll (one IntersectionObserver for the header line), passive listeners,
// layout metrics from ResizeObserver only. While the intro shows, NOTHING of the 3D side runs: no
// WebGL context, no three.js, no body.glb (v4 contract "Intro: zero WebGL"); the engine and the
// anatomy start downloading only when the intro reaches its last chapters (intro:near-end) or closes,
// and the WebGL probe runs only once the intro has gone. The Learn panels are rendered after the
// intro too (they are 7,000+ DOM nodes).
import { bus } from './bus.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const html = document.documentElement;

const SITES = ['abdomen', 'thigh', 'arm'];
const SITE_LABEL = { abdomen: 'Belly', thigh: 'Thigh', arm: 'Upper arm' };
const SITE_PHRASE = { abdomen: 'the belly', thigh: 'the thigh', arm: 'the upper arm' };
const STEPS = ['peptide', 'site', 'play'];
const DEFAULT_PEPTIDE = 'retatrutide';
const ANATOMY_URL = new URL('../assets/anatomy/body.glb', import.meta.url).href;
// Decoded size of body.glb (bytes, as written by tools/build-anatomy.mjs). Hosts that gzip the file
// (GitHub Pages) report the compressed content-length, so progress uses this instead.
const ANATOMY_BYTES = 1457120;
// The in-stage CC BY credit links to the rendered asset register (a raw .md on Pages is not readable).
const ASSETS_HREF = 'https://github.com/Saifmaati/peptidescope/blob/main/ASSETS.md#anatomy';
// Browsers block ES modules on file:// pages; if this module runs anyway (some browsers allow it),
// the 3D body still cannot load its anatomy, so the stage shows the "open it from a server" notice.
const IS_FILE = location.protocol === 'file:';
// Storage keys (the inline boot script in index.html reads the same ones before first paint).
const KEY = { theme: 'peptidescope.theme', motion: 'peptidescope.motion', introSeen: 'peptidescope.introSeen' };

// One short sentence per step of the injection animation, with a plain short name for the small tag
// (the tag and the sentence always describe the same thing; the injection module's own labels are
// not used for the tag). Never phrased as instructions (safety review).
const PHASES = {
  syringe: { title: 'The shot', text: 'In the body, it starts in the fat layer under the skin.' },
  depot: { title: 'Under the skin', text: 'It sits in a little pocket under the skin and does not reach the blood all at once.' },
  absorption: { title: 'Into the blood', text: 'Over hours to days, it seeps into tiny blood vessels nearby.' },
  bloodstream: { title: 'In the blood', text: 'The blood carries it to the heart, which pumps it all around the body.' },
  distribution: { title: 'At the organs', text: 'It attaches to receptors in the organs it acts on, and that is where its effects and side effects start.' },
  done: { title: 'That was one shot', text: 'Now press play on the timeline below to see what happens over the next weeks.' },
};
// One short sentence per timeline phase (js/timeline.js phase ids; the timeline itself shows the cited text).
const TIME_TEXT = {
  injection: 'It is still seeping out from under the skin.',
  onset: 'It has reached the blood.',
  peak: 'The amount in the blood is near its highest.',
  falling: 'The amount in the blood is going down.',
  halfLife: 'Less than half of the peak amount is left in the blood.',
  clearance: 'Most of it has left the blood. Small amounts can still be found for weeks.',
};

const store = {
  get(kind, key) { try { return window[kind].getItem(key); } catch { return null; } },
  set(kind, key, value) { try { window[kind].setItem(key, value); } catch { /* private mode */ } },
};
const media = (q) => { try { return window.matchMedia(q); } catch { return null; } };

const state = {
  theme: html.dataset.theme === 'dark' ? 'dark' : 'light',
  reducedMotion: html.dataset.motion === 'reduce',
  introOpen: html.dataset.intro === 'show',
  booting: true,
  peptides: [],
  peptideId: null,
  peptide: null,
  entry: null,
  entryFailed: false,
  site: null,
  step: 'peptide',
  advanceOnLoad: null, // a peptide id the visitor picked; step 2 opens once its entry has loaded
  stage: 'idle', // idle | loading | ready | fallback
  sequence: 'idle', // idle | playing | done
  ui: null,
  body: null,
  timeline: null,
  effects: null,
  mountedFor: null,
  riskCheck: null,
  watched: false, // the visitor has watched the shot (or there is no 3D): the timeline shows
  stageContextLost: false,
};

// ------------------------------------------------------------------ helpers

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : String(c));
  return node;
}

function notice(host, text, { replace = false, tone = 'info' } = {}) {
  if (!host) return null;
  const p = el('p', { class: `module-notice module-notice--${tone}`, role: 'status', 'data-shell': true }, text);
  if (replace) host.replaceChildren(p);
  else host.append(p);
  return p;
}

async function safeImport(path, label) {
  try {
    return await import(path);
  } catch (err) {
    console.warn(`[main] ${label} could not load (${path}).`, err);
    return null;
  }
}

// Modules return { dispose() } (contract) or { destroy() }; accept both.
function release(handle) {
  try {
    if (typeof handle?.dispose === 'function') handle.dispose();
    else if (typeof handle?.destroy === 'function') handle.destroy();
  } catch (err) {
    console.warn('[main] releasing a module failed', err);
  }
}

function clearShell(host) {
  for (const n of $$(':scope > [data-shell]', host)) n.remove();
}

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function setParam(key, value) {
  try {
    const url = new URL(location.href);
    if (value == null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  } catch { /* file:// or sandboxed */ }
}

// Run fn when the main thread is idle (or after `timeout` ms at the latest).
function idle(fn, timeout = 800) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout });
  else setTimeout(fn, 60);
}

function scrollBehavior() {
  return state.reducedMotion ? 'auto' : 'smooth';
}

function focusHeading(node, { scroll = false, instant = false } = {}) {
  if (!node) return;
  if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
  if (scroll) (node.closest('section') || node).scrollIntoView({ behavior: instant ? 'instant' : scrollBehavior(), block: 'start' });
  node.focus({ preventScroll: true });
}

function readyNames() {
  const names = state.peptides.filter((p) => p.ready).map((p) => p.name);
  return names.length ? names.join(', ') : 'the first entry';
}

const isArrowKey = (k) => ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(k);

// Accessible radio group: roving tabindex, arrows/Home/End move and select (ARIA APG pattern).
function radioGroup(host, selector, onPick) {
  const items = () => $$(selector, host).filter((n) => !n.hidden);
  host.addEventListener('click', (e) => {
    const item = e.target.closest(selector);
    if (item && host.contains(item)) onPick(item);
  });
  host.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(e.target.closest(selector));
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % list.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    if (next < 0) return;
    e.preventDefault();
    list[next].focus();
    onPick(list[next]);
  });
}

function reflectRadios(host, selector, isOn) {
  const list = $$(selector, host);
  let any = false;
  for (const n of list) {
    const on = isOn(n);
    any ||= on;
    n.setAttribute('aria-checked', String(on));
    n.tabIndex = on ? 0 : -1;
  }
  if (!any && list[0]) list[0].tabIndex = 0;
}

// ------------------------------------------------------------------ theme + motion

function syncThemeColor() {
  const color = getComputedStyle(html).getPropertyValue('--bg').trim() || (state.theme === 'dark' ? '#0F0E17' : '#F7F6FB');
  for (const m of $$('meta[name="theme-color"]')) m.setAttribute('content', color);
}

function applyTheme(theme, { persist = false, emit = true } = {}) {
  state.theme = theme === 'dark' ? 'dark' : 'light';
  html.dataset.theme = state.theme;
  if (persist) store.set('localStorage', KEY.theme, state.theme);
  const next = state.theme === 'dark' ? 'light' : 'dark';
  const btn = $('#theme-toggle');
  if (btn) {
    btn.setAttribute('aria-label', `Switch to ${next} theme`);
    btn.title = `Switch to ${next} theme`;
  }
  syncThemeColor();
  if (emit) bus.emit('theme:change', { theme: state.theme });
}

function applyMotion(reduce, { persist = false, emit = true } = {}) {
  state.reducedMotion = !!reduce;
  if (persist) store.set('localStorage', KEY.motion, reduce ? 'reduce' : 'full');
  const stored = store.get('localStorage', KEY.motion);
  if (reduce) html.dataset.motion = 'reduce';
  else if (stored === 'full') html.dataset.motion = 'full';
  else delete html.dataset.motion;
  $('#motion-toggle')?.setAttribute('aria-checked', String(state.reducedMotion));
  if (emit) bus.emit('motion:change', { reducedMotion: state.reducedMotion });
}

function initPreferences() {
  applyTheme(state.theme, { emit: false });
  applyMotion(state.reducedMotion, { emit: false });
  $('#theme-toggle')?.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark', { persist: true }));
  $('#motion-toggle')?.addEventListener('click', () => applyMotion(!state.reducedMotion, { persist: true }));
  media('(prefers-color-scheme: dark)')?.addEventListener?.('change', (e) => {
    const stored = store.get('localStorage', KEY.theme);
    if (stored !== 'light' && stored !== 'dark') applyTheme(e.matches ? 'dark' : 'light');
  });
  media('(prefers-reduced-motion: reduce)')?.addEventListener?.('change', (e) => {
    const stored = store.get('localStorage', KEY.motion);
    if (stored !== 'reduce' && stored !== 'full') applyMotion(e.matches);
  });
}

// ------------------------------------------------------------------ layout metrics, header line

// --header-h and --disclaimer-h follow the real boxes (ResizeObserver only: nothing runs on scroll).
function initLayoutMetrics() {
  const header = $('#site-header');
  const bar = $('#disclaimer');
  const px = (entry) => Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height);
  if (!('ResizeObserver' in window)) return;
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === header) html.style.setProperty('--header-h', `${px(entry)}px`);
      else if (entry.target === bar) html.style.setProperty('--disclaimer-h', `${px(entry)}px`);
    }
  });
  if (header) ro.observe(header);
  if (bar) ro.observe(bar);
}

// The header gains its bottom line once the page has scrolled (one IntersectionObserver).
function initHeaderLine() {
  const header = $('#site-header');
  if (!header || !('IntersectionObserver' in window)) return;
  const sentinel = el('div', { 'aria-hidden': 'true', style: 'position:absolute;top:0;left:0;width:1px;height:4px;pointer-events:none;visibility:hidden' });
  document.body.prepend(sentinel);
  new IntersectionObserver(([e]) => { header.dataset.scrolled = String(!e.isIntersecting); }).observe(sentinel);
}

// ------------------------------------------------------------------ intro

let intro = null;
let introMounted = false;
let introWatchdog = 0;
let introLoading = null; // promise while intro.js is importing / mounting
// The 3D body mounts only once the intro has gone (it never competes with the intro for the main thread).
let introReleased = !state.introOpen;

function setBackgroundInert(on) {
  for (const node of [$('.skip-link'), $('#site-header'), $('#app'), $('#site-footer')]) {
    if (node) node.toggleAttribute('inert', on);
  }
}

function lowData() {
  const c = navigator.connection;
  return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
}

function onIntroKey(e) {
  if (e.key === 'Escape' && state.introOpen) closeIntro('skip');
}

function onIntroButton(kind) {
  if (!state.introOpen) return;
  if (kind === 'skip' || !introMounted) {
    closeIntro(kind);
    return;
  }
  // intro.js owns Enter / Facts (it may play a short exit first). Make sure we can never get stuck.
  clearTimeout(introWatchdog);
  introWatchdog = setTimeout(() => closeIntro(kind), 4000);
}

async function startIntro() {
  if (!state.introOpen) return;
  setBackgroundInert(true);
  $('#intro-enter')?.addEventListener('click', () => onIntroButton('enter'));
  $('#intro-facts')?.addEventListener('click', () => onIntroButton('facts'));
  $('#intro-skip')?.addEventListener('click', () => onIntroButton('skip'));
  document.addEventListener('keydown', onIntroKey);

  introLoading = (async () => {
    const mod = await safeImport('./intro.js', 'The intro');
    if (!state.introOpen || typeof mod?.mountIntro !== 'function') return; // static DOM intro keeps working
    try {
      intro = await mod.mountIntro($('#intro'), {
        reducedMotion: state.reducedMotion,
        onEnter: () => closeIntro('enter'),
        onFacts: () => closeIntro('facts'),
      });
      introMounted = true;
      if (!state.introOpen) disposeIntro();
    } catch (err) {
      console.warn('[main] mountIntro failed; using the static intro.', err);
    }
  })();
  await introLoading;
}

function disposeIntro() {
  release(intro);
  intro = null;
}

function closeIntro(kind = 'enter') {
  if (!state.introOpen) return;
  state.introOpen = false;
  clearTimeout(introWatchdog);
  document.removeEventListener('keydown', onIntroKey);
  store.set('sessionStorage', KEY.introSeen, '1');
  setBackgroundInert(false);

  const finish = () => {
    html.dataset.intro = 'done';
    // If intro.js is still mounting (Skip pressed early), wait for it so it is released too.
    Promise.resolve(introLoading).catch(() => {}).then(() => {
      disposeIntro();
      introReleased = true;
      if (!stageBooted) boot3D();
      maybeMountBody();
    });
  };
  html.dataset.intro = 'leaving';
  if (state.reducedMotion) finish();
  else setTimeout(finish, 450);
  // The Learn panels were left unrendered while the intro showed: now (at once for the facts or a
  // deep link, which land in them; otherwise when the browser is idle).
  if (kind === 'facts' || kind === 'hash') flushContent();
  else idle(flushContent, 600);

  // Instant: a smooth scroll does not run while the overlay still locks the page.
  if (kind === 'facts') focusHeading($('#learn-title'), { scroll: true, instant: true });
  else if (kind !== 'hash') {
    if (scrollY > 0) scrollTo({ top: 0, behavior: 'instant' });
    focusHeading($('#explorer-title'));
  }
}

function initRouting() {
  const onNav = () => {
    if (state.introOpen && location.hash.length > 1 && location.hash !== '#intro') closeIntro('hash');
    // Back/forward with a panel open: close any open panel that does not hold the new hash target
    // (the page behind it must not jump while the panel stays up).
    let target = null;
    try { target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null; } catch { /* bad hash */ }
    for (const d of $$('dialog.learn-dialog[open]')) if (!target || !d.contains(target)) d.close();
    openPanelForHash();
  };
  addEventListener('hashchange', onNav);
  addEventListener('popstate', () => { if (!location.hash) onNav(); });
}

// ------------------------------------------------------------------ 3D stage
// Boot: after first paint, when the browser is idle, main.js starts the engine (three.js +
// js/scene/*) and streams the anatomy, showing real progress in #stage-loading. The scene mounts as
// soon as its modules are in and the intro has gone. Without WebGL 2, when a module fails to load or
// when mountBody() throws, #stage-fallback explains why and shows a still picture of the body
// (assets/img/body-poster.webp). Opened as a file, the fallback says to use a web address.

const FALLBACK = {
  webgl: {
    title: 'The 3D body can’t show here',
    text: 'This browser or device couldn’t start 3D graphics (WebGL 2). Everything else still works: the timeline, the side effects and all the facts.',
  },
  load: {
    title: 'The 3D body didn’t load',
    text: 'Part of the 3D view couldn’t be downloaded right now. Refresh to try again. Everything else still works: the timeline, the side effects and all the facts.',
  },
  start: {
    title: 'The 3D body couldn’t start',
    text: 'This device couldn’t start the 3D view. Everything else still works: the timeline, the side effects and all the facts.',
  },
  file: {
    title: 'Open this page from its web address',
    text: '',
  },
};

function setStageState(s, reason) {
  state.stage = s;
  if (s === 'fallback') setWatched(true); // no 3D: the timeline and side effects show straight away
  const host = $('#stage-host');
  if (host) host.dataset.state = s;
  const loading = $('#stage-loading');
  const fallback = $('#stage-fallback');
  if (loading) loading.hidden = s !== 'loading';
  if (fallback) {
    fallback.hidden = s !== 'fallback';
    if (s === 'fallback') {
      const copy = FALLBACK[reason] || FALLBACK.start;
      fallback.dataset.reason = reason in FALLBACK ? reason : 'start';
      setText($('#stage-fallback-title'), copy.title);
      if (copy.text) setText($('#stage-fallback-text'), copy.text);
      showPoster(fallback);
    }
  }
  updatePlay();
}

// A still picture of the body for visitors without 3D, added only once it has actually loaded.
let posterTried = false;
function showPoster(fallback) {
  const base = fallback?.dataset.poster;
  if (posterTried || !base || IS_FILE) return;
  posterTried = true;
  // a dark-background picture in the dark theme, swapped live on theme:change
  const srcFor = (t) => (t === 'dark' ? base.replace(/\.webp$/, '-dark.webp') : base);
  const src = srcFor(state.theme);
  const img = new Image();
  img.decoding = 'async';
  img.className = 'stage-fallback-poster';
  img.alt = 'A still picture of the 3D body model';
  bus.on('theme:change', ({ theme }) => { if (img.isConnected) img.src = srcFor(theme); });
  img.addEventListener('load', () => {
    fallback.prepend(img);
    fallback.dataset.poster = 'shown';
  }, { once: true });
  img.addEventListener('error', () => { delete fallback.dataset.poster; }, { once: true });
  img.src = src;
}

let webgl2 = null; // cached: every probe creates (and immediately loses) a throwaway context
function hasWebGL2() {
  if (webgl2 !== null) return webgl2;
  if (new URLSearchParams(location.search).has('no3d')) return (webgl2 = false); // test hook for the fallback
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    webgl2 = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

// Real loading progress for #stage-loading: the engine modules, the anatomy download (streamed, so
// it has a byte count), then building the scene. The caption names the step still in progress.
const stageProgress = (() => {
  const parts = { engine: { w: 0.3, p: 0 }, anatomy: { w: 0.55, p: 0 }, build: { w: 0.15, p: 0 } };
  const STEP = { engine: 'Loading the 3D engine', anatomy: 'Loading the body', build: 'Putting it together' };
  let raf = 0;
  let shownPct = -1;
  const paint = () => {
    raf = 0;
    const v = Object.values(parts).reduce((sum, x) => sum + x.w * x.p, 0);
    const bar = $('#stage-loading .stage-progress');
    if (bar) {
      bar.style.setProperty('--progress', v.toFixed(3));
      const pct = Math.round(v * 100);
      if (pct !== shownPct) {
        shownPct = pct;
        bar.setAttribute('aria-valuenow', String(pct));
      }
    }
    const step = Object.keys(parts).find((k) => parts[k].p < 1) || 'build';
    setText($('#stage-loading-step'), STEP[step]);
  };
  return {
    set(key, p) {
      const part = parts[key];
      if (!part || !(p > part.p)) return;
      part.p = Math.min(1, p);
      if (!raf) raf = requestAnimationFrame(paint);
    },
  };
})();

// One streamed download of the anatomy for the stage progress. The scene parses these same bytes
// (mountBody's `glb` option), so body.glb is requested once; if the stream fails, the scene fetches it.
let anatomyStream = null;
function streamAnatomy() {
  if (anatomyStream) return anatomyStream;
  const subs = new Set();
  let progress = 0;
  let done = false;
  const report = (p, end = false) => {
    progress = Math.max(progress, Math.min(1, p));
    done ||= end;
    for (const fn of subs) {
      try { fn(progress, done); } catch (err) { console.error('[main] progress listener failed', err); }
    }
  };
  let resolveBytes;
  anatomyStream = {
    streamed: !(IS_FILE || lowData() || typeof fetch !== 'function'),
    // The downloaded bytes (ArrayBuffer) for the scene to parse, or null: the scene then fetches the
    // file itself. One download of body.glb instead of two.
    bytes: new Promise((res) => { resolveBytes = res; }),
    onProgress(fn) {
      subs.add(fn);
      fn(progress, done);
      return () => subs.delete(fn);
    },
  };
  if (!anatomyStream.streamed) { resolveBytes(null); return anatomyStream; } // progress unknown: credited once the scene is built
  fetch(ANATOMY_URL, { credentials: 'same-origin', priority: 'low' }).then(async (res) => {
    // content-length is the COMPRESSED size when the host gzips the file: then the decoded size is
    // known from the build instead (the stream yields decoded bytes)
    const encoded = !!res.headers.get('content-encoding');
    const size = encoded ? ANATOMY_BYTES : Number(res.headers.get('content-length')) || ANATOMY_BYTES;
    if (!res.ok) {
      await res.arrayBuffer?.().catch(() => {});
      resolveBytes(null);
      report(1, true);
      return;
    }
    if (!res.body?.getReader) {
      resolveBytes(await res.arrayBuffer().catch(() => null));
      report(1, true);
      return;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      if (value) chunks.push(value);
      got += value?.byteLength || 0;
      report(Math.min(0.97, got / size));
    }
    const out = new Uint8Array(got);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.byteLength; }
    // the reader finished without an error: these are the whole file's bytes
    resolveBytes(got > 0 ? out.buffer : null);
    report(1, true);
  }).catch(() => { resolveBytes(null); report(1, true); });
  return anatomyStream;
}

// The engine: three.js, then the scene modules (which import three.js themselves).
let enginePromise = null;
let scenePromise = null;
function loadEngine() {
  enginePromise ||= import('three').catch((err) => {
    console.warn('[main] three.js could not load.', err);
    return null;
  });
  return enginePromise;
}
function loadScene() {
  scenePromise ||= (async () => {
    // the loaders and the landmarks are needed right after three.js: fetch them alongside it
    // (they are cached; the scene imports the same URLs)
    import('three/addons/loaders/GLTFLoader.js').catch(() => {});
    import('three/addons/libs/meshopt_decoder.module.js').catch(() => {});
    fetch(new URL('../assets/anatomy/landmarks.json', import.meta.url).href, { priority: 'low' }).catch(() => {});
    await loadEngine();
    stageProgress.set('engine', 0.55);
    const mod = await safeImport('./scene/index.js', 'The 3D body');
    stageProgress.set('engine', 1);
    return mod;
  })();
  return scenePromise;
}

let bodyMounting = false;
let bodyMountAt = Infinity;
const lastAt = Object.create(null);
for (const t of ['peptide:loaded', 'site:select', 'time:change', 'effects:active', 'risk:change']) {
  bus.on(t, (d) => { if (!d?.replay) lastAt[t] = performance.now(); });
}

let stageBooted = false;
// Starts the downloads (engine, scene modules, anatomy). It creates no WebGL context: the probe runs in
// maybeMountBody(), once the intro has gone.
function boot3D() {
  if (stageBooted) return;
  stageBooted = true;
  if (IS_FILE) {
    setStageState('fallback', 'file');
    return;
  }
  if (new URLSearchParams(location.search).has('no3d')) {
    setStageState('fallback', 'webgl');
    return;
  }
  setStageState('loading');
  const stream = streamAnatomy();
  stream.onProgress((p, done) => {
    if (stream.streamed) stageProgress.set('anatomy', done ? 1 : p);
  });
  if (!state.introOpen) stageVisibleAt = performance.now();
  armSlowNotice(15000);
  loadScene().then(maybeMountBody, (err) => console.error('[main] 3D boot failed', err));
}

// A slow connection gets a reassuring line, but only while the visitor can actually see the stage.
let stageVisibleAt = 0;
function armSlowNotice(ms) {
  setTimeout(() => {
    if (state.stage !== 'loading') return;
    if (state.introOpen || !introReleased) return armSlowNotice(2000);
    const waited = performance.now() - (stageVisibleAt || performance.now());
    if (!stageVisibleAt) stageVisibleAt = performance.now();
    if (waited < 15000) return armSlowNotice(15000 - waited + 50);
    setText($('.stage-loading-text'), 'Still getting the 3D body ready. You can explore the facts below.');
  }, ms);
}

// After the first frame has been presented, then when the main thread is idle (≤ 1.2 s).
function afterFirstPaint(fn) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const run = () => { try { fn(); } catch (err) { console.error('[main] 3D boot failed', err); } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1200 });
    else setTimeout(run, 60);
  }));
}

async function maybeMountBody() {
  if (bodyMounting || state.stage === 'fallback' || state.stage === 'ready' || !stageBooted) return;
  if (state.introOpen || !introReleased) return; // closeIntro() calls back once the intro is gone
  const mod = await loadScene();
  if (bodyMounting || state.stage === 'fallback' || state.stage === 'ready') return;
  // the one WebGL probe, after the intro (the scene trusts it and skips its own)
  if (!hasWebGL2()) {
    setStageState('fallback', 'webgl');
    return;
  }
  bodyMounting = true;
  if (typeof mod?.mountBody !== 'function') {
    setStageState('fallback', 'load');
    return;
  }
  const host = $('#stage-host');
  const offReady = bus.on('stage:ready', onStageReady);
  bodyMountAt = performance.now();
  try {
    state.body = await mod.mountBody(host, {
      reducedMotion: state.reducedMotion,
      theme: state.theme,
      creditHref: ASSETS_HREF,
      glb: anatomyStream?.streamed ? anatomyStream.bytes : null,
      webgl2: true,
    });
    stageProgress.set('anatomy', 1);
    stageProgress.set('build', 1);
    onStageReady();
  } catch (err) {
    console.warn('[main] mountBody failed.', err);
    offReady();
    setStageState('fallback', hasWebGL2() ? 'start' : 'webgl');
  }
}

function onStageReady() {
  if (state.stage === 'ready' || state.stage === 'fallback') return;
  setStageState('ready');
  // The scene subscribed late: replay the state it missed, in dependency order. A replayed
  // peptide:loaded carries `replay: true`, so the timeline, the side-effect list and the narration
  // keep what the visitor has already done (only the scene takes it).
  for (const t of ['peptide:loaded', 'site:select', 'time:change', 'effects:active', 'risk:change']) {
    const detail = bus.last(t);
    if (detail !== undefined && (lastAt[t] ?? Infinity) < bodyMountAt) bus.emit(t, t === 'peptide:loaded' ? { ...detail, replay: true } : detail);
  }
  bus.emit('step:change', { step: state.step });
}

// ------------------------------------------------------------------ stepper (Pick a peptide · Pick a spot · Watch)

function stepAllowed(step) {
  if (step === 'peptide') return true;
  if (step === 'site') return !!state.entry;
  if (step === 'play') return !!state.entry && !!state.site;
  return false;
}

function stepDone(step) {
  if (step === 'peptide') return !!state.entry;
  if (step === 'site') return !!state.entry && !!state.site;
  if (step === 'play') return state.sequence === 'done';
  return false;
}

function updateStepper() {
  const cur = state.step;
  STEPS.forEach((step, i) => {
    const item = $(`.stepper-item[data-step="${step}"]`);
    const btn = item?.querySelector('.stepper-btn');
    if (!item || !btn) return;
    item.dataset.done = String(stepDone(step) && step !== cur);
    item.dataset.reached = String(i > 0 && stepDone(STEPS[i - 1]));
    if (step === cur) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
    btn.setAttribute('aria-disabled', String(!stepAllowed(step)));
  });
  setText($('#stepper-value-peptide'), state.peptide?.name || '');
  setText($('#stepper-value-site'), state.site && state.entry ? SITE_LABEL[state.site] : '');
  setText($('#stepper-value-play'), state.sequence === 'done' ? 'Watched' : '');
  for (const b of $$('[data-next]')) b.setAttribute('aria-disabled', String(!stepAllowed(b.dataset.next)));
}

function goToStep(step, { focus = false } = {}) {
  if (!STEPS.includes(step) || !stepAllowed(step)) return false;
  const changed = state.step !== step;
  state.step = step;
  const explorer = $('#explorer');
  if (explorer) explorer.dataset.step = step;
  for (const panel of $$('.step-panel')) panel.hidden = panel.dataset.step !== step;
  updateStepper();
  // the 3D scene shows all three injection-site markers (and their labels) only on step 2
  if (changed) bus.emit('step:change', { step });
  if (changed && state.sequence !== 'playing') narrateIdle();
  if (focus) focusHeading($(`#step-${step}-label`));
  return true;
}

// The first step the visitor still has to do (used when a step further on is not available yet).
function firstOpenStep() {
  return STEPS.find((s) => !stepDone(s) || s === 'play') || 'play';
}

function initStepper() {
  for (const btn of $$('.stepper-btn')) {
    btn.addEventListener('click', () => {
      const step = btn.dataset.goto;
      if (btn.getAttribute('aria-disabled') === 'true') {
        goToStep(firstOpenStep(), { focus: true });
        return;
      }
      goToStep(step, { focus: true });
    });
  }
  for (const btn of $$('[data-next]')) {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      goToStep(btn.dataset.next, { focus: true });
    });
  }
  // Picking moves on: a click (or Enter/Space) on a peptide opens step 2 once its entry has loaded.
  // Arrow keys only move the selection (APG radio groups select on arrow), so they never advance.
  $('#peptide-picker')?.addEventListener('click', (e) => {
    const opt = e.target.closest('[role="radio"]');
    if (!opt) return;
    const id = opt.dataset.peptideId || opt.dataset.id;
    setTimeout(() => {
      const p = state.peptides.find((x) => x.id === (id || state.peptideId));
      if (!p) return;
      if (!p.ready) { requestAnimationFrame(revealPeptideNote); return; } // coming soon: stay, the note says why
      if (state.entry?.id === p.id) goToStep('site', { focus: true });
      else state.advanceOnLoad = p.id;
    }, 0);
  });
  // A spot chosen in the list (click/Enter/Space) or on the 3D body opens step 3; arrows only select.
  let siteKeyAt = -Infinity;
  $('#site-picker')?.addEventListener('keydown', (e) => { if (isArrowKey(e.key)) siteKeyAt = performance.now(); }, { capture: true });
  bus.on('site:select', () => {
    if (state.booting || performance.now() - siteKeyAt < 400) return;
    setTimeout(() => { if (state.site && stepAllowed('play')) goToStep('play', { focus: state.step !== 'play' }); }, 0);
  });
}

// ------------------------------------------------------------------ peptides + content

const FALLBACK_PEPTIDES = [
  { id: 'retatrutide', name: 'Retatrutide', status: 'in-trials', statusLabel: 'Investigational: not approved anywhere', ready: false, missing: true },
];

function fallbackPicker(host, selectedId) {
  const chip = (p) => el('button', {
    type: 'button', role: 'radio', class: `chip chip--peptide${p.ready ? '' : ' chip--soon'}`,
    'aria-checked': String(p.id === selectedId), tabindex: p.id === selectedId ? '0' : '-1', 'data-id': p.id,
  }, el('span', { class: 'chip-label' }, p.name), p.ready ? null : el('span', { class: 'chip-tag' }, 'Soon'));
  host.replaceChildren(...state.peptides.map(chip));
  host.dataset.fallback = 'true';
  host.setAttribute('role', 'radiogroup'); // the built-in list holds only radios
  radioGroup(host, '[role="radio"]', (btn) => bus.emit('peptide:select', { id: btn.dataset.id }));
  bus.on('peptide:select', ({ id }) => reflectRadios(host, '[role="radio"]', (n) => n.dataset.id === id));
}

function mountPeptidePicker(selectedId) {
  const host = $('#peptide-picker');
  if (!host) return;
  if (typeof state.ui?.mountPicker === 'function') {
    try {
      clearShell(host);
      state.ui.mountPicker(host, state.peptides, { selectedId });
      return;
    } catch (err) {
      console.warn('[main] mountPicker failed; using the built-in list.', err);
    }
  }
  fallbackPicker(host, selectedId);
}

function mountSites(selected) {
  const host = $('#site-picker');
  if (!host) return;
  const shellSel = '[data-site][data-shell]';
  let mounted = false;
  if (typeof state.ui?.mountSitePicker === 'function') {
    try {
      state.ui.mountSitePicker(host, { selected });
      mounted = true;
    } catch (err) {
      console.warn('[main] mountSitePicker failed; using the built-in buttons.', err);
    }
  }
  const shell = $$(shellSel, host);
  const all = $$('[data-site]', host);
  if (mounted && shell.length && all.length > shell.length) shell.forEach((n) => n.remove()); // module drew its own
  if (!$$(shellSel, host).length) return;
  // Our pre-rendered buttons are still the ones on screen: keep them working and in sync.
  if (mounted) {
    host.addEventListener('click', (e) => {
      const b = e.target.closest(shellSel);
      if (b) bus.emit('site:select', { site: b.dataset.site });
    });
  } else {
    radioGroup(host, shellSel, (b) => bus.emit('site:select', { site: b.dataset.site }));
  }
  bus.on('site:select', ({ site }) => reflectRadios(host, shellSel, (n) => n.dataset.site === site));
  reflectRadios(host, shellSel, (n) => n.dataset.site === selected);
}

function renderMissing(text) {
  for (const body of $$('.section-body[data-render]')) {
    body.dataset.state = 'error';
    notice(body, text, { replace: true, tone: 'warn' });
  }
}

function renderContent(peptide, entry) {
  const ui = state.ui;
  if (!ui) {
    renderMissing('This part of the page didn’t load. Please refresh to try again.');
  } else if (state.entryFailed) {
    renderMissing(`The facts for ${peptide.name} didn’t load. Please refresh to try again.`);
  } else {
    for (const body of $$('.section-body[data-state="error"]')) {
      delete body.dataset.state;
      body.replaceChildren();
    }
    try {
      if (entry) ui.renderEntry(entry, { root: document });
      else ui.renderComingSoon(peptide, { root: document });
    } catch (err) {
      console.warn('[main] rendering the content failed.', err);
      renderMissing('This part of the page didn’t load. Please refresh to try again.');
    }
    const riskHost = $('#risk-check .section-body');
    if (!entry) {
      release(state.riskCheck);
      state.riskCheck = null;
    }
    if (entry && riskHost && typeof ui.mountRiskCheck === 'function') {
      try {
        release(state.riskCheck);
        state.riskCheck = ui.mountRiskCheck(riskHost, entry) || null;
      } catch (err) {
        console.warn('[main] mountRiskCheck failed.', err);
        notice(riskHost, 'The health-history check didn’t load. Please refresh to try again.', { tone: 'warn' });
      }
    }
  }
  renderLearnMeta(peptide);
  syncLearnCards();
}

let pendingContent = null;
function flushContent() {
  const p = pendingContent;
  if (!p || p.peptide !== state.peptide) return;
  pendingContent = null;
  renderContent(p.peptide, p.entry);
  mountTimelineAndEffects(p.peptide, p.entry);
}

// "After the shot" (timeline + side effects) shows once the visitor has watched the shot for this
// peptide, or at once when there is no 3D body (safety review: no red emergency card before any shot;
// v4 layout: the timeline comes after Watch).
function setWatched(on) {
  state.watched = !!on;
  const after = $('.explorer-after');
  if (after) after.hidden = !state.watched;
}

const moduleCache = {};
function loadOnce(key, path, label) {
  moduleCache[key] ||= safeImport(path, label);
  return moduleCache[key];
}

async function mountTimelineAndEffects(peptide, entry) {
  const tHost = $('#timeline');
  const eHost = $('#active-effects');
  const tNote = $('#timeline-notice');
  const eNote = $('#effects-notice');
  if (!tHost || !eHost) return;

  if (!entry) {
    try { state.timeline?.pause?.(); } catch { /* ignore */ }
    tHost.hidden = true;
    eHost.hidden = true;
    if (tNote) {
      tNote.hidden = false;
      tNote.textContent = state.entryFailed
        ? `The timeline for ${peptide.name} didn’t load. Please refresh to try again.`
        : `The timeline for ${peptide.name} is coming soon. Right now it is ready for ${readyNames()}.`;
    }
    if (eNote) {
      eNote.hidden = false;
      eNote.textContent = `Side effects for ${peptide.name} will show here once its entry is finished.`;
    }
    return;
  }
  tHost.hidden = false;
  eHost.hidden = false;
  if (tNote) tNote.hidden = true;
  if (eNote) eNote.hidden = true;
  if (state.mountedFor === entry.id) return;

  const [tl, fx] = await Promise.all([
    loadOnce('timeline', './timeline.js', 'The timeline'),
    loadOnce('effects', './effects.js', 'The side-effect list'),
  ]);
  if (state.entry !== entry) return; // selection changed while loading

  release(state.timeline);
  release(state.effects);
  state.timeline = null;
  state.effects = null;

  if (typeof tl?.mountTimeline === 'function') {
    try {
      tHost.replaceChildren();
      state.timeline = await tl.mountTimeline(tHost, entry, { reducedMotion: state.reducedMotion });
    } catch (err) {
      console.warn('[main] mountTimeline failed.', err);
      notice(tHost, 'The timeline didn’t load. “How it works” in the facts below covers when it starts, peaks and leaves.', { replace: true, tone: 'warn' });
    }
  } else {
    notice(tHost, 'The timeline didn’t load. “How it works” in the facts below covers when it starts, peaks and leaves.', { replace: true, tone: 'warn' });
  }

  if (typeof fx?.mountEffects === 'function') {
    try {
      const hasOwn = () => [...eHost.children].some((n) => !n.hasAttribute('data-shell'));
      state.effects = await fx.mountEffects(eHost, entry);
      if (hasOwn()) clearShell(eHost);
      else bus.once('effects:active', () => clearShell(eHost));
    } catch (err) {
      console.warn('[main] mountEffects failed.', err);
      notice(eHost, 'The side-effect list didn’t load. Open “Side effects” in the facts below.', { replace: true, tone: 'warn' });
    }
  } else {
    notice(eHost, 'The side-effect list didn’t load. Open “Side effects” in the facts below.', { replace: true, tone: 'warn' });
  }
  state.mountedFor = entry.id;
}

function peptideNote(p) {
  const note = $('#peptide-note');
  if (!note) return;
  let text = '';
  if (p && state.entryFailed) text = `The facts for ${p.name} didn’t load. Please refresh to try again.`;
  else if (p && !p.ready) text = `${p.name} is coming soon. The 3D walkthrough is ready for ${readyNames()}. You can still open its facts below.`;
  note.hidden = !text;
  setText(note, text);
}

// After a coming-soon pick the note under the list says why nothing moves on; on a phone it sits
// below the open grid, so bring it into view (teen-ux review).
function revealPeptideNote() {
  const note = $('#peptide-note');
  if (!note || note.hidden) return;
  const r = note.getBoundingClientRect();
  if (r.bottom > innerHeight - (parseFloat(getComputedStyle(html).getPropertyValue('--disclaimer-h')) || 40) || r.top < 0) {
    note.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
  }
}

let loadToken = 0;
async function selectPeptide(id, { fromUrl = false } = {}) {
  const peptide = state.peptides.find((p) => p.id === id);
  if (!peptide || id === state.peptideId) return;
  const token = ++loadToken;
  state.peptideId = id;
  state.peptide = peptide;
  state.entry = null;
  state.entryFailed = false;
  state.sequence = 'idle';
  if (!fromUrl || new URLSearchParams(location.search).has('peptide')) setParam('peptide', id);
  if (!state.booting) document.title = `${peptide.name} inside your body · PeptideScope`;
  if (state.step !== 'peptide') goToStep('peptide');
  updateStepper();
  updatePlay();

  let entry = null;
  if (peptide.ready && typeof peptide.load === 'function') {
    try {
      const mod = await peptide.load();
      entry = mod?.default ?? null;
      if (!entry) throw new Error('entry module has no default export');
    } catch (err) {
      console.warn(`[main] loading ${id} failed.`, err);
      state.entryFailed = true;
    }
  } else if (peptide.missing) {
    state.entryFailed = true;
  }
  if (token !== loadToken) return;

  state.entry = entry;
  bus.emit('peptide:loaded', { id, entry });
  // While the intro shows, the Learn panels and the timeline wait (closeIntro() flushes them).
  pendingContent = { peptide, entry };
  if (!state.introOpen) flushContent();
  setWatched(state.stage === 'fallback');
  peptideNote(peptide);
  narrateIdle();
  updateStepper();
  updatePlay();
  if (state.advanceOnLoad === id) {
    state.advanceOnLoad = null;
    if (entry) goToStep('site', { focus: true });
  }
}

function onSite(site) {
  if (!SITES.includes(site)) return;
  const changed = state.site !== site;
  state.site = site;
  setParam('site', site);
  if (changed && state.sequence === 'done') state.sequence = 'idle';
  if (changed && state.sequence !== 'playing') narrateIdle();
  updateStepper();
  updatePlay();
}

async function bootContent() {
  const [data, ui] = await Promise.all([
    safeImport('../data/peptides.js', 'The peptide list'),
    safeImport('./ui/index.js', 'The content renderer'),
  ]);
  state.ui = ui;
  const list = data?.PEPTIDES ?? data?.default;
  state.peptides = Array.isArray(list) && list.length ? list : FALLBACK_PEPTIDES;

  const params = new URLSearchParams(location.search);
  let id = params.get('peptide');
  const fromParam = state.peptides.some((p) => p.id === id);
  if (!fromParam) {
    id = state.peptides.some((p) => p.id === DEFAULT_PEPTIDE) ? DEFAULT_PEPTIDE : state.peptides[0].id;
  }
  const site = SITES.includes(params.get('site')) ? params.get('site') : null;
  if (params.has('site') && !site) setParam('site', null); // never keep an unknown value in shared links

  bus.on('peptide:select', ({ id: next }) => selectPeptide(next));
  bus.on('site:select', ({ site: next }) => onSite(next));

  mountPeptidePicker(id);
  mountSites(site);
  if (state.peptides === FALLBACK_PEPTIDES) notice($('#peptide-picker'), 'The full list didn’t load. Please refresh to try again.', { tone: 'warn' });

  await selectPeptide(id, { fromUrl: true });
  bus.emit('peptide:select', { id }); // lets pickers reflect the initial choice (no-op for main)
  if (site) bus.emit('site:select', { site });
  // A shared link opens on the step it points at: ?peptide= → step 2, ?peptide=&site= → step 3.
  if (site && stepAllowed('play')) goToStep('play');
  else if (fromParam && stepAllowed('site')) goToStep('site');
  else goToStep('peptide');
  state.booting = false;
  relandOnHash();
}

// A link to something inside a panel (#risk-check, #src-…) opens that panel once the content has
// rendered; other targets are landed on again, unless the visitor has already started interacting.
let interacted = false;
for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(t, () => { interacted = true; }, { once: true, passive: true, capture: true });
function relandOnHash() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  if (!id || id === 'intro' || id === 'app' || state.introOpen || interacted) return;
  if (openPanelForHash()) return;
  requestAnimationFrame(() => {
    const target = document.getElementById(id);
    if (target && !interacted) target.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
}

// ------------------------------------------------------------------ Learn: cards → <dialog> panels

const panelOpeners = new WeakMap();

function panelOf(id) {
  return document.getElementById(`dlg-${id}`);
}

// Scroll a node into view inside its panel (under the sticky head), mark it briefly and focus it.
function landInPanel(node) {
  if (!node) return;
  if (!node.hasAttribute('tabindex') && !node.matches('a[href], button, input, select, textarea, summary')) node.setAttribute('tabindex', '-1');
  // Scroll only the panel's own scroller (scrollIntoView would also move the locked page behind it).
  const inner = node.closest('.dialog-inner');
  if (inner) {
    const head = $('.dialog-head', inner);
    const offset = node.getBoundingClientRect().top - inner.getBoundingClientRect().top - (head?.offsetHeight || 0) - 16;
    inner.scrollTop += offset;
  }
  node.focus({ preventScroll: true });
  if (!state.reducedMotion) {
    node.classList.remove('is-landed');
    void node.offsetWidth; // restart the highlight
    node.classList.add('is-landed');
    setTimeout(() => node.classList.remove('is-landed'), 1700);
  }
}

function openPanel(id, { target = null, opener = null } = {}) {
  const dialog = panelOf(id);
  if (!dialog || typeof dialog.showModal !== 'function') return false;
  const current = $('dialog.learn-dialog[open]');
  let back = opener || document.activeElement;
  if (current && current !== dialog) {
    back = panelOpeners.get(current) || back; // focus goes back to the card that opened the first panel
    current.close();
  }
  if (back && !dialog.contains(back)) panelOpeners.set(dialog, back);
  if (!dialog.open) {
    try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
  }
  const inner = $('.dialog-inner', dialog);
  if (target && target !== dialog.querySelector('section')) {
    requestAnimationFrame(() => landInPanel(target));
  } else {
    if (inner) inner.scrollTop = 0;
    focusHeading($('h2', dialog));
  }
  return true;
}

function openPanelForHash() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return false; }
  const target = id ? document.getElementById(id) : null;
  const dialog = target?.closest('dialog.learn-dialog');
  if (!dialog) return false;
  return openPanel(dialog.id.slice(4), { target: target.matches('section') ? null : target, opener: $(`[data-open="${dialog.id.slice(4)}"]`) });
}

function initLearn() {
  $('.learn-grid')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-open]');
    if (card) openPanel(card.dataset.open, { opener: card });
  });
  for (const dialog of $$('dialog.learn-dialog')) {
    $('[data-close]', dialog)?.addEventListener('click', () => dialog.close());
    // a click on the backdrop (outside the panel box) closes it
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      const back = panelOpeners.get(dialog);
      panelOpeners.delete(dialog);
      // a link into a panel set the hash; drop it once the panel is closed
      try {
        const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (t && dialog.contains(t)) history.replaceState(history.state, '', location.pathname + location.search);
      } catch { /* ignore */ }
      const toStage = dialog.dataset.focusStage === 'true';
      delete dialog.dataset.focusStage;
      if (toStage) return;
      if (!$('dialog.learn-dialog[open]') && back?.isConnected) back.focus({ preventScroll: true });
    });
  }

  // In-page links: a target inside a panel opens that panel (citations open Sources); any other
  // target closes an open panel first. Native scrolling (CSS smooth, scroll-padding) does the rest.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || state.introOpen || a.closest('#intro')) return;
    let id = '';
    try { id = decodeURIComponent(a.getAttribute('href').slice(1)); } catch { return; }
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    const dialog = target.closest('dialog.learn-dialog');
    if (dialog) {
      e.preventDefault();
      try { history.replaceState(history.state, '', `#${encodeURIComponent(id)}`); } catch { /* ignore */ }
      openPanel(dialog.id.slice(4), { target: target.matches('section') ? null : target });
      return;
    }
    const open = $('dialog.learn-dialog[open]');
    if (open) {
      e.preventDefault();
      open.close();
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        if (target.id === 'explorer') focusHeading($('#explorer-title'));
        else if (target.id === 'learn') focusHeading($('#learn-title'));
      });
    }
  });

  // "Show on the body" buttons inside a panel: close it so the body can be seen (js/ui emits organ:focus,
  // scrolls to the body and focuses it). Focus then stays with the body, not the card that opened the
  // panel (which is off screen by then).
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-organ-focus]');
    const dialog = btn?.closest('dialog.learn-dialog[open]');
    if (!dialog) return;
    dialog.dataset.focusStage = 'true';
    dialog.close();
  }, { capture: true });

  // A panel whose topic has nothing to show for this peptide keeps its card hidden (never an empty panel).
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(() => syncLearnCards());
    for (const host of $$('dialog.learn-dialog [data-render]')) mo.observe(host, { childList: true });
  }
}

function syncLearnCards() {
  for (const item of $$('.learn-item')) {
    const card = $('[data-open]', item);
    const dialog = card && panelOf(card.dataset.open);
    if (!dialog) { item.hidden = true; continue; }
    const filled = $$('[data-render]', dialog).some((h) => h.childElementCount > 0 || (h.textContent || '').trim().length > 0);
    item.hidden = !filled;
  }
}

// The peptide's name in the Learn heading ("Get the facts about Retatrutide").
function renderLearnMeta(p) {
  const name = $('#learn-peptide');
  if (name && p) {
    setText(name, p.name);
    name.closest('.learn-about')?.removeAttribute('hidden');
  }
}

// ------------------------------------------------------------------ play button, narration

let seqWatchdog = 0;
let sawPhase = false;

function updatePlay() {
  const btn = $('#play-sequence');
  const hint = $('#play-hint');
  if (!btn || !hint) return;
  const p = state.peptide;
  let disabled = true;
  let label = 'Watch it happen';
  let mode = 'inject';
  let msg;
  if (!p) msg = 'Loading the list…';
  else if (state.entryFailed) msg = `The facts for ${p.name} didn’t load, so it can’t play.`;
  else if (!p.ready) msg = `${p.name} is coming soon. This part is ready for ${readyNames()}.`;
  else if (!state.entry) msg = `Loading ${p.name}…`;
  else if (!state.site) msg = 'Pick a spot first.';
  else if (state.stage === 'fallback') msg = 'The 3D body can’t show here. The timeline below still works.';
  else if (state.stageContextLost) msg = 'The 3D view is restoring…';
  else if (state.stage !== 'ready') msg = 'The 3D body is still loading…';
  else if (state.sequence === 'playing') {
    label = 'Playing…';
    mode = 'playing';
    msg = 'Watch the body. The sentence under it says what is happening.';
  } else {
    disabled = false;
    if (state.sequence === 'done') {
      label = 'Watch again';
      mode = 'replay';
      msg = 'Or press play on the timeline to see the next weeks.';
    } else {
      msg = `Starts with a shot in ${SITE_PHRASE[state.site]}.`;
    }
  }
  btn.setAttribute('aria-disabled', String(disabled));
  btn.dataset.mode = mode;
  setText($('.btn-label', btn), label);
  setText(hint, msg);
  // the step heading follows the state (teen-ux review)
  setText($('#step-play-label'), mode === 'playing' ? 'Watching…' : mode === 'replay' ? 'Want to see it again?' : 'Ready to watch?');
  updateStepper();
}

function initPlay() {
  const btn = $('#play-sequence');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (btn.getAttribute('aria-disabled') === 'true') {
      const hint = $('#play-hint');
      if (hint && !state.reducedMotion) {
        hint.classList.remove('is-nudged');
        void hint.offsetWidth;
        hint.classList.add('is-nudged');
      }
      return;
    }
    state.sequence = 'playing';
    sawPhase = false;
    updatePlay();
    bus.emit('sequence:start', { site: state.site, peptideId: state.peptideId });

    // On narrow screens the body sits under the steps: bring it into view.
    const host = $('#stage-host');
    const r = host?.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(html).getPropertyValue('--header-h')) || 64;
    if (r && (r.top < top || r.bottom > innerHeight - 40)) host.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });

    clearTimeout(seqWatchdog);
    seqWatchdog = setTimeout(() => {
      if (state.sequence === 'playing' && !sawPhase) {
        state.sequence = 'idle';
        // tell the scene to drop the sequence too, so the two never disagree about what is playing
        bus.emit('sequence:cancel', {});
        updatePlay();
        narrate('Didn’t start', 'Something went wrong in the 3D view. Try again, or open the facts below.');
      }
    }, 5000);
  });
}

function narrate(tag, text) {
  setText($('#narration-phase'), tag);
  setText($('#narration-text'), text);
}

function narrateIdle() {
  const p = state.peptide;
  if (!p) return;
  if (state.entryFailed) narrate('Didn’t load', `The facts for ${p.name} didn’t load. Please refresh the page.`);
  else if (!p.ready) narrate('Coming soon', `${p.name} is coming soon. The 3D walkthrough is ready for ${readyNames()}.`);
  else if (state.step === 'peptide') narrate('Step 1 of 3', 'Pick the peptide you saw online.');
  else if (!state.site || state.step === 'site') narrate('Step 2 of 3', 'Pick a spot: the belly, the thigh or the upper arm.');
  else narrate('Step 3 of 3', `Press Watch to follow it from ${SITE_PHRASE[state.site]} into the blood.`);
}

function initNarration() {
  bus.on('sequence:phase', ({ phase, label } = {}) => {
    sawPhase = true;
    const info = PHASES[phase] || { title: label || 'In progress', text: '' };
    state.sequence = phase === 'done' ? 'done' : 'playing';
    const host = $('#stage-host');
    if (host) host.dataset.phase = phase || '';
    narrate(info.title, info.text);
    updatePlay();
  });
  bus.on('sequence:done', () => {
    sawPhase = true;
    clearTimeout(seqWatchdog);
    if (state.sequence !== 'done') {
      state.sequence = 'done';
      narrate(PHASES.done.title, PHASES.done.text);
    }
    setWatched(true);
    updatePlay();
  });
  // The 3D view lost its WebGL context (GPU reset, too many tabs): Watch waits until it is back.
  bus.on('stage:context', ({ lost } = {}) => {
    state.stageContextLost = !!lost;
    if (lost && state.sequence === 'playing') { state.sequence = 'idle'; clearTimeout(seqWatchdog); }
    updatePlay();
  });

  // The timeline reports t = 0 on mount: keep the step instructions until time actually moves.
  let pending = null;
  let raf = 0;
  let lastPhaseId = null;
  const flush = () => {
    raf = 0;
    const d = pending;
    if (!d || state.sequence === 'playing') return;
    const moved = Number.isFinite(d.tDays) && d.tDays > 0.001;
    if (!moved && lastPhaseId === null) return;
    const id = d.phaseId;
    if (id && id !== lastPhaseId) {
      lastPhaseId = id;
      narrate(d.phaseLabel || 'Timeline', TIME_TEXT[id] || 'Move along the timeline to see what happens next.');
    }
  };
  bus.on('time:change', (d = {}) => {
    pending = d;
    // One announcer while the timeline plays: the timeline's own live region names each phase, so
    // the narration updates on screen without being read out a second time (a11y review).
    const box = $('#narration');
    if (box) box.setAttribute('aria-live', state.timeline?.playing ? 'off' : 'polite');
    if (!raf) raf = requestAnimationFrame(flush);
  });
  bus.on('peptide:loaded', (d) => {
    if (d?.replay) return;
    lastPhaseId = null;
    pending = null;
  });
}

// ------------------------------------------------------------------ boot

function step(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.catch === 'function') r.catch((err) => console.error(`[main] ${name} failed`, err));
  } catch (err) {
    console.error(`[main] ${name} failed`, err);
  }
}

step('preferences', initPreferences);
step('layout', initLayoutMetrics);
step('header', initHeaderLine);
step('routing', initRouting);
step('stepper', initStepper);
step('learn', initLearn);
step('play', initPlay);
step('narration', initNarration);
step('intro', startIntro);
// The 3D side: after first paint when there is no intro; with the intro, its downloads start when the
// story reaches its last chapters (intro:near-end, no WebGL yet) or when it closes.
step('stage', () => {
  if (!state.introOpen) afterFirstPaint(boot3D);
  else bus.once('intro:near-end', () => idle(() => { if (!stageBooted) boot3D(); }, 1500));
});
step('content', bootContent);
html.classList.add('is-booted');
