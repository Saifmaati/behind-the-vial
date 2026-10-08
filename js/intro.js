// Behind the Vial: cinematic landing (intro).
//
// export function mountIntro(host /* #intro */, { reducedMotion, onEnter, onFacts }) → { dispose() }
//
// The DOM (title, sub, buttons, note, skip) is written by index.html. This module:
//   - renders a WebGL scene into #intro-canvas-host (procedural glowing vasculature with flowing blood
//     cells, the realistic syringe from ./scene/syringe.js, a drop at the needle tip, bloom, grade),
//   - stages the DOM text in sync with the 3D clock through classes on #intro,
//   - wires #intro-enter / #intro-facts / #intro-skip and the keys (Enter → onEnter, Escape → skip,
//     which also calls onEnter).
// It calls onEnter / onFacts immediately and plays a short 3D push while the host fades out (main.js
// owns the fade through html[data-intro="leaving"] and calls dispose() afterwards). If nobody calls
// dispose(), rendering stops by itself ~1.2 s after leaving.
//
// Storyboard (seconds on the intro clock, which starts at the first rendered frame):
//   0–2.2   black → one capillary draws itself as a hairline of light; HUD ticks fade in
//   2.2–7   slow pull-back: the light spreads through a branching network (arteries coral, veins blue,
//           capillary fringe) receding into depth fog; blood cells flow at a resting heart rhythm
//   4.8–9   the syringe glides in from the dark, rim-lit; liquid faintly luminous; a drop beads at the tip;
//           focus racks from the vessels to the syringe
//   7.6–11  kicker, title (tracking in), sub, buttons, note
//   12+     idle loop: slow drift, flow continues
// Reduced motion: one composed still, everything visible at once, no camera moves.

const STAGES = [
  ['hud', 0.45], ['kicker', 7.7], ['title', 8.0], ['sub', 9.3], ['actions', 10.2], ['note', 10.8], ['idle', 12.0],
];
const STILL_T = 12.6;          // composed frame used for reduced motion
const LATE_START_T = 9.4;      // where the 3D starts if it arrives after the text was already shown
const TEXT_DEADLINE_MS = 4500; // show the text anyway if the 3D sequence has not started by then
const HEART_PERIOD = 60 / 62;  // resting heart rhythm, ~62 per minute

const PARTS = [
  ['kicker', '.intro-kicker'],
  ['title', '#intro-title'],
  ['sub', '#intro-sub, .intro-sub'],
  ['actions', '.intro-actions'],
  ['note', '.intro-note, .intro-disclaimer, [data-intro-note]'],
];

export function mountIntro(host, opts = {}) {
  const noop = { dispose() {} };
  if (!host || typeof host.querySelector !== 'function') return noop;

  const { onEnter, onFacts } = opts;
  const reducedMotion = !!opts.reducedMotion;
  const debug = opts.debug || null; // dev only: { t: seconds, freeze: bool }

  const $ = (sel) => host.querySelector(sel);
  const cleanups = [];
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); };

  let disposed = false;
  let leaving = false;
  let lateText = false;
  let gl = null; // the 3D runtime once it exists

  // ---------------------------------------------------------------- DOM
  let canvasHost = $('#intro-canvas-host');
  let createdCanvasHost = false;
  if (!canvasHost) {
    canvasHost = document.createElement('div');
    canvasHost.id = 'intro-canvas-host';
    canvasHost.setAttribute('aria-hidden', 'true');
    host.prepend(canvasHost);
    createdCanvasHost = true;
  }
  const tagged = [];
  for (const [name, sel] of PARTS) {
    const el = $(sel);
    if (el && !el.hasAttribute('data-intro-part')) { el.setAttribute('data-intro-part', name); tagged.push(el); }
  }

  const hud = buildHud();
  canvasHost.append(hud);

  host.hidden = false;
  host.classList.add('intro--js');
  host.classList.toggle('intro--still', reducedMotion);
  if (!reducedMotion) host.classList.add('intro--seq');

  const stageDone = new Set();
  function setStage(name) {
    if (stageDone.has(name)) return;
    stageDone.add(name);
    host.classList.add(`intro--s-${name}`);
  }
  function revealAll() { for (const [name] of STAGES) setStage(name); }
  if (reducedMotion) revealAll();

  // ---------------------------------------------------------------- buttons + keys
  function leave(reason) {
    if (leaving || disposed) return;
    leaving = true;
    host.classList.add('intro--leaving');
    if (gl) gl.beginExit();
    later(() => { if (gl) gl.stop(); }, reducedMotion ? 0 : 1200);
    const cb = reason === 'facts' ? (onFacts || onEnter) : onEnter;
    try { cb?.({ reason }); } catch (err) { console.error('[intro] callback failed', err); }
  }
  const enterBtn = $('#intro-enter');
  const factsBtn = $('#intro-facts');
  const skipBtn = $('#intro-skip');
  if (enterBtn) on(enterBtn, 'click', () => leave('enter'));
  if (factsBtn) on(factsBtn, 'click', () => leave('facts'));
  if (skipBtn) on(skipBtn, 'click', () => leave('skip'));
  on(document, 'keydown', (e) => {
    if (leaving || disposed || host.hidden || e.defaultPrevented) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return;
    if (e.key === 'Escape') { leave('skip'); return; }
    if (e.key === 'Enter') {
      const t = e.target;
      const interactive = t && t.closest && t.closest('button, a[href], input, select, textarea, summary, [contenteditable=""], [contenteditable="true"], [role="button"], [role="link"]');
      if (interactive) return; // let the focused control do its own thing
      e.preventDefault();
      leave('enter');
    }
  });
  // Keyboard users get everything at once (no waiting for the reveal to reach the buttons).
  on(host, 'focusin', (e) => { if (e.target && e.target !== skipBtn) revealAll(); });

  // Show the text even if WebGL is slow or missing.
  if (!reducedMotion) {
    later(() => { if (!gl || !gl.ready) { lateText = true; revealAll(); } }, debug?.textDeadlineMs ?? TEXT_DEADLINE_MS);
  }

  // ---------------------------------------------------------------- 3D
  start3D().catch((err) => {
    if (disposed) return;
    console.warn('[intro] 3D unavailable, showing the static intro.', err);
    host.classList.add('intro--no-webgl');
    revealAll();
  });

  async function start3D() {
    const [THREE, composerMod, renderPassMod, bloomMod, passMod, syringeMod] = await Promise.all([
      import('three'),
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/Pass.js'),
      import('./scene/syringe.js'),
    ]);
    if (disposed || leaving) return;
    gl = createRuntime({
      THREE,
      EffectComposer: composerMod.EffectComposer,
      RenderPass: renderPassMod.RenderPass,
      UnrealBloomPass: bloomMod.UnrealBloomPass,
      Pass: passMod.Pass,
      FullScreenQuad: passMod.FullScreenQuad,
      createSyringe: syringeMod.createSyringe,
    }, {
      canvasHost, reducedMotion, debug,
      onFirstFrame() {
        host.classList.add('intro--webgl');
      },
      onReady() {
        host.classList.add('intro--playing');
      },
      onTime(t) {
        for (const [name, at] of STAGES) if (t >= at) setStage(name);
      },
      lateStart: () => (lateText ? LATE_START_T : 0),
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* ignore */ } }
    try { gl?.dispose(); } catch (err) { console.warn('[intro] dispose failed', err); }
    gl = null;
    hud.remove();
    for (const el of tagged) el.removeAttribute('data-intro-part');
    host.classList.remove('intro--js', 'intro--seq', 'intro--still', 'intro--webgl', 'intro--playing', 'intro--no-webgl', 'intro--leaving',
      ...STAGES.map(([n]) => `intro--s-${n}`));
    if (createdCanvasHost) canvasHost.remove();
  }

  return {
    dispose,
    /** dev helpers (not part of the contract) */
    get _state() { return gl ? gl.state() : { started: false }; },
  };
}

