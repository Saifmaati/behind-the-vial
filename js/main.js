// PeptideScope: boot, theme, motion, routing, lazy loading and wiring (foundation).
//
// Every other module is loaded with a guarded dynamic import, so a missing or failing module only
// shows a small notice in its own host and never blanks the page. See docs/ARCHITECTURE.md.
import { bus } from './bus.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const html = document.documentElement;

const SITES = ['abdomen', 'thigh', 'arm'];
const SITE_LABEL = { abdomen: 'Abdomen', thigh: 'Thigh', arm: 'Upper arm' };
const SITE_PHRASE = { abdomen: 'the abdomen', thigh: 'the thigh', arm: 'the upper arm' };
const DEFAULT_PEPTIDE = 'retatrutide';
const STATUS_SHORT = { approved: 'Approved', 'in-trials': 'In trials', 'research-only': 'Research chemical' };
const ANATOMY_URL = new URL('../assets/anatomy/body.glb', import.meta.url).href;
// The in-stage CC BY credit links to the rendered asset register (a raw .md on Pages is not readable).
const ASSETS_HREF = 'https://github.com/Saifmaati/peptidescope/blob/main/ASSETS.md#anatomy';

// Plain-language narration for each step of the injection sequence. The injection module may send
// its own short `label`; it becomes the headline and this text explains it.
const PHASES = {
  syringe: { title: 'The injection', text: 'The needle places the drug in the fat layer just under the skin, not into a vein.' },
  depot: { title: 'A depot forms', text: 'The liquid pools into a small pocket under the skin, called a depot. It does not all reach the blood at once.' },
  absorption: { title: 'Slow absorption', text: 'Over hours to days, the drug seeps out of the depot into tiny blood vessels and lymph channels nearby.' },
  bloodstream: { title: 'Into the bloodstream', text: 'Once in the blood, it is carried to the heart and pumped around the whole body.' },
  distribution: { title: 'Reaching the organs', text: 'It reaches the organs it acts on and attaches to their receptors. That is where its effects, and its side effects, come from.' },
  done: { title: 'One injection, start to finish', text: 'Now move along the timeline to see how the level rises, peaks and fades, and which side effects tend to show up along the way.' },
};
const PHASE_ORDER = ['syringe', 'depot', 'absorption', 'bloodstream', 'distribution'];

const store = {
  get(kind, key) { try { return window[kind].getItem(key); } catch { return null; } },
  set(kind, key, value) { try { window[kind].setItem(key, value); } catch { /* private mode */ } },
};
const media = (q) => { try { return window.matchMedia(q); } catch { return null; } };

const state = {
  theme: html.dataset.theme === 'light' ? 'light' : 'dark',
  reducedMotion: html.dataset.motion === 'reduce',
  introOpen: html.dataset.intro === 'show',
  peptides: [],
  peptideId: null,
  peptide: null,
  entry: null,
  entryFailed: false,
  site: null,
  stage: 'idle', // idle | loading | ready | fallback
  sequence: 'idle', // idle | playing | done
  ui: null,
  body: null,
  timeline: null,
  effects: null,
  mountedFor: null,
  riskCheck: null,
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

function setParam(key, value) {
  try {
    const url = new URL(location.href);
    if (value == null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  } catch { /* file:// or sandboxed */ }
}

function scrollBehavior() {
  return state.reducedMotion ? 'auto' : 'smooth';
}

function focusHeading(node, { scroll = false, instant = false } = {}) {
  if (!node) return;
  if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
  if (scroll) node.closest('section')?.scrollIntoView({ behavior: instant ? 'instant' : scrollBehavior(), block: 'start' });
  node.focus({ preventScroll: true });
}

function readyNames() {
  const names = state.peptides.filter((p) => p.ready).map((p) => p.name);
  return names.length ? names.join(', ').toLowerCase() : 'the first entry';
}

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
  const color = getComputedStyle(html).getPropertyValue('--bg').trim() || (state.theme === 'light' ? '#F6F2EA' : '#0A0A0B');
  for (const m of $$('meta[name="theme-color"]')) m.setAttribute('content', color);
}

// A visitor-initiated theme switch cross-fades the whole page (View Transitions where supported,
// app.css sets the timing); instant under reduced motion or in older browsers.
function crossFadeTheme(apply) {
  if (state.reducedMotion || typeof document.startViewTransition !== 'function') return apply();
  try {
    document.startViewTransition(apply);
  } catch {
    apply();
  }
}

function applyTheme(theme, { persist = false, emit = true } = {}) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  html.dataset.theme = state.theme;
  if (persist) store.set('localStorage', 'btv.theme', state.theme);
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
  if (persist) store.set('localStorage', 'btv.motion', reduce ? 'reduce' : 'full');
  const stored = store.get('localStorage', 'btv.motion');
  if (reduce) html.dataset.motion = 'reduce';
  else if (stored === 'full') html.dataset.motion = 'full';
  else delete html.dataset.motion;
  const btn = $('#motion-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(state.reducedMotion));
    btn.title = state.reducedMotion ? 'Reduce motion: on' : 'Reduce motion: off';
  }
  if (state.reducedMotion) settleMotion();
  // Not in the original contract: lets mounted modules adapt without a reload (see docs/decisions/foundation.md).
  if (emit) bus.emit('motion:change', { reducedMotion: state.reducedMotion });
}

