"use client";

import KindMark from "@/components/KindMark";
import { countryFlag } from "@/lib/fx";
import { AliasName } from "@/components/SandboxAliases";

// What a company reports today (its latest figures on Yahoo Finance), as the Sandbox shows it:
// its revenue over the last 12 months, its total assets and liabilities from its latest
// balance sheet (and that sheet's date), its full-time employees, and the currency it reports
// in. Null for a fund.
export type Figures = {
  revenue: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  employees: number | null;
  currency: string | null;
  balanceDate: string | null;
} | null;

export type PickCard = {
  symbol: string;
  name: string;
  kind: string;
  color: string;
  ink: string;
  mark: string; // its kind's mark's colour, on its colour
  line: string;
  industry: string | null; // its industry (or, for a fund, its category)
  place: string | null; // where it is based: city, country
  country: string | null; // that country, for its flag
  note: string | null; // for a fund, what it holds in a few words (none for a company)
  about: string | null;
  sector: string | null;
  currency: string | null; // what it trades in
  size: number | null; // its market value today
  figures: Figures;
};

const compact = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 2 });
// A big amount, short ("4.26B USD"); a count, in full ("6,400").
export const amountText = (n: number | null, currency: string | null) =>
  n === null ? "—" : `${compact.format(n)}${currency ? ` ${currency}` : ""}`;
export const countText = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-CA"));
// A balance sheet's date as written: "Jun 30, 2026".
export const dayText = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// The figures, as rows of a small table.
export function FigureRows({ figures }: { figures: NonNullable<Figures> }) {
  const rows: [string, string][] = [
    ["Revenue", amountText(figures.revenue, figures.currency)],
    ["Total assets", amountText(figures.totalAssets, figures.currency)],
    ["Total liabilities", amountText(figures.totalLiabilities, figures.currency)],
    ["Employees", countText(figures.employees)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-slate-500">{label}</dt>
          <dd className="font-semibold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// The Sandbox's picks, as cards: each with a strip and mark of its sector's colour and kind,
// its name (or the alias given it, once the test has started), its industry and where it is,
// and the start of what it does (its name hidden). Pointing at a card (or tabbing into it)
// opens a card under it with its general figures as they are today, saying so: its sector,
// revenue, assets, liabilities and employees. Each card rises in, one after another.
export default function PickCards({ cards }: { cards: PickCard[] }) {
  return (
    <ul className="relative mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <li
          key={card.symbol}
          tabIndex={0}
          className="group/card kind-hover rise-in relative rounded-xl border border-slate-200 bg-white p-3 pl-4 shadow-sm outline-none transition hover:z-20 hover:border-slate-300 hover:shadow-md focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-slate-300"
          style={{ animationDelay: `${60 + Math.min(i, 12) * 30}ms` }}
        >
          <span
            aria-hidden
            className="absolute inset-y-2 left-1.5 w-1 rounded-full"
            style={{ background: card.color }}
          />
          <div className="flex items-start gap-2">
            <span
              className="kind-badge grid size-7 shrink-0 place-items-center rounded-lg"
              style={{ background: card.color, color: card.mark, ["--badge" as string]: card.color }}
            >
              <KindMark kind={card.kind} className="size-4" />
            </span>
            {/* Where it is from: where a company is based, or where a fund is listed. */}
            {countryFlag(card.country, true) && (
              // eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG
              <img
                src={countryFlag(card.country, true)!}
                alt={card.country ?? ""}
                title={`${card.kind === "ETF" ? "Listed in" : "Based in"} ${card.country}`}
                className="mt-2 h-3 w-auto shrink-0 rounded-[2px] ring-1 ring-black/10"
              />
            )}
            <div className="min-w-0 flex-1">
              {/* Aliases are given once the test has started; any given show here. */}
              <AliasName
                symbol={card.symbol}
                name={card.name}
                editable={false}
                className="text-sm font-semibold text-slate-900"
              />
              <p className="text-xs text-slate-500">{card.line}</p>
              {/* A fund: what it holds, in a few words (from its holdings, never naming it). */}
              {card.note && <p className="text-xs font-medium text-slate-700">{card.note}</p>}
            </div>
          </div>
          {card.about && <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">{card.about}</p>}

          {/* Its general figures today, opening under it when pointed at. */}
          <div
            role="tooltip"
            className="pointer-events-none absolute left-2 right-2 top-full z-30 mt-2 translate-y-1 rounded-lg border border-slate-200 bg-white p-3 opacity-0 shadow-lg shadow-slate-300/50 transition duration-200 ease-out group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 group-hover/card:translate-y-0 group-hover/card:opacity-100"
          >
            <span
              aria-hidden
              className="absolute -top-[5.5px] left-5 size-2.5 rotate-45 border-l border-t border-slate-200 bg-white"
            />
            <p className="mb-2 flex items-baseline justify-between gap-2 text-[11px]">
              <span className="font-semibold uppercase tracking-wide text-slate-500">General info</span>
              <span className="text-slate-400">
                Today{card.figures?.balanceDate ? ` · as of ${dayText(card.figures.balanceDate)}` : ""}
              </span>
            </p>
            {card.sector && <p className="mb-1.5 text-xs text-slate-700">{card.sector}</p>}
            {card.figures ? (
              <FigureRows figures={card.figures} />
            ) : (
              <p className="text-xs text-slate-500">A fund: no company figures.</p>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              Today&apos;s figures, not from the stretch of time you&apos;ll trade it in.
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
