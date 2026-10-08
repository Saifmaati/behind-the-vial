# Decisions: timeline (js/pk.js, js/timeline.js, js/effects.js, css/timeline.css)

The chart-era timeline decisions were replaced on 2026-10-08 by the plain-text timeline below.

One line each: decision, then why.

## Model (js/pk.js)
- One compartment, first-order absorption (Bateman), everything normalized so one shot peaks at exactly 1.0: the only honest shape we can draw from a published half-life and time to peak, and it never carries an amount.
- `kaFromTmax` solves ln(x)/(x−1) = tmax·ke by log-space bisection (x = ka/ke > 1): that function is strictly monotonic, so bisection always converges with no tuning.
- `kaFromTmax` throws a RangeError when tmax ≥ half-life/ln2 (no ka > ke exists), and the timeline catches it and shows its disabled state: drawing a made-up shape would be worse than drawing nothing.
- "Mostly cleared" = level down to 3 % of the peak (`CLEARANCE_FRACTION = 0.03`), which is about 5 half-lives, as specified; the constant is exported so the copy and the math cannot drift apart.
- Steady state = the first shot number n ≥ 2 whose trough (just before shot n+1) differs from the previous trough by < 5 %. Shot 1 has no previous trough, so it is never "steady". For a 6-day half-life with weekly shots this gives 5 (tests check 4 to 6 over tmax 0.5 to 4 days).
- The weekly plateau is computed by superposition and never hardcoded; a test checks it against the closed-form steady-state Bateman series.
- Extra exports beyond the contract: `keFromHalfLife`, `tmaxFromRates`, `riseTimeToFraction`, `paramsFromPk`, and the constants. They are additive.

## Timeline (js/timeline.js): plain text, no graphs (timeline-text, 2026-10-08)
- Owner: "NO GRAPHS". The SVG level curve, fill, axes, plateau band, markers and the "% of peak" readout are gone. Timing shows through the body animation (the 3D glow and the side-effect list follow `time:change`) plus plain text: a time readout in words, the phase name, a milestone row and the current milestone's cited text.
- Milestone names are fixed plain language (Starts working, Peak, Half gone, Mostly cleared). The entry's own term (`pk.phases[].label`, e.g. "Onset", "Half-life") is shown beside the name only when it differs; the figure (`display`) and the text (`text`, cited) always come from the entry. No figure is shown when the entry has none: the model's day counts are never printed as facts.
- Milestone positions use the entry's `pk.phases[].tDays` (model fields the data already carries); only a missing one falls back to js/pk.js, and that milestone is flagged "Estimate". Peak is an estimate when `pk.tmaxEstimate` is set.
- Time in words: elapsed-time convention, as trials use it ("week 20" = 20 weeks in). Under a day: "N hours after the shot" ("The shot" at 0, "Minutes" before 1 h); Day N up to day 13; Week N from day 14. `timeWords()` is exported so other modules can match it.
- The scrubber is not linear in time: position² ∝ time over a 6-week view. Onset (2 h) and peak (day 1) would otherwise sit in the first 2 % of the track; this spreads the milestones out (about 4 %, 15 %, 42 %, 87 %) and makes playback linger on the first hours and move quickly through the weeks of clearance. Allowed now that no plot has to match the track. The readout and `aria-valuetext` always state the actual time.
- Keyboard as before, in days: arrows ±¼ day (snapped to the quarter-day grid), Page Up/Down ±1 day, Home/End. The key hint floats under the track only while the scrubber has keyboard focus, so nothing moves.
- Phase states (readout, `aria-valuetext`, `time:change.phaseId`) are unchanged: injection, onset, peak (level within 90 % of its peak, so the "12 to 72 hours" peak window can be landed on), falling, halfLife, clearance. Labels: Under the skin, Starts working, Peak, Past the peak, Half gone, Mostly cleared. `aria-valuetext` reads like "Day 1: peak (estimate)".
- The highlighted milestone follows the phase (falling keeps Peak highlighted), not the last tDays passed, so "Peak" lights up across the whole peak window.
- Before "Starts working" the detail shows the entry's cited depot absorption step, never a generic sentence.
- Weekly mode: no toggle and no weekly time model any more. The entry's `steadyState` phase is a folded "Steady level with weekly shots" text. `setMode('weekly')` opens that text and `setMode('single')` folds it: it only changes the explanatory text. `time:change.mode` is always 'single' (shot 1 of 1), so js/effects.js never switches to its repeated-shot clock on a one-shot timeline.
- `time:change` keeps every field it had (tDays, level, levelNorm, phaseId, phaseLabel, estimate, mode, shot, shots, sinceShotDays, intervalDays, tEnd, peptideId); DOM updates are synchronous and the emission is rAF-throttled with a 120 ms fallback, as before.
- Reduced motion: play jumps milestone to milestone (then the end of the view) every 1.7 s; live `motion:change` switches style mid-play.
- Play never starts on its own. `sequence:start` pauses; `sequence:done` sets t = 0 and shows "Press play to follow the next 6 weeks, or drag the timeline."
- Coming soon (no entry): the readout says "Coming soon · Timeline arrives with the full entry" and the scrubber is hidden rather than shown disabled.
- The head (play, readout, scrubber) keeps the `.tl-head` / `.tl-scrub-foot` classes main.js measures, so the desktop layout still keeps play and the scrubber above the disclaimer bar.
- `citeSlot()` is the new name for the empty citation slot; `citePlaceholder` stays exported as an alias because js/effects.js imports it.
- Styles for the new parts live only in the block at the end of css/timeline.css that starts `/* timeline-text (plain text timeline) */`; the chart rules above it no longer match anything and are the theme owner's to delete.
- The sandbox (tools/sandbox/timeline.html) now runs on the real retatrutide entry with a numbered source list from data/sources.js; no sample data, fake numbers or placeholder text.

