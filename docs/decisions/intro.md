# Decisions: intro (js/intro.js, css/intro.css, js/scene/vial.js, js/scene/syringe.js, #intro in index.html)

One line each: decision, then why.

## Film and scroll (v2: the scroll-driven film replaces the timed intro)
- **Six chapters plus an opening and an end card on one ~760 % scroll track: vial → syringe with a drop → the site on a lifelike belly → a cut block of tissue with the depot → capillary into a vein → the whole see-through body with the drug reaching its target organs → title and buttons.** It is the owner's storyboard in order, one viewport of scroll per chapter.
- **#intro itself is the scroll container (a sticky full-screen stage plus an empty track), not the document**, so the app behind never moves, mobile toolbars never resize the stage mid-film, and app.css can keep the body locked; the page's own scroll is saved at mount and restored on exit (dev handle `#intro.__intro.seek(p)`; `window.scrollTo` does not drive the film).
- **The 3D is five separate sets (studio, body, tissue, blood, glass) joined by short cross-dissolves with a slight push-in**, because the scales differ by a factor of 100 000 (a 1.75 m body vs 7 µm red cells); a dissolve reads as one continuous camera move and each set keeps sane depth precision.
- **Scroll is followed with a critically damped lerp (rate 5.2/s)**, so wheel steps and touch flicks scrub like a video instead of jumping.
- **Keys move a whole chapter (Space/PageDown/arrows forward, Shift+Space/PageUp/arrows back, Home/End); Enter with nothing focused enters, Escape skips; a focused button keeps its own Space/Enter.** Chapter steps are what a keyboard user needs; per-pixel keyboard scrolling of a film is meaningless.
- **Hidden end-card buttons are `visibility: hidden` (out of the tab order) until the end card shows; focusing one jumps to the end card.** Keyboard users never tab onto something invisible; Skip is always first in the tab order.
- **Chapter captions are one ordered list of real text; only the title card and its buttons leave the accessibility tree when faded**, so a screen reader can read the whole narrative in order.
- **Back / Next chapter buttons and an `01 / 06` count sit next to the safety line** (never "00"), for touch users and as the primary control under reduced motion.

## First frame, safety and fallback
- **Kicker "Independent education · Not a seller", the title with its tagline, the line "Education only · Nothing for sale · Not medical advice · No dosing guidance" and Skip are static HTML over a CSS/SVG still**, so the educational, non-commercial purpose shows before any script, font or 3D has loaded (owner feedback 2).
- **The kicker and the safety line stay on screen through the whole film** (top bar and foot), not only on the first frame, because a visitor can land mid-scroll via a shared screenshot or a restore.
- **Without WebGL (or `?no3d`) the intro stays that still title card with both buttons and no scroll track**: it looks designed (line-drawn vial and syringe in champagne hairlines, a soft halo) and is fully usable.
- **The vial label reads only "RESEARCH USE ONLY", "NOT FOR HUMAN USE" and a lot code** (the SVG still uses the same three lines): no amount, strength, brand, price, storage or preparation wording. The earlier "LYOPHILIZED POWDER", expiry date, storage line and barcode digits were removed as fake data.
- **The syringe never touches the vial and never points at it; it floats beside it, needle down, with one drop at the tip.** Nothing reads as drawing up, mixing, measuring or an injection angle; caption 02 says so in words.
- **The injection site is shown as a champagne ring drawn on the skin, never with a needle on the body**, so the intro shows where, not how.

## Look
- **Tone mapping is AgX with a gentle S-curve and a warm obsidian lift**, because ACES pushed skin to orange and blood to neon red; AgX keeps skin natural and lets champagne glows roll off softly.
- **Bloom is set per shot (strength and threshold)**: high thresholds in the studio and on skin (no haze from glass highlights), lower in the micro shots so the drug reads as light.
- **Lifelike skin is a MeshPhysicalMaterial with: a tileable micro-relief texture drawn once on the CPU (pores ≈ 0.4 mm, a fine diamond pattern of furrows), applied triplanar in world space with mipmaps; soft mottling; a warm wrap-light term for light scattering under the skin; sheen and a thin oily clearcoat.** No image textures are downloaded; detail fades out by mipmapping at distance, so there is no shimmer.
- **The GLB skin normals are recomputed in full precision (vertices welded first)** for the close-up, because the quantized normals showed faceted planes under raking light.
- **A procedural navel at `landmarks.anchors.navel` and ~190 vellus hairs seated on the skin around the site** make the macro shot read as a real belly; hair roots are fitted to the nearest skin vertices so they never float.
- **The cut tissue block is illustrative, labelled "Illustration · not to scale"**: epidermis exaggerated, fat lobules with septa and adipocytes, fascia, striated muscle, follicles, vessels cut across, and the depot as a champagne pool half exposed by the cut. Thicknesses are not data and no numbers are shown.
- **Red cells use the Evans–Fung biconcave profile, travel edge-on in single file in the capillary and tumble freely in the vein; a clear channel is kept down the vein's axis for the camera.** Flow is slowed down (a film, not a measurement).
- **The glass body uses the real anatomy GLB: organs in muted natural tones, arteries oxblood, veins sapphire, skin as a champagne fresnel; the drug follows `abdomen_to_heart` → `heart_to_lungs` → `lungs_to_heart` → `to_<organ>` and lights the organs with receptors named in the targets of data/retatrutide.js (heart, liver, stomach, pancreas, brain).** Organ labels carry names only, no claims or numbers.
- **On phones the subject sits in the upper part of the frame (lens shift, not a camera turn) and the words stack below; on desktop the subject sits right of centre and the words on the left.**

## Performance and lifecycle
- **A quality ladder steps down when frames are slow (pixel ratio 1.6 → 1.25 → 1 → 0.75, MSAA 4 → 2 → 0) and, as a last resort, stops the ambient motion so frames are drawn only while scrolling.** Phones and old laptops stay responsive; headless SwiftShader can still take screenshots.
- **Every set is compiled (`compileAsync`) before it can appear; a shot whose set is not ready borrows the nearest earlier one**, so nothing compiles mid-scroll and a slow anatomy download never shows an empty frame.
- **`dispose()` frees every geometry, material, texture and render target, then `renderer.dispose()` + `forceContextLoss()` and removes the canvas** (verified: no `#intro canvas` after Enter/Escape; main.js then mounts the body).
- **Reduced motion = still frames, one per chapter, chosen where that chapter's picture is complete** (ring drawn, drop formed, depot formed); scroll, keys and Back/Next switch them instantly; no ambient motion, no CSS transitions. `motion:change` switches live without a restart.

## Contract notes
- `mountIntro(host, { reducedMotion, onEnter, onFacts }) → { dispose() }` is unchanged; `_state` (dev) and `host.__intro = { seek(p, { instant }), state }` are additive.
- `createVial(THREE, { envMap, scale, envMapIntensity, capColor, label }) → { group, dispose(), dims, parts, materials, labelReady }` (local frame and real sizes documented in the file).
- `createSyringe` defaults are now warm neutrals (clear, faintly warm liquid; warm grey graduations) instead of a pale cyan tint, per the luxury palette; the API is unchanged.
- The #intro DOM keeps every contract id (`#intro-canvas-host`, `#intro-title`, `#intro-enter`, `#intro-facts`, `#intro-skip`, `#intro-sub`) and adds `.intro-stage`, `.intro-track`, `.intro-card`, `.intro-chapters`, `.intro-foot`, `.intro-labels`.
