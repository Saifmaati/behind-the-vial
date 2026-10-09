# Integration: decisions

One line each: decision, then why. Every change outside a module's own design is listed under
"Cross-module changes" with the file it touched.

## Layout
1. **Desktop (≥ 1100 px) fits the explorer to the viewport: the stage ends where the timeline's head (play, time, level readout) still sits fully above the fixed disclaimer bar**, because at 1440×900 the readout used to peek out from under the bar, and a smaller stage that shows the whole chart (≈ 400 px tall at 900 px) made the body and its callouts too small.
2. **On screens ≥ 1180 px tall the stage shrinks a little more so the whole level chart fits too**, since there the stage still gets ≥ 600 px.
3. **main.js measures the timeline (`--tl-head-h`, `--tl-core-h`) instead of hard-coding it**, because the head wraps onto two rows when the centre column is narrow (≈ 1100–1400 px wide).
4. **The stage height is clamped to 420–820 px**; below ~720 px of viewport height the head can dip under the bar, which is better than a stage too small to read.
5. **The right column (narration + side effects) is sticky on desktop and the side-effect panel fills the rest of the viewport and scrolls inside**, so the live panels stay in view while the visitor scrolls down to drag the chart.
6. **Inside its panel, the side-effect list drops its own card chrome and duplicate eyebrow**, because a card in a card in a panel wasted ~40 px of a 320 px column; the panel's h2 already names it.
7. **"Skip animation" sits above the bottom HUD row on stages wider than 600 px** (labels keep 52 px clear while it shows), because it covered the CC BY credit at 689 px; narrow stages keep body3d's rule (credit hidden during the sequence).
8. **Stage callouts rebalance between the left and right columns when one column cannot fit all labels**, moving the labels whose anchors sit nearest the other side; nine-plus side effects at the peak used to overlap on shorter stages.

## Wiring
9. **The 3D body mounts only after the intro has been disposed (canvas removed, context force-lost)**, not when the overlay starts fading, so two WebGL contexts never coexist; if Skip is pressed while intro.js is still mounting, main.js waits for it and disposes it first.
10. **The in-stage anatomy credit links to `ASSETS.md#anatomy` on GitHub (rendered), via `mountBody({ creditHref })`**, because GitHub Pages serves a raw `.md` file that some browsers download instead of showing; the footer now also carries the full CC BY attribution line.
11. **Timeline, side-effect list and content renderers follow `motion:change` live and read `html[data-motion]` before the media query**, so the header's Reduce-motion toggle reaches every module, not only the intro and the stage.
12. **The scene feeds `levelNorm` (0..1 within the view) to the drug glow**, because `level` goes above 1 in the weekly view.
13. **Side effects tied to the injection site are not drawn on the body until a site is chosen**, because the anchor defaults to the abdomen and an orange glow there before any choice reads as "it went in here".
14. **The selected injection-site hotspot keeps only a faint fill and no extra brightness**, because at the default distance its fill and boosted colour bloomed into a white disc that hid the intestines behind the abdomen site (it now reads as a crisp reticle; unselected and hover states are unchanged).
15. **"Read the facts first" lands on the overview with an instant scroll**, because a smooth scroll never ran while the overlay still locked the page (body overflow hidden during the fade), leaving the visitor at the top with focus far below.
16. **Section deep links (`#risk-check`, `#src-…`) land again once the content has rendered**, unless the visitor has already scrolled or pressed a key, because the browser resolves the hash before the sections are filled and the target ended up ~8,000 px below the viewport.

## Cross-module changes (file → change)
- `css/app.css` (foundation): desktop viewport-fit (`--stage-h`, `--tl-peek`), sticky side column, effects panel fill, flattened `.fx` inside `.panel--effects`.
- `js/main.js` (foundation): body mounts after intro disposal; timeline metrics; `creditHref`; instant scroll for the facts exit; hash re-landing.
- `index.html` (foundation): anatomy attribution line in the footer.
- `css/stage.css`, `js/scene/index.js`, `js/scene/callouts.js`, `js/scene/anatomy.js` (body3d): skip button position and insets; `levelNorm`; injection-site gate; column balancing; selected-hotspot shader fill.
- `js/timeline.js`, `js/effects.js`, `css/timeline.css` (timeline): live `motion:change`; the `.fx-row` container query now wins over the base rule (it never applied before).
- `js/ui/util.js` (content): `prefersReducedMotion()` honours `html[data-motion]`.
- `ASSETS.md`: merged the module asset records (anatomy, three.js, Inter, made-here list).
- `docs/ARCHITECTURE.md`: `motion:change`, bus extras, additive detail fields and APIs from the module decision files, the desktop layout rule.

# v4 integration (2026-10-08 evening)

One line each: decision, then why.

