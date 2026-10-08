// Behind the Vial: #overview: status, what it is, how it works.
import { html, organLabel, uid } from './util.js';
import { statusPill } from './picker.js';
import { icon } from './icons.js';

export function organButton(organ, { label } = {}) {
  const name = label || organLabel(organ);
  return html`<button type="button" class="c-organ" data-organ-focus="${organ}" aria-label="Show ${name} on the body"><span class="c-organ__dot" aria-hidden="true"></span>${name}</button>`;
}

export function renderOverview(entry, ctx) {
  const st = entry.status || {};
  const howId = uid('how');
  const aka = (entry.aka || []).join(', ');
  return html`
  <div class="c-overview">
    <div class="c-card c-card--lit c-statuscard">
      <p class="c-kicker">Where it stands</p>
      <div class="c-statuscard__badge">${statusPill(st.level, { small: false })}</div>
      <p class="c-statuscard__label">${st.label}${ctx.cite(st.sources, { unverified: !!st.unverified })}${ctx.chips(st)}</p>
      ${st.detail ? html`<p class="c-statuscard__detail">${st.detail}</p>` : ''}
      <dl class="c-facts">
        ${aka ? html`<div><dt>Also called</dt><dd>${aka}</dd></div>` : ''}
        ${entry.developer ? html`<div><dt>Developed by</dt><dd>${entry.developer}</dd></div>` : ''}
        ${entry.route ? html`<div><dt>How it is given</dt><dd>${entry.route}</dd></div>` : ''}
      </dl>
    </div>
    <div class="c-prose c-overview__what">
      <h3 class="c-h3">What it is</h3>
      ${(entry.what || []).map((w) => html`<p>${w.text}${ctx.mark(w)}</p>`)}
    </div>
  </div>

  ${entry.how?.length ? html`
  <div class="c-how" role="group" aria-labelledby="${howId}">
    <div class="c-how__intro">
      <h3 class="c-h3" id="${howId}">How it works</h3>
      <p class="c-sub">A receptor is like a lock on the surface of certain cells. ${entry.name} fits more than one lock, so it acts in several organs at once.</p>
    </div>
    <div class="c-how__head" aria-hidden="true"><span>Receptor</span><span>Where in the body</span><span>What it does</span></div>
    <ol class="c-how__rows">
      ${entry.how.map((h) => html`
      <li class="c-how__row">
        <div class="c-how__cell c-how__receptor"><span class="c-receptor">${h.receptor}</span><span class="c-sr"> receptor.</span></div>
        <span class="c-how__arrow" aria-hidden="true">${icon('arrow', { size: 16 })}</span>
        <div class="c-how__cell c-how__organs"><span class="c-sr">Found in: </span>${(h.organs || []).map((o) => organButton(o))}</div>
        <span class="c-how__arrow" aria-hidden="true">${icon('arrow', { size: 16 })}</span>
        <p class="c-how__cell c-how__effect">${h.effect}${ctx.mark(h)}</p>
      </li>`)}
    </ol>
  </div>` : ''}`;
}
