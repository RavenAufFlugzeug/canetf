// A strategy (lib/strategy.ts) run in the Sandbox's test, one day at a time (components/
// SandboxTest.tsx): given the deck, what the market has shown up to today and what is held, it
// says what to buy and sell today, and why.
//
// What a deck applies to is found among the test's picks: all its ETFs, the firms of a sector,
// or one listing. Where a card buys with money (an amount, the month's money, the pot), it buys
// the pick with the best outlook among those its conditions hold for (outlook: its price's
// change over 6 and 12 months, averaged, plus twice its dividend yield over the past year).
// Cards that buy or sell shares, or move part of a holding, act on each pick on its own.
//
// Money: whatever comes in (the cash when the strategy starts, each month's contribution, the
// dividends if the plan reinvests them) is shared out as the plan says: the pot gets its share,
// and the rest is the month's money. The plan's cash reserve
// and its own monthly amounts aren't played out (the Sandbox's capital is what comes in), nor "averages since" a year (the test's dates are hidden): averages look
// back the plan's number of years (5 if none).
//
// Measures the Sandbox has no data for (the yield over bonds, the discount to the holdings'
// value, fees, policy changes) never hold.

import { kindOf } from "@/lib/sandbox";
import {
  actionOf,
  actionText,
  complete,
  conditionText,
  METRICS,
  num,
  valueText,
  type Condition,
  type Metric,
  type Rule,
  type Strategy,
} from "@/lib/strategy";

// A pick as the strategy sees it: its closes (the days before the test, then Day 1 to today),
// each day's cash dividend per share (else 0) and its currency's rate to CAD (null where none is
// known), all lined up; where Day 1 is among them; and from which day it can be traded.
export type RunPick = {
  symbol: string;
  name: string;
  kind: string;
  currency: string | null;
  offset: number;
  start: number;
  closes: number[];
  dividends: number[];
  rates: (number | null)[];
};

export type RunMarket = {
  day: number;
  picks: RunPick[];
  held: Record<string, { shares: number; cost: number }>;
  cash: number; // all the cash, in CAD at today's rates
};

// What the strategy keeps from day to day: money not yet invested (`fresh`), the pot and the
// reserve (both kept in the cash), the day each card last acted, when the pot was last used,
// a pause (from and until which day) or a stop on buying, and the share of new money sent to a
// second fund.
export type RunState = {
  fresh: number;
  pot: number;
  reserve: number;
  lastFired: Record<number, number>;
  potUsed: number;
  pausedFrom: number | null;
  pausedUntil: number;
  stopped: boolean;
  split: number;
  potClosed: boolean;
};

export type Order = { symbol: string; side: "Bought" | "Sold"; shares: number; why?: Why };

// Why something was done: the card that did it (or the plan), the pick it looked at, how often
// the card checks, whether all or any of its conditions had to hold, and each condition with
// its figure that day and whether it held; and, where a card buys with money and several picks
// qualified, why this one was chosen.
export type Why = {
  card: string;
  // Its place in the deck ("Card 2 of 5"), and what it does, in words.
  number?: number;
  of?: number;
  does?: string;
  pick: string | null;
  check: string | null;
  match: "all" | "any";
  conditions: { text: string; now: string | null; met: boolean }[];
  chosen?: string;
};
// What the strategy says of a day: each thing it did (`acted`, with why), or why it did nothing.
export type Note = { text: string; acted: boolean; why?: Why };

const MONTH = 21;
const QUARTER = 63;
const YEAR = 252;
// (A card checked "once" looks each day until it has acted.)
const PERIOD = { once: 1, day: 1, month: MONTH, quarter: QUARTER, year: YEAR, none: 0 } as const;

// A strategy starting on Day `day`, with nothing shared out yet.
export const startRun = (day: number): RunState => ({
  fresh: 0,
  pot: 0,
  reserve: 0,
  lastFired: {},
  potUsed: day,
  pausedFrom: null,
  pausedUntil: 0,
  stopped: false,
  split: 0,
  potClosed: false,
});

