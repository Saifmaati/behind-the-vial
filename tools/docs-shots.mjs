// Regenerates the README screenshots in docs/screenshots/ (JPEG, same names and sizes every time).
// Headless Chrome with software WebGL, like tools/shot.mjs; needs the dev server running.
//
// Usage:
//   node tools/serve.mjs 8849 &
//   node tools/docs-shots.mjs http://127.0.0.1:8849 [--only name,name]
// Prints one line per shot and exits non-zero when a page logged a console error.
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/screenshots');
const base = (process.argv[2] || 'http://127.0.0.1:8849').replace(/\/$/, '');
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(',')) : null;

const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844, mobile: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- step helpers (each receives the puppeteer page)
const ready = async (p) => { await p.waitForSelector('#stage-host[data-state="ready"]', { timeout: 180000 }); await sleep(1500); };
const next = (n) => async (p) => { for (let i = 0; i < n; i++) { await p.click('.intro-next'); await sleep(900); } await sleep(1800); };
const click = (sel, ms = 1200) => async (p) => { await p.click(sel); await sleep(ms); };
const phase = (text, ms = 600) => async (p) => {
  await p.waitForFunction((t) => document.querySelector('#narration-phase')?.textContent.trim() === t, { timeout: 90000, polling: 100 }, text);
  await sleep(ms);
};
const top = async (p) => { await p.evaluate(() => window.scrollTo(0, 0)); await sleep(500); };
const scrollTo = (sel, ms = 900) => async (p) => { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel); await sleep(ms); };
const pick = (site) => [click('[data-peptide-id="retatrutide"]'), click(`.c-site[data-site="${site}"]`, 3000)];
const watch = (site, at, ms) => [ready, ...pick(site), click('#play-sequence', 200), phase(at, ms)];

const SHOTS = [
  { name: 'intro-first', url: '/', size: DESK, steps: [async () => sleep(1500)] },
  { name: 'intro-vial', url: '/', size: DESK, steps: [next(1)] },
  { name: 'intro-syringe', url: '/', size: DESK, steps: [next(3)] },
  { name: 'intro-blood', url: '/', size: DESK, steps: [next(5)] },
  { name: 'intro-end', url: '/', size: DESK, steps: [next(8)] },
  { name: 'mobile-intro', url: '/', size: PHONE, steps: [async () => sleep(1500)] },
  { name: 'explorer-light', url: '/?skip-intro', size: DESK, steps: [ready] },
  { name: 'explorer-dark', url: '/?skip-intro', size: DESK, dark: true, steps: [ready, ...pick('abdomen')] },
  { name: 'step-2-site', url: '/?skip-intro', size: DESK, steps: [ready, click('[data-peptide-id="retatrutide"]', 2000)] },
  { name: 'inject-thigh', url: '/?skip-intro', size: DESK, steps: watch('thigh', 'The shot', 1600) },
  { name: 'inject-abdomen', url: '/?skip-intro', size: DESK, steps: watch('abdomen', 'Under the skin', 700) },
  { name: 'inject-upper-arm', url: '/?skip-intro', size: DESK, steps: watch('arm', 'Into the blood', 900) },
  {
    name: 'timeline', url: '/?skip-intro', size: DESK,
    steps: [...watch('abdomen', 'The shot', 300), click('.stage-skip', 2500), scrollTo('.explorer-after', 600),
      async (p) => { await p.evaluate(() => [...document.querySelectorAll('.tl-mile')].find((b) => /Peak/.test(b.textContent))?.click()); await sleep(2500); }],
  },
  {
    name: 'body-editor-female', url: '/?skip-intro', size: DESK,
    steps: [ready, click('.stage-body-btn', 1500), click('.be-sex [data-female]', 5000),
      click('.be-tab[data-tab="layers"]', 600), click('.lp-end[data-x="0"]', 2000), click('.be-tab[data-tab="shape"]', 1500)],
  },
  { name: 'learn-cards', url: '/?skip-intro&no3d', size: DESK, steps: [scrollTo('#learn')] },
  { name: 'learn-gray-market', url: '/?skip-intro&no3d', size: DESK, steps: [scrollTo('#learn'), click('[data-open="gray-market"]', 1500)] },
  { name: 'learn-protect', url: '/?skip-intro&no3d', size: DESK, steps: [scrollTo('#learn'), click('[data-open="protect"]', 1500)] },
  {
    name: 'mobile-explorer', url: '/?skip-intro', size: PHONE,
    steps: [ready, ...pick('abdomen'), click('#play-sequence', 200), phase('The shot', 300), click('.stage-skip', 3000), top],
  },
];

await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check'],
});
let failed = 0;
try {
  for (const s of SHOTS) {
    if (only && !only.has(s.name)) continue;
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.setViewport({ width: s.size.width, height: s.size.height, deviceScaleFactor: 1, isMobile: !!s.size.mobile, hasTouch: !!s.size.mobile });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: s.dark ? 'dark' : 'light' }]);
    try {
      await page.goto(base + s.url, { waitUntil: 'load', timeout: 60000 });
      await sleep(1000);
      for (const step of s.steps) await step(page);
      const png = await page.screenshot({ type: 'png' });
      await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(join(outDir, `${s.name}.jpg`));
    } catch (e) { errors.push(`step failed: ${e.message}`); }
    await page.close();
    if (errors.length) failed++;
    console.log(`${errors.length ? 'FAIL' : 'ok  '} ${s.name}${errors.length ? `  ${errors.join(' | ')}` : ''}`);
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
