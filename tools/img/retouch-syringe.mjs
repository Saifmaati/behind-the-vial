// Retouch for the insulin-syringe photo (Rehab Center Parus, CC BY-SA 4.0): the printed scale
// numbers (10–100) and the word "UNITS" are removed from the barrel, the plain tick marks stay.
//
// Why: insulin-syringe "units" are how gray-market peptide amounts are passed around online, and
// ARCHITECTURE.md's hard exclusions say barrel tick marks carry no numbers or units. The photo is
// otherwise untouched (real object, real orange caps). Credit lines say "printed scale numbers
// removed" (CC BY-SA 4.0 allows adaptations; ours stay CC BY-SA 4.0).
//
// Method (on the full-size, oriented original, 5171 × 3447 px): in the strip of the barrel that holds
// the printed numbers, every pixel darker than its local clean-barrel colour is replaced by that
// colour. The clean colour is measured per row from the brighter pixels around it, so the barrel's
// own shading (horizontal highlight bands, the grey rubber plunger tip) is kept. A soft edge blends
// the repair into the original. The faint mirror-image numbers on the far side of the clear barrel,
// seen between the ticks, are lifted the same way, but only away from the dark tick lines.
//
// Coordinates are in original pixels; they were read from crops of the original.
const BARREL = { top: 1613, bottom: 1839 };
const NUMBERS = { x0: 1560, x1: 3292, y0: 1700, y1: 1839 };     // printed numbers 100 … 20
const UNITS = { x0: 1530, x1: 1662, y0: 1613, y1: 1839 };       // vertical "CC UNITS" by the flange
const PLUNGER = { x0: 3332, x1: 3470, y0: 1703, y1: 1836 };     // "10", printed over the grey rubber tip
const RUBBER_CLEAN = [3471, 3489];                               // clean rubber columns right of the "10"
const GHOSTS = { x0: 1660, x1: 3300, y0: 1616, y1: 1700 };      // mirrored far-side numbers between ticks

