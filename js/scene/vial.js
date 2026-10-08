// Procedural, physically based peptide vial (intro).
//
// createVial(THREE, { envMap, scale = 1, envMapIntensity = 1, capColor, label = true }) →
//   { group, dispose(),                                   // contract
//     parts, materials, dims, labelReady }                // extras (additive)
//
// What it is: the small clear "2R" serum vial that gray-market peptides are sold in (ISO 8362-1 2R
// proportions): clear borosilicate glass with real wall thickness, a grey lyophilisation rubber
// stopper, a crimped aluminium seal with a flip-off plastic button (muted oxblood), a white freeze-dried
// powder cake at the bottom and a minimal paper label that reads like a gray-market product
// ("RESEARCH USE ONLY", "NOT FOR HUMAN USE", a lot code). The label never shows an amount, a strength,
// a brand, a price or any preparation or storage wording (a hard product rule).
//
// LOCAL FRAME AND REAL-WORLD SIZE (meters, before `scale`; group.scale = scale):
//   - +Y is the vial axis; y = 0 is the lowest point of the glass (the heel ring it stands on); the axis
//     is x = z = 0. The label is centred on +Z (the "front").
//   - Glass: body outer diameter 16.0 mm, wall 1.0 mm, bottom 0.8 mm (slight push-up dome), neck outer
//     diameter 10.5 mm, bore 7.0 mm, crown (lip) 13.0 mm wide, glass height 35.0 mm.
//   - Stopper: grey bromobutyl, plug inside the bore (5.4 mm deep) and a flange on the crown.
//   - Aluminium seal: 13 mm crimp, skirt rolled under the crown; flip-off button 12.9 mm wide on top.
//     Overall height with the button: 39.8 mm (`dims.height`).
//   - Powder cake: 6.6 mm tall, 13.5 mm wide (it shrinks a little away from the wall when freeze-dried).
//   - Label: 15.5 mm tall (y 10.6–26.1 mm), wraps 290° around the body, gap at the back (-Z).
//   - `dims` repeats these numbers (meters, unscaled); `dims.center` is the visual centre (y).
//
// RENDERING NOTES (three r185)
//   - The glass is one closed lathe solid (outer and inner surfaces) with MeshPhysicalMaterial
//     transmission, FrontSide: each wall is crossed once with a 1 mm `thickness`. three.js only shows
//     opaque-list objects through transmissive ones, so the cake, stopper and label are opaque, and the
//     far wall's reflections are a separate opaque-list additive layer (`parts.glassBack`, BackSide,
//     black base colour, specular only) so they show through the front wall, refracted.
//   - Pass `envMap` or set `scene.environment`: glass reads as glass mostly through the strip-light
//     reflections of a studio environment.

const MM = 0.001;

/** Glass profile, millimetres: [r, y] from the outer bottom centre, up the outside, down the inside. */
function glassProfile() {
  const pts = [];
  const P = (r, y) => pts.push([r, y]);
  const arc = (cx, cy, rad, a0, a1, n) => {
    for (let i = 1; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      P(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    }
  };
  const bez = (p0, p1, p2, p3, n) => {
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      P(u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]);
    }
  };
  // outside: push-up dome, heel ring, wall, shoulder, neck, crown
  P(0, 0.55); P(2.4, 0.5); P(4.4, 0.34); P(5.8, 0.12); P(6.55, 0.0);
  arc(6.55, 1.45, 1.45, -Math.PI / 2, 0, 8);           // heel → (8.0, 1.45)
  P(8.0, 6); P(8.0, 12); P(8.0, 18); P(8.0, 25.3);
  bez([8.0, 25.3], [8.0, 27.7], [5.25, 27.4], [5.25, 29.7], 14); // shoulder
  P(5.25, 30.75);
  bez([5.25, 30.75], [5.3, 31.15], [6.45, 31.0], [6.5, 31.55], 6); // under the crown
  P(6.5, 34.35);
  arc(6.0, 34.35, 0.5, 0, Math.PI / 2, 5);             // crown top edge → (6.0, 34.85)
  P(5.0, 34.98); P(4.0, 35.0);
  arc(4.0, 34.55, 0.45, Math.PI / 2, Math.PI, 4);      // bore lip → (3.55, 34.55)
  // inside: bore, inner shoulder, wall, heel, floor
  P(3.5, 33.2); P(3.5, 29.4);
  bez([3.5, 29.4], [3.5, 27.2], [7.0, 27.3], [7.0, 24.9], 14);
  P(7.0, 18); P(7.0, 12); P(7.0, 6); P(7.0, 2.25);
  arc(6.0, 2.25, 1.0, 0, -Math.PI / 2, 6);             // inner heel → (6.0, 1.25)
  P(4.5, 1.28); P(2.4, 1.33); P(0, 1.35);
  return pts;
}

