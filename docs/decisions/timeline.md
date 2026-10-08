# Decisions: timeline (js/pk.js, js/timeline.js, js/effects.js, css/timeline.css)

One line each: decision, then why.

## Model (js/pk.js)
- One compartment, first-order absorption (Bateman), everything normalized so one shot peaks at exactly 1.0: the only honest shape we can draw from a published half-life and time to peak, and it never carries an amount.
- `kaFromTmax` solves ln(x)/(x−1) = tmax·ke by log-space bisection (x = ka/ke > 1): that function is strictly monotonic, so bisection always converges with no tuning.
- `kaFromTmax` throws a RangeError when tmax ≥ half-life/ln2 (no ka > ke exists), and the timeline catches it and shows its disabled state: drawing a made-up shape would be worse than drawing nothing.
- "Mostly cleared" = level down to 3 % of the peak (`CLEARANCE_FRACTION = 0.03`), which is about 5 half-lives, as specified; the constant is exported so the copy and the math cannot drift apart.
- Steady state = the first shot number n ≥ 2 whose trough (just before shot n+1) differs from the previous trough by < 5 %. Shot 1 has no previous trough, so it is never "steady". For a 6-day half-life with weekly shots this gives 5 (tests check 4 to 6 over tmax 0.5 to 4 days).
- The weekly plateau is computed by superposition and never hardcoded; a test checks it against the closed-form steady-state Bateman series.
- Extra exports beyond the contract: `keFromHalfLife`, `tmaxFromRates`, `riseTimeToFraction`, `paramsFromPk`, and the constants. They are additive.

## Timeline (js/timeline.js)
- The time axis is linear. A log or broken axis would make the first days easier to read, but it would distort the decay curve for lay readers, and showing that shape honestly is the point of the chart.
- The one-shot view runs 0 to 42 days, but it stretches in 7-day steps if "mostly cleared" + 3 days would fall past day 42: the clearance marker must always be visible.
- Marker positions come from the model (peak, half, clearance). Onset uses the entry's `pk.phases[onset].tDays` because "starts working" is not a blood-level property. Without it, onset falls back to the time the level reaches 50 % on the way up, flagged "Model estimate".
- The half marker is labelled "Half of peak" on the chart and in the rail, never "Half-life": the level reaches 50 % of the peak a bit more than one half-life after the peak, because the depot is still releasing drug. The entry's own label ("Half-life") and its published figure head the detail panel, and a model line explains the gap.
- The Injection marker's detail text comes from the entry's `absorption.steps[depot]` when there is no `injection` phase, so the text is cited. A generic sentence is used only as a last resort.
- `phases[].display` (the published figure, for example "12–72 h") is shown as a small "Reported" pill next to the detail heading, kept separate from the model's day count.
- Phase states (readout, `aria-valuetext`, `time:change.phaseId`): injection, onset, peak (while ≥ 90 % of the peak), falling, halfLife, clearance. In weekly mode they are buildup and plateau, plus "shot k of 10". Without a "peak" band, a 1-frame peak would be impossible to land on with the keyboard.
- The weekly view shows 10 shots over 70 days. The steady band starts at `entry.pk.steadyStateDoses` (the published claim), and the model's own count appears in the detail's "Model:" line, so the two can be compared. The band's high/low lines come from the last full interval in view.
- DOM updates happen synchronously on every input (key, drag, `set()`). Only the `time:change` emission is rAF-throttled, with a 120 ms timeout fallback. This keeps `aria-valuetext` current when a screen reader reads the key press, and keeps emission working when rAF stalls (hidden tab, headless test browser).
- All keyboard steps are handled manually (arrows ±0.25 day, PageUp/PageDown ±1 day, Home/End) with `step="any"`, so continuous playback values never get snapped by the browser. Arrow steps snap to the quarter-day grid.
- The range thumb's centre is aligned to the SVG time axis: the scrub row is offset by the plot margins minus half the thumb width. Drag on the chart itself also scrubs, and `touch-action: pan-y` keeps vertical page scrolling on phones.
- Play never starts on its own. `sequence:start` pauses, `sequence:done` sets t = 0 and adds a pulsing ring plus the line "Press play to follow the next 6 weeks". Under reduced motion, play jumps between phase markers (weekly mode: each shot's peak) every 1.7 s, and the ring is static.
- During playback a polite live region announces each phase change (debounced). While scrubbing, it stays quiet because `aria-valuetext` already speaks.
- Past vs future: solid glowing line and bright fill up to the playhead, with a dotted, dim line and fill after it. This reads as "where you are" without a second colour.
- Colours: every colour comes from the tokens. Severity uses `--neutral` / `--warn` / `--danger`, never green.

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
2. **`time:change` detail**: please document the extra fields timeline.js sends: `levelNorm` (0..1, level ÷ the highest level in the current view), `estimate` (bool), `shot`, `shots`, `sinceShotDays`, `intervalDays`, `tEnd`, `peptideId`. Note that `level` exceeds 1 in weekly mode (for example 1.8 at the plateau), so `vessels.setDrugLevel(0..1)` should be fed `levelNorm`, or `Math.min(1, level)`.
3. **`effects:active` items** also carry `alsoOrgans: [...]`, so the body can light up secondary organs dimly.
4. **Timeline instance** also exposes read-only getters `tDays`, `mode` and `playing` (additive).
5. **Data (optional fields)**: `sideEffects[].timing.cumulative: true` forces the repeated-exposure clock. A `pk.phases` entry with `id: 'steadyState'` (text + sources) replaces the generic "why levels build up" text in weekly mode. `pk.phases[].display` is shown as the reported figure.
6. **Foundation**: `index.html` needs `<link rel="stylesheet" href="css/timeline.css">`. main.js should mount timeline/effects once; both modules re-initialise themselves on `peptide:loaded`, so main does not need to remount them, and if it does, it must `dispose()` the old instance first.
7. **Exports used across my files**: `fillCitations(root)` and `citePlaceholder(ids)` are exported from timeline.js and imported by effects.js; `activeEffectIds` is exported from effects.js.
