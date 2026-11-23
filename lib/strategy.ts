// A strategy as the Strategies page builds it (components/StrategyBuilder.tsx) and the Sandbox
// runs it (lib/strategyRun.ts): a deck of rules ("cards"), each with its conditions and what it
// does, what the deck applies to, and its plan for money. Kept in this browser (STORE).

import type { PaletteName } from "@/components/EtfBreakdown";

export type Scope = "sector" | "etfs" | "single";
export type Metric =
  | "price"
  | "dayChange"
  | "weekChange"
  | "monthChange"
  | "yearChange"
  | "vsAvg50"
  | "vsAvg200"
  | "fromHigh"
  | "fromLow"
  | "yieldVsAvg"
  | "dividendChange"
  | "spreadVsAvg"
  | "cadVsAvg"
  | "navDiscount"
  | "feeChange"
  | "policyChange"
  | "gain"
  | "held"
  | "funds"
  | "quietQuarters"
  | "pausedMonths";
export type Op = "above" | "below" | "atLeast" | "atMost";
// (`lasting`: for a measure kept up over time, how many months or payouts in a row it must hold.)
export type Condition = { id: number; metric: Metric; op: Op; value: string; lasting?: string };
// What a card does. (Cards from before there were others have only `side`: buying or selling
// shares.)
export type Action = "buy" | "sell" | "buyAmount" | "buyMonthly" | "buyPot" | "move" | "split" | "pause" | "stop";
export type Check = "day" | "month" | "quarter" | "year";
export type Limit = "none" | "month" | "quarter" | "year";
export type Phase = "always" | "build" | "hold";
export type Rule = {
  id: number;
  name: string;
  conditions: Condition[];
  side: "buy" | "sell";
  shares: string;
  action?: Action;
  amount?: string; // dollars (buyAmount), percent (move, split) or months (pause)
  target?: string; // the fund moved or sent to (move, split)
  match?: "all" | "any";
  check?: Check;
  limit?: Limit;
  phase?: Phase;
};
// How money comes in and is kept; each figure left empty is not part of the plan.
export type Plan = {
  monthlyMin: string;
  monthlyMax: string;
  reserve: string;
  pot: string;
  emergencyEvery: string;
  emergencyMin: string;
  emergencyMax: string;
  dividends: "reinvest" | "cash";
  buildYears: string;
  averagesFrom: string;
  averagesYears: string;
  noDebt: boolean;
};
export type Strategy = {
  id: number;
  name: string;
  scope: Scope;
  sector: string;
  symbol: string;
  rules: Rule[];
  palette?: PaletteName; // its colour, one of the Search charts' families (blue, as theirs, if none is chosen)
  plan?: Plan;
};
// What is kept: the decks, the one open, and the card being edited in each.

