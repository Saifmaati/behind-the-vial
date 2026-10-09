// PeptideScope: the overview parts (v4, for teens): `what` ("What is it?"), `status`
// ("Is it approved?", normally shown at the top of the evidence card) and `how` (the
// receptors it fits and the organs it acts on, in the "How it works" card). Each part opens
// with a plain summary taken word for word from the verified data, then the details.
import { html, organLabel, organOrder, uid, sentences, firstSentences, andList } from './util.js';
import { statusPill } from './picker.js';
import { icon } from './icons.js';
import { summary, group, more, sentenceList } from './blocks.js';

export const OVERVIEW_PARTS = ['what', 'status', 'how'];
/** What an overview host shows when no part is named. */
export const OVERVIEW_DEFAULT = ['what', 'how'];

export function organButton(organ, { label } = {}) {
  const name = label || organLabel(organ);
  return html`<button type="button" class="c-organ" data-organ-focus="${organ}" aria-label="Show ${name} on the body"><span class="c-organ__dot" aria-hidden="true"></span>${name}</button>`;
}

function showOnBody(organ, extra = '') {
  return html`<button type="button" class="c-btn c-btn--soft c-btn--sm" data-organ-focus="${organ}">${icon('target', { size: 16 })}Show on body<span class="c-sr">: ${extra || organLabel(organ)}</span></button>`;
}

// ---------------------------------------------------------------------------
// What is it?

// The summary takes the first sentence of the first two "what" paragraphs; the details below never
// repeat them.
const SUMMARY_PARAS = 2;
function whatSummary(entry, ctx) {
  const what = (entry.what || []).filter((w) => w && w.text);
  const parts = what.slice(0, SUMMARY_PARAS).map((w) => html`${firstSentences(w.text, 1)}${ctx.mark(w)}`);
  return summary(html`${parts.map((p, i) => html`${i ? ' ' : ''}${p}`)}`);
}

function quickFacts(entry, { withStatus = false } = {}) {
  const aka = (entry.aka || []).join(', ');
  const st = entry.status || {};
  const rows = [
    withStatus && st.level ? html`<div><dt>Status</dt><dd>${statusPill(st.level, { statusLabel: st.label })}</dd></div>` : '',
    aka ? html`<div><dt>Also called</dt><dd>${aka}</dd></div>` : '',
    entry.developer ? html`<div><dt>Made by</dt><dd>${entry.developer}</dd></div>` : '',
    // no "How it is given" tile (safety review): the trial-context sentence in the details covers it
  ].filter(Boolean);
  return rows.length ? html`<dl class="c-facts">${rows}</dl>` : '';
}

function whatDetails(entry, ctx, { skipSummary = false } = {}) {
  const what = (entry.what || []).filter((w) => w && w.text);
  const paras = what.map((w, i) => {
    const text = skipSummary && i < SUMMARY_PARAS ? sentences(w.text).slice(1).join(' ') : w.text;
    return text ? html`<p>${text}${ctx.mark(w)}</p>` : '';
  }).filter((p) => String(p).trim());
  return paras.length ? html`<div class="c-prose">${paras}</div>` : '';
}

