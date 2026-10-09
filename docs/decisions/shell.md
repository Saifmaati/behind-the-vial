# Shell (v4): decisions

One line each: decision, then why. Files: index.html (outside `#intro`), css/tokens.css, css/app.css,
css/brand.css, css/timeline.css, js/main.js, js/bus.js, js/timeline.js, 404.html, favicon.svg,
assets/fonts/*.

## Design system
1. **The v4 colour table in ARCHITECTURE.md is used verbatim (light default, dark under the media query, `[data-theme]` and `.force-dark` / `.force-light`); every other colour is a `color-mix()` of table colours, declared on `:root, .force-dark, .force-light`** so a pinned subtree derives from its own base colours.
2. **Older token names stay as aliases (`--accent` → `--primary`, `--gold-fill` → solid violet, `--accent-ink` → `--on-primary`, status tokens …)**, because content.css, stage.css and intro.css still read them; nothing had to change in other owners' files.
3. **Small-text inks `--danger-ink` / `--warn-ink` / `--info-ink` (85 % colour + 15 % text) were added**, because the table's light `--danger` is 4.2:1 on `--danger-bg` and `--warn` 4.4:1 on `--surface-2`; the inks are ≥ 5.2:1 everywhere. Every table text colour is ≥ 4.5:1 on `--bg` and `--surface` in both themes.
4. **Status colours: approved = calm blue (`--info`), in trials = violet, research chemical = amber; never green.** Approved is not an outcome verdict, so it is not a "good" colour.
5. **Nunito is instanced to wght 600–900 (default 800) and DM Sans to wght 400–700 at the 14 pt optical size before subsetting**, so both fonts together are 79 KB (were 270 KB for Inter + Newsreader roman); headings only ever use 800/900 and body text never needs the optical-size axis.
6. **Inter and Newsreader were retired**: no stylesheet loads them any more; the files were moved out of the shipped tree to `tools/.cache/retired-fonts/` (still in git history). js/scene/vial.js asks for "Inter" on a canvas label; it falls back to Helvetica/Arial.
7. **Spacing 8·12·16·24·32·48·64·96, radius 16 (controls) / 24 (cards, panels, stage), pill buttons, base 17 px, touch targets ≥ 44 px.**

## Layout
8. **Header: logo + name + tagline, one "Learn" pill and the theme toggle; nothing else.** The 12-link section nav and the header motion toggle are gone; "Reduce motion" is a switch in the footer (OS setting still followed automatically).
9. **Desktop (≥ 960 px): steps and, under them, the timeline and side effects in a 300–400 px left column; the 3D body on the right, sticky under the header** (`grid-template-areas: "rail stage" "after stage"`), so the body stays in view while the timeline is scrubbed and the side effects are read. Phones: steps, body, sentence, timeline, side effects.
10. **Stage height = viewport − header − bar − 140 px, clamped 420–800 px on desktop; `clamp(340px, 58svh, 560px)` on phones** (649 px at 1440×900, 517 px at 1024×768, 490 px at 390×844).
11. **Stepper (21st.dev "basic stepper" pattern, rebuilt in plain HTML): three numbered circles joined by a line, the chosen value under each label, one step panel visible at a time** (`hidden`), the current step `aria-current="step"`, unavailable steps `aria-disabled` (clicking one opens the first step still to do).
12. **Picking moves on only on a click / Enter / Space, never on arrow keys** (APG radio groups select on arrow; advancing there would yank the list away mid-browse). Each step also has a "Next" button. A 3D hotspot click counts as picking a spot.
13. **A coming-soon peptide keeps the visitor on step 1 with a short note** ("… is coming soon. The 3D walkthrough is ready for Retatrutide. You can still open its facts below.") instead of steps that cannot play.
14. **Shared links open on the step they point at**: `?peptide=` → step 2, `?peptide=&site=` → step 3. Other URL params unchanged (`?skip-intro`, `?no3d`).
15. **Stage chrome removed from the shell**: no HUD corners, rulers, model/phase/site labels or phase track; the only text the shell keeps on the stage is what the 3D scene adds (its CC BY credit link and controls).
16. **Narration is one small tag + one short sentence under the body.** Animation steps and timeline phases each map to one fixed sentence (shorter rewrites of the earlier copy, no new facts); the cited detail stays in the timeline. No time, level or percentage readout anywhere.
17. **Learn panels are native `<dialog>`s opened from a grid of cards (21st.dev "expandable card" pattern)** rather than `<details>` in the grid: an opened accordion in a 3–4 column grid either leaves holes or reorders cards, and several topics are long. Dialogs give focus containment, Escape, and a bottom sheet on phones; focus returns to the card.
18. **Card → host mapping uses js/ui's `data-part` support**: What is it? = `overview/what`; Is it approved? = `evidence` (js/ui puts the status first); How it works = `overview/how` + `pharmacology`; If you have one = `protect/have-one`; Real medicine vs. internet vial = `protect/compare`; the rest one host each; the health-history card holds `risk-check`.
19. **A card whose panel rendered nothing is hidden** (MutationObserver on the hosts), so there is never an empty panel or a placeholder (e.g. protect before data/protect.js existed).
20. **Links into a panel open it**: citations open Sources and land on the source (scrolling only the panel's own scroller, then a short highlight); deep links (`#risk-check`, `#src-…`) open the panel after the content renders; closing a panel drops a hash that pointed inside it; "Show on the body" buttons close the panel first.
21. **Panels sit above the disclaimer bar (`inset-block-end: var(--disclaimer-h)`)** so the bar stays readable under the backdrop.
22. **Disclaimer bar text: "Education only · Not medical advice · No dosing guidance · Talk to a trusted adult or a doctor"; its `title` carries the longer form with "clinician"**, because tests/exclusions.test.mjs requires the word in the bar and the owner wants plain words for kids.
23. **"Read the facts first" in the intro lands on the Learn heading** (the facts now live in panels).
24. **404.html redrawn in the v4 palette with the new mark; still self-contained with absolute `/peptidescope/` links.** favicon.svg: white vial on a violet rounded square, legible in both themes.

## Performance (it was laggy)
25. **No scroll listeners**: the header's bottom line comes from one IntersectionObserver on a 4 px sentinel; `--header-h` / `--disclaimer-h` come from a ResizeObserver (`borderBoxSize`, no forced layout).
26. **Removed: preloader, compose-in choreography, section reveals, eased anchor glide, nav scroll-spy, scroll fades and View-Transition theme cross-fade.** Native CSS smooth scrolling with `scroll-padding` replaces the glide.
27. **No `backdrop-filter` on the sticky header or the fixed bar**: blurring over a live WebGL canvas re-composites every frame; both are opaque now.
28. **3D boot runs after the first frame when the main thread is idle (`requestIdleCallback`, ≤ 1.2 s)**; the scene still mounts only after the intro has gone and the fade has finished (450 ms), so the scene's heavy first frame never competes with the intro.
29. **Theme switch is instant** (no cross-fade of the whole page).

## Timeline presentation (js/timeline.js unchanged; css/timeline.css rewritten)
30. **The timeline is one calm card: a 56 px round play button, the time in words in Nunito, a 10 px rounded track with the four milestone pins and a 28 px thumb, the milestones as four soft tiles (2 × 2 below 620 px of card width via a container query), then the cited text.** API, markup and events unchanged.
31. **The side-effect list drops its own eyebrow and "Day 0.3 after the shot" line visually** (still in the DOM for screen readers), because the section heading names it and the timeline already shows the time; cards keep severity colours (amber notable, red serious, neutral common).

## Contract notes (for docs/ARCHITECTURE.md, which this step does not own)
- DOM: `#explorer[data-step]`, `.stepper-btn[data-goto]`, `#step-peptide|#step-site|#step-play` panels (`#step-*-label` headings), `[data-next]`, `#peptide-note`; `#learn` (`#learn-title`, `#learn-peptide`), cards `[data-open=<id>]` → `dialog#dlg-<id>` containing `section#<id>` (overview, evidence, pharmacology, side-effects, red-flags, too-much, gray-market, protect, real-vs-internet, claims, dose-facts, risk-check, sources); `#motion-toggle` is now a `role="switch"` in the footer.
- Removed ids: `#hud-*`, `#readout-*`, `#narration-title`, `.phase-track`, `#explorer-peptide`, `#preloader`, `.site-nav`.
- No new events; `motion:change` and `theme:change` unchanged.
