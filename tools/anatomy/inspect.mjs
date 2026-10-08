// Dev helper: print the node tree of a GLB with world-space bounds and triangle counts.
// Usage: node tools/anatomy/inspect.mjs <file.glb> [maxDepth]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/core';
import { MeshoptDecoder } from 'meshoptimizer';

const [file, maxDepthArg] = process.argv.slice(2);
const maxDepth = Number(maxDepthArg ?? 99);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(file);
const root = doc.getRoot();
const tris = (mesh) => mesh ? mesh.listPrimitives().reduce((n, p) => n + (p.getIndices() ? p.getIndices().getCount() / 3 : p.getAttribute('POSITION').getCount() / 3), 0) : 0;
function subtreeTris(node) { return tris(node.getMesh()) + node.listChildren().reduce((n, c) => n + subtreeTris(c), 0); }
function walk(node, depth) {
  if (depth > maxDepth) return;
  const b = getBounds(node);
  const f = (v) => v.map((x) => x.toFixed(3)).join(',');
  const t = node.getTranslation(), r = node.getRotation(), s = node.getScale();
  const xf = (t.some(Boolean) || r[3] !== 1 || s.some((x) => x !== 1)) ? ` T[${f(t)}] R[${f(r)}] S[${f(s)}]` : '';
  console.log(`${'  '.repeat(depth)}${node.getName()} tris=${subtreeTris(node)}${node.getMesh() ? ' (mesh)' : ''} min[${f(b.min)}] max[${f(b.max)}]${xf}`);
  for (const c of node.listChildren()) walk(c, depth + 1);
}
for (const scene of root.listScenes()) { console.log('SCENE', scene.getName()); for (const n of scene.listChildren()) walk(n, 0); }
console.log('meshes', root.listMeshes().length, 'nodes', root.listNodes().length, 'materials', root.listMaterials().length, 'extensionsUsed', root.listExtensionsUsed().map((e) => e.extensionName));