function initPreferences() {
  applyTheme(state.theme, { emit: false });
  applyMotion(state.reducedMotion, { emit: false });
  $('#theme-toggle')?.addEventListener('click', () => crossFadeTheme(() => applyTheme(state.theme === 'dark' ? 'light' : 'dark', { persist: true })));
  $('#motion-toggle')?.addEventListener('click', () => applyMotion(!state.reducedMotion, { persist: true }));
  media('(prefers-color-scheme: light)')?.addEventListener?.('change', (e) => {
    const stored = store.get('localStorage', 'btv.theme');
    if (stored !== 'light' && stored !== 'dark') applyTheme(e.matches ? 'light' : 'dark');
  });
  media('(prefers-reduced-motion: reduce)')?.addEventListener?.('change', (e) => {
    const stored = store.get('localStorage', 'btv.motion');
    if (stored !== 'reduce' && stored !== 'full') applyMotion(e.matches);
  });
}

// ------------------------------------------------------------------ layout metrics, nav

function initLayoutMetrics() {
  const header = $('#site-header');
  const bar = $('#disclaimer');
  const set = () => {
    if (header) html.style.setProperty('--header-h', `${Math.round(header.getBoundingClientRect().height)}px`);
    if (bar) html.style.setProperty('--disclaimer-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
  };
  set();
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(set);
    header && ro.observe(header);
    bar && ro.observe(bar);
  } else {
    addEventListener('resize', set, { passive: true });
  }
}

// Vertical scroll containers marked [data-scroll-fade] get top/bottom fade flags for CSS masks.
function initScrollFades() {
  const update = (node) => {
    const max = node.scrollHeight - node.clientHeight;
    node.dataset.fadeTop = String(max > 2 && node.scrollTop > 2);
    node.dataset.fadeBottom = String(max > 2 && node.scrollTop < max - 2);
  };
  for (const node of $$('[data-scroll-fade]')) {
    node.addEventListener('scroll', () => update(node), { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(() => update(node)).observe(node);
    if ('MutationObserver' in window) new MutationObserver(() => update(node)).observe(node, { childList: true, subtree: true });
    update(node);
  }
}

function initNav() {
  const nav = $('.site-nav');
  if (!nav) return;
  const links = $$('a[href^="#"]', nav);
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));

  const updateFades = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    nav.dataset.fadeStart = String(nav.scrollLeft > 4);
    nav.dataset.fadeEnd = String(nav.scrollLeft < max - 4);
  };
  nav.addEventListener('scroll', updateFades, { passive: true });
  addEventListener('resize', updateFades, { passive: true });
  updateFades();

  if (!('IntersectionObserver' in window)) return;
  const visible = new Map();
  let current = null;
  const setCurrent = (id) => {
    if (id === current) return;
    current = id;
    for (const [key, a] of byId) {
      if (key === id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
    const a = byId.get(id);
    if (a && nav.scrollWidth > nav.clientWidth) {
      const left = a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2;
      nav.scrollTo({ left: Math.max(0, left), behavior: scrollBehavior() });
    }
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.set(e.target.id, e.target);
      else visible.delete(e.target.id);
    }
    const order = [...byId.keys()];
    const first = order.find((id) => visible.has(id));
    if (first) setCurrent(first);
  }, { rootMargin: '-30% 0px -60% 0px' });
  for (const id of byId.keys()) {
    const sec = document.getElementById(id);
    if (sec) io.observe(sec);
  }
}

// ------------------------------------------------------------------ luxury feel (theme agent)
// Preloader, the explorer composing in, the condensing header, section reveals and eased anchor
// scrolling. Every piece is presentation only and switches off under reduced motion.

const reveals = new Set();

// Reduced motion turned on (header toggle or OS): show everything in its final state at once.
function settleMotion() {
  for (const node of reveals) node.classList.add('is-revealed');
  if (html.dataset.compose) delete html.dataset.compose;
  if (html.dataset.preload === 'show') finishPreloaderNow?.();
}

