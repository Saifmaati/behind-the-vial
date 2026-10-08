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
// Browsers block ES modules on file:// pages; if this module runs anyway (some browsers allow it),
// the 3D body still cannot load its anatomy, so the stage shows the "open it from a server" notice.
const IS_FILE = location.protocol === 'file:';
// Storage keys (the inline boot script in index.html reads the same ones before first paint).
const KEY = { theme: 'peptidescope.theme', motion: 'peptidescope.motion', introSeen: 'peptidescope.introSeen' };

// Plain-language narration for each step of the injection sequence. The injection module may send
// its own short `label`; it becomes the headline and this text explains it.
const PHASES = {
  syringe: { title: 'The injection', text: 'The needle places the drug in the fat layer just under the skin, not into a vein.' },
  depot: { title: 'A depot forms', text: 'The liquid pools into a small pocket under the skin, called a depot. It does not all reach the blood at once.' },
  absorption: { title: 'Slow absorption', text: 'Over hours to days, the drug seeps out of the depot into tiny blood vessels and lymph channels nearby.' },
  bloodstream: { title: 'Into the bloodstream', text: 'Once in the blood, it is carried to the heart and pumped around the whole body.' },
  distribution: { title: 'Reaching the organs', text: 'It reaches the organs it acts on and attaches to their receptors. That is where its effects, and its side effects, come from.' },
  done: { title: 'One injection, start to finish', text: 'Now move along the timeline to see when it starts working, when it peaks and when it has mostly cleared, and which side effects tend to show up along the way.' },
};
const PHASE_ORDER = ['syringe', 'depot', 'absorption', 'bloodstream', 'distribution'];
// What each sped-up step of the animation stands for in real time (matches the narration above).
const SEQ_TIME = { syringe: 'Just injected', depot: 'Just injected', absorption: 'Hours to days', bloodstream: 'Hours to days', distribution: 'Hours to days' };

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
    const stored = store.get('localStorage', KEY.theme);
    if (stored !== 'light' && stored !== 'dark') applyTheme(e.matches ? 'light' : 'dark');
  });
  media('(prefers-reduced-motion: reduce)')?.addEventListener?.('change', (e) => {
    const stored = store.get('localStorage', KEY.motion);
    if (stored !== 'reduce' && stored !== 'full') applyMotion(e.matches);
  });
}

// ------------------------------------------------------------------ layout metrics, nav

