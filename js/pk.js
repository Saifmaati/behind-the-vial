// Behind the Vial: pure pharmacokinetic math (no DOM, no side effects).
//
// Model: one compartment with first-order absorption from the depot under the
// skin and first-order elimination (the Bateman function). Everything here is
// NORMALIZED: a single shot peaks at exactly 1.0. Nothing is ever expressed in
// mg or any amount; the only input that changes the curve's shape is the
// published half-life and time to peak.
//
//   C(t) ∝ ka / (ka − ke) · (e^(−ke·t) − e^(−ka·t)),   t ≥ 0
//   tmax = ln(ka / ke) / (ka − ke)
//   ke   = ln 2 / half-life
//
// Repeated shots are handled by superposition (sum of time-shifted single-shot
// curves), normalized to the single-shot peak, so the plateau rises above 1.0
// because each shot arrives before the previous one has cleared.

export const LN2 = Math.LN2;
/** Level (fraction of peak) we call "mostly cleared": ~3 %, about 5 half-lives. */
export const CLEARANCE_FRACTION = 0.03;
/** Level (fraction of peak) for the half-life point after the peak. */
export const HALF_FRACTION = 0.5;
/** Steady state: the trough changes by less than this vs the previous trough. */
export const STEADY_STATE_TOLERANCE = 0.05;

const isPos = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** Elimination rate constant (1/day) from the half-life in days. */
export function keFromHalfLife(halfLifeDays) {
  if (!isPos(halfLifeDays)) throw new RangeError('halfLifeDays must be a positive number');
  return LN2 / halfLifeDays;
}

/** Time of the single-shot peak (days) for absorption/elimination rates ka, ke (1/day). */
export function tmaxFromRates(ka, ke) {
  if (!isPos(ka) || !isPos(ke)) return NaN;
  const d = ka - ke;
  if (Math.abs(d) <= 1e-12 * ke) return 1 / ke; // ka → ke limit
  return Math.log(ka / ke) / d;
}

// g(x) = ln(x) / (x − 1), x = ka/ke > 1. Strictly decreasing from 1 (x→1) to 0 (x→∞).
// tmax·ke = g(ka/ke), so solving g(x) = tmax·ke recovers ka.
function g(x) {
  const u = x - 1;
  if (u < 1e-8) return 1 - u / 2 + (u * u) / 3; // series, avoids 0/0
  return Math.log1p(u) / u;
}

/**
 * Absorption rate constant ka (1/day, ka > ke) that puts the single-shot peak at tmaxDays.
 * Solved numerically (bisection on log scale; g is monotonic so it always converges).
 * Throws RangeError when no ka > ke exists, i.e. when tmax ≥ half-life / ln 2.
 */
export function kaFromTmax(tmaxDays, halfLifeDays) {
  if (!isPos(tmaxDays)) throw new RangeError('tmaxDays must be a positive number');
  const ke = keFromHalfLife(halfLifeDays);
  const target = tmaxDays * ke;
  if (target >= 1) {
    throw new RangeError(`tmax (${tmaxDays} d) must be shorter than half-life / ln 2 (${(1 / ke).toFixed(2)} d) for absorption faster than elimination`);
  }
  let lo = 1; // g(lo) = 1 > target
  let hi = 2;
  while (g(hi) > target && hi < 1e12) hi *= 2;
  // Bisection in log space: robust over many orders of magnitude.
  let a = Math.log(lo), b = Math.log(hi);
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2;
    if (g(Math.exp(m)) > target) a = m; else b = m;
    if (b - a < 1e-15) break;
  }
  return Math.exp((a + b) / 2) * ke;
}

// Un-normalized Bateman shape (unit dose, unit volume, F = 1).
function bateman(t, ka, ke) {
  if (!(t > 0)) return 0;
  const d = ka - ke;
  if (Math.abs(d) <= 1e-9 * ke) return ka * t * Math.exp(-ke * t); // ka → ke limit
  return (ka / d) * (Math.exp(-ke * t) - Math.exp(-ka * t));
}

function peakRaw(ka, ke) {
  return bateman(tmaxFromRates(ka, ke), ka, ke);
}

function checkRates(p) {
  if (!p || !isPos(p.ka) || !isPos(p.ke)) throw new RangeError('params need positive ka and ke (1/day)');
}

/** Single-shot level at tDays, normalized so the peak is exactly 1 (0 before the shot). */
export function singleDose(tDays, params) {
  checkRates(params);
  const { ka, ke } = params;
  return bateman(tDays, ka, ke) / peakRaw(ka, ke);
}

/**
 * Level at tDays when a shot is given at t = 0, intervalDays, 2·intervalDays, …
 * (`doses` shots in total; omit for an open-ended series). Superposition of
 * single-shot curves, normalized to the SINGLE-shot peak (so it can exceed 1).
 */
