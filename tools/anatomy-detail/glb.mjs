// GLB writer/reader for the close-up detail layer (dev-only).
// Same approach as tools/anatomy/glb.mjs (meshopt reorder + KHR_mesh_quantization + EXT_meshopt_compression with
// a scene-wide quantization volume), plus optional per-vertex colours (COLOR_0), per-item material settings and
// configurable quantization bits for close-range viewing.
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { normals as computeNormals } from '../anatomy/mesh.mjs';

/**
 * @param {string} file
 * @param {Array<{name, mesh:{positions,indices}, normals?:Float32Array, colors?:Uint8Array(rgb), color?:[r,g,b],
 *   roughness?:number, metalness?:number, opacity?:number, doubleSided?:boolean, extras?:object}>} items
 */
export async function writeDetailGLB(file, items, { extras = {}, copyright = '', generator = 'PeptideScope tools/build-anatomy-detail.mjs (glTF-Transform)', positionBits = 14, normalBits = 10 } = {}) {
  const doc = new Document();
  const asset = doc.getRoot().getAsset();
  if (copyright) asset.copyright = copyright;
  asset.generator = generator;
  doc.createBuffer();
  const scene = doc.createScene('anatomy-detail');
  scene.setExtras(extras);
  const root = doc.createNode('body_detail');
  scene.addChild(root);
  for (const it of items) {
    const { positions, indices } = it.mesh;
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(it.normals || computeNormals(it.mesh)))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)));
    if (it.colors) {
      // linear-space RGB floats, quantized to normalized unsigned bytes below
      const n = positions.length / 3; const c = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) c[i] = srgbToLinear(it.colors[i] / 255);
      prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(c));
    }
    const mat = doc.createMaterial(it.name)
      .setBaseColorFactor([...(it.color || [0.8, 0.8, 0.8]), it.opacity ?? 1])
      .setRoughnessFactor(it.roughness ?? 0.6).setMetallicFactor(it.metalness ?? 0)
      .setAlphaMode((it.opacity ?? 1) < 1 ? 'BLEND' : 'OPAQUE')
      .setDoubleSided(!!it.doubleSided);
    prim.setMaterial(mat);
    const m = doc.createMesh(it.name).addPrimitive(prim);
    const node = doc.createNode(it.name).setMesh(m);
    if (it.extras) node.setExtras(it.extras);
    root.addChild(node);
  }
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  await MeshoptEncoder.ready;
  await doc.transform(
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({ quantizePosition: positionBits, quantizeNormal: normalBits, quantizeColor: 8, quantizationVolume: 'scene' }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(file, doc);
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Read a (meshopt-compressed, quantized) GLB: { name: { positions (world space, Float32), indices, extras } }. */
export async function readGLBMeshes(file) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(file);
  const out = {};
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const e = node.getWorldMatrix();
    const parts = [];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'); const n = pos.getCount(); const p = new Float32Array(n * 3); const el = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        pos.getElement(i, el); // getElement de-normalizes normalized integer accessors
        p[i * 3] = e[0] * el[0] + e[4] * el[1] + e[8] * el[2] + e[12];
        p[i * 3 + 1] = e[1] * el[0] + e[5] * el[1] + e[9] * el[2] + e[13];
        p[i * 3 + 2] = e[2] * el[0] + e[6] * el[1] + e[10] * el[2] + e[14];
      }
      const ind = prim.getIndices(); const idx = ind ? Uint32Array.from(ind.getArray()) : Uint32Array.from({ length: n }, (_, i) => i);
      parts.push({ positions: p, indices: idx });
    }
    let nv = 0; for (const q of parts) nv += q.positions.length;
    let ni = 0; for (const q of parts) ni += q.indices.length;
    const positions = new Float32Array(nv), indices = new Uint32Array(ni); let ov = 0, oi = 0;
    for (const q of parts) { positions.set(q.positions, ov); for (let i = 0; i < q.indices.length; i++) indices[oi + i] = q.indices[i] + ov / 3; ov += q.positions.length; oi += q.indices.length; }
    out[node.getName()] = { positions, indices, extras: node.getExtras() };
  }
  return out;
}
