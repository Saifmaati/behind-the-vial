// Traceability check for one data module while writing it.
//   node tools/trace.mjs data/retatrutide/core.js [exportName]
// Prints every problem (see tests/traceability.test.mjs for the rules) and exits 1 if any.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadLedger, checkRoot } from './trace-lib.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const file = process.argv[2];
if (!file) { console.error('usage: node tools/trace.mjs <data module> [exportName]'); process.exit(2); }
const mod = await import(pathToFileURL(resolve(file)).href + `?t=${Date.now()}`);
const name = process.argv[3];
let root = name ? mod[name] : (mod.default ?? mod);
if (Array.isArray(root)) root = root.map(x => (x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'load')) : x));
const claims = loadLedger(`${ROOT}research/claims.json`);
let ids = null;
try { ids = new Set(Object.keys((await import(pathToFileURL(`${ROOT}data/sources.js`).href)).SOURCES)); } catch { /* sources not generated yet */ }
const problems = checkRoot(file, root, claims, ids);
console.log(problems.length ? problems.join('\n') : `OK: ${file} traces cleanly`);
process.exit(problems.length ? 1 : 0);
