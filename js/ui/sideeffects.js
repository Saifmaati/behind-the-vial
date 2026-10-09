// PeptideScope: side effects (v4). A plain summary built from the effect names in the data,
// then three simple groups (common, less common, serious). Each effect is one tap-to-open row:
// how often, why it happens, what helps or when it passes, and where it is on the body.
import { html, organLabel, SEVERITY, uid, shortName, andList, isRepeatedUse } from './util.js';
import { icon } from './icons.js';
import { summary, group, more } from './blocks.js';

const ORDER = ['common', 'notable', 'serious'];
const GROUP = {
  common: { title: 'Common', sub: 'Many people get these.', tone: '' },
  notable: { title: 'Less common', sub: 'Less common, or worth watching for.', tone: 'warn' },
  serious: { title: 'Serious', sub: 'Rare, but can be dangerous. Get help fast.', tone: 'danger' },
};

export function severityTag(level) {
  const s = SEVERITY[level] || { label: level || 'Unrated', tone: 'neutral' };
  return html`<span class="c-sev c-sev--${level || 'unrated'}"><span class="c-sev__shape" aria-hidden="true"></span><span class="c-sr">Severity: </span>${s.label}</span>`;
}

function fxSummary(entry, list) {
  const names = (sev) => list.filter((f) => f.severity === sev).map((f) => shortName(f.name));
  const common = names('common');
  const serious = names('serious');
  const parts = [];
  if (common.length) {
    const shown = common.slice(0, 3);
    parts.push(`The common ones include ${andList(shown)}${common.length > shown.length ? ', and more' : ''}.`);
  }
  if (serious.length) parts.push(`Rarer but serious: ${andList(serious)}.`);
  if (!parts.length) return '';
  return summary(html`${parts.join(' ')}`);
}

function fxRow(fx, ctx) {
  return more(
    html`<span class="c-row__name">${fx.name}</span><span class="c-row__meta">${organLabel(fx.organ)}</span>`,
    html`
    ${fx.frequency?.text ? html`<div class="c-kv"><p class="c-kv__k">How often</p><p>${fx.frequency.text}${ctx.mark(fx.frequency)}</p></div>` : ''}
    ${fx.why?.text ? html`<div class="c-kv"><p class="c-kv__k">Why it happens</p><p>${fx.why.text}${ctx.mark(fx.why)}</p></div>` : ''}
    ${fx.reduce?.text ? html`<div class="c-kv"><p class="c-kv__k">What helps, or when it passes</p><p>${fx.reduce.text}${ctx.mark(fx.reduce)}</p></div>` : ''}
    ${fx.timing?.text ? html`<p class="c-when">${icon('clock', { size: 16 })}<span>${fx.timing.text}</span></p>` : ''}
    ${fx.alsoOrgans?.length ? html`<p class="c-meta"><span class="c-meta__k">Also involves</span>${fx.alsoOrgans.map((o) => html`<span class="c-tag">${organLabel(o)}</span>`)}</p>` : ''}
    <p class="c-actions"><button type="button" class="c-btn c-btn--soft c-btn--sm" data-organ-focus="${fx.organ}">${icon('target', { size: 16 })}Show on body<span class="c-sr">: ${fx.name} (${organLabel(fx.organ)})</span></button></p>`,
    { tone: fx.severity === 'serious' ? 'danger' : fx.severity === 'notable' ? 'warn' : '', attrs: html` data-effect-id="${fx.id}"` },
  );
}

export function renderSideEffects(entry, ctx) {
  const list = (entry.sideEffects || []).filter((f) => f && f.name);
  const groups = ORDER.map((sev) => ({
    sev,
    items: list.filter((f) => f.severity === sev),
  })).filter((g) => g.items.length);
  const other = list.filter((f) => !ORDER.includes(f.severity));
  if (other.length) groups.push({ sev: 'other', items: other });

  const repeated = list.filter(isRepeatedUse);
  return html`
  <div class="c-panel c-panel--fx">
    ${fxSummary(entry, list)}
    ${repeated.length ? html`<p class="c-note">${icon('clock', { size: 16 })} With repeated use over weeks to months (not shown on the one-shot timeline under the body): ${andList(repeated.map((f) => shortName(f.name)))}.</p>` : ''}
    ${groups.map((g) => group({
      title: GROUP[g.sev]?.title || 'Other',
      sub: GROUP[g.sev]?.sub || '',
      tone: GROUP[g.sev]?.tone || '',
      id: uid('fxg'),
      cls: `c-group--sev-${g.sev}`,
      body: html`<div class="c-rows">${g.items.map((fx) => fxRow(fx, ctx))}</div>`,
    }))}
  </div>`;
}
