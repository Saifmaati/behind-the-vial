// landmarks.json builder: organ centres/radii, injection sites (ray cast on the final skin), anchor points,
// and blood-flow paths that follow the actual vessel meshes (venous return to the right atrium, pulmonary loop,
// and arterial routes from the aortic root to each target organ).
import * as M from './mesh.mjs';
import { slice, loopStats, rayHits, inside } from './slice.mjs';
import { findSplitHeight, hLoops, traceLimb } from './rings.mjs';
import { pointIndex, followVessel, resample, smoothPath, concat, nearestVertex, pathLength } from './paths.mjs';

const { sub, add, scale, dot, cross, norm, dist, lerp } = M;

export const endOf = (m, dir, tol = 0.003) => {
  const d = norm(dir); const p = m.positions; let mx = -Infinity;
  for (let i = 0; i < p.length; i += 3) mx = Math.max(mx, p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2]);
  let n = 0; const c = [0, 0, 0];
  for (let i = 0; i < p.length; i += 3) if (p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2] > mx - tol) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; n++; }
  return c.map((v) => v / n);
};

/** Area-weighted average normal of the skin triangles within r of p. */
function surfaceNormal(skin, p, r = 0.015) {
  const P = skin.positions, I = skin.indices; const n = [0, 0, 0];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    if ((cx - p[0]) ** 2 + (cy - p[1]) ** 2 + (cz - p[2]) ** 2 > r * r) continue;
    const f = cross([P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]);
    n[0] += f[0]; n[1] += f[1]; n[2] += f[2];
  }
  return norm(n);
}

/** First skin hit from an interior point along direction d. */
function castOut(skin, from, d) {
  const hits = rayHits(skin, from, norm(d));
  if (!hits.length) throw new Error(`ray from ${from} did not hit the skin`);
  return add(from, scale(norm(d), hits[0]));
}

