"use client";

import { useEffect, useRef, useState } from "react";
import KindMark from "@/components/KindMark";

// One holding in the deck: the pick's name (or alias), what its card calls it, short (its alias
// or its kind: "Tech"), its number among its kind, its kind (for its mark),
// its sector's colour and the text that reads on it, and the shares held, what they're worth
// and what they've made on what was paid.
export type DeckCard = {
  symbol: string;
  name: string;
  short: string;
  number: string;
  kind: string;
  color: string;
  ink: string;
  mark: string; // its kind's mark's colour
  shares: number;
  value: number;
  gain: number;
};

const CARD_W = 116;
const CARD_H = 150;
const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const signedMoney = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${money.format(Math.abs(x))}`;

// The Sandbox test's holdings, as a deck of cards: one card per pick held, in its sector's
// colour, with its kind's mark and its number on top, then how many shares, what they're
// worth and what they've made. At rest the cards lie stacked, each a little behind and
// turned from the last; pointed at (or tabbed into), the deck fans out across its row so each
// card shows whole, and the chosen pick's card stands a little proud. A card newly held is
// dealt in, swooping onto the deck (.deck-deal in globals.css); clicking a card chooses its
// pick. With nothing held, an empty place waits for the first card.
export default function HoldingsDeck({
  cards,
  selected,
  onSelect,
}: {
  cards: DeckCard[];
  selected: string;
  onSelect: (symbol: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [open, setOpen] = useState(false);

  // The row's width, to fan the cards across.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = cards.length;
  // Fanned out: side by side with a small gap, or overlapping just enough to fit the row.
  const spread = n > 1 ? Math.min(CARD_W + 10, (width - CARD_W) / (n - 1)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Your holdings{n ? ` · ${n}` : ""}
        </p>
        {n > 1 && (
          <p
            className="text-[11px] text-slate-400 transition-opacity duration-300"
            style={{ opacity: open ? 0 : 1 }}
          >
            Point at the deck to spread it out
          </p>
        )}
      </div>
      <div
        ref={row}
        className="relative mt-2"
        style={{ height: CARD_H + 18 }}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
      >
        {n === 0 && (
          <div
            className="text-fade-in absolute left-0 top-3 grid place-items-center rounded-xl border-2 border-dashed border-slate-300 p-3 text-center text-[11px] leading-snug text-slate-400"
            style={{ width: CARD_W, height: CARD_H }}
          >
            No shares yet. Buy some, and they&apos;re dealt here.
          </div>
        )}
        {cards.map((card, i) => {
          const chosen = card.symbol === selected;
          // At rest: stacked, each a little to the right of and turned from the one before;
          // spread out: across the row, upright.
          const x = open ? i * spread : i * 9;
          const y = (chosen ? -8 : 0) + (open ? 0 : i * -1.5);
          const turn = open ? 0 : (i - (n - 1) / 2) * 2.5;
          return (
            <button
              key={card.symbol}
              type="button"
              onClick={() => onSelect(card.symbol)}
              aria-pressed={chosen}
              aria-label={`${card.name}: ${card.shares} shares, worth ${money.format(card.value)}`}
              className={`kind-hover deck-deal absolute left-0 top-3 flex flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left shadow-md transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                chosen
                  ? "shadow-xl ring-2 ring-slate-900 ring-offset-2"
                  : "ring-1 ring-black/10 hover:shadow-lg"
              }`}
              style={{
                width: CARD_W,
                height: CARD_H,
                background: card.color,
                color: card.ink,
                zIndex: chosen && !open ? n + 1 : i + 1,
                transform: `translate(${x}px, ${y}px) rotate(${turn}deg)`,
              }}
            >
              {/* The mark and the number, on top. */}
              <span className="flex items-start justify-between">
                <span
                  className="kind-badge grid size-8 place-items-center rounded-lg bg-white/25 ring-1 ring-black/5"
                  style={{ ["--badge" as string]: card.color }}
                >
                  <KindMark kind={card.kind} className="size-5" color={card.mark} />
                </span>
                <span className="text-lg font-bold leading-none tabular-nums">{card.number}</span>
              </span>
              <span>
                <span className="block truncate text-[11px] font-semibold leading-tight opacity-85">
                  {/* Short, to fit: "Tech", or its alias (the full name is the card's label). */}
                  {card.short}
                </span>
                <span className="block text-xl font-bold leading-tight tabular-nums">
                  {card.shares.toLocaleString("en-CA")}
                  <span className="ml-1 text-[11px] font-semibold opacity-80">
                    {card.shares === 1 ? "share" : "shares"}
                  </span>
                </span>
              </span>
              <span className="block text-[11px] leading-tight tabular-nums">
                <span className="block font-semibold">{money.format(card.value)}</span>
                <span
                  className={`mt-0.5 inline-block rounded-full bg-white/90 px-1.5 font-semibold ${
                    card.gain > 0 ? "text-green-700" : card.gain < 0 ? "text-red-600" : "text-slate-500"
                  }`}
                >
                  {signedMoney(card.gain)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
