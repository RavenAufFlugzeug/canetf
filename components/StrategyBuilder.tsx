"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isPaletteName, paletteColor, PalettePicker, type PaletteName } from "@/components/EtfBreakdown";
import { Fish } from "@/components/HoldingsDeck";
import SearchBox from "@/components/SearchBox";
import SlideTabs from "@/components/SlideTabs";
import StrategyCardBack from "@/components/StrategyCardBack";
import { BuyMark, SellMark } from "@/components/TestMarks";

// The Strategies page's builder (app/strategy/page.tsx), in the Sandbox's cards. Each strategy
// is a deck: on the shelf at the top, the decks kept, face down (StrategyCardBack) in their
// colour (one of the Search charts' four), each with its name and how many cards it holds;
// clicking one opens it. A strategy says what it
// applies to (every firm in a sector, every ETF, or one firm or ETF), and each of its rules is
// a card, dealt face up in a row: the shares it trades in its corners (as a playing card's
// rank), whether it buys or sells, its name and how many conditions it has. Clicking a card
// lifts it (tagged "Editing") and brings up its editor below: its conditions on the market or
// on what is held, all of which must hold, and how many shares to buy or sell. A new card is
// dealt in at the end of the row. The open deck is written out in plain words beside it. The
// first deck is an example for tech firms; the decks are kept in this browser.

type Scope = "sector" | "etfs" | "single";
type Metric =
  | "price"
  | "dayChange"
  | "weekChange"
  | "monthChange"
  | "vsAvg50"
  | "vsAvg200"
  | "fromHigh"
  | "fromLow"
  | "gain"
  | "held";
type Op = "above" | "below";
type Condition = { id: number; metric: Metric; op: Op; value: string };
type Rule = { id: number; name: string; conditions: Condition[]; side: "buy" | "sell"; shares: string };
type Strategy = {
  id: number;
  name: string;
  scope: Scope;
  sector: string;
  symbol: string;
  rules: Rule[];
  palette?: PaletteName; // its colour, one of the Search charts' families (blue, as theirs, if none is chosen)
};
// What is kept: the decks, the one open, and the card being edited in each.
type Saved = { decks: Strategy[]; open: number; editing: Record<number, number> };

// The sectors a strategy can apply to: the broad ones each firm's listing gives.
const SECTORS = [
  "Technology",
  "Communication Services",
  "Healthcare",
  "Financial Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Industrials",
  "Energy",
  "Basic Materials",
  "Real Estate",
  "Utilities",
];

// What a condition can look at, in two groups: the market (the price and how it has moved),
// and the position (what is held of it). Each with its name in the menu, how it reads in a
// sentence, how its value is written, and a line saying what it is.
type MetricInfo = { group: string; label: string; phrase: string; unit: "$" | "%" | "shares"; hint: string };
const METRICS: Record<Metric, MetricInfo> = {
  price: {
    group: "Price and trend",
    label: "Price",
    phrase: "the price",
    unit: "$",
    hint: "The last closing price, in the currency it trades in.",
  },
  dayChange: {
    group: "Price and trend",
    label: "Day's change",
    phrase: "the day's change",
    unit: "%",
    hint: "How far the price moved on the day; a fall is negative.",
  },
  weekChange: {
    group: "Price and trend",
    label: "Change over 5 days",
    phrase: "the change over the past 5 days",
    unit: "%",
    hint: "How far the price moved over the last 5 trading days, about a week.",
  },
  monthChange: {
    group: "Price and trend",
    label: "Change over 1 month",
    phrase: "the change over the past month",
    unit: "%",
    hint: "How far the price moved over the last 21 trading days, about a month.",
  },
  vsAvg50: {
    group: "Price and trend",
    label: "Price vs 50-day average",
    phrase: "the price against its 50-day average",
    unit: "%",
    hint: "How far the price is above (+) or below (−) its average over 50 days: the short-term trend.",
  },
  vsAvg200: {
    group: "Price and trend",
    label: "Price vs 200-day average",
    phrase: "the price against its 200-day average",
    unit: "%",
    hint: "How far the price is above (+) or below (−) its average over 200 days: the long-term trend. Above 0% is often read as an uptrend.",
  },
  fromHigh: {
    group: "Price and trend",
    label: "Distance from 52-week high",
    phrase: "the price against its 52-week high",
    unit: "%",
    hint: "How far the price is below its highest close of the past year: 0% at the high, −20% a fifth below it.",
  },
  fromLow: {
    group: "Price and trend",
    label: "Distance from 52-week low",
    phrase: "the price against its 52-week low",
    unit: "%",
    hint: "How far the price is above its lowest close of the past year: 0% at the low.",
  },
  gain: {
    group: "Your position",
    label: "Gain on shares held",
    phrase: "the gain on the shares held",
    unit: "%",
    hint: "Your return on the shares you hold, against what you paid: for taking profits or cutting losses.",
  },
  held: {
    group: "Your position",
    label: "Shares held",
    phrase: "the number of shares held",
    unit: "shares",
    hint: "How many shares you already own: to cap how much a rule buys.",
  },
};
const GROUPS = [...new Set(Object.values(METRICS).map((m) => m.group))];

