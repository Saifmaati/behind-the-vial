// PeptideScope: scrubbable level-over-time timeline.
//
// An SVG chart of the NORMALIZED level in the body (% of the peak after one
// shot) from js/pk.js, with phase markers (injection, onset, peak, half-life
// point, mostly cleared), a glowing playhead, a native range input for time
// since injection, play/pause, and a "one shot" vs "weekly shots, as studied"
// view. The only control is TIME. Nothing here is, or can become, a dose.
//
// Public API (docs/ARCHITECTURE.md):
//   mountTimeline(host, entry, { reducedMotion }) →
//     { set(tDays), play(), pause(), setMode('single'|'weekly'), dispose() }
// Emits   time:change { tDays, level, phaseId, phaseLabel, mode, … } (rAF-throttled)
// Listens sequence:start (pause), sequence:done (t = 0, cue Play), peptide:loaded (re-init)

import { bus } from './bus.js';
import { paramsFromPk, phaseTimes, curve, singleDose, repeatedDoses, riseTimeToFraction } from './pk.js';

const SINGLE_END = 42;
const WEEKLY_END = 70;
const WEEKLY_SHOTS = 10;
const KEY_STEP = 0.25;
const PAGE_STEP = 1;
const PLAY_SECONDS = { single: 16, weekly: 22 };
const RM_STEP_MS = 1700;
const PEAK_BAND = 0.9; // "peak level" while within 90 % of the peak
const CAPTION = 'Shape from the published half-life and timing. Real levels differ from person to person. Not a dosing tool.';
const WEEKLY_NOTE = 'Weekly view repeats the one-shot shape every 7 days to show how levels build up. It is not a schedule to follow.';
const DISABLED_MSG = 'Timeline arrives with the full entry';

const MARKER_LABELS = { injection: 'Injection', onset: 'Onset', peak: 'Peak', halfLife: 'Half of peak', clearance: 'Mostly cleared' };
// The half marker sits where the LEVEL is down to 50 % of the peak, which comes a bit later than
// one half-life after the peak (the depot is still releasing drug). So its chart/rail label is
// always ours; the entry's own label ("Half-life") heads the detail panel with the published figure.
const FIXED_MARKER_LABEL = new Set(['halfLife']);
const MARKER_SHORT = { injection: 'Shot', onset: 'Onset', peak: 'Peak', halfLife: 'Half', clearance: 'Cleared' };
const STATE_LABELS = {
  injection: 'Absorbing from under the skin',
  onset: 'Rising: starting to work',
  peak: 'Peak level',
  falling: 'Past the peak, slowly falling',
  halfLife: 'Below half of the peak',
  clearance: 'Mostly cleared',
  buildup: 'Building up',
  plateau: 'Steady level',
};
const DEFAULT_TEXT = {
  injection: 'The shot leaves a small pool (a depot) under the skin. The drug seeps from it into tiny blood vessels over the following days.',
  onset: 'Enough drug has reached the blood to start acting on its targets.',
  peak: 'The level in the blood is at its highest.',
  halfLife: 'Half of the peak level is gone. The body keeps removing the drug at a steady pace.',
  clearance: 'Only a few percent of the peak level is left.',
  weekly: 'Each new shot arrives before the previous one has cleared, so the level builds up over the first few weeks, then rises and falls within a steady band.',
};

