"use client";

import { useEffect, useRef, useState } from "react";
import DeckBack, { Suit } from "@/components/DeckBack";
import KindMark from "@/components/KindMark";

// One pick as a card: the pick's name (or alias), what its card calls it, short (its alias or
// its kind: "Tech"), its number among its kind, its kind (for its mark), its sector's colour
// and the text that reads on it, and the shares held, what they're worth and what they've
// made on what was paid. A pick not held has no shares; its value is then one share's price.
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
const GAP = 14;
const RETURN_MS = 760;
const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const signedMoney = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${money.format(Math.abs(x))}`;

// A whole number from 0 up to (not including) n, at random.
const randomIndex = (n: number) => Math.floor(Math.random() * n);

// A corner of a card's face, as a playing card's: the number of shares held (its "rank") over
// its "suit" in its sector's colour: a fish or a four-leaf clover, as the chosen deck back has.
function Corner({ card, flip }: { card: DeckCard; flip?: boolean }) {
  return (
    <span
      className={`absolute flex flex-col items-center leading-none ${flip ? "bottom-1.5 right-1.5 rotate-180" : "left-1.5 top-1.5"}`}
    >
      <span className="text-base font-bold tabular-nums text-slate-900">
        {card.shares.toLocaleString("en-CA")}
      </span>
      <Suit color={card.color} />
    </span>
  );
}

// A card's face: white, outlined in its sector's colour, the shares held in two corners as a
// playing card's rank, and in its middle its mark, what it's called, and either what the
// shares are worth and have made, or (not held) one share's price.
function CardFace({ card }: { card: DeckCard }) {
  const held = card.shares > 0;
  return (
    <span
      className="absolute inset-0 rounded-xl border-[2.5px] bg-white shadow-md"
      style={{ borderColor: card.color }}
    >
      <Corner card={card} />
      <Corner card={card} flip />
      <span className="flex size-full flex-col items-center justify-center gap-1 px-6 text-center">
        <span
          className="kind-badge grid size-8 place-items-center rounded-lg ring-1 ring-black/5"
          style={{ background: card.color, ["--badge" as string]: card.color }}
        >
          <KindMark kind={card.kind} className="size-5" color={card.mark} />
        </span>
        <span className="block w-full truncate text-[11px] font-semibold leading-tight text-slate-700">
          {/* Short, to fit: "Tech 2", or its alias (the full name is the card's label). */}
          {card.short}
          {card.number && ` ${card.number}`}
        </span>
        <span className="block text-[11px] font-semibold leading-tight tabular-nums text-slate-900">
          {money.format(card.value)}
        </span>
        {held ? (
          <span
            className={`inline-block rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold leading-snug tabular-nums ${
              card.gain > 0 ? "text-green-700" : card.gain < 0 ? "text-red-600" : "text-slate-500"
            }`}
          >
            {signedMoney(card.gain)}
          </span>
        ) : (
          <span className="text-[10px] leading-snug text-slate-500">a share</span>
        )}
      </span>
    </span>
  );
}

// A card that can turn over: its face, with its back behind it. `flip` names the animation
// that turns it face up as it comes in (.deck-flip, .deck-draw in globals.css). Chosen, it is
// lifted, ringed and tagged "Trading" (the same wherever it lies), the ring travelling with it as it comes in.
function Card({ card, flip, chosen }: { card: DeckCard; flip: string; chosen: boolean }) {
  return (
    <span
      className={`${flip} relative block size-full rounded-xl transition-[box-shadow,translate] duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)] [transform-style:preserve-3d] ${
        chosen ? "-translate-y-2 shadow-xl ring-2 ring-slate-900 ring-offset-2" : ""
      }`}
    >
      <span className="absolute inset-0 [backface-visibility:hidden]">
        <CardFace card={card} />
      </span>
      <span className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <DeckBack color={card.color} />
      </span>
      {/* The pick being traded, tagged on its top edge as its row is in the investment universe. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -top-2 left-1/2 rounded-full bg-slate-900 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white shadow transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.3,1.25,0.5,1)] [backface-visibility:hidden] ${
          chosen
            ? "opacity-100 [transform:translateX(-50%)_translateZ(1px)_scale(1)]"
            : "opacity-0 [transform:translateX(-50%)_translateZ(1px)_scale(0.6)]"
        }`}
      >
        Trading
      </span>
    </span>
  );
}

