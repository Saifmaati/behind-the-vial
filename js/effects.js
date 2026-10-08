// Behind the Vial: timeline time → side effects active at that moment.
//
// Listens to time:change from js/timeline.js, works out which of the entry's
// side effects are typically present at that point, renders compact cards
// (name, organ, how often, severity, "why it happens", "how to reduce it or
// when it passes", citations) and tells the 3D body which organs to light up.
//
// Public API (docs/ARCHITECTURE.md):
//   mountEffects(host, entry) → { dispose() }
// Listens time:change, peptide:loaded (swap entry)
// Emits   effects:active { ids, items: [{ id, organ, severity, name }] } (only when the set changes)
//         organ:focus { organ } ("Show on body" button)
//
// Timing rule. Each side effect has timing { fromDays, toDays } on the ONE-SHOT
// timeline. One-shot view: active when fromDays ≤ t ≤ toDays.
// Weekly view: effects whose whole window fits inside one dosing interval
// (toDays ≤ intervalDays) follow the clock of the MOST RECENT shot, so they can
// come back after every shot. Effects tied to repeated exposure, meaning the
// window reaches past one interval (toDays > intervalDays) or the data marks it
// `timing.cumulative: true`, follow the clock of the FIRST shot: active from
// fromDays after the first shot until toDays after the most recent shot.

import { bus } from './bus.js';
import { fillCitations, citePlaceholder } from './timeline.js';

const SEVERITY = {
  serious: { rank: 0, label: 'Serious' },
  notable: { rank: 1, label: 'Notable' },
  common: { rank: 2, label: 'Common' },
};
const ORGAN_LABELS = {
  brain: 'Brain', thyroid: 'Thyroid', heart: 'Heart', lungs: 'Lungs', liver: 'Liver', gallbladder: 'Gallbladder',
  stomach: 'Stomach', pancreas: 'Pancreas', spleen: 'Spleen', small_intestine: 'Small intestine',
  large_intestine: 'Large intestine', kidneys: 'Kidneys', bladder: 'Bladder', skin: 'Skin', fat: 'Body fat',
  injection_site: 'Injection site', muscle: 'Muscle', eyes: 'Eyes', blood: 'Blood',
};
const ANNOUNCE_DEBOUNCE_MS = 900;
const VISIBLE_LIMIT = 4; // more than this → "Show N more" (most serious first, so the rest are milder)
const LEAVE_MS = 220;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const organLabel = (id) => ORGAN_LABELS[id] || String(id || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const listJoin = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);

/**
 * Pure: ids of side effects active at a timeline state.
 * state = { tDays, mode, sinceShotDays, shot, intervalDays }
 */
export function activeEffectIds(sideEffects, state) {
  if (!Array.isArray(sideEffects) || !state || !num(state.tDays)) return [];
  const t = state.tDays;
  const weekly = state.mode === 'weekly';
  const tau = num(state.intervalDays) && state.intervalDays > 0 ? state.intervalDays : 7;
  const since = num(state.sinceShotDays) ? state.sinceShotDays : (weekly ? t % tau : t);
  const lastShotT = t - since;
  const out = [];
  for (const fx of sideEffects) {
    if (!fx || !fx.id || !fx.timing) continue;
    const from = num(fx.timing.fromDays) ? fx.timing.fromDays : 0;
    const to = num(fx.timing.toDays) ? fx.timing.toDays : Infinity;
    let on;
    if (!weekly) on = t >= from && t <= to;
    else if (fx.timing.cumulative || to > tau) on = t >= from && t <= lastShotT + to;
    else on = since >= from && since <= to;
    if (on) out.push(fx.id);
  }
  return out;
}

