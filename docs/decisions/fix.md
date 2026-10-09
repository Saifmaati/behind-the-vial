# Fix pass: decisions (review findings, 2026-10-08 night)

One line each: decision, then why. Grouped by the review lens that raised it.

## Safety
1. **The Finnrick results database is cited but never linked; its record points at Finnrick's methodology page with a "link withheld" note, and the seller-certificate records and the uncited FDA warning letters addressed to named sellers are dropped** (tools/source-overrides.mjs, applied by tools/build-sources.mjs), because the results page lists sellers, star ratings and prices, and data/sources.js ships to every visitor; research/ stays untouched.
2. **tests/commerce.test.mjs gained a check on source titles and URLs (seller names, vendor/price wording, product, seller and certificate pages)**; the one "/products/" path allowed is the manufacturer's medical-information Q&A, which sells nothing.
3. **The syringe photo's printed numbers and "UNITS" are retouched out (tick marks kept) instead of choosing another photo**, because it is the only licensed photo with orange caps on both ends; the retouch rebuilds the barrel from its own clean pixels per row, so it still reads as a real object, and the credits say "printed scale numbers removed".
4. **No "with weekly shots" block on the explorer timeline; the accumulation fact stays in "How it works", reworded with no schedule and no week count**, because "12 mg · weekly · steady after 4–5 weeks" assembled a dosing plan from fixed facts.
5. **"How it is given" is gone from the "What is it?" tiles and `route` no longer says "weekly"**; the trial sentence in the details keeps the context.
6. **Side-effect rows in the explorer say "the highest-dose group" instead of "12 mg group"** (12 mg is the top arm in every trial cited); exact arms stay in "The trials", which carries the "not instructions" caption.
7. **Injection framing: "Pick a spot to follow", "In the body, it starts in the fat layer under the skin", "Does the spot change what happens inside?", and the protocol sentence "every shot was to go into the belly" removed**, so nothing reads as where, how deep or how to inject.
8. **In the 3D sequence the syringe fades out as it reaches the skin (never shown in tissue) and the cross-section labels only Skin and Fat**; the depot still forms, so the story is intact.
9. **Site markers are a soft area highlight (a glowing disc with one rim), not a bullseye**, and they always face the camera, which also answers the teen review's "edge-on smudge on the arm".
10. **For any peptide but retatrutide, "What's really in the vial" opens by saying no tests of that peptide are shown and these are vials sold as retatrutide; every vial is captioned "Sold as retatrutide"**, so nobody reads them as tests of their own peptide.
11. **"Real medicine vs. internet vial" rows about GLP-1 pens and "Retatrutide right now" carry `appliesTo` and show only for those peptides.**
12. **The risk check gains "I'm under 18" (first) and melanotan II/I mole and melanoma warnings, all from claims already verified in the ledger**; the "tanning peptides" hint shows only for peptides that have a mapping; the under-18 warning lights no organ (`wholeBody`).
13. **Continuation statistics ("most went away while people kept taking the drug") are dropped from "What helps"; both texts end with when to tell a doctor.**
14. **Timeline and side effects appear only after the visitor has watched the shot (or straight away when there is no 3D)**, so no red emergency card greets anyone before a shot.
15. **Effects tied to weeks of repeated use (cumulative windows starting two weeks or later: muscle loss, gallbladder, diabetic eye, hair loss) are left off the one-shot timeline and listed in the Side effects panel as "with repeated use".**
16. **"If you have one" no longer gives pen-sharing advice ("even with a new needle"), which presumes injecting; "Don't touch used needles" keeps the infection and needle-stick facts.**
17. **Creator claims open with the safety and legality checks; the "Supported" weight-loss card adds "in adults, in a supervised trial, with the real product, not an internet vial".**
18. **Sermorelin's one-liner ends with the compounding fact and "That does not make the versions sold today safe or tested."**

## Accuracy
19. **The first timeline stop is "In the blood · Within 2 hours (small study)"**, because 2 hours is when the drug was found in blood, not when it worked; the cited text already says the first measured effects were at about 24 hours.
20. **Half-life reads "About 6 days after the peak", the "How it works" summary says "After it peaks, the amount in the blood falls by half about every 6 days", and the stretch after the marker reads "More than half gone".**
21. **A replayed `peptide:loaded` carries `replay: true` and only the 3D scene takes it**, so a slow 3D load no longer snaps the timeline back while the narration keeps the old phase.
22. **The Utah charge is dropped from the Public Citizen card** (its only support was an unusable news item); the endotoxin harm gloss is dropped; the semaglutide card says "reported" and notes that two vials had only an upper limit; "resting" heart rate becomes "heart rate"; dysesthesia timing names semaglutide as the source of the drug-level link; "35 studies" becomes "No registered retatrutide study".
23. **The "Estimate" chip is kept off the measured 12–72 h peak range**; only estimated figures carry it.
24. **The expanded-access sentence now cites ClinicalTrials.gov NCT07629401 and its ledger claim.**
25. **"Too much" says "the 4 individual vials shown in 'What's really in the vial'" and adds Finnrick's larger range from the data item itself (value and citation).**
26. **Protocol titles corrected through the source overrides (GZBD(c) for NCT04867785, GZBF(b) for NCT04881760); ids unchanged.**
27. **Melanotan I's badge shows what is sold online ("research-only"; the label names the Scenesse implant); approvals for one narrow use (Vyleesi, Forzinity, Egrifta) show "Approved for one narrow use".**
28. **Clearance narration says most of it has left the blood and small amounts can be found for weeks**, matching the cited 7-week detection.

