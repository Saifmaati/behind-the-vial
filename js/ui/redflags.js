// PeptideScope: #red-flags: "Call 911 now" vs "See a doctor today", plus
// the US Poison Control and 988 lines.
import { html, uid } from './util.js';
import { icon } from './icons.js';

/** US help lines. Shown in red flags and too-much. */
export function helpLines() {
  return html`
  <div class="c-lines" role="group" aria-label="Help lines (United States)">
    <a class="c-line c-line--poison" href="tel:+18002221222">
      <span class="c-line__icon">${icon('phone', { size: 20 })}</span>
      <span class="c-line__body">
        <span class="c-line__name">Poison Control</span>
        <span class="c-line__num">1-800-222-1222</span>
        <span class="c-line__desc">Free and private, any time, day or night. Call if you think someone took too much, or you are not sure what was in it.</span>
      </span>
    </a>
    <a class="c-line c-line--988" href="tel:988">
      <span class="c-line__icon">${icon('message', { size: 20 })}</span>
      <span class="c-line__body">
        <span class="c-line__name">988 Suicide &amp; Crisis Lifeline</span>
        <span class="c-line__num">Call or text 988</span>
        <span class="c-line__desc">Free and private, any time. If you are having thoughts of hurting yourself, or you are worried about someone.</span>
      </span>
    </a>
    <p class="c-lines__note">These numbers are for the United States. Elsewhere, call your local emergency number.</p>
  </div>`;
}

function flagList(items, ctx) {
  if (!items?.length) return html`<p class="c-flag__empty">Nothing listed in our sources yet.</p>`;
  return html`<ul class="c-flag__list">${items.map((it) => html`
    <li class="c-flag__item">
      <p class="c-flag__sign">${it.sign}</p>
      ${it.why ? html`<p class="c-flag__why">${it.why}${ctx.mark(it)}</p>` : html`<p class="c-flag__why">${ctx.mark(it)}</p>`}
    </li>`)}</ul>`;
}

export function renderRedFlags(entry, ctx) {
  const rf = entry.redFlags || {};
  const a = uid('rf');
  const b = uid('rf');
  return html`
  <div class="c-flags">
    <section class="c-flag c-flag--911" aria-labelledby="${a}">
      <header class="c-flag__head">
        <span class="c-flag__icon">${icon('phone', { size: 22 })}</span>
        <div>
          <p class="c-flag__eyebrow">Emergency</p>
          <h3 class="c-flag__title" id="${a}">Call 911 now</h3>
          <p class="c-flag__sub">Or go to the nearest emergency room. Do not wait to see if it passes.</p>
        </div>
      </header>
      ${flagList(rf.call911, ctx)}
      <a class="c-flag__cta" href="tel:911">${icon('phone', { size: 16 })}Call 911</a>
    </section>
    <section class="c-flag c-flag--today" aria-labelledby="${b}">
      <header class="c-flag__head">
        <span class="c-flag__icon">${icon('clock', { size: 22 })}</span>
        <div>
          <p class="c-flag__eyebrow">Urgent, not an emergency</p>
          <h3 class="c-flag__title" id="${b}">See a doctor today</h3>
          <p class="c-flag__sub">Call your doctor, or go to urgent care today. If it gets worse, call 911.</p>
        </div>
      </header>
      ${flagList(rf.doctorToday, ctx)}
    </section>
  </div>
  ${helpLines()}`;
}
