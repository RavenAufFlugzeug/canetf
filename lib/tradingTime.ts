// Trading time, as the Sandbox counts it: in trading days (markets close on weekends and
// holidays), 5 to a week, 21 to a month and 252 to a year.
const UNITS = [
  { name: "year", days: 252 },
  { name: "month", days: 21 },
  { name: "week", days: 5 },
] as const;

const plural = (k: number, name: string) => `${k} ${name}${k === 1 ? "" : "s"}`;

// `n` trading days in the largest unit it is a whole number of ("3 days", "1 week",
// "2 months", "1 year"), or, when it is none, in the largest unit it makes at least one of,
// rounded ("8 days" is about 2 weeks); `exact` says which.
export function tradingSpan(n: number): { text: string; exact: boolean } {
  for (const unit of UNITS)
    if (n >= unit.days && n % unit.days === 0) return { text: plural(n / unit.days, unit.name), exact: true };
  const unit = UNITS.find((u) => n >= u.days);
  if (!unit) return { text: plural(n, "day"), exact: true };
  return { text: plural(Math.round(n / unit.days), unit.name), exact: false };
}

// A day of the Sandbox's test, by its number: Day 1 onwards for the test itself, and the
// days before it by how long before Day 1 they are ("−3 days", "−1 week", "≈ −3 months").
export function testDayName(d: number): string {
  if (d >= 1) return `Day ${d}`;
  const { text, exact } = tradingSpan(1 - d);
  return exact ? `−${text}` : `≈ −${text}`;
}
