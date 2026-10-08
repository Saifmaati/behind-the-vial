// PeptideScope: the time-since-injection scrubber and plain-text timeline.
//
// NO GRAPHS (owner, 2026-10-08). There is no level chart, no axis and no "% of peak" readout:
// timing shows through the body animation itself (the 3D scene and the side-effect list follow
// `time:change`) and through plain text here:
//   - play / pause and one native range input, "Time since injection";
//   - a large readout of the time in words ("6 hours after the shot", "Day 3", "Week 4") and the
//     phase name ("Peak", "Half gone" …);
//   - a milestone row, Starts working · Peak · Half gone · Mostly cleared, whose terms, reported
//     figures and texts come from entry.pk.phases; each one is a button that jumps the scrubber;
//   - the cited text of the current milestone, and the caption.
// The only control is TIME. Nothing here is, or can become, a dose or an amount.
//
// Public API (docs/ARCHITECTURE.md):
//   mountTimeline(host, entry, { reducedMotion }) →
//     { set(tDays), play(), pause(), setMode('single'|'weekly'), dispose(), tDays, mode, playing }
// Emits   time:change { tDays, level, phaseId, phaseLabel, mode, levelNorm, estimate, shot, shots,
//                       sinceShotDays, intervalDays, tEnd, peptideId } (rAF-throttled)
// Listens sequence:start (pause), sequence:done (t = 0, cue Play), peptide:loaded (re-init),
//         motion:change (reduced motion on/off)

import { bus } from './bus.js';
import { paramsFromPk, phaseTimes, singleDose, riseTimeToFraction } from './pk.js';

const VIEW_END = 42;          // days shown after one shot; stretched in whole weeks if "mostly cleared" falls later
const KEY_STEP = 0.25;        // arrow keys: a quarter of a day
const PAGE_STEP = 1;          // Page Up / Page Down: one day
const POS_MAX = 1000;         // range positions; time = end × (position / POS_MAX)²
const PLAY_SECONDS = 16;      // one pass of the whole view
const RM_STEP_MS = 1700;      // reduced motion: pause on each milestone
const PEAK_BAND = 0.9;        // the readout says "Peak" while the level is within 90 % of its peak
const CAPTION = 'Timing from published studies. Real timing differs from person to person. Not a dosing tool.';
const DISABLED_MSG = 'Timeline arrives with the full entry';

// Plain-language milestone names. The entry's own term (pk.phases[].label, e.g. "Half-life") is
// shown next to the name when it differs; the reported figure (pk.phases[].display) and the text
// (pk.phases[].text, cited) always come from the entry.
const MILESTONES = [
  { id: 'onset', name: 'Starts working' },
  { id: 'peak', name: 'Peak' },
  { id: 'halfLife', name: 'Half gone' },
  { id: 'clearance', name: 'Mostly cleared' },
];
// Phase states (readout, aria-valuetext, time:change.phaseId) and the milestone each one highlights.
const STATE_LABELS = {
  injection: 'Under the skin',
  onset: 'Starts working',
  peak: 'Peak',
  falling: 'Past the peak',
  halfLife: 'Half gone',
  clearance: 'Mostly cleared',
};
const STATE_MILESTONE = { injection: null, onset: 'onset', peak: 'peak', falling: 'peak', halfLife: 'halfLife', clearance: 'clearance' };

let uidCounter = 0;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** Time since the shot in words: { main, sub }. "The shot", "6 hours" + "after the shot", "Day 3", "Week 4". */
export function timeWords(tDays) {
  const tt = Math.max(0, Number(tDays) || 0);
  if (tt < 1e-6) return { main: 'The shot', sub: '' };
  if (tt < 1 / 24) return { main: 'Minutes', sub: 'after the shot' };
  if (tt < 1) {
    const h = Math.floor(tt * 24 + 1e-6);
    return { main: `${h} hour${h === 1 ? '' : 's'}`, sub: 'after the shot' };
  }
  if (tt < 14) return { main: `Day ${Math.floor(tt + 1e-6)}`, sub: '' };
  return { main: `Week ${Math.floor(tt / 7 + 1e-6)}`, sub: '' };
}
const wordsText = (w) => (w.sub ? `${w.main} ${w.sub}` : w.main);

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
    try { const out = page(ids); const s = out == null ? '' : String(out); if (s.trim()) return s; } catch { /* fall through */ }
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

