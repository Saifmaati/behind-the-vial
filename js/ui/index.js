// Behind the Vial: the content UI's public API (the only content entry point main.js uses).
//
//   mountPicker(host, peptides, { selectedId })   → { select(id), selected, destroy() }   emits peptide:select
//   mountSitePicker(host, { selected })            → { select(site), selected, destroy() } emits site:select, reflects site:select
//   renderEntry(entry, { root })                   → { ctx }   fills every [data-render] body + #sources
//   renderComingSoon(peptide, { root })            → { ctx }   stubs for a not-ready peptide
//   mountRiskCheck(host, entry)                    → { items, destroy() }                  emits risk:change
//
// Also wired once, document-wide: [data-organ-focus] buttons emit organ:focus;
// [data-peptide-jump] buttons emit peptide:select; site:select is reflected in
// the pharmacology site notes; details open for printing.
import { bus } from './busref.js';
import { SOURCES } from '../../data/sources.js';
import { GRAY } from '../../data/graymarket.js';
import { createCiteContext } from './cite.js';
import { html, prefersReducedMotion, sampleNote } from './util.js';
import { mountPicker, mountSitePicker as mountSites } from './picker.js';
import { renderOverview } from './overview.js';
import { renderPharmacology } from './pharmacology.js';
import { renderSideEffects } from './sideeffects.js';
import { renderRedFlags } from './redflags.js';
import { renderTooMuch } from './toomuch.js';
import { renderDoseFacts } from './dosefacts.js';
import { renderEvidence } from './evidence.js';
import { renderClaims } from './claims.js';
import { renderGrayMarket } from './graymarket.js';
import { mountRiskCheck as mountRisk } from './riskcheck.js';
import { renderSources } from './sources.js';
import { comingSoonCard, comingSoonSection } from './comingsoon.js';
import { hydrateCharts, resetCharts } from './charts.js';

export { mountPicker };
export { createCiteContext } from './cite.js';

const RENDER = {
  overview: (e, ctx) => renderOverview(e, ctx),
  pharmacology: (e, ctx) => renderPharmacology(e, ctx),
  'side-effects': (e, ctx) => renderSideEffects(e, ctx),
  'red-flags': (e, ctx) => renderRedFlags(e, ctx),
  'too-much': (e, ctx) => renderTooMuch(e, ctx, { gray: GRAY }),
  'dose-facts': (e, ctx) => renderDoseFacts(e, ctx),
  evidence: (e, ctx) => renderEvidence(e, ctx),
  claims: (e, ctx) => renderClaims(e, ctx),
  'gray-market': (_e, ctx) => renderGrayMarket(GRAY, ctx),
};

let current = { id: null, ctx: null };
let currentSite = (() => { try { return bus.last?.('site:select')?.site || null; } catch { return null; } })();

/** Site picker; also seeds the site highlighted in the pharmacology notes. */
export function mountSitePicker(host, opts = {}) {
  if (opts.selected) { currentSite = opts.selected; reflectSite(document); }
  return mountSites(host, opts);
}

const SAMPLE_NOTE = sampleNote();

/** [data-render] bodies in reading order (first per key), plus a #sources fallback. */
function bodies(root) {
  const map = new Map();
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('[data-render]').forEach((el) => {
    const k = el.getAttribute('data-render');
    if (k && !map.has(k)) map.set(k, el);
  });
  if (!map.has('sources')) {
    const s = scope.querySelector('#sources .section-body') || scope.querySelector('#sources');
    if (s) map.set('sources', s);
  }
  return map;
}

function fill(el, key, markup, { sample } = {}) {
  el.innerHTML = `${sample ? SAMPLE_NOTE : ''}${markup}`;
  el.classList.add('c-body');
  el.dataset.rendered = key;
}

function failNote(key, err) {
  console.error(`[content] could not render "${key}"`, err);
  return String(html`<p class="c-note c-note--error" role="note">This part could not be shown. Please reload the page.</p>`);
}

function afterRender(root) {
  hydrateCharts(root && root.querySelectorAll ? root : document);
  reflectSite(root);
}

/** Fill every [data-render] section body (and #sources) for a full entry. */
export function renderEntry(entry, { root = document } = {}) {
  if (!entry) return { ctx: null };
  const ctx = createCiteContext(SOURCES);
  current = { id: entry.id, ctx };
  resetCharts();
  const map = bodies(root);
  for (const [key, el] of map) {
    if (key === 'sources') continue;
    try {
      if (key === 'risk-check') {
        mountRisk(el, entry, ctx);
        el.classList.add('c-body');
        continue;
      }
      const r = RENDER[key];
      if (!r) continue;
      const sample = key === 'gray-market' ? !!GRAY?.sample : !!entry.sample;
      fill(el, key, String(r(entry, ctx)), { sample });
    } catch (err) {
      el.innerHTML = failNote(key, err);
    }
  }
  const src = map.get('sources');
  if (src) {
    try { fill(src, 'sources', String(renderSources(ctx)), { sample: Object.values(SOURCES).some((s) => s.sample) }); } catch (err) { src.innerHTML = failNote('sources', err); }
  }
  afterRender(root);
  return { ctx };
}

/** Stub content for a peptide whose full entry is not ready yet. */
export function renderComingSoon(peptide, { root = document } = {}) {
  if (!peptide) return { ctx: null };
  const ctx = createCiteContext(SOURCES);
  current = { id: peptide.id, ctx };
  resetCharts();
  const map = bodies(root);
  for (const [key, el] of map) {
    if (key === 'sources') continue;
    try {
      if (key === 'risk-check') { mountRisk(el, { name: peptide.name, id: peptide.id, risk: null }, ctx); el.classList.add('c-body'); continue; }
      if (key === 'overview') { fill(el, key, String(comingSoonCard(peptide, ctx)), { sample: !!peptide.sample }); continue; }
      if (key === 'gray-market') { fill(el, key, String(renderGrayMarket(GRAY, ctx)), { sample: !!GRAY?.sample }); continue; }
      fill(el, key, String(comingSoonSection(key, peptide)));
    } catch (err) {
      el.innerHTML = failNote(key, err);
    }
  }
  const src = map.get('sources');
  if (src) {
    try { fill(src, 'sources', String(renderSources(ctx)), { sample: Object.values(SOURCES).some((s) => s.sample) }); } catch (err) { src.innerHTML = failNote('sources', err); }
  }
  afterRender(root);
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
}

if (typeof document !== 'undefined' && !globalThis.__btvContentWired) {
  globalThis.__btvContentWired = true;
  document.addEventListener('click', (e) => {
    const focusBtn = e.target.closest?.('[data-organ-focus]');
    if (focusBtn) {
      bus.emit('organ:focus', { organ: focusBtn.dataset.organFocus });
      scrollToStage();
      return;
    }
    const jump = e.target.closest?.('[data-peptide-jump]');
    if (jump) bus.emit('peptide:select', { id: jump.dataset.peptideJump });
  });
  bus.on('site:select', (d) => { currentSite = d?.site || null; reflectSite(document); });
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('.c-body details:not([open])').forEach((d) => { d.setAttribute('open', ''); d.dataset.printOpened = '1'; });
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('details[data-print-opened]').forEach((d) => { d.removeAttribute('open'); delete d.dataset.printOpened; });
  });
}
