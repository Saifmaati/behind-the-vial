// Procedural, physically based syringe (intro; reused by the injection sequence).
//
// createSyringe(THREE, { envMap, scale = 1, ... }) →
//   { group, setPlunger(t), setLiquid(t), setCapOn(on), dispose(),          // contract
//     setGlow(t), parts, materials, dims, tip }                             // extras (additive)
//
// LOCAL FRAME AND REAL-WORLD SIZE (meters, before `scale`; group.scale = scale):
//   - The barrel, plunger and needle share the local Y axis. The needle points toward -Y.
//   - The needle tip (the sharp point of the bevel) is at y = 0. It sits on the needle wall,
//     0.165 mm from the axis, at (0, 0, -0.000165): `tip` holds that exact point. For placement on the
//     body treat the origin as the tip; the error is under 0.2 mm.
//   - Everything else extends along +Y: exposed needle 0 – 12.7 mm, needle hub 12.7 – 22.2 mm, barrel
//     (nozzle to rim) 21.6 – 98 mm with the finger flange at 96.5 – 98 mm, plunger thumb press above
//     the flange (104 – 105.6 mm when fully pushed in, 55.3 mm higher when fully drawn back).
//   - Barrel: outer diameter 6.8 mm, inner diameter 4.8 mm (1 mm wall). Barrel length ≈ 7.6 cm, about
//     8.4 cm with the hub. Overall ≈ 10.6 cm (plunger in) to 16.1 cm (plunger fully drawn back).
//   - Needle: 0.33 mm outer diameter, 12.7 mm exposed, 12° lancet bevel. The bevel face and the printed
//     graduation marks both face local +Z.
//   - The finger flange is wide along local X (21 mm) and narrow along local Z (10.5 mm).
//
// API SEMANTICS
//   setPlunger(t): 0 = stopper fully pushed in, 1 = drawn back to the top graduation mark.
//   setLiquid(t):  liquid volume as a fraction of the graduated capacity (0..1). It can never exceed the
//                  space below the stopper: pushing the plunger past the liquid level expels liquid
//                  (the stored level drops with it); drawing the plunger back leaves an air gap and the
//                  liquid shows a meniscus at the needle end (assumes needle-down, as in an injection).
//   setCapOn(on):  shows or hides the needle cap.
//   setGlow(t):    0..1 faint self-luminance of the liquid (the cinematic intro uses ~0.6).
//   Graduation ticks carry no numbers and no units (a hard product rule).
//
// RENDERING NOTES (three r185)
//   - Barrel, flange, hub and cap use MeshPhysicalMaterial transmission. three.js only shows OPAQUE-list
//     objects through transmissive ones, so the liquid is drawn in the opaque list with its own blending
//     (transparent: false + CustomBlending, depthWrite false). Additive "glow" objects behind the
//     syringe should do the same (transparent: false, AdditiveBlending, depthWrite false) if they need to
//     be seen refracted through the glass.
//   - Pass `envMap` or set `scene.environment` (RoomEnvironment works well). Without an environment
//     the glass has nothing to reflect and looks flat.

const MM = 0.001;

/** Design dimensions in millimetres. Derived values are added below. */
const S = {
  needleR: 0.165, lumenR: 0.092, needleLen: 12.7, needleInHub: 6.5, bevelDeg: 12,
  hubBottom: 12.7, hubTop: 22.2,
  nozzleBottom: 21.6, nozzleR: 1.6, channelR: 0.45,
  shoulderY: 24.0, bodyY: 26.8, barrelTop: 98.0,
  outerR: 3.4, innerR: 2.4,
  floorEdgeY: 27.4, coneSlope: 0.9,
  flangeW: 21.0, flangeD: 10.5, flangeT: 1.5,
  stopperH: 6.2, stopperGap: 0.08, travel: 55.3,
  thumbR: 5.2, thumbH: 1.6, thumbGap: 6.0,
  ticks: 50, majorEvery: 5,
  capTop: 23.4, capBottom: -2.4,
};
S.channelTopY = S.floorEdgeY - (S.innerR - S.channelR) * S.coneSlope; // floor cone meets the channel
S.stopperBase0 = S.channelTopY - S.channelR * S.coneSlope + S.stopperGap; // stopper cone tip at t = 0

