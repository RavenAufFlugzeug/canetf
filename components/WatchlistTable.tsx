"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Company } from "@/lib/db";
import { moneyFormatter } from "@/lib/money";

const ROW_LEAVE_MS = 350; // matches .picker-collapse in globals.css

const money = (value: number | null, currency: string | null) =>
  value === null ? "—" : moneyFormatter(currency).format(value);

const compact = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("en-CA", { notation: "compact", maximumFractionDigits: 1 });

// Table rows can't fold their height directly, so each cell's content sits in a
// folding wrapper (.picker-collapse) and the padding lives inside it.
function Cell({
  folded,
  className = "",
  children,
}: {
  folded: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <td className="p-0">
      <div className="picker-collapse" data-closed={folded ? "" : undefined}>
        <div>
          <div className={`p-4 ${className}`}>{children}</div>
        </div>
      </div>
    </td>
  );
}

export default function WatchlistTable({
  companies,
  justAdded,
  remove,
}: {
  companies: Company[];
  justAdded: string[]; // added moments ago: unfold in with a highlight
  remove: (symbol: string) => Promise<void>;
}) {
  // Rows folding away; they are removed once the fold has played.
  const [leaving, setLeaving] = useState<string[]>([]);
  const [, startRemoval] = useTransition();

  function onRemove(symbol: string) {
    setLeaving((l) => [...l, symbol]);
    setTimeout(
      () =>
        startRemoval(async () => {
          await remove(symbol);
          setLeaving((l) => l.filter((s) => s !== symbol));
        }),
      ROW_LEAVE_MS,
    );
  }

  return (
    // Scrolls sideways if the table is too wide, but never vertically: a vertical scrollbar
    // (e.g. while rows rise in, or from a 1px rounding overflow) would take 15px of width
    // and make the columns re-wrap.
    <div className="overflow-x-auto overflow-y-hidden rounded-2xl bg-white shadow">
      {/* Fixed column widths, so adding or removing a row never resizes the columns and
          re-wraps the names; the name column takes the rest. Narrower than min-w, the
          table scrolls sideways instead of squeezing the names. */}
      <table className="w-full min-w-[53rem] table-fixed text-left text-sm text-slate-700">
        <colgroup>
          <col className="w-[6.5rem]" />
          <col />
          <col className="w-[8rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[5.5rem]" />
          <col className="w-[5.5rem]" />
          <col className="w-[4rem]" />
          <col className="w-[7.75rem]" />
        </colgroup>
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="p-4">Symbol</th>
            <th className="p-4">Name</th>
            <th className="p-4">Sector</th>
            <th className="p-4 text-right">Price</th>
            <th className="p-4 text-right">Change</th>
            <th className="p-4 text-right">Market cap</th>
            <th className="p-4 text-right">P/E</th>
            <th className="p-4">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const folded = leaving.includes(c.symbol);
            return (
              <tr
                key={c.symbol}
                className={`border-b border-slate-200 last:border-0 ${
                  justAdded.includes(c.symbol) ? "row-added" : "row-rise"
                }`}
              >
                <Cell folded={folded} className="font-semibold">
                  <Link
                    href={`/search?symbol=${encodeURIComponent(c.symbol)}`}
                    className="hover:text-blue-600"
                  >
                    {c.symbol}
                  </Link>
                </Cell>
                <Cell folded={folded}>{c.name ?? "—"}</Cell>
                <Cell folded={folded}>{c.sector ?? "—"}</Cell>
                <Cell folded={folded} className="text-right">
                  {money(c.price, c.currency)}
                </Cell>
                <Cell
                  folded={folded}
                  className={`text-right ${(c.changePct ?? 0) < 0 ? "text-red-600" : "text-green-700"}`}
                >
                  {c.changePct === null
                    ? "—"
                    : `${c.changePct > 0 ? "+" : ""}${c.changePct.toFixed(2)}%`}
                </Cell>
                <Cell folded={folded} className="text-right">
                  {compact(c.marketCap)}
                </Cell>
                <Cell folded={folded} className="text-right">
                  {c.peTrailing === null ? "—" : c.peTrailing.toFixed(1)}
                </Cell>
                <Cell folded={folded} className="pr-10 text-right">
                  <button
                    type="button"
                    disabled={folded}
                    onClick={() => onRemove(c.symbol)}
                    aria-label={`Remove ${c.symbol} from watch list`}
                    className="rounded-md px-2 py-1 text-slate-500 transition-colors duration-500 ease-out hover:bg-red-50 hover:text-red-600"
                  >
                    Remove
                  </button>
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
