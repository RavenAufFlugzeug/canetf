"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isPaletteName, paletteColor, PalettePicker, type PaletteName } from "@/components/EtfBreakdown";
import SearchBox from "@/components/SearchBox";
import SlideTabs from "@/components/SlideTabs";
import { ChevronDownIcon } from "@/components/Icons";
import DeckBack, { Suit } from "@/components/DeckBack";
import {
  AmountMark,
  BuyMark,
  MonthMark,
  MoveMark,
  PauseMark,
  PotMark,
  SellMark,
  SplitMark,
  StopMark,
} from "@/components/TestMarks";
import {
  actionDone,
  actionOf,
  complete,
  EMPTY_PLAN,
  METRICS,
  num,
  positive,
  STORE,
  wholeShares,
  type Action,
  type Check,
  type Condition,
  type Limit,
  type Metric,
  type Op,
  type Phase,
  type Plan,
  type Rule,
  type Saved,
  type Strategy,
} from "@/lib/strategy";
import { button, field, LABEL as UI_LABEL, PANEL_TITLE, REMOVE_ARMED, REMOVE_BUTTON, CARD_COMPACT, FOCUS_RING, TAG, TAG_SHAPE, CARD_SLOT } from "@/lib/ui";

// The Strategies page's builder (app/strategy/page.tsx), in the Sandbox's cards. Each strategy
// is a deck: on the shelf at the top, the decks kept, face down (DeckBack, in the design chosen on the account page) in their
// colour (one of the Search charts' four), each with its name and how many cards it holds;
// clicking one opens it. A strategy says what it
// applies to (every firm in a sector, every ETF, or one firm or ETF), and each of its rules is
// a card, dealt face up in a row: the shares it trades in its corners (as a playing card's
// rank), whether it buys or sells, its name and how many conditions it has. Clicking a card
// lifts it (tagged "Editing") and brings up its editor below: its conditions on the market or
// on what is held, all of which must hold, and how many shares to buy or sell. A new card is
// dealt in at the end of the row. The open deck is written out in plain words beside it. The
// first deck is an example for tech firms; the decks are kept in this browser.
//
// A deck can also say how money comes in and is kept (its plan): a monthly amount, a cash
// reserve kept for emergencies, an opportunity pot set aside from each month's money, what is
// done with dividends, how many years it is actively built before it is simply held, and how
// far back its averages look. A card can then be checked each day, month, quarter or year, at
// most once in a while, in the building or the holding years, with all or any of its
// conditions, and do more than buy or sell shares: buy an amount, buy with the month's money or
// the pot, move part of a holding to another fund, send part of new money to one, or pause or
// stop buying. The dividend example (after a course paper) uses all of these.


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
const GROUPS = [...new Set(Object.values(METRICS).map((m) => m.group))];

const OLD_STORE = "canetf-strategy-draft-v2";
// Set once the dividend example (the course paper's strategy) has been dealt onto the shelf,
// so it is added once only: deleted, it stays gone (the shelf's tile adds it again).
const DIVIDEND_ADDED = "canetf-strategy-dividend-added-v3";

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


