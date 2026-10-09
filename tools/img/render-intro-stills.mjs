// Renders the intro's two anatomy stills from our own 3D scene (the sandbox), light and dark:
//   assets/img/intro-body-{800,1600}.webp, intro-body-4x5-{640,1280}.webp       whole body, see-through skin, organs
//   assets/img/intro-organs-{800,1600}.webp, intro-organs-4x5-{640,1280}.webp   head and torso, the organs the drug
//                                                                              acts on in soft violet
//   … and the same with a -dark suffix before the width (dark stage background), e.g. intro-body-dark-1600.webp
//   assets/img/body-poster.webp, body-poster-dark.webp                           the no-WebGL fallback picture
//   (ONLY=body-poster,intro-body … renders a subset)
//
// v4 fix (owner: "no fake-looking blood vessels in the intro"): the blood-vessel layer is OFF in every still;
// only the see-through skin and the organs show. No injection-site rings, labels or HUD.
//
// Usage: node tools/serve.mjs 8849 &   then   node tools/img/render-intro-stills.mjs http://127.0.0.1:8849
// Rendered at 2× in headless Chrome (SwiftShader WebGL), downsampled with Lanczos3, WebP, ≤ 200 KB each.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const puppeteer = require('puppeteer-core');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = process.env.STILLS_OUT || join(ROOT, 'assets', 'img');
const BASE = process.argv[2] || 'http://127.0.0.1:8849';
const BUDGET = { large: 200 * 1024, small: 90 * 1024 };

// Organs the retatrutide entry lists as targets (data/retatrutide/core.js), the ones the intro line names.
const ORGANS = ['brain', 'stomach', 'heart', 'liver', 'pancreas'];
const VIOLET = { light: 0x6246ea, dark: 0xb3a4ff };

const SHOTS = [
  // 16:9 frames (the wide intro layout)
  { name: 'intro-body', vw: 1600, vh: 900, widths: [800, 1600], view: 'body' },
  { name: 'intro-organs', vw: 1600, vh: 900, widths: [800, 1600], view: 'organs' },
  // 4:5 frames (phones and portrait tablets)
  { name: 'intro-body-4x5', vw: 800, vh: 1000, widths: [640, 1280], view: 'body' },
  { name: 'intro-organs-4x5', vw: 800, vh: 1000, widths: [640, 1280], view: 'organs' },
  // the no-WebGL fallback picture (#stage-fallback): the default stage view, one file per theme
  { name: 'body-poster', vw: 1600, vh: 1000, widths: [1600], view: 'poster', plain: true },
].filter((s) => !process.env.ONLY || process.env.ONLY.split(',').includes(s.name));

async function encode(buf, w, budget) {
  for (let q = 90; q >= 60; q -= 4) {
    const out = await sharp(buf).resize({ width: w, kernel: 'lanczos3' }).webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer();
    if (out.length <= budget || q <= 60) return { out, q };
  }
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check'],
});
const rows = [];
try {
  for (const theme of ['light', 'dark']) {
    for (const s of SHOTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: s.vw, height: s.vh, deviceScaleFactor: 2 });
      page.on('pageerror', (e) => console.error('pageerror', e.message));
      await page.goto(`${BASE}/tools/sandbox/body3d.html?poster=1&theme=${theme}&nodetail=1&rm=1&quality=high`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForSelector('html.sb-ready', { timeout: 120000 });
      await page.evaluate(async ({ view, organs, violet }) => {
        const { body, setView } = window.__sb;
        // see-through skin, organs, NO vessels, no skeleton (the poster keeps the stage's default look)
        if (view !== 'poster') setView({ xray: 1, layers: { skin: true, organs: true, vessels: false, skeleton: false } });
        body.anatomy.setHotspotsVisible(false);
        body.callouts.clear();
        const st = body.stage;
        if (view === 'organs') {
          for (const o of organs) body.anatomy.highlight(o, { channel: 'focus', color: violet, intensity: 0.9, pulse: 0 });
          const top = st.homeTarget.clone();
          await st.flyTo({ target: [0, top.y * 1.45, 0], distance: st.homeDistance * 0.5, azimuth: 0, elevation: 2, duration: 0 });
        } else {
          await st.flyTo({ target: st.homeTarget.toArray(), distance: st.homeDistance * 0.94, azimuth: 0, elevation: 2, duration: 0 });
        }
        st.advance?.(2, 1 / 30);
        st.advance?.(1, 1 / 30);
      }, { view: s.view, organs: ORGANS, violet: VIOLET[theme] });
      await new Promise((r) => setTimeout(r, 1500));
      const png = await page.screenshot({ type: 'png' });
      await page.close();
      for (const w of s.widths) {
        const budget = w >= 1200 ? BUDGET.large : BUDGET.small;
        const { out, q } = await encode(png, w, budget);
        const file = `${s.name}${theme === 'dark' ? '-dark' : ''}${s.plain ? '' : `-${w}`}.webp`;
        await writeFile(join(OUT, file), out);
        rows.push({ file, kb: (out.length / 1024).toFixed(1), q, ok: out.length <= budget });
      }
    }
  }
} finally {
  await browser.close();
}
console.table(rows);
if (rows.some((r) => !r.ok)) process.exitCode = 1;
