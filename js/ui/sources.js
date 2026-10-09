// PeptideScope: #sources: every cited source, numbered by first citation.
// Sources we could not confirm yet are listed separately under "Not yet confirmed".
import { html, fmtSourceDate, andList } from './util.js';
import { summary } from './blocks.js';
import { icon } from './icons.js';

// Plural words for the summary, in the order they are listed.
const TYPE_PLURAL = {
  journal: 'medical journals',
  regulator: 'medicine regulators such as the FDA',
  label: 'official drug labels',
  'trial-registry': 'trial registries',
  company: 'drug companies',
  'health-service': 'health services',
  nonprofit: 'consumer safety groups',
  'testing-lab': 'independent testing labs',
};

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

// A source whose page lists sellers or prices is never linked (tools/source-overrides.mjs sets
// `linkWithheld`): its title is plain text and the note says why.
function item({ id, n, source: s }) {
  // dateNote qualifies the date ("accessed", "data last updated; accessed 2026-10-08").
  const date = fmtSourceDate(s.date, s.dateNote);
  return html`
  <li class="c-src" id="src-${id}" value="${n}" tabindex="-1">
    <span class="c-src__n" aria-hidden="true">${n}</span>
    <div class="c-src__body">
      ${s.linkWithheld
        ? html`<p class="c-src__title c-src__title--plain">${s.title}</p>`
        : html`<a class="c-src__title" href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}<span class="c-sr"> (opens in a new tab)</span>${icon('external', { size: 14 })}</a>`}
      <p class="c-src__meta">
        <span class="c-src__type c-src__type--${s.type}">${TYPE_LABEL[s.type] || s.type || 'Source'}</span>
        <span>${s.publisher}</span>${date ? html`<span aria-hidden="true">·</span><span>${date}</span>` : ''}
      </p>
      ${s.note ? html`<p class="c-src__note">${s.note}</p>` : ''}
      ${s.linkWithheld ? html`<p class="c-src__note">${s.linkWithheld} <a href="${s.url}" target="_blank" rel="noopener noreferrer">Methodology<span class="c-sr"> (opens in a new tab)</span></a></p>` : ''}
    </div>
  </li>`;
}

export function renderSources(ctx) {
  const all = ctx.list();
  const confirmed = all.filter((r) => r.confirmed);
  const pending = all.filter((r) => !r.confirmed);
  if (!all.length) return html`<p class="c-note">No sources cited yet.</p>`;
  const types = Object.keys(TYPE_PLURAL).filter((t) => all.some((r) => r.source.type === t)).map((t) => TYPE_PLURAL[t]);
  return html`
  <div class="c-panel c-panel--sources c-sources">
    ${summary(html`Every fact on this page has a small number next to it. Tap the number to see where it comes from.${types.length ? ` These sources are ${andList(types)}.` : ''}`)}
    <p class="c-note">Numbered in the order they are first cited on this page.</p>
    ${confirmed.length ? html`<ol class="c-srclist">${confirmed.map(item)}</ol>` : ''}
    ${pending.length ? html`
    <section class="c-srcpending" aria-label="Not yet confirmed">
      <h3 class="c-h3">Not yet confirmed</h3>
      <p class="c-note">We have not been able to confirm these against an original, authoritative source yet. Anything that relies only on them is marked "Unverified".</p>
      <ol class="c-srclist c-srclist--pending">${pending.map(item)}</ol>
    </section>` : ''}
  </div>`;
}
