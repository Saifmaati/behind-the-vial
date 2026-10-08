// Dev-only: drive js/main.js end to end with mock intro/scene modules (request interception),
// so the shell wiring can be verified before the real modules land.
// Usage: node tools/sandbox/foundation-flow.mjs http://127.0.0.1:8801/ [--out dir] [--mobile]
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith('--')) || 'http://127.0.0.1:8801/';
const oi = args.indexOf('--out');
const out = resolve(oi >= 0 ? args[oi + 1] : 'tools/.cache/shots/foundation/flow');
const mobile = args.includes('--mobile');
await mkdir(out, { recursive: true });

const MOCK_SCENE = `
import { bus } from '../bus.js';
export async function mountBody(host, opts) {
  const log = (window.__mock = { opts, seen: [] });
  for (const t of ['peptide:loaded','site:select','time:change','effects:active','risk:change','theme:change','motion:change','sequence:start'])
    bus.on(t, () => log.seen.push(t));
  const c = document.createElement('canvas');
  host.querySelector('#stage-canvas-host').append(c);
  bus.on('sequence:start', async () => {
    for (const phase of ['syringe','depot','absorption','bloodstream','distribution']) {
      bus.emit('sequence:phase', { phase });
      await new Promise((r) => setTimeout(r, 250));
    }
    bus.emit('sequence:phase', { phase: 'done' });
    bus.emit('sequence:done', {});
  });
  await new Promise((r) => setTimeout(r, 300));
  bus.emit('stage:ready', {});
  return { dispose() {} };
}`;
const MOCK_INTRO = `
export function mountIntro(host, { onEnter, onFacts }) {
  window.__introMounted = true;
  host.querySelector('#intro-enter').addEventListener('click', () => setTimeout(onEnter, 300));
  host.querySelector('#intro-facts').addEventListener('click', () => setTimeout(onFacts, 300));
  return { dispose() { window.__introDisposed = true; } };
}`;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run'],
});
const report = { errors: [], failed: [], checks: [], shots: [] };
const check = (name, ok, info) => report.checks.push({ name, ok: !!ok, ...(info !== undefined ? { info } : {}) });
try {
  const page = await browser.newPage();
  await page.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.endsWith('/js/scene/index.js')) return req.respond({ status: 200, contentType: 'text/javascript', body: MOCK_SCENE });
    if (u.pathname.endsWith('/js/intro.js')) return req.respond({ status: 200, contentType: 'text/javascript', body: MOCK_INTRO });
    return req.continue();
  });
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('pageerror', (e) => report.errors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) report.failed.push(`${r.status()} ${r.url()}`); });
  const shot = async (name) => { const p = join(out, `${name}.png`); await page.screenshot({ path: p }); report.shots.push(p); };
  const q = (fn) => page.evaluate(fn);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await page.goto(base, { waitUntil: 'load' });
  await sleep(1200);
  check('intro shown on first visit', await q(() => document.documentElement.dataset.intro === 'show'));
  check('mock intro mounted', await q(() => window.__introMounted === true));
  check('app inert under intro', await q(() => document.querySelector('#app').inert === true));
  check('stage not mounted during intro', await q(() => !window.__mock));

  await page.click('#intro-enter');
  await sleep(150);
  check('intro still open while intro.js plays its exit', await q(() => document.documentElement.dataset.intro === 'show'));
  await page.waitForFunction(() => document.documentElement.dataset.intro === 'done', { timeout: 5000 }).catch(() => {});
  check('intro closed via onEnter', await q(() => document.documentElement.dataset.intro === 'done'), await q(() => document.documentElement.dataset.intro));
  check('intro disposed', await q(() => window.__introDisposed === true));
  check('focus on explorer heading', await q(() => document.activeElement?.id === 'explorer-title'));

  await page.waitForFunction(() => document.querySelector('#stage-host').dataset.state === 'ready', { timeout: 15000 }).catch(() => {});
  check('stage ready', await q(() => document.querySelector('#stage-host').dataset.state === 'ready'));
  check('mountBody got theme + reducedMotion', await q(() => window.__mock?.opts?.theme === 'dark' && window.__mock?.opts?.reducedMotion === false));
  check('missed peptide:loaded replayed to the scene', await q(() => window.__mock?.seen.includes('peptide:loaded')), await q(() => window.__mock?.seen));
  check('Inject disabled until a site is chosen', await q(() => document.querySelector('#play-sequence').getAttribute('aria-disabled') === 'true'), await q(() => document.querySelector('#play-hint').textContent));

  await page.click('#site-picker [data-site="abdomen"]');
  await sleep(300);
  check('site written to URL', await q(() => new URLSearchParams(location.search).get('site') === 'abdomen'));
  check('Inject enabled', await q(() => document.querySelector('#play-sequence').getAttribute('aria-disabled') === 'false'), await q(() => document.querySelector('#play-hint').textContent));
  check('HUD shows site', await q(() => document.querySelector('#hud-site').textContent === 'Abdomen'));
  await shot('ready');

  await page.click('#play-sequence');
  await sleep(700);
  check('button shows Playing', await q(() => document.querySelector('#play-sequence .btn-label').textContent.startsWith('Playing')));
  check('phase track active', await q(() => !!document.querySelector('.phase-track li[data-state="active"]')));
  await shot('playing');
  await sleep(1600);
  check('button shows Replay after done', await q(() => document.querySelector('#play-sequence .btn-label').textContent === 'Replay'));
  check('narration shows done text', await q(() => document.querySelector('#narration-phase').textContent), await q(() => document.querySelector('#narration-phase').textContent));
  await shot('done');

  await page.click('#theme-toggle');
  await sleep(200);
  check('theme:change reached scene', await q(() => window.__mock.seen.includes('theme:change')));
  await page.click('#motion-toggle');
  await sleep(100);
  check('motion:change emitted', await q(() => window.__mock.seen.includes('motion:change')));
  await shot('light');

  // Coming-soon peptide disables Inject and hides the timeline behind a notice.
  const soon = await q(() => {
    const b = [...document.querySelectorAll('#peptide-picker [role="radio"]')].find((n) => !/retatrutide/i.test(n.textContent));
    b?.click();
    return b?.textContent?.trim().split(/\s+/)[0];
  });
  await sleep(600);
  check(`coming-soon (${soon}) disables Inject`, await q(() => document.querySelector('#play-sequence').getAttribute('aria-disabled') === 'true'), await q(() => document.querySelector('#play-hint').textContent));
  check('timeline notice shown', await q(() => !document.querySelector('#timeline-notice').hidden && document.querySelector('#timeline').hidden));
  check('peptide written to URL', await q(() => !!new URLSearchParams(location.search).get('peptide')));
  await shot('coming-soon');
} finally {
  await browser.close();
}
report.pass = report.checks.filter((c) => c.ok).length;
report.fail = report.checks.filter((c) => !c.ok).map((c) => c.name);
console.log(JSON.stringify(report, null, 2));
