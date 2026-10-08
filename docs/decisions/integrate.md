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
