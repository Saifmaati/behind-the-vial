#!/usr/bin/env node
// PeptideScope: anatomy asset pipeline (dev-only, Node 20).
//
//   cd tools && npm install          # dev dependencies only
//   node tools/build-anatomy.mjs     # downloads sources (first run), builds assets/anatomy/{body.glb,landmarks.json}
//
// Flags: --offline (never download), --fresh (recompute cached warp landmarks), --no-skeleton
//
// Sources (all CC BY 4.0; see assets/anatomy/LICENSE.md):
//   * HRA 3D Reference Organ Set, United Male v1.9 (NIH HuBMAP; Visible Human Male): skin, organs, torso vessels, spine/pelvis/leg bones
//   * VOXEL-MAN Segmented Internal Organs of the Visible Human Male (Höhne et al. 2025): stomach, thyroid, rib cage, shoulder girdle
//   * BodyParts3D 4.0 (DBCLS): limb, neck and head vessels; skull, arm, hand and foot bones (non-rigidly warped into the HRA body)
//
// Output frame (docs/ARCHITECTURE.md "3D world contract"): metres, +Y up, feet at y=0, facing +Z, centred on x=0,z=0,
// height 1.75 m, the person's left = +X.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from './anatomy/mesh.mjs';
import * as V from './anatomy/voxel.mjs';
import { openHRA } from './anatomy/hra.mjs';
import { loadSIO, labelTable } from './anatomy/sio.mjs';
import { BP3D } from './anatomy/bp3d.mjs';
import { fitSimilarity } from './anatomy/register.mjs';
import { preAlign, makeWarp, warpLandmarks } from './anatomy/bp3d-warp.mjs';
import { writeGLB } from './anatomy/glb.mjs';
import { ensureSources, safeUnzip, readXlsxRows, SOURCES } from './anatomy/sources.mjs';
import { buildLandmarks } from './anatomy/landmarks.mjs';
import { tubeEnd, bridgeTube, insideField, clampInside } from './anatomy/vessels.mjs';

const args = new Set(process.argv.slice(2));
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const RAW = join(ROOT, 'tools/.cache/anatomy-raw');
const WORK = join(ROOT, 'tools/.cache/anatomy-build');
const OUT = join(ROOT, 'assets/anatomy');
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a);
const report = { generated: new Date().toISOString(), meshes: {}, warnings: [] };
const warn = (msg) => { report.warnings.push(msg); log('WARN', msg); };

// ---------------------------------------------------------------------------------------------------------------
log('1/7 sources');
await ensureSources(RAW, { offline: args.has('--offline'), log });
safeUnzip(join(RAW, 'sio/zip/VOXEL-MAN_segmented-internal-organs.zip'), join(RAW, 'sio/data'), ['VOXEL-MAN_segmented-internal-organs/labels/*'], { marker: 'VOXEL-MAN_segmented-internal-organs/labels/labels2029.tif' });
safeUnzip(join(RAW, 'bp3d/zip/partof_BP3D_4.0_obj_99.zip'), join(RAW, 'bp3d/obj'), [], { marker: 'partof_BP3D_4.0_obj_99/FJ1252.obj' });
safeUnzip(join(RAW, 'bp3d/zip/isa_BP3D_4.0_obj_99.zip'), join(RAW, 'bp3d/obj'), [], { marker: 'isa_BP3D_4.0_obj_99/FJ1682M.obj' });
await M.ready;