export function buildLandmarks({ final, vesselParts, organsHRA, toWorld, fromWorld, log = () => {}, warn = () => {} }) {
  const skin = final.skin;
  const P = (n) => { const m = vesselParts.get(n); if (!m) throw new Error(`landmarks: missing mesh ${n}`); return m; };
  const C = (n) => M.surfaceCentroid(P(n));
  const E = (n, dir, tol) => endOf(P(n), dir, tol);
  const idxCache = new Map();
  const IDX = (names) => { const key = [].concat(names).join('|'); if (!idxCache.has(key)) idxCache.set(key, pointIndex(M.merge([].concat(names).map(P)), 0.01)); return idxCache.get(key); };
  const follow = (names, a, b, radius = 0.008, step = 0.005) => followVessel(IDX(names), a, b, { radius, step });

  // ---------------- organs (world frame) ----------------
  const organs = {};
  const sphere = (m) => { const c = M.volumeCentroid(m).centroid; let r = 0; for (let i = 0; i < m.positions.length; i += 3) r = Math.max(r, dist(c, [m.positions[i], m.positions[i + 1], m.positions[i + 2]])); return { center: c, radius: r }; };
  for (const id of ['brain', 'thyroid', 'heart', 'lungs', 'liver', 'gallbladder', 'stomach', 'pancreas', 'spleen', 'small_intestine', 'large_intestine', 'kidneys', 'bladder']) {
    organs[id] = sphere(final[id]);
    if (id === 'lungs' || id === 'kidneys') {
      const comps = M.components(final[id]).slice(0, 2).map((c) => sphere(M.subsetTriangles(final[id], c)));
      const [l, r] = comps[0].center[0] > comps[1].center[0] ? comps : [comps[1], comps[0]];
      organs[id].parts = { left: l, right: r };
    }
  }

  // ---------------- injection sites (world frame, on the rendered skin) ----------------
  const W = toWorld; const H = fromWorld;
  // Navel: the umbilical dimple on the full-resolution skin (anterior abdominal patch), searched between ~4 cm
  // below the L5 and the L2 vertebral levels: depth = mean of the 4 neighbours (±1.5 cm) minus the midline height.
  const abd = vesselParts.get('skin_hi_abdomen'); // HRA frame, full resolution, anterior abdomen only
  const zF = (x, y) => { const h = rayHits(abd, [x, y, 0], [0, 0, 1]); return h.length ? h[h.length - 1] : NaN; };
  const yL2h = C('VH_M_lumbar_vertebra_2')[1], yL5h = C('VH_M_lumbar_vertebra_5')[1];
  let best = null;
  for (let y = yL5h - 0.04; y <= yL2h; y += 0.002) {
    const z0 = zF(0, y); const nb = [zF(-0.015, y), zF(0.015, y), zF(0, y - 0.015), zF(0, y + 0.015)];
    const depth = nb.reduce((a, b) => a + b, 0) / 4 - z0;
    if (Number.isFinite(depth) && (!best || depth > best.depth)) best = { y, depth };
  }
  let navelH = null;
  for (let x = -0.012; x <= 0.01201; x += 0.002) { const z = zF(x, best.y); if (!navelH || z < navelH[2]) navelH = [x, best.y, z]; }
  const navel = W(navelH);
  log(`navel dimple depth ${(best.depth * 1000).toFixed(1)} mm at ${navel.map((v) => v.toFixed(3))} (${(navel[1] / 1.75 * 100).toFixed(1)}% of stature)`);
  const site = (pt, label) => ({ point: pt, normal: surfaceNormal(skin, pt), label });
  const sites = {};
  const abdPt = castOut(skin, [navel[0] + 0.05, navel[1] - 0.015, navel[2] - 0.12], [0, 0, 1]);
  sites.abdomen = site(abdPt, 'Abdomen');
  // thigh: front of the left thigh, halfway between the hip joint and the knee
  const femTop = W(E('VH_M_femur_L', [0, 1, 0])), femBot = W(E('VH_M_femur_L', [0, -1, 0]));
  const yMid = (femTop[1] + femBot[1]) / 2;
  const thighLoop = slice(skin, [0, yMid, 0], [0, 1, 0]).filter((l) => l.closed).map((l) => ({ ...l, ...loopStats(l.points, [0, 1, 0]) })).filter((l) => l.centroid[0] > 0.02).sort((a, b) => b.area - a.area)[0];
  const thighC = thighLoop.centroid;
  const thighPt = castOut(skin, thighC, [0, 0, 1]);
  sites.thigh = site(thighPt, 'Thigh');
  // arm: back/outer side of the left upper arm, about halfway between shoulder and elbow. The HRA body has no arm
  // bones, so the upper arm is traced on the skin: axilla (first height where the arm separates from the torso) ->
  // fingertip, cross-section centroids along the limb; the site ring sits 13% of the way along that line
  // (~7 cm past the axillary fold), then a ray is cast toward the back/outer (posterolateral) surface.
  const sp = skin.positions; let tip = null;
  for (let i = 0; i < sp.length; i += 3) if (!tip || sp[i] > tip[0]) tip = [sp[i], sp[i + 1], sp[i + 2]];
  const axY = findSplitHeight(skin, 1.45, 0.95, (c) => c[0] > 0.16, 0.003);
  const armLoop0 = hLoops(skin, axY - 0.002).filter((l) => l.centroid[0] > 0.16).sort((a, b) => a.centroid[0] - b.centroid[0])[0];
  const medial = armLoop0.points.reduce((m, q) => (q[0] < m[0] ? q : m), armLoop0.points[0]);
  const armRoot = [medial[0], axY + 0.01, armLoop0.centroid[2]];
  const trace = traceLimb(skin, armRoot, tip, [0.13], { k: 8 });
  const ring = trace.rings[0];
  const armAxis = ring.normal;
  const lateral = norm(sub([1, 0, 0], scale(armAxis, armAxis[0])));
  const armDir = norm(add(lateral, [0, 0, -1]));
  const armPt = castOut(skin, ring.center, armDir);
  sites.arm = site(armPt, 'Upper arm');
  log(`navel ${navel.map((v) => v.toFixed(3))}; abdomen site ${abdPt.map((v) => v.toFixed(3))} (${((abdPt[0] - navel[0]) * 100).toFixed(1)} cm left, ${((navel[1] - abdPt[1]) * 100).toFixed(1)} cm below navel)`);
  log(`thigh site ${thighPt.map((v) => v.toFixed(3))} at mid-femur height ${yMid.toFixed(3)}; arm site ${armPt.map((v) => v.toFixed(3))} (axilla y ${axY.toFixed(3)}, ring centre ${ring.center.map((v) => v.toFixed(3))})`);

  // ---------------- anchors ----------------
  const inward = (s, d) => sub(s.point, scale(s.normal, d));
  // skin anchor: the left cheek (flushing / rash are most visible on the face)
  const eyesC = W(C('VH_M_eyes'));
  const faceSkin = castOut(skin, [eyesC[0] + 0.035, eyesC[1] - 0.035, eyesC[2] - 0.08], [0.15, 0, 1]);
  const faceNormal = surfaceNormal(skin, faceSkin, 0.012);
  const fat = W(M.surfaceCentroid(P('VH_M_subcutaneous_abdominal_adipose_tissue')));
  const fatB = M.bounds(M.mapVertices(P('VH_M_subcutaneous_abdominal_adipose_tissue'), (x, y, z) => W([x, y, z])));
  const muscle = lerp(thighC, thighPt, 0.45);
  const descB = P('VH_M_descending_aorta_b'); const blood = W(M.surfaceCentroid(descB));
  const extra = {
    fat: { center: fat, radius: Math.max(...fatB.size) / 2 },
    injection_site: { center: inward(sites.abdomen, 0.006), radius: 0.03 },
    muscle: { center: muscle, radius: 0.06 },
    eyes: { center: W(C('VH_M_eyes')), radius: 0.05 },
    blood: { center: blood, radius: 0.05 },
    skin: { center: faceSkin, radius: 0.05, normal: faceNormal },
  };
  for (const [k2, v] of Object.entries(extra)) organs[k2] = { ...v, anchor: true };

  // ---------------- flow paths (built in the HRA frame on the vessel meshes) ----------------
  const RA = C('VH_M_right_cardiac_atrium'), RV = C('VH_M_heart_right_ventricle'), LA = C('VH_M_left_cardiac_atrium'), LV = C('VH_M_heart_left_ventricle');
  const AV = C('VH_M_aortic_valve'), PV = C('VH_M_pulmonary_valve'), TV = C('VH_M_tricuspid_valve'), MV = C('VH_M_mitral_valve');
  const AORTA = ['VH_M_ascending_aorta', 'VH_M_aortic_arch', 'VH_M_descending_aorta_a', 'VH_M_descending_aorta_b'];
  const descNames = ['VH_M_descending_aorta_a', 'VH_M_descending_aorta_b'];
  const descMesh = M.merge(descNames.map(P));
  const aortaAt = (y) => { const p = descMesh.positions; let n = 0; const c = [0, 0, 0]; for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 1] - y) < 0.004) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; n++; } return c.map((v) => v / n); };
  const ascTop = E('VH_M_ascending_aorta', [0, 1, 0.2]);
  const archApex = E('VH_M_aortic_arch', [0, 1, 0]);
  const descTop = E('VH_M_descending_aorta_a', [0, 1, -0.3]);
  const aortaRoot = () => concat([AV], follow(AORTA, AV, ascTop, 0.02, 0.006));
  const toArchApex = () => concat(aortaRoot(), follow(AORTA, ascTop, archApex, 0.02, 0.006));
  const downAorta = (y) => concat(toArchApex(), follow(AORTA, archApex, descTop, 0.02, 0.006), follow(descNames, descTop, aortaAt(y), 0.018, 0.008));
  const toBranch = (originPt) => concat(downAorta(originPt[1]), [originPt]);

  const paths = {};
  // Venous return -------------------------------------------------------------
  const sevName = 'left superficial epigastric vein', gsvName = 'left great saphenous vein', fvName = 'left femoral vein';
  const sfj = E(gsvName, [0, 1, 0]);
  const eivBottom = E('VH_M_external_iliac_vein_L', [0.3, -1, 0.5]), eivTop = E('VH_M_external_iliac_vein_L', [-0.3, 1, -0.5]);
  const civBottom = E('VH_M_common_iliac_vein_L', [0.3, -1, 0]), civTop = E('VH_M_common_iliac_vein_L', [-0.5, 1, 0]);
  const ivcBottom = E('VH_M_inferior_vena_cava_b', [0, -1, 0]), ivcTop = E('VH_M_inferior_vena_cava_a', [0, 1, 0]);
  const IVC = ['VH_M_inferior_vena_cava_a', 'VH_M_inferior_vena_cava_b'];
  const legToHeart = () => concat(
    follow([gsvName, fvName], sfj, E(fvName, [0, 1, 0]), 0.008),
    [eivBottom], follow('VH_M_external_iliac_vein_L', eivBottom, eivTop, 0.01),
    follow('VH_M_common_iliac_vein_L', civBottom, civTop, 0.012),
    [ivcBottom], follow(IVC, ivcBottom, ivcTop, 0.02, 0.008), [RA],
  );
  const abdIn = H(inward(sites.abdomen, 0.006));
  const sevNear = nearestVertex(P(sevName), abdIn);
  paths.abdomen_to_heart = concat([abdIn], [sevNear], follow(sevName, sevNear, E(sevName, [0, -1, 0]), 0.006), [sfj], legToHeart());
  const thighIn = H(inward(sites.thigh, 0.008));
  const gsvNear = nearestVertex(P(gsvName), thighIn);
  paths.thigh_to_heart = concat([thighIn], [lerp(thighIn, gsvNear, 0.5)], follow(gsvName, gsvNear, sfj, 0.007), legToHeart());
  const armIn = H(inward(sites.arm, 0.008));
  const cephName = 'left cephalic vein', axName = 'left axillary vein', scName = 'left subclavian vein';
  const cephNear = nearestVertex(P(cephName), armIn);
  const cephTop = E(cephName, [-1, 0.7, 0.2]);
  const axTop = E(axName, [-1, 0.6, 0]), scMed = E(scName, [-1, -0.2, 0]);
  const bcvLat = E('VH_M_brachiocephalic_vein_L', [1, 0.4, 0]), bcvMed = E('VH_M_brachiocephalic_vein_L', [-1, -0.3, 0]);
  const svcTop = E('VH_M_superior_vena_cava', [0, 1, 0]), svcBot = E('VH_M_superior_vena_cava', [0, -1, 0]);
  paths.arm_to_heart = concat([armIn], [cephNear], follow(cephName, cephNear, cephTop, 0.007),
    [nearestVertex(P(axName), cephTop)], follow([axName, scName], nearestVertex(P(axName), cephTop), scMed, 0.009),
    [bcvLat], follow('VH_M_brachiocephalic_vein_L', bcvLat, bcvMed, 0.012), [svcTop], follow('VH_M_superior_vena_cava', svcTop, svcBot, 0.014), [RA]);

  // Pulmonary loop --------------------------------------------------------------
  const lungL = M.surfaceCentroid(P('VH_M_lungs_L')); const hilumL = C('VH_M_hilum_L');
  const ptTop = E('VH_M_pulmonary_trunk', [0.2, 1, -0.3]); const lpaEnd = E('VH_M_pulmonary_artery_L', [1, 0, -0.2]);
  paths.heart_to_lungs = concat([RA, TV, RV, PV], follow(['VH_M_pulmonary_trunk', 'VH_M_pulmonary_artery_L'], PV, ptTop, 0.012), follow(['VH_M_pulmonary_trunk', 'VH_M_pulmonary_artery_L'], ptTop, lpaEnd, 0.012), [hilumL, lerp(hilumL, lungL, 0.6), lungL]);
  const lspvLat = E('VH_M_pulmonary_vein_L_sup', [1, 0.3, 0]), lspvMed = E('VH_M_pulmonary_vein_L_sup', [-1, -0.3, 0]);
  paths.lungs_to_heart = concat([lungL, lerp(lungL, hilumL, 0.5), hilumL, lspvLat], follow('VH_M_pulmonary_vein_L_sup', lspvLat, lspvMed, 0.008), [LA, MV, LV, AV]);

  // Arterial routes from the aortic root ---------------------------------------
  const brainC = M.volumeCentroid(organsHRA.brain).centroid;
  const lccaO = E('left common carotid artery', [0, -1, 0]), lccaTop = E('left common carotid artery', [0, 1, 0]);
  const icaBot = E('left internal carotid artery', [0, -1, 0]), icaTop = E('left internal carotid artery', [0, 1, 0]);
  const toLCCA = () => concat(aortaRoot(), follow(AORTA, ascTop, lccaO, 0.02, 0.006), [lccaO], follow('left common carotid artery', lccaO, lccaTop, 0.008));
  paths.to_brain = concat(toLCCA(), [icaBot], follow('left internal carotid artery', icaBot, icaTop, 0.006), [add(icaTop, [0.02, 0.008, 0.0]), add(brainC, [0.045, -0.005, 0.005])]);
  const lsaO = E('left subclavian artery', [0, -1, 0]);
  const tctBot = E('left thyrocervical trunk', [0, -1, 0]), tctTop = E('left thyrocervical trunk', [0, 1, 0]);
  const itaMed = E('left inferior thyroid artery', [-1, 0, 0.6]);
  const thyM = organsHRA.thyroid; const thyL = (() => { const p = thyM.positions; let n = 0; const c = [0, 0, 0]; for (let i = 0; i < p.length; i += 3) if (p[i] > 0.008) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; n++; } return c.map((v) => v / n); })();
  paths.to_thyroid = concat(aortaRoot(), follow(AORTA, ascTop, lsaO, 0.02, 0.006), [lsaO], follow('left subclavian artery', lsaO, nearestVertex(P('left subclavian artery'), tctBot), 0.007),
    [tctBot], follow('left thyrocervical trunk', tctBot, tctTop, 0.005), [nearestVertex(P('left inferior thyroid artery'), tctTop)], follow('left inferior thyroid artery', nearestVertex(P('left inferior thyroid artery'), tctTop), itaMed, 0.005), [thyL]);
  // celiac family
  const celO = E('VH_M_celiac_trunk', [0, 0.3, -1]), celTip = E('VH_M_celiac_trunk', [0, -0.2, 1]);
  const toCeliac = () => concat(toBranch(celO), follow('VH_M_celiac_trunk', celO, celTip, 0.005));
  const chaA = E('VH_M_common_hepatic_artery', [1, 0, 0]), chaB = E('VH_M_common_hepatic_artery', [-1, 0, 0]);
  const phaB = E('VH_M_proper_hepatic_artery', [-1, 0.5, 0]);
  const rhaB = E('VH_M_right_hepatic_artery', [-1, 0, 0]);
  const liverC = M.volumeCentroid(organsHRA.liver).centroid;
  const toPHA = () => concat(toCeliac(), [chaA], follow('VH_M_common_hepatic_artery', chaA, chaB, 0.005), follow('VH_M_proper_hepatic_artery', chaB, phaB, 0.005));
  paths.to_liver = concat(toPHA(), follow('VH_M_right_hepatic_artery', phaB, rhaB, 0.005), [lerp(rhaB, liverC, 0.5), liverC]);
  const cysA = E('VH_M_cystic_artery', [1, 0, -0.5]), cysB = E('VH_M_cystic_artery', [-0.3, 0, 1]);
  const gbC = M.volumeCentroid(organsHRA.gallbladder).centroid;
  paths.to_gallbladder = concat(toPHA(), [nearestVertex(P('VH_M_right_hepatic_artery'), cysA), cysA], follow('VH_M_cystic_artery', cysA, cysB, 0.004), [gbC]);
  const splA = E('VH_M_splenic_artery', [-1, 0, 0.3]), splB = E('VH_M_splenic_artery', [1, 0.2, -0.3]);
  const spleenC = M.volumeCentroid(organsHRA.spleen).centroid;
  paths.to_spleen = concat(toCeliac(), [splA], follow('VH_M_splenic_artery', splA, splB, 0.006), [spleenC]);
  const pancC = M.volumeCentroid(organsHRA.pancreas).centroid;
  const splMid = nearestVertex(P('VH_M_splenic_artery'), pancC);
  paths.to_pancreas = concat(toCeliac(), [splA], follow('VH_M_splenic_artery', splA, splMid, 0.006), [pancC]);
  const stomC = M.volumeCentroid(organsHRA.stomach).centroid;
  const lesser = nearestVertex(organsHRA.stomach, celTip);
  paths.to_stomach = concat(toCeliac(), [lerp(celTip, lesser, 0.5), lerp(lesser, stomC, 0.15), stomC]);
  // renal (geometric left side)
  const renName = M.surfaceCentroid(P('VH_M_right_renal_artery'))[0] > 0 ? 'VH_M_right_renal_artery' : 'VH_M_left_renal_artery';
  const renO = E(renName, [-1, 0, 0]), renB = E(renName, [1, 0, 0]);
  const kidLC = M.volumeCentroid(M.subsetTriangles(organsHRA.kidneys, M.components(organsHRA.kidneys).sort((a, b) => M.surfaceCentroid(M.subsetTriangles(organsHRA.kidneys, b))[0] - M.surfaceCentroid(M.subsetTriangles(organsHRA.kidneys, a))[0])[0])).centroid;
  paths.to_kidneys = concat(toBranch(renO), follow(renName, renO, renB, 0.006), [kidLC]);
  // mesenteric
  const smaO = E('VH_M_superior_mesenteric_artery', [0, 1, -1]), smaB = E('VH_M_superior_mesenteric_artery', [0, -1, 1]);
  const siC = M.volumeCentroid(organsHRA.small_intestine).centroid;
  paths.to_small_intestine = concat(toBranch(smaO), follow('VH_M_superior_mesenteric_artery', smaO, smaB, 0.006), [lerp(smaB, siC, 0.5), siC]);
  const imaO = E('VH_M_inferior_mesenteric_artery', [0, 1, -0.5]), imaB = E('VH_M_inferior_mesenteric_artery', [0, -1, 0.5]);
  const lcaA = nearestVertex(P('VH_M_left_colic_artery'), imaB), lcaB = E('VH_M_left_colic_artery', [1, 0.3, 0]);
  const colonPt = nearestVertex(organsHRA.large_intestine, lcaB);
  const liC = M.volumeCentroid(organsHRA.large_intestine).centroid;
  paths.to_large_intestine = concat(toBranch(imaO), follow('VH_M_inferior_mesenteric_artery', imaO, imaB, 0.005), [lcaA], follow('VH_M_left_colic_artery', lcaA, lcaB, 0.005), [lerp(colonPt, liC, 0.04)]);
  // coronary
  const lcaO = E('VH_M_left_coronary_artery', [-1, 0, 0]), ladTop = E('VH_M_left_anterior_descending_artery', [0, 1, 0]), ladBot = E('VH_M_left_anterior_descending_artery', [0.3, -1, 0.5]);
  paths.to_heart_muscle = concat([AV, lerp(AV, lcaO, 0.5), lcaO], follow('VH_M_left_coronary_artery', lcaO, ladTop, 0.005), follow('VH_M_left_anterior_descending_artery', ladTop, ladBot, 0.005), [lerp(ladBot, LV, 0.3)]);
  // iliac -> femoral family (fat, muscle)
  const bif = E('VH_M_descending_aorta_b', [0, -1, 0]);
  const ciaB = E('left common iliac artery', [0.3, -1, 0.3]), eiaB = E('left external iliac artery', [0.2, -1, 0.6]);
  const FA = 'left femoral artery';
  const toEIA = () => concat(downAorta(bif[1] + 0.004), [bif], follow('left common iliac artery', bif, ciaB, 0.008), follow('left external iliac artery', ciaB, eiaB, 0.008));
  // to_fat: superficial epigastric artery (from the femoral artery just below the inguinal ligament, up over the lower abdomen)
  const fatTarget = H(inward(sites.abdomen, 0.008));
  const seaBot = E('left superficial epigastric artery', [0, -1, 0]); const seaNear = nearestVertex(P('left superficial epigastric artery'), fatTarget);
  paths.to_fat = concat(toEIA(), [seaBot], follow('left superficial epigastric artery', seaBot, seaNear, 0.005), [fatTarget]);
  // to_muscle: femoral artery down the front of the thigh to mid-thigh, then a muscular branch into the quadriceps.
  // (BodyParts3D's deep femoral artery is incomplete in the mid-thigh, so the path stays on the femoral artery.)
  const faM = P(FA); const muscleH = H(muscle);
  const faAt = (() => { const p = faM.positions; let n = 0; const c = [0, 0, 0]; for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 1] - muscleH[1]) < 0.01) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; n++; } return n ? c.map((v) => v / n) : nearestVertex(faM, muscleH); })();
  const faStart = nearestVertex(faM, eiaB);
  paths.to_muscle = concat(toEIA(), [faStart], follow(FA, faStart, faAt, 0.007), [lerp(faAt, muscleH, 0.5), muscleH]);
  // skin of the face (flushing, rash): carotid bifurcation -> external carotid course -> cheek
  const faceIn = H(sub(faceSkin, scale(faceNormal, 0.006)));
  paths.to_skin = concat(toLCCA(), [add(lccaTop, [0.006, 0.02, 0.012]), lerp(add(lccaTop, [0.006, 0.02, 0.012]), faceIn, 0.5), faceIn]);

  // ---------------- tidy, convert to world, check ----------------
  const out = {};
  for (const [key, pts] of Object.entries(paths)) {
    let w = pts.map(W);
    w = smoothPath(resample(w, 0.006), 3, 0.4);
    w = resample(w, 0.018);
    out[key] = w;
  }
  // fix exact endpoints after smoothing
  const raW = W(RA), avW = W(AV);
  for (const k2 of ['abdomen_to_heart', 'thigh_to_heart', 'arm_to_heart']) out[k2][out[k2].length - 1] = raW;
  for (const k2 of Object.keys(out).filter((x) => x.startsWith('to_'))) out[k2][0] = avW;
  const outside = [];
  let checked = 0;
  for (const [k2, pts] of Object.entries(out)) pts.forEach((p, i) => { checked++; if (!inside(skin, p)) outside.push(`${k2}[${i}]`); });
  const lengths = Object.fromEntries(Object.entries(out).map(([k2, p]) => [k2, +pathLength(p).toFixed(3)]));
  log(`paths: ${Object.keys(out).length}; waypoints checked ${checked}; outside skin: ${outside.length}`);
  for (const [k2, p] of Object.entries(out)) log(`  ${k2.padEnd(20)} ${String(p.length).padStart(3)} pts  ${lengths[k2].toFixed(2)} m`);
  if (outside.length) warn(`waypoints outside skin: ${outside.join(', ')}`);
  const sitesInside = Object.fromEntries(Object.entries(sites).map(([k2, s]) => [k2, inside(skin, sub(s.point, scale(s.normal, 0.004))) && !inside(skin, add(s.point, scale(s.normal, 0.004)))]));
  return {
    units: 'm', height: 1.75,
    organs,
    sites,
    paths: out,
    anchors: { navel: navel, aortic_root: avW, right_atrium: raW, right_ventricle: W(RV), left_atrium: W(LA), left_ventricle: W(LV), pulmonary_valve: W(PV) },
    checks: { waypoints: checked, outside, sitesOnSurface: sitesInside, pathLengths_m: lengths },
  };
}