// What a condition can look at: each measure's group in the menu, its label, how it reads, and
// how its value is written.
// (An event has no figure: it either happens or not. `span`: what a measure kept up over time
// is counted in.)
export type Unit = "$" | "%" | "pts" | "shares" | "funds" | "quarters" | "months" | "event";
export type MetricInfo = { group: string; label: string; phrase: string; unit: Unit; span?: "months" | "payouts" };
export const METRICS: Record<Metric, MetricInfo> = {
  price: {
    group: "Price and trend",
    label: "Price",
    phrase: "the price",
    unit: "$",
  },
  dayChange: {
    group: "Price and trend",
    label: "Day's change",
    phrase: "the day's change",
    unit: "%",
  },
  weekChange: {
    group: "Price and trend",
    label: "Change over 5 days",
    phrase: "the change over the past 5 days",
    unit: "%",
  },
  monthChange: {
    group: "Price and trend",
    label: "Change over 1 month",
    phrase: "the change over the past month",
    unit: "%",
  },
  yearChange: {
    group: "Price and trend",
    label: "Change over 1 year",
    phrase: "the change over the past year",
    unit: "%",
  },
  vsAvg50: {
    group: "Price and trend",
    label: "Price vs 50-day average",
    phrase: "the price against its 50-day average",
    unit: "%",
  },
  vsAvg200: {
    group: "Price and trend",
    label: "Price vs 200-day average",
    phrase: "the price against its 200-day average",
    unit: "%",
  },
  fromHigh: {
    group: "Price and trend",
    label: "Distance from 52-week high",
    phrase: "the price against its 52-week high",
    unit: "%",
  },
  fromLow: {
    group: "Price and trend",
    label: "Distance from 52-week low",
    phrase: "the price against its 52-week low",
    unit: "%",
  },
  yieldVsAvg: {
    group: "Dividends and the fund",
    label: "Yield vs its average",
    phrase: "the dividend yield against its average",
    unit: "%",
  },
  dividendChange: {
    group: "Dividends and the fund",
    label: "Dividend change",
    phrase: "the dividend's change from a year before",
    unit: "%",
    span: "payouts",
  },
  spreadVsAvg: {
    group: "Dividends and the fund",
    label: "Yield over 5-year bond vs its average",
    phrase: "the yield over the 5-year Government of Canada bond's, against its average",
    unit: "pts",
  },
  cadVsAvg: {
    group: "Dividends and the fund",
    label: "CAD vs USD against its average",
    phrase: "the CAD against the USD, compared with its average",
    unit: "%",
  },
  navDiscount: {
    group: "Dividends and the fund",
    label: "Discount to NAV",
    phrase: "the price's discount to the value of its holdings",
    unit: "%",
    span: "months",
  },
  feeChange: {
    group: "Dividends and the fund",
    label: "Fee change",
    phrase: "the change in the fund's fee",
    unit: "pts",
  },
  policyChange: {
    group: "Dividends and the fund",
    label: "Policy change on foreign dividends",
    phrase: "a new tax, higher withholding or a limit on foreign holdings comes in",
    unit: "event",
  },
  gain: {
    group: "Your position",
    label: "Gain on shares held",
    phrase: "the gain on the shares held",
    unit: "%",
  },
  held: {
    group: "Your position",
    label: "Shares held",
    phrase: "the number of shares held",
    unit: "shares",
  },
  funds: {
    group: "Your position",
    label: "Funds held",
    phrase: "the number of funds held",
    unit: "funds",
  },
  quietQuarters: {
    group: "Your position",
    label: "Quarters since the pot was used",
    phrase: "the quarters since the pot was last used",
    unit: "quarters",
  },
  pausedMonths: {
    group: "Your position",
    label: "Months buying has been paused",
    phrase: "the months buying has been paused",
    unit: "months",
  },
};

export const filled = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
export const wholeShares = (v: string) => /^\d+$/.test(v.trim()) && Number(v) > 0;
export const positive = (v: string | undefined) => filled(v ?? "") && Number(v) > 0;

// What a card does (cards from before there were other actions only buy or sell shares), and
// whether it has all it needs: each condition's figure, and its action's.
export const actionOf = (r: Rule): Action => r.action ?? r.side;
export const conditionDone = (c: Condition) =>
  METRICS[c.metric].unit === "event" || (filled(c.value) && (!c.lasting?.trim() || positive(c.lasting)));
export function actionDone(r: Rule) {
  const a = actionOf(r);
  if (a === "buy" || a === "sell") return wholeShares(r.shares);
  if (a === "buyAmount" || a === "pause") return positive(r.amount);
  if (a === "move" || a === "split")
    return positive(r.amount) && Number(r.amount) <= 100 && !!r.target?.trim();
  return true;
}
export const complete = (r: Rule) => r.conditions.every(conditionDone) && actionDone(r);

// The plan's figures as numbers, or null where left empty.
export const num = (v: string | undefined) => (filled(v ?? "") ? Number(v) : null);

// The plan a deck starts with: nothing set, dividends reinvested.
export const EMPTY_PLAN: Plan = {
  monthlyMin: "",
  monthlyMax: "",
  reserve: "",
  pot: "",
  emergencyEvery: "",
  emergencyMin: "",
  emergencyMax: "",
  dividends: "reinvest",
  buildYears: "",
  averagesFrom: "",
  averagesYears: "",
  noDebt: false,
};

// Where the decks are kept in this browser, with the one open and the card edited in each.
export const STORE = "canetf-strategy-decks";
export type Saved = { decks: Strategy[]; open: number; editing: Record<number, number> };

// The decks kept in this browser (none before the Strategies page has kept any).
export function loadDecks(): Strategy[] {
  try {
    const kept = JSON.parse(localStorage.getItem(STORE) ?? "null") as Saved | null;
    return kept?.decks ?? [];
  } catch {
    return [];
  }
}
