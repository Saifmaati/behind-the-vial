// Behind the Vial: #dose-facts: FIXED, cited results from the studied trial
// groups. Static tables and static SVG bars only. There is deliberately no
// control of any kind here (no sliders, toggles, tabs or inputs).
import { html, raw, numberIn, uid } from './util.js';
import { icon } from './icons.js';
import { chartHost } from './charts.js';

const CAPTION = 'Fixed results from trials run under medical supervision. Not instructions.';
const AUTO_CHART = /stopp|discontinu|side effect/i;

function trialTable(t, capId) {
  const cols = t.columns || [];
  const rows = t.rows || [];
  const width = rows[0]?.cells?.length ?? 0;
  const head = cols.length === width + 1 ? cols : ['Study group', ...cols];
  return html`
  <p class="c-table__label" aria-hidden="true">Results by study group${t.timepoint ? html` · ${t.timepoint}` : ''}</p>
  <div class="c-table-wrap" tabindex="0" role="region" aria-labelledby="${capId}">
    <table class="c-table">
      <caption id="${capId}" class="c-sr">${t.name}: results by study group${t.timepoint ? html` (${t.timepoint})` : ''}</caption>
      <thead><tr>${head.map((h) => html`<th scope="col">${h}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => html`<tr><th scope="row">${r.arm}</th>${(r.cells || []).map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
    </table>
  </div>`;
}

function trialCharts(t) {
  const cols = t.columns || [];
  const rows = t.rows || [];
  const width = rows[0]?.cells?.length ?? 0;
  const head = cols.length === width + 1 ? cols.slice(1) : cols;
  let names = Array.isArray(t.chart?.columns) ? t.chart.columns : head.filter((h) => AUTO_CHART.test(h));
  names = names.filter((n) => head.includes(n));
  if (!names.length) return null;
  const series = names.map((name) => {
    const ci = head.indexOf(name);
    return {
      title: name,
      rows: rows.map((r) => ({
        arm: r.arm,
        text: r.cells?.[ci] ?? '',
        value: numberIn(r.cells?.[ci]),
        comparator: /placebo|comparator|control/i.test(r.arm),
      })),
    };
  });
  // one shared scale per trial so the small multiples compare honestly
  const max = Math.max(...series.flatMap((s) => s.rows.map((r) => (Number.isFinite(r.value) ? r.value : 0))));
  const nice = [10, 20, 25, 40, 50, 60, 80, 100].find((v) => max <= v) || Math.ceil(max / 50) * 50;
  return series.map((s) => ({ ...s, max: nice }));
}

export function renderDoseFacts(entry, ctx) {
  const df = entry.doseFacts || {};
  return html`
  <div class="c-dose">
    ${df.intro ? html`<p class="c-prose c-intro">${df.intro}${ctx.cite(df.sources)}</p>` : ''}
    <p class="c-callout c-callout--caveat" role="note">
      <span class="c-callout__icon">${icon('info', { size: 20 })}</span>
      <span><strong>Not instructions.</strong> ${df.caveat || CAPTION}</span>
    </p>
    ${(df.trials || []).map((t) => {
      const tid = uid('trial');
      const capId = uid('cap');
      const charts = trialCharts(t);
      return html`
    <article class="c-card c-trial" aria-labelledby="${tid}">
      <header class="c-trial__head">
        <h3 class="c-h3" id="${tid}">${t.name}${ctx.cite(t.sources, { unverified: !!t.unverified })}${ctx.chips(t)}</h3>
        <p class="c-trial__meta">${[t.design, t.timepoint].filter(Boolean).join(' · ')}</p>
      </header>
      ${charts ? html`
      <figure class="c-figure c-trial__fig">
        <div class="c-minis">
          ${charts.map((c) => html`
          <div class="c-mini">
            <p class="c-mini__title">${c.title}</p>
            ${raw(chartHost('arms', c, { nominal: charts.length > 1 ? 420 : 640 }))}
          </div>`)}
        </div>
        <figcaption class="c-figcap">${CAPTION}${ctx.cite(t.sources)}</figcaption>
      </figure>` : ''}
      ${trialTable(t, capId)}
    </article>`;
    })}
  </div>`;
}
