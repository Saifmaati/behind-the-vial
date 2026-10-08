// PeptideScope: body editor (appearance only) and the anatomy layers panel (view only).
//
//   const editor = mountBodyEditor(host /* #stage-host */, { initial, femaleAvailable, onChange, onToggle, onOpen, buttonHost });
//   editor.open(); editor.close(); editor.toggle(); editor.sync(state); editor.setFemaleAvailable(bool);
//   editor.setLocked(bool); editor.setBusy(bool, text?); editor.state; editor.isOpen; editor.dispose()
//   onChange({ sex, heightCm, weightKg, age, skinTone })  → the caller emits body:change on the bus
//   onToggle(open, panelElement)                         → the stage keeps its labels clear of the panel
//
//   const layers = mountLayersPanel(host, { initial: { layers, xray }, muscles, structures, onChange, onFocus, onToggle, buttonHost });
//   layers.open(); layers.close(); layers.sync({ layers, xray }); layers.setMuscles(bool); layers.setStructures([{ id, organ, title }]);
//   layers.setLocked(bool); layers.isOpen; layers.dispose()
//   onChange({ layers: { skin, organs, vessels, skeleton, muscles }, xray })   (xray: 0 lifelike … 1 glass)
//   onFocus(organId)   → the caller emits organ:focus (keyboard route to every structure)
//
// A glass panel (#body-editor) inside the 3D stage, opened by a "Body" button in the stage corner:
// Sex, Height, Weight, Age (adults, 18–90) and Skin tone. It changes how the 3D body looks and nothing else. The
// panel says so, every input carries data-appearance-only, and only js/scene/* listens to the
// body:change event (enforced by tests/exclusions.test.mjs). No index, category or health judgement
// is ever derived or shown, and the values are never stored.
//
// Keyboard: the Body button opens and closes the panel; Escape closes it and returns focus to the
// button; arrow keys move the sliders and switch Male / Female. Reduced motion: no transitions.

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
// Swatches for the lifelike skin (the scene holds the same six tones).
export const SKIN_TONE_SWATCHES = [
  { id: 'tone-1', hex: '#e8cbb9', name: 'Tone 1, lightest' },
  { id: 'tone-2', hex: '#d6ae95', name: 'Tone 2' },
  { id: 'tone-3', hex: '#bc9177', name: 'Tone 3' },
  { id: 'tone-4', hex: '#9a7058', name: 'Tone 4' },
  { id: 'tone-5', hex: '#74513d', name: 'Tone 5' },
  { id: 'tone-6', hex: '#4b3427', name: 'Tone 6, deepest' },
];
const TONE_IDS = SKIN_TONE_SWATCHES.map((t) => t.id);

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
    return { num: String(v), unit: 'cm', alt: `${ft}′ ${inch}″`, valuetext: `${v} centimetres, ${ft} feet ${inch} inches` };
  }
  if (key === 'weightKg') {
    const lb = pounds(v);
    return { num: String(v), unit: 'kg', alt: `${lb} lb`, valuetext: `${v} kilograms, ${lb} pounds` };
  }
  return { num: String(v), unit: 'years', alt: '', valuetext: `${v} years` };
}

const ICON_FIGURE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.6" r="2.1"/><path d="M8.2 9.2c1.1-.7 2.4-1 3.8-1s2.7.3 3.8 1M12 8.2v6.6M12 14.8l-2.6 6.4M12 14.8l2.6 6.4M8.2 9.2 6.6 13.6M15.8 9.2l1.6 4.4"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

let uid = 0;

