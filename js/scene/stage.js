// PeptideScope: 3D stage (body3d).
// Renderer, camera, orbit controls, environment lighting, post-processing, render loop.
//
//   const stage = await createStage(host /* #stage-host */, { reducedMotion, theme });
//   stage.onFrame((dt, t) => { ... }) → off
//   stage.flyTo({ target:[x,y,z], distance, azimuth, elevation, duration }) → Promise
//   stage.pick(clientX, clientY, objects) → intersection | null
//   stage.project([x,y,z] | Vector3, out?) → { x, y, visible }   (CSS px relative to host)
//   stage.setTheme('dark'|'light'); stage.resize(); stage.dispose()
// Extras (additive): stage.onTheme(fn) → off; stage.setReducedMotion(bool); stage.homeView(opts);
//   stage.zoom(factor); stage.getView(); stage.fitDistance(halfH, halfW); stage.homeDistance;
//   stage.onContextChange(fn(lost)) → off; stage.contextLost;
//   stage.setBodyFrame(heightM, scaleRatio) — the editable body's height: the home framing grows for
//     tall bodies (shorter ones keep the default frame, so they read as shorter); a camera at home
//     follows, one framing something else keeps it centred as the body scales; stage.homeTarget
//   stage.advance(seconds, step) — dev/test hook: deterministic time steps + one frame
//   (with stage.timeScale = 0 the real-time loop keeps drawing but scene time stands still).
//   stage.lights { key, rim, fill, hemi }; stage.quality ('high' | 'low'); stage.setBloom(bool)
//
// Deep zoom (v3): the mouse wheel and a pinch zoom toward the point under the cursor. Before each zoom
// step the orbit pivot moves (along the current view axis, so the picture does not jump) to the depth
// of the surface under the cursor, found by stage.surfacePicker(clientX, clientY) → Vector3 | null
// (index.js supplies it from the visible layers); the camera can then come to within MIN_DIST of that
// surface but never through it. The near plane follows the distance (down to 1 mm), panning is on
// while zoomed in (right-drag, Shift/⌘-drag, two fingers), the pivot stays inside the body's bounds,
// and pulling back out drifts the pivot home so the whole body is centred again.
//   stage.focusPoint(point, { distance, duration }) — fly so `point` is the pivot (double-click focus)
//   stage.minDistance; stage.zoomed (closer than ~70 % of the home distance)
//
// Budget: pixel ratio capped at 1.75 (1.5 on phones and low-end devices) and stepped down when frames
// are slow; bloom runs at half resolution (UnrealBloomPass) and is skipped on phones and low-end
// devices, or switched off when frames stay slow at the lowest pixel ratio; the loop stops when the
// stage is off-screen, the tab is hidden or the WebGL context is lost (a status note shows, and the
// prefiltered environment is rebuilt on restore).
//
// Conventions (docs/ARCHITECTURE.md, "3D world contract"): meters, Y up, feet at y = 0, the body
// faces +Z, the person's left is +X. flyTo angles are DEGREES: azimuth 0 = camera in front of the
// body (+Z), positive azimuth swings toward the person's left (+X); elevation 0 = level, positive =
// looking down from above. duration is in milliseconds (values ≤ 10 are read as seconds).
//
// The canvas is transparent: the stage frame's CSS background (--stage-bg, the warm vignette in
// stage.css, the HUD) shows through, so the scene sits seamlessly in both themes. Bloom is composited
// as additive light (alpha is left untouched) and kept restrained: luminous over obsidian, nearly
// absent over ivory. Luxury palette (v2): warm key light, champagne rim, champagne floor hairlines.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const DEG = Math.PI / 180;
const FOV = 30;
// Body bounds used to frame the "home" shot (meters).
const BODY_HALF_H = 0.93;
const BODY_HALF_W = 0.42;
const HOME_TARGET = [0, 0.9, 0];
const HOME_AZ = 16;
const HOME_EL = 4;
const MIN_DIST = 0.024;      // m: closest the camera comes to the pivot (a ~13 mm field of view)
const NEAR_MIN = 0.001;      // m: the near plane at the closest zoom
const NEAR_MAX = 0.05;
// Bounds the orbit pivot may wander within while panning (model frame at scale 1, metres).
const PIVOT_BOX = { x: 0.62, y0: 0.0, y1: 1.98, z: 0.42 };

