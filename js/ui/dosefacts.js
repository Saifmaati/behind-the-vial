// PeptideScope: "The trials" (v4): FIXED, cited results from the studied trial groups, as
// simple tables only. No charts, and deliberately no control of any kind (no sliders, toggles,
// tabs or inputs): nothing here can be adjusted.
//
// Tables are laid out the way journals print them: one row per measured outcome, one column
// per study group. On phones each outcome becomes a small card with one labelled line per group.
import { html, uid, sentences } from './util.js';
import { icon } from './icons.js';
import { summary, more } from './blocks.js';

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
  <div class="c-table-wrap" tabindex="0" role="region" aria-labelledby="${capId}">
    <table class="c-table c-ttable" style="--groups: ${groups.length}">
      <caption id="${capId}" class="c-ttable__cap"><span class="c-sr">${t.name}${t.timepoint ? html`, ${t.timepoint}` : ''}. </span>${NOT_INSTRUCTIONS}${ctx.cite(t.sources)}</caption>
      <thead>
        <tr>
          <th scope="col" class="c-ttable__corner">What was measured</th>
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
  const cav = sentences(df.caveat);
  const lead = cav.length > 1 ? `${cav[0]} ${cav[cav.length - 1]}` : (cav[0] || NOT_INSTRUCTIONS);
  const middle = cav.slice(1, -1).join(' ');
  return html`
  <div class="c-panel c-panel--trials">
    <p class="c-badge c-badge--info">${icon('info', { size: 16 })}Not instructions</p>
    ${summary(html`${lead}${ctx.cite(df.sources)}`)}
    ${middle ? html`<p class="c-note">${middle}</p>` : ''}
    ${df.intro ? html`<p class="c-lead">${df.intro}${ctx.cite(df.sources)}</p>` : ''}
    <div class="c-rows c-rows--trials">
      ${trials.map((t, i) => more(
        html`<span class="c-row__name">${t.name}</span>${t.timepoint ? html`<span class="c-row__meta">${t.timepoint}</span>` : ''}`,
        html`
        ${t.design ? html`<p>${t.design}${ctx.cite(t.sources, { unverified: !!t.unverified })}${ctx.chips(t)}</p>` : ''}
        ${trialTable(t, ctx)}`,
        { cls: 'c-more--trial', attrs: i === 0 ? html` open` : '' },
      ))}
    </div>
  </div>`;
}
