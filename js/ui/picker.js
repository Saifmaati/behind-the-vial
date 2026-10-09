// PeptideScope: peptide picker and injection-site picker.
// Both are ARIA radiogroups with roving tabindex (one tab stop; arrows, Home and
// End move and select). Pickers only EMIT selections; main.js loads content.
import { bus } from './busref.js';
import { html, STATUS, SITES, statusKey } from './util.js';
import { bodyGlyph, icon } from './icons.js';

/**
 * Status badge. Pass the peptide's statusLabel so an approval that exists only outside the US
 * reads "Approved outside the US" rather than a bare "Approved".
 */
function statusPill(level, { small = true, statusLabel = '' } = {}) {
  const key = statusKey(level, statusLabel);
  const s = STATUS[key] || { label: 'Status unknown', tone: 'neutral' };
  return html`<span class="c-status c-status--${key || 'unknown'}${small ? ' c-status--sm' : ''}"><span class="c-status__shape" aria-hidden="true"></span>${s.label}</span>`;
}
export { statusPill };

/** Wire roving tabindex + arrow keys on a set of role=radio elements. */
function roving(radios, { onMove }) {
  const handler = (e) => {
    const i = radios.indexOf(e.currentTarget);
    if (i < 0) return;
    let j = null;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': j = (i + 1) % radios.length; break;
      case 'ArrowLeft': case 'ArrowUp': j = (i - 1 + radios.length) % radios.length; break;
      case 'Home': j = 0; break;
      case 'End': j = radios.length - 1; break;
      default: return;
    }
    e.preventDefault();
    const closed = radios[j].closest('details:not([open])');
    if (closed) closed.open = true;
    const hiddenGrid = radios[j].closest('[hidden]');
    if (hiddenGrid) hiddenGrid.dispatchEvent(new CustomEvent('ps:reveal', { bubbles: true }));
    radios[j].focus();
    onMove(radios[j]);
  };
  radios.forEach((r) => r.addEventListener('keydown', handler));
  return () => radios.forEach((r) => r.removeEventListener('keydown', handler));
}

function setChecked(radios, el) {
  radios.forEach((r) => {
    const on = r === el;
    r.setAttribute('aria-checked', on ? 'true' : 'false');
    r.tabIndex = on ? 0 : -1;
  });
  if (!el && radios[0]) radios[0].tabIndex = 0;
}

/**
 * Peptide cards. Retatrutide (ready) is first and featured; coming-soon cards stay
 * selectable and say "Coming soon".
 * Emits peptide:select { id }. Reflects external peptide:select.
 */
