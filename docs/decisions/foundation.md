# Foundation: decisions

One line each: decision, then why.

## Shell and routing
1. **A tiny inline boot script in `<head>` sets `data-theme`, `data-motion` and `data-intro` on `<html>` before first paint**, because doing it in the deferred `main.js` would flash the wrong theme and flash the app behind the intro. No inline event handlers anywhere.
2. **Intro visibility is owned by `html[data-intro="show|leaving|done|skip"]` with an `!important` hide rule**, so no intro stylesheet can accidentally resurrect a closed intro, and no-JS visitors never see a dead intro.
3. **Intro shows on the first visit per session unless the URL has any hash other than `#intro`, or `?skip-intro`**; `#intro` forces it. Simplest rule that covers `#app` and every section id.
4. **The static DOM intro is fully wired by `main.js` before `intro.js` loads**; once `mountIntro` succeeds, `intro.js` owns Enter / Facts (so it can play an exit) with a 4 s watchdog that force-closes if it never calls back. "Skip intro" and Escape always close immediately, because "skip" must never be slowed by an animation.
5. **Background (`.skip-link`, header, main, footer) is `inert` while the intro is open**, even though the contract keeps `aria-modal="false"`, so Tab can never land on controls hidden behind the full-screen overlay.
6. **The disclaimer bar stays visible above the intro** (forced dark colours there), because the brief requires a persistent disclaimer; the intro also carries its own muted line.
7. **On Enter, focus moves to `#explorer-title` (h1, `tabindex=-1`); on "Read the facts first" the page scrolls to `#overview` and focuses its h2.**
8. **Explorer heading is the page `<h1>`** ("Follow one injection through the body"); the intro title is the dialog's own h1 and disappears with it, so the page always has exactly one visible h1.
9. **`?peptide=` is only written to the URL once the visitor changes the peptide (or it was already there); `?site=` is written on every site choice**, so a plain visit keeps a clean URL while shared links reproduce the state.

## Module loading and wiring
10. **Every dynamic import is wrapped (`safeImport`)**; failures `console.warn` and show a small `.module-notice` in that module's host. Missing `ui/index.js` falls back to a built-in accessible peptide radiogroup and the pre-rendered site buttons.
11. **`#site-picker` ships with three pre-rendered `[data-site][data-shell]` buttons**, so step 2 works and looks finished before (or without) `js/ui`. If `mountSitePicker` replaces them, nothing else happens; if it leaves them, `main.js` keeps them working.
12. **3D mounts only after the intro has closed and `#stage-host` is within 320 px of the viewport**, to avoid two WebGL contexts at once; `body.glb` is prefetched (`<link rel=prefetch>`, skipped on Save-Data / 2G) while the intro plays.
13. **WebGL 2 is feature-detected with a throwaway context that is immediately lost**; `?no3d` forces the fallback for testing.
14. **When the stage becomes ready, `main.js` re-emits the last `peptide:loaded`, `site:select`, `time:change`, `effects:active` and `risk:change` that happened before the scene mounted** (using `bus.last`), because the scene subscribes late and would otherwise miss the current state. Events emitted after mount are not replayed.
15. **Stage counts as ready on `stage:ready` OR when `mountBody()` resolves**, whichever comes first, so the Inject button cannot stay disabled forever if a module forgets the event.
16. **`#play-sequence` uses `aria-disabled` (not `disabled`) plus `#play-hint` via `aria-describedby`**, so keyboard and screen-reader users can still reach it and hear why it is unavailable. A 5 s watchdog resets "Playing…" if no `sequence:phase` arrives.
17. **Timeline and effects are mounted once per ready entry and hidden (not destroyed) for coming-soon peptides**, with a notice sibling, because the contract has no guaranteed dispose; `release()` calls `dispose()` or `destroy()` when a different entry needs a remount.
18. **Narration announces only on phase changes** (`#narration` is `aria-live`), while time and level readouts update silently every frame (rAF-throttled), so screen readers are not flooded while scrubbing.
18b. **The timeline's mount-time `time:change` at t = 0 does not overwrite the idle instructions**; narration follows the timeline only once time moves (or after the first phase it reported).
19. **Level readout says "% of peak" (single) or "% of first peak" (weekly)**; it never mentions dose, per the timeline exclusion.

## Visual system
20. **Dark default palette is blue-black (`#05080c`) with clinical cyan (`#4fd8eb`)**; every text token was checked at ≥ 4.5:1 on all four background tokens in both themes (lowest: light `--artery` 4.81:1 on `--bg-2`).
21. **Status colours: approved = neutral slate, in trials = cyan, research chemical = amber, danger = red; no green anywhere.** Approved is not an outcome verdict, so it stays neutral.
22. **`.force-dark` re-declares the dark tokens** so the intro stays cinematic in light mode without duplicating component CSS.
23. **Motion: `prefers-reduced-motion` or `html[data-motion="reduce"]` collapse durations and animations; `data-motion="full"` lets a visitor opt back in.** The header "Reduce motion" toggle persists in `localStorage btv.motion`.
24. **Inter is self-hosted as a Latin subset of the official variable woff2 (opsz + wght, all OpenType features kept)**: 129 KB roman, 142 KB italic (italic only downloads if used). Subset with fonttools in a throwaway venv.
25. **The intro baseline in `app.css` uses single-class selectors and `stage`/`timeline` host rules use `:where()`**, so `intro.css`, `stage.css` and `timeline.css` override them without specificity fights.
26. **The stage HUD (corner brackets, hairline rulers, mono labels) uses container queries on `#stage-host`**, so labels drop out based on the stage's own width rather than the viewport.
27. **On desktop the peptide picker scrolls inside the rail (`max-height: clamp(140px, 100vh - 724px, 440px)`, with fade masks)**, so step 3 "Inject" stays in the first viewport at 1440×900 even with 20 coming-soon chips.
28. **Section anchors use a negative `scroll-margin-top`** so nav jumps land just above the eyebrow instead of on 128 px of empty section padding.
29. **Nav labels are short ("Timing", "Trial data")** so all 12 links fit inline at 1440 px; below that the nav becomes a horizontal scroll strip with edge fades, and below 720 px the wordmark collapses to the vial glyph.
30. **`404.html` is self-contained with absolute `/peptidescope/` links**, because GitHub Pages serves it at arbitrary depths where relative paths break.

## Verification tooling
31. **`tools/sandbox/foundation.html`** is a token/component gallery with live contrast ratios and a bus self-test (8 checks); **`tools/sandbox/foundation-flow.mjs`** drives `main.js` end to end with mock `intro.js` / `scene/index.js` served by request interception (24 checks: intro, inert, focus, replay of missed state, Inject states, theme/motion events, coming-soon handling).

## Contract requests
- **`motion:change { reducedMotion }`** (emitted by `main.js` when the header toggle or the OS setting changes). Proposed for `intro`, `body3d` and `timeline` to listen to so they can switch to instant transitions without a reload. Not yet in ARCHITECTURE.md.
- **Optional `bus.last(type)`, `bus.once(type, fn)` and `bus.off(type, fn)`** are implemented as additive extras in `js/bus.js`; please add them to the contract if other modules want late-subscriber state.
- **Ask `timeline` and `effects` to return `{ dispose() }`** (effects already does; timeline should too) so a second ready peptide can remount cleanly.
- **Ask `body3d` to emit `stage:ready` after its bus listeners are attached**; `main.js` replays missed state right after it.
