// Morphing a chart's line from one range to another (components/PriceChart.tsx and
// components/SandboxChart.tsx). Every range's line is resampled to the same number of
// points, so any two can be blended point by point.

export const MORPH_MS = 900; // matches .chart-fade in globals.css
// Points in every range's resampled line (see resample): two per column, and the columns
// must be no wider than a pixel on the widest chart (about 1,100px), or the morph's last
// frame would differ visibly from the exact line drawn after it.
export const SAMPLES = 2400;

export type Shape = { xs: number[]; ys: number[] };

// The line through pixel positions (px, py), as SAMPLES points that look the same as it.
// The line's span is cut into SAMPLES / 2 columns of under a pixel each, and each column
// gives two points: its lowest and highest point of the line, in the order they come.
// A column holding no point of the line takes the line where it crosses the column's
// edges. Picking evenly spaced points instead would skip the spikes between them when a
// range has more prices than the chart has pixels (5Y, All), and the line would jump when
// the exact one replaced the morph's last frame.
export function resample(px: number[], py: number[]): Shape {
  const n = px.length;
  if (n < 2) return { xs: Array(SAMPLES).fill(px[0] ?? 0), ys: Array(SAMPLES).fill(py[0] ?? 0) };

  const x0 = px[0];
  const span = px[n - 1] - x0 || 1;
  const columns = SAMPLES / 2;
  let seg = 0;
  // The line's height at x (x within the line's span), scanning forward from `seg`.
  const at = (x: number) => {
    while (seg < n - 2 && px[seg + 1] < x) seg++;
    const w = px[seg + 1] - px[seg];
    const f = w > 0 ? Math.min(Math.max((x - px[seg]) / w, 0), 1) : 0;
    return py[seg] + (py[seg + 1] - py[seg]) * f;
  };

  const xs: number[] = [];
  const ys: number[] = [];
  let j = 0; // the first point not yet placed in a column
  for (let c = 0; c < columns; c++) {
    const a = x0 + (span * c) / columns;
    const b = x0 + (span * (c + 1)) / columns;
    const last = c === columns - 1;
    let lo = -1;
    let hi = -1;
    for (; j < n && (px[j] < b || last); j++) {
      if (lo < 0 || py[j] > py[lo]) lo = j; // pixel y grows downwards: lowest price
      if (hi < 0 || py[j] < py[hi]) hi = j;
    }
    if (lo < 0) {
      xs.push(a, b);
      ys.push(at(a), at(b));
    } else {
      const [first, second] = lo <= hi ? [lo, hi] : [hi, lo];
      xs.push(px[first], px[second]);
      ys.push(py[first], py[second]);
    }
  }
  // The ends sit exactly where the line's do, so the shading under it lines up too.
  xs[0] = px[0];
  ys[0] = py[0];
  xs[SAMPLES - 1] = px[n - 1];
  ys[SAMPLES - 1] = py[n - 1];
  return { xs, ys };
}

export function blend(a: Shape, b: Shape, t: number): Shape {
  return {
    xs: a.xs.map((x, i) => x + (b.xs[i] - x) * t),
    ys: a.ys.map((y, i) => y + (b.ys[i] - y) * t),
  };
}

export function linePath(xs: number[], ys: number[]) {
  return xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join("");
}

export const easeOut = (t: number) => 1 - (1 - t) ** 3;
