// BodyParts3D -> HRA (Visible Human Male) non-rigid warp.
// BodyParts3D models a different adult male in a different pose (arms hanging) than the HRA reference
// body (arms abducted). We map BP3D geometry into the HRA body with a 3D thin-plate spline fitted to
// corresponding landmarks: vertebrae, pelvis and leg bones, organ centroids, and radial "ring" samples on
// cross-sections of both skins (neck, head, torso, legs, arms).
import * as M from './mesh.mjs';
import { fitTPS } from './register.mjs';
import { ringAt, traceLimb, findSplitHeight, hLoops, handLandmarks } from './rings.mjs';

const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

/** BP3D (mm, Z up, -Y front, +X left) -> HRA axes (m, Y up, +Z front, +X left). */
export const bpAxes = (p) => [p[0] / 1000, p[2] / 1000, -p[1] / 1000];

/** Centroid of the vertices within `slab` metres of the mesh's highest point. */
function topSlab(m, slab) {
  const p = m.positions; let hi = -Infinity; for (let i = 1; i < p.length; i += 3) hi = Math.max(hi, p[i]);
  let n = 0; const c = [0, 0, 0];
  for (let i = 0; i < p.length; i += 3) if (p[i + 1] > hi - slab) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; n++; }
  return n ? c.map((v) => v / n) : null;
}

function endCentroid(m, which, frac = 0.1) {
  // centroid of the vertices in the top (which='top') or bottom fraction of the height range
  const b = M.bounds(m); const p = m.positions; const lo = b.min[1], hi = b.max[1]; const H = hi - lo;
  let n = 0; const c = [0, 0, 0];
  for (let i = 0; i < p.length; i += 3) {
    const y = p[i + 1];
    if ((which === 'top' && y > hi - frac * H) || (which === 'bottom' && y < lo + frac * H)) { c[0] += p[i]; c[1] += y; c[2] += p[i + 2]; n++; }
  }
  return c.map((v) => v / n);
}

/**
 * @param {object} o
 * @param {object} o.hra  openHRA() handle
 * @param {object} o.po   BP3D partof handle
 * @param {object} o.isa  BP3D isa handle
 * @param {object} o.hraSkin  HRA skin (welded, may be simplified)
 * @param {function} o.log
 */
/** Pre-alignment: axis swap + uniform scale + translation (no rotation), from the two skins' bounding boxes. */
export function preAlign(po, hraSkin) {
  const bpSkinRaw = M.mapVertices(po.mesh('skin'), (x, y, z) => bpAxes([x, y, z]));
  const bb = M.bounds(bpSkinRaw), hb = M.bounds(hraSkin);
  const s = hb.size[1] / bb.size[1];
  const pre = (p) => { const q = bpAxes(p); return [(q[0] - bb.center[0]) * s + hb.center[0], (q[1] - bb.min[1]) * s + hb.min[1], (q[2] - bb.center[2]) * s + hb.center[2]]; };
  const preMesh = (m) => M.mapVertices(m, (x, y, z) => pre([x, y, z]));
  return { s, pre, preMesh, bpHeight: bb.size[1], hraHeight: hb.size[1] };
}

/** Thin-plate spline from landmark pairs (+ optional extra pairs), composed with the pre-alignment. */
export function makeWarp(pa, { src, dst }, extra = [], { lambda = 0.002 } = {}) {
  const S = [...src, ...extra.map((e) => e[0])], D = [...dst, ...extra.map((e) => e[1])];
  const tps = fitTPS(S, D, { lambda });
  const apply = (pMM) => tps.apply(pa.pre(pMM));
  return { apply, applyPre: tps.apply, maxResidual: tps.maxResidual, mapMesh: (m) => M.mapVertices(m, (x, y, z) => apply([x, y, z])), count: S.length };
}

/** Landmark pairs (pre-aligned BP3D -> HRA). Slow (skin slicing); the build caches the result. */
/**
 * Options (defaults reproduce the male build exactly):
 *   hip: 'whole' pairs whole hip-bone centroids; 'crest' pairs the top 15 mm of the iliac crests (for a body whose HRA
 *        pelvis is the ilium only, as in the female set).
 *   sternum: also pair the manubrium and sternal body centroids and the jugular notch (top of the manubrium).
 *   maskHRA(p): drop ring samples whose HRA point satisfies the predicate (the female breasts: a male BodyParts3D
 *        chest has no counterpart there, and pairing it would drag the anterior chest wall forward).
 *   armX: |x| beyond which a horizontal skin loop counts as the arm (axilla detection), metres.
 */