// Phones, tablets and low-end machines get a lighter pipeline (no bloom, a lower pixel-ratio cap,
// fewer particles). `quality` may force it ('high' | 'low'); 'auto' decides from the device.
export function detectQuality(pref = 'auto') {
  if (pref === 'high' || pref === 'low') return pref;
  try {
    const coarse = !!globalThis.matchMedia?.('(pointer: coarse)').matches && !globalThis.matchMedia?.('(any-pointer: fine)').matches;
    const cores = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 8;
    return coarse || cores <= 4 || mem <= 4 ? 'low' : 'high';
  } catch { return 'high'; }
}

export const STAGE_THEMES = {
  dark: {
    bloomStrength: 0.42, bloomRadius: 0.42, bloomThreshold: 0.8,
    exposure: 1.0,
    key: 1.1, rim: 1.25, fill: 0.28, env: 0.4,
    rimColor: 0xe6d3a3, keyColor: 0xfff3e2, hemiSky: 0xf1e6d2, hemiGround: 0x120e0a,
    floor: 0xc8a96a, floorAlpha: 0.44, floorGlow: 0x4a3a20,
  },
  light: {
    bloomStrength: 0.12, bloomRadius: 0.3, bloomThreshold: 0.95,
    exposure: 1.0,
    key: 2.0, rim: 0.6, fill: 0.7, env: 0.75,
    rimColor: 0xf3e6c8, keyColor: 0xfffaf0, hemiSky: 0xfffdf8, hemiGround: 0xcfc3ad,
    floor: 0x2e2920, floorAlpha: 0.42, floorGlow: 0xd9c9a6,
  },
};

// Smooth camera easing (in-out, long settle). Precomputed cubic-bezier(.45,.05,.2,1) lookup.
const EASE_LUT = (() => {
  const n = 256, lut = new Float32Array(n + 1);
  const p1x = 0.45, p1y = 0.05, p2x = 0.2, p2y = 1;
  const bx = (s) => 3 * (1 - s) * (1 - s) * s * p1x + 3 * (1 - s) * s * s * p2x + s * s * s;
  const by = (s) => 3 * (1 - s) * (1 - s) * s * p1y + 3 * (1 - s) * s * s * p2y + s * s * s;
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    let lo = 0, hi = 1, s = x;
    for (let k = 0; k < 30; k++) { s = (lo + hi) / 2; if (bx(s) < x) lo = s; else hi = s; }
    lut[i] = by(s);
  }
  return lut;
})();
export function easeCamera(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const x = t * 256, i = Math.floor(x), f = x - i;
  return EASE_LUT[i] + (EASE_LUT[i + 1] - EASE_LUT[i]) * f;
}