const STAGE = join(WORK, 'stage-meshes.bin');
let final, organs, vesselParts, skinBounds, k;
if (args.has('--landmarks-only') && existsSync(STAGE)) {
  log('2-5/7 skipped (--landmarks-only): loading cached meshes');
  const all = M.unpackMeshes(readFileSync(STAGE));
  final = {}; organs = {}; vesselParts = new Map();
  for (const [n, m] of Object.entries(all)) { const [kind, name] = n.split('::'); if (kind === 'final') final[name] = m; else if (kind === 'organ') organs[name] = m; else vesselParts.set(name, m); }
  ({ skinBounds, k } = JSON.parse(readFileSync(STAGE + '.json', 'utf8')));
  Object.assign(report, JSON.parse(readFileSync(join(WORK, 'report.json'), 'utf8')), { warnings: [] });
} else {
// ---------------------------------------------------------------------------------------------------------------
log('2/7 HRA united male: skin, organs, torso vessels, bones');
const hra = await openHRA(join(RAW, 'hra/glb/3d-vh-m-united-v1.9.glb'));
const skinHRA = M.weld(hra.collect('VH_M_skin'), 1e-6);
skinBounds = M.bounds(skinHRA);
// Inside-field of the skin, used to keep warped / re-posed geometry under the skin (see step 4).
const skinField = insideField(skinHRA, 0.003);
var clampLog = { vertices: 0, maxMove_mm: 0 };
var keepInside = (m) => { const r = clampInside(m, skinField); clampLog.vertices += r.moved; clampLog.maxMove_mm = Math.max(clampLog.maxMove_mm, +(r.maxMove * 1000).toFixed(1)); return r.mesh; };
{ // full-resolution anterior abdominal skin patch, for navel detection
  const P = skinHRA.positions, I = skinHRA.indices; const keep = [];
  for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3; if (P[a + 2] > 0.05 && Math.abs(P[a]) < 0.08 && P[a + 1] > -0.05 && P[a + 1] < 0.45) keep.push(t / 3); }
  var skinAbdomen = M.subsetTriangles(skinHRA, keep);
}
log(`  skin ${M.triCount(skinHRA)} tris, height ${skinBounds.size[1].toFixed(4)} m`);

const remesh = (m, o) => M.orientOutward(M.taubin(V.remeshSolid(o.cap ? V.capBoundaries(m) : m, o.h, { close: o.close ?? 1, keep: o.keep ?? 1 }).mesh, { iterations: 8 }));
const ORGANS = {
  brain: { hra: ['Allen_brain'], h: 0.002, budget: 12000, src: 'hra' },
  heart: { hra: ['VH_M_heart'], h: 0.0015, budget: 12000, src: 'hra' },
  lungs: { hra: ['VH_M_lungs'], h: 0.0025, keep: 2, budget: 12000, src: 'hra' },
  liver: { hra: ['VH_M_liver'], exclude: ['VH_M_ligament_of_liver'], h: 0.002, budget: 10000, src: 'hra' },
  gallbladder: { hra: ['VH_M_gallbladder'], h: 0.0012, budget: 3000, src: 'hra' },
  pancreas: { hra: ['VH_M_pancreas'], h: 0.0015, budget: 6000, src: 'hra' },
  spleen: { hra: ['VH_M_spleen'], h: 0.0015, budget: 6000, src: 'hra' },
  small_intestine: { hra: ['VH_M_small_intestine'], h: 0.0015, cap: true, close: 2, budget: 12000, src: 'hra' },
  large_intestine: { hra: ['VH_M_colon'], h: 0.0018, cap: true, close: 2, budget: 12000, src: 'hra' },
  kidneys: { hra: ['VH_M_kidney'], h: 0.0015, keep: 2, budget: 8000, src: 'hra' },
  bladder: { hra: ['VH_M_urinary_bladder'], h: 0.0012, cap: true, budget: 4000, src: 'hra' },
  stomach: { sio: ['stomach', 'body of stomach', 'cardia', 'fundus of stomach', 'greater curvature', 'lesser curvature'], budget: 8000, src: 'sio' },
  thyroid: { sio: ['thyroid gland'], budget: 3000, src: 'sio' },
};
organs = {};
for (const [id, o] of Object.entries(ORGANS)) {
  if (!o.hra) continue;
  organs[id] = remesh(M.weld(hra.collect(o.hra, { exclude: o.exclude || [] }), 1e-6), o);
  log(`  ${id}: shell ${M.triCount(organs[id])} tris, ${(M.volumeCentroid(organs[id]).volume * 1000).toFixed(3)} L`);
}

