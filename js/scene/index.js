// PeptideScope: the only 3D entry point main.js uses (body).
//
//   const body = await mountBody(host /* #stage-host */, { reducedMotion, theme, creditHref });
//   body.dispose();
//
// Listens: site:select, sequence:start, time:change, effects:active, risk:change, organ:focus,
//          theme:change, peptide:loaded, body:change, motion:change
// Emits:   site:select (hotspot / site label click), organ:focus (callout or organ click),
//          sequence:phase, sequence:done (via the injection module), stage:ready,
//          body:change { sex, heightCm, weightKg, age, skinTone } (from the Body panel it mounts in the stage)
//
// v4 (simpler, faster, for teens): one small "Body" button opens one panel with two tabs: Shape (sex,
// height, weight, age, skin tone; appearance only) and Layers (skin, organs, blood vessels, skeleton,
// muscles once the detail model is in, and the skin look from real skin to see-through). The stage draws
// only while something changes (stage.js). No HUD: a short hint, the zoom buttons, the anatomy credit,
// and a colour key that appears with the injection.
//
// Editable body (appearance only): body:change reaches only this scene: height scales the anatomy about
// the feet, weight offsets the skin by region and thickens or thins the fat layer of the injection
// cross-section, age adds a slight stature loss and shifts fat toward the abdomen, Female swaps in
// body-female.glb. It never touches the timeline, the effects, the risk check or any content. Locked
// while the injection sequence plays.
//
// Labels and zoom: pointing at a structure names it (hover on desktop, tap on touch) with its plain name
// from the atlas (fetched on the first label); the wheel and pinch zoom toward the surface under the
// pointer; double-click or double-tap flies to that spot. The detail model (close-up skin, muscles) is
// fetched only on a deep zoom, and never by default on phones. While the drug travels (bloodstream and
// distribution) the scene switches to the see-through view with organs and vessels shown and the blood
// flowing, then restores the visitor's choice.
//
// Extra options (optional, for tests and the sandbox): { bus, anatomy: 'auto' | 'procedural' | 'glb', assetBase,
//   detail: { glb, atlas } | false, quality: 'auto' | 'high' | 'low', detailOnZoom: true,
//   glb: ArrayBuffer | Promise<ArrayBuffer|null> (the male body.glb bytes the page already downloaded; main.js) }.
import * as THREE from 'three';
import { createStage } from './stage.js';
import { loadAnatomy, ORGAN_LABELS, bodyParams, hasVariant, clearAnatomyCache } from './anatomy.js';
import { createVessels } from './vessels.js';
import { createInjection } from './injection.js';
import { createCallouts } from './callouts.js';
import { mountBodyEditor, normalizeBody, BODY_EDITOR_DEFAULTS } from '../ui/bodyeditor.js';

// The same words as the site picker (WCAG 3.2.4: one control, one name)
const SITE_LABELS = { abdomen: 'Belly', thigh: 'Thigh', arm: 'Upper arm' };
const SEVERITY = { common: 1, notable: 2, serious: 3 };
// 3D highlight colours (v4 tokens: --warn amber, --danger red, --focus violet; never green).
const HL = {
  light: { warn: 0xd97706, danger: 0xd92d20, focus: 0x6246ea, drug: 0x6246ea },
  dark: { warn: 0xf5b454, danger: 0xff7a70, focus: 0xb3a4ff, drug: 0xb3a4ff },
};
// Close enough to the skin to fetch the detail model (metres from the orbit pivot, at body scale 1).
const DETAIL_DISTANCE = 0.62;