// Money come in, shared out as the plan says: the pot's share (until the pot is closed), the
// rest to invest. (Not the plan's cash reserve: the Sandbox doesn't play it
// out, so here it would only sit idle.)
export function addMoney(deck: Strategy, state: RunState, amount: number): RunState {
  if (amount <= 0) return state;
  const next = { ...state };
  const left = amount;
  const share = state.potClosed ? 0 : (num(deck.plan?.pot) ?? 0) / 100;
  next.pot += left * share;
  next.fresh += left * (1 - share);
  return next;
}

// Whether a deck's building years are over by Day `day` (none set: never).
const holding = (deck: Strategy, day: number) => {
  const years = num(deck.plan?.buildYears);
  return years !== null && years > 0 && day - 1 >= years * YEAR;
};

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const BASIC = ["MiningCompany", "ChemicalCompany", "AgriCompany", "MaterialsCompany"];

// The picks a deck applies to.
function inScope(deck: Strategy, p: { kind: string; symbol: string }) {
  if (deck.scope === "etfs") return p.kind === "ETF";
  if (deck.scope === "single") return p.symbol === deck.symbol;
  if (deck.sector === "Basic Materials") return BASIC.includes(p.kind);
  return p.kind === kindOf({ sector: deck.sector, industry: null, fundFamily: null, category: null });
}

// Whether any of a deck's cards looks on Day `day` (or its building years end then), and the
// next day after `day` that one does: the days between, it has nothing to decide. (A card that
// acts once looks no more once it has, by what the strategy has kept, `state`.)
export function checksOn(deck: Strategy, day: number, state?: RunState) {
  const years = num(deck.plan?.buildYears);
  if (years !== null && years > 0 && day - 1 === years * YEAR) return true;
  return deck.rules.some(
    (r) =>
      complete(r) &&
      (day - 1) % PERIOD[r.check ?? "day"] === 0 &&
      !(r.check === "once" && state?.lastFired[r.id] !== undefined),
  );
}
export function nextCheck(deck: Strategy, day: number, last: number, state?: RunState) {
  for (let d = day + 1; d < last; d++) if (checksOn(deck, d, state)) return d;
  return last;
}

// How many of a deck's cards are missing a figure (they are skipped), and whether any is
// finished (with none, it does nothing).
export const unfinished = (deck: Strategy) => deck.rules.filter((r) => !complete(r)).length;
export const runnable = (deck: Strategy) => deck.rules.some(complete);

// Why a deck has nothing to do among these picks (none of its cards is finished, or none of what
// it applies to is among them), or null.
export function nothingToTrade(deck: Strategy, picks: { kind: string; symbol: string }[]) {
  if (!deck.rules.length) return "It has no cards yet, so it can't do anything. Add some on the Strategies page.";
  if (!runnable(deck))
    return "None of its cards is finished (each is missing a figure), so it can't do anything. Fill them in on the Strategies page.";
  if (picks.some((p) => inScope(deck, p))) return null;
  if (deck.scope === "etfs") return "There are no ETFs in this set for it to trade.";
  if (deck.scope === "single") return `${deck.symbol || "Its listing"} isn't in this set.`;
  return `There are no ${deck.sector.toLowerCase()} firms in this set for it to trade.`;
}