// Torso vessels. Colour/classification follows the textbook convention of blood oxygenation:
// pulmonary arteries carry deoxygenated blood (drawn blue -> "veins"), pulmonary veins oxygenated (red -> "arteries").
const HRA_ARTERIES = [
  ['VH_M_aorta', { exclude: ['VH_M_brachiocephalic_artery', 'VH_M_left_common_carotid_artery', 'VH_M_left_subclavian_artery'] }],
  ['VH_M_cardiac_artery'], ['VH_M_arteries_of_kidney'], ['VH_M_arteries_of_spleen'], ['VH_M_arteries_of_gallbladder'],
  ['VH_M_arteries_of_liver'], ['VH_M_arteries_of_large_intestine'], ['VH_M_pulmonary_vein'],
];
const HRA_VEINS = [
  ['VH_M_vena_cava'], ['VH_M_brachiocephalic_vein'], ['VH_M_cardiac_vein'], ['VH_M_veins_of_kidney'], ['VH_M_veins_of_spleen'],
  ['VH_M_veins_of_gallbladder'], ['VH_M_veins_of_liver'], ['VH_M_veins_of_large_intestine'], ['VH_M_pulmonary_artery'],
];
vesselParts = new Map([['skin_hi_abdomen', skinAbdomen]]); // name -> mesh (HRA frame), used for landmarks and flow paths
const collectV = ([name, opt]) => { const m = M.weld(hra.collect(name, opt || {}), 1e-6); vesselParts.set(name, m); return m; };
const hraArteries = M.merge(HRA_ARTERIES.map(collectV));
const hraVeins = M.merge(HRA_VEINS.map(collectV));
for (const n of ['VH_M_ascending_aorta', 'VH_M_aortic_arch', 'VH_M_descending_aorta_a', 'VH_M_descending_aorta_b', 'VH_M_brachiocephalic_artery_a', 'VH_M_left_common_carotid_artery_a',
  'VH_M_left_subclavian_artery_a', 'VH_M_celiac_trunk', 'VH_M_common_hepatic_artery', 'VH_M_proper_hepatic_artery', 'VH_M_right_hepatic_artery', 'VH_M_cystic_artery', 'VH_M_splenic_artery',
  'VH_M_superior_mesenteric_artery', 'VH_M_inferior_mesenteric_artery', 'VH_M_left_colic_artery', 'VH_M_left_renal_artery', 'VH_M_right_renal_artery', 'VH_M_left_coronary_artery',
  'VH_M_left_anterior_descending_artery', 'VH_M_pulmonary_trunk', 'VH_M_pulmonary_artery_L', 'VH_M_pulmonary_vein_L_sup', 'VH_M_pulmonary_vein_L_inf', 'VH_M_superior_vena_cava',
  'VH_M_inferior_vena_cava_a', 'VH_M_inferior_vena_cava_b', 'VH_M_brachiocephalic_vein_L', 'VH_M_brachiocephalic_vein_R', 'VH_M_common_iliac_vein_L', 'VH_M_external_iliac_vein_L',
  'VH_M_external_iliac_vein_R', 'VH_M_right_cardiac_atrium', 'VH_M_heart_right_ventricle', 'VH_M_left_cardiac_atrium', 'VH_M_heart_left_ventricle', 'VH_M_aortic_valve',
  'VH_M_pulmonary_valve', 'VH_M_tricuspid_valve', 'VH_M_mitral_valve', 'VH_M_hilum_L', 'VH_M_lungs_L', 'VH_M_subcutaneous_abdominal_adipose_tissue', 'VH_M_eyes', 'VH_M_femur_L',
  'VH_M_femur_R', 'VH_M_tibia_L', 'VH_M_patella_L', 'VH_M_larynx', 'VH_M_trachea', 'VH_M_ilium_compact_bone_L', 'VH_M_lumbar_vertebra_2', 'VH_M_lumbar_vertebra_5']) {
  if (!vesselParts.has(n)) vesselParts.set(n, M.weld(hra.collect(n), 1e-6));
}

// Bones (HRA): vertebrae, sacrum, coccyx, hip bones, leg bones (femur sub-patches excluded).
const femurPatches = [/condyle/, /intercondylar/, /enthesis/, /perichondular/, /patellar_surface/, /articular_cartilage/, /distal_most/];
const hraBones = M.weld(M.merge([
  hra.collect('VH_M_vertebra'), hra.collect(['VH_M_sacrum', 'VH_M_coccyx']),
  hra.collect(['VH_M_ilium_compact_bone', 'VH_M_ischium_compact_bone', 'VH_M_pubis_compact_bone']),
  hra.collect(['VH_M_femur_L', 'VH_M_femur_R'], { exclude: femurPatches }),
  hra.collect(['VH_M_tibia_L', 'VH_M_tibia_R', 'VH_M_fibula_L', 'VH_M_fibula_R', 'VH_M_patella_L', 'VH_M_patella_R']),
]), 1e-6);

