// The intro photographs: where each comes from and how each web version is cut.
// Licences were checked on each file's own Commons page (see docs/assets/photos.md).
//
// Each output:
//   out     file stem in assets/img/ (files are <out>-<width>.webp; the width is the real pixel width)
//   aspect  [w, h] of the frame
//   crop    { cx, cy, w }: frame centre and frame width as fractions of the (oriented, rotated) original
//   rotate  optional clockwise degrees applied first; exposed corners are filled with `fill`
//   cutout  true: make the pure-white studio background transparent (only white connected to the frame edge)
//   (photo) retouch  'syringe-scale': remove the printed scale numbers and "UNITS" first (tools/img/retouch-syringe.mjs)
//   widths  output widths in px
export const PHOTOS = [
  {
    // NCI Visuals Online #2238, Bill Branson, 1986, black-and-white studio photograph. Public domain.
    name: 'vial',
    commons: 'File:Chemotherapy vials (2).jpg',
    outputs: [
      // fix (teen-ux review): framed on the small flip-off-cap vials at the front ("Little vials"), not
      // the whole group of large bottles. The tighter frames are smaller than 1600 / 1280 px, so the
      // largest sizes are 1200 (16:9) and 640 (4:5); nothing is upscaled.
      { out: 'intro-vial', aspect: [16, 9], crop: { cx: 0.40, cy: 0.665, w: 0.56 }, widths: [800, 1200] },
      { out: 'intro-vial-4x5', aspect: [4, 5], crop: { cx: 0.285, cy: 0.655, w: 0.33 }, widths: [640] },
    ],
  },
  {
    // Epolk, 2024, top view of flip-off caps in a carton. CC BY-SA 4.0. EXIF (incl. GPS) is dropped.
    name: 'vial-caps',
    commons: 'File:Vial caps.jpg',
    outputs: [
      // fix (teen-ux review): only the brown-cap rows, so the intro has no bright teal (v4 palette: no green,
      // no neon). Colours are not changed.
      { out: 'intro-vial-caps', aspect: [16, 9], crop: { cx: 0.5, cy: 0.745, w: 0.62 }, widths: [800, 1600] },
      // (top view, so a quarter turn is harmless: the two brown rows become two columns that fill a 4:5 frame)
      { out: 'intro-vial-caps-4x5', aspect: [4, 5], rotate: 90, crop: { cx: 0.262, cy: 0.5, w: 0.47 }, widths: [640, 1280] },
    ],
  },
  {
    // Rehab Center Parus (rebcenter-moscow.ru), 2017, insulin syringe with both orange caps on, plunger
    // fully in (empty), on a pure white (255) background. CC BY-SA 4.0 (VRT ticket 2018121410008526).
    name: 'syringe',
    commons: 'File:Insulin syringe foto.jpg',
    // fix (safety review): the printed scale numbers (10–100) and "UNITS" are removed; ticks stay.
    retouch: 'syringe-scale',
    outputs: [
      { out: 'intro-syringe', aspect: [16, 9], crop: { cx: 0.5, cy: 0.5, w: 0.9 }, widths: [800, 1600] },
      { out: 'intro-syringe-4x5', aspect: [4, 5], rotate: -45, fill: '#ffffff', crop: { cx: 0.5, cy: 0.5, w: 0.56 }, widths: [640, 1280] },
      { out: 'intro-syringe-cutout', aspect: [1600, 300], cutout: true, crop: { cx: 0.5, cy: 0.5, w: 0.775 }, widths: [800, 1600] },
    ],
  },
  {
    // NCI Visuals Online #2129, Bruce Wetzel and Harry Schaefer, 1982, scanning electron micrograph of
    // normal circulating human blood (red cells, white cells, platelets). Public domain.
    name: 'blood',
    commons: 'File:SEM blood cells.jpg',
    outputs: [
      { out: 'intro-blood', aspect: [16, 9], crop: { cx: 0.5, cy: 0.226, w: 1 }, widths: [800, 1600] },
      { out: 'intro-blood-4x5', aspect: [4, 5], crop: { cx: 0.5, cy: 0.5, w: 0.995 }, widths: [640, 1280] },
    ],
  },
];

// Byte budgets (owner: ≤ 200 KB for the large file, ≤ 90 KB for the small one).
export const BUDGET = { large: 200 * 1024, small: 90 * 1024, largeMinWidth: 1200 };
