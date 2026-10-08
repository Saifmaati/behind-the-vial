# Decisions: intro (js/intro.js, css/intro.css, js/scene/syringe.js)

One line each: decision, then why.

## Storyboard and behaviour
- **The intro clock starts at the first rendered frame after every shader is compiled and the studio environment is filtered**, not at page load, so nothing stutters mid-sequence; a black frame is on screen from the start and "Skip intro" is visible and live from frame 1.
- **Storyboard: 0–2.2 s one capillary draws itself; 2.2–7 s pull-back as the network lights up from it; 4.8–9.4 s the syringe glides in rim-lit, then the studio light comes up; 7.7–10.8 s kicker, title, sub, buttons, note; 12 s+ idle loop (slow drift, heartbeat flow).** Text waits for the 3D clock so words and picture land together.
- **If the 3D is not ready 4.5 s after mount the text is shown anyway, and the 3D later joins at 9.4 s (syringe already in place)**, so a slow device never leaves the visitor in front of a black screen with nothing to read.
- **Keyboard focus anywhere except "Skip intro" reveals all the text at once**, so keyboard users never tab onto an invisible button; buttons stay `pointer-events: none` until revealed for mouse users.
- **Enter (with no control focused) enters the app, Escape skips; both are ignored with modifier keys or while composing text**; a focused button handles its own Enter.
- **Enter / Facts call back immediately and the 3D plays a 0.7 s push-in while main.js fades the overlay**; the loop stops by itself 1.2 s after leaving even if nobody calls `dispose()`.
- **`dispose()` frees every geometry, material, texture and render target, then calls `renderer.dispose()` and `renderer.forceContextLoss()` and removes the canvas**, so the 3D body never shares the GPU with a second live context (verified: `isContextLost() === true` after Enter and after Escape).
- **Reduced motion is one composed still at t = 12.6 s with all text visible and no transitions.** The module also listens to the bus event `motion:change { reducedMotion }` and switches still ⇄ idle loop live (never restarting the sequence); with no `reducedMotion` option it falls back to `html[data-motion]`, then the media query.
- **No allocations in the frame loop** (shared scratch vectors, stage reveal by index instead of iterating the stage table) and the loop pauses on `visibilitychange`.

## Look
- **The intro is always dark**, whatever the site theme (the overlay carries `.force-dark`): it is a cinematic title card.
- **Lighting of the syringe: a black studio environment with soft strip lights for the glass, a front key from the camera's upper left, a little ambient fill, two rim lights, and a tiny point light on the bevel's mirror direction.** The black studio alone made the white plastic read as a dark grey stick; the fill and key fix that without washing out the glass.
- **Bloom threshold 0.8**: only light sources (vessels, blood cells, glints, the needle flash) bloom; lit plastic stays solid. The key is 20 % lower on tall (phone) layouts because the same bloom covers more of a small frame.
- **On phones the syringe sits above the title (upper third) and the copy stacks below**; checked at 390×844 and 360×740 that they never overlap.

## Syringe (js/scene/syringe.js)
- **Modelled on a standard 1 mL tuberculin-style syringe at real size (meters; barrel Ø 6.8 mm, 29 G needle, 12° lancet bevel)**, documented with its local frame at the top of the file so injection.js can place it on the skin by the tip.
- **The finger flange is a solid, frosted shape (it shares the hub's frosted material)**; a perfectly clear flange seen nearly edge-on against black only showed its outline, which read as a stray wire.
- **The barrel ends inside the flange and the flange forms the top of the bore**, so no overlapping transmissive surfaces z-fight there.
- **Plunger rod and thumb press: opaque white polypropylene (satin, low sheen, faint clearcoat).** Opaque because three.js only shows opaque objects through a transmissive barrel; low clearcoat because glossy glints bloomed on phones.
- **Stopper: black rubber with two rounded sealing ribs and a deep groove, a slight silicone sheen** so the rib crests catch thin highlights through the barrel.
- **Graduations are drawn procedurally in the fragment shader with fwidth anti-aliasing (three lengths: every line, every 5th, every 10th), at least ~1 px wide, with minor lines fading first when they crowd under ~3 px**: crisp at the intro's size, no moiré at the small size inside the body. Lines only, never numbers or units.
- **Needle: polished steel (roughness 0.17), the freshly ground bevel facet slightly brighter than the shaft and flat-shaded so it flashes as one facet.**
- **Liquid: own shader in the opaque list (so the glass refracts it), concave meniscus when there is an air gap, wetting the stopper face when there is none; updates move existing vertices (no allocations) with fixed bounds.**
- **`materials.hub` now also drives the flange** (same object), so callers that restyle `glass`/`hub`/`cap` (injection.js does) restyle the flange too; `parts.head` was added (rod head disc). All other extras (`setGlow`, `parts`, `materials`, `dims`, `tip`) are unchanged and additive to the contract.

## Contract notes
- Consumes the foundation proposal `motion:change { reducedMotion }` (not yet in ARCHITECTURE.md).
- `mountIntro` returns `{ dispose() }` plus a dev-only `_state` getter (clock, ready, running, timings) used by the sandbox.
