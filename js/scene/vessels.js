// PeptideScope: circulation (body).
// Flow routes from anatomy.landmarks.paths (Catmull-Rom curves along the real vessels), one merged mesh of
// faint flow lines, blood cells animated entirely on the GPU (pulsatile ~1 Hz in arteries, slow and steady
// in veins), and drug particles that travel site → heart → lungs → heart → aorta → target organs.
//
//   const vessels = createVessels(stage, anatomy);
//   vessels.setBloodFlow(true | false)   ambient blood cells (v4: on only while the sequence plays)
//   vessels.release({ site, targets: [organIds], count, onArrive(organId), timing }) → handle
//       handle = { promise, cancel(), finish(), setOpacity(a) }  (timing in seconds:
//       { emit, venous, pulmonary, arterial }; under reduced motion the route is shown as a still
//       trace and every onArrive fires at once)
//   vessels.trace({ site, targets, segments: [0 venous, 1 lungs, 2 arterial], opacity }) → handle
//   vessels.setDrugLevel(0..1)    drug tint in the flow lines and the target organs (timeline-driven)
//   vessels.setDrugTargets([organIds]); vessels.setDim(k); vessels.particleBudget
// The group lives inside the anatomy group, so routes and particles are in the anatomy's model space and
// follow the editable body's scale. When the skin is offset (weight), drug particles leave from the
// displaced skin point and merge into the vein within the first few centimetres of the route.
//
// v4 (performance + look): every point sprite in the scene stays within 1,500 on desktop and 600 on phones
// (blood cells ≤ 800 / 300, drug particles 160 × 3 / 70 × 2; the tissue close-up uses the rest); all flow
// lines are ONE draw call; nothing here asks for frames unless particles move or something fades. Arterial
// blood #E5484D, venous blood #3E63DD, the drug violet #6246EA (light) / #B3A4FF (dark).
import * as THREE from 'three';
import { OUTPUT_CHUNK } from './stage.js';

const S = 256; // samples per route in the path texture
const MAX_ROUTES = 64;
const ORGAN_PATH = {
  brain: 'to_brain', eyes: 'to_brain', thyroid: 'to_thyroid', heart: 'to_heart_muscle', liver: 'to_liver',
  gallbladder: 'to_gallbladder', stomach: 'to_stomach', pancreas: 'to_pancreas', spleen: 'to_spleen',
  small_intestine: 'to_small_intestine', large_intestine: 'to_large_intestine', kidneys: 'to_kidneys',
  bladder: 'to_kidneys', fat: 'to_fat', injection_site: 'to_fat', skin: 'to_skin', muscle: 'to_muscle',
};
const MIRRORED = ['abdomen_to_heart', 'thigh_to_heart', 'arm_to_heart', 'heart_to_lungs', 'lungs_to_heart',
  'to_kidneys', 'to_muscle', 'to_fat', 'to_skin'];
const COLORS = {
  light: { oxy: 0xe5484d, deoxy: 0x3e63dd, drug: 0x6246ea, organDrug: 0x6246ea, lineArt: 0xe5484d, lineVein: 0x3e63dd, lineDrug: 0x6246ea, cellAlpha: 0.8, additive: false },
  dark: { oxy: 0xff6369, deoxy: 0x7b93ff, drug: 0xb3a4ff, organDrug: 0xb3a4ff, lineArt: 0xff6369, lineVein: 0x7b93ff, lineDrug: 0xb3a4ff, cellAlpha: 0.85, additive: true },
};
const LEAD_IN = 0.07; // m along the venous route over which the skin offset blends into the vein
export const PARTICLE_BUDGET = { high: { cells: 800, drug: 160, trail: 3 }, low: { cells: 300, drug: 70, trail: 2 } };

// Arterial velocity waveform: a sharp systolic surge then a slow diastolic run-off, mean ≈ 1.
function pulseWave(t) {
  const x = t - Math.floor(t);
  return (0.35 + 2.2 * Math.exp(-(((x - 0.12) / 0.085) ** 2))) / 0.68;
}

