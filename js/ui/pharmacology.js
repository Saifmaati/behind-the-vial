// PeptideScope: timing after one shot (v4): a plain summary built from the data's own time
// words ("Within hours", "12 to 72 hours" …), then the stops as a simple list, what changes
// with weekly shots, how it gets from under the skin to the organs, and whether the area matters.
// Times only, never amounts, never a level and never a graph.
import { html, fmtDays, SITES, uid, firstSentences, sentences } from './util.js';
import { bodyGlyph } from './icons.js';
import { summary, group, more } from './blocks.js';

const SEQUENCE = ['onset', 'peak', 'halfLife', 'clearance'];
// Plain words for the four stops (the same words the timeline under the body uses). The first stop is
// when it was first found in the blood (accuracy review): the first measured effects came later.
const PLAIN = { onset: 'In the blood', peak: 'Peak', halfLife: 'Half gone', clearance: 'Mostly cleared' };

const when = (p) => p.display || fmtDays(p.tDays);
const lower = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
/** "Within hours" stays "within hours"; "About 6 days" → "after about 6 days". */
const after = (s) => (/^(within|after|by|in|over|from|around|up to)\b/i.test(s) ? lower(s) : `after ${lower(s)}`);

const est = (p) => (p.estimate ? ' (an estimate)' : '');

function timingSummary(entry, rail, ctx) {
  const byId = Object.fromEntries(rail.map((p) => [p.id, p]));
  const a = [];
  if (byId.onset) a.push(`is found in the blood ${after(when(byId.onset))}${est(byId.onset)}`);
  if (byId.peak) a.push(`peaks in the blood ${after(when(byId.peak))}${est(byId.peak)}`);
  const b = [];
  // half-life counts from the peak (accuracy review): "falls by half about every N days"
  const hl = entry.pk?.halfLifeDays;
  if (byId.halfLife && Number.isFinite(hl)) b.push(`After it peaks, the amount in the blood falls by half about every ${hl} days`);
  else if (byId.halfLife) b.push(`Half of it is gone ${after(when(byId.halfLife))}${est(byId.halfLife)}`);
  if (byId.clearance) b.push(`${b.length ? 'it is' : 'It is'} mostly cleared ${after(when(byId.clearance))}${est(byId.clearance)}`);
  const s1 = a.length ? `After one shot, ${entry.name} ${a.join(' and ')}.` : '';
  const s2 = b.length ? `${b.join(', and ')}.` : '';
  if (!s1 && !s2) return '';
  const ids = rail.flatMap((p) => p.sources || []);
  return summary(html`${s1}${s1 && s2 ? ' ' : ''}${s2}${ctx.cite(ids)}`);
}

export function renderPharmacology(entry, ctx) {
  const pk = entry.pk || {};
  const all = (pk.phases || []).filter((p) => p && p.label);
  const rail = all.filter((p) => SEQUENCE.includes(p.id)).sort((a, b) => SEQUENCE.indexOf(a.id) - SEQUENCE.indexOf(b.id));
  const extra = all.filter((p) => !SEQUENCE.includes(p.id)).sort((a, b) => (a.tDays ?? 0) - (b.tDays ?? 0));
  const steps = entry.absorption?.steps || [];
  const sites = entry.absorption?.sites || {};
  const anyEstimate = all.some((p) => p.estimate);

  const stops = html`
  <ol class="c-stops">
    ${rail.map((p) => html`
    <li class="c-stop c-stop--${p.id}">
      <span class="c-stop__dot" aria-hidden="true"></span>
      <div class="c-stop__main">
        <p class="c-stop__label">${PLAIN[p.id] || p.label}${PLAIN[p.id] && PLAIN[p.id] !== p.label ? html`<span class="c-stop__term"> (${p.label.toLowerCase()})</span>` : ''}</p>
        <p class="c-stop__value">${when(p)}${p.estimate ? html`<span class="c-sr"> (estimate)</span>` : ''}</p>
      </div>
    </li>`)}
  </ol>
  <div class="c-rows">
    ${rail.length ? more(
      html`<span class="c-row__name">Where these times come from</span>`,
      html`<ul class="c-list">${rail.map((p) => html`<li><strong>${PLAIN[p.id] || p.label}:</strong> ${p.text}${ctx.cite(p.sources, { unverified: !!p.unverified })}${ctx.chips(p)}</li>`)}</ul>`,
    ) : ''}
    ${extra.map((p) => more(
      html`<span class="c-row__name">${p.label}</span>${p.display ? html`<span class="c-row__meta">${p.display}</span>` : ''}`,
      html`<p>${p.text}${ctx.cite(p.sources, { unverified: !!p.unverified })}${ctx.chips(p)}</p>`,
    ))}
  </div>
  <p class="c-note">These times come from the studies cited and are different for every person.${anyEstimate ? ' “Model estimate” marks a time worked out from published data rather than measured directly.' : ''}${ctx.cite(pk.sources)}</p>`;

  // Each step: its title and first sentence, the rest one tap away.
  const route = steps.length ? html`
  <ol class="c-steps">
    ${steps.map((s, i) => {
      const [first, ...rest] = sentences(s.text);
      return html`
    <li class="c-step" data-step="${s.id}">
      <span class="c-step__n" aria-hidden="true">${i + 1}</span>
      <div class="c-step__body">
        <p class="c-step__title">${s.title}</p>
        <p class="c-step__text">${first || ''}${ctx.mark(s)}</p>
        ${rest.length ? more(html`<span class="c-more__small">Read more</span>`, html`<p>${rest.join(' ')}${ctx.mark(s)}</p>`, { cls: 'c-more--inline' }) : ''}
      </div>
    </li>`;
    })}
  </ol>` : '';

  const siteRows = Object.keys(sites).length ? html`
  <ul class="c-sitenotes" role="list">
    ${SITES.filter((s) => sites[s.id]).map((s) => html`
    <li class="c-sitenote" data-site-note="${s.id}">
      <span class="c-sitenote__glyph">${bodyGlyph(s.id, { size: 48 })}</span>
      <div>
        <p class="c-sitenote__name">${s.label}${s.sub ? html` <span class="c-muted">(${s.sub.toLowerCase()})</span>` : ''}<span class="c-sitenote__current"> · Your pick</span></p>
        <p class="c-sitenote__lead">${firstSentences(sites[s.id].text, 1)}${ctx.mark(sites[s.id])}</p>
        ${more(html`<span class="c-more__small">Read more</span>`, html`<p>${sites[s.id].text}${ctx.mark(sites[s.id])}</p>`, { cls: 'c-more--inline' })}
      </div>
    </li>`)}
  </ul>` : '';

  return html`
  <div class="c-panel c-panel--timing">
    ${timingSummary(entry, rail, ctx)}
    ${group({ title: 'From under the skin to the organs', body: route, id: uid('route') })}
    ${group({ title: 'After one shot', body: stops, id: uid('stops'), iconName: 'clock' })}
    ${group({ title: 'Does the spot change what happens inside?', sub: 'What studies found about the three areas.', body: siteRows, id: uid('sites') })}
  </div>`;
}
