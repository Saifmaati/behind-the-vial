// PeptideScope: circulation (body3d).
// Flow routes from anatomy.landmarks.paths (Catmull-Rom curves), faint glowing flow lines, blood
// cells animated entirely on the GPU (pulsatile ~1 Hz in arteries, slow and steady in veins), and
// luminous drug particles that travel site → heart → lungs → heart → aorta → target organs.
//
//   const vessels = createVessels(stage, anatomy);
//   vessels.setBloodFlow(true | false)
//   vessels.release({ site, targets: [organIds], count, onArrive(organId), timing }) → handle
//       handle = { promise, cancel(), finish(), setOpacity(a) }  (timing in seconds:
//       { emit, venous, pulmonary, arterial }; under reduced motion the route is shown as a still
//       trace and every onArrive fires at once)
//   vessels.trace({ site, targets, segments: [0 venous, 1 lungs, 2 arterial], opacity }) → handle
//   vessels.setDrugLevel(0..1)    drug glow in the blood, the flow lines and the target organs
//   vessels.setDrugTargets([organIds])
// The group lives inside the anatomy group, so routes and particles are in the anatomy's model space
// and follow the editable body's scale. When the skin is offset (weight), drug particles leave from the
// displaced skin point and merge into the vein within the first few centimetres of the route.
// Luxury palette: oxblood arterial blood, wine venous blood, the drug as luminous champagne light.
// The ambient blood cells and flow lines follow the anatomy's Vessels layer (anatomy.layerFade.vessels);
// the drug stream always shows. Phones and low-end devices (stage.quality 'low') get half the cells and
// fewer drug particles.
import * as THREE from 'three';

const S = 256; // samples per route in the path texture
const ORGAN_PATH = {
  brain: 'to_brain', eyes: 'to_brain', thyroid: 'to_thyroid', heart: 'to_heart_muscle', liver: 'to_liver',
  gallbladder: 'to_gallbladder', stomach: 'to_stomach', pancreas: 'to_pancreas', spleen: 'to_spleen',
  small_intestine: 'to_small_intestine', large_intestine: 'to_large_intestine', kidneys: 'to_kidneys',
  bladder: 'to_kidneys', fat: 'to_fat', injection_site: 'to_fat', skin: 'to_skin', muscle: 'to_muscle',
};
const MIRRORED = ['abdomen_to_heart', 'thigh_to_heart', 'arm_to_heart', 'heart_to_lungs', 'lungs_to_heart',
  'to_kidneys', 'to_muscle', 'to_fat', 'to_skin'];
const COLORS = {
  dark: { oxy: 0xc4524a, deoxy: 0x8a2f45, drug: 0xf1dda8, organDrug: 0xe2be72, lineArt: 0xc4524a, lineVein: 0x5b7db8, lineDrug: 0xf1dda8, cellAlpha: 0.9, additive: true },
  light: { oxy: 0xa83a33, deoxy: 0x7a2a40, drug: 0x8f6c2c, organDrug: 0x8f6c2c, lineArt: 0x9c2f2a, lineVein: 0x2f4f86, lineDrug: 0x8f6c2c, cellAlpha: 0.72, additive: false },
};
const LEAD_IN = 0.07; // m along the venous route over which the skin offset blends into the vein

// Arterial velocity waveform: a sharp systolic surge then a slow diastolic run-off, mean ≈ 1.
function pulseWave(t) {
  const x = t - Math.floor(t);
  return (0.35 + 2.2 * Math.exp(-(((x - 0.12) / 0.085) ** 2))) / 0.68;
}

const BLOOD_VERT = /* glsl */`
  uniform sampler2D uPaths;
  uniform float uRows; uniform float uArt; uniform float uVen; uniform float uScale; uniform float uDrugLevel;
  attribute float aRow; attribute float aOffset; attribute float aInvLen; attribute float aPulse; attribute float aOxy;
  attribute float aDrug; attribute vec3 aJit;
  varying float vAlpha; varying float vOxy; varying float vDrug;
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
    float edge = smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.97, 1.0, u));
    vOxy = aOxy; vDrug = aDrug;
    vAlpha = edge * (aDrug > 0.5 ? smoothstep(0.0, 0.08, uDrugLevel) * (0.35 + 0.65 * uDrugLevel) : 1.0);
    float size = aDrug > 0.5 ? 0.005 : 0.0033;
    gl_PointSize = clamp(size * uScale / -mv.z, 1.0, aDrug > 0.5 ? 13.0 : 10.0);
  }`;
