// PeptideScope: "Too much" (v4): what to do first, signs it may be too much, and why the
// amount in an online vial cannot be known. No amounts, ever.
import { html, firstSentences } from './util.js';
import { icon } from './icons.js';
import { helpLines } from './redflags.js';
import { graySummary } from './graymarket.js';
import { summary, group } from './blocks.js';

export function renderTooMuch(entry, ctx, { gray } = {}) {
  const tm = entry.tooMuch || {};
  const first = (tm.whatToDo || [])[0];
  const n = gray?.vialTests?.length || 0;
  const g = gray ? graySummary(gray, { lead: `In the ${n === 1 ? 'one vial' : `${n} individual vials`} shown in “What’s really in the vial”` }) : null;
  const graySources = gray ? [...(gray.sources || []), ...(gray.vialTests || []).flatMap((t) => t.sources || [])] : [];
  // Finnrick's larger set of measured vials (the figure and its source come from data/graymarket.js)
  const range = (gray?.enforcement || []).find((e) => e && e.id === 'finnrick-range');

  return html`
  <div class="c-panel c-panel--toomuch">
    ${summary(html`${first ? html`${firstSentences(first.text, 1)}${ctx.mark(first)} ` : ''}${gray?.headline ? html`${gray.headline}${ctx.cite(gray.sources)}` : ''}`)}
    ${tm.intro ? html`<p class="c-lead">${tm.intro}${ctx.cite(tm.sources)}</p>` : ''}
    <div class="c-split">
      ${group({
        title: 'Signs it may be too much',
        iconName: 'alert',
        tone: 'warn',
        body: tm.signs?.length ? html`<ul class="c-list">${tm.signs.map((s) => html`<li>${s.text}${ctx.mark(s)}</li>`)}</ul>` : '',
      })}
      ${group({
        title: 'What to do',
        iconName: 'phone',
        tone: 'danger',
        body: tm.whatToDo?.length ? html`<ol class="c-numlist">${tm.whatToDo.map((s) => html`<li>${s.text}${ctx.mark(s)}</li>`)}</ol>` : '',
      })}
    </div>
    ${helpLines()}
    ${gray ? html`
    <aside class="c-callout" aria-label="Why the amount cannot be known">
      <span class="c-callout__icon">${icon('vial', { size: 24 })}</span>
      <div>
        <p class="c-callout__title">Why no one can say how much is “too much” from an online vial</p>
        <p>${g?.sentence || ''}${ctx.cite(graySources)}</p>
        ${range?.value ? html`<p>In Finnrick’s larger set of measured retatrutide vials, the amount ranged ${range.value} from the label.${ctx.mark(range)}</p>` : ''}
        <p><a class="c-link" href="#gray-market" data-open-render="gray-market">See what labs found inside the vials ${icon('arrow', { size: 16 })}</a></p>
      </div>
    </aside>` : ''}
  </div>`;
}
