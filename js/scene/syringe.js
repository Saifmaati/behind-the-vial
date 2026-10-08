// Procedural, physically based 1 mL syringe (intro; reused by the injection sequence).
//
// createSyringe(THREE, { envMap, scale = 1, ... }) →
//   { group, setPlunger(t), setLiquid(t), setCapOn(on), dispose(),          // contract
//     setGlow(t), parts, materials, dims, tip }                             // extras (additive)
//
// Modelled on a standard 1 mL tuberculin-style syringe: clear polypropylene barrel and finger flange,
// white polypropylene X-section plunger rod and thumb press, black two-rib rubber stopper, frosted
// needle hub, 29 G stainless needle with a lancet bevel. Graduations are plain lines in three lengths;
// they carry NO numbers and NO units (a hard product rule).
//
// LOCAL FRAME AND REAL-WORLD SIZE (meters, before `scale`; group.scale = scale):
//   - Barrel, plunger and needle share the local Y axis. The needle points toward -Y.
//   - The needle tip (the sharp point of the bevel) is at y = 0. It sits on the needle wall, 0.165 mm
//     from the axis, at (0, 0, -0.000165): `tip` holds that exact point. For placement on the body treat
//     the origin as the tip; the error is under 0.2 mm.
//   - Everything else extends along +Y: exposed needle 0 – 12.7 mm, needle hub 12.7 – 22.2 mm, barrel
//     (nozzle to rim) 21.6 – 98 mm, finger flange 96.2 – 98 mm, plunger thumb press above the flange
//     (104 – 105.6 mm when fully pushed in, 55.3 mm higher when fully drawn back).
//   - Barrel: outer diameter 6.8 mm, inner diameter 4.8 mm (1 mm wall). Barrel ≈ 7.6 cm, about 8.4 cm
//     with the hub. Overall ≈ 10.6 cm (plunger in) to 16.1 cm (plunger fully drawn back).
//   - Needle: 0.33 mm outer diameter, 12.7 mm exposed, 12° lancet bevel.
//   - Local +Z is the "front": the bevel face and the printed graduations both face +Z.
//   - The finger flange is wide along local X (21 mm) and narrow along local Z (10.5 mm), 1.8 mm thick.
//   - `dims` repeats these numbers (meters, unscaled) for callers that need them.
//
// API SEMANTICS
//   setPlunger(t): 0 = stopper fully pushed in, 1 = drawn back to the top graduation line.
//   setLiquid(t):  liquid volume as a fraction of the graduated capacity (0..1). It can never exceed the
//                  space below the stopper: pushing the plunger past the liquid level expels liquid
//                  (the stored level drops with it); drawing the plunger back leaves an air gap and the
//                  liquid shows a meniscus at the needle end (assumes needle-down, as in an injection).
//   setCapOn(on):  shows or hides the needle cap.
//   setGlow(t):    0..1 faint self-luminance of the liquid (the cinematic intro uses ~0.5).
//   dispose():     removes the group from its parent and frees every geometry, material and texture.
//
// MATERIALS (`materials`, all owned by the syringe; callers may tune them, injection.js does)
//   glass  barrel (MeshPhysicalMaterial, transmission)       hub   needle hub AND finger flange (frosted)
//   cap    needle cap                                          plunger  rod + thumb press (white PP, opaque)
//   stopper rubber                                            needle  stainless steel (vertex-shaded lumen)
//   ticks  printed graduations (procedural, anti-aliased lines; alpha follows `opacity`)
//   liquid custom shader (see below)
//
// RENDERING NOTES (three r185)
//   - Barrel, flange, hub and cap use MeshPhysicalMaterial transmission. three.js only shows OPAQUE-list
//     objects through transmissive ones, so the stopper and rod are opaque, and the liquid is drawn in the
//     opaque list with its own blending (transparent: false + CustomBlending, depthWrite false). Additive
//     "glow" objects behind the syringe should do the same if they need to be seen through the glass.
//   - Pass `envMap` or set `scene.environment` (RoomEnvironment works well). Without an environment the
//     glass has nothing to reflect and looks flat; on a black studio environment add a key light.

