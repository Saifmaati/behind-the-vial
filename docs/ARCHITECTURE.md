# PeptideScope: architecture and module contract

This file is the shared contract every module is built against. If you change a
public API or DOM id listed here, update this file in the same commit.

## Product in one paragraph

An education-only web app. A cinematic intro hands the visitor into an
interactive, translucent 3D human body. They pick a peptide (retatrutide is the
full entry; 20 others are "coming soon"), pick an injection site (abdomen,
thigh, upper arm), and watch: syringe → depot under the skin → slow absorption
into capillaries → bloodstream → the organs the drug acts on. A scrubbable
timeline (onset, peak, clearance, from real pharmacology, normalized, never in
mg) drives side effects that appear at the organ they come from, each with
"why it happens" and "how to reduce it / when it passes". Content panels cover
status, mechanism, red flags (call 911 vs see a doctor today), too-much /
overdose, fixed cited trial dose-arm facts, evidence strength, creator claims
vs evidence, gray-market vial tests, a warnings-only personal risk check, and
every source.

## Hard exclusions (enforced by tests/exclusions.test.mjs)

- No dose calculator, dose slider, dose input, weight/sex/bloodwork → dose.
- No personalized dosing, mg/kg, titration or step-up schedules, injection
  amounts, reconstitution/mixing, or injection technique instructions.
- No "safe dose" zones; no control where the user sets a dose.
- Dose-response appears only as fixed, cited trial facts (studied arms and how
  side effects and dropouts rose with dose). Never interactive.
- The risk check only ever shows warnings. It never says safe / cleared / OK /
  low risk / "you can", and never outputs a dose.
- The timeline's only control is TIME since injection (normalized level, % of
  peak). Its label must never say dose.
- Syringe barrel tick marks carry no numbers or units.
- Never use green "safe" colors for outcomes.

## Stack

- Static site on GitHub Pages, served from the repo root of `main`
  (`.nojekyll`). URL: https://saifmaati.github.io/peptidescope/
- Vanilla ES modules, no bundler, no runtime npm dependencies.
- three.js r185.1 vendored in `vendor/three/` (MIT). Import map in
  `index.html`:
  `"three": "./vendor/three/three.module.min.js"`,
  `"three/addons/": "./vendor/three/addons/"`.
  Available addons: loaders/GLTFLoader, utils/BufferGeometryUtils,
  utils/SkeletonUtils, libs/meshopt_decoder.module, controls/OrbitControls,
  postprocessing/{EffectComposer, RenderPass, UnrealBloomPass, OutputPass,
  ShaderPass, MaskPass, Pass, SMAAPass, FXAAPass},
  shaders/{CopyShader, LuminosityHighPassShader, OutputShader, FXAAShader,
  SMAAShader}, environments/RoomEnvironment, geometries/RoundedBoxGeometry.
  Need another? Copy it from `tools/.cache/three/package/examples/jsm/`
  keeping its path, and list it in `ASSETS.md`.
- All paths relative (the site lives under `/peptidescope/`).
- Dev-only tooling lives in `tools/` (own package.json, never shipped).

## Dev loop

- Serve: `node tools/serve.mjs 8790` → http://127.0.0.1:8790/ (any free port
  works; pick your own if 8790 is taken).
- Headless check with real Chrome + WebGL (SwiftShader):
  `node tools/shot.mjs http://127.0.0.1:8790/ --size 1440x900 --wait 4000 --out tools/.cache/shots/<name> [--dark|--light] [--reduced-motion] [--mobile] [--steps steps.json]`
  It prints console errors, failed requests, and saves PNGs you can open with
  the Read tool. `steps.json` supports wait, waitFor, click, key, type,
  scroll, eval, shot.
- Tests: `node --test tests/` (zero dependencies).

## File layout and ownership