export function createVial(THREE, opts = {}) {
  const {
    envMap = null,
    scale = 1,
    envMapIntensity = 1,
    capColor = 0x4a1d22,       // muted oxblood flip-off button
    label = true,
    radialSegments = 112,
  } = opts;

  const disposables = new Set();
  const track = (x) => { if (x) disposables.add(x); return x; };
  const group = new THREE.Group();
  group.name = 'vial';
  group.scale.setScalar(scale);

  const lathe = (pts, seg = radialSegments) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r * MM, y * MM)), seg);
  const mesh = (geo, mat, name, renderOrder = 0) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.name = name;
    m.renderOrder = renderOrder;
    group.add(m);
    return m;
  };

  // ------------------------------------------------------------------ materials
  const glass = track(new THREE.MeshPhysicalMaterial({
    name: 'vial-glass',
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    ior: 1.47,                    // borosilicate
    thickness: 1.0 * MM * scale,
    attenuationColor: new THREE.Color(0xf7f4ee),
    attenuationDistance: 0.05 * scale,
    specularIntensity: 1,
    envMapIntensity,
    side: THREE.FrontSide,
  }));
  // far-wall reflections seen through the front wall (opaque list, additive, specular only)
  const glassBack = track(new THREE.MeshPhysicalMaterial({
    name: 'vial-glass-back',
    color: 0x000000,
    metalness: 0,
    roughness: 0.05,
    specularIntensity: 1,
    envMapIntensity: envMapIntensity * 0.55,
    side: THREE.BackSide,
    transparent: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const rubber = track(new THREE.MeshPhysicalMaterial({
    name: 'vial-stopper',
    color: 0x5f6266,
    roughness: 0.62,
    metalness: 0,
    sheen: 0.4,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0x8a8d91),
    clearcoat: 0.1,
    clearcoatRoughness: 0.5,
    envMapIntensity,
  }));
  const alu = track(new THREE.MeshPhysicalMaterial({
    name: 'vial-seal',
    color: 0xd9d6d0,
    metalness: 1,
    roughness: 0.36,
    envMapIntensity,
    side: THREE.DoubleSide,
  }));
  const cap = track(new THREE.MeshPhysicalMaterial({
    name: 'vial-cap',
    color: capColor,
    roughness: 0.46,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.32,
    sheen: 0.2,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xb98a7c),
    envMapIntensity,
  }));
  const cake = track(makeCakeMaterial(THREE, envMapIntensity));
  const labelTex = label ? track(makeLabelTexture(THREE)) : null;
  const paper = track(new THREE.MeshPhysicalMaterial({
    name: 'vial-label',
    color: 0xffffff,
    map: labelTex ? labelTex.texture : null,
    roughness: 0.74,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xffffff),
    envMapIntensity: envMapIntensity * 0.8,
  }));
  const materials = { glass, glassBack, stopper: rubber, seal: alu, cap, cake, label: paper };
  if (envMap) for (const m of Object.values(materials)) if ('envMap' in m) m.envMap = envMap;

  // ------------------------------------------------------------------ glass (closed solid lathe)
  const glassGeo = track(lathe(glassProfile()));
  const glassMesh = mesh(glassGeo, glass, 'glass', 3);
  const glassBackMesh = new THREE.Mesh(glassGeo, glassBack);
  glassBackMesh.name = 'glass-back';
  glassBackMesh.renderOrder = 1;
  group.add(glassBackMesh);

  // ------------------------------------------------------------------ powder cake
  const cakeMesh = mesh(makeCakeGeometry(THREE), cake, 'cake', 0);

  // ------------------------------------------------------------------ stopper (plug in the bore + flange)
  const stopperProfile = [
    [0, 29.75], [2.6, 29.75], [3.25, 29.9], [3.47, 30.25], [3.47, 34.0], [3.52, 34.6], [3.52, 35.0],
    [3.52, 35.0], [6.2, 35.0], [6.42, 35.15], [6.48, 35.5], [6.48, 36.6], [6.35, 36.95], [6.35, 36.95], [0, 36.95],
  ];
  const stopperMesh = mesh(lathe(stopperProfile, 64), rubber, 'stopper', 0);

  // ------------------------------------------------------------------ aluminium crimp seal (thin sheet)
  const sealProfile = [
    [5.42, 30.95], [5.75, 30.86], [6.2, 30.98], [6.55, 31.25], [6.72, 31.7], [6.74, 32.4],
    [6.74, 36.55], [6.7, 36.95], [6.55, 37.2], [6.3, 37.3], [5.0, 37.32], [4.55, 37.3], [4.42, 37.18], [4.4, 37.0],
  ];
  const sealGeo = lathe(sealProfile);
  crimpFolds(sealGeo, 26, 0.035 * MM, 30.8 * MM, 32.4 * MM);
  const sealMesh = mesh(sealGeo, alu, 'seal', 0);

  // ------------------------------------------------------------------ flip-off button
  const capProfile = [
    [0, 37.2], [6.2, 37.2], [6.4, 37.28], [6.46, 37.5], [6.46, 39.25], [6.38, 39.58], [6.12, 39.76], [5.6, 39.8],
    [5.25, 39.8], [5.12, 39.7], [4.78, 39.7], [4.66, 39.8], [0, 39.8],
  ];
  const capMesh = mesh(lathe(capProfile, 96), cap, 'cap', 0);

  // ------------------------------------------------------------------ label (290° wrap, gap at the back)
  let labelMesh = null;
  const LABEL = { r: 8.06, y0: 10.6, y1: 26.1, arcDeg: 290 };
  if (labelTex) {
    const th = THREE.MathUtils.degToRad(LABEL.arcDeg);
    const geo = new THREE.CylinderGeometry(LABEL.r * MM, LABEL.r * MM, (LABEL.y1 - LABEL.y0) * MM, 160, 1, true, -th / 2, th);
    geo.translate(0, ((LABEL.y0 + LABEL.y1) / 2) * MM, 0);
    labelMesh = mesh(geo, paper, 'label', 0);
  }

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const d of disposables) { try { d.dispose(); } catch { /* already gone */ } }
    disposables.clear();
  }

  const dims = {
    units: 'meters',
    scale,
    height: 39.8 * MM,
    glassHeight: 35.0 * MM,
    bodyDiameter: 16.0 * MM,
    neckDiameter: 10.5 * MM,
    crownDiameter: 13.0 * MM,
    boreDiameter: 7.0 * MM,
    wall: 1.0 * MM,
    cakeTop: 7.9 * MM,
    labelBottom: LABEL.y0 * MM,
    labelTop: LABEL.y1 * MM,
    shoulder: 27.5 * MM,
    center: 19.9 * MM,
  };

  return {
    group,
    dispose,
    dims,
    parts: { glass: glassMesh, glassBack: glassBackMesh, cake: cakeMesh, stopper: stopperMesh, seal: sealMesh, cap: capMesh, label: labelMesh },
    materials,
    labelReady: labelTex ? labelTex.ready : Promise.resolve(),
  };
}

