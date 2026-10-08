// Behind the Vial: #side-effects: cards grouped by the organ they come from.
import { html, organLabel, organOrder, SEVERITY, uid, plural } from './util.js';
import { icon } from './icons.js';

export function severityTag(level) {
  const s = SEVERITY[level] || { label: level || 'Unrated', tone: 'neutral' };
  return html`<span class="c-sev c-sev--${level || 'unrated'}"><span class="c-sev__shape" aria-hidden="true"></span><span class="c-sr">Severity: </span>${s.label}</span>`;
}

export function renderSideEffects(entry, ctx) {
  const list = entry.sideEffects || [];
  const groups = new Map();
  for (const fx of list) {
    if (!groups.has(fx.organ)) groups.set(fx.organ, []);
    groups.get(fx.organ).push(fx);
  }
  const sevRank = { serious: 0, notable: 1, common: 2 };
  const ordered = [...groups.entries()].sort((a, b) => organOrder(a[0]) - organOrder(b[0]));

  return html`
  <div class="c-fx">
    <dl class="c-sevlegend" aria-label="What the labels mean">
      ${['common', 'notable', 'serious'].map((k) => html`<div class="c-sevlegend__item"><dt>${severityTag(k)}</dt><dd>${SEVERITY[k].hint}</dd></div>`)}
    </dl>
    <div class="c-fxcols">
    ${ordered.map(([organ, items]) => {
      const gid = uid('fxg');
      items.sort((a, b) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3));
      return html`
    <section class="c-fxgroup" aria-labelledby="${gid}" data-organ="${organ}">
      <header class="c-fxgroup__head">
        <h3 class="c-fxgroup__title" id="${gid}"><span class="c-organ__dot" aria-hidden="true"></span>${organLabel(organ)}</h3>
        <span class="c-fxgroup__count">${plural(items.length, 'effect')}</span>
      </header>
      <div class="c-fxgrid">
        ${items.map((fx) => {
          const hid = uid('fx');
          return html`
        <article class="c-card c-fxcard c-fxcard--${fx.severity}" aria-labelledby="${hid}" data-effect-id="${fx.id}">
          <header class="c-fxcard__head">
            <h4 class="c-fxcard__name" id="${hid}">${fx.name}</h4>
            ${severityTag(fx.severity)}
          </header>
          ${fx.frequency?.text ? html`<p class="c-fxcard__freq"><span class="c-fxcard__k">How often</span> ${fx.frequency.text}${ctx.mark(fx.frequency)}</p>` : ''}
          <dl class="c-fxcard__dl">
            ${fx.why?.text ? html`<div><dt>Why it happens</dt><dd>${fx.why.text}${ctx.mark(fx.why)}</dd></div>` : ''}
            ${fx.reduce?.text ? html`<div><dt>Easing it, or when it passes</dt><dd>${fx.reduce.text}${ctx.mark(fx.reduce)}</dd></div>` : ''}
          </dl>
          <footer class="c-fxcard__foot">
            ${fx.timing?.text ? html`<span class="c-fxcard__when">${icon('clock', { size: 15 })}<span>${fx.timing.text}</span></span>` : html`<span></span>`}
            <button type="button" class="c-btn c-btn--ghost c-btn--sm" data-organ-focus="${fx.organ}">${icon('target', { size: 15 })}Show on body<span class="c-sr">: ${fx.name} (${organLabel(fx.organ)})</span></button>
          </footer>
        </article>`;
        })}
      </div>
    </section>`;
    })}
    </div>
  </div>`;
}