// The explorer's parts rise into place, staggered (app.css html[data-compose]). The 3D body waits
// until they have settled (maybeMountBody), so its heavy first frame never stutters the motion.
let composeTimers = [];
let composeBusyUntil = 0;
function composeExplorer({ delay = 0 } = {}) {
  composeTimers.forEach(clearTimeout);
  composeTimers = [];
  if (state.reducedMotion) {
    delete html.dataset.compose;
    composeBusyUntil = 0;
    return;
  }
  composeBusyUntil = performance.now() + delay + 1250;
  html.dataset.compose = 'pending';
  const go = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (html.dataset.compose !== 'pending') return;
    html.dataset.compose = 'in';
    composeTimers.push(setTimeout(() => { if (html.dataset.compose === 'in') delete html.dataset.compose; }, 1700));
  }));
  if (delay > 0) composeTimers.push(setTimeout(go, delay));
  else go();
}

// Preloader: obsidian, the wordmark and one champagne line that follows real progress: the fonts,
// three.js (only when WebGL 2 exists) and the anatomy as it streams. It leaves as soon as the fonts
// and three.js are in (giving the anatomy a short grace period), and never later than PRELOAD_CAP_MS.
// The boot script never shows it under reduced motion; app.css hides it after 8 s whatever happens.
const PRELOAD_CAP_MS = 3200;
const PRELOAD_GLB_GRACE_MS = 900;
let finishPreloaderNow = null;
let preloadSettled = html.dataset.preload !== 'show';
const preloadListeners = [];
function onPreloadSettled(fn) {
  if (preloadSettled) fn();
  else preloadListeners.push(fn);
}
function settlePreload() {
  if (preloadSettled) return;
  preloadSettled = true;
  for (const fn of preloadListeners.splice(0)) {
    try { fn(); } catch (err) { console.error('[main] preload listener failed', err); }
  }
}

function initPreloader() {
  if (html.dataset.preload !== 'show') {
    settlePreload();
    return;
  }
  const bar = $('.preloader-bar');
  const covered = !state.introOpen; // with the intro open, the preloader reveals the intro instead
  if (covered && !state.reducedMotion) html.dataset.compose = 'pending'; // composes in as the cover lifts
  const parts = { fonts: { w: 0.3, p: 0 }, three: { w: 0.3, p: 0 }, glb: { w: 0.4, p: 0 } };
  let shown = 0;
  let raf = 0;
  let essentialsAt = 0;
  let finished = false;
  const total = () => Object.values(parts).reduce((sum, x) => sum + x.w * x.p, 0);
  const paint = () => {
    raf = 0;
    const v = finished ? 1 : total();
    if (v > shown) {
      shown = v;
      bar?.style.setProperty('--progress', shown.toFixed(3));
    }
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(cap);
    finishPreloaderNow = null;
    paint();
    const leave = () => {
      html.dataset.preload = 'leaving';
      if (covered) composeExplorer({ delay: 140 });
      setTimeout(() => {
        delete html.dataset.preload;
        settlePreload();
      }, 700);
    };
    if (state.reducedMotion) {
      delete html.dataset.preload;
      if (covered) composeExplorer();
      settlePreload();
    } else setTimeout(leave, 300); // let the line arrive
  };
  const check = () => {
    if (finished) return;
    const essentials = parts.fonts.p >= 1 && parts.three.p >= 1;
    if (essentials && !essentialsAt) {
      essentialsAt = performance.now();
      setTimeout(check, PRELOAD_GLB_GRACE_MS + 20);
    }
    if (essentials && (parts.glb.p >= 1 || performance.now() - essentialsAt >= PRELOAD_GLB_GRACE_MS)) finish();
  };
  const set = (key, p) => {
    parts[key].p = Math.max(parts[key].p, Math.min(1, p));
    if (!raf) raf = requestAnimationFrame(paint);
    check();
  };
  const cap = setTimeout(finish, PRELOAD_CAP_MS);
  finishPreloaderNow = finish;

  // fonts: the faces visible on the first screen
  if (document.fonts?.load) {
    const faces = ['400 1em Inter', '500 1em Inter', '400 1em Newsreader', 'italic 400 1em Newsreader'];
    let n = 0;
    for (const f of faces) {
      document.fonts.load(f).catch(() => {}).finally(() => set('fonts', ++n / faces.length));
    }
  } else set('fonts', 1);

  // three.js and the anatomy only matter when the 3D view can run
  const webgl = hasWebGL2();
  if (webgl) import('three').catch(() => {}).finally(() => set('three', 1));
  else set('three', 1);

  if (!webgl || lowData() || prefetched || typeof fetch !== 'function') {
    set('glb', 1);
    return;
  }
  prefetched = true; // this stream warms the HTTP cache for the scene's own request
  fetch(ANATOMY_URL, { credentials: 'same-origin' }).then(async (res) => {
    const size = Number(res.headers.get('content-length')) || 0;
    if (!res.ok || !res.body?.getReader) {
      await res.arrayBuffer?.().catch(() => {});
      set('glb', 1);
      return;
    }
    const reader = res.body.getReader();
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value?.byteLength || 0;
      set('glb', size ? got / size : Math.min(0.9, got / 3.5e6));
    }
    set('glb', 1);
  }).catch(() => set('glb', 1));
}