export function decide(deck: Strategy, market: RunMarket, start: RunState) {
  const { day, picks } = market;
  const state: RunState = { ...start, lastFired: { ...start.lastFired } };
  if (state.pausedFrom !== null && day > state.pausedUntil) state.pausedFrom = null;
  const orders: Order[] = [];
  const notes: Note[] = [];
  const say = (text: string, why?: Why) => notes.push({ text, acted: true, why });
  // What is held and the cash, as today's orders change them.
  const held: Record<string, { shares: number; cost: number }> = { ...market.held };
  let cash = market.cash;
  const window = Math.round((num(deck.plan?.averagesYears) ?? 5) * YEAR);

  const listed = (p: RunPick) => day > p.offset;
  const idx = (p: RunPick) => p.start + day - 1;
  const rateAt = (p: RunPick, i: number) => p.rates[i] ?? 1;
  const perShare = (p: RunPick) => p.closes[idx(p)] * rateAt(p, idx(p));
  const sharesOf = (p: RunPick) => held[p.symbol]?.shares ?? 0;

  // A year's dividends per share up to day `i`, and as a share of that day's price.
  const ttm = (p: RunPick, i: number) =>
    i < YEAR - 1 ? null : p.dividends.slice(i - YEAR + 1, i + 1).reduce((a, b) => a + b, 0);
  const yieldAt = (p: RunPick, i: number) => {
    const d = ttm(p, i);
    return d === null || !p.closes[i] ? null : d / p.closes[i];
  };
  const change = (p: RunPick, i: number, n: number) =>
    i - n >= 0 && p.closes[i - n] ? (p.closes[i] / p.closes[i - n] - 1) * 100 : null;

  // A measure's value for a pick on day `i` (among its closes), or null where it can't be told.
  function value(metric: Metric, p: RunPick, i: number): number | null {
    const c = p.closes;
    switch (metric) {
      case "price":
        return c[i] ?? null;
      case "dayChange":
        return change(p, i, 1);
      case "weekChange":
        return change(p, i, 5);
      case "monthChange":
        return change(p, i, MONTH);
      case "yearChange":
        return change(p, i, YEAR);
      case "vsAvg50":
      case "vsAvg200": {
        const n = metric === "vsAvg50" ? 50 : 200;
        if (i + 1 < n) return null;
        return (c[i] / mean(c.slice(i - n + 1, i + 1)) - 1) * 100;
      }
      case "fromHigh":
      case "fromLow": {
        const last = c.slice(Math.max(0, i - YEAR + 1), i + 1);
        const edge = metric === "fromHigh" ? Math.max(...last) : Math.min(...last);
        return (c[i] / edge - 1) * 100;
      }
      case "yieldVsAvg": {
        const now = yieldAt(p, i);
        if (!now) return null;
        const past: number[] = [];
        for (let j = i; j >= Math.max(YEAR - 1, i - window); j -= MONTH) {
          const y = yieldAt(p, j);
          if (y !== null) past.push(y);
        }
        const avg = past.length ? mean(past) : 0;
        return avg ? (now / avg - 1) * 100 : null;
      }
      case "dividendChange": {
        const now = ttm(p, i);
        const before = ttm(p, i - YEAR);
        return now === null || !before ? null : (now / before - 1) * 100;
      }
      case "cadVsAvg": {
        // The Canadian dollar against the US dollar's rate (from a pick in USD), against its
        // average: a stronger dollar is a lower rate.
        const usd = picks.find((q) => q.currency === "USD");
        if (!usd) return null;
        const j = usd.start + (i - p.start);
        const rate = usd.rates[j];
        if (!rate) return null;
        const past = usd.rates.slice(Math.max(0, j - window), j + 1).filter((r): r is number => r !== null);
        return past.length ? (mean(past) / rate - 1) * 100 : null;
      }
      case "gain": {
        const h = held[p.symbol];
        return h?.shares && h.cost ? ((h.shares * perShare(p) - h.cost) / h.cost) * 100 : null;
      }
      case "held":
        return sharesOf(p);
      case "funds":
        return picks.filter((q) => q.kind === "ETF" && sharesOf(q) > 0).length;
      case "quietQuarters":
        return Math.floor((day - state.potUsed) / QUARTER);
      case "pausedMonths":
        return state.pausedFrom === null ? 0 : Math.floor((day - state.pausedFrom) / MONTH);
      default:
        return null;
    }
  }

  const compare = (v: number, c: Condition) => {
    const x = Number(c.value);
    return c.op === "above" ? v > x : c.op === "below" ? v < x : c.op === "atLeast" ? v >= x : v <= x;
  };
  // A condition holding for a pick today (and, kept up, on as many months or payouts before).
  function holds(c: Condition, p: RunPick) {
    const info = METRICS[c.metric];
    if (info.unit === "event") return false;
    const i = idx(p);
    const n = Math.max(1, Math.floor(Number(c.lasting) || 1));
    const at =
      info.span === "payouts"
        ? p.dividends
            .map((d, j) => (d > 0 && j <= i ? j : -1))
            .filter((j) => j >= 0)
            .slice(-n)
        : Array.from({ length: n }, (_, k) => i - k * MONTH);
    if (at.length < n || at.some((j) => j < 0)) return false;
    return at.every((j) => {
      const v = value(c.metric, p, j);
      return v !== null && compare(v, c);
    });
  }
  const meets = (rule: Rule, p: RunPick) =>
    rule.conditions.length === 0 ||
    (rule.match === "any" ? rule.conditions.some((c) => holds(c, p)) : rule.conditions.every((c) => holds(c, p)));

  // Why `rule` acted on `p`: each of its conditions, with its figure today and whether it held.
  // (`pool`: how many picks it chose `p` from, for a card that buys with money.)
  let current: { rule: Rule; pool: number } | null = null;
  const CHECKS = {
    once: "Acts once, at the start",
    day: "Checks every day",
    month: "Checks every month",
    quarter: "Checks every quarter",
    year: "Checks every year",
  };
  function explain(p: RunPick | undefined): Why | undefined {
    if (!current) return undefined;
    const { rule, pool } = current;
    const reason = p ? why(p) : "";
    return {
      card: rule.name.trim() || "Untitled card",
      number: deck.rules.indexOf(rule) + 1,
      of: deck.rules.length,
      does: capital(actionText(rule, deck)),
      pick: p?.name ?? null,
      check: CHECKS[rule.check ?? "day"],
      match: rule.match === "any" ? "any" : "all",
      conditions: p
        ? rule.conditions.map((c) => {
            const v = value(c.metric, p, idx(p));
            return { text: conditionText(c), now: v === null ? null : valueText(c.metric, String(v)), met: holds(c, p) };
          })
        : [],
      chosen:
        p && pool > 1
          ? `Of the ${pool} that met them, it had the best outlook${reason ? ` (${reason})` : ""}.`
          : undefined,
    };
  }

  // A pick's outlook: its price's change over 6 and 12 months, averaged, plus twice its yield.
  const outlook = (p: RunPick) => {
    const i = idx(p);
    const moves = [change(p, i, 126), change(p, i, YEAR)].filter((v): v is number => v !== null);
    const move = moves.length ? mean(moves) : (change(p, i, QUARTER) ?? 0);
    return move + 2 * (yieldAt(p, i) ?? 0) * 100;
  };
  // The one with the best outlook, of those `amount` (in CAD) buys at least a share of.
  const best = (list: RunPick[], amount = Infinity) =>
    [...list]
      .filter((p) => perShare(p) > 0 && perShare(p) <= Math.min(amount, cash))
      .sort((a, b) => outlook(b) - outlook(a))[0];
  const why = (p: RunPick) => {
    const i = idx(p);
    const year = change(p, i, YEAR);
    const y = yieldAt(p, i);
    return [
      year !== null ? `${year >= 0 ? "+" : "−"}${Math.abs(year).toFixed(0)}% over a year` : null,
      y ? `${(y * 100).toFixed(1)}% yield` : null,
    ]
      .filter(Boolean)
      .join(", ");
  };

  // The dividend score, for choosing the top funds to spread money across: of the picks given,
  // those with a year of prices before today and no dividend cut (the last 12 months' dividends
  // more than 10% under the 12 before, where two years are known), ranked on three measures, each
  // among them: the yield (the last 12 months' dividends over today's price), the total return
  // (the last 12 months' price change and dividends, in CAD), and steadiness (how much the price
  // moves from day to day over the year, in CAD: less is better). Best first: the lowest average
  // of the three ranks, ties going to the higher yield. With each, its figures, to say why.
  type Scored = { p: RunPick; yield: number; total: number; swing: number; place: number };
  function dividendRanking(list: RunPick[]): Scored[] {
    const scored = list.flatMap((p) => {
      const i = idx(p);
      if (i < YEAR || !p.closes[i - YEAR]) return [];
      const now = ttm(p, i);
      const before = ttm(p, i - YEAR);
      if (now !== null && before && now < before * 0.9) return [];
      const cad = (j: number) => p.closes[j] * rateAt(p, j);
      let paid = 0;
      const moves: number[] = [];
      for (let j = i - YEAR + 1; j <= i; j++) {
        paid += p.dividends[j] * rateAt(p, j);
        if (cad(j - 1) > 0 && cad(j) > 0) moves.push(Math.log(cad(j) / cad(j - 1)));
      }
      const avg = moves.length ? mean(moves) : 0;
      const swing = moves.length ? Math.sqrt(mean(moves.map((m) => (m - avg) ** 2))) * Math.sqrt(YEAR) * 100 : Infinity;
      return [
        {
          p,
          yield: ((now ?? 0) / p.closes[i]) * 100,
          total: ((cad(i) + paid) / cad(i - YEAR) - 1) * 100,
          swing,
          place: 0,
        },
      ];
    });
    const rank = (key: (s: Scored) => number) => {
      const order = [...scored].sort((a, b) => key(b) - key(a));
      return (s: Scored) => order.indexOf(s) + 1;
    };
    const byYield = rank((s) => s.yield);
    const byTotal = rank((s) => s.total);
    const bySwing = rank((s) => -s.swing);
    const score = new Map(scored.map((s) => [s, (byYield(s) + byTotal(s) + bySwing(s)) / 3]));
    return scored
      .sort((a, b) => score.get(a)! - score.get(b)! || b.yield - a.yield)
      .map((s, k) => ({ ...s, place: k + 1 }));
  }
  const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
  const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}%`;

  const blocked = () => state.stopped || day < state.pausedUntil;
  // Buys as many whole shares of `p` as `amount` (in CAD) and the cash stretch to; what it spent.
  function buy(p: RunPick, amount: number, what: string) {
    const each = perShare(p);
    // (A hair over, so 5 shares' worth buys 5 despite rounding.)
    const n = each > 0 ? Math.floor(Math.min(amount, cash) / each + 1e-9) : 0;
    if (n < 1) return 0;
    const reason = explain(p) ?? {
      card: "The plan",
      pick: p.name,
      check: null,
      match: "all" as const,
      conditions: [],
      chosen: `Its building years are over, so the pot went to the pick with the best outlook${why(p) ? ` (${why(p)})` : ""}.`,
    };
    orders.push({ symbol: p.symbol, side: "Bought", shares: n, why: reason });
    const spent = n * each;
    cash -= spent;
    const h = held[p.symbol] ?? { shares: 0, cost: 0 };
    held[p.symbol] = { shares: h.shares + n, cost: h.cost + spent };
    say(`Bought ${n} ${p.name}${what ? ` ${what}` : ""}.`, reason);
    return spent;
  }
  // Buys `n` shares of `p` (as many as the cash stretches to), with why; what it spent.
  function buyShares(p: RunPick, n: number, what: string, reason: Why | undefined) {
    const each = perShare(p);
    const shares = Math.min(n, each > 0 ? Math.floor(cash / each + 1e-9) : 0);
    if (shares < 1) return 0;
    orders.push({ symbol: p.symbol, side: "Bought", shares, why: reason });
    const spent = shares * each;
    cash -= spent;
    const h = held[p.symbol] ?? { shares: 0, cost: 0 };
    held[p.symbol] = { shares: h.shares + shares, cost: h.cost + spent };
    say(`Bought ${shares} ${p.name} ${what}.`, reason);
    return spent;
  }
  function sell(p: RunPick, n: number, what: string) {
    const h = held[p.symbol];
    const shares = Math.min(n, h?.shares ?? 0);
    if (shares < 1) return 0;
    const reason = explain(p);
    orders.push({ symbol: p.symbol, side: "Sold", shares, why: reason });
    const got = shares * perShare(p);
    cash += got;
    held[p.symbol] = { shares: h.shares - shares, cost: h.shares === shares ? 0 : (h.cost * (h.shares - shares)) / h.shares };
    say(`Sold ${shares} ${p.name}${what}.`, reason);
    return got;
  }

  // Building over: the pot is invested in the best of them, and closed.
  const scope = picks.filter((p) => inScope(deck, p) && listed(p));
  if (holding(deck, day) && !state.potClosed) {
    state.potClosed = true;
    if (state.pot > 0 && scope.length && !blocked()) {
      const to = best(scope, state.pot);
      if (to) state.pot -= buy(to, state.pot, "with the pot, as building ends");
      state.fresh += Math.max(state.pot, 0);
      state.pot = 0;
    }
  }

  for (const rule of deck.rules) {
    if (!complete(rule)) continue;
    // Checked today? (Day 1, then every day, month, quarter or year on.)
    if ((day - 1) % PERIOD[rule.check ?? "day"]) continue;
    if (rule.check === "once" && state.lastFired[rule.id] !== undefined) continue;
    if (rule.phase === "build" && holding(deck, day)) continue;
    if (rule.phase === "hold" && !holding(deck, day)) continue;
    const limit = PERIOD[rule.limit ?? "none"];
    const last = state.lastFired[rule.id];
    if (limit && last !== undefined && day - last < limit) continue;
    if (!scope.length) continue;

    const action = actionOf(rule);
    const amount = Number(rule.amount);
    const matching = scope.filter((p) => meets(rule, p));
    // (Cards that buy with money choose among the picks that qualify.)
    current = { rule, pool: ["buyAmount", "buyMonthly", "buyPot"].includes(action) ? matching.length : 0 };
    let fired = false;
    switch (action) {
      case "buy":
        if (blocked()) break;
        for (const p of matching) fired = buy(p, Number(rule.shares) * perShare(p), "") > 0 || fired;
        break;
      case "sell":
        for (const p of matching) fired = sell(p, Number(rule.shares), "") > 0 || fired;
        break;
      case "buyAmount": {
        if (blocked() || !matching.length) break;
        const to = best(matching, amount);
        fired = !!to && buy(to, amount, `for $${amount}`) > 0;
        break;
      }
      case "buyMonthly": {
        if (blocked() || !matching.length || state.fresh < 1) break;
        // Part to a second fund, when the plan has one (if that part buys a share of one).
        const toSecond = state.split ? (state.fresh * state.split) / 100 : 0;
        const first = best(matching, state.fresh - toSecond) ?? best(matching, state.fresh);
        const second = first && toSecond ? best(matching.filter((p) => p !== first), toSecond) : undefined;
        const spent = first
          ? buy(first, state.fresh - (second ? toSecond : 0), "with this month's money") +
            (second ? buy(second, toSecond, "with its share of this month's money") : 0)
          : 0;
        state.fresh -= spent;
        fired = spent > 0;
        break;
      }
      case "buyPot": {
        if (blocked() || !matching.length || state.pot < 1) break;
        const to = best(matching, state.pot);
        const spent = to ? buy(to, state.pot, "with the pot") : 0;
        state.pot -= spent;
        if (spent > 0) state.potUsed = day;
        fired = spent > 0;
        break;
      }
      case "spread": {
        // The money waiting (less a cent), spread evenly across the top funds by the dividend
        // score, in whole shares: as many funds as the card says (fewer where too few pass, or
        // where a fund's share costs more than its slice: it gives way to the next). Each fund is
        // brought up to an even share of what they hold together with the money; what is left is
        // spent a share at a time, best first, until no share fits.
        if (blocked() || state.fresh < 1) break;
        const ranked = dividendRanking(matching);
        const money = Math.min(state.fresh, cash);
        let top: Scored[] = [];
        for (let k = Math.min(amount, ranked.length); k >= 1; k--) {
          top = ranked.filter((s) => perShare(s.p) <= money / k).slice(0, k);
          if (top.length === k) break;
        }
        if (!top.length) break;
        const worth = (p: RunPick) => sharesOf(p) * perShare(p);
        const even = (money + top.reduce((sum, s) => sum + worth(s.p), 0)) / top.length;
        const count = new Map(top.map((s) => [s, Math.max(0, Math.floor((even - worth(s.p)) / perShare(s.p) + 1e-9))]));
        let left = money - top.reduce((sum, s) => sum + count.get(s)! * perShare(s.p), 0);
        for (let more = true; more; ) {
          more = false;
          for (const s of top)
            if (perShare(s.p) <= left + 1e-9) {
              count.set(s, count.get(s)! + 1);
              left -= perShare(s.p);
              more = true;
              break;
            }
        }
        let spent = 0;
        for (const s of top) {
          const n = count.get(s)!;
          if (!n) continue;
          // Why this fund: its place and figures, among how many passed.
          const base = explain(s.p);
          const reason = base && {
            ...base,
            chosen: `It ranked ${ordinal(s.place)} of the ${ranked.length} ${ranked.length === 1 ? "fund" : "funds"} with a year of prices and no dividend cut, on yield (${s.yield.toFixed(1)}%), total return over a year (${signed(s.total)} in CAD) and steadiness (${s.swing.toFixed(0)}% a year of price swings).`,
          };
          spent += buyShares(s.p, n, `as one of the top ${top.length}`, reason);
        }
        state.fresh -= spent;
        fired = spent > 0;
        break;
      }
      case "move":
        // Part of each holding it holds for, sold, and the money put in the best other one.
        for (const p of matching.filter((q) => sharesOf(q) > 0)) {
          const n = amount >= 100 ? sharesOf(p) : Math.max(1, Math.floor((sharesOf(p) * amount) / 100));
          const got = sell(p, n, ` to move ${amount >= 100 ? "it all" : `${amount}%`} elsewhere`);
          const to = best(scope.filter((q) => q !== p), got);
          if (got > 0 && to && !blocked()) buy(to, got, `with the money moved from ${p.name}`);
          fired = fired || got > 0;
        }
        break;
      case "split":
        if (matching.length && state.split !== amount) {
          state.split = amount;
          say(`From now on, ${amount}% of new money goes to a second fund.`, explain(matching[0]));
          fired = true;
        }
        break;
      case "pause":
        if (matching.some((p) => sharesOf(p) > 0) || (!Object.values(held).some((h) => h.shares) && matching.length)) {
          if (day >= state.pausedUntil) {
            state.pausedFrom = state.pausedFrom ?? day;
            state.pausedUntil = day + amount * MONTH;
            say(
              `Paused buying for ${amount} ${amount === 1 ? "month" : "months"}.`,
              explain(matching.find((p) => sharesOf(p) > 0) ?? matching[0]),
            );
            fired = true;
          }
        }
        break;
      case "stop":
        if (matching.length && !state.stopped) {
          state.stopped = true;
          say("Stopped buying.", explain(matching[0]));
          fired = true;
        }
        break;
    }
    if (fired) state.lastFired[rule.id] = day;
  }
  current = null;

  // Nothing done: why (nothing to trade, buying held back, or its cards next look later).
  if (!notes.length) {
    const why = nothingToTrade(deck, picks);
    const next = deck.rules
      .filter(complete)
      .map((r) => {
        const every = PERIOD[r.check ?? "day"];
        return day + every - ((day - 1) % every);
      })
      .reduce((a, b) => Math.min(a, b), Infinity);
    notes.push({
      acted: false,
      text:
      why ??
        (!scope.length
          ? "None of what it trades is listed yet."
          : state.stopped
            ? "Buying is stopped."
            : day < state.pausedUntil
              ? `Buying is paused until Day ${state.pausedUntil}.`
              : Number.isFinite(next) && next > day + 1
                ? `Nothing to do today. Its next check is on Day ${next}.`
                : "Nothing to do today."),
    });
  }
  // (Some cards skipped for missing a figure: said, so their silence isn't a mystery.)
  const skipped = unfinished(deck);
  if (skipped && runnable(deck))
    notes.push({ acted: false, text: `${skipped} unfinished ${skipped === 1 ? "card is" : "cards are"} skipped.` });
  return { orders, state, notes };
}