// ==================================================================== HUD (decorative, aria-hidden)

function buildHud() {
  const hud = document.createElement('div');
  hud.className = 'ihud';
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = `
    <span class="ihud-corner ihud-corner--tl"></span><span class="ihud-corner ihud-corner--tr"></span>
    <span class="ihud-corner ihud-corner--bl"></span><span class="ihud-corner ihud-corner--br"></span>
    <span class="ihud-ruler ihud-ruler--l"></span><span class="ihud-ruler ihud-ruler--r"></span>
    <div class="ihud-label"><span class="ihud-dot"></span><span>Simulated view</span><span class="ihud-sep">/</span><span>Blood vessels under the skin</span></div>
    <div class="ihud-legend">
      <span class="ihud-key ihud-key--a">Arteries</span>
      <span class="ihud-key ihud-key--v">Veins</span>
      <span class="ihud-key ihud-key--c">Capillaries</span>
    </div>
    <div class="ihud-ecg">
      <svg viewBox="0 0 160 28" preserveAspectRatio="none" focusable="false">
        <path class="ihud-ecg-base" d="M0 16 H160"/>
        <path class="ihud-ecg-trace" pathLength="100" d="M0 16 H22 l3 -2 l3 2 H40 l2 3 l4 -15 l4 19 l3 -5 H66 q6 -6 12 0 H102 l3 -2 l3 2 H120 l2 3 l4 -15 l4 19 l3 -5 H146 q6 -6 12 0 H160"/>
      </svg>
      <span>Resting heart rhythm</span>
    </div>`;
  return hud;
}

// ==================================================================== 3D runtime