```
index.html                 page skeleton, import map, all section ids (foundation)
css/tokens.css             design tokens, light/dark, typography (foundation)
css/app.css                layout, header, stage, controls, footer, disclaimer (foundation)
css/intro.css              intro overlay (intro)
css/content.css            content sections, cards, tables, charts (content)
css/stage.css              #stage-host internals, #callout-layer, tissue labels (body3d)
css/timeline.css           #timeline and #active-effects (timeline)
js/main.js                 boot, theme, routing, lazy loading, wiring (foundation, then integration)
js/bus.js                  tiny event bus (foundation)
js/intro.js                cinematic landing (intro)
js/scene/syringe.js        procedural realistic syringe (intro; reused by injection)
js/scene/stage.js          renderer, camera, controls, post, loop (body3d)
js/scene/anatomy.js        loads assets/anatomy/*, materials, organ registry, highlights (body3d)
js/scene/vessels.js        flow paths, glowing vessel lines, blood + drug particles (body3d)
js/scene/injection.js      syringe → depot → capillaries → blood → organs sequence (body3d)
js/scene/callouts.js       screen-space labels anchored to 3D points (body3d)
js/scene/index.js          mountBody(): creates stage+anatomy+vessels+injection+callouts and does ALL bus wiring for the 3D side (body3d)
js/pk.js                   pure pharmacokinetic math, normalized (timeline)
js/timeline.js             scrubber UI + SVG level curve + phase markers (timeline)
js/effects.js              timeline time → active side effects → organ highlights + cards (timeline)
js/ui/index.js             public UI API used by main.js (content)
js/ui/*.js                 content renderers, picker, risk check, citations (content)
data/sources.js            source registry (content)
data/peptides.js           catalog: retatrutide + 20 coming soon (content)
data/retatrutide.js        full entry (content)
data/graymarket.js         enforcement + vial test data (content)
data/riskitems.js          personal-history checklist items (content)
assets/anatomy/body.glb    anatomy meshes (anatomy pipeline)
assets/anatomy/landmarks.json  organ centers, sites, flow paths (anatomy pipeline)
assets/fonts/              self-hosted OFL fonts (foundation)
tools/                     dev-only scripts (serve, shot, build-anatomy)
tests/                     node --test suites
```

## DOM contract (ids are stable; foundation creates them)

```
#intro                     full-screen intro overlay (role="dialog" aria-modal="false", aria-labelledby="intro-title")
  #intro-canvas-host       container for intro WebGL canvas
  #intro-title             h1 "PeptideScope"
  #intro-enter             primary button → app
  #intro-skip              "Skip intro" button (visible from first frame)
#disclaimer                persistent slim bar (always visible, role="note")
#site-header               header: brand, nav, theme toggle (#theme-toggle)
#app (main)
  #explorer                section: the interactive body
    #peptide-picker        list of peptide chips (role="radiogroup")
    #site-picker           three buttons [data-site="abdomen|thigh|arm"] (role="radiogroup")
    #play-sequence         "Inject" / "Replay" button
    #stage-host            3D canvas container (position:relative)
      #stage-canvas-host   the <canvas> goes here
      #callout-layer       absolutely positioned HTML labels over the canvas
      #stage-fallback      shown if WebGL unavailable (hidden otherwise)
      #stage-loading       loading indicator
    #narration             aria-live="polite" text: what is happening now
    #timeline              timeline component host
    #active-effects        list of side effects active at current time (aria-live="polite")
  #overview                status, what it is, how it works
  #pharmacology            onset / peak / clearance, absorption, sites
  #side-effects            side effect cards grouped by organ
  #red-flags               call 911 vs see a doctor today
  #too-much                overdose / too much / unknowable gray-market doses
  #dose-facts              fixed cited trial dose-arm facts
  #evidence                evidence strength ladder
  #claims                  creator claims vs evidence
  #gray-market             independent vial tests + enforcement
  #risk-check              warnings-only personal history check
  #sources                 numbered source list (#src-<id> anchors)
#site-footer               disclaimer, "Pharmacist review: pending", licenses link
```

Routing: `#intro` (default on first visit per session), `#app` and any section
hash skip the intro. `?peptide=<id>&site=<abdomen|thigh|arm>` preselects.

## Event bus (js/bus.js)

`import { bus } from './bus.js'` with `bus.on(type, fn) → off`, `bus.emit(type, detail)`.