// ---------------------------------------------------------------------------------------------------------------
log('3/7 SIO (Visible Human Male label volume): stomach, thyroid, rib cage; rigid registration to HRA');
const sio = loadSIO(join(RAW, 'sio/data/VOXEL-MAN_segmented-internal-organs/labels'));
const LT = labelTable(readXlsxRows(join(RAW, 'sio/zip/SIO_Object_Labels.xlsx')));
const L = (...names) => names.flatMap((n) => { const v = LT.get(n); if (!v) throw new Error(`SIO label missing: ${n}`); return v; });
const voxelCentroid = (m, h = 0.002) => {
  const g = V.voxelizeSolid(m, M.bounds(m), h); let n = 0; const s = [0, 0, 0];
  for (let k = 0; k < g.nz; k++) for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) if (g.data[i + g.nx * (j + g.ny * k)]) { n++; s[0] += i; s[1] += j; s[2] += k; }
  return s.map((v, a) => g.origin[a] + (v / n) * g.h);
};
const kidL = M.surfaceCentroid(hra.collect('VH_M_left_kidney'))[0] > 0 ? 'VH_M_left_kidney' : 'VH_M_right_kidney';
const kidR = kidL === 'VH_M_left_kidney' ? 'VH_M_right_kidney' : 'VH_M_left_kidney';
const regPairs = [
  ['liver', ['VH_M_liver'], L('liver')], ['spleen', ['VH_M_spleen'], L('spleen')],
  ['kidney L', [kidL], L('left kidney', 'left renal medulla')], ['kidney R', [kidR], L('right kidney', 'right renal medulla')],
  ['heart', ['VH_M_heart'], L('myocardium', 'left atrium', 'left ventricle', 'right atrium', 'right ventricle')],
  ['bladder', ['VH_M_urinary_bladder'], L('urinary bladder')], ['gallbladder', ['VH_M_gallbladder'], L('gallbladder')],
  ['pancreas', ['VH_M_pancreas'], L('pancreas')], ['lung L', ['VH_M_lungs_L'], L('left lung')], ['lung R', ['VH_M_lungs_R'], L('right lung')],
];
const A = [], B = [];
for (const [, hn, labels] of regPairs) { A.push(sio.stats(labels).centroid); B.push(voxelCentroid(M.weld(hra.collect(hn), 1e-6))); }
const sioSim = fitSimilarity(A, B);
report.sioRegistration = { scale_m_per_voxel: +sioSim.s.toFixed(6), rms_mm: +(sioSim.rms * 1000).toFixed(1), residuals_mm: Object.fromEntries(regPairs.map((p, i) => [p[0], +(sioSim.residuals[i] * 1000).toFixed(1)])) };
log(`  SIO -> HRA similarity: scale ${sioSim.s.toFixed(6)} m/voxel, RMS ${(sioSim.rms * 1000).toFixed(1)} mm over ${A.length} organs`);
const sioMesh = (labels, { blurPasses = 1, iterations = 10 } = {}) => {
  const g = V.gridFromMask(sio.mask(labels), sio.W, sio.H, sio.D, { pad: 2 });
  const m = V.surfaceNets(V.blur(g, blurPasses), 0.5);
  return M.orientOutward(M.taubin(M.mapVertices(m, (x, y, z) => sioSim.apply([x, y, z])), { iterations }));
};
for (const [id, o] of Object.entries(ORGANS)) if (o.sio) { organs[id] = sioMesh(L(...o.sio)); log(`  ${id}: ${M.triCount(organs[id])} tris, ${(M.volumeCentroid(organs[id]).volume * 1000).toFixed(3)} L`); }
const ribNames = [...LT.keys()].filter((n) => /^(left|right) (rib \d+|costal cartilage .+|clavicle|clavicular cartilage|scapula)$|^sternum$/.test(n));
// (SIO shoulder girdle is in the cadaver's arms-down pose; the HRA skin has abducted arms, so keep it under the skin)
const sioBones = args.has('--no-skeleton') ? null : keepInside(sioMesh(L(...ribNames), { iterations: 6 }));

