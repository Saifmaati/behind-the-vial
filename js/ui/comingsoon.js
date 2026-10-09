// PeptideScope: what a Learn card shows for a peptide whose full entry is still being checked
// (v4). The "What is it?" card gets the verified one-line description and status; the other
// per-peptide cards say plainly that the facts are still being checked. Emergency help, the
// vial tests and the protective sections are not peptide-specific, so they always show.
import { html } from './util.js';
import { statusPill } from './picker.js';
import { icon } from './icons.js';
import { helpLines } from './redflags.js';
import { summary, inProgress } from './blocks.js';

const TOPIC = {
  pharmacology: 'Timing in the body',
  'side-effects': 'Side effects',
  'red-flags': 'Warning signs',
  'too-much': 'What happens with too much',
  'dose-facts': 'Trial results',
  evidence: 'How strong the evidence is',
  claims: 'Creator claims vs. facts',
  how: 'How it works',
};

/** The "What is it?" card (also used for "Is it approved?"). */
export function comingSoonCard(p, ctx) {
  return html`
  <div class="c-panel c-panel--soon">
    ${p.oneLine ? summary(html`${p.oneLine}${ctx.mark(p)}`) : ''}
    <dl class="c-facts">
      <div><dt>Status</dt><dd>${statusPill(p.status, { statusLabel: p.statusLabel })}</dd></div>
      ${p.aka?.length ? html`<div><dt>Also called</dt><dd>${p.aka.join(', ')}</dd></div>` : ''}
    </dl>
    ${inProgress(html`<strong>We are still checking the facts for ${p.name}.</strong> The body animation, timing, side effects and fact checks will appear here once every fact has a trusted source.`)}
    <p class="c-actions"><button type="button" class="c-btn c-btn--primary" data-peptide-jump="retatrutide">See retatrutide, which is ready ${icon('arrow', { size: 18 })}</button></p>
  </div>`;
}

/** "Is it approved?" for a peptide still being checked: its verified status line, then a note. */
export function comingSoonStatus(p, ctx) {
  return html`
  <div class="c-panel c-panel--soon">
    <div class="c-statusline">
      ${statusPill(p.status, { small: false, statusLabel: p.statusLabel })}
      ${p.statusLabel ? summary(html`<strong>${p.statusLabel}.</strong>${ctx.cite(p.sources, { unverified: !!p.unverified })}`) : ''}
    </div>
    ${inProgress(html`<strong>How strong the evidence is for ${p.name}: still being checked.</strong> We only show facts that have a trusted source.`)}
  </div>`;
}

/** Any other per-peptide card. Emergency help stays visible for every peptide. */
export function comingSoonSection(key, p) {
  const help = key === 'red-flags' || key === 'too-much';
  return html`
  <div class="c-panel c-panel--soon">
    ${help ? summary(html`Whatever the product: for trouble breathing, chest pain, fainting or a seizure, call 911.`) : ''}
    ${inProgress(html`<strong>${TOPIC[key] || 'This part'} for ${p.name}: still being checked.</strong> We only show facts that have a trusted source.`)}
    ${help ? helpLines() : ''}
  </div>`;
}

