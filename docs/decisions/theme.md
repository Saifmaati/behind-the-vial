# Theme (luxury pass): decisions

One line each: decision, then why. Files: index.html (outside `#intro`), css/tokens.css, css/app.css,
css/brand.css, css/timeline.css (outside the plain-text timeline block), js/main.js, js/bus.js,
404.html, favicon.svg, assets/fonts/*.

## Palette and type
1. **The v2 hex table in ARCHITECTURE.md is used verbatim for both themes and for `.force-dark`**; extra tokens (`--surface-3`, `--line-faint`, `--gold-fill`, `--gold-rule`, `--sheen`, status tokens) are mixed only from those colours, so nothing off-palette can creep in.
2. **Status colours: approved = champagne, in trials = pale champagne outline, research chemical = bronze amber; never green**, and in the light theme the "in trials" text uses the deeper gold because pale champagne is a fill colour there (about 3:1).
3. **`--font-mono` now points at Inter (`--font-code` is the real monospace)**, so every module that asked for "mono" HUD text gets Inter small caps with tabular numerals instead of a terminal look, without touching their files.
4. **Newsreader is used for headlines, the wordmark, step numerals, narration headings and the readout values; Inter for everything else; small-caps labels use `"case", "tnum"` and wide tracking.**
5. **favicon.svg and 404.html were redrawn in the luxury palette** (they still carried the old cyan); 404.html stays self-contained with absolute `/peptidescope/` links and now shows the name, tagline and "Independent education · Not a seller".

## Name, purpose, wording
6. **Storage keys renamed to `peptidescope.theme`, `peptidescope.motion`, `peptidescope.introSeen`** (and the keyframes to a `ps-` prefix) so no abbreviation of the working title remains; old saved preferences are not migrated, because reading the old keys would reintroduce the old name and only a theme/motion choice is lost.
7. **The preloader is the first frame, so it carries "Independent education · Not a seller" and "Education only · Nothing for sale · Not medical advice · No dosing guidance"**, making the purpose clear within the first second even before the intro.
8. **Header lockup: the full tagline is never truncated**; nav links lost 1 px of padding so all 12 links and the full lockup fit at 1440 px, and below that the nav becomes the existing sideways strip.
9. **Phones get a two-row header: name + tagline + toggles on top (scrolls away), the section strip below (stays pinned via a negative sticky `top`)**, because the old phone header showed only the vial glyph, which broke "PeptideScope everywhere", and a fully pinned two-row header would cost 98 px of a small screen. main.js measures only the pinned part into `--header-h`.
10. **Gray-market lede says "vials sold online"**, and the footer stamp reads "Sources re-checked 8 October 2026" (the date of the strict-source ledger pass) instead of an older date.
11. **The HUD model label no longer says "1.75 m"**; it read like a measurement of the Visible Human Male, which the ledger does not support, and the editable body changes height anyway.

## Narration panel (no graphs, no level numbers)
12. **"Level in the blood: % of peak" is gone; the panel shows time since injection in words and the phase name only** ("Not started" / "Before the injection" until time moves or Inject is pressed, so it never claims an injection that has not happened).
13. **Time in words**: hours under a day, half days up to a week ("1½ days"), then weeks and days up to four weeks, then half weeks; "Since the first shot" in the weekly view.
14. **While the sped-up injection animation plays, the readout names the step and the real span it stands for ("Just injected", then "Hours to days")**, matching the narration copy; the timeline takes over again when the animation ends.

## 3D boot (robust, fast)
15. **The 3D side starts right after first paint (double rAF), not when the stage scrolls into view**: three.js and js/scene/* import and the anatomy streams immediately; the scene mounts as soon as the modules are in and no intro WebGL context is alive.
16. **The mount still waits for the explorer's compose-in motion (≤ 1.6 s, or until the preloader has lifted)**, because in software WebGL the first scene frame blocked the main thread long enough to leave the page blank mid-compose.
17. **#stage-loading shows real progress**: engine 30 % (three.js, then the scene modules), anatomy 55 % (streamed bytes of body.glb), scene build 15 % (until mountBody resolves); the caption names the step in progress and the bar is a `role="progressbar"`.
18. **One streamed fetch of body.glb is shared by the preloader and the stage progress**; it warms the HTTP cache for the scene's own request (GitHub Pages sends a max-age), replacing the old `<link rel=prefetch>`. Save-Data / 2G skips it and credits the anatomy step when the scene is built.
19. **The WebGL 2 probe is cached** so the preloader, the boot and the fallback path never create more than one throwaway context.
20. **Fallback reasons are explicit (`data-reason="webgl|load|start|file"`) with a title and text each**, and a still of the body (`assets/img/body-poster.webp`, made by another step) is added only once it has actually loaded; until that file exists the probe costs one 404 on the fallback path only.
21. **Opened as a file, the inline boot script sets `html[data-file]`, skips the preloader and the intro and leaves the `js` class off**, because browsers block ES modules on file:// and a dead full-screen intro would hide everything; CSS alone then shows a prominent notice and the stage's file message pointing to saifmaati.github.io/peptidescope or `npm run serve`. The local address is written as plain text (no `http://` link), since the commerce test allows links only to cited sources and project pages.

## Motion
22. **Preloader cap lowered to 2.6 s (anatomy grace 0.7 s)**, so it never holds the content back for long; under reduced motion it never shows.
23. **The stage progress line keeps a slow glint over its filled part**, so a long anatomy download still reads as alive; it is switched off with every other animation under reduced motion.