export function repeatedDoses(tDays, params) {
  checkRates(params);
  const { ka, ke } = params;
  const tau = params.intervalDays;
  if (!isPos(tau)) throw new RangeError('intervalDays must be a positive number');
  if (!(tDays > 0)) return 0;
  const total = params.doses == null ? Infinity : Math.max(0, Math.floor(params.doses));
  const n = Math.min(total, Math.floor(tDays / tau) + 1);
  const p0 = peakRaw(ka, ke);
  let sum = 0;
  for (let k = 0; k < n; k++) sum += bateman(tDays - k * tau, ka, ke);
  return sum / p0;
}

/**
 * Time (days) AFTER the peak at which a single shot has fallen to `fraction` of its peak.
 * fraction ≥ 1 returns the peak time. Bisection (the curve is strictly decreasing after the peak).
 */
export function timeToFraction(fraction, params) {
  checkRates(params);
  const { ka, ke } = params;
  const tm = tmaxFromRates(ka, ke);
  if (!(fraction < 1)) return tm;
  if (!(fraction > 0)) return Infinity;
  let lo = tm;
  let hi = tm + Math.max(1 / ke, 1e-6);
  while (singleDose(hi, params) > fraction && hi < 1e9) { lo = hi; hi *= 2; }
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (singleDose(m, params) > fraction) lo = m; else hi = m;
    if (hi - lo < 1e-10 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}

/**
 * Time (days) BEFORE the peak at which a single shot first reaches `fraction` of its peak.
 * (Extra helper, not in the contract: used as a fallback onset marker.)
 */
export function riseTimeToFraction(fraction, params) {
  checkRates(params);
  const tm = tmaxFromRates(params.ka, params.ke);
  if (!(fraction < 1)) return tm;
  if (!(fraction > 0)) return 0;
  let lo = 0, hi = tm;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (singleDose(m, params) < fraction) lo = m; else hi = m;
    if (hi - lo < 1e-12 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}

/**
 * Sampled curve for drawing. mode: 'single' (default) or 'weekly'/'repeated'
 * (uses params.intervalDays and params.doses). Returns n evenly spaced samples
 * on [0, tEnd] plus the exact shot times and the single-shot peak, sorted.
 */
export function curve(params, { tEnd = 42, n = 241, mode = 'single' } = {}) {
  checkRates(params);
  if (!isPos(tEnd)) throw new RangeError('tEnd must be a positive number');
  const repeated = mode === 'weekly' || mode === 'repeated';
  const count = Math.max(2, Math.floor(n));
  const ts = new Set();
  for (let i = 0; i < count; i++) ts.add((tEnd * i) / (count - 1));
  const tm = tmaxFromRates(params.ka, params.ke);
  if (repeated) {
    const tau = params.intervalDays;
    const total = params.doses == null ? Infinity : params.doses;
    for (let k = 0; k < total && k * tau <= tEnd; k++) {
      ts.add(k * tau);
      if (k * tau + tm <= tEnd) ts.add(k * tau + tm);
    }
  } else if (tm <= tEnd) {
    ts.add(tm);
  }
  const level = repeated ? (t) => repeatedDoses(t, params) : (t) => singleDose(t, params);
  return [...ts].sort((a, b) => a - b).map((t) => ({ t, level: level(t) }));
}

/**
 * Marker times computed from the model.
 *  peak            single-shot peak (days)
 *  half            level has fallen to 50 % of the peak (days, after the peak)
 *  clearance       level has fallen to ~3 % of the peak (≈ 5 half-lives) (days)
 *  steadyStateDose first shot number n (≥ 2) whose trough (just before shot n+1)
 *                  differs from the previous trough by < 5 %; null without intervalDays
 */
export function phaseTimes(params) {
  checkRates(params);
  const peak = tmaxFromRates(params.ka, params.ke);
  const half = timeToFraction(HALF_FRACTION, params);
  const clearance = timeToFraction(CLEARANCE_FRACTION, params);
  let steadyStateDose = null;
  const tau = params.intervalDays;
  if (isPos(tau)) {
    // trough after n shots T(n) = Σ_{j=1..n} single(j·τ); relative change = single(n·τ) / T(n−1)
    let prev = singleDose(tau, params);
    for (let n = 2; n <= 500; n++) {
      const add = singleDose(n * tau, params);
      if (prev > 0 && add / prev < STEADY_STATE_TOLERANCE) { steadyStateDose = n; break; }
      prev += add;
    }
  }
  return { peak, half, clearance, steadyStateDose };
}

/**
 * Convenience: build model params from a data entry's `pk` block
 * ({ halfLifeDays, tmaxDays, intervalDays }). Extra helper, not in the contract.
 */
export function paramsFromPk(pk, { doses } = {}) {
  if (!pk) throw new RangeError('pk block missing');
  const ke = keFromHalfLife(pk.halfLifeDays);
  const ka = kaFromTmax(pk.tmaxDays, pk.halfLifeDays);
  return { ka, ke, intervalDays: isPos(pk.intervalDays) ? pk.intervalDays : 7, doses };
}