function miniBus() {
  const m = new Map();
  return {
    on(t, fn) { if (!m.has(t)) m.set(t, new Set()); m.get(t).add(fn); return () => m.get(t)?.delete(fn); },
    emit(t, d = {}) { for (const fn of [...(m.get(t) || [])]) { try { fn(d, t); } catch (e) { console.error(e); } } },
  };
}
async function resolveBus(opt) {
  if (opt && typeof opt.on === 'function' && typeof opt.emit === 'function') return opt;
  try {
    const mod = await import('../bus.js');
    if (mod?.bus) return mod.bus;
  } catch (e) { console.warn('[scene] bus.js unavailable; using a local bus.', e); }
  globalThis.__psBus ||= miniBus();
  return globalThis.__psBus;
}
const unwrap = (d) => (typeof Event !== 'undefined' && d instanceof Event ? d.detail : d) || {};

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  skip: '<path d="M6 5l9 7-9 7z"/><path d="M18 5v14"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0V12"/><path d="M14 11v-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4-2L5 16.5a1.6 1.6 0 0 1 2.5-2L8 15"/>',
};
const svgIcon = (name) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
function initialTheme(t) {
  if (t === 'light' || t === 'dark') return t;
  const h = document.documentElement.dataset.theme;
  if (h === 'light' || h === 'dark') return h;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export async function mountBody(host, opts = {}) {
  if (!host) throw new Error('mountBody: host element required');
  const bus = await resolveBus(opts.bus);
  const reducedMotionInit = opts.reducedMotion ?? !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const themeInit = initialTheme(opts.theme);

  // ---------------------------------------------------------------- DOM (internals of #stage-host)
  const added = [];
  let canvasHost = host.querySelector('#stage-canvas-host');
  if (!canvasHost) { canvasHost = document.createElement('div'); canvasHost.id = 'stage-canvas-host'; host.prepend(canvasHost); added.push(canvasHost); }
  let layer = host.querySelector('#callout-layer');
  if (!layer) { layer = document.createElement('div'); layer.id = 'callout-layer'; host.appendChild(layer); added.push(layer); }

  // main.js has already probed WebGL 2 (opts.webgl2): no second throwaway context
  if (opts.webgl2 !== true && !hasWebGL2()) {
    const fb = host.querySelector('#stage-fallback');
    if (fb) fb.hidden = false;
    throw new Error('WebGL 2 unavailable');
  }

  // The injection module's events pass through here first (the scene reacts to its phases), then the bus.
  let onSeqEvent = null;
  const seqEmit = (t, d) => { try { onSeqEvent?.(t, d); } catch (e) { console.error(e); } bus.emit(t, d); };

  const stage = await createStage(host, { reducedMotion: reducedMotionInit, theme: themeInit, quality: opts.quality || 'auto' });
  let anatomy, vessels, callouts, injection;
  try {
    anatomy = await loadAnatomy(stage, { source: opts.anatomy || 'auto', base: opts.assetBase, detail: opts.detail ?? null, glb: opts.glb ?? null });
    vessels = createVessels(stage, anatomy);
    callouts = createCallouts(stage, layer, { onSelect: (organ) => bus.emit('organ:focus', { organ }) });
    injection = createInjection(stage, anatomy, vessels, { emit: seqEmit, callouts });
  } catch (e) {
    stage.dispose();
    for (const el of added) el.remove();
    throw e;
  }
  const label = (id) => ORGAN_LABELS[id] || String(id || '').replace(/_/g, ' ');
  // Callout anchors are cached vectors (no per-frame allocation); site-dependent ones reset on site:select.
  const anchorCache = new Map();
  const anchorOf = (organ) => {
    let v = anchorCache.get(organ);
    if (!v) { v = anatomy.organAnchor(organ); anchorCache.set(organ, v); }
    return v;
  };
  let HC = HL[stage.theme];

  // controls overlay (v4, kept small): zoom out / in / reset, skip, a colour key with the injection, a hint
  const tools = document.createElement('div');
  tools.className = 'stage-tools';
  tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', '3D view controls');
  tools.innerHTML = `
    <button type="button" class="stage-tool" data-act="out" aria-label="Zoom out" title="Zoom out">${svgIcon('minus')}</button>
    <button type="button" class="stage-tool" data-act="in" aria-label="Zoom in" title="Zoom in">${svgIcon('plus')}</button>
    <button type="button" class="stage-tool" data-act="reset" aria-label="Reset the view" title="Reset the view">${svgIcon('reset')}</button>`;
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'stage-skip';
  skipBtn.hidden = true;
  skipBtn.innerHTML = `${svgIcon('skip')}<span>Skip animation</span>`;
  const legend = document.createElement('ul');
  legend.className = 'stage-legend';
  legend.setAttribute('aria-label', 'Colour key');
  legend.innerHTML = '<li><span class="sw sw--artery" aria-hidden="true"></span>Arteries</li><li><span class="sw sw--vein" aria-hidden="true"></span>Veins</li><li><span class="sw sw--drug" aria-hidden="true"></span>Drug</li>';
  const hint = document.createElement('p');
  hint.className = 'stage-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = `${svgIcon('hand')}<span>Drag to turn the body</span>`;
  // Attribution for the anatomy (CC BY 4.0 requires it next to the work); links to the asset register.
  const credit = document.createElement('p');
  credit.className = 'stage-credit';
  credit.innerHTML = `Anatomy: <a href="${opts.creditHref || './ASSETS.md'}" target="_blank" rel="noopener" aria-label="Anatomy: CC BY 4.0, from HRA, VOXEL-MAN and BodyParts3D. Asset licences (opens in a new tab)"><span class="stage-credit__long">CC BY 4.0 (HRA, VOXEL-MAN, BodyParts3D)</span><span class="stage-credit__short">CC BY 4.0</span></a>`;
  // the one "Body" button sits in the top-right corner
  const panelBtns = document.createElement('div');
  panelBtns.className = 'stage-panel-btns';
  host.append(tools, skipBtn, legend, hint, credit, panelBtns);
  added.push(tools, skipBtn, legend, hint, credit, panelBtns);
  host.classList.add('has-body3d');

  let disposed = false;

  // ---------------------------------------------------------------- editable body (appearance only)
  // body:change → anatomy.setBody (tweened). Each tween step refreshes the cached callout anchors and
  // the camera's home framing (no allocation). Female swaps in the female anatomy.
  let bodyDesc = { ...BODY_EDITOR_DEFAULTS.male };
  let pendingBody = null;
  let lastBodyH = anatomy.modelHeight * anatomy.bodyScale;
  let femaleOk = false;
  let wantSex = 'male'; // the sex last asked for (it may arrive before the female files are confirmed)
  let swapping = null;
  const refreshAnchor = (v, organ) => { anatomy.organAnchor(organ, v); };
  function onBodyStep(b) {
    anchorCache.forEach(refreshAnchor);
    const h = anatomy.modelHeight * b.scale;
    stage.setBodyFrame(h, h / (lastBodyH || h));
    lastBodyH = h;
  }
  let offBodyStep = anatomy.onBodyChange(onBodyStep);
  // The open Body panel never hides the body it edits (teen-ux review). In single-column layouts it is a
  // sheet under the body, in room the stage grows by (css); beside the body (desktop) the camera frames
  // the body in the part of the stage the panel leaves free, and the labels keep clear of it.
  function editorInsets(open, panel) {
    // while the panel is open the side-effect, warning and arrival labels step aside: the panel is about
    // the body's shape, and the labels would crowd the space it leaves (restored on close)
    state.editorOpen = !!(open && panel);
    for (const g of ['effects', 'risk', 'arrival']) callouts.setGroupVisible(g, !state.editorOpen && !(state.playing && g !== 'arrival'));
    if (!open || !panel) {
      stage.setFrameInset({});
      callouts.setInsets(state.playing ? { right: 0 } : { right: 0, bottom: 0 });
      return;
    }
    const hr = host.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    const sheet = pr.width > hr.width * 0.7;
    if (sheet) {
      stage.setFrameInset({});
      callouts.setInsets({ right: 0, bottom: 0 });
    } else {
      const right = Math.max(0, hr.right - pr.left + 8);
      stage.setFrameInset({ right });
      callouts.setInsets({ right: Math.max(0, right - 20), bottom: 0 });
    }
  }

  // ---------------------------------------------------------------- the Body panel: shape + layers
  // view = what the visitor chose; while the drug travels the sequence borrows the see-through view.
  const view = { layers: { ...anatomy.layers }, xray: anatomy.xray };
  let seqGlass = false;
  function applyView({ instant = false } = {}) {
    if (state.playing) {
      // the sequence needs the organs and vessels; the see-through look once the drug is travelling
      anatomy.setLayers({ ...view.layers, organs: true, vessels: true });
      anatomy.setXray(seqGlass ? 1 : view.xray, { instant });
    } else {
      anatomy.setLayers(view.layers);
      anatomy.setXray(view.xray, { instant });
    }
  }
  const editor = mountBodyEditor(host, {
    initial: bodyDesc,
    femaleAvailable: false,
    onChange: (d) => bus.emit('body:change', d),
    onToggle: (open, panel) => editorInsets(open, panel),
    onOpen: () => { if (!femaleOk) checkFemale(); anatomy.loadAtlas?.(); },
    buttonHost: panelBtns,
    view: {
      initial: view,
      muscles: anatomy.hasMuscles,
      structures: anatomy.structures(),
      onChange: (v) => { view.layers = { ...v.layers }; view.xray = v.xray; applyView(); },
      onFocus: (organ) => bus.emit('organ:focus', { organ }),
    },
  });
  const layersUI = editor.layers;
  added.push(editor.elements.toggle, editor.elements.panel);
  // names (atlas) and the detail model are fetched on demand; a panel already open learns about them
  function wireDetail(a) {
    return a.onDetail?.(() => {
      if (disposed || a !== anatomy) return;
      layersUI.setMuscles(a.hasMuscles);
      layersUI.setStructures(a.structures());
      applyView({ instant: true });
    }) || (() => {});
  }
  let offDetail = wireDetail(anatomy);
  // Deep zoom fetches the detail model (desktop by default; phones only when asked with { detail: {...} }).
  const detailAuto = opts.detailOnZoom !== false && (stage.quality !== 'low' || (opts.detail && typeof opts.detail === 'object'));
  // Only a zoom the visitor makes counts (not the injection close-up or another camera flight), and only
  // once the camera has stayed close for a moment.
  let nearSince = -1;
  function maybeLoadDetail(t) {
    const a = anatomy;
    if (!detailAuto || !a.detailInfo || a.detailLoading) return;
    const d = stage.camera.position.distanceTo(stage.controls.target);
    const near = !state.playing && !stage.flying && d < DETAIL_DISTANCE * (a.bodyScale || 1);
    if (!near) { nearSince = -1; return; }
    if (nearSince < 0) nearSince = t;
    if (t - nearSince > 0.35) a.loadDetail();
  }
  function checkFemale() {
    if (opts.anatomy === 'procedural') return Promise.resolve(false);
    return hasVariant('female', opts.assetBase).then((ok) => {
      if (disposed) return false;
      femaleOk = ok;
      editor.setFemaleAvailable(ok);
      if (ok && wantSex === 'female' && bodyDesc.sex !== 'female') applyBody(withSex(bodyDesc, 'female'));
      return ok;
    });
  }
  // untouched height and weight follow the new sex's defaults (the editor does the same)
  function withSex(desc, sex) {
    const from = BODY_EDITOR_DEFAULTS[desc.sex] || BODY_EDITOR_DEFAULTS.male, to = BODY_EDITOR_DEFAULTS[sex];
    return {
      ...desc, sex,
      heightCm: desc.heightCm === from.heightCm ? to.heightCm : desc.heightCm,
      weightKg: desc.weightKg === from.weightKg ? to.weightKg : desc.weightKg,
    };
  }
  function applyBody(d, { instant = false } = {}) {
    if (d?.sex === 'female' || d?.sex === 'male') wantSex = d.sex;
    bodyDesc = normalizeBody(d, bodyDesc);
    if (bodyDesc.sex === 'female' && !femaleOk) bodyDesc = { ...bodyDesc, sex: 'male' };
    editor.sync(bodyDesc);
    if (state.playing) { pendingBody = bodyDesc; return; } // the sequence owns the body until it ends
    if (anatomy.variant !== bodyDesc.sex) { swapVariant(bodyDesc.sex); return; }
    anatomy.setBody(bodyParams(bodyDesc, anatomy.modelHeight), { instant });
    anatomy.setSkinTone(bodyDesc.skinTone);
    anatomy.setSkinAge(bodyDesc.age);
  }
  async function swapVariant(variant) {
    if (swapping) { swapping.want = variant; return; }
    const job = { want: variant };
    swapping = job;
    editor.setBusy(true, `Loading the ${variant} body…`);
    host.classList.add('is-swapping');
    try {
      const next = await loadAnatomy(stage, { source: opts.anatomy || 'auto', base: opts.assetBase, variant, detail: opts.detail ?? null });
      if (disposed) { next.dispose(); return; }
      replaceAnatomy(next);
    } catch (e) {
      console.warn(`[scene] the ${variant} anatomy could not be loaded`, e);
      if (variant === 'female') {
        femaleOk = false;
        editor.setFemaleAvailable(false);
        bodyDesc = { ...bodyDesc, sex: 'male' };
        job.want = 'male';
      }
    } finally {
      swapping = null;
      editor.setBusy(false);
      host.classList.remove('is-swapping');
    }
    if (disposed) return;
    if (job.want !== anatomy.variant && (job.want !== 'female' || femaleOk)) { swapVariant(job.want); return; }
    applyBody(bodyDesc, { instant: true });
  }
  function replaceAnatomy(next) {
    offBodyStep();
    offDetail();
    injection.dispose();
    vessels.dispose();
    anatomy.dispose();
    callouts.clear();
    anchorCache.clear();
    for (const k of Object.keys(normalCache)) delete normalCache[k];
    anatomy = next;
    vessels = createVessels(stage, anatomy);
    injection = createInjection(stage, anatomy, vessels, { emit: seqEmit, callouts });
    offBodyStep = anatomy.onBodyChange(onBodyStep);
    offDetail = wireDetail(anatomy);
    applyView({ instant: true });
    layersUI.setMuscles(anatomy.hasMuscles);
    layersUI.setStructures(anatomy.structures());
    host.dataset.anatomy = anatomy.source;
    host.dataset.variant = anatomy.variant;
    // restore what the scene was showing
    if (state.site) anatomy.selectSite(state.site);
    vessels.setDrugTargets((state.entry?.targets || []).map((t) => t.organ).filter(Boolean));
    vessels.setDrugLevel(state.playing ? 0 : state.level);
    applyEffects(state.effects);
    applyRisk(state.warnings);
    if (state.focus) { const f = state.focus; state.focus = null; setFocus(f); }
    renderSiteLabels();
    stage.invalidate();
  }

  // ---------------------------------------------------------------- state
  const state = {
    site: null, peptideId: null, entry: undefined, playing: false, focus: null,
    effects: [], warnings: [], level: 0,
    // v4: side-effect labels wait until the visitor has started the injection or moved the timeline, so
    // the first view of the body is calm and uncluttered
    engaged: false,
    // the explorer step (main.js step:change): the three site markers and labels show only on step 2
    step: null,
  };

  // ---------------------------------------------------------------- views
  // Choosing a site keeps the whole body in view and turns it a little toward that side.
  function siteView(site) {
    if (!anatomy.siteFrame(site)) return null;
    const az = site === 'arm' ? 62 : site === 'thigh' ? 24 : 16;
    return { target: stage.homeTarget.toArray(), distance: stage.homeDistance, azimuth: az, elevation: 4 };
  }
  function organView(organ) {
    const c = anatomy.organCenter(organ);
    const r = anatomy.organRadius(organ);
    const d = Math.max(0.36, stage.fitDistance(Math.max(0.09, r * 2.3), Math.max(0.09, r * 2.3)));
    let az = c.x > 0.025 ? 26 : c.x < -0.025 ? -26 : 10;
    if (organ === 'eyes' || organ === 'thyroid') az = 0;
    if (organ === 'kidneys' || organ === 'spleen') az = c.x >= 0 ? 60 : -60;
    return { target: c.toArray(), distance: d, azimuth: az, elevation: 8 };
  }

  // ---------------------------------------------------------------- highlights + callouts
  // Step 2 ("Pick a spot") shows all three markers with their labels; afterwards only the chosen spot's
  // marker stays (teen-ux review: a kid who picked the arm must not see a target on the belly). Without
  // step events (sandbox) the old rule applies: all three until a site is chosen.
  const sitesStep = () => (state.step ? state.step === 'site' : !state.site);
  function syncSiteMarkers() {
    if (state.playing) return; // the injection sequence owns the markers while it plays
    anatomy.setSiteMarkers?.(sitesStep() ? 'all' : state.site ? 'chosen' : 'none');
  }
  function renderSiteLabels() {
    syncSiteMarkers();
    const busy = (state.engaged && state.effects.length > 0) || state.warnings.length > 0;
    const show = sitesStep() && !state.playing && !state.focus && !(busy && !state.step);
    if (!show) { callouts.clear('sites'); return; }
    for (const s of Object.keys(SITE_LABELS)) {
      const f = anatomy.siteFrame(s);
      if (!f) continue;
      callouts.set(`site:${s}`, {
        // the body is see-through, so a site label only hides once its side faces well away
        anchor: f.point, normal: f.normal, facing: -0.45, title: SITE_LABELS[s], text: 'injection site', tone: 'site', group: 'sites',
        side: s === 'abdomen' ? 'left' : 'right', ariaLabel: `Choose injection site: ${SITE_LABELS[s]}`,
        onClick: () => bus.emit('site:select', { site: s }),
      });
    }
  }
  // Surface anchors (on the skin) carry a normal so their labels hide when that side faces away.
  function surfaceNormal(organ) {
    if (organ === 'injection_site') return anatomy.siteFrame(state.site || 'abdomen')?.normal || null;
    const n = anatomy.landmarks?.organs?.[organ]?.normal;
    return Array.isArray(n) ? normalCache[organ] || (normalCache[organ] = new THREE.Vector3().fromArray(n).normalize()) : null;
  }
  const normalCache = {};
  function applyEffects(items) {
    state.effects = Array.isArray(items) ? items : [];
    anatomy.clearHighlights('effect');
    callouts.clear('effects');
    if (state.playing || !state.engaged) { renderSiteLabels(); return; } // the sequence owns the body; effects come back when it ends
    const byOrgan = new Map();
    const also = new Set();
    for (const it of state.effects) {
      const organ = it?.organ || it?.organId;
      // no site chosen yet: there is no injection site to point at (it would default to the abdomen)
      if (!organ || (organ === 'injection_site' && !state.site)) continue;
      const e = byOrgan.get(organ) || { names: [], sev: 0 };
      e.names.push(it.name || it.title || it.id || 'Side effect');
      e.sev = Math.max(e.sev, SEVERITY[it.severity] || 1);
      byOrgan.set(organ, e);
      for (const a of it.alsoOrgans || []) if (a !== 'injection_site' || state.site) also.add(a);
    }
    for (const [organ, e] of byOrgan) {
      const serious = e.sev >= 3;
      anatomy.highlight(organ, { channel: 'effect', color: serious ? HC.danger : HC.warn, intensity: serious ? 1.15 : 0.95, pulse: 0.6 });
      const text = e.names.length > 2 ? `${e.names.slice(0, 2).join(', ')} +${e.names.length - 2} more` : e.names.join(', ');
      const site = organ === 'injection_site';
      callouts.set(`effect:${organ}`, {
        anchor: anchorOf(organ), normal: surfaceNormal(organ), title: label(organ), text, tone: serious ? 'danger' : 'warn', organ, group: 'effects',
        ariaLabel: `${label(organ)}: ${e.names.join(', ')}. Show on the body.`,
        // the injection site ranks right after serious effects and is never dropped for space; its skin
        // faces sideways on the arm, so it stays up at grazing angles too (teen-ux review)
        ...(site ? { priority: 5.4, keep: true, facing: -0.45 } : {}),
      });
    }
    for (const organ of also) {
      if (!byOrgan.has(organ)) anatomy.highlight(organ, { channel: 'effect', color: HC.warn, intensity: 0.4, pulse: 0 });
    }
    renderSiteLabels();
  }
  function applyRisk(warnings, items) {
    let list = Array.isArray(warnings) ? warnings : [];
    if (!list.length && Array.isArray(items) && state.entry?.risk) {
      list = items.flatMap((id) => (state.entry.risk[id] || []).map((w) => ({ ...w, item: id })));
    }
    state.warnings = list;
    anatomy.clearHighlights('risk');
    callouts.clear('risk');
    if (state.playing) return;
    const byOrgan = new Map();
    for (const w of list) {
      const organ = w?.organ;
      if (!organ) continue;
      const arr = byOrgan.get(organ) || [];
      arr.push(w.title || w.text || 'Warning');
      byOrgan.set(organ, arr);
    }
    for (const [organ, titles] of byOrgan) {
      anatomy.highlight(organ, { channel: 'risk', color: HC.danger, intensity: 1.35, pulse: 1.25 });
      callouts.set(`risk:${organ}`, {
        anchor: anchorOf(organ), normal: surfaceNormal(organ), title: `Warning · ${label(organ)}`,
        text: titles.length > 1 ? `${titles[0]} (+${titles.length - 1} more)` : titles[0],
        tone: 'danger', organ, group: 'risk', ariaLabel: `Warning for ${label(organ)}: ${titles.join('; ')}. Show on the body.`,
      });
    }
    renderSiteLabels();
  }
  function setFocus(organ) {
    const prev = state.focus;
    state.focus = organ || null;
    if (prev && prev !== organ) anatomy.unhighlight(prev, { channel: 'focus' });
    callouts.clear('focus');
    anatomy.setFocus(state.focus);
    if (state.focus) {
      anatomy.highlight(state.focus, { channel: 'focus', color: HC.focus, intensity: 0.16, pulse: 0 });
      const hasOther = callouts.has(`effect:${organ}`) || callouts.has(`risk:${organ}`) || callouts.has(`arrival:${organ}`);
      if (!hasOther) {
        callouts.set('focus', {
          anchor: anchorOf(organ), title: label(organ), text: '', tone: 'info', organ, group: 'focus', interactive: false,
        });
      }
    }
    renderSiteLabels();
  }
  function setPlaying(on) {
    const was = state.playing;
    state.playing = on;
    // focus never drops to <body> when the focused Skip button hides (a11y review)
    if (!on && skipBtn.contains(document.activeElement)) {
      const next = document.getElementById('play-sequence') || stage.canvas;
      next?.focus({ preventScroll: true });
    }
    skipBtn.hidden = !on;
    editor.setLocked(on);
    stage.autoCenter = !on;
    if (on) { host.classList.add('has-drug-key'); hideHint(); }
    if (!on) vessels.setBloodFlow(false);
    if (on !== was) {
      seqGlass = false;
      clearPin();
      callouts.remove('hover');
      applyView();
    }
    host.classList.toggle('is-sequence-playing', on);
    for (const g of ['effects', 'risk', 'focus']) callouts.setGroupVisible(g, !on && !(state.editorOpen && g !== 'focus'));
    // keep labels clear of the skip button while it shows
    // (the button sits higher on narrow stages, above the colour key: measure where it really is)
    callouts.setInsets({ bottom: on ? Math.max(44, Math.round(host.clientHeight - skipBtn.offsetTop) + 6) : 0 });
    if (on !== was) {
      // While the sequence plays it owns the organ glow: warnings and side effects step back, and the
      // timeline's drug level waits until the drug has actually been shown arriving.
      applyEffects(state.effects);
      applyRisk(state.warnings);
      vessels.setDrugLevel(on ? 0 : state.level);
    }
    renderSiteLabels();
    if (!on && pendingBody) { const b = pendingBody; pendingBody = null; applyBody(b); }
  }
  // GPU reset: main.js keeps Watch disabled until the 3D view is back; a sequence that was playing ends
  const offContext = stage.onContextChange?.((lost) => {
    if (lost && state.playing) { injection.reset(); setPlaying(false); }
    bus.emit('stage:context', { lost: !!lost });
  }) || (() => {});

  // The drug travels from the bloodstream phase on: see-through view and flowing blood until it ends.
  onSeqEvent = (t, d) => {
    if (t !== 'sequence:phase' || !state.playing) return;
    const travel = d?.phase === 'bloodstream' || d?.phase === 'distribution';
    if (travel !== seqGlass) { seqGlass = travel; applyView(); }
    vessels.setBloodFlow(travel);
  };

  // ---------------------------------------------------------------- bus wiring
  const offs = [];
  const on = (t, fn) => offs.push(bus.on(t, (d) => { try { fn(unwrap(d)); } catch (e) { console.error(`[scene] ${t} handler failed`, e); } }));

  on('site:select', ({ site }) => {
    if (!SITE_LABELS[site]) return;
    const changed = site !== state.site;
    state.site = site;
    anatomy.selectSite(site);
    for (const k of ['injection_site', 'fat']) { const v = anchorCache.get(k); if (v) anatomy.organAnchor(k, v); }
    if (state.playing && changed) { injection.reset(); setPlaying(false); }
    else if (changed && state.effects.some((it) => (it?.organ || it?.organId) === 'injection_site' || (it?.alsoOrgans || []).includes('injection_site'))) applyEffects(state.effects); // new site (normal, anchor)
    if (state.focus) setFocus(null);
    renderSiteLabels();
    if (!state.playing) {
      const v = siteView(site);
      if (v) stage.flyTo({ ...v, duration: 1300 });
    }
    // the syringe model is only needed for the injection: fetch it once a site is chosen, then compile
    // the sequence's shaders ahead so the first Watch does not hitch at each phase (performance review)
    const pre = () => {
      if (disposed) return;
      injection.preload?.();
      injection.warm?.(site)?.then?.(() => { if (!disposed && !state.playing) anatomy.warmVariants?.(stage.renderer, stage.camera); });
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(pre, { timeout: 2000 }); else setTimeout(pre, 400);
  });

  on('peptide:loaded', ({ id, entry }) => {
    state.peptideId = id ?? null;
    state.entry = entry ?? null;
    if (state.playing) { injection.reset(); setPlaying(false); }
    // a new choice starts fresh: side-effect labels wait for this peptide's own shot or timeline move
    if (state.engaged) { state.engaged = false; applyEffects(state.effects); }
    const targets = (state.entry?.targets || []).map((t) => t.organ).filter(Boolean);
    vessels.setDrugTargets(targets);
    if (!state.entry) vessels.setDrugLevel(0);
    host.classList.remove('has-drug-key');
  });

  on('sequence:start', ({ site, peptideId }) => {
    const entry = state.entry;
    if (!entry || (peptideId && state.peptideId && peptideId !== state.peptideId)) return; // coming soon: no sequence
    if (stage.contextLost) return; // nothing can draw; main.js says the view is restoring
    const s = SITE_LABELS[site] ? site : state.site || 'abdomen';
    state.site = s;
    state.engaged = true;
    if (state.focus) setFocus(null);
    setPlaying(true);
    injection.play({ site: s, peptide: entry }).then((res) => {
      if (!res?.cancelled || !injection.playing) setPlaying(false);
    }).catch((e) => { console.error('[scene] sequence failed', e); setPlaying(false); });
  });

  // main.js gave up waiting for the sequence (its watchdog): drop it here too, so both sides agree
  on('sequence:cancel', () => { if (state.playing) { injection.reset(); setPlaying(false); } });
  on('step:change', ({ step }) => {
    state.step = step || null;
    renderSiteLabels();
    stage.invalidate();
  });
  on('time:change', ({ level, levelNorm, tDays }) => {
    // weekly mode reports level > 1 (build-up); the glow takes the 0..1 level within the current view
    state.level = Number.isFinite(levelNorm) ? levelNorm : Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
    if (Number(tDays) > 0.01 && !state.engaged) { state.engaged = true; applyEffects(state.effects); }
    if (state.playing) return;
    vessels.setDrugLevel(state.level);
    // once the visitor moves along the timeline, its level drives the glow instead of the arrival flash
    if (Number(tDays) > 0.01 && injection.hasArrivals) injection.fadeArrivals();
  });
  on('effects:active', ({ items, ids }) => {
    let list = items;
    if ((!Array.isArray(list) || !list.length) && Array.isArray(ids) && state.entry?.sideEffects) {
      list = ids.map((id) => state.entry.sideEffects.find((s) => s.id === id)).filter(Boolean);
    }
    applyEffects(list || []);
  });
  on('risk:change', ({ warnings, items }) => applyRisk(warnings, items));
  on('organ:focus', ({ organ }) => {
    if (!organ || !(organ in ORGAN_LABELS)) return;
    if (state.playing) return; // never yank the camera away mid-sequence
    setFocus(organ);
    stage.flyTo({ ...organView(organ), duration: 1300 });
  });
  on('theme:change', ({ theme }) => {
    stage.setTheme(theme === 'dark' ? 'dark' : 'light');
  });
  on('motion:change', ({ reducedMotion }) => stage.setReducedMotion(!!reducedMotion));
  on('body:change', (d) => applyBody(d));
  stage.onTheme((t) => {
    HC = HL[t] || HL.light;
    applyEffects(state.effects);
    applyRisk(state.warnings);
    if (state.focus) anatomy.highlight(state.focus, { channel: 'focus', color: HC.focus, intensity: 0.16, pulse: 0 });
  });

  // ---------------------------------------------------------------- pointer: hotspots, structures, deep zoom
  // Hover (mouse) names the structure under the pointer; a tap names it on touch (an organ also gets
  // the organ focus, as before); double-click / double-tap flies to the spot. Labels sit on the point
  // that was picked, so they stay on screen when zoomed in close.
  const canvas = stage.canvas;
  const camRel = new THREE.Vector3();
  let down = null;
  const finePointer = !!globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  stage.surfacePicker = (x, y) => anatomy.pickStructure(x, y)?.point || null;
  function pickSite(x, y) {
    if (state.playing) return null;
    const h = stage.pick(x, y, anatomy.hotspotTargets);
    const site = h?.object?.userData?.site;
    if (site && !anatomy.siteHotspots[site]?.visible) return null; // rings step aside in a close-up
    const f = site && anatomy.siteFrame(site);
    // not a hotspot on the far side of the body (the same limit the site labels and rings use)
    return f && f.normal.dot(camRel.subVectors(stage.camera.position, f.point)) > -0.45 * camRel.length() ? site : null;
  }
  const hoverAnchor = new THREE.Vector3();
  const pinAnchor = new THREE.Vector3();
  // the names come from the atlas once it is in (fetched on the first label, ~30 KB)
  function structureLabel(id, info, anchor) {
    anatomy.loadAtlas?.();
    anchor.copy(info.point);
    callouts.set(id, { anchor, title: info.title, text: info.text, tone: 'info', group: 'hover', interactive: false, organ: info.organ || undefined });
  }
  function clearPin() { callouts.remove('pin'); }
  function focusAt(x, y) {
    if (state.playing) return;
    const info = anatomy.pickStructure(x, y);
    if (!info) return;
    callouts.clear('hover');
    structureLabel('pin', info, pinAnchor);
    stage.focusPoint(info.point);
  }
  function tapAt(x, y) {
    const site = pickSite(x, y);
    if (site) { bus.emit('site:select', { site }); return; }
    const info = anatomy.pickStructure(x, y);
    if (info?.organ && !state.playing) { clearPin(); bus.emit('organ:focus', { organ: info.organ }); return; }
    if (info && !state.playing) { structureLabel('pin', info, pinAnchor); return; }
    clearPin();
    if (state.focus) setFocus(null);
  }
  let lastTap = null, tapTimer = 0;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; hideHint(); };
  const onUp = (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 6 || !quick) return;
    if (e.pointerType === 'touch') {
      // a second tap close by within 300 ms is a double-tap (fly to the spot); otherwise a tap
      const now = performance.now();
      if (lastTap && now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        clearTimeout(tapTimer); lastTap = null; focusAt(e.clientX, e.clientY); return;
      }
      lastTap = { t: now, x: e.clientX, y: e.clientY };
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { lastTap = null; tapAt(e.clientX, e.clientY); }, 260);
      return;
    }
    tapAt(e.clientX, e.clientY);
  };
  const onDbl = (e) => { if (e.target === canvas) { e.preventDefault(); focusAt(e.clientX, e.clientY); } };
  let hoverRaf = 0, hoverEv = null, hoverAt = 0;
  const onMove = (e) => {
    if (!finePointer || e.pointerType !== 'mouse' || down) return;
    hoverEv = e;
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const ev = hoverEv;
      if (!ev) return;
      const now = performance.now();
      if (now - hoverAt < 50) { hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; onMove(ev); }); return; }
      hoverAt = now;
      const site = pickSite(ev.clientX, ev.clientY);
      anatomy.setHoverSite(site);
      const info = site || state.playing ? null : anatomy.pickStructure(ev.clientX, ev.clientY);
      canvas.style.cursor = site || info?.organ ? 'pointer' : '';
      const taken = info?.organ && (info.organ === state.focus || callouts.has(`effect:${info.organ}`) || callouts.has(`risk:${info.organ}`));
      if (info && !taken) structureLabel('hover', info, hoverAnchor);
      else callouts.remove('hover');
    });
  };
  const onLeave = () => { anatomy.setHoverSite(null); callouts.remove('hover'); canvas.style.cursor = ''; };
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (callouts.has('pin')) { clearPin(); e.preventDefault(); }
    if (state.focus) { setFocus(null); stage.homeView(); e.preventDefault(); }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('dblclick', onDbl);
  canvas.addEventListener('keydown', onKey);

  tools.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'in') stage.zoom(1.25);
    else if (act === 'out') stage.zoom(0.8);
    else if (act === 'reset') { if (state.focus) setFocus(null); clearPin(); stage.homeView(); }
  });
  skipBtn.addEventListener('click', () => { injection.skip(); });

  // the "drag to turn" hint fades after the first touch of the body (or after a while)
  let hintTimer = setTimeout(hideHint, 9000);
  function hideHint() { clearTimeout(hintTimer); hint.classList.add('is-hidden'); }

  renderSiteLabels();
  // site labels step aside in a close-up (the rings do too, in anatomy.js); a deep zoom fetches the
  // detail model
  let sitesShown = true;
  const offSitesFrame = stage.onFrame((dt, t) => {
    const show = stage.camera.position.distanceTo(stage.controls.target) > 0.3;
    if (show !== sitesShown) { sitesShown = show; callouts.setGroupVisible('sites', show); }
    maybeLoadDetail(t);
    return nearSince >= 0 && !anatomy.detailLoading; // keep a frame coming until the short wait is over
  });

  // ---------------------------------------------------------------- ready
  host.dataset.anatomy = anatomy.source;
  host.dataset.variant = anatomy.variant;
  checkFemale();
  // a body set before the scene mounted (sandbox, tests) is applied at once
  { const last = bus.last?.('body:change'); if (last) applyBody(last, { instant: true }); }
  try { bus.emit('stage:ready', { anatomy: anatomy.source }); } catch (e) { console.error(e); }

  const api = {
    // getters: the anatomy, vessels and injection are rebuilt when the body editor swaps Male / Female
    get stage() { return stage; }, get anatomy() { return anatomy; }, get vessels() { return vessels; },
    get injection() { return injection; }, get callouts() { return callouts; }, get editor() { return editor; },
    get layers() { return layersUI; }, get view() { return { layers: { ...view.layers }, xray: view.xray }; },
    get body() { return { ...bodyDesc }; },
    get state() { return { ...state }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      delete host.__psBody;
      offBodyStep();
      offDetail();
      offContext();
      clearTimeout(hintTimer);
      editor.dispose();
      for (const off of offs) { try { off(); } catch { /* ignore */ } }
      cancelAnimationFrame(hoverRaf);
      clearTimeout(tapTimer);
      offSitesFrame();
      stage.surfacePicker = null;
      canvas.removeEventListener('dblclick', onDbl);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('keydown', onKey);
      injection.dispose();
      callouts.dispose();
      vessels.dispose();
      anatomy.dispose();
      clearAnatomyCache();
      stage.dispose();
      for (const el of added) el.remove();
      host.classList.remove('has-body3d', 'is-sequence-playing', 'has-body-editor-open', 'has-drug-key', 'is-swapping');
      delete host.dataset.anatomy;
      delete host.dataset.variant;
    },
  };
  // Dev/test handle (headless checks reach the scene through the host element, not a global).
  Object.defineProperty(host, '__psBody', { value: api, configurable: true, enumerable: false });
  return api;
}
