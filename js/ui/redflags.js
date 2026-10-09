// PeptideScope: "When to get help" (v4): call 911 now vs see a doctor today, then the US
// Poison Control and 988 lines. Every warning sign stays visible; "why" opens underneath.
import { html, uid } from './util.js';
import { icon } from './icons.js';
import { summary, more } from './blocks.js';

/** US help lines. Shown in "When to get help", "Too much" and "If you have one". */
export function helpLines() {
  return html`
  <div class="c-lines" role="group" aria-label="Help lines (United States)">
    <a class="c-line" href="tel:+18002221222">
      <span class="c-line__icon">${icon('phone', { size: 22 })}</span>
      <span class="c-line__body">
        <span class="c-line__name">Poison Control</span>
        <span class="c-line__num">1-800-222-1222</span>
        <span class="c-line__desc">Free and private, any time, day or night. Call if you think someone took too much, or you are not sure what was in it.</span>
      </span>
    </a>
    <a class="c-line" href="tel:988">
      <span class="c-line__icon">${icon('message', { size: 22 })}</span>
      <span class="c-line__body">
        <span class="c-line__name">988 Suicide &amp; Crisis Lifeline</span>
        <span class="c-line__num">Call or text 988</span>
        <span class="c-line__desc">Free and private, any time. If you are having thoughts of hurting yourself, or you are worried about someone.</span>
      </span>
    </a>
    <p class="c-lines__note">These numbers are for the United States. Elsewhere, call your local emergency number.</p>
  </div>`;
}

function signRows(items, ctx, tone) {
  if (!items?.length) return html`<p class="c-muted">Nothing listed in our sources yet.</p>`;
  return html`<div class="c-rows">${items.map((it) => (it.why
    ? more(html`<span class="c-row__name">${it.sign}</span>`, html`<p class="c-kv__k">Why it matters</p><p>${it.why}${ctx.mark(it)}</p>`, { tone })
    : html`<p class="c-row c-row--static">${it.sign}${ctx.mark(it)}</p>`))}</div>`;
}

export function renderRedFlags(entry, ctx) {
  const rf = entry.redFlags || {};
  const a = uid('rf');
  const b = uid('rf');
  return html`
  <div class="c-panel c-panel--help">
    ${summary(html`Some signs mean <strong>call 911 now</strong>. Others mean <strong>see a doctor today</strong>.`)}
    <section class="c-alert c-alert--danger" aria-labelledby="${a}">
      <div class="c-alert__head">
        <span class="c-alert__icon">${icon('phone', { size: 24 })}</span>
        <div>
          <h3 class="c-alert__title" id="${a}">Call 911 now</h3>
          <p class="c-alert__sub">Or go to the nearest emergency room. Do not wait to see if it passes.</p>
        </div>
        <a class="c-call" href="tel:911">${icon('phone', { size: 18 })}Call 911</a>
      </div>
      ${signRows(rf.call911, ctx, 'danger')}
    </section>
    <section class="c-alert c-alert--warn" aria-labelledby="${b}">
      <div class="c-alert__head">
        <span class="c-alert__icon">${icon('clock', { size: 24 })}</span>
        <div>
          <h3 class="c-alert__title" id="${b}">See a doctor today</h3>
          <p class="c-alert__sub">Call your doctor, or go to urgent care today. If it gets worse, call 911.</p>
        </div>
      </div>
      ${signRows(rf.doctorToday, ctx, 'warn')}
    </section>
    ${helpLines()}
  </div>`;
}
