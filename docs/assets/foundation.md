# Foundation: third-party assets

| Asset | Files in repo | Source | Author | License | Modifications |
|---|---|---|---|---|---|
| Inter 4.1 variable font (roman + italic) | `assets/fonts/InterVariable-latin.woff2`, `assets/fonts/InterVariable-Italic-latin.woff2` | Official release zip https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip (files `web/InterVariable.woff2`, `web/InterVariable-Italic.woff2`; zip SHA-256 `9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e`) | Rasmus Andersson and The Inter Project Authors | SIL Open Font License 1.1 (`assets/fonts/OFL.txt`, copied verbatim from the release's `LICENSE.txt`; no Reserved Font Name) | Subset with fontTools 4.60.2 `pyftsubset` to Latin + Latin Extended-A + general punctuation, arrows, a few math and Greek symbols (µ, α, β, Δ, ≈, ≤, ≥, ×, −); all layout features, both variable axes (opsz 14–32, wght 100–900) and all name records kept. 352 KB → 129 KB (roman), 388 KB → 142 KB (italic). |

Everything else owned by foundation (`favicon.svg`, the vial brand mark, the icon sprite in `index.html`, the body-figure glyph) was drawn for this project and has no third-party source.
