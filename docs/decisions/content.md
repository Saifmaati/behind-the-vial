# Content module: decisions

One line each: the decision, then why.

## Data (samples)

1. **All data files are schema-complete samples (`sample: true` on every object).** The verified research replaces them wholesale; `tests/data.test.mjs` fails while any sample remains (`PEPTIDESCOPE_ALLOW_SAMPLES=1` skips only that check).
2. **Text placeholders use "00" ("00%", "00 days", "000 adults").** Nothing that looks like a real figure can leak into the shipped site.
3. **Numbers that only drive geometry use artificial repdigit steps (11, 22, 33 ... 133; pk half-life 4.4 d, tmax 1.1 d).** Charts and the timeline need non-zero numbers to be checked visually; a repdigit staircase is obviously fake and none of it is from memory.
4. **Coming-soon statuses are best guesses, flagged sample, with the label "Sample status label: not yet verified".** The enum must hold a valid value for the UI; the label says plainly it is unverified.
5. **Every section shows a dashed "Sample data" note while its data is sample.** Makes placeholder content impossible to mistake for verified facts in screenshots or reviews.
6. **`RISK_ITEMS` carry no `sample` flag and no sources.** They are checklist labels supplied by the brief, not claims; what each item means per peptide lives in the entry's `risk` map, with citations.
7. **Risk-item ids:** `heart-rhythm, pancreatitis, gallbladder, thyroid-mtc, pregnancy, diabetes-meds, kidney, diabetic-eye, mood, surgery, gastroparesis, birth-control, moles-melanoma, eating-disorder` (the test requires all 14).
8. **Sample retatrutide leaves `moles-melanoma` and `eating-disorder` unmapped.** Exercises the required "No specific warning ... That does not mean it is safe for you." path.
9. **`labeledMg` is kept in gray-market data but never rendered.** The message is "% of what the label claims"; showing milligram amounts would edge toward dose information.

## Rendering

10. **String renderers through a tiny auto-escaping `html` tag (`js/ui/util.js`).** Matches the contract's `ctx.cite()` string API and makes it impossible to inject markup from data.
11. **Citations are numbered by first use while sections render in DOM order; risk-warning sources are pre-registered.** The numbers in the text match `#sources`, and ticking a risk item later never renumbers anything.
12. **Multiple citations render as adjacent `<sup class="cite">` elements with a CSS comma.** Keeps the exact contract markup per link (`aria-label="Source n: <title>"`).
13. **A source goes under "Not yet confirmed" if it has `unverified: true` or is cited only by unverified objects.** Readers see which sources still need confirming.
14. **`renderEntry` also mounts the risk check; a later `mountRiskCheck` call from main.js tears down the first and reuses the same citation numbers.** Either call order works and listeners never pile up.
15. **Ticked risk items live only in memory (never storage, never sent) and carry over when the peptide changes.** Health history is sensitive, and the visitor's history does not change with the peptide.
16. **The risk check emits `risk:change` on every mount, including `{ items: [], warnings: [] }`.** Clears stale organ highlights when the peptide changes.
17. **Warnings carry an extra `item` field (`{ organ, title, item }`).** Lets the 3D side group highlights by history item. Additive only.
18. **Coming-soon peptides: overview gets the full stub card; gray-market still renders (general data); red-flags and too-much stubs keep the 911 line plus the Poison Control and 988 cards; the risk check says "We have not mapped warnings for X yet. That does not mean it is safe for you."** Emergency help must never disappear just because an entry is unfinished.
19. **US help lines (Poison Control 1-800-222-1222, 988) are UI constants in `redflags.js` with "These numbers are for the United States".** They are not peptide-specific; the brief supplied them.

## Interaction

20. **Peptide picker: arrow keys move focus and selection immediately but emit `peptide:select` after 260 ms; click, Space and Enter emit at once.** Arrowing across 21 chips should not load and render every entry on the way.
21. **Re-clicking the selected site re-emits `site:select`.** Lets the stage re-focus the spot. Arrow keys emit only on change.
22. **Site picker drops location hints ("back of the arm" etc.); labels only.** Avoids anything that reads as injection technique.
23. **"Show on body" emits `organ:focus` and scrolls `#stage-host` into view only when it is mostly off screen (instant under reduced motion).** Otherwise the button would appear to do nothing.
24. **Organ chips in "How it works" and risk warnings are also `organ:focus` buttons ("Show Brain on the body").** Same wiring, one document-level listener.