function createRuntime(mods, cfg) {
  const t0 = performance.now();
  const { THREE, EffectComposer, RenderPass, UnrealBloomPass, Pass, FullScreenQuad, createSyringe } = mods;
  const { canvasHost, reducedMotion, debug } = cfg;
  const V3 = THREE.Vector3;

  // ---------------------------------------------------------------- renderer
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-canvas';
  canvasHost.prepend(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  } catch (err) {
    canvas.remove();
    throw err;
  }
  const size = () => {
    const r = canvasHost.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width || innerWidth)), h: Math.max(1, Math.round(r.height || innerHeight)) };
  };
  let { w: W, h: H } = size();
  const small = Math.min(W, H) < 700;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.02, 120);

  // Studio-on-black environment (strip softboxes behind the subject give the glass its rim highlights).
  // Built in prepare(), while the screen is still black, because PMREM filtering stalls the GPU briefly.
  let envRT = null;
  scene.environmentIntensity = 0;
  let tEnv = 0;
  // ---------------------------------------------------------------- vasculature
  const net = buildVasculature(THREE, 20261007);
  const tNet = performance.now() - t0;
  const shared = {
    uRes: { value: new THREE.Vector2(W * pixelRatio, H * pixelRatio) },
    uMinPx: { value: 1.15 * pixelRatio },
    uFocus: { value: 2 },
    uCoc: { value: 6 },
    uMaxBlur: { value: 10 * pixelRatio },
    uReveal: { value: -1 },
    uFog: { value: 0.07 },
    uFogStart: { value: 3.0 },
    uBeat: { value: 0 },
    uFlow: { value: 0 },
    uTime: { value: 0 },
    uFrontColor: { value: new THREE.Color(1.0, 0.92, 0.88) },
    uGain: { value: 1 },
  };
  const ARTERY = new THREE.Color().setRGB(1.0, 0.15, 0.1);
  const VEIN = new THREE.Color().setRGB(0.05, 0.2, 1.0);
  const groups = { 0: [], 1: [], 2: [] };
  for (const v of net.vessels) groups[v.kind].push(v);
  const ribbonMeshes = [
    makeRibbons(THREE, groups[0], shared, { colorA: ARTERY, colorB: ARTERY, intensity: 1.55, pulse: 0.5 }),
    makeRibbons(THREE, groups[1], shared, { colorA: VEIN, colorB: VEIN, intensity: 1.45, pulse: 0.12 }),
    makeRibbons(THREE, groups[2], shared, { colorA: ARTERY, colorB: VEIN, intensity: 0.6, pulse: 0.25 }),
  ];
  for (const m of ribbonMeshes) scene.add(m);
  const cells = makeCells(THREE, net, shared, small ? 2200 : 4200);
  scene.add(cells.points);
  const flow = { a: 0, v: 0, c: 0 };

  // ---------------------------------------------------------------- syringe + drop
  const syr = createSyringe(THREE, { scale: 1, tickColor: 0xc4ccd6 });
  syr.setCapOn(false);
  syr.setPlunger(0.5);
  syr.setLiquid(0.43);
  syr.setGlow(0);
  const syringeRoot = new THREE.Group();
  syringeRoot.add(syr.group);
  scene.add(syringeRoot);
  // center the syringe on its visual middle so it rotates and floats around it
  const syrLength = syr.dims.lengthPlungerIn + 0.5 * syr.dims.plungerTravel;
  syr.group.position.y = -syrLength * 0.5;

  const rim = new THREE.DirectionalLight(0xffffff, 0);
  const rim2 = new THREE.DirectionalLight(0xbfe9ff, 0);
  scene.add(rim, rim.target, rim2, rim2.target);

  const dropMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, ior: 1.333, thickness: 1.6,
    attenuationColor: new THREE.Color(0xd7f7ff), attenuationDistance: 2.5,
    emissive: new THREE.Color(0x6fdcff), emissiveIntensity: 0.0, envMapIntensity: 2.6,
  });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), dropMat);
  drop.visible = false;
  scene.add(drop);
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(THREE), color: new THREE.Color(0.75, 0.95, 1.0), blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, depthTest: false, opacity: 0,
  }));
  glint.renderOrder = 50;
  scene.add(glint);
  // the drop reads as liquid through two small lights: a specular point and the caustic it focuses
  const dotTex = radialTexture(THREE, [[0, 1], [0.32, 0.92], [0.55, 0.3], [1, 0]]);
  const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTex, color: new THREE.Color(1, 1, 1), blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, depthTest: false, opacity: 0,
  }));
  const caustic = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTex, color: new THREE.Color(0.55, 0.9, 1.0), blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, depthTest: false, opacity: 0,
  }));
  sparkle.renderOrder = caustic.renderOrder = 51;
  scene.add(sparkle, caustic);

  // ---------------------------------------------------------------- post
  const rt = new THREE.WebGLRenderTarget(W * pixelRatio, H * pixelRatio, { type: THREE.HalfFloatType, samples: small ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W * pixelRatio, H * pixelRatio), 0.9, 0.55, 0.5);
  composer.addPass(bloom); // UnrealBloomPass already works at half resolution internally
  const finalPass = makeFinalPass(THREE, Pass, FullScreenQuad);
  composer.addPass(finalPass);

  // ---------------------------------------------------------------- choreography
  let layout = computeLayout();
  const tmp = { v: new V3(), v2: new V3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };

  function computeLayout() {
    const aspect = W / H;
    const tall = aspect < 0.95;
    const fov = tall ? 50 : aspect < 1.3 ? 40 : 32;
    const fov0 = fov * 0.6; // slight telephoto at the start, widening during the pull-back
    const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const tanH = tanV * aspect;
    const tanV0 = Math.tan(THREE.MathUtils.degToRad(fov0 / 2));
    const tanH0 = tanV0 * aspect;
    // opening shot: frame the hero capillary across the screen
    const chord = net.heroB.clone().sub(net.heroA);
    const chordLen = chord.length();
    const C = chord.normalize();
    const zAxis = new V3(0, 0, 1);
    const back = zAxis.clone().addScaledVector(C, -C.dot(zAxis)).normalize(); // perpendicular to the chord, toward +Z
    const dist0 = Math.max(0.75, (chordLen * 0.62) / Math.min(tanH0, tanV0 * 1.6));
    const P0 = net.heroMid.clone().addScaledVector(back, dist0).add(new V3(0, 0.04, 0));
    // final shot
    const M = net.heroMid;
    const Tf = M.clone().add(tall ? new V3(1.2, 0.8, -7.5) : new V3(2.4, -1.7, -7.5));
    const Pf = M.clone().add(tall ? new V3(0.8, -1.0, 8.2) : new V3(1.6, -1.25, 9.6));
    const Pmid = P0.clone().lerp(Pf, 0.42).add(new V3(-1.4, 0.7, 0.3));
    const path = new THREE.CatmullRomCurve3([P0.clone(), P0.clone().lerp(Pmid, 0.5), Pmid, Pf.clone()], false, 'centripetal');

    // final camera basis → syringe anchor in screen space
    const cam = new THREE.PerspectiveCamera(fov, aspect, 0.02, 120);
    cam.position.copy(Pf);
    cam.lookAt(Tf);
    cam.updateMatrixWorld();
    const right = new V3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new V3().setFromMatrixColumn(cam.matrixWorld, 1);
    const fwd = new V3().setFromMatrixColumn(cam.matrixWorld, 2).negate();
    const D = tall ? 4.0 : 4.4;
    const ndc = tall ? [0.1, 0.5] : aspect < 1.3 ? [0.38, 0.22] : [0.5, 0.14];
    const anchor = Pf.clone().addScaledVector(fwd, D)
      .addScaledVector(right, ndc[0] * D * tanH)
      .addScaledVector(up, ndc[1] * D * tanV);
    const visH = 2 * D * tanV;
    const visW = visH * aspect;
    // on-screen angle of the barrel axis (from +X, counter-clockwise), needle pointing the other way
    const phi = THREE.MathUtils.degToRad(tall ? 33 : 52);
    const lenWorld = tall ? Math.min(visW * 0.98, visH * 0.5) : aspect < 1.3 ? visH * 0.76 : visH * 0.86;
    const scale = lenWorld / syrLength;
    const axis = right.clone().multiplyScalar(Math.cos(phi)).addScaledVector(up, Math.sin(phi)).addScaledVector(fwd, tall ? 0.22 : 0.32).normalize();
    // local +Z (graduations, bevel) turned mostly toward the camera, a little to the side for depth
    const toCam = fwd.clone().negate().addScaledVector(right, -0.42);
    const zDir = toCam.addScaledVector(axis, -toCam.dot(axis)).normalize();
    const xDir = new V3().crossVectors(axis, zDir).normalize();
    const finalQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xDir, axis, zDir));
    const enterOffset = right.clone().multiplyScalar(tall ? visW * 1.1 : visW * 0.62).addScaledVector(up, tall ? visH * 0.06 : -visH * 0.16).addScaledVector(fwd, 1.4);
    const enterQuat = new THREE.Quaternion().setFromAxisAngle(fwd, -0.42).multiply(finalQuat.clone());
    const blur = tall ? 0.6 : 1;
    const light = tall ? 0.6 : 1;
    return { aspect, tall, blur, light, fov, fov0, P0, dist0, Pf, Tf, path, M, C, anchor, scale, finalQuat, enterOffset, enterQuat, right, up, fwd, D };
  }

  // rim lights sit behind the syringe relative to the final camera
  function placeLights() {
    const L = layout;
    rim.position.copy(L.anchor).addScaledVector(L.right, 3.2).addScaledVector(L.up, 0.6).addScaledVector(L.fwd, 4.5);
    rim.target.position.copy(L.anchor);
    rim2.position.copy(L.anchor).addScaledVector(L.right, -3).addScaledVector(L.up, -0.5).addScaledVector(L.fwd, 3.5);
    rim2.target.position.copy(L.anchor);
  }
  placeLights();

  const E = {
    smooth: (x) => x * x * (3 - 2 * x),
    smoother: (x) => x * x * x * (x * (x * 6 - 15) + 10),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    inQuad: (x) => x * x,
  };
  const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const beat = (p) => {
    p -= Math.floor(p);
    return Math.exp(-(((p - 0.06) / 0.045) ** 2)) + 0.35 * Math.exp(-(((p - 0.3) / 0.07) ** 2));
  };

  const camTarget = new V3();
  let exitAt = -1;

  function update(t, dt, realDt) {
    const L = layout;
    // ---- camera
    const k0 = seg(t, 0, 2.3);
    const kPull = E.smoother(seg(t, 2.1, 7.6));
    if (kPull <= 0) {
      camera.position.copy(L.P0).addScaledVector(L.C, 0.05 * E.smooth(k0)).addScaledVector(L.fwd, 0.03 * k0);
      camTarget.copy(L.M).addScaledVector(L.C, 0.05 * E.smooth(k0));
    } else {
      L.path.getPointAt(kPull, camera.position);
      const kt = E.smoother(seg(t, 2.1, 7.0));
      camTarget.copy(L.M).addScaledVector(L.C, 0.05).lerp(L.Tf, kt);
    }
    // idle drift (slow, small)
    const kIdle = E.smooth(seg(t, 7.0, 11.0));
    if (kIdle > 0) {
      const d = t - 7;
      camera.position.addScaledVector(L.right, Math.sin(d * 0.11) * 0.22 * kIdle)
        .addScaledVector(L.up, Math.sin(d * 0.077 + 1.3) * 0.12 * kIdle)
        .addScaledVector(L.fwd, Math.sin(d * 0.05) * 0.25 * kIdle);
    }
    // exit push
    if (exitAt >= 0) {
      const ke = E.inQuad(Math.min(1, (t - exitAt) / 0.7));
      camera.position.lerp(L.anchor, 0.28 * ke);
      finalPass.uniforms.uFade.value = 1 - ke;
      bloom.strength = 0.9 + 0.9 * ke;
    }
    const fovNow = lerp(L.fov0, L.fov, kPull);
    if (Math.abs(camera.fov - fovNow) > 1e-4) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
    camera.lookAt(camTarget);
    if (debug && debug.view) { const [vx, vy, vw, vh] = debug.view; camera.setViewOffset(W, H, vx * W, vy * H, vw * W, vh * H); }
    camera.updateMatrixWorld();

    // ---- reveal: hero hairline first, then the network
    const kDraw = E.inOutCubic(seg(t, 0.35, 2.25));
    const kNet = seg(t, 2.25, 6.9);
    const netReveal = net.heroLen + (net.maxReveal + 1 - net.heroLen) * (0.55 * E.inQuad(kNet) + 0.45 * E.smooth(kNet));
    shared.uReveal.value = t < 0.35 ? -1 : kNet > 0 ? netReveal : net.heroLen * kDraw;

    // ---- focus: follow the hero point, then rack to the syringe
    const dHero = camera.position.distanceTo(L.M);
    const dSyr = camera.position.distanceTo(syringeRoot.position);
    const kRack = E.inOutCubic(seg(t, 6.6, 8.8));
    shared.uFocus.value = lerp(dHero, dSyr, kRack);
    shared.uGain.value = lerp(1, 0.8, kRack); // the background settles back as focus moves to the syringe
    const blurScale = H * pixelRatio / 900;
    shared.uCoc.value = lerp(lerp(4.5, 2.6, kPull), 4.6 * L.blur, kRack) * blurScale;

    // ---- heart + flow
    shared.uTime.value = t;
    shared.uBeat.value = t / HEART_PERIOD;
    const b = beat(t / HEART_PERIOD);
    flow.a += dt * (0.55 + 0.9 * b);
    flow.v += dt * 1.0;
    flow.c += dt * 1.0;
    shared.uFlow.value = flow.a;
    cells.uniforms.uFlowA.value = flow.a;
    cells.uniforms.uFlowV.value = flow.v;
    cells.uniforms.uFlowC.value = flow.c;

    // ---- syringe
    const kIn = seg(t, 4.8, 9.4);
    const kPos = E.outExpo(kIn);
    const kRot = E.outQuint(kIn);
    syringeRoot.visible = t > 4.7;
    syringeRoot.scale.setScalar(L.scale);
    syringeRoot.position.copy(L.anchor).addScaledVector(L.enterOffset, 1 - kPos);
    syringeRoot.quaternion.copy(L.enterQuat).slerp(L.finalQuat, kRot);
    if (t > 9) {
      const d = t - 9;
      const f = E.smooth(seg(t, 9, 11));
      syringeRoot.position.addScaledVector(L.up, Math.sin(d * 0.62) * 0.018 * f).addScaledVector(L.right, Math.sin(d * 0.41) * 0.01 * f);
      tmp.q.setFromAxisAngle(L.fwd, Math.sin(d * 0.33) * 0.012 * f);
      syringeRoot.quaternion.premultiply(tmp.q);
    }
    // it arrives as a rim-lit silhouette, then the studio light comes up
    const kLight = E.smooth(seg(t, 5.2, 8.6));
    const kRim = E.smooth(seg(t, 4.8, 6.4));
    scene.environmentIntensity = 0.14 * kRim + 0.9 * kLight;
    rim.intensity = (1.0 * kRim + 0.6 * kLight) * L.light;
    rim2.intensity = (0.5 * kRim + 0.4 * kLight) * L.light;
    syr.setGlow(0.5 * E.smooth(seg(t, 6.2, 9.0)));
    syringeRoot.updateMatrixWorld(true);

    // ---- drop beading at the tip
    const kDrop = seg(t, 7.9, 9.3);
    drop.visible = syringeRoot.visible && kDrop > 0;
    if (drop.visible) {
      const tipW = tmp.v.copy(syr.tip).applyMatrix4(syr.group.matrixWorld);
      const rd = 0.00085 * L.scale * (0.15 + 0.85 * easeOutBack(kDrop));
      const wob = 1 + 0.06 * Math.sin(t * 11) * Math.exp(-(t - 8.6) * 1.6) * (t > 8.6 ? 1 : 0);
      drop.scale.set(rd / wob, rd * 1.12 * wob, rd / wob);
      drop.position.copy(tipW).add(tmp.v2.set(0, -rd * 0.92, 0));
      dropMat.emissiveIntensity = 0.22 * E.smooth(kDrop);
      // the glint flares once as the drop forms, then breathes softly
      const flare = Math.exp(-(((t - 9.15) / 0.35) ** 2));
      glint.material.opacity = Math.min(1, 0.85 * flare + 0.22 * E.smooth(seg(t, 9.0, 10.0)) * (0.8 + 0.2 * Math.sin(t * 2.1)));
      glint.position.copy(drop.position).addScaledVector(L.up, rd * 0.35).addScaledVector(L.right, -rd * 0.3).addScaledVector(L.fwd, -rd * 1.2);
      glint.scale.setScalar(rd * (5 + 7 * flare));
      const kd = E.smooth(kDrop);
      sparkle.material.opacity = 0.95 * kd;
      sparkle.scale.setScalar(rd * 0.62);
      sparkle.position.copy(drop.position).addScaledVector(L.up, rd * 0.5).addScaledVector(L.right, -rd * 0.42).addScaledVector(L.fwd, -rd * 1.1);
      caustic.material.opacity = 0.42 * kd * (0.9 + 0.1 * Math.sin(t * 1.7));
      caustic.scale.setScalar(rd * 1.05);
      caustic.position.copy(drop.position).addScaledVector(L.up, -rd * 0.6).addScaledVector(L.right, rd * 0.3).addScaledVector(L.fwd, -rd * 1.1);
    } else {
      glint.material.opacity = 0;
      sparkle.material.opacity = 0;
      caustic.material.opacity = 0;
    }
    if (debug && window.__introDebug?.override) window.__introDebug.override(t);
  }

  const setupMs = performance.now() - t0;
  if (debug) window.__introDebug = { scene, camera, sparkle, caustic, glint, drop, syr };
  // ---------------------------------------------------------------- loop
  let raf = 0;
  let running = false;
  let started = false;
  let stopped = false;
  let last = 0;
  const debugT = debug && Number.isFinite(debug.t);
  let clock = debugT ? debug.t : 0;
  let firstFrameMs = -1;
  if (reducedMotion) clock = STILL_T;

  function frame(now) {
    raf = 0;
    if (!running) return;
    const realDt = last ? Math.min(0.25, (now - last) / 1000) : 1 / 60;
    last = now;
    const dt = debug && debug.freeze ? 0 : realDt;
    clock += dt;
    renderAt(clock, dt, realDt);
    if (running) raf = requestAnimationFrame(frame);
  }

  function renderAt(t, dt, realDt, warmup = false) {
    update(t, dt, realDt);
    finalPass.uniforms.uTime.value = t;
    finalPass.uniforms.uFadeIn.value = warmup ? 0 : reducedMotion ? 1 : Math.min(1, t / 0.4);
    composer.render(dt);
    if (!started) {
      started = true;
      firstFrameMs = performance.now() - t0;
      cfg.onFirstFrame?.();
    }
    if (!warmup) cfg.onTime?.(t);
  }

  function play() {
    if (running || stopped || reducedMotion || !ready) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function renderStill() {
    if (stopped || !ready) return;
    // a couple of frames so transmission / bloom buffers settle
    renderAt(STILL_T, 0, 0);
    renderAt(STILL_T, 0, 0);
  }

  const onVisibility = () => { if (document.hidden) pause(); else if (!reducedMotion) play(); };
  document.addEventListener('visibilitychange', onVisibility);

  let resizeQueued = 0;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = requestAnimationFrame(() => {
      resizeQueued = 0;
      const s = size();
      if (s.w === W && s.h === H) return;
      W = s.w; H = s.h;
      renderer.setSize(W, H, false);
      composer.setSize(W, H);
      camera.aspect = W / H;
      camera.fov = computeLayout().fov;
      camera.updateProjectionMatrix();
      shared.uRes.value.set(W * pixelRatio, H * pixelRatio);
      layout = computeLayout();
      placeLights();
      if (reducedMotion || !running) renderStill();
    });
  }) : null;
  ro?.observe(canvasHost);

  const onLost = (e) => { e.preventDefault(); pause(); stopped = true; canvasHost.closest('#intro')?.classList.add('intro--no-webgl'); };
  canvas.addEventListener('webglcontextlost', onLost);

  camera.fov = layout.fov;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();

  // First a black frame (the canvas is live at once), then the environment and every shader the
  // sequence will need, so nothing compiles mid-animation. Only then does the clock start.
  let ready = false;
  async function prepare() {
    renderAt(reducedMotion ? STILL_T : clock, 0, 0, true);
    await new Promise((r) => requestAnimationFrame(() => r()));
    if (disposedRt) return;
    const te = performance.now();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = buildStudio(THREE);
    envRT = pmrem.fromScene(envScene, 0, 0.1, 100, { size: 128 }); // soft strips: 128 px is plenty
    disposeObject(envScene);
    pmrem.dispose();
    scene.environment = envRT.texture;
    tEnv = performance.now() - te;
    const vis = [syringeRoot.visible, drop.visible];
    syringeRoot.visible = true;
    drop.visible = true;
    try {
      if (typeof renderer.compileAsync === 'function') await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
    } catch { /* compile lazily instead */ }
    syringeRoot.visible = vis[0];
    drop.visible = vis[1];
    if (disposedRt) return;
    ready = true;
    readyMs = performance.now() - t0;
    // the text was already shown (slow device): join the sequence where the syringe has arrived
    if (!debugT && !reducedMotion) clock = Math.max(clock, cfg.lateStart?.() || 0);
    cfg.onReady?.();
    if (reducedMotion) renderStill();
    else if (!document.hidden) play();
  }
  let readyMs = -1;
  prepare().catch((err) => { console.warn('[intro] prepare failed', err); ready = true; if (reducedMotion) renderStill(); else play(); });

  // ---------------------------------------------------------------- teardown
  let disposedRt = false;
  function dispose() {
    if (disposedRt) return;
    disposedRt = true;
    pause();
    stopped = true;
    if (resizeQueued) cancelAnimationFrame(resizeQueued);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onLost);
    ro?.disconnect();
    syr.dispose();
    disposeObject(scene);
    cells.texture.dispose();
    envRT?.dispose();
    glint.material.map?.dispose();
    dotTex.dispose();
    for (const p of composer.passes) p.dispose?.();
    composer.dispose?.();
    rt.dispose();
    renderer.renderLists?.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return {
    get started() { return started; },
    get ready() { return ready; },
    beginExit() {
      if (reducedMotion) return;
      exitAt = clock;
    },
    stop() { pause(); stopped = true; },
    dispose,
    state: () => ({ started, ready, firstFrameMs: Math.round(firstFrameMs), setupMs: Math.round(setupMs), envMs: Math.round(tEnv), netMs: Math.round(tNet), readyMs: Math.round(readyMs), clock, running, reveal: shared.uReveal.value, maxReveal: net.maxReveal, vessels: net.vessels.length, focus: shared.uFocus.value }),
  };
}