const STORE = "canetf-strategy-decks";
const OLD_STORE = "canetf-strategy-draft-v2";

// A card's size, as the Sandbox's; and the room between cards laid side by side.
const CARD_W = 116;
const CARD_H = 150;
const GAP = 12;
// A deck on the shelf: a little bigger than a card.
const DECK_W = Math.round(CARD_W * 1.1);
const DECK_H = Math.round(CARD_H * 1.1);

let next = 1;
const newCondition = (c: Partial<Condition> = {}): Condition => ({
  id: next++,
  metric: "dayChange",
  op: "below",
  value: "",
  ...c,
});
const newRule = (r: Partial<Rule> = {}): Rule => ({
  id: next++,
  name: "",
  conditions: [newCondition()],
  side: "buy",
  shares: "",
  ...r,
});
const newDeck = (d: Partial<Strategy> = {}): Strategy => ({
  id: next++,
  name: "New strategy",
  scope: "sector",
  sector: "Technology",
  symbol: "",
  rules: [newRule()],
  ...d,
});

// The example: tech firms, bought on a sharp daily dip while their long-term trend is still
// up (and only up to a cap), part sold once well up, and more sold if a holding falls too far.
function techExample(): Strategy {
  return newDeck({
    name: "Tech dip buyer",
    rules: [
      newRule({
        name: "Buy the dip",
        conditions: [
          newCondition({ metric: "dayChange", op: "below", value: "-3" }),
          newCondition({ metric: "vsAvg200", op: "above", value: "0" }),
          newCondition({ metric: "held", op: "below", value: "50" }),
        ],
        side: "buy",
        shares: "5",
      }),
      newRule({
        name: "Take profit",
        conditions: [newCondition({ metric: "gain", op: "above", value: "20" })],
        side: "sell",
        shares: "5",
      }),
      newRule({
        name: "Cut losses",
        conditions: [newCondition({ metric: "gain", op: "below", value: "-10" })],
        side: "sell",
        shares: "10",
      }),
    ],
  });
}

function starting(): Saved {
  const deck = techExample();
  return { decks: [deck], open: deck.id, editing: { [deck.id]: deck.rules[0].id } };
}

// A deck's colour family (one of the Search charts', blue unless another is chosen), and its
// colour: that family's main shade.
const deckPalette = (s: Strategy): PaletteName => (isPaletteName(s.palette) ? s.palette : "blue");
const deckColor = (s: Strategy) => paletteColor(deckPalette(s));

const filled = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
const wholeShares = (v: string) => /^\d+$/.test(v.trim()) && Number(v) > 0;
const complete = (r: Rule) => r.conditions.every((c) => filled(c.value)) && wholeShares(r.shares);