const SVGNS = 'http://www.w3.org/2000/svg';
let uidCounter = 0;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const fmtDayShort = (t) => {
  if (t > 0 && t < 1) return `${Math.round(t * 24)} h`;
  const r = Math.round(t * 10) / 10;
  return `Day ${Number.isInteger(r) ? r : r.toFixed(1)}`;
};
const pct = (lv) => Math.round(lv * 100);
const firstNumber = (v) => {
  if (num(v)) return v;
  const m = String(v ?? '').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// ---------------------------------------------------------------------------
// Citations (shared with js/effects.js). Numbers must match the page's
// numbered #sources list, so we never use a citation helper that restarts its
// numbering per call. Order of preference:
//   1. a page-level cite context exported by js/ui/cite.js (contract request:
//      pageCite(ids) or getPageContext().cite(ids), same numbering as renderEntry)
//   2. the rendered #sources list: <… id="src-ID"> gives the number, we print
//      the same <sup class="cite"> markup cite.js uses
//   3. plain source links (publisher name) from data/sources.js
let citerPromise = null;
function loadCiter() {
  if (!citerPromise) {
    citerPromise = (async () => {
      let page = null;
      let sources = null;
      try {
        const m = await import('./ui/cite.js');
        if (typeof m.pageCite === 'function') page = (ids) => m.pageCite(ids);
        else if (typeof m.getPageContext === 'function') page = (ids) => m.getPageContext()?.cite?.(ids);
      } catch { /* cite.js not available: fall back */ }
      try {
        const s = await import('../data/sources.js');
        sources = s.SOURCES || s.default || null;
      } catch { /* sources registry not available */ }
      return { page, sources };
    })();
  }
  return citerPromise;
}

function sourceNumber(el) {
  const n = Number(el.dataset?.n ?? el.getAttribute('value'));
  if (Number.isInteger(n) && n > 0) return n;
  if (el.tagName === 'LI' && el.parentElement?.tagName === 'OL') {
    const start = Number(el.parentElement.getAttribute('start')) || 1;
    return start + [...el.parentElement.children].indexOf(el);
  }
  const lead = (el.textContent || '').trim().match(/^\[?(\d{1,3})[\].]\s/);
  return lead ? Number(lead[1]) : null;
}

function citeHtml(ids, { page, sources }) {
  if (page) {
    try { const out = page(ids); const str = out == null ? '' : String(out); if (str.trim()) return str; } catch { /* fall through */ }
  }
  const sups = [];
  const plain = [];
  for (const id of ids) {
    const src = sources?.[id];
    const anchor = typeof document !== 'undefined' ? document.getElementById(`src-${id}`) : null;
    const n = anchor ? sourceNumber(anchor) : null;
    if (n) {
      const label = `Source ${n}${src?.title ? `: ${src.title}` : ''}`;
      sups.push(`<sup class="cite"><a href="#src-${esc(id)}" aria-label="${esc(label)}">${n}</a></sup>`);
      continue;
    }
    const text = src ? (src.publisher || src.title || id) : 'Source';
    const title = src?.title ? ` title="${esc(src.title)}"` : '';
    if (anchor) plain.push(`<a href="#src-${esc(id)}"${title}>${esc(text)}</a>`);
    else if (src?.url && /^https?:\/\//.test(src.url)) plain.push(`<a href="${esc(src.url)}" target="_blank" rel="noopener"${title}>${esc(text)}<span class="tl-sr"> (opens in a new tab)</span></a>`);
    else plain.push(`<span${title}>${esc(text)}</span>`);
  }
  let html = sups.join('');
  if (plain.length) html += `<span class="tl-src"><span class="tl-src-k">${plain.length > 1 ? 'Sources' : 'Source'}:</span> ${plain.join('<span aria-hidden="true"> · </span>')}</span>`;
  return html;
}

/** Render citations into every [data-cite="id id …"] placeholder under root. */
export async function fillCitations(root) {
  if (!root) return;
  const nodes = [...root.querySelectorAll('[data-cite]:not([data-cite-done])')];
  if (!nodes.length) return;
  const citer = await loadCiter();
  for (const el of nodes) {
    if (!el.isConnected) continue;
    const ids = [...new Set((el.getAttribute('data-cite') || '').split(/\s+/).filter(Boolean))];
    el.setAttribute('data-cite-done', '');
    if (ids.length) el.innerHTML = citeHtml(ids, citer);
  }
}
export const citePlaceholder = (ids) => (Array.isArray(ids) && ids.length ? `<span class="tl-cites" data-cite="${esc(ids.join(' '))}"></span>` : '');

// ---------------------------------------------------------------------------

function buildModel(entry) {
  const pk = entry?.pk;
  if (!pk) return null;
  let params;
  try {
    params = paramsFromPk(pk, { doses: WEEKLY_SHOTS });
  } catch (e) {
    console.warn('[timeline] pk data unusable:', e.message);
    return null;
  }
  const times = phaseTimes(params);
  const list = Array.isArray(pk.phases) ? pk.phases.filter((p) => p && p.id) : [];
  const byId = Object.fromEntries(list.map((p) => [p.id, p]));
  const onsetPhase = byId.onset;
  const onsetT = num(onsetPhase?.tDays) ? onsetPhase.tDays : riseTimeToFraction(0.5, params);
  // The injection marker borrows the entry's "depot" absorption step when it has no phase of its own.
  const depot = (entry.absorption?.steps || []).find((st) => st && st.id === 'depot');
  if (!byId.injection && depot?.text) byId.injection = { text: depot.text, sources: depot.sources, unverified: depot.unverified };
  const mk = (id, t, estimate) => {
    const ph = byId[id] || {};
    const entryLabel = typeof ph.label === 'string' && ph.label.trim() ? ph.label.trim() : MARKER_LABELS[id];
    const label = FIXED_MARKER_LABEL.has(id) ? MARKER_LABELS[id] : entryLabel;
    return { id, t, estimate: !!estimate, label, entryLabel, chartLabel: label.length <= 16 ? label : MARKER_LABELS[id], text: ph.text || DEFAULT_TEXT[id], display: typeof ph.display === 'string' ? ph.display : '', sources: ph.sources || [], unverified: !!ph.unverified };
  };
  const markers = [
    mk('injection', 0, false),
    mk('onset', onsetT, !num(onsetPhase?.tDays) || onsetPhase?.estimate),
    mk('peak', times.peak, pk.tmaxEstimate || byId.peak?.estimate),
    mk('halfLife', times.half, byId.halfLife?.estimate),
    mk('clearance', times.clearance, byId.clearance?.estimate),
  ];
  const entryN = firstNumber(pk.steadyStateDoses);
  const steadyN = clamp(Math.round(entryN ?? times.steadyStateDose ?? 5), 2, WEEKLY_SHOTS);
  const tau = params.intervalDays;
  const singleEnd = Math.max(SINGLE_END, Math.ceil((times.clearance + 3) / 7) * 7);
  const weeklyParams = { ...params, doses: WEEKLY_SHOTS };
  // Peak / trough of the last full interval in view = the steady band.
  const lastStart = (WEEKLY_SHOTS - 1) * tau;
  let bandHi = 0, bandLo = Infinity, maxWeekly = 0;
  for (let i = 0; i <= 1400; i++) {
    const t = (WEEKLY_END * i) / 1400;
    const v = repeatedDoses(t, weeklyParams);
    maxWeekly = Math.max(maxWeekly, v);
  }
  for (let i = 0; i <= 400; i++) {
    const t = lastStart - tau + (tau * i) / 400;
    const v = repeatedDoses(t, weeklyParams);
    bandHi = Math.max(bandHi, v);
    bandLo = Math.min(bandLo, v);
  }
  const steadyPhase = byId.steadyState || byId.steady || null;
  return {
    id: entry.id, name: entry.name, pk, params, weeklyParams, times, markers, tau,
    steadyN, steadyNModel: times.steadyStateDose, steadyFromEntry: entryN != null,
    steadyText: steadyPhase?.text || DEFAULT_TEXT.weekly, steadySources: steadyPhase?.sources || [],
    end: { single: singleEnd, weekly: WEEKLY_END },
    max: { single: 1, weekly: maxWeekly },
    band: { hi: bandHi, lo: bandLo },
  };
}

export function mountTimeline(host, entry, { reducedMotion } = {}) {
  if (!host) throw new TypeError('mountTimeline: host element required');
  // Reduced motion: the mount option, else the page's html[data-motion] (set by main.js), else the OS
  // setting; `motion:change` (main.js) switches it live.
  const motionAttr = typeof document !== 'undefined' ? document.documentElement.dataset.motion : undefined;
  let rm = reducedMotion ?? (motionAttr === 'reduce' ? true : motionAttr === 'full' ? false
    : (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));
  const uid = `tl${(++uidCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const offs = [];
  let model = null;
  let mode = 'single';
  let t = 0;
  let playing = false;
  let playRaf = 0, frameRaf = 0, rmTimer = 0, lastTs = 0;
  let geo = null;
  let lastPhaseKey = '';
  let lastDetailKey = '';
  let dragging = false;
  let disposed = false;

  const root = document.createElement('div');
  root.className = 'tl';
  root.innerHTML = `
    <div class="tl-head">
      <div class="tl-lead">
        <button type="button" class="tl-play" aria-label="Play timeline">
          <svg class="tl-ico tl-ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a.6.6 0 0 0 .9.5l10.2-6.5a.6.6 0 0 0 0-1L8.9 5a.6.6 0 0 0-.9.5z"/></svg>
          <svg class="tl-ico tl-ico-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>
        </button>
        <div class="tl-readout">
          <p class="tl-eyebrow">Level in the body · model</p>
          <p class="tl-value" aria-hidden="true"><span class="tl-day">Day 0.0</span><span class="tl-dot-sep">·</span><span class="tl-pct">0%</span><span class="tl-of">of peak</span></p>
          <p class="tl-state"><span class="tl-state-dot" aria-hidden="true"></span><span class="tl-state-label"></span><span class="tl-chip tl-chip-est" hidden>Model estimate</span></p>
        </div>
      </div>
      <fieldset class="tl-modes">
        <legend class="tl-sr">Timeline view</legend>
        <label class="tl-mode"><input type="radio" name="${uid}-mode" value="single" checked><span>One shot</span></label>
        <label class="tl-mode"><input type="radio" name="${uid}-mode" value="weekly"><span>Weekly shots, as studied</span></label>
      </fieldset>
    </div>
    <p class="tl-cue" hidden><span class="tl-cue-dot" aria-hidden="true"></span><span class="tl-cue-text"></span></p>
    <div class="tl-chart-top">
      <p class="tl-ytitle">% of the peak after one shot</p>
      <p class="tl-legend" hidden><span class="tl-lg tl-lg-shot">Shot</span><span class="tl-lg tl-lg-ref">One-shot peak</span><span class="tl-lg tl-lg-band">Steady band</span></p>
    </div>
    <div class="tl-chart">
      <svg class="tl-svg" xmlns="${SVGNS}" role="img" aria-labelledby="${uid}-svgtitle"><title id="${uid}-svgtitle"></title></svg>
      <div class="tl-empty" hidden><p>${esc(DISABLED_MSG)}</p></div>
    </div>
    <div class="tl-scrub">
      <input class="tl-range" id="${uid}-range" type="range" min="0" max="${SINGLE_END}" step="any" value="0" aria-describedby="${uid}-keys">
    </div>
    <div class="tl-scrub-foot">
      <label class="tl-range-label" for="${uid}-range">Time since injection</label>
      <span class="tl-keys" id="${uid}-keys">Arrow keys: ¼ day · Page Up/Down: 1 day</span>
    </div>
    <ol class="tl-rail" aria-label="Jump to a point on the timeline"></ol>
    <div class="tl-detail"></div>
    <p class="tl-caption"><span>${esc(CAPTION)}</span> <span class="tl-weekly-note" hidden>${esc(WEEKLY_NOTE)}</span></p>
    <p class="tl-sr" aria-live="polite" aria-atomic="true"></p>`;
  host.replaceChildren(root);
  host.classList.add('tl-host');

  const $ = (s) => root.querySelector(s);
  const playBtn = $('.tl-play');
  const range = $('.tl-range');
  const svg = $('.tl-svg');
  const svgTitle = svg.querySelector('title');
  const chartWrap = $('.tl-chart');
  const emptyEl = $('.tl-empty');
  const dayEl = $('.tl-day');
  const pctEl = $('.tl-pct');
  const ofEl = $('.tl-of');
  const stateLabelEl = $('.tl-state-label');
  const estChip = $('.tl-chip-est');
  const rail = $('.tl-rail');
  const detail = $('.tl-detail');
  const cue = $('.tl-cue');
  const cueText = $('.tl-cue-text');
  const legend = $('.tl-legend');
  const weeklyNote = $('.tl-weekly-note');
  const live = root.querySelector('p.tl-sr[aria-live]');
  const radios = [...root.querySelectorAll('.tl-modes input')];
  if (rm) root.classList.add('tl-rm');

  // ----- model helpers -----------------------------------------------------
  const tEnd = () => (model ? model.end[mode] : SINGLE_END);
  const levelAt = (tt) => {
    if (!model) return 0;
    return mode === 'weekly' ? repeatedDoses(tt, model.weeklyParams) : singleDose(tt, model.params);
  };
  const shotInfo = (tt) => {
    if (!model) return { shot: 1, shots: 1, since: tt };
    if (mode !== 'weekly') return { shot: 1, shots: 1, since: tt };
    const k = clamp(Math.floor(tt / model.tau + 1e-9) + 1, 1, WEEKLY_SHOTS);
    return { shot: k, shots: WEEKLY_SHOTS, since: tt - (k - 1) * model.tau };
  };
  // Last marker passed (drives the detail panel and the rail highlight).
  const currentMarker = (tt) => {
    if (!model) return null;
    let cur = model.markers[0];
    for (const m of model.markers) if (tt >= m.t - 1e-9) cur = m;
    return cur;
  };
  function stateAt(tt, lv) {
    if (!model) return { id: 'none', label: '', estimate: false };
    if (mode === 'weekly') {
      const { shot } = shotInfo(tt);
      const id = shot < model.steadyN ? 'buildup' : 'plateau';
      return { id, label: `${STATE_LABELS[id]}: shot ${shot} of ${WEEKLY_SHOTS}`, estimate: false };
    }
    const [, onset, peak, half, clear] = model.markers;
    let id;
    if (tt < onset.t && tt < peak.t) id = 'injection';
    else if (lv >= PEAK_BAND) id = 'peak';
    else if (tt < peak.t) id = 'onset';
    else if (tt < half.t) id = 'falling';
    else if (tt < clear.t) id = 'halfLife';
    else id = 'clearance';
    const estimate = (id === 'peak' && peak.estimate) || (id === 'onset' && onset.estimate);
    return { id, label: STATE_LABELS[id], estimate };
  }

  // ----- layout (static SVG layers) -----------------------------------------
  function layout() {
    const w = Math.round(chartWrap.clientWidth);
    if (!w) return; // hidden; ResizeObserver will call again
    const W = Math.max(260, w);
    const narrow = W < 520;
    const H = narrow ? 212 : 252;
    const weekly = mode === 'weekly';
    const M = { l: narrow ? 38 : 46, r: narrow ? 12 : 18, t: weekly ? 30 : (narrow ? 42 : 44), b: 26 };
    const pw = W - M.l - M.r;
    const ph = H - M.t - M.b;
    const end = tEnd();
    const yMax = model ? (weekly ? Math.max(1.15, model.max.weekly * 1.1) : 1.12) : 1.12;
    const x = (tt) => M.l + (tt / end) * pw;
    const y = (v) => M.t + ph * (1 - v / yMax);
    geo = { W, H, M, pw, ph, end, yMax, x, y, narrow };
    root.style.setProperty('--tl-ml', `${M.l}px`);
    root.style.setProperty('--tl-mr', `${M.r}px`);
    root.classList.toggle('tl-narrow', narrow);

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    const base = y(0);
    const parts = [];
    parts.push(`<defs>
      <linearGradient id="${uid}-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="tl-stop-a"/><stop offset="1" class="tl-stop-b"/>
      </linearGradient>
      <linearGradient id="${uid}-wash" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="tl-wash-a"/><stop offset="1" class="tl-wash-b"/>
      </linearGradient>
      <clipPath id="${uid}-past"><rect class="tl-clip" x="0" y="0" width="0" height="${H}"/></clipPath>
      <clipPath id="${uid}-plot"><rect x="${M.l}" y="${M.t - 8}" width="${pw}" height="${ph + 8}"/></clipPath>
      <filter id="${uid}-glow" x="-20%" y="-40%" width="140%" height="180%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`);
    parts.push(`<rect class="tl-plotbg" x="${M.l}" y="${M.t}" width="${pw}" height="${ph}" fill="url(#${uid}-wash)"/>`);

    // Horizontal grid + y labels
    const step = yMax > 1.3 ? 0.5 : 0.25;
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      const yy = y(v).toFixed(1);
      const ref = Math.abs(v - 1) < 1e-9;
      parts.push(`<line class="tl-grid${v === 0 ? ' tl-axis' : ''}${ref ? ' tl-grid-ref' : ''}" x1="${M.l}" x2="${W - M.r}" y1="${yy}" y2="${yy}"/>`);
      parts.push(`<text class="tl-ylab${ref ? ' tl-ylab-ref' : ''}" x="${M.l - 7}" y="${yy}" dy="0.32em" text-anchor="end">${Math.round(v * 100)}%</text>`);
    }
    // X ticks
    for (let d = 0; d <= end + 1e-9; d += 1) {
      const xx = x(d).toFixed(1);
      const major = d % 7 === 0;
      parts.push(`<line class="tl-tick${major ? ' tl-tick-major' : ''}" x1="${xx}" x2="${xx}" y1="${base}" y2="${base + (major ? 6 : 3)}"/>`);
      if (major && !(narrow && weekly && d % 14 !== 0 && d !== end)) {
        parts.push(`<text class="tl-xlab" x="${xx}" y="${base + 18}" text-anchor="middle">${d}</text>`);
      }
      if (major && d > 0 && d < end) parts.push(`<line class="tl-vgrid" x1="${xx}" x2="${xx}" y1="${M.t}" y2="${base}"/>`);
    }

    if (model) {
      // Weekly annotations: steady band + shot markers
      if (weekly) {
        const bx = x((model.steadyN - 1) * model.tau);
        parts.push(`<rect class="tl-band" x="${bx.toFixed(1)}" y="${M.t}" width="${(W - M.r - bx).toFixed(1)}" height="${ph}"/>`);
        parts.push(`<line class="tl-band-edge" x1="${bx.toFixed(1)}" x2="${bx.toFixed(1)}" y1="${M.t - 10}" y2="${base}"/>`);
        const bandLabel = narrow ? `Steady from shot ${model.steadyN}` : `Steady level from about shot ${model.steadyN}`;
        parts.push(`<text class="tl-band-label" x="${(bx + 6).toFixed(1)}" y="${M.t - 14}">${esc(bandLabel)}</text>`);
        if (!narrow) {
          for (const [v, cls] of [[model.band.hi, 'hi'], [model.band.lo, 'lo']]) {
            const yy = y(v).toFixed(1);
            parts.push(`<line class="tl-band-line" x1="${bx.toFixed(1)}" x2="${W - M.r}" y1="${yy}" y2="${yy}"/>`);
            parts.push(`<text class="tl-band-val tl-band-val-${cls}" x="${W - M.r - 4}" y="${yy}" dy="${cls === 'hi' ? '-0.45em' : '1.1em'}" text-anchor="end">${pct(v)}%</text>`);
          }
        }
        parts.push('<g class="tl-shots">');
        for (let k = 0; k < WEEKLY_SHOTS; k++) {
          const sx = x(k * model.tau);
          parts.push(`<path class="tl-shot" data-shot="${k + 1}" d="M${(sx - 4.5).toFixed(1)} ${base - 0.5} L${sx.toFixed(1)} ${base - 7.5} L${(sx + 4.5).toFixed(1)} ${base - 0.5} Z"/>`);
        }
        parts.push('</g>');
      }

      // Curve
      const n = clamp(Math.round(pw * 1.2), 160, 900);
      const pts = curve(mode === 'weekly' ? model.weeklyParams : model.params, { tEnd: end, n, mode });
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(2)} ${y(p.level).toFixed(2)}`).join('');
      const area = `${line}L${x(end).toFixed(2)} ${base}L${x(0).toFixed(2)} ${base}Z`;
      parts.push(`<g clip-path="url(#${uid}-plot)">
        <path class="tl-area tl-area-future" d="${area}" fill="url(#${uid}-fill)"/>
        <path class="tl-line tl-line-future" d="${line}"/>
        <g clip-path="url(#${uid}-past)">
          <path class="tl-area tl-area-past" d="${area}" fill="url(#${uid}-fill)"/>
          <path class="tl-line tl-line-past" d="${line}" filter="url(#${uid}-glow)"/>
        </g>
      </g>`);

      // Phase markers (single mode): lane labels with collision avoidance
      if (!weekly) {
        const laneY = [M.t - 27, M.t - 12];
        const laneEnd = [-Infinity, -Infinity];
        const gap = 6;
        parts.push('<g class="tl-markers">');
        const sx0 = x(0);
        parts.push(`<path class="tl-shot is-past is-active tl-shot-0" d="M${(sx0 - 4.5).toFixed(1)} ${base - 0.5} L${sx0.toFixed(1)} ${base - 7.5} L${(sx0 + 4.5).toFixed(1)} ${base - 0.5} Z"/>`);
        for (const m of model.markers) {
          const px = x(m.t);
          if (m.id === 'injection') {
            parts.push(`<g class="tl-mk" data-id="injection"><circle class="tl-mk-ring" cx="${px.toFixed(1)}" cy="${base.toFixed(1)}" r="3.6"/></g>`);
            continue;
          }
          const py = y(levelAt(m.t));
          const text = narrow ? MARKER_SHORT[m.id] : m.chartLabel;
          const est = m.estimate && m.id === 'peak';
          const w = text.length * (narrow ? 5.9 : 6.3) + (est ? 26 : 0);
          let left = clamp(px - w / 2, 2, W - M.r - w);
          let lane = -1;
          for (let i = laneY.length - 1; i >= 0; i--) if (left >= laneEnd[i] + gap) { lane = i; break; }
          if (lane < 0) { lane = laneEnd[0] <= laneEnd[1] ? 0 : 1; left = Math.min(laneEnd[lane] + gap, W - M.r - w); }
          laneEnd[lane] = left + w;
          const ly = laneY[lane];
          const cx = left + w / 2;
          const stemTop = ly + 5;
          let stem = `M${px.toFixed(1)} ${(M.t - 2).toFixed(1)} L${px.toFixed(1)} ${(py - 6).toFixed(1)}`;
          if (Math.abs(cx - px) > 3) stem = `M${clamp(cx, left + 4, left + w - 4).toFixed(1)} ${stemTop} L${px.toFixed(1)} ${(M.t - 2).toFixed(1)} ` + stem.replace(/^M/, 'L');
          else stem = `M${px.toFixed(1)} ${stemTop} ` + stem.replace(/^M/, 'L');
          parts.push(`<g class="tl-mk" data-id="${m.id}">
            <path class="tl-mk-stem" d="${stem}"/>
            <circle class="tl-mk-ring" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.6"/>
            <text class="tl-mk-label" x="${left.toFixed(1)}" y="${ly}">${esc(text)}${est ? '<tspan class="tl-mk-est" dx="5">EST</tspan>' : ''}</text>
          </g>`);
        }
        parts.push('</g>');
      }

      // Playhead
      parts.push(`<g class="tl-head-g">
        <line class="tl-playline" x1="0" x2="0" y1="${M.t - 4}" y2="${base}"/>
        <path class="tl-playcap" d="M-4.5 ${M.t - 10} L4.5 ${M.t - 10} L0 ${M.t - 4} Z"/>
        <circle class="tl-halo" cx="0" cy="0" r="13"/>
        <circle class="tl-pdot" cx="0" cy="0" r="5.2"/>
      </g>`);
    } else {
      // Disabled ghost curve
      const ghost = [];
      for (let i = 0; i <= 120; i++) {
        const tt = (end * i) / 120;
        const v = 0.9 * (tt / 2.2) * Math.exp(1 - tt / 2.2) * Math.exp(-Math.max(0, tt - 2.2) / 14);
        ghost.push(`${i ? 'L' : 'M'}${x(tt).toFixed(1)} ${y(v).toFixed(1)}`);
      }
      parts.push(`<path class="tl-ghost" d="${ghost.join('')}"/>`);
    }
    svg.innerHTML = `<title id="${uid}-svgtitle"></title>${parts.join('')}`;
    geo.refs = {
      title: svg.querySelector('title'),
      clip: svg.querySelector('.tl-clip'),
      head: svg.querySelector('.tl-head-g'),
      dot: svg.querySelector('.tl-pdot'),
      halo: svg.querySelector('.tl-halo'),
      markers: [...svg.querySelectorAll('.tl-mk')],
      shots: [...svg.querySelectorAll('.tl-shot[data-shot]')],
    };
    updateTitle();
    lastPhaseKey = '';
    render();
  }

  function updateTitle() {
    const el = geo?.refs?.title || svgTitle;
    if (!el) return;
    if (!model) { el.textContent = `Level over time: ${DISABLED_MSG}.`; return; }
    if (mode === 'weekly') {
      el.textContent = `Chart: level in the body with a shot every ${model.tau} days, ${WEEKLY_SHOTS} shots over ${WEEKLY_END} days, as a percent of the peak after one shot. It builds up and steadies from about shot ${model.steadyN}, rising and falling between about ${pct(model.band.lo)}% and ${pct(model.band.hi)}%.`;
    } else {
      const [, on, pk, hl, cl] = model.markers;
      el.textContent = `Chart: level in the body after one shot, as a percent of its peak. Onset about ${fmtDayShort(on.t).toLowerCase()}, peak about ${fmtDayShort(pk.t).toLowerCase()}, half of the peak by ${fmtDayShort(hl.t).toLowerCase()}, mostly cleared by ${fmtDayShort(cl.t).toLowerCase()}.`;
    }
  }

  // ----- rail + detail ------------------------------------------------------
  function railStations() {
    if (!model) return [];
    if (mode === 'weekly') {
      return [
        { id: 'shot1', t: 0, label: 'First shot', estimate: false },
        { id: 'steady', t: (model.steadyN - 1) * model.tau, label: `Steady from shot ${model.steadyN}`, estimate: !model.steadyFromEntry },
        { id: 'last', t: (WEEKLY_SHOTS - 1) * model.tau, label: `Shot ${WEEKLY_SHOTS}`, estimate: false },
      ];
    }
    return model.markers.map((m) => ({ id: m.id, t: m.t, label: m.label, estimate: m.estimate }));
  }

  function buildRail() {
    const stations = railStations();
    rail.innerHTML = stations.map((s) => `
      <li><button type="button" class="tl-stop" data-id="${s.id}" data-t="${s.t}">
        <span class="tl-stop-dot" aria-hidden="true"></span>
        <span class="tl-stop-label">${esc(s.label)}</span>
        <span class="tl-stop-t">${s.estimate ? '≈ ' : ''}${esc(fmtDayShort(s.t))}</span>
      </button></li>`).join('');
    rail.hidden = !stations.length;
  }

  function detailFor(tt) {
    if (!model) return null;
    if (mode === 'weekly') {
      const modelLine = `Model: steady after about shot ${model.steadyNModel ?? model.steadyN}; the level then rises and falls between about ${pct(model.band.lo)}% and ${pct(model.band.hi)}% of the one-shot peak.`;
      return { key: 'weekly', label: 'Why levels build up', text: model.steadyText, sources: model.steadySources, estimate: !model.steadyFromEntry, modelLine };
    }
    const m = currentMarker(tt);
    const lines = {
      injection: null,
      onset: `Model: the level reaches half of its peak about ${fmtDayShort(riseTimeToFraction(0.5, model.params)).toLowerCase()} after the shot.`,
      peak: `Model: highest level about ${fmtDayShort(model.times.peak).toLowerCase()} after the shot.`,
      halfLife: `Model: the level is down to half of its peak by ${fmtDayShort(model.times.half).toLowerCase()}, a little more than one half-life after the peak, because the depot under the skin is still releasing drug.`,
      clearance: `Model: below 3% of the peak from ${fmtDayShort(model.times.clearance).toLowerCase()}, about five half-lives.`,
    };
    return { key: m.id, label: m.entryLabel, text: m.text, display: m.display, sources: m.sources, estimate: m.estimate, unverified: m.unverified, modelLine: lines[m.id] };
  }

  function renderDetail(tt) {
    const d = detailFor(tt);
    const key = `${mode}:${d?.key ?? 'none'}`;
    if (key === lastDetailKey) return;
    lastDetailKey = key;
    if (!d) { detail.innerHTML = ''; return; }
    detail.innerHTML = `
      <p class="tl-detail-head"><span class="tl-detail-label">${esc(d.label)}</span>${d.display ? `<span class="tl-detail-fig"><span class="tl-sr">Reported: </span>${esc(d.display)}</span>` : ''}${d.estimate ? '<span class="tl-chip tl-chip-est">Model estimate</span>' : ''}${d.unverified ? '<span class="tl-chip tl-chip-unv">Unverified</span>' : ''}</p>
      <p class="tl-detail-text">${esc(d.text)} ${citePlaceholder(d.sources)}</p>
      ${d.modelLine ? `<p class="tl-detail-model">${esc(d.modelLine)}</p>` : ''}`;
    fillCitations(detail);
  }

  // ----- per-frame render ---------------------------------------------------
  function render() {
    const end = tEnd();
    t = clamp(t, 0, end);
    const lv = levelAt(t);
    const st = stateAt(t, lv);
    if (geo?.refs?.head && model) {
      const px = geo.x(t);
      const py = geo.y(lv);
      geo.refs.clip.setAttribute('width', Math.max(0, px).toFixed(2));
      geo.refs.head.setAttribute('transform', `translate(${px.toFixed(2)} 0)`);
      geo.refs.dot.setAttribute('cy', py.toFixed(2));
      geo.refs.halo.setAttribute('cy', py.toFixed(2));
      const cur = currentMarker(t);
      for (const g of geo.refs.markers) {
        g.classList.toggle('is-active', g.dataset.id === cur?.id);
        g.classList.toggle('is-past', model.markers.find((m) => m.id === g.dataset.id).t <= t + 1e-9);
      }
      if (geo.refs.shots.length) {
        const { shot } = shotInfo(t);
        for (const s of geo.refs.shots) {
          const k = Number(s.dataset.shot);
          s.classList.toggle('is-past', k <= shot);
          s.classList.toggle('is-active', k === shot);
        }
      }
    }
    if (model) {
      dayEl.textContent = `Day ${f1(t)}`;
      pctEl.textContent = `${pct(lv)}%`;
      ofEl.textContent = mode === 'weekly' ? 'of one-shot peak' : 'of peak';
      stateLabelEl.textContent = st.label;
      estChip.hidden = !st.estimate;
      root.dataset.phase = st.id;
      if (!dragging) range.value = String(t);
      range.style.setProperty('--tl-f', (t / end).toFixed(4));
      const vt = `Day ${f1(t)}: ${st.label.charAt(0).toLowerCase()}${st.label.slice(1)}${st.estimate ? ' (model estimate)' : ''}. ${pct(lv)}% of the ${mode === 'weekly' ? 'one-shot ' : ''}peak.`;
      range.setAttribute('aria-valuetext', vt);
      // rail highlight: last station passed
      let active = null;
      for (const b of rail.querySelectorAll('.tl-stop')) if (t >= Number(b.dataset.t) - 1e-9) active = b;
      for (const b of rail.querySelectorAll('.tl-stop')) {
        const on = b === active;
        b.classList.toggle('is-active', on);
        if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      }
      renderDetail(t);
      if (playing) {
        const key = `${mode}:${st.id}:${st.label}`;
        if (key !== lastPhaseKey) { lastPhaseKey = key; announce(`Day ${Math.round(t)}: ${st.label}`); }
      } else {
        lastPhaseKey = `${mode}:${st.id}:${st.label}`;
      }
    }
    return { lv, st };
  }

  let announceTimer = 0;
  function announce(msg) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { live.textContent = msg; }, 250);
  }

  function emit(lv, st) {
    if (!model) return;
    const { shot, shots, since } = shotInfo(t);
    const detailObj = {
      tDays: t,
      level: lv,
      levelNorm: clamp(lv / model.max[mode], 0, 1),
      phaseId: st.id,
      phaseLabel: st.label,
      estimate: st.estimate,
      mode,
      shot,
      shots,
      sinceShotDays: since,
      intervalDays: model.tau,
      tEnd: tEnd(),
      peptideId: model.id,
    };
    try { bus.emit('time:change', detailObj); } catch (e) { console.warn('[timeline] time:change listener failed', e); }
  }

  // DOM updates happen immediately (so aria-valuetext is current when a screen
  // reader reads the key press); time:change is emitted at most once per frame.
  let emitTimer = 0;
  function cancelEmit() {
    if (frameRaf) { cancelAnimationFrame(frameRaf); frameRaf = 0; }
    if (emitTimer) { clearTimeout(emitTimer); emitTimer = 0; }
  }
  function flushEmit() {
    cancelEmit();
    if (disposed || !model) return;
    const lv = levelAt(t);
    emit(lv, stateAt(t, lv));
  }
  function schedule() {
    if (disposed) return;
    render();
    if (!model) return;
    if (!frameRaf) frameRaf = requestAnimationFrame(flushEmit);
    if (!emitTimer) emitTimer = setTimeout(flushEmit, 120); // rAF can stall (hidden tab, headless)
  }

  // ----- playback -----------------------------------------------------------
  function updatePlayBtn() {
    root.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-label', playing ? 'Pause timeline' : 'Play timeline');
    playBtn.title = playing ? 'Pause' : 'Play';
  }
  function setCue(on) {
    root.classList.toggle('is-cued', !!on);
    cue.hidden = !on;
    if (on && model) cueText.textContent = `Press play to follow the next ${Math.round(tEnd() / 7)} weeks, or drag the timeline.`;
  }
  function stations() {
    if (!model) return [];
    if (mode === 'weekly') {
      const out = [];
      for (let k = 0; k < WEEKLY_SHOTS; k++) out.push(k * model.tau + model.times.peak);
      out.push(WEEKLY_END);
      return out;
    }
    return [...model.markers.map((m) => m.t), tEnd()];
  }
  function tick(ts) {
    if (!playing) return;
    const dt = Math.min(0.1, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    t = Math.min(tEnd(), t + (dt * tEnd()) / PLAY_SECONDS[mode]);
    cancelEmit();
    const { lv, st } = render();
    emit(lv, st);
    if (t >= tEnd() - 1e-9) { pause(); return; }
    playRaf = requestAnimationFrame(tick);
  }
  function rmStep() {
    if (!playing) return;
    const next = stations().find((s) => s > t + 1e-6);
    if (next == null) { pause(); return; }
    t = next;
    schedule();
    if (t >= tEnd() - 1e-9) { pause(); return; }
    rmTimer = setTimeout(rmStep, RM_STEP_MS);
  }
  function play() {
    if (!model || playing || disposed) return;
    if (t >= tEnd() - 1e-6) t = 0;
    playing = true;
    setCue(false);
    updatePlayBtn();
    lastPhaseKey = '';
    if (rm) {
      // Reduced motion: jump from phase to phase, no continuous animation.
      rmStep();
    } else {
      lastTs = performance.now();
      playRaf = requestAnimationFrame(tick);
    }
  }
  function pause() {
    if (!playing) { updatePlayBtn(); return; }
    playing = false;
    cancelAnimationFrame(playRaf); playRaf = 0;
    clearTimeout(rmTimer); rmTimer = 0;
    updatePlayBtn();
  }

  // ----- public set/mode ----------------------------------------------------
  function set(tDays) {
    if (!model || !num(Number(tDays))) return;
    t = clamp(Number(tDays), 0, tEnd());
    schedule();
  }
  function setMode(m) {
    if (m !== 'single' && m !== 'weekly') return;
    if (m === mode && geo) return;
    mode = m;
    for (const r of radios) r.checked = r.value === mode;
    root.dataset.mode = mode;
    range.max = String(tEnd());
    t = clamp(t, 0, tEnd());
    legend.hidden = mode !== 'weekly' || !model;
    weeklyNote.hidden = mode !== 'weekly';
    lastDetailKey = '';
    buildRail();
    layout();
    schedule();
  }

  // ----- init / re-init -----------------------------------------------------
  function init(e) {
    pause();
    setCue(false);
    model = buildModel(e);
    t = 0;
    mode = mode === 'weekly' && model ? 'weekly' : 'single';
    root.dataset.mode = mode;
    root.classList.toggle('is-disabled', !model);
    emptyEl.hidden = !!model;
    for (const el of [playBtn, range, ...radios]) el.disabled = !model;
    for (const r of radios) r.checked = r.value === mode;
    range.max = String(tEnd());
    range.value = '0';
    legend.hidden = mode !== 'weekly' || !model;
    weeklyNote.hidden = mode !== 'weekly';
    lastDetailKey = '';
    range.style.setProperty('--tl-f', '0');
    if (!model) {
      dayEl.textContent = 'Day –';
      pctEl.textContent = '–';
      ofEl.textContent = 'of peak';
      stateLabelEl.textContent = 'Coming soon for this peptide';
      estChip.hidden = true;
      range.setAttribute('aria-valuetext', DISABLED_MSG);
      detail.innerHTML = '';
      root.dataset.phase = 'none';
    }
    buildRail();
    layout();
    updatePlayBtn();
    if (model) schedule();
  }

  // ----- events -------------------------------------------------------------
  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  range.addEventListener('input', () => {
    pause(); setCue(false);
    t = clamp(Number(range.value), 0, tEnd());
    schedule();
  });
  range.addEventListener('pointerdown', () => { dragging = true; });
  for (const type of ['pointerup', 'pointercancel', 'change', 'blur']) range.addEventListener(type, () => { dragging = false; });
  range.addEventListener('keydown', (ev) => {
    if (!model) return;
    const q = (v) => Math.round(v / KEY_STEP) * KEY_STEP;
    let next = null;
    switch (ev.key) {
      case 'ArrowRight': case 'ArrowUp': next = q(t) + KEY_STEP; break;
      case 'ArrowLeft': case 'ArrowDown': next = q(t) - KEY_STEP; break;
      case 'PageUp': next = q(t) + PAGE_STEP; break;
      case 'PageDown': next = q(t) - PAGE_STEP; break;
      case 'Home': next = 0; break;
      case 'End': next = tEnd(); break;
      default: return;
    }
    ev.preventDefault();
    pause(); setCue(false);
    t = clamp(next, 0, tEnd());
    range.value = String(t);
    schedule();
  });
  for (const r of radios) r.addEventListener('change', () => { if (r.checked) { pause(); setCue(false); setMode(r.value); } });
  rail.addEventListener('click', (ev) => {
    const b = ev.target.closest('.tl-stop');
    if (!b || !model) return;
    pause(); setCue(false);
    t = clamp(Number(b.dataset.t), 0, tEnd());
    schedule();
  });

  // Pointer scrubbing directly on the chart (touch-action: pan-y keeps vertical page scroll).
  const scrubFromEvent = (ev) => {
    if (!geo) return;
    const r = svg.getBoundingClientRect();
    const sx = (ev.clientX - r.left) * (geo.W / r.width);
    t = clamp(((sx - geo.M.l) / geo.pw) * geo.end, 0, geo.end);
    schedule();
  };
  let chartPointer = null;
  svg.addEventListener('pointerdown', (ev) => {
    if (!model || ev.button !== 0) return;
    chartPointer = ev.pointerId;
    try { svg.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
    pause(); setCue(false);
    root.classList.add('is-scrubbing');
    scrubFromEvent(ev);
  });
  svg.addEventListener('pointermove', (ev) => { if (chartPointer === ev.pointerId) scrubFromEvent(ev); });
  const endScrub = (ev) => { if (chartPointer === ev.pointerId) { chartPointer = null; root.classList.remove('is-scrubbing'); } };
  svg.addEventListener('pointerup', endScrub);
  svg.addEventListener('pointercancel', endScrub);

  let ro = null;
  let lastW = 0;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => {
      const w = Math.round(chartWrap.clientWidth);
      if (w && w !== lastW) { lastW = w; layout(); }
    });
    ro.observe(chartWrap);
  }

  const safeOn = (type, fn) => { try { const off = bus.on(type, fn); if (typeof off === 'function') offs.push(off); } catch (e) { console.warn('[timeline] bus.on failed', e); } };
  safeOn('sequence:start', () => pause());
  safeOn('sequence:done', () => {
    if (!model) return;
    pause();
    t = 0;
    schedule();
    setCue(true);
  });
  safeOn('peptide:loaded', (d) => init(d?.entry ?? null));
  safeOn('motion:change', (d) => {
    const next = !!d?.reducedMotion;
    if (next === rm) return;
    const wasPlaying = playing;
    pause();
    rm = next;
    root.classList.toggle('tl-rm', rm);
    if (wasPlaying) play(); // continue in the new style (phase jumps or continuous)
  });

  init(entry ?? null);
  lastW = Math.round(chartWrap.clientWidth);

  return {
    set,
    play,
    pause,
    setMode,
    get tDays() { return t; },
    get mode() { return mode; },
    get playing() { return playing; },
    dispose() {
      if (disposed) return;
      pause();
      disposed = true;
      cancelEmit();
      clearTimeout(announceTimer);
      ro?.disconnect();
      for (const off of offs.splice(0)) { try { off(); } catch { /* ignore */ } }
      root.remove();
      host.classList.remove('tl-host');
    },
  };
}
