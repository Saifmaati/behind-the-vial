// Behind the Vial: #pharmacology: onset / peak / clearance tiles, absorption
// sequence, and how the three studied areas compare. Times only, never amounts.
import { html, fmtDays, SITES } from './util.js';
import { bodyGlyph } from './icons.js';

const TILE_ORDER = ['onset', 'peak', 'halfLife', 'clearance'];

export function renderPharmacology(entry, ctx) {
  const pk = entry.pk || {};
  const phases = [...(pk.phases || [])]
    .filter((p) => p && p.label)
    .sort((a, b) => {
      const ia = TILE_ORDER.indexOf(a.id); const ib = TILE_ORDER.indexOf(b.id);
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || (a.tDays ?? 0) - (b.tDays ?? 0);
    });
  const steps = entry.absorption?.steps || [];
  const sites = entry.absorption?.sites || {};
  const anyEstimate = phases.some((p) => p.estimate);

  return html`
  <div class="c-pharm">
    <ul class="c-stats" role="list" aria-label="Timing after one shot">
      ${phases.map((p) => html`
      <li class="c-stat c-card${p.id === 'peak' ? ' c-card--lit' : ''}">
        <p class="c-stat__label">${p.label}</p>
        <p class="c-stat__value">${p.display || fmtDays(p.tDays)}</p>
        <p class="c-stat__text">${p.text}${ctx.cite(p.sources, { unverified: !!p.unverified })}</p>
        ${p.estimate || p.unverified ? html`<p class="c-stat__chips">${ctx.chips(p)}</p>` : ''}
      </li>`)}
    </ul>
    <p class="c-note">Times are for a single shot, measured or modeled in study volunteers. They vary from person to person.${anyEstimate ? ' "Model estimate" means the number comes from a calculation based on published data, not a direct measurement.' : ''}${ctx.cite(pk.sources)}</p>

    <div class="c-pharm__grid">
      ${steps.length ? html`
      <div class="c-pharm__steps">
        <h3 class="c-h3">From under the skin to the organs</h3>
        <ol class="c-steps">
          ${steps.map((s, i) => html`
          <li class="c-step" data-step="${s.id}">
            <span class="c-step__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
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
