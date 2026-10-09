# Learn panels, pickers and protective sections (v4): decisions

Scope: `js/ui/*.js` (except `bodyeditor.js`) and `css/content.css`. One line each: the decision, then why.

## Reading order and copy
1. **Every Learn panel opens with a 1-2 sentence plain summary (`.c-summary`), then the details.** The owner said there was too much information; the summary answers the card's question before anything else.
2. **Summaries are taken word for word from verified data (first sentence of a fact object, the status label, the gray-market headline, the trial caveat) or built only from data fields (effect names, receptor names, the data's own time words, verdict counts).** No new facts or numbers in UI copy; citations stay on every sentence that carries a fact.
3. **The timing summary is assembled from each phase's `display` words ("Within hours", "12 to 72 hours", "About 6 days", "Several weeks") and marks an estimated phase "(an estimate)".** Same words as the stops below it, so the two can never disagree.
4. **Plain stop names: Starts working · Peak · Half gone · Mostly cleared, with the data label in brackets when it differs.** The v4 contract's timeline vocabulary; teens get the plain word, the term stays visible.
5. **The claims summary says "Most of the creator claims we checked are not backed by the evidence" only when more than half the verdicts are "not supported"** (computed); otherwise "Some …".
6. **The side-effects summary lists the first three effects marked common in data order, then every serious one; names lose their bracketed glosses ("inflamed pancreas").** Short enough to read at a glance; the full names stay in the rows.
7. **The evidence ladder's first rung is called "Stories online" instead of "Anecdote", and rungs carry no numbers ("Rung n of 4" is gone).** Plainer for teens; no level numbers anywhere.

## Progressive disclosure
8. **Long lists are tap-to-open rows built on native `<details>` (`.c-more`): side effects, warning signs, claims, trials, targets, receptors, evidence gaps, contamination items, per-vial lab notes.** Works with keyboard and screen readers without JavaScript, and nothing heavy renders until opened.
9. **Warning signs stay visible; only the "why it matters" opens.** In an emergency the sign itself must never be hidden.
10. **Route steps show the title and first sentence; "Read more" opens the rest.** The full paragraphs were a wall of text inside a dialog.
11. **The first trial table is open by default; the others are one tap away.** Shows what a table looks like without four tables at once.
12. **The risk check is one column and each ticked item opens its warnings right underneath.** In the 880 px dialog the old side-by-side results fell below fourteen checkboxes, out of sight of the box just ticked. `risk:change` is unchanged.

## Mapping to the shell's Learn dialogs
13. **"Is it approved?" (`data-render="evidence"`) now opens with the approval status (pill + label + first sentence, then the rest as a list), followed by the evidence ladder.** The shell's card asks "Is it approved?"; the status lived only in the overview before. `#approval-status` in the dialog can stay hidden, or it will repeat the status.
14. **"What is it?" (`overview`, part `what`) shows the plain summary, quick facts with a status pill and the "what it is" paragraphs; "How it works" stacks `overview` part `how` (the receptors it fits and the organs it acts on) and `pharmacology` (how it gets in, the timing stops, whether the spot matters), separated by a rule.** Matches the shell's card texts; each host still opens with its own one-line summary.
15. **Hosts may carry `data-part` (overview: `what|status|how`; protect: `have-one|compare`) and a few aliases (`status`, `how`, `timing`, `trials`, `vial`, `if-you-have-one`, `real-vs-internet`); a host without a part shows the parts no other host shows on its own.** The final card split was unknown while building in parallel; any split renders every part exactly once.
16. **Protect renders whichever part its host names (the shell now has `dlg-protect` with `data-part="have-one"` and `dlg-real-vs-internet` with `data-part="compare"`); a protect host without a part shows both, the second under its own heading. Anchors `#protect-if-you-have-one` and `#protect-real-vs-internet` (`tabindex="-1"`) are always present.** Either layout works, and a link can land on a part.
17. **Protect reads `data/protect.js` through a guarded top-level `await import()`; if the file is missing or empty the host stays empty with `data-empty="true"` and nothing throws.** It is written in parallel; the shell's `:empty` skeleton would show meanwhile, so the shell may hide `[data-empty]` cards.
18. **Coming-soon peptides: "What is it?" shows the verified one-line description and status; "Is it approved?" shows the verified status label; other per-peptide panels say the facts are still being checked; help lines, vial tests and the protective sections always show.** Emergency help and protection are not peptide-specific.

## Interaction
19. **Citation links and `[data-open-render]` links open the closed panel that holds their target first: `<details>` are opened, a closed `<dialog>` is opened through its own opener button (`[aria-controls=dlg-…]`), falling back to `showModal()`; then the target scrolls into view, takes focus and gets the shell's `.is-landed` highlight.** Sources live in their own dialog; without this a citation number did nothing. The handler steps aside when the shell already called `preventDefault()`.
20. **Peptide picker: retatrutide as one big card, the twenty others behind a "20 more peptides · Coming soon" disclosure as compact cards.** Twenty cards made step 1 the longest thing on the page; the radiogroup and roving arrow keys still reach every card (arrowing into the closed list opens it).
21. **Picker and site cards follow the 21st.dev "icon card radio group" pattern, rebuilt in plain HTML: a check circle, a name, one short line.** The owner asked for 21st.dev patterns; no React or paid component code is installed.
22. **Site picker labels: "Belly" with "Abdomen" underneath, "Thigh", "Upper arm"; the accessible name keeps both words.** Plain words for kids without losing the term the 3D labels use.

## Visual system
23. **Only v4 tokens (`--surface`, `--primary`, `--info`, `--warn(-bg|-ink)`, `--danger(-bg|-ink)`, `--status-*` …), aliased once on the content scopes with the v4 light values as fallbacks.** Follows `data-theme` and the dark palette with no per-theme rules in this file.
24. **Small coloured text uses the `-ink` tokens; tones always pair a colour with a shape and a word (status, severity, verdict).** Contrast ≥ 4.5:1 in both themes; never colour alone; still no green.
25. **Status pills follow the theme's status tokens: approved = calm blue, in trials = violet, research chemical = amber.** One status language across the site.
26. **Layout inside panels uses container queries on `.c-body` (and `.c-picker`), not viewport media queries.** The panels live in an 880 px dialog on desktop and a bottom sheet on phones; the viewport width says nothing about the panel width.
27. **No blur, backdrop filters, large shadows or animated layout; transitions only on colour, border and transform; all off under reduced motion.** The owner found the site laggy.
28. **Gray-market vials keep the drawn glass pictograms (fill = share of the label found, line = the label amount, ∅ = none found), restyled with the `--drug` violet powder and neutral metal crimp; the table became per-vial tap-to-open notes.** Pictograms are allowed (not a chart) and the notes read better on a phone than a four-column table.
29. **Trial tables turn into one small card per outcome under 560 px of panel width, each line labelled with its study group.** A five-group table cannot be read by sideways scrolling on a phone.
30. **"If you have one" is a single-column numbered list; each step's icon is picked from its title (911 / poison → phone, don't / never → stop, adult / parent → people, doctor / pharmacist → doctor, take-back / sharps → bin).** Order matters in steps, so no two-column grid; icons follow the data instead of a fixed position.
31. **Data intros given as `{ text, sources, editorial }` objects or as plain strings both work; editorial text gets no citation.** `data/protect.js` uses objects; the contract showed strings.
