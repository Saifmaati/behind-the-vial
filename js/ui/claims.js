// Behind the Vial: #claims: what creators say vs what the evidence shows.
// Verdict chips: Supported / Partly true / Not supported / Unknown (never green).
import { html, VERDICT, uid } from './util.js';
import { icon } from './icons.js';

export function verdictChip(v) {
  const meta = VERDICT[v] || VERDICT.unknown;
  const key = VERDICT[v] ? v : 'unknown';
  return html`<p class="c-verdict c-verdict--${key}"><span class="c-verdict__shape" aria-hidden="true"></span><span class="c-sr">Verdict: </span>${meta.label}</p>`;
}

export function renderClaims(entry, ctx) {
  const claims = entry.claims || [];
  return html`
  <ul class="c-claims" role="list">
    ${claims.map((c) => {
      const id = uid('claim');
      return html`
    <li class="c-card c-claim c-claim--${VERDICT[c.verdict] ? c.verdict : 'unknown'}">
      <article aria-labelledby="${id}">
        <p class="c-claim__eyebrow">${icon('quote', { size: 15 })}The claim</p>
        <h3 class="c-claim__text" id="${id}">${c.claim}</h3>
        ${verdictChip(c.verdict)}
        <p class="c-claim__ev"><span class="c-claim__evlabel">What the evidence shows</span>${c.evidence}${ctx.mark(c)}</p>
      </article>
    </li>`;
    })}
  </ul>`;
}