export function mountEffects(host, entry) {
  if (!host) throw new TypeError('mountEffects: host element required');
  const offs = [];
  const cards = new Map(); // id → li
  let list = [];
  let byId = new Map();
  let activeKey = '';
  let lastState = null;
  let announced = new Set();
  let announceTimer = 0;
  let disposed = false;
  // html[data-motion] (main.js) wins over the OS setting; `motion:change` switches it live.
  const motionAttr = typeof document !== 'undefined' ? document.documentElement.dataset.motion : undefined;
  let rm = motionAttr === 'reduce' ? true : motionAttr === 'full' ? false
    : (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // The host may carry aria-live="polite" (DOM contract). We announce a short,
  // debounced summary ourselves instead, so card markup is not read out on every change.
  const prevLive = host.getAttribute('aria-live');
  host.setAttribute('aria-live', 'off');

  const root = document.createElement('div');
  root.className = 'fx';
  root.innerHTML = `
    <div class="fx-head">
      <p class="fx-eyebrow">Side effects at this point</p>
      <p class="fx-when" aria-hidden="true"></p>
      <p class="fx-count" aria-hidden="true"></p>
    </div>
    <ul class="fx-list" id="fx-list-${Math.random().toString(36).slice(2, 8)}" tabindex="-1" aria-label="Side effects typical at this point on the timeline"></ul>
    <button type="button" class="fx-toggle" aria-expanded="false" hidden></button>
    <p class="fx-empty"></p>
    <p class="fx-note">Timing windows are typical patterns from studies, not predictions for any one person. Side effects can show up at other times too.</p>
    <p class="fx-sr" aria-live="polite" aria-atomic="true"></p>`;
  host.replaceChildren(root);
  host.classList.add('fx-host');
  const listEl = root.querySelector('.fx-list');
  const emptyEl = root.querySelector('.fx-empty');
  const whenEl = root.querySelector('.fx-when');
  const countEl = root.querySelector('.fx-count');
  const toggleEl = root.querySelector('.fx-toggle');
  toggleEl.setAttribute('aria-controls', listEl.id);
  let expanded = false;
  const live = root.querySelector('.fx-sr');
  if (rm) root.classList.add('fx-rm');

  function setEntry(e) {
    list = Array.isArray(e?.sideEffects) ? e.sideEffects.filter((x) => x && x.id) : [];
    byId = new Map(list.map((x) => [x.id, x]));
    for (const li of cards.values()) li.remove();
    cards.clear();
    activeKey = '';
    expanded = false;
    toggleEl.hidden = true;
    announced = new Set();
    clearTimeout(announceTimer);
    live.textContent = '';
    root.classList.toggle('is-disabled', !e);
    if (!e) {
      whenEl.textContent = '';
      countEl.textContent = '';
      emptyEl.hidden = false;
      emptyEl.textContent = 'Side effects arrive with the full entry.';
      emitActive([]);
      return;
    }
    update(lastState && lastState.peptideId === e.id ? lastState : { tDays: 0, mode: 'single' });
  }

  function cardHtml(fx) {
    const sev = SEVERITY[fx.severity] ? fx.severity : 'common';
    const freq = fx.frequency || {};
    const why = fx.why || {};
    const reduce = fx.reduce || {};
    const also = Array.isArray(fx.alsoOrgans) && fx.alsoOrgans.length ? ` <span class="fx-also">+ ${esc(fx.alsoOrgans.map(organLabel).join(', '))}</span>` : '';
    const timing = fx.timing?.text ? `<p class="fx-row fx-timing"><span class="fx-k">When</span><span class="fx-v">${esc(fx.timing.text)}</span></p>` : '';
    return `
      <div class="fx-card-top">
        <span class="fx-sev fx-sev-${sev}">${SEVERITY[sev].label}</span>
        <span class="fx-organ"><span class="fx-organ-dot" aria-hidden="true"></span>${esc(organLabel(fx.organ))}${also}</span>
        ${fx.organ ? `<button type="button" class="fx-locate" data-organ="${esc(fx.organ)}" title="Show on the body"><span aria-hidden="true" class="fx-locate-ico"></span><span aria-hidden="true">Show</span><span class="fx-sr">Show ${esc(organLabel(fx.organ).toLowerCase())} on the body (${esc(fx.name)})</span></button>` : ''}
      </div>
      <h3 class="fx-name">${esc(fx.name)}</h3>
      ${freq.text ? `<p class="fx-row fx-freq"><span class="fx-k">How often</span><span class="fx-v">${esc(freq.text)}${freq.unverified ? ' <span class="tl-chip tl-chip-unv">Unverified</span>' : ''} ${citePlaceholder(freq.sources)}</span></p>` : ''}
      ${timing}
      ${why.text ? `<details class="fx-more"><summary>Why it happens</summary><p>${esc(why.text)} ${citePlaceholder(why.sources)}</p></details>` : ''}
      ${reduce.text ? `<details class="fx-more"><summary>How to reduce it or when it passes</summary><p>${esc(reduce.text)} ${citePlaceholder(reduce.sources)}</p></details>` : ''}`;
  }

  function ordered(ids) {
    return ids
      .map((id) => byId.get(id))
      .sort((a, b) => (SEVERITY[a.severity]?.rank ?? 3) - (SEVERITY[b.severity]?.rank ?? 3) || (a.timing?.fromDays ?? 0) - (b.timing?.fromDays ?? 0));
  }

  function emitActive(items) {
    try {
      bus.emit('effects:active', {
        ids: items.map((x) => x.id),
        items: items.map((x) => ({ id: x.id, organ: x.organ, severity: x.severity, name: x.name, alsoOrgans: x.alsoOrgans || [] })),
      });
    } catch (e) { console.warn('[effects] effects:active listener failed', e); }
  }

  function scheduleAnnounce(items) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const now = new Set(items.map((x) => x.id));
      const added = items.filter((x) => !announced.has(x.id)).map((x) => x.name);
      const gone = [...announced].filter((id) => !now.has(id)).map((id) => byId.get(id)?.name).filter(Boolean);
      announced = now;
      const parts = [];
      if (added.length) parts.push(`Side effects now possible: ${listJoin(added)}.`);
      if (gone.length) parts.push(`No longer typical: ${listJoin(gone)}.`);
      if (parts.length) live.textContent = parts.join(' ');
    }, ANNOUNCE_DEBOUNCE_MS);
  }

  function update(state) {
    if (disposed) return;
    lastState = state;
    if (!list.length && !byId.size) {
      emptyEl.hidden = false;
      if (!root.classList.contains('is-disabled')) emptyEl.textContent = 'No side-effect timing data for this entry yet.';
      return;
    }
    const weekly = state.mode === 'weekly';
    whenEl.textContent = weekly && num(state.sinceShotDays)
      ? `Day ${f1(state.tDays)} · ${f1(state.sinceShotDays)} days after shot ${state.shot ?? ''}`.replace(/ +$/, '')
      : `Day ${f1(state.tDays ?? 0)} after the shot`;
    const items = ordered(activeEffectIds(list, state));
    const key = items.map((x) => x.id).join('|');
    if (key === activeKey) return;
    activeKey = key;

    const keep = new Set(items.map((x) => x.id));
    // Leaving cards: keep focus somewhere sensible, then fade out.
    for (const [id, li] of cards) {
      if (keep.has(id)) continue;
      cards.delete(id);
      if (li.contains(document.activeElement)) listEl.focus({ preventScroll: true });
      if (rm) li.remove();
      else { li.classList.add('is-leaving'); li.inert = true; setTimeout(() => li.remove(), LEAVE_MS); }
    }
    // Entering / staying cards, in order.
    let prev = null;
    for (const fx of items) {
      let li = cards.get(fx.id);
      if (!li) {
        li = document.createElement('li');
        li.className = `fx-card fx-card-${SEVERITY[fx.severity] ? fx.severity : 'common'}`;
        li.dataset.id = fx.id;
        li.dataset.organ = fx.organ || '';
        li.innerHTML = cardHtml(fx);
        if (!rm) li.classList.add('is-entering');
        cards.set(fx.id, li);
        fillCitations(li);
        if (!rm) requestAnimationFrame(() => requestAnimationFrame(() => li.classList.remove('is-entering')));
      }
      const want = prev ? prev.nextElementSibling : listEl.firstElementChild;
      if (want !== li) listEl.insertBefore(li, prev ? prev.nextSibling : listEl.firstChild);
      prev = li;
    }
    applyLimit();
    emptyEl.hidden = items.length > 0;
    if (!items.length) emptyEl.textContent = 'None of the listed side effects is tied to this point on the timeline. They can still happen at any time.';
    root.dataset.count = String(items.length);
    countEl.textContent = items.length ? `${items.length} linked to this point` : '';
    emitActive(items);
    scheduleAnnounce(items);
  }

  function applyLimit() {
    const shown = [...listEl.children].filter((li) => !li.classList.contains('is-leaving'));
    const extra = shown.length - VISIBLE_LIMIT;
    shown.forEach((li, i) => {
      const hide = !expanded && i >= VISIBLE_LIMIT;
      if (hide && li.contains(document.activeElement)) toggleEl.focus({ preventScroll: true });
      li.hidden = hide;
    });
    toggleEl.hidden = extra <= 0;
    toggleEl.setAttribute('aria-expanded', String(expanded));
    toggleEl.textContent = expanded ? 'Show fewer' : `Show ${extra} more`;
  }
  toggleEl.addEventListener('click', () => { expanded = !expanded; applyLimit(); });

  listEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('.fx-locate');
    if (!b) return;
    try { bus.emit('organ:focus', { organ: b.dataset.organ }); } catch (e) { console.warn('[effects] organ:focus listener failed', e); }
  });
  const safeOn = (type, fn) => { try { const off = bus.on(type, fn); if (typeof off === 'function') offs.push(off); } catch (e) { console.warn('[effects] bus.on failed', e); } };
  safeOn('time:change', (d) => { if (d && num(d.tDays)) update(d); });
  safeOn('peptide:loaded', (d) => setEntry(d?.entry ?? null));
  safeOn('motion:change', (d) => { rm = !!d?.reducedMotion; root.classList.toggle('fx-rm', rm); });

  setEntry(entry ?? null);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(announceTimer);
      for (const off of offs.splice(0)) { try { off(); } catch { /* ignore */ } }
      root.remove();
      host.classList.remove('fx-host');
      if (prevLive == null) host.removeAttribute('aria-live'); else host.setAttribute('aria-live', prevLive);
    },
  };
}
