import type { TemporalSeries, ForecastResult } from "../types/spending";

/**
 * Time-series math for annual fiscal-year aggregations. Pure functions;
 * the DB-touching helpers live in `src/lib/analytics/queries.ts`.
 */

export interface FYRow {
  fy: number;
  total: number;
  recipientCount: number;
  programCount: number;
  agreementCount: number;
}

/** Identify whether a time series is growing, flat, or shrinking. */
export function classifyTrend(
  points: ReadonlyArray<{ fy: number; total: number }>,
): { trend: "growing" | "flat" | "shrinking"; confidence: number; slope: number; rSquared: number } {
  if (points.length < 3) {
    return { trend: "flat", confidence: 0, slope: 0, rSquared: 0 };
  }
  const { slope, rSquared } = linearRegression(
    points.map((p) => p.fy),
    points.map((p) => p.total),
  );
  const meanY = points.reduce((s, p) => s + p.total, 0) / points.length;
  const relativeSlope = meanY > 0 ? slope / meanY : 0;

  let trend: "growing" | "flat" | "shrinking";
  if (Math.abs(relativeSlope) < 0.01) trend = "flat";
  else if (relativeSlope > 0) trend = "growing";
  else trend = "shrinking";

  // Confidence: combination of R² and the magnitude of the relative slope
  const confidence = Math.min(1, rSquared * Math.min(1, Math.abs(relativeSlope) * 20));
  return { trend, confidence, slope, rSquared };
}

/**
 * Linear regression — returns slope, intercept, and R². Used by both the
 * trend classifier and the forecast generator.
 */
export function linearRegression(
  xs: ReadonlyArray<number>,
  ys: ReadonlyArray<number>,
): { slope: number; intercept: number; rSquared: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, rSquared: 0 };

  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const slope = denX === 0 ? 0 : num / denX;
  const intercept = meanY - slope * meanX;
  const rSquared = denX === 0 || denY === 0 ? 0 : (num * num) / (denX * denY);
  return { slope, intercept, rSquared };
}

/**
 * Forecast forward N years using simple linear regression on the
 * historical series. Confidence interval = ±1.96 × residual std-dev.
 *
 * This is a straightforward, transparent forecast model. The
 * methodology page discloses it openly (`R² = …`, `n = N points`).
 * Replace with a proper time-series model post-hackathon.
 */
export function forecastForward(
  historical: ReadonlyArray<{ fy: number; value: number }>,
  forwardYears: number = 3,
): ForecastResult {
  const xs = historical.map((p) => p.fy);
  const ys = historical.map((p) => p.value);
  const reg = linearRegression(xs, ys);

  // Residual standard deviation
  const residuals = historical.map((p) => p.value - (reg.slope * p.fy + reg.intercept));
  const meanResidual = residuals.reduce((s, r) => s + r, 0) / Math.max(1, residuals.length);
  const residualVariance =
    residuals.reduce((s, r) => s + (r - meanResidual) * (r - meanResidual), 0) /
    Math.max(1, residuals.length - 1);
  const residualStd = Math.sqrt(residualVariance);

  const lastFy = xs[xs.length - 1] ?? new Date().getFullYear();
  const forecast = [];
  for (let i = 1; i <= forwardYears; i++) {
    const fy = lastFy + i;
    const predicted = reg.slope * fy + reg.intercept;
    const margin = 1.96 * residualStd * Math.sqrt(1 + i / Math.max(1, historical.length));
    forecast.push({
      fy,
      predicted: Math.max(0, predicted),
      lowerBound: Math.max(0, predicted - margin),
      upperBound: predicted + margin,
    });
  }

  const trend = classifyTrend(historical.map((p) => ({ fy: p.fy, total: p.value })));

  return {
    series: "spend",
    historical: historical.map((p) => ({ fy: p.fy, value: p.value })),
    forecast,
    method: `Linear regression (slope=${reg.slope.toFixed(0)}, intercept=${reg.intercept.toFixed(0)}, n=${historical.length}). Confidence ±1.96σ over expanding-residual variance.`,
    rSquared: reg.rSquared,
    trend: trend.trend,
    trendConfidence: trend.confidence,
  };
}

/**
 * Build a TemporalSeries from raw FY rows.
 */
export function aggregateByFY(
  rows: ReadonlyArray<FYRow>,
  seriesLabel: string,
): TemporalSeries {
  const sorted = [...rows].sort((a, b) => a.fy - b.fy);
  return { bySeries: seriesLabel, points: sorted };
}