const BLOOD_FRAG = /* glsl */`
  uniform vec3 uOxy; uniform vec3 uDeoxy; uniform vec3 uDrug; uniform float uOpacity; uniform float uCellAlpha;
  varying float vAlpha; varying float vOxy; varying float vDrug;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float soft = 1.0 - smoothstep(0.55, 1.0, r2);
    vec3 col;
    if (vDrug > 0.5) col = uDrug * (1.6 - r2);
    else {
      // red cell: brighter rim, slightly darker centre (biconcave disc)
      float rim = smoothstep(0.05, 0.75, r2);
      vec3 base = vOxy > 0.5 ? uOxy : uDeoxy;
      col = base * (0.72 + 0.5 * rim);
    }
    gl_FragColor = vec4(col, soft * vAlpha * uOpacity * (vDrug > 0.5 ? 1.0 : uCellAlpha));
  }`;

const LINE_VERT = /* glsl */`
  varying float vU; varying vec3 vN; varying vec3 vW;
  void main() {
    vU = uv.x;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const LINE_FRAG = /* glsl */`
  uniform vec3 uColor; uniform vec3 uDrugColor; uniform float uAlpha; uniform float uActive; uniform float uDrug;
  uniform float uLen; uniform float uPhase; uniform float uOpacity; uniform float uAnim;
  varying float vU; varying vec3 vN; varying vec3 vW;
  void main() {
    float s = vU * uLen;
    float wave = pow(0.5 + 0.5 * sin((s - uPhase) * 42.0), 8.0) * uAnim;
    vec3 v = normalize(cameraPosition - vW);
    float core = abs(dot(normalize(vN), v));
    float drug = clamp(uDrug + uActive, 0.0, 1.0);
    vec3 col = mix(uColor, uDrugColor, drug);
    float a = uAlpha * (0.4 + 0.6 * core) * (0.55 + 0.45 * wave) + uActive * (0.16 + 0.24 * wave) * core + uDrug * 0.22 * core;
    gl_FragColor = vec4(col * (1.0 + uActive * 0.25 + wave * 0.3), clamp(a, 0.0, 1.0) * uOpacity);
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
    vec3 col = uColor * (0.75 + uCore * exp(-r2 * 14.0));
    gl_FragColor = vec4(col, min(1.0, glow * vAlpha * uOpacity * uAlphaK));
  }`;

export function createVessels(stage, anatomy) {
  const { scene } = stage;
  const L = anatomy.landmarks || {};
  const P = L.paths || {};
  const group = new THREE.Group();
  group.name = 'vessels';
  (anatomy.root || scene).add(group);

  // ---------------------------------------------------------------- routes
  const routes = [];
  const byName = {};
  const isVenousName = (n) => /_to_heart(_r)?$/.test(n);
  const isDeoxy = (n) => isVenousName(n) || /^heart_to_lungs/.test(n);
  function addRoute(name, pts) {
    if (!Array.isArray(pts) || pts.length < 2) return;
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
      pulse: !isVenousName(name), oxy: !isDeoxy(name), active: 0, activeTarget: 0, mat: null,
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
  const uDrugLevel = { value: 0 };
  const uAnim = { value: stage.reducedMotion ? 0 : 1 };

  // ---------------------------------------------------------------- flow lines
  const lineGroup = new THREE.Group();
  lineGroup.name = 'flow-lines';
  group.add(lineGroup);
  const lineProto = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color() }, uDrugColor: { value: new THREE.Color() }, uAlpha: { value: 0.09 },
      uActive: { value: 0 }, uDrug: { value: 0 }, uLen: { value: 1 }, uPhase: uArt, uOpacity: { value: 1 }, uAnim,
    },
    vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false,
  });
  for (const r of routes) {
    const geo = new THREE.TubeGeometry(r.curve, Math.min(400, Math.max(24, Math.ceil(r.length / 0.006))), 0.0014, 6, false);
    const mat = lineProto.clone();
    mat.uniforms.uPhase = r.pulse ? uArt : uVen;
    mat.uniforms.uAnim = uAnim;
    mat.uniforms.uLen.value = r.length;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 3;
    mesh.name = `flow:${r.name}`;
    r.mat = mat;
    lineGroup.add(mesh);
  }
  lineProto.dispose();

  // ---------------------------------------------------------------- blood cells (GPU)
  const low = stage.quality === 'low';
  const cells = [];
  for (const r of routes) {
    const density = (r.pulse ? 150 : 115) * (low ? 0.5 : 1);
    const count = Math.max(6, Math.round(r.length * density));
    for (let i = 0; i < count; i++) cells.push(r);
  }
  const NC = cells.length;
  const cGeo = new THREE.BufferGeometry();
  const cPos = new Float32Array(NC * 3); // unused, positions come from the texture
  const aRow = new Float32Array(NC), aOffset = new Float32Array(NC), aInvLen = new Float32Array(NC);
  const aPulse = new Float32Array(NC), aOxy = new Float32Array(NC), aDrug = new Float32Array(NC), aJit = new Float32Array(NC * 3);
  for (let i = 0; i < NC; i++) {
    const r = cells[i];
    aRow[i] = r.row; aOffset[i] = Math.random(); aInvLen[i] = 1 / r.length;
    aPulse[i] = r.pulse ? 1 : 0; aOxy[i] = r.oxy ? 1 : 0; aDrug[i] = Math.random() < 0.2 ? 1 : 0;
    let x, y, z;
    do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1);
    aJit[i * 3] = x; aJit[i * 3 + 1] = y; aJit[i * 3 + 2] = z;
  }
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cGeo.setAttribute('aRow', new THREE.BufferAttribute(aRow, 1));
  cGeo.setAttribute('aOffset', new THREE.BufferAttribute(aOffset, 1));
  cGeo.setAttribute('aInvLen', new THREE.BufferAttribute(aInvLen, 1));
  cGeo.setAttribute('aPulse', new THREE.BufferAttribute(aPulse, 1));
  cGeo.setAttribute('aOxy', new THREE.BufferAttribute(aOxy, 1));
  cGeo.setAttribute('aDrug', new THREE.BufferAttribute(aDrug, 1));
  cGeo.setAttribute('aJit', new THREE.BufferAttribute(aJit, 3));
  const cMat = new THREE.ShaderMaterial({
    uniforms: {
      uPaths: { value: pathTex }, uRows: { value: rows }, uArt, uVen, uScale, uDrugLevel,
      uOxy: { value: new THREE.Color() }, uDeoxy: { value: new THREE.Color() }, uDrug: { value: new THREE.Color() },
      uOpacity: { value: 1 }, uCellAlpha: { value: 0.95 },
    },
    vertexShader: BLOOD_VERT, fragmentShader: BLOOD_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const cellPoints = new THREE.Points(cGeo, cMat);
  cellPoints.frustumCulled = false;
  cellPoints.renderOrder = 4;
  cellPoints.name = 'blood-cells';
  group.add(cellPoints);

  // ---------------------------------------------------------------- drug stream (CPU)
  const MAXP = low ? 150 : 240, TRAIL = 4, NP = MAXP * TRAIL;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(NP * 3);
  const dAlpha = new Float32Array(NP);
  const dSize = new Float32Array(NP);
  for (let i = 0; i < MAXP; i++) for (let k = 0; k < TRAIL; k++) dSize[i * TRAIL + k] = [0.0058, 0.0046, 0.0037, 0.003][k];
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
    stream = null;
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
      setOpacity(a) { s.opacity = a; },
    };
    stream = s;
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
    return s;
  }

  function updateStream(dt, t) {
    segActiveCount.fill(0);
    const s = stream;
    if (!s) return;
    const pw = pulseWave(t);
    let alive = 0;
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
        dAlpha[base] = 0.5 * s.opacity;
        for (let k = 1; k < TRAIL; k++) dAlpha[base + k] = 0;
        segActiveCount[sg.r.row] += 1;
        alive++;
        continue;
      }
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
      const step = 0.009 / Math.max(0.05, sg.r.length);
      for (let k = 1; k < TRAIL; k++) {
        sampleSeg(sg, p.f - step * k, _p, s.lead);
        const o = (base + k) * 3;
        dPos[o] = _p.x + p.jx; dPos[o + 1] = _p.y + p.jy; dPos[o + 2] = _p.z + p.jz;
        dAlpha[base + k] = fadeIn * s.opacity * (0.55 - k * 0.14);
      }
      segActiveCount[sg.r.row] += 1;
      alive++;
    }
    dGeo.attributes.position.needsUpdate = true;
    dGeo.attributes.aAlpha.needsUpdate = true;
    if (!alive && s.mode === 'flow' && !s.done) { s.done = true; stream = null; s.resolve(); }
  }

  // ---------------------------------------------------------------- drug level
  let drugLevel = 0;
  let drugTargets = [];
  let C = COLORS[stage.theme] || COLORS.dark;
  function setDrugLevel(level) {
    drugLevel = Math.min(1, Math.max(0, Number(level) || 0));
    uDrugLevel.value = drugLevel;
    for (const id of drugTargets) {
      if (drugLevel > 0.01) anatomy.highlight(id, { channel: 'drug', color: C.organDrug, intensity: 0.12 + 0.5 * drugLevel });
      else anatomy.unhighlight(id, { channel: 'drug' });
    }
  }
  function setDrugTargets(ids) {
    for (const id of drugTargets) anatomy.unhighlight(id, { channel: 'drug' });
    drugTargets = Array.isArray(ids) ? ids.filter(Boolean) : [];
    setDrugLevel(drugLevel);
  }

  // ---------------------------------------------------------------- theme
  function applyTheme(theme) {
    C = COLORS[theme] || COLORS.dark;
    const blending = C.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    cMat.uniforms.uOxy.value.setHex(C.oxy);
    cMat.uniforms.uDeoxy.value.setHex(C.deoxy);
    cMat.uniforms.uDrug.value.setHex(C.drug);
    cMat.uniforms.uCellAlpha.value = C.cellAlpha;
    cMat.blending = blending; cMat.needsUpdate = true;
    dMat.uniforms.uColor.value.setHex(C.drug);
    dMat.uniforms.uCore.value = C.additive ? 0.55 : 0.0;
    // on the pale theme the drug is a dark teal ink: larger and denser so it reads over the vessels
    dMat.uniforms.uAlphaK.value = C.additive ? 0.55 : 1.6;
    dMat.uniforms.uSizeK.value = C.additive ? 1 : 1.35;
    dMat.blending = blending; dMat.needsUpdate = true;
    for (const r of routes) {
      r.mat.uniforms.uColor.value.setHex(r.oxy ? C.lineArt : C.lineVein);
      r.mat.uniforms.uDrugColor.value.setHex(C.lineDrug);
      r.mat.uniforms.uAlpha.value = C.additive ? 0.1 : 0.14;
      r.mat.blending = blending; r.mat.needsUpdate = true;
    }
    setDrugLevel(drugLevel);
  }
  const offTheme = stage.onTheme(applyTheme);
  applyTheme(stage.theme);

  // ---------------------------------------------------------------- frame
  let flowOn = true;
  let flowVis = 1;
  let dimTarget = 1, dim = 1;
  const vArt = 0.2, vVen = 0.065;
  function update(dt, t) {
    const rm = stage.reducedMotion;
    uAnim.value = rm ? 0 : 1;
    if (flowOn && !rm) {
      uArt.value += dt * vArt * pulseWave(t);
      uVen.value += dt * vVen;
    }
    flowVis += ((flowOn ? 1 : 0) - flowVis) * (rm ? 1 : 1 - Math.exp(-dt * 4));
    dim += (dimTarget - dim) * (rm ? 1 : 1 - Math.exp(-dt * 6));
    const vis = dim * (anatomy.layerFade?.vessels ?? 1) * (anatomy.layerFade?.inside ?? 1);
    cMat.uniforms.uOpacity.value = flowVis * vis;
    cellPoints.visible = flowVis * vis > 0.01;
    lineGroup.visible = dim > 0.01; // routes the drug is on stay lit even with the layer off
    uScale.value = stage.viewScale || 500;
    updateStream(dt, t);
    const k = rm ? 1 : 1 - Math.exp(-dt * 5);
    for (const r of routes) {
      r.activeTarget = segActiveCount[r.row] > 0 ? 1 : 0;
      r.active += (r.activeTarget - r.active) * k;
      r.mat.uniforms.uActive.value = r.active;
      r.mat.uniforms.uDrug.value = drugLevel * 0.55;
      r.mat.uniforms.uOpacity.value = Math.max(vis, r.active * dim);
    }
  }
  const offFrame = stage.onFrame(update);

  return {
    group,
    routes: byName,
    setBloodFlow(on) { flowOn = !!on; },
    // 0..1 visibility of the ambient blood cells and flow lines (the drug stream is unaffected)
    setDim(k) { dimTarget = Math.min(1, Math.max(0, k)); },
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
      group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      pathTex.dispose();
      group.removeFromParent();
    },
  };
}
