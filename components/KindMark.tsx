// A mark for what kind of listing something is (its kind from kindOf in lib/sandbox.ts,
// "TechCompany", "MiningCompany", "ETF"…), drawn in lines of the colour of the text around it:
// a chip for tech, a mine cart of ore for mining, a flame for energy, a bank for finance, a
// cross for health, a gear for industry, a house for real estate, a bolt for utilities, a play
// button for media, a bag for consumer goods, a basket for staples, two fused rings of six (a
// molecule) for chemicals, a sprout for agriculture, a cube for materials, stacked layers
// for an ETF, two arrows passing each other for an exchange rate, the letters A and B (A in
// front) for a credit rating, and a building for any other company. Each comes alive in its own way when
// something round it marked `kind-hover` is pointed at (.kind-mark-* in globals.css): the
// cart rolls, the gear stamps, the sprout grows, the molecule floats, the flame flickers…

// A gear: eight teeth round a ring, with a hole in the middle.
function gear() {
  const teeth = 8;
  const [outer, inner, cx, cy] = [7.2, 5.4, 10, 10];
  const at = (r: number, a: number) =>
    `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const step = (Math.PI * 2) / teeth;
  const parts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    // Each tooth: up its leading edge, across its top, down its trailing edge, then the gap.
    parts.push(
      `${i ? "L" : "M"}${at(inner, a - step * 0.3)}`,
      `L${at(outer, a - step * 0.18)}`,
      `L${at(outer, a + step * 0.18)}`,
      `L${at(inner, a + step * 0.3)}`,
    );
  }
  return `${parts.join("")}ZM12.3 10a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1 4.6 0Z`;
}

// A molecule as chemists draw one: two rings of six side by side, sharing a bond, with the
// double bonds inside the left one, three bonds reaching out, and four atoms marked as dots.
function molecule() {
  const r = 4.3;
  const half = (r * Math.sqrt(3)) / 2;
  const [left, right] = [10 - half, 10 + half];
  const rad = (i: number) => ((-90 + 60 * i) * Math.PI) / 180;
  const pt = (cx: number, d: number, a: number) =>
    `${(cx + d * Math.cos(a)).toFixed(2)} ${(10 + d * Math.sin(a)).toFixed(2)}`;
  const corner = (cx: number, i: number) => pt(cx, r, rad(i));
  const ring = (cx: number) =>
    `M${corner(cx, 0)}` + [1, 2, 3, 4, 5].map((i) => `L${corner(cx, i)}`).join("") + "Z";
  // A double bond: a shorter line just inside the edge from corner i to corner i + 1.
  const bond = (cx: number, i: number) => {
    const a = rad(i) + Math.PI / 6;
    const [x, y] = [cx + 1.8 * Math.cos(a), 10 + 1.8 * Math.sin(a)];
    const [dx, dy] = [-Math.sin(a) * 0.7, Math.cos(a) * 0.7];
    return `M${(x - dx).toFixed(2)} ${(y - dy).toFixed(2)}L${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)}`;
  };
  const reach = (cx: number, i: number, d: number) => `M${corner(cx, i)}L${pt(cx, r + d, rad(i))}`;
  const atom = (cx: number, i: number) => {
    const [x, y] = corner(cx, i).split(" ").map(Number);
    return `M${x} ${(y - 0.45).toFixed(2)}a.45.45 0 1 0 0 .9.45.45 0 1 0 0-.9Z`;
  };
  return (
    ring(left) +
    ring(right) +
    [0, 2, 4].map((i) => bond(left, i)).join("") +
    reach(left, 5, 1.5) +
    reach(left, 3, 2) +
    reach(right, 1, 1.5) +
    atom(left, 0) +
    atom(left, 4) +
    atom(right, 0) +
    atom(right, 3)
  );
}

const PATHS: Record<string, string> = {
  Tech: "M6 6h8v8H6ZM8.5 8.5h3v3h-3ZM8 3v3M12 3v3M8 14v3M12 14v3M3 8h3M3 12h3M14 8h3M14 12h3",
  // A mine cart heaped with ore, on two wheels.
  Mining:
    "M3 8.5h14l-1.8 6H4.8ZM5.5 8.5 7 6l2 1.2L11 5l2 2 1.5-1 1 2.5M7.6 16.5a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM14.6 16.5a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z",
  Energy:
    "M10 17c-3 0-5-2-5-4.8 0-2.7 2.2-4.2 3-7.2 1.4 1.4 1.8 3 1.6 4.4 1-.6 1.6-1.6 1.8-2.8 2 1.6 3.6 3.6 3.6 5.6 0 2.8-2 4.8-5 4.8Z",
  Finance: "M3 8 10 4l7 4ZM4.5 8v6.5M8 8v6.5M12 8v6.5M15.5 8v6.5M3 16.5h14",
  Health: "M8 3.5h4v4.5h4.5v4H12v4.5H8V12H3.5V8H8Z",
  Industrial: gear(),
  RealEstate: "M3.5 9.5 10 4l6.5 5.5M5.5 8v8h9V8M8.5 16v-4h3v4",
  Utility: "M11 3 5 11h4.5L9 17l6-8h-4.5Z",
  Media: "M3.5 5.5h13v9h-13ZM8.5 7.8v4.4l3.8-2.2Z",
  Consumer: "M5 7h10l-1 9.5H6ZM7.5 7V5.8a2.5 2.5 0 0 1 5 0V7",
  Staples: "M3.5 8.5h13l-1.5 7.5H5ZM6.5 8.5 9 4M13.5 8.5 11 4M8 11v2.5M12 11v2.5",
  Chemical: molecule(),
  // A sprout: a stem curling up into a big leaf, open at one side, and a small leaf lower
  // down to the left with its vein running into the stem.
  Agri: "M10.59 17.68V9.78C10.67 7.74 11.31 6.59 12.58 5.95M16.28 5.06C16.79 4.17 17.55 3.40 18.19 3.10C16.79 2.25 13.73 1.75 11.69 2.76C9.65 3.79 8.88 6.21 9.39 7.99C9.90 9.78 11.69 9.90 12.71 9.65C14.24 9.27 15.26 8.25 15.57 7.10M9.14 12.46C8.38 9.78 4.80 7.99 2.13 11.18C3.53 11.56 4.29 12.84 5.06 13.47C6.33 14.49 8.38 14.11 9.14 12.46ZM6.08 11.05C8.12 11.43 10.03 12.84 10.59 15.26",
  Materials: "M10 3.5 16 7v6l-6 3.5L4 13V7ZM4 7l6 3.5L16 7M10 10.5v6",
  // Two arrows passing each other: one currency traded for another.
  Currency: "M3.5 7.5h12M12.5 4.5l3 3-3 3M16.5 12.5h-12M7.5 9.5l-3 3 3 3",
  // A credit rating: the letter A, a grade, in front (BEHIND has the B behind it).
  Rating: "M2.5 17.5 6.8 5l4.4 12.5M4.1 13.3h5.4",
  ETF: "M10 3.5 17 7l-7 3.5L3 7ZM3 10l7 3.5 7-3.5M3 13l7 3.5 7-3.5",
  Company: "M5 16.5V4.5h7v12M12 8.5h3v8M3.5 16.5h13M7.5 7h2M7.5 10h2M7.5 13h2",
};

// What some marks have behind them, drawn first and fainter, with a gap cut round the front
// mark where it crosses (a mask), so the front one plainly stands before it: a credit
// rating's B, up and to the right, behind its A.
const BEHIND: Record<string, string> = {
  Rating: "M10.6 3v10M10.6 3h3.5a2.5 2.5 0 0 1 0 5h-3.5M10.6 8h4a2.5 2.5 0 0 1 0 5h-4",
};

export default function KindMark({
  kind,
  className = "",
  color,
}: {
  kind: string;
  className?: string;
  color?: string; // its colour, when not the text's around it
}) {
  const key = kind === "ETF" ? "ETF" : kind.replace(/Company$/, "") || "Company";
  const found = PATHS[key] ? key : "Company";
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`kind-mark kind-mark-${found.toLowerCase()} shrink-0 ${className}`}
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={found === "Chemical" || found === "Agri" ? 1.4 : 1.6} /* these are close-set */
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {BEHIND[found] && (
        <>
          {/* The same for every mark of the kind, so one id serves them all. */}
          <mask id={`kind-mark-behind-${found}`} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
            <rect width="20" height="20" fill="white" />
            <path d={PATHS[found]} stroke="black" strokeWidth={3.6} />
          </mask>
          <path d={BEHIND[found]} opacity={0.55} mask={`url(#kind-mark-behind-${found})`} />
        </>
      )}
      <path d={PATHS[found]} />
    </svg>
  );
}