## Name sweep
17. **Every remaining abbreviation of the working title renamed** (tests/name.test.mjs): the sample-data env flag is now `PEPTIDESCOPE_ALLOW_SAMPLES` (tests/data.test.mjs, docs), docs name the `peptidescope.*` storage keys, the dev handles are `__psBus`, `__psFallbackBus` and `__psBody`, and the stage label classes and their keyframes use the `ps-callout` prefix; storage keys, `ps-*` keyframes and `brand-accent` were already done by their owners.

## Fixes
18. **The 3D stage runs its own requestAnimationFrame loop instead of `renderer.setAnimationLoop()`**, because three.js's loop always schedules its next frame after the callback returns, so stopping it from inside a frame (where the stage decides it is idle) left an empty loop running 60 times a second while the page looked idle.
19. **`body.glb` is downloaded once**: main.js already streamed it for the progress bar, and now hands the bytes to the scene (`mountBody({ glb })` → `loadAnatomy({ glb })` → `GLTFLoader.parseAsync`), because the second request doubled the download on servers without caching and was intermittently reported as `net::ERR_ABORTED` in headless checks; if the stream fails, the scene fetches the file itself as before.
20. **Side-effect labels on the body reset when a different peptide is loaded**, because after one injection a later peptide switch showed "Serious allergic reaction" on the head at time 0 before the visitor had watched anything for that peptide.
21. **`#stage-host` is a size container named `stage` again** (`container: stage / inline-size` in app.css), because the v4 app.css dropped it and every `@container stage` rule in stage.css (short credit, smaller labels, phone sheet) had stopped applying.
22. **Skip animation sits above the colour key on stages narrower than 800 px, and the labels keep clear of wherever it really is** (the scene measures the button), because it overlapped the key and the zoom buttons on phones and at 1024–1280 px.
23. **Several citation numbers in a row are wrapped in `.cite-group` (nowrap)**, because the comma between two numbers could start a new line, even on desktop.
24. **Sources is the last Learn card and spans the whole row as a slim card**, so the other 12 cards fill every row evenly at 4, 3, 2 or 1 per row (13 cards left one alone on the last row).
25. **In the intro, quick repeated keys add up** (PageDown twice = two chapters), because the second press used to restart from the chapter still showing while the smooth scroll was under way.
26. **Footer carries both credit lines (anatomy CC BY 4.0, photos CC BY-SA 4.0 / public domain) with links to the licence deeds and ASSETS.md**; ASSETS.md now lists the male, female and both close-up anatomy files, the renders, the four photographs, three.js (with the addons actually loaded) and Nunito/DM Sans, and drops Inter/Newsreader.
27. **The disclaimer bar keeps the shell's plain wording ("Talk to a trusted adult or a doctor") with "clinician" in its accessible description (`title`)**, because a doctor is the clinician a teen will actually see; the footer disclaimer spells out "a licensed clinician, like a doctor or pharmacist" in visible text.
28. **The dev server sends `Content-Length`** (tools/serve.mjs), matching GitHub Pages.
29. **Opened as a file, the "Loading the list…" placeholder is hidden**, since nothing loads there and the notice at the top explains why.
30. **Two real data strings stay as they are although a naive placeholder scan flags them**: "not a random sample of what is sold" (gray market, a verified caveat) and the EU trial number "EU CT 2023-503658-11-00" (sources); neither is placeholder data.

## Declined
31. **Dosing, storage/refrigeration, preparation and how-long-to-use content was not built** (owner request, DECISIONS.md 14); the protective "If you have one" and "Real medicine vs. internet vial" panels show for every peptide instead.

## Cross-module changes (v4; file → change)
- `js/scene/stage.js` (body): own rAF loop.
- `js/scene/index.js` (body): `__psBus`/`__psBody`; `glb` option; effects gate reset on `peptide:loaded`; Skip-aware label insets.
- `js/scene/anatomy.js` (body): `loadAnatomy({ glb })`, `tryLoadGLB` parses supplied bytes.
- `js/scene/callouts.js`, `css/stage.css` (body): `ps-callout*` classes; Skip position on narrow and mid-width stages.
- `js/main.js` (shell): streamed bytes handed to `mountBody`.
- `css/app.css` (shell): stage size container, footer fine-print links, slim Sources card, file-mode placeholder.
- `index.html` (shell): photo credit line and `#credits` in the footer.
- `js/intro.js` (intro): repeated keys add up.
- `js/ui/cite.js`, `css/content.css`, `css/timeline.css` (learn, timeline): `.cite-group` / `.tl-cites` nowrap.
- `js/ui/busref.js` (learn): `__psFallbackBus`.
- `tests/data.test.mjs`: env flag renamed only (no assertion changed).
- `tools/serve.mjs`: `Content-Length`.
- `ASSETS.md`, `assets/anatomy/LICENSE.md` (female close-up layer row), `docs/ARCHITECTURE.md` (v4 DOM contract and APIs), `README.md`, docs/decisions content/foundation/body/body3d (renamed identifiers).
