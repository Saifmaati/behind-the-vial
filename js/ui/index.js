// PeptideScope: the content UI's public API (the only content entry point main.js uses).
//
//   mountPicker(host, peptides, { selectedId })   → { select(id), selected, destroy() }   emits peptide:select
//   mountSitePicker(host, { selected })            → { select(site), selected, destroy() } emits site:select, reflects site:select
//   renderEntry(entry, { root })                   → { ctx }   fills every [data-render] host + #sources
//   renderComingSoon(peptide, { root })            → { ctx }   the same hosts for a not-ready peptide
//   mountRiskCheck(host, entry)                    → { items, destroy() }                  emits risk:change
//
// v4 Learn cards: each [data-render] host sits inside an expandable panel and gets a plain
// 1-2 sentence summary first, then the details. Hosts may also carry data-part to show one part
// of a combined renderer, and a few friendly key aliases are accepted:
//
//   data-render                     shows
//   overview                        What is it? + what it does in the body (minus parts other hosts show)
//   overview data-part=what|status|how   (aliases: data-render="what" | "status" | "how")
//   pharmacology (alias timing)     timing after one shot, how it travels, does the spot matter
//   side-effects                    side effects
//   red-flags (alias help)          when to get help: call 911 now / see a doctor today
//   too-much                        too much
//   dose-facts (alias trials)       fixed trial results as simple tables
//   evidence                        Is it approved? (status first) + how strong the evidence is
//   claims                          creator claims vs facts
//   gray-market (alias vial)        what's really in the vial
//   protect                         If you have one + Real medicine vs. internet vial (minus parts other hosts show)
//   protect data-part=have-one|compare   (aliases: data-render="if-you-have-one" | "real-vs-internet")
//   risk-check                      warnings-only personal history check
//   sources                         numbered sources (falls back to #sources)
//
// A host that has nothing to show (protect without data/protect.js) is left empty with
// data-empty="true". Also wired once, document-wide: [data-organ-focus] buttons emit
// organ:focus; [data-peptide-jump] buttons emit peptide:select; citation links and
// [data-open-render] links open the collapsed panel that holds their target first.
import { bus } from './busref.js';
import { SOURCES } from '../../data/sources.js';
import { GRAY } from '../../data/graymarket.js';
import { createCiteContext } from './cite.js';
import { html, prefersReducedMotion } from './util.js';
import { mountPicker, mountSitePicker as mountSites } from './picker.js';
import { renderOverview, OVERVIEW_DEFAULT } from './overview.js';
import { renderPharmacology } from './pharmacology.js';
import { renderSideEffects } from './sideeffects.js';
import { renderRedFlags } from './redflags.js';
import { renderTooMuch } from './toomuch.js';
import { renderDoseFacts } from './dosefacts.js';
import { renderEvidence } from './evidence.js';
import { renderClaims } from './claims.js';
import { renderGrayMarket } from './graymarket.js';
import { renderProtect, PROTECT_PARTS } from './protect.js';
import { mountRiskCheck as mountRisk } from './riskcheck.js';
import { renderSources } from './sources.js';
import { comingSoonCard, comingSoonSection, comingSoonStatus } from './comingsoon.js';

export { mountPicker };
export { createCiteContext } from './cite.js';

// ---------------------------------------------------------------------------
// host discovery

const KEY_ALIAS = {
  what: ['overview', 'what'],
  'what-is-it': ['overview', 'what'],
  status: ['overview', 'status'],
  approved: ['overview', 'status'],
  'is-it-approved': ['overview', 'status'],
  how: ['overview', 'how'],
  'how-it-works': ['overview', 'how'],
  timing: ['pharmacology'],
  help: ['red-flags'],
  'when-to-get-help': ['red-flags'],
  trials: ['dose-facts'],
  vial: ['gray-market'],
  'in-the-vial': ['gray-market'],
  'if-you-have-one': ['protect', 'have-one'],
  'have-one': ['protect', 'have-one'],
  'real-vs-internet': ['protect', 'compare'],
  compare: ['protect', 'compare'],
};
const PART_ALIAS = {
  'what-is-it': 'what',
  approved: 'status',
  'is-it-approved': 'status',
  'how-it-works': 'how',
  where: 'how',
  'if-you-have-one': 'have-one',
  ifyouhaveone: 'have-one',
  'real-vs-internet': 'compare',
  realvsinternet: 'compare',
};
// What a host without data-part shows by default (minus parts other hosts show on their own).
const PARTS = { overview: OVERVIEW_DEFAULT, protect: PROTECT_PARTS };

