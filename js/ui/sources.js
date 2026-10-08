// PeptideScope: #sources: every cited source, numbered by first citation.
// Sources we could not confirm yet are listed separately under "Not yet confirmed".
import { html, fmtDate } from './util.js';
import { icon } from './icons.js';

const TYPE_LABEL = {
  journal: 'Journal',
  regulator: 'Regulator',
  label: 'Drug label',
  company: 'Company',
  'trial-registry': 'Trial registry',
  nonprofit: 'Nonprofit',
  'testing-lab': 'Independent lab',
  news: 'News',
  'health-service': 'Health service',
};

function item({ id, n, source: s }) {
  const date = fmtDate(s.date);
  return html`
  <li class="c-src" id="src-${id}" value="${n}" tabindex="-1">
    <span class="c-src__n" aria-hidden="true">${n}</span>
    <div class="c-src__body">
      <a class="c-src__title" href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}<span class="c-sr"> (opens in a new tab)</span>${icon('external', { size: 14 })}</a>
      <p class="c-src__meta">
        <span class="c-src__type c-src__type--${s.type}">${TYPE_LABEL[s.type] || s.type || 'Source'}</span>
        <span>${s.publisher}</span>${date ? html`<span aria-hidden="true">·</span><span>${date}</span>` : ''}
      </p>
      ${s.note ? html`<p class="c-src__note">${s.note}</p>` : ''}
    </div>
  </li>`;
}

export function renderSources(ctx) {
  const all = ctx.list();
  const confirmed = all.filter((r) => r.confirmed);
  const pending = all.filter((r) => !r.confirmed);
  if (!all.length) return html`<p class="c-note">No sources cited yet.</p>`;
  return html`
  <div class="c-sources">
    <p class="c-note">Numbered in the order they are first cited on this page. Select a number in the text to jump to its source.</p>
    ${confirmed.length ? html`<ol class="c-srclist">${confirmed.map(item)}</ol>` : ''}
    ${pending.length ? html`
    <section class="c-srcpending" aria-label="Not yet confirmed">
      <h3 class="c-h3">Not yet confirmed</h3>
      <p class="c-note">We have not been able to confirm these against an original, authoritative source yet. Anything that relies only on them is marked "Unverified".</p>
      <ol class="c-srclist c-srclist--pending">${pending.map(item)}</ol>
    </section>` : ''}
  </div>`;
}
