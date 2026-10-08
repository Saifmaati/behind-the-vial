// PeptideScope: the only 3D entry point main.js uses (body3d).
//
//   const body = await mountBody(host /* #stage-host */, { reducedMotion, theme });
//   body.dispose();
//
// Listens: site:select, sequence:start, time:change, effects:active, risk:change, organ:focus,
//          theme:change, peptide:loaded, body:change (and motion:change { reducedMotion } when main sends it)
// Emits:   site:select (hotspot / site label click), organ:focus (callout or organ click),
//          sequence:phase, sequence:done (via the injection module), stage:ready,
//          body:change { sex, heightCm, weightKg, age } (from the body editor it mounts in the stage)
//
// Editable body (appearance only): the "Body" button in the stage corner opens js/ui/bodyeditor.js.
// body:change reaches only this scene: height scales the anatomy about the feet, weight offsets the
// skin by region and thickens or thins the fat layer of the injection cross-section, age adds a slight
// stature loss and shifts fat toward the abdomen, and Female swaps in body-female.glb when published.
// It never touches the timeline, the effects, the risk check or any content. Locked while the
// injection sequence plays.
//
// Extra options (optional, for tests and the sandbox): { bus, anatomy: 'auto' | 'placeholder' | 'glb', assetBase }.
import * as THREE from 'three';
import { createStage } from './stage.js';
import { loadAnatomy, ORGAN_LABELS, bodyParams, hasVariant } from './anatomy.js';
import { createVessels } from './vessels.js';
import { createInjection } from './injection.js';
import { createCallouts } from './callouts.js';
import { mountBodyEditor, normalizeBody, BODY_EDITOR_DEFAULTS } from '../ui/bodyeditor.js';

const SITE_LABELS = { abdomen: 'Abdomen', thigh: 'Thigh', arm: 'Upper arm' };
const SEVERITY = { common: 1, notable: 2, serious: 3 };
// 3D highlight colours (the --warn bronze amber, --danger and champagne --focus of the luxury palette;
// never green).
const HL = {
  dark: { warn: 0xd9a05b, danger: 0xe06a5f, focus: 0xe6d3a3, drug: 0xf1dda8 },
  light: { warn: 0x8f5410, danger: 0xb3261e, focus: 0x7a5c28, drug: 0x8f6c2c },
};

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
  globalThis.__btvBus ||= miniBus();
  return globalThis.__btvBus;
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
};
const svgIcon = (name) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

