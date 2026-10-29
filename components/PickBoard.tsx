"use client";

import { useState } from "react";
import KindMark from "@/components/KindMark";
import Tween from "@/components/Tween";
import { KINDS } from "@/lib/kinds";

export type BoardPick = {
  symbol: string;
  name: string; // as shown: its alias, or its kind and number
  kind: string;
  color: string;
  ink: string;
  currency: string | null; // what it trades in
  price: number;
  move: number | null; // the day's change, in percent (null on the first day)
  held: number; // shares held
};

type Status = "all" | "held" | "up" | "down";
const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "held", label: "Held" },
  { value: "up", label: "Rising" },
  { value: "down", label: "Falling" },
];

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const moneyText = (x: number) => money.format(x);
const pctText = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}%`;
const tone = (x: number) => (x > 0 ? "text-green-700" : x < 0 ? "text-red-600" : "text-slate-500");

// The Sandbox test's picks, to choose the one to trade: a scrollable board of cards (each with
// its badge, name, price and the currency it trades in, the day's change, and the shares held), narrowed by a search (by
// name, alias or kind), by what is held or how it moved today, and by kind (a chip for each
// kind of mark in the set). The chosen pick stays chosen while filtered out of view.
export default function PickBoard({
  picks,
  chosen,
  onChoose,
}: {
  picks: BoardPick[];
  chosen: string;
  onChoose: (symbol: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [kinds, setKinds] = useState<string[]>([]);

  // The kinds in the set, in the legend's order.
  const present = KINDS.filter((k) => picks.some((p) => p.kind === k.kind));
  const words = query.trim().toLowerCase();
  const shown = picks.filter(
    (p) =>
      (!words ||
        p.name.toLowerCase().includes(words) ||
        p.kind.toLowerCase().includes(words) ||
        (KINDS.find((k) => k.kind === p.kind)
          ?.label.toLowerCase()
          .includes(words) ??
          false)) &&
      (status === "all" ||
        (status === "held" && p.held > 0) ||
        (status === "up" && (p.move ?? 0) > 0) ||
        (status === "down" && (p.move ?? 0) < 0)) &&
      (kinds.length === 0 || kinds.includes(p.kind)),
  );
  const filtered = words !== "" || status !== "all" || kinds.length > 0;
  const clear = () => {
    setQuery("");
    setStatus("all");
    setKinds([]);
  };
  const count = (s: Status) =>
    picks.filter(
      (p) =>
        s === "all" ||
        (s === "held" && p.held > 0) ||
        (s === "up" && (p.move ?? 0) > 0) ||
        (s === "down" && (p.move ?? 0) < 0),
    ).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* The filters: a search, what is held or how it moved, and kind. */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-40 flex-1">
          <span className="sr-only">Find a pick</span>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500"
          >
            <path d="M8.5 3.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10ZM12.2 12.2 16.5 16.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find by name, alias or kind"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none"
          />
        </label>
        <div role="group" aria-label="Show" className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={status === s.value}
              onClick={() => setStatus(s.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                status === s.value
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700 hover:bg-white hover:text-slate-900"
              }`}
            >
              {s.label}
              <span
                className={`ml-1 tabular-nums ${status === s.value ? "text-white/70" : "text-slate-500"}`}
              >
                {count(s.value)}
              </span>
            </button>
          ))}
        </div>
      </div>
      {present.length > 1 && (
        <div role="group" aria-label="Kinds" className="mt-2 flex flex-wrap gap-1">
          {present.map((k) => {
            const on = kinds.includes(k.kind);
            const look = picks.find((p) => p.kind === k.kind)!;
            return (
              <button
                key={k.kind}
                type="button"
                aria-pressed={on}
                onClick={() => setKinds((was) => (on ? was.filter((x) => x !== k.kind) : [...was, k.kind]))}
                className={`kind-hover inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                  on
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
                }`}
              >
                <span
                  className="grid size-5 place-items-center rounded-full"
                  style={{ background: look.color, color: look.ink }}
                >
                  <KindMark kind={k.kind} className="size-3" />
                </span>
                {k.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span key={`${shown.length}-${picks.length}`} className="text-fade-in">
          {filtered ? `Showing ${shown.length} of ${picks.length}` : `${picks.length} picks`} · choose one to
          trade it
        </span>
        {filtered && (
          <button
            type="button"
            onClick={clear}
            className="text-fade-in font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:decoration-slate-900"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* The board: scrolls when the cards don't fit. */}
      <div className="pick-board -mx-1 mt-1.5 max-h-64 overflow-y-auto px-1 pb-1 pt-2">
        {shown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
            No picks match.{" "}
            <button type="button" onClick={clear} className="font-semibold text-slate-900 underline">
              Clear filters
            </button>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="group" aria-label="Your picks">
            {shown.map((p, i) => {
              const on = p.symbol === chosen;
              return (
                <button
                  key={p.symbol}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChoose(p.symbol)}
                  className={`kind-hover group/pick rise-in relative flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                    on
                      ? "border-slate-900 bg-white shadow-md shadow-slate-900/10"
                      : "border-slate-200 bg-slate-50/60 hover:border-slate-400 hover:bg-white motion-safe:hover:-translate-y-0.5 hover:shadow-sm"
                  }`}
                  style={{ animationDelay: `${Math.min(i, 12) * 25}ms`, animationDuration: "400ms" }}
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-lg shadow-sm"
                    style={{ background: p.color, color: p.ink }}
                  >
                    <KindMark kind={p.kind} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-xs font-semibold leading-snug text-slate-900">
                      {p.name}
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-2 tabular-nums">
                      <span className="text-sm font-semibold text-slate-900">
                        <Tween value={p.price} format={moneyText} />
                        {p.currency && (
                          <span className="ml-1 text-[10px] font-bold text-slate-500">{p.currency}</span>
                        )}
                      </span>
                      <span
                        className={`text-[11px] font-semibold transition-colors duration-500 ${tone(p.move ?? 0)}`}
                      >
                        {p.move === null ? "" : pctText(p.move)}
                      </span>
                    </span>
                  </span>
                  {p.held > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 px-1.5 text-[10px] font-bold tabular-nums text-white shadow">
                      {p.held.toLocaleString("en-CA")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