export function mountBodyEditor(host, { initial, femaleAvailable = false, onChange, onToggle, onOpen, buttonHost } = {}) {
  if (!host) throw new Error('mountBodyEditor: host element required');
  const n = ++uid;
  const id = (s) => `be${n}-${s}`;
  let state = normalizeBody(initial || BODY_EDITOR_DEFAULTS.male);
  let femaleOk = !!femaleAvailable;
  let locked = false;
  let isOpen = false;
  let closeTimer = 0;
  let raf = 0;

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
  panel.setAttribute('aria-describedby', id('note'));
  panel.hidden = true;
  const rangeRow = (key, label) => `
    <div class="be-field be-range" data-key="${key}">
      <div class="be-row">
        <label class="be-label" for="${id(key)}">${label}</label>
        <span class="be-read" aria-hidden="true"><span class="be-num" data-num></span><span class="be-unit" data-unit></span><span class="be-alt" data-alt></span></span>
      </div>
      <input class="be-slider" id="${id(key)}" name="${key}" type="range" min="${RANGES[key].min}" max="${RANGES[key].max}" step="${RANGES[key].step}" data-appearance-only>
    </div>`;
  panel.innerHTML = `
    <header class="be-head">
      <p class="be-eyebrow">Appearance only</p>
      <h3 class="be-title" id="${id('title')}">Shape the body</h3>
      <button type="button" class="be-close" aria-label="Close body settings">${ICON_CLOSE}</button>
    </header>
    <div class="be-body">
      <fieldset class="be-field be-sex">
        <legend class="be-label">Sex</legend>
        <div class="be-seg">
          <label class="be-seg__opt"><input type="radio" name="${id('sex')}" value="male" data-appearance-only><span class="be-seg__text">Male</span></label>
          <label class="be-seg__opt" data-female><input type="radio" name="${id('sex')}" value="female" data-appearance-only><span class="be-seg__text">Female</span><small class="be-seg__soon"> anatomy loading soon</small></label>
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
        <p class="be-hint">Shows when the skin look is set to lifelike (Layers).</p>
      </fieldset>
      <div class="be-foot">
        <button type="button" class="be-reset">Reset</button>
        <p class="be-status" role="status" aria-live="polite"></p>
      </div>
    </div>
    <p class="be-note" id="${id('note')}">${NOTE}</p>`;
  (buttonHost || host).append(toggle);
  host.append(panel);

  const q = (s) => panel.querySelector(s);
  const closeBtn = q('.be-close');
  const resetBtn = q('.be-reset');
  const statusEl = q('.be-status');
  const radios = [...panel.querySelectorAll('.be-sex input[type="radio"]')];
  const tones = [...panel.querySelectorAll('.be-tones input[type="radio"]')];
  const femaleLabel = q('[data-female]');
  const sliders = {};
  for (const key of Object.keys(RANGES)) {
    const row = q(`.be-range[data-key="${key}"]`);
    sliders[key] = { input: row.querySelector('input'), num: row.querySelector('[data-num]'), unit: row.querySelector('[data-unit]'), alt: row.querySelector('[data-alt]') };
  }

  // ---------------------------------------------------------------- render
  function paintSlider(key) {
    const s = sliders[key];
    const v = state[key];
    const r = RANGES[key];
    if (String(s.input.value) !== String(v)) s.input.value = String(v);
    s.input.style.setProperty('--p', `${((v - r.min) / (r.max - r.min)) * 100}%`);
    const t = readouts(key, v);
    s.num.textContent = t.num;
    s.unit.textContent = t.unit;
    s.alt.textContent = t.alt;
    s.alt.hidden = !t.alt;
    s.input.setAttribute('aria-valuetext', t.valuetext);
  }
  function paintSex() {
    for (const r of radios) r.checked = r.value === state.sex;
    const fr = radios.find((r) => r.value === 'female');
    fr.disabled = !femaleOk || locked;
    femaleLabel.classList.toggle('is-unavailable', !femaleOk);
    femaleLabel.querySelector('.be-seg__soon').hidden = femaleOk;
    radios.find((r) => r.value === 'male').disabled = locked;
  }
  function paintTone() {
    for (const r of tones) { r.checked = r.value === state.skinTone; r.disabled = locked; }
  }
  function paint() {
    paintSex();
    paintTone();
    for (const key of Object.keys(RANGES)) paintSlider(key);
  }

  // ---------------------------------------------------------------- emit (coalesced per frame while dragging)
  function emitNow() {
    cancelAnimationFrame(raf); raf = 0;
    try { onChange?.({ ...state }); } catch (e) { console.error('[bodyeditor] onChange failed', e); }
  }
  function emitSoon() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; emitNow(); });
  }

  // ---------------------------------------------------------------- input
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
    state = { ...BODY_EDITOR_DEFAULTS[state.sex] };
    paint();
    emitNow();
  });

  // ---------------------------------------------------------------- open / close
  const reduced = () => document.documentElement.dataset.motion === 'reduce'
    || (document.documentElement.dataset.motion !== 'full' && !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  function open() {
    if (isOpen || locked) return;
    isOpen = true;
    clearTimeout(closeTimer);
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    host.classList.add('has-body-editor-open');
    if (reduced()) panel.classList.add('is-open');
    else requestAnimationFrame(() => { if (isOpen) panel.classList.add('is-open'); });
    const first = radios.find((r) => r.checked && !r.disabled) || sliders.heightCm.input;
    first.focus({ preventScroll: true });
    try { onToggle?.(true, panel); onOpen?.(); } catch (e) { console.error(e); }
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
    else closeTimer = setTimeout(() => { if (!isOpen) panel.hidden = true; }, 260);
    if (restoreFocus && hadFocus) toggle.focus({ preventScroll: true });
    try { onToggle?.(false, panel); } catch (e) { console.error(e); }
  }
  const toggleOpen = () => (isOpen ? close() : open());
  toggle.addEventListener('click', () => {
    if (locked) return;
    toggleOpen();
  });
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
    toggle.title = locked ? 'Available when the animation ends' : 'Change how the body looks';
    if (locked && isOpen) close();
    paintSex();
    paintTone();
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

  setLocked(false);
  paint();

  return {
    open, close, toggle: toggleOpen, sync, setLocked, setFemaleAvailable, setBusy,
    get state() { return { ...state }; },
    get isOpen() { return isOpen; },
    get femaleAvailable() { return femaleOk; },
    elements: { toggle, panel },
    dispose() {
      cancelAnimationFrame(raf);
      clearTimeout(closeTimer);
      toggle.remove();
      panel.remove();
      host.classList.remove('has-body-editor-open');
    },
  };
}

