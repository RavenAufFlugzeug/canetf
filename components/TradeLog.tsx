"use client";

import { useEffect, useId, useRef, useState } from "react";
import FoldButton from "@/components/FoldButton";
import KindMark from "@/components/KindMark";
import { BuyMark, SellMark } from "@/components/TestMarks";

export type LoggedTrade = {
  symbol: string;
  day: number;
  side: "Bought" | "Sold";
  shares: number;
  price: number;
};
// How a pick looks: its kind's mark, on its sector's colour.
export type PickLook = { kind: string; color: string; ink: string; currency?: string | null };

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const sharesText = (n: number) => `${n.toLocaleString("en-CA")} ${n === 1 ? "share" : "shares"}`;
const tradesText = (n: number) => `${n} ${n === 1 ? "trade" : "trades"}`;
// Money in green, money out red.
const tone = (x: number) => (x > 0 ? "text-green-700" : x < 0 ? "text-red-600" : "text-slate-900");
const netText = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${money.format(Math.abs(x))}`;

// What a run of trades came to: bought, sold, and the cash it made or spent.
function totals(trades: LoggedTrade[]) {
  const bought = trades.filter((t) => t.side === "Bought").reduce((sum, t) => sum + t.shares * t.price, 0);
  const sold = trades.filter((t) => t.side === "Sold").reduce((sum, t) => sum + t.shares * t.price, 0);
  return { bought, sold, net: sold - bought };
}

// A pick's badge: its kind's mark on its sector's colour.
function Badge({ look, className }: { look?: PickLook; className: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center ${className}`}
      style={{ background: look?.color ?? "#e2e8f0", color: look?.ink ?? "#0f172a" }}
    >
      <KindMark kind={look?.kind ?? "Company"} className="size-[70%]" />
    </span>
  );
}