// Header: transparent over the page at the top, an obsidian (or ivory) glass bar once scrolled.
// Its box never changes height, so nothing below it moves.
function initHeaderCondense() {
  const header = $('#site-header');
  if (!header) return;
  let on = null;
  let raf = 0;
  const update = () => {
    raf = 0;
    const next = scrollY > 8;
    if (next === on) return;
    on = next;
    header.dataset.condensed = String(next);
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  update();
}

// Sections (and the footer) rise into place once, the first time they enter the viewport.
function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  const targets = [...$$('.content-section'), $('#site-footer')].filter(Boolean);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-revealed');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
  for (const t of targets) {
    reveals.add(t);
    if (state.reducedMotion) t.classList.add('is-revealed');
    else io.observe(t);
  }
  html.classList.add('reveal-on');
  addEventListener('beforeprint', () => { for (const t of targets) t.classList.add('is-revealed'); });
}

// In-page links glide to their target (eased, with the sticky header's offset), then update the
// hash and move focus to the target's heading. Any wheel, touch or key input stops the glide.
let glide = 0;
function stopGlide() {
  if (glide) cancelAnimationFrame(glide);
  glide = 0;
}

function scrollTargetTop(node) {
  const pad = parseFloat(getComputedStyle(html).scrollPaddingTop) || 0;
  const margin = parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
  const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  return Math.min(max, Math.max(0, node.getBoundingClientRect().top + scrollY - pad - margin));
}

function focusAnchorTarget(node) {
  if (node.id === 'app') return node.focus({ preventScroll: true });
  if (node.id === 'explorer') return focusHeading($('#explorer-title'));
  if (node.matches('section')) {
    const h = node.querySelector('h2, h1');
    if (h) return focusHeading(h);
  }
  if (node.hasAttribute('tabindex') || node.matches('a[href], button, input, select, textarea, summary')) {
    node.focus({ preventScroll: true });
  }
}

function glideTo(node, hash) {
  stopGlide();
  const arrive = () => {
    // Setting the hash at the resting position keeps :target, history and the focus start point
    // right; the browser computes the same offset, so nothing moves.
    if (hash && location.hash !== hash) location.hash = hash;
    focusAnchorTarget(node);
  };
  const y0 = scrollY;
  const dist = scrollTargetTop(node) - y0;
  if (state.reducedMotion || Math.abs(dist) < 2) {
    scrollTo({ top: y0 + dist, behavior: 'instant' });
    arrive();
    return;
  }
  const dur = Math.min(1300, Math.max(560, Math.sqrt(Math.abs(dist)) * 18));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const live = scrollTargetTop(node); // follows late layout (charts, fonts) on the way
    scrollTo({ top: y0 + (live - y0) * ease(t), behavior: 'instant' });
    if (t < 1) glide = requestAnimationFrame(step);
    else {
      glide = 0;
      arrive();
    }
  };
  glide = requestAnimationFrame(step);
}

function initSmoothAnchors() {
  for (const t of ['wheel', 'touchstart', 'keydown']) addEventListener(t, stopGlide, { passive: true });
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || state.introOpen || a.closest('#intro')) return;
    let id = '';
    try { id = decodeURIComponent(a.getAttribute('href').slice(1)); } catch { return; }
    const node = id && id !== 'intro' ? document.getElementById(id) : null;
    if (!node) return;
    e.preventDefault();
    glideTo(node, `#${a.getAttribute('href').slice(1)}`);
  });
}

// ------------------------------------------------------------------ intro

let intro = null;
let introMounted = false;
let introWatchdog = 0;
let introLoading = null; // promise while intro.js is importing / mounting
// The 3D body never starts while the intro's WebGL context is alive: it mounts only once the intro
// has been disposed (its canvas removed and its context force-lost), see closeIntro().
let introReleased = !state.introOpen;

function setBackgroundInert(on) {
  for (const node of [$('.skip-link'), $('#site-header'), $('#app'), $('#site-footer')]) {
    if (node) node.toggleAttribute('inert', on);
  }
}

