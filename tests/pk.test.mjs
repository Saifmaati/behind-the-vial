// Unit tests for js/pk.js (node:test, zero dependencies). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  kaFromTmax, keFromHalfLife, tmaxFromRates, singleDose, repeatedDoses,
  timeToFraction, riseTimeToFraction, curve, phaseTimes, paramsFromPk,
  CLEARANCE_FRACTION,
} from '../js/pk.js';

const CASES = [
  { halfLife: 6, tmax: 1 },
  { halfLife: 6, tmax: 2 },
  { halfLife: 6, tmax: 3 },
  { halfLife: 7, tmax: 0.5 },
  { halfLife: 5, tmax: 1.5 },
  { halfLife: 0.25, tmax: 0.05 },
  { halfLife: 30, tmax: 10 },
];

const params = (halfLife, tmax, extra = {}) => ({ ka: kaFromTmax(tmax, halfLife), ke: keFromHalfLife(halfLife), ...extra });

// Numerical argmax on a fine grid (independent of the analytic tmax formula).
function argmax(f, t0, t1, n = 200000) {
  let best = -Infinity, bt = t0;
  for (let i = 0; i <= n; i++) { const t = t0 + ((t1 - t0) * i) / n; const v = f(t); if (v > best) { best = v; bt = t; } }
  return { t: bt, v: best };
}

test('ke = ln2 / half-life', () => {
  assert.ok(Math.abs(keFromHalfLife(6) - Math.LN2 / 6) < 1e-15);
  assert.throws(() => keFromHalfLife(0), RangeError);
});

test('kaFromTmax recovers tmax within 1% (analytic and numerical peak), with ka > ke', () => {
  for (const { halfLife, tmax } of CASES) {
    const p = params(halfLife, tmax);
    assert.ok(p.ka > p.ke, `ka > ke for ${JSON.stringify({ halfLife, tmax })}`);
    const analytic = tmaxFromRates(p.ka, p.ke);
    assert.ok(Math.abs(analytic - tmax) / tmax < 0.01, `analytic tmax ${analytic} vs ${tmax}`);
    const num = argmax((t) => singleDose(t, p), 0, tmax * 4);
    assert.ok(Math.abs(num.t - tmax) / tmax < 0.01, `numerical tmax ${num.t} vs ${tmax}`);
  }
});

test('kaFromTmax rejects impossible inputs (tmax ≥ half-life / ln2)', () => {
  assert.throws(() => kaFromTmax(9, 6), RangeError); // 1/ke = 8.66 d
  assert.throws(() => kaFromTmax(-1, 6), RangeError);
  assert.throws(() => kaFromTmax(1, NaN), RangeError);
});

test('single shot is normalized: peak = 1, zero at and before t = 0, never above 1', () => {
  for (const { halfLife, tmax } of CASES) {
    const p = params(halfLife, tmax);
    assert.ok(Math.abs(singleDose(tmaxFromRates(p.ka, p.ke), p) - 1) < 1e-12);
    assert.equal(singleDose(0, p), 0);
    assert.equal(singleDose(-1, p), 0);
    const { v } = argmax((t) => singleDose(t, p), 0, halfLife * 10, 50000);
    assert.ok(v <= 1 + 1e-12 && v > 0.9999, `max ${v}`);
  }
});

test('monotonic rise before the peak and monotonic decay after it', () => {
  for (const { halfLife, tmax } of CASES) {
    const p = params(halfLife, tmax);
    const tm = tmaxFromRates(p.ka, p.ke);
    let prev = 0;
    for (let i = 1; i <= 2000; i++) { const v = singleDose((tm * i) / 2000, p); assert.ok(v >= prev, 'rising'); prev = v; }
    prev = 1;
    for (let i = 1; i <= 4000; i++) {
      const t = tm + (halfLife * 12 * i) / 4000;
      const v = singleDose(t, p);
      assert.ok(v < prev, `strictly decreasing at t=${t}`);
      prev = v;
    }
  }
});

test('timeToFraction lands on the requested fraction after the peak', () => {
  const p = params(6, 2);
  for (const f of [0.9, 0.5, 0.25, CLEARANCE_FRACTION, 0.001]) {
    const t = timeToFraction(f, p);
    assert.ok(t > 2, 'after the peak');
    assert.ok(Math.abs(singleDose(t, p) - f) < 1e-9, `fraction ${f}`);
  }
  assert.equal(timeToFraction(1, p), tmaxFromRates(p.ka, p.ke));
  const r = riseTimeToFraction(0.5, p);
  assert.ok(r > 0 && r < 2 && Math.abs(singleDose(r, p) - 0.5) < 1e-9);
});

test('clearance (~3 %) is roughly five half-lives after the peak', () => {
  for (const { halfLife, tmax } of CASES) {
    const p = params(halfLife, tmax);
    const { peak, half, clearance } = phaseTimes(p);
    assert.ok(peak < half && half < clearance);
    const halfLives = (clearance - peak) / halfLife;
    assert.ok(halfLives > 3.5 && halfLives < 6, `${halfLives} half-lives`);
  }
});