/** Render citations into every [data-cite="id id …"] slot under root. */
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
/** An empty citation slot that fillCitations() fills in. */
export const citeSlot = (ids) => (Array.isArray(ids) && ids.length ? `<span class="tl-cites" data-cite="${esc(ids.join(' '))}"></span>` : '');
/** Older name of citeSlot(), still imported by js/effects.js. */
export const citePlaceholder = citeSlot;

// ---------------------------------------------------------------------------

function buildModel(entry) {
  const pk = entry?.pk;
  if (!pk) return null;
  let params;
  try {
    params = paramsFromPk(pk, { doses: 1 });
  } catch (e) {
    console.warn('[timeline] pk data unusable:', e.message);
    return null;
  }
  const times = phaseTimes(params);
  const list = Array.isArray(pk.phases) ? pk.phases.filter((p) => p && p.id) : [];
  const byId = Object.fromEntries(list.map((p) => [p.id, p]));
  // Where each milestone sits: the entry's own tDays first (they are model fields kept in the data),
  // else the model. Onset is not a blood-level property, so without data it falls back to the
  // model's half-way point on the way up and is flagged as an estimate.
  const fromModel = {
    onset: riseTimeToFraction(0.5, params),
    peak: times.peak,
    halfLife: times.half,
    clearance: times.clearance,
  };
  const miles = MILESTONES.map(({ id, name }) => {
    const ph = byId[id] || {};
    const hasT = num(ph.tDays) && ph.tDays >= 0;
    const term = str(ph.label);
    return {
      id,
      name,
      term: term && term.toLowerCase() !== name.toLowerCase() ? term : '',
      t: hasT ? ph.tDays : fromModel[id],
      display: str(ph.display),
      text: str(ph.text),
      sources: Array.isArray(ph.sources) ? ph.sources : [],
      estimate: !!ph.estimate || (id === 'peak' && !!pk.tmaxEstimate) || !hasT,
      unverified: !!ph.unverified,
    };
  }).sort((a, b) => a.t - b.t);
  // Before "starts working", the text is the entry's cited "depot" absorption step.
  const depot = (entry.absorption?.steps || []).find((st) => st && st.id === 'depot');
  const start = depot && str(depot.text)
    ? { id: 'injection', name: str(depot.title) || STATE_LABELS.injection, text: str(depot.text), sources: depot.sources || [], unverified: !!depot.unverified }
    : null;
  const steady = byId.steadyState || byId.steady || null;
  const weekly = steady && str(steady.text)
    ? { label: str(steady.label) || 'With weekly shots', display: str(steady.display), text: str(steady.text), sources: steady.sources || [], estimate: !!steady.estimate, unverified: !!steady.unverified }
    : null;
  const clearT = miles.find((m) => m.id === 'clearance')?.t ?? times.clearance;
  const end = Math.max(VIEW_END, Math.ceil((clearT + 3) / 7) * 7);
  return { id: entry.id, name: entry.name, params, times, miles, start, weekly, end, tau: params.intervalDays };
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
  let view = 'single';         // 'weekly' only swaps in the "with weekly shots" text
  let t = 0;
  let playing = false;
  let playRaf = 0, frameRaf = 0, rmTimer = 0, lastTs = 0;
  let lastPhaseKey = '';
  let lastDetailKey = '';
  let dragging = false;
  let disposed = false;

  const root = document.createElement('div');
  root.className = 'tl tl-text';
  root.innerHTML = `
    <div class="tl-head">
      <div class="tl-lead">
        <button type="button" class="tl-play" aria-label="Play timeline">
          <svg class="tl-ico tl-ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a.6.6 0 0 0 .9.5l10.2-6.5a.6.6 0 0 0 0-1L8.9 5a.6.6 0 0 0-.9.5z"/></svg>
          <svg class="tl-ico tl-ico-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>
        </button>
        <div class="tl-readout" aria-hidden="true">
          <p class="tl-eyebrow">After one shot</p>
          <p class="tl-time"><span class="tl-time-main"></span><span class="tl-time-sub" hidden></span></p>
          <p class="tl-state"><span class="tl-state-dot" aria-hidden="true"></span><span class="tl-state-label"></span><span class="tl-chip tl-chip-est" hidden>Estimate</span></p>
        </div>
      </div>
      <div class="tl-track">
        <div class="tl-scrub">
          <div class="tl-groove" aria-hidden="true"><span class="tl-groove-fill"></span><span class="tl-pins"></span></div>
          <input class="tl-range" id="${uid}-range" type="range" min="0" max="${POS_MAX}" step="any" value="0" aria-describedby="${uid}-keys">
        </div>
        <div class="tl-scrub-foot">
          <span class="tl-end tl-end-start" aria-hidden="true">The shot</span>
          <label class="tl-range-label" for="${uid}-range">Time since injection</label>
          <span class="tl-end tl-end-stop" aria-hidden="true"></span>
        </div>
        <p class="tl-keys" id="${uid}-keys">Arrow keys: ¼ day · Page Up/Down: 1 day</p>
      </div>
    </div>
    <p class="tl-cue" hidden><span class="tl-cue-dot" aria-hidden="true"></span><span class="tl-cue-text"></span></p>
    <ol class="tl-miles" aria-label="Milestones after one shot"></ol>
    <div class="tl-detail"></div>
    <details class="tl-weekly" hidden><summary class="tl-weekly-sum"></summary><p class="tl-weekly-text"></p></details>
    <p class="tl-caption">${esc(CAPTION)}</p>
    <p class="tl-sr" aria-live="polite" aria-atomic="true"></p>`;
  host.replaceChildren(root);
  host.classList.add('tl-host');

  const $ = (s) => root.querySelector(s);
  const playBtn = $('.tl-play');
  const range = $('.tl-range');
  const scrub = $('.tl-scrub');
  const pinsEl = $('.tl-pins');
  const endStop = $('.tl-end-stop');
  const timeMain = $('.tl-time-main');
  const timeSub = $('.tl-time-sub');
  const stateLabelEl = $('.tl-state-label');
  const estChip = $('.tl-readout .tl-chip-est');
  const miles = $('.tl-miles');
  const detail = $('.tl-detail');
  const weeklyEl = $('.tl-weekly');
  const weeklySum = $('.tl-weekly-sum');
  const weeklyText = $('.tl-weekly-text');
  const cue = $('.tl-cue');
  const cueText = $('.tl-cue-text');
  const live = root.querySelector('p.tl-sr[aria-live]');
  if (rm) root.classList.add('tl-rm');

  // ----- model helpers -----------------------------------------------------
  const tEnd = () => (model ? model.end : VIEW_END);
  // The scrubber is not linear in time: position² ∝ time, so the first hours and days (onset,
  // peak) get room on the track and in playback, and the slow weeks of clearance move faster.
  const posFromT = (tt) => Math.sqrt(clamp(tt / tEnd(), 0, 1)) * POS_MAX;
  const tFromPos = (p) => tEnd() * (clamp(Number(p) || 0, 0, POS_MAX) / POS_MAX) ** 2;
  const levelAt = (tt) => (model ? singleDose(tt, model.params) : 0);
  const mile = (id) => model?.miles.find((m) => m.id === id) || null;

  function stateAt(tt, lv) {
    if (!model) return { id: 'none', label: '', estimate: false };
    const onset = mile('onset'), peak = mile('peak'), half = mile('halfLife'), clear = mile('clearance');
    let id;
    if (tt < onset.t && tt < peak.t) id = 'injection';
    else if (lv >= PEAK_BAND) id = 'peak';
    else if (tt < peak.t) id = 'onset';
    else if (tt < half.t) id = 'falling';
    else if (tt < clear.t) id = 'halfLife';
    else id = 'clearance';
    const m = mile(STATE_MILESTONE[id]);
    const estimate = id !== 'falling' && !!m?.estimate;
    return { id, label: STATE_LABELS[id], estimate };
  }
  const valueText = (tt, st) => `${wordsText(timeWords(tt))}: ${lowerFirst(st.label)}${st.estimate ? ' (estimate)' : ''}`;

  // ----- static parts (per entry) --------------------------------------------
  function buildMiles() {
    if (!model) { miles.innerHTML = ''; pinsEl.innerHTML = ''; miles.hidden = true; return; }
    miles.hidden = false;
    miles.innerHTML = model.miles.map((m) => {
      const aria = `${m.name}${m.term ? `, ${m.term}` : ''}${m.display ? `: ${m.display}` : ''}${m.estimate ? ' (estimate)' : ''}. Move the timeline here.`;
      return `
      <li class="tl-mile-item"><button type="button" class="tl-mile" data-id="${m.id}" data-t="${m.t}" aria-label="${esc(aria)}">
        <span class="tl-mile-dot" aria-hidden="true"></span>
        <span class="tl-mile-name">${esc(m.name)}</span>
        ${m.term || m.display ? `<span class="tl-mile-meta">${m.term ? `<span class="tl-mile-term">${esc(m.term)}</span>` : ''}${m.display ? `<span class="tl-mile-fig">${esc(m.display)}</span>` : ''}</span>` : ''}
        ${m.estimate ? '<span class="tl-chip tl-chip-est">Estimate</span>' : ''}
      </button></li>`;
    }).join('');
    pinsEl.innerHTML = model.miles.map((m) => `<span class="tl-pin" data-id="${m.id}" style="--p:${(posFromT(m.t) / POS_MAX).toFixed(4)}"></span>`).join('');
  }

  function buildWeekly() {
    const w = model?.weekly;
    weeklyEl.hidden = !w;
    if (!w) { weeklySum.innerHTML = ''; weeklyText.innerHTML = ''; weeklyEl.open = false; return; }
    weeklySum.innerHTML = `<span class="tl-weekly-label">${esc(w.label)}</span>${w.display ? `<span class="tl-detail-fig"><span class="tl-sr">Reported: </span>${esc(w.display)}</span>` : ''}${w.estimate ? '<span class="tl-chip tl-chip-est">Estimate</span>' : ''}${w.unverified ? '<span class="tl-chip tl-chip-unv">Unverified</span>' : ''}`;
    weeklyText.innerHTML = `${esc(w.text)} ${citeSlot(w.sources)}`;
    weeklyEl.open = view === 'weekly';
    fillCitations(weeklyText);
  }

  // ----- detail (text of the current milestone) ----------------------------
  function renderDetail(st) {
    const mid = STATE_MILESTONE[st.id];
    const d = mid ? mile(mid) : model?.start;
    const key = d ? d.id : 'none';
    if (key === lastDetailKey) return;
    lastDetailKey = key;
    if (!d) { detail.innerHTML = ''; return; }
    detail.innerHTML = `
      <p class="tl-detail-head"><span class="tl-detail-label">${esc(d.name)}</span>${d.term ? `<span class="tl-detail-term">${esc(d.term)}</span>` : ''}${d.display ? `<span class="tl-detail-fig"><span class="tl-sr">Reported: </span>${esc(d.display)}</span>` : ''}${d.estimate ? '<span class="tl-chip tl-chip-est">Estimate</span>' : ''}${d.unverified ? '<span class="tl-chip tl-chip-unv">Unverified</span>' : ''}</p>
      ${d.text ? `<p class="tl-detail-text">${esc(d.text)} ${citeSlot(d.sources)}</p>` : ''}`;
    fillCitations(detail);
  }

  // ----- per-frame render ---------------------------------------------------
  function render() {
    const end = tEnd();
    t = clamp(t, 0, end);
    const lv = levelAt(t);
    const st = stateAt(t, lv);
    if (model) {
      const w = timeWords(t);
      timeMain.textContent = w.main;
      timeSub.textContent = w.sub;
      timeSub.hidden = !w.sub;
      stateLabelEl.textContent = st.label;
      estChip.hidden = !st.estimate;
      root.dataset.phase = st.id;
      const p = posFromT(t);
      if (!dragging) range.value = String(p);
      scrub.style.setProperty('--tl-f', (p / POS_MAX).toFixed(4));
      range.setAttribute('aria-valuetext', valueText(t, st));
      const cur = STATE_MILESTONE[st.id];
      for (const b of miles.querySelectorAll('.tl-mile')) {
        const on = b.dataset.id === cur;
        b.classList.toggle('is-active', on);
        b.classList.toggle('is-past', t >= Number(b.dataset.t) - 1e-9);
        if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      }
      for (const pin of pinsEl.children) {
        pin.classList.toggle('is-active', pin.dataset.id === cur);
        pin.classList.toggle('is-past', t >= (mile(pin.dataset.id)?.t ?? Infinity) - 1e-9);
      }
      renderDetail(st);
      const key = `${st.id}:${st.label}`;
      if (playing) {
        if (key !== lastPhaseKey) { lastPhaseKey = key; announce(`${wordsText(timeWords(t))}: ${st.label}`); }
      } else {
        lastPhaseKey = key;
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
    const detailObj = {
      tDays: t,
      level: lv,
      levelNorm: clamp(lv, 0, 1),
      phaseId: st.id,
      phaseLabel: st.label,
      estimate: st.estimate,
      mode: 'single', // the one time model; setMode('weekly') only changes the explanatory text
      shot: 1,
      shots: 1,
      sinceShotDays: t,
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
  const stations = () => (model ? [...model.miles.map((m) => m.t), tEnd()] : []);
  function tick(ts) {
    if (!playing) return;
    const dt = Math.min(0.1, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    // advance along the track (not in days), so the first hours play slowly and the weeks quickly
    const p = Math.min(POS_MAX, posFromT(t) + (dt * POS_MAX) / PLAY_SECONDS);
    t = p >= POS_MAX ? tEnd() : tFromPos(p);
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
      // Reduced motion: jump from milestone to milestone, no continuous animation.
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
  // No graphs: there is one time model (one shot). 'weekly' opens the cited "with weekly shots"
  // text; the scrubber, the readout and time:change stay on the one-shot timeline.
  function setMode(m) {
    if (m !== 'single' && m !== 'weekly') return;
    view = m;
    root.dataset.view = view;
    if (model?.weekly) weeklyEl.open = view === 'weekly';
  }

  // ----- init / re-init -----------------------------------------------------
  function init(e) {
    pause();
    setCue(false);
    model = buildModel(e);
    t = 0;
    root.classList.toggle('is-disabled', !model);
    for (const el of [playBtn, range]) el.disabled = !model;
    range.value = '0';
    scrub.style.setProperty('--tl-f', '0');
    lastDetailKey = '';
    endStop.textContent = `Week ${Math.round(tEnd() / 7)}`;
    if (!model) {
      timeMain.textContent = 'Coming soon';
      timeSub.hidden = true;
      stateLabelEl.textContent = DISABLED_MSG;
      estChip.hidden = true;
      range.setAttribute('aria-valuetext', DISABLED_MSG);
      detail.innerHTML = '';
      root.dataset.phase = 'none';
    }
    buildMiles();
    buildWeekly();
    updatePlayBtn();
    if (model) schedule();
  }

  // ----- events -------------------------------------------------------------
  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  range.addEventListener('input', () => {
    pause(); setCue(false);
    t = tFromPos(range.value);
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
    range.value = String(posFromT(t));
    schedule();
  });
  miles.addEventListener('click', (ev) => {
    const b = ev.target.closest('.tl-mile');
    if (!b || !model) return;
    pause(); setCue(false);
    t = clamp(Number(b.dataset.t), 0, tEnd());
    schedule();
  });
  weeklyEl.addEventListener('toggle', () => {
    view = weeklyEl.open ? 'weekly' : 'single';
    root.dataset.view = view;
  });

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
    if (wasPlaying) play(); // continue in the new style (milestone jumps or continuous)
  });

  root.dataset.view = view;
  init(entry ?? null);

  return {
    set,
    play,
    pause,
    setMode,
    get tDays() { return t; },
    get mode() { return view; },
    get playing() { return playing; },
    dispose() {
      if (disposed) return;
      pause();
      disposed = true;
      cancelEmit();
      clearTimeout(announceTimer);
      for (const off of offs.splice(0)) { try { off(); } catch { /* ignore */ } }
      root.remove();
      host.classList.remove('tl-host');
    },
  };
}
