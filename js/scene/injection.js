// Behind the Vial: the injection sequence (body3d).
// syringe → depot under the skin → slow absorption into capillaries → bloodstream → organs.
//
//   const injection = createInjection(stage, anatomy, vessels, { emit, callouts });
//   injection.play({ site, peptide }) → Promise     emits sequence:phase { phase, label, text, step, total }
//                                                    and sequence:done {}
//   injection.skip(); injection.reset(); injection.playing
//
// What it shows, never how to do it: no angle labels, no depth numbers, no amounts. The syringe
// barrel ticks carry no numbers (syringe.js). A small layered tissue block (skin, fat, muscle) fades in
// at the site in a medical-illustration style so the needle tip, the depot and the capillaries can be
// seen; the cut face looks toward the camera.
//
// Normal motion: ~17 s. Reduced motion: no camera flights and no particle travel; it steps through
// the end state of each phase with short cross-fades (~2 s per phase) and emits the same events.
import * as THREE from 'three';

const PHASES = ['syringe', 'depot', 'absorption', 'bloodstream', 'distribution'];
const DEFAULT_LABELS = {
  syringe: { label: 'The injection', text: 'The drug goes into the fat layer just under the skin.' },
  depot: { label: 'A depot forms', text: 'The liquid pools into a small pocket in the fat that releases the drug slowly.' },
  absorption: { label: 'Slow absorption', text: 'Drug molecules seep from the pocket into tiny blood vessels (capillaries) and lymph channels.' },
  bloodstream: { label: 'Into the bloodstream', text: 'Veins carry it to the heart, through the lungs and back to the heart.' },
  distribution: { label: 'Reaching the organs', text: 'The heart pumps it through the arteries to the organs it acts on.' },
  done: { label: 'In circulation', text: 'Move along the timeline to see how the level rises, peaks and clears.' },
};
const STEP_FOR_PHASE = { depot: ['depot'], absorption: ['capillary', 'lymph'], bloodstream: ['blood'], distribution: ['distribution'] };
const ORGAN_LABEL = {
  brain: 'Brain', thyroid: 'Thyroid', heart: 'Heart', lungs: 'Lungs', liver: 'Liver', gallbladder: 'Gallbladder',
  stomach: 'Stomach', pancreas: 'Pancreas', spleen: 'Spleen', small_intestine: 'Small intestine', large_intestine: 'Large intestine',
  kidneys: 'Kidneys', bladder: 'Bladder', skin: 'Skin', fat: 'Fat tissue', injection_site: 'Injection site', muscle: 'Muscle',
  eyes: 'Eyes', blood: 'Bloodstream',
};
const DRUG = { dark: 0x9ff4ff, light: 0x0a8fa6 };
const ORGAN_DRUG = { dark: 0x2fcbe6, light: 0x0a8fa6 }; // saturated enough to stay cyan on pale organs