## Charts

25. **Charts are static SVG strings drawn at the container's real pixel width and redrawn on resize (ResizeObserver).** Text stays crisp and readable at 360 px instead of a scaled-down viewBox.
26. **Dose facts: small multiples of horizontal bars, one metric each, a shared scale per trial, placebo in neutral gray and studied groups in accent, values at bar tips, no hover, no controls of any kind.** The brief forbids interactivity here; a shared scale keeps the comparison honest.
27. **Charted columns come from optional `trial.chart.columns` (header names); without it, columns matching stopped / discontinued / side effect are charted.** Researchers control it without code changes.
28. **Vial chart: one column per vial sorted low to high, a solid 100% reference line, a red × at the baseline for "none detected", `<title>` per mark, legend, computed summary, and a table in a `<details>`.** The none-detected vials stand out without inventing "under/over" thresholds.
29. **The summary sentence is computed from the data (range of % found and count with none).** No invented cut-offs, and it stays consistent with the chart.
30. **Every data table sits in a focusable, labelled scroll region (`tabindex="0" role="region"`).** Wide tables scroll inside the card with no page overflow, and keyboard users can scroll them.

## Visual language

31. **All classes are prefixed `c-`; derived colors are defined on the content scopes, not `:root`.** Avoids collisions with app.css and follows whichever element carries `data-theme`.
32. **Tones: approved = accent (cyan), in trials = accent-2, research only = warn; severity common = neutral, notable = warn, serious = danger; verdict supported = accent, partly = warn, not supported = danger, unknown = muted.** No green anywhere, and every tone also has a shape (dot, half dot, diamond, triangle, ×) and a text label.
33. **Text on tints uses `color-mix(tone, --text)`.** It keeps 4.5:1 in both themes automatically. The sandbox contrast audit reports 0 failures with the sandbox tokens and with the real `css/tokens.css`, dark and light.
34. **The "Call 911" button background is the danger color mixed 74% with black.** White text then clears 4.5:1 (plain `--danger` would be about 3.2:1).
35. **content.css has a defensive reset for header/footer/section/article/aside/figure/fieldset inside `.c-body`, plus border-box sizing.** A page-level `footer {}` rule leaked 48 px of padding into card footers during testing.
36. **Side effects use CSS columns (masonry) of organ groups.** Most organs have one effect; a grid left large holes.
37. **Peptide picker: a featured retatrutide chip, then an aligned grid of coming-soon chips; below 720 px the grid becomes a two-row horizontal scroller.** Twenty ragged chips were noisy, and at 360 px a full grid would push the body far down the page.
38. **Print: light ink tokens inside content scopes, no glass or shadows, buttons hidden, source URLs printed, `<details>` opened on `beforeprint`.**

## Contract requests

(Additive, optional fields. Renderers fall back gracefully when they are missing.)

- `pk.phases[].display?: string`: the text shown on the stat tile (for example "about 2 days"). Without it the tile shows `tDays` in words ("about 18 hours", "about 5 days", "about 3 weeks").
- `doseFacts.trials[].chart?: { columns: [<column header>, ...] }`: which columns to chart. `columns` may include the group column first (`cells.length === columns.length - 1`) or not.
- `doseFacts.sources`, `evidence.sources`, `GRAY.intro`: under the contract rule "every text-bearing object carries sources", `intro` and `summary` text needs sources too. The test enforces this.
- `SOURCES[id].unverified?: true` puts a source in "Not yet confirmed".
- Return values: `mountPicker` and `mountSitePicker` return `{ select(id|site), selected, destroy() }`; `renderEntry` and `renderComingSoon` return `{ ctx }`; `mountRiskCheck` returns `{ items, destroy() }`.
- main.js does not need to call `mountRiskCheck` after `renderEntry`, because `renderEntry` already mounts it. The second call is harmless.
- `risk:change.warnings[]` items are `{ organ, title, item }`.