// ---------------------------------------------------------------------------------------------------------------
log('4/7 BodyParts3D: thin-plate-spline warp into the HRA body; limb/neck/head vessels; skull, arm, hand, foot bones');
const po = new BP3D(join(RAW, 'bp3d'), 'partof');
const isa = new BP3D(join(RAW, 'bp3d'), 'isa');
const ringSkin = M.simplify(skinHRA, 150000, { error: 0.005 });
const lmCache = join(WORK, 'warp-landmarks.json');
const WARP_VERSION = 4;
let lmk = existsSync(lmCache) && !args.has('--fresh') ? JSON.parse(readFileSync(lmCache, 'utf8')) : null;
if (!lmk || lmk.version !== WARP_VERSION) {
  lmk = { version: WARP_VERSION, ...warpLandmarks({ hra, po, isa, hraSkin: ringSkin, log: (m) => log('  ' + m) }) };
  writeFileSync(lmCache, JSON.stringify(lmk));
} else log(`  using cached warp landmarks (${lmk.src.length}); --fresh recomputes`);
const pa = preAlign(po, ringSkin);
// Junction landmarks: make BodyParts3D vessels start exactly where the HRA torso vessels end.
const endOf = (m, dir, tol = 0.003) => {
  const d = M.norm(dir); const p = m.positions; let mx = -Infinity;
  for (let i = 0; i < p.length; i += 3) mx = Math.max(mx, p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2]);
  let n = 0; const c = [0, 0, 0];
  for (let i = 0; i < p.length; i += 3) if (p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2] > mx - tol) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; n++; }
  return c.map((v) => v / n);
};
const bpPre = (tree, name) => pa.preMesh(tree.mesh(name));
const hv = (n) => vesselParts.get(n);
const junctions = [
  ['brachiocephalic trunk origin', endOf(bpPre(isa, 'brachiocephalic artery'), [0, -1, 0]), endOf(hv('VH_M_brachiocephalic_artery_a'), [0, -1, 0])],
  ['left common carotid origin', endOf(bpPre(isa, 'left common carotid artery'), [0, -1, 0]), endOf(hv('VH_M_left_common_carotid_artery_a'), [0, -1, 0])],
  ['left subclavian origin', endOf(bpPre(isa, 'left subclavian artery'), [0, -1, 0]), endOf(hv('VH_M_left_subclavian_artery_a'), [0, -1, 0])],
  ['aortic bifurcation', endOf(bpPre(isa, 'abdominal aorta'), [0, -1, 0]), endOf(hv('VH_M_descending_aorta_b'), [0, -1, 0])],
  ['left venous angle', endOf(bpPre(isa, 'left brachiocephalic vein'), [1, 0.4, 0]), endOf(hv('VH_M_brachiocephalic_vein_L'), [1, 0.4, 0])],
  ['right venous angle', endOf(bpPre(isa, 'right brachiocephalic vein'), [-1, 0.4, 0]), endOf(hv('VH_M_brachiocephalic_vein_R'), [-1, 0.4, 0])],
  ['left external iliac vein (inguinal)', endOf(bpPre(isa, 'left external iliac vein'), [0.3, -1, 0.5]), endOf(hv('VH_M_external_iliac_vein_L'), [0.3, -1, 0.5])],
  ['right external iliac vein (inguinal)', endOf(bpPre(isa, 'right external iliac vein'), [-0.3, -1, 0.5]), endOf(hv('VH_M_external_iliac_vein_R'), [-0.3, -1, 0.5])],
];
const warp = makeWarp(pa, lmk, junctions.map((j) => [j[1], j[2]]));
report.warp = { landmarks: warp.count, junctions: junctions.map((j) => j[0]), maxResidual_mm: +(warp.maxResidual * 1000).toFixed(1), preScale: +pa.s.toFixed(4) };
log(`  TPS on ${warp.count} landmark pairs (${junctions.length} vessel junctions); max residual ${(warp.maxResidual * 1000).toFixed(1)} mm`);

