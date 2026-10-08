// PeptideScope: #pharmacology: a plain-text timeline after one shot (starts
// working → peak → half-life → mostly cleared), what changes with weekly shots,
// the absorption sequence, and how the three studied areas compare.
// Times only, never amounts, never a level and never a graph.
import { html, fmtDays, SITES } from './util.js';
import { bodyGlyph, icon } from './icons.js';

const SEQUENCE = ['onset', 'peak', 'halfLife', 'clearance'];

export function renderPharmacology(entry, ctx) {
  const pk = entry.pk || {};
  const all = (pk.phases || []).filter((p) => p && p.label);
  const rail = all
    .filter((p) => SEQUENCE.includes(p.id))
    .sort((a, b) => SEQUENCE.indexOf(a.id) - SEQUENCE.indexOf(b.id));
  const extra = all.filter((p) => !SEQUENCE.includes(p.id)).sort((a, b) => (a.tDays ?? 0) - (b.tDays ?? 0));
  const steps = entry.absorption?.steps || [];
  const sites = entry.absorption?.sites || {};
  const anyEstimate = all.some((p) => p.estimate);

  return html`
  <div class="c-pharm">
    <div class="c-when">
      <p class="c-kicker c-when__kicker">After one shot</p>
      <ol class="c-when__rail" aria-label="Timing after one shot, in order">
        ${rail.map((p) => html`
        <li class="c-when__stop c-when__stop--${p.id}">
          <span class="c-when__mark" aria-hidden="true"><span class="c-when__dot"></span></span>
          <p class="c-when__label">${p.label}</p>
          <p class="c-when__value">${p.display || fmtDays(p.tDays)}</p>
          <p class="c-when__text">${p.text}${ctx.cite(p.sources, { unverified: !!p.unverified })}</p>
          ${p.estimate || p.unverified ? html`<p class="c-when__chips">${ctx.chips(p)}</p>` : ''}
        </li>`)}
      </ol>
      ${extra.map((p) => html`
      <div class="c-card c-when__extra">
        <span class="c-when__extraicon">${icon('progress', { size: 20 })}</span>
        <div>
          <p class="c-when__label">${p.label}</p>
          <p class="c-when__value c-when__value--sm">${p.display || fmtDays(p.tDays)}</p>
          <p class="c-when__text">${p.text}${ctx.cite(p.sources, { unverified: !!p.unverified })}${ctx.chips(p)}</p>
        </div>
      </div>`)}
      <p class="c-note">These times come from the studies cited and vary from person to person. The timeline under the body plays through the same stages.${anyEstimate ? ' "Model estimate" marks a time worked out from published data rather than measured directly.' : ''}${ctx.cite(pk.sources)}</p>
    </div>

    <div class="c-pharm__grid">
      ${steps.length ? html`
      <div class="c-pharm__steps">
        <h3 class="c-h3">From under the skin to the organs</h3>
        <ol class="c-steps">
          ${steps.map((s, i) => html`
          <li class="c-step" data-step="${s.id}">
            <span class="c-step__n" aria-hidden="true">${i + 1}</span>
            <div class="c-step__body">
              <h4 class="c-step__title">${s.title}</h4>
              <p class="c-step__text">${s.text}${ctx.mark(s)}</p>
            </div>
          </li>`)}
        </ol>
      </div>` : ''}

      ${Object.keys(sites).length ? html`
      <div class="c-pharm__sites">
        <h3 class="c-h3">Does the area matter?</h3>
        <p class="c-sub">How absorption compares between the three areas used in studies.</p>
        <ul class="c-sitenotes" role="list">
          ${SITES.filter((s) => sites[s.id]).map((s) => html`
          <li class="c-sitenote" data-site-note="${s.id}">
            <span class="c-sitenote__glyph">${bodyGlyph(s.id, { size: 44 })}</span>
            <div>
              <p class="c-sitenote__name">${s.label}<span class="c-sitenote__current"> · Selected</span></p>
              <p class="c-sitenote__text">${sites[s.id].text}${ctx.mark(sites[s.id])}</p>
            </div>
          </li>`)}
        </ul>
      </div>` : ''}
    </div>
  </div>`;
}