// ------------------------------------------------------------------ tissue block shader
const BLOCK_VERT = /* glsl */`
  varying vec3 vL; varying vec3 vNL; varying vec3 vW; varying vec3 vNW;
  void main() {
    vL = position; vNL = normal;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz; vNW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const BLOCK_FRAG = /* glsl */`
  uniform vec4 uLayers;       // epidermis bottom, dermis bottom, fat bottom, total depth (meters, positive)
  uniform vec3 uDepot; uniform vec3 uDepotR; uniform float uDepotAmt; uniform float uSeep;
  uniform vec3 uDrug; uniform float uOpacity; uniform float uGlow;
  varying vec3 vL; varying vec3 vNL; varying vec3 vW; varying vec3 vNW;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
  vec3 voro(vec2 x) {
    vec2 n = floor(x), f = fract(x); float md = 8.0, md2 = 8.0; vec2 id = n;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)); vec2 o = 0.15 + 0.7 * h22(n + g); vec2 r = g + o - f; float d = dot(r, r);
      if (d < md) { md2 = md; md = d; id = n + g; } else if (d < md2) md2 = d;
    }
    return vec3(sqrt(md), sqrt(md2) - sqrt(md), h12(id));
  }
  vec3 muscle(vec2 q) {
    float s = 0.5 + 0.5 * sin(q.y * 5200.0 + vn(q * vec2(90.0, 260.0)) * 7.0);
    vec3 base = lin(vec3(0.62, 0.17, 0.2));
    vec3 c = mix(base * 0.72, base * 1.18, s);
    float fasc = vn(vec2(q.x * 140.0, q.y * 700.0));
    c *= 0.82 + 0.26 * smoothstep(0.25, 0.75, fasc);
    return c;
  }
  void main() {
    vec3 an = abs(vNL);
    vec2 q = an.z > 0.5 ? vL.xy : (an.x > 0.5 ? vL.zy : vL.xz);
    float depth = -vL.y;
    vec3 col;
    float pap = sin(q.x * 1500.0) * 0.00022 + sin(q.x * 640.0 + 1.3) * 0.00012;
    if (vNL.y > 0.5) {
      float n = vn(vL.xz * 2200.0) * 0.5 + vn(vL.xz * 700.0) * 0.5;
      col = mix(lin(vec3(0.83, 0.62, 0.53)), lin(vec3(0.92, 0.75, 0.66)), n);
      col *= 0.9 + 0.1 * smoothstep(0.3, 0.7, vn(vL.xz * 9000.0));
    } else if (vNL.y < -0.5) {
      col = muscle(q);
    } else if (depth < uLayers.x + pap * 0.4) {
      col = mix(lin(vec3(0.96, 0.84, 0.75)), lin(vec3(0.88, 0.68, 0.6)), smoothstep(0.0, uLayers.x, depth));
      col *= 0.92 + 0.08 * vn(q * vec2(3000.0, 9000.0));
    } else if (depth < uLayers.y + pap) {
      float fib = vn(vec2(q.x * 900.0, q.y * 2600.0));
      col = mix(lin(vec3(0.84, 0.5, 0.49)), lin(vec3(0.95, 0.7, 0.66)), fib * 0.75);
      col = mix(col, lin(vec3(0.7, 0.4, 0.4)), smoothstep(0.00035, 0.0, abs(depth - uLayers.x - pap * 0.4)) * 0.6);
    } else if (depth < uLayers.z) {
      vec3 v = voro(q * 640.0);
      vec3 cell = mix(lin(vec3(0.99, 0.89, 0.58)), lin(vec3(0.94, 0.77, 0.4)), clamp(v.x * 0.95, 0.0, 1.0));
      cell *= 0.9 + 0.18 * v.z;
      float edge = smoothstep(0.025, 0.1, v.y);
      col = mix(lin(vec3(0.85, 0.58, 0.48)), cell, edge);
    } else {
      col = muscle(q);
    }
    // fascia between fat and muscle, and a fine line at the dermis/fat border
    col = mix(col, lin(vec3(0.97, 0.93, 0.88)), smoothstep(0.00045, 0.0, abs(depth - uLayers.z)) * step(0.5, 1.0 - an.y));
    col = mix(col, lin(vec3(0.78, 0.5, 0.46)), smoothstep(0.0003, 0.0, abs(depth - uLayers.y - pap)) * 0.5 * step(0.5, 1.0 - an.y));
    // lighting
    vec3 n = normalize(vNW);
    vec3 v = normalize(cameraPosition - vW);
    float lam = 0.6 + 0.45 * max(dot(n, normalize(vec3(0.3, 0.9, 0.45))), 0.0);
    col *= lam;
    col += pow(1.0 - abs(dot(n, v)), 3.0) * 0.06;
    // drug depot stain on the cut faces + the halo of molecules seeping out during absorption
    vec3 dd = (vL - uDepot) / max(uDepotR, vec3(1e-5));
    float d = length(dd);
    float stain = (1.0 - smoothstep(0.75, 1.35, d)) * uDepotAmt;
    float halo = (1.0 - smoothstep(1.0, 2.3, d)) * uSeep;
    col = mix(col, uDrug * 0.7, clamp(stain * 0.45 + halo * 0.14, 0.0, 0.7));
    col += uDrug * (stain * 0.07 + halo * 0.03) * uGlow;
    gl_FragColor = vec4(col, uOpacity);
  }`;

const CAP_VERT = /* glsl */`
  attribute float aKind; attribute float aFill;
  varying float vKind; varying float vFill; varying vec3 vNW; varying vec3 vW;
  void main() {
    vKind = aKind; vFill = aFill;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz; vNW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const CAP_FRAG = /* glsl */`
  uniform vec3 uCap; uniform vec3 uArt; uniform vec3 uVen; uniform vec3 uLymph; uniform vec3 uDrug;
  uniform float uFill; uniform float uOpacity; uniform float uGlow;
  varying float vKind; varying float vFill; varying vec3 vNW; varying vec3 vW;
  void main() {
    vec3 base = vKind < 0.5 ? uCap : vKind < 1.5 ? uArt : vKind < 2.5 ? uVen : uLymph;
    float lit = vFill >= 0.0 ? 1.0 - smoothstep(uFill - 0.12, uFill, vFill) : 0.0;
    vec3 n = normalize(vNW);
    float ndv = abs(dot(n, normalize(cameraPosition - vW)));
    vec3 col = base * (0.55 + 0.55 * ndv);
    col = mix(col, uDrug * (0.55 + 0.2 * uGlow), lit * 0.8);
    gl_FragColor = vec4(col, uOpacity);
  }`;

const SEEP_VERT = /* glsl */`
  attribute float aAlpha;
  uniform float uScale; uniform float uSize;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aAlpha > 0.0 ? clamp(uSize * uScale / -mv.z, 1.5, 22.0) : 0.0;
  }`;
const SEEP_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uCore;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0; float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(uColor * (0.8 + 0.6 * uCore * exp(-r2 * 10.0)), exp(-r2 * 3.0) * vAlpha);
  }`;

const DEPOT_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uAnim;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    vec3 n = normalize(vN); vec3 v = normalize(vV);
    float fr = pow(1.0 - abs(dot(n, v)), 2.0);
    float shimmer = 0.9 + 0.1 * sin(uTime * 2.0 + vP.x * 900.0 + vP.y * 700.0) * uAnim;
    float a = (0.34 + 0.46 * fr) * uOpacity;
    gl_FragColor = vec4(uColor * (0.5 + 0.55 * fr) * shimmer, a);
  }`;
const DEPOT_VERT = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    vP = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;

// ------------------------------------------------------------------ helpers
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function makeTimeline() {
  const tracks = [];
  const events = [];
  let t = 0;
  return {
    track(start, end, fn) { tracks.push({ start, end, fn, done: false }); },
    at(time, fn) { events.push({ time, fn, fired: false }); },
    update(dt) {
      t += dt;
      for (const ev of events) if (!ev.fired && t >= ev.time) { ev.fired = true; ev.fn(); }
      for (const tr of tracks) {
        if (tr.done || t < tr.start) continue;
        const k = tr.end > tr.start ? Math.min(1, (t - tr.start) / (tr.end - tr.start)) : 1;
        tr.fn(k);
        if (k >= 1) tr.done = true;
      }
    },
    get time() { return t; },
  };
}

// Organic little polyline wander (deterministic per seed).
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Variable-radius tube in local space, with extra per-vertex attributes for the capillary shader.
function capTube(points, radius, kind, fillFn, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const L = curve.getLength();
  const n = Math.max(6, Math.ceil(L / 0.0006));
  const g = new THREE.TubeGeometry(curve, n, radius, radial, false);
  const cnt = g.attributes.position.count;
  const kindA = new Float32Array(cnt).fill(kind);
  const fillA = new Float32Array(cnt);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < cnt; i++) fillA[i] = fillFn ? fillFn(uv.getX(i), pos.getX(i), pos.getY(i)) : -1;
  g.setAttribute('aKind', new THREE.BufferAttribute(kindA, 1));
  g.setAttribute('aFill', new THREE.BufferAttribute(fillA, 1));
  g.deleteAttribute('uv');
  return { geo: g, curve, length: L };
}