let prefetched = false; // the preloader may already be streaming the anatomy (see initPreloader)
function lowData() {
  const c = navigator.connection;
  return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
}
function prefetchAnatomy() {
  if (prefetched) return;
  prefetched = true;
  if (lowData()) return;
  const link = el('link', { rel: 'prefetch', href: ANATOMY_URL, as: 'fetch', crossorigin: 'anonymous' });
  document.head.append(link);
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
  prefetchAnatomy();
  $('#intro-enter')?.addEventListener('click', () => onIntroButton('enter'));
  $('#intro-facts')?.addEventListener('click', () => onIntroButton('facts'));
  $('#intro-skip')?.addEventListener('click', () => onIntroButton('skip'));
  document.addEventListener('keydown', onIntroKey);

  introLoading = (async () => {
    const mod = await safeImport('./intro.js', 'The intro animation');
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
  store.set('sessionStorage', 'btv.introSeen', '1');
  setBackgroundInert(false);
  prefetchAnatomy();

  const finish = () => {
    html.dataset.intro = 'done';
    // If intro.js is still mounting (Skip pressed early), wait for it so its context is released too.
    Promise.resolve(introLoading).catch(() => {}).then(() => {
      disposeIntro();
      introReleased = true;
      maybeMountBody();
    });
  };
  // Fade through obsidian (app.css): the intro's picture and words go first, then its dark ground
  // dissolves while the explorer composes in underneath; 'done' lands after both have finished.
  html.dataset.intro = 'leaving';
  if (kind !== 'facts') composeExplorer({ delay: 380 });
  if (state.reducedMotion) finish();
  else setTimeout(finish, 1000);

  // Instant: a smooth scroll does not run while the overlay still locks the page (body overflow
  // hidden during 'leaving'); the fading overlay reveals the section instead.
  if (kind === 'facts') focusHeading($('#overview-title'), { scroll: true, instant: true });
  else if (kind !== 'hash') {
    if (scrollY > 0) scrollTo({ top: 0, behavior: 'auto' });
    focusHeading($('#explorer-title'));
  }
}

function initRouting() {
  addEventListener('hashchange', () => {
    if (state.introOpen && location.hash.length > 1 && location.hash !== '#intro') closeIntro('hash');
  });
}

// ------------------------------------------------------------------ 3D stage

function setStageState(s, message) {
  state.stage = s;
  const host = $('#stage-host');
  if (host) host.dataset.state = s;
  const loading = $('#stage-loading');
  const fallback = $('#stage-fallback');
  if (loading) loading.hidden = s !== 'loading';
  if (fallback) fallback.hidden = s !== 'fallback';
  if (s === 'fallback' && message) {
    const t = $('#stage-fallback-text');
    if (t) t.textContent = message;
  }
  updatePlay();
}

function hasWebGL2() {
  if (new URLSearchParams(location.search).has('no3d')) return false; // test hook for the fallback
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

let stageNear = false;
let bodyMounting = false;
let bodyMountAt = Infinity;
const lastAt = Object.create(null);
for (const t of ['peptide:loaded', 'site:select', 'time:change', 'effects:active', 'risk:change']) {
  bus.on(t, () => { lastAt[t] = performance.now(); });
}

function watchStage() {
  const host = $('#stage-host');
  if (!host) return;
  if (!('IntersectionObserver' in window)) {
    stageNear = true;
    maybeMountBody();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      stageNear = true;
      io.disconnect();
      maybeMountBody();
    }
  }, { rootMargin: '320px 0px' });
  io.observe(host);
}

async function maybeMountBody() {
  if (bodyMounting || state.introOpen || !introReleased || !stageNear) return;
  // Presentation (theme agent): the scene's first frame is heavy, so it starts only once the
  // preloader has lifted and the explorer has finished composing in.
  if (state.stage === 'idle' && (!preloadSettled || composeBusyUntil > performance.now())) setStageState('loading');
  if (!preloadSettled) {
    onPreloadSettled(maybeMountBody);
    return;
  }
  const settleIn = composeBusyUntil - performance.now();
  if (settleIn > 16) {
    setTimeout(maybeMountBody, settleIn);
    return;
  }
  bodyMounting = true;
  const host = $('#stage-host');
  if (!hasWebGL2()) {
    setStageState('fallback', 'This browser or device couldn’t start 3D graphics (WebGL 2). Everything else still works: the timeline, the side effects, and every cited fact below.');
    return;
  }
  setStageState('loading');
  const slow = setTimeout(() => {
    const t = $('.stage-loading-text');
    if (t && state.stage === 'loading') t.textContent = 'Still preparing the 3D body… You can keep reading below.';
  }, 15000);
  const offReady = bus.on('stage:ready', onStageReady);
  bodyMountAt = performance.now();
  const mod = await safeImport('./scene/index.js', 'The 3D body');
  if (typeof mod?.mountBody !== 'function') {
    clearTimeout(slow);
    offReady();
    setStageState('fallback', 'The 3D body couldn’t load right now. Everything else still works: the timeline, the side effects, and every cited fact below.');
    return;
  }
  try {
    state.body = await mod.mountBody(host, { reducedMotion: state.reducedMotion, theme: state.theme, creditHref: ASSETS_HREF });
    onStageReady();
  } catch (err) {
    console.warn('[main] mountBody failed.', err);
    offReady();
    setStageState('fallback', 'The 3D body couldn’t start on this device. Everything else still works: the timeline, the side effects, and every cited fact below.');
  } finally {
    clearTimeout(slow);
  }
}

function onStageReady() {
  if (state.stage === 'ready' || state.stage === 'fallback') return;
  setStageState('ready');
  // The scene subscribed late: replay the state it missed, in dependency order.
  for (const t of ['peptide:loaded', 'site:select', 'time:change', 'effects:active', 'risk:change']) {
    const detail = bus.last(t);
    if (detail !== undefined && (lastAt[t] ?? Infinity) < bodyMountAt) bus.emit(t, detail);
  }
}

// ------------------------------------------------------------------ peptides + content

const FALLBACK_PEPTIDES = [
  { id: 'retatrutide', name: 'Retatrutide', status: 'in-trials', statusLabel: 'Investigational: not approved anywhere', ready: false, missing: true },
];

function renderPeptideMeta(p) {
  const host = $('#explorer-peptide');
  if (!host || !p) return;
  const level = p.status in STATUS_SHORT ? p.status : 'in-trials';
  host.replaceChildren(
    el('span', { class: 'explorer-peptide-name' }, p.name),
    el('span', { class: `badge badge--${level}`, 'data-status': level }, STATUS_SHORT[level]),
    p.statusLabel ? el('span', { class: 'explorer-peptide-status' }, p.statusLabel) : null,
  );
  document.title = `${p.name} inside the body · PeptideScope`;
}

function fallbackPicker(host, selectedId) {
  const chip = (p) => el('button', {
    type: 'button', role: 'radio', class: `chip chip--peptide${p.ready ? '' : ' chip--soon'}`,
    'aria-checked': String(p.id === selectedId), tabindex: p.id === selectedId ? '0' : '-1', 'data-id': p.id,
  }, el('span', { class: 'chip-label' }, p.name), p.ready ? null : el('span', { class: 'chip-tag' }, 'Soon'));
  host.replaceChildren(...state.peptides.map(chip));
  host.dataset.fallback = 'true';
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

function markStep(step, done) {
  const li = $(`.step[data-step="${step}"]`);
  if (li) li.dataset.done = String(!!done);
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
    return;
  }
  if (state.entryFailed) {
    renderMissing(`The facts for ${peptide.name} didn’t load. Please refresh to try again.`);
    return;
  }
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
    return;
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
      notice(riskHost, 'The risk check didn’t load. Please refresh to try again.', { tone: 'warn' });
    }
  }
}