function easeOutBack(x) {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (v && v.isTexture) v.dispose();
      }
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) u.value.dispose();
      m.dispose();
    }
  });
}

// ==================================================================== studio environment (for reflections)

function buildStudio(THREE) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x000000);
  const geo = new THREE.PlaneGeometry(1, 1);
  const panel = (x, y, z, w, h, color, intensity) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.scale.set(w, h, 1);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(-3.4, 0.6, -3.8, 1.1, 9, 0xe8f2ff, 6.5);  // rim strip, left-behind
  panel(3.8, 1.2, -3.3, 0.8, 9, 0xfff6ec, 8.0);   // rim strip, right-behind
  panel(0.2, 6.0, -0.8, 6.5, 2.4, 0xffffff, 2.6); // overhead softbox
  panel(0, 1.0, 6.0, 9, 4, 0xbcd6ff, 0.22);       // faint front fill
  panel(-3.2, -3.0, 1.2, 2.2, 2.2, 0x56d6ff, 0.9); // low cyan kicker
  return s;
}

// ==================================================================== vasculature generator

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildVasculature(THREE, seed) {
  const V3 = THREE.Vector3;
  const rng = mulberry32(seed);
  const R = (a, b) => a + (b - a) * rng();
  const B = { x: 15, y: 9.5, zMin: -34, zMax: 0.7 };
  const R_MIN = 0.0115;
  const SPACING = 0.07;
  const vessels = [];

  const randUnit = () => {
    const z = R(-1, 1), t = R(0, Math.PI * 2), s = Math.sqrt(1 - z * z);
    return new V3(s * Math.cos(t), s * Math.sin(t), z);
  };
  const perpendicular = (d) => new V3().crossVectors(d, Math.abs(d.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0)).normalize();
  const steer = (p) => {
    const s = new V3();
    if (p.x > B.x) s.x -= p.x - B.x; else if (p.x < -B.x) s.x += -B.x - p.x;
    if (p.y > B.y) s.y -= p.y - B.y; else if (p.y < -B.y) s.y += -B.y - p.y;
    if (p.z > B.zMax) s.z -= (p.z - B.zMax) * 3; else if (p.z < B.zMin) s.z += B.zMin - p.z;
    return s.multiplyScalar(0.7);
  };
  function path(start, dir, len, wander, spacing = SPACING) {
    const n = Math.max(3, Math.ceil(len / 0.38));
    const ctrl = [start.clone()];
    const d = dir.clone().normalize();
    const p = start.clone();
    for (let i = 1; i <= n; i++) {
      d.addScaledVector(randUnit(), wander).add(steer(p)).normalize();
      p.addScaledVector(d, len / n);
      ctrl.push(p.clone());
    }
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    const count = Math.max(4, Math.ceil(len / spacing));
    return { pts: curve.getSpacedPoints(count), endDir: d.clone() };
  }
  function addVessel(kind, pts, r0, r1, flowDir, rJoin = 0) {
    const arc = [0];
    for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const len = arc[arc.length - 1] || 1e-6;
    // linear taper, flaring smoothly into the parent at the junction (no visible step)
    const flare = Math.min(len * 0.3, r0 * 9);
    const rad = arc.map((a) => {
      const base = r0 + (r1 - r0) * (a / len);
      if (!rJoin || rJoin <= base) return base;
      const k = Math.min(1, a / flare);
      return base + (rJoin - base) * (1 - k * k * (3 - 2 * k));
    });
    const v = { id: vessels.length, kind, pts, rad, arc, len, conns: [], flow: flowDir, seed: rng() };
    vessels.push(v);
    return v;
  }
  function connect(a, aArc, b, bArc, cost = 0) {
    a.conns.push({ arc: aArc, to: b.id, toArc: bArc, cost });
    b.conns.push({ arc: bArc, to: a.id, toArc: aArc, cost });
  }
  // companion vein: follows the artery on a parallel-transported side offset
  function companion(art, n0, parentVein, parentIdx) {
    const pts = art.pts;
    const frames = [];
    let n = n0.clone();
    const out = [];
    const phase = R(0, 6.28), freq = R(2.5, 5);
    for (let i = 0; i < pts.length; i++) {
      const t = (i < pts.length - 1 ? pts[i + 1].clone().sub(pts[i]) : pts[i].clone().sub(pts[i - 1])).normalize();
      n.addScaledVector(t, -n.dot(t)).normalize();
      frames.push(n.clone());
      const rA = art.rad[i];
      const off = rA * 4.4 + 0.02;
      const b = new V3().crossVectors(t, n);
      out.push(pts[i].clone().addScaledVector(n, off).addScaledVector(b, Math.sin(art.arc[i] * freq + phase) * rA * 0.8));
    }
    if (parentVein) {
      const p0 = parentVein.pts[parentIdx];
      const delta = p0.clone().sub(out[0]);
      const m = Math.min(out.length, 6);
      for (let i = 0; i < m; i++) out[i].addScaledVector(delta, 1 - i / m);
    }
    const vein = addVessel(1, out, art.rad[0] * 1.32, art.rad[art.rad.length - 1] * 1.32, -1);
    vein.rad = art.rad.map((r) => r * 1.32);
    vein.frames = frames;
    if (parentVein) connect(parentVein, parentVein.arc[parentIdx], vein, 0);
    return vein;
  }

  const terminals = [];
  const roots = [];
  function grow(start, dir, r, gen, parent) {
    const len = Math.min(3.3, Math.max(0.3, r * R(30, 44)));
    const { pts, endDir } = path(start, dir, len, r > 0.04 ? 0.15 : 0.24);
    const rEnd = r * 0.86;
    const rJoin = parent ? Math.min(parent.art.rad[parent.idx] * 0.9, r * 1.6) : 0;
    const art = addVessel(0, pts, r, rEnd, 1, rJoin);
    let n0;
    if (parent) {
      connect(parent.art, parent.art.arc[parent.idx], art, 0);
      n0 = parent.vein.frames[parent.idx].clone();
    } else {
      n0 = perpendicular(endDir).applyAxisAngle(endDir.clone(), R(0, 6.28));
    }
    const vein = companion(art, n0, parent ? parent.vein : null, parent ? parent.idx : 0);
    if (!parent) roots.push({ art, vein });

    // side branch partway along
    if (r > 0.02 && rng() < 0.62) {
      const i = Math.floor(R(0.28, 0.72) * (pts.length - 1));
      const t = pts[i + 1].clone().sub(pts[i]).normalize();
      const ax = perpendicular(t).applyAxisAngle(t, R(0, 6.28));
      grow(pts[i], t.clone().applyAxisAngle(ax, R(0.9, 1.35)), r * R(0.34, 0.52), gen + 1, { art, vein, idx: i });
    }
    const last = pts.length - 1;
    if (rEnd > R_MIN && gen < 16) {
      const a = R(0.76, 0.9), b = Math.cbrt(1 - a * a * a);
      const ax = perpendicular(endDir).applyAxisAngle(endDir, R(0, 6.28));
      grow(pts[last], endDir.clone().applyAxisAngle(ax, R(0.18, 0.42)), rEnd * a, gen + 1, { art, vein, idx: last });
      grow(pts[last], endDir.clone().applyAxisAngle(ax, -R(0.5, 0.95)), rEnd * b, gen + 1, { art, vein, idx: last });
    } else {
      terminals.push({ art, vein, dir: endDir.clone(), A: pts[last].clone(), V: vein.pts[last].clone() });
    }
  }

  const TRUNKS = [
    [[-16, -6.0, -1.6], [1, 0.36, 0.1], 0.085],
    [[16, 7.5, -8], [-1, -0.36, 0.14], 0.1],
    [[4, -11, -17], [-0.15, 1, 0.12], 0.115],
    [[-13, 10.5, -21], [0.55, -0.72, 0.18], 0.11],
    [[13, -9.5, -28], [-0.6, 0.66, 0.1], 0.125],
  ];
  for (const [p, d, r] of TRUNKS) grow(new V3(...p), new V3(...d), r, 0, null);
  // the trunks meet off-screen: virtual links so the reveal can spread everywhere
  for (let i = 0; i < roots.length; i++) {
    connect(roots[i].art, 0, roots[i].vein, roots[i].vein.len, 1.2);
    if (i > 0) connect(roots[i - 1].art, 0, roots[i].art, 0, 3.5);
  }

  // capillary fringe: loops from each arteriole end to its venule, plus links to neighbours
  const capR = 0.0022;
  function capillary(A, V, d, reach, art, vein, otherVeinEnd) {
    const out = randUnit().addScaledVector(d, 1.3).normalize();
    const c1 = A.clone().addScaledVector(d, reach * 0.35).addScaledVector(randUnit(), reach * 0.22);
    const mid = A.clone().lerp(V, 0.5).addScaledVector(out, reach).addScaledVector(randUnit(), reach * 0.18);
    const c2 = V.clone().addScaledVector(d, reach * 0.35).addScaledVector(randUnit(), reach * 0.22);
    const curve = new THREE.CatmullRomCurve3([A.clone(), c1, mid, c2, V.clone()], false, 'centripetal');
    const len = curve.getLength();
    const pts = curve.getSpacedPoints(Math.max(6, Math.ceil(len / 0.035)));
    const cap = addVessel(2, pts, capR, capR, 1);
    connect(art, art.len, cap, 0);
    connect(cap, cap.len, vein, otherVeinEnd ?? vein.len);
    return cap;
  }
  for (const T of terminals) {
    const k = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < k; i++) capillary(T.A, T.V, T.dir, R(0.16, 0.42), T.art, T.vein);
  }
  for (let i = 0; i < terminals.length; i++) {
    const T = terminals[i];
    let best = -1, bd = Infinity;
    for (let j = 0; j < terminals.length; j++) {
      if (j === i) continue;
      const d = terminals[j].V.distanceTo(T.A);
      if (d > 0.35 && d < 1.1 && d < bd) { bd = d; best = j; }
    }
    if (best >= 0 && rng() < 0.8) {
      const U = terminals[best];
      const dir = U.V.clone().sub(T.A).normalize().add(T.dir.clone().multiplyScalar(0.4)).normalize();
      capillary(T.A, U.V, dir, R(0.12, 0.3), T.art, U.vein);
    }
  }

  // hero capillary: a long, graceful link that draws itself first
  const H = new V3(-1.6, -0.3, 0.1);
  let hero = null;
  {
    const cand = terminals
      .map((T) => ({ T, d: T.A.distanceTo(H) + Math.max(0, T.A.z - 0.5) * 4 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12);
    let best = null;
    for (const { T, d: dT } of cand) {
      for (const U of terminals) {
        if (U === T) continue;
        const c = U.V.clone().sub(T.A);
        const L = c.length();
        if (L < 0.9 || L > 1.6) continue;
        c.normalize();
        const score = dT * 0.6 + Math.abs(c.y) * 1.2 + Math.abs(c.z) * 1.6 - c.x * 0.9 + Math.abs(L - 1.25);
        if (!best || score < best.score) best = { T, U, score };
      }
    }
    const T = best ? best.T : cand[0].T;
    const U = best ? best.U : cand[0].T;
    const A = T.A.clone();
    const Vend = U.V.clone();
    let ctrl;
    if (best) {
      const c = Vend.clone().sub(A);
      const side = new V3().crossVectors(c, new V3(0, 0, 1)).normalize();
      ctrl = [A, A.clone().addScaledVector(c, 0.22).addScaledVector(side, 0.07), A.clone().addScaledVector(c, 0.5).addScaledVector(side, -0.05).add(new V3(0, 0, 0.03)),
        A.clone().addScaledVector(c, 0.78).addScaledVector(side, 0.06), Vend];
    } else {
      const out = new V3(1, 0.1, 0).normalize();
      ctrl = [A, A.clone().addScaledVector(out, 0.4), A.clone().addScaledVector(out, 0.75).add(new V3(0, 0.08, 0)), Vend.clone().addScaledVector(out, 0.4), Vend];
    }
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    const len = curve.getLength();
    const pts = curve.getSpacedPoints(Math.max(24, Math.ceil(len / 0.02)));
    hero = addVessel(2, pts, 0.0019, 0.0019, 1);
    hero.hero = true;
    connect(T.art, T.art.len, hero, 0);
    connect(hero, hero.len, U.vein, U.vein.len);
  }

  // reveal distance along the vessel graph, starting at the hero capillary's arterial end
  const arrivals = vessels.map(() => []);
  const heap = [];
  const push = (n) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p].d <= heap[i].d) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0];
    const end = heap.pop();
    if (heap.length) {
      heap[0] = end;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].d < heap[m].d) m = l;
        if (r < heap.length && heap[r].d < heap[m].d) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  // The hero draws alone (reveal = its own arc length); the rest of the network lights up from both of
  // its ends once it is complete, spreading along the vessels.
  for (const c of hero.conns) push({ d: 0, v: c.to, arc: c.toArc });
  while (heap.length) {
    const { d, v, arc } = pop();
    const arr = arrivals[v];
    if (arr.some((a) => a.d + Math.abs(a.arc - arc) <= d + 1e-6)) continue;
    arr.push({ arc, d });
    for (const c of vessels[v].conns) if (c.to !== hero.id) push({ d: d + Math.abs(c.arc - arc) + c.cost, v: c.to, arc: c.toArc });
  }
  let maxReveal = 0;
  for (const v of vessels) {
    if (v === hero) { v.reveal = v.arc.slice(); continue; }
    const arr = arrivals[v.id];
    v.reveal = v.arc.map((s) => {
      let m = Infinity;
      for (const a of arr) m = Math.min(m, a.d + Math.abs(s - a.arc));
      return hero.len + m;
    });
    for (const r of v.reveal) if (Number.isFinite(r)) maxReveal = Math.max(maxReveal, r);
  }
  for (const v of vessels) v.reveal = v.reveal.map((r) => (Number.isFinite(r) ? r : maxReveal));

  const heroMid = hero.pts[Math.floor(hero.pts.length / 2)].clone();
  return {
    vessels,
    hero,
    heroLen: hero.len,
    heroA: hero.pts[0].clone(),
    heroB: hero.pts[hero.pts.length - 1].clone(),
    heroMid,
    maxReveal,
  };
}