// The dividend example, after a course paper, kept simple: a new graduate puts $100–$500 into
// dividend ETFs each month (whichever looks best: in the Sandbox, the one with the best outlook), keeps $300 in cash
// for emergencies, and saves 10% of the rest in a pot to buy more when the fund is cheap (its
// yield well above usual, or the Canadian dollar strong). Built for 5 years, then held, adding a
// second fund. A dividend cut pauses buying; still cut a year on, half moves to a similar fund;
// a new tax on foreign holdings stops buying.
function dividendExample(): Strategy {
  return newDeck({
    name: "New grad dividends",
    scope: "etfs",
    palette: "green",
    plan: {
      monthlyMin: "100",
      monthlyMax: "500",
      reserve: "300",
      pot: "10",
      emergencyEvery: "6",
      emergencyMin: "100",
      emergencyMax: "300",
      dividends: "reinvest",
      buildYears: "5",
      averagesFrom: "2022",
      averagesYears: "5",
      noDebt: true,
    },
    rules: [
      newRule({ name: "Invest every month", conditions: [], action: "buyMonthly", check: "month" }),
      newRule({
        name: "Buy more when it's cheap",
        match: "any",
        conditions: [
          newCondition({ metric: "yieldVsAvg", op: "above", value: "15" }),
          newCondition({ metric: "cadVsAvg", op: "above", value: "7" }),
        ],
        action: "buyPot",
        check: "month",
        limit: "quarter",
        phase: "build",
      }),
      newRule({
        name: "Don't leave the pot idle",
        conditions: [newCondition({ metric: "quietQuarters", op: "atLeast", value: "4" })],
        action: "buyPot",
        check: "quarter",
        phase: "build",
      }),
      newRule({
        name: "Dividend cut: wait",
        conditions: [newCondition({ metric: "dividendChange", op: "below", value: "-20", lasting: "2" })],
        action: "pause",
        amount: "12",
        check: "quarter",
      }),
      newRule({
        name: "Still cut: switch half",
        conditions: [
          newCondition({ metric: "pausedMonths", op: "atLeast", value: "12" }),
          newCondition({ metric: "dividendChange", op: "below", value: "-20" }),
        ],
        action: "move",
        amount: "50",
        target: "a similar ETF",
        check: "quarter",
      }),
      newRule({
        name: "New tax: stop buying",
        conditions: [newCondition({ metric: "policyChange", op: "above", value: "" })],
        action: "stop",
        check: "quarter",
      }),
      newRule({
        name: "Add a second fund",
        conditions: [newCondition({ metric: "funds", op: "below", value: "2" })],
        action: "split",
        amount: "50",
        target: "a broader fund",
        check: "year",
        phase: "hold",
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

const dollars = (n: number) => `$${n.toLocaleString("en-CA", { maximumFractionDigits: 2 })}`;
const range = (a: number | null, b: number | null) =>
  a !== null && b !== null && a !== b ? `${dollars(Math.min(a, b))}–${dollars(Math.max(a, b))}` : dollars((a ?? b)!);
const buildYears = (s: Strategy) => {
  const n = num(s.plan?.buildYears);
  return n !== null && n > 0 ? Math.round(n) : null;
};

function valueText(metric: Metric, value: string) {
  const n = Number(value);
  const unit = METRICS[metric].unit;
  if (unit === "$")
    return `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (unit === "shares") return `${n.toLocaleString("en-CA")} ${n === 1 ? "share" : "shares"}`;
  if (unit === "funds" || unit === "quarters" || unit === "months")
    return `${n.toLocaleString("en-CA")} ${n === 1 ? unit.slice(0, -1) : unit}`;
  if (unit === "pts") return `${n.toLocaleString("en-CA", { maximumFractionDigits: 2 }).replace("-", "−")} points`;
  return `${n.toLocaleString("en-CA", { maximumFractionDigits: 2 }).replace("-", "−")}%`;
}

// What the strategy applies to, in words, and how a rule's shares are said of it.
function scopeText(s: Strategy) {
  if (s.scope === "sector") return `every ${s.sector.toLowerCase()} firm, each on its own`;
  if (s.scope === "etfs") return "every ETF, each on its own";
  return s.symbol ? s.symbol : "the firm or ETF you choose";
}
const ofWhat = (s: Strategy) => (s.scope === "single" ? (s.symbol ? ` of ${s.symbol}` : "") : " of it");

const OP_TEXT: Record<Op, string> = { above: "over", below: "under", atLeast: "at least", atMost: "at most" };

// What each measure is called in a card's words: short, as one would say it.
const SUBJECT: Record<Metric, string> = {
  price: "the price",
  dayChange: "today's move",
  weekChange: "the 5-day move",
  monthChange: "the 1-month move",
  yearChange: "the 1-year move",
  vsAvg50: "the price vs its 50-day average",
  vsAvg200: "the price vs its 200-day average",
  fromHigh: "the price vs its 52-week high",
  fromLow: "the price vs its 52-week low",
  yieldVsAvg: "the dividend yield vs usual",
  dividendChange: "the dividend vs a year ago",
  spreadVsAvg: "the yield's lead over bonds vs usual",
  cadVsAvg: "the Canadian dollar vs usual",
  navDiscount: "the discount to its holdings' value",
  feeChange: "the fund's fee change",
  policyChange: "a new tax or limit on foreign holdings",
  gain: "your gain",
  held: "shares held",
  funds: "funds held",
  quietQuarters: "quarters since the pot was used",
  pausedMonths: "months buying has been paused",
};

// Counts read better said their own way ("the pot hasn't been used for at least 4 quarters").
const COUNT_OP: Record<Op, string> = { above: "more than", below: "fewer than", atLeast: "at least", atMost: "at most" };
const COUNTS: Partial<Record<Metric, (count: string) => string>> = {
  quietQuarters: (n) => `the pot hasn't been used for ${n} quarters`,
  pausedMonths: (n) => `buying has been paused for ${n} months`,
  funds: (n) => `you hold ${n} funds`,
  held: (n) => `you hold ${n} shares`,
};

function conditionText(c: Condition) {
  const info = METRICS[c.metric];
  if (info.unit === "event") return SUBJECT[c.metric];
  const count = COUNTS[c.metric];
  if (count) return count(`${COUNT_OP[c.op]} ${Number(c.value).toLocaleString("en-CA")}`);
  const n = Number(c.lasting);
  const lasting =
    info.span && positive(c.lasting)
      ? ` for ${n} ${n === 1 ? info.span.slice(0, -1) : info.span} in a row`
      : "";
  return `${SUBJECT[c.metric]} is ${OP_TEXT[c.op]} ${valueText(c.metric, c.value)}${lasting}`;
}

// What a card does, in words.
function actionText(rule: Rule, s: Strategy) {
  const n = Number(rule.shares);
  const amount = Number(rule.amount);
  const what = s.scope === "single" && s.symbol ? s.symbol : "it";
  switch (actionOf(rule)) {
    case "buy":
    case "sell":
      return `${actionOf(rule)} ${n.toLocaleString("en-CA")} ${n === 1 ? "share" : "shares"}${ofWhat(s)}`;
    case "buyAmount":
      return `buy ${dollars(amount)}${ofWhat(s)}`;
    case "buyMonthly":
      return `buy ${what} with this month's money`;
    case "buyPot":
      return `buy ${what} with the pot`;
    case "move":
      return amount >= 100
        ? `move all of ${what} to ${rule.target?.trim()}`
        : `move ${amount}% of ${what} to ${rule.target?.trim()}`;
    case "split":
      return `send ${amount}% of new money to ${rule.target?.trim()}`;
    case "pause":
      return `pause buying for ${amount} ${amount === 1 ? "month" : "months"}`;
    case "stop":
      return "stop buying";
  }
}

const CHECK_TEXT: Record<Check, string> = { day: "Every day", month: "Every month", quarter: "Every quarter", year: "Every year" };
const LIMIT_TEXT: Record<Limit, string> = { none: "", month: "a month", quarter: "a quarter", year: "a year" };

// The years a card is in force, in words ("years 1–5", "from year 6"), or "".
function phaseText(rule: Rule, s: Strategy) {
  const years = buildYears(s);
  if (!years || !rule.phase || rule.phase === "always") return "";
  return rule.phase === "build" ? `years 1–${years}` : `from year ${years + 1}`;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// A rule in plain words, in three parts: how often it is looked at (and in which years, and at
// most how often it acts), when it acts, and what it does; or null while it is missing a figure.
function ruleParts(rule: Rule, s: Strategy) {
  if (!complete(rule)) return null;
  const timing = [
    CHECK_TEXT[rule.check ?? "day"],
    phaseText(rule, s),
    rule.limit && rule.limit !== "none" ? `at most once ${LIMIT_TEXT[rule.limit]}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const when = rule.conditions.map(conditionText).join(rule.match === "any" ? ", or " : ", and ");
  return { timing, when: when ? capital(when) : null, then: capital(actionText(rule, s)) };
}

// The plan in plain words: a short line for each part set, in the order money moves.
function planTexts(s: Strategy) {
  const p = s.plan;
  if (!p) return [];
  const out: string[] = [];
  if (p.noDebt) out.push("Starts once high-interest debt is paid off.");
  const lo = num(p.monthlyMin);
  const hi = num(p.monthlyMax);
  const reserve = num(p.reserve);
  const pot = num(p.pot);
  if (lo !== null || hi !== null) out.push(`Adds ${range(lo, hi)} a month.`);
  if (reserve) out.push(`Keeps ${dollars(reserve)} in cash for emergencies, topped up first.`);
  if (pot) out.push(`Saves ${pot}% of the rest in a pot for extra buys.`);
  const every = num(p.emergencyEvery);
  const eLo = num(p.emergencyMin);
  const eHi = num(p.emergencyMax);
  if (every && (eLo !== null || eHi !== null))
    out.push(`Emergencies (${range(eLo, eHi)}, every ${every} ${every === 1 ? "month" : "months"}) are paid from cash, never by selling.`);
  out.push(p.dividends === "reinvest" ? "Reinvests dividends." : "Takes dividends as cash.");
  const years = buildYears(s);
  if (years) out.push(`Builds for ${years} ${years === 1 ? "year" : "years"}, then just holds.`);
  const from = num(p.averagesFrom);
  const back = num(p.averagesYears);
  if (from || back)
    out.push(
      `"Usual" means the average${from ? ` since ${from}` : ""}${back ? `, at most ${back} ${back === 1 ? "year" : "years"} back` : ""}.`,
    );
  return out;
}

const ruleName = (r: Rule, i: number) => r.name.trim() || `Card ${i + 1}`;

// The site's fields and labels (lib/ui.ts).
const FIELD = field("sm");
const LABEL = UI_LABEL;
const LIGHT_BUTTON = `gap-1.5 ${button("secondary", "xs")}`;

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
        // The dividend example, added to the shelf and opened, the first time (in place of the
        // longer one it once was, if that is there).
        if (!localStorage.getItem(DIVIDEND_ADDED)) {
          localStorage.setItem(DIVIDEND_ADDED, "1");
          const deck = dividendExample();
          setSaved((s) => {
            const at = s.decks.findIndex((d) => d.name === deck.name);
            const decks = at < 0 ? [...s.decks, deck] : s.decks.map((d, i) => (i === at ? deck : d));
            return { decks, open: deck.id, editing: { ...s.editing, [deck.id]: deck.rules[0].id } };
          });
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
  const setPlan = (change: Partial<Plan>) =>
    setDeck((d) => ({ ...d, plan: { ...EMPTY_PLAN, ...d.plan, ...change } }));
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
  const texts = deck.rules.map((r) => ruleParts(r, deck));

  return (
    <div className="space-y-6">
      {/* The shelf: every deck kept, and room for a new one. (Above the panels under it, so the
          examples' menu drops over them.) */}
      <section className={`rise-in relative z-20 ${CARD_COMPACT}`}>
        <p className={`${PANEL_TITLE}`}>
          Your decks · {saved.decks.length}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-5">
          {saved.decks.map((d) => (
            <DeckPile key={d.id} deck={d} open={d.id === deck.id} onOpen={() => openDeck(d.id)} />
          ))}
          {/* Room for another: a blank deck, or one of the examples (from a menu). */}
          <NewDeckTile label="New deck" onClick={() => addDeck(newDeck())} />
          <ExamplesTile onAdd={addDeck} />
        </div>
      </section>

      {/* The deck open: swapping in as another is opened. */}
      <div
        key={deck.id}
        className="sandbox-swap-in grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"
      >
        <div className="space-y-4">
          {/* Its name, and what it applies to. */}
          <div className={CARD_COMPACT}>
            {/* Its name and its colour side by side; deleting it in the corner, as removing a
                card is in the card's editor. */}
            <div className="flex items-start gap-4">
              <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-6 gap-y-4">
                <label className={`flex min-w-48 flex-1 flex-col gap-1.5 ${LABEL}`}>
                  Strategy name
                  <input
                    value={deck.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="e.g. Tech dip buyer"
                    className={`${FIELD} normal-case tracking-normal`}
                  />
                </label>
                {/* Its colour: one of the families the Search page's charts are coloured in,
                    chosen the same way (with its diamonds), level with the name's field. */}
                <div className="flex flex-col gap-1.5">
                  <p className={LABEL}>Deck colour</p>
                  <div className="flex h-[34px] items-center">
                    <PalettePicker
                      label="Deck colour"
                      current={deckPalette(deck)}
                      onPick={(palette) => set({ palette })}
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => (deleting ? removeDeck() : setDeleting(true))}
                onBlur={() => setDeleting(false)}
                className={`-mt-1 shrink-0 ${REMOVE_BUTTON} ${deleting ? REMOVE_ARMED : ""}`}
              >
                {deleting ? "Click again to delete" : "Delete deck"}
              </button>
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
            <div key={deck.scope} className={deck.scope === "etfs" ? undefined : "text-fade-in mt-3"}>
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
                </label>
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
                    placeholders={{ symbol: "e.g. NVDA or XEQT.TO", name: "e.g. Shopify" }}
                    onChoose={async (symbol) => set({ symbol })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* How money comes in and is kept. */}
          <PlanEditor plan={{ ...EMPTY_PLAN, ...deck.plan }} onPlan={setPlan} />

          {/* Its cards, one per rule, and under them, the one being edited: one panel, as one
              chooses what the other edits. */}
          <div className={CARD_COMPACT}>
            <p className={PANEL_TITLE}>Cards · {deck.rules.length}</p>
            <Hand rules={deck.rules} editing={rule.id} color={color} onEdit={edit} onAdd={addCard} />

            {/* The card being edited, sliding in from its side as another is chosen. */}
            <div
              key={rule.id}
              className="pick-swap-in mt-6 border-t border-slate-100 pt-6"
              style={{ "--dir": dir } as React.CSSProperties}
            >
              <RuleEditor
                n={at + 1}
                rule={rule}
                phases={buildYears(deck)}
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
        </div>

        {/* The deck in plain words, kept in view beside it; a card's words choose it too. */}
        <aside className={`${CARD_COMPACT} lg:sticky lg:top-28`}>
          <p className="text-base font-semibold text-slate-900">
            {deck.name.trim() || "Untitled strategy"}
          </p>
          <p key={scopeText(deck)} className="text-fade-in mt-1 text-sm text-slate-600">
            Applies to {scopeText(deck)}.
          </p>
          {planTexts(deck).length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {planTexts(deck).map((t) => (
                <li key={t} className="text-fade-in">
                  {t}
                </li>
              ))}
            </ul>
          )}
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
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                        on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">{ruleName(r, i)}</span>
                      {text ? (
                        <span key={JSON.stringify(text)} className="text-fade-in block">
                          <span className="block text-xs text-slate-500">{text.timing}</span>
                          {text.when && (
                            <span className="mt-1 block">
                              <span className="font-semibold text-slate-900">When </span>
                              {text.when}
                            </span>
                          )}
                          <span className="mt-0.5 block">
                            <span className="font-semibold text-slate-900">Then </span>
                            {text.then}
                          </span>
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

const DIVIDENDS = [
  { value: "reinvest", label: "Reinvest" },
  { value: "cash", label: "Take as cash" },
] as const;

const MATCHES = [
  { value: "all", label: "All must hold" },
  { value: "any", label: "Any can hold" },
] as const;

// The actions, in the menu: buying, then moving money elsewhere, then holding back.
const ACTIONS: { group: string; options: [Action, string][] }[] = [
  {
    group: "Buy and sell",
    options: [
      ["buy", "Buy shares"],
      ["sell", "Sell shares"],
      ["buyAmount", "Buy an amount"],
      ["buyMonthly", "Buy with the month's money"],
      ["buyPot", "Buy with the pot"],
    ],
  },
  {
    group: "Another fund",
    options: [
      ["move", "Move part to another fund"],
      ["split", "Send part of new money to another fund"],
    ],
  },
  {
    group: "Hold back",
    options: [
      ["pause", "Pause buying"],
      ["stop", "Stop buying"],
    ],
  },
];

// Each action's mark on its card: shares bought into or sold out of a box, a coin for an
// amount, a calendar for the month's money, a jar for the pot, an arrow across to another fund,
// a forking arrow for sending part elsewhere, a pause, a stop sign.
const ACTION_MARKS: Record<Action, (props: { className?: string }) => React.ReactNode> = {
  buy: BuyMark,
  sell: SellMark,
  buyAmount: AmountMark,
  buyMonthly: MonthMark,
  buyPot: PotMark,
  move: MoveMark,
  split: SplitMark,
  pause: PauseMark,
  stop: StopMark,
};
function ActionMark({ action }: { action: Action }) {
  const Mark = ACTION_MARKS[action];
  return <Mark className="size-4" />;
}

// What a card's corners show (its "rank"), and the tag in its middle.
function rankText(r: Rule) {
  const a = actionOf(r);
  if (a === "buy" || a === "sell") return wholeShares(r.shares) ? Number(r.shares).toLocaleString("en-CA") : "?";
  if (!actionDone(r)) return "?";
  if (a === "buyAmount") return `$${Number(r.amount).toLocaleString("en-CA", { notation: "compact" })}`;
  if (a === "move" || a === "split") return `${Number(r.amount)}%`;
  if (a === "pause") return `${Number(r.amount)}m`;
  if (a === "buyMonthly") return "M";
  if (a === "buyPot") return "P";
  return "×";
}
const TAG_WORD: Record<Action, string> = {
  buy: "buy",
  sell: "sell",
  buyAmount: "buy",
  buyMonthly: "buy",
  buyPot: "buy",
  move: "move",
  split: "split",
  pause: "pause",
  stop: "stop",
};
const buying = (a: Action) => a === "buy" || a === "buyAmount" || a === "buyMonthly" || a === "buyPot" || a === "split";

// A deck on the shelf: up to three card backs in its colour (the cat hiding behind a cup of
// coffee, surprised when the deck is pointed at, happy when it is clicked), stacked a little askew, the top one lifting
// when pointed at; under it, its name and how many cards it holds. The one open is
// ringed and tagged "Open".
function DeckPile({ deck, open, onOpen }: { deck: Strategy; open: boolean; onOpen: () => void }) {
  const color = deckColor(deck);
  const layers = Math.min(deck.rules.length, 3);
  const cards = `${deck.rules.length} ${deck.rules.length === 1 ? "card" : "cards"}`;
  // Clicked, the cat on its cards is happy until the pointer leaves it.
  const [happy, setHappy] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onOpen();
        setHappy(true);
      }}
      data-happy={happy || undefined}
      onPointerLeave={() => setHappy(false)}
      aria-pressed={open}
      aria-label={`${deck.name.trim() || "Untitled strategy"}: ${cards}`}
      className="deck-pile group flex w-36 flex-col items-center gap-2 focus-visible:outline-none"
    >
      <span className="relative block" style={{ width: DECK_W, height: DECK_H }}>
        {Array.from({ length: layers }, (_, k) => layers - 1 - k).map((depth) => (
          <span
            key={depth}
            className="absolute inset-0"
            style={{ transform: `translate(${depth * 2.5}px, ${depth * 2.5}px) rotate(${depth * 1.5}deg)` }}
          >
            <span
              className={`absolute inset-0 rounded-xl transition-[translate,rotate,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                depth === 0
                  ? "motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:-rotate-2"
                  : ""
              } ${depth === 0 && open ? "ring-2 ring-slate-900 ring-offset-2" : ""} ${
                depth === 0
                  ? "group-focus-visible:ring-2 group-focus-visible:ring-slate-400 group-focus-visible:ring-offset-2"
                  : ""
              }`}
            >
              <DeckBack color={color} />
            </span>
          </span>
        ))}
        <span
          aria-hidden
          className={`pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 ${TAG} shadow transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.3,1.25,0.5,1)] ${
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
            aria-label={`${ruleName(r, i)}: ${TAG_WORD[actionOf(r)]} ${rankText(r)}. ${on ? "Editing" : "Click to edit"}`}
            className={`group absolute left-0 top-3 rounded-xl transition-transform duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)] ${FOCUS_RING}`}
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
        className={`absolute left-0 top-3 ${CARD_SLOT} transition-[transform,border-color,color] duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)] hover:border-slate-500 hover:text-slate-700 ${FOCUS_RING}`}
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
// shares it trades in two corners (its "rank") over its suit (a fish or clover, as the chosen back has); in its middle the
// mark of what it does, whether it buys or sells, its name, and how many conditions it has (or that it
// is unfinished). Being edited, it stands proud, ringed and tagged "Editing".
function RuleCardFace({ rule, n, color, on }: { rule: Rule; n: number; color: string; on: boolean }) {
  const rank = rankText(rule);
  const action = actionOf(rule);
  const corner = (flip?: boolean) => (
    <span
      className={`absolute flex flex-col items-center leading-none ${flip ? "bottom-1.5 right-1.5 rotate-180" : "left-1.5 top-1.5"}`}
    >
      <span className="text-base font-bold tabular-nums text-slate-900">{rank}</span>
      <Suit color={color} />
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
            <ActionMark action={action} />
          </span>
          <span
            className={`${TAG_SHAPE} ${
              buying(action) ? "bg-slate-900 text-white" : "border border-slate-900 text-slate-900"
            }`}
          >
            {TAG_WORD[action]}
          </span>
          <span className="line-clamp-2 w-full text-[11px] font-semibold leading-tight text-slate-800">
            {ruleName(rule, n)}
          </span>
          <span
            className={`text-[10px] leading-snug ${complete(rule) ? "text-slate-500" : "italic text-slate-400"}`}
          >
            {!complete(rule)
              ? "Unfinished"
              : count === 0
                ? `Every ${rule.check && rule.check !== "day" ? rule.check : "day"}`
                : `${rule.match === "any" && count > 1 ? "Any of " : ""}${count} ${count === 1 ? "condition" : "conditions"}`}
          </span>
        </span>
      </span>
      {/* Being edited: tagged on its top edge, as the Sandbox's card being traded is. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 ${TAG} shadow transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.3,1.25,0.5,1)] ${
          on ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        Editing
      </span>
    </span>
  );
}

// The editor of the card chosen: its name; when it is checked (and at most how often, and in
// which years, once the plan has building years); its conditions, all or any of which must
// hold; and what it does.
function RuleEditor({
  n,
  rule,
  phases,
  removable,
  onRemove,
  onRule,
  onCondition,
  onAddCondition,
  onRemoveCondition,
}: {
  n: number;
  rule: Rule;
  phases: number | null;
  removable: boolean;
  onRemove: () => void;
  onRule: (change: Partial<Rule>) => void;
  onCondition: (id: number, change: Partial<Condition>) => void;
  onAddCondition: () => void;
  onRemoveCondition: (id: number) => void;
}) {
  const id = useId();
  const action = actionOf(rule);
  return (
    <section aria-labelledby={id}>
      <div className="flex items-center justify-between gap-4">
        <h2 id={id} className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-slate-900">
          <span className={TAG}>
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
            className={`shrink-0 ${REMOVE_BUTTON}`}
          >
            Remove card
          </button>
        )}
      </div>

      {/* When: how often it is checked, how often at most it acts, in which years; then its
          conditions, all (or any) of which must hold. */}
      <p className={`mt-4 ${LABEL}`}>When</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="hidden w-9 sm:block" />
        <select
          aria-label="Checked"
          value={rule.check ?? "day"}
          onChange={(e) => onRule({ check: e.target.value as Check })}
          className={FIELD}
        >
          <option value="day">Checked each day</option>
          <option value="month">Checked each month</option>
          <option value="quarter">Checked each quarter</option>
          <option value="year">Checked each year</option>
        </select>
        <select
          aria-label="At most"
          value={rule.limit ?? "none"}
          onChange={(e) => onRule({ limit: e.target.value as Limit })}
          className={FIELD}
        >
          <option value="none">Any number of times</option>
          <option value="month">At most once a month</option>
          <option value="quarter">At most once a quarter</option>
          <option value="year">At most once a year</option>
        </select>
        {phases && (
          <select
            aria-label="In which years"
            value={rule.phase ?? "always"}
            onChange={(e) => onRule({ phase: e.target.value as Phase })}
            className={FIELD}
          >
            <option value="always">All years</option>
            <option value="build">Years 1–{phases}</option>
            <option value="hold">From year {phases + 1}</option>
          </select>
        )}
      </div>
      <div className="mt-3 space-y-3">
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
                  {i === 0 ? "" : rule.match === "any" ? "or" : "and"}
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
                {/* (An event has no figure: it happens or not.) */}
                {info.unit !== "event" && (
                  <>
                    <select
                      aria-label="Comparison"
                      value={c.op}
                      onChange={(e) => onCondition(c.id, { op: e.target.value as Op })}
                      className={FIELD}
                    >
                      <option value="above">is above</option>
                      <option value="below">is below</option>
                      <option value="atLeast">is at least</option>
                      <option value="atMost">is at most</option>
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
                      {/* Always as wide as the longest unit, so each row's Remove lines up with
                          the others'. */}
                      <span className="w-16 text-sm text-slate-500">{info.unit !== "$" ? info.unit : ""}</span>
                    </span>
                    {/* Kept up over time: how many months or payouts in a row (optional). */}
                    {info.span && (
                      <span className="flex items-center gap-1.5 text-sm text-slate-500">
                        for
                        <input
                          aria-label={`For how many ${info.span} in a row`}
                          inputMode="numeric"
                          value={c.lasting ?? ""}
                          onChange={(e) => onCondition(c.id, { lasting: e.target.value })}
                          placeholder="1"
                          className={`${FIELD} w-16 tabular-nums`}
                        />
                        {info.span} in a row
                      </span>
                    )}
                  </>
                )}
                {/* (A card with none acts each time it is checked.) */}
                <button
                  type="button"
                  onClick={() => onRemoveCondition(c.id)}
                  aria-label="Remove condition"
                  className={REMOVE_BUTTON}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 sm:ml-11">
        <button type="button" onClick={onAddCondition} className={LIGHT_BUTTON}>
          <PlusMark />
          Add condition
        </button>
        {rule.conditions.length > 1 && (
          <SlideTabs
            label="All or any of the conditions"
            size="xs"
            value={rule.match ?? "all"}
            onChange={(match) => onRule({ match })}
            options={MATCHES}
          />
        )}
      </div>

      {/* Then: what it does, and its figures. */}
      <p className={`mt-5 ${LABEL}`}>Then</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="hidden w-9 sm:block" />
        <select
          aria-label="Action"
          value={action}
          onChange={(e) => {
            const next = e.target.value as Action;
            onRule({ action: next, side: next === "sell" ? "sell" : "buy" });
          }}
          className={FIELD}
        >
          {ACTIONS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {(action === "buy" || action === "sell") && (
          <>
            <input
              aria-label="Number of shares"
              inputMode="numeric"
              value={rule.shares}
              onChange={(e) => onRule({ shares: e.target.value })}
              placeholder="0"
              className={`${FIELD} w-24 tabular-nums`}
            />
            shares
          </>
        )}
        {action === "buyAmount" && (
          <span className="flex items-center gap-1">
            $
            <input
              aria-label="Amount"
              inputMode="decimal"
              value={rule.amount ?? ""}
              onChange={(e) => onRule({ amount: e.target.value })}
              placeholder="0"
              className={`${FIELD} w-24 tabular-nums`}
            />
          </span>
        )}
        {action === "pause" && (
          <>
            for
            <input
              aria-label="Months"
              inputMode="numeric"
              value={rule.amount ?? ""}
              onChange={(e) => onRule({ amount: e.target.value })}
              placeholder="0"
              className={`${FIELD} w-16 tabular-nums`}
            />
            months
          </>
        )}
        {(action === "move" || action === "split") && (
          <>
            <input
              aria-label="Percent"
              inputMode="decimal"
              value={rule.amount ?? ""}
              onChange={(e) => onRule({ amount: e.target.value })}
              placeholder="0"
              className={`${FIELD} w-16 tabular-nums`}
            />
            % to
            <input
              aria-label="Fund"
              value={rule.target ?? ""}
              onChange={(e) => onRule({ target: e.target.value })}
              placeholder="e.g. XEQT.TO"
              className={`${FIELD} w-44`}
            />
          </>
        )}
      </div>
    </section>
  );
}

// The deck's plan for its money: what comes in each month, the cash kept back and the pot set
// aside from it, emergencies, dividends, how long it is built before it is held, and how far
// back its averages look. Each figure left empty is not part of the plan.
function PlanEditor({ plan, onPlan }: { plan: Plan; onPlan: (change: Partial<Plan>) => void }) {
  const figure = (key: keyof Plan, label: string, width = "w-20") => (
    <input
      aria-label={label}
      inputMode="decimal"
      value={plan[key] as string}
      onChange={(e) => onPlan({ [key]: e.target.value })}
      placeholder="–"
      className={`${FIELD} ${width} tabular-nums`}
    />
  );
  // A dollar figure: its sign kept beside its box.
  const money = (key: keyof Plan, label: string, width = "w-20") => (
    <span className="inline-flex items-center gap-1">${figure(key, label, width)}</span>
  );
  const row = "flex flex-wrap items-center gap-2 text-sm text-slate-600";
  return (
    <div className={CARD_COMPACT}>
      <p className={PANEL_TITLE}>Money</p>
      <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <p className={LABEL}>Each month</p>
          <div className={`mt-2 ${row}`}>
            {money("monthlyMin", "Least each month")} to {money("monthlyMax", "Most each month")}
          </div>
        </div>
        <div>
          <p className={LABEL}>Cash reserve</p>
          <div className={`mt-2 ${row}`}>{money("reserve", "Cash reserve")}</div>
        </div>
        <div>
          <p className={LABEL}>Opportunity pot</p>
          <div className={`mt-2 ${row}`}>
            {figure("pot", "Opportunity pot", "w-16")}% of what&apos;s left
          </div>
        </div>
        <div>
          <p className={LABEL}>Emergencies</p>
          <div className={`mt-2 ${row} gap-y-2`}>
            Every {figure("emergencyEvery", "Months between emergencies", "w-14")} months
            <span className="basis-full" />
            {money("emergencyMin", "Least emergency")} to {money("emergencyMax", "Most emergency")}
          </div>
        </div>
        <div>
          <p className={LABEL}>Dividends</p>
          <div className="mt-2 flex">
            <SlideTabs
              label="Dividends"
              value={plan.dividends}
              onChange={(dividends) => onPlan({ dividends })}
              options={DIVIDENDS}
            />
          </div>
        </div>
        <div>
          <p className={LABEL}>Building years</p>
          <div className={`mt-2 ${row}`}>
            {figure("buildYears", "Building years", "w-14")} then hold
          </div>
        </div>
        <div>
          <p className={LABEL}>Averages</p>
          <div className={`mt-2 ${row}`}>
            From {figure("averagesFrom", "Averages from year")} at most
            {figure("averagesYears", "Years back at most", "w-14")} years back
          </div>
        </div>
        <label className={`${row} self-end`}>
          <input
            type="checkbox"
            checked={plan.noDebt}
            onChange={(e) => onPlan({ noDebt: e.target.checked })}
            className="size-4 accent-slate-900"
          />
          Start once high-interest debt is paid off
        </label>
      </div>
    </div>
  );
}

// A dashed space the size of a deck, for adding one, its words under it as a deck's name is.
function NewDeckTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="deck-pile group flex w-36 flex-col items-center gap-2 focus-visible:outline-none"
    >
      <span
        className={`${CARD_SLOT} transition group-hover:border-slate-500 group-hover:text-slate-700 group-focus-visible:border-slate-900`}
        style={{ width: DECK_W, height: DECK_H }}
      >
        <PlusMark className="size-5" />
      </span>
      <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900">{label}</span>
    </button>
  );
}

// The example decks, to add one: a dashed space the size of a deck (as New deck's) whose menu
// drops open under it (as the investment universe's sort menu does), each example with a line
// saying what it does. A click outside or Escape closes it.
const EXAMPLES = [
  { key: "tech", label: "Tech dip buyer", hint: "Buys tech firms on a sharp dip, sells on a gain or a loss", make: techExample },
  {
    key: "dividends",
    label: "New grad dividends",
    hint: "Invests monthly in the best dividend ETF, more when it's cheap",
    make: dividendExample,
  },
];

function ExamplesTile({ onAdd }: { onAdd: (deck: Strategy) => void }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    list.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const choose = (i: number) => {
    onAdd(EXAMPLES[i].make());
    setOpen(false);
  };
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setFocus(0);
          setOpen(!open);
        }}
        className="deck-pile group flex w-36 flex-col items-center gap-2 focus-visible:outline-none"
      >
        <span
          className={`${CARD_SLOT} transition group-hover:border-slate-500 group-hover:text-slate-700 group-focus-visible:border-slate-900 ${
            open ? "border-slate-900 text-slate-900" : ""
          }`}
          style={{ width: DECK_W, height: DECK_H }}
        >
          <PlusMark className="size-5" />
        </span>
        <span
          className={`flex items-center gap-1 text-xs font-semibold group-hover:text-slate-900 ${open ? "text-slate-900" : "text-slate-500"}`}
        >
          Examples
          <ChevronDownIcon className={`size-3 transition duration-300 ease-out ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <ul
        ref={list}
        role="listbox"
        aria-label="Example decks"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "ArrowDown") setFocus((f) => Math.min(EXAMPLES.length - 1, f + 1));
          else if (e.key === "ArrowUp") setFocus((f) => Math.max(0, f - 1));
          else if (e.key === "Enter" || e.key === " ") choose(focus);
          else return;
          e.preventDefault();
        }}
        data-open={open ? "" : undefined}
        className={`sort-menu absolute left-0 top-full z-30 mt-1.5 w-72 origin-top-left rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 outline-none ${
          open ? "" : "pointer-events-none"
        }`}
      >
        {EXAMPLES.map((x, i) => (
          <li
            key={x.key}
            role="option"
            aria-selected={false}
            onPointerEnter={() => setFocus(i)}
            onClick={() => choose(i)}
            className={`sort-option flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 ${
              focus === i ? "bg-slate-100 text-slate-900" : "text-slate-700"
            }`}
            style={{ "--i": i } as React.CSSProperties}
          >
            <PlusMark className="size-3 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold">{x.label}</span>
              <span className="block text-[11px] text-slate-500">{x.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
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