export async function mountBody(host, opts = {}) {
  if (!host) throw new Error('mountBody: host element required');
  const bus = await resolveBus(opts.bus);
  const reducedMotionInit = opts.reducedMotion ?? !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const themeInit = opts.theme === 'light' ? 'light' : 'dark';

  // ---------------------------------------------------------------- DOM (internals of #stage-host)
  const added = [];
  let canvasHost = host.querySelector('#stage-canvas-host');
  if (!canvasHost) { canvasHost = document.createElement('div'); canvasHost.id = 'stage-canvas-host'; host.prepend(canvasHost); added.push(canvasHost); }
  let layer = host.querySelector('#callout-layer');
  if (!layer) { layer = document.createElement('div'); layer.id = 'callout-layer'; host.appendChild(layer); added.push(layer); }

  if (!hasWebGL2()) {
    const fb = host.querySelector('#stage-fallback');
    if (fb) fb.hidden = false;
    throw new Error('WebGL 2 unavailable');
  }

  const stage = await createStage(host, { reducedMotion: reducedMotionInit, theme: themeInit });
  let anatomy, vessels, callouts, injection;
  try {
    anatomy = await loadAnatomy(stage, { source: opts.anatomy || 'auto', base: opts.assetBase });
    vessels = createVessels(stage, anatomy);
    callouts = createCallouts(stage, layer, { onSelect: (organ) => bus.emit('organ:focus', { organ }) });
    injection = createInjection(stage, anatomy, vessels, { emit: (t, d) => bus.emit(t, d), callouts });
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

  // controls overlay: zoom / reset, skip, colour key
  const tools = document.createElement('div');
  tools.className = 'stage-tools';
  tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', '3D view controls');
  tools.innerHTML = `
    <button type="button" class="stage-tool" data-act="in" aria-label="Zoom in" title="Zoom in">${svgIcon('plus')}</button>
    <button type="button" class="stage-tool" data-act="out" aria-label="Zoom out" title="Zoom out">${svgIcon('minus')}</button>
    <button type="button" class="stage-tool" data-act="reset" aria-label="Reset view" title="Reset view">${svgIcon('reset')}</button>`;
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'stage-skip';
  skipBtn.hidden = true;
  skipBtn.innerHTML = `${svgIcon('skip')}<span>Skip animation</span>`;
  const legend = document.createElement('ul');
  legend.className = 'stage-legend';
  legend.setAttribute('aria-label', 'Colour key');
  legend.innerHTML = '<li><span class="sw sw--artery" aria-hidden="true"></span>Arteries</li><li><span class="sw sw--vein" aria-hidden="true"></span>Veins</li><li><span class="sw sw--drug" aria-hidden="true"></span>Drug</li>';
  // Attribution for the anatomy (CC BY 4.0 requires it next to the work); links to the asset register.
  const credit = document.createElement('p');
  credit.className = 'stage-credit';
  credit.innerHTML = `Anatomy: <a href="${opts.creditHref || './ASSETS.md'}" target="_blank" rel="noopener" aria-label="Anatomy: CC BY 4.0, from HRA, VOXEL-MAN and BodyParts3D. Asset licences (opens in a new tab)"><span class="stage-credit__long">CC BY 4.0 (HRA, VOXEL-MAN, BodyParts3D)</span><span class="stage-credit__short">CC BY 4.0</span></a>`;
  host.append(tools, skipBtn, legend, credit);
  added.push(tools, skipBtn, legend, credit);
  host.classList.add('has-body3d');

  let disposed = false;

  // ---------------------------------------------------------------- editable body (appearance only)
  // body:change → anatomy.setBody (tweened). Each tween step refreshes the cached callout anchors and
  // the camera's home framing (no allocation). Female swaps in the female anatomy when it is published.
  const hudModel = host.querySelector('.hud-label--tl');
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
  function updateHud() {
    if (!hudModel) return;
    const kind = hudModel.querySelector('.hud-tl-kind');
    const text = `Visible Human ${anatomy.variant === 'female' ? 'Female' : 'Male'} · ${(bodyDesc.heightCm / 100).toFixed(2)} m`;
    // keep the "Anatomical model · " prefix (app.css hides it on narrow stages); replace the rest
    const node = kind ? kind.nextSibling : hudModel.firstChild;
    if (node && node.nodeType === 3) node.nodeValue = text;
    else if (!node) hudModel.append(document.createTextNode(text));
  }
  // Labels keep clear of the open panel: a side panel on wide stages, a bottom sheet on narrow ones.
  function editorInsets(open, panel) {
    if (!open || !panel) { callouts.setInsets(state.playing ? { right: 0 } : { right: 0, bottom: 0 }); return; }
    const hr = host.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    if (pr.width > hr.width * 0.7) callouts.setInsets({ bottom: Math.max(0, hr.bottom - pr.top + 8 - 40), right: 0 });
    else callouts.setInsets({ right: Math.max(0, hr.right - pr.left + 8 - 56), bottom: 0 });
  }
  const editor = mountBodyEditor(host, {
    initial: bodyDesc,
    femaleAvailable: false,
    onChange: (d) => bus.emit('body:change', d),
    onToggle: editorInsets,
    onOpen: () => { if (!femaleOk) checkFemale(); },
  });
  added.push(editor.elements.toggle, editor.elements.panel);
  function checkFemale() {
    if (opts.anatomy === 'placeholder') return Promise.resolve(false);
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
    updateHud();
  }
  async function swapVariant(variant) {
    if (swapping) { swapping.want = variant; return; }
    const job = { want: variant };
    swapping = job;
    editor.setBusy(true, `Loading the ${variant} anatomy…`);
    try {
      const next = await loadAnatomy(stage, { source: opts.anatomy || 'auto', base: opts.assetBase, variant });
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
    }
    if (disposed) return;
    if (job.want !== anatomy.variant && (job.want !== 'female' || femaleOk)) { swapVariant(job.want); return; }
    applyBody(bodyDesc, { instant: true });
  }
  function replaceAnatomy(next) {
    offBodyStep();
    injection.dispose();
    vessels.dispose();
    anatomy.dispose();
    callouts.clear();
    anchorCache.clear();
    for (const k of Object.keys(normalCache)) delete normalCache[k];
    anatomy = next;
    vessels = createVessels(stage, anatomy);
    injection = createInjection(stage, anatomy, vessels, { emit: (t, d) => bus.emit(t, d), callouts });
    offBodyStep = anatomy.onBodyChange(onBodyStep);
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
  }

  // ---------------------------------------------------------------- state
  const state = {
    site: null, peptideId: null, entry: undefined, playing: false, focus: null,
    effects: [], warnings: [], level: 0,
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
  function renderSiteLabels() {
    const busy = state.effects.length > 0 || state.warnings.length > 0;
    const show = !state.site && !state.playing && !state.focus && !busy;
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
    if (state.playing) return; // the sequence owns the body; effects come back when it ends
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
      callouts.set(`effect:${organ}`, {
        anchor: anchorOf(organ), normal: surfaceNormal(organ), title: label(organ), text, tone: serious ? 'danger' : 'warn', organ, group: 'effects',
        ariaLabel: `${label(organ)}: ${e.names.join(', ')}. Show on the body.`,
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
    skipBtn.hidden = !on;
    editor.setLocked(on);
    host.classList.toggle('is-sequence-playing', on);
    for (const g of ['effects', 'risk', 'focus']) callouts.setGroupVisible(g, !on);
    // keep labels clear of the skip button while it shows (it sits higher on wide stages; see stage.css)
    callouts.setInsets({ bottom: on ? (host.clientWidth > 600 ? 52 : 26) : 0 });
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
  });

  on('peptide:loaded', ({ id, entry }) => {
    state.peptideId = id ?? null;
    state.entry = entry ?? null;
    if (state.playing) { injection.reset(); setPlaying(false); }
    const targets = (state.entry?.targets || []).map((t) => t.organ).filter(Boolean);
    vessels.setDrugTargets(targets);
    if (!state.entry) vessels.setDrugLevel(0);
  });

  on('sequence:start', ({ site, peptideId }) => {
    const entry = state.entry;
    if (!entry || (peptideId && state.peptideId && peptideId !== state.peptideId)) return; // coming soon: no sequence
    const s = SITE_LABELS[site] ? site : state.site || 'abdomen';
    state.site = s;
    if (state.focus) setFocus(null);
    setPlaying(true);
    injection.play({ site: s, peptide: entry }).then((res) => {
      if (!res?.cancelled || !injection.playing) setPlaying(false);
    }).catch((e) => { console.error('[scene] sequence failed', e); setPlaying(false); });
  });

  on('time:change', ({ level, levelNorm, tDays }) => {
    // weekly mode reports level > 1 (build-up); the glow takes the 0..1 level within the current view
    state.level = Number.isFinite(levelNorm) ? levelNorm : Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
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
    stage.setTheme(theme === 'light' ? 'light' : 'dark');
  });
  on('motion:change', ({ reducedMotion }) => stage.setReducedMotion(!!reducedMotion));
  on('body:change', (d) => applyBody(d));
  stage.onTheme((t) => {
    HC = HL[t] || HL.dark;
    applyEffects(state.effects);
    applyRisk(state.warnings);
    if (state.focus) anatomy.highlight(state.focus, { channel: 'focus', color: HC.focus, intensity: 0.16, pulse: 0 });
  });

  // ---------------------------------------------------------------- pointer: hotspots + organs
  const canvas = stage.canvas;
  const camRel = new THREE.Vector3();
  let down = null;
  const finePointer = !!globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  function pickAt(x, y) {
    if (!state.playing) {
      const h = stage.pick(x, y, anatomy.hotspotTargets);
      const site = h?.object?.userData?.site;
      const f = site && anatomy.siteFrame(site);
      // not a hotspot on the far side of the body (the same limit the site labels and rings use)
      if (f && f.normal.dot(camRel.subVectors(stage.camera.position, f.point)) > -0.45 * camRel.length()) return { site };
    }
    const o = stage.pick(x, y, anatomy.pickables);
    if (o?.object?.userData?.organId) return { organ: o.object.userData.organId };
    return null;
  }
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 6 || !quick) return;
    const hit = pickAt(e.clientX, e.clientY);
    if (hit?.site) bus.emit('site:select', { site: hit.site });
    else if (hit?.organ && !state.playing) bus.emit('organ:focus', { organ: hit.organ });
    else if (state.focus) setFocus(null);
  };
  let hoverRaf = 0, hoverEv = null;
  const onMove = (e) => {
    if (!finePointer || e.pointerType !== 'mouse' || down) return;
    hoverEv = e;
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const ev = hoverEv;
      if (!ev) return;
      const hit = pickAt(ev.clientX, ev.clientY);
      anatomy.setHoverSite(hit?.site || null);
      canvas.style.cursor = hit ? 'pointer' : '';
      if (hit?.organ && !state.playing && hit.organ !== state.focus && !callouts.has(`effect:${hit.organ}`) && !callouts.has(`risk:${hit.organ}`)) {
        callouts.set('hover', { anchor: anchorOf(hit.organ), title: label(hit.organ), text: '', tone: 'info', group: 'hover', interactive: false });
      } else callouts.clear('hover');
    });
  };
  const onLeave = () => { anatomy.setHoverSite(null); callouts.clear('hover'); canvas.style.cursor = ''; };
  const onKey = (e) => {
    if (e.key === 'Escape' && state.focus) { setFocus(null); stage.homeView(); e.preventDefault(); }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('keydown', onKey);

  tools.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'in') stage.zoom(1.25);
    else if (act === 'out') stage.zoom(0.8);
    else if (act === 'reset') { if (state.focus) setFocus(null); stage.homeView(); }
  });
  skipBtn.addEventListener('click', () => { injection.skip(); });

  renderSiteLabels();

  // ---------------------------------------------------------------- ready
  host.dataset.anatomy = anatomy.source;
  host.dataset.variant = anatomy.variant;
  checkFemale();
  // a body set before the scene mounted (sandbox, tests) is applied at once
  { const last = bus.last?.('body:change'); if (last) applyBody(last, { instant: true }); else updateHud(); }
  try { bus.emit('stage:ready', { anatomy: anatomy.source }); } catch (e) { console.error(e); }

  const api = {
    // getters: the anatomy, vessels and injection are rebuilt when the body editor swaps Male / Female
    get stage() { return stage; }, get anatomy() { return anatomy; }, get vessels() { return vessels; },
    get injection() { return injection; }, get callouts() { return callouts; }, get editor() { return editor; },
    get body() { return { ...bodyDesc }; },
    get state() { return { ...state }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      delete host.__btvBody;
      offBodyStep();
      editor.dispose();
      for (const off of offs) { try { off(); } catch { /* ignore */ } }
      cancelAnimationFrame(hoverRaf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('keydown', onKey);
      injection.dispose();
      callouts.dispose();
      vessels.dispose();
      anatomy.dispose();
      stage.dispose();
      for (const el of added) el.remove();
      host.classList.remove('has-body3d', 'is-sequence-playing', 'has-body-editor-open');
      delete host.dataset.anatomy;
      delete host.dataset.variant;
    },
  };
  // Dev/test handle (headless checks reach the scene through the host element, not a global).
  Object.defineProperty(host, '__btvBody', { value: api, configurable: true, enumerable: false });
  return api;
}