const MM = 0.001;

/** Design dimensions in millimetres. Derived values are added below. */
const S = {
  needleR: 0.165, lumenR: 0.092, needleLen: 12.7, needleInHub: 6.5, bevelDeg: 12,
  hubBottom: 12.7, hubTop: 22.2,
  nozzleBottom: 21.6, nozzleR: 1.6, channelR: 0.45,
  shoulderY: 24.0, bodyY: 26.8, barrelTop: 98.0,
  outerR: 3.4, innerR: 2.4,
  floorEdgeY: 27.4, coneSlope: 0.9,
  flangeW: 21.0, flangeD: 10.5, flangeT: 1.8, flangeCorner: 4.2,
  stopperH: 6.2, stopperGap: 0.08, travel: 55.3,
  thumbR: 5.6, thumbH: 1.6, thumbGap: 6.0,
  ticks: 50, midEvery: 5, majorEvery: 10,
  capTop: 23.4, capBottom: -2.4,
};
S.channelTopY = S.floorEdgeY - (S.innerR - S.channelR) * S.coneSlope; // floor cone meets the channel
S.stopperBase0 = S.channelTopY - S.channelR * S.coneSlope + S.stopperGap; // stopper cone tip at t = 0
S.noseR = S.innerR - 0.34;                       // stopper nose cone ends here (matches the barrel floor)
S.ribBottom = S.noseR * S.coneSlope + 0.34;      // first sealing line above the cone tip (reads like the ticks)

/** Printed graduations: 50 lines; every 5th is longer and every 10th longest. Millimetres around the barrel. */
const TICK = {
  start: -1.95,                  // arc position where every line starts (0 = straight ahead, +Z)
  len: [1.45, 2.35, 3.5],        // minor, mid, major
  halfWidth: [0.065, 0.08, 0.1], // printed line half widths
  arcDeg: 110,                   // the printed shell covers this much of the barrel
  pad: 1.2,                      // shell overhang above and below the scale
};

