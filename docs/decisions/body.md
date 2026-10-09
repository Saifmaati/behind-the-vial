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

10. **Skin occlusion is baked once per body, per vertex, when the lifelike look is first used** (nearby skin in front of each vertex within 7 cm, through a spatial hash, then smoothed over the mesh), so armpits, the groin, between the fingers and under the chin darken with a warm bounce; it takes a fraction of a second on the 60k-triangle skin and nothing per frame.
11. **Hands, feet and face carry slightly more red** (from the editable body's own regional weights: little fat under the skin), a small step away from a uniform mannequin tone.

## Layers, labels, zoom
12. **Layers: Skin · Muscles (only once the detail asset is loaded) · Skeleton · Organs · Blood vessels, plus a "Skin look" slider from Lifelike to Glass; default Glass with every layer on except Muscles**, so the first view is the same see-through body as before.
13. **The layers panel lives in `js/ui/bodyeditor.js` (`mountLayersPanel`)**, because `tests/exclusions.test.mjs` allows range inputs only in the timeline and the body editor; its inputs carry `data-view-only`, and it never mentions anything but the view.
14. **Below an X-ray value of one half, vessels, bones and organs take solid looks (oxblood arteries, sapphire veins, ivory bone, opaque organs)**, so peeling the skin off in the lifelike view reads like an anatomical plate rather than glass.
15. **Structure names come from the mesh names now and from `atlas-<sex>.json` once it ships; skin points are named by body region** ("Skin · Left forearm") from the same capsules that weight the editable body, so no label is invented.
16. **Picking order: an opaque skin wins; in the glass view organs (and muscles) come first, bones only where nothing else is under the pointer, the skin last**, so pointing at the belly names the organ behind the glass rather than a rib.
17. **Hover labels (mouse) and tap labels (touch) sit on the picked point, not the organ centre**, so they stay on screen in a deep zoom; an organ tap still focuses the organ as before.
18. **Zoom to cursor with a surface pivot**: before each zoom-in step the orbit pivot slides along the current view axis to the depth of the surface under the pointer (no visible jump), so the camera heads for that spot and stops 2.4 cm short of it instead of passing through the skin; zooming out goes straight back, and past ~72 % of the home distance the pivot drifts home so the whole body is centred again.
19. **The near plane follows the distance (4 % of it, between 1 mm and 5 cm)**, which keeps depth precision at the full-body view and allows a 13 mm field of view at the closest zoom.
20. **Panning is on only when zoomed in (closer than 70 % of the home distance), and the pivot stays inside a box around the body**; zoomed in on a touch screen, one-finger drags turn the body instead of scrolling the page.
21. **Double-click / double-tap flies to the point (pivot there, 38 % of the current distance)**; on touch a single tap waits 260 ms to tell it from a double tap.
22. **Injection-site rings and labels step aside in a close-up (closer than ~0.3 m)**, because a 3 cm ring covered the skin being examined.
23. **Detail asset (`detail-<sex>.glb`: `skin_hi`, `muscle_<slug>`, `eyes`, `skeleton_hi`; `atlas-<sex>.json`) is requested only when named** by `landmarks-<sex>.json` (`detail: { glb, atlas }` or `meta.detail`) or by the caller, because probing a missing file logs a console error; `skin_hi` replaces the body skin within 0.5 m of the pivot.

## Sequence
24. **The sequence keeps the visitor's skin look for the syringe and depot close-up (a lifelike skin stays whole around the section window), turns on organs and vessels, and switches to the glass view from the bloodstream phase until it ends**, then restores the visitor's layers and look; both panels are locked while it plays.
25. **The orbit pivot does not drift home during the sequence** (`stage.autoCenter = false`), so the fitted bloodstream and organ views stay as framed.

## Look and layout fixes
26. **Light theme: the glass skin's core is an ink wash (#3a3226 at 3.5 %) instead of ivory**, because the output pass converts the premultiplied colour to sRGB, which turned a faint ivory core into a white veil over the organs; the body now reads as ivory paper with ink linework, as the palette asks.
27. **Labels keep 86 px clear at the top of wide stages** (56 px at ≤ 430 px), so they never sit under the Layers / Body buttons; at ≤ 430 px the two buttons become icon-only (names kept for assistive technology) so they clear the colour key.
28. **Zoom speed 1.1** (was 0.7): the zoom now spans 3.6 m to 2.4 cm, about 80 wheel notches; trackpad pinches and double-clicks get there much faster.
29. **The close-up skin from the detail asset is welded, relaxed twice and given fresh normals on load**, because its quantised normals showed facets in the test build.

## Robustness
30. **Quality tiers: phones, tablets and machines with ≤ 4 cores or ≤ 4 GB report `quality: 'low'`**: no bloom, pixel ratio capped at 1.5 (floor 0.85), 2× MSAA, half the ambient blood cells, 150 drug particles instead of 240, the light skin shader; on any device bloom switches off if frames stay under 30 fps at the lowest pixel ratio.
31. **The female-anatomy check is a GET of `landmarks-female.json` (reused from the cache by the load)** instead of HEAD requests, which headless Chrome reported as aborted.
32. **No per-frame allocation in the new code**: picks run only on pointer events (throttled to ~20 per second for hover, ~11 per second for wheel pivots), and per-frame work reuses vectors.

## Poster
33. **`assets/img/body-poster.webp` is the default glass body, dark theme, three-quarter (azimuth 32°), rendered from the sandbox at 1.5× and downsampled onto the stage's obsidian vignette, injection rings hidden (1598 × 998, 67 KB WebP at quality 0.93)**, for the no-WebGL fallback.

## Contract requests (for ARCHITECTURE.md)
- `body:change` gains `skinTone: 'tone-1' … 'tone-6'` (appearance only, consumed by `js/scene/*` only).
- Additive scene APIs: `stage.focusPoint()`, `stage.surfacePicker`, `stage.pivotToSurface()`, `stage.autoCenter`, `stage.quality`, `stage.lights`, `stage.setBloom()`, `stage.minDistance`, `stage.zoomed`; `anatomy.setLayers()`, `anatomy.layers`, `anatomy.layerFade`, `anatomy.setXray()`, `anatomy.xray`, `anatomy.setSkinTone()`, `anatomy.setSkinAge()`, `anatomy.pickStructure()`, `anatomy.structures()`, `anatomy.loadDetail()`, `anatomy.detailInfo`, `anatomy.hasMuscles`; `mountLayersPanel()` in `js/ui/bodyeditor.js`; `mountBody(host, { detail, quality })`; `host.__psBody.layers` and `.view`.
- `loadAnatomy({ source: 'procedural' })` replaces the old `'placeholder'` value (owner rule: no "placeholder" anywhere).
- Anatomy pipeline: when `detail-<sex>.glb` / `atlas-<sex>.json` ship, add `"detail": { "glb": "detail-male.glb", "atlas": "atlas-male.json" }` to the matching landmarks file so the scene loads them.
- Foundation/integration: show `assets/img/body-poster.webp` in `#stage-fallback`.

# v4: simpler, faster, for teens (owner, 2026-10-08 evening)

One line each. Supersedes the luxury-palette items above where they conflict (colours, bloom, HUD, the
two panel buttons, the poster).

## Performance (owner: "it's very laggy")
34. **The stage draws on demand**: every frame callback returns whether it is still animating; the loop runs only while the camera moves or damps, a flight, the sequence, a tween, a fade or a pulse is in progress, and releases requestAnimationFrame when the picture is still (`stage.invalidate()` asks for a frame after any change). Measured in the sandbox: 0 frames per second at rest (v3 drew 60 per second all the time).
35. **No post-processing**: the composer, the HDR multisampled target, bloom and the output pass are gone; the canvas is drawn directly with MSAA and Neutral tone mapping, and custom shaders end with three's tone-mapping and colour-space chunks. One frame of the default view: 20 draw calls (v3: 66 including the bloom passes), 288k triangles (v3: 376k), 5 shader programs (v3: 18), 2 textures (v3: 16).
36. **Pixel ratio ≤ 1.25 on desktop, 1 on phones and low-end devices** (v3: 1.75 / 1.5), stepped down to 0.85 / 0.75 while continuous frames stay under 45 fps.
37. **Organs use MeshStandardMaterial** (v3: MeshPhysical with clearcoat and sheen); fully opaque organs leave the transparent pass.
38. **Point-sprite budget: 1,500 desktop / 600 phones in all**: blood cells ≤ 800 / 300 (spread over the routes by length), drug particles 160 × 3 / 70 × 2, tissue seep 80 × 2 / 50 × 2, 7 anchor glows (1,447 / 547 allocated). Blood cells are drawn only while the drug travels in the sequence, so a resting body draws no points.
39. **The 28 flow lines are one merged mesh and one draw call** (per-route activity in a uniform array), built the first time the injection or the timeline needs them; the syringe module loads once a site is chosen.
40. **Highlights pulse for 2.6 s when they appear, then hold steady**; re-applying the same highlight list (every timeline step) keeps the pulse phase, so scrubbing does not restart it.
41. **No idle animation anywhere**: the scan band, contour hairlines, breathing site rings and the always-flowing blood are gone.
42. **The detail model (`detail-<sex>.glb`, ~3 MB) is fetched only after the visitor's own zoom stays within 0.62 m of the pivot for a moment** (never during the injection close-up, never by default on phones); the atlas (names, ~30 KB) is fetched on the first label or when the Body panel opens. Its close-up skin then draws alone: 3 draw calls at the deepest zoom.

## Look
43. **Light-first stage**: CSS #F7F6FB with a faint radial vignette behind the transparent canvas (dark: #0F0E17), a soft contact shadow under the feet instead of the watch-dial floor.
44. **Glass skin = clean frosted glass**: light theme a faint lavender frost (10 %) with a soft violet rim (#6A52EC); dark theme additive with a lavender rim (#A89CF0) kept low (34 %) so the body does not turn purple.
45. **Organs in clear, friendly natural tones** (pink lungs, red heart, red-brown liver, salmon gut, golden pancreas, golden-ochre gallbladder; no green), lit by softer lights (key 1.55, hemisphere 0.6) so they do not wash out on the light stage.
46. **Arteries #E5484D, veins #3E63DD, drug violet #6246EA (light) / #B3A4FF (dark)** in vessels, blood, drug particles, tissue capillaries, arrival glows and the colour key.
47. **No HUD**: the corner marks, rulers and model/phase/site labels are hidden; the stage keeps a short "Drag to turn the body" hint (fades after the first touch or 9 s), three round zoom buttons bottom right, the CC BY credit bottom left, and a colour key that appears with the injection.
48. **Labels are white cards with a coloured dot and sentence-case text** (amber and red only for warnings, violet for the drug), 13–14 px, and they keep clear of the Body button and the zoom buttons.
49. **Side-effect labels wait until the visitor starts the injection or moves the timeline**, so the first view of the body is calm (they used to show the t = 0 effects before anything had happened); risk-check warnings still show at once because the visitor asked for them.
50. **The site marker is a static violet ring and dot** that fills softly once chosen.
61. **At most six labels show at once (five on a stage under 560 px)**, the most important first (hover > tissue > warnings > side effects > arrivals), because the end of the sequence plus the first side effects reached eight and read as bunched up.
51. **Clean white syringe plastic and a clear barrel** on the light stage (the 3D syringe is not the intro's; the intro now uses photographs).

## Modesty (kids audience)
52. **Garments are signed distances baked per skin vertex (`aCloth`)** from the body-shape capsules (trunk and thighs for the shorts, trunk only for the top), so the edges are crisp, anti-aliased and follow the editable body; hands and arms are never covered.
53. **Shorts from 0.955 to 0.745 of a 1.75 m body** (heights normalised per model): below the abdomen site (1.01) and above the thigh sites (0.65–0.70), and below the lowest point of the male crotch (0.755, measured on the mesh); a small gusset dips 1.5 cm (male) / 3 cm (female) at the midline. The female top runs from 1.165 to 1.405.
54. **Under the shorts the front of the male pelvis is eased back onto a smooth profile in the vertex shader** (and the female chest a little under the top), and the fabric is shaded with a softened normal, so the cloth reads smooth; picking and landmarks are unaffected.
55. **The glass look frosts the shorts region with a soft-edged panel** (light: #E7E4F4 at 80 %; dark: #3B3664 at 78 %) that occludes in both themes; the chest stays clear so the heart and lungs remain visible.
56. **Fabric colour #2B2E4A (deep navy), matte knit with darker hems**, the same in both themes.

## Body panel
57. **One "Body" button opens one panel with two tabs**, Shape (sex, height, weight, age, skin tone, Reset, the appearance-only line) and Layers (Skin, Organs, Blood vessels, Skeleton, Muscles once the detail model is in; the skin look from "Real skin" to "See-through"; "Find a part" list); `mountLayersPanel` is gone, `mountBodyEditor(..., { view })` returns `.layers`.
58. **Default layers: skin, organs and vessels; the skeleton is off** (less clutter, 60k fewer triangles); one switch brings it back.
59. **All controls are at least 40–44 px**, sentence case, DM Sans / Nunito through the page's font tokens, with stage-scoped colour tokens so the sandbox matches the page.

## Stills
60. **Stills are rendered from the sandbox at 2× and downsampled (Lanczos), WebP quality 95**: `body-poster.webp` 1600 × 1000 (60 KB; default glass view, light, no markers), `intro-body-{800,1600}.webp` 16:9 (19 / 53 KB), `intro-organs-{800,1600}.webp` 16:9 with the brain, stomach, heart, liver and pancreas softly highlighted in violet (35 / 94 KB). The intro markup also asks for 4:5 versions, so `intro-body-4x5-{640,1280}.webp` and `intro-organs-4x5-{640,1280}.webp` are made the same way (40–133 KB).

## Contract notes (for ARCHITECTURE.md)
- `stage.invalidate(frames?)`, `stage.running`, `stage.stats.frames`; `stage.onFrame(fn)` callbacks may return `true` while still animating. `stage.composer` and `stage.bloom` are `null`; `stage.setBloom()` is a no-op.
- `anatomy.loadAtlas()`, `anatomy.detailLoading`, `anatomy.detailLoaded`; `loadAnatomy({ detail: false })` turns the detail files off.
- `vessels.particleCount`, `vessels.particleBudget`; `PARTICLE_BUDGET` export; `injection.preload()`.
- `mountBody(host, { detailOnZoom })`; `mountBodyEditor(host, { view })` → `{ ..., layers, showTab() }` replaces `mountLayersPanel`.
- Theme default is light when neither the option nor `html[data-theme]` says otherwise (prefers-color-scheme decides).
