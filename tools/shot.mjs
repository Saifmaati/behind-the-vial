// Headless check: load a page in the installed Google Chrome (WebGL via SwiftShader),
// collect console errors / page errors / failed requests, run optional steps, and save screenshots.
//
// Usage:
//   node tools/shot.mjs <url> [--out dir] [--size 1440x900] [--wait 4000] [--dark|--light]
//                       [--reduced-motion] [--steps steps.json] [--mobile]
// steps.json: [{"wait":1000},{"click":"#enter"},{"eval":"document.title"},{"shot":"name"},{"key":"ArrowRight"},
//              {"scroll":"#sources"},{"waitFor":"#app.ready"}]
// Prints a JSON report to stdout. Screenshots are PNGs you can open with the Read tool.
import puppeteer from 'puppeteer-core';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.match(/^--(out|size|wait|steps)$/));
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes(`--${k}`);
if (!url) { console.error('usage: node tools/shot.mjs <url> [options]'); process.exit(2); }

const out = resolve(opt('out', 'tools/.cache/shots'));
await mkdir(out, { recursive: true });
const [w, h] = (flag('mobile') ? '390x844' : opt('size', '1440x900')).split('x').map(Number);
const steps = opt('steps') ? JSON.parse(await readFile(opt('steps'), 'utf8')) : [];

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check'],
});
const report = { url, size: `${w}x${h}`, errors: [], warnings: [], failed: [], shots: [], evals: [] };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: flag('mobile'), hasTouch: flag('mobile') });
  const media = [];
  if (flag('dark')) media.push({ name: 'prefers-color-scheme', value: 'dark' });
  if (flag('light')) media.push({ name: 'prefers-color-scheme', value: 'light' });
  if (flag('reduced-motion')) media.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  if (media.length) await page.emulateMediaFeatures(media);
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); else if (m.type() === 'warning') report.warnings.push(m.text()); });
  page.on('pageerror', e => report.errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', r => report.failed.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400) report.failed.push(`${r.status()} ${r.url()}`); });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  report.loadMs = Date.now() - t0;
  await new Promise(r => setTimeout(r, Number(opt('wait', 3000))));
  let n = 0;
  for (const s of steps) {
    if (s.wait) await new Promise(r => setTimeout(r, s.wait));
    if (s.waitFor) await page.waitForSelector(s.waitFor, { timeout: s.timeout || 30000 }).catch(e => report.errors.push(`waitFor ${s.waitFor}: ${e.message}`));
    if (s.click) await page.click(s.click).catch(e => report.errors.push(`click ${s.click}: ${e.message}`));
    if (s.key) await page.keyboard.press(s.key);
    if (s.type) await page.keyboard.type(s.type);
    if (s.scroll) await page.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), s.scroll);
    if (s.eval) report.evals.push({ expr: s.eval, value: await page.evaluate(s.eval).catch(e => `ERR ${e.message}`) });
    if (s.shot) { const p = join(out, `${s.shot}.png`); await page.screenshot({ path: p, fullPage: !!s.full }); report.shots.push(p); }
    n++;
  }
  if (!steps.some(s => s.shot)) { const p = join(out, 'shot.png'); await page.screenshot({ path: p }); report.shots.push(p); }
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
