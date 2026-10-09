// PeptideScope: creator claims vs facts (v4). Each claim is one tap-to-open row with its
// verdict (Supported / Partly true / Not supported / Unknown, never green); the evidence opens
// underneath. The summary is worked out from the verdicts in the data.
import { html, VERDICT } from './util.js';
import { icon } from './icons.js';
import { summary, more } from './blocks.js';

export function verdictChip(v) {
  const meta = VERDICT[v] || VERDICT.unknown;
  const key = VERDICT[v] ? v : 'unknown';
  return html`<span class="c-verdict c-verdict--${key}"><span class="c-verdict__shape" aria-hidden="true"></span><span class="c-sr">Verdict: </span>${meta.label}</span>`;
}

function claimsSummary(claims) {
  if (!claims.length) return '';
  const not = claims.filter((c) => c.verdict === 'not-supported').length;
  const lead = not * 2 > claims.length
    ? 'Most of the creator claims we checked are not backed by the evidence.'
    : not ? 'Some of the creator claims we checked are not backed by the evidence.' : '';
  return summary(html`${lead}${lead ? ' ' : ''}Open a claim to see what the studies actually show.`);
}

export function renderClaims(entry, ctx) {
  const claims = (entry.claims || []).filter((c) => c && c.claim);
  return html`
  <div class="c-panel c-panel--claims">
    ${claimsSummary(claims)}
    <div class="c-rows">
      ${claims.map((c) => {
        const key = VERDICT[c.verdict] ? c.verdict : 'unknown';
        return more(
          html`<span class="c-claim__quote">${icon('quote', { size: 16 })}<span>${c.claim}</span></span>${verdictChip(c.verdict)}`,
          html`<p class="c-kv__k">What the evidence shows</p><p>${c.evidence}${ctx.mark(c)}</p>`,
          { cls: `c-more--claim c-more--${key}` },
        );
      })}
    </div>
  </div>`;
}
