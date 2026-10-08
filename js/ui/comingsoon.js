// Behind the Vial: stubs for peptides whose full visual entry is not ready.
import { html } from './util.js';
import { statusPill } from './picker.js';
import { icon } from './icons.js';
import { helpLines } from './redflags.js';

const TOPIC = {
  pharmacology: 'Timing in the body',
  'side-effects': 'Side effects',
  'red-flags': 'Warning signs',
  'too-much': 'What happens with too much',
  'dose-facts': 'Trial results',
  evidence: 'Strength of evidence',
  claims: 'Creator claims vs evidence',
};

/** Full stub card (used in #overview). */
export function comingSoonCard(p, ctx) {
  return html`
  <div class="c-card c-card--lit c-soon">
    <div class="c-soon__head">
      <div>
        <p class="c-kicker">Coming soon</p>
        <h3 class="c-soon__name">${p.name}</h3>
        ${p.aka?.length ? html`<p class="c-soon__aka">Also called ${p.aka.join(', ')}</p>` : ''}
      </div>
      <div class="c-soon__status">${statusPill(p.status, { small: false })}</div>
    </div>
    ${p.statusLabel ? html`<p class="c-soon__label">${p.statusLabel}</p>` : ''}
    ${p.oneLine ? html`<p class="c-soon__line">${p.oneLine}${ctx.mark(p)}</p>` : ''}
    <p class="c-soon__progress">${icon('progress', { size: 18 })}<span><strong>Full visual entry in progress.</strong> The body animation, timeline, side effects and fact checks for ${p.name} are being researched and checked.</span></p>
    <p class="c-soon__actions"><button type="button" class="c-btn c-btn--primary" data-peptide-jump="retatrutide">See the full retatrutide entry ${icon('arrow', { size: 16 })}</button></p>
  </div>`;
}

/** Compact stub for any other per-peptide section. Emergency help lines stay visible for every peptide. */
export function comingSoonSection(key, p) {
  return html`
  <div class="c-soon c-soon--compact">
    <p class="c-soon__progress">${icon('progress', { size: 18 })}<span><strong>${TOPIC[key] || 'This section'} for ${p.name}: in progress.</strong> Full visual entry in progress.</span></p>
    ${statusPill(p.status)}
  </div>
  ${key === 'red-flags' || key === 'too-much' ? html`
  <p class="c-note">Whatever the product: for trouble breathing, chest pain, fainting or a seizure, call 911.</p>
  ${helpLines()}` : ''}`;
}