/** "What is it?": the plain summary and the quick facts; the jargon is one tap away (collapsed). */
export function renderWhat(entry, ctx) {
  const details = whatDetails(entry, ctx, { skipSummary: true });
  return html`
  <div class="c-panel c-panel--what">
    ${whatSummary(entry, ctx)}
    ${quickFacts(entry, { withStatus: true })}
    ${details ? html`<div class="c-rows">${more(html`<span class="c-row__name">A bit more detail</span>`, details)}</div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------------------
// Is it approved?

export function statusSummary(st, ctx) {
  const lead = firstSentences(st.detail, 1);
  return html`
  <div class="c-statusline">
    ${statusPill(st.level, { small: false, statusLabel: st.label })}
    ${summary(html`<strong>${st.label}.</strong>${lead ? html` ${lead}` : ''}${ctx.cite(st.sources, { unverified: !!st.unverified })}${ctx.chips(st)}`)}
  </div>`;
}

export function statusDetails(st, ctx) {
  const rest = sentences(st.detail).slice(1);
  return sentenceList(rest, ctx.cite(st.sources, { unverified: !!st.unverified }));
}

/** The approval status on its own: a pill, the label and the first sentence, then the rest as a list. */
export function renderStatus(entry, ctx) {
  const st = entry.status || {};
  return html`
  <div class="c-panel c-panel--status">
    ${statusSummary(st, ctx)}
    ${statusDetails(st, ctx)}
  </div>`;
}

// ---------------------------------------------------------------------------
// How it works (receptors, then the organs it acts on)

function howSentence(entry) {
  const receptors = [...new Set((entry.how || []).map((h) => h.receptor).filter(Boolean))];
  if (!receptors.length) return '';
  // "Glucagon" → "glucagon" in running text; acronyms (GLP-1, GIP) stay as they are.
  const words = receptors.map((r) => (/^[A-Z][a-z]+$/.test(r) ? r.toLowerCase() : r));
  return html`A receptor is like a lock on the surface of certain cells. ${entry.name} fits the ${andList(words)} locks, so it acts in several organs at once.`;
}
const howSummary = (entry) => summary(howSentence(entry));

function receptorRows(entry, ctx) {
  if (!entry.how?.length) return '';
  return html`
  <div class="c-rows">
    ${entry.how.map((h) => more(
      html`<span class="c-receptor">${h.receptor}<span class="c-sr"> receptor</span></span><span class="c-row__lead">${firstSentences(h.effect, 1)}${ctx.mark(h)}</span>`,
      html`
      <p>${h.effect}${ctx.mark(h)}</p>
      ${h.organs?.length ? html`<p class="c-meta"><span class="c-meta__k">Found in</span>${h.organs.map((o) => organButton(o))}</p>` : ''}`,
      { cls: 'c-more--lock' },
    ))}
  </div>`;
}

/** "Faster heartbeat. In monkeys …" → the first sentence as the row title, the rest underneath. */
function targetRows(entry, ctx) {
  const targets = [...(entry.targets || [])].filter((t) => t && t.organ && t.effect);
  if (!targets.length) return '';
  targets.sort((a, b) => organOrder(a.organ) - organOrder(b.organ));
  return html`
  <div class="c-rows">
    ${targets.map((t) => {
      const first = firstSentences(t.effect, 1);
      return more(
        html`<span class="c-row__organ">${organLabel(t.organ)}</span><span class="c-row__lead">${first}${ctx.mark(t)}</span>`,
        html`
        <p>${t.effect}${ctx.mark(t)}</p>
        ${t.receptors?.length ? html`<p class="c-meta"><span class="c-meta__k">Receptors</span>${t.receptors.map((r) => html`<span class="c-receptor c-receptor--sm">${r}</span>`)}</p>` : ''}
        <p class="c-actions">${showOnBody(t.organ)}</p>`,
      );
    })}
  </div>`;
}

export function renderHow(entry, ctx) {
  const where = targetRows(entry, ctx);
  return html`
  <div class="c-panel c-panel--how">
    ${howSummary(entry)}
    ${group({ title: 'The locks it opens', body: receptorRows(entry, ctx), id: uid('locks') })}
    ${group({ title: 'Where it acts in the body', sub: 'These organs light up on the body after the shot. Open one to read more.', body: where, id: uid('where') })}
  </div>`;
}

// ---------------------------------------------------------------------------

/**
 * Combined overview ("What is it?"). By default it shows what it is and what it does in the
 * body; the approval status is a pill here and gets its own part ("Is it approved?", which
 * js/ui/index.js puts at the top of the evidence card unless a host asks for it here).
 */
export function renderOverview(entry, ctx, { parts = OVERVIEW_DEFAULT } = {}) {
  const want = new Set(parts);
  if (want.size === 1) {
    if (want.has('status')) return renderStatus(entry, ctx);
    if (want.has('how')) return renderHow(entry, ctx);
    return renderWhat(entry, ctx);
  }
  const st = entry.status || {};
  const lead = want.has('what') ? whatSummary(entry, ctx) : want.has('status') ? statusSummary(st, ctx) : howSummary(entry);
  return html`
  <div class="c-panel c-panel--overview">
    ${lead}
    ${want.has('what') ? quickFacts(entry, { withStatus: !want.has('status') }) : ''}
    ${want.has('status') ? group({
      title: 'Is it approved?',
      id: uid('status'),
      body: want.has('what')
        ? html`<div class="c-statusline">${statusPill(st.level, { small: false, statusLabel: st.label })}<p class="c-lead"><strong>${st.label}.</strong></p></div>${sentenceList(sentences(st.detail), ctx.cite(st.sources, { unverified: !!st.unverified }))}`
        : statusDetails(st, ctx),
    }) : ''}
    ${want.has('what') ? group({ title: 'A bit more detail', id: uid('what'), body: whatDetails(entry, ctx, { skipSummary: true }) }) : ''}
    ${want.has('how') ? html`
      ${group({
        title: 'What it does in the body',
        id: uid('how'),
        body: html`${want.has('what') || want.has('status') ? html`<p class="c-lead">${howSentence(entry)}</p>` : ''}${receptorRows(entry, ctx)}`,
      })}
      ${group({ title: 'Where it acts in the body', sub: 'These organs light up on the body after the shot. Open one to read more.', body: targetRows(entry, ctx), id: uid('where') })}` : ''}
  </div>`;
}
