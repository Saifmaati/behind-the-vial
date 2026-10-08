// Female build profile for the anatomy pipeline (dev-only).
//
// Backbone: HRA 3D Reference Organ Set, United Female v1.10 (NIH HuBMAP; Visible Human Female), read through a
// sparse range-fetched copy of the 374.5 MB GLB (see hra-ranged.mjs). The rest of the pipeline was written against
// the male HRA node names (VH_M_*); `openFemaleHRA` translates those *logical* names to the female nodes, so the
// shared code (warp landmarks, flow paths) runs unchanged on the female body.
import * as M from './mesh.mjs';
import { nodeTable, openRanged } from './hra-ranged.mjs';
import { fitTPS } from './register.mjs';
import { ringAt, hLoops, ringSamples } from './rings.mjs';

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
 * Node subtrees fetched from the female GLB (40.9 MB of index + position data in 80 ranges). Not fetched: eyes (23.7 MB;
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

/**
 * Rib-cage pairs for the male -> female spline: radial samples on matching horizontal cross-sections of the two bodies'
 * closed lung shells (left and right lung separately; levels as fractions of each lung's own height, 12 directions).
 * The lungs fill the thoracic cage, so these pin the (male) SIO rib cage to the female thorax; skin rings alone leave
 * the chest wall unconstrained where the breast samples are masked. Returns [tag, malePoint, femalePoint][].
 */
export function lungPairs(maleLungs, femaleLungs, { levels = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85], k = 12 } = {}) {
  const sides = (m) => {
    const comps = M.components(m).slice(0, 2).map((c) => M.subsetTriangles(m, c));
    const out = {}; for (const c of comps) out[M.bounds(c).center[0] > 0 ? 'L' : 'R'] = c; return out;
  };
  const a = sides(maleLungs), b = sides(femaleLungs); const pairs = [];
  for (const side of ['L', 'R']) {
    if (!a[side] || !b[side]) continue;
    const ba = M.bounds(a[side]), bb = M.bounds(b[side]);
    for (const f of levels) {
      const ra = ringAt(a[side], ba.min[1] + f * ba.size[1], ba.center, k, 1), rb = ringAt(b[side], bb.min[1] + f * bb.size[1], bb.center, k, 1);
      if (!ra || !rb) continue;
      ra.samples.forEach((p, i) => { if (p && rb.samples[i]) pairs.push([`lung:${side}:${f}:${i}`, p, rb.samples[i]]); });
    }
  }
  return pairs;
}

/**
 * Lower-chest and waist pairs for the male -> female rib-cage spline: radial samples on matching horizontal skin
 * cross-sections of the two bodies, at heights relative to each body's lungs (from 45 % of lung height below the lung
 * base up to 15 % above it, where the lower ribs are), lateral and posterior directions only (the front sector is
 * skipped: breasts and belly differ between the bodies). Levels whose torso loop still includes an arm are skipped.
 */
export function torsoPairs(maleSkin, femaleSkin, maleLungs, femaleLungs, { levels = [-0.45, -0.3, -0.15, 0, 0.15], k = 16, frontHalfAngle = 55, maxHalfWidth = 0.24 } = {}) {
  const torsoLoop = (skin, y) => {
    const loops = hLoops(skin, y).sort((a, b) => Math.abs(a.centroid[0]) - Math.abs(b.centroid[0]));
    const l = loops[0]; if (!l) return null;
    const half = Math.max(...l.points.map((p) => Math.abs(p[0] - l.centroid[0])));
    return half < maxHalfWidth ? l : null;
  };
  const a = M.bounds(maleLungs), b = M.bounds(femaleLungs); const pairs = [];
  for (const f of levels) {
    const la = torsoLoop(maleSkin, a.min[1] + f * a.size[1]), lb = torsoLoop(femaleSkin, b.min[1] + f * b.size[1]);
    if (!la || !lb) continue;
    const ra = ringSamples(la, la.centroid, [0, 1, 0], [0, 0, 1], k, 1), rb = ringSamples(lb, lb.centroid, [0, 1, 0], [0, 0, 1], k, 1);
    for (let i = 0; i < k; i++) {
      const ang = (i / k) * 360; if (Math.min(ang, 360 - ang) < frontHalfAngle) continue;
      if (ra[i] && rb[i]) pairs.push([`torso:${f}:${i}`, ra[i], rb[i]]);
    }
  }
  return pairs;
}

/**
 * The male -> female spline used for the SIO rib cage and shoulder girdle (and, in the close-up layer, the SIO trunk
 * muscles that lie on them): the organ spline's pairs plus lung cross-section pairs and lower-chest skin pairs.
 * Skins are the 150k-triangle ring skins (M.simplify(skin, 150000, { error: 0.005 })) of each body, HRA frames.
 */
export function ribCageSpline({ lmkMale, lmkFemale, extra, maleLungs, femaleLungs, maleSkin, femaleSkin }) {
  const lp = lungPairs(maleLungs, femaleLungs);
  const tp = torsoPairs(maleSkin, femaleSkin, maleLungs, femaleLungs);
  const s = maleToFemale(lmkMale, lmkFemale, [...extra, ...lp, ...tp]);
  return { ...s, lungPairs: lp.length, torsoPairs: tp.length };
}