// Minimal stand-in that follows syringe.js conventions (meters, needle toward -Y, tip at the origin).
function standInSyringe(envMap) {
  const group = new THREE.Group();
  group.name = 'syringe-standin';
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.28, envMap, depthWrite: false });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.4, envMap });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd7dce1, metalness: 1, roughness: 0.25, envMap });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.6 });
  const liquidMat = new THREE.MeshBasicMaterial({ color: 0xbfeeff, transparent: true, opacity: 0.35, depthWrite: false });
  const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; group.add(m); return m; };
  add(new THREE.CylinderGeometry(0.000165, 0.000165, 0.0127, 8), steel, 0.00635);
  add(new THREE.CylinderGeometry(0.0019, 0.0023, 0.0095, 24), white, 0.0175);
  add(new THREE.CylinderGeometry(0.0034, 0.0034, 0.0764, 32, 1, true), glass, 0.0598);
  const liquid = add(new THREE.CylinderGeometry(0.0024, 0.0024, 1, 24), liquidMat, 0.03);
  const stopper = add(new THREE.CylinderGeometry(0.0024, 0.0024, 0.0062, 24), rubber, 0.03);
  const rod = add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.08, 12), white, 0.07);
  const thumb = add(new THREE.CylinderGeometry(0.0052, 0.0052, 0.0016, 24), white, 0.11);
  let pl = 0.5, lq = 0.4;
  const apply = () => {
    const base = 0.0245 + pl * 0.0553;
    stopper.position.y = base + 0.0031;
    rod.position.y = base + 0.0062 + 0.04;
    thumb.position.y = base + 0.0062 + 0.08;
    const h = Math.max(1e-4, lq * 0.0553);
    liquid.scale.y = h; liquid.position.y = 0.0245 + h / 2; liquid.visible = lq > 0.002;
  };
  apply();
  return {
    group,
    setPlunger(t) { pl = clamp01(t); if (lq > pl) lq = pl; apply(); },
    setLiquid(t) { lq = Math.min(clamp01(t), pl); apply(); },
    setCapOn() {},
    parts: { liquid },
    dispose() { group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); group.removeFromParent(); },
  };
}

