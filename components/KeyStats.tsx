import type { KeyStats as Stats } from "@/lib/db";

// Prices as finance sites list them: plain numbers, two decimals, no currency sign.
const price = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const count = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-CA"));

const range = (lo: number | null, hi: number | null) =>
  lo === null || hi === null ? "—" : `${price(lo)} - ${price(hi)}`;

const quote = (p: number | null, size: number | null) =>
  p === null ? "—" : size === null ? price(p) : `${price(p)} x ${count(size)}`;

export default function KeyStats({ stats }: { stats: Stats }) {
  const rows: [string, string][] = [
    ["Previous Close", price(stats.prevClose)],
    ["Open", price(stats.open)],
    ["Bid", quote(stats.bid, stats.bidSize)],
    ["Ask", quote(stats.ask, stats.askSize)],
    ["Day's Range", range(stats.dayLow, stats.dayHigh)],
    ["52 Week Range", range(stats.week52Low, stats.week52High)],
    ["Volume", count(stats.volume)],
    ["Avg. Volume", count(stats.avgVolume)],
  ];

  return (
    <dl className="mt-6 grid gap-x-8 text-sm sm:grid-cols-2">
      {rows.map(([label, value], i) => (
        <div
          key={label}
          className="rise-in flex justify-between gap-4 border-b border-slate-200 py-2"
          style={{ animationDelay: `${300 + i * 40}ms` }}
        >
          <dt className="text-slate-600">{label}</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
