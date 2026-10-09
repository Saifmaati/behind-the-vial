// Cache-busting for GitHub Pages (which caches every file for ~10 minutes).
// Without this, a visitor who returns right after a deploy can run a mix of old and new modules.
//
//   node tools/stamp.mjs          rewrite index.html stamps from current file contents
//   node tools/stamp.mjs --check  exit 1 if any stamp is stale (used by tests/stamp.test.mjs)
//
// Every first-party module (js/**, data/**) gets an import-map entry "./path.js" → "./path.js?v=<hash>".
// Import maps also remap relative imports inside modules (they match on the resolved URL), so the whole
// module graph is versioned without touching any import statement. Stylesheets, the entry script and
// modulepreload links get the same ?v=<hash> suffix. Hash = first 10 hex chars of the file's SHA-256.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INDEX = join(ROOT, 'index.html');
const hash = p => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex').slice(0, 10);

function walk(dir, out = []) {
  for (const n of readdirSync(join(ROOT, dir)).sort()) {
    const rel = `${dir}/${n}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(m?js)$/.test(n)) out.push(rel);
  }
  return out;
}

export function stampedHtml(html) {
  const modules = [...walk('js'), ...walk('data')];
  const map = { imports: { three: './vendor/three/three.module.min.js', 'three/addons/': './vendor/three/addons/' } };
  for (const m of modules) map.imports[`./${m}`] = `./${m}?v=${hash(m)}`;
  const json = JSON.stringify(map, null, 2).replace(/\n/g, '\n    ');
  let out = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">\n    ${json}\n  </script>`);
  // Stylesheets, modulepreload and the entry script: href/src="./x?v=..." with a fresh hash.
  out = out.replace(/((?:href|src)=")\.\/((?:css|js)\/[\w./-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")/g,
    (_, a, path, z) => `${a}./${path}?v=${hash(path)}${z}`);
  return out;
}

const html = readFileSync(INDEX, 'utf8');
const next = stampedHtml(html);
if (process.argv.includes('--check')) {
  if (next !== html) { console.error('index.html stamps are stale: run node tools/stamp.mjs'); process.exit(1); }
  console.log('stamps current');
} else {
  writeFileSync(INDEX, next);
  console.log(`stamped ${relative(ROOT, INDEX)}`);
}