// ==================================================================== ribbons (screen-space glowing lines)

const RIBBON_VERT = /* glsl */`
  attribute vec3 aPrev;
  attribute vec3 aNext;
  attribute float aSide;
  attribute vec4 aA;      // x: arc length, y: radius, z: reveal distance, w: u (0..1 along)
  attribute float aSeed;
  uniform vec2 uRes;
  uniform float uMinPx;
  uniform float uFocus;
  uniform float uCoc;
  uniform float uMaxBlur;
  varying float vSide;
  varying float vHalf;
  varying float vCore;
  varying float vBlur;
  varying float vEnergy;
  varying float vDepth;
  varying vec4 vA;
  varying float vSeed;
  vec2 toScreen(vec4 c) { return c.xy / max(c.w, 1e-4) * 0.5 * uRes; }
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec4 c = projectionMatrix * mv;
    vec2 s = toScreen(c);
    vec2 sp = toScreen(projectionMatrix * (modelViewMatrix * vec4(aPrev, 1.0)));
    vec2 sn = toScreen(projectionMatrix * (modelViewMatrix * vec4(aNext, 1.0)));
    vec2 d1 = s - sp;
    vec2 d2 = sn - s;
    float l1 = length(d1);
    float l2 = length(d2);
    vec2 dir = (l1 > 1e-4 ? d1 / l1 : vec2(0.0)) + (l2 > 1e-4 ? d2 / l2 : vec2(0.0));
    float ld = length(dir);
    dir = ld > 1e-4 ? dir / ld : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    float depth = max(-mv.z, 1e-3);
    float pxPerUnit = projectionMatrix[1][1] * 0.5 * uRes.y / depth;
    float core = aA.y * pxPerUnit;
    float coreC = max(core, uMinPx * 0.5);
    float blur = min(uCoc * abs(depth - uFocus) / depth, uMaxBlur);
    float halfW = coreC + blur * 1.6 + 1.25;
    vEnergy = core / coreC;
    vHalf = halfW;
    vCore = coreC;
    vBlur = blur;
    vSide = aSide;
    vDepth = depth;
    vA = aA;
    vSeed = aSeed;
    s += nrm * aSide * halfW;
    gl_Position = vec4(s / (0.5 * uRes) * c.w, c.z, c.w);
  }`;