export function removeScaleNumbers(data, W, H, C) {
  const lum = (o) => 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  const idx = (x, y) => (y * W + x) * C;

  // Clean colour for row y around x: the mean of the brightest half of the pixels in [xa, xb).
  function cleanRow(y, xa, xb, keep = 0.5) {
    const px = [];
    for (let x = xa; x < xb; x++) { const o = idx(x, y); px.push([lum(o), data[o], data[o + 1], data[o + 2]]); }
    px.sort((a, b) => b[0] - a[0]);
    const n = Math.max(1, Math.round(px.length * keep));
    let l = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < n; i++) { l += px[i][0]; r += px[i][1]; g += px[i][2]; b += px[i][3]; }
    return [l / n, r / n, g / n, b / n];
  }

  // The "10" sits on the grey rubber plunger tip, whose shading runs in horizontal bands: each row of
  // the text area takes the mean colour of the clean rubber columns just right of the text, with a
  // 3 px feather at the left and right edges.
  function cloneRubber() {
    const { x0, x1, y0, y1 } = PLUNGER;
    const F = 3;
    for (let y = y0; y < y1; y++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let x = RUBBER_CLEAN[0]; x <= RUBBER_CLEAN[1]; x++) { const o = idx(x, y); r += data[o]; g += data[o + 1]; b += data[o + 2]; n++; }
      const ref = [r / n, g / n, b / n];
      for (let x = x0; x < x1; x++) {
        const a = Math.min(1, (x - x0 + 1) / F, (x1 - x) / F);
        const o = idx(x, y);
        const gr = rnd() * 3;
        for (let k = 0; k < 3; k++) data[o + k] = Math.max(0, Math.min(255, Math.round(data[o + k] * (1 - a) + (ref[k] + gr) * a)));
      }
    }
  }

  // Deterministic grain so the repair is not flatter than the photo around it.
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };

  function repair(region, { window = 220, keep = 0.5, delta = 14, grow = 3, refX = null, protectDark = 0 } = {}) {
    const { x0, x1, y0, y1 } = region;
    const w = x1 - x0, h = y1 - y0;
    const lo = (x) => (refX ? refX[0] : Math.max(x0, x - window));
    const hi = (x) => (refX ? refX[1] : Math.min(x1, x + window));
    // 1. a first guess of the clean colour per row (the brighter pixels around x), to find the text
    const step = 40;
    const guess = [];
    for (let y = y0; y < y1; y++) {
      const row = [];
      for (let x = x0; x < x1; x += step) row.push(cleanRow(y, lo(x), hi(x), keep)[0]);
      guess.push(row);
    }
    const guessAt = (x, y) => { const row = guess[y - y0]; return row[Math.min(row.length - 1, Math.round((x - x0) / step))]; };
    // 2. mask: darker than the clean colour
    const mask = new Uint8Array(w * h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (lum(idx(x, y)) < guessAt(x, y) - delta) mask[(y - y0) * w + (x - x0)] = 1;
    }
    // optional: keep anything within `protectDark` px of a really dark pixel (the tick lines); those
    // pixels are also left out of the clean-colour average below
    let near = null;
    if (protectDark) {
      const dark = new Uint8Array(w * h);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (lum(idx(x, y)) < 110) dark[(y - y0) * w + (x - x0)] = 1;
      near = grow2(dark, w, h, protectDark + 2);
      for (let i = 0; i < mask.length; i++) if (near[i]) mask[i] = 0;
    }
    // 3. grow the mask (anti-aliased glyph edges), then a soft ring for blending
    const core = grow2(mask, w, h, grow);
    const soft = grow2(core, w, h, 2);
    // 4. the clean colour: per row, the mean of the pixels OUTSIDE the grown mask within the window
    //    (prefix sums along the row), so the fill matches the real barrel around it, grain included
    const rowSum = new Float64Array((w + 1) * 4);
    for (let y = y0; y < y1; y++) {
      const extra = refX ? [refX[0], refX[1]] : null;
      rowSum.fill(0);
      for (let x = x0; x < x1; x++) {
        const i = (y - y0) * w + (x - x0);
        const o = idx(x, y);
        const use = soft[i] || (near && near[i]) ? 0 : 1;
        const b = (x - x0) * 4, nb = b + 4;
        rowSum[nb] = rowSum[b] + use;
        rowSum[nb + 1] = rowSum[b + 1] + use * data[o];
        rowSum[nb + 2] = rowSum[b + 2] + use * data[o + 1];
        rowSum[nb + 3] = rowSum[b + 3] + use * data[o + 2];
      }
      // a fixed reference strip outside the region (refX) is averaged once per row
      let fixed = null;
      if (extra) {
        let r = 0, g = 0, bb = 0, n = 0;
        for (let x = extra[0]; x < extra[1]; x++) {
          const o = idx(x, y);
          if (lum(o) < guessAt(Math.min(x1 - 1, Math.max(x0, x)), y) - delta) continue;
          r += data[o]; g += data[o + 1]; bb += data[o + 2]; n++;
        }
        fixed = n ? [r / n, g / n, bb / n] : null;
      }
      for (let x = x0; x < x1; x++) {
        const i = (y - y0) * w + (x - x0);
        if (!soft[i]) continue;
        let ref = fixed;
        if (!ref) {
          const a = (Math.max(x0, x - window) - x0) * 4, b = (Math.min(x1, x + window) - x0) * 4;
          const n = rowSum[b] - rowSum[a];
          if (n < 4) continue;
          ref = [(rowSum[b + 1] - rowSum[a + 1]) / n, (rowSum[b + 2] - rowSum[a + 2]) / n, (rowSum[b + 3] - rowSum[a + 3]) / n];
        }
        const al = core[i] ? 1 : 0.5;
        const o = idx(x, y);
        const gr = rnd() * 4;
        for (let k = 0; k < 3; k++) data[o + k] = Math.max(0, Math.min(255, Math.round(data[o + k] * (1 - al) + (ref[k] + gr) * al)));
      }
    }
  }

  repair(NUMBERS, { window: 260, keep: 0.45, delta: 14, grow: 4 });
  repair(UNITS, { window: 60, keep: 0.45, delta: 12, grow: 4 });
  cloneRubber();
  repair(GHOSTS, { window: 400, keep: 0.5, delta: 10, grow: 2, protectDark: 4 });
  return { barrel: BARREL };
}

// Grow a binary mask by r pixels (square), separable.
function grow2(mask, w, h, r) {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = -1e9;
    for (let x = 0; x < w; x++) { if (mask[y * w + x]) run = x; if (x - run <= r) tmp[y * w + x] = 1; }
    run = 1e9;
    for (let x = w - 1; x >= 0; x--) { if (mask[y * w + x]) run = x; if (run - x <= r) tmp[y * w + x] = 1; }
  }
  for (let x = 0; x < w; x++) {
    let run = -1e9;
    for (let y = 0; y < h; y++) { if (tmp[y * w + x]) run = y; if (y - run <= r) out[y * w + x] = 1; }
    run = 1e9;
    for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) run = y; if (run - y <= r) out[y * w + x] = 1; }
  }
  return out;
}
