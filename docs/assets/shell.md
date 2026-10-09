# Shell (v4): third-party assets

| Asset | Files in repo | Source | Author | License | Modifications |
|---|---|---|---|---|---|
| Nunito variable font (roman) | `assets/fonts/Nunito-latin.woff2` (50,704 bytes) | Google Fonts' official OFL repository, `ofl/nunito/Nunito[wght].ttf` at commit `2eb0b48d5f760f62e286216f0859a8c540dbc1bd` of https://github.com/google/fonts (SHA-256 of the TTF `bb55a5ca5c2042335b3991af27c4d0705d0ef41cac6164ac737fd8f2a1e85207`); upstream project https://github.com/googlefonts/nunito | The Nunito Project Authors (as named in the font's OFL notice) | SIL Open Font License 1.1 (`assets/fonts/OFL-Nunito.txt`, copied verbatim from `ofl/nunito/OFL.txt`; "Copyright 2014 The Nunito Project Authors"; no Reserved Font Name) | fontTools 4.60.2: `varLib.instancer` limited wght to 600–900 (default 800, name table updated), then `pyftsubset` to Basic Latin, Latin-1, Latin Extended-A, general punctuation, arrows and a few symbols (µ α β Δ − ≈ ≠ ≤ ≥ × ✓ ✕ € ™), all layout features and name records kept, WOFF2. 277 KB TTF → 51 KB. |
| DM Sans variable font (roman) | `assets/fonts/DMSans-latin.woff2` (28,876 bytes) | Google Fonts' official OFL repository, `ofl/dmsans/DMSans[opsz,wght].ttf` at the same commit (SHA-256 `8cd08d97e89c24d0aa92edd2f0f4c8ee6195eee9b7c9f154865a58b02f0c1c0d`); upstream project https://github.com/googlefonts/dm-fonts | The DM Sans Project Authors (as named in the font's OFL notice) | SIL Open Font License 1.1 (`assets/fonts/OFL-DMSans.txt`, copied verbatim from `ofl/dmsans/OFL.txt`; "Copyright 2014 The DM Sans Project Authors"; no Reserved Font Name) | fontTools 4.60.2: `varLib.instancer` pinned opsz to 14 and limited wght to 400–700 (name table updated: "DM Sans 14pt"), then the same Latin subset as Nunito, WOFF2. 240 KB TTF → 29 KB. |

Retired by this step (no longer loaded by any stylesheet; moved to `tools/.cache/retired-fonts/`, still in git
history): Inter 4.1 (`InterVariable-latin.woff2`, `InterVariable-Italic-latin.woff2`, `OFL.txt`) and Newsreader
1.003 (`NewsreaderVariable-latin.woff2`, `NewsreaderVariable-Italic-latin.woff2`, `OFL-Newsreader.txt`).

Drawn for this project, no third-party source: `favicon.svg`, the vial mark and every icon in the sprite in
`index.html` (info, landmark, route, pulse, phone, search, people, compare, message, clipboard, list-check, book,
check, close, chevron, arrow, play, replay, sun, moon, alert, cube, external, body figure), and `404.html`.

Design references (patterns only, no code or assets copied): 21st.dev "Basic Stepper" (sean0205) for the
numbered stepper, "Grid Feature Cards" (efferd) for the Learn grid, and the expandable-card-to-dialog pattern
for the Learn panels; ui-ux-pro-max (local skill) for the "Minimalism & Swiss" style, the Nunito + DM Sans
pairing and the UX checks (contrast, 44 px targets, focus, reduced motion).

To merge into `ASSETS.md` (not owned by this step): the two font rows above, and remove the Inter and
Newsreader rows.