const RIBBON_FRAG = /* glsl */`
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uPulse;
  uniform float uReveal;
  uniform float uFog;
  uniform float uFogStart;
  uniform float uBeat;
  uniform float uFlow;
  uniform vec3 uFrontColor;
  uniform float uGain;
  varying float vSide;
  varying float vHalf;
  varying float vCore;
  varying float vBlur;
  varying float vEnergy;
  varying float vDepth;
  varying vec4 vA;
  varying float vSeed;
  float beatShape(float p) {
    p = fract(p);
    return exp(-pow((p - 0.06) / 0.045, 2.0)) + 0.35 * exp(-pow((p - 0.30) / 0.07, 2.0));
  }
  void main() {
    float rev = uReveal - vA.z;
    if (rev < 0.0) discard;
    float x = abs(vSide) * vHalf;
    float sharp = 1.0 - smoothstep(vCore - 0.85, vCore + 0.85, x);
    float t = clamp(x / vCore, 0.0, 1.0);
    float ts = clamp(vSide * vHalf / vCore, -1.0, 1.0);
    // a lit, translucent tube: glowing volume, brighter wall, and a soft specular streak off-centre
    float vol = sqrt(max(1.0 - t * t, 0.0));
    float tube = 0.3 + 0.55 * vol + 0.45 * pow(t, 6.0) + 0.55 * exp(-pow((ts + 0.42) / 0.17, 2.0));
    float profSharp = sharp * mix(1.0, tube, smoothstep(2.0, 6.0, vCore));
    float sigma = vCore + vBlur * 0.55;
    float gauss = exp(-0.5 * x * x / (sigma * sigma)) * (vCore / sigma);
    float bf = clamp(vBlur / (vCore + 1.0), 0.0, 1.0);
    float prof = mix(profSharp, gauss, bf);
    float pulse = 1.0 + uPulse * beatShape(uBeat - vA.x * 0.08);
    float shimmer = 0.86 + 0.14 * sin(vA.x * 24.0 - uFlow * 8.0 + vSeed * 6.2831);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.1, 0.9, vA.w)) * uIntensity * pulse * shimmer;
    float head = exp(-rev * 6.0) * min(1.0, 3.0 / vCore);
    col = col * smoothstep(0.0, 0.05, rev) + uFrontColor * head * 2.2;
    col /= 1.0 + 0.12 * max(vCore - 6.0, 0.0);
    col *= exp(-uFog * max(vDepth - uFogStart, 0.0));
    gl_FragColor = vec4(col * prof * vEnergy * uGain, 1.0);
  }`;