export function createSyringe(THREE, opts = {}) {
  const {
    envMap = null,
    scale = 1,
    envMapIntensity = 1,
    tickColor = 0xd8d0c0,   // warm grey print
    liquidColor = 0xf3ead8, // clear, faintly warm (never a neon tint)
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
    attenuationColor: new THREE.Color(0xf4f1ea),
    attenuationDistance: 0.03 * scale,
    specularIntensity: 1,
    envMapIntensity,
    side: THREE.DoubleSide,
  }));
  // Frosted, moulded polypropylene: needle hub and finger flange. A perfectly clear flange seen edge-on
  // against black only shows its outline, which reads as a stray wire, so it gets the hub's haze.
  const hubMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-frosted',
    color: 0xebe9e6,
    roughness: 0.36,
    specularIntensity: 0.55, // haze scatters the reflection: no hot rim glints on the flange ends
    transmission: 0.5,
    ior: 1.49,
    thickness: 1.8 * MM,
    attenuationColor: new THREE.Color(0xdedad4),
    attenuationDistance: 0.006 * scale,
    clearcoat: 0.15,
    clearcoatRoughness: 0.36,
    envMapIntensity,
  }));
  const capMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-cap',
    color: 0xe9edf1,
    roughness: 0.42,
    transmission: 0.9,
    ior: 1.49,
    thickness: 0.4 * MM,
    attenuationColor: new THREE.Color(0xd0ccc4),
    attenuationDistance: 0.004 * scale,
    envMapIntensity,
  }));
  // White polypropylene: waxy satin surface (a little sheen lifts the silhouette; no glossy clearcoat glare).
  const plungerMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-plunger',
    color: 0xf3f5f6,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.42,
    sheen: 0.25,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xffffff),
    envMapIntensity,
  }));
  // Black rubber with a slight silicone film: the rib crests catch thin highlights through the barrel.
  const rubberMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-stopper',
    color: 0x1d2024,
    roughness: 0.4,
    metalness: 0,
    sheen: 0.5,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0x5d6670),
    clearcoat: 0.45,
    clearcoatRoughness: 0.26,
    envMapIntensity,
  }));
  const steelMat = track(new THREE.MeshPhysicalMaterial({
    name: 'syringe-needle',
    color: 0xe0e4e8,
    metalness: 1,
    roughness: 0.17,
    vertexColors: true,
    envMapIntensity,
    side: THREE.DoubleSide,
  }));
  const yZero = S.stopperBase0 + S.ribBottom;
  const yFull = yZero + S.travel;
  const tickMat = track(makeTickMaterial(THREE, tickColor, envMapIntensity, { yZero, yFull }));
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
  const rimY = S.barrelTop - S.flangeT * 0.5; // the barrel ends inside the flange, which forms the top of the bore
  P(S.outerR, rimY);
  P(S.innerR + 0.1, rimY); P(S.innerR + 0.1, rimY);
  P(S.innerR, rimY - 0.1);
  P(S.innerR, S.floorEdgeY); P(S.innerR, S.floorEdgeY); // inner wall → floor cone, hard edge
  P(S.channelR, S.channelTopY); P(S.channelR, S.channelTopY);
  P(S.channelR, S.nozzleBottom); // closes on the first point
  const barrel = mesh(new THREE.LatheGeometry(barrelProfile, radialSegments), glass, 'barrel', 2);
  group.add(barrel);

  // finger flange: a solid rounded oblong with the bore through it
  const flange = mesh(makeFlangeGeometry(THREE), hubMat, 'flange', 2);
  group.add(flange);

  // printed graduation lines on a hairline shell just outside the barrel, facing +Z
  const tickArc = THREE.MathUtils.degToRad(TICK.arcDeg);
  const tickGeo = new THREE.LatheGeometry(
    [new THREE.Vector2((S.outerR + 0.025) * MM, (yZero - TICK.pad) * MM), new THREE.Vector2((S.outerR + 0.025) * MM, (yFull + TICK.pad) * MM)],
    32, -tickArc / 2, tickArc,
  );
  const ticks = mesh(tickGeo, tickMat, 'ticks', 3);
  group.add(ticks);

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

  const stopper = mesh(new THREE.LatheGeometry(stopperProfile().map(([r, y]) => new THREE.Vector2(r * MM, y * MM)), 56), rubberMat, 'stopper', 0);
  plunger.add(stopper);

  // the rod's head disc sits on the stopper's flat top
  const headR = S.innerR - 0.42;
  const head = mesh(new THREE.CylinderGeometry(headR * MM, headR * MM, 0.9 * MM, 40), plungerMat, 'plunger-head', 0);
  head.position.y = (S.stopperH + 0.45) * MM;
  plunger.add(head);

  const rodBottom = S.stopperH + 0.9;
  const rodTop = S.barrelTop + S.thumbGap - S.stopperBase0;
  const rod = mesh(makeRodGeometry(THREE, rodTop - rodBottom), plungerMat, 'plunger-rod', 0);
  rod.position.y = rodBottom * MM;
  plunger.add(rod);

  const thumbProfile = [
    [0, 0], [S.thumbR - 0.3, 0], [S.thumbR - 0.08, 0.08], [S.thumbR, 0.32], [S.thumbR, 1.22], [S.thumbR - 0.1, 1.48], [S.thumbR - 0.35, S.thumbH],
    [S.thumbR - 0.35, S.thumbH], [S.thumbR - 1.2, S.thumbH - 0.12], [0, S.thumbH - 0.16],
  ].map(([r, y]) => new THREE.Vector2(r * MM, y * MM));
  const thumb = mesh(new THREE.LatheGeometry(thumbProfile, 56), plungerMat, 'thumb-press', 0);
  thumb.position.y = rodTop * MM;
  plunger.add(thumb);

  // ------------------------------------------------------------------ liquid (opaque list, custom blend)
  const liquid = makeLiquid(THREE, liquidMat);
  liquid.mesh.renderOrder = 1;
  track(liquid.mesh.geometry);
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
    flangeWidth: S.flangeW * MM,
    flangeDepth: S.flangeD * MM,
    flangeThickness: S.flangeT * MM,
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
    parts: { barrel, flange, ticks, hub, needle, plunger, stopper, head, rod, thumb, liquid: liquid.mesh, cap },
    materials,
    get plunger() { return plungerT; },
    get liquid() { return liquidT; },
  };
}