## Teen UX and layout
29. **Intro body and organ stills re-rendered from our scene with the vessel layer off, in light and dark (switched by `html[data-theme]`)**; alt text no longer mentions blood vessels.
30. **Intro vial photo cropped to the small vials at the front (largest size 1200 px, nothing upscaled); the caps photo cropped to the brown rows (no teal)**, matching "Little vials" and the no-neon palette without recolouring a real photo.
31. **Phones: title, then the body at about half the screen, then the stepper and the step card**; the lede is hidden there.
32. **Labels on the body: 3 under a 600 px stage, 5 under 900 px, else 6, ranked serious > injection site > organs; the rest fold into small tappable dots; the injection-site label is never dropped and subtitles wrap instead of being cut off.**
33. **Organ labels say what happens ("Eating less", "Slower emptying") from the first sentence of the cited target text**; receptor names stay in "How it works".
34. **Side effects are compact rows with "Learn more"; serious ones plus three others, then "Show all N"; the count reads "N side effects can show up around now".**
35. **The Body panel never hides the body: a sheet under it in single-column layouts (the stage grows), a side panel with the body framed beside it on desktop; effect labels step aside while it is open.**
36. **Coming-soon peptides show no "still being checked" panels: those cards are hidden; "What is it?", "Is it approved?", "When to get help", "Too much" and the protective cards stay.**
37. **"What is it?" no longer repeats its summary; the jargon is in a collapsed "A bit more detail" row.**
38. **One content width (`--container-wide`) for header, explorer, Learn and footer.**
39. **Hover styles only for fine pointers**, so a card under a finger never looks picked.
40. **Step 3 heading follows the state ("Watching…", "Want to see it again?"); the narration tag is a plain phase name from main.js, never the injection module's own label.**
41. **"Belly" everywhere on the body (3D labels and accessible names), matching the picker.**

## Accessibility
42. **The intro has a persistent "Next" button with a "Space or ↓ for next" hint; focus moves there (or to "Start exploring") when the chapter changes under it; only the visible chapter's controls are tabbable; Enter leaves only on the end card; the cue's name is its visible text.**
43. **Short viewports (≤ 500 px tall, e.g. 400% zoom): the header scrolls away and the disclaimer shrinks (it may wrap to two short lines rather than be clipped); the intro uses the plain story under 320 px and keeps its two-row bar where one row would overlap.**
44. **Danger label titles use the darker ink (≥ 4.5:1); off-state switches and the checkbox border use the muted ink (≥ 3:1).**
45. **"Show on the body" from the side-effect list and from Learn panels scrolls to the body and moves focus to the canvas; a panel closed that way does not send focus back to its card.**
46. **Touch targets: 44 px for stage tools, the Body button, label pills (invisible hit area), body-panel controls, Learn-panel toggles, organ buttons, source titles, footer emergency links; citation pills get an invisible larger hit area.**
47. **One announcer at a time: the narration's live region is off while the timeline plays (the timeline names each phase); the side-effect list announces nothing at load.**
48. **The canvas is `role="application"` so screen readers pass arrow, plus and minus through; peptide aka names are visible text; the picker's radiogroups own only radios.**
49. **Focus never drops to `<body>` when "Skip animation" hides; the credits popover closes when focus leaves it; the Body panel scrolls into view before its tab takes focus.**

## Performance
50. **No WebGL, three.js or body.glb during the intro; downloads start on the last two chapters; one WebGL probe after the intro, passed to the scene.**
51. **Shader warm-up: once a site is picked, the sequence's materials (both opacity variants) and the double-sided skin are compiled with compileAsync**; verified: no new program compiles during the sequence (was 18).
52. **Zoom buttons and +/− keys fixed (OrbitControls' dollyOut zooms in).**
53. **body.glb streamed once even when the host gzips it (decoded size from the build, the stream's bytes always handed over); loaders and landmarks fetched alongside three.js.**
54. **Parsed bodies cached per variant (Male/Female toggles re-use them); Learn panels and the timeline render after the intro.**
55. **Hover labels lay out without a 3D frame; a lost WebGL context disables Watch and cancels a running sequence; Back/forward closes an open panel; unknown `?site=` values are dropped from the URL; the no-3D poster has a dark version.**

## Retry pass (2026-10-09, after the interrupted run)
56. **Every finding above was re-verified in the running app (1440, 1024, 768, 390, 320×180; light, dark, reduced motion, no 3D, context loss) rather than redone**; nothing had regressed, the test suite passes and no page logs a console error.
57. **On phones and tablets the open Body sheet and the body above it now fit on screen together**: the body part shrinks (never below 240 px) to fit between the header and the disclaimer, and opening the panel scrolls the whole stage into view, because before the head sat under the sticky header while the sliders were visible.
58. **docs/screenshots/ is regenerated by a script (`tools/docs-shots.mjs`), not by hand**, so the README pictures can't drift from the app again (they still showed "Abdomen", "Muscle: deeper layer" and "not into a vein").