// ==================================================================== helpers

/** Radial folds where the aluminium skirt is crimped under the crown (displaces the lathe in place). */
function crimpFolds(geo, folds, amp, y0, y1) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > y1) continue;
    const w = 1 - Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    const a = Math.atan2(x, z);
    const r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const k = 1 + (amp / r) * w * w * (Math.sin(a * folds) * 0.8 + Math.sin(a * folds * 2.3 + 1.7) * 0.2);
    pos.setXYZ(i, x * k, y, z * k);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Freeze-dried cake: a slightly shrunken, irregular puck with a soft concave top. */
function makeCakeGeometry(THREE) {
  const R = 6.75, yb = 1.4, top = 7.95;
  const prof = [
    [0, yb], [3, yb], [5.6, yb + 0.02], [6.45, yb + 0.12], [R, yb + 0.45], [R, yb + 1.5], [R - 0.02, 4.0], [R - 0.05, 6.4],
    [R - 0.12, top - 0.35], [R - 0.35, top - 0.05], [R - 0.8, top + 0.03], [5.0, top - 0.06], [3.5, top - 0.2], [2.0, top - 0.3], [0, top - 0.34],
  ];
  // lathe the profile, then roughen it with a smooth 3D noise (continuous across the seam)
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * MM, y * MM)), 96);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / MM, y = pos.getY(i) / MM, z = pos.getZ(i) / MM;
    const r = Math.hypot(x, z);
    const top01 = Math.min(1, Math.max(0, (y - 6.8) / 1.2));
    const n = vnoise3(x * 0.9, y * 0.9, z * 0.9) * 0.6 + vnoise3(x * 2.3 + 7, y * 2.3, z * 2.3) * 0.3 + vnoise3(x * 5.1, y * 5.1 + 3, z * 5.1) * 0.1;
    // the side pulls in a little and wobbles; the top undulates
    const dr = r > 0.5 ? (n - 0.5) * 0.18 * (1 - top01 * 0.5) : 0;
    const dy = top01 * (n - 0.5) * 0.45 + (y > yb + 0.3 ? 0 : 0);
    const k = r > 1e-6 ? (r + dr) / r : 1;
    pos.setXYZ(i, x * k * MM, (y + dy) * MM, z * k * MM);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function makeCakeMaterial(THREE, envMapIntensity) {
  const mat = new THREE.MeshStandardMaterial({
    name: 'vial-cake',
    color: 0xf4f1ea,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: envMapIntensity * 0.7,
  });
  // porous, slightly cracked surface: albedo grain + darker hairline fissures (procedural, no textures)
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCakeP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvCakeP = position * 1000.0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vCakeP;
float ckHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ckNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ckHash(i), ckHash(i + vec3(1,0,0)), f.x), mix(ckHash(i + vec3(0,1,0)), ckHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ckHash(i + vec3(0,0,1)), ckHash(i + vec3(1,0,1)), f.x), mix(ckHash(i + vec3(0,1,1)), ckHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float ckCell(vec3 p) { // distance to the nearest Voronoi edge (approximate, 2D on the radial plane)
  vec3 i = floor(p); vec3 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(ckHash(i + g), ckHash(i + g + 19.1), ckHash(i + g + 37.7));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float g = ckNoise(vCakeP * 6.0) * 0.6 + ckNoise(vCakeP * 15.0) * 0.4;
  float e = ckCell(vCakeP * vec3(0.55, 0.42, 0.55));
  float crack = 1.0 - smoothstep(0.0, 0.045, e);
  diffuseColor.rgb *= 0.9 + 0.1 * g;
  diffuseColor.rgb *= 1.0 - 0.32 * crack * smoothstep(0.35, 0.7, ckNoise(vCakeP * 0.7));
}`);
  };
  return mat;
}

// -------------------------------------------------------------------- label

// The label is deliberately minimal: what a gray-market vial says about itself, and nothing else.
// Never an amount, a strength, a brand, a price or any preparation or storage instruction.
const LABEL_LINES = {
  main: 'RESEARCH USE ONLY',
  warn: 'NOT FOR HUMAN USE',
  lot: 'LOT 24A0917',
};

/** Canvas-drawn paper label. Redraws once the web font is available. Returns { texture, ready, dispose }. */
function makeLabelTexture(THREE) {
  const W = 2048;
  const H = 778; // 15.5 mm tall over a 40.8 mm wrap
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const draw = () => {
    const g = canvas.getContext('2d');
    // paper: warm ivory with a faint fibre grain
    g.fillStyle = '#efe9de';
    g.fillRect(0, 0, W, H);
    const rnd = mulberry32(7);
    g.globalAlpha = 0.05;
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = rnd() < 0.5 ? '#ffffff' : '#b9ad99';
      g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1);
    }
    g.globalAlpha = 1;
    const cx = W / 2;
    const ink = '#1c1915';
    const sans = '"Inter", "Helvetica Neue", Arial, sans-serif';
    const text = (s, x, y, font, color, tracking = 0, align = 'center') => {
      g.font = font;
      g.fillStyle = color;
      g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g) {
        g.letterSpacing = `${tracking}px`;
        g.textAlign = align;
        // letterSpacing adds trailing space after the last glyph: compensate when centred
        g.fillText(s, align === 'center' ? x + tracking / 2 : x, y);
        g.letterSpacing = '0px';
      } else {
        g.textAlign = align;
        g.fillText(s, x, y);
      }
    };
    // front panel (about 115° of the wrap, so every line stays readable from the front)
    const panelW = 800;
    g.strokeStyle = 'rgba(40, 32, 20, 0.5)';
    g.lineWidth = 2;
    g.strokeRect(cx - panelW / 2, 70, panelW, H - 140);
    g.fillStyle = '#5a1f22';
    g.fillRect(cx - panelW / 2, 70, panelW, 12);
    g.fillRect(cx - panelW / 2, H - 82, panelW, 12);

    text(LABEL_LINES.main, cx, 318, `800 78px ${sans}`, ink, 2);
    text(LABEL_LINES.warn, cx, 404, `700 44px ${sans}`, '#7b2a25', 10);
    g.fillStyle = 'rgba(40, 32, 20, 0.45)';
    g.fillRect(cx - 250, 460, 500, 2);
    text(LABEL_LINES.lot, cx, 560, `500 40px ${sans}`, '#3e382f', 8);
    texture.needsUpdate = true;
  };
  draw();
  let ready = Promise.resolve();
  try {
    if (document.fonts && document.fonts.load) {
      ready = Promise.all([document.fonts.load('800 78px "Inter"'), document.fonts.load('500 40px "Inter"')])
        .then(() => draw())
        .catch(() => {});
    }
  } catch { /* no font loading API */ }
  return { texture, ready, dispose: () => texture.dispose() };
}

// -------------------------------------------------------------------- small math

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

function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx), fy),
    l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx), fy),
    fz,
  );
}
