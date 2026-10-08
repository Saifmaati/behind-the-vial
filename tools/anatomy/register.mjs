// Point-set registration helpers: similarity (Horn quaternion), affine least squares, thin-plate spline.

function jacobiEigen(Ain) {
  const n = Ain.length; const A = Ain.map((r) => r.slice()); const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  return { values: A.map((r, i) => r[i]), vectors: V };
}

const mean = (P, w) => { const W = w ? w.reduce((a, b) => a + b, 0) : P.length; const m = [0, 0, 0]; P.forEach((p, i) => { const wi = w ? w[i] : 1; m[0] += wi * p[0]; m[1] += wi * p[1]; m[2] += wi * p[2]; }); return m.map((x) => x / W); };

/** Similarity transform B ≈ s R A + t (Horn 1987, optional weights). Returns {s, R (3x3 rows), t, apply(p), rms}. */
export function fitSimilarity(A, B, { weights = null, allowScale = true } = {}) {
  const ma = mean(A, weights), mb = mean(B, weights);
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; let sa = 0, sb = 0;
  A.forEach((a, i) => {
    const w = weights ? weights[i] : 1; const x = [a[0] - ma[0], a[1] - ma[1], a[2] - ma[2]], y = [B[i][0] - mb[0], B[i][1] - mb[1], B[i][2] - mb[2]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += w * x[r] * y[c];
    sa += w * (x[0] ** 2 + x[1] ** 2 + x[2] ** 2); sb += w * (y[0] ** 2 + y[1] ** 2 + y[2] ** 2);
  });
  const [[Sxx, Sxy, Sxz], [Syx, Syy, Syz], [Szx, Szy, Szz]] = S;
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const { values, vectors } = jacobiEigen(N);
  let bi = 0; for (let i = 1; i < 4; i++) if (values[i] > values[bi]) bi = i;
  const [q0, qx, qy, qz] = [vectors[0][bi], vectors[1][bi], vectors[2][bi], vectors[3][bi]];
  const R = [
    [q0 * q0 + qx * qx - qy * qy - qz * qz, 2 * (qx * qy - q0 * qz), 2 * (qx * qz + q0 * qy)],
    [2 * (qy * qx + q0 * qz), q0 * q0 - qx * qx + qy * qy - qz * qz, 2 * (qy * qz - q0 * qx)],
    [2 * (qz * qx - q0 * qy), 2 * (qz * qy + q0 * qx), q0 * q0 - qx * qx - qy * qy + qz * qz],
  ];
  const s = allowScale ? Math.sqrt(sb / sa) : 1;
  const Rma = [R[0][0] * ma[0] + R[0][1] * ma[1] + R[0][2] * ma[2], R[1][0] * ma[0] + R[1][1] * ma[1] + R[1][2] * ma[2], R[2][0] * ma[0] + R[2][1] * ma[1] + R[2][2] * ma[2]];
  const t = [mb[0] - s * Rma[0], mb[1] - s * Rma[1], mb[2] - s * Rma[2]];
  const apply = (p) => [s * (R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2]) + t[0], s * (R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2]) + t[1], s * (R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2]) + t[2]];
  const res = A.map((a, i) => Math.hypot(...apply(a).map((v, k) => v - B[i][k])));
  return { s, R, t, apply, residuals: res, rms: Math.sqrt(res.reduce((x, r) => x + r * r, 0) / res.length) };
}

function solve(M, rhs) {
  // Gaussian elimination with partial pivoting; M: n x n (array of Float64Array), rhs: n x m
  const n = M.length, m = rhs[0].length;
  const A = M.map((r, i) => Float64Array.from([...r, ...rhs[i]]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-14) throw new Error('singular system');
    [A[c], A[p]] = [A[p], A[c]];
    const piv = A[c][c];
    for (let r = c + 1; r < n; r++) { const f = A[r][c] / piv; if (!f) continue; const Ar = A[r], Ac = A[c]; for (let k = c; k < n + m; k++) Ar[k] -= f * Ac[k]; }
  }
  const X = Array.from({ length: n }, () => new Float64Array(m));
  for (let r = n - 1; r >= 0; r--) for (let j = 0; j < m; j++) { let s = A[r][n + j]; for (let k = r + 1; k < n; k++) s -= A[r][k] * X[k][j]; X[r][j] = s / A[r][r]; }
  return X;
}

/** General affine least squares B ≈ M A + t. */
export function fitAffine(A, B) {
  const ATA = Array.from({ length: 4 }, () => new Float64Array(4)); const ATB = Array.from({ length: 4 }, () => new Float64Array(3));
  A.forEach((a, i) => { const h = [a[0], a[1], a[2], 1]; for (let r = 0; r < 4; r++) { for (let c = 0; c < 4; c++) ATA[r][c] += h[r] * h[c]; for (let c = 0; c < 3; c++) ATB[r][c] += h[r] * B[i][c]; } });
  const X = solve(ATA, ATB);
  const apply = (p) => [0, 1, 2].map((c) => X[0][c] * p[0] + X[1][c] * p[1] + X[2][c] * p[2] + X[3][c]);
  const res = A.map((a, i) => Math.hypot(...apply(a).map((v, k) => v - B[i][k])));
  return { X, apply, residuals: res, rms: Math.sqrt(res.reduce((x, r) => x + r * r, 0) / res.length) };
}

/** 3D thin-plate spline (kernel |r|) mapping src -> dst with regularisation lambda. */
export function fitTPS(src, dst, { lambda = 0 } = {}) {
  const n = src.length; const N = n + 4;
  const M = Array.from({ length: N }, () => new Float64Array(N)); const rhs = Array.from({ length: N }, () => new Float64Array(3));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i][j] = Math.hypot(src[i][0] - src[j][0], src[i][1] - src[j][1], src[i][2] - src[j][2]);
    M[i][i] += lambda;
    M[i][n] = 1; M[i][n + 1] = src[i][0]; M[i][n + 2] = src[i][1]; M[i][n + 3] = src[i][2];
    M[n][i] = 1; M[n + 1][i] = src[i][0]; M[n + 2][i] = src[i][1]; M[n + 3][i] = src[i][2];
    rhs[i][0] = dst[i][0]; rhs[i][1] = dst[i][1]; rhs[i][2] = dst[i][2];
  }
  const X = solve(M, rhs);
  const cx = new Float64Array(n), cy = new Float64Array(n), cz = new Float64Array(n);
  for (let i = 0; i < n; i++) { cx[i] = src[i][0]; cy[i] = src[i][1]; cz[i] = src[i][2]; }
  const apply = (p) => {
    let x = X[n][0] + X[n + 1][0] * p[0] + X[n + 2][0] * p[1] + X[n + 3][0] * p[2];
    let y = X[n][1] + X[n + 1][1] * p[0] + X[n + 2][1] * p[1] + X[n + 3][1] * p[2];
    let z = X[n][2] + X[n + 1][2] * p[0] + X[n + 2][2] * p[1] + X[n + 3][2] * p[2];
    for (let i = 0; i < n; i++) { const r = Math.hypot(p[0] - cx[i], p[1] - cy[i], p[2] - cz[i]); x += X[i][0] * r; y += X[i][1] * r; z += X[i][2] * r; }
    return [x, y, z];
  };
  const res = src.map((a, i) => Math.hypot(...apply(a).map((v, k) => v - dst[i][k])));
  return { apply, residuals: res, maxResidual: Math.max(...res) };
}