| event | detail | emitted by |
|---|---|---|
| `peptide:select` | `{ id }` | picker |
| `peptide:loaded` | `{ id, entry }` (entry = data module default export, or null for coming soon) | main |
| `site:select` | `{ site }` | site picker or 3D hotspot click |
| `sequence:start` | `{ site, peptideId }` | play button |
| `sequence:phase` | `{ phase: 'syringe'|'depot'|'absorption'|'bloodstream'|'distribution'|'done', label }` | injection |
| `sequence:done` | `{}` | injection |
| `time:change` | `{ tDays, level, phaseId, phaseLabel, mode }` | timeline |
| `effects:active` | `{ ids: [...], items: [...] }` | effects |
| `organ:focus` | `{ organ }` | any (cards, callouts) → stage flies camera / highlights |
| `risk:change` | `{ items: [...checked ids], warnings: [...] }` | risk check → anatomy highlights |
| `theme:change` | `{ theme: 'dark'|'light' }` | main |
| `motion:change` | `{ reducedMotion }` (header toggle or OS setting changed) | main |
| `stage:ready` | `{}` (after the scene's bus listeners are attached) | stage |

Bus extras (additive): `bus.off(type, fn)`, `bus.once(type, fn) → off`, `bus.last(type) → most
recent detail`. main.js replays the last `peptide:loaded`, `site:select`, `time:change`,
`effects:active` and `risk:change` once the late-mounting 3D scene is ready.

Additive detail fields:
- `time:change` also carries `levelNorm` (0..1, level ÷ the highest level in the current view; use
  it for glows, since `level` exceeds 1 in weekly mode), `estimate`, `shot`, `shots`,
  `sinceShotDays`, `intervalDays`, `tEnd`, `peptideId`.
- `effects:active.items[]` are `{ id, organ, severity, name, alsoOrgans }`.
- `risk:change.warnings[]` are `{ organ, title, item }` (`item` = the risk item id).
- Every module that animates listens to `motion:change` and switches live (intro, stage, timeline,
  effects); without the event they read `html[data-motion]` (`reduce` | `full`), then the media query.

Organ ids (shared vocabulary): `brain, thyroid, heart, lungs, liver,
gallbladder, stomach, pancreas, spleen, small_intestine, large_intestine,
kidneys, bladder, skin, fat, injection_site, muscle, eyes, blood`. `fat`,
`injection_site`, `eyes`, `muscle`, `blood` map to anchor points rather than
meshes.

## Data contract (data/*.js, ES modules)

Every text-bearing object carries `sources: [sourceId, ...]`. Anything we
could not verify carries `unverified: true` and the UI shows an "Unverified"
chip. Estimates carry `estimate: true` ("Model estimate" chip).

```js
// data/sources.js
export const SOURCES = {
  'lilly-2026-triumph1': { title, publisher, url, date, type, note? },
  // type: journal | regulator | label | company | trial-registry | nonprofit | testing-lab | news | health-service
};

// data/peptides.js
export const PEPTIDES = [
  { id: 'retatrutide', name: 'Retatrutide', aka: ['LY3437943'], status: 'in-trials',
    statusLabel: 'Investigational: not approved anywhere', ready: true, load: () => import('./retatrutide.js') },
  { id: 'semaglutide', name: 'Semaglutide', aka: ['Ozempic', 'Wegovy'], status: 'approved',
    statusLabel: '...', oneLine: '...', sources: [...], ready: false },
  // status: approved | in-trials | research-only
];

// data/retatrutide.js  (default export)
{
  id, name, aka, developer, route: 'Once-weekly injection under the skin',
  status: { level, label, detail, sources },
  what: [{ text, sources }],
  how: [{ receptor: 'GLP-1', organs: ['brain','pancreas','stomach'], effect, sources }],
  pk: {
    halfLifeDays, tmaxDays, tmaxEstimate: true, intervalDays: 7, steadyStateDoses,
    phases: [ { id: 'onset'|'peak'|'halfLife'|'clearance'|..., tDays, label, text, sources, estimate? } ],
    sources
  },
  absorption: { steps: [{ id: 'depot'|'capillary'|'lymph'|'blood'|'distribution', title, text, sources }],
                sites: { abdomen: { text, sources }, thigh: {...}, arm: {...} } },
  targets: [{ organ, receptors: [...], effect, sources }],
  sideEffects: [{
    id, name, organ, alsoOrgans: [], severity: 'common'|'notable'|'serious',
    frequency: { text, sources, unverified? },
    why: { text, sources }, reduce: { text, sources },
    timing: { fromDays, toDays, text },   // window on the single-shot timeline
  }],
  redFlags: { call911: [{ sign, why, sources }], doctorToday: [{ sign, why, sources }] },
  tooMuch: { intro, signs: [{ text, sources }], whatToDo: [{ text, sources }], sources },
  doseFacts: { intro, caveat, trials: [{ id, name, design, timepoint, sources,
               columns: [...], rows: [{ arm, cells: [...] }] }] },
  evidence: { level: 'anecdote'|'animal'|'small-human'|'large-trial', summary, rungs: [{ level, text, sources }], gaps: [{ text, sources }] },
  claims: [{ claim, verdict: 'supported'|'partly'|'not-supported'|'unknown', evidence, sources }],
  risk: { [riskItemId]: [{ organ, title, text, sources }] },
}

// data/riskitems.js
export const RISK_ITEMS = [{ id: 'heart-rhythm', label, hint }, ...];

// data/graymarket.js
export const GRAY = { headline, enforcement: [{ text, value, sources }],
  vialTests: [{ id, label, labeledMg, pctOfLabel /* null = none detected */, identity: 'pass'|'fail', note, sources }],
  takeaway, sources };
```

## 3D world contract

- Units meters, Y up, feet at y = 0, body faces +Z, centered on x = 0, z = 0,
  height ≈ 1.75 m. The person's left is +X.
- `assets/anatomy/body.glb`: meshes named `skin`, organ ids above (`heart`,
  `lungs`, `liver`, `gallbladder`, `stomach`, `pancreas`, `spleen`,
  `small_intestine`, `large_intestine`, `kidneys`, `bladder`, `brain`,
  `thyroid`), `arteries`, `veins`, optional `skeleton`. Meshopt-compressed
  (EXT_meshopt_compression + KHR_mesh_quantization): load with GLTFLoader +
  `MeshoptDecoder` from `three/addons/libs/meshopt_decoder.module.js`.
- `assets/anatomy/landmarks.json`:
  `{ units, height, organs: { <id>: { center: [x,y,z], radius } },
     sites: { abdomen|thigh|arm: { point, normal, label } },
     paths: { abdomen_to_heart, thigh_to_heart, arm_to_heart, heart_to_lungs,
              lungs_to_heart, to_brain, to_thyroid, to_liver, to_stomach, to_pancreas,
              to_kidneys, to_small_intestine, to_large_intestine, to_heart_muscle,
              to_fat, to_skin, to_gallbladder, to_spleen, to_muscle } }`
  (each path = array of [x,y,z] waypoints, inside the body, following the
  real vessel route; `to_*` paths start at the aortic root).
- Until the real assets exist, `anatomy.js` must render a tasteful procedural
  placeholder (so every other module can be developed) and switch to the GLB
  automatically when present.

### Public JS APIs

```js
// js/scene/stage.js
export async function createStage(host, { reducedMotion, theme }) → stage
stage.scene, stage.camera, stage.renderer, stage.controls
stage.onFrame(fn(dt, t)) → off            // fn called every rendered frame
stage.flyTo({ target:[x,y,z], distance, azimuth, elevation, duration })
stage.setTheme('dark'|'light'); stage.resize(); stage.dispose()
stage.pick(clientX, clientY, objects) → intersection | null
stage.project([x,y,z]) → { x, y, visible }   // CSS px relative to host
// additive: stage.onTheme(fn) → off; stage.setReducedMotion(bool); stage.homeView(); stage.zoom(f);
//   stage.getView(); stage.fitDistance(w, h); stage.homeDistance; stage.onContextChange(fn(lost)) → off;
//   stage.contextLost; stage.advance(seconds, step)  (dev/test: deterministic steps + one frame)

// js/scene/anatomy.js
export async function loadAnatomy(stage) → anatomy
anatomy.landmarks; anatomy.meshes[organId]; anatomy.siteHotspots
anatomy.highlight(organId, { color, intensity, pulse }) ; anatomy.unhighlight(organId); anatomy.clearHighlights()
anatomy.setFocus(organId|null)   // dims everything else
anatomy.organCenter(organId) → THREE.Vector3
// additive: anatomy.setSkinCut(center, radius, amount, planeNormal); anatomy.setIsolate(bool);
//   anatomy.setHotspotsVisible(bool); anatomy.setHoverSite(site|null); anatomy.siteFrame(site)

// js/scene/vessels.js
export function createVessels(stage, anatomy) → vessels
vessels.setBloodFlow(true|false)
vessels.release({ site, targets: [organIds], count, onArrive(organId) })  // drug particles
vessels.setDrugLevel(0..1)   // overall glow of drug in blood, driven by timeline level

// js/scene/syringe.js
export function createSyringe(THREE, { envMap, scale }) → { group, setPlunger(0..1), setLiquid(0..1), setCapOn(bool), dispose() }

// js/scene/injection.js
export function createInjection(stage, anatomy, vessels) → injection
injection.play({ site, peptide }) → Promise   // emits sequence:* events
injection.skip(); injection.reset(); injection.playing
// additive: injection.fadeArrivals(); injection.phase

// js/scene/callouts.js (used by index.js)
export function createCallouts(stage, layerEl, { onSelect }) → callouts
callouts.set(id, { anchor, title, text, tone, organ, group, interactive, side, normal, facing, onClick, ariaLabel, priority })
callouts.remove(id); callouts.clear(group?); callouts.setGroupVisible(group, bool); callouts.setInsets({ top, right, bottom, left })

// js/pk.js (pure, no DOM)
export function kaFromTmax(tmaxDays, halfLifeDays) → ka
export function singleDose(tDays, { ka, ke }) → level (normalized so peak = 1)
export function repeatedDoses(tDays, { ka, ke, intervalDays, doses }) → level (normalized to single-dose peak)
export function timeToFraction(fraction, params) → tDays   // after peak
export function curve(params, { tEnd, n, mode }) → [{ t, level }]

// js/timeline.js
export function mountTimeline(host, entry, { reducedMotion }) → timeline
timeline.set(tDays); timeline.play(); timeline.pause(); timeline.setMode('single'|'weekly')
timeline.tDays; timeline.mode; timeline.playing; timeline.dispose()   // additive

// js/effects.js
export function mountEffects(host, entry) → effects   // listens to time:change, emits effects:active
effects.dispose(); export function activeEffectIds(sideEffects, state)   // additive

// js/scene/index.js — the only 3D entry point main.js uses
export async function mountBody(host /* #stage-host */, { reducedMotion, theme, creditHref }) → { dispose() }
//   creditHref: where the in-stage CC BY anatomy credit links (main.js: ASSETS.md on GitHub, #anatomy)
//   dev/test handle: host.__btvBody (stage, anatomy, vessels, injection, callouts, state)
//   listens: site:select, sequence:start, time:change, effects:active, organ:focus, risk:change, theme:change, peptide:loaded, motion:change
//   emits:   site:select (hotspot click), sequence:phase, sequence:done, stage:ready

// js/ui/index.js — the only content entry point main.js uses
export function mountPicker(host /* #peptide-picker */, peptides, { selectedId })   // emits peptide:select
export function mountSitePicker(host /* #site-picker */, { selected })            // emits site:select, reflects external site:select
export function renderEntry(entry, { root = document })        // fills every [data-render] section body + #sources; numbered citations
export function renderComingSoon(peptide, { root = document }) // stub content for not-ready peptides
export function mountRiskCheck(host /* #risk-check .section-body */, entry)        // emits risk:change (warnings only)
// renderers use ctx.cite(sourceIds) → '<sup class="cite"><a href="#src-ID">n</a></sup>' (numbered by first use)
// return values (additive): mountPicker / mountSitePicker → { select(), selected, destroy() };
//   renderEntry / renderComingSoon → { ctx }; mountRiskCheck → { items, destroy() }. renderEntry already
//   mounts the risk check; a later mountRiskCheck call replaces it and keeps the citation numbers.

// js/intro.js
export function mountIntro(host /* #intro */, { reducedMotion, onEnter, onFacts }) → { dispose() }
//   dispose() frees every GPU resource, calls forceContextLoss() and removes the canvas, so the
//   intro's WebGL context is gone before the 3D body mounts (main.js mounts the body after closing).
```

Section markup (foundation writes it; content fills `.section-body`):
```html
<section id="overview" class="content-section" aria-labelledby="overview-title">
  <header class="section-head"><p class="eyebrow">01 · Overview</p><h2 id="overview-title">…</h2><p class="lede">…</p></header>
  <div class="section-body" data-render="overview"></div>
</section>
```
`data-render` values: overview, pharmacology, side-effects, red-flags, too-much, dose-facts, evidence, claims, gray-market, risk-check, sources.

## Visual language

- Dark default (respects `prefers-color-scheme`, toggle persists in
  localStorage `btv.theme`). The intro is always dark (cinematic).
- Tokens (`css/tokens.css`): `--bg, --bg-2, --surface, --surface-2, --line,
  --text, --text-2, --muted, --accent (clinical cyan), --accent-2,
  --artery (coral red), --vein (blue), --drug (luminous cyan-white),
  --warn (amber), --danger (red), --focus`. Light theme redefines all.
- Type: Inter (self-hosted, OFL) for UI; `ui-monospace` stack for data.
- Motion: ease `cubic-bezier(.2,.7,.1,1)`; 200–1200 ms; under
  `prefers-reduced-motion: reduce` no camera flights, no autoplay, no
  parallax; state changes are instant cross-fades.
- Contrast ≥ 4.5:1 for text in both themes. Focus rings always visible.
- Mobile first: works at 360 px width, 16 px gutters, no horizontal scroll.
- Desktop (≥ 1100 px): the explorer fits the viewport. `--stage-h` is the viewport minus the header,
  the disclaimer bar and `--tl-peek` (the timeline's head: play, time and level readout), clamped to
  420–820 px; on screens ≥ 1180 px tall `--tl-peek` grows so the whole level chart fits as well. The
  right column (narration + side effects) is sticky, so it stays in view while the chart is scrubbed.

## Performance budget

- First paint without three.js: HTML + CSS + main.js < 120 KB gzipped.
- three.js core + addons ≈ 200 KB gzipped, loaded as modules after first paint.
- `body.glb` ≤ 3.5 MB; prefetched during the intro.
- Render loop pauses when the stage is offscreen or the tab is hidden.

---

# v2 additions (2026-10-08, owner feedback)

Owner asked for: a scroll-driven "video" introduction with lifelike peptide
vials and syringe → the injection site on a lifelike body → inside the body
into the bloodstream; a luxury, very professional colour theme and feel; an
editable body (male/female, height, weight, age); and only incredibly accurate
sources.

## Luxury palette (replaces the cyan clinical palette everywhere: CSS, 3D, intro)

Obsidian, ivory and champagne gold, with oxblood and sapphire for blood. No
neon cyan. No green anywhere.

| token | dark (default) | light |
|---|---|---|
| `--bg` | `#0A0A0B` | `#F6F2EA` |
| `--bg-2` | `#111012` | `#EFE9DE` |
| `--surface` | `#151417` | `#FFFDF8` |
| `--surface-2` | `#1C1A1E` | `#F3EEE4` |
| `--line` | `rgba(232,220,196,.12)` | `rgba(40,32,20,.12)` |
| `--line-strong` | `rgba(232,220,196,.24)` | `rgba(40,32,20,.24)` |
| `--text` | `#F3EEE6` | `#17140F` |
| `--text-2` | `#D9D2C5` | `#2E2920` |
| `--muted` | `#A39C8F` | `#6B6355` |
| `--accent` (champagne gold) | `#C8A96A` | `#7A5C28` |
| `--accent-2` (pale champagne) | `#E6D3A3` | `#A88645` |
| `--accent-ink` (text on gold) | `#1A1408` | `#FFFDF8` |
| `--artery` (oxblood) | `#C4524A` | `#9C2F2A` |
| `--vein` (sapphire) | `#5B7DB8` | `#2F4F86` |
| `--drug` (luminous champagne) | `#F1DDA8` | `#A88645` |
| `--warn` (bronze amber) | `#D9A05B` | `#8F5410` |
| `--danger` | `#E06A5F` | `#B3261E` |
| `--focus` | `#E6D3A3` | `#7A5C28` |

3D: obsidian background with a faint warm vignette (light theme: ivory with
ink linework); skin is glass with a champagne fresnel rim; organs in muted,
desaturated natural tones; arteries oxblood, veins sapphire; drug particles
luminous champagne; bloom restrained. HUD lines are thin champagne hairlines.

Type: display serif **Newsreader** (variable, OFL, self-hosted) for headlines
and large figures; **Inter** for UI and body. HUD/eyebrow labels in Inter
small caps with wide tracking (no monospace look). Numbers tabular.

Feel: unhurried, precise, quiet. Preloader with a fine champagne progress
line; section reveals (opacity + 12 px rise, staggered, once); buttons with
soft light sweep on hover; magnetic focus states; no bouncy easing. All of it
off under reduced motion.

## Scroll-driven film intro (replaces the timed intro)

`#intro` becomes a tall scroll track (about 600–700 vh) with a sticky
full-screen canvas. Scroll position (smoothed with a lerp) scrubs one
continuous camera move like a video:

1. Lifelike peptide vial (clear glass, rubber stopper, crimped aluminium
   seal, flip-off cap, white freeze-dried powder cake, minimal label that
   reads like a gray-market product: no brand, NO mg amount) on obsidian.
2. The syringe (insulin-type, from `js/scene/syringe.js`), its needle
   catching light beside the vial. Never shows mixing, drawing up, measuring
   or volumes.
3. The injection site on a lifelike human body (real anatomy skin with a
   realistic skin material: warm tone, soft sheen; abdomen close-up).
4. Through the skin: the layers, the depot forming.
5. Into a capillary, then the bloodstream: red cells streaming, the drug as
   champagne light.
6. Pull back: the whole translucent body with vasculature glowing.
7. Title + "Enter the body" / "Read the facts first".
Chapter captions are real DOM text (accessible, one short line each).
"Skip intro" is always visible. Keyboard: Space/PageDown/arrows scroll,
Enter enters, Escape skips. Reduced motion: no scrubbing; chapters become a
calm sequence of still frames with captions and buttons. `mountIntro(host,
{ reducedMotion, onEnter, onFacts }) → { dispose() }` is unchanged; the intro
owns the page scroll while visible and restores it on exit.

New module: `js/scene/vial.js` → `createVial(THREE, { envMap, scale }) →
{ group, dispose() }` (local frame and real size documented in the file).

## Editable body (appearance only)

A "Body" control panel lives inside the stage (`#body-editor`, rendered by
`js/ui/bodyeditor.js`, styled in `css/stage.css`): Sex (Male / Female),
Height, Weight, Age (adults only, 18–90). It emits
`body:change { sex, heightCm, weightKg, age }`.

Hard rule: appearance only. `body:change` may be consumed only by
`js/scene/*` (and `js/ui/bodyeditor.js` itself). The timeline, PK model,
effects, risk check and content never read it, and nothing derived from it
is ever shown as a level, dose, amount or risk. The panel shows the line
"Changes how the body looks. It never changes the timeline or suggests a
dose." Every input in the panel carries `data-appearance-only`.
(Enforced by `tests/exclusions.test.mjs`.)

Rendering: female anatomy from the same HRA source (`assets/anatomy/
body-female.glb` + `landmarks-female.json`, same names/frame); height =
uniform scale; weight = subcutaneous fat thickness (skin displacement along
normals weighted by region, and the fat layer in the tissue cross-section
gets thicker or thinner); age = subtle (posture/stature, fat distribution).
Defaults: male 175 cm 75 kg 35 y; female 162 cm 65 kg 35 y.

## Sources (strict)

Only claims an independent checker confirmed or corrected; no news outlets,
no press-release re-hosts, no computed database values, no chart-read
values. See `research/LEDGER.md`. `data/sources.js` is generated.

## Events added

`motion:change { reducedMotion }` (main.js), `body:change {...}` (body
editor). Bus extras: `once`, `off`, `last(type)`.

---

# v3 additions: lifelike anatomy (owner, 2026-10-08)

Owner: "I want the body to feel more real and replicate the exact human body and
be able to zoom in very closely and see the skin of the human and be able to
genuinely tell the anatomy of the human body so it's very lifelike."

- **Detail assets** (lazy-loaded): `assets/anatomy/detail-male.glb` (and later
  `detail-female.glb`) with `skin_hi` (~300k tris), `eyes`, named muscles
  `muscle_<slug>`, optional `skeleton_hi`; `assets/anatomy/atlas-<sex>.json`
  lists every named structure `{ id, name, plain, system, center, file }`.
- **Lifelike skin**: opaque skin material with warm tone, soft subsurface feel
  (wrap lighting / thickness approximation), sheen, and procedural micro-detail
  (triplanar pore/fine-wrinkle normal noise in the shader; no image textures
  needed); skin tone is an appearance-only option in the body editor.
- **Anatomy layers**: Skin · Muscles · Skeleton · Organs · Vessels toggles plus a
  glass/X-ray blend; the injection sequence and timeline keep working in any
  layer mode (they switch to the glass view while the drug travels).
- **Deep zoom**: zoom to cursor, pan when zoomed, double-click/tap to focus a
  point, near plane ~1 mm, swap to `skin_hi` when the camera is close.
- **Labels**: hover (desktop) or tap (touch) a structure → label with its
  anatomical name and plain-language name from the atlas; keyboard users get
  a structure list in the layers panel.