const BLOOD_VERT = /* glsl */`
  uniform sampler2D uPaths;
  uniform float uArt; uniform float uVen; uniform float uScale;
  attribute float aRow; attribute float aOffset; attribute float aInvLen; attribute float aPulse; attribute float aOxy;
  attribute vec3 aJit;
  varying float vAlpha; varying float vOxy;
  vec3 pathAt(float row, float u) {
    float x = u * ${S - 1}.0;
    float i0 = floor(x);
    float f = x - i0;
    int r = int(row);
    vec3 a = texelFetch(uPaths, ivec2(int(i0), r), 0).xyz;
    vec3 b = texelFetch(uPaths, ivec2(int(min(i0 + 1.0, ${S - 1}.0)), r), 0).xyz;
    return mix(a, b, f);
  }
  void main() {
    float ph = aPulse > 0.5 ? uArt : uVen;
    float u = fract(aOffset + ph * aInvLen);
    vec3 p = pathAt(aRow, u) + aJit * 0.0022;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.97, 1.0, u));
    vOxy = aOxy;
    gl_PointSize = clamp(0.0036 * uScale / -mv.z, 1.0, 10.0);
  }`;
const BLOOD_FRAG = /* glsl */`
  uniform vec3 uOxy; uniform vec3 uDeoxy; uniform float uOpacity; uniform float uCellAlpha;
  varying float vAlpha; varying float vOxy;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float soft = 1.0 - smoothstep(0.55, 1.0, r2);
    // red cell: brighter rim, slightly darker centre (biconcave disc)
    float rim = smoothstep(0.05, 0.75, r2);
    vec3 base = vOxy > 0.5 ? uOxy : uDeoxy;
    gl_FragColor = vec4(base * (0.72 + 0.5 * rim), soft * vAlpha * uOpacity * uCellAlpha);
    ${OUTPUT_CHUNK}
  }`;

// All flow lines in one mesh: per-vertex route index and arc length; per-route activity in a uniform array.
const LINE_VERT = /* glsl */`
  uniform float uActive[${MAX_ROUTES}];
  attribute float aRoute; attribute float aS; attribute float aOxy; attribute float aPulse;
  varying float vS; varying float vActive; varying float vOxy; varying float vPulse; varying vec3 vN; varying vec3 vW;
  void main() {
    vS = aS; vOxy = aOxy; vPulse = aPulse;
    vActive = uActive[int(aRoute + 0.5)];
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const LINE_FRAG = /* glsl */`
  uniform vec3 uArtColor; uniform vec3 uVenColor; uniform vec3 uDrugColor; uniform float uAlpha; uniform float uDrug;
  uniform float uArt; uniform float uVen; uniform float uOpacity; uniform float uAnim; uniform float uBase;
  varying float vS; varying float vActive; varying float vOxy; varying float vPulse; varying vec3 vN; varying vec3 vW;
  void main() {
    float ph = vPulse > 0.5 ? uArt : uVen;
    float wave = pow(0.5 + 0.5 * sin((vS - ph) * 42.0), 8.0) * uAnim;
    vec3 v = normalize(cameraPosition - vW);
    float core = abs(dot(normalize(vN), v));
    float drug = clamp(uDrug + vActive, 0.0, 1.0);
    vec3 col = mix(vOxy > 0.5 ? uArtColor : uVenColor, uDrugColor, drug);
    float a = uAlpha * uBase * (0.4 + 0.6 * core) * (0.55 + 0.45 * wave) + vActive * (0.2 + 0.3 * wave) * core + uDrug * 0.25 * core;
    if (a < 0.003) discard;
    gl_FragColor = vec4(col * (1.0 + vActive * 0.2), clamp(a, 0.0, 1.0) * uOpacity);
    ${OUTPUT_CHUNK}
  }`;

const DRUG_VERT = /* glsl */`
  attribute float aAlpha; attribute float aSize;
  uniform float uScale; uniform float uSizeK;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aAlpha > 0.0 ? clamp(aSize * uSizeK * uScale / -mv.z, 1.5, 18.0 * uSizeK) : 0.0;
  }`;
const DRUG_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uOpacity; uniform float uCore; uniform float uAlphaK;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float glow = exp(-r2 * 3.5);
    vec3 col = uColor * (0.8 + uCore * exp(-r2 * 14.0));
    gl_FragColor = vec4(col, min(1.0, glow * vAlpha * uOpacity * uAlphaK));
    ${OUTPUT_CHUNK}
  }`;

