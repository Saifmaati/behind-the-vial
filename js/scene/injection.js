// PeptideScope: the injection sequence (body3d).
// syringe → depot under the skin → slow absorption into capillaries → bloodstream → organs.
//
//   const injection = createInjection(stage, anatomy, vessels, { emit, callouts });
//   injection.play({ site, peptide }) → Promise     emits sequence:phase { phase, label, text, step, total }
//                                                    and sequence:done {}
//   injection.skip(); injection.reset(); injection.playing; injection.phase
//   injection.fadeArrivals()   after the sequence: let the time-driven drug glow take over
//
// What it shows, never how to do it: no angle labels, no depth numbers, no amounts. The syringe
// barrel ticks carry no numbers (syringe.js). A small layered tissue block (skin, fat, muscle) is the
// cut face of a section through the body at the site: its top lies on the skin, the skin in front of
// the section fades away, and the syringe comes in along the site's skin normal inside the section
// plane, so the needle is seen passing the skin and stopping in the fat, where the depot forms.
//
// Normal motion: ~19 s. Reduced motion: no camera flights and no particle travel; it steps through
// the end state of each phase with short cross-fades (~2.2 s per phase) and emits the same events.
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
// Luxury palette: the drug is luminous champagne (dark) or a deep gold ink (light); on organ surfaces
// a warmer gold so it still reads on pale tissue.
const DRUG = { dark: 0xf1dda8, light: 0x8f6c2c };
const ORGAN_DRUG = { dark: 0xe2be72, light: 0x8f6c2c };

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
    vec3 base = lin(vec3(0.58, 0.2, 0.2));
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
      col = mix(lin(vec3(0.82, 0.64, 0.55)), lin(vec3(0.9, 0.76, 0.67)), n);
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
      vec3 cell = mix(lin(vec3(0.97, 0.89, 0.66)), lin(vec3(0.91, 0.78, 0.5)), clamp(v.x * 0.95, 0.0, 1.0));
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
    gl_FragColor = vec4(uColor * (0.72 + 0.4 * uCore * exp(-r2 * 10.0)), exp(-r2 * 3.2) * vAlpha * 0.8);
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
// ------------------------------------------------------------------ site frames + close-up views
// The close-up is a section through the body at the site. In the site frame
//   n = outward skin normal (from landmarks), t = horizontal, perpendicular to n: the section plane's
//   normal, which faces the camera, b = n × t (close to world up on all three sites).
// The tissue block's top face lies on the skin at the site, its cut face is the section plane, and the
// syringe travels along n inside that plane, so the needle is seen entering the layers side-on.
// VIEW_HINT picks which side of the site the camera looks from (the cut face faces it):
//   abdomen and thigh from the person's left side (the belly or thigh in profile);
//   upper arm from behind and to the left, because that site sits on the back/outer arm.
// VIEW_SWING turns the camera from the cut-face normal toward the skin normal so the skin surface
// and the needle read in depth.
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const VIEW_HINT = { abdomen: [1, 0, 0.25], thigh: [1, 0, 0.15], arm: [0.35, 0, -1] };
const VIEW_SWING = { abdomen: 10, thigh: 10, arm: 15 };
const VIEW_LIFT = 0.16;
const BLOOD_AZ = { abdomen: 14, thigh: 16, arm: 30 };
// Syringe geometry used for framing (syringe.js: needle 12.7 mm, hub to 22.2 mm, barrel to 98 mm,
// thumb press up to ~124 mm with the plunger partly drawn).
const SYR_FRONT = 0.05;
const SYR_FULL = 0.124;
const SYR_APPROACH = 0.018;   // needle tip distance from the skin when the syringe arrives
const NEEDLE_OFF = 0.0007;    // the needle runs just in front of the cut face

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

  // ---------------------------------------------------------------- site frames
  // Frames follow the editable body (scale and skin offset); they are rebuilt lazily after a change.
  const frames = {};
  let framesDirty = false;
  const offBody = anatomy.onBodyChange?.(() => { framesDirty = true; }) || (() => {});
  function frameFor(site) {
    if (framesDirty) { for (const k of Object.keys(frames)) delete frames[k]; framesDirty = false; }
    if (frames[site]) return frames[site];
    const f = anatomy.siteFrame(site);
    if (!f) return null;
    const n = f.normal.clone().normalize();
    const hint = new THREE.Vector3().fromArray(VIEW_HINT[site] || [1, 0, 0]).normalize();
    const t = new THREE.Vector3(n.z, 0, -n.x);
    if (t.lengthSq() < 1e-6) t.set(1, 0, 0);
    t.normalize();
    if (t.dot(hint) < 0) t.negate();
    const b = new THREE.Vector3().crossVectors(n, t).normalize();
    const a = (VIEW_SWING[site] ?? 20) * DEG;
    const view = t.clone().multiplyScalar(Math.cos(a)).addScaledVector(n, Math.sin(a)).addScaledVector(UP, VIEW_LIFT).normalize();
    const basis = new THREE.Matrix4().makeBasis(b, n, t);
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis);
    // which end of the block is lower on screen (labels go under it)
    const down = b.y >= 0 ? -1 : 1;
    frames[site] = { point: f.point.clone(), n, t, b, view, quat, down };
    return frames[site];
  }

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
          if (M.plunger) { M.plunger.envMapIntensity = 0.35; M.plunger.color?.setHex?.(0x9a958c); }
          if (M.glass) { M.glass.opacity = 0.12; M.glass.envMapIntensity = 0.45; M.glass.color?.setHex?.(0xd2cabb); }
          if (M.hub) M.hub.color?.setHex?.(0xb4ad9f);
          syringePivot.add(syringe.group);
          // remember material states so the syringe can fade in and out
          syringe.group.traverse((o) => {
            if (!o.isMesh) return;
            o.renderOrder = 11;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) if (m && !m.userData.__fade) m.userData.__fade = { transparent: m.transparent, opacity: m.opacity ?? 1, depthWrite: m.depthWrite };
          });
          return syringe;
        });
    }
    return syringeLoad;
  }
  loadSyringe();
  function setSyringeOpacity(o) {
    if (!syringe) return;
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
  // tipOffset: needle tip position along the skin normal (positive = outside the skin, negative = depth)
  function placeSyringe(site, tipOffset) {
    const F = frameFor(site);
    if (!F) return;
    syringePivot.quaternion.copy(F.quat); // local +Y (barrel) = n, +Z (ticks, bevel) = t (camera side)
    syringePivot.position.copy(F.point).addScaledVector(F.t, NEEDLE_OFF).addScaledVector(F.n, tipOffset);
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
      uCap: { value: new THREE.Color(0x9a3c48) }, uArt: { value: new THREE.Color(0xc4524a) }, uVen: { value: new THREE.Color(0x5b7db8) },
      uLymph: { value: new THREE.Color(0xb8ad96) }, uDrug: { value: drugColor }, uFill: { value: 0 }, uOpacity: { value: 0 }, uGlow: { value: 1 },
    },
    vertexShader: CAP_VERT, fragmentShader: CAP_FRAG, transparent: true,
  });
  const depotMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: drugColor }, uOpacity: { value: 0 }, uTime: { value: 0 }, uAnim: { value: 1 } },
    vertexShader: DEPOT_VERT, fragmentShader: DEPOT_FRAG, transparent: true, depthWrite: false,
  });
  const SEEP_N = 120, SEEP_TRAIL = 3;
  const seepGeo = new THREE.BufferGeometry();
  const seepPos = new Float32Array(SEEP_N * SEEP_TRAIL * 3);
  const seepAlpha = new Float32Array(SEEP_N * SEEP_TRAIL);
  seepGeo.setAttribute('position', new THREE.BufferAttribute(seepPos, 3).setUsage(THREE.DynamicDrawUsage));
  seepGeo.setAttribute('aAlpha', new THREE.BufferAttribute(seepAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  const seepMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: drugColor }, uScale: { value: 500 }, uSize: { value: 0.00085 }, uCore: { value: 1 } },
    vertexShader: SEEP_VERT, fragmentShader: SEEP_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });

  let blockMesh = null, edges = null, capMesh = null, depotMesh = null, seepPoints = null;
  let blockDims = null;
  let routes = [];          // absorption routes (local polylines, arc-length samples)
  let labelAnchors = {};    // local-space anchors for tissue labels
  let builtFor = null;
  const seep = Array.from({ length: SEEP_N }, () => ({ r: 0, delay: 0, dur: 2, t: -1, jx: 0, jy: 0 }));

  function buildBlock(site, peptide) {
    const F = frameFor(site);
    if (!F) return false;
    const hasLymph = !!peptide?.absorption?.steps?.some?.((s) => s.id === 'lymph');
    // The fat layer follows the editable body: a heavier body shows a thicker layer under the skin
    // (quantised so the block is only rebuilt when the thickness really changes).
    const fatScale = Math.round((anatomy.siteTissue?.(site)?.fatScale ?? 1) * 40) / 40;
    const key = `${site}|${hasLymph}|${fatScale}`;
    // local frame: x = b, y = n (0 at the skin, negative = deeper), z = t (cut face at z = 0, facing the camera)
    block.quaternion.copy(F.quat);
    block.position.copy(F.point);
    block.updateMatrixWorld(true);
    if (builtFor === key) return true;
    builtFor = key;
    for (const o of [blockMesh, edges, capMesh, depotMesh]) if (o) { o.geometry.dispose(); block.remove(o); }
    if (seepPoints) block.remove(seepPoints);
    const small = site === 'arm';
    // Illustrative proportions (not a measurement): skin ≈ 4.5 mm, fat below it, then muscle. The
    // needle tip stays where it is; only the fat layer around it grows or thins.
    const W = small ? 0.036 : 0.05, TH = small ? 0.016 : 0.022;
    const epi = 0.0012, derm = 0.0045;
    const tip = small ? 0.0095 : 0.0105;
    const fat0 = small ? 0.0165 : 0.0185;
    // a lean body thins the layer, but never so far that the depot would seem to sit in the muscle
    const depotRy = small ? 0.0032 : 0.0036;
    const fat = Math.max(tip + depotRy + 0.0009, derm + (fat0 - derm) * fatScale);
    const D = fat + (small ? 0.0095 : 0.0115);
    blockDims = { W, D, TH, epi, derm, fat, tip };
    blockMat.uniforms.uLayers.value.set(epi, derm, fat, D);
    const bg = new THREE.BoxGeometry(W, D, TH, 1, 1, 1);
    bg.translate(0, -D / 2, -TH / 2);
    blockMesh = new THREE.Mesh(bg, blockMat);
    blockMesh.renderOrder = 6;
    edges = new THREE.LineSegments(new THREE.EdgesGeometry(bg), edgeMat);
    edges.renderOrder = 7;
    // depot: a flattened bolus centred on the needle tip, in the fat layer
    const dr = new THREE.Vector3(small ? 0.0048 : 0.0058, depotRy, 0.0042);
    depotMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), depotMat);
    depotMesh.position.set(0, -tip, 0.0003);
    depotMesh.userData.r = dr;
    depotMesh.scale.setScalar(1e-4);
    depotMesh.renderOrder = 9;
    blockMat.uniforms.uDepot.value.set(0, -tip, 0);
    blockMat.uniforms.uDepotR.value.copy(dr);

    // ---- vessels drawn on the cut face
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
    // septal capillaries through the fat (kept clear of the needle track)
    for (let i = 0; i < 7; i++) {
      let x = -halfW + 0.004 + (W - 0.008) * (i + 0.3 + R() * 0.4) / 7;
      if (Math.abs(x) < 0.0035) x += x < 0 ? -0.004 : 0.004;
      const pts = [];
      for (let k = 0; k <= 6; k++) { const y = plexY - 0.0004 + (deepY - plexY + 0.0004) * (k / 6); pts.push([x + (R() - 0.5) * 0.0018, y, zc]); }
      geos.push(capTube(pts, 0.00014, 0, null, 5).geo);
    }
    // a fine capillary mesh in the fat around the depot: jittered ring nodes joined to their nearest
    // neighbours; it fills with drug from the depot outward during absorption
    const nodes = [];
    const fatTop = -(derm + 0.0009), fatBot = -(fat - 0.0009);
    for (let ring = 0; ring < 3; ring++) {
      const k = 1.3 + ring * 0.55;
      const cnt = 9 + ring * 4;
      for (let i = 0; i < cnt; i++) {
        const a = ((i + R() * 0.6) / cnt) * Math.PI * 2;
        const x = Math.cos(a) * dr.x * k * (0.9 + R() * 0.25);
        const y = -tip + Math.sin(a) * dr.y * k * (0.9 + R() * 0.25);
        if (y > fatTop || y < fatBot || Math.abs(x) > halfW - 0.0015) continue;
        if (Math.abs(x) < 0.0006 && y > -tip) continue; // the needle track
        nodes.push([x, y, zc + 0.0001]);
      }
    }
    const meshEdges = new Set();
    const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    nodes.forEach((p, i) => {
      const near = nodes.map((q, j) => [j, dist2(p, q)]).filter(([j]) => j !== i).sort((u, v) => u[1] - v[1]).slice(0, 3);
      for (const [j, d2] of near) {
        if (d2 > (dr.x * 1.6) ** 2) continue;
        const k = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (meshEdges.has(k)) continue;
        meshEdges.add(k);
        const q = nodes[j];
        const mx = (p[0] + q[0]) / 2 + (R() - 0.5) * 0.0007, my = (p[1] + q[1]) / 2 + (R() - 0.5) * 0.0007;
        const dc = Math.min(Math.hypot(p[0], p[1] + tip), Math.hypot(q[0], q[1] + tip)) / (dr.x * 2.6);
        geos.push(capTube([p, [mx, my, p[2]], q], 0.00012, 0, () => 0.05 + 0.4 * clamp01(dc), 5).geo);
      }
    });
    const nearestNode = (x, y) => {
      let best = null, bd = 1e9;
      for (const p of nodes) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = p; } }
      return best;
    };
    // absorption routes: depot edge → a mesh capillary → venule → out of the block
    routes = [];
    const angles = [200, 235, 270, 305, 340, 20, 160, 250, 290, 140];
    angles.forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const sx = Math.cos(a) * dr.x * 0.9, sy = -tip + Math.sin(a) * dr.y * 0.9;
      const node = nearestNode(sx * 1.6, -tip + (sy + tip) * 1.6);
      const goUp = Math.sin(a) > 0.2 || (i % 2 === 0 && Math.sin(a) > -0.3);
      const targetY = goUp ? venPlex[0][1] : venDeep[0][1];
      const ox = node ? node[0] : sx, oy = node ? node[1] : sy;
      const jx = THREE.MathUtils.clamp(ox + (R() - 0.5) * 0.008 - 0.002, -halfW + 0.004, xJmax - 0.001);
      const pts = [[sx, sy, zc], [ox, oy, zc]];
      const steps = 4;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        pts.push([ox + (jx - ox) * t + Math.sin(t * Math.PI) * (R() - 0.5) * 0.003, oy + (targetY - oy) * easeInOut(t) + (R() - 0.5) * 0.0006 * Math.sin(t * Math.PI), zc]);
      }
      geos.push(capTube(pts, 0.00013, 0, (u) => u * 0.5, 5).geo);
      const ven = goUp ? venPlex : venDeep;
      const tail = ven.filter((p) => p[0] < jx - 0.0005).reverse();
      const all = [...pts, ...tail, [exitX - 0.0015, tail.length ? tail[tail.length - 1][1] : targetY, zc]];
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
    capMesh = new THREE.Mesh(mergeCap(geos), capMat);
    capMesh.renderOrder = 8;
    seepPoints = new THREE.Points(seepGeo, seepMat);
    seepPoints.frustumCulled = false;
    seepPoints.renderOrder = 10;
    block.add(blockMesh, edges, capMesh, depotMesh, seepPoints);
    // label anchors: tissue layers on the lower edge of the cut face; depot, capillaries and lymph inside
    const lowX = F.down * W / 2;
    const highX = -lowX;
    labelAnchors = {
      skin: new THREE.Vector3(lowX, -derm * 0.5, 0),
      fat: new THREE.Vector3(lowX, -(derm + fat) / 2, 0),
      muscle: new THREE.Vector3(lowX, -(fat + D) / 2, 0),
      depot: new THREE.Vector3(0, -tip, 0.0035),
      capillaries: new THREE.Vector3(highX * 0.55, plexY - 0.0004, zc),
      lymph: new THREE.Vector3(0.62 * halfW, -(derm + (fat - derm) * 0.55), zc), // the lymph vessel runs toward +x
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
  // Callout anchors are functions so they follow the block; each key has its own output vector.
  const anchorOut = {};
  const worldAnchor = (key) => {
    const v = labelAnchors[key];
    if (!v) return null;
    const out = anchorOut[key] || (anchorOut[key] = new THREE.Vector3());
    return () => block.localToWorld(out.copy(labelAnchors[key]));
  };

  function setBlockOpacity(o) {
    block.visible = o > 0.003;
    blockMat.uniforms.uOpacity.value = o;
    blockMat.transparent = o < 0.999;
    blockMat.depthWrite = o > 0.5;
    capMat.uniforms.uOpacity.value = o;
    capMat.transparent = o < 0.999;
    edgeMat.opacity = o * (stage.theme === 'light' ? 0.45 : 0.4);
  }
  let depotVis = 1;
  function setDepot(k) {
    if (!depotMesh) return;
    const r = depotMesh.userData.r;
    const s = Math.max(1e-4, k);
    depotMesh.scale.set(r.x * s, r.y * s, r.z * s);
    depotMat.uniforms.uOpacity.value = Math.min(1, k * 1.4) * depotVis;
    blockMat.uniforms.uDepotR.value.set(r.x * Math.max(0.05, k), r.y * Math.max(0.05, k), r.z * Math.max(0.05, k));
    blockMat.uniforms.uDepotAmt.value = Math.min(1, k * 1.2);
  }
  // Section cut through the skin at the site (the block is the cut face).
  function setCut(site, amount) {
    const F = frameFor(site);
    if (!F || amount <= 0.001) { anatomy.setSkinCut(null); return; }
    anatomy.setSkinCut(F.point, site === 'arm' ? 0.065 : 0.08, amount, F.t);
  }

  // ---------------------------------------------------------------- seep particles (absorption)
  let seepMode = 'off'; // off | flow | still
  let seepOpacity = 1;
  function startSeep(mode) {
    seepMode = mode;
    const R = rng(4242);
    const n = routes.length;
    const lymph = routes[n - 1]?.lymph;
    for (let i = 0; i < SEEP_N; i++) {
      const p = seep[i];
      p.r = lymph && i % 5 === 0 ? n - 1 : i % (lymph ? n - 1 : n);
      p.delay = R() * 2.4;
      p.dur = (routes[p.r].lymph ? 2.8 : 1.9) + R() * 0.8;
      p.t = mode === 'still' ? R() : -1;
      p.jx = (R() - 0.5) * 0.00022; p.jy = (R() - 0.5) * 0.00022;
    }
  }
  function stopSeep() { seepMode = 'off'; seepAlpha.fill(0); seepGeo.attributes.aAlpha.needsUpdate = true; }
  const _sp = new THREE.Vector3();
  function samplePts(pts, f, out) {
    const x = clamp01(f) * (pts.length - 1);
    const i0 = Math.floor(x), i1 = Math.min(pts.length - 1, i0 + 1);
    return out.lerpVectors(pts[i0], pts[i1], x - i0);
  }
  const seepRand = rng(99);
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
        if (p.t > 1) { p.t = -1; p.delay = 0.2 + seepRand() * 0.6; for (let k = 0; k < SEEP_TRAIL; k++) seepAlpha[b + k] = 0; continue; }
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

  // ---------------------------------------------------------------- camera views
  // Fit a set of world points for a camera looking along `dir` (from the points toward the camera):
  // returns a stage.flyTo view whose target is the centre of the points' screen footprint and whose
  // distance fits them inside fillX × fillY of the stage at its current aspect.
  const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3();
  function fitView(points, dir, { fillX = 0.8, fillY = 0.76, minDist = 0.12, padRight = 56 } = {}) {
    const d = dir.clone().normalize();
    _r.crossVectors(UP, d).normalize();
    _u.crossVectors(d, _r).normalize();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = -Infinity;
    const o = points[0];
    for (const p of points) {
      _p.subVectors(p, o);
      const x = _p.dot(_r), y = _p.dot(_u), z = _p.dot(d);
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z > z1) z1 = z;
    }
    const W = Math.max(1, stage.size.width), H = Math.max(1, stage.size.height);
    // the zoom buttons take a column on the right: fit into the stage minus that column
    const wFrac = Math.max(0.5, (W - padRight) / W);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const target = o.clone().addScaledVector(_r, cx).addScaledVector(_u, cy);
    const cz = target.clone().sub(o).dot(d);
    const dist = Math.max(minDist, stage.fitDistance(((y1 - y0) / 2) / fillY, ((x1 - x0) / 2) / (fillX * wFrac)) + Math.max(0, z1 - cz));
    // shift the view so the footprint is centred in the free part of the stage
    const worldPerPx = (2 * dist * Math.tan((stage.camera.fov * DEG) / 2)) / H;
    target.addScaledVector(_r, (padRight / 2) * worldPerPx);
    return {
      target: target.toArray(), distance: dist,
      azimuth: Math.atan2(d.x, d.z) / DEG, elevation: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) / DEG,
    };
  }
  const local = (F, x, y, z) => new THREE.Vector3().copy(F.point).addScaledVector(F.b, x).addScaledVector(F.n, y).addScaledVector(F.t, z);
  // mode: 'needle' (block + syringe), 'tissue' (block only, closer)
  function closeView(site, mode = 'needle') {
    const F = frameFor(site);
    const { W, D, TH } = blockDims;
    const pts = [];
    for (const x of [-W / 2, W / 2]) for (const y of [0, -D]) for (const z of [0, -TH]) pts.push(local(F, x, y, z));
    // room for the label row under the block (and over it while absorbing)
    pts.push(local(F, F.down * W * (mode === 'tissue' ? 0.85 : 0.95), -D * 0.5, 0));
    if (mode === 'tissue') pts.push(local(F, -F.down * W * 0.8, -D * 0.5, 0));
    if (mode === 'needle') {
      const aspect = stage.size.width / Math.max(1, stage.size.height);
      // wide stages show the whole syringe; narrow ones keep the needle, hub and the front of the barrel
      const reach = aspect > 1.25 ? SYR_FULL : aspect > 0.8 ? SYR_FRONT : 0.028;
      for (const x of [-0.004, 0.004]) pts.push(local(F, x, SYR_APPROACH + reach, NEEDLE_OFF));
    }
    const v = fitView(pts, F.view, mode === 'tissue' ? { fillX: 0.7, fillY: 0.8 } : { fillX: 0.84, fillY: 0.76 });
    return v;
  }
  function routePoints(name, n = 14) {
    const r = vessels.routes?.[name];
    if (!r?.curve) return [];
    const out = [];
    // routes are in the anatomy's model space
    for (let i = 0; i <= n; i++) out.push(anatomy.toWorld ? anatomy.toWorld(r.curve.getPointAt(i / n)) : r.curve.getPointAt(i / n));
    return out;
  }
  const dirFromAngles = (azDeg, elDeg) => new THREE.Vector3(
    Math.sin(azDeg * DEG) * Math.cos(elDeg * DEG), Math.sin(elDeg * DEG), Math.cos(azDeg * DEG) * Math.cos(elDeg * DEG));
  function bloodView(site) {
    const pts = [...routePoints(`${site}_to_heart`), ...routePoints('heart_to_lungs', 6), ...routePoints('lungs_to_heart', 6)];
    pts.push(anatomy.organCenter('heart'));
    if (pts.length < 3) return { target: [0.03, 1.15, 0], distance: stage.fitDistance(0.36, 0.26), azimuth: 18, elevation: 6 };
    return fitView(pts, dirFromAngles(BLOOD_AZ[site] ?? 16, 6), { fillX: 0.7, fillY: 0.74 });
  }
  function distView(targets) {
    const pts = [anatomy.organCenter('heart'), anatomy.organCenter('lungs')];
    for (const o of targets) {
      const c = anatomy.organCenter(o);
      const r = Math.min(0.12, anatomy.organRadius(o) || 0.05) * 0.8;
      pts.push(c.clone().addScaledVector(UP, r), c.clone().addScaledVector(UP, -r));
    }
    return fitView(pts, dirFromAngles(12, 4), { fillX: 0.62, fillY: 0.78 });
  }
  const fly = (view, ms) => stage.flyTo({ ...view, duration: stage.reducedMotion ? 0 : ms });
  const flyHome = (ms) => stage.homeView({ duration: stage.reducedMotion ? 0 : ms });

  // ---------------------------------------------------------------- copy
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
    return out;
  }

  // ---------------------------------------------------------------- labels
  function tissueLabels(on) {
    if (!callouts) return;
    if (!on) { callouts.clear('tissue'); return; }
    callouts.set('tissue:skin', { anchor: worldAnchor('skin'), title: 'Skin', text: 'outer layers', tone: 'tissue', group: 'tissue', interactive: false, side: 'below' });
    callouts.set('tissue:fat', { anchor: worldAnchor('fat'), title: 'Fat layer', text: 'under the skin', tone: 'tissue', group: 'tissue', interactive: false, side: 'below' });
    callouts.set('tissue:muscle', { anchor: worldAnchor('muscle'), title: 'Muscle', text: 'deeper layer', tone: 'tissue', group: 'tissue', interactive: false, side: 'below' });
  }
  function depotLabel(on) {
    if (!callouts) return;
    if (on) callouts.set('tissue:depot', { anchor: worldAnchor('depot'), title: 'Depot', text: 'a pocket that releases slowly', tone: 'drug', group: 'tissue', interactive: false, side: 'above' });
    else callouts.remove('tissue:depot');
  }
  function capLabels(on, hasLymph) {
    if (!callouts) return;
    if (!on) { callouts.remove('tissue:cap'); callouts.remove('tissue:lymph'); return; }
    callouts.set('tissue:cap', { anchor: worldAnchor('capillaries'), title: 'Capillaries', text: 'tiny vessels take it up', tone: 'info', group: 'tissue', interactive: false, side: 'above' });
    if (hasLymph) callouts.set('tissue:lymph', { anchor: worldAnchor('lymph'), title: 'Lymph vessel', text: 'carries some of it too', tone: 'tissue', group: 'tissue', interactive: false, side: 'above' });
  }

  // ---------------------------------------------------------------- arrivals
  const arrived = new Set();
  const arrivalFades = [];   // { organ, start, from, to, dur }
  const arrivalTimers = new Set();
  const arrivalAnchors = {};
  let clock = 0;
  const ARRIVAL_REST = 0.7;
  function onArrive(organ, peptide) {
    if (arrived.has(organ)) return;
    arrived.add(organ);
    anatomy.highlight(organ, { channel: 'arrival', color: ORGAN_DRUG[stage.theme] || ORGAN_DRUG.dark, intensity: 1.6, pulse: 0 });
    arrivalFades.push({ organ, start: clock, from: 1.6, to: ARRIVAL_REST, dur: 2.2 });
    if (callouts) {
      const t = peptide?.targets?.find?.((x) => x.organ === organ);
      const rec = t?.receptors?.length ? `${t.receptors.join(' + ')} receptors` : 'drug arrives';
      const out = arrivalAnchors[organ] || (arrivalAnchors[organ] = new THREE.Vector3());
      callouts.set(`arrival:${organ}`, {
        // a function, so the label follows the body if it is edited while the label still shows
        anchor: () => (anatomy.organAnchor ? anatomy.organAnchor(organ, out) : anatomy.organCenter(organ, out)),
        title: ORGAN_LABEL[organ] || organ, text: rec, tone: 'drug', organ, group: 'arrival',
      });
    }
  }
  // After the sequence the timeline takes over: the arrival glow fades and the time-driven drug level
  // (vessels.setDrugLevel) is what remains.
  function fadeArrivals() {
    if (!arrived.size || playing) return;
    arrivalFades.length = 0;
    for (const o of arrived) arrivalFades.push({ organ: o, start: clock, from: ARRIVAL_REST, to: 0, dur: stage.reducedMotion ? 0 : 1.2, release: true });
    callouts?.clear('arrival');
  }

  // ---------------------------------------------------------------- state machine
  let playing = false;
  let tl = null;
  let resolvePlay = null;
  let stream = null;
  let current = null;
  let token = 0;

  function emitPhase(phase, copy, step) {
    const c = copy[phase] || DEFAULT_LABELS[phase];
    if (current) current.phase = phase;
    fire('sequence:phase', { phase, label: c.label, text: c.text, step, total: PHASES.length });
  }
  function isolate(on) {
    anatomy.setIsolate?.(on);
    vessels.setDim?.(on ? 0.04 : 1);
  }
  function hideStage() {
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
    current = null;
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
    const tm = setTimeout(() => { if (token === myToken) callouts?.clear('arrival'); arrivalTimers.delete(tm); }, 12000);
    arrivalTimers.add(tm);
    if (resolvePlay) { const r = resolvePlay; resolvePlay = null; r({ cancelled: false }); }
  }

  async function play({ site = 'abdomen', peptide = null } = {}) {
    reset();
    const myToken = ++token;
    await loadSyringe();
    if (myToken !== token) return { cancelled: true };
    if (!frameFor(site)) site = 'abdomen';
    const copy = phaseCopy(peptide);
    const targets = (peptide?.targets || []).map((t) => t.organ).filter(Boolean);
    const hasLymph = !!peptide?.absorption?.steps?.some?.((s) => s.id === 'lymph');
    current = { site, peptide, copy, targets, hasLymph, phase: null };
    buildBlock(site, peptide);
    playing = true;
    clock = 0;
    anatomy.selectSite(site);
    anatomy.setHotspotsVisible(false);
    const done = new Promise((res) => { resolvePlay = res; });
    tl = stage.reducedMotion ? buildReducedTimeline(current) : buildTimeline(current);
    return done;
  }

  // ~19 s. Times in seconds.
  function buildTimeline({ site, peptide, copy, targets, hasLymph }) {
    const T = makeTimeline();
    const { tip } = blockDims;
    syringe.setPlunger(0.34);
    syringe.setLiquid(0.34);
    placeSyringe(site, SYR_APPROACH + 0.012);
    setSyringeOpacity(0);
    T.at(0, () => {
      emitPhase('syringe', copy, 1);
      isolate(true);
      fly(closeView(site, 'needle'), 1700);
    });
    T.track(0.5, 1.5, (k) => { const e = easeOut(k); setBlockOpacity(e); setCut(site, e); });
    T.at(1.3, () => tissueLabels(true));
    // the syringe arrives along the skin normal, lined up with the section plane
    T.track(1.1, 1.8, (k) => { placeSyringe(site, SYR_APPROACH + 0.012 * (1 - easeOut(k))); setSyringeOpacity(easeOut(k)); });
    // insertion: through the skin and the dermis, stopping in the fat
    T.track(1.95, 3.0, (k) => placeSyringe(site, SYR_APPROACH - (SYR_APPROACH + tip) * easeInOut(k)));
    // the plunger goes down and the depot grows at the needle tip
    T.track(3.15, 4.6, (k) => {
      const e = easeInOut(k);
      syringe.setPlunger(0.34 * (1 - e));
      setDepot(easeOut(k));
    });
    T.at(4.7, () => { emitPhase('depot', copy, 2); depotLabel(true); });
    // withdraw along the same line
    T.track(5.0, 5.9, (k) => placeSyringe(site, -tip + (SYR_APPROACH + tip + 0.02) * easeInOut(k)));
    T.track(5.45, 6.0, (k) => setSyringeOpacity(1 - k));
    T.at(6.3, () => {
      emitPhase('absorption', copy, 3);
      depotLabel(false);
      capLabels(true, hasLymph);
      fly(closeView(site, 'tissue'), 1400);
      startSeep('flow');
    });
    T.track(6.3, 10.0, (k) => {
      capMat.uniforms.uFill.value = 1.15 * easeInOut(k);
      blockMat.uniforms.uSeep.value = easeOut(k);
      setDepot(1 - 0.6 * easeInOut(k));
    });
    T.at(10.2, () => {
      emitPhase('bloodstream', copy, 4);
      tissueLabels(false); capLabels(false);
      fly(bloodView(site), 1800);
      anatomy.setFocus('blood');
      stream = vessels.release({
        site, targets, count: 160,
        timing: { emit: 1.2, venous: 2.1, pulmonary: 1.2, arterial: 1.8 },
        onArrive: (o) => onArrive(o, peptide),
      });
    });
    T.track(10.2, 11.2, (k) => {
      seepOpacity = 1 - k;
      setBlockOpacity(1 - easeInOut(k));
      setCut(site, 1 - easeInOut(k));
      if (k >= 1) { stopSeep(); seepOpacity = 1; }
    });
    T.at(10.6, () => isolate(false));
    T.at(13.4, () => { emitPhase('distribution', copy, 5); anatomy.setFocus(null); fly(distView(targets), 1500); });
    // final pull-back: the whole body with the target organs glowing
    T.at(16.6, () => flyHome(2000));
    T.at(19.2, () => finish(copy));
    return T;
  }

  // Reduced motion: no flights and no particle travel; each phase is its end state, cross-faded.
  function buildReducedTimeline({ site, peptide, copy, targets, hasLymph }) {
    const T = makeTimeline();
    const { tip } = blockDims;
    const XF = 0.35;
    syringe.setPlunger(0.34);
    syringe.setLiquid(0.34);
    placeSyringe(site, -tip);
    setSyringeOpacity(0);
    T.at(0, () => {
      emitPhase('syringe', copy, 1);
      isolate(true);
      fly(closeView(site, 'needle'), 0);
      tissueLabels(true);
    });
    T.track(0, XF, (k) => { setBlockOpacity(k); setSyringeOpacity(k); setCut(site, k); });
    T.at(2.2, () => { emitPhase('depot', copy, 2); depotLabel(true); syringe.setPlunger(0); });
    T.track(2.2, 2.2 + XF, (k) => { setDepot(k); setSyringeOpacity(1 - k); });
    T.at(4.4, () => {
      emitPhase('absorption', copy, 3);
      depotLabel(false); capLabels(true, hasLymph);
      fly(closeView(site, 'tissue'), 0);
      startSeep('still');
      seepOpacity = 0;
    });
    T.track(4.4, 4.4 + XF, (k) => {
      capMat.uniforms.uFill.value = 1.15 * k;
      blockMat.uniforms.uSeep.value = k;
      setDepot(1 - 0.6 * k);
      seepOpacity = k;
    });
    T.at(6.6, () => {
      emitPhase('bloodstream', copy, 4);
      tissueLabels(false); capLabels(false);
      fly(bloodView(site), 0);
      isolate(false);
      anatomy.setFocus('blood');
      stream = vessels.trace({ site, targets, segments: [0, 1], count: 160, opacity: 0 });
    });
    T.track(6.6, 6.6 + XF, (k) => {
      setBlockOpacity(1 - k); seepOpacity = 1 - k;
      setCut(site, 1 - k);
      stream?.setOpacity?.(k);
      if (k >= 1) stopSeep();
    });
    T.at(8.8, () => {
      emitPhase('distribution', copy, 5);
      anatomy.setFocus(null);
      flyHome(0);
      stream?.cancel?.();
      stream = vessels.trace({ site, targets, segments: [2], count: 160, opacity: 0, onArrive: (o) => onArrive(o, peptide) });
    });
    T.track(8.8, 8.8 + XF, (k) => stream?.setOpacity?.(k));
    T.at(11, () => finish(copy));
    return T;
  }

  function skip() {
    if (!playing || !current) return;
    const { targets, peptide, copy } = current;
    tl = null;
    if (stream) { stream.cancel(); stream = null; }
    for (const o of targets) onArrive(o, peptide);
    hideStage();
    flyHome(0);
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
    // arrival glow: a flash that settles to a calm level; later it can fade out completely
    for (let i = arrivalFades.length - 1; i >= 0; i--) {
      const a = arrivalFades[i];
      const k = a.dur > 0 && !stage.reducedMotion ? Math.min(1, (clock - a.start) / a.dur) : 1;
      const inten = a.from + (a.to - a.from) * easeOut(k);
      if (inten <= 0.001) {
        anatomy.unhighlight(a.organ, { channel: 'arrival' });
        if (a.release) arrived.delete(a.organ);
      } else {
        anatomy.highlight(a.organ, { channel: 'arrival', color: ORGAN_DRUG[stage.theme] || ORGAN_DRUG.dark, intensity: inten, pulse: 0 });
      }
      if (k >= 1) arrivalFades.splice(i, 1);
    }
  }
  const offFrame = stage.onFrame(update);

  function applyTheme(theme) {
    drugColor.setHex(DRUG[theme] || DRUG.dark);
    const dark = theme !== 'light';
    blockMat.uniforms.uGlow.value = dark ? 1 : 0.15;
    capMat.uniforms.uGlow.value = dark ? 1 : 0;
    seepMat.uniforms.uCore.value = dark ? 1 : 0;
    seepMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    seepMat.needsUpdate = true;
    edgeMat.color.setHex(dark ? 0xe6d3a3 : 0x2e2920);
  }
  const offTheme = stage.onTheme((theme) => {
    applyTheme(theme);
    for (const o of arrived) {
      if (arrivalFades.some((a) => a.organ === o)) continue;
      anatomy.highlight(o, { channel: 'arrival', color: ORGAN_DRUG[theme] || ORGAN_DRUG.dark, intensity: ARRIVAL_REST });
    }
  });
  applyTheme(stage.theme);

  return {
    play, skip, reset, fadeArrivals,
    get playing() { return playing; },
    get phase() { return current?.phase || null; },
    get phaseTime() { return tl ? tl.time : 0; },
    get hasArrivals() { return arrived.size > 0; },
    dispose() {
      reset();
      offFrame(); offTheme(); offBody();
      syringe?.dispose?.();
      root.traverse((o) => { o.geometry?.dispose?.(); });
      for (const m of [blockMat, edgeMat, capMat, depotMat, seepMat]) m.dispose();
      seepGeo.dispose();
      root.removeFromParent();
    },
  };
}