const moduleCache = {};
function loadOnce(key, path, label) {
  moduleCache[key] ||= safeImport(path, label);
  return moduleCache[key];
}

// The desktop layout sizes the stage so the timeline's head (and, on tall screens, its whole chart)
// sits above the fixed disclaimer bar. The head wraps at narrower widths, so measure it.
let tlMetricsRO = null;
function watchTimelineMetrics(tHost) {
  const tl = tHost?.querySelector('.tl');
  const head = tl?.querySelector('.tl-head');
  const foot = tl?.querySelector('.tl-scrub-foot') || tl?.querySelector('.tl-scrub') || tl?.querySelector('.tl-chart');
  tlMetricsRO?.disconnect();
  if (!tl || !head) return;
  let last = '';
  const set = () => {
    const top = tl.getBoundingClientRect().top;
    const headH = Math.round(head.getBoundingClientRect().bottom - top);
    const coreH = foot ? Math.round(foot.getBoundingClientRect().bottom - top) : 0;
    const key = `${headH}/${coreH}`;
    if (key === last || headH <= 0) return; // hidden (coming soon) or unchanged
    last = key;
    html.style.setProperty('--tl-head-h', `${headH}px`);
    if (coreH > 0) html.style.setProperty('--tl-core-h', `${coreH}px`);
  };
  set();
  if ('ResizeObserver' in window) {
    tlMetricsRO = new ResizeObserver(set);
    tlMetricsRO.observe(head);
    tlMetricsRO.observe(tl);
  }
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
      eNote.textContent = `Side effects for ${peptide.name} will appear here once its entry is finished.`;
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
      watchTimelineMetrics(tHost);
    } catch (err) {
      console.warn('[main] mountTimeline failed.', err);
      notice(tHost, 'The timeline didn’t load. The sections below still cover onset, peak and clearance.', { replace: true, tone: 'warn' });
    }
  } else {
    notice(tHost, 'The timeline didn’t load. The sections below still cover onset, peak and clearance.', { replace: true, tone: 'warn' });
  }

  if (typeof fx?.mountEffects === 'function') {
    try {
      const hasOwn = () => [...eHost.children].some((n) => !n.hasAttribute('data-shell'));
      state.effects = await fx.mountEffects(eHost, entry);
      if (hasOwn()) clearShell(eHost);
      else bus.once('effects:active', () => clearShell(eHost));
    } catch (err) {
      console.warn('[main] mountEffects failed.', err);
      notice(eHost, 'The side-effect list didn’t load. See “Side effects, organ by organ” below.', { replace: true, tone: 'warn' });
    }
  } else {
    notice(eHost, 'The side-effect list didn’t load. See “Side effects, organ by organ” below.', { replace: true, tone: 'warn' });
  }
  state.mountedFor = entry.id;
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
  renderPeptideMeta(peptide);
  setPhaseTrack(null);
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
  renderContent(peptide, entry);
  mountTimelineAndEffects(peptide, entry);
  narrateIdle();
  markStep('peptide', !!entry);
  updatePlay();
}

