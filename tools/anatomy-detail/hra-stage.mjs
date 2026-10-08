// Stage 1 of the close-up detail build: read what we need from the HRA United Male v1.9 GLB once and cache it.
// The 238 MB GLB is only parsed as glTF data (never executed). Everything returned is in the HRA frame
// (metres, +Y up, +Z front, +X = the person's left), exactly as tools/build-anatomy.mjs collects it.
import * as M from '../anatomy/mesh.mjs';
import * as V from '../anatomy/voxel.mjs';
import { openHRA } from '../anatomy/hra.mjs';

// Same junction parts as tools/build-anatomy.mjs step 4 (needed to rebuild the identical thin-plate spline).
export const JUNCTION_PARTS = [
  'VH_M_brachiocephalic_artery_a', 'VH_M_left_common_carotid_artery_a', 'VH_M_left_subclavian_artery_a', 'VH_M_descending_aorta_b',
  'VH_M_brachiocephalic_vein_L', 'VH_M_brachiocephalic_vein_R', 'VH_M_external_iliac_vein_L', 'VH_M_external_iliac_vein_R',
];
// HRA eye parts used for the 'eyes' mesh (outer coat, clear front, coloured iris, opening, lens).
export const EYE_PARTS = ['sclera', 'cornea', 'iris', 'pupil', 'lens', 'bulbar_conjunctiva'];

const voxelCentroid = (m, h = 0.002) => {
  const g = V.voxelizeSolid(m, M.bounds(m), h); let n = 0; const s = [0, 0, 0];
  for (let k = 0; k < g.nz; k++) for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) if (g.data[i + g.nx * (j + g.ny * k)]) { n++; s[0] += i; s[1] += j; s[2] += k; }
  return s.map((v, a) => g.origin[a] + (v / n) * g.h);
};

/**
 * @returns {{ meshes: Record<string, {positions, indices}>, info: object, hra: object }} (hra = open handle; drop it when done)
 */
export async function extractHRA(file, { log = () => {}, skeleton = true } = {}) {
  const hra = await openHRA(file);
  const meshes = {};
  const skin = M.weld(hra.collect('VH_M_skin'), 1e-6);
  meshes.skin = skin;
  log(`HRA skin: ${M.triCount(skin)} tris, ${skin.positions.length / 3} vertices`);
  for (const side of ['L', 'R']) for (const p of EYE_PARTS) meshes[`eye_${p}_${side}`] = M.weld(hra.collect(`VH_M_${p}_${side}`), 1e-7);
  for (const n of JUNCTION_PARTS) meshes[`part::${n}`] = M.weld(hra.collect(n), 1e-6);
  if (skeleton) {
    // Identical selection to tools/build-anatomy.mjs (vertebrae, sacrum, coccyx, hip bones, leg bones; femur sub-patches excluded).
    const femurPatches = [/condyle/, /intercondylar/, /enthesis/, /perichondular/, /patellar_surface/, /articular_cartilage/, /distal_most/];
    meshes.hraBones = M.weld(M.merge([
      hra.collect('VH_M_vertebra'), hra.collect(['VH_M_sacrum', 'VH_M_coccyx']),
      hra.collect(['VH_M_ilium_compact_bone', 'VH_M_ischium_compact_bone', 'VH_M_pubis_compact_bone']),
      hra.collect(['VH_M_femur_L', 'VH_M_femur_R'], { exclude: femurPatches }),
      hra.collect(['VH_M_tibia_L', 'VH_M_tibia_R', 'VH_M_fibula_L', 'VH_M_fibula_R', 'VH_M_patella_L', 'VH_M_patella_R']),
    ]), 1e-6);
    log(`HRA bones: ${M.triCount(meshes.hraBones)} tris`);
  }
  // HRA organ centroids for the SIO similarity fit (same pairs and method as the male build).
  const kidL = M.surfaceCentroid(hra.collect('VH_M_left_kidney'))[0] > 0 ? 'VH_M_left_kidney' : 'VH_M_right_kidney';
  const kidR = kidL === 'VH_M_left_kidney' ? 'VH_M_right_kidney' : 'VH_M_left_kidney';
  const REG = [['liver', ['VH_M_liver']], ['spleen', ['VH_M_spleen']], ['kidney L', [kidL]], ['kidney R', [kidR]], ['heart', ['VH_M_heart']],
    ['bladder', ['VH_M_urinary_bladder']], ['gallbladder', ['VH_M_gallbladder']], ['pancreas', ['VH_M_pancreas']], ['lung L', ['VH_M_lungs_L']], ['lung R', ['VH_M_lungs_R']]];
  const regB = REG.map(([tag, names]) => [tag, voxelCentroid(M.weld(hra.collect(names), 1e-6))]);
  return { meshes, info: { regB }, hra };
}