function valueText(metric: Metric, value: string) {
  const n = Number(value);
  const unit = METRICS[metric].unit;
  if (unit === "$")
    return `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (unit === "shares") return `${n.toLocaleString("en-CA")} ${n === 1 ? "share" : "shares"}`;
  return `${n.toLocaleString("en-CA", { maximumFractionDigits: 2 }).replace("-", "−")}%`;
}

// What the strategy applies to, in words, and how a rule's shares are said of it.
function scopeText(s: Strategy) {
  if (s.scope === "sector") return `every ${s.sector.toLowerCase()} firm, each on its own`;
  if (s.scope === "etfs") return "every ETF, each on its own";
  return s.symbol ? s.symbol : "the firm or ETF you choose";
}
const ofWhat = (s: Strategy) => (s.scope === "single" ? (s.symbol ? ` of ${s.symbol}` : "") : " of it");

// A rule in plain words, or null while it is missing a figure.
function ruleText(rule: Rule, s: Strategy) {
  if (!complete(rule)) return null;
  const when = rule.conditions
    .map((c) => `${METRICS[c.metric].phrase} is ${c.op} ${valueText(c.metric, c.value)}`)
    .join(" and ");
  const n = Number(rule.shares);
  return `When ${when}, ${rule.side} ${n.toLocaleString("en-CA")} ${n === 1 ? "share" : "shares"}${ofWhat(s)}.`;
}

const ruleName = (r: Rule, i: number) => r.name.trim() || `Card ${i + 1}`;

const FIELD =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-slate-900 focus:outline-none";
const LABEL = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const LIGHT_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50";

export default function StrategyBuilder() {
  const [saved, setSaved] = useState<Saved>(starting);
  const [loaded, setLoaded] = useState(false);
  // Which way the editor's card swap goes (from the side of the card chosen), and asking
  // before a deck is thrown away.
  const [dir, setDir] = useState(1);
  const [deleting, setDeleting] = useState(false);

  // The decks kept from before (or a draft from before there were decks, as the first deck),
  // then kept as they change. (Read once the page is up, as SandboxAliases reads its names.)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const kept = JSON.parse(localStorage.getItem(STORE) ?? "null") as Saved | null;
        const draft = JSON.parse(localStorage.getItem(OLD_STORE) ?? "null") as Omit<Strategy, "id"> | null;
        const ids = (d: Strategy[]) =>
          d.flatMap((s) => [s.id, ...s.rules.flatMap((r) => [r.id, ...r.conditions.map((c) => c.id)])]);
        if (kept?.decks?.length) {
          next = Math.max(next, ...ids(kept.decks)) + 1;
          setSaved(kept);
        } else if (draft?.rules?.length && draft.scope) {
          next = Math.max(next, ...ids([{ ...draft, id: 0 }])) + 1;
          const deck = { ...draft, id: next++ };
          setSaved({ decks: [deck], open: deck.id, editing: { [deck.id]: deck.rules[0].id } });
        }
      } catch {}
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(saved));
    } catch {}
  }, [saved, loaded]);

  const deck = saved.decks.find((d) => d.id === saved.open) ?? saved.decks[0];
  const editingId = deck ? (saved.editing[deck.id] ?? deck.rules[0]?.id) : undefined;
  const at = deck
    ? Math.max(
        0,
        deck.rules.findIndex((r) => r.id === editingId),
      )
    : 0;
  const rule = deck?.rules[at];

  const setDeck = (change: (d: Strategy) => Strategy) =>
    setSaved((s) => ({ ...s, decks: s.decks.map((d) => (d.id === s.open ? change(d) : d)) }));
  const set = (change: Partial<Strategy>) => setDeck((d) => ({ ...d, ...change }));
  const setRule = (id: number, change: (r: Rule) => Rule) =>
    setDeck((d) => ({ ...d, rules: d.rules.map((r) => (r.id === id ? change(r) : r)) }));
  const edit = (id: number) => {
    if (!deck) return;
    const to = deck.rules.findIndex((r) => r.id === id);
    if (to === at) return;
    setDir(to > at ? 1 : -1);
    setSaved((s) => ({ ...s, editing: { ...s.editing, [deck.id]: id } }));
  };
  const openDeck = (id: number) => {
    setDeleting(false);
    setSaved((s) => ({ ...s, open: id }));
  };
  const addDeck = (d: Strategy) => {
    setDeleting(false);
    setSaved((s) => ({
      decks: [...s.decks, d],
      open: d.id,
      editing: { ...s.editing, [d.id]: d.rules[0].id },
    }));
  };
  const addCard = () => {
    const r = newRule();
    setDir(1);
    setSaved((s) => ({
      ...s,
      decks: s.decks.map((d) => (d.id === s.open ? { ...d, rules: [...d.rules, r] } : d)),
      editing: { ...s.editing, [s.open]: r.id },
    }));
  };
  const removeCard = (id: number) => {
    if (!deck || deck.rules.length < 2) return;
    const left = deck.rules.filter((r) => r.id !== id);
    setDir(-1);
    setSaved((s) => ({
      ...s,
      decks: s.decks.map((d) => (d.id === s.open ? { ...d, rules: left } : d)),
      editing: { ...s.editing, [s.open]: left[Math.max(0, at - 1)].id },
    }));
  };
  const removeDeck = () => {
    setDeleting(false);
    setSaved((s) => {
      const decks = s.decks.filter((d) => d.id !== s.open);
      if (!decks.length) return starting();
      return { ...s, decks, open: decks[0].id };
    });
  };

  if (!deck || !rule) return null;
  const color = deckColor(deck);
  const texts = deck.rules.map((r) => ruleText(r, deck));
  const ready = texts.filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* The shelf: every deck kept, and room for a new one. */}
      <section className="rise-in rounded-2xl bg-white p-6 shadow">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-900">
            Your decks · {saved.decks.length}
          </p>
          <button type="button" onClick={() => addDeck(techExample())} className={LIGHT_BUTTON}>
            <PlusMark />
            Add the tech example
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-5">
          {saved.decks.map((d) => (
            <DeckPile key={d.id} deck={d} open={d.id === deck.id} onOpen={() => openDeck(d.id)} />
          ))}
          <button
            type="button"
            onClick={() => addDeck(newDeck())}
            className="group flex w-36 flex-col items-center gap-2 focus-visible:outline-none"
          >
            <span
              className="grid place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition group-hover:border-slate-500 group-hover:text-slate-700 group-focus-visible:border-slate-900"
              style={{ width: DECK_W, height: DECK_H }}
            >
              <PlusMark className="size-5" />
            </span>
            <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900">New deck</span>
          </button>
        </div>
      </section>

      {/* The deck open: swapping in as another is opened. */}
      <div
        key={deck.id}
        className="sandbox-swap-in grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"
      >
        <div className="space-y-4">
          {/* Its name, and what it applies to. */}
          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <label className={`flex min-w-48 flex-1 flex-col gap-1.5 ${LABEL}`}>
                Strategy name
                <input
                  value={deck.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="e.g. Tech dip buyer"
                  className={`${FIELD} normal-case tracking-normal`}
                />
              </label>
              <button
                type="button"
                onClick={() => (deleting ? removeDeck() : setDeleting(true))}
                onBlur={() => setDeleting(false)}
                className={`${LIGHT_BUTTON} ${deleting ? "border-slate-900" : ""}`}
              >
                {deleting ? "Click again to delete" : "Delete deck"}
              </button>
            </div>

            {/* Its colour: one of the families the Search page's charts are coloured in, chosen
                the same way (with its diamonds). */}
            <p className={`mt-5 ${LABEL}`}>Deck colour</p>
            <div className="mt-1">
              <PalettePicker
                label="Deck colour"
                current={deckPalette(deck)}
                onPick={(palette) => set({ palette })}
              />
            </div>

            <p className={`mt-5 ${LABEL}`}>Applies to</p>
            <div className="mt-2 flex">
              <SlideTabs
                label="What the strategy applies to"
                value={deck.scope}
                onChange={(scope) => set({ scope })}
                options={SCOPES}
              />
            </div>
            {/* The sector, or the one firm or ETF; for all ETFs, nothing more to choose. */}
            <div key={deck.scope} className="text-fade-in mt-3">
              {deck.scope === "sector" && (
                <label className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  Every firm in
                  <select
                    value={deck.sector}
                    onChange={(e) => set({ sector: e.target.value })}
                    className={FIELD}
                  >
                    {SECTORS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <span className="basis-full text-slate-500">
                    Each firm is checked against the cards on its own.
                  </span>
                </label>
              )}
              {deck.scope === "etfs" && (
                <p className="text-sm text-slate-600">
                  Every ETF, each checked against the cards on its own.
                </p>
              )}
              {deck.scope === "single" && (
                <div className="max-w-xl">
                  {deck.symbol && (
                    <p className="flex items-center gap-2 text-sm text-slate-600">
                      Chosen:
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 text-sm font-semibold text-white">
                        {deck.symbol}
                      </span>
                      <button
                        type="button"
                        onClick={() => set({ symbol: "" })}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                      >
                        Clear
                      </button>
                    </p>
                  )}
                  <SearchBox
                    lead={deck.symbol ? "Choose another by" : "Choose a firm or ETF by"}
                    placeholders={{ symbol: "e.g. NVDA or XEQT.TO", name: "e.g. Shopify" }}
                    onChoose={async (symbol) => set({ symbol })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Its cards, one per rule: click one to edit it. */}
          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-900">
                Cards · {deck.rules.length}
              </p>
              <p className="text-xs text-slate-500">Click a card to edit it.</p>
            </div>
            <Hand rules={deck.rules} editing={rule.id} color={color} onEdit={edit} onAdd={addCard} />
          </div>

          {/* The card being edited, sliding in from its side as another is chosen. */}
          <div key={rule.id} className="pick-swap-in" style={{ "--dir": dir } as React.CSSProperties}>
            <RuleEditor
              n={at + 1}
              rule={rule}
              removable={deck.rules.length > 1}
              onRemove={() => removeCard(rule.id)}
              onRule={(change) => setRule(rule.id, (r) => ({ ...r, ...change }))}
              onCondition={(id, change) =>
                setRule(rule.id, (r) => ({
                  ...r,
                  conditions: r.conditions.map((c) => (c.id === id ? { ...c, ...change } : c)),
                }))
              }
              onAddCondition={() =>
                setRule(rule.id, (r) => ({ ...r, conditions: [...r.conditions, newCondition()] }))
              }
              onRemoveCondition={(id) =>
                setRule(rule.id, (r) => ({ ...r, conditions: r.conditions.filter((c) => c.id !== id) }))
              }
            />
          </div>
        </div>

        {/* The deck in plain words, kept in view beside it; a card's words choose it too. */}
        <aside className="rounded-2xl bg-white p-6 shadow lg:sticky lg:top-28">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-900">In plain words</p>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {deck.name.trim() || "Untitled strategy"}
          </p>
          <p key={scopeText(deck)} className="text-fade-in mt-1 text-sm text-slate-600">
            Applies to {scopeText(deck)}.
          </p>
          <ol className="mt-4 space-y-1 text-sm text-slate-700">
            {texts.map((text, i) => {
              const r = deck.rules[i];
              const on = r.id === rule.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => edit(r.id)}
                    aria-pressed={on}
                    className={`flex w-full gap-2.5 rounded-lg p-2 text-left transition-colors ${
                      on ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold transition-colors ${
                        on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span>
                      <span className="block font-semibold text-slate-900">{ruleName(r, i)}</span>
                      {text ? (
                        <span key={text} className="text-fade-in">
                          {text}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Fill in this card&apos;s figures to see it here.
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {`${ready} of ${deck.rules.length} ${deck.rules.length === 1 ? "card" : "cards"} complete. Every condition on a card must hold for it to act. Your decks are kept in this browser.`}
          </p>
        </aside>
      </div>
    </div>
  );
}

// The switch's options, made once so it isn't re-measured on every change.
const SCOPES = [
  { value: "sector", label: "A sector" },
  { value: "etfs", label: "All ETFs" },
  { value: "single", label: "One firm or ETF" },
] as const;

// A deck on the shelf: up to three card backs in its colour (the cat by her knocked-over mug,
// which she pokes when the deck is pointed at), stacked a little askew, the top one lifting
// when pointed at; under it, its name and how many cards it holds. The one open is
// ringed and tagged "Open".
function DeckPile({ deck, open, onOpen }: { deck: Strategy; open: boolean; onOpen: () => void }) {
  const color = deckColor(deck);
  const layers = Math.min(deck.rules.length, 3);
  const cards = `${deck.rules.length} ${deck.rules.length === 1 ? "card" : "cards"}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={open}
      aria-label={`${deck.name.trim() || "Untitled strategy"}: ${cards}`}
      className="group flex w-36 flex-col items-center gap-2 focus-visible:outline-none"
    >
      <span className="relative block" style={{ width: DECK_W, height: DECK_H }}>
        {Array.from({ length: layers }, (_, k) => layers - 1 - k).map((depth) => (
          <span
            key={depth}
            className="absolute inset-0"
            style={{ transform: `translate(${depth * 2.5}px, ${depth * 2.5}px) rotate(${depth * 1.5}deg)` }}
          >
            <span
              className={`absolute inset-0 rounded-xl transition-[transform,box-shadow] duration-300 ease-out ${
                depth === 0
                  ? "motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:-rotate-2"
                  : ""
              } ${depth === 0 && open ? "ring-2 ring-slate-900 ring-offset-2" : ""} ${
                depth === 0
                  ? "group-focus-visible:ring-2 group-focus-visible:ring-slate-400 group-focus-visible:ring-offset-2"
                  : ""
              }`}
            >
              <StrategyCardBack color={color} />
            </span>
          </span>
        ))}
        <span
          aria-hidden
          className={`pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white shadow transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.3,1.25,0.5,1)] ${
            open ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        >
          Open
        </span>
      </span>
      <span className="w-full text-center leading-tight">
        <span className="block truncate text-xs font-semibold text-slate-900">
          {deck.name.trim() || "Untitled strategy"}
        </span>
        <span className="text-[11px] text-slate-500">{cards}</span>
      </span>
    </button>
  );
}

// The open deck's cards, face up in a row (overlapping when there are too many to fit side by
// side), each sliding to its place as cards come and go, and a dashed slot after them to deal
// a new one. Each card is dealt in turning face up, one after another as the deck opens.
function Hand({
  rules,
  editing,
  color,
  onEdit,
  onAdd,
}: {
  rules: Rule[];
  editing: number;
  color: string;
  onEdit: (id: number) => void;
  onAdd: () => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = rules.length;
  const spread = n > 1 ? Math.max(0, Math.min(CARD_W + GAP, (width - 2 * CARD_W - GAP) / (n - 1))) : 0;
  const slot = Math.min((n - 1) * spread + CARD_W + GAP, Math.max(width - CARD_W, 0));

  return (
    <div
      ref={row}
      className="relative mt-4 overflow-x-clip [overflow-clip-margin:8px]"
      style={{ height: CARD_H + 16 }}
    >
      {rules.map((r, i) => {
        const on = r.id === editing;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onEdit(r.id)}
            aria-pressed={on}
            aria-label={`${ruleName(r, i)}: ${r.side} ${r.shares || "?"} shares. ${on ? "Editing" : "Click to edit"}`}
            className="group absolute left-0 top-3 rounded-xl transition-transform duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            style={{
              width: CARD_W,
              height: CARD_H,
              zIndex: on ? n + 1 : i + 1,
              transform: `translateX(${i * spread}px)`,
            }}
          >
            <span className="deck-flip block size-full" style={{ animationDelay: `${i * 90}ms` }}>
              <RuleCardFace rule={r} n={i} color={color} on={on} />
            </span>
          </button>
        );
      })}
      {/* A new card. */}
      <button
        type="button"
        onClick={onAdd}
        className="absolute left-0 top-3 grid place-items-center rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-400 transition-[transform,border-color,color] duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)] hover:border-slate-500 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        style={{ width: CARD_W, height: CARD_H, transform: `translateX(${slot}px)` }}
      >
        <span className="flex flex-col items-center gap-1.5 text-xs font-semibold">
          <PlusMark className="size-5" />
          Add card
        </span>
      </button>
    </div>
  );
}

