// Write named triangle meshes into a GLB (optionally meshopt-compressed + quantized).
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { normals as computeNormals } from './mesh.mjs';

/**
 * @param {string} file output path
 * @param {Array<{name:string, mesh:{positions,indices}, color?:[r,g,b], opacity?:number, extras?:object}>} items
 * @param {{compress?:boolean, extras?:object}} opts
 */
export async function writeGLB(file, items, { compress = true, extras = {}, copyright = '' } = {}) {
  const doc = new Document();
  if (copyright) doc.getRoot().getAsset().copyright = copyright;
  doc.getRoot().getAsset().generator = 'PeptideScope tools/build-anatomy.mjs (glTF-Transform)';
  doc.createBuffer();
  const scene = doc.createScene('anatomy');
  scene.setExtras(extras);
  const root = doc.createNode('body');
  scene.addChild(root);
  for (const it of items) {
    const { positions, indices } = it.mesh;
    const nrm = computeNormals(it.mesh);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)));
    const mat = doc.createMaterial(it.name)
      .setBaseColorFactor([...(it.color || [0.8, 0.8, 0.8]), it.opacity ?? 1])
      .setRoughnessFactor(0.6).setMetallicFactor(0)
      .setAlphaMode((it.opacity ?? 1) < 1 ? 'BLEND' : 'OPAQUE')
      .setDoubleSided(false);
    prim.setMaterial(mat);
    const m = doc.createMesh(it.name).addPrimitive(prim);
    const node = doc.createNode(it.name).setMesh(m);
    if (it.extras) node.setExtras(it.extras);
    root.addChild(node);
  }
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  if (compress) {
    await MeshoptEncoder.ready;
    await doc.transform(
      reorder({ encoder: MeshoptEncoder, target: 'size' }),
      quantize({ quantizePosition: 14, quantizeNormal: 10, quantizationVolume: 'scene' }),
    );
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  }
  await io.write(file, doc);
}
