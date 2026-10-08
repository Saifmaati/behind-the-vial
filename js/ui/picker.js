// Behind the Vial: peptide picker and injection-site picker.
// Both are ARIA radiogroups with roving tabindex (one tab stop; arrows, Home and
// End move and select). Pickers only EMIT selections; main.js loads content.
import { bus } from './busref.js';
import { html, STATUS, SITES } from './util.js';
import { bodyGlyph } from './icons.js';

function statusPill(level, { small = true } = {}) {
  const s = STATUS[level] || { label: 'Status unknown', tone: 'neutral' };
  return html`<span class="c-status c-status--${level || 'unknown'}${small ? ' c-status--sm' : ''}"><span class="c-status__shape" aria-hidden="true"></span>${s.label}</span>`;
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
 * Peptide chips. Retatrutide (ready) is first and featured; coming-soon chips stay
 * selectable and show a status badge plus "Coming soon".
 * Emits peptide:select { id }. Reflects external peptide:select.
 */
export function mountPicker(host, peptides = [], { selectedId } = {}) {
  if (!host) return { select() {}, destroy() {} };
  const list = [...peptides].sort((a, b) => (b.id === 'retatrutide') - (a.id === 'retatrutide') || (b.ready === true) - (a.ready === true));
  const ready = list.filter((p) => p.ready);
  const soon = list.filter((p) => !p.ready);

  const chip = (p) => html`
    <button type="button" role="radio" aria-checked="false" tabindex="-1"
      class="c-pchip ${p.ready ? 'c-pchip--ready' : 'c-pchip--soon'}" data-peptide-id="${p.id}"
      ${p.aka?.length ? html`title="${p.aka.join(', ')}"` : ''}>
      <span class="c-pchip__radio" aria-hidden="true"></span>
      <span class="c-pchip__text">${p.ready ? html`
        <span class="c-pchip__name">${p.name}</span>
        <span class="c-pchip__meta">${statusPill(p.status)}<span class="c-pchip__tag">Full entry</span></span>` : html`
        <span class="c-pchip__row"><span class="c-pchip__name">${p.name}</span><span class="c-pchip__tag c-pchip__tag--soon">Coming soon</span></span>
        <span class="c-pchip__meta">${statusPill(p.status)}</span>`}
      </span>
    </button>`;

  if (!host.getAttribute('role')) host.setAttribute('role', 'radiogroup');
  if (!host.hasAttribute('aria-label') && !host.hasAttribute('aria-labelledby')) host.setAttribute('aria-label', 'Choose a peptide');
  host.innerHTML = String(html`
    <div class="c-picker">
      ${ready.length ? html`<div class="c-picker__lead">${ready.map(chip)}</div>` : ''}
      ${soon.length ? html`
        <p class="c-picker__label" aria-hidden="true"><span>Coming soon</span><span class="c-picker__count">${soon.length}</span></p>
        <div class="c-picker__rail">${soon.map(chip)}</div>` : ''}
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
    // Arrowing through 21 chips should not load every entry on the way.
    if (defer) timer = setTimeout(() => emit(id), 260); else emit(id);
  }

  const onClick = (e) => {
    const el = e.target.closest('[role="radio"]');
    if (el && host.contains(el)) select(el.dataset.peptideId, { emit: true });
  };
  host.addEventListener('click', onClick);
  const offKeys = roving(radios, { onMove: (el) => select(el.dataset.peptideId, { emit: true, defer: true }) });
  const offBus = bus.on('peptide:select', (d) => { if (d?.id && d.id !== current) select(d.id); });

  setChecked(radios, null);
  if (selectedId) select(selectedId);

  return {
    select: (id) => select(id, { emit: true }),
    get selected() { return current; },
    destroy() { clearTimeout(timer); host.removeEventListener('click', onClick); offKeys(); offBus?.(); },
  };
}

/**
 * Injection-site picker: three large buttons with small anatomical glyphs.
 * Emits site:select { site }. Reflects external site:select (e.g. 3D hotspot clicks).
 */
export function mountSitePicker(host, { selected } = {}) {
  if (!host) return { select() {}, destroy() {} };
  if (!host.getAttribute('role')) host.setAttribute('role', 'radiogroup');
  if (!host.hasAttribute('aria-label') && !host.hasAttribute('aria-labelledby')) host.setAttribute('aria-label', 'Choose where the shot goes');
  host.innerHTML = String(html`
    <div class="c-sites">
      ${SITES.map((s) => html`
        <button type="button" role="radio" aria-checked="false" tabindex="-1" class="c-site" data-site="${s.id}">
          <span class="c-site__glyph">${bodyGlyph(s.id, { size: 58 })}</span>
          <span class="c-site__label">${s.label}</span>
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