/** Every [data-render] host in reading order: { el, key, part, parts }. */
function hosts(root) {
  const scope = root && root.querySelectorAll ? root : document;
  const list = [...scope.querySelectorAll('[data-render]')].map((el) => {
    const raw = String(el.getAttribute('data-render') || '').trim().toLowerCase();
    const [key, aliasPart] = KEY_ALIAS[raw] || [raw];
    const p = String(el.getAttribute('data-part') || '').trim().toLowerCase();
    const part = p ? (PART_ALIAS[p] || p) : (aliasPart || '');
    return { el, key, part };
  }).filter((h) => h.key);
  // A host without a part shows every part that no other host shows on its own.
  for (const key of Object.keys(PARTS)) {
    const claimed = new Set(list.filter((h) => h.key === key && h.part).map((h) => h.part));
    for (const h of list) {
      if (h.key !== key) continue;
      if (h.part) h.parts = [h.part];
      else {
        const rest = PARTS[key].filter((x) => !claimed.has(x));
        h.parts = rest.length ? rest : [PARTS[key][0]];
      }
    }
  }
  if (!list.some((h) => h.key === 'sources')) {
    const s = scope.querySelector('#sources .section-body') || scope.querySelector('#sources');
    if (s) list.push({ el: s, key: 'sources', part: '' });
  }
  // "Is it approved?" leads the evidence card unless a host shows the status on its own.
  const statusHosted = list.some((h) => h.key === 'overview' && h.parts?.includes('status'));
  list.forEach((h) => { if (h.key === 'evidence') h.status = !statusHosted; });
  return list;
}

function fill(el, key, markup) {
  const s = String(markup || '');
  el.innerHTML = s;
  el.classList.add('c-body');
  el.dataset.rendered = key;
  if (s.trim()) delete el.dataset.empty; else el.dataset.empty = 'true';
}

function failNote(key, err) {
  console.error(`[content] could not render "${key}"`, err);
  return String(html`<p class="c-progress" role="note">This part could not be shown. Please reload the page.</p>`);
}

let current = { id: null, ctx: null };
let currentSite = (() => { try { return bus.last?.('site:select')?.site || null; } catch { return null; } })();

/** Site picker; also seeds the site highlighted in the timing notes. */
export function mountSitePicker(host, opts = {}) {
  if (opts.selected) { currentSite = opts.selected; reflectSite(document); }
  return mountSites(host, opts);
}

function renderSourcesInto(list, ctx) {
  for (const h of list.filter((x) => x.key === 'sources')) {
    try { fill(h.el, 'sources', renderSources(ctx)); } catch (err) { h.el.innerHTML = failNote('sources', err); }
  }
}

// ---------------------------------------------------------------------------
// full entry

const RENDER = {
  overview: (e, ctx, h) => renderOverview(e, ctx, { parts: h.parts }),
  pharmacology: (e, ctx) => renderPharmacology(e, ctx),
  'side-effects': (e, ctx) => renderSideEffects(e, ctx),
  'red-flags': (e, ctx) => renderRedFlags(e, ctx),
  'too-much': (e, ctx) => renderTooMuch(e, ctx, { gray: GRAY }),
  'dose-facts': (e, ctx) => renderDoseFacts(e, ctx),
  evidence: (e, ctx, h) => renderEvidence(e, ctx, { status: h.status !== false }),
  claims: (e, ctx) => renderClaims(e, ctx),
  'gray-market': (e, ctx) => renderGrayMarket(GRAY, ctx, { peptide: e }),
  protect: (e, ctx, h) => renderProtect(ctx, { parts: h.parts, peptideId: e.id }),
};

/** Fill every [data-render] host (and #sources) for a full entry. */
export function renderEntry(entry, { root = document } = {}) {
  if (!entry) return { ctx: null };
  const ctx = createCiteContext(SOURCES);
  current = { id: entry.id, ctx };
  const list = hosts(root);
  let riskDone = false;
  for (const h of list) {
    if (h.key === 'sources') continue;
    try {
      if (h.key === 'risk-check') {
        if (riskDone) continue;
        riskDone = true;
        mountRisk(h.el, entry, ctx);
        h.el.classList.add('c-body');
        continue;
      }
      const r = RENDER[h.key];
      if (!r) continue;
      fill(h.el, h.key, r(entry, ctx, h));
    } catch (err) {
      h.el.innerHTML = failNote(h.key, err);
    }
  }
  renderSourcesInto(list, ctx);
  reflectSite(root);
  return { ctx };
}

// ---------------------------------------------------------------------------
// coming soon