function initLayoutMetrics() {
  const header = $('#site-header');
  const bar = $('#disclaimer');
  const set = () => {
    // The part of the header that stays on screen: on phones its top row scrolls away (negative top).
    if (header) {
      const top = parseFloat(getComputedStyle(header).top) || 0;
      html.style.setProperty('--header-h', `${Math.round(header.getBoundingClientRect().height + Math.min(0, top))}px`);
    }
    if (bar) html.style.setProperty('--disclaimer-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
  };
  set();
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(set);
    header && ro.observe(header);
    bar && ro.observe(bar);
  }
  addEventListener('resize', set, { passive: true }); // the phone layout changes the header's top
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

// Preloader: obsidian, the wordmark, the "independent education, not a seller" line and one fine
// champagne line that follows real progress: the fonts, three.js (only when WebGL 2 exists) and the
// anatomy as it streams. It leaves as soon as the fonts and three.js are in (giving the anatomy a short
// grace period), and never later than PRELOAD_CAP_MS, so it never holds the content back for long.
// The boot script never shows it under reduced motion; app.css hides it after 8 s whatever happens.
const PRELOAD_CAP_MS = 2600;
const PRELOAD_GLB_GRACE_MS = 700;
let finishPreloaderNow = null;

function initPreloader() {
  if (html.dataset.preload !== 'show') return;
  const bar = $('.preloader-bar');
  const covered = !state.introOpen; // with the intro open, the preloader reveals the intro instead
  if (covered && !state.reducedMotion) {
    html.dataset.compose = 'pending'; // composes in as the cover lifts
    composeBusyUntil = Infinity; // the body mounts after that motion (composeExplorer sets the real time)
  }
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
      setTimeout(() => { delete html.dataset.preload; }, 700);
    };
    if (state.reducedMotion) {
      delete html.dataset.preload;
      if (covered) composeExplorer();
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
  if (webgl) loadEngine().finally(() => set('three', 1));
  else set('three', 1);

  const stream = webgl ? streamAnatomy() : null;
  if (!stream?.streamed) {
    set('glb', 1);
    return;
  }
  stream.onProgress((p, done) => set('glb', done ? 1 : p));
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

function lowData() {
  const c = navigator.connection;
  return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
}
// While the intro plays, the anatomy streams in the background (shared with the preloader and the
// stage progress), so the body is ready the moment the visitor enters.
function prefetchAnatomy() {
  if (!IS_FILE && hasWebGL2()) streamAnatomy();
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
  store.set('sessionStorage', KEY.introSeen, '1');
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
// Boot: right after first paint (whether or not the stage is on screen yet) main.js starts the engine
// (three.js + js/scene/*) and streams the anatomy, showing real progress in #stage-loading. The scene
// mounts as soon as its modules are in and no intro WebGL context is alive (if the explorer is still
// composing in, once that motion settles). Without WebGL 2, when a module fails to load or when
// mountBody() throws, #stage-fallback explains why and shows a still image of the body if
// assets/img/body-poster.webp exists. Opened as a file, the fallback says to use a web address.

const FALLBACK = {
  webgl: {
    title: 'The 3D view isn’t available here',
    text: 'This browser or device couldn’t start 3D graphics (WebGL 2). Everything else still works: the timeline, the side effects, and every cited fact below.',
  },
  load: {
    title: 'The 3D body didn’t load',
    text: 'Part of the 3D view couldn’t be downloaded right now. Refresh to try again. Everything else still works: the timeline, the side effects, and every cited fact below.',
  },
  start: {
    title: 'The 3D body couldn’t start',
    text: 'This device couldn’t start the 3D view. Everything else still works: the timeline, the side effects, and every cited fact below.',
  },
  file: {
    title: 'Open this page from its web address',
    text: '',
  },
};

function setStageState(s, reason) {
  state.stage = s;
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
      const title = $('#stage-fallback-title');
      const text = $('#stage-fallback-text');
      if (title) title.textContent = copy.title;
      if (text && copy.text) text.textContent = copy.text;
      showPoster(fallback);
    }
  }
  updatePlay();
}

// A still image of the body for visitors without 3D. Another build step renders it; until that file
// exists the request simply fails and the fallback card stays on its own.
let posterTried = false;
function showPoster(fallback) {
  const src = fallback?.dataset.poster;
  if (posterTried || !src || IS_FILE) return;
  posterTried = true;
  const img = new Image();
  img.decoding = 'async';
  img.className = 'stage-fallback-poster';
  img.alt = 'A still picture of the see-through 3D body model';
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
  const STEP = { engine: 'Loading the 3D engine', anatomy: 'Loading the anatomy', build: 'Building the scene' };
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
    const stepEl = $('#stage-loading-step');
    if (stepEl && stepEl.textContent !== STEP[step]) stepEl.textContent = STEP[step];
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

// One streamed download of the anatomy, shared by the preloader and the stage progress. It also warms
// the HTTP cache for the scene's own request (GitHub Pages sends a max-age, and Chrome's cache lock
// makes a concurrent request for the same URL wait for this one instead of downloading it twice).
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
  anatomyStream = {
    streamed: !(IS_FILE || lowData() || typeof fetch !== 'function'),
    onProgress(fn) {
      subs.add(fn);
      fn(progress, done);
      return () => subs.delete(fn);
    },
  };
  if (!anatomyStream.streamed) return anatomyStream; // progress unknown: credited once the scene is built
  fetch(ANATOMY_URL, { credentials: 'same-origin' }).then(async (res) => {
    const size = Number(res.headers.get('content-length')) || 0;
    if (!res.ok || !res.body?.getReader) {
      await res.arrayBuffer?.().catch(() => {});
      report(1, true);
      return;
    }
    const reader = res.body.getReader();
    let got = 0;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      got += value?.byteLength || 0;
      report(size ? got / size : Math.min(0.9, got / 3.5e6));
    }
    report(1, true);
  }).catch(() => report(1, true));
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
  bus.on(t, () => { lastAt[t] = performance.now(); });
}

// Starts the 3D side right after first paint (double rAF: the first frame has been presented).
let stageBooted = false;
function boot3D() {
  if (stageBooted) return;
  stageBooted = true;
  if (IS_FILE) {
    setStageState('fallback', 'file');
    return;
  }
  if (!hasWebGL2()) {
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

// A slow connection gets a reassuring line, but only while the visitor can actually see the stage
// (not while the intro is still up, which keeps the body waiting on purpose).
let stageVisibleAt = 0; // when the stage could first be seen (boot, or when the intro was released)
function armSlowNotice(ms) {
  setTimeout(() => {
    if (state.stage !== 'loading') return;
    if (state.introOpen || !introReleased) return armSlowNotice(2000);
    const waited = performance.now() - (stageVisibleAt || performance.now());
    if (!stageVisibleAt) stageVisibleAt = performance.now();
    if (waited < 15000) return armSlowNotice(15000 - waited + 50);
    const t = $('.stage-loading-text');
    if (t) t.textContent = 'Still preparing the 3D body. You can keep reading below.';
  }, ms);
}

function afterFirstPaint(fn) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try { fn(); } catch (err) { console.error('[main] 3D boot failed', err); }
  }));
}

