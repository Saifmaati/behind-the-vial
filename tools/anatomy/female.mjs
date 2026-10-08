// Female build profile for the anatomy pipeline (dev-only).
//
// Backbone: HRA 3D Reference Organ Set, United Female v1.10 (NIH HuBMAP; Visible Human Female), read through a
// sparse range-fetched copy of the 374.5 MB GLB (see hra-ranged.mjs). The rest of the pipeline was written against
// the male HRA node names (VH_M_*); `openFemaleHRA` translates those *logical* names to the female nodes, so the
// shared code (warp landmarks, flow paths) runs unchanged on the female body.
import * as M from './mesh.mjs';
import { nodeTable, openRanged } from './hra-ranged.mjs';
import { fitTPS } from './register.mjs';

export const HRA_FEMALE = {
  id: 'hra-united-female',
  version: 'v1.10',
  url: 'https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb',
  size: 374505632,
  etag: 'd66fa43f568db06c3f5545a48c35eec0-45', // S3 multipart ETag, Last-Modified 2026-06-10 13:31:57 GMT
  headSha256: '42ecd1470c19e479cb80d445219e14b2fb3d2f9419d6e9ef03a8d6bc1ec68cc6', // GLB header + JSON chunk (939,536 bytes)
  doi: 'https://doi.org/10.48539/HBM637.DWBM.744',
  page: 'https://lod.humanatlas.io/ref-organ/united-female/v1.10',
  file: 'hra-f/glb/3d-vh-f-united-v1.10.sparse.glb',
};

/**
 * Node subtrees fetched from the female GLB (about 35 MB of index + position data). Not fetched: eyes (23.7 MB;
 * only their centres are needed, taken from the accessor bounds), mouth (60 MB), mammary glands (21.9 MB; the skin
 * already carries the breast surface), intervertebral discs (18 MB), tracheobronchial tree, spinal cord, placenta.
 */
export const FEMALE_FETCH = [
  'VH_F_skin', 'VH_F_subcutaneous_abdominal_adipose_tissue', 'Allen_brain', 'VH_F_heart', 'VH_F_lungs', 'VH_F_liver', 'VH_F_gallbladder_',
  'VH_F_pancreas', 'VH_F_spleen', 'VH_F_small_intestine', 'VH_F_colon', 'VH_F_kidney', 'VH_F_urinary_bladder', 'VH_F_uterus', 'VH_F_ovary',
  'VH_F_blood_vasculature', 'VH_F_vertebra', 'VH_F_pelvis', 'VH_F_lower_limb', 'VH_F_sternum', 'VH_F_manubrium', 'VH_F_larynx', 'VH_F_trachea',
];
export const FEMALE_FETCH_EXCLUDE = ['VH_F_blood_vasculature_of_eye'];
/** Used only through their bounding boxes (accessor min/max), never fetched. */
const BOX_ONLY = new Set(['VH_F_eyes', 'VH_F_eye_L', 'VH_F_eye_R', 'VH_F_mammary_gland', 'VH_F_mammary_gland_L', 'VH_F_mammary_gland_R']);

/**
 * Logical (male) name -> female node(s). Names not listed map VH_M_x -> VH_F_x. `null` = no female counterpart
 * (collect returns an empty mesh; the female build supplies BodyParts3D geometry for those where needed).
 */
export const FEMALE_ALIAS = {
  VH_M_heart_left_ventricle: 'VH_F_left_ventricle',
  VH_M_heart_right_ventricle: 'VH_F_right_ventricle',
  VH_M_lungs_L: 'VH_F_left_lungs_L',
  VH_M_common_iliac_vein_L: 'VH_F_left_common_iliac_vein',
  VH_M_common_iliac_vein_R: 'VH_F_right_common_iliac_vein',
  VH_M_hyoid: null, // not in the female set
  VH_M_ischium_compact_bone_L: null, VH_M_ischium_compact_bone_R: null, VH_M_pubis_compact_bone_L: null, VH_M_pubis_compact_bone_R: null,
  VH_M_brachiocephalic_vein: null, VH_M_brachiocephalic_vein_L: null, VH_M_brachiocephalic_vein_R: null,
  VH_M_external_iliac_vein_L: null, VH_M_external_iliac_vein_R: null,
};

const tf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

/** World-space bounding box of a node subtree from accessor min/max (no geometry needed). */
export function worldBounds(head, name) {
  const { json } = head; const T = nodeTable(json); const i = T.byName.get(name);
  if (i === undefined) throw new Error(`HRA female: node not found: ${name}`);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const k of T.subtree(i)) {
    const n = json.nodes[k]; if (n.mesh === undefined) continue; const W = T.world(k);
    for (const p of json.meshes[n.mesh].primitives) {
      const a = json.accessors[p.attributes.POSITION];
      for (let c = 0; c < 8; c++) { const w = tf(W, [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]]); for (let d = 0; d < 3; d++) { mn[d] = Math.min(mn[d], w[d]); mx[d] = Math.max(mx[d], w[d]); } }
    }
  }
  return { min: mn, max: mx, center: mn.map((v, d) => (v + mx[d]) / 2), size: mn.map((v, d) => mx[d] - v) };
}

