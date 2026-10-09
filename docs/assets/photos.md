# Intro photographs: third-party assets

Real photographs for the v4 intro (vial, insulin syringe with orange caps, blood cells), served as
WebP from `assets/img/`. Every licence was checked on the file's own page on 2026-10-08: the
Wikimedia Commons file page's "Licensing" section (wikitext snapshot kept in
`tools/.cache/photos/<name>/page.wikitext`, with `meta.json`), and for the two NCI images also the
original NCI Visuals Online record, whose site no longer resolves, read from the Internet Archive.
Only public domain and CC BY-SA 4.0 material is used. No image shows a person, an injection, a drug
being drawn up, a price, a brand name or a seller label.

**Fix pass (2026-10-08, docs/assets/fix.md):** the syringe's printed scale numbers and "UNITS" are
retouched out before cropping (`tools/img/retouch-syringe.mjs`); the NCI vial photo is now cropped to the
small vials at the front (16:9 at 800/1200 px, 4:5 at 640 px, because the tighter frame is smaller than
1600 px and nothing is upscaled); the vial-caps photo is cropped to the brown-cap rows (no teal), its
4:5 version turned a quarter (top view). The tables below describe the earlier cut; the current frames
are in `tools/img/photos.config.mjs`.

The originals are not shipped. They live in `tools/.cache/photos/` (git-ignored) and are rebuilt with:

```
node tools/img/fetch-commons.mjs       # originals + licence snapshots (≈ 6.6 MB in total)
node tools/img/make-intro-photos.mjs   # writes assets/img/intro-*.webp and prints sizes
```

## Sources

| Name | Subject | Author | Source page | Licence | Original |
|---|---|---|---|---|---|
| vial | Glass medicine vials with rubber stoppers, metal crimp seals and flip-off caps, no labels; black-and-white studio photograph, 1986 (NCI title: "Chemotherapy Vials") | Bill Branson (photographer), National Cancer Institute | https://commons.wikimedia.org/wiki/File:Chemotherapy_vials_(2).jpg · NCI Visuals Online #2238 (AV-8600-3478-C), archived at https://web.archive.org/web/20250728012355/https://visualsonline.cancer.gov/details.cfm?imageid=2238 | Public domain (US federal government work; `{{PD-USGov-HHS-NIH}}`; NCI: "Reuse Restrictions: None - This image is in the public domain") | 2293 × 1800 JPEG, sha1 `3fc59f39f1bbb767743ff01e38288c1768296ad9` |
| vial-caps | Rows of medicine vials seen from above in their carton: teal and brown flip-off caps, no labels visible, 2024 | Epolk | https://commons.wikimedia.org/wiki/File:Vial_caps.jpg | CC BY-SA 4.0 (`{{self\|cc-by-sa-4.0}}`) | 4722 × 3388 JPEG, sha1 `54283dbdc43e7550e3b861f016ef19a498743d9b` |
| syringe | 1 ml insulin syringe with both orange caps on (needle cap and plunger cap), plunger fully in, empty, on a pure white studio background, 2017 | Rehab Center Parus (uploaded by Rebcenter-moscow; permission confirmed by Wikimedia VRT ticket 2018121410008526) | https://commons.wikimedia.org/wiki/File:Insulin_syringe_foto.jpg | CC BY-SA 4.0 (`{{cc-by-sa-4.0}}`, with the author's note "Attribution is to be given to Rehab Center Parus") | 5171 × 3447 JPEG, sha1 `10bc7a41a859abd18551a271ff2e270ce15330af` |
| blood | Scanning electron micrograph of normal circulating human blood: red blood cells, white blood cells (lymphocytes, a monocyte, a neutrophil) and platelets; black and white, 1982 | Bruce Wetzel and Harry Schaefer (photographers), National Cancer Institute | https://commons.wikimedia.org/wiki/File:SEM_blood_cells.jpg · NCI Visuals Online #2129 (AV-8202-3656), archived at https://web.archive.org/web/20260208233222/https://visualsonline.cancer.gov/details.cfm?imageid=2129 | Public domain (US federal government work; `{{PD-USGov}}`; NCI: "Reuse Restrictions: None - This image is in the public domain") | 1800 × 2239 JPEG, sha1 `f80369b4346754e2581bd1a73bacdece92f271bc` |

