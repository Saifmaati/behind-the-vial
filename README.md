# PeptideScope

**Live site: https://saifmaati.github.io/peptidescope/**

*See what viral peptides really do inside your body.*

An education-only website for kids and teens who see injectable "peptides" (starting with retatrutide) on
TikTok and Instagram and want to know what would actually happen inside their body. Every factual claim is
cited. It is not medical advice, it never gives dosing, storage or how-to-use instructions, and nothing is
for sale.

## Status (first draft, v4: 2026-10-08)

Finished:
- Intro: a slow chapter story with real, properly licensed photos (glass vials, an orange-capped insulin
  syringe, a blood-cell micrograph) and renders of the real anatomy. No WebGL. "Education only · Not a
  seller · Nothing for sale" from the first frame.
- Explorer: three steps (pick a peptide, pick a spot, watch) beside a 3D body built from Visible Human
  anatomy (male and female, appearance-only shape controls, lifelike skin or see-through, zoom-in detail).
  The shot goes under the skin, a depot forms, the drug seeps into capillaries, travels with the blood and
  reaches the organs it acts on.
- Plain-text timeline (starts working, peak, half gone, mostly cleared) that drives the body, and side
  effects shown at the organ they come from. No charts.
- Learn: 13 panels (what it is, approval, how it works, side effects, when to get help, too much, what is
  really in vials sold online, if you have one, real medicine vs. internet vial, creator claims, the trials,
  a warnings-only health-history check, sources).
- Light and dark themes, reduced motion, keyboard access, phones from 320 px.

Stubbed ("coming soon"): semaglutide, tirzepatide, cagrilintide, tesamorelin, CJC-1295, ipamorelin,
sermorelin, BPC-157, TB-500, GHK-Cu, melanotan II, melanotan I, PT-141, MOTS-c, SS-31, epitalon, Semax,
Selank, thymosin alpha-1 and KPV show a verified one-line description and status plus the protective panels;
the 3D walkthrough and full facts are retatrutide only. Pharmacist review: pending.

## How the facts were checked

Every number on the site traces to a row in the [research ledger](research/LEDGER.md). Researcher agents
collected each claim with a verbatim quote from a primary source (FDA and other regulators, peer-reviewed
journals, trial registries, Eli Lilly's own releases, Public Citizen, independent lab data); separate
fact-checker agents re-opened every source and tried to refute it. Strict policy: only claims a checker
confirmed or corrected are used; no news outlets, press-release re-hosts or chart-read values.
`tests/traceability.test.mjs` fails the build if any number in `data/` is missing from the claims it cites.

## Deliberately not built

No dose calculator, dose inputs, dosing, titration, storage/refrigeration, preparation, how-long-to-use or
injection-technique content, and no "safe" verdicts (see DECISIONS.md 14). The body editor changes only how
the body looks. No prices, shopping language, seller names or vendor links. `tests/exclusions.test.mjs` and
`tests/commerce.test.mjs` enforce this.

## Run locally

`npm run serve` (or `node tools/serve.mjs 8790`), then open http://127.0.0.1:8790/ . Opening `index.html`
straight from disk (file://) will not work: browsers block JavaScript modules there, so the 3D body and the
intro cannot load. Tests: `node --test tests/`. Before deploying, run `node tools/stamp.mjs` (content-hash cache-busting; a test fails if you forget). Screenshots: `node tools/docs-shots.mjs <site-url>`.

## Docs
- [Product brief](docs/BRIEF.md)
- [Architecture and module contract](docs/ARCHITECTURE.md)
- [Decisions log](DECISIONS.md)
- [Third-party assets and licenses](ASSETS.md)
- [Screenshots](docs/screenshots/)