export function mountPicker(host, peptides = [], { selectedId } = {}) {
  if (!host) return { select() {}, destroy() {} };
  const list = [...peptides].sort((a, b) => (b.id === 'retatrutide') - (a.id === 'retatrutide') || (b.ready === true) - (a.ready === true));
  const ready = list.filter((p) => p.ready);
  const soon = list.filter((p) => !p.ready);

  // Big simple cards (21st.dev "icon card radio group" pattern, rebuilt in plain HTML):
  // the ready peptide first and larger, the rest in a calm "Coming soon" grid.
  const card = (p) => html`
    <button type="button" role="radio" aria-checked="false" tabindex="-1"
      class="c-pcard ${p.ready ? 'c-pcard--ready' : 'c-pcard--soon'}" data-peptide-id="${p.id}">
      <span class="c-pcard__check" aria-hidden="true">${icon('check', { size: 16 })}</span>
      <span class="c-pcard__text">
        <span class="c-pcard__name">${p.name}</span>
        ${p.aka?.length ? html`<span class="c-pcard__aka">Also called ${p.aka.join(', ')}</span>` : ''}
        ${p.ready
          ? html`<span class="c-pcard__meta">${statusPill(p.status, { statusLabel: p.statusLabel })}<span class="c-pcard__tag">Ready to explore</span></span>`
          : html`<span class="c-pcard__soon">Coming soon</span>`}
      </span>
    </button>`;

  // The host is a plain group; the radios live in radiogroups that own only radios (ARIA), and the
  // "more peptides" disclosure is a sibling button between them, not a child of a radiogroup.
  if (!host.getAttribute('role') || host.getAttribute('role') === 'radiogroup') host.setAttribute('role', 'group');
  if (!host.hasAttribute('aria-label') && !host.hasAttribute('aria-labelledby')) host.setAttribute('aria-label', 'Choose a peptide');
  const gridId = `c-picker-soon-${Math.random().toString(36).slice(2, 7)}`;
  const openAtStart = soon.some((p) => p.id === selectedId);
  host.innerHTML = String(html`
    <div class="c-picker">
      ${ready.length ? html`<div class="c-picker__lead" role="radiogroup" aria-label="Ready to explore">${ready.map(card)}</div>` : ''}
      ${soon.length ? html`
        <div class="c-picker__more"${openAtStart ? html` data-open="true"` : ''}>
          <button type="button" class="c-picker__toggle" aria-expanded="${openAtStart ? 'true' : 'false'}" aria-controls="${gridId}"><span class="c-picker__ttext">${soon.length} more peptides <span class="c-picker__soon">· coming soon</span></span><span class="c-picker__chev" aria-hidden="true">${icon('chevron', { size: 20 })}</span></button>
          <div class="c-picker__grid" id="${gridId}" role="radiogroup" aria-label="Coming soon"${openAtStart ? '' : html` hidden`}>${soon.map(card)}</div>
        </div>` : ''}
    </div>`);

  const radios = [...host.querySelectorAll('[role="radio"]')];
  let current = null;
  let timer = 0;

  const emit = (id) => { clearTimeout(timer); bus.emit('peptide:select', { id }); };
  function select(id, { emit: doEmit = false, defer = false } = {}) {
    const el = radios.find((r) => r.dataset.peptideId === id) || null;
    if (!el) return;
    setChecked(radios, el);
    if (current === id) return;
    current = id;
    if (!doEmit) return;
    clearTimeout(timer);
    // Arrowing through 21 cards should not load every entry on the way.
    if (defer) timer = setTimeout(() => emit(id), 260); else emit(id);
  }

  const onClick = (e) => {
    const el = e.target.closest('[role="radio"]');
    if (el && host.contains(el)) select(el.dataset.peptideId, { emit: true });
  };
  host.addEventListener('click', onClick);
  const offKeys = roving(radios, { onMove: (el) => select(el.dataset.peptideId, { emit: true, defer: true }) });
  // The "more peptides" disclosure (a button with aria-expanded). Keep one reachable tab stop when the
  // list is closed over the checked card.
  const more = host.querySelector('.c-picker__more');
  const toggleBtn = more?.querySelector('.c-picker__toggle');
  const grid = more?.querySelector('.c-picker__grid');
  function setOpen(open) {
    if (!more) return;
    grid.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', String(open));
    more.dataset.open = String(open);
    const el = radios.find((r) => r.dataset.peptideId === current) || null;
    if (!open && el && grid.contains(el)) { radios.forEach((r) => { r.tabIndex = -1; }); radios[0].tabIndex = 0; }
    else setChecked(radios, el);
  }
  const onToggle = () => setOpen(grid.hidden);
  const onReveal = () => setOpen(true);
  toggleBtn?.addEventListener('click', onToggle);
  grid?.addEventListener('ps:reveal', onReveal);
  const offBus = bus.on('peptide:select', (d) => {
    if (!d?.id || d.id === current) return;
    select(d.id);
    const el = radios.find((r) => r.dataset.peptideId === d.id);
    if (el && grid?.contains(el) && grid.hidden) setOpen(true);
  });

  setChecked(radios, null);
  if (selectedId) select(selectedId);

  return {
    select: (id) => select(id, { emit: true }),
    get selected() { return current; },
    destroy() { clearTimeout(timer); host.removeEventListener('click', onClick); toggleBtn?.removeEventListener('click', onToggle); grid?.removeEventListener('ps:reveal', onReveal); offKeys(); offBus?.(); },
  };
}

/**
 * Injection-site picker: three big buttons with simple body icons.
 * Emits site:select { site }. Reflects external site:select (e.g. 3D hotspot clicks).
 */
export function mountSitePicker(host, { selected } = {}) {
  if (!host) return { select() {}, destroy() {} };
  if (!host.getAttribute('role')) host.setAttribute('role', 'radiogroup');
  if (!host.hasAttribute('aria-label') && !host.hasAttribute('aria-labelledby')) host.setAttribute('aria-label', 'Choose where the shot goes');
  host.innerHTML = String(html`
    <div class="c-sites">
      ${SITES.map((s) => html`
        <button type="button" role="radio" aria-checked="false" tabindex="-1" class="c-site" data-site="${s.id}"${s.sub ? html` aria-label="${s.label} (${s.sub.toLowerCase()})"` : ''}>
          <span class="c-site__glyph">${bodyGlyph(s.id, { size: 72 })}</span>
          <span class="c-site__label">${s.label}</span>
          ${s.sub ? html`<span class="c-site__sub" aria-hidden="true">${s.sub}</span>` : ''}
        </button>`)}
    </div>`);

  const radios = [...host.querySelectorAll('[role="radio"]')];
  let current = null;
  function select(site, { emit = false } = {}) {
    const el = radios.find((r) => r.dataset.site === site) || null;
    if (!el) return;
    setChecked(radios, el);
    const changed = current !== site;
    current = site;
    if (emit && changed) bus.emit('site:select', { site });
  }
  const onClick = (e) => {
    const el = e.target.closest('[role="radio"]');
    if (el && host.contains(el)) {
      const site = el.dataset.site;
      // Re-clicking the current site re-announces it (lets the stage re-focus the spot).
      if (site === current) bus.emit('site:select', { site }); else select(site, { emit: true });
    }
  };
  host.addEventListener('click', onClick);
  const offKeys = roving(radios, { onMove: (el) => select(el.dataset.site, { emit: true }) });
  const offBus = bus.on('site:select', (d) => { if (d?.site && d.site !== current) select(d.site); });

  setChecked(radios, null);
  if (selected) select(selected);

  return {
    select: (site) => select(site, { emit: true }),
    get selected() { return current; },
    destroy() { host.removeEventListener('click', onClick); offKeys(); offBus?.(); },
  };
}

