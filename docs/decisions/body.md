# body: decisions (v2 luxury palette, editable body, v3 lifelike anatomy)

One line each: decision, then why. Files: `js/scene/{stage,anatomy,vessels,injection,callouts,index}.js`,
`js/ui/bodyeditor.js`, `css/stage.css`, `tools/sandbox/body3d.html`. Earlier body3d decisions stay in
`docs/decisions/body3d.md`.

## Lifelike skin
1. **One skin material blends the glass look and the lifelike look (`uXray` 1 → 0) with premultiplied output (blend One, OneMinusSrcAlpha)**, because the glass skin must keep adding light without alpha on the transparent canvas while the lifelike skin must be opaque; one blend mode covers both and every mix in between.
2. **Below an X-ray value of one half the skin writes depth; at 0 (and fully shown) it moves to the opaque pass**, so a limb hides the torso and the skin hides the inside; organs, vessels and bones under a whole opaque skin are switched off, because a few vessel and bone bits of the scanned model reach the surface and poked through.
3. **The lifelike skin is lit by a camera-relative studio rig (key 55° upper left, soft fill right, rim behind) with the stage lights' intensities**, because the scene's world-fixed lights sit near the default camera and lit the skin flat; turning with the viewer keeps the body modelled from every angle and gives raking light across the relief in a close-up.
4. **Skin shading: red-shifted wrap diffuse (light bleeds past the terminator, red furthest), a red back-scatter at the silhouette, a two-lobe specular with skin's ~2.8 % reflectance, a velvet sheen**, a cheap stand-in for subsurface scattering that needs no extra render passes.
5. **Micro-relief is procedural and triplanar (no image textures)**: long wandering primary furrows, a finer Voronoi crease net, uneven pores and a soft undulation, each faded out before it falls under a few pixels (from the screen-space footprint), so the full body never shimmers and a 2 cm close-up shows pores and lines. Low-end devices use only the dominant projection and skip the finest net.
6. **The scanned skin is welded and given three Taubin passes before its normals are rebuilt**, because folded sliver triangles of the simplified scan showed as dark flaps once the skin was opaque; the surface moves well under a millimetre, so landmarks still sit on it.
7. **Fragments whose interpolated normal points into the surface use the mirrored normal about the face normal**, for the same scan artefacts.
8. **Six skin tones, unnamed (Tone 1, lightest … Tone 6, deepest), default Tone 3**, appearance only, emitted as `skinTone` in `body:change`; the swatches are duplicated in `bodyeditor.js` so the UI never imports three.js.
9. **Age also deepens the fine furrows and lowers the oil sheen a little** (18 → 90 years), on top of the existing stature and fat shift; it is appearance only and never shown as a number.

## Layers, labels, zoom
10. **Layers: Skin · Muscles (only once the detail asset is loaded) · Skeleton · Organs · Blood vessels, plus a "Skin look" slider from Lifelike to Glass; default Glass with every layer on except Muscles**, so the first view is the same see-through body as before.
11. **The layers panel lives in `js/ui/bodyeditor.js` (`mountLayersPanel`)**, because `tests/exclusions.test.mjs` allows range inputs only in the timeline and the body editor; its inputs carry `data-view-only`, and it never mentions anything but the view.
12. **Below an X-ray value of one half, vessels, bones and organs take solid looks (oxblood arteries, sapphire veins, ivory bone, opaque organs)**, so peeling the skin off in the lifelike view reads like an anatomical plate rather than glass.
13. **Structure names come from the mesh names now and from `atlas-<sex>.json` once it ships; skin points are named by body region** ("Skin · Left forearm") from the same capsules that weight the editable body, so no label is invented.
14. **Picking order: an opaque skin wins; in the glass view organs (and muscles) come first, bones only where nothing else is under the pointer, the skin last**, so pointing at the belly names the organ behind the glass rather than a rib.
15. **Hover labels (mouse) and tap labels (touch) sit on the picked point, not the organ centre**, so they stay on screen in a deep zoom; an organ tap still focuses the organ as before.
16. **Zoom to cursor with a surface pivot**: before each zoom-in step the orbit pivot slides along the current view axis to the depth of the surface under the pointer (no visible jump), so the camera heads for that spot and stops 2.4 cm short of it instead of passing through the skin; zooming out goes straight back, and past ~72 % of the home distance the pivot drifts home so the whole body is centred again.
17. **The near plane follows the distance (4 % of it, between 1 mm and 5 cm)**, which keeps depth precision at the full-body view and allows a 13 mm field of view at the closest zoom.
18. **Panning is on only when zoomed in (closer than 70 % of the home distance), and the pivot stays inside a box around the body**; zoomed in on a touch screen, one-finger drags turn the body instead of scrolling the page.
19. **Double-click / double-tap flies to the point (pivot there, 38 % of the current distance)**; on touch a single tap waits 260 ms to tell it from a double tap.
20. **Injection-site rings and labels step aside in a close-up (closer than ~0.3 m)**, because a 3 cm ring covered the skin being examined.
21. **Detail asset (`detail-<sex>.glb`: `skin_hi`, `muscle_<slug>`, `eyes`, `skeleton_hi`; `atlas-<sex>.json`) is requested only when named** by `landmarks-<sex>.json` (`detail: { glb, atlas }` or `meta.detail`) or by the caller, because probing a missing file logs a console error; `skin_hi` replaces the body skin within 0.5 m of the pivot.

