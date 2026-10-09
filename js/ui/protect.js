// PeptideScope: "If you have one" and "Real medicine vs. internet vial" (v4), shown for every
// peptide, including the ones still coming soon. Reads data/protect.js:
//   PROTECT = {
//     ifYouHaveOne:   { intro, steps: [{ title, text, sources }] },
//     realVsInternet: { intro, rows:  [{ aspect, real, internet, sources }] },
//   }
// The steps never describe using, storing or handling a product: they are about not using it,
// telling a trusted adult, getting help, and getting rid of it safely.
// If data/protect.js is missing or empty, nothing is rendered and nothing throws.
import { html } from './util.js';
import { icon } from './icons.js';
import { summary, group } from './blocks.js';

let PROTECT = null;
try {
  const mod = await import('../../data/protect.js');
  PROTECT = mod.PROTECT || mod.default || null;
} catch (err) {
  console.warn('[content] data/protect.js is not available yet; the protective sections stay hidden.', err?.message || err);
}

export const PROTECT_PARTS = ['have-one', 'compare'];

/** Accepts a string, or a { text, sources } object (both shapes are allowed for intros). */
function introOf(v, ctx) {
  if (!v) return '';
  if (typeof v === 'string') return html`${v}`;
  if (typeof v === 'object' && v.text) return html`${v.text}${ctx.mark(v)}`;
  return '';
}

function stepIcon(step, i) {
  const t = `${step.title || ''} ${step.text || ''}`.toLowerCase();
  const title = String(step.title || '').toLowerCase();
  if (/\b(911|poison|emergency)\b/.test(title)) return 'phone';
  if (/\b(don.?t|do not|never|stop)\b/.test(title)) return 'stop';
  if (/\b(tell|adult|parent|guardian|trusted|talk to someone)\b/.test(title)) return 'people';
  if (/\b(doctor|pharmacist|nurse|clinic|clinician)\b/.test(title)) return 'doctor';
  if (/\b(dispos|get rid|throw|take.?back|sharps|bin|drop.?off)\w*/.test(title)) return 'bin';
  if (/\b(911|poison|emergency)\b/.test(t)) return 'phone';
  return ['stop', 'people', 'doctor', 'bin', 'phone'][i % 5];
}

function haveOnePanel(part, ctx) {
  const steps = (part?.steps || []).filter((s) => s && (s.title || s.text));
  if (!steps.length) return '';
  return html`
  <div class="c-panel c-panel--haveone" id="protect-if-you-have-one" data-part="if-you-have-one" tabindex="-1">
    ${summary(introOf(part.intro, ctx))}
    <ol class="c-safe-steps">
      ${steps.map((s, i) => html`
      <li class="c-safe-step c-safe-step--${stepIcon(s, i)}">
        <span class="c-safe-step__icon" aria-hidden="true">${icon(stepIcon(s, i), { size: 26 })}<span class="c-safe-step__n">${i + 1}</span></span>
        <div class="c-safe-step__body">
          ${s.title ? html`<p class="c-safe-step__title">${s.title}</p>` : ''}
          ${s.text ? html`<p class="c-safe-step__text">${s.text}${ctx.mark(s)}</p>` : html`${ctx.mark(s)}`}
        </div>
      </li>`)}
    </ol>
  </div>`;
}

function comparePanel(part, ctx, peptideId) {
  // rows tagged appliesTo (e.g. the GLP-1 pen/tablet row, the "Retatrutide right now" row) show only
  // for those peptides (safety review)
  const rows = (part?.rows || []).filter((r) => r && (r.real || r.internet))
    .filter((r) => !Array.isArray(r.appliesTo) || !peptideId || r.appliesTo.includes(peptideId));
  if (!rows.length) return '';
  return html`
  <div class="c-panel c-panel--compare">
    ${summary(introOf(part.intro, ctx))}
    <div class="c-vs" role="table" aria-label="Real medicine compared with an internet vial">
      <div class="c-vs__head" role="row">
        <span class="c-vs__corner" role="columnheader"><span class="c-sr">What we compare</span></span>
        <span class="c-vs__col c-vs__col--real" role="columnheader">${icon('shield', { size: 22 })}Real medicine</span>
        <span class="c-vs__col c-vs__col--net" role="columnheader">${icon('alert', { size: 22 })}Internet vial</span>
      </div>
      ${rows.map((r) => html`
      <div class="c-vs__row" role="row">
        <p class="c-vs__aspect" role="rowheader">${r.aspect || ''}</p>
        <div class="c-vs__cell c-vs__cell--real" role="cell">
          <p class="c-vs__label" aria-hidden="true">${icon('shield', { size: 16 })}Real medicine</p>
          <p>${r.real || ''}</p>
        </div>
        <div class="c-vs__cell c-vs__cell--net" role="cell">
          <p class="c-vs__label" aria-hidden="true">${icon('alert', { size: 16 })}Internet vial</p>
          <p>${r.internet || ''}${ctx.mark(r)}</p>
        </div>
      </div>`)}
    </div>
  </div>`;
}

/** True when there is something to show (so the caller can leave a host empty otherwise). */
export function hasProtect() {
  return !!(PROTECT && ((PROTECT.ifYouHaveOne?.steps || []).length || (PROTECT.realVsInternet?.rows || []).length));
}

/**
 * Renders the protective sections. `parts` picks 'have-one', 'compare' or both (default).
 * Returns '' when the data is missing, so the host simply stays empty.
 */
export function renderProtect(ctx, { parts = PROTECT_PARTS, peptideId = null } = {}) {
  if (!hasProtect()) return '';
  const want = new Set(parts);
  const a = want.has('have-one') ? haveOnePanel(PROTECT.ifYouHaveOne, ctx) : '';
  const b = want.has('compare') ? comparePanel(PROTECT.realVsInternet, ctx, peptideId) : '';
  // Stable anchors so the "Real medicine vs. internet vial" card can open this panel at its part.
  const compare = b ? html`<div id="protect-real-vs-internet" data-part="real-vs-internet" tabindex="-1">${a
    ? group({ title: 'Real medicine vs. internet vial', iconName: 'shield', cls: 'c-group--compare', body: b })
    : b}</div>` : '';
  return html`${a}${compare}`;
}
