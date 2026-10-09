// PeptideScope: the "Body" panel inside the 3D stage (v4): body shape (appearance only) and the anatomy
// layers (view only), behind ONE small "Body" button.
//
//   const panel = mountBodyEditor(host /* #stage-host */, {
//     initial, femaleAvailable, onChange, onToggle, onOpen, buttonHost,
//     view: { initial: { layers, xray }, muscles, structures, onChange, onFocus },
//   });
//   panel.open(tab?); panel.close(); panel.toggle(); panel.sync(state); panel.setFemaleAvailable(bool);
//   panel.setLocked(bool); panel.setBusy(bool, text?); panel.state; panel.isOpen; panel.showTab('shape' | 'layers');
//   panel.layers → { sync({ layers, xray }), setMuscles(bool), setStructures([{ id, organ, title }]), state }
//   panel.dispose()
//   onChange({ sex, heightCm, weightKg, age, skinTone })   → the caller emits body:change on the bus
//   view.onChange({ layers: { skin, organs, vessels, skeleton, muscles }, xray })   (xray: 0 real skin … 1 see-through)
//   view.onFocus(organId)                                   → the caller emits organ:focus
//   onToggle(open, panelElement)                            → the stage keeps its labels clear of the panel
//
// Shape tab: Sex, Height, Weight, Age (adults, 18–90) and Skin tone. It changes how the 3D body looks and
// nothing else. The panel says so, every shape input carries data-appearance-only, and only js/scene/*
// listens to body:change (enforced by tests/exclusions.test.mjs). Nothing is derived from these values or
// stored. Layers tab: which parts show and the skin look; its inputs carry data-view-only.
//
// Keyboard: the Body button opens and closes the panel; the tabs follow the ARIA tabs pattern (arrow
// keys); Escape closes and returns focus to the button. Reduced motion: no transitions.

const RANGES = {
  heightCm: { min: 145, max: 205, step: 1 },
  weightKg: { min: 40, max: 160, step: 1 },
  age: { min: 18, max: 90, step: 1 },
};
export const BODY_EDITOR_DEFAULTS = {
  male: { sex: 'male', heightCm: 175, weightKg: 75, age: 35, skinTone: 'tone-3' },
  female: { sex: 'female', heightCm: 162, weightKg: 65, age: 35, skinTone: 'tone-3' },
};
const NOTE = 'Changes how the body looks. It never changes the timeline or suggests a dose.';
// Swatches for the real-skin look (the scene holds the same six tones).
export const SKIN_TONE_SWATCHES = [
  { id: 'tone-1', hex: '#e8cbb9', name: 'Tone 1, lightest' },
  { id: 'tone-2', hex: '#d6ae95', name: 'Tone 2' },
  { id: 'tone-3', hex: '#bc9177', name: 'Tone 3' },
  { id: 'tone-4', hex: '#9a7058', name: 'Tone 4' },
  { id: 'tone-5', hex: '#74513d', name: 'Tone 5' },
  { id: 'tone-6', hex: '#4b3427', name: 'Tone 6, deepest' },
];
const TONE_IDS = SKIN_TONE_SWATCHES.map((t) => t.id);
const LAYER_ROWS = [
  { key: 'skin', label: 'Skin' },
  { key: 'organs', label: 'Organs' },
  { key: 'vessels', label: 'Blood vessels' },
  { key: 'skeleton', label: 'Skeleton' },
  { key: 'muscles', label: 'Muscles' },
];

const clampTo = (k, v) => {
  const r = RANGES[k];
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(r.max, Math.max(r.min, n)) : null;
};
export function normalizeBody(d = {}, prev = BODY_EDITOR_DEFAULTS.male) {
  const sex = d.sex === 'female' ? 'female' : d.sex === 'male' ? 'male' : prev.sex;
  return {
    sex,
    heightCm: clampTo('heightCm', d.heightCm) ?? prev.heightCm,
    weightKg: clampTo('weightKg', d.weightKg) ?? prev.weightKg,
    age: clampTo('age', d.age) ?? prev.age,
    skinTone: TONE_IDS.includes(d.skinTone) ? d.skinTone : TONE_IDS.includes(prev.skinTone) ? prev.skinTone : 'tone-3',
  };
}

