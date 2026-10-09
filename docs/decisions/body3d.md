# body3d: decisions

One line each: decision, then why. Files: `js/scene/{stage,anatomy,vessels,injection,callouts,index}.js`, `css/stage.css`, `tools/sandbox/body3d.html`.

## Injection close-up
1. **The close-up is a section through the body at the site**: the tissue block's top face lies on the skin at the landmark point, its cut face is the section plane, and the block is oriented by the site frame (n = landmark skin normal, t = horizontal ⟂ n facing the camera, b = n × t), because a cut face that belongs to the body reads as "inside this belly/thigh/arm" instead of a floating diagram.
2. **The syringe shares the block's basis and travels along n inside the section plane (0.7 mm in front of the cut face)**, so the needle is always seen side-on entering through the skin face, crossing skin and dermis and stopping in the middle of the fat; the depot bolus is centred on the needle tip.
3. **The camera side is chosen per site (`VIEW_HINT`)**: abdomen and thigh from the person's left (belly or thigh in profile), upper arm from behind the left arm, because the arm landmark sits on the back/outer surface (anatomy decision note) and any front view looks through the arm.
4. **The view turns only 10–15° from the cut-face normal toward the skin normal (`VIEW_SWING`) plus a slight lift**, because larger swings make the block's top face look like a slab the needle lies on; small swings keep the layers and the needle readable and still show depth.
5. **Close-up framing is computed, not hand-placed**: the block corners, room for the label row and the syringe extent are projected onto the camera plane and fitted to the stage's current aspect (minus the zoom-button column); wide stages show the whole syringe, narrow ones only the needle, hub and front of the barrel.
6. **The skin cut is a window, not a sphere**: within 8 cm (arm 6.5 cm) of the site, measured in the section plane, skin and vessel walls on the camera side fade; the far half is drawn double-sided while cut and a faint contour marks where the shell meets the plane, so the limb or belly visibly continues around the block. The previous round window removed the whole arm and made the block look like it floated.
7. **Block proportions are illustrative and unlabelled** (skin ≈ 4.5 mm, then fat, then muscle; arm slightly thinner); there are no depth, angle or amount labels anywhere, per the hard exclusions.
8. **Absorption shows a fine capillary mesh around the depot** (jittered ring nodes joined to nearest neighbours) that fills with drug from the depot outward while particles travel depot → mesh capillary → venule → out of the block, and the depot shrinks to 40 %.

## Sequence, camera and glow
9. **Timeline ≈ 19 s**: syringe 0–6 s, depot at 4.7 s, absorption 6.3–10 s, bloodstream 10.2 s (venous route → right heart → lungs → left heart), distribution 13.4 s (torso + targets framed from the arterial routes), whole-body pull-back at 16.6 s, done at 19.2 s; organ arrivals land between ~14 and 16.5 s.
10. **Blood and organ views are fitted to the real route points** (`<site>_to_heart`, the pulmonary loop, the heart, the target organs) instead of fixed targets, so all three sites frame their own vein path.
11. **Arrival flash then a calm glow, plus a cyan tint on the organ surface**, because emissive light alone barely shows on pale organs (and not at all in the light theme).
12. **While the sequence plays it owns the organ glow**: side-effect and risk highlights and labels step back and the timeline's drug level is held at 0, then restored at the end; the first `time:change` with t > 0 after the sequence fades the arrival glow so the time-driven level (`vessels.setDrugLevel`) is what remains.
13. **Drug particles are smaller and dimmer in the dark theme and a denser dark-teal ink in the light theme**, because at close camera distances the old sizes bloomed into a white laser line and the light-theme particles vanished against red/blue vessels.
14. **Reduced motion**: same events in the same order, instant camera cuts (no flights), still particle traces, ~2.2 s per phase with 0.35 s cross-fades; `motion:change` switches live.

## Callouts and HUD
15. **Tissue labels form a row under the block, depot/capillary/lymph labels a row over it** (`side: 'below' | 'above'` in callouts.js, horizontally de-overlapped), because side columns piled onto the block.
16. **Surface anchors carry a normal and hide when their side faces away** (skin, injection site, site labels); site labels and hotspot picks use a lenient limit (−0.45) because the body is see-through and the back-of-arm site must stay discoverable from the default front view.
17. **Hotspot hit discs are double-sided** so the back-of-arm site can be picked through the arm; picks are refused once a site is clearly on the far side.
18. **Label insets**: top 60 px (HUD + colour key), bottom 58 px (hint row + credit), +26 px while the skip button shows, right 56 px (zoom buttons); on stages ≤ 430 px the colour key moves under the phase label and the credit shortens to "CC BY 4.0".
19. **HUD copy is "Anatomical model · Visible Human Male · 1.75 m"**; the first part drops below 900 px of stage width so it never runs into the phase label.
20. **The CC BY 4.0 credit lives inside the stage frame as a real link to `ASSETS.md`** (full source list in its accessible name), because CC BY attribution belongs next to the work; it hides during the sequence on narrow stages where the skip button needs the space.

## Robustness and budget
21. **WebGL context loss**: the loop stops, the canvas and labels hide, a status note shows; on restore the GPU-only prefiltered environment is rebuilt and re-assigned to every material that used it; after 6 s without a restore the note says to reload.
22. **MSAA 2× on screens above 1.5 dppx, 4× otherwise; pixel ratio capped at 1.75 and stepped down under 48 fps; bloom at half resolution**. Measured in headless Chrome: all scene JS per frame (callouts, anatomy, vessels, injection) ≈ 0.04 ms mean, 0.1 ms p95, no measurable heap growth over 1,200 ticks.
23. **`stage.advance(seconds)` and `host.__psBody`** are dev/test hooks (deterministic stepping in headless checks; no global variables).

## Contract requests (for ARCHITECTURE.md)
- `injection.fadeArrivals()`, `injection.phase` (additive).
- `stage.advance()`, `stage.onContextChange()`, `stage.contextLost`, `stage.onTheme()`, `stage.setReducedMotion()`, `stage.homeView()`, `stage.zoom()`, `stage.getView()`, `stage.fitDistance()` (additive).
- `anatomy.setSkinCut(center, radius, amount, planeNormal)` and `anatomy.setIsolate()` (additive).
- `mountBody(host, { creditHref })` option for pages that are not at the site root (the sandbox passes `/ASSETS.md`).
- Please merge `docs/assets/body3d.md` (no new third-party files) and the anatomy attribution into `ASSETS.md`, which the in-stage credit links to.