test('superposition: repeated shots equal the sum of shifted single shots and plateau above 1', () => {
  const tau = 7;
  const p = params(6, 2, { intervalDays: tau, doses: 10 });
  for (const t of [0.5, 3, 7, 7.0001, 15.2, 40, 63, 69.9, 80]) {
    let sum = 0;
    for (let k = 0; k < 10; k++) sum += singleDose(t - k * tau, p);
    assert.ok(Math.abs(repeatedDoses(t, p) - sum) < 1e-12, `t=${t}`);
  }
  // First interval is identical to one shot.
  for (const t of [0.5, 2, 6.9]) assert.ok(Math.abs(repeatedDoses(t, p) - singleDose(t, p)) < 1e-12);
  // Peaks after each shot climb and converge to a plateau > 1 (computed, never hardcoded).
  const peaks = [];
  for (let k = 0; k < 10; k++) peaks.push(argmax((t) => repeatedDoses(t, p), k * tau, (k + 1) * tau, 4000).v);
  for (let k = 1; k < 10; k++) assert.ok(peaks[k] > peaks[k - 1], 'peaks rise');
  assert.ok(peaks[9] > 1.2, `plateau ${peaks[9]}`);
  assert.ok(peaks[9] - peaks[8] < 0.01, 'plateau converged');
  // Closed-form steady state of the Bateman series: matches superposition after many shots.
  const { ka, ke } = p;
  const tm = tmaxFromRates(ka, ke);
  const norm = (ka / (ka - ke)) * (Math.exp(-ke * tm) - Math.exp(-ka * tm));
  const css = (s) => (ka / (ka - ke)) * (Math.exp(-ke * s) / (1 - Math.exp(-ke * tau)) - Math.exp(-ka * s) / (1 - Math.exp(-ka * tau))) / norm;
  const open = { ...p, doses: undefined };
  for (const s of [0.25, 2, 5, 6.9]) assert.ok(Math.abs(repeatedDoses(60 * tau + s, open) - css(s)) < 1e-6, `css at ${s}`);
  // With a very long interval there is no accumulation.
  const far = params(6, 2, { intervalDays: 1000, doses: 3 });
  assert.ok(Math.abs(repeatedDoses(1002, far) - 1) < 1e-9);
});

test('after the last shot the series decays; nothing is added past `doses`', () => {
  const p = params(6, 2, { intervalDays: 7, doses: 10 });
  let prev = Infinity;
  for (let t = 63 + 2.5; t < 140; t += 0.5) { const v = repeatedDoses(t, p); assert.ok(v < prev); prev = v; }
});

test('steady state is reached within 4–6 shots for a 6-day half-life with weekly shots', () => {
  for (const tmax of [0.5, 1, 2, 3, 4]) {
    const p = params(6, tmax, { intervalDays: 7 });
    const { steadyStateDose } = phaseTimes(p);
    assert.ok(steadyStateDose >= 4 && steadyStateDose <= 6, `tmax ${tmax}: ${steadyStateDose}`);
    // Definition check: trough after shot n vs after shot n−1 changes < 5 %; the one before does not.
    const trough = (n) => repeatedDoses(n * 7, { ...p, doses: n });
    const rel = (n) => (trough(n) - trough(n - 1)) / trough(n - 1);
    assert.ok(rel(steadyStateDose) < 0.05);
    assert.ok(rel(steadyStateDose - 1) >= 0.05);
  }
  assert.equal(phaseTimes(params(6, 2)).steadyStateDose, null, 'no interval → null');
});

test('curve(): sorted samples, includes shot times, matches the model', () => {
  const p = params(6, 2, { intervalDays: 7, doses: 10 });
  const single = curve(p, { tEnd: 42, n: 169 });
  assert.equal(single[0].t, 0);
  assert.equal(single.at(-1).t, 42);
  for (let i = 1; i < single.length; i++) assert.ok(single[i].t > single[i - 1].t);
  assert.ok(single.some((s) => Math.abs(s.level - 1) < 1e-12), 'exact peak sample present');
  const weekly = curve(p, { tEnd: 70, n: 281, mode: 'weekly' });
  for (let k = 0; k < 10; k++) assert.ok(weekly.some((s) => s.t === k * 7), `shot ${k + 1} sampled`);
  for (const s of weekly) assert.ok(Math.abs(s.level - repeatedDoses(s.t, p)) < 1e-12);
  assert.ok(Math.max(...weekly.map((s) => s.level)) > 1.2);
});

test('paramsFromPk builds model params from a data entry pk block', () => {
  const p = paramsFromPk({ halfLifeDays: 6, tmaxDays: 2, intervalDays: 7 }, { doses: 10 });
  assert.ok(Math.abs(tmaxFromRates(p.ka, p.ke) - 2) < 1e-6);
  assert.equal(p.intervalDays, 7);
  assert.equal(p.doses, 10);
  assert.throws(() => paramsFromPk(null), RangeError);
});