## Files in `assets/img/`

All files: WebP (lossy, quality 82, Lanczos3 downscale, no upscaling), auto-oriented, no EXIF/GPS/XMP/ICC
(RIFF chunks are only `VP8 `, or `VP8X`+`ALPH`+`VP8 ` for the cut-out). Frame = the region of the
original that was kept (px), before resizing.

| File | Size | Bytes | From | Changes |
|---|---|---|---|---|
| `intro-vial-1600.webp` | 1600 × 900 | 115 704 | vial | 16:9 crop (2110 × 1187 at 119,460) centred on the group of vials; resized |
| `intro-vial-800.webp` | 800 × 450 | 24 236 | vial | same crop, smaller |
| `intro-vial-4x5-1280.webp` | 1280 × 1600 | 163 070 | vial | 4:5 crop (1440 × 1800 at 734,0), the right-hand group; resized |
| `intro-vial-4x5-640.webp` | 640 × 800 | 24 898 | vial | same crop, smaller |
| `intro-vial-caps-1600.webp` | 1600 × 900 | 81 964 | vial-caps | 16:9 crop (4297 × 2417 at 378,384), carton wall trimmed; resized; EXIF incl. GPS removed |
| `intro-vial-caps-800.webp` | 800 × 450 | 35 502 | vial-caps | same crop, smaller |
| `intro-vial-caps-4x5-1280.webp` | 1280 × 1600 | 88 236 | vial-caps | 4:5 crop (2455 × 3069 at 425,160), three columns of vials; resized |
| `intro-vial-caps-4x5-640.webp` | 640 × 800 | 36 988 | vial-caps | same crop, smaller |
| `intro-syringe-1600.webp` | 1600 × 900 | 15 256 | syringe | 16:9 crop (4654 × 2618 at 259,415) on the original white; resized |
| `intro-syringe-800.webp` | 800 × 450 | 6 614 | syringe | same crop, smaller |
| `intro-syringe-4x5-1280.webp` | 1280 × 1600 | 23 982 | syringe | rotated 45° anticlockwise (needle cap up-right) on white, 4:5 crop; resized |
| `intro-syringe-4x5-640.webp` | 640 × 800 | 9 864 | syringe | same, smaller |
| `intro-syringe-cutout-1600.webp` | 1600 × 300 | 29 706 | syringe | tight crop (4008 × 752 at 582,1348); white studio background made transparent (only white connected to the frame edge, 2 px edge band un-mixed from white); resized. Works on light and dark backgrounds |
| `intro-syringe-cutout-800.webp` | 800 × 150 | 13 498 | syringe | same, smaller |
| `intro-blood-1600.webp` | 1600 × 900 | 126 128 | blood | 16:9 crop of the top of the frame (1800 × 1013 at 0,0), mostly red cells; resized |
| `intro-blood-800.webp` | 800 × 450 | 44 506 | blood | same crop, smaller |
| `intro-blood-4x5-1280.webp` | 1280 × 1600 | 175 374 | blood | 4:5 crop (1791 × 2239 at 5,0), nearly the whole frame incl. two white cells; resized |
| `intro-blood-4x5-640.webp` | 640 × 800 | 66 810 | blood | same crop, smaller |

Budgets met: every 1280/1600 px file ≤ 200 KB, every 640/800 px file ≤ 90 KB. Total 1.1 MB for all
18 files; a visitor downloads one size of each picture actually shown.

The `intro-syringe-*` and `intro-vial-caps-*` files are adaptations of CC BY-SA 4.0 works and are
themselves licensed **CC BY-SA 4.0**. The `intro-vial-*` and `intro-blood-*` files are public domain.

## Attribution lines

For the site's footer/credits (shipped files may only link to cited source hosts, `github.com`,
`saifmaati.github.io` and `creativecommons.org`, see `tests/commerce.test.mjs`, so the full source
links live in ASSETS.md and the site links there):

Plain text, one line:

> Photos: insulin syringe by Rehab Center Parus and vial caps by Epolk, both CC BY-SA 4.0, via Wikimedia Commons (cropped, resized; syringe background removed); medicine vials (Bill Branson) and blood-cell micrograph (Bruce Wetzel, Harry Schaefer) from the National Cancer Institute, public domain.