export function warpLandmarks({ hra, po, isa, hraSkin, log = () => {}, opts = {} }) {
  const { hip = 'whole', sternum = false, maskHRA = null, armX = 0.17 } = opts;
  const pa = preAlign(po, hraSkin); const { s, pre, preMesh } = pa;
  const bpSkin = M.simplify(M.weld(preMesh(po.mesh('skin')), 1e-6), 120000, { error: 0.003 });
  log(`BP3D pre-scale ${s.toFixed(4)} (BP3D skin height ${pa.bpHeight.toFixed(3)} m -> HRA ${pa.hraHeight.toFixed(3)} m)`);

  const src = [], dst = [], tags = [];
  const pair = (tag, a, b) => { if (a && b && a.every(Number.isFinite) && b.every(Number.isFinite)) { src.push(a); dst.push(b); tags.push(tag); } };
  const bpC = (tree, name) => M.surfaceCentroid(preMesh(tree.mesh(name)));
  const hC = (names) => M.surfaceCentroid(hra.collect(names));

  // 2) Spine and pelvis.
  const vert = [];
  for (let i = 1; i <= 7; i++) vert.push([`VH_M_cervical_vertebra_${i}`, i === 1 ? 'atlas' : i === 2 ? 'axis' : `${ORD[i - 1]} cervical vertebra`]);
  for (let i = 1; i <= 12; i++) vert.push([`VH_M_thoracic_vertebra_${i}`, `${ORD[i - 1]} thoracic vertebra`]);
  for (let i = 1; i <= 5; i++) vert.push([`VH_M_lumbar_vertebra_${i}`, `${ORD[i - 1]} lumbar vertebra`]);
  vert.push(['VH_M_sacrum', 'sacrum']);
  const vc = {};
  for (const [h, b] of vert) { const hc = hC(h), bc = bpC(po, b); vc[h] = { hra: hc, bp: bc }; pair(`spine:${h}`, bc, hc); }
  if (hip === 'whole') {
    pair('hip:L', bpC(po, 'left hip bone'), hC(['VH_M_ilium_compact_bone_L', 'VH_M_ischium_compact_bone_L', 'VH_M_pubis_compact_bone_L']));
    pair('hip:R', bpC(po, 'right hip bone'), hC(['VH_M_ilium_compact_bone_R', 'VH_M_ischium_compact_bone_R', 'VH_M_pubis_compact_bone_R']));
  } else {
    pair('hip:crest:L', topSlab(preMesh(po.mesh('left hip bone')), 0.015), topSlab(hra.collect('VH_M_ilium_compact_bone_L'), 0.015));
    pair('hip:crest:R', topSlab(preMesh(po.mesh('right hip bone')), 0.015), topSlab(hra.collect('VH_M_ilium_compact_bone_R'), 0.015));
  }
  if (sternum) {
    const man = preMesh(po.mesh('manubrium')), body = preMesh(po.mesh('body of sternum'));
    const hMan = hra.collect('VH_M_manubrium'), hBody = hra.collect('VH_M_sternum');
    pair('sternum:manubrium', M.surfaceCentroid(man), M.surfaceCentroid(hMan));
    pair('sternum:body', M.surfaceCentroid(body), M.surfaceCentroid(hBody));
    pair('sternum:notch', topSlab(man, 0.006), topSlab(hMan, 0.006));
  }

  // 3) Leg bones (ends).
  for (const [S, side] of [['L', 'left'], ['R', 'right']]) {
    for (const [hn, bn] of [[`VH_M_femur_${S}`, `${side} femur`], [`VH_M_tibia_${S}`, `${side} tibia`], [`VH_M_fibula_${S}`, `${side} fibula`]]) {
      const hm = hra.collect(hn), bm = preMesh(po.mesh(bn));
      pair(`bone:${hn}:top`, endCentroid(bm, 'top'), endCentroid(hm, 'top'));
      pair(`bone:${hn}:bottom`, endCentroid(bm, 'bottom'), endCentroid(hm, 'bottom'));
    }
    pair(`bone:patella:${S}`, bpC(po, `${side} patella`), hC(`VH_M_patella_${S}`));
  }

  // 4) Organs.
  const organPairs = [
    ['liver', 'VH_M_liver', po, 'liver'], ['heart', 'VH_M_heart', po, 'heart'], ['lungL', 'VH_M_lungs_L', po, 'left lung'], ['lungR', 'VH_M_lungs_R', po, 'right lung'],
    ['kidneyL', 'VH_M_left_kidney', po, 'left kidney'], ['kidneyR', 'VH_M_right_kidney', po, 'right kidney'], ['bladder', 'VH_M_urinary_bladder', po, 'urinary bladder'],
    ['pancreas', 'VH_M_pancreas', po, 'pancreas'], ['spleen', 'VH_M_spleen', isa, 'spleen'], ['brain', 'Allen_brain', po, 'brain'],
    ['eyeL', 'VH_M_eye_L', po, 'left eyeball'], ['eyeR', 'VH_M_eye_R', po, 'right eyeball'], ['trachea', 'VH_M_trachea', po, 'trachea'],
    ['hyoid', 'VH_M_hyoid', po, 'hyoid bone'], ['thyroidCartilage', 'VH_M_thyroid_cartilage', isa, 'thyroid cartilage'],
  ];
  for (const [tag, hn, tree, bn] of organPairs) {
    // HRA kidney node names are swapped relative to geometry in places; pick by side of the centroid.
    let h = hC(hn);
    if (tag === 'kidneyL' && h[0] < 0) h = hC('VH_M_right_kidney');
    if (tag === 'kidneyR' && h[0] > 0) h = hC('VH_M_left_kidney');
    pair(`organ:${tag}`, bpC(tree, bn), h);
  }

  // 5) Skin rings: neck/torso at vertebral levels, head above the eyes, legs, arms.
  let masked = 0;
  const ringPairs = (tag, ra, rb) => { if (!ra || !rb) return; ra.samples.forEach((p, i) => { if (maskHRA && maskHRA(rb.samples[i])) { masked++; return; } pair(`${tag}:${i}`, p, rb.samples[i]); }); };
  const levels = [['C3', 'VH_M_cervical_vertebra_3'], ['C6', 'VH_M_cervical_vertebra_6'], ['T2', 'VH_M_thoracic_vertebra_2'], ['T6', 'VH_M_thoracic_vertebra_6'], ['T10', 'VH_M_thoracic_vertebra_10'], ['L2', 'VH_M_lumbar_vertebra_2'], ['L4', 'VH_M_lumbar_vertebra_4']];
  for (const [lab, h] of levels) {
    const { hra: hc, bp: bc } = vc[h];
    ringPairs(`ring:${lab}`, ringAt(bpSkin, bc[1], bc, 12), ringAt(hraSkin, hc[1], hc, 12));
  }
  const eyeB = M.surfaceCentroid(preMesh(po.mesh('left eyeball', 'right eyeball'))), eyeH = hC('VH_M_eyes');
  for (const dy of [0, 0.05, 0.09]) ringPairs(`ring:head+${dy}`, ringAt(bpSkin, eyeB[1] + dy, [0, 0, eyeB[2] - 0.05], 12), ringAt(hraSkin, eyeH[1] + dy, [0, 0, eyeH[2] - 0.05], 12));
  // top of head
  const top = (m) => { let best = null; for (let i = 0; i < m.positions.length; i += 3) if (!best || m.positions[i + 1] > best[1]) best = [m.positions[i], m.positions[i + 1], m.positions[i + 2]]; return best; };
  pair('head:top', top(bpSkin), top(hraSkin));
  // hips ring at the level of the femoral heads (midpoint of both femur tops)
  {
    const fb = M.lerp(src[tags.indexOf('bone:VH_M_femur_L:top')], src[tags.indexOf('bone:VH_M_femur_R:top')], 0.5);
    const fh = M.lerp(dst[tags.indexOf('bone:VH_M_femur_L:top')], dst[tags.indexOf('bone:VH_M_femur_R:top')], 0.5);
    ringPairs('ring:hips', ringAt(bpSkin, fb[1], [0, 0, fb[2]], 12), ringAt(hraSkin, fh[1], [0, 0, fh[2]], 12));
  }
  // legs: horizontal rings at fractions between the bone landmarks (femur top -> tibia bottom), per side
  for (const S of ['L', 'R']) {
    const sx = S === 'L' ? 1 : -1;
    const aB = src[tags.indexOf(`bone:VH_M_femur_${S}:top`)], aH = dst[tags.indexOf(`bone:VH_M_femur_${S}:top`)];
    const kB = src[tags.indexOf(`bone:VH_M_femur_${S}:bottom`)], kH = dst[tags.indexOf(`bone:VH_M_femur_${S}:bottom`)];
    const zB = src[tags.indexOf(`bone:VH_M_tibia_${S}:bottom`)], zH = dst[tags.indexOf(`bone:VH_M_tibia_${S}:bottom`)];
    for (const [f, A1, A2, B1, B2] of [[0.35, aB, kB, aH, kH], [0.65, aB, kB, aH, kH], [0.92, aB, kB, aH, kH], [0.3, kB, zB, kH, zH], [0.6, kB, zB, kH, zH], [0.9, kB, zB, kH, zH]]) {
      const pb = M.lerp(A1, A2, f), ph = M.lerp(B1, B2, f);
      ringPairs(`ring:leg${S}${f}`, ringAt(bpSkin, pb[1], pb, 8), ringAt(hraSkin, ph[1], ph, 8));
    }
    // foot: toe tip and heel
    const foot = (m) => { let toe = null, heel = null; for (let i = 0; i < m.positions.length; i += 3) { const x = m.positions[i], y = m.positions[i + 1], z = m.positions[i + 2]; if (Math.sign(x) !== sx || y > M.bounds(m).min[1] + 0.06) continue; if (!toe || z > toe[2]) toe = [x, y, z]; if (!heel || z < heel[2]) heel = [x, y, z]; } return { toe, heel }; };
    const fb = foot(bpSkin), fh = foot(hraSkin);
    pair(`foot:toe${S}`, fb.toe, fh.toe); pair(`foot:heel${S}`, fb.heel, fh.heel);
  }
  // arms: axilla -> fingertip, rings perpendicular to the limb
  const armFrac = [0.12, 0.24, 0.36, 0.48, 0.6, 0.7];
  const armInfo = {};
  for (const S of ['L', 'R']) {
    const sx = S === 'L' ? 1 : -1;
    const arm = (skin, which) => {
      const b = M.bounds(skin); const p = skin.positions;
      // fingertip: HRA arms are abducted (extreme |x|); BP3D arms hang (lowest point lateral to the thighs)
      let tip = null;
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i], y = p[i + 1], z = p[i + 2]; if (Math.sign(x) !== sx) continue;
        if (which === 'hra') { if (!tip || Math.abs(x) > Math.abs(tip[0])) tip = [x, y, z]; }
        else if (Math.abs(x) > 0.22 * (b.size[0] / 0.66) && y > b.min[1] + 0.5) { if (!tip || y < tip[1]) tip = [x, y, z]; }
      }
      // axilla: highest horizontal slice with a separate loop on this side, lateral to the torso
      const yTop = b.min[1] + 0.82 * b.size[1];
      const ax = findSplitHeight(skin, yTop, b.min[1] + 0.45 * b.size[1], (c) => sx * c[0] > armX);
      const loops = hLoops(skin, ax - 0.002);
      const armLoop = loops.filter((l) => sx * l.centroid[0] > armX).sort((a, c) => sx * a.centroid[0] - sx * c.centroid[0])[0];
      // axilla point: innermost (most medial) vertex of the separate arm loop, at the loop's mid-depth
      const medial = armLoop.points.reduce((m, q) => (sx * q[0] < sx * m[0] ? q : m), armLoop.points[0]);
      const root = [medial[0], ax + 0.01, armLoop.centroid[2]];
      const tr = traceLimb(skin, root, tip, armFrac, { k: 8 });
      // wrist = narrowest ring in the distal half; hand landmarks (5 fingertips + palm) beyond it
      const wrist = tr.rings.filter((r) => r && r.f >= 0.48).sort((a, c) => a.area - c.area)[0];
      const hand = handLandmarks(skin, wrist.center, wrist.normal);
      return { tip, root, wrist, hand, ...tr };
    };
    const ab = arm(bpSkin, 'bp'), ah = arm(hraSkin, 'hra');
    armInfo[S] = { bp: ab, hra: ah };
    ab.rings.forEach((r, i) => ringPairs(`ring:arm${S}${armFrac[i]}`, r, ah.rings[i]));
    if (ab.hand && ah.hand) {
      const pull = (q, w) => M.lerp(q, w, 0.08);
      ab.hand.tips.forEach((t, i) => pair(`hand:tip${S}${i}`, pull(t, ab.wrist.center), pull(ah.hand.tips[i], ah.wrist.center)));
      pair(`hand:palm${S}`, ab.hand.palm, ah.hand.palm);
      log(`hand ${S}: wrist f=${ah.wrist.f} (HRA) / ${ab.wrist.f} (BP3D); fingertip reach HRA ${ah.hand.tips.map((t) => M.dist(t, ah.wrist.center).toFixed(3)).join(',')} BP3D ${ab.hand.tips.map((t) => M.dist(t, ab.wrist.center).toFixed(3)).join(',')}`);
    } else { log(`hand ${S}: fingertip detection failed; falling back to the extreme fingertip`); pair(`arm:tip${S}`, ab.tip, ah.tip); }
  }

  log(`warp landmarks: ${src.length}${masked ? ` (${masked} ring samples masked)` : ''}`);
  const arms = Object.fromEntries(Object.entries(armInfo).map(([k, v]) => [k, { hra: { tip: v.hra.tip, root: v.hra.root, rings: v.hra.rings.map((r) => r && { f: r.f, center: r.center, normal: r.normal, area: r.area }) } }]));
  return { src, dst, tags, arms };
}