// =====================================================================================
// Anatomy layers panel (view only): which structures show, the skin look and a keyboard route to
// every structure. Opened by a "Layers" button beside "Body". Nothing here reaches the timeline.
// =====================================================================================
const LAYER_ROWS = [
  { key: 'skin', label: 'Skin' },
  { key: 'muscles', label: 'Muscles' },
  { key: 'skeleton', label: 'Skeleton' },
  { key: 'organs', label: 'Organs' },
  { key: 'vessels', label: 'Blood vessels' },
];
const ICON_LAYERS = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16 9 4.5 9-4.5"/></svg>';

export function mountLayersPanel(host, { initial = {}, muscles = false, structures = [], onChange, onFocus, onToggle, buttonHost } = {}) {
  if (!host) throw new Error('mountLayersPanel: host element required');
  const n = ++uid;
  const id = (s) => `lp${n}-${s}`;
  let layers = { skin: true, organs: true, vessels: true, skeleton: true, muscles: false, ...(initial.layers || {}) };
  let xray = Number.isFinite(initial.xray) ? initial.xray : 1;
  let hasMuscles = !!muscles;
  let locked = false;
  let isOpen = false;
  let closeTimer = 0;
  let raf = 0;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'stage-body-btn stage-layers-btn';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'layers-panel');
  toggle.innerHTML = `${ICON_LAYERS}<span class="stage-body-btn__text">Layers</span>`;

  const panel = document.createElement('section');
  panel.id = 'layers-panel';
  panel.className = 'body-editor layers-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', id('title'));
  panel.hidden = true;
  panel.innerHTML = `
    <header class="be-head">
      <p class="be-eyebrow">View</p>
      <h3 class="be-title" id="${id('title')}">Anatomy layers</h3>
      <button type="button" class="be-close" aria-label="Close anatomy layers">${ICON_CLOSE}</button>
    </header>
    <div class="be-body">
      <fieldset class="be-field lp-show">
        <legend class="be-label">Show</legend>
        <div class="lp-switches">
          ${LAYER_ROWS.map((r) => `<label class="lp-switch" data-layer="${r.key}"><input type="checkbox" name="${r.key}" data-view-only><span class="lp-switch__box" aria-hidden="true"></span><span class="lp-switch__text">${r.label}</span></label>`).join('')}
        </div>
      </fieldset>
      <div class="be-field be-range lp-look">
        <div class="be-row">
          <label class="be-label" for="${id('xray')}">Skin look</label>
          <span class="be-read" aria-hidden="true"><span class="lp-read" data-read></span></span>
        </div>
        <input class="be-slider" id="${id('xray')}" type="range" min="0" max="100" step="1" data-view-only>
        <div class="lp-ends"><button type="button" class="lp-end" data-x="0">Lifelike</button><button type="button" class="lp-end" data-x="100">Glass</button></div>
      </div>
      <details class="be-field lp-structures">
        <summary class="be-label">Structures</summary>
        <ul class="lp-list" role="list"></ul>
      </details>
    </div>
    <p class="be-note">Point at any part of the body to name it. Scroll or pinch toward a spot to zoom in; double-click or double-tap flies there.</p>`;
  (buttonHost || host).append(toggle);
  host.append(panel);

  const q = (s) => panel.querySelector(s);
  const boxes = [...panel.querySelectorAll('.lp-switch input')];
  const slider = q(`#${id('xray')}`);
  const read = q('[data-read]');
  const list = q('.lp-list');
  const closeBtn = q('.be-close');
  const muscleRow = q('[data-layer="muscles"]');

  const lookText = (v) => (v <= 0.02 ? 'Lifelike' : v >= 0.98 ? 'Glass' : `${Math.round(v * 100)}% glass`);
  function paint() {
    for (const b of boxes) { b.checked = !!layers[b.name]; b.disabled = locked; }
    muscleRow.hidden = !hasMuscles;
    const v = Math.round(xray * 100);
    if (String(slider.value) !== String(v)) slider.value = String(v);
    slider.disabled = locked;
    slider.style.setProperty('--p', `${v}%`);
    read.textContent = lookText(xray);
    slider.setAttribute('aria-valuetext', lookText(xray));
  }
  function setStructures(items = []) {
    list.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lp-item';
      b.textContent = it.title;
      b.addEventListener('click', () => { try { onFocus?.(it.organ || it.id); } catch (e) { console.error(e); } });
      li.append(b);
      list.append(li);
    }
  }
  function emitNow() {
    cancelAnimationFrame(raf); raf = 0;
    try { onChange?.({ layers: { ...layers }, xray }); } catch (e) { console.error('[layers] onChange failed', e); }
  }
  function emitSoon() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; emitNow(); }); }

  for (const b of boxes) b.addEventListener('change', () => { layers = { ...layers, [b.name]: b.checked }; paint(); emitNow(); });
  slider.addEventListener('input', () => { xray = Math.min(1, Math.max(0, Number(slider.value) / 100)); paint(); emitSoon(); });
  slider.addEventListener('change', () => emitNow());
  for (const e of panel.querySelectorAll('.lp-end')) {
    e.addEventListener('click', () => { if (locked) return; xray = Number(e.dataset.x) / 100; paint(); emitNow(); });
  }

  const reduced = () => document.documentElement.dataset.motion === 'reduce'
    || (document.documentElement.dataset.motion !== 'full' && !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  function open() {
    if (isOpen) return;
    isOpen = true;
    clearTimeout(closeTimer);
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    host.classList.add('has-layers-open');
    if (reduced()) panel.classList.add('is-open');
    else requestAnimationFrame(() => { if (isOpen) panel.classList.add('is-open'); });
    (boxes.find((b) => !b.disabled && !b.closest('[hidden]')) || slider).focus({ preventScroll: true });
    try { onToggle?.(true, panel); } catch (e) { console.error(e); }
  }
  function close({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    const hadFocus = panel.contains(document.activeElement);
    panel.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    host.classList.remove('has-layers-open');
    clearTimeout(closeTimer);
    if (reduced()) panel.hidden = true;
    else closeTimer = setTimeout(() => { if (!isOpen) panel.hidden = true; }, 260);
    if (restoreFocus && hadFocus) toggle.focus({ preventScroll: true });
    try { onToggle?.(false, panel); } catch (e) { console.error(e); }
  }
  toggle.addEventListener('click', () => (isOpen ? close() : open()));
  closeBtn.addEventListener('click', () => close());
  const onKey = (e) => { if (e.key === 'Escape' && isOpen) { e.preventDefault(); e.stopPropagation(); close(); } };
  panel.addEventListener('keydown', onKey);
  toggle.addEventListener('keydown', onKey);

  setStructures(structures);
  paint();
  return {
    open, close,
    sync(next = {}) {
      if (next.layers) layers = { ...layers, ...next.layers };
      if (Number.isFinite(next.xray)) xray = Math.min(1, Math.max(0, next.xray));
      paint();
    },
    setMuscles(on) { hasMuscles = !!on; if (!hasMuscles) layers.muscles = false; paint(); },
    setStructures,
    setLocked(on) {
      locked = !!on;
      toggle.title = locked ? 'The view returns to your choice when the animation ends' : 'Choose which parts of the anatomy show';
      paint();
    },
    get isOpen() { return isOpen; },
    get state() { return { layers: { ...layers }, xray }; },
    elements: { toggle, panel },
    dispose() {
      cancelAnimationFrame(raf);
      clearTimeout(closeTimer);
      toggle.remove();
      panel.remove();
      host.classList.remove('has-layers-open');
    },
  };
}