HTML (links only to the licence deed and the project's credits page):

```html
Photos: insulin syringe by Rehab Center Parus and vial caps by Epolk, both
<a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener">CC BY-SA 4.0</a>,
via Wikimedia Commons (cropped, resized; syringe background removed); medicine vials (Bill Branson)
and blood-cell micrograph (Bruce Wetzel, Harry Schaefer) from the National Cancer Institute, public
domain. <a href="https://github.com/Saifmaati/peptidescope/blob/main/ASSETS.md" rel="noopener">Credits and licences</a>
```

Short per-image credits (for a caption or `figcaption` next to each picture):

| Picture | Credit line |
|---|---|
| vial | Photo: Bill Branson, National Cancer Institute (public domain) |
| vial-caps | Photo: Epolk, CC BY-SA 4.0, via Wikimedia Commons (cropped) |
| syringe | Photo: Rehab Center Parus, CC BY-SA 4.0, via Wikimedia Commons (cropped; background removed) |
| blood | Electron micrograph: Bruce Wetzel and Harry Schaefer, National Cancer Institute (public domain) |

### Section for ASSETS.md (owned by another module; paste as is)

```md
## Photographs (intro)

| Asset | Files | Source | Author | License | Changes |
|---|---|---|---|---|---|
| Insulin syringe with orange caps | `assets/img/intro-syringe-*.webp` | https://commons.wikimedia.org/wiki/File:Insulin_syringe_foto.jpg | Rehab Center Parus | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); our versions are CC BY-SA 4.0 too | cropped, resized, one version rotated 45°, one with the white background made transparent; metadata removed |
| Medicine vial caps (top view) | `assets/img/intro-vial-caps-*.webp` | https://commons.wikimedia.org/wiki/File:Vial_caps.jpg | Epolk | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); our versions are CC BY-SA 4.0 too | cropped, resized; metadata (incl. GPS) removed |
| Glass medicine vials ("Chemotherapy Vials", 1986) | `assets/img/intro-vial-*.webp` (not `-caps`) | https://commons.wikimedia.org/wiki/File:Chemotherapy_vials_(2).jpg (NCI Visuals Online #2238) | Bill Branson, National Cancer Institute | Public domain (US government work) | cropped, resized |
| Scanning electron micrograph of human blood (1982) | `assets/img/intro-blood-*.webp` | https://commons.wikimedia.org/wiki/File:SEM_blood_cells.jpg (NCI Visuals Online #2129) | Bruce Wetzel and Harry Schaefer, National Cancer Institute | Public domain (US government work) | cropped, resized |
```

## Suggested alt text (describes only what is in the picture)

| Picture | Alt |
|---|---|
| vial | Real glass medicine vials with rubber stoppers and metal seals (black-and-white photo). |
| vial-caps | Rows of real medicine vials seen from above, with teal and brown flip-off caps. |
| syringe | A real insulin syringe with orange caps on both ends. |
| blood | Real human red blood cells seen through an electron microscope (black-and-white). |

## Looked for, not used

- **A colour photo of a single, unlabelled small vial with a flip-off cap on a clean background**: not
  found under an acceptable licence. Every colour single-vial photo on Commons that fits (for example
  the CC BY 4.0 series by Wesalius on white backgrounds) carries a printed drug label with a brand or
  manufacturer name, which the brief excludes. The unlabelled vials used here are the NCI
  black-and-white studio photo and the top-view caps photo.
- **Alternative syringe**: `File:Insulin_syringe_white_background.jpg` (Wesalius, CC BY 4.0) has an
  orange needle cap but a clear plunger end, so it does not match "orange at the ends"; not used.
- **Optional skin macro**: not added; nothing tasteful under an acceptable licence was found quickly,
  and the intro uses our own anatomy renders for the body.
- Excluded on sight: anything with a person injecting, a drug being drawn up, brand or seller labels
  (Humulin, Solu-Medrol, Helicid, GlucaGen, COVID-19 vaccine vials and similar), and CC BY-NC or
  "all rights reserved" stock images.