// ==================================================================== geometry helpers

function clamp01(v) { v = Number(v); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0; }

/** Rubber stopper profile (mm, y = 0 at the cone tip): nose cone, two rounded sealing ribs, a groove, a flat top. */
function stopperProfile() {
  const R = S.innerR - 0.012; // rib crest, a hair inside the bore
  const rc = S.noseR;         // where the nose cone ends
  const g = S.innerR - 0.36;  // groove between the ribs
  const t = S.innerR - 0.16;  // upper body
  const yc = rc * S.coneSlope;
  const rib = (y0) => [
    [R - 0.13, y0 + 0.1], [R - 0.035, y0 + 0.21], [R, y0 + 0.34], [R, y0 + 0.86], [R - 0.035, y0 + 0.99], [R - 0.13, y0 + 1.1],
  ];
  return [
    [0, 0], [rc * 0.5, rc * 0.5 * S.coneSlope], [rc, yc], [rc, yc],
    ...rib(yc),
    [g, yc + 1.26], [g, yc + 1.84],
    ...rib(yc + 1.9),
    [t, yc + 3.14], [t, S.stopperH - 0.3], [t - 0.18, S.stopperH], [t - 0.18, S.stopperH], [0, S.stopperH],
  ];
}

function capProfile() {
  const top = S.capTop, bot = S.capBottom;
  return [
    [0, bot], [0.55, bot + 0.12], [0.88, bot + 0.45], [1.0, bot + 1.1], [1.12, 2.0], [1.92, 14.0], [2.66, 19.7],
    [2.66, 19.7], [2.8, 20.0], [2.8, 20.5], [2.68, 20.8], [2.8, 21.1], [2.8, 21.6], [2.68, 21.9], [2.8, 22.2], [2.8, 22.7],
    [2.74, top - 0.1], [2.64, top], [2.64, top], [2.44, top], [2.44, top], [2.42, top - 0.3], [2.42, 20.6], [1.55, 14.0],
    [0.74, 2.0], [0.56, bot + 1.15], [0.3, bot + 0.6], [0, bot + 0.5],
  ];
}

/** Solid finger flange: rounded oblong (wide along X), bevelled edges, the bore through the middle. */
function makeFlangeGeometry(THREE) {
  const bevel = 0.32;
  const hw = S.flangeW / 2 - bevel, hd = S.flangeD / 2 - bevel, cr = S.flangeCorner - bevel;
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hd);
  s.lineTo(hw - cr, -hd);
  s.absarc(hw - cr, -hd + cr, cr, -Math.PI / 2, 0, false);
  s.lineTo(hw, hd - cr);
  s.absarc(hw - cr, hd - cr, cr, 0, Math.PI / 2, false);
  s.lineTo(-hw + cr, hd);
  s.absarc(-hw + cr, hd - cr, cr, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hd + cr);
  s.absarc(-hw + cr, -hd + cr, cr, Math.PI, Math.PI * 1.5, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, S.innerR + 0.04 + bevel, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: S.flangeT - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 4, curveSegments: 20,
  });
  geo.rotateX(-Math.PI / 2); // extrusion (+Z) → +Y; shape Y → -Z
  geo.translate(0, S.barrelTop - S.flangeT + bevel, 0);
  geo.scale(MM, MM, MM);
  geo.computeVertexNormals();
  return geo;
}

