// PeptideScope: v4 building blocks shared by the content renderers.
// Every Learn panel reads the same way: a 1-2 sentence plain summary first, then the
// details as short lists, simple tables and tap-to-open rows, citations kept.
import { html } from './util.js';
import { icon } from './icons.js';

/** The plain summary that opens a panel. `body` is Safe html (text + citations). */
export function summary(body, { tone = '' } = {}) {
  if (!body || !String(body).trim()) return '';
  return html`<p class="c-summary${tone ? ` c-summary--${tone}` : ''}">${body}</p>`;
}

/** A titled group inside a panel. */
export function group({ title, sub = '', body, id = '', iconName = '', tone = '', cls = '' }) {
  if (!body || !String(body).trim()) return '';
  return html`
  <section class="c-group${tone ? ` c-group--${tone}` : ''}${cls ? ` ${cls}` : ''}"${id ? html` aria-labelledby="${id}"` : ''}>
    <h3 class="c-h3"${id ? html` id="${id}"` : ''}>${iconName ? html`<span class="c-h3__icon">${icon(iconName, { size: 20 })}</span>` : ''}<span>${title}</span></h3>
    ${sub ? html`<p class="c-sub">${sub}</p>` : ''}
    ${body}
  </section>`;
}

/**
 * A tap-to-open row (native <details>, so it works without JS, with the keyboard and
 * with screen readers). `head` stays visible; `body` opens underneath.
 */
export function more(head, body, { tone = '', cls = '', attrs = '' } = {}) {
  return html`
  <details class="c-more${tone ? ` c-more--${tone}` : ''}${cls ? ` ${cls}` : ''}"${attrs}>
    <summary class="c-more__head"><span class="c-more__title">${head}</span><span class="c-more__chev" aria-hidden="true">${icon('chevron', { size: 20 })}</span></summary>
    <div class="c-more__body">${body}</div>
  </details>`;
}

/** Bulleted sentences (a long paragraph broken up for easier reading), cited once at the end. */
export function sentenceList(list, trailer = '') {
  if (!list.length) return '';
  return html`<ul class="c-list">${list.map((s, i) => html`<li>${s}${i === list.length - 1 ? trailer : ''}</li>`)}</ul>`;
}

/** A short "in progress" note for a peptide whose full entry is not finished. */
export function inProgress(text) {
  return html`<p class="c-progress">${icon('progress', { size: 20 })}<span>${text}</span></p>`;
}