export function createSyringe(THREE, opts = {}) {
  const {
    envMap = null,
    scale = 1,
    envMapIntensity = 1,
    tickColor = 0xc9d1d9,
    liquidColor = 0xbfeeff,
    radialSegments = 64,
  } = opts;

  const disposables = new Set();
  const track = (x) => { if (x) disposables.add(x); return x; };

  const group = new THREE.Group();
  group.name = 'syringe';
  group.scale.setScalar(scale);

  // ------------------------------------------------------------------ materials
  const glass = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-barrel',
    color: 0xffffff,
    metalness: 0,
    roughness: 0.035,
    transmission: 1,
    ior: 1.49,
    thickness: 1.0 * MM,
    attenuationColor: new THREE.Color(0xe6f3ff),
    attenuationDistance: 0.03 * scale,
    specularIntensity: 1,
    clearcoat: 0.0,
    envMapIntensity,
    side: THREE.DoubleSide,
  }));
  const hubMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-hub',
    color: 0xdfe5eb,
    roughness: 0.32,
    transmission: 0.55,
    ior: 1.5,
    thickness: 1.6 * MM,
    attenuationColor: new THREE.Color(0xd9dee4),
    attenuationDistance: 0.006 * scale,
    envMapIntensity,
  }));
  const capMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-cap',
    color: 0xe9edf1,
    roughness: 0.42,
    transmission: 0.9,
    ior: 1.49,
    thickness: 0.4 * MM,
    attenuationColor: new THREE.Color(0xc8d0d8),
    attenuationDistance: 0.004 * scale,
    envMapIntensity,
  }));
  const plungerMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-plunger',
    color: 0xe8ecef,
    roughness: 0.38,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
    envMapIntensity,
  }));
  const rubberMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-stopper',
    color: 0x16181b,
    roughness: 0.58,
    metalness: 0,
    sheen: 0.55,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0x4a5058),
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
    envMapIntensity,
  }));
  const steelMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-needle',
    color: 0xd7dce1,
    metalness: 1,
    roughness: 0.3,
    vertexColors: true,
    envMapIntensity,
    side: THREE.DoubleSide,
  }));
  const tickTex = track(makeTickTexture(THREE));
  const tickMat = track(new THREE.MeshStandardMaterial({
    name: 'syringe-ticks',
    color: tickColor,
    emissive: new THREE.Color(tickColor).multiplyScalar(0.12),
    roughness: 0.55,
    metalness: 0,
    alphaMap: tickTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    envMapIntensity,
  }));
  const liquidMat = track(makeLiquidMaterial(THREE, liquidColor));

  const materials = { glass, hub: hubMat, cap: capMat, plunger: plungerMat, stopper: rubberMat, needle: steelMat, ticks: tickMat, liquid: liquidMat };
  if (envMap) {
    for (const m of Object.values(materials)) if ('envMap' in m && m !== liquidMat) m.envMap = envMap;
  }

  const mesh = (geo, mat, name, renderOrder = 0) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.name = name;
    m.renderOrder = renderOrder;
    return m;
  };

  // ------------------------------------------------------------------ barrel (outer + inner wall, closed lathe)
  const barrelProfile = [];
  const P = (r, y) => barrelProfile.push(new THREE.Vector2(r * MM, y * MM));
  P(S.channelR, S.nozzleBottom);
  P(S.nozzleR - 0.12, S.nozzleBottom); P(S.nozzleR - 0.12, S.nozzleBottom); // hard edge
  P(S.nozzleR - 0.03, S.nozzleBottom + 0.12);
  P(S.nozzleR, S.shoulderY - 0.2);
  // convex shoulder from the nozzle to the barrel wall
  {
    const rx = S.outerR - S.nozzleR, ry = S.bodyY - S.shoulderY + 0.2, cx = S.nozzleR, cy = S.bodyY;
    for (let i = 1; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * (Math.PI / 2);
      P(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
    }
  }
  const rimY = S.barrelTop - 0.05; // hidden inside the flange's top face (avoids z-fighting)
  P(S.outerR, rimY - 0.3);
  P(S.outerR - 0.3, rimY); P(S.outerR - 0.3, rimY);
  P(S.innerR + 0.2, rimY); P(S.innerR + 0.2, rimY);
  P(S.innerR, rimY - 0.2);
  P(S.innerR, S.floorEdgeY); P(S.innerR, S.floorEdgeY); // inner wall → floor cone, hard edge
  P(S.channelR, S.channelTopY); P(S.channelR, S.channelTopY);
  P(S.channelR, S.nozzleBottom); // closes on the first point
  const barrel = mesh(new THREE.LatheGeometry(barrelProfile, radialSegments), glass, 'barrel', 2);
  group.add(barrel);

  // finger flange: rounded oblong with the bore through it
  const flange = mesh(makeFlangeGeometry(THREE), glass, 'flange', 2);
  group.add(flange);

  // printed graduation marks on a hairline shell just outside the barrel, facing +Z
  const yZero = S.stopperBase0 + stopperRibBottom();
  const yFull = yZero + S.travel;
  const tickPad = 1.2;
  const tickArc = THREE.MathUtils.degToRad(100);
  const tickGeo = new THREE.LatheGeometry(
    [new THREE.Vector2((S.outerR + 0.03) * MM, (yZero - tickPad) * MM), new THREE.Vector2((S.outerR + 0.03) * MM, (yFull + tickPad) * MM)],
    28, -tickArc / 2, tickArc,
  );
  const ticks = mesh(tickGeo, tickMat, 'ticks', 3);
  group.add(ticks);
  tickTex.userData.layout = { yZero, yFull, tickPad };

  // ------------------------------------------------------------------ hub + needle
  const hubProfile = [
    [0, 12.62], [0.30, 12.62], [0.42, 12.78], [0.72, 13.3], [1.0, 13.8], [1.18, 14.1], [1.22, 14.35], [1.22, 14.35],
    [1.3, 14.9], [1.86, 20.9], [1.86, 20.9], [2.3, 21.05], [2.36, 21.3], [2.36, 21.95], [2.3, 22.2], [2.3, 22.2], [0, 22.2],
  ].map(([r, y]) => new THREE.Vector2(r * MM, y * MM));
  const hub = mesh(new THREE.LatheGeometry(hubProfile, 40), hubMat, 'hub', 1);
  group.add(hub);

  const needle = mesh(makeNeedleGeometry(THREE), steelMat, 'needle', 0);
  group.add(needle);
  const tip = new THREE.Vector3(0, 0, -S.needleR * MM);

  // ------------------------------------------------------------------ plunger (stopper, head, X-rod, thumb press)
  const plunger = new THREE.Group();
  plunger.name = 'plunger';
  group.add(plunger);

  const stopper = mesh(new THREE.LatheGeometry(stopperProfile().map(([r, y]) => new THREE.Vector2(r * MM, y * MM)), 48), rubberMat, 'stopper', 0);
  plunger.add(stopper);

  const headR = S.innerR - 0.45;
  const head = mesh(new THREE.CylinderGeometry(headR * MM, headR * MM, 1.2 * MM, 32), plungerMat, 'plunger-head', 0);
  head.position.y = (S.stopperH + 0.2) * MM;
  plunger.add(head);

  const rodBottom = S.stopperH + 0.8;
  const rodTop = S.barrelTop + S.thumbGap - S.stopperBase0;
  const rod = mesh(makeRodGeometry(THREE, rodTop - rodBottom), plungerMat, 'plunger-rod', 0);
  rod.position.y = rodBottom * MM;
  plunger.add(rod);

  const thumbProfile = [
    [0, 0], [S.thumbR - 0.3, 0], [S.thumbR - 0.08, 0.08], [S.thumbR, 0.32], [S.thumbR, 1.22], [S.thumbR - 0.1, 1.48], [S.thumbR - 0.35, S.thumbH],
    [S.thumbR - 0.35, S.thumbH], [S.thumbR - 1.2, S.thumbH - 0.12], [0, S.thumbH - 0.16],
  ].map(([r, y]) => new THREE.Vector2(r * MM, y * MM));
  const thumb = mesh(new THREE.LatheGeometry(thumbProfile, 48), plungerMat, 'thumb-press', 0);
  thumb.position.y = rodTop * MM;
  plunger.add(thumb);

  // ------------------------------------------------------------------ liquid (opaque list, custom blend)
  const liquid = makeLiquid(THREE, liquidMat);
  liquid.mesh.renderOrder = 1;
  group.add(liquid.mesh);

  // ------------------------------------------------------------------ cap
  const cap = mesh(new THREE.LatheGeometry(capProfile().map(([r, y]) => new THREE.Vector2(r * MM, y * MM)), 40), capMat, 'cap', 2);
  cap.visible = false;
  group.add(cap);

  // ------------------------------------------------------------------ state
  let plungerT = 0.5;
  let liquidT = 0.42;

  function apply() {
    const base = S.stopperBase0 + plungerT * S.travel;
    plunger.position.y = base * MM;
    liquid.update(liquidT, base);
  }

  function setPlunger(t) {
    plungerT = clamp01(t);
    if (liquidT > plungerT) liquidT = plungerT; // pushing in expels liquid
    apply();
  }
  function setLiquid(t) {
    liquidT = Math.min(clamp01(t), plungerT);
    apply();
  }
  function setCapOn(on) { cap.visible = !!on; }
  function setGlow(t) { liquidMat.uniforms.uGlow.value = Math.max(0, Number(t) || 0); }

  apply();

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
    tipToHub: S.hubBottom * MM,
    hubTop: S.hubTop * MM,
    barrelBottom: S.nozzleBottom * MM,
    barrelTop: S.barrelTop * MM,
    barrelLength: (S.barrelTop - S.nozzleBottom) * MM,
    outerDiameter: 2 * S.outerR * MM,
    innerDiameter: 2 * S.innerR * MM,
    needleLength: S.needleLen * MM,
    needleDiameter: 2 * S.needleR * MM,
    graduationZero: yZero * MM,
    graduationFull: yFull * MM,
    plungerTravel: S.travel * MM,
    lengthPlungerIn: (S.barrelTop + S.thumbGap + S.thumbH) * MM,
    lengthPlungerOut: (S.barrelTop + S.thumbGap + S.thumbH + S.travel) * MM,
    centerY: (S.barrelTop * 0.6) * MM,
  };

  return {
    group,
    setPlunger,
    setLiquid,
    setCapOn,
    setGlow,
    dispose,
    tip,
    dims,
    parts: { barrel, flange, ticks, hub, needle, plunger, stopper, rod, thumb, liquid: liquid.mesh, cap },
    materials,
    get plunger() { return plungerT; },
    get liquid() { return liquidT; },
  };
}