// imperial companions (display only)
function feetInches(cm) {
  const total = cm / 2.54;
  let ft = Math.floor(total / 12);
  let inch = Math.round(total - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return { ft, inch };
}
const pounds = (kg) => Math.round(kg * 2.20462);
function readouts(key, v) {
  if (key === 'heightCm') {
    const { ft, inch } = feetInches(v);
    return { text: `${v} cm`, alt: `${ft}′ ${inch}″`, valuetext: `${v} centimetres, ${ft} feet ${inch} inches` };
  }
  if (key === 'weightKg') {
    const lb = pounds(v);
    return { text: `${v} kg`, alt: `${lb} lb`, valuetext: `${v} kilograms, ${lb} pounds` };
  }
  return { text: `${v} years`, alt: '', valuetext: `${v} years` };
}

const ICON_FIGURE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.6" r="2.1"/><path d="M8.2 9.2c1.1-.7 2.4-1 3.8-1s2.7.3 3.8 1M12 8.2v6.6M12 14.8l-2.6 6.4M12 14.8l2.6 6.4M8.2 9.2 6.6 13.6M15.8 9.2l1.6 4.4"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

let uid = 0;

export function mountBodyEditor(host, { initial, femaleAvailable = false, onChange, onToggle, onOpen, buttonHost, view = {} } = {}) {
  if (!host) throw new Error('mountBodyEditor: host element required');
  const n = ++uid;
  const id = (s) => `be${n}-${s}`;
  let state = normalizeBody(initial || BODY_EDITOR_DEFAULTS.male);
  let femaleOk = !!femaleAvailable;
  let locked = false;
  let isOpen = false;
  let tab = 'shape';
  let closeTimer = 0;
  let raf = 0;
  // view (layers + skin look)
  let layers = { skin: true, organs: true, vessels: true, skeleton: false, muscles: false, ...(view.initial?.layers || {}) };
  let xray = Number.isFinite(view.initial?.xray) ? view.initial.xray : 1;
  let hasMuscles = !!view.muscles;
  let vraf = 0;

  // ---------------------------------------------------------------- DOM
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'stage-body-btn';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'body-editor');
  toggle.innerHTML = `${ICON_FIGURE}<span class="stage-body-btn__text">Body</span>`;

  const panel = document.createElement('section');
  panel.id = 'body-editor';
  panel.className = 'body-editor';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', id('title'));
  panel.hidden = true;
  const rangeRow = (key, label) => `
    <div class="be-field be-range" data-key="${key}">
      <div class="be-row">
        <label class="be-label" for="${id(key)}">${label}</label>
        <span class="be-read" aria-hidden="true"><span class="be-num" data-num></span><span class="be-alt" data-alt></span></span>
      </div>
      <input class="be-slider" id="${id(key)}" name="${key}" type="range" min="${RANGES[key].min}" max="${RANGES[key].max}" step="${RANGES[key].step}" data-appearance-only>
    </div>`;
  panel.innerHTML = `
    <header class="be-head">
      <h3 class="be-title" id="${id('title')}">Body</h3>
      <button type="button" class="be-close" aria-label="Close the body panel">${ICON_CLOSE}</button>
    </header>
    <div class="be-tabs" role="tablist" aria-label="Body panel">
      <button type="button" class="be-tab" role="tab" id="${id('tab-shape')}" aria-controls="${id('pane-shape')}" data-tab="shape">Shape</button>
      <button type="button" class="be-tab" role="tab" id="${id('tab-layers')}" aria-controls="${id('pane-layers')}" data-tab="layers">Layers</button>
    </div>
    <div class="be-pane" role="tabpanel" id="${id('pane-shape')}" aria-labelledby="${id('tab-shape')}" data-pane="shape">
      <fieldset class="be-field be-sex">
        <legend class="be-label">Sex</legend>
        <div class="be-seg">
          <label class="be-seg__opt"><input type="radio" name="${id('sex')}" value="male" data-appearance-only><span>Male</span></label>
          <label class="be-seg__opt" data-female><input type="radio" name="${id('sex')}" value="female" data-appearance-only><span>Female</span></label>
        </div>
      </fieldset>
      ${rangeRow('heightCm', 'Height')}
      ${rangeRow('weightKg', 'Weight')}
      ${rangeRow('age', 'Age')}
      <fieldset class="be-field be-tones">
        <legend class="be-label">Skin tone</legend>
        <div class="be-tone-row">
          ${SKIN_TONE_SWATCHES.map((t) => `<label class="be-tone" title="${t.name}"><input type="radio" name="${id('tone')}" value="${t.id}" aria-label="${t.name}" data-appearance-only><span class="be-tone__sw" style="--sw:${t.hex}" aria-hidden="true"></span></label>`).join('')}
        </div>
        <p class="be-hint">You see it with the real-skin look (Layers tab).</p>
      </fieldset>
      <p class="be-note" id="${id('note')}">${NOTE}</p>
      <div class="be-foot">
        <button type="button" class="be-reset">Reset</button>
        <p class="be-status" role="status" aria-live="polite"></p>
      </div>
    </div>
    <div class="be-pane" role="tabpanel" id="${id('pane-layers')}" aria-labelledby="${id('tab-layers')}" data-pane="layers" hidden>
      <fieldset class="be-field lp-show">
        <legend class="be-label">Show</legend>
        <div class="lp-switches">
          ${LAYER_ROWS.map((r) => `<label class="lp-switch" data-layer="${r.key}"><input type="checkbox" name="${r.key}" data-view-only><span class="lp-switch__box" aria-hidden="true"></span><span class="lp-switch__text">${r.label}</span></label>`).join('')}
        </div>
      </fieldset>
      <div class="be-field be-range lp-look">
        <div class="be-row">
          <label class="be-label" for="${id('xray')}">Skin look</label>
          <span class="be-read" aria-hidden="true"><span class="be-num" data-read></span></span>
        </div>
        <input class="be-slider" id="${id('xray')}" type="range" min="0" max="100" step="1" data-view-only>
        <div class="lp-ends"><button type="button" class="lp-end" data-x="0">Real skin</button><button type="button" class="lp-end" data-x="100">See-through</button></div>
      </div>
      <details class="be-field lp-structures">
        <summary class="be-label">Find a part</summary>
        <ul class="lp-list" role="list"></ul>
      </details>
      <p class="be-note">Tap or point at any part to see its name. Pinch or scroll to zoom in; double-tap or double-click to fly closer.</p>
    </div>`;
  (buttonHost || host).append(toggle);
  host.append(panel);

  const q = (s) => panel.querySelector(s);
  const closeBtn = q('.be-close');
  const resetBtn = q('.be-reset');
  const statusEl = q('.be-status');
  const tabs = [...panel.querySelectorAll('.be-tab')];
  const panes = [...panel.querySelectorAll('.be-pane')];
  const radios = [...panel.querySelectorAll('.be-sex input[type="radio"]')];
  const tones = [...panel.querySelectorAll('.be-tones input[type="radio"]')];
  const femaleLabel = q('[data-female]');
  const sliders = {};
  for (const key of Object.keys(RANGES)) {
    const row = q(`.be-range[data-key="${key}"]`);
    sliders[key] = { input: row.querySelector('input'), num: row.querySelector('[data-num]'), alt: row.querySelector('[data-alt]') };
  }
  const boxes = [...panel.querySelectorAll('.lp-switch input')];
  const look = q(`#${id('xray')}`);
  const lookRead = q('[data-read]');
  const list = q('.lp-list');
  const muscleRow = q('[data-layer="muscles"]');

  // ---------------------------------------------------------------- render
  function paintSlider(key) {
    const s = sliders[key];
    const v = state[key];
    const r = RANGES[key];
    if (String(s.input.value) !== String(v)) s.input.value = String(v);
    s.input.style.setProperty('--p', `${((v - r.min) / (r.max - r.min)) * 100}%`);
    const t = readouts(key, v);
    s.num.textContent = t.text;
    s.alt.textContent = t.alt;
    s.alt.hidden = !t.alt;
    s.input.setAttribute('aria-valuetext', t.valuetext);
    s.input.disabled = locked;
  }
  function paintSex() {
    for (const r of radios) r.checked = r.value === state.sex;
    const fr = radios.find((r) => r.value === 'female');
    fr.disabled = !femaleOk || locked;
    femaleLabel.classList.toggle('is-unavailable', !femaleOk);
    femaleLabel.title = femaleOk ? '' : 'Loading the female body…';
    radios.find((r) => r.value === 'male').disabled = locked;
  }
  function paintTone() {
    for (const r of tones) { r.checked = r.value === state.skinTone; r.disabled = locked; }
  }
  const lookText = (v) => (v <= 0.02 ? 'Real skin' : v >= 0.98 ? 'See-through' : `${Math.round(v * 100)}% see-through`);
  function paintView() {
    for (const b of boxes) { b.checked = !!layers[b.name]; b.disabled = locked; }
    muscleRow.hidden = !hasMuscles;
    const v = Math.round(xray * 100);
    if (String(look.value) !== String(v)) look.value = String(v);
    look.disabled = locked;
    look.style.setProperty('--p', `${v}%`);
    lookRead.textContent = lookText(xray);
    look.setAttribute('aria-valuetext', lookText(xray));
  }
  function paintTabs() {
    for (const t of tabs) {
      const on = t.dataset.tab === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    }
    for (const p of panes) p.hidden = p.dataset.pane !== tab;
    resetBtn.disabled = locked;
  }
  function paint() {
    paintSex();
    paintTone();
    for (const key of Object.keys(RANGES)) paintSlider(key);
    paintView();
    paintTabs();
  }

  // ---------------------------------------------------------------- emit (coalesced per frame while dragging)
  function emitNow() {
    cancelAnimationFrame(raf); raf = 0;
    try { onChange?.({ ...state }); } catch (e) { console.error('[body panel] onChange failed', e); }
  }
  function emitSoon() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; emitNow(); });
  }
  function emitView() {
    cancelAnimationFrame(vraf); vraf = 0;
    try { view.onChange?.({ layers: { ...layers }, xray }); } catch (e) { console.error('[body panel] view onChange failed', e); }
  }
  function emitViewSoon() { if (!vraf) vraf = requestAnimationFrame(() => { vraf = 0; emitView(); }); }

  // ---------------------------------------------------------------- input: shape
  for (const key of Object.keys(RANGES)) {
    const s = sliders[key];
    s.input.addEventListener('input', () => {
      const v = clampTo(key, s.input.value);
      if (v == null || v === state[key]) return;
      state = { ...state, [key]: v };
      paintSlider(key);
      emitSoon();
    });
    s.input.addEventListener('change', () => emitNow());
  }
  for (const r of radios) {
    r.addEventListener('change', () => {
      if (!r.checked || r.value === state.sex) return;
      if (r.value === 'female' && !femaleOk) { paintSex(); return; }
      const from = BODY_EDITOR_DEFAULTS[state.sex];
      const to = BODY_EDITOR_DEFAULTS[r.value];
      // untouched height and weight follow the new default; values the visitor set are kept
      const next = { ...state, sex: r.value };
      if (state.heightCm === from.heightCm) next.heightCm = to.heightCm;
      if (state.weightKg === from.weightKg) next.weightKg = to.weightKg;
      state = next;
      paint();
      emitNow();
    });
  }
  for (const r of tones) {
    r.addEventListener('change', () => {
      if (!r.checked || r.value === state.skinTone) return;
      state = { ...state, skinTone: r.value };
      paintTone();
      emitNow();
    });
  }
  resetBtn.addEventListener('click', () => {
    if (locked) return;
    state = { ...BODY_EDITOR_DEFAULTS[state.sex] };
    paint();
    emitNow();
  });

  // ---------------------------------------------------------------- input: layers
  for (const b of boxes) b.addEventListener('change', () => { layers = { ...layers, [b.name]: b.checked }; paintView(); emitView(); });
  look.addEventListener('input', () => { xray = Math.min(1, Math.max(0, Number(look.value) / 100)); paintView(); emitViewSoon(); });
  look.addEventListener('change', () => emitView());
  for (const e of panel.querySelectorAll('.lp-end')) {
    e.addEventListener('click', () => { if (locked) return; xray = Number(e.dataset.x) / 100; paintView(); emitView(); });
  }
  function setStructures(items = []) {
    list.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lp-item';
      b.textContent = it.title;
      b.addEventListener('click', () => { try { view.onFocus?.(it.organ || it.id); } catch (e) { console.error(e); } });
      li.append(b);
      list.append(li);
    }
  }

  // ---------------------------------------------------------------- tabs
  function showTab(name, { focus = false } = {}) {
    tab = name === 'layers' ? 'layers' : 'shape';
    paintTabs();
    if (focus) tabs.find((t) => t.dataset.tab === tab)?.focus({ preventScroll: true });
  }
  for (const t of tabs) {
    t.addEventListener('click', () => showTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const i = tabs.indexOf(t);
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        showTab(tabs[j].dataset.tab, { focus: true });
      }
    });
  }

  // ---------------------------------------------------------------- open / close
  const reduced = () => document.documentElement.dataset.motion === 'reduce'
    || (document.documentElement.dataset.motion !== 'full' && !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  function open(which) {
    if (locked) return;
    if (which) showTab(which);
    if (isOpen) return;
    isOpen = true;
    clearTimeout(closeTimer);
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    host.classList.add('has-body-editor-open');
    if (reduced()) panel.classList.add('is-open');
    else requestAnimationFrame(() => { if (isOpen) panel.classList.add('is-open'); });
    try { onToggle?.(true, panel); onOpen?.(); } catch (e) { console.error(e); }
    // Bring the panel into view before focusing it (a11y review: on a phone it opened under the fixed
    // disclaimer bar, so focus went somewhere nobody could see). html scroll-padding keeps it clear of
    // the header and the bar.
    // When the whole stage (body + sheet) fits between the header and the bar, bring all of it into view,
    // so the body being edited shows in full; otherwise just the panel.
    const rootCss = getComputedStyle(document.documentElement);
    const bar = parseFloat(rootCss.getPropertyValue('--disclaimer-h')) || 0;
    const head = parseFloat(rootCss.getPropertyValue('--header-h')) || 0;
    const r = panel.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const behavior = reduced() ? 'auto' : 'smooth';
    if (hr.height <= innerHeight - bar - head - 32) {
      if (hr.top < head || hr.bottom > innerHeight - bar) host.scrollIntoView({ block: 'nearest', behavior });
    } else if (r.bottom > innerHeight - bar || r.top < 0) panel.scrollIntoView({ block: 'nearest', behavior });
    tabs.find((t) => t.dataset.tab === tab)?.focus({ preventScroll: true });
  }
  function close({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    const hadFocus = panel.contains(document.activeElement);
    panel.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    host.classList.remove('has-body-editor-open');
    clearTimeout(closeTimer);
    if (reduced()) panel.hidden = true;
    else closeTimer = setTimeout(() => { if (!isOpen) panel.hidden = true; }, 220);
    if (restoreFocus && hadFocus) toggle.focus({ preventScroll: true });
    try { onToggle?.(false, panel); } catch (e) { console.error(e); }
  }
  const toggleOpen = () => (isOpen ? close() : open());
  toggle.addEventListener('click', () => { if (!locked) toggleOpen(); });
  closeBtn.addEventListener('click', () => close());
  const onKey = (e) => {
    if (e.key === 'Escape' && isOpen) { e.preventDefault(); e.stopPropagation(); close(); }
  };
  panel.addEventListener('keydown', onKey);
  toggle.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- state from outside
  function setLocked(on) {
    locked = !!on;
    toggle.setAttribute('aria-disabled', String(locked));
    toggle.title = locked ? 'Available when the animation ends' : 'Change the body and what you can see';
    if (locked && isOpen) close();
    paint();
  }
  function setFemaleAvailable(on) {
    femaleOk = !!on;
    if (!femaleOk && state.sex === 'female') state = { ...state, sex: 'male' };
    paintSex();
  }
  function setBusy(on, text = '') {
    panel.setAttribute('aria-busy', String(!!on));
    statusEl.textContent = on ? text : '';
  }
  function sync(next) {
    const s = normalizeBody(next, state);
    if (s.sex === 'female' && !femaleOk) s.sex = 'male';
    state = s;
    paint();
  }

  setStructures(view.structures || []);
  setLocked(false);
  paint();

  const layersApi = {
    sync(next = {}) {
      if (next.layers) layers = { ...layers, ...next.layers };
      if (Number.isFinite(next.xray)) xray = Math.min(1, Math.max(0, next.xray));
      paintView();
    },
    setMuscles(on) { hasMuscles = !!on; if (!hasMuscles) layers.muscles = false; paintView(); },
    setStructures,
    setLocked,
    get state() { return { layers: { ...layers }, xray }; },
    get isOpen() { return isOpen && tab === 'layers'; },
    open: () => open('layers'),
    close,
    elements: { toggle, panel, slider: look },
  };

  return {
    open, close, toggle: toggleOpen, sync, setLocked, setFemaleAvailable, setBusy, showTab,
    get state() { return { ...state }; },
    get isOpen() { return isOpen; },
    get tab() { return tab; },
    get femaleAvailable() { return femaleOk; },
    layers: layersApi,
    elements: { toggle, panel },
    dispose() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(vraf);
      clearTimeout(closeTimer);
      toggle.remove();
      panel.remove();
      host.classList.remove('has-body-editor-open');
    },
  };
}