## Sequence
22. **The sequence keeps the visitor's skin look for the syringe and depot close-up (a lifelike skin stays whole around the section window), turns on organs and vessels, and switches to the glass view from the bloodstream phase until it ends**, then restores the visitor's layers and look; both panels are locked while it plays.
23. **The orbit pivot does not drift home during the sequence** (`stage.autoCenter = false`), so the fitted bloodstream and organ views stay as framed.

## Robustness
24. **Quality tiers: phones, tablets and machines with ≤ 4 cores or ≤ 4 GB report `quality: 'low'`**: no bloom, pixel ratio capped at 1.5 (floor 0.85), 2× MSAA, half the ambient blood cells, 150 drug particles instead of 240, the light skin shader; on any device bloom switches off if frames stay under 30 fps at the lowest pixel ratio.
25. **The female-anatomy check is a GET of `landmarks-female.json` (reused from the cache by the load)** instead of HEAD requests, which headless Chrome reported as aborted.
26. **No per-frame allocation in the new code**: picks run only on pointer events (throttled to ~20 per second for hover, ~11 per second for wheel pivots), and per-frame work reuses vectors.

## Poster
27. **`assets/img/body-poster.webp` is the default glass body, dark theme, three-quarter (azimuth 32°), rendered from the sandbox at 1.5× and downsampled onto the stage's obsidian vignette, injection rings hidden**, for the no-WebGL fallback.

## Contract requests (for ARCHITECTURE.md)
- `body:change` gains `skinTone: 'tone-1' … 'tone-6'` (appearance only, consumed by `js/scene/*` only).
- Additive scene APIs: `stage.focusPoint()`, `stage.surfacePicker`, `stage.pivotToSurface()`, `stage.autoCenter`, `stage.quality`, `stage.lights`, `stage.setBloom()`, `stage.minDistance`, `stage.zoomed`; `anatomy.setLayers()`, `anatomy.layers`, `anatomy.layerFade`, `anatomy.setXray()`, `anatomy.xray`, `anatomy.setSkinTone()`, `anatomy.setSkinAge()`, `anatomy.pickStructure()`, `anatomy.structures()`, `anatomy.loadDetail()`, `anatomy.detailInfo`, `anatomy.hasMuscles`; `mountLayersPanel()` in `js/ui/bodyeditor.js`; `mountBody(host, { detail, quality })`; `host.__btvBody.layers` and `.view`.
- `loadAnatomy({ source: 'procedural' })` replaces the old `'placeholder'` value (owner rule: no "placeholder" anywhere).
- Anatomy pipeline: when `detail-<sex>.glb` / `atlas-<sex>.json` ship, add `"detail": { "glb": "detail-male.glb", "atlas": "atlas-male.json" }` to the matching landmarks file so the scene loads them.
- Foundation/integration: show `assets/img/body-poster.webp` in `#stage-fallback`.