// ==================================================================== geometry helpers

function clamp01(v) { v = Number(v); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0; }

/** Rubber stopper profile (mm, y = 0 at the cone tip). Two sealing ribs, a groove, a seat for the rod head. */
function stopperProfile() {
  const R = S.innerR - 0.012; // rib radius, a hair inside the bore
  const rc = S.innerR - 0.3;   // where the nose cone ends
  const g = S.innerR - 0.24;   // groove radius
  const t = S.innerR - 0.12;   // upper body radius
  const yc = rc * S.coneSlope;
  const pts = [
    [0, 0], [rc * 0.5, rc * 0.5 * S.coneSlope], [rc, yc],
    [R - 0.07, yc + 0.16], [R, yc + 0.36], [R, yc + 0.96], [R - 0.07, yc + 1.14], [g, yc + 1.28],
    [g, yc + 1.78], [R - 0.07, yc + 1.92], [R, yc + 2.1], [R, yc + 2.66], [R - 0.07, yc + 2.84], [t, yc + 2.98],
    [t, S.stopperH - 0.32], [t - 0.16, S.stopperH], [t - 0.16, S.stopperH], [0, S.stopperH],
  ];
  return pts;
}
function stopperRibBottom() { return (S.innerR - 0.3) * S.coneSlope + 0.36; }

