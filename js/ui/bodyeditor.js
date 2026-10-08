// PeptideScope: body editor (appearance only).
//
//   const editor = mountBodyEditor(host /* #stage-host */, { initial, femaleAvailable, onChange, onToggle, onOpen });
//   editor.open(); editor.close(); editor.toggle(); editor.sync(state); editor.setFemaleAvailable(bool);
//   editor.setLocked(bool); editor.setBusy(bool, text?); editor.state; editor.isOpen; editor.dispose()
//   onChange({ sex, heightCm, weightKg, age })  → the caller emits body:change on the bus
//   onToggle(open, panelElement)               → the stage keeps its labels clear of the panel
//
// A glass panel (#body-editor) inside the 3D stage, opened by a "Body" button in the stage corner:
// Sex, Height, Weight and Age (adults, 18–90). It changes how the 3D body looks and nothing else. The
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
  male: { sex: 'male', heightCm: 175, weightKg: 75, age: 35 },
  female: { sex: 'female', heightCm: 162, weightKg: 65, age: 35 },
};
const NOTE = 'Changes how the body looks. It never changes the timeline or suggests a dose.';

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

export function mountBodyEditor(host, { initial, femaleAvailable = false, onChange, onToggle, onOpen } = {}) {
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
      <div class="be-foot">
        <button type="button" class="be-reset">Reset</button>
        <p class="be-status" role="status" aria-live="polite"></p>
      </div>
    </div>
    <p class="be-note" id="${id('note')}">${NOTE}</p>`;
  host.append(toggle, panel);

  const q = (s) => panel.querySelector(s);
  const closeBtn = q('.be-close');
  const resetBtn = q('.be-reset');
  const statusEl = q('.be-status');
  const radios = [...panel.querySelectorAll('input[type="radio"]')];
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
  function paint() {
    paintSex();
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