/** Closed box mesh (12 triangles, outward) for a bounds object. Its surface centroid is the box centre. */
function boxMesh(b) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const P = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const I = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  return M.mesh(P, I);
}

/**
 * Open the sparse female GLB. Returns the same interface as openHRA(), with logical-name translation, a guard that
 * refuses to collect nodes whose bytes were not fetched, and box proxies for the bounds-only nodes.
 */
export async function openFemaleHRA(file, head) {
  const raw = openRanged(file);
  const T = nodeTable(head.json);
  const fetchedRoots = new Set([...FEMALE_FETCH].map((n) => T.byName.get(n)));
  const excludedRoots = new Set(FEMALE_FETCH_EXCLUDE.map((n) => T.byName.get(n)));
  const isFetched = (i) => { for (let k = i; k >= 0; k = T.parent[k]) { if (excludedRoots.has(k)) return false; if (fetchedRoots.has(k)) return true; } return false; };
  const tr = (n) => (Object.prototype.hasOwnProperty.call(FEMALE_ALIAS, n) ? FEMALE_ALIAS[n] : n.replace(/^VH_M_/, 'VH_F_'));
  const check = (name, exclude) => {
    const i = T.byName.get(name); if (i === undefined) throw new Error(`HRA female: node not found: ${name}`);
    const ex = exclude.map((e) => (e instanceof RegExp ? e : new RegExp(`^${e}$`)));
    const visit = (k) => { const n = head.json.nodes[k]; if (ex.some((r) => r.test(n.name))) return; if (n.mesh !== undefined && !isFetched(k)) throw new Error(`HRA female: ${n.name} (under ${name}) was not fetched; add it to FEMALE_FETCH`); (n.children || []).forEach(visit); };
    visit(i);
  };
  function collect(names, { exclude = [] } = {}) {
    const list = [].concat(names).map(tr).filter((n) => n !== null);
    const exT = exclude.map((e) => (typeof e === 'string' ? tr(e) : e)).filter((e) => e !== null);
    const parts = [];
    for (const n of list) {
      if (BOX_ONLY.has(n)) { parts.push(boxMesh(worldBounds(head, n))); continue; }
      check(n, exT); parts.push(raw.collect(n, { exclude: exT }));
    }
    return M.merge(parts);
  }
  const has = (n) => { const t = tr(n); return t !== null && raw.has(t); };
  return { ...raw, collect, has, translate: tr, bounds: (n) => worldBounds(head, tr(n)) };
}

/** Predicate: is an HRA-frame point inside either breast (mammary gland box, expanded by `pad`)? */
export function breastMask(head, pad = 0.008) {
  const boxes = ['VH_F_mammary_gland_L', 'VH_F_mammary_gland_R'].map((n) => worldBounds(head, n));
  return (p) => !!p && boxes.some((b) => p.every((v, d) => v >= b.min[d] - pad && v <= b.max[d] + pad));
}

/**
 * Thin-plate spline from the male HRA body to the female HRA body, from landmarks with the same tag in both warp
 * landmark sets (each set pairs BodyParts3D with one HRA body, so equal tags are corresponding anatomical points),
 * plus extra pairs [tag, malePoint, femalePoint].
 */
export function maleToFemale(lmkMale, lmkFemale, extra = [], { lambda = 0.002 } = {}) {
  const f = new Map(lmkFemale.tags.map((t, i) => [t, lmkFemale.dst[i]]));
  const src = [], dst = [], tags = [];
  lmkMale.tags.forEach((t, i) => { if (f.has(t)) { src.push(lmkMale.dst[i]); dst.push(f.get(t)); tags.push(t); } });
  for (const [t, a, b] of extra) if (a && b && a.every(Number.isFinite) && b.every(Number.isFinite)) { src.push(a); dst.push(b); tags.push(t); }
  const tps = fitTPS(src, dst, { lambda });
  // leave-one-out style diagnostic: how far each pair's own target is from the smooth fit (regularised spline)
  const worst = tags.map((t, i) => [t, tps.residuals[i]]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, r]) => `${t} ${(r * 1000).toFixed(1)} mm`);
  return { apply: tps.apply, count: src.length, tags, maxResidual: tps.maxResidual, worst, mapMesh: (m) => M.mapVertices(m, (x, y, z) => tps.apply([x, y, z])) };
}