## Effects (js/effects.js)
- Timing rule. In the one-shot view, an effect is active when fromDays ≤ t ≤ toDays. In the weekly view, an effect whose window fits inside one interval (toDays ≤ intervalDays) follows the time since the most recent shot, so it recurs after each shot. An effect whose window reaches past one interval (toDays > intervalDays), or that is marked `timing.cumulative: true`, follows the first-shot clock instead: it is active from fromDays after shot 1 until toDays after the latest shot. This is simple and documented, and it errs toward showing an effect rather than hiding it.
- Cards are ordered serious → notable → common, then by window start. More than 4 active cards collapses the rest behind a "Show N more" button (`aria-expanded`). The milder ones are hidden first, and on a phone the list would otherwise run past 4,000 px.
- The host `#active-effects` has `aria-live="polite"` in the DOM contract. While mounted, mountEffects sets it to "off" (and restores it on dispose), then announces a debounced (900 ms) summary in its own live region: "Side effects now possible: … No longer typical: …". Otherwise every card's full markup would be read out on every frame of playback.
- If focus is inside a card that is leaving or being collapsed, focus moves to the list or the toggle first, so keyboard users never lose their place.
- "Show" on each card emits `organ:focus { organ }`. The empty state says "None of the listed side effects is tied to this point on the timeline. They can still happen at any time.", which carefully avoids implying "safe".
- The pure helper `activeEffectIds(sideEffects, state)` is exported so it can be unit-tested and reused (for example by the 3D side).

## Citations
- `js/ui/cite.js`'s standalone `cite()` restarts its numbering on every call, so a number like "1" would not match the numbered #sources list. We do not use it. Order of preference: (1) a page-level context, if cite.js exports `pageCite(ids)` or `getPageContext()` (see the request below); (2) the number of the rendered `#src-<id>` element (`data-n`, `value`, or its position in the `<ol>`), printed with the same `<sup class="cite">` markup; (3) a plain publisher link built from `data/sources.js`.

## Third-party assets
- None. No fonts, icons or images beyond the project's tokens; the icons are inline SVG paths written here.

## Contract requests
1. **js/ui/cite.js**: export a page-level citer bound to the same context `renderEntry()` uses, for example `export function pageCite(ids)` (or `getPageContext() → ctx`), so citations rendered outside `renderEntry` (timeline detail, effect cards) carry the same numbers as `#sources`. timeline.js already feature-detects both names.
2. **`time:change` detail**: please document the extra fields timeline.js sends: `levelNorm` (0..1, level ÷ the highest level in the current view), `estimate` (bool), `shot`, `shots`, `sinceShotDays`, `intervalDays`, `tEnd`, `peptideId`. Since the no-graphs change `mode` is always 'single' and `level` never exceeds 1; `levelNorm` stays the field to feed `vessels.setDrugLevel(0..1)`.
3. **`effects:active` items** also carry `alsoOrgans: [...]`, so the body can light up secondary organs dimly.
4. **Timeline instance** also exposes read-only getters `tDays`, `mode` and `playing` (additive).
5. **Data (optional fields)**: `sideEffects[].timing.cumulative: true` forces the repeated-exposure clock. A `pk.phases` entry with `id: 'steadyState'` (label, display, text, sources) becomes the folded "with weekly shots" text. `pk.phases[].display` is shown as the reported figure.
6. **Foundation**: `index.html` needs `<link rel="stylesheet" href="css/timeline.css">`. main.js should mount timeline/effects once; both modules re-initialise themselves on `peptide:loaded`, so main does not need to remount them, and if it does, it must `dispose()` the old instance first.
7. **Exports used across my files**: `fillCitations(root)` and `citeSlot(ids)` (alias `citePlaceholder`, still imported by effects.js) and `timeWords(tDays)` are exported from timeline.js; `activeEffectIds` is exported from effects.js.
8. **Integration (main.js / effects.js owners)**: `#readout-time` in main.js and the effects header ("Day 0.3 after the shot") format time differently from the timeline ("6 hours after the shot", "Day 7", "Week 4"); importing `timeWords` from timeline.js would make all three match. docs/ARCHITECTURE.md still describes timeline.js as "SVG level curve" and the "% of peak" / level chart in the layout notes.