const SIDES = ['left', 'right'];
const both = (...names) => names.flatMap((n) => SIDES.map((s) => `${s} ${n}`));
const BP_ARTERIES = [
  'brachiocephalic artery', ...both('common carotid artery', 'internal carotid artery', 'vertebral artery', 'anterior cerebral artery', 'subclavian artery',
    'thyrocervical trunk', 'inferior thyroid artery', 'internal thoracic artery', 'axillary artery', 'brachial artery', 'deep brachial artery', 'radial artery', 'ulnar artery',
    'superficial palmar arterial arch', 'deep palmar arch', 'common iliac artery', 'external iliac artery', 'internal iliac artery', 'femoral artery',
    'lateral circumflex femoral artery', 'popliteal artery', 'anterior tibial artery', 'posterior tibial artery', 'dorsalis pedis artery', 'plantar arch',
    'superficial epigastric artery', 'inferior epigastric artery'), 'basilar artery',
];
const BP_ARTERIES_PARTOF = [...both('deep femoral artery', 'posterior cerebral artery')];
const BP_VEINS = [
  ...both('internal jugular vein', 'subclavian vein', 'axillary vein', 'cephalic vein', 'basilic vein', 'median cubital vein', 'medial brachial vein', 'radial vein', 'ulnar vein',
    'superficial palmar venous arch', 'femoral vein', 'deep femoral vein', 'great saphenous vein', 'small saphenous vein', 'popliteal vein', 'posterior tibial vein',
    'anterior tibial vein', 'superficial epigastric vein'),
];
// Warped BodyParts3D geometry is kept inside the HRA skin (superficial veins/arteries and finger bones can land a few
// millimetres outside because the two bodies differ): such vertices are pushed inward along the skin's inside-field.
const bpVessel = (tree, name) => {
  if (!tree.has(name)) { warn(`BodyParts3D ${tree.tree}: no concept "${name}" (skipped)`); return null; }
  const m = keepInside(M.weld(warp.mapMesh(tree.mesh(name)), 1e-6)); vesselParts.set(name, m); return m;
};
vesselParts.set('left humerus', warp.mapMesh(po.mesh('left humerus')));
const bpArtList = [...BP_ARTERIES.map((n) => bpVessel(isa, n)), ...BP_ARTERIES_PARTOF.map((n) => bpVessel(po, n))];
const bpVeinList = BP_VEINS.map((n) => bpVessel(isa, n));
// BodyParts3D 4.0 has no geometry for the cervical internal carotid, the lower vertebral artery or the upper internal
// jugular vein. Bridge those gaps with tubes that join the real vessel ends (cubic Hermite, matched end radii).
const bridges = [];
for (const side of SIDES) {
  const sx = side === 'left' ? 1 : -1; const g = (n) => vesselParts.get(`${side} ${n}`);
  const cca = g('common carotid artery'), ica = g('internal carotid artery'), va = g('vertebral artery'), sca = g('subclavian artery'), ijv = g('internal jugular vein');
  if (cca && ica) { const b = bridgeTube(tubeEnd(cca, [0, 1, 0]), tubeEnd(ica, [0, -1, 0])); bpArtList.push(b); vesselParts.set(`${side} internal carotid artery`, M.merge([ica, b])); bridges.push(`${side} cervical internal carotid artery`); }
  if (va && sca) {
    const vb = tubeEnd(va, [0, -1, 0]); const p = sca.positions; let best = null, bd = Infinity;
    for (let i = 0; i < p.length; i += 3) { const v = [p[i], p[i + 1], p[i + 2]]; const d = M.dist(v, vb.center); if (d < bd) { bd = d; best = v; } }
    const ring = []; for (let i = 0; i < p.length; i += 3) { const v = [p[i], p[i + 1], p[i + 2]]; if (M.dist(v, best) < 0.008) ring.push(v); }
    const c = ring.reduce((s2, v) => M.add(s2, v), [0, 0, 0]).map((x) => x / ring.length);
    const b = bridgeTube({ center: c, tangent: M.norm(M.sub(vb.center, c)), radius: vb.radius }, vb); bpArtList.push(b); bridges.push(`${side} vertebral artery (origin)`);
  }
  if (ijv && ica) {
    const top = tubeEnd(ijv, [0, 1, 0]); const icaB = tubeEnd(ica, [0, -1, 0]);
    const end = { center: M.add(icaB.center, [sx * 0.012, 0.002, -0.01]), tangent: [0, -1, 0], radius: top.radius * 0.85 };
    const b = bridgeTube(top, end); bpVeinList.push(b); vesselParts.set(`${side} internal jugular vein`, M.merge([ijv, b])); bridges.push(`${side} upper internal jugular vein`);
  }
}
report.bridges = bridges;
const bpArteries = M.merge(bpArtList);
const bpVeins = M.merge(bpVeinList);
log(`  kept inside skin: ${clampLog.vertices} warped vertices moved (max ${clampLog.maxMove_mm} mm); bridged gaps: ${bridges.join(', ')}`);
log(`  BodyParts3D vessels: arteries ${M.triCount(bpArteries)} tris, veins ${M.triCount(bpVeins)} tris (before simplification)`);

let bpBones = null;
if (!args.has('--no-skeleton')) {
  const SKULL = ['frontal bone', 'occipital bone', 'sphenoid bone', 'ethmoid', 'vomer', 'mandible', ...both('parietal bone', 'temporal bone', 'zygomatic bone', 'maxilla', 'nasal bone', 'lacrimal bone', 'palatine bone', 'inferior nasal concha')];
  const CARPALS = ['scaphoid', 'lunate', 'triquetral', 'pisiform', 'trapezium', 'trapezoid', 'capitate', 'hamate'];
  const parts = [];
  for (const n of SKULL) { const tree = po.has(n) ? po : isa; if (tree.has(n)) parts.push(tree.mesh(n)); else warn(`BodyParts3D: no skull part "${n}"`); }
  for (const s of SIDES) {
    for (const n of ['humerus', 'radius', 'ulna', ...CARPALS]) { const nm = `${s} ${n}`; if (po.has(nm)) parts.push(po.mesh(nm)); else if (isa.has(nm)) parts.push(isa.mesh(nm)); else warn(`BodyParts3D: no bone "${nm}"`); }
    parts.push(po.mesh(`${s} hand`), po.mesh(`${s} foot`));
  }
  bpBones = keepInside(M.weld(warp.mapMesh(M.merge(parts)), 1e-6));
}

