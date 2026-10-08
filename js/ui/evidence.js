// Behind the Vial: #evidence: the four-rung ladder of human evidence, with the
// entry's level highlighted, and what we still don't know.
import { html, EVIDENCE_LEVELS } from './util.js';
import { icon } from './icons.js';

const RUNGS = {
  anecdote: { name: 'Anecdote', what: 'Personal stories, posts and videos. They cannot show whether the drug caused the result, or what was really in the vial.' },
  animal: { name: 'Animal studies', what: 'Tests in mice, rats or other animals. Useful clues, but results often do not carry over to people.' },
  'small-human': { name: 'Small human studies', what: 'Early trials in a limited number of people. They show common effects but can miss rare ones.' },
  'large-trial': { name: 'Large trials', what: 'Big controlled trials that compare the drug with a placebo. The strongest evidence available before approval.' },
};

export function renderEvidence(entry, ctx) {
  const ev = entry.evidence || {};
  const at = EVIDENCE_LEVELS.indexOf(ev.level);
  const byLevel = new Map();
  (ev.rungs || []).forEach((r) => { if (!byLevel.has(r.level)) byLevel.set(r.level, []); byLevel.get(r.level).push(r); });

  return html`
  <div class="c-evidence">
    ${ev.summary ? html`<p class="c-prose c-intro">${ev.summary}${ctx.cite(ev.sources)}</p>` : ''}
    <p class="c-ladder__axis" aria-hidden="true"><span>Weaker</span><i></i><span>Stronger evidence</span></p>
    <ol class="c-ladder" aria-label="Strength of evidence, weakest to strongest">
      ${EVIDENCE_LEVELS.map((lvl, i) => {
        const meta = RUNGS[lvl];
        const reached = at >= 0 && i <= at;
        const isCurrent = i === at;
        const items = byLevel.get(lvl) || [];
        return html`
      <li class="c-rung${reached ? ' c-rung--reached' : ' c-rung--ahead'}${isCurrent ? ' c-rung--current' : ''}"${isCurrent ? html` aria-current="step"` : ''}>
        <div class="c-rung__meter" aria-hidden="true">${EVIDENCE_LEVELS.map((_, k) => html`<span class="${k <= i ? 'on' : ''}"></span>`)}</div>
        <p class="c-rung__step">Level ${i + 1} of 4</p>
        <h3 class="c-rung__name">${meta.name}</h3>
        <p class="c-rung__what">${meta.what}</p>
        ${isCurrent ? html`<p class="c-rung__badge">${entry.name} is here<span class="c-sr"> (the strongest level reached so far)</span></p>` : ''}
        ${items.length
          ? items.map((r) => html`<p class="c-rung__here">${r.text}${ctx.mark(r)}</p>`)
          : html`<p class="c-rung__none">${reached ? 'Nothing listed at this level in our sources.' : 'Not reached yet.'}</p>`}
      </li>`;
      })}
    </ol>
    ${ev.gaps?.length ? html`
    <section class="c-gaps" aria-label="What we still don't know">
      <h3 class="c-h3">What we still don't know</h3>
      <ul class="c-gaps__list">${ev.gaps.map((g) => html`<li>${icon('question', { size: 18 })}<span>${g.text}${ctx.mark(g)}</span></li>`)}</ul>
    </section>` : ''}
  </div>`;
}
