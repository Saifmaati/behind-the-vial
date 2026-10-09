// PeptideScope: "Is it approved?" (v4): where it stands with regulators (summary first, from
// the verified status), then how strong the human evidence is: a four-step ladder (weakest to
// strongest) with this peptide's step marked, and what we still don't know. No scores and no
// numbered levels: the steps are named, and the list order says which is stronger.
import { html, EVIDENCE_LEVELS, sentences, uid } from './util.js';
import { icon } from './icons.js';
import { summary, group, more } from './blocks.js';
import { statusSummary, statusDetails } from './overview.js';

const RUNGS = {
  anecdote: { name: 'Stories online', what: 'Personal stories, posts and videos. They cannot show whether the drug caused the result, or what was really in the vial.' },
  animal: { name: 'Animal studies', what: 'Tests in mice, rats or other animals. Useful clues, but results often do not carry over to people.' },
  'small-human': { name: 'Small human studies', what: 'Early trials in a limited number of people. They show common effects but can miss rare ones.' },
  'large-trial': { name: 'Large trials', what: 'Big controlled trials that compare the drug with a placebo. The strongest evidence available before approval.' },
};

/** `status: false` leaves the approval status out (when another card shows it on its own). */
export function renderEvidence(entry, ctx, { status = true } = {}) {
  const st = entry.status || null;
  const ev = entry.evidence || {};
  const at = EVIDENCE_LEVELS.indexOf(ev.level);
  const byLevel = new Map();
  (ev.rungs || []).forEach((r) => { if (!byLevel.has(r.level)) byLevel.set(r.level, []); byLevel.get(r.level).push(r); });

  const ladder = html`
  <p class="c-axis" aria-hidden="true"><span>Weaker</span><i></i><span>Stronger</span></p>
  <ol class="c-ladder" aria-label="Kinds of evidence, from weakest to strongest">
    ${EVIDENCE_LEVELS.map((lvl, i) => {
      const meta = RUNGS[lvl];
      const reached = at >= 0 && i <= at;
      const isCurrent = i === at;
      const items = byLevel.get(lvl) || [];
      return html`
    <li class="c-rung${reached ? ' is-reached' : ''}${isCurrent ? ' is-current' : ''}"${isCurrent ? html` aria-current="step"` : ''}>
      <div class="c-rung__head">
        <span class="c-rung__dot" aria-hidden="true">${reached ? icon('check', { size: 14 }) : ''}</span>
        <p class="c-rung__name">${meta.name}</p>
        ${isCurrent ? html`<span class="c-badge c-badge--primary">${entry.name} is here</span>` : ''}
      </div>
      <p class="c-rung__what">${meta.what}</p>
      ${items.length
        ? more(html`<span class="c-more__small">What we found here</span>`, html`<ul class="c-list">${items.map((r) => html`<li>${r.text}${ctx.mark(r)}</li>`)}</ul>`, { cls: 'c-more--inline' })
        : html`<p class="c-muted c-small">${reached ? 'Nothing listed on this step in our sources.' : 'Not reached yet.'}</p>`}
    </li>`;
    })}
  </ol>`;

  const said = sentences(ev.summary);
  // Each gap: its first sentence as the row, the rest underneath.
  const gaps = ev.gaps?.length ? html`<div class="c-rows">${ev.gaps.map((g) => {
    const [head, ...rest] = sentences(g.text);
    return rest.length
      ? more(html`<span class="c-row__name">${head}${ctx.mark(g)}</span>`, html`<p>${rest.join(' ')}${ctx.mark(g)}</p>`)
      : html`<p class="c-row c-row--static">${g.text}${ctx.mark(g)}</p>`;
  })}</div>` : '';

  const withStatus = status && st && st.label;
  const proofLead = said.length > 2
    ? html`<p class="c-lead">${said.slice(0, 2).join(' ')}${ctx.cite(ev.sources)}</p>${more(html`<span class="c-more__small">Read more</span>`, html`<p>${said.slice(2).join(' ')}${ctx.cite(ev.sources)}</p>`, { cls: 'c-more--inline' })}`
    : said.length ? html`<p class="c-lead">${said.join(' ')}${ctx.cite(ev.sources)}</p>` : '';
  return html`
  <div class="c-panel c-panel--evidence">
    ${withStatus ? statusSummary(st, ctx) : said.length ? summary(html`${said[0]}${ctx.cite(ev.sources)}`) : ''}
    ${withStatus ? group({ title: 'Where it stands', id: uid('stands'), body: statusDetails(st, ctx) }) : ''}
    ${group({
      title: 'How strong is the proof?',
      id: uid('ladder'),
      body: html`${withStatus ? proofLead : said.length > 1 ? html`<p class="c-lead">${said.slice(1).join(' ')}${ctx.cite(ev.sources)}</p>` : ''}${ladder}`,
    })}
    ${group({ title: 'What we still don’t know', id: uid('gaps'), iconName: 'question', body: gaps })}
  </div>`;
}