function makeFloor() {
  const geo = new THREE.CircleGeometry(1.15, 96);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uAlpha: { value: 0.5 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vXZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform vec3 uGlow; uniform float uAlpha; uniform float uTime;
      varying vec2 vXZ;
      float ringLine(float r, float radius, float w) {
        float d = abs(r - radius);
        float fw = max(fwidth(r), 1e-4);
        return 1.0 - smoothstep(w, w + fw * 1.5, d);
      }
      void main() {
        float r = length(vXZ);
        float a = 0.0;
        // a watch-dial floor: three hairline rings, sixty minute ticks and twelve longer indices on the
        // middle ring, and very faint concentric lines near the feet
        a += ringLine(r, 0.34, 0.0004) * 0.5;
        a += ringLine(r, 0.62, 0.0005) * 0.42;
        a += ringLine(r, 0.92, 0.0004) * 0.2;
        float f = r / 0.05;
        float g = abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-4);
        a += (1.0 - min(g, 1.0)) * 0.06 * (1.0 - smoothstep(0.1, 0.55, r));
        float ang = atan(vXZ.y, vXZ.x);
        float tk = abs(fract(ang / 6.2831853 * 60.0) - 0.5);
        float tickMask = step(0.6, r) * (1.0 - step(0.635, r));
        a += (1.0 - smoothstep(0.05, 0.1, tk * 2.0 * r * 2.0)) * tickMask * 0.3;
        float hk = abs(fract(ang / 6.2831853 * 12.0) - 0.5);
        float hourMask = step(0.6, r) * (1.0 - step(0.675, r));
        a += (1.0 - smoothstep(0.03, 0.06, hk * 2.0 * r * 2.0)) * hourMask * 0.3;
        // soft pool of light under the figure
        float pool = exp(-r * r * 9.0);
        vec3 col = uColor * a + uGlow * pool * 0.5;
        float alpha = (a + pool * 0.3) * uAlpha * (1.0 - smoothstep(0.75, 1.15, r));
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'floor';
  mesh.renderOrder = -5;
  mesh.position.y = 0.0005;
  return mesh;
}

export async function createStage(host, { reducedMotion = false, theme = 'dark', quality = 'auto' } = {}) {
  if (!host) throw new Error('createStage: host element required');
  const canvasHost = host.querySelector('#stage-canvas-host') || host;

  const renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '3D body. Arrow keys rotate, plus and minus zoom, Home resets the view.');
  canvas.classList.add('stage-canvas');
  canvasHost.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, NEAR_MAX, 40);
  const tier = detectQuality(quality);
  const tanHalf = Math.tan((FOV * DEG) / 2);

  // ---- environment + lights
  // The prefiltered environment lives only on the GPU, so it is rebuilt after a context restore.
  function buildEnv() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    room.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    room.dispose?.();
    pmrem.dispose();
    return rt;
  }
  let envRT = buildEnv();
  scene.environment = envRT.texture;

  const hemi = new THREE.HemisphereLight(0xf1e6d2, 0x120e0a, 0.4);
  const key = new THREE.DirectionalLight(0xfff3e2, 1.5);
  key.position.set(1.6, 3.2, 2.6);
  const rim = new THREE.DirectionalLight(0xe6d3a3, 1.4);
  rim.position.set(-2.2, 1.8, -2.6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-2.4, 0.6, 1.8);
  scene.add(hemi, key, rim, fill);

  const floor = makeFloor();
  scene.add(floor);

  // ---- controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.minDistance = MIN_DIST;
  controls.maxDistance = 6;
  // zoom toward the cursor (the pivot is first moved to the surface under it; see onWheelCapture)
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;
  controls.panSpeed = 0.8;
  controls.minPolarAngle = 0.27 * Math.PI; // ~41° above level
  controls.maxPolarAngle = 0.62 * Math.PI; // ~22° below level
  controls.target.set(...HOME_TARGET);
  // One-finger vertical swipes keep scrolling the page; horizontal drags rotate; pinch zooms.
  canvas.style.touchAction = 'pan-y';

  // ---- post-processing
  const size = { width: 1, height: 1 };
  const dpr = window.devicePixelRatio || 1;
  const prMax = Math.min(dpr, tier === 'low' ? 1.5 : 1.75);
  const prMin = Math.min(tier === 'low' ? 0.85 : 1, prMax);
  let pr = prMax;
  // MSAA on the HDR target; high-density screens need fewer samples for the same smoothness
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: dpr > 1.5 || tier === 'low' ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  // UnrealBloomPass already extracts and blurs at half resolution internally.
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.8, 0.5, 0.5);
  // Composite bloom as additive light and leave alpha untouched (transparent canvas).
  {
    const bm = bloom.blendMaterial;
    if (bm) {
      bm.blending = THREE.CustomBlending;
      bm.blendEquation = THREE.AddEquation;
      bm.blendSrc = THREE.SrcAlphaFactor;
      bm.blendDst = THREE.OneFactor;
      bm.blendEquationAlpha = THREE.AddEquation;
      bm.blendSrcAlpha = THREE.ZeroFactor;
      bm.blendDstAlpha = THREE.OneFactor;
      bm.needsUpdate = true;
    }
  }
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(outputPass);
  let bloomWanted = tier !== 'low';
  bloom.enabled = bloomWanted;

  // ---- state
  const frameFns = [];
  const themeFns = [];
  let disposed = false;
  let running = false;
  let contextLost = false;
  let inView = true;
  let last = 0;
  let time = 0;
  let homeDistance = 3.6;
  const homeTarget = new THREE.Vector3(...HOME_TARGET);
  const prevHomeTarget = new THREE.Vector3();
  let bodyHalfH = BODY_HALF_H;
  let bodyH = 1.75;           // current body height (m), for the pivot bounds
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hits = [];
  const tmpV = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const sph = new THREE.Spherical();

  const stage = {
    scene, camera, renderer, controls, composer, bloom, canvas, host,
    envMap: envRT.texture,
    size,
    theme: theme === 'light' ? 'light' : 'dark',
    reducedMotion: !!reducedMotion,
    timeScale: 1,
    quality: tier,
    lights: { key, rim, fill, hemi },
    minDistance: MIN_DIST,
    surfacePicker: null,      // (clientX, clientY) → Vector3 | null, set by index.js
    get time() { return time; },
    get flying() { return flight.active; },
    get homeDistance() { return homeDistance; },
    get homeTarget() { return homeTarget; },
    get zoomed() { return camera.position.distanceTo(controls.target) < homeDistance * 0.7; },
  };
  stage.setBloom = (on) => { bloomWanted = !!on; bloom.enabled = bloomWanted; };

  // ---------------------------------------------------------------- theme
  function setTheme(next) {
    stage.theme = next === 'light' ? 'light' : 'dark';
    const T = STAGE_THEMES[stage.theme];
    bloom.strength = T.bloomStrength;
    bloom.radius = T.bloomRadius;
    bloom.threshold = T.bloomThreshold;
    renderer.toneMappingExposure = T.exposure;
    key.intensity = T.key; key.color.setHex(T.keyColor);
    rim.intensity = T.rim; rim.color.setHex(T.rimColor);
    fill.intensity = T.fill;
    hemi.color.setHex(T.hemiSky); hemi.groundColor.setHex(T.hemiGround);
    scene.environmentIntensity = T.env;
    floor.material.uniforms.uColor.value.setHex(T.floor);
    floor.material.uniforms.uGlow.value.setHex(T.floorGlow);
    floor.material.uniforms.uAlpha.value = T.floorAlpha;
    for (const fn of themeFns.slice()) { try { fn(stage.theme); } catch (e) { console.error('[stage] theme listener failed', e); } }
  }
  stage.setTheme = setTheme;
  stage.onTheme = (fn) => { themeFns.push(fn); return () => { const i = themeFns.indexOf(fn); if (i >= 0) themeFns.splice(i, 1); }; };

  stage.setReducedMotion = (on) => {
    stage.reducedMotion = !!on;
    controls.enableDamping = !on;
  };

  // ---------------------------------------------------------------- sizing
  function computeHome() {
    return stage.fitDistance(bodyHalfH, BODY_HALF_W) * 1.04;
  }
  stage.fitDistance = (halfH, halfW = 0) => {
    const aspect = size.width / size.height || 1;
    return Math.max(halfH / tanHalf, halfW / (tanHalf * aspect));
  };
  function applySize() {
    const w = Math.max(1, Math.round(canvasHost.clientWidth || host.clientWidth || 1));
    const h = Math.max(1, Math.round(canvasHost.clientHeight || host.clientHeight || 1));
    size.width = w; size.height = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const prevHome = homeDistance;
    homeDistance = computeHome();
    controls.maxDistance = homeDistance * 1.35;
    // Keep the home framing when the stage changes shape while the camera is at home distance.
    const d = camera.position.distanceTo(controls.target);
    if (!flight.active && Math.abs(d - prevHome) < 0.02 * prevHome) {
      offset.copy(camera.position).sub(controls.target).setLength(homeDistance);
      camera.position.copy(controls.target).add(offset);
    }
    stage.pixelRatio = pr;
    stage.viewScale = (h * pr) / (2 * tanHalf); // world size → device px at distance 1
  }
  stage.resize = applySize;
  let resizeRaf = 0;
  const ro = new ResizeObserver(() => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; if (!disposed) applySize(); });
  });
  ro.observe(canvasHost);

  // Adaptive resolution: step the pixel ratio down when frames are slow, back up when there is headroom.
  let perfAcc = 0, perfFrames = 0, perfCool = 0;
  function adapt(dt) {
    perfAcc += dt; perfFrames++;
    if (perfAcc < 1.25) return;
    const fps = perfFrames / perfAcc;
    perfAcc = 0; perfFrames = 0;
    if (perfCool > 0) { perfCool--; return; }
    if (fps < 48 && pr > prMin + 0.01) { pr = Math.max(prMin, pr - 0.25); applySize(); perfCool = 1; }
    else if (fps < 30 && bloom.enabled) { bloom.enabled = false; perfCool = 2; } // still slow at the lowest ratio
    else if (fps > 58 && pr < prMax - 0.01) { pr = Math.min(prMax, pr + 0.125); applySize(); perfCool = 3; }
  }

  // ---------------------------------------------------------------- camera flights
  const flight = {
    active: false, t: 0, dur: 1,
    fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3(),
    fromR: 1, toR: 1, fromAz: 0, dAz: 0, fromEl: 0, toEl: 0, resolve: null,
  };
  function currentView() {
    offset.copy(camera.position).sub(controls.target);
    sph.setFromVector3(offset);
    return { r: sph.radius, az: sph.theta, el: Math.PI / 2 - sph.phi };
  }
  function placeCamera(target, r, az, el) {
    const phi = Math.PI / 2 - el;
    sph.set(r, phi, az);
    offset.setFromSpherical(sph);
    camera.position.copy(target).add(offset);
    controls.target.copy(target);
    camera.lookAt(target);
  }
  function clearControlInertia() {
    // OrbitControls keeps damped deltas internally; drop them so a flight never drifts afterwards.
    try {
      controls._sphericalDelta?.set(0, 0, 0);
      controls._panOffset?.set(0, 0, 0);
      if ('_scale' in controls) controls._scale = 1;
    } catch { /* private fields may change between three releases */ }
  }
  function endFlight() {
    if (!flight.active) return;
    flight.active = false;
    controls.enabled = true;
    clearControlInertia();
    controls.update();
    const r = flight.resolve; flight.resolve = null;
    r?.();
  }
  stage.flyTo = ({ target, distance, azimuth, elevation, duration = 1400 } = {}) => {
    if (flight.active) endFlight();
    const cur = currentView();
    const toTarget = new THREE.Vector3();
    if (target && target.isVector3) toTarget.copy(target);
    else if (Array.isArray(target)) toTarget.set(target[0], target[1], target[2]);
    else toTarget.copy(controls.target);
    const toR = Math.max(MIN_DIST, distance ?? cur.r);
    const toAz = azimuth == null ? cur.az : azimuth * DEG;
    const elMax = Math.PI / 2 - controls.minPolarAngle;
    const elMin = Math.PI / 2 - controls.maxPolarAngle;
    const toEl = THREE.MathUtils.clamp(elevation == null ? cur.el : elevation * DEG, elMin + 1e-3, elMax - 1e-3);
    let dAz = toAz - cur.az;
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz)); // shortest way round
    const ms = duration <= 10 ? duration * 1000 : duration;
    if (stage.reducedMotion || ms <= 0) {
      placeCamera(toTarget, toR, cur.az + dAz, toEl);
      clearControlInertia();
      controls.update();
      return Promise.resolve();
    }
    flight.fromTarget.copy(controls.target);
    flight.toTarget.copy(toTarget);
    flight.fromR = cur.r; flight.toR = toR;
    flight.fromAz = cur.az; flight.dAz = dAz;
    flight.fromEl = cur.el; flight.toEl = toEl;
    flight.t = 0; flight.dur = ms / 1000;
    flight.active = true;
    controls.enabled = false;
    clearControlInertia();
    return new Promise((res) => { flight.resolve = res; });
  };
  const flyTarget = new THREE.Vector3();
  function stepFlight(dt) {
    flight.t += dt;
    const k = Math.min(1, flight.t / flight.dur);
    const e = easeCamera(k);
    flyTarget.lerpVectors(flight.fromTarget, flight.toTarget, e);
    // Distance eases in log space so long pull-backs feel even.
    const r = Math.exp(Math.log(flight.fromR) + (Math.log(flight.toR) - Math.log(flight.fromR)) * e);
    placeCamera(flyTarget, r, flight.fromAz + flight.dAz * e, flight.fromEl + (flight.toEl - flight.fromEl) * e);
    if (k >= 1) endFlight();
  }
  stage.cancelFlight = endFlight;
  stage.homeView = (opts = {}) => stage.flyTo({
    target: homeTarget.toArray(), distance: homeDistance, azimuth: HOME_AZ, elevation: HOME_EL, duration: 1300, ...opts,
  });
  // Editable body (appearance only): bodies up to the default height keep the default frame (so a
  // shorter body reads as shorter against the floor rings); taller ones widen it so the head stays in
  // view. A camera at home follows the new home; any other view stays centred on what it frames as
  // the body scales about the feet. Called on every tween step; no allocation.
  stage.setBodyFrame = (heightM = 1.75, scaleRatio = 1) => {
    bodyH = heightM > 0.5 ? heightM : 1.75;
    prevHomeTarget.copy(homeTarget);
    const prevDist = homeDistance;
    bodyHalfH = Math.max(BODY_HALF_H, heightM / 2 + 0.055);
    homeTarget.set(0, bodyHalfH - 0.03, 0);
    homeDistance = computeHome();
    controls.maxDistance = homeDistance * 1.35;
    if (flight.active) return;
    offset.copy(camera.position).sub(controls.target);
    const d = offset.length();
    const atHome = controls.target.distanceTo(prevHomeTarget) < 0.02 && Math.abs(d - prevDist) < 0.03 * prevDist;
    if (atHome) {
      offset.setLength(homeDistance);
      controls.target.copy(homeTarget);
    } else if (Number.isFinite(scaleRatio) && Math.abs(scaleRatio - 1) > 1e-6) {
      controls.target.multiplyScalar(scaleRatio);
    } else return;
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
  };
  stage.getView = () => {
    const v = currentView();
    return { target: controls.target.toArray(), distance: v.r, azimuth: v.az / DEG, elevation: v.el / DEG };
  };
  // Double-click / double-tap focus: the point becomes the pivot and the camera closes in on it along
  // the current view direction (the camera was looking at that surface, so it stays outside it).
  stage.focusPoint = (p, { distance, duration = 950 } = {}) => {
    if (!p) return Promise.resolve();
    const cur = currentView();
    const d = distance ?? THREE.MathUtils.clamp(cur.r * 0.38, MIN_DIST * 3, homeDistance * 0.55);
    return stage.flyTo({ target: p.isVector3 ? p.toArray() : p, distance: d, duration });
  };

  // ---------------------------------------------------------------- deep zoom helpers
  // Move the orbit pivot along the current view axis to the depth of the surface under the cursor, so a
  // zoom step heads for that surface and stops MIN_DIST short of it (the picture does not move: the
  // pivot stays on the line the camera already looks along). Picks are throttled while wheeling.
  const fwd = new THREE.Vector3();
  const rel = new THREE.Vector3();
  let lastPickT = -1e9, lastPickX = -1e4, lastPickY = -1e4;
  function pivotToSurface(clientX, clientY, force = false) {
    if (typeof stage.surfacePicker !== 'function' || flight.active) return false;
    const now = performance.now();
    if (!force && now - lastPickT < 90 && Math.abs(clientX - lastPickX) + Math.abs(clientY - lastPickY) < 8) return false;
    lastPickT = now; lastPickX = clientX; lastPickY = clientY;
    let p = null;
    try { p = stage.surfacePicker(clientX, clientY); } catch (e) { console.warn('[stage] surface pick failed', e); }
    if (!p) return false;
    camera.getWorldDirection(fwd);
    const depth = rel.subVectors(p, camera.position).dot(fwd);
    if (depth < controls.minDistance * 1.05 || depth > controls.maxDistance * 0.98) return false;
    controls.target.copy(camera.position).addScaledVector(fwd, depth);
    return true;
  }
  stage.pivotToSurface = pivotToSurface;
  let touchZoomed = false;
  stage.autoCenter = true; // pulling back out drifts the pivot home (index.js pauses it during the sequence)
  // After the controls move the camera: near plane, panning, pivot bounds and the drift home.
  function afterControls(dt) {
    offset.subVectors(camera.position, controls.target);
    const r = offset.length();
    const near = THREE.MathUtils.clamp(r * 0.04, NEAR_MIN, NEAR_MAX);
    if (Math.abs(near - camera.near) > camera.near * 0.04) { camera.near = near; camera.updateProjectionMatrix(); }
    const zoomedIn = r < homeDistance * 0.7;
    controls.enablePan = !flight.active && zoomedIn;
    // zoomed in, one-finger drags turn the body instead of scrolling the page
    if (zoomedIn !== touchZoomed) { touchZoomed = zoomedIn; canvas.style.touchAction = zoomedIn ? 'none' : 'pan-y'; }
    if (flight.active) return;
    const k = bodyH / 1.75;
    const t = controls.target;
    let tx = THREE.MathUtils.clamp(t.x, -PIVOT_BOX.x * k, PIVOT_BOX.x * k);
    let ty = THREE.MathUtils.clamp(t.y, PIVOT_BOX.y0, PIVOT_BOX.y1 * k);
    let tz = THREE.MathUtils.clamp(t.z, -PIVOT_BOX.z * k, PIVOT_BOX.z * k);
    const out = stage.autoCenter ? THREE.MathUtils.smoothstep(r / homeDistance, 0.72, 0.95) : 0;
    if (out > 0) {
      const e = (stage.reducedMotion ? 1 : 1 - Math.exp(-dt * 2.6)) * out;
      tx += (homeTarget.x - tx) * e; ty += (homeTarget.y - ty) * e; tz += (homeTarget.z - tz) * e;
    }
    const dx = tx - t.x, dy = ty - t.y, dz = tz - t.z;
    if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1e-7) {
      t.set(tx, ty, tz);
      camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;
    }
  }

  // ---------------------------------------------------------------- picking + projection
  stage.pick = (clientX, clientY, objects) => {
    if (!objects || !objects.length) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    hits.length = 0;
    raycaster.intersectObjects(objects, true, hits);
    return hits.length ? hits[0] : null;
  };
  stage.project = (p, out = {}) => {
    if (p && p.isVector3) tmpV.copy(p); else tmpV.set(p[0], p[1], p[2]);
    tmpV.project(camera);
    out.x = (tmpV.x * 0.5 + 0.5) * size.width;
    out.y = (-tmpV.y * 0.5 + 0.5) * size.height;
    out.visible = tmpV.z > -1 && tmpV.z < 1 && Math.abs(tmpV.x) <= 1.02 && Math.abs(tmpV.y) <= 1.02;
    out.depth = tmpV.z;
    return out;
  };

  stage.onFrame = (fn) => { frameFns.push(fn); return () => { const i = frameFns.indexOf(fn); if (i >= 0) frameFns.splice(i, 1); }; };

  // ---------------------------------------------------------------- input niceties
  // Wheel zoom only after the visitor engages with the stage (click/drag) or holds Ctrl/⌘
  // (trackpad pinch sends ctrlKey). Otherwise the page keeps scrolling: no scroll trap.
  let engaged = false;
  let hintEl = null, hintTimer = 0;
  function showHint(text) {
    if (!hintEl) {
      hintEl = document.createElement('div');
      hintEl.className = 'stage-zoom-hint';
      hintEl.setAttribute('aria-hidden', 'true');
      host.appendChild(hintEl);
    }
    hintEl.textContent = text;
    hintEl.classList.add('is-visible');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl?.classList.remove('is-visible'), 1500);
  }
  const onWheelCapture = (e) => {
    if (e.target !== canvas) return;
    if (flight.active) { e.stopPropagation(); return; }
    if (!(engaged || e.ctrlKey || e.metaKey)) {
      e.stopPropagation(); // OrbitControls never sees it; the page scrolls normally
      showHint('Click the body first, or hold Ctrl, to zoom');
      return;
    }
    // zoom in toward the surface under the cursor; zoom out straight back along the view axis
    controls.zoomToCursor = e.deltaY < 0;
    if (e.deltaY < 0) pivotToSurface(e.clientX, e.clientY);
  };
  // two fingers down: the pinch heads for the surface between them
  const touches = new Map();
  const onPointerDown = (e) => {
    if (e.target === canvas) engaged = true;
    if (flight.active && e.target === canvas) endFlight();
    if (e.pointerType === 'touch' && e.target === canvas) {
      touches.set(e.pointerId, e);
      if (touches.size === 2) {
        controls.zoomToCursor = true;
        let x = 0, y = 0;
        for (const t of touches.values()) { x += t.clientX; y += t.clientY; }
        pivotToSurface(x / 2, y / 2, true);
      }
    }
  };
  const onPointerEnd = (e) => { touches.delete(e.pointerId); };
  const onPointerLeave = () => { engaged = false; };
  host.addEventListener('wheel', onWheelCapture, { capture: true, passive: true });
  host.addEventListener('pointerdown', onPointerDown, { capture: true });
  host.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);

  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = 12 * DEG;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': controls.rotateLeft?.(-step); break;
      case 'ArrowRight': controls.rotateLeft?.(step); break;
      case 'ArrowUp': controls.rotateUp?.(-step * 0.6); break;
      case 'ArrowDown': controls.rotateUp?.(step * 0.6); break;
      case '+': case '=': pivotToCentre(); controls.dollyIn?.(1.18); break;
      case '-': case '_': controls.dollyOut?.(1.18); break;
      case 'Home': case '0': stage.homeView(); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); if (flight.active && e.key !== 'Home' && e.key !== '0') endFlight(); }
  };
  canvas.addEventListener('keydown', onKey);
  // Buttons and keys zoom toward the surface at the middle of the view (not into the body's centre).
  function pivotToCentre() {
    const r = canvas.getBoundingClientRect();
    if (r.width && r.height) pivotToSurface(r.left + r.width / 2, r.top + r.height / 2, true);
  }
  stage.zoom = (factor) => {
    if (flight.active) endFlight();
    if (factor > 1) { pivotToCentre(); controls.dollyIn?.(factor); } else controls.dollyOut?.(1 / factor);
  };

  // ---------------------------------------------------------------- loop
  function tick(dt) {
    time += dt;
    if (flight.active) stepFlight(dt);
    else controls.update(dt);
    afterControls(dt);
    camera.updateMatrixWorld();
    for (let i = 0; i < frameFns.length; i++) {
      try { frameFns[i](dt, time); } catch (e) { console.error('[stage] frame callback failed', e); frameFns.splice(i--, 1); }
    }
  }
  function loop(now) {
    if (disposed || contextLost) return;
    const rdt = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 1 / 60;
    const dt = rdt * stage.timeScale; // timeScale is a dev/test hook (default 1)
    last = now;
    tick(dt);
    composer.render(dt);
    if (stage.timeScale > 0) adapt(rdt);
  }
  // Dev/test hook: advance scene time deterministically in fixed steps, then draw one frame.
  // Pair with `stage.timeScale = 0` to freeze real time (headless SwiftShader renders at a few fps).
  stage.advance = (seconds = 0, step = 1 / 30) => {
    let s = Math.max(0, seconds);
    while (s > 1e-6) { const d = Math.min(step, s); s -= d; tick(d); }
    if (!disposed && !contextLost) { camera.updateMatrixWorld(); composer.render(0); }
  };
  function updateRunning() {
    const should = !disposed && !contextLost && inView && !document.hidden;
    if (should === running) return;
    running = should;
    last = 0;
    renderer.setAnimationLoop(should ? loop : null);
  }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) inView = en.isIntersecting;
    updateRunning();
  }, { threshold: 0 });
  io.observe(host);
  const onVis = () => updateRunning();
  document.addEventListener('visibilitychange', onVis);
  stage.renderOnce = () => { camera.updateMatrixWorld(); composer.render(0); };

  // ---------------------------------------------------------------- WebGL context loss
  // three.js re-creates its GL state on restore and re-uploads buffers and textures lazily; only the
  // GPU-only prefiltered environment has to be rebuilt here. While the context is gone the loop stops
  // and a small status note replaces the picture (the rest of the page keeps working).
  let lostEl = null, lostTimer = 0;
  const lostFns = [];
  function showLost(on, text) {
    if (on && !lostEl) {
      lostEl = document.createElement('div');
      lostEl.className = 'stage-context-note';
      lostEl.setAttribute('role', 'status');
      host.appendChild(lostEl);
    }
    if (lostEl) {
      lostEl.textContent = text || '';
      lostEl.hidden = !on;
    }
  }
  const onContextLost = (e) => {
    e.preventDefault(); // allow the browser to restore it
    if (disposed) return;
    contextLost = true;
    endFlight();
    updateRunning();
    host.classList.add('is-context-lost');
    showLost(true, 'The 3D view paused because the graphics processor reset. Restoring…');
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => {
      if (contextLost && !disposed) showLost(true, 'The 3D view could not be restored. Reload the page to try again; everything else still works.');
    }, 6000);
    for (const fn of lostFns.slice()) { try { fn(true); } catch (err) { console.error(err); } }
  };
  const onContextRestored = () => {
    if (disposed) return;
    clearTimeout(lostTimer);
    const old = envRT;
    try {
      envRT = buildEnv();
      scene.environment = envRT.texture;
      scene.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) if (m.envMap === old.texture) { m.envMap = envRT.texture; m.needsUpdate = true; }
      });
      stage.envMap = envRT.texture;
      old.dispose();
    } catch (err) { console.warn('[stage] environment rebuild failed', err); }
    contextLost = false;
    host.classList.remove('is-context-lost');
    showLost(false);
    applySize();
    updateRunning();
    for (const fn of lostFns.slice()) { try { fn(false); } catch (err) { console.error(err); } }
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);
  stage.onContextChange = (fn) => { lostFns.push(fn); return () => { const i = lostFns.indexOf(fn); if (i >= 0) lostFns.splice(i, 1); }; };
  Object.defineProperty(stage, 'contextLost', { get: () => contextLost });

  // ---------------------------------------------------------------- dispose
  stage.dispose = () => {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    ro.disconnect(); io.disconnect();
    cancelAnimationFrame(resizeRaf);
    clearTimeout(hintTimer);
    clearTimeout(lostTimer);
    document.removeEventListener('visibilitychange', onVis);
    host.removeEventListener('wheel', onWheelCapture, { capture: true });
    host.removeEventListener('pointerdown', onPointerDown, { capture: true });
    host.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('pointerup', onPointerEnd);
    window.removeEventListener('pointercancel', onPointerEnd);
    canvas.removeEventListener('keydown', onKey);
    hintEl?.remove();
    lostEl?.remove();
    lostFns.length = 0;
    controls.dispose();
    frameFns.length = 0; themeFns.length = 0;
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) u.value.dispose();
        m.dispose();
      }
    });
    envRT.dispose();
    composer.dispose?.();
    rt.dispose();
    bloom.dispose?.();
    outputPass.dispose?.();
    renderer.dispose();
    canvas.removeEventListener('webglcontextlost', onContextLost, false);
    canvas.removeEventListener('webglcontextrestored', onContextRestored, false);
    renderer.forceContextLoss?.();
    canvas.remove();
  };

  // ---------------------------------------------------------------- go
  applySize();
  setTheme(stage.theme);
  placeCamera(homeTarget, homeDistance, HOME_AZ * DEG, HOME_EL * DEG);
  controls.update();
  updateRunning();
  return stage;
}