export function createVessels(stage, anatomy) {
  const L = anatomy.landmarks || {};
  const P = L.paths || {};
  const inv = () => stage.invalidate?.();
  const group = new THREE.Group();
  group.name = 'vessels';
  (anatomy.root || stage.scene).add(group);
  const low = stage.quality === 'low';
  const BUDGET = PARTICLE_BUDGET[low ? 'low' : 'high'];

  // ---------------------------------------------------------------- routes
  const routes = [];
  const byName = {};
  const isVenousName = (n) => /_to_heart(_r)?$/.test(n);
  const isDeoxy = (n) => isVenousName(n) || /^heart_to_lungs/.test(n);
  function addRoute(name, pts) {
    if (routes.length >= MAX_ROUTES || !Array.isArray(pts) || pts.length < 2) return;
    const v = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal', 0.5);
    const length = curve.getLength();
    if (!(length > 0.01)) return;
    const n = Math.min(900, Math.max(48, Math.ceil(length / 0.002)));
    const sp = curve.getSpacedPoints(n - 1);
    const samples = new Float32Array(n * 3);
    sp.forEach((p, i) => { samples[i * 3] = p.x; samples[i * 3 + 1] = p.y; samples[i * 3 + 2] = p.z; });
    const r = {
      name, curve, length, samples, n, row: routes.length,
      pulse: !isVenousName(name), oxy: !isDeoxy(name), active: 0, activeTarget: 0,
    };
    routes.push(r);
    byName[name] = r;
  }
  for (const [name, pts] of Object.entries(P)) addRoute(name, pts);
  for (const name of MIRRORED) {
    const pts = P[name];
    if (!pts) continue;
    let changed = false;
    const m = pts.map((p) => { if (p[0] > 0.03) { changed = true; return [-p[0], p[1], p[2]]; } return p; });
    if (changed) addRoute(`${name}_r`, m);
  }
  const rows = routes.length;

  // Path texture: one row per route, S arc-length samples.
  const texData = new Float32Array(S * Math.max(1, rows) * 4);
  const tmp = new THREE.Vector3();
  for (const r of routes) {
    for (let i = 0; i < S; i++) {
      r.curve.getPointAt(i / (S - 1), tmp);
      const o = (r.row * S + i) * 4;
      texData[o] = tmp.x; texData[o + 1] = tmp.y; texData[o + 2] = tmp.z; texData[o + 3] = 1;
    }
  }
  const pathTex = new THREE.DataTexture(texData, S, Math.max(1, rows), THREE.RGBAFormat, THREE.FloatType);
  pathTex.minFilter = THREE.NearestFilter;
  pathTex.magFilter = THREE.NearestFilter;
  pathTex.generateMipmaps = false;
  pathTex.needsUpdate = true;

  // ---------------------------------------------------------------- shared phases
  const uArt = { value: 0 };
  const uVen = { value: 0 };
  const uScale = { value: 500 };
  const uAnim = { value: stage.reducedMotion ? 0 : 1 };

  // ---------------------------------------------------------------- flow lines (one merged mesh)
  const activeArr = new Float32Array(MAX_ROUTES);
  let lineMesh = null;
  const lineMat = new THREE.ShaderMaterial({
    uniforms: {
      uArtColor: { value: new THREE.Color() }, uVenColor: { value: new THREE.Color() }, uDrugColor: { value: new THREE.Color() },
      uAlpha: { value: 0.1 }, uDrug: { value: 0 }, uArt, uVen, uOpacity: { value: 1 }, uAnim, uBase: { value: 0 },
      uActive: { value: activeArr },
    },
    vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false,
  });
  // built on first use (the injection or the timeline), not with the scene
  let linesTried = false;
  function buildLines() {
    if (lineMesh || linesTried) return;
    linesTried = true;
    const parts = [];
    let vCount = 0, iCount = 0;
    for (const r of routes) {
      const g = new THREE.TubeGeometry(r.curve, Math.min(300, Math.max(24, Math.ceil(r.length / 0.008))), 0.0014, 5, false);
      parts.push([r, g]);
      vCount += g.attributes.position.count; iCount += g.index.count;
    }
    const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
    const aRoute = new Float32Array(vCount), aS = new Float32Array(vCount), aOx = new Float32Array(vCount), aPu = new Float32Array(vCount);
    const idx = new Uint32Array(iCount);
    let vo = 0, io = 0;
    for (const [r, g] of parts) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      const uv = g.attributes.uv;
      for (let i = 0; i < n; i++) { aRoute[vo + i] = r.row; aS[vo + i] = uv.getX(i) * r.length; aOx[vo + i] = r.oxy ? 1 : 0; aPu[vo + i] = r.pulse ? 1 : 0; }
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      vo += n; io += gi.length;
      g.dispose();
    }
    if (vCount) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('aRoute', new THREE.BufferAttribute(aRoute, 1));
      geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
      geo.setAttribute('aOxy', new THREE.BufferAttribute(aOx, 1));
      geo.setAttribute('aPulse', new THREE.BufferAttribute(aPu, 1));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      lineMesh = new THREE.Mesh(geo, lineMat);
      lineMesh.name = 'flow-lines';
      lineMesh.renderOrder = 3;
      lineMesh.frustumCulled = false;
      lineMesh.visible = false;
      group.add(lineMesh);
    }
  }

  // ---------------------------------------------------------------- blood cells (GPU)
  // Spread over the routes by length, capped by the particle budget.
  const totalLen = routes.reduce((a, r) => a + r.length * (r.pulse ? 1.25 : 1), 0) || 1;
  const perM = BUDGET.cells / totalLen;
  const cells = [];
  for (const r of routes) {
    const count = Math.max(3, Math.floor(r.length * perM * (r.pulse ? 1.25 : 1)));
    for (let i = 0; i < count && cells.length < BUDGET.cells; i++) cells.push(r);
  }
  const NC = cells.length;
  const cGeo = new THREE.BufferGeometry();
  const aRow = new Float32Array(NC), aOffset = new Float32Array(NC), aInvLen = new Float32Array(NC);
  const aPulse = new Float32Array(NC), aOxy = new Float32Array(NC), aJit = new Float32Array(NC * 3);
  for (let i = 0; i < NC; i++) {
    const r = cells[i];
    aRow[i] = r.row; aOffset[i] = Math.random(); aInvLen[i] = 1 / r.length;
    aPulse[i] = r.pulse ? 1 : 0; aOxy[i] = r.oxy ? 1 : 0;
    let x, y, z;
    do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1);
    aJit[i * 3] = x; aJit[i * 3 + 1] = y; aJit[i * 3 + 2] = z;
  }
  cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NC * 3), 3)); // positions come from the texture
  cGeo.setAttribute('aRow', new THREE.BufferAttribute(aRow, 1));
  cGeo.setAttribute('aOffset', new THREE.BufferAttribute(aOffset, 1));
  cGeo.setAttribute('aInvLen', new THREE.BufferAttribute(aInvLen, 1));
  cGeo.setAttribute('aPulse', new THREE.BufferAttribute(aPulse, 1));
  cGeo.setAttribute('aOxy', new THREE.BufferAttribute(aOxy, 1));
  cGeo.setAttribute('aJit', new THREE.BufferAttribute(aJit, 3));
  const cMat = new THREE.ShaderMaterial({
    uniforms: {
      uPaths: { value: pathTex }, uArt, uVen, uScale,
      uOxy: { value: new THREE.Color() }, uDeoxy: { value: new THREE.Color() },
      uOpacity: { value: 0 }, uCellAlpha: { value: 0.9 },
    },
    vertexShader: BLOOD_VERT, fragmentShader: BLOOD_FRAG, transparent: true, depthWrite: false,
  });
  const cellPoints = new THREE.Points(cGeo, cMat);
  cellPoints.frustumCulled = false;
  cellPoints.renderOrder = 4;
  cellPoints.name = 'blood-cells';
  cellPoints.visible = false;
  group.add(cellPoints);

  // ---------------------------------------------------------------- drug stream (CPU)
  const MAXP = BUDGET.drug, TRAIL = BUDGET.trail, NP = MAXP * TRAIL;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(NP * 3);
  const dAlpha = new Float32Array(NP);
  const dSize = new Float32Array(NP);
  const SIZES = [0.0058, 0.0044, 0.0034];
  for (let i = 0; i < MAXP; i++) for (let k = 0; k < TRAIL; k++) dSize[i * TRAIL + k] = SIZES[k];
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3).setUsage(THREE.DynamicDrawUsage));
  dGeo.setAttribute('aAlpha', new THREE.BufferAttribute(dAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  dGeo.setAttribute('aSize', new THREE.BufferAttribute(dSize, 1));
  const dMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 1 }, uScale, uCore: { value: 1.2 }, uAlphaK: { value: 0.55 }, uSizeK: { value: 1 } },
    vertexShader: DRUG_VERT, fragmentShader: DRUG_FRAG, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const drugPoints = new THREE.Points(dGeo, dMat);
  drugPoints.frustumCulled = false;
  drugPoints.renderOrder = 14;
  drugPoints.name = 'drug-stream';
  drugPoints.visible = false;
  group.add(drugPoints);

  // particle state (preallocated, no per-frame allocation)
  const ps = Array.from({ length: MAXP }, () => ({
    live: false, j: 0, seg: 0, f: 0, delay: 0, scale: 1, linger: -1, jx: 0, jy: 0, jz: 0, lx: 0, ly: 0, lz: 0, still: false,
  }));
  let journeys = [];
  let stream = null; // current release/trace

  function journeyFor(site, organ, variant) {
    const segs = [];
    const ven = byName[`${site}_to_heart`] || byName.abdomen_to_heart;
    if (ven) segs.push({ r: ven, kind: 0 });
    const right = variant % 2 === 1;
    const pa = (right && byName.heart_to_lungs_r) || byName.heart_to_lungs;
    const pv = (right && byName.lungs_to_heart_r) || byName.lungs_to_heart;
    if (pa) segs.push({ r: pa, kind: 1 });
    if (organ !== 'lungs' && pv) segs.push({ r: pv, kind: 1 });
    const pathName = ORGAN_PATH[organ];
    if (pathName && organ !== 'lungs') {
      const mirrored = variant >= 2 && byName[`${pathName}_r`];
      const art = mirrored || byName[pathName];
      if (art) segs.push({ r: art, kind: 2 });
    }
    const pulLen = segs.reduce((a, sg) => a + (sg.kind === 1 ? sg.r.length : 0), 0) || 1;
    for (const sg of segs) sg.share = sg.kind === 1 ? sg.r.length / pulLen : 1;
    return { organ, segs };
  }
  function samplePos(r, f, out) {
    const x = Math.min(1, Math.max(0, f)) * (r.n - 1);
    const i0 = Math.floor(x), i1 = Math.min(r.n - 1, i0 + 1), t = x - i0;
    const s = r.samples;
    out.x = s[i0 * 3] + (s[i1 * 3] - s[i0 * 3]) * t;
    out.y = s[i0 * 3 + 1] + (s[i1 * 3 + 1] - s[i0 * 3 + 1]) * t;
    out.z = s[i0 * 3 + 2] + (s[i1 * 3 + 2] - s[i0 * 3 + 2]) * t;
    return out;
  }
  const _p = { x: 0, y: 0, z: 0 };
  // samplePos plus the skin offset at the start of the venous segment (no allocation)
  function sampleSeg(sg, f, out, lead) {
    samplePos(sg.r, f, out);
    if (lead && sg.kind === 0) {
      const k = 1 - Math.min(1, Math.max(0, f) * sg.r.length / LEAD_IN);
      if (k > 0) { const e = k * k * (3 - 2 * k); out.x += lead.x * e; out.y += lead.y * e; out.z += lead.z * e; }
    }
    return out;
  }
  const segActiveCount = new Float32Array(Math.max(1, rows));

  function clearStream() {
    for (const p of ps) p.live = false;
    dAlpha.fill(0);
    dGeo.attributes.aAlpha.needsUpdate = true;
    drugPoints.visible = false;
    stream = null;
    inv();
  }

  function startStream({ site = 'abdomen', targets = [], count = 150, onArrive, timing = {}, mode = 'flow', segments = [0, 1, 2], opacity = 1 }) {
    if (stream) stream.cancel();
    const tg = (targets.length ? targets : ['heart']).filter((o, i, a) => a.indexOf(o) === i);
    journeys = [];
    // two variants per organ (left/right lung; mirrored branch where one exists)
    for (const organ of tg) for (let v = 0; v < 4; v++) journeys.push(journeyFor(site, organ, v));
    const n = Math.min(MAXP, Math.max(8, count | 0));
    const T = { emit: 1.4, venous: 2.6, pulmonary: 1.5, arterial: 2.2, ...timing };
    const arrived = new Set();
    let resolve;
    const promise = new Promise((res) => { resolve = res; });
    const s = {
      mode, T, onArrive, arrived, opacity, segments, resolve, n, done: false,
      lead: anatomy.siteOffset?.(site) || null,
      cancel() { if (s.done) return; s.done = true; clearStream(); resolve(); },
      finish() {
        if (s.done) return;
        for (const o of tg) if (!arrived.has(o)) { arrived.add(o); try { onArrive?.(o); } catch (e) { console.error(e); } }
        s.cancel();
      },
      setOpacity(a) { s.opacity = a; inv(); },
    };
    stream = s;
    drugPoints.visible = true;
    for (let i = 0; i < MAXP; i++) {
      const p = ps[i];
      p.live = i < n;
      if (!p.live) continue;
      p.j = i % journeys.length;
      p.seg = 0; p.f = 0; p.linger = -1; p.still = mode !== 'flow';
      p.delay = (i / n) * T.emit + Math.random() * 0.12;
      p.scale = 0.86 + Math.random() * 0.28;
      p.jx = (Math.random() - 0.5) * 0.004; p.jy = (Math.random() - 0.5) * 0.004; p.jz = (Math.random() - 0.5) * 0.004;
      const lr = 0.25 + Math.random() * 0.75;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      p.lx = Math.sin(ph) * Math.cos(th) * lr; p.ly = Math.cos(ph) * lr; p.lz = Math.sin(ph) * Math.sin(th) * lr;
      if (p.still) {
        // A still trace: spread particles over the chosen segments of the journey.
        const jr = journeys[p.j];
        const pick = [];
        jr.segs.forEach((sg, si) => { if (segments.includes(sg.kind)) pick.push(si); });
        if (!pick.length) { p.live = false; continue; }
        p.seg = pick[Math.floor(Math.random() * pick.length)];
        p.f = Math.random();
        p.delay = 0;
      }
    }
    for (let i = 0; i < MAXP; i++) if (!ps[i].live) for (let k = 0; k < TRAIL; k++) dAlpha[i * TRAIL + k] = 0;
    if (mode === 'still' && onArrive) {
      // reduced motion: everything has "arrived" at once
      queueMicrotask(() => { if (!s.done) for (const o of tg) if (!arrived.has(o)) { arrived.add(o); try { onArrive(o); } catch (e) { console.error(e); } } });
    }
    if (mode !== 'flow') resolve();
    s.promise = promise;
    inv();
    return s;
  }

  // → true while particles still move
  function updateStream(dt, t) {
    segActiveCount.fill(0);
    const s = stream;
    if (!s) return false;
    const pw = pulseWave(t);
    let alive = 0, moving = false;
    for (let i = 0; i < MAXP; i++) {
      const p = ps[i];
      const base = i * TRAIL;
      if (!p.live) continue;
      const jr = journeys[p.j];
      if (!jr || !jr.segs.length) { p.live = false; continue; }
      if (p.still) {
        const sg = jr.segs[p.seg];
        sampleSeg(sg, p.f, _p, s.lead);
        dPos[base * 3] = _p.x + p.jx; dPos[base * 3 + 1] = _p.y + p.jy; dPos[base * 3 + 2] = _p.z + p.jz;
        dAlpha[base] = 0.6 * s.opacity;
        for (let k = 1; k < TRAIL; k++) dAlpha[base + k] = 0;
        segActiveCount[sg.r.row] += 1;
        alive++;
        continue;
      }
      moving = true;
      if (p.delay > 0) { p.delay -= dt; for (let k = 0; k < TRAIL; k++) dAlpha[base + k] = 0; alive++; continue; }
      if (p.linger < 0) {
        const sg = jr.segs[p.seg];
        const dur = (sg.kind === 0 ? s.T.venous : sg.kind === 1 ? s.T.pulmonary * sg.share : s.T.arterial) * p.scale;
        const rate = (1 / Math.max(0.2, dur)) * (sg.kind === 0 ? 1 : pw);
        p.f += dt * rate;
        if (p.f >= 1) {
          if (p.seg < jr.segs.length - 1) { p.seg++; p.f = 0; }
          else {
            p.f = 1;
            p.linger = 0;
            if (!s.arrived.has(jr.organ)) {
              s.arrived.add(jr.organ);
              try { s.onArrive?.(jr.organ); } catch (e) { console.error('[vessels] onArrive failed', e); }
            }
          }
        }
      }
      const sg = jr.segs[p.seg];
      if (p.linger >= 0) {
        p.linger += dt;
        const spread = Math.min(1, p.linger / 1.1);
        const e = 1 - (1 - spread) * (1 - spread);
        // organRadius is in world units; particles live in the anatomy's model space
        const rad = ((anatomy.organRadius?.(jr.organ) || 0.05) / (anatomy.bodyScale || 1)) * 0.45;
        samplePos(sg.r, 1, _p);
        dPos[base * 3] = _p.x + p.lx * rad * e; dPos[base * 3 + 1] = _p.y + p.ly * rad * e; dPos[base * 3 + 2] = _p.z + p.lz * rad * e;
        const a = (1 - Math.min(1, Math.max(0, (p.linger - 0.25) / 1.4))) * s.opacity;
        dAlpha[base] = a * 0.9;
        for (let k = 1; k < TRAIL; k++) dAlpha[base + k] = 0;
        if (p.linger > 1.7) { p.live = false; dAlpha[base] = 0; continue; }
        alive++;
        continue;
      }
      sampleSeg(sg, p.f, _p, s.lead);
      dPos[base * 3] = _p.x + p.jx; dPos[base * 3 + 1] = _p.y + p.jy; dPos[base * 3 + 2] = _p.z + p.jz;
      const fadeIn = Math.min(1, (p.seg === 0 ? p.f * 8 : 1));
      dAlpha[base] = fadeIn * s.opacity;
      const step = 0.011 / Math.max(0.05, sg.r.length);
      for (let k = 1; k < TRAIL; k++) {
        sampleSeg(sg, p.f - step * k, _p, s.lead);
        const o = (base + k) * 3;
        dPos[o] = _p.x + p.jx; dPos[o + 1] = _p.y + p.jy; dPos[o + 2] = _p.z + p.jz;
        dAlpha[base + k] = fadeIn * s.opacity * (0.55 - k * 0.18);
      }
      segActiveCount[sg.r.row] += 1;
      alive++;
    }
    dGeo.attributes.position.needsUpdate = true;
    dGeo.attributes.aAlpha.needsUpdate = true;
    if (!alive && s.mode === 'flow' && !s.done) { s.done = true; stream = null; drugPoints.visible = false; s.resolve(); }
    return moving;
  }

  // ---------------------------------------------------------------- drug level
  let drugLevel = 0;
  let drugTargets = [];
  let C = COLORS[stage.theme] || COLORS.light;
  function setDrugLevel(level) {
    const next = Math.min(1, Math.max(0, Number(level) || 0));
    drugLevel = next;
    for (const id of drugTargets) {
      if (drugLevel > 0.01) anatomy.highlight(id, { channel: 'drug', color: C.organDrug, intensity: 0.12 + 0.5 * drugLevel });
      else anatomy.unhighlight(id, { channel: 'drug' });
    }
    inv();
  }
  function setDrugTargets(ids) {
    for (const id of drugTargets) anatomy.unhighlight(id, { channel: 'drug' });
    drugTargets = Array.isArray(ids) ? ids.filter(Boolean) : [];
    setDrugLevel(drugLevel);
  }

  // ---------------------------------------------------------------- theme
  function applyTheme(theme) {
    C = COLORS[theme] || COLORS.light;
    const blending = C.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    cMat.uniforms.uOxy.value.setHex(C.oxy);
    cMat.uniforms.uDeoxy.value.setHex(C.deoxy);
    cMat.uniforms.uCellAlpha.value = C.cellAlpha;
    cMat.blending = blending; cMat.needsUpdate = true;
    dMat.uniforms.uColor.value.setHex(C.drug);
    dMat.uniforms.uCore.value = C.additive ? 0.6 : 0.0;
    // on the light stage the drug is a violet ink: larger and denser so it reads over the vessels
    dMat.uniforms.uAlphaK.value = C.additive ? 0.6 : 1.5;
    dMat.uniforms.uSizeK.value = C.additive ? 1 : 1.3;
    dMat.blending = blending; dMat.needsUpdate = true;
    lineMat.uniforms.uArtColor.value.setHex(C.lineArt);
    lineMat.uniforms.uVenColor.value.setHex(C.lineVein);
    lineMat.uniforms.uDrugColor.value.setHex(C.lineDrug);
    lineMat.uniforms.uAlpha.value = C.additive ? 0.12 : 0.16;
    lineMat.blending = blending; lineMat.needsUpdate = true;
    setDrugLevel(drugLevel);
  }
  const offTheme = stage.onTheme(applyTheme);
  applyTheme(stage.theme);

  // ---------------------------------------------------------------- frame
  let flowOn = false;
  let flowVis = 0;
  let dimTarget = 1, dim = 1;
  const vArt = 0.2, vVen = 0.065;
  function update(dt, t) {
    const rm = stage.reducedMotion;
    uAnim.value = rm ? 0 : 1;
    let busy = false;
    const fv = flowOn ? 1 : 0;
    if (Math.abs(flowVis - fv) > 2e-3) { flowVis += (fv - flowVis) * (rm ? 1 : 1 - Math.exp(-dt * 4)); busy = true; } else flowVis = fv;
    if (Math.abs(dim - dimTarget) > 2e-3) { dim += (dimTarget - dim) * (rm ? 1 : 1 - Math.exp(-dt * 6)); busy = true; } else dim = dimTarget;
    const vis = dim * (anatomy.layerFade?.vessels ?? 1) * (anatomy.layerFade?.inside ?? 1);
    const cellsOn = flowVis * vis > 0.01;
    cMat.uniforms.uOpacity.value = flowVis * vis;
    cellPoints.visible = cellsOn;
    // the blood only flows while it is on screen (and never under reduced motion)
    if (cellsOn && !rm) {
      uArt.value += dt * vArt * pulseWave(t);
      uVen.value += dt * vVen;
      busy = true;
    }
    uScale.value = stage.viewScale || 500;
    if (updateStream(dt, t)) busy = true;
    const k = rm ? 1 : 1 - Math.exp(-dt * 5);
    let anyActive = false;
    for (const r of routes) {
      r.activeTarget = segActiveCount[r.row] > 0 ? 1 : 0;
      if (Math.abs(r.active - r.activeTarget) > 2e-3) { r.active += (r.activeTarget - r.active) * k; busy = true; } else r.active = r.activeTarget;
      activeArr[r.row] = r.active * dim;
      if (r.active > 0.01) anyActive = true;
    }
    // faint route lines only while blood is shown; routes the drug is on stay lit; the timeline's drug
    // level tints them
    lineMat.uniforms.uDrug.value = drugLevel * 0.55 * vis;
    lineMat.uniforms.uBase.value = flowVis;
    lineMat.uniforms.uOpacity.value = Math.max(vis, dim * 0.9);
    const linesWanted = dim > 0.01 && (anyActive || flowVis > 0.01 || drugLevel * vis > 0.01);
    if (linesWanted && !linesTried) buildLines();
    if (lineMesh) lineMesh.visible = linesWanted;
    return busy;
  }
  const offFrame = stage.onFrame(update);

  return {
    group,
    routes: byName,
    get particleCount() { return NC + NP; },
    particleBudget: { cells: NC, drug: NP },
    setBloodFlow(on) { if (flowOn !== !!on) { flowOn = !!on; inv(); } },
    // 0..1 visibility of the ambient blood cells and flow lines (the drug stream is unaffected)
    setDim(k) { dimTarget = Math.min(1, Math.max(0, k)); inv(); },
    release(opts = {}) {
      return startStream({ ...opts, mode: stage.reducedMotion ? 'still' : 'flow', segments: [0, 1, 2] });
    },
    trace(opts = {}) {
      return startStream({ ...opts, mode: 'still', onArrive: opts.onArrive || null });
    },
    clearDrugStream() { if (stream) stream.cancel(); else clearStream(); },
    setDrugLevel,
    setDrugTargets,
    get drugLevel() { return drugLevel; },
    routeStart(name) { const r = byName[name]; return r ? r.curve.getPointAt(0) : null; }, // model space
    dispose() {
      offFrame(); offTheme();
      stream?.cancel();
      group.traverse((o) => { o.geometry?.dispose?.(); });
      cMat.dispose(); dMat.dispose(); lineMat.dispose();
      pathTex.dispose();
      group.removeFromParent();
    },
  };
}