function capProfile() {
  const top = S.capTop, bot = S.capBottom;
  return [
    [0, bot], [0.55, bot + 0.12], [0.88, bot + 0.45], [1.0, bot + 1.1], [1.12, 2.0], [1.92, 14.0], [2.66, 19.7],
    [2.66, 19.7], [2.8, 20.0], [2.8, 20.5], [2.68, 20.8], [2.8, 21.1], [2.8, 21.6], [2.68, 21.9], [2.8, 22.2], [2.8, 22.7],
    [2.74, top - 0.1], [2.64, top], [2.64, top], [2.44, top], [2.44, top], [2.42, top - 0.3], [2.42, 20.6], [1.55, 14.0],
    [0.74, 2.0], [0.56, bot + 1.15], [0.3, bot + 0.6], [0, bot + 0.5],
  ];
}

function makeFlangeGeometry(THREE) {
  const bevel = 0.28;
  const hw = S.flangeW / 2 - bevel, hd = S.flangeD / 2 - bevel, cr = 3.6;
  const s = new THREE.Shape();
  // rounded rectangle (mm), drawn counter-clockwise
  s.moveTo(-hw + cr, -hd);
  s.lineTo(hw - cr, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + cr);
  s.lineTo(hw, hd - cr);
  s.quadraticCurveTo(hw, hd, hw - cr, hd);
  s.lineTo(-hw + cr, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - cr);
  s.lineTo(-hw, -hd + cr);
  s.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);
  const hole = new THREE.Path();
  hole.absarc(0, 0, S.innerR + bevel, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: S.flangeT - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3,
    curveSegments: 18,
  });
  geo.rotateX(-Math.PI / 2); // extrusion (+Z) → +Y; shape Y → -Z
  geo.translate(0, S.barrelTop - S.flangeT + bevel, 0);
  geo.scale(MM, MM, MM);
  geo.computeVertexNormals();
  return geo;
}