// The Sandbox test's trade record, above the buttons that move the test on. A summary on top
// (what is shown, how much was bought and sold); then two strips of chips to narrow it: by
// holding (every pick, or one that was traded) and by day (every day, or one that had trades,
// with arrows to step between them). Then the board: a scrollable list of trades, the latest
// first, under a header for each day that stays in view as it scrolls. A row shows the pick's
// badge (its mark moving when pointed at, as elsewhere), its name, buy or sell, how many at
// what price, and the cash it moved (money in green, money out red). Narrowing it, the board
// fades over; a new trade slides in, lit a moment. Its Fold / Open button folds all but the
// summary away, and opens it again.
export default function TradeLog({
  trades,
  looks,
  nameOf,
}: {
  trades: LoggedTrade[];
  looks: Record<string, PickLook>;
  nameOf: (symbol: string) => string;
}) {
  const [pickView, setPickView] = useState<string>("all");
  const [dayView, setDayView] = useState<number | "all">("all");
  // Whether the filters and the board are open (they start open; Fold folds them away under
  // the summary, as the Holdings Map's key does).
  const [open, setOpen] = useState(true);
  const id = useId();

  // The picks traded, in the order first traded; one no longer among them shows all.
  const symbols = [...new Set(trades.map((t) => t.symbol))];
  const pick = pickView !== "all" && symbols.includes(pickView) ? pickView : "all";
  const ofPick = pick === "all" ? trades : trades.filter((t) => t.symbol === pick);
  // The days with trades (of that pick), earliest first; likewise.
  const days = [...new Set(ofPick.map((t) => t.day))].sort((a, b) => a - b);
  const day = dayView !== "all" && days.includes(dayView) ? dayView : "all";
  const shown = day === "all" ? ofPick : ofPick.filter((t) => t.day === day);
  const sum = totals(shown);
  const at = day === "all" ? -1 : days.indexOf(day);

  const arrow = (dir: -1 | 1) => {
    // From All days, back goes to the latest day and on to the earliest.
    const to = day === "all" ? (dir === -1 ? days.length - 1 : 0) : at + dir;
    const usable = days.length > 0 && to >= 0 && to < days.length;
    return (
      <button
        type="button"
        aria-label={dir === -1 ? "Earlier day with trades" : "Later day with trades"}
        disabled={!usable}
        onClick={() => usable && setDayView(days[to])}
        className="group grid size-7 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-90 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-3 transition-transform duration-300 ease-out ${
            dir === -1
              ? "motion-safe:group-hover:-translate-x-0.5"
              : "motion-safe:group-hover:translate-x-0.5"
          }`}
        >
          <path d={dir === -1 ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6 4.5 9.5"} />
        </svg>
      </button>
    );
  };

  const what = `${pick === "all" ? "All holdings" : nameOf(pick)} · ${day === "all" ? "every day" : `Day ${day}`}`;

  return (
    <section aria-label="Trade record" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* The summary: what is shown, and what it came to. */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 pb-3 pt-4 transition-colors duration-500 ${open ? "border-slate-100" : "border-transparent"}`}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M5 2.5h10a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1ZM7 6.5h6M7 10h6M7 13.5h3.5" />
            </svg>
            Trade record
          </p>
          <p key={what} className="text-fade-in mt-0.5 truncate text-xs text-slate-500">
            {what} · {tradesText(shown.length)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <dl className="flex gap-4 text-right text-xs tabular-nums">
            <div>
              <dt className="text-slate-500">Bought</dt>
              <dd className="font-semibold text-slate-900">{money.format(sum.bought)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sold</dt>
              <dd className="font-semibold text-slate-900">{money.format(sum.sold)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cash moved</dt>
              <dd className={`font-semibold ${tone(sum.net)}`}>{netText(sum.net)}</dd>
            </div>
          </dl>
          <FoldButton open={open} controls={id} onClick={() => setOpen(!open)} className="text-xs" />
        </div>
      </div>

      <div id={id} className="legend-fold" data-closed={open ? undefined : ""} inert={!open}>
        <div>
          {/* Which holding: all, or one that was traded. */}
          <div className="flex items-center gap-2 px-4 pt-3">
            <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Holding
            </span>
            <Strip
              label="Holding"
              chosen={pick}
              onChoose={(v) => setPickView(String(v))}
              items={[
                { value: "all", label: "All", count: trades.length },
                ...symbols.map((s) => ({
                  value: s,
                  label: nameOf(s),
                  count: trades.filter((t) => t.symbol === s).length,
                  badge: looks[s],
                })),
              ]}
            />
          </div>

          {/* Which day: all, or one that had trades, with arrows to step between them. */}
          <div className="flex items-center gap-2 px-4 pt-2">
            <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Day
            </span>
            {arrow(-1)}
            <Strip
              label="Day"
              chosen={day}
              onChoose={(v) => setDayView(v === "all" ? "all" : Number(v))}
              items={[
                { value: "all", label: "All", count: ofPick.length },
                ...[...days].reverse().map((d) => ({
                  value: d,
                  label: `Day ${d}`,
                  count: ofPick.filter((t) => t.day === d).length,
                })),
              ]}
            />
            {arrow(1)}
          </div>

          {/* The board. Keyed by what is shown, so a change fades the new list in. */}
          <div className="trade-board mt-2 max-h-72 overflow-y-auto px-2 pb-2">
            {trades.length === 0 ? (
              <div className="m-2 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                No trades yet. Each order you place shows up here, day by day.
              </div>
            ) : (
              <Board
                key={`${pick}|${day}`}
                trades={trades}
                pick={pick}
                days={day === "all" ? [...days].reverse() : [day]}
                looks={looks}
                nameOf={nameOf}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

type Item = { value: string | number; label: string; count: number; badge?: PickLook };

// A row of chips, one chosen, scrolling sideways when they don't fit: a dark pill slides
// behind the chosen one, and the strip scrolls it into view.
function Strip({
  label,
  items,
  chosen,
  onChoose,
}: {
  label: string;
  items: Item[];
  chosen: string | number;
  onChoose: (value: string | number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const shape = items.map((i) => `${i.value}:${i.count}`).join(",");
  useEffect(() => {
    const chip = strip.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(String(chosen))}"]`);
    if (!chip || !pill.current) return;
    pill.current.style.width = `${chip.offsetWidth}px`;
    pill.current.style.transform = `translateX(${chip.offsetLeft}px)`;
    pill.current.style.opacity = "1";
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const box = strip.current!;
    const left = chip.offsetLeft - (box.clientWidth - chip.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: calm ? "auto" : "smooth" });
  }, [chosen, shape]);

  return (
    <div
      ref={strip}
      role="group"
      aria-label={label}
      className="trade-strip relative flex min-w-0 flex-1 gap-1 overflow-x-auto px-3 py-0.5"
    >
      <span
        ref={pill}
        aria-hidden
        className="absolute left-0 top-0.5 h-[calc(100%-4px)] rounded-full bg-slate-900 opacity-0 shadow-sm transition-[transform,width] duration-[400ms] ease-[cubic-bezier(0.3,1.2,0.5,1)]"
      />
      {items.map((item) => {
        const on = item.value === chosen;
        return (
          <button
            key={item.value}
            type="button"
            data-value={item.value}
            aria-pressed={on}
            onClick={() => onChoose(item.value)}
            className={`kind-hover relative z-10 inline-flex max-w-64 shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 text-xs font-semibold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
              item.badge ? "pl-1" : "pl-3"
            } ${on ? "text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"}`}
          >
            {item.badge && <Badge look={item.badge} className="size-5 rounded-full" />}
            <span className="truncate">{item.label}</span>
            <span
              className={`rounded-full px-1.5 text-[10px] tabular-nums transition-colors duration-300 ${
                on ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// The trades of the days given (latest day first), of one pick or all, under a header for
// each day. Rows here when it first shows rise in one after another; a trade made after that
// slides in and is lit.
function Board({
  trades,
  pick,
  days,
  looks,
  nameOf,
}: {
  trades: LoggedTrade[];
  pick: string;
  days: number[];
  looks: Record<string, PickLook>;
  nameOf: (symbol: string) => string;
}) {
  const [known] = useState(trades.length);
  let n = 0;
  return (
    <div>
      {days.map((d) => {
        const rows = trades
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => t.day === d && (pick === "all" || t.symbol === pick))
          .reverse();
        const { net } = totals(rows.map(({ t }) => t));
        return (
          <div key={d}>
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white/90 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
              <span>Day {d}</span>
              <span className="normal-case tracking-normal tabular-nums">
                {tradesText(rows.length)} · <span className={tone(net)}>{netText(net)}</span>
              </span>
            </div>
            <ol>
              {rows.map(({ t, i }) => {
                const fresh = i >= known;
                const buy = t.side === "Bought";
                return (
                  <li
                    key={i}
                    className={`kind-hover group flex items-center gap-3 rounded-lg px-2 py-2 transition duration-200 ease-out hover:translate-x-0.5 hover:bg-slate-50 ${
                      fresh ? "trade-row" : "rise-in"
                    }`}
                    style={fresh ? undefined : { animationDelay: `${Math.min(n++, 10) * 35}ms` }}
                  >
                    <Badge
                      look={looks[t.symbol]}
                      className="size-8 rounded-lg shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.3,1.6,0.5,1)] group-hover:scale-110"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {nameOf(t.symbol)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs tabular-nums text-slate-500">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-bold ${
                            buy
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-900 ring-1 ring-slate-300"
                          }`}
                        >
                          {buy ? <BuyMark className="size-3" /> : <SellMark className="size-3" />}
                          {buy ? "BUY" : "SELL"}
                        </span>
                        {sharesText(t.shares)} at {money.format(t.price)}
                        {looks[t.symbol]?.currency ? ` ${looks[t.symbol]?.currency}` : ""}
                      </span>
                    </span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${buy ? "text-red-600" : "text-green-700"}`}
                    >
                      {buy ? "−" : "+"}
                      {money.format(t.shares * t.price)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
