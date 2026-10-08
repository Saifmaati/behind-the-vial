# Content UI (v3 pass): decisions

One line each: the decision, then why. Earlier content decisions live in `content.md`; this pass supersedes its "Charts" and "Data (samples)" parts.

1. **No charts anywhere in the content sections; `js/ui/charts.js` is deleted.** Owner rule 10 (no graphs, site-wide); nothing else imported it.
2. **Trial dose facts are journal-style static tables: one row per outcome, one column per study group, placebo column in a quieter tone.** Reading an outcome across the groups shows how side effects and dropouts rose with dose without a bar chart, the way NEJM and The Lancet print it.
3. **Every trial table carries a visible caption "Fixed results from a trial run under medical supervision, as published. Not instructions."** plus the trial's citations; the section callout leads with "Not instructions." followed by the data's own caveat.
4. **On phones (< 560 px) each outcome becomes a block of small cells, each labelled with its study group (`data-group` via CSS); 560–719 px keeps the table with a sticky first column.** A 7-group table cannot be read by sideways scrolling on a phone.
5. **`trial.chart.columns` is no longer used.** It only chose bar-chart metrics; all columns are in the table.
6. **Gray-market vial tests are drawn as a row of glass vials (inline SVG, theme colours from CSS classes): fill height = share of the label amount, a fine line with end ticks = the label amount, an empty vial with an oxblood ∅ = none of the labeled drug found.** Pictorial, honest to scale, and readable without a chart axis.
7. **The vial fill scale is max(200 %, the fullest vial + 4 %, rounded up to 50 %), so the label line sits at half height today.** Over-label vials (165 %, 190 %) stay inside the glass and the 100 % line stays in the same place on every vial.
8. **The powder is ivory with a champagne cast in both themes.** It reads as freeze-dried powder, not a liquid, and keeps the luxury palette.
9. **Exact published figures only under each vial ("51.3 %", "165 %", "None"); no derived numbers.** Strict ledger rule; the TGA vial says "None of the labeled drug found", never "empty", because it held a different drug.
10. **The full per-vial notes are in the `<details>` table, not under the vials.** Keeps the vial row calm; the TGA story also appears as its own "8×" harm entry.
11. **Gray-market enforcement items are grouped for reading: Finnrick figures beside the vials, harms (FDA reports, case reports, TGA test, Victoria liver cluster) as an oxblood ledger, the rest under "Regulators, watchdogs and lawsuits".** Grouping is by id; any new id falls into the enforcement group so nothing is dropped.
12. **Every `GRAY.contamination` item renders as a titled card under "Germs, toxins and other contaminants".** The data writers added the field after the first renderer; the data file's comment still says it is not rendered.
13. **The vial summary sentence is computed from the data and says "none of the labeled drug", not "none of the drug".** The TGA vial contained semaglutide.
14. **#too-much cites the vial-test sources as well as the gray-market root sources.** Its summary sentence mentions the TGA vial, whose source is not in `GRAY.sources`.
15. **Status badge "Approved outside the US" when `status === 'approved'` and the status label never affirms an FDA approval (negated phrases such as "not FDA-approved" or "not part of any FDA-approved medicine" are ignored).** Semax, Selank and thymosin alpha-1; `statusKey()` in `js/ui/util.js` is exported for other modules.
16. **The badge for approved-outside-the-US is a champagne ring with a centre dot.** Same tone as "Approved", different shape, never colour alone.
17. **Timing is a plain-text rail of stops (Onset → Peak → Half-life → Mostly cleared), not to scale, with any other phase (steady state with weekly shots) as a card below.** Owner asked for timing as body animation plus plain text; tiles became a calmer sequence.
18. **Overview gains "Where it acts in the body" from `entry.targets`, the same organs the 3D body lights up, each with its receptors and a "Show on body" button.** Real verified data that no section rendered.
19. **A short opening sentence of a target's effect ("Faster heartbeat.") is set as an italic serif lead; the text itself is unchanged.**
20. **Side-effect cards list `alsoOrgans` under "Also involves".** Real data that was not shown.
21. **Sources show `dateNote`: "Accessed Oct 7, 2026", "Data last updated Jul 30, 2026; accessed Oct 8, 2026".** ISO dates inside the note are formatted the same way.
22. **"Call 911" sits directly under the emergency heading, before the list of signs.** In an emergency the button should not be twelve items down.
23. **Evidence ladder rungs say "Rung n of 4" instead of "Level n of 4".** Avoids any reading of "level" as a drug level.
24. **Sample-data notes and the `sampleNote()` helper are removed; site-picker hints ("Back of the arm") are dropped from the vocabulary.** Data is verified now (no placeholders); the hints read like technique.
25. **Claims cards no longer push "What the evidence shows" to the bottom.** It left large holes under short claims.