async function maybeMountBody() {
  // Two WebGL contexts never coexist: the body mounts only once the intro has been disposed.
  if (bodyMounting || state.stage === 'fallback' || state.stage === 'ready' || !stageBooted) return;
  if (state.introOpen || !introReleased) return; // closeIntro() calls back once the intro is gone
  const mod = await loadScene();
  if (bodyMounting || state.stage === 'fallback' || state.stage === 'ready') return;
  // The scene's first frame is heavy; let the explorer's compose-in motion finish first (≤ 1.6 s once
  // it starts; while the preloader still covers the page its start time is not known yet).
  const settleIn = composeBusyUntil - performance.now();
  if (settleIn > 16) {
    setTimeout(maybeMountBody, Number.isFinite(settleIn) ? settleIn : 150);
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
    state.body = await mod.mountBody(host, { reducedMotion: state.reducedMotion, theme: state.theme, creditHref: ASSETS_HREF });
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

// The desktop layout sizes the stage so the timeline's head (and, on tall screens, its whole core)
// sits above the fixed disclaimer bar. The head wraps at narrower widths, so measure it.
let tlMetricsRO = null;
function watchTimelineMetrics(tHost) {
  // Works with any timeline markup: the head is .tl-head (or the first block), the core ends at the
  // scrubber's foot (or the end of the component).
  const tl = tHost?.querySelector('.tl') || tHost?.firstElementChild;
  const head = tl?.querySelector('.tl-head') || tl?.firstElementChild;
  const foot = tl?.querySelector('.tl-scrub-foot') || tl?.querySelector('.tl-scrub') || tl;
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

// Time since the injection, in words ("6 hours", "1½ days", "2 weeks and 3 days"). The narration
// panel shows only this and the phase name: never a level, a percentage or a graph.
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
function timeInWords(tDays) {
  if (!Number.isFinite(tDays) || tDays < 0) return 'Not started';
  const hours = tDays * 24;
  if (hours < 0.5) return 'Just injected';
  if (hours < 1.5) return 'About an hour';
  if (hours < 23.5) return plural(Math.round(hours), 'hour');
  if (tDays < 6.75) {
    const half = Math.round(tDays * 2) / 2;
    const whole = Math.floor(half);
    return half % 1 ? `${whole}½ days` : plural(whole, 'day');
  }
  const days = Math.round(tDays);
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  if (weeks < 4) return rest ? `${plural(weeks, 'week')} and ${plural(rest, 'day')}` : plural(weeks, 'week');
  const halfWeeks = Math.round((tDays / 7) * 2) / 2;
  return halfWeeks % 1 ? `${Math.floor(halfWeeks)}½ weeks` : plural(halfWeeks, 'week');
}

const READOUT_IDLE = { time: 'Not started', phase: 'Before the injection', label: 'Time since injection' };
function setReadout({ time, phase, label }) {
  const t = $('#readout-time');
  const p = $('#readout-phase');
  const l = $('#readout-time-label');
  if (t && time != null && t.textContent !== time) t.textContent = time;
  if (p && phase != null && p.textContent !== phase) p.textContent = phase;
  if (l && label != null && l.textContent !== label) l.textContent = label;
}

function initNarration() {
  bus.on('sequence:phase', ({ phase, label } = {}) => {
    sawPhase = true;
    const info = PHASES[phase] || { title: label || 'In progress', text: '' };
    if (phase === 'done') state.sequence = 'done';
    else state.sequence = 'playing';
    setPhaseTrack(phase);
    narrate(label || info.title, info.text);
    // The animation is sped up: the readout names the step and, in words, the real time span it stands for.
    if (phase in SEQ_TIME) setReadout({ time: SEQ_TIME[phase], phase: info.title, label: 'Time since injection' });
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
    const id = d.phaseId ?? d.phaseLabel;
    // The timeline reports t = 0 on mount; keep the idle instructions (and "Not started") until time
    // actually moves or an injection has been played.
    const moved = Number.isFinite(d.tDays) && d.tDays > 0.001;
    if (moved || state.sequence !== 'idle' || lastPhaseId !== null) {
      setReadout({
        time: timeInWords(d.tDays),
        phase: d.phaseLabel || undefined,
        label: d.mode === 'weekly' ? 'Since the first shot' : 'Time since injection',
      });
    }
    if (id && id !== lastPhaseId && state.sequence !== 'playing' && (moved || lastPhaseId !== null)) {
      lastPhaseId = id;
      const ph = state.entry?.pk?.phases?.find?.((x) => x.id === d.phaseId);
      narrate(d.phaseLabel || ph?.label || 'Timeline', ph?.text || 'Move along the timeline to see when it starts working, when it peaks and when it has mostly cleared.');
    }
  };
  bus.on('time:change', (d = {}) => {
    pending = d;
    if (!raf) raf = requestAnimationFrame(flush);
  });
  bus.on('peptide:loaded', () => {
    lastPhaseId = null;
    pending = null;
    setReadout(READOUT_IDLE);
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
step('stage', () => afterFirstPaint(boot3D));
step('content', bootContent);
html.classList.add('is-booted');
