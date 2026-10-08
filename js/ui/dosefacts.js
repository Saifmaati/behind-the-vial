// PeptideScope: #dose-facts: FIXED, cited results from the studied trial
// groups, as static tables only. No charts, and deliberately no control of any
// kind (no sliders, toggles, tabs or inputs): nothing here can be adjusted.
//
// Tables are laid out the way journals print them: one row per measured
// outcome, one column per study group, so a reader can follow an outcome
// across the groups. The placebo column is set in a quieter tone.
import { html, uid } from './util.js';
import { icon } from './icons.js';

const NOT_INSTRUCTIONS = 'Fixed results from a trial run under medical supervision, as published. Not instructions.';
const COMPARATOR = /placebo|comparator|control/i;

/** { groups: [...], measures: [{ name, cells: [...] }] } from the row-per-group data. */
function transpose(t) {
  const cols = t.columns || [];
  const rows = t.rows || [];
  const width = rows.reduce((m, r) => Math.max(m, r.cells?.length || 0), 0);
  const names = cols.length === width + 1 ? cols.slice(1) : cols.slice(0, width);
  const groups = rows.map((r) => ({ name: r.arm, comparator: COMPARATOR.test(r.arm || '') }));
  const measures = names.map((name, ci) => ({ name, cells: rows.map((r) => r.cells?.[ci] ?? '') }));
  return { groups, measures };
}

function trialTable(t, ctx) {
  const { groups, measures } = transpose(t);
  if (!groups.length || !measures.length) return '';
  const capId = uid('cap');
  return html`
  <div class="c-table-wrap c-table-wrap--trial" tabindex="0" role="region" aria-labelledby="${capId}">
    <table class="c-table c-ttable" style="--groups: ${groups.length}">
      <caption id="${capId}" class="c-ttable__cap">
        <span class="c-sr">${t.name}${t.timepoint ? html`, ${t.timepoint}` : ''}. </span>${NOT_INSTRUCTIONS}${ctx.cite(t.sources)}
      </caption>
      <thead>
        <tr>
          <th scope="col" class="c-ttable__corner">Outcome</th>
          ${groups.map((g) => html`<th scope="col" class="${g.comparator ? 'is-comparator' : ''}">${g.name}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${measures.map((m) => html`
        <tr>
          <th scope="row">${m.name}</th>
          ${m.cells.map((c, i) => html`<td class="${groups[i]?.comparator ? 'is-comparator' : ''}" data-group="${groups[i]?.name || ''}">${c || html`<span class="c-muted">Not reported</span>`}</td>`)}
        </tr>`)}
      </tbody>
    </table>
  </div>`;
}

export function renderDoseFacts(entry, ctx) {
  const df = entry.doseFacts || {};
  const trials = df.trials || [];
  return html`
  <div class="c-dose">
    ${df.intro ? html`<p class="c-prose c-intro">${df.intro}${ctx.cite(df.sources)}</p>` : ''}
    <p class="c-callout c-callout--caveat" role="note">
      <span class="c-callout__icon">${icon('info', { size: 20 })}</span>
      <span><strong>Not instructions.</strong> ${df.caveat || NOT_INSTRUCTIONS}</span>
    </p>
    ${trials.map((t) => {
      const tid = uid('trial');
      return html`
    <article class="c-card c-trial" aria-labelledby="${tid}">
      <header class="c-trial__head">
        ${t.timepoint ? html`<p class="c-kicker c-trial__kicker">${t.timepoint}</p>` : ''}
        <h3 class="c-h3 c-trial__name" id="${tid}">${t.name}${ctx.cite(t.sources, { unverified: !!t.unverified })}${ctx.chips(t)}</h3>
        ${t.design ? html`<p class="c-trial__design">${t.design}</p>` : ''}
      </header>
      ${trialTable(t, ctx)}
    </article>`;
    })}
  </div>`;
}