// The Sandbox test's cards. On the left, the hand: one card per pick held, face up, as a
// playing card (its shares its rank, in the corners; its sector's colour round its edge). At
// rest the hand lies stacked, each card a little behind and turned from the last; pointed at
// (or tabbed into), it fans out so each shows whole, and the chosen pick's card stands a
// little proud. On the right, the deck: the picks not yet held, face down in their sectors'
// colours. Clicking it (or "Draw at random!" under it) draws a card at random, turning it face
// up beside it. Clicking the card drawn shows its pick (its chart and ticket, to buy), the
// page gliding up to it; clicking it again, once shown, puts it back under the deck. A pick newly bought leaves the deck and turns face up into the
// hand. Clicking a card in the hand chooses its pick.
export default function HoldingsDeck({
  cards,
  pile,
  selected,
  onSelect,
  onView,
}: {
  cards: DeckCard[];
  pile: DeckCard[];
  selected: string;
  onSelect: (symbol: string) => void;
  onView: (symbol: string) => void; // a card drawn, clicked: its pick shown and scrolled to
}) {
  const row = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [open, setOpen] = useState(false);
  // The deck's order (picks put back go under it), the card drawn (if any), and a card being
  // put back (sliding back onto the deck).
  const [order, setOrder] = useState<string[]>(() => pile.map((c) => c.symbol));
  const [drawn, setDrawn] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  const [draws, setDraws] = useState(0);
  // Whether the deck has been clicked since the pointer came onto it (its cat happy).
  const [happy, setHappy] = useState(false);
  // A pick bought while drawn, whose card comes into the hand from the drawn place.
  const [fromDrawn, setFromDrawn] = useState<string | null>(null);
  // The hand in the order its cards came in, each new one joining the end.
  const [hand, setHand] = useState<string[]>(() => cards.map((c) => c.symbol));

  // The row's width, to fan the hand across.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keeping the hand's order and the deck's in step with what is held: a pick bought joins the
  // hand's end (and leaves the deck); one sold off goes back under the deck.
  const heldKey = cards.map((c) => c.symbol).join(",");
  const pileKey = pile.map((c) => c.symbol).join(",");
  const [seen, setSeen] = useState(`${heldKey}|${pileKey}`);
  if (seen !== `${heldKey}|${pileKey}`) {
    setSeen(`${heldKey}|${pileKey}`);
    const held = new Set(cards.map((c) => c.symbol));
    const free = new Set(pile.map((c) => c.symbol));
    setHand((h) => [
      ...h.filter((s) => held.has(s)),
      ...cards.map((c) => c.symbol).filter((s) => !h.includes(s)),
    ]);
    setOrder((o) => [
      ...o.filter((s) => free.has(s)),
      ...pile.map((c) => c.symbol).filter((s) => !o.includes(s)),
    ]);
    if (drawn && !free.has(drawn)) {
      // Bought while drawn: its card goes into the hand from where it lay, beside the deck.
      if (held.has(drawn)) setFromDrawn(drawn);
      setDrawn(null);
    }
  }

  const bySymbol = new Map([...cards, ...pile].map((c) => [c.symbol, c]));
  const handCards = hand.map((s) => bySymbol.get(s)).filter((c): c is DeckCard => !!c && c.shares > 0);
  const deck = order
    .filter((s) => s !== drawn)
    .map((s) => bySymbol.get(s))
    .filter((c): c is DeckCard => !!c);
  const shown = drawn ? bySymbol.get(drawn) : undefined;

  // Drawing the deck's top card (any card already drawn going back under the deck first).
  function draw() {
    // A card from anywhere in the deck, at random.
    const top = deck[randomIndex(deck.length)];
    if (!top) return;
    setOrder((o) => [
      ...o.filter((s) => s !== top.symbol && s !== drawn),
      ...(drawn ? [drawn] : []),
      top.symbol,
    ]);
    setDrawn(top.symbol);
    setDraws((d) => d + 1);
  }

  // Putting the drawn card back under the deck: face down, it slides out to the deck's side,
  // then tucks in under it (.deck-return in globals.css).
  function putBack() {
    if (!drawn) return;
    const back = drawn;
    setOrder((o) => [...o.filter((s) => s !== back), back]);
    setDrawn(null);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) return;
    setReturning(back);
    window.setTimeout(() => setReturning((r) => (r === back ? null : r)), RETURN_MS);
  }

  const n = handCards.length;
  // The hand's room: the row less the drawn card's place and the deck's.
  const room = Math.max(width - 2 * CARD_W - 2 * GAP, CARD_W);
  // Fanned out: side by side with a small gap, or overlapping just enough to fit its room.
  const spread = n > 1 ? Math.min(CARD_W + 10, (room - CARD_W) / (n - 1)) : 0;
  const returned = returning ? bySymbol.get(returning) : undefined;
  // The deck as drawn, less a card still tucking in under it; and how deep that card ends up.
  const stack = deck.filter((c) => c.symbol !== returning);
  const under = Math.min(deck.length, 4) - 1;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Your holdings{n ? ` · ${n}` : ""}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Deck{deck.length ? ` · ${deck.length}` : ""}
        </p>
      </div>
      <div ref={row} className="relative mt-2" style={{ height: CARD_H + 18 + 40 }}>
        {/* The hand. */}
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: room }}
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
          {handCards.map((card, i) => {
            const chosen = card.symbol === selected;
            // At rest: stacked, each a little to the right of and turned from the one before;
            // spread out: across its room, upright.
            const x = open ? i * spread : i * 9;
            const y = open ? 0 : i * -1.5;
            const turn = open ? 0 : (i - (n - 1) / 2) * 2.5;
            return (
              <button
                key={card.symbol}
                type="button"
                onClick={() => onSelect(card.symbol)}
                aria-pressed={chosen}
                aria-label={`${card.name}: ${card.shares} shares, worth ${money.format(card.value)}`}
                className="kind-hover absolute left-0 top-3 rounded-xl transition-transform duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  zIndex: chosen && !open ? n + 1 : i + 1,
                  transform: `translate(${x}px, ${y}px) rotate(${turn}deg)`,
                  // How far right the deck lies, for a card newly held to come in from it.
                  ["--from" as string]: `${width - CARD_W - x - (card.symbol === fromDrawn ? CARD_W + GAP : 0)}px`,
                }}
              >
                <Card card={card} flip="deck-flip" chosen={chosen} />
              </button>
            );
          })}
        </div>

        {/* The card drawn, face up beside the deck (its pick shown). Clicked, it shows its pick
            again if another has been chosen since; otherwise it goes back under the deck. */}
        <div className="absolute top-3" style={{ right: CARD_W + GAP, width: CARD_W }}>
          {shown ? (
            <div key={`${shown.symbol}-${draws}`}>
              <button
                type="button"
                onClick={() => (shown.symbol === selected ? putBack() : onView(shown.symbol))}
                aria-pressed={shown.symbol === selected}
                aria-label={`${shown.name}: not held, ${money.format(shown.value)} a share. ${
                  shown.symbol === selected ? "Click to put it back" : "Click to view it"
                }`}
                className="kind-hover relative block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                style={{ width: CARD_W, height: CARD_H, ["--from" as string]: `${CARD_W + GAP}px` }}
              >
                <Card card={shown} flip="deck-draw" chosen={shown.symbol === selected} />
              </button>
              {/* What clicking it does. */}
              <p
                className="text-fade-in mt-2.5 text-center text-[11px] leading-snug text-slate-500"
                style={{ animationDelay: "350ms" }}
              >
                {shown.symbol === selected ? "Click to put it back" : "Click to view it"}
              </p>
            </div>
          ) : null}
        </div>

        {/* The deck: the picks not held, face down; clicking it
            draws. */}
        <div className="absolute right-0 top-3" style={{ width: CARD_W, height: CARD_H }}>
          {deck.length === 0 && !returned ? (
            <div className="text-fade-in grid size-full place-items-center rounded-xl border-2 border-dashed border-slate-300 p-3 text-center text-[11px] leading-snug text-slate-400">
              Every pick is in your hand.
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                draw();
                setHappy(true);
              }}
              // Clicked, the cat on its top card is happy until the pointer leaves it.
              data-happy={happy || undefined}
              onPointerLeave={() => setHappy(false)}
              disabled={deck.length === 0}
              aria-label={`Draw at random from the deck (${deck.length} ${deck.length === 1 ? "card" : "cards"})`}
              className="deck-pile group relative block size-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              {/* A card being put back, tucking in under the others (above them as it comes out
                  to the side, then beneath them), to end where the bottom card lies. */}
              {returned && (
                <span
                  key={`back-${returned.symbol}`}
                  className="deck-return absolute inset-0"
                  style={{
                    ["--from" as string]: `${-(CARD_W + GAP)}px`,
                    ["--end-x" as string]: `${under * 2.5}px`,
                    ["--end-turn" as string]: `${under * 1.5}deg`,
                    ["--end-o" as string]: deck.length > 4 ? 0 : 1,
                  }}
                >
                  <DeckBack color={returned.color} />
                </span>
              )}
              {/* The cards under the top one, peeking out a little below and to the side. */}
              {stack
                .slice(0, 4)
                .reverse()
                .map((c, k, all) => {
                  const depth = all.length - 1 - k;
                  return (
                    <span
                      key={c.symbol}
                      className="absolute inset-0 z-[2] transition-transform duration-300 ease-out"
                      style={{
                        transform: `translate(${depth * 2.5}px, ${depth * 2.5}px) rotate(${depth * 1.5}deg)`,
                      }}
                    >
                      <span
                        className={`absolute inset-0 transition-transform duration-300 ease-out ${depth === 0 ? "motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:-rotate-2" : ""}`}
                      >
                        <DeckBack color={c.color} />
                      </span>
                    </span>
                  );
                })}
              {/* Under the deck, saying what clicking it does. */}
              {deck.length > 0 && (
                <span className="absolute -inset-x-4 top-full mt-2.5 text-center text-[11px] leading-snug">
                  <span className="block font-semibold text-slate-900 underline-offset-2 group-hover:underline">
                    Draw at random!
                  </span>
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