// =====================================================================================
export function createInjection(stage, anatomy, vessels, { emit, callouts } = {}) {
  const { scene } = stage;
  const fire = (type, detail) => {
    try {
      if (emit) emit(type, detail);
      else stage.host?.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
    } catch (e) { console.error('[injection] emit failed', e); }
  };
  const root = new THREE.Group();
  root.name = 'injection';
  scene.add(root);

  // ---------------------------------------------------------------- syringe (guarded import)
  let syringe = null;
  let syringeLoad = null;
  const syringePivot = new THREE.Group();
  syringePivot.name = 'syringe-pivot';
  syringePivot.visible = false;
  root.add(syringePivot);
  function loadSyringe() {
    if (!syringeLoad) {
      syringeLoad = import('./syringe.js')
        .then((m) => (typeof m.createSyringe === 'function' ? m.createSyringe(THREE, { envMap: stage.envMap, scale: 1 }) : null))
        .catch((e) => { console.warn('[injection] syringe.js unavailable, using a stand-in.', e); return null; })
        .then((s) => {
          syringe = s || standInSyringe(stage.envMap);
          syringe.setCapOn?.(false);
          // Clear-plastic look without transmission: the canvas is transparent, and transmission would
          // only see opaque objects (it renders as a bright white blade under bloom).
          const M = syringe.materials || {};
          for (const k of ['glass', 'hub', 'cap']) {
            const m = M[k];
            if (!m) continue;
            m.transmission = 0;
            m.transparent = true;
            m.opacity = k === 'glass' ? 0.16 : 0.5;
            m.depthWrite = false;
            m.roughness = Math.min(m.roughness ?? 0.1, 0.12);
            m.envMapIntensity = 0.7;
            m.needsUpdate = true;
          }
          // keep the white plastic below the bloom threshold so it reads as plastic, not light
          if (M.plunger) { M.plunger.envMapIntensity = 0.35; M.plunger.color?.setHex?.(0x8d969e); }
          if (M.glass) { M.glass.opacity = 0.12; M.glass.envMapIntensity = 0.45; M.glass.color?.setHex?.(0xbcc8d2); }
          if (M.hub) M.hub.color?.setHex?.(0xa9b3bc);
          syringePivot.add(syringe.group);
          // remember material states so the syringe can fade in and out
          syringe.group.traverse((o) => {
            if (!o.isMesh) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) if (m && !m.userData.__fade) m.userData.__fade = { transparent: m.transparent, opacity: m.opacity ?? 1, depthWrite: m.depthWrite };
          });
          return syringe;
        });
    }
    return syringeLoad;
  }
  loadSyringe();
  let syrOpacity = 1;
  function setSyringeOpacity(o) {
    if (!syringe) return;
    syrOpacity = o;
    syringePivot.visible = o > 0.005;
    const liquidMesh = syringe.parts?.liquid;
    syringe.group.traverse((m) => {
      if (!m.isMesh) return;
      if (m === liquidMesh) { m.visible = o > 0.9; return; }
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const f = mat?.userData?.__fade;
        if (!f) continue;
        if (o >= 0.999) { mat.transparent = f.transparent; mat.opacity = f.opacity; mat.depthWrite = f.depthWrite; }
        else { mat.transparent = true; mat.opacity = f.opacity * o; mat.depthWrite = false; }
      }
    });
  }

  // ---------------------------------------------------------------- tissue block
  const block = new THREE.Group();
  block.name = 'tissue-block';
  block.visible = false;
  root.add(block);
  const drugColor = new THREE.Color(DRUG[stage.theme] || DRUG.dark);
  const blockMat = new THREE.ShaderMaterial({
    uniforms: {
      uLayers: { value: new THREE.Vector4() }, uDepot: { value: new THREE.Vector3() }, uDepotR: { value: new THREE.Vector3(1, 1, 1) },
      uDepotAmt: { value: 0 }, uSeep: { value: 0 }, uDrug: { value: drugColor }, uOpacity: { value: 0 }, uGlow: { value: 1 },
    },
    vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, transparent: true,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const capMat = new THREE.ShaderMaterial({
    uniforms: {
      uCap: { value: new THREE.Color(0xa63a5a) }, uArt: { value: new THREE.Color(0xd8343c) }, uVen: { value: new THREE.Color(0x3d5fd0) },
      uLymph: { value: new THREE.Color(0xa89f8a) }, uDrug: { value: drugColor }, uFill: { value: 0 }, uOpacity: { value: 0 }, uGlow: { value: 1 },
    },
    vertexShader: CAP_VERT, fragmentShader: CAP_FRAG, transparent: true,
  });
  const depotMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: drugColor }, uOpacity: { value: 0 }, uTime: { value: 0 }, uAnim: { value: 1 } },
    vertexShader: DEPOT_VERT, fragmentShader: DEPOT_FRAG, transparent: true, depthWrite: false,
  });
  const SEEP_N = 110, SEEP_TRAIL = 3;
  const seepGeo = new THREE.BufferGeometry();
  const seepPos = new Float32Array(SEEP_N * SEEP_TRAIL * 3);
  const seepAlpha = new Float32Array(SEEP_N * SEEP_TRAIL);
  seepGeo.setAttribute('position', new THREE.BufferAttribute(seepPos, 3).setUsage(THREE.DynamicDrawUsage));
  seepGeo.setAttribute('aAlpha', new THREE.BufferAttribute(seepAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  const seepMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: drugColor }, uScale: { value: 500 }, uSize: { value: 0.0014 }, uCore: { value: 1 } },
    vertexShader: SEEP_VERT, fragmentShader: SEEP_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });

  let blockMesh = null, edges = null, capMesh = null, depotMesh = null, seepPoints = null;
  let blockDims = null;
  let routes = [];          // absorption routes (local space polylines with arc samples)
  let labelAnchors = {};    // world-space anchors for tissue labels
  let builtFor = null;
  const seep = Array.from({ length: SEEP_N }, () => ({ r: 0, delay: 0, dur: 2, t: -1, jx: 0, jy: 0 }));

  function buildBlock(site, peptide) {
    const f = anatomy.siteFrame(site);
    if (!f) return false;
    const hasLymph = !!peptide?.absorption?.steps?.some?.((s) => s.id === 'lymph');
    const key = `${site}|${hasLymph}`;
    // place in the site frame: x = bitangent, y = normal (0 at the skin, negative = deeper), z = tangent (cut face at 0)
    const m = new THREE.Matrix4().makeBasis(f.bitangent, f.normal, f.tangent);
    block.quaternion.setFromRotationMatrix(m);
    block.position.copy(f.point);
    block.updateMatrixWorld(true);
    if (builtFor === key) return true;
    builtFor = key;
    // dispose previous
    for (const o of [blockMesh, edges, capMesh, depotMesh, seepPoints]) if (o) { o.geometry.dispose(); block.remove(o); }
    const small = site === 'arm';
    const W = small ? 0.034 : 0.05, D = small ? 0.026 : 0.03, TH = small ? 0.016 : 0.022;
    const epi = 0.0012, derm = 0.0045, fat = small ? 0.016 : 0.0185;
    blockDims = { W, D, TH, epi, derm, fat, tip: 0.0105 };
    blockMat.uniforms.uLayers.value.set(epi, derm, fat, D);
    const bg = new THREE.BoxGeometry(W, D, TH, 1, 1, 1);
    bg.translate(0, -D / 2, -TH / 2);
    blockMesh = new THREE.Mesh(bg, blockMat);
    blockMesh.renderOrder = 6;
    edges = new THREE.LineSegments(new THREE.EdgesGeometry(bg), edgeMat);
    edges.renderOrder = 7;
    // depot
    const tip = blockDims.tip;
    const dr = new THREE.Vector3(small ? 0.0048 : 0.006, 0.0036, 0.0042);
    depotMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), depotMat);
    depotMesh.position.set(0, -tip, 0.0003);
    depotMesh.userData.r = dr;
    depotMesh.scale.setScalar(1e-4);
    depotMesh.renderOrder = 9;
    blockMat.uniforms.uDepot.value.set(0, -tip, 0);
    blockMat.uniforms.uDepotR.value.copy(dr);
    // capillary network on the cut face
    const zc = 0.00045;
    const R = rng(site.length * 7919 + 17);
    const geos = [];
    const halfW = W / 2;
    const wig = (x, y0, amp, fr, ph) => y0 + Math.sin(x * fr + ph) * amp;
    const plexY = -(derm + 0.0007);
    const deepY = -(fat - 0.001);
    const exitX = -halfW;
    const xJmax = 0.006;
    const venFill = (x) => (x <= xJmax ? 0.5 + 0.5 * clamp01((xJmax - x) / (xJmax - exitX)) : -1);
    const line = (y0, amp, fr, ph, dz = 0) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const x = -halfW + (W * i) / 24; pts.push([x, wig(x, y0, amp, fr, ph), zc + dz]); }
      return pts;
    };
    const venPlex = line(plexY - 0.0005, 0.00035, 380, 0.4);
    const artPlex = line(plexY + 0.0002, 0.0003, 330, 1.7, 0.0002);
    const venDeep = line(deepY, 0.0004, 300, 2.2);
    const artDeep = line(deepY + 0.0007, 0.00035, 260, 0.9, 0.0002);
    geos.push(capTube(venPlex, 0.00042, 2, (u, x) => venFill(x)).geo);
    geos.push(capTube(artPlex, 0.00032, 1, null).geo);
    geos.push(capTube(venDeep, 0.0005, 2, (u, x) => venFill(x)).geo);
    geos.push(capTube(artDeep, 0.00038, 1, null).geo);
    // dermal capillary loops
    for (let i = 0; i < 14; i++) {
      const x = -halfW + 0.002 + (W - 0.004) * (i + R() * 0.5) / 14;
      const top = -(epi + 0.0004 + R() * 0.0004);
      geos.push(capTube([[x, plexY + 0.0002, zc], [x + 0.0002, (plexY + top) / 2, zc], [x + 0.0006, top, zc], [x + 0.001, (plexY + top) / 2, zc], [x + 0.0012, plexY - 0.0004, zc]], 0.00011, 0, null, 5).geo);
    }
    // septal capillaries through the fat (skip the needle track)
    for (let i = 0; i < 7; i++) {
      let x = -halfW + 0.004 + (W - 0.008) * (i + 0.3 + R() * 0.4) / 7;
      if (Math.abs(x) < 0.0035) x += x < 0 ? -0.004 : 0.004;
      const pts = [];
      for (let k = 0; k <= 6; k++) { const y = plexY - 0.0004 + (deepY - plexY + 0.0004) * (k / 6); pts.push([x + (R() - 0.5) * 0.0018, y, zc]); }
      geos.push(capTube(pts, 0.00014, 0, null, 5).geo);
    }
    // absorption routes: depot edge → capillary → venule → exit edge
    routes = [];
    const angles = [200, 235, 270, 305, 340, 20, 160, 250, 290];
    angles.forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const sx = Math.cos(a) * dr.x * 0.9, sy = -tip + Math.sin(a) * dr.y * 0.9;
      const goUp = Math.sin(a) > 0.2 || (i % 2 === 0 && Math.sin(a) > -0.3);
      const targetY = goUp ? venPlex[0][1] : venDeep[0][1];
      const jx = THREE.MathUtils.clamp(sx + (R() - 0.5) * 0.008 - 0.002, -halfW + 0.004, xJmax - 0.001);
      const pts = [[sx, sy, zc]];
      const steps = 5;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        pts.push([sx + (jx - sx) * t + Math.sin(t * Math.PI) * (R() - 0.5) * 0.003, sy + (targetY - sy) * easeInOut(t) + (R() - 0.5) * 0.0006 * Math.sin(t * Math.PI), zc]);
      }
      const capPts = pts.slice();
      geos.push(capTube(capPts, 0.00016, 0, (u) => u * 0.5, 5).geo);
      // continue along the venule to the exit edge
      const ven = goUp ? venPlex : venDeep;
      const tail = ven.filter((p) => p[0] < jx - 0.0005).reverse();
      const all = [...capPts, ...tail, [exitX - 0.0015, tail.length ? tail[tail.length - 1][1] : targetY, zc]];
      const curve = new THREE.CatmullRomCurve3(all.map((p) => new THREE.Vector3(p[0], p[1], p[2] + 0.0002)), false, 'centripetal');
      routes.push({ curve, length: curve.getLength(), lymph: false, pts: curve.getSpacedPoints(160) });
    });
    if (hasLymph) {
      const ly = -(derm + (fat - derm) * 0.55);
      const lpts = [];
      for (let i = 0; i <= 18; i++) { const x = 0.004 + (halfW + 0.001 - 0.004) * (i / 18); lpts.push([x, ly + Math.sin(i * 0.9) * 0.0004, zc + 0.0001]); }
      const lt = capTube(lpts, 0.0004, 3, (u) => 0.5 + 0.5 * u, 8);
      geos.push(lt.geo);
      const lead = [[dr.x * 0.9, -tip + 0.0005, zc], [0.0032, (ly - tip) / 2, zc], lpts[0]];
      geos.push(capTube(lead, 0.0002, 3, (u) => u * 0.5, 5).geo);
      const curve = new THREE.CatmullRomCurve3([...lead, ...lpts.slice(1), [halfW + 0.0015, lpts[lpts.length - 1][1], zc]].map((p) => new THREE.Vector3(p[0], p[1], p[2] + 0.0003)), false, 'centripetal');
      routes.push({ curve, length: curve.getLength(), lymph: true, pts: curve.getSpacedPoints(160) });
    }
    const merged = mergeCap(geos);
    capMesh = new THREE.Mesh(merged, capMat);
    capMesh.renderOrder = 8;
    seepPoints = new THREE.Points(seepGeo, seepMat);
    seepPoints.frustumCulled = false;
    seepPoints.renderOrder = 10;
    block.add(blockMesh, edges, capMesh, depotMesh, seepPoints);
    // label anchors on the lower edge of the cut face (local → world at use time)
    const lowX = (f.bitangent.y >= 0 ? -1 : 1) * W / 2;
    labelAnchors = {
      skin: new THREE.Vector3(lowX, -derm * 0.5, 0),
      fat: new THREE.Vector3(lowX, -(derm + fat) / 2, 0),
      muscle: new THREE.Vector3(lowX, -(fat + D) / 2, 0),
      depot: new THREE.Vector3(dr.x * 0.6, -tip + dr.y * 0.4, dr.z * 0.7),
      capillaries: new THREE.Vector3(W * 0.28, plexY, zc),
      lymph: new THREE.Vector3(W * 0.36, -(derm + (fat - derm) * 0.55), zc),
    };
    return true;
  }
  function mergeCap(geos) {
    // merge indexed tube geometries with position/normal/aKind/aFill
    let vCount = 0, iCount = 0;
    for (const g of geos) { vCount += g.attributes.position.count; iCount += g.index.count; }
    const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), kind = new Float32Array(vCount), fill = new Float32Array(vCount);
    const idx = new Uint32Array(iCount);
    let vo = 0, io = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      kind.set(g.attributes.aKind.array, vo);
      fill.set(g.attributes.aFill.array, vo);
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      vo += g.attributes.position.count; io += gi.length;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    out.setAttribute('aFill', new THREE.BufferAttribute(fill, 1));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  const worldAnchor = (key) => {
    const v = labelAnchors[key];
    return v ? () => block.localToWorld(_anchorTmp.copy(v)) : null;
  };
  const _anchorTmp = new THREE.Vector3();

  function setBlockOpacity(o) {
    block.visible = o > 0.003;
    blockMat.uniforms.uOpacity.value = o;
    blockMat.transparent = o < 0.999;
    blockMat.depthWrite = o > 0.5;
    capMat.uniforms.uOpacity.value = o;
    capMat.transparent = o < 0.999;
    edgeMat.opacity = o * (stage.theme === 'light' ? 0.45 : 0.4);
  }
  function setDepot(k) {
    if (!depotMesh) return;
    const r = depotMesh.userData.r;
    const s = Math.max(1e-4, k);
    depotMesh.scale.set(r.x * s, r.y * s, r.z * s);
    depotMat.uniforms.uOpacity.value = Math.min(1, k * 1.4) * depotVis;
    blockMat.uniforms.uDepotR.value.set(r.x * Math.max(0.05, k), r.y * Math.max(0.05, k), r.z * Math.max(0.05, k));
    blockMat.uniforms.uDepotAmt.value = Math.min(1, k * 1.2);
  }
  let depotVis = 1;

  // ---------------------------------------------------------------- seep particles (absorption)
  let seepMode = 'off'; // off | flow | still
  let seepOpacity = 1;
  function startSeep(mode) {
    seepMode = mode;
    const R = rng(4242);
    const n = routes.length;
    for (let i = 0; i < SEEP_N; i++) {
      const p = seep[i];
      const lymphOnly = routes[n - 1]?.lymph;
      p.r = lymphOnly && i % 5 === 0 ? n - 1 : i % (lymphOnly ? n - 1 : n);
      p.delay = R() * 2.2;
      p.dur = (routes[p.r].lymph ? 2.6 : 1.7) + R() * 0.8;
      p.t = mode === 'still' ? R() : -1;
      p.jx = (R() - 0.5) * 0.00025; p.jy = (R() - 0.5) * 0.00025;
    }
  }
  function stopSeep() { seepMode = 'off'; seepAlpha.fill(0); seepGeo.attributes.aAlpha.needsUpdate = true; }
  const _sp = new THREE.Vector3();
  function samplePts(pts, f, out) {
    const x = clamp01(f) * (pts.length - 1);
    const i0 = Math.floor(x), i1 = Math.min(pts.length - 1, i0 + 1);
    return out.lerpVectors(pts[i0], pts[i1], x - i0);
  }
  function updateSeep(dt) {
    if (seepMode === 'off' || !routes.length) return;
    for (let i = 0; i < SEEP_N; i++) {
      const p = seep[i];
      const route = routes[p.r];
      const b = i * SEEP_TRAIL;
      if (seepMode === 'flow') {
        if (p.delay > 0) { p.delay -= dt; for (let k = 0; k < SEEP_TRAIL; k++) seepAlpha[b + k] = 0; continue; }
        if (p.t < 0) p.t = 0;
        p.t += dt / p.dur;
        if (p.t > 1) { p.t = -1; p.delay = 0.2 + Math.random() * 0.6; for (let k = 0; k < SEEP_TRAIL; k++) seepAlpha[b + k] = 0; continue; }
      }
      const fade = Math.min(1, p.t * 6) * (1 - Math.max(0, (p.t - 0.85) / 0.15));
      for (let k = 0; k < SEEP_TRAIL; k++) {
        samplePts(route.pts, p.t - k * 0.018, _sp);
        const o = (b + k) * 3;
        seepPos[o] = _sp.x + p.jx; seepPos[o + 1] = _sp.y + p.jy; seepPos[o + 2] = _sp.z;
        seepAlpha[b + k] = (seepMode === 'still' ? (k === 0 ? 0.85 : 0) : fade * (1 - k * 0.32)) * seepOpacity;
      }
    }
    seepGeo.attributes.position.needsUpdate = true;
    seepGeo.attributes.aAlpha.needsUpdate = true;
  }

  // ---------------------------------------------------------------- syringe placement
  const f0 = new THREE.Vector3();
  function placeSyringe(site, tipOffset) {
    const f = anatomy.siteFrame(site);
    if (!f) return;
    // syringe local +Y (barrel) along the outward normal; tip at the site + offset along the normal
    syringePivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f.normal);
    // keep the printed tick side (+Z) toward the camera side (tangent)
    const q2 = new THREE.Quaternion();
    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(syringePivot.quaternion);
    const proj = f.tangent.clone().addScaledVector(f.normal, -f.tangent.dot(f.normal)).normalize();
    const ang = Math.atan2(new THREE.Vector3().crossVectors(z, proj).dot(f.normal), z.dot(proj));
    q2.setFromAxisAngle(f.normal, ang);
    syringePivot.quaternion.premultiply(q2);
    f0.copy(f.point).addScaledVector(f.tangent, 0.0008).addScaledVector(f.normal, tipOffset);
    syringePivot.position.copy(f0);
  }

  // ---------------------------------------------------------------- camera views
  const UP = new THREE.Vector3(0, 1, 0);
  function dirAngles(dir) {
    const d = dir.clone().normalize();
    return { azimuth: (Math.atan2(d.x, d.z) * 180) / Math.PI, elevation: (Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) * 180) / Math.PI };
  }
  function closeView(site, zoom = 1) {
    // Look at the cut face almost straight on (a side view of the layers), a touch from above and
    // from the skin side, so the needle, the depot and the capillaries all read clearly.
    const f = anatomy.siteFrame(site);
    const dir = f.tangent.clone().multiplyScalar(0.93).addScaledVector(f.normal, 0.2).addScaledVector(UP, 0.17);
    const target = f.point.clone().addScaledVector(f.normal, zoom < 1 ? -0.013 : 0.022);
    const dist = Math.max(0.12, stage.fitDistance(0.042 * zoom, 0.078 * zoom));
    return { target: target.toArray(), distance: dist, ...dirAngles(dir) };
  }
  function bloodView(site) {
    const t = site === 'thigh' ? [0.04, 0.98, 0.0] : site === 'arm' ? [0.06, 1.24, 0.0] : [0.02, 1.12, 0.0];
    const hh = site === 'thigh' ? 0.4 : 0.33;
    return { target: t, distance: stage.fitDistance(hh, 0.26), azimuth: 20, elevation: 6 };
  }
  function distView() {
    return { target: [0, 1.17, 0.0], distance: stage.fitDistance(0.6, 0.3), azimuth: 14, elevation: 4 };
  }
  const fly = (view, ms) => stage.flyTo({ ...view, duration: stage.reducedMotion ? 0 : ms });

  // ---------------------------------------------------------------- labels
  function phaseCopy(peptide) {
    const steps = peptide?.absorption?.steps || [];
    const out = {};
    for (const ph of [...PHASES, 'done']) {
      const ids = STEP_FOR_PHASE[ph] || [];
      const st = ids.map((id) => steps.find((s) => s.id === id)).filter(Boolean);
      out[ph] = st.length
        ? { label: st[0].title || DEFAULT_LABELS[ph].label, text: st.map((s) => s.text).filter(Boolean).join(' ') || DEFAULT_LABELS[ph].text }
        : { ...DEFAULT_LABELS[ph] };
    }
    if (peptide?.route) out.syringe.text = DEFAULT_LABELS.syringe.text;
    return out;
  }
  // Which way the skin faces on screen in the close-up (labels go to the skin side / the deep side).
  function skinSide(site) {
    const f = anatomy.siteFrame(site);
    const dir = f.tangent.clone().multiplyScalar(0.93).addScaledVector(f.normal, 0.2).addScaledVector(UP, 0.17).normalize();
    const right = new THREE.Vector3().crossVectors(dir.clone().negate(), UP).normalize();
    return f.normal.dot(right) < 0 ? 'left' : 'right';
  }
  function tissueLabels(on, hasLymph) {
    if (!callouts) return;
    if (!on) { callouts.clear('tissue'); return; }
    const sk = skinSide(current?.site || 'abdomen');
    const deep = sk === 'left' ? 'right' : 'left';
    callouts.set('tissue:skin', { anchor: worldAnchor('skin'), title: 'Skin', text: 'outer layers', tone: 'tissue', group: 'tissue', interactive: false, side: sk });
    callouts.set('tissue:fat', { anchor: worldAnchor('fat'), title: 'Fat layer', text: 'under the skin', tone: 'tissue', group: 'tissue', interactive: false, side: sk });
    callouts.set('tissue:muscle', { anchor: worldAnchor('muscle'), title: 'Muscle', text: 'deeper layer', tone: 'tissue', group: 'tissue', interactive: false, side: deep });
    void hasLymph;
  }
  function depotLabel(on) {
    if (!callouts) return;
    const deep = skinSide(current?.site || 'abdomen') === 'left' ? 'right' : 'left';
    if (on) callouts.set('tissue:depot', { anchor: worldAnchor('depot'), title: 'Depot', text: 'a pocket that releases slowly', tone: 'drug', group: 'tissue', interactive: false, side: deep });
    else callouts.remove('tissue:depot');
  }
  function capLabels(on, hasLymph) {
    if (!callouts) return;
    if (!on) { callouts.remove('tissue:cap'); callouts.remove('tissue:lymph'); return; }
    const deep = skinSide(current?.site || 'abdomen') === 'left' ? 'right' : 'left';
    callouts.set('tissue:cap', { anchor: worldAnchor('capillaries'), title: 'Capillaries', text: 'tiny vessels take it up', tone: 'info', group: 'tissue', interactive: false, side: deep });
    if (hasLymph) callouts.set('tissue:lymph', { anchor: worldAnchor('lymph'), title: 'Lymph vessel', text: 'carries some of it too', tone: 'tissue', group: 'tissue', interactive: false, side: deep });
  }

  // ---------------------------------------------------------------- arrivals
  const arrivalTimers = new Set();
  let arrivalLevel = 0;
  const arrived = new Set();
  function onArrive(organ, peptide) {
    if (arrived.has(organ)) return;
    arrived.add(organ);
    const color = ORGAN_DRUG[stage.theme] || ORGAN_DRUG.dark;
    anatomy.highlight(organ, { channel: 'arrival', color, intensity: 1.1, pulse: 0 });
    // settle to a calm glow
    const start = clock;
    arrivalFades.push({ organ, start });
    if (callouts) {
      const t = peptide?.targets?.find?.((x) => x.organ === organ);
      const rec = t?.receptors?.length ? `${t.receptors.join(' + ')} receptors` : 'drug arrives';
      callouts.set(`arrival:${organ}`, {
        anchor: anatomy.organAnchor?.(organ) || anatomy.organCenter(organ),
        title: ORGAN_LABEL[organ] || organ, text: rec, tone: 'drug', organ, group: 'arrival',
      });
    }
  }
  const arrivalFades = [];

  // ---------------------------------------------------------------- state machine
  let playing = false;
  let tl = null;
  let resolvePlay = null;
  let clock = 0;
  let stream = null;
  let current = null;
  let token = 0;

  function emitPhase(phase, copy, step) {
    const c = copy[phase] || DEFAULT_LABELS[phase];
    fire('sequence:phase', { phase, label: c.label, text: c.text, step, total: PHASES.length });
  }

  function isolate(on) {
    anatomy.setIsolate?.(on);
    vessels.setDim?.(on ? 0.04 : 1);
  }

  function hideStage(instant = true) {
    void instant;
    setBlockOpacity(0);
    setSyringeOpacity(0);
    syringePivot.visible = false;
    setDepot(0);
    blockMat.uniforms.uSeep.value = 0;
    capMat.uniforms.uFill.value = 0;
    stopSeep();
    anatomy.setSkinCut(null);
  }

  function reset() {
    token++;
    tl = null;
    if (stream) { stream.cancel(); stream = null; }
    vessels.clearDrugStream?.();
    hideStage();
    for (const o of arrived) anatomy.unhighlight(o, { channel: 'arrival' });
    arrived.clear();
    arrivalFades.length = 0;
    for (const t of arrivalTimers) clearTimeout(t);
    arrivalTimers.clear();
    callouts?.clear('tissue');
    callouts?.clear('arrival');
    anatomy.setHotspotsVisible(true);
    anatomy.setFocus(null);
    isolate(false);
    const wasPlaying = playing;
    playing = false;
    if (resolvePlay) { const r = resolvePlay; resolvePlay = null; r({ cancelled: wasPlaying }); }
  }

  function finish(copy) {
    if (!playing) return;
    playing = false;
    tl = null;
    stream?.finish?.();
    stream = null;
    hideStage();
    anatomy.setHotspotsVisible(true);
    anatomy.setFocus(null);
    isolate(false);
    callouts?.clear('tissue');
    emitPhase('done', copy, PHASES.length + 1);
    fire('sequence:done', {});
    const myToken = token;
    const tm = setTimeout(() => { if (token === myToken) callouts?.clear('arrival'); arrivalTimers.delete(tm); }, 9000);
    arrivalTimers.add(tm);
    if (resolvePlay) { const r = resolvePlay; resolvePlay = null; r({ cancelled: false }); }
  }

  async function play({ site = 'abdomen', peptide = null } = {}) {
    reset();
    const myToken = ++token;
    await loadSyringe();
    if (myToken !== token) return { cancelled: true };
    if (!anatomy.siteFrame(site)) site = 'abdomen';
    const copy = phaseCopy(peptide);
    const targets = (peptide?.targets || []).map((t) => t.organ).filter(Boolean);
    const hasLymph = !!peptide?.absorption?.steps?.some?.((s) => s.id === 'lymph');
    current = { site, peptide, copy, targets, hasLymph };
    buildBlock(site, peptide);
    playing = true;
    clock = 0;
    anatomy.selectSite(site);
    anatomy.setHotspotsVisible(false);
    const done = new Promise((res) => { resolvePlay = res; });
    tl = stage.reducedMotion ? buildReducedTimeline(current) : buildTimeline(current);
    return done;
  }

  function buildTimeline({ site, peptide, copy, targets, hasLymph }) {
    const T = makeTimeline();
    const f = anatomy.siteFrame(site);
    const tipDepth = blockDims.tip;
    syringe.setPlunger(0.34);
    syringe.setLiquid(0.34);
    placeSyringe(site, 0.05);
    setSyringeOpacity(0);
    T.at(0, () => {
      emitPhase('syringe', copy, 1);
      isolate(true);
      fly(closeView(site), 1500);
    });
    T.track(0.5, 1.5, (k) => { setBlockOpacity(easeOut(k)); anatomy.setSkinCut(f.point, 0.055, 0.8 * easeOut(k)); });
    T.at(1.2, () => tissueLabels(true, hasLymph));
    T.track(0.9, 1.5, (k) => { placeSyringe(site, 0.05 - 0.012 * easeOut(k)); setSyringeOpacity(easeOut(k)); });
    T.track(1.6, 2.6, (k) => placeSyringe(site, 0.038 - (0.038 + tipDepth) * easeInOut(k)));
    T.track(2.8, 4.3, (k) => {
      const e = easeInOut(k);
      syringe.setPlunger(0.34 * (1 - e));
      setDepot(easeOut(k));
    });
    T.at(4.4, () => { emitPhase('depot', copy, 2); depotLabel(true); });
    T.track(4.7, 5.6, (k) => { placeSyringe(site, -tipDepth + (0.05 + tipDepth) * easeInOut(k)); });
    T.track(5.1, 5.7, (k) => setSyringeOpacity(1 - k));
    T.at(6.2, () => {
      emitPhase('absorption', copy, 3);
      depotLabel(false);
      capLabels(true, hasLymph);
      fly(closeView(site, 0.72), 1300);
      startSeep('flow');
    });
    T.track(6.2, 9.6, (k) => {
      capMat.uniforms.uFill.value = 1.15 * easeInOut(k);
      blockMat.uniforms.uSeep.value = easeOut(k);
      setDepot(1 - 0.45 * easeInOut(k));
    });
    T.at(9.8, () => {
      emitPhase('bloodstream', copy, 4);
      tissueLabels(false); capLabels(false);
      fly(bloodView(site), 1700);
      anatomy.setFocus('blood');
      stream = vessels.release({
        site, targets, count: 150,
        timing: { emit: 1.2, venous: 2.0, pulmonary: 1.2, arterial: 1.8 },
        onArrive: (o) => onArrive(o, peptide),
      });
    });
    T.track(9.8, 10.8, (k) => {
      seepOpacity = 1 - k;
      setBlockOpacity(1 - easeInOut(k));
      anatomy.setSkinCut(f.point, 0.055, 0.8 * (1 - easeInOut(k)));
      if (k >= 1) { stopSeep(); seepOpacity = 1; }
    });
    T.at(10.2, () => isolate(false));
    T.at(12.8, () => { emitPhase('distribution', copy, 5); anatomy.setFocus(null); fly(distView(), 1500); });
    T.at(17.0, () => finish(copy));
    return T;
  }

  function buildReducedTimeline({ site, peptide, copy, targets, hasLymph }) {
    const T = makeTimeline();
    const f = anatomy.siteFrame(site);
    const tipDepth = blockDims.tip;
    const XF = 0.35; // cross-fade length (s)
    syringe.setPlunger(0.34);
    syringe.setLiquid(0.34);
    placeSyringe(site, -tipDepth);
    setSyringeOpacity(0);
    T.at(0, () => {
      emitPhase('syringe', copy, 1);
      isolate(true);
      fly(closeView(site), 0);
      tissueLabels(true, hasLymph);
    });
    T.track(0, XF, (k) => { setBlockOpacity(k); setSyringeOpacity(k); anatomy.setSkinCut(f.point, 0.055, 0.8 * k); });
    T.at(2, () => { emitPhase('depot', copy, 2); depotLabel(true); syringe.setPlunger(0); });
    T.track(2, 2 + XF, (k) => { setDepot(k); setSyringeOpacity(1 - k); });
    T.at(4, () => {
      emitPhase('absorption', copy, 3);
      depotLabel(false); capLabels(true, hasLymph);
      startSeep('still');
      seepOpacity = 0;
    });
    T.track(4, 4 + XF, (k) => {
      capMat.uniforms.uFill.value = 1.15 * k;
      blockMat.uniforms.uSeep.value = k;
      setDepot(1 - 0.45 * k);
      seepOpacity = k;
    });
    T.at(6, () => {
      emitPhase('bloodstream', copy, 4);
      tissueLabels(false); capLabels(false);
      fly(bloodView(site), 0);
      isolate(false);
      anatomy.setFocus('blood');
      stream = vessels.trace({ site, targets, segments: [0, 1], count: 160, opacity: 0 });
    });
    T.track(6, 6 + XF, (k) => {
      setBlockOpacity(1 - k); seepOpacity = 1 - k;
      anatomy.setSkinCut(f.point, 0.055, 0.8 * (1 - k));
      stream?.setOpacity?.(k);
      if (k >= 1) stopSeep();
    });
    T.at(8, () => {
      emitPhase('distribution', copy, 5);
      anatomy.setFocus(null);
      fly(distView(), 0);
      stream?.cancel?.();
      stream = vessels.trace({ site, targets, segments: [2], count: 160, opacity: 0, onArrive: (o) => onArrive(o, peptide) });
    });
    T.track(8, 8 + XF, (k) => stream?.setOpacity?.(k));
    T.at(10, () => finish(copy));
    return T;
  }

  function skip() {
    if (!playing || !current) return;
    const { targets, peptide, copy } = current;
    tl = null;
    if (stream) { stream.cancel(); stream = null; }
    for (const o of targets) onArrive(o, peptide);
    hideStage();
    fly(distView(), 0);
    finish(copy);
  }

  // ---------------------------------------------------------------- frame
  function update(dt) {
    clock += dt;
    if (tl) tl.update(dt);
    depotMat.uniforms.uTime.value = clock;
    depotMat.uniforms.uAnim.value = stage.reducedMotion ? 0 : 1;
    seepMat.uniforms.uScale.value = stage.viewScale || 500;
    updateSeep(dt);
    // arrival glow settles from a flash to a calm level
    for (let i = arrivalFades.length - 1; i >= 0; i--) {
      const a = arrivalFades[i];
      const k = Math.min(1, (clock - a.start) / 1.6);
      const inten = stage.reducedMotion ? 0.45 : 1.1 - 0.65 * easeOut(k);
      anatomy.highlight(a.organ, { channel: 'arrival', color: ORGAN_DRUG[stage.theme] || ORGAN_DRUG.dark, intensity: inten, pulse: 0 });
      if (k >= 1) arrivalFades.splice(i, 1);
    }
  }
  const offFrame = stage.onFrame(update);

  const offTheme = stage.onTheme((theme) => {
    drugColor.setHex(DRUG[theme] || DRUG.dark);
    const dark = theme !== 'light';
    blockMat.uniforms.uGlow.value = dark ? 1 : 0.15;
    capMat.uniforms.uGlow.value = dark ? 1 : 0;
    seepMat.uniforms.uCore.value = dark ? 1 : 0;
    seepMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    seepMat.needsUpdate = true;
    edgeMat.color.setHex(dark ? 0xd8f6ff : 0x24465c);
    for (const o of arrived) anatomy.highlight(o, { channel: 'arrival', color: ORGAN_DRUG[theme] || ORGAN_DRUG.dark, intensity: 0.45 });
  });
  {
    const dark = stage.theme !== 'light';
    blockMat.uniforms.uGlow.value = dark ? 1 : 0.15;
    capMat.uniforms.uGlow.value = dark ? 1 : 0;
    seepMat.uniforms.uCore.value = dark ? 1 : 0;
    if (!dark) seepMat.blending = THREE.NormalBlending;
    edgeMat.color.setHex(dark ? 0xd8f6ff : 0x24465c);
  }

  return {
    play, skip, reset,
    get playing() { return playing; },
    get phaseTime() { return tl ? tl.time : 0; },
    dispose() {
      reset();
      offFrame(); offTheme();
      syringe?.dispose?.();
      root.traverse((o) => { o.geometry?.dispose?.(); });
      for (const m of [blockMat, edgeMat, capMat, depotMat, seepMat]) m.dispose();
      seepGeo.dispose();
      root.removeFromParent();
    },
  };
}