// ---------------------------------------------------------------------------------------------------------------
log('5/7 assemble in contract frame, simplify, compress');
k = 1.75 / skinBounds.size[1];
const toWorldS = (p) => [(p[0] - skinBounds.center[0]) * k, (p[1] - skinBounds.min[1]) * k, (p[2] - skinBounds.center[2]) * k];
const W = (m) => M.mapVertices(m, (x, y, z) => toWorldS([x, y, z]));
report.frame = { units: 'm', up: '+Y', front: '+Z', personLeft: '+X', scaleFromHRA: +k.toFixed(6), sourceHeight_m: +skinBounds.size[1].toFixed(4), height_m: 1.75 };

// Containment check (HRA frame): share of each mesh's vertices that lie inside the skin.
const insideShare = (m) => { let n = 0; const p = m.positions; for (let i = 0; i < p.length; i += 3) if (skinField.sample([p[i], p[i + 1], p[i + 2]]) > 0.5) n++; return +(n / (p.length / 3)).toFixed(4); };
report.insideSkin = {};
for (const [id, m] of Object.entries(organs)) report.insideSkin[id] = insideShare(m);
report.insideSkin.arteries = insideShare(M.merge([hraArteries, bpArteries]));
report.insideSkin.veins = insideShare(M.merge([hraVeins, bpVeins]));
if (sioBones) report.insideSkin.skeleton = insideShare(M.merge([hraBones, sioBones, bpBones]));
log(`  share of vertices inside the skin: ${Object.entries(report.insideSkin).map(([a, b]) => `${a} ${(b * 100).toFixed(2)}%`).join(', ')}`);
for (const [id, v] of Object.entries(report.insideSkin)) if (v < 0.995) warn(`${id}: only ${(v * 100).toFixed(2)}% of vertices inside the skin`);
final = {};
final.skin = M.simplify(W(skinHRA), 60000, { error: 0.002 });
for (const [id, o] of Object.entries(ORGANS)) final[id] = M.simplify(W(organs[id]), o.budget, { error: 0.001 });
const vesselSimplify = (m, budget) => M.simplify(M.weld(W(m), 1e-6), budget, { error: 0.0002, absolute: true });
final.arteries = vesselSimplify(M.merge([hraArteries, bpArteries]), 60000);
final.veins = vesselSimplify(M.merge([hraVeins, bpVeins]), 60000);
if (!args.has('--no-skeleton')) final.skeleton = M.simplify(M.weld(W(M.merge([hraBones, sioBones, bpBones])), 1e-6), 60000, { error: 0.0005, absolute: true });

