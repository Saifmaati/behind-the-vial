#!/usr/bin/env node
// Regenerate docs/anatomy-previews/detail-*.png from tools/sandbox/anatomy-detail.html (dev-only).
// Usage: node tools/anatomy-detail/previews.mjs [port=8825] [female]   (female: docs/anatomy-previews/detail-female-*.png)
// Starts tools/serve.mjs on the port, captures each view with tools/shot.mjs (headless Chrome, software WebGL),
// quantizes the PNGs to 160 colours (each <= 250 KB) and stops the server.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, quantize, encodeIndexed } from '../anatomy/pngquant.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PORT = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 8825);
const FEMALE = process.argv.includes('female') || process.argv.includes('--sex=female');
const OUT = join(ROOT, 'docs/anatomy-previews');
const TMP = join(ROOT, 'tools/.cache/shots/anatomy-detail/previews');
const PREVIEWS_MALE = {
  'detail-muscles-front': 'skin=ghost&layers=muscles,skeleton&view=front',
  'detail-muscles-back': 'skin=ghost&layers=muscles,skeleton&view=back',
  'detail-muscles-torso': 'skin=off&layers=muscles,skeleton,eyes&view=threequarter&focus=torso',
  'detail-labels': 'skin=off&layers=muscles,skeleton&view=front&focus=torso&labels=1',
  'detail-overlay': 'skin=glass&layers=muscles,vessels&view=threequarter&focus=torso',
  'detail-skin-face': 'skin=real&focus=face',
  'detail-skin-abdomen': 'skin=real&focus=abdomen',
  'detail-thigh-deep': 'skin=off&layers=muscles,skeleton&focus=thigh&view=threequarter&dist=1.1&hide=muscle_sartorius,muscle_rectus_femoris,muscle_tensor_fasciae_latae',
};
const F = 'body=/assets/anatomy/body-female.glb&detail=/assets/anatomy/detail-female.glb&atlas=/assets/anatomy/atlas-female.json&landmarks=/assets/anatomy/landmarks-female.json';
const PREVIEWS = FEMALE ? {
  'detail-female-muscles-front': `${F}&skin=ghost&layers=muscles,skeleton&view=front`,
  'detail-female-muscles-back': `${F}&skin=ghost&layers=muscles,skeleton&view=back`,
  'detail-female-muscles-torso': `${F}&skin=off&layers=muscles,skeleton&view=threequarter&focus=torso`,
  'detail-female-skeleton': `${F}&skin=ghost&layers=skeleton&view=threequarter&focus=torso`,
  'detail-female-skin-abdomen': `${F}&skin=real&focus=abdomen`,
} : PREVIEWS_MALE;
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
const steps = join(TMP, 'steps.json');
writeFileSync(steps, JSON.stringify([{ waitFor: 'body[data-ready]', timeout: 240000 }, { wait: 800 }, { shot: 'preview' }]));
const server = spawn(process.execPath, [join(ROOT, 'tools/serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let failed = false;
try {
  for (const [name, query] of Object.entries(PREVIEWS)) {
    const dir = join(TMP, name);
    const out = execFileSync(process.execPath, [join(ROOT, 'tools/shot.mjs'), `http://127.0.0.1:${PORT}/tools/sandbox/anatomy-detail.html?${query}&theme=dark&ui=0`, '--out', dir, '--size', '820x1000', '--wait', '500', '--steps', steps], { cwd: join(ROOT, 'tools') }).toString();
    const report = JSON.parse(out.slice(out.indexOf('{')));
    if (report.errors.length || report.failed.length) { failed = true; console.error(name, report.errors, report.failed); }
    const png = encodeIndexed(quantize(decodePNG(readFileSync(join(dir, 'preview.png'))), 160));
    const file = join(OUT, `${name}.png`); writeFileSync(file, png);
    const kb = statSync(file).size / 1024; if (kb > 250) { failed = true; console.error(`${name}.png is ${kb.toFixed(0)} KB (> 250 KB)`); }
    console.log(`${name}.png ${kb.toFixed(0)} KB, console errors ${report.errors.length}`);
  }
} finally { server.kill(); }
process.exitCode = failed ? 1 : 0;