function makeRibbons(THREE, list, shared, { colorA, colorB, intensity, pulse }) {
  let nPts = 0, nIdx = 0;
  for (const v of list) { nPts += v.pts.length; nIdx += (v.pts.length - 1) * 6; }
  const nV = nPts * 2;
  const pos = new Float32Array(nV * 3), prev = new Float32Array(nV * 3), next = new Float32Array(nV * 3);
  const side = new Float32Array(nV), aA = new Float32Array(nV * 4), seed = new Float32Array(nV);
  const index = new Uint32Array(nIdx);
  let vi = 0, ii = 0;
  for (const v of list) {
    const n = v.pts.length;
    const base = vi;
    for (let i = 0; i < n; i++) {
      const p = v.pts[i], pp = v.pts[Math.max(0, i - 1)], pn = v.pts[Math.min(n - 1, i + 1)];
      for (let s = -1; s <= 1; s += 2) {
        pos.set([p.x, p.y, p.z], vi * 3);
        prev.set([pp.x, pp.y, pp.z], vi * 3);
        next.set([pn.x, pn.y, pn.z], vi * 3);
        side[vi] = s;
        aA.set([v.arc[i], v.rad[i], v.reveal[i], v.arc[i] / v.len], vi * 4);
        seed[vi] = v.seed;
        vi++;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      index[ii++] = a; index[ii++] = b; index[ii++] = c;
      index[ii++] = b; index[ii++] = d; index[ii++] = c;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3));
  geo.setAttribute('aNext', new THREE.BufferAttribute(next, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setAttribute('aA', new THREE.BufferAttribute(aA, 4));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uColorA: { value: colorA.clone() },
      uColorB: { value: colorB.clone() },
      uIntensity: { value: intensity },
      uPulse: { value: pulse },
    },
    vertexShader: RIBBON_VERT,
    fragmentShader: RIBBON_FRAG,
    // opaque list + additive blending: drawn before the transmissive glass, so the barrel refracts them
    transparent: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}

// ==================================================================== blood cells (GPU path following)

const CELL_VERT = /* glsl */`
  attribute vec4 aPath;   // x: first point, y: point count, z: path length, w: kind
  attribute vec4 aP;      // x: phase, y: speed, z: lane angle, w: lane radius
  attribute float aSize;
  uniform sampler2D uPaths;
  uniform float uTexW;
  uniform float uFlowA;
  uniform float uFlowV;
  uniform float uFlowC;
  uniform vec2 uRes;
  uniform float uMinPx;
  uniform float uFocus;
  uniform float uCoc;
  uniform float uMaxBlur;
  uniform float uReveal;
  varying float vEnergy;
  varying float vBlurF;
  varying float vShow;
  varying float vKind;
  varying float vDepth;
  vec4 fetchT(float i) {
    float x = mod(i, uTexW);
    float y = floor(i / uTexW);
    return texelFetch(uPaths, ivec2(int(x), int(y)), 0);
  }
  void main() {
    float flow = aPath.w < 0.5 ? uFlowA : (aPath.w < 1.5 ? uFlowV : uFlowC);
    float u = fract(aP.x + flow * aP.y / aPath.z);
    float fi = u * (aPath.y - 1.0);
    float i0 = floor(fi);
    float f = fi - i0;
    float i1 = min(i0 + 1.0, aPath.y - 1.0);
    vec4 a0 = fetchT((aPath.x + i0) * 2.0);
    vec4 a1 = fetchT((aPath.x + i1) * 2.0);
    float r0 = fetchT((aPath.x + i0) * 2.0 + 1.0).x;
    float r1 = fetchT((aPath.x + i1) * 2.0 + 1.0).x;
    vec3 p = mix(a0.xyz, a1.xyz, f);
    float rad = mix(a0.w, a1.w, f);
    vec3 tn = a1.xyz - a0.xyz;
    tn = length(tn) > 1e-6 ? normalize(tn) : vec3(0.0, 1.0, 0.0);
    vec3 up = abs(tn.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 b1 = normalize(cross(tn, up));
    vec3 b2 = cross(tn, b1);
    p += (b1 * cos(aP.z) + b2 * sin(aP.z)) * rad * aP.w * 0.7;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = max(-mv.z, 1e-3);
    float pxPerUnit = projectionMatrix[1][1] * 0.5 * uRes.y / depth;
    float sz = aSize * pxPerUnit;
    float szC = max(sz, uMinPx);
    float blur = min(uCoc * abs(depth - uFocus) / depth, uMaxBlur);
    float total = szC + 2.0 * blur;
    gl_PointSize = total + 1.0;
    vEnergy = (sz / szC) * (szC * szC) / (total * total);
    vBlurF = clamp(2.0 * blur / total, 0.0, 1.0);
    vShow = smoothstep(0.0, 0.2, uReveal - mix(r0, r1, f));
    vKind = aPath.w;
    vDepth = depth;
    gl_Position = projectionMatrix * mv;
  }`;

const CELL_FRAG = /* glsl */`
  uniform float uFog;
  uniform float uFogStart;
  uniform float uGain;
  varying float vEnergy;
  varying float vBlurF;
  varying float vShow;
  varying float vKind;
  varying float vDepth;
  void main() {
    if (vShow <= 0.001) discard;
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    float disc = 1.0 - smoothstep(0.8, 1.0, r);
    float rimB = smoothstep(0.5, 0.92, r) * disc;
    float bokeh = disc * 0.7 + rimB * 0.55;
    float dotS = exp(-r * r * 3.2) * (0.75 + 0.25 * smoothstep(0.15, 0.6, r));
    float shape = mix(dotS, bokeh, vBlurF);
    vec3 col = vKind < 0.5 ? vec3(1.0, 0.42, 0.34) * 2.6 : (vKind < 1.5 ? vec3(0.36, 0.52, 1.0) * 1.9 : vec3(0.85, 0.5, 1.0) * 1.1);
    col *= exp(-uFog * max(vDepth - uFogStart, 0.0));
    gl_FragColor = vec4(col * uGain, shape * vEnergy * vShow);
  }`;

function makeCells(THREE, net, shared, count) {
  // pick which vessels carry cells, weighted by length and calibre
  const pool = [];
  let total = 0;
  for (const v of net.vessels) {
    if (v.hero) continue;
    const w = v.kind === 2 ? v.len * 0.06 : v.len * (0.25 + v.rad[0] * 22);
    pool.push({ v, w });
    total += w;
  }
  const rng = mulberry32(99);
  const chosen = new Map();
  const cum = new Float64Array(pool.length);
  let acc = 0;
  for (let k = 0; k < pool.length; k++) { acc += pool[k].w; cum[k] = acc; }
  for (let i = 0; i < count; i++) {
    const x = rng() * total;
    let lo = 0, hi = pool.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < x) lo = mid + 1; else hi = mid; }
    const v = pool[lo].v;
    chosen.set(v, (chosen.get(v) || 0) + 1);
  }
  // pack the chosen paths: two texels per point (xyz + radius, reveal)
  const TEXW = 1024;
  let nPts = 0;
  for (const v of chosen.keys()) nPts += v.pts.length;
  const texH = Math.max(1, Math.ceil((nPts * 2) / TEXW));
  const data = new Float32Array(TEXW * texH * 4);
  const aPath = new Float32Array(count * 4), aP = new Float32Array(count * 4), aSize = new Float32Array(count);
  const pos = new Float32Array(count * 3);
  let pi = 0, ci = 0;
  for (const [v, n] of chosen) {
    const first = pi;
    for (let i = 0; i < v.pts.length; i++) {
      const p = v.pts[i];
      data.set([p.x, p.y, p.z, v.rad[i]], (pi * 2) * 4);
      data.set([v.reveal[i], v.arc[i], 0, 0], (pi * 2 + 1) * 4);
      pi++;
    }
    for (let j = 0; j < n; j++) {
      const speed = v.kind === 0 ? 0.75 + rng() * 0.6 : v.kind === 1 ? -(0.45 + rng() * 0.35) : 0.1 + rng() * 0.1;
      aPath.set([first, v.pts.length, v.len, v.kind], ci * 4);
      aP.set([rng(), speed, rng() * Math.PI * 2, Math.sqrt(rng())], ci * 4);
      aSize[ci] = v.kind === 2 ? 0.008 : 0.013 + rng() * 0.012;
      const p = v.pts[0];
      pos.set([p.x, p.y, p.z], ci * 3);
      ci++;
    }
  }
  const tex = new THREE.DataTexture(data, TEXW, texH, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPath', new THREE.BufferAttribute(aPath, 4));
  geo.setAttribute('aP', new THREE.BufferAttribute(aP, 4));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  const uniforms = {
    uRes: shared.uRes, uMinPx: shared.uMinPx, uFocus: shared.uFocus, uCoc: shared.uCoc, uMaxBlur: shared.uMaxBlur,
    uReveal: shared.uReveal, uFog: shared.uFog, uFogStart: shared.uFogStart, uGain: shared.uGain,
    uPaths: { value: tex }, uTexW: { value: TEXW },
    uFlowA: { value: 0 }, uFlowV: { value: 0 }, uFlowC: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: CELL_VERT,
    fragmentShader: CELL_FRAG,
    transparent: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 11;
  return { points, uniforms, texture: tex };
}

// ==================================================================== final pass: tone map, grade, vignette, grain

function makeFinalPass(THREE, Pass, FullScreenQuad) {
  const uniforms = {
    tDiffuse: { value: null },
    toneMappingExposure: { value: 1 },
    uTime: { value: 0 },
    uFade: { value: 1 },
    uFadeIn: { value: 0 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.035 },
    uCA: { value: 0.0016 },
  };
  const material = new THREE.RawShaderMaterial({
    name: 'IntroFinal',
    uniforms,
    defines: { ACES_FILMIC_TONE_MAPPING: '', SRGB_TRANSFER: '' },
    vertexShader: /* glsl */`
      precision highp float;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      attribute vec3 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uFade;
      uniform float uFadeIn;
      uniform float uVignette;
      uniform float uGrain;
      uniform float uCA;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void main() {
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        vec2 off = c * uCA * (0.4 + 2.2 * r2);
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + off).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - off).b;
        col = ACESFilmicToneMapping(col);
        vec4 o = sRGBTransferOETF(vec4(col, 1.0));
        float vig = 1.0 - uVignette * smoothstep(0.08, 0.72, r2 * 1.6);
        o.rgb *= vig;
        float g = hash(vUv * 1024.0 + fract(uTime * 7.13) * 91.7) - 0.5;
        o.rgb += g * uGrain * (0.35 + 0.65 * (1.0 - o.g));
        o.rgb *= uFade * uFadeIn;
        gl_FragColor = vec4(max(o.rgb, 0.0), 1.0);
      }`,
  });
  const quad = new FullScreenQuad(material);
  const pass = new Pass();
  pass.uniforms = uniforms;
  pass.render = function render(renderer, writeBuffer, readBuffer) {
    uniforms.tDiffuse.value = readBuffer.texture;
    uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      quad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      quad.render(renderer);
    }
  };
  pass.dispose = function dispose() { material.dispose(); quad.dispose(); };
  return pass;
}

function radialTexture(THREE, stops = [[0, 1], [0.18, 0.55], [0.45, 0.12], [1, 0]]) {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, a] of stops) grd.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
