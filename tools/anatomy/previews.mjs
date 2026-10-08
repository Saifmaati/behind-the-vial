#!/usr/bin/env node
// Regenerate docs/anatomy-previews/*.png from the sandbox (dev-only).
// Usage: node tools/anatomy/previews.mjs [port=8806] [--sex female]   (female: docs/anatomy-previews/female-*.png)
// Starts tools/serve.mjs on the port, captures each view with tools/shot.mjs (headless Chrome), quantizes the PNGs
// to 256 colours (each <= 250 KB), and stops the server.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, quantize, encodeIndexed } from './pngquant.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const argv = process.argv.slice(2);
const FEMALE = argv.includes('female') || argv.includes('--sex=female');
const PORT = Number(argv.find((a) => /^\d+$/.test(a)) || 8806);
const OUT = join(ROOT, 'docs/anatomy-previews');
const TMP = join(ROOT, 'tools/.cache/shots/anatomy/previews');
const PREVIEWS_MALE = {
  front: 'view=front&layers=skin,organs,vessels,sites&theme=dark',
  side: 'view=side&layers=skin,organs,vessels,sites&theme=dark',
  'three-quarter': 'view=threequarter&layers=skin,organs,vessels,skeleton,sites&theme=dark&focus=torso',
  'flow-paths': 'view=front&layers=skin,organs,paths,sites&theme=dark&pathr=0.0026',
  'organ-landmarks': 'view=front&layers=skin,organs,labels,sites&theme=dark&focus=torso',
  'light-theme': 'view=threequarter&layers=skin,organs,vessels,sites&theme=light',
};
const PREVIEWS = FEMALE ? {
  'female-front': 'sex=female&view=front&layers=skin,organs,vessels,sites&theme=dark',
  'female-side': 'sex=female&view=side&layers=skin,organs,vessels,sites&theme=dark',
  'female-three-quarter': 'sex=female&view=threequarter&layers=skin,organs,vessels,skeleton,sites&theme=dark&focus=torso',
  'female-flow-paths': 'sex=female&view=front&layers=skin,organs,paths,sites&theme=dark&pathr=0.0026',
} : PREVIEWS_MALE;

mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
const steps = join(TMP, 'steps.json');
writeFileSync(steps, JSON.stringify([{ waitFor: 'body[data-ready]', timeout: 120000 }, { wait: 800 }, { shot: 'preview' }]));
const server = spawn(process.execPath, [join(ROOT, 'tools/serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let failed = false;
try {
  for (const [name, query] of Object.entries(PREVIEWS)) {
    const dir = join(TMP, name);
    const out = execFileSync(process.execPath, [join(ROOT, 'tools/shot.mjs'), `http://127.0.0.1:${PORT}/tools/sandbox/anatomy.html?${query}&ui=0`, '--out', dir, '--size', '900x1100', '--wait', '500', '--steps', steps], { cwd: join(ROOT, 'tools') }).toString();
    const report = JSON.parse(out.slice(out.indexOf('{')));
    if (report.errors.length || report.failed.length) { failed = true; console.error(name, report.errors, report.failed); }
    const png = encodeIndexed(quantize(decodePNG(readFileSync(join(dir, 'preview.png'))), 256));
    const file = join(OUT, `${name}.png`); writeFileSync(file, png);
    const kb = statSync(file).size / 1024; if (kb > 250) { failed = true; console.error(`${name}.png is ${kb.toFixed(0)} KB (> 250 KB)`); }
    console.log(`${name}.png ${kb.toFixed(0)} KB, console errors ${report.errors.length}`);
  }
} finally { server.kill(); }
process.exitCode = failed ? 1 : 0;