/** Plunger rod: four-armed X section (ribs at 45° so it reads as an X from the front). */
function makeRodGeometry(THREE, lengthMm) {
  const bevel = 0.12;
  const a = S.innerR - 0.26 - bevel; // arm half-length (nearly touches the bore)
  const w = 0.46 - bevel;             // arm half-thickness
  const s = new THREE.Shape();
  const pts = [[a, -w], [a, w], [w, w], [w, a], [-w, a], [-w, w], [-a, w], [-a, -w], [-w, -w], [-w, -a], [w, -a], [w, -w]];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: lengthMm - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.rotateY(Math.PI / 4);
  geo.scale(MM, MM, MM);
  geo.computeVertexNormals();
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
  let shade = 1;
  const tri = (a, b, c, na, nb, nc, ref) => {
    const e1 = b.clone().sub(a), e2 = c.clone().sub(a);
    if (e1.cross(e2).dot(ref) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    for (const [p, n] of [[a, na], [b, nb], [c, nc]]) { pos.push(p.x * MM, p.y * MM, p.z * MM); nor.push(n.x, n.y, n.z); col.push(shade, shade, shade); }
  };
  const bevelN = v(0, -1, k).normalize();
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
    const d0 = v(Math.sin(t0), 0, Math.cos(t0)), d1 = v(Math.sin(t1), 0, Math.cos(t1));
    // outer wall (drawn a touch darker than the freshly ground bevel)
    shade = 0.9;
    const ob0 = v(rO * d0.x, yPlane(rO * d0.z), rO * d0.z), ob1 = v(rO * d1.x, yPlane(rO * d1.z), rO * d1.z);
    const ot0 = v(rO * d0.x, yTop, rO * d0.z), ot1 = v(rO * d1.x, yTop, rO * d1.z);
    const refO = d0.clone().add(d1);
    tri(ob0, ob1, ot1, d0, d1, d1, refO);
    tri(ob0, ot1, ot0, d0, d1, d0, refO);
    // lumen wall (normals face the axis; little light gets into a 0.18 mm bore)
    const ib0 = v(rI * d0.x, yPlane(rI * d0.z), rI * d0.z), ib1 = v(rI * d1.x, yPlane(rI * d1.z), rI * d1.z);
    const it0 = v(rI * d0.x, yTop, rI * d0.z), it1 = v(rI * d1.x, yTop, rI * d1.z);
    const n0 = d0.clone().negate(), n1 = d1.clone().negate(), refI = refO.clone().negate();
    shade = 0.08;
    tri(ib0, ib1, it1, n0, n1, n1, refI);
    tri(ib0, it1, it0, n0, n1, n0, refI);
    // bevel face (annulus on the cut plane, flat-shaded so it flashes as one facet)
    shade = 1;
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

// -------------------------------------------------------------------- graduations

/**
 * Printed graduation lines, drawn procedurally in the fragment shader with screen-space anti-aliasing
 * (fwidth), so they stay crisp at any size instead of blurring like a texture. Lines are at least ~1 px
 * wide; minor lines fade out first when they crowd closer than ~3 px (no moiré inside the small 3D body).
 * Lines only: no numbers, no units.
 */
function makeTickMaterial(THREE, color, envMapIntensity, { yZero, yFull }) {
  const arcMm = THREE.MathUtils.degToRad(TICK.arcDeg) * (S.outerR + 0.025);
  const uniforms = {
    uTk: { value: new THREE.Vector4(yZero - TICK.pad, yFull + TICK.pad, arcMm, yZero) },
    uTkStep: { value: S.travel / S.ticks },
    uTkCount: { value: S.ticks },
    uTkLen: { value: new THREE.Vector4(TICK.len[0], TICK.len[1], TICK.len[2], TICK.start) },
    uTkHw: { value: new THREE.Vector3(...TICK.halfWidth) },
    uTkEvery: { value: new THREE.Vector2(S.midEvery, S.majorEvery) },
  };
  const mat = new THREE.MeshStandardMaterial({
    name: 'syringe-ticks',
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.16),
    roughness: 0.6,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    envMapIntensity,
  });
  mat.userData.tickUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTickUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvTickUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vTickUv;
uniform vec4 uTk;      // shell y0, shell y1, shell arc (mm), first line y (mm)
uniform float uTkStep; // mm between lines
uniform float uTkCount;
uniform vec4 uTkLen;   // minor, mid, major length, start (mm around the barrel)
uniform vec3 uTkHw;    // half widths (mm)
uniform vec2 uTkEvery; // mid, major period (lines)`)
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
{
  float yMm = mix(uTk.x, uTk.y, vTickUv.y);
  float sMm = (vTickUv.x - 0.5) * uTk.z;
  float f = (yMm - uTk.w) / uTkStep;
  float idx = floor(f + 0.5);
  float dY = abs(f - idx) * uTkStep;
  float fwY = max(fwidth(yMm), 1e-6);
  float fwS = max(fwidth(sMm), 1e-6);
  float inRange = step(-0.5, idx) * step(idx, uTkCount + 0.5);
  float mMaj = mod(idx + 0.25, uTkEvery.y);
  float mMid = mod(idx + 0.25, uTkEvery.x);
  float lvl = mMaj < 0.5 ? 2.0 : (mMid < 0.5 ? 1.0 : 0.0);
  float hw = lvl > 1.5 ? uTkHw.z : (lvl > 0.5 ? uTkHw.y : uTkHw.x);
  float len = lvl > 1.5 ? uTkLen.z : (lvl > 0.5 ? uTkLen.y : uTkLen.x);
  float period = lvl > 1.5 ? uTkEvery.y : (lvl > 0.5 ? uTkEvery.x : 1.0);
  float hwEff = max(hw, 0.55 * fwY);
  float covY = clamp((hwEff - dY) / fwY + 0.5, 0.0, 1.0);
  float covS = clamp((sMm - uTkLen.w) / fwS + 0.5, 0.0, 1.0) * clamp((uTkLen.w + len - sMm) / fwS + 0.5, 0.0, 1.0);
  float crowd = smoothstep(1.6, 3.4, uTkStep * period / fwY);
  diffuseColor.a *= covY * covS * inRange * crowd * 0.94;
  if (diffuseColor.a < 0.004) discard;
}`);
  };
  return mat;
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

/** Liquid column with a meniscus. Profile points flagged `cap` / `top` are moved on update (no allocations). */
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
  const CAP = 14;
  for (let i = 0; i <= CAP; i++) {
    const r = R * (1 - i / CAP);
    add(r, S.floorEdgeY + 1, 0, 1, 2);
  }
  const seg = 48;
  const n = prof.length;
  const count = (seg + 1) * n;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const sinT = new Float32Array(seg + 1);
  const cosT = new Float32Array(seg + 1);
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const phi = (i / seg) * Math.PI * 2;
    sinT[i] = Math.sin(phi); cosT[i] = Math.cos(phi);
    for (let j = 0; j < n; j++) {
      const p = prof[j], o = (i * n + j) * 3;
      pos[o] = p.r * sinT[i] * MM; pos[o + 1] = p.y * MM; pos[o + 2] = p.r * cosT[i] * MM;
      nor[o] = p.nr * sinT[i]; nor[o + 1] = p.ny; nor[o + 2] = p.nr * cosT[i];
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
  // generous fixed bounds (the whole bore), so updates never need computeBoundingSphere
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, ((S.nozzleBottom + S.barrelTop) / 2) * MM, 0), ((S.barrelTop - S.nozzleBottom) / 2 + S.innerR) * MM);
  const meshObj = new THREE.Mesh(geo, material);
  meshObj.name = 'liquid';

  const ribLocal = S.ribBottom;
  const coneEnd = S.noseR;
  const depth = 0.75; // meniscus sag at the centre (mm)

  function update(liquidT, stopperBase) {
    const level = S.stopperBase0 + ribLocal + liquidT * S.travel; // wall contact line, read like the ticks
    const ribY = stopperBase + ribLocal;
    const gap = ribY - level;
    meshObj.visible = liquidT > 0.0005;
    // 0 = meniscus (air gap above), 1 = liquid wets the stopper face
    const w = gap > 1.0 ? 0 : gap < 0.25 ? 1 : 1 - (gap - 0.25) / 0.75;
    for (let j = 0; j < n; j++) {
      const p = prof[j];
      if (!p.flag) continue;
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
      for (let i = 0; i <= seg; i++) {
        const o = (i * n + j) * 3;
        pos[o + 1] = y * MM;
        nor[o] = nr * sinT[i]; nor[o + 1] = ny; nor[o + 2] = nr * cosT[i];
      }
    }
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;
  }
  return { mesh: meshObj, update };
}