/** The same hosts for a peptide whose full entry is not ready yet. */
export function renderComingSoon(peptide, { root = document } = {}) {
  if (!peptide) return { ctx: null };
  const ctx = createCiteContext(SOURCES);
  current = { id: peptide.id, ctx };
  const list = hosts(root);
  let riskDone = false;
  for (const h of list) {
    if (h.key === 'sources') continue;
    try {
      if (h.key === 'risk-check') {
        if (riskDone) continue;
        riskDone = true;
        mountRisk(h.el, { name: peptide.name, id: peptide.id, risk: peptide.risk || null }, ctx);
        h.el.classList.add('c-body');
        continue;
      }
      if (h.key === 'overview') {
        const onlyHow = h.parts.length === 1 && h.parts[0] === 'how';
        fill(h.el, h.key, onlyHow ? '' : comingSoonCard(peptide, ctx)); // no "still being checked" placeholder
        continue;
      }
      if (h.key === 'evidence' && h.status !== false) { fill(h.el, h.key, comingSoonStatus(peptide, ctx)); continue; }
      if (h.key === 'gray-market') { fill(h.el, h.key, renderGrayMarket(GRAY, ctx, { peptide })); continue; }
      if (h.key === 'protect') { fill(h.el, h.key, renderProtect(ctx, { parts: h.parts, peptideId: peptide.id })); continue; }
      // Only emergency help is shown for a per-peptide topic still being checked; the other topics stay
      // empty (data-empty), so their Learn cards are hidden instead of opening a "still being checked"
      // placeholder (teen-ux review: no placeholders).
      if (h.key === 'red-flags' || h.key === 'too-much') { fill(h.el, h.key, comingSoonSection(h.key, peptide)); continue; }
      if (RENDER[h.key]) fill(h.el, h.key, '');
    } catch (err) {
      h.el.innerHTML = failNote(h.key, err);
    }
  }
  renderSourcesInto(list, ctx);
  reflectSite(root);
  return { ctx };
}

/** Warnings-only personal risk check. Reuses the current render's citation numbers when they match. */
export function mountRiskCheck(host, entry) {
  const ctx = current.ctx && entry && current.id === entry.id ? current.ctx : createCiteContext(SOURCES);
  host?.classList?.add('c-body');
  return mountRisk(host, entry, ctx);
}

// ---------------------------------------------------------------------------
// document-wide wiring (once)

function reflectSite(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('[data-site-note]').forEach((el) => {
    if (el.dataset.siteNote === currentSite) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
}

function scrollToStage() {
  const stage = document.getElementById('stage-host');
  if (!stage || !stage.getBoundingClientRect) return;
  const r = stage.getBoundingClientRect();
  const vh = window.innerHeight || 800;
  const mostlyVisible = r.top >= -r.height * 0.25 && r.bottom <= vh + r.height * 0.25;
  if (!mostlyVisible) stage.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  // keyboard focus follows what is shown: the 3D view (a11y review)
  const canvas = stage.querySelector('#stage-canvas-host canvas[tabindex]');
  if (canvas) canvas.focus({ preventScroll: true });
}

const cssEscape = (s) => (globalThis.CSS?.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));

/**
 * Open whatever closed container holds `target`: a native <details>, a Learn panel <dialog>,
 * or a disclosure toggled by a control with aria-controls + aria-expanded. Other owners'
 * panels are opened through their own opener (the button that names them in aria-controls),
 * so their open/close bookkeeping stays right; a dialog with no opener is shown directly.
 */
function reveal(target) {
  const chain = [];
  for (let n = target; n && n !== document.body; n = n.parentElement) chain.push(n);
  for (const n of chain.reverse()) {
    if (n.tagName === 'DETAILS' && !n.open && n !== target) { n.open = true; continue; }
    if (n.tagName === 'DIALOG' && !n.open) {
      const opener = n.id && document.querySelector(`[aria-controls~="${cssEscape(n.id)}"]:not([data-part])`);
      if (opener) opener.click();
      if (!n.open && typeof n.showModal === 'function') { try { n.showModal(); } catch { /* not connected */ } }
      continue;
    }
    if (n.id) {
      const ctrl = document.querySelector(`[aria-controls~="${cssEscape(n.id)}"][aria-expanded="false"]`);
      if (ctrl) ctrl.click();
    }
  }
}

function goTo(target) {
  reveal(target);
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.classList.remove('is-landed');   // the shell's landing highlight (css/app.css)
    void target.offsetWidth;
    target.classList.add('is-landed');
  });
}

if (typeof document !== 'undefined' && !globalThis.__peptidescopeContentWired) {
  globalThis.__peptidescopeContentWired = true;
  document.addEventListener('click', (e) => {
    const focusBtn = e.target.closest?.('[data-organ-focus]');
    if (focusBtn) {
      bus.emit('organ:focus', { organ: focusBtn.dataset.organFocus });
      scrollToStage();
      return;
    }
    const jump = e.target.closest?.('[data-peptide-jump]');
    if (jump) { bus.emit('peptide:select', { id: jump.dataset.peptideJump }); return; }
    if (e.defaultPrevented) return;   // the page shell already handled this link
    const open = e.target.closest?.('[data-open-render]');
    if (open) {
      const host = document.querySelector(`[data-render="${cssEscape(open.dataset.openRender)}"]`);
      if (host) { e.preventDefault(); goTo(host); }
      return;
    }
    const cite = e.target.closest?.('a[href^="#src-"]');
    if (cite) {
      const target = document.getElementById(decodeURIComponent(cite.getAttribute('href').slice(1)));
      if (target) { e.preventDefault(); goTo(target); }
    }
  });
  bus.on('site:select', (d) => { currentSite = d?.site || null; reflectSite(document); });
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('.c-body details:not([open])').forEach((d) => { d.setAttribute('open', ''); d.dataset.printOpened = '1'; });
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('details[data-print-opened]').forEach((d) => { d.removeAttribute('open'); delete d.dataset.printOpened; });
  });
}
