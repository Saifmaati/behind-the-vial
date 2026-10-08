// Behind the Vial: #risk-check: WARNINGS ONLY.
//
// The visitor ticks parts of their history; we show only the warnings our
// sources list for the selected peptide. It never says someone is safe or
// cleared, never ranks risk as low, and never outputs a dose.
// Ticked items live in memory only (never stored, never sent) and carry over
// when the visitor switches peptide.
// Emits risk:change { items: [checked ids], warnings: [{ organ, title, item }] }.
import { bus } from './busref.js';
import { RISK_ITEMS } from '../../data/riskitems.js';
import { html, uid, plural, sampleNote } from './util.js';
import { icon } from './icons.js';
import { createCiteContext } from './cite.js';
import { organButton } from './overview.js';

const checked = new Set();          // shared across mounts (peptide switches)
let active = null;                  // the current mount's teardown

const NOTE = 'This check only shows warnings. It cannot tell you that you are safe, and it never gives a dose. Talk to a clinician.';

export function mountRiskCheck(host, entry, ctx) {
  if (!host) return { destroy() {} };
  active?.destroy();
  const items = RISK_ITEMS;
  const name = entry?.name || 'this peptide';
  const mapped = entry && entry.risk && typeof entry.risk === 'object' ? entry.risk : null;
  ctx = ctx || createCiteContext();
  // Reserve citation numbers for every warning now, so numbering is stable and #sources lists them.
  if (mapped) items.forEach((it) => (mapped[it.id] || []).forEach((w) => ctx.register(w.sources, { unverified: !!w.unverified })));

  const formId = uid('risk');
  const statusId = uid('risk');
  host.innerHTML = String(html`${entry?.sample ? sampleNote() : ''}
  <div class="c-risk">
    <p class="c-risk__note" role="note">${icon('alert', { size: 20 })}<span><strong>This check only shows warnings.</strong> It cannot tell you that you are safe, and it never gives a dose. Talk to a clinician.</span></p>
    <div class="c-risk__grid">
      <fieldset class="c-card c-risk__form" id="${formId}">
        <legend class="c-risk__legend">Tick anything that applies to you</legend>
        <p class="c-risk__privacy">${icon('lock', { size: 15 })}Your answers stay on this page. They are not saved or sent anywhere.</p>
        <div class="c-risk__items">
          ${items.map((it) => {
            const id = `${formId}-${it.id}`;
            return html`
          <div class="c-check">
            <input type="checkbox" class="c-check__box" id="${id}" value="${it.id}" aria-describedby="${id}-hint"${checked.has(it.id) ? html` checked` : ''}>
            <label class="c-check__label" for="${id}">
              <span class="c-check__text">${it.label}<span class="c-check__hint" id="${id}-hint">${it.hint || ''}</span></span>
            </label>
          </div>`;
          })}
        </div>
        <button type="button" class="c-btn c-btn--quiet c-btn--sm" data-risk-clear>Clear my answers</button>
      </fieldset>
      <div class="c-risk__out">
        <h3 class="c-h3 c-risk__outtitle">Warnings for ${name}</h3>
        <p class="c-sr" id="${statusId}" role="status" aria-live="polite"></p>
        <div class="c-risk__results" data-risk-results></div>
      </div>
    </div>
  </div>`);

  const results = host.querySelector('[data-risk-results]');
  const status = host.querySelector(`#${statusId}`);

  function warningsFor(id) { return mapped ? (mapped[id] || []) : []; }

  function render({ announce = true } = {}) {
    const ticked = items.filter((it) => checked.has(it.id));
    const warnings = [];
    if (!ticked.length) {
      results.innerHTML = String(html`<p class="c-risk__empty">Nothing ticked yet. Tick anything that applies to see the warnings our sources list for ${name}.</p>`);
    } else {
      results.innerHTML = String(html`${ticked.map((it) => {
        const ws = warningsFor(it.id);
        ws.forEach((w) => warnings.push({ organ: w.organ, title: w.title, item: it.id }));
        if (!ws.length) {
          return html`
          <section class="c-warn c-warn--none" aria-label="${it.label}">
            <p class="c-warn__item">${it.label}</p>
            <p class="c-warn__none">${mapped
              ? `No specific warning for this in our sources for ${name}. That does not mean it is safe for you.`
              : `We have not mapped warnings for ${name} yet. That does not mean it is safe for you.`}</p>
          </section>`;
        }
        return html`
          <section class="c-warn" aria-label="${it.label}">
            <p class="c-warn__item">${it.label}</p>
            ${ws.map((w) => html`
            <div class="c-warn__card">
              <p class="c-warn__title">${icon('alert', { size: 16 })}<span>${w.title}</span></p>
              <p class="c-warn__text">${w.text}${ctx.mark(w)}</p>
              <p class="c-warn__organ">${w.organ ? organButton(w.organ) : ''}</p>
            </div>`)}
          </section>`;
      })}
      <p class="c-risk__remind">${NOTE}</p>`);
    }
    if (announce && status) {
      status.textContent = ticked.length
        ? `${plural(warnings.length, 'warning')} shown for ${plural(ticked.length, 'ticked item')}.`
        : 'No items ticked.';
    }
    bus.emit('risk:change', { items: ticked.map((it) => it.id), warnings });
  }

  const onChange = (e) => {
    const box = e.target.closest('input[type="checkbox"]');
    if (!box) return;
    if (box.checked) checked.add(box.value); else checked.delete(box.value);
    render();
  };
  const onClick = (e) => {
    if (!e.target.closest('[data-risk-clear]')) return;
    checked.clear();
    host.querySelectorAll('input[type="checkbox"]').forEach((b) => { b.checked = false; });
    render();
    host.querySelector('input[type="checkbox"]')?.focus();
  };
  host.addEventListener('change', onChange);
  host.addEventListener('click', onClick);
  render({ announce: false });

  const api = {
    get items() { return [...checked]; },
    destroy() { host.removeEventListener('change', onChange); host.removeEventListener('click', onClick); if (active === api) active = null; },
  };
  active = api;
  return api;
}

