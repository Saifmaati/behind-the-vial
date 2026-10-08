// Behind the Vial: #gray-market: independent tests of vials bought online, and
// enforcement numbers. Core message: you cannot know how much you are getting.
// The label amount in mg is never shown; only "% of what the label claims".
import { html, raw, uid, plural } from './util.js';
import { icon } from './icons.js';
import { chartHost } from './charts.js';

/** Plain-language summary computed from the vial data (no invented thresholds). */
export function graySummary(gray) {
  const tests = gray?.vialTests || [];
  const measured = tests.map((t) => t.pctOfLabel).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const none = tests.filter((t) => t.pctOfLabel == null).length;
  if (!tests.length) return { n: 0, sentence: '' };
  const lo = measured.length ? Math.min(...measured) : null;
  const hi = measured.length ? Math.max(...measured) : null;
  const parts = [];
  if (measured.length) parts.push(`measured amounts ranged from ${lo}% to ${hi}% of what the label claimed`);
  if (none) parts.push(`${none} of ${tests.length} had none of the drug at all`);
  const sentence = parts.length ? `In the tests listed here, ${parts.join(', and ')}.` : '';
  return { n: tests.length, lo, hi, none, sentence };
}

const IDENTITY = { pass: 'Labeled drug found', fail: 'Labeled drug not found' };

export function renderGrayMarket(gray, ctx) {
  if (!gray) return html`<p class="c-note">Vial test data is not available yet.</p>`;
  const tests = [...(gray.vialTests || [])].sort((a, b) => (a.pctOfLabel ?? -1) - (b.pctOfLabel ?? -1));
  const sum = graySummary(gray);
  const figTitle = uid('vt');
  const capId = uid('cap');
  const sourcesOfTests = [...new Set(tests.flatMap((t) => t.sources || []))];

  return html`
  <div class="c-gray">
    <p class="c-gray__headline">${gray.headline}</p>
    ${gray.intro ? html`<p class="c-prose c-intro">${gray.intro}${ctx.cite(gray.sources)}</p>` : ''}

    ${gray.enforcement?.length ? html`
    <ul class="c-stats c-stats--enf" role="list" aria-label="Enforcement actions">
      ${gray.enforcement.map((e) => html`
      <li class="c-stat c-card">
        <p class="c-stat__value">${e.value}</p>
        <p class="c-stat__text">${e.text}${ctx.mark(e)}</p>
      </li>`)}
    </ul>` : ''}

    ${tests.length ? html`
    <figure class="c-card c-figure c-vials" aria-labelledby="${figTitle}">
      <div class="c-vials__head">
        <h3 class="c-h3" id="${figTitle}">${icon('flask', { size: 18 })}What independent labs found inside ${plural(tests.length, 'vial')}</h3>
        <p class="c-sub">Each column is one vial bought online. Its height shows how much of the drug was found, compared with what the label promised. The solid line marks 100%: exactly what the label claims.</p>
      </div>
      ${raw(chartHost('vials', {
        tests,
        title: `Independent vial tests: amount found as a percentage of the label, ${tests.length} vials`,
        desc: sum.sentence || '',
      }, { nominal: 720 }))}
      <ul class="c-legend" role="list" aria-label="Chart key">
        <li><span class="c-legend__key c-legend__key--bar" aria-hidden="true"></span>Amount found, as % of the label</li>
        <li><span class="c-legend__key c-legend__key--ref" aria-hidden="true"></span>Amount on the label (100%)</li>
        <li><span class="c-legend__key c-legend__key--none" aria-hidden="true">×</span>None of the drug found</li>
      </ul>
      <figcaption class="c-figcap">${sum.sentence}${ctx.cite(sourcesOfTests)}</figcaption>
    </figure>

    <details class="c-details">
      <summary>${icon('list', { size: 16 })}Show the vial results as a table</summary>
      <div class="c-table-wrap" tabindex="0" role="region" aria-labelledby="${capId}">
        <table class="c-table">
          <caption id="${capId}" class="c-sr">Independent vial tests, lowest to highest</caption>
          <thead><tr><th scope="col">Vial</th><th scope="col">Amount found (% of label)</th><th scope="col">Identity test</th><th scope="col">Note</th></tr></thead>
          <tbody>${tests.map((t) => html`
            <tr class="${t.pctOfLabel == null ? 'is-none' : ''}">
              <th scope="row">${t.label}</th>
              <td class="c-num">${t.pctOfLabel == null ? html`<span class="c-none">None found</span>` : `${t.pctOfLabel}%`}</td>
              <td>${IDENTITY[t.identity] || 'Not reported'}</td>
              <td>${t.note || ''}${ctx.mark(t)}</td>
            </tr>`)}
          </tbody>
        </table>
      </div>
    </details>` : ''}

    ${gray.takeaway ? html`<p class="c-gray__takeaway">${icon('alert', { size: 18 })}<span>${gray.takeaway}${ctx.cite(gray.sources)}</span></p>` : ''}
  </div>`;
}
