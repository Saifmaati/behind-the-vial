// Behind the Vial: #too-much: signs of too much, what to do, and why the
// amount in a gray-market vial cannot be known. No amounts, ever.
import { html } from './util.js';
import { icon } from './icons.js';
import { helpLines } from './redflags.js';
import { graySummary } from './graymarket.js';

export function renderTooMuch(entry, ctx, { gray } = {}) {
  const tm = entry.tooMuch || {};
  const g = gray ? graySummary(gray) : null;
  return html`
  <div class="c-toomuch">
    ${tm.intro ? html`<p class="c-prose c-intro">${tm.intro}${ctx.cite(tm.sources)}</p>` : ''}
    <div class="c-two">
      <section class="c-card c-tm c-tm--signs" aria-label="Signs it may be too much">
        <h3 class="c-h3 c-tm__title">${icon('alert', { size: 18 })}Signs it may be too much</h3>
        <ul class="c-bullets">${(tm.signs || []).map((s) => html`<li>${s.text}${ctx.mark(s)}</li>`)}</ul>
      </section>
      <section class="c-card c-tm c-tm--do" aria-label="What to do">
        <h3 class="c-h3 c-tm__title">${icon('phone', { size: 18 })}What to do</h3>
        <ol class="c-numbered">${(tm.whatToDo || []).map((s) => html`<li>${s.text}${ctx.mark(s)}</li>`)}</ol>
      </section>
    </div>
    ${helpLines()}
    ${gray ? html`
    <aside class="c-callout c-callout--unknowable" aria-label="Why the amount is unknowable">
      <span class="c-callout__icon">${icon('vial', { size: 22 })}</span>
      <div>
        <h3 class="c-callout__title">Why no one can say how much is "too much" from an online vial</h3>
        <p>${gray.headline}${g?.sentence ? html` ${g.sentence}` : ''}${ctx.cite(gray.sources)}</p>
        <p><a class="c-link" href="#gray-market">See the vial tests ${icon('arrow', { size: 14 })}</a></p>
      </div>
    </aside>` : ''}
  </div>`;
}