function onSite(site) {
  if (!SITES.includes(site)) return;
  const changed = state.site !== site;
  state.site = site;
  setParam('site', site);
  const hud = $('#hud-site');
  if (hud) hud.textContent = SITE_LABEL[site];
  markStep('site', true);
  if (changed && state.sequence === 'done') state.sequence = 'idle';
  if (changed && state.sequence !== 'playing') narrateIdle();
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
  if (!state.peptides.some((p) => p.id === id)) {
    id = state.peptides.some((p) => p.id === DEFAULT_PEPTIDE) ? DEFAULT_PEPTIDE : state.peptides[0].id;
  }
  const site = SITES.includes(params.get('site')) ? params.get('site') : null;

  bus.on('peptide:select', ({ id: next }) => selectPeptide(next));
  bus.on('site:select', ({ site: next }) => onSite(next));

  mountPeptidePicker(id);
  mountSites(site);
  if (state.peptides === FALLBACK_PEPTIDES) notice($('#peptide-picker'), 'The full peptide list didn’t load. Please refresh to try again.', { tone: 'warn' });

  await selectPeptide(id, { fromUrl: true });
  bus.emit('peptide:select', { id }); // lets pickers reflect the initial choice (no-op for main)
  if (site) bus.emit('site:select', { site });
  relandOnHash();
}

// A section link (#risk-check, #src-…) is resolved by the browser before the sections are filled, so
// the target ends up far below the viewport once content renders above it. Land on it again, unless
// the visitor has already started scrolling or interacting.
let interacted = false;
for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(t, () => { interacted = true; }, { once: true, passive: true, capture: true });
function relandOnHash() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  if (!id || id === 'intro' || id === 'app' || state.introOpen) return;
  const go = () => {
    const target = document.getElementById(id);
    if (!target || interacted) return;
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
  };
  requestAnimationFrame(go);
  setTimeout(go, 350); // charts are drawn at their real width after a ResizeObserver pass
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
  let label = 'Inject';
  let mode = 'inject';
  let msg;
  if (!p) msg = 'Loading the peptide list…';
  else if (state.entryFailed) msg = `The facts for ${p.name} didn’t load, so the animation can’t play.`;
  else if (!p.ready) msg = `${p.name} is coming soon. The animation is ready for ${readyNames()}.`;
  else if (!state.entry) msg = `Loading ${p.name}…`;
  else if (!state.site) msg = 'Choose where it goes in first.';
  else if (state.stage === 'fallback') msg = 'The 3D view isn’t available here. The timeline and the sections below cover the same steps.';
  else if (state.stage !== 'ready') msg = 'The 3D body is still loading…';
  else if (state.sequence === 'playing') {
    label = 'Playing…';
    mode = 'playing';
    msg = 'Follow along in “What’s happening now”.';
  } else {
    disabled = false;
    if (state.sequence === 'done') {
      label = 'Replay';
      mode = 'replay';
      msg = 'Watch it again, or move along the timeline to explore.';
    } else {
      msg = `Plays what happens after an injection in ${SITE_PHRASE[state.site]}. Education only.`;
    }
  }
  btn.setAttribute('aria-disabled', String(disabled));
  btn.dataset.mode = mode;
  const span = $('.btn-label', btn);
  if (span && span.textContent !== label) span.textContent = label;
  if (hint.textContent !== msg) hint.textContent = msg;
  markStep('play', state.sequence === 'done');
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
    setPhaseTrack(null);
    updatePlay();
    bus.emit('sequence:start', { site: state.site, peptideId: state.peptideId });

    const host = $('#stage-host');
    const r = host?.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(html).getPropertyValue('--header-h')) || 64;
    if (r && (r.top < top || r.bottom > innerHeight - 40)) host.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });

    clearTimeout(seqWatchdog);
    seqWatchdog = setTimeout(() => {
      if (state.sequence === 'playing' && !sawPhase) {
        state.sequence = 'idle';
        updatePlay();
        narrate('The animation didn’t start', 'Something went wrong in the 3D view. Try again, or read the step-by-step sections below.');
      }
    }, 5000);
  });
}