function makeRodGeometry(THREE, lengthMm) {
  const bevel = 0.1;
  const a = S.innerR - 0.27 - bevel; // arm half-length
  const w = 0.42 - bevel;             // arm half-thickness
  const s = new THREE.Shape();
  const pts = [[a, -w], [a, w], [w, w], [w, a], [-w, a], [-w, w], [-a, w], [-a, -w], [-w, -w], [-w, -a], [w, -a], [w, -w]];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: lengthMm - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.rotateY(Math.PI / 4); // ribs read as an X from the front
  geo.scale(MM, MM, MM);
  return geo;
}

/** Hollow stainless needle with a lancet bevel. Tip point at y = 0 on the -Z wall; bevel face looks +Z. */
function makeNeedleGeometry(THREE) {
  const seg = 24;
  const rO = S.needleR, rI = S.lumenR;
  const k = 1 / Math.tan(THREE.MathUtils.degToRad(S.bevelDeg));
  const yPlane = (z) => (z + rO) * k;
  const yTop = S.needleLen + S.needleInHub;
  const pos = [], nor = [], col = [];
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  let shade = 1; // the lumen is darker: little light gets into a 0.18 mm bore
  const tri = (a, b, c, na, nb, nc, ref) => {
    const e1 = b.clone().sub(a), e2 = c.clone().sub(a);
    if (e1.cross(e2).dot(ref) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    for (const [p, n] of [[a, na], [b, nb], [c, nc]]) { pos.push(p.x * MM, p.y * MM, p.z * MM); nor.push(n.x, n.y, n.z); col.push(shade, shade, shade); }
  };
  const bevelN = v(0, -1, k).normalize();
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
    const d0 = v(Math.sin(t0), 0, Math.cos(t0)), d1 = v(Math.sin(t1), 0, Math.cos(t1));
    // outer wall
    const ob0 = v(rO * d0.x, yPlane(rO * d0.z), rO * d0.z), ob1 = v(rO * d1.x, yPlane(rO * d1.z), rO * d1.z);
    const ot0 = v(rO * d0.x, yTop, rO * d0.z), ot1 = v(rO * d1.x, yTop, rO * d1.z);
    const refO = d0.clone().add(d1);
    tri(ob0, ob1, ot1, d0, d1, d1, refO);
    tri(ob0, ot1, ot0, d0, d1, d0, refO);
    // lumen wall (normals face the axis)
    const ib0 = v(rI * d0.x, yPlane(rI * d0.z), rI * d0.z), ib1 = v(rI * d1.x, yPlane(rI * d1.z), rI * d1.z);
    const it0 = v(rI * d0.x, yTop, rI * d0.z), it1 = v(rI * d1.x, yTop, rI * d1.z);
    const n0 = d0.clone().negate(), n1 = d1.clone().negate(), refI = refO.clone().negate();
    shade = 0.08;
    tri(ib0, ib1, it1, n0, n1, n1, refI);
    tri(ib0, it1, it0, n0, n1, n0, refI);
    shade = 1;
    // bevel face (annulus on the cut plane)
    tri(ob0, ob1, ib1, bevelN, bevelN, bevelN, bevelN);
    tri(ob0, ib1, ib0, bevelN, bevelN, bevelN, bevelN);
    // top annulus (hidden in the hub, closes the solid)
    const up = v(0, 1, 0);
    tri(ot0, ot1, it1, up, up, up, up);
    tri(ot0, it1, it0, up, up, up, up);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Alpha texture of graduation ticks. No numbers, no units. u = around the barrel, v = along it. */
function makeTickTexture(THREE) {
  const W = 256, H = 2048;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#ffffff';
  const yZero = S.stopperBase0 + stopperRibBottom();
  const pad = 1.2;
  const span = S.travel + pad * 2;
  const vOf = (yMm) => (yMm - (yZero - pad)) / span; // 0 at the bottom of the shell
  const x0 = Math.round(W * 0.16);
  for (let i = 0; i <= S.ticks; i++) {
    const y = yZero + (i / S.ticks) * S.travel;
    const py = (1 - vOf(y)) * H; // CanvasTexture.flipY: v = 0 is the bottom row
    const major = i % S.majorEvery === 0;
    const len = major ? 0.56 : 0.3;
    const th = major ? 6 : 4;
    g.fillRect(x0, py - th / 2, Math.round(W * len), th);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// -------------------------------------------------------------------- liquid

function makeLiquidMaterial(THREE, color) {
  return new THREE.ShaderMaterial({
    name: 'syringe-liquid',
    uniforms: {
      uTint: { value: new THREE.Color(color) },
      uGlow: { value: 0 },
      uDensity: { value: 0.55 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTint;
      uniform float uGlow;
      uniform float uDensity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(vV);
        float ndv = clamp(abs(dot(n, v)), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 4.0);
        float body = uDensity * (0.3 + 0.7 * ndv);
        vec3 col = uTint * (body * 0.1 + fres * 0.8) + uTint * uGlow * (0.15 + 0.85 * ndv * ndv);
        float a = clamp(body * 0.2 + fres * 0.5, 0.0, 0.8);
        if (!gl_FrontFacing) { col *= 0.45; a *= 0.4; }
        gl_FragColor = vec4(col, a);
      }`,
    transparent: false,             // stays in the opaque list so transmissive glass can see it
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: true,
  });
}

/** Liquid column with a meniscus. Profile points flagged `cap` / `top` are moved on update. */
function makeLiquid(THREE, material) {
  const R = S.innerR - 0.02;
  const rc = S.channelR - 0.015;
  const slopeN = new THREE.Vector2(S.coneSlope, -1).normalize();
  const prof = [];
  const add = (r, y, nr, ny, flag = 0) => prof.push({ r, y, nr, ny, flag });
  const yb = S.nozzleBottom + 0.15;
  add(0, yb, 0, -1);
  add(rc, yb, 0, -1);
  add(rc, yb, 1, 0);
  add(rc, S.channelTopY + 0.02, 1, 0);
  add(rc, S.channelTopY + 0.02, slopeN.x, slopeN.y);
  add(R, S.floorEdgeY + 0.02, slopeN.x, slopeN.y);
  add(R, S.floorEdgeY + 0.02, 1, 0);
  add(R, S.floorEdgeY + 1, 1, 0, 1); // wall top (moves with the level)
  const CAP = 12;
  for (let i = 0; i <= CAP; i++) {
    const r = R * (1 - i / CAP);
    add(r, S.floorEdgeY + 1, 0, 1, 2);
  }
  const seg = 48;
  const n = prof.length;
  const count = (seg + 1) * n;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const phi = (i / seg) * Math.PI * 2, s = Math.sin(phi), c = Math.cos(phi);
    for (let j = 0; j < n; j++) {
      const p = prof[j], o = (i * n + j) * 3;
      pos[o] = p.r * s * MM; pos[o + 1] = p.y * MM; pos[o + 2] = p.r * c * MM;
      nor[o] = p.nr * s; nor[o + 1] = p.ny; nor[o + 2] = p.nr * c;
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = j + i * n, b = j + (i + 1) * n, c = b + 1, d = a + 1;
      idx.push(a, b, d, c, d, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  const norAttr = new THREE.BufferAttribute(nor, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  norAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('normal', norAttr);
  geo.setIndex(idx);
  const meshObj = new THREE.Mesh(geo, material);
  meshObj.name = 'liquid';

  const ribLocal = stopperRibBottom();
  const coneEnd = S.innerR - 0.3;
  const depth = 0.75; // meniscus sag at the centre (mm)

  function update(liquidT, stopperBase) {
    const level = S.stopperBase0 + ribLocal + liquidT * S.travel; // wall contact line, read like the ticks
    const ribY = stopperBase + ribLocal;
    const gap = ribY - level;
    meshObj.visible = liquidT > 0.0005;
    // 0 = meniscus (air gap above), 1 = liquid wets the stopper face
    const w = gap > 1.0 ? 0 : gap < 0.25 ? 1 : 1 - (gap - 0.25) / 0.75;
    for (let i = 0; i <= seg; i++) {
      const phi = (i / seg) * Math.PI * 2, s = Math.sin(phi), c = Math.cos(phi);
      for (let j = 0; j < n; j++) {
        const p = prof[j];
        if (!p.flag) continue;
        const o = (i * n + j) * 3;
        let y, nr, ny;
        if (p.flag === 1) {
          y = Math.min(level, ribY - 0.05);
          nr = 1; ny = 0;
        } else {
          const x = p.r / R;
          const yMen = level - depth * (1 - x * x * x);
          const dMen = depth * 3 * x * x / R; // dy/dr
          const yStop = stopperBase - 0.05 + Math.min(p.r, coneEnd) * S.coneSlope + (p.r > coneEnd ? (p.r - coneEnd) * 1.2 : 0);
          const dStop = p.r > coneEnd ? 1.2 : S.coneSlope;
          y = Math.min(yMen * (1 - w) + Math.min(yStop, level) * w, ribY - 0.05);
          const d = dMen * (1 - w) + dStop * w;
          const l = Math.hypot(d, 1);
          nr = -d / l; ny = 1 / l;
        }
        pos[o + 1] = y * MM;
        nor[o] = nr * s; nor[o + 1] = ny; nor[o + 2] = nr * c;
      }
    }
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;
    geo.computeBoundingSphere();
  }
  return { mesh: meshObj, update };
}