const COLORS = {
  skin: [0.55, 0.78, 0.86], brain: [0.85, 0.65, 0.7], thyroid: [0.79, 0.44, 0.53], heart: [0.78, 0.25, 0.29], lungs: [0.9, 0.64, 0.65], liver: [0.55, 0.23, 0.2],
  gallbladder: [0.45, 0.56, 0.24], stomach: [0.85, 0.56, 0.45], pancreas: [0.9, 0.72, 0.42], spleen: [0.48, 0.21, 0.33], small_intestine: [0.89, 0.63, 0.52],
  large_intestine: [0.79, 0.55, 0.42], kidneys: [0.63, 0.27, 0.25], bladder: [0.84, 0.7, 0.36], arteries: [0.93, 0.33, 0.3], veins: [0.3, 0.45, 0.9], skeleton: [0.91, 0.89, 0.82],
};
const SRC = {
  hra: 'HRA 3D Reference Organ Set, United Male v1.9 (NIH HuBMAP; Visible Human Male), CC BY 4.0',
  sio: 'VOXEL-MAN Segmented Internal Organs of the Visible Human Male (Höhne et al., 2025), CC BY 4.0',
  bp3d: 'BodyParts3D 4.0, © The Database Center for Life Science, CC BY 4.0',
};
const meshSources = { skin: [SRC.hra], arteries: [SRC.hra, SRC.bp3d], veins: [SRC.hra, SRC.bp3d], skeleton: [SRC.hra, SRC.sio, SRC.bp3d] };
for (const [id, o] of Object.entries(ORGANS)) meshSources[id] = [SRC[o.src]];
const ORDER = ['skin', 'brain', 'thyroid', 'heart', 'lungs', 'liver', 'gallbladder', 'stomach', 'pancreas', 'spleen', 'small_intestine', 'large_intestine', 'kidneys', 'bladder', 'arteries', 'veins', 'skeleton'];
const items = ORDER.filter((id) => final[id]).map((id) => ({ name: id, mesh: final[id], color: COLORS[id], extras: { sources: meshSources[id] } }));
for (const it of items) report.meshes[it.name] = { triangles: M.triCount(it.mesh), vertices: it.mesh.positions.length / 3 };
const glbPath = join(OUT, 'body.glb');
await writeGLB(glbPath, items, {
  compress: true,
  copyright: 'Anatomy: HRA 3D Reference Organs (NIH HuBMAP, CC BY 4.0); VOXEL-MAN Segmented Internal Organs of the Visible Human Male (CC BY 4.0); BodyParts3D (DBCLS, CC BY 4.0). Adapted for PeptideScope.',
  extras: { frame: report.frame, license: 'CC BY 4.0 (adapted material; see assets/anatomy/LICENSE.md)', vesselClassification: 'by blood oxygenation: pulmonary arteries are in "veins", pulmonary veins in "arteries"' },
});
report.glbBytes = statSync(glbPath).size;
log(`  body.glb ${(report.glbBytes / 1e6).toFixed(2)} MB; triangles: ${items.map((i) => `${i.name} ${M.triCount(i.mesh)}`).join(', ')}`);
if (report.glbBytes > 3.5e6) warn(`body.glb is ${(report.glbBytes / 1e6).toFixed(2)} MB (> 3.5 MB budget)`);
const cache = {};
for (const [n, m] of Object.entries(final)) cache[`final::${n}`] = m;
for (const [n, m] of Object.entries(organs)) cache[`organ::${n}`] = m;
for (const [n, m] of vesselParts) cache[`part::${n}`] = m;
writeFileSync(STAGE, M.packMeshes(cache)); writeFileSync(STAGE + '.json', JSON.stringify({ skinBounds, k }));
}
const toWorld = (p) => [(p[0] - skinBounds.center[0]) * k, (p[1] - skinBounds.min[1]) * k, (p[2] - skinBounds.center[2]) * k];

// ---------------------------------------------------------------------------------------------------------------
log('6/7 landmarks: organ centres, injection sites, flow paths');
const fromWorld = (p) => [p[0] / k + skinBounds.center[0], p[1] / k + skinBounds.min[1], p[2] / k + skinBounds.center[2]];
const lm = buildLandmarks({ final, organsHRA: organs, vesselParts, toWorld, fromWorld, log: (m) => log('  ' + m), warn });
lm.meta = {
  generator: 'tools/build-anatomy.mjs',
  frame: 'metres, +Y up, feet at y=0, body faces +Z, centred on x=0 z=0, person\'s left = +X',
  sources: SOURCES.filter((s) => !/elements|crosswalk/.test(s.id)).map((s) => s.url),
  attribution: 'Anatomy adapted from the HRA 3D Reference Organs (NIH HuBMAP, CC BY 4.0), the VOXEL-MAN Segmented Internal Organs of the Visible Human Male (Höhne et al., CC BY 4.0) and BodyParts3D (© DBCLS, CC BY 4.0).',
  checks: lm.checks,
};
delete lm.checks;
writeFileSync(join(OUT, 'landmarks.json'), JSON.stringify(lm, (key, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v)));
report.landmarks = { organs: Object.keys(lm.organs).length, sites: Object.keys(lm.sites), paths: Object.fromEntries(Object.entries(lm.paths).map(([k2, p]) => [k2, p.length])), checks: lm.meta.checks };

// ---------------------------------------------------------------------------------------------------------------
log('7/7 report');
writeFileSync(join(WORK, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ glbMB: +(report.glbBytes / 1e6).toFixed(3), meshes: report.meshes, sio: report.sioRegistration, warp: report.warp, landmarks: report.landmarks, warnings: report.warnings }, null, 2));
if (lm.meta.checks.outside.length) { console.error('FAIL: waypoints outside the skin:', lm.meta.checks.outside); process.exitCode = 1; }
