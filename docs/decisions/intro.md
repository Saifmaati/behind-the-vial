# Decisions: intro (js/intro.js, css/intro.css, #intro in index.html, tools/sandbox/intro.html)

One line each: decision, then why. v4 (owner, 2026-10-08 evening) replaces the v2 WebGL film entirely.

## Story
- **No WebGL at all: real photographs (vials, the orange-capped insulin syringe, a blood micrograph) and our own renders of the anatomy, cross-faded.** The owner found the procedural needle and vessels fake-looking and the old intro laggy; photos cost nothing to draw.
- **Eight chapters plus an end card, one short line each, in big Nunito:** feed → vials → "no doctor, no prescription" → syringe → body → blood → organs → "Let's look inside." → PeptideScope. The owner said the intro was too short and showed too much information.
- **Chapter 1 reads "Peptide shots are all over your feed." instead of "It's all over your feed."** On the very first frame "It" has nothing to point to; naming the thing keeps the purpose clear from the first second.
- **Chapter 3 ("No doctor. No prescription. No idea what's really inside.") uses the colour vial-caps photo**, so the two vial chapters do not repeat one picture and the story gets some colour early.
- **No numbers, no technique, no amounts anywhere in the copy; "inject them under the skin" is the only mention of injecting.** Brief hard exclusions; the audience is kids and teens.
- **"…your brain, your gut and your heart" comes from data/retatrutide.js targets** (GLP-1 receptors: brain, stomach, heart); "gut" is the plain word for the stomach.
- **The photos are never captioned as peptide or retatrutide vials.** They show other medicines (NCI chemotherapy vials, a vaccine kit); captions say "Real photo · author · licence" and alt text describes only what is visible.
- **The syringe never points at a body and the text never refers to its printed scale**: a cut-out on a soft neutral card, horizontal in wide frames, turned 45° (needle cap up and right) in portrait frames.
- **The black-and-white electron micrograph is tinted red with a CSS filter and its caption says "colour added"**, because a grey picture does not read as blood to a 12-year-old and electron microscopes record no colour anyway.
- **Render alt text was written from the pictures themselves** (organs render: brain, heart, liver and stomach shown in violet), because the renders arrived without a description.

## Layout and look
- **One DOM, two layouts: a plain vertical story by default (no script yet, reduced motion, or intro.js failed) and a sticky scroll-triggered story (`.intro--scrolly`) once intro.js mounts with motion allowed.** The first chapter looks the same in both, so there is no flash when the script arrives, and the intro can never be stuck.
- **Wide screens (≥ 1024 px and landscape ≥ 5:4): words left, a 16:9 picture right; phones and portrait tablets: a 4:5 picture above the words.** `<picture>` art direction with srcset/sizes picks 800/1600 (16:9) or 640/1280 (4:5), so a phone never downloads the desktop crop.
- **Theme-aware (site tokens, light first) instead of always dark**: v4 is light-first; pictures sit on soft neutral frames (`--surface-2`, a hairline and a soft shadow), and the light-background renders read as cards in dark mode.
- **The top bar is the same on every frame: the PeptideScope mark and name, the pill "Education only · Not a seller · Nothing for sale", and Skip intro.** The purpose is obvious from the first second and on any frame someone lands on.
- **The end card is the only place with the h1 ("PeptideScope"), the tagline and the two buttons ("Start exploring" / "Read the facts").** One idea per screen.
- **Photo credits: a one-line caption under every picture, plus a "Photo credits" disclosure on the end card with the full line, the CC deeds and ASSETS.md.** CC BY-SA attribution stays next to the work; shipped links stay on allowed hosts (creativecommons.org, github.com).
- **Progress shows as dots (decorative) plus a 3 px hairline at the top that follows the scroll exactly.** The dots tell where you are; the hairline is the only scroll-linked motion.
- **Short landscape phones get a compact one-row bar and words beside a smaller picture**, so nothing overlaps at 844 × 390.

## Motion and performance
- **Chapter changes are triggered, not scrubbed: crossing halfway between two chapters cross-fades the next one in (opacity 900 ms, line rising 16 px, picture settling from 1.06 to 1) with CSS transitions.** Calm, never half-faded, and the browser does the work on the compositor.
- **The only per-frame work is one `transform` on the hairline, in requestAnimationFrame from a passive scroll listener.** The old intro was laggy; this one does almost nothing per frame.
- **CSS scroll snapping (mandatory, `scroll-snap-stop: always`) gives one chapter per swipe or wheel step.** It is native, smooth and familiar to an audience raised on vertical video.
- **Directional settle: if a gesture ends back on the chapter it started from (a small wheel step or a short swipe the browser snapped back), the intro moves one chapter in that direction.** Headless Chrome snapped single 120 px wheel steps and 300 px swipes back to the start; with passive listeners only, nothing blocks the browser's own scrolling.
- **Pictures more than one chapter away are `display: none` in scrolly mode, so their lazy images load one chapter ahead; only the first picture (the vial) is eager.** Verified: on first load only `intro-vial-800.webp` is requested; neighbours are pre-decoded before their cross-fade.
- **Reduced motion = the plain vertical story with the same pictures and lines: no transitions, no snapping, no animation; keys jump instantly.** `motion:change` switches live and keeps the current chapter.

## Input and accessibility
- **Keys: Space / PageDown / ArrowDown / ArrowRight next; Shift+Space / PageUp / ArrowUp / ArrowLeft back; Home / End; Enter with nothing focused starts exploring.** A focused button keeps its own Space/Enter.
- **Escape and Skip stay with main.js (they always close at once); the intro handles them only when given `onSkip` (the sandbox does).** No double handling on the real page.
- **All chapter lines are real text in one ordered list and stay in the accessibility tree; hidden chapters are only transparent.** A screen reader reads the whole story in order, then the end card.
- **Tabbing onto a control in a chapter that is not showing jumps to that chapter; if the chapter changes while focus is inside it, focus moves to #intro.** Focus is never on something invisible.
- **The first chapter's "Scroll to start" / "Swipe up to start" hint is a real button that goes to the next chapter**, for mouse users without a wheel.
- **A picture that fails to load hides its broken-image icon and leaves the calm frame.** Network errors should not look broken.

## Contract notes
- `mountIntro(host, { reducedMotion, onEnter, onFacts, onSkip }) → { dispose(), go(i) }`; `onSkip` and `go` are additive. Dev handle: `host.__intro = { go(i, { instant }), state }`.
- `onEnter` / `onFacts` are called at once with `{ reason }`; main.js fades the overlay (app.css owns `html[data-intro]`).
- DOM: `#intro-title` (h1), `#intro-enter`, `#intro-facts`, `#intro-skip` kept; `#intro-canvas-host` and `#intro-sub` removed (no canvas any more); `aria-describedby` now points at `#intro-safety`. ARCHITECTURE.md's DOM contract still lists the canvas host (not my file).
- `js/scene/vial.js` deleted (only the old intro used it). `js/scene/syringe.js` stays for the 3D injection sequence; the intro no longer imports it or three.js.