// A rule's card, face up, as the Sandbox's cards are: white, edged in its deck's colour, the
// shares it trades in two corners (its "rank") over a fish (its "suit"); in its middle the
// mark of what it does, whether it buys or sells, its name, and how many conditions it has (or that it
// is unfinished). Being edited, it stands proud, ringed and tagged "Editing".
function RuleCardFace({ rule, n, color, on }: { rule: Rule; n: number; color: string; on: boolean }) {
  const rank = wholeShares(rule.shares) ? Number(rule.shares).toLocaleString("en-CA") : "?";
  const corner = (flip?: boolean) => (
    <span
      className={`absolute flex flex-col items-center leading-none ${flip ? "bottom-1.5 right-1.5 rotate-180" : "left-1.5 top-1.5"}`}
    >
      <span className="text-base font-bold tabular-nums text-slate-900">{rank}</span>
      <Fish color={color} className="mt-0.5 h-3 w-[18px]" />
    </span>
  );
  const count = rule.conditions.length;
  return (
    <span
      className={`relative block size-full rounded-xl transition-[box-shadow,translate] duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)] ${
        on ? "-translate-y-2 shadow-xl ring-2 ring-slate-900 ring-offset-2" : ""
      }`}
    >
      <span
        className="absolute inset-0 rounded-xl border-[2.5px] bg-white shadow-md transition-[border-color] duration-500 ease-[ease]"
        style={{ borderColor: color }}
      >
        {corner()}
        {corner(true)}
        <span className="flex size-full flex-col items-center justify-center gap-1 px-5 text-center">
          {/* What it does: an arrow dropping into a box to buy, rising out of it to sell (as the
              Sandbox's buy and sell buttons have), moving as the card is pointed at. */}
          <span
            className="grid size-7 place-items-center rounded-lg text-white ring-1 ring-black/5 transition-[background-color] duration-500 ease-[ease]"
            style={{ backgroundColor: color }}
          >
            {rule.side === "buy" ? <BuyMark className="size-4" /> : <SellMark className="size-4" />}
          </span>
          <span
            className={`rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${
              rule.side === "buy" ? "bg-slate-900 text-white" : "border border-slate-900 text-slate-900"
            }`}
          >
            {rule.side}
          </span>
          <span className="line-clamp-2 w-full text-[11px] font-semibold leading-tight text-slate-800">
            {ruleName(rule, n)}
          </span>
          <span
            className={`text-[10px] leading-snug ${complete(rule) ? "text-slate-500" : "italic text-slate-400"}`}
          >
            {complete(rule) ? `${count} ${count === 1 ? "condition" : "conditions"}` : "Unfinished"}
          </span>
        </span>
      </span>
      {/* Being edited: tagged on its top edge, as the Sandbox's card being traded is. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white shadow transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.3,1.25,0.5,1)] ${
          on ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        Editing
      </span>
    </span>
  );
}

// The editor of the card chosen: its name, its conditions (each with a line saying what its
// measure is), and how many shares to buy or sell.
function RuleEditor({
  n,
  rule,
  removable,
  onRemove,
  onRule,
  onCondition,
  onAddCondition,
  onRemoveCondition,
}: {
  n: number;
  rule: Rule;
  removable: boolean;
  onRemove: () => void;
  onRule: (change: Partial<Rule>) => void;
  onCondition: (id: number, change: Partial<Condition>) => void;
  onAddCondition: () => void;
  onRemoveCondition: (id: number) => void;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-2xl bg-white p-6 shadow">
      <div className="flex items-center justify-between gap-4">
        <h2 id={id} className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Editing card {n}
          </span>
          <input
            aria-label={`Card ${n}'s name`}
            value={rule.name}
            onChange={(e) => onRule({ name: e.target.value })}
            placeholder="Name it (optional)"
            className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-0.5 font-semibold text-slate-900 transition-colors placeholder:font-normal placeholder:text-slate-400 hover:border-slate-200 focus:border-slate-900 focus:outline-none"
          />
        </h2>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Remove card
          </button>
        )}
      </div>

      {/* When: every condition must hold. */}
      <p className={`mt-4 ${LABEL}`}>When</p>
      <div className="mt-2 space-y-3">
        {rule.conditions.map((c, i) => {
          const info = METRICS[c.metric];
          return (
            <div key={c.id} className="rise-in" style={{ animationDuration: "500ms" }}>
              <div className="flex flex-wrap items-center gap-2">
                {/* "and" before each condition after the first: on its own line on a phone, in a
                    column to the left on a wider screen. */}
                <span
                  className={`text-xs font-semibold text-slate-400 sm:block sm:w-9 ${i === 0 ? "hidden" : "basis-full sm:basis-auto"}`}
                >
                  {i === 0 ? "" : "and"}
                </span>
                <select
                  aria-label="Measure"
                  value={c.metric}
                  onChange={(e) => onCondition(c.id, { metric: e.target.value as Metric })}
                  className={`${FIELD} w-full sm:w-auto`}
                >
                  {GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                      {(Object.keys(METRICS) as Metric[])
                        .filter((m) => METRICS[m].group === g)
                        .map((m) => (
                          <option key={m} value={m}>
                            {METRICS[m].label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <select
                  aria-label="Comparison"
                  value={c.op}
                  onChange={(e) => onCondition(c.id, { op: e.target.value as Op })}
                  className={FIELD}
                >
                  <option value="above">is above</option>
                  <option value="below">is below</option>
                </select>
                <span className="flex items-center gap-1">
                  {info.unit === "$" && <span className="text-sm text-slate-500">$</span>}
                  <input
                    aria-label="Value"
                    inputMode="decimal"
                    value={c.value}
                    onChange={(e) => onCondition(c.id, { value: e.target.value })}
                    placeholder="0"
                    className={`${FIELD} w-24 tabular-nums`}
                  />
                  {info.unit !== "$" && <span className="text-sm text-slate-500">{info.unit}</span>}
                </span>
                {rule.conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveCondition(c.id)}
                    aria-label="Remove condition"
                    className="rounded px-1.5 text-lg leading-none text-slate-400 hover:text-slate-900"
                  >
                    ×
                  </button>
                )}
              </div>
              {/* What the measure is. */}
              <p key={c.metric} className="text-fade-in mt-1 text-xs text-slate-500 sm:ml-11">
                {info.hint}
              </p>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={onAddCondition} className={`${LIGHT_BUTTON} mt-3 sm:ml-11`}>
        <PlusMark />
        Add condition
      </button>

      {/* Then: buy or sell a number of shares. */}
      <p className={`mt-5 ${LABEL}`}>Then</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="hidden w-9 sm:block" />
        <div role="group" aria-label="Buy or sell" className="flex rounded-lg bg-slate-100 p-0.5">
          {(["buy", "sell"] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={rule.side === side}
              onClick={() => onRule({ side })}
              className={`rounded-md px-3 py-1 text-sm font-semibold capitalize transition ${
                rule.side === side
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {side}
            </button>
          ))}
        </div>
        <input
          aria-label="Number of shares"
          inputMode="numeric"
          value={rule.shares}
          onChange={(e) => onRule({ shares: e.target.value })}
          placeholder="0"
          className={`${FIELD} w-24 tabular-nums`}
        />
        <span className="text-sm text-slate-600">shares</span>
      </div>
    </section>
  );
}

function PlusMark({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`${className} stroke-current`}
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}