function setPhaseTrack(phase) {
  const idx = phase === 'done' ? PHASE_ORDER.length : PHASE_ORDER.indexOf(phase);
  for (const li of $$('.phase-track li')) {
    const i = PHASE_ORDER.indexOf(li.dataset.phase);
    li.dataset.state = idx < 0 ? '' : i < idx ? 'done' : i === idx ? 'active' : '';
  }
  const hud = $('#hud-phase');
  if (hud) hud.textContent = phase === 'done' ? 'Complete' : phase ? (PHASES[phase]?.title ?? phase) : state.sequence === 'playing' ? 'Starting' : 'Standby';
  const host = $('#stage-host');
  if (host) host.dataset.phase = phase || '';
}

function narrate(headline, text) {
  const h = $('#narration-phase');
  const t = $('#narration-text');
  if (h && h.textContent !== headline) h.textContent = headline;
  if (t && t.textContent !== text) t.textContent = text;
}

function narrateIdle() {
  const p = state.peptide;
  if (!p) return;
  if (state.entryFailed) {
    narrate(`${p.name} didn’t load`, 'Please refresh the page to try again.');
  } else if (!p.ready) {
    const one = p.oneLine ? `${p.oneLine} ` : '';
    narrate(`${p.name}: coming soon`, `${one}Its full walkthrough is still being researched and checked. The animation and timeline are ready for ${readyNames()}.`);
  } else if (!state.site) {
    narrate('Ready when you are', 'Choose where it goes in, then press Inject to follow it through the body.');
  } else {
    narrate('Ready when you are', `Press Inject to follow it from ${SITE_PHRASE[state.site]} into the blood and out to the organs it acts on.`);
  }
}

function formatTime(tDays) {
  if (!Number.isFinite(tDays)) return '–';
  if (tDays < 1) {
    const h = Math.max(0, Math.round(tDays * 24));
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  if (tDays < 21) {
    const d = tDays < 10 ? Math.round(tDays * 10) / 10 : Math.round(tDays);
    return `${d} day${d === 1 ? '' : 's'}`;
  }
  const w = Math.round((tDays / 7) * 10) / 10;
  return `${w} weeks`;
}

function initNarration() {
  bus.on('sequence:phase', ({ phase, label } = {}) => {
    sawPhase = true;
    const info = PHASES[phase] || { title: label || 'In progress', text: '' };
    if (phase === 'done') state.sequence = 'done';
    else state.sequence = 'playing';
    setPhaseTrack(phase);
    narrate(label || info.title, info.text);
    updatePlay();
  });
  bus.on('sequence:done', () => {
    sawPhase = true;
    clearTimeout(seqWatchdog);
    if (state.sequence !== 'done') {
      state.sequence = 'done';
      setPhaseTrack('done');
      narrate(PHASES.done.title, PHASES.done.text);
    }
    updatePlay();
  });

  let pending = null;
  let raf = 0;
  let lastPhaseId = null;
  const flush = () => {
    raf = 0;
    const d = pending;
    if (!d) return;
    const time = $('#readout-time');
    const level = $('#readout-level');
    if (time) time.textContent = formatTime(d.tDays);
    if (level) {
      level.textContent = Number.isFinite(d.level)
        ? `${Math.round(d.level * 100)}% of ${d.mode === 'weekly' ? 'first peak' : 'peak'}`
        : '–';
    }
    const id = d.phaseId ?? d.phaseLabel;
    // The timeline reports t = 0 on mount; keep the idle instructions until time actually moves.
    const moved = Number.isFinite(d.tDays) && d.tDays > 0.001;
    if (id && id !== lastPhaseId && state.sequence !== 'playing' && (moved || lastPhaseId !== null)) {
      lastPhaseId = id;
      const ph = state.entry?.pk?.phases?.find?.((x) => x.id === d.phaseId);
      narrate(d.phaseLabel || ph?.label || 'Timeline', ph?.text || 'Drag along the timeline to see how the level in the blood changes over time.');
    }
  };
  bus.on('time:change', (d = {}) => {
    pending = d;
    if (!raf) raf = requestAnimationFrame(flush);
  });
  bus.on('peptide:loaded', () => {
    lastPhaseId = null;
    const time = $('#readout-time');
    const level = $('#readout-level');
    if (time) time.textContent = '–';
    if (level) level.textContent = '–';
  });
}

function initHudHint() {
  const hint = $('#hud-hint');
  if (hint && media('(pointer: coarse)')?.matches) hint.textContent = 'Drag to rotate · Pinch to zoom';
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
step('preloader', initPreloader);
step('layout', initLayoutMetrics);
step('header', initHeaderCondense);
step('nav', initNav);
step('anchors', initSmoothAnchors);
step('reveal', initReveal);
step('scroll-fades', initScrollFades);
step('routing', initRouting);
step('hud', initHudHint);
step('play', initPlay);
step('narration', initNarration);
step('intro', startIntro);
step('stage', watchStage);
step('content', bootContent);
html.classList.add('is-booted');
