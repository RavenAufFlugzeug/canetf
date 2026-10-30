"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { getSandboxSetHistory, getSandboxSetPrices, revealSandboxSet } from "@/app/actions/sandbox";
import DiamondLoader from "@/components/DiamondLoader";
import BadgeLegend from "@/components/BadgeLegend";
import { NAICS_GROUPS } from "@/lib/naics";
import EtfHoldings from "@/components/EtfHoldings";
import { Flag, Place } from "@/components/FlagPair";
import FoldButton from "@/components/FoldButton";
import HoldingsDeck from "@/components/HoldingsDeck";
import KindMark from "@/components/KindMark";
import PickBoard, { FilterMenu, type MenuOption } from "@/components/PickBoard";
import ResultChart from "@/components/ResultChart";
import {
  type Figures,
  amountText,
  countText as figureCount,
  dayText as figureDay,
} from "@/components/PickCards";
import { AliasName, useAliases } from "@/components/SandboxAliases";
import { useStage } from "@/components/SandboxStage";
import SandboxChart, { type Range as ChartRange } from "@/components/SandboxChart";
import { EaseHeight, useSandboxSwap } from "@/components/SandboxSwap";
import StartMark from "@/components/StartMark";
import {
  BuyMark,
  DayMark,
  ExitMark,
  FinishMark,
  MonthMark,
  MoonMark,
  RetryMark,
  SellMark,
  WarnMark,
  WeekMark,
} from "@/components/TestMarks";
import TradeLog from "@/components/TradeLog";
import Tween from "@/components/Tween";
import { currencyName, usedIn } from "@/lib/fx";
import { moneyFormatter, rateDecimals } from "@/lib/money";
import { newSeed, sandboxHref, type Choices } from "@/lib/sandbox";
import { tradingSpan } from "@/lib/tradingTime";

// The Sandbox's trading test, over a set of companies and ETFs (`picks`, named by their kind,
// not their names) all trading through the same stretch of time. Starting with `amount`
// dollars, the player sees Day 1's closing prices, buys or sells whole shares of any of them
// at those prices, then moves on a day, a week (5 trading days) or a month (21) at a time to
// Day `days`, seeing how the account does and a chart of whichever pick is chosen, and is
// rated at the end on the account's value. Prices count as dollars as they are (no exchange
// rate). Each day's prices are fetched only when that day comes, so the days ahead aren't in
// the page. Moving on is smooth: the day, the prices and what the account is worth count to
// their new figures (Tween) as the chart's new days slide in (SandboxChart). The picks sit in a
// grid (their prices, the day's change and the shares held); choosing one shows its chart and
// its order tickets, one to buy and one to sell (OrderTicket), one in use at a time (clicking
// the other switches, each keeping its number until the test moves on): a number of shares,
// typed in or stepped up and down by 1 or 10, its estimated cost or proceeds and where the
// cash and the position would end up shown as it changes (MoneyTiles); then reviewed and
// confirmed (ConfirmTrade), which places the order, for good: once made, a badge floats up
// from the position, the figures count to their new values, the trade slides into the log
// and a mark pops up on the chart where it was made.
// A pick: its symbol, its name ("TechCompany (1)": the player may give it an alias), the
// trading day its test starts on, for its card in the holdings deck its kind and its sector's
// colour and ink, and its general figures today (for a company; null for a fund).
type Pick = {
  symbol: string;
  name: string;
  from: string;
  kind: string;
  color: string;
  ink: string;
  mark: string; // its kind's mark's colour, on its colour
  line: string; // its industry and place
  industry: string | null;
  place: string | null; // where it is based
  country: string | null; // that country, for its flag
  note: string | null; // for a fund, what it holds in a few words
  about: string | null; // what it does, its name hidden
  sector: string | null; // its NAICS group's name
  currency: string | null; // what it trades in
  figures: Figures;
};
type Side = "Bought" | "Sold";
// A trade: its price per share in the currency the pick trades in, and `rate`, how many
// Canadian dollars one unit of that currency was worth that day (1 for CAD): the cash moved
// is shares × price × rate.
type Trade = {
  symbol: string;
  name: string;
  day: number;
  side: Side;
  shares: number;
  price: number;
  rate: number;
};
// The cash, by currency: CAD to begin with, and any other a share was sold for or bought with,
// or exchanged into.
type Wallet = Record<string, number>;
// A currency exchange: on Day `day`, `paid` of `from` for `got` of `to` (`auto`: made to pay for
// a share in that currency, when the cash in it fell short).
type Exchange = { day: number; from: string; to: string; paid: number; got: number; auto: boolean };
// A purchase's payment: its cost in the share's currency, how much of that comes from the cash
// already held in it, and the rest, exchanged from CAD (`short` in that currency, for `cadPaid`).
type Payment = { cost: number; fromHeld: number; short: number; cadPaid: number };
// A trade waiting to be confirmed.
type Ask = { symbol: string; name: string; side: Side; shares: number };
// What is held of a pick: how many shares, and what they cost in Canadian dollars (for their
// average price; a sale takes its shares out at that average).
type Holding = { shares: number; cost: number };
// What happened over the days just passed, shown before they come in: from Day `from` to
// Day `to`, the account's value on each of those days (at the shares held throughout), how
// each pick moved, and how each position did; with each pick's new closes and which of
// those days (by number) begin a new year, to bring in once it is seen.
type Recap = {
  from: number;
  to: number;
  values: number[];
  // Each pick held: its shares, how its worth in CAD moved over the days (its price and its
  // currency's rate together), and what that made or lost.
  // `pricePct`: its price's change alone; `pct`: its worth in CAD (the same for a CAD pick).
  positions: { name: string; shares: number; foreign: boolean; pricePct: number; pct: number; gain: number }[];
  days: Record<string, { closes: number[]; rates: number[]; yearStarts: number[] }>;
};

// How long a recap stays up before the test moves on by itself (unless pointed at), and how
// long it takes to fade away (.recap-timer, .recap-out in globals.css).
const RECAP_MS = 5000;
const RECAP_OUT_MS = 260;
// How long passed, for a recap's heading: "A day passes", "A week passes", "3 days pass".
function passedText(n: number) {
  const { text } = tradingSpan(n);
  return text.startsWith("1 ") ? `A ${text.slice(2)} passes` : `${text} pass`;
}

// How a test went, by its return: a gain or loss of 10% or more, average within 5%, and
// above or below average in between.
// Each grade's colours: S+ holographic on dark (pastels flowing like water), S a bright gold, A
// purple, B deep blue, C green, F red (`text` for the letter on white, `fill` for the grade
// earned, filled in on the scale). By the whole grade, else its letter.
const GRADE_LOOK: Record<string, { text: string; fill: string }> = {
  "S+": { text: "grade-holo", fill: "grade-holo-fill text-white" },
  S: { text: "text-[#f5a00b]", fill: "bg-[#f5a00b] text-white shadow-amber-900/25" },
  A: { text: "text-violet-700", fill: "bg-violet-700 text-white shadow-violet-900/20" },
  B: { text: "text-blue-900", fill: "bg-blue-900 text-white shadow-blue-950/20" },
  C: { text: "text-green-700", fill: "bg-green-700 text-white shadow-green-900/20" },
  F: { text: "text-red-600", fill: "bg-red-600 text-white shadow-red-900/20" },
};
// A grade's letter in its colours; an S+ with sparkles twinkling round it, one after another.
function GradeLetter({ grade, className }: { grade: string; className: string }) {
  if (grade !== "S+") return <span className={`font-bold leading-none ${className}`}>{grade}</span>;
  return (
    <span className="relative inline-block">
      <span className={`font-bold leading-none ${className}`}>{grade}</span>
      {[
        { left: "-30%", top: "-25%", size: "0.5em", delay: "0s" },
        { left: "95%", top: "-35%", size: "0.38em", delay: "0.9s" },
        { left: "88%", top: "70%", size: "0.32em", delay: "1.8s" },
      ].map((p, i) => (
        <svg
          key={i}
          aria-hidden
          viewBox="0 0 10 10"
          className="grade-sparkle pointer-events-none absolute"
          style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay }}
        >
          <path d="M5 0c.4 2.6 2 4.4 5 5-3 .6-4.6 2.4-5 5-.4-2.6-2-4.4-5-5 3-.6 4.6-2.4 5-5Z" fill="#fff" />
        </svg>
      ))}
    </span>
  );
}

const lookOf = (grade: string) => GRADE_LOOK[grade] ?? GRADE_LOOK[grade[0]] ?? GRADE_LOOK.C;

// The test's grade, as a teacher would mark it, by how much the account's value changed:
// S+ for more than doubling it (over 100%), S for 25% or more, A for 10% or more, A− for 5% or more, B+ for up to 5% (or no change),
// B for a loss of up to 5%, B− up to 10%, C up to 25%, and F for more than that.
const GRADES: { min: number; grade: string; label: string; note: string; range: string }[] = [
  {
    min: 100.000001,
    grade: "S+",
    label: "Exceptional",
    note: "You more than doubled your money.",
    range: "over +100%",
  },
  {
    min: 25,
    grade: "S",
    label: "Exceptional",
    note: "You grew your money by 25% or more.",
    range: "+25% to +100%",
  },
  {
    min: 10,
    grade: "A",
    label: "Excellent",
    note: "You grew your money by 10% or more.",
    range: "+10% to +25%",
  },
  { min: 5, grade: "A−", label: "Excellent", note: "Up between 5% and 10%.", range: "+5% to +10%" },
  {
    min: 0,
    grade: "B+",
    label: "Good",
    note: "Up to 5% better than where you started, or level.",
    range: "0 to +5%",
  },
  { min: -5, grade: "B", label: "Good", note: "Down by less than 5%.", range: "0 to −5%" },
  { min: -10, grade: "B−", label: "Good", note: "Down between 5% and 10%.", range: "−5% to −10%" },
  { min: -25, grade: "C", label: "Satisfactory", note: "Down between 10% and 25%.", range: "−10% to −25%" },
  {
    min: -Infinity,
    grade: "F",
    label: "Needs improvement",
    note: "You lost more than 25% of your money.",
    range: "below −25%",
  },
];

function verdict(pct: number) {
  const g = GRADES.find((x) => pct >= x.min - 1e-9) ?? GRADES[GRADES.length - 1];
  return { ...g, tone: pct > 0 ? "text-green-700" : pct < 0 ? "text-red-600" : "text-slate-900" };
}

// A day written out: "Mar 4, 2019".
const longDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const cents = (x: number) => Math.round(x * 100) / 100;
// `x` with its sign; `x` is already rounded as shown, so a "0.00" never reads "−0.00".
const signed = (x: number, text: string) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${text}`;
const pctText = (x: number) => {
  const shown = Number(x.toFixed(2));
  return signed(shown, `${Math.abs(shown).toFixed(2)}%`);
};
const tone = (x: number) => (x > 0 ? "text-green-700" : x < 0 ? "text-red-600" : "text-slate-500");
const moneyText = (x: number) => money.format(x);
// A price in the currency a pick trades in, with that currency's decimals (none for yen),
// its code beside it: "182.40 USD"; for CAD, as other money is.
const nativeText = (x: number, currency: string | null) => {
  if (!currency || currency === "CAD") return money.format(x);
  const { decimals } = moneyFormatter(currency);
  return `${x.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
};
// A price's figure alone, with its currency's decimals (its code is shown beside it).
const plainText = (x: number, currency: string | null) => {
  const { decimals } = moneyFormatter(currency);
  return x.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
// An exchange rate as written beside a price: "1 USD = $1.3986".
const rateText = (rate: number, currency: string | null) =>
  `1 ${currency} = ${moneyFormatter("CAD", rateDecimals(rate)).format(rate)}`;
const changeText = (x: number) => signed(cents(x), money.format(Math.abs(cents(x))));
const dayText = (x: number) => String(Math.round(x));
const countText = (x: number) => Math.round(x).toLocaleString("en-CA");
const sharesWord = (n: number) => (n === 1 ? "share" : "shares");

// A button that can't be used shows the warning cursor (.warn-cursor in globals.css).
const BUTTON =
  "rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 warn-cursor disabled:opacity-40";
const DARK = `${BUTTON} bg-slate-900 text-white hover:bg-slate-700`;
const LIGHT = `${BUTTON} border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50`;
// The test's main actions (buying and selling, moving on, finishing), each with its mark
// (TestMarks): pointed at, the button lifts with a soft shadow and its mark comes alive;
// pressed, it sinks a touch.
const ACTION =
  "group inline-flex items-center gap-2 hover:shadow-md motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] disabled:hover:translate-y-0 disabled:hover:shadow-none";
// The start button: dark, with its play mark. Pointed at, it lifts a little and the mark
// springs forwards, ready to go; clicked, the mark launches (shooting forwards out of
// sight) as a ripple spreads from where it was clicked, then the loading mark shows until
// Day 1 is in (see begin).
const START =
  "group relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out hover:bg-slate-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 motion-safe:hover:-translate-y-0.5 disabled:cursor-wait disabled:translate-y-0";
// How long the play mark takes to launch (.start-mark-launch in globals.css).
const LAUNCH_MS = 380;
// Starting the test is unhurried: the loading mark shows for at least START_WAIT_MS from
// the click, then the start panel's contents fade away over LEAVE_MS, and the panel grows
// to the trading panel over GROW_MS as the trading panel's parts rise in one by one.
const START_WAIT_MS = 1100;
const LEAVE_MS = 350;
// How long the shown pick's parts take to fade out when another is chosen (.pick-swap-out).
const SWAP_OUT_MS = 260;
const GROW_MS = 750;
const pause = (ms: number) => new Promise((done) => window.setTimeout(done, ms));

// One part of the trading panel rising in, `i` parts after the first, as the test starts.
const enter = (i: number) => ({
  className: "rise-in",
  style: { animationDelay: `${120 + i * 110}ms`, animationDuration: "700ms" },
});

const NO_ORDERS: Record<Side, string> = { Bought: "", Sold: "" };
const sizeOf = (text: string) => {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export default function SandboxTest({
  picks,
  days,
  amount,
  setKey,
  choices,
}: {
  picks: Pick[];
  days: number;
  amount: number;
  // The key of the Sandbox's area this test is in (the set's: see SandboxSwap), and the
  // choices it was made with, for trying again (a new set) or leaving (no set).
  setKey: string;
  choices: Choices;
}) {
  const { change } = useSandboxSwap();
  // Whether the test is under way, for the set-up above to fold away (SetupArea); said as it
  // starts, as it is left, and when this test goes (a new set, a new amount).
  const { setTesting } = useStage();
  useEffect(() => () => setTesting(false), [setTesting]);
  const [status, setStatus] = useState<"ready" | "trading" | "done">("ready");
  // Whether the card asking to leave the test early is up, and whether it is going away.
  const [quitting, setQuitting] = useState(false);
  // Whether the card congratulating the player on finishing is up, and whether it is going.
  const [finishing, setFinishing] = useState(false);
  const [finishLeaving, setFinishLeaving] = useState(false);
  const [quitLeaving, setQuitLeaving] = useState(false);
  const panelTop = useRef<HTMLDivElement>(null);
  // Each pick's closes so far, Day 1 first (today is the last); its closes before Day 1, for
  // the chart to look back on; and where each year begins among them all (by index), for
  // the chart's YTD range.
  const [prices, setPrices] = useState<Record<string, number[]>>({});
  // Each pick's rate to Canadian dollars on each of those days (1 for CAD): the cash is in
  // CAD, so a price in another currency is paid and valued at that day's rate.
  const [rates, setRates] = useState<Record<string, number[]>>({});
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [yearStarts, setYearStarts] = useState<Record<string, number[]>>({});
  // For each pick in another currency than CAD, its CAD rate on the days before Day 1 (from the
  // first the rate has) and where years begin among them, for the chart of its rate.
  const [rateHistory, setRateHistory] = useState<Record<string, { rates: number[]; yearStarts: number[] }>>({});
  // The range and scope the charts show, shared by a pick's price chart and its rate's, so the
  // two always cover the same days.
  const [chartRange, setChartRange] = useState<ChartRange>("1M");
  const [chartScope, setChartScope] = useState<"all" | "test">("all");
  // The cash, by currency (CAD to begin with), and the exchanges made, by hand or to pay.
  const [wallet, setWallet] = useState<Wallet>({ CAD: amount });
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  // A note on what was done with the cash (an exchange made to pay for shares, a sale kept in
  // its currency), keyed so each comes in anew; it goes by itself after a while.
  const [moneyNote, setMoneyNote] = useState<{ key: number; text: string } | null>(null);
  useEffect(() => {
    if (!moneyNote) return;
    const gone = window.setTimeout(() => setMoneyNote(null), 7000);
    return () => window.clearTimeout(gone);
  }, [moneyNote]);
  const [holdings, setHoldings] = useState<Record<string, Holding>>({});
  // The pick shown (its chart and its order tickets).
  const [selected, setSelected] = useState(picks[0].symbol);
  // Which way the last change of pick went (1: to a later pick, -1: an earlier one), for the
  // pick's parts to slide in from that side.
  const [swapDir, setSwapDir] = useState(1);
  // The pick being changed to while the shown one's parts fade out, before it is shown.
  const [swapTo, setSwapTo] = useState<string | null>(null);
  const swapTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(swapTimer.current), []);
  // Whether the chosen pick's general info is open (open to begin with; it can be folded).
  const [infoOpen, setInfoOpen] = useState(true);
  // How many times it has been opened, so what plays as it opens (an ETF's map) plays each time.
  const [infoOpenings, setInfoOpenings] = useState(0);
  // A trade asked for and waiting to be confirmed, and whether its card is going away.
  const [ask, setAsk] = useState<Ask | null>(null);
  const [askLeaving, setAskLeaving] = useState(false);
  // The badge that floats up from the position after a trade ("+10", "−5"), keyed so each
  // trade starts a new one; and how many errors there have been, so each one comes in anew.
  const [flash, setFlash] = useState<{ key: number; text: string; side: Side; symbol: string } | null>(null);
  const [errors, setErrors] = useState(0);
  // Each pick's two order tickets' numbers of shares, as typed (or stepped), kept until the
  // test moves on; the ticket in use (clicking the other switches to it); and the tickets'
  // boxes, which give a little bump when stepped so the change is seen.
  const [orders, setOrders] = useState<Record<string, Record<Side, string>>>({});
  const [working, setWorking] = useState<Side>("Bought");
  const boxes = { Bought: useRef<HTMLInputElement>(null), Sold: useRef<HTMLInputElement>(null) };
  // What the account was worth on the day moved on from (Day 0: the start), for the change since.
  const [before, setBefore] = useState({ day: 0, value: amount });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The start button's ripple (where it was clicked, keyed so each click starts a new one),
  // and whether its play mark is launching.
  const [ripple, setRipple] = useState<{ x: number; y: number; size: number; key: number } | null>(null);
  const [launching, setLaunching] = useState(false);
  // Whether the start panel's contents are fading away, the test about to start.
  const [leaving, setLeaving] = useState(false);
  // The days just loaded, summed up before they come in, and whether that summary is fading.
  const [recap, setRecap] = useState<Recap | null>(null);
  const [recapLeaving, setRecapLeaving] = useState(false);

  const entries = picks.map(({ symbol, from }) => ({ symbol, from }));
  // Once the test is over: the stretch of time it ran over, and each pick's real name.
  // The pick opened in the result's table, to see its price over the test (and before).
  const [resultPick, setResultPick] = useState<string | null>(null);
  // Whether the result's scale of grades is open (it starts open; its Fold / Open button folds it).
  const [gradesOpen, setGradesOpen] = useState(true);
  // How many times each pick's chart has been opened, so each opening draws its line in afresh.
  const [openings, setOpenings] = useState<Record<string, number>>({});
  const [reveal, setReveal] = useState<Awaited<ReturnType<typeof revealSandboxSet>>>(null);
  useEffect(() => {
    if (status !== "done") return;
    let live = true;
    revealSandboxSet(entries, days).then((r) => live && setReveal(r));
    return () => {
      live = false;
    };
    // Asked for once, as the test ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  // A pick's name, or the alias the player has given it.
  const { aliases } = useAliases();
  const nameOf = (symbol: string) =>
    aliases[symbol] ?? picks.find((p) => p.symbol === symbol)?.name ?? symbol;
  const day = prices[picks[0].symbol]?.length ?? 0;
  // A pick's price today, to the cent, as shown (what its shares are bought and sold at), and
  // the day before's.
  const priceOf = (symbol: string) => cents(prices[symbol]?.[day - 1] ?? 0);
  const lastOf = (symbol: string) => cents(prices[symbol]?.[day - 2] ?? history[symbol]?.at(-1) ?? 0);
  const heldOf = (symbol: string) => holdings[symbol] ?? { shares: 0, cost: 0 };
  // A pick's currency's rate to CAD today, and a share's price today in CAD.
  const rateOf = (symbol: string) => rates[symbol]?.[day - 1] ?? 1;
  const cadOf = (symbol: string) => priceOf(symbol) * rateOf(symbol);
  // Today's change of a share's worth in CAD (its price and its rate together), in percent;
  // null on Day 1.
  const cadMoveOf = (symbol: string) => {
    const then = lastOf(symbol) * (rates[symbol]?.[day - 2] ?? 1);
    return day > 1 && then ? ((cadOf(symbol) - then) / then) * 100 : null;
  };
  const invested = picks.reduce((sum, p) => sum + heldOf(p.symbol).shares * cadOf(p.symbol), 0);
  // The currencies there are: CAD, and each one a pick trades in.
  const currencies = ["CAD", ...new Set(picks.flatMap((p) => (p.currency && p.currency !== "CAD" ? [p.currency] : [])))];
  const currencyOf = (symbol: string) => picks.find((p) => p.symbol === symbol)?.currency ?? "CAD";
  // A currency's rate to CAD on a test day (by index, from 0), from a pick that trades in it,
  // in `from` (the rates loaded so far, or days just loaded).
  const fxOn = (c: string, k: number, from: Record<string, number[]> = rates) => {
    if (c === "CAD") return 1;
    const by = picks.find((p) => p.currency === c);
    const list = by ? from[by.symbol] : undefined;
    return list?.[k] ?? list?.at(-1) ?? rates[by?.symbol ?? ""]?.at(-1) ?? 1;
  };
  const fxNow = (c: string) => fxOn(c, day - 1);
  // The cash, all of it, in CAD at today's rates.
  const cashCad = Object.entries(wallet).reduce((sum, [c, v]) => sum + v * fxNow(c), 0);
  const value = cents(cashCad + invested);
  const sinceStart = ((value - amount) / amount) * 100;

  // The pick shown, and its figures.
  const pick = picks.find((p) => p.symbol === selected) ?? picks[0];
  const price = priceOf(pick.symbol);
  const rate = rateOf(pick.symbol);
  const cadPrice = cadOf(pick.symbol);
  const foreign = Boolean(pick.currency && pick.currency !== "CAD");
  const { shares, cost } = heldOf(pick.symbol);
  // How `n` shares of `symbol` would be paid for today: from the cash already in its currency,
  // then, for one not in CAD, the rest exchanged from CAD (rounded up to the cent); null when the
  // cash doesn't stretch to it.
  function paymentFor(symbol: string, n: number): Payment | null {
    const cur = currencyOf(symbol);
    const cost = cents(n * priceOf(symbol));
    const fromHeld = Math.min(wallet[cur] ?? 0, cost);
    const short = cents(cost - fromHeld);
    if (cur === "CAD") return short > 0 ? null : { cost, fromHeld, short: 0, cadPaid: 0 };
    const cadPaid = Math.ceil(short * rateOf(symbol) * 100 - 1e-6) / 100;
    return cadPaid <= (wallet.CAD ?? 0) + 1e-9 ? { cost, fromHeld, short, cadPaid } : null;
  }
  // As many shares as the cash pays for: the cash in the share's currency, and for one not in
  // CAD, the CAD it can be exchanged for too.
  const held = wallet[pick.currency ?? "CAD"] ?? 0;
  const budget = held + (foreign ? (wallet.CAD ?? 0) / rate : 0);
  let affordable = price > 0 ? Math.floor(budget / price) : 0;
  while (affordable > 0 && !paymentFor(pick.symbol, affordable)) affordable--;
  const ticket = orders[pick.symbol] ?? NO_ORDERS;
  const sizes = { Bought: sizeOf(ticket.Bought), Sold: sizeOf(ticket.Sold) };

  function start(event: React.MouseEvent<HTMLButtonElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    // A click from the keyboard has no position: the ripple spreads from the middle.
    const [x, y] = event.detail
      ? [event.clientX - box.left, event.clientY - box.top]
      : [box.width / 2, box.height / 2];
    setRipple({ x, y, size: box.width * 2.2, key: Date.now() });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLaunching(true);
      window.setTimeout(() => setLaunching(false), LAUNCH_MS);
    }
    begin();
  }

  // Starts the test: loads every pick's Day 1 price and the history before it, with the
  // loading mark showing for a moment at least, then fades the start panel's contents away
  // and moves on to trading. With reduced motion, it moves on as soon as the prices are in.
  function begin() {
    setError(null);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    startTransition(async () => {
      const [[dayOne, past]] = await Promise.all([
        Promise.all([getSandboxSetPrices(entries, 1, 1), getSandboxSetHistory(entries)]),
        pause(calm ? 0 : START_WAIT_MS),
      ]);
      if (dayOne === null || past === null) {
        setError("Those days' prices couldn't be loaded. Try again.");
        return;
      }
      if (!calm) {
        setLeaving(true);
        await pause(LEAVE_MS);
      }
      const each = <T,>(f: (symbol: string) => T) =>
        Object.fromEntries(picks.map((p) => [p.symbol, f(p.symbol)]));
      setHistory(each((s) => past[s].closes));
      setYearStarts(each((s) => past[s].yearStarts));
      setRateHistory(
        Object.fromEntries(
          picks.flatMap((p) =>
            past[p.symbol].rates
              ? [[p.symbol, { rates: past[p.symbol].rates!, yearStarts: past[p.symbol].rateYearStarts ?? [] }]]
              : [],
          ),
        ),
      );
      setBefore({ day: 0, value: amount });
      setPrices(each((s) => dayOne[s].closes));
      setRates(each((s) => dayOne[s].rates));
      setOrders({});
      setStatus("trading");
      setLeaving(false);
      setTesting(true);
      // The set-up folds away above; the page glides to the test's top as it does.
      toPanelTop();
    });
  }

  // Steps the shown pick's ticket's number of shares: by `by` (never below none), or to `to`.
  // Each step builds on the latest number, so quick clicks all count.
  function step(side: Side, { by, to }: { by?: number; to?: number }) {
    const symbol = pick.symbol;
    setOrders((o) => {
      const now = sizeOf((o[symbol] ?? NO_ORDERS)[side]);
      const next = Math.max(to ?? now + (by ?? 0), 0);
      return { ...o, [symbol]: { ...(o[symbol] ?? NO_ORDERS), [side]: next ? String(next) : "" } };
    });
    setError(null);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      boxes[side].current?.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
        { duration: 260, easing: "ease-out" },
      );
    }
  }

  // Moves on to Day `next`, in two beats: the days since are loaded and summed up first (a
  // recap over the panel: how the account went, how the picks moved, and how each position
  // did); then, as it fades, they come in (moveOn), the chart sliding on and the figures
  // counting.
  function goTo(next: number) {
    setError(null);
    startTransition(async () => {
      const loaded = await getSandboxSetPrices(entries, day + 1, next);
      if (loaded === null) {
        setError("Those days' prices couldn't be loaded. Try again.");
        return;
      }
      const steps = next - day;
      const values = Array.from({ length: steps + 1 }, (_, k) =>
        cents(
          // The cash, each currency at that day's rate, then the shares.
          Object.entries(wallet).reduce(
            (sum, [c, v]) =>
              sum +
              v *
                (k === 0
                  ? fxNow(c)
                  : fxOn(
                      c,
                      k - 1,
                      Object.fromEntries(picks.map((p) => [p.symbol, loaded[p.symbol].rates])),
                    )),
            0,
          ) +
            picks.reduce(
              (sum, p) =>
                sum +
                heldOf(p.symbol).shares *
                  (k === 0 ? cadOf(p.symbol) : loaded[p.symbol].closes[k - 1] * loaded[p.symbol].rates[k - 1]),
              0,
            ),
        ),
      );
      // A share's worth in CAD at the end of the days.
      const endOf = (s: string) => loaded[s].closes[steps - 1] * loaded[s].rates[steps - 1];
      setRecap({
        from: day,
        to: next,
        values,
        positions: picks
          .filter((p) => heldOf(p.symbol).shares > 0)
          .map((p) => ({
            name: nameOf(p.symbol),
            shares: heldOf(p.symbol).shares,
            foreign: Boolean(p.currency && p.currency !== "CAD"),
            pricePct: ((loaded[p.symbol].closes[steps - 1] - priceOf(p.symbol)) / priceOf(p.symbol)) * 100,
            pct: ((endOf(p.symbol) - cadOf(p.symbol)) / cadOf(p.symbol)) * 100,
            gain: cents(heldOf(p.symbol).shares * (endOf(p.symbol) - cadOf(p.symbol))),
          })),
        days: loaded,
      });
    });
  }

  // Closes the recap and brings its days in, with today's value to measure the change from.
  function moveOn() {
    if (!recap || recapLeaving) return;
    const done = recap;
    setRecapLeaving(true);
    window.setTimeout(() => {
      setBefore({ day: done.from, value });
      setPrices((all) =>
        Object.fromEntries(picks.map((p) => [p.symbol, [...all[p.symbol], ...done.days[p.symbol].closes]])),
      );
      setRates((all) =>
        Object.fromEntries(picks.map((p) => [p.symbol, [...all[p.symbol], ...done.days[p.symbol].rates]])),
      );
      setYearStarts((all) =>
        Object.fromEntries(
          picks.map((p) => [
            p.symbol,
            [
              ...all[p.symbol],
              ...done.days[p.symbol].yearStarts.map((d) => history[p.symbol].length + d - 1),
            ],
          ]),
        ),
      );
      setOrders({});
      setRecap(null);
      setRecapLeaving(false);
    }, RECAP_OUT_MS);
  }

  // After the test: a new set, with the same choices (the page gliding up to the picks as the
  // set below them fades and the new one comes in); or out, back to before any set.
  function tryAgain() {
    setTesting(false);
    change(setKey, () => sandboxHref({ ...choices, seed: newSeed() }));
    document.getElementById("sandbox-picks")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exit() {
    setTesting(false);
    change(setKey, () => sandboxHref(choices));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Brings the page to the top of the test's panel (as the test starts, and to the summary as
  // it ends) and keeps it there while what is around it settles (the set-up folding away above,
  // the panel easing to its new size): each frame the page eases a part of the way to where the
  // panel's top sits just under the header, so it glides there and follows it, rather than the
  // panel sliding out of sight and being fetched back. With motion reduced, it jumps there.
  function toPanelTop() {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const until = performance.now() + GROW_MS + 600;
    const step = () => {
      const el = panelTop.current;
      if (!el) return;
      const want = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      const off = el.getBoundingClientRect().top - want;
      const last = performance.now() >= until;
      if (calm || last || Math.abs(off) < 1) window.scrollBy(0, off);
      else window.scrollBy(0, off * 0.16);
      if (!calm && !last) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Finishing: the congratulating card goes, the summary comes in in its place, and the page
  // glides to the summary's top, so it is read from the start.
  function finish() {
    if (finishLeaving) return;
    setFinishLeaving(true);
    window.setTimeout(() => {
      setFinishing(false);
      setFinishLeaving(false);
      setStatus("done");
      toPanelTop();
    }, RECAP_OUT_MS);
  }

  // Leaving the test early, once the player has said so on the card that warns them: the test
  // goes back to just before it started (the same picks and choices, the Start button ready),
  // everything done in it gone; the set-up opens again above, and the page glides up to it.
  function quit(confirmed: boolean) {
    if (quitLeaving) return;
    setQuitLeaving(true);
    window.setTimeout(() => {
      setQuitting(false);
      setQuitLeaving(false);
      if (!confirmed) return;
      setStatus("ready");
      setPrices({});
      setRates({});
      setHistory({});
      setYearStarts({});
      setRateHistory({});
      setWallet({ CAD: amount });
      setExchanges([]);
      setMoneyNote(null);
      setHoldings({});
      setSelected(picks[0].symbol);
      setAsk(null);
      setFlash(null);
      setOrders({});
      setWorking("Bought");
      setBefore({ day: 0, value: amount });
      setTrades([]);
      setError(null);
      setRecap(null);
      setRipple(null);
      setTesting(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, RECAP_OUT_MS);
  }

  // Changing the pick shown: its parts fade out and slide away first (SWAP_OUT_MS), then the
  // new pick's fade and slide in from its side. Choosing again meanwhile just changes where it
  // is going; the board and the deck mark the new choice at once.
  function choosePick(symbol: string) {
    if (symbol === (swapTo ?? pick.symbol)) return;
    const at = (s: string) => picks.findIndex((p) => p.symbol === s);
    setSwapDir(at(symbol) < at(pick.symbol) ? -1 : 1);
    setError(null);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) {
      setSelected(symbol);
      return;
    }
    setSwapTo(symbol);
    window.clearTimeout(swapTimer.current);
    swapTimer.current = window.setTimeout(() => {
      setSelected(symbol);
      setSwapTo(null);
    }, SWAP_OUT_MS);
  }

  function fail(message: string) {
    setError(message);
    setErrors((n) => n + 1);
  }

  // Asks to buy or sell `n` shares of the pick shown at today's price: if it can be done, the
  // confirming card comes up; if not, why not.
  function request(side: Side, n: number) {
    if (!Number.isInteger(n) || n < 1) return fail("Enter a whole number of shares.");
    if (side === "Bought" && n > affordable)
      return fail(`Your cash stretches to at most ${affordable} ${sharesWord(affordable)} on Day ${day}.`);
    if (side === "Sold" && n > shares) return fail(`You only hold ${shares} ${sharesWord(shares)}.`);
    setError(null);
    setAsk({ symbol: pick.symbol, name: nameOf(pick.symbol), side, shares: n });
  }

  // Exchanges `paid` of one currency for another, at today's rates (by way of CAD), the amount
  // got rounded down to the cent; and says so.
  function exchange(from: string, to: string, paid: number) {
    const amountPaid = cents(Math.min(paid, wallet[from] ?? 0));
    if (from === to || amountPaid <= 0) return;
    const got = Math.floor(((amountPaid * fxNow(from)) / fxNow(to)) * 100 + 1e-6) / 100;
    setWallet((w) => ({
      ...w,
      [from]: cents((w[from] ?? 0) - amountPaid),
      [to]: cents((w[to] ?? 0) + got),
    }));
    setExchanges((e) => [...e, { day, from, to, paid: amountPaid, got, auto: false }]);
    setMoneyNote({ key: Date.now(), text: `Exchanged ${nativeText(amountPaid, from)} for ${nativeText(got, to)}.` });
  }

  // Closes the confirming card; confirmed, the trade is made as it goes, for good.
  function settle(confirmed: boolean) {
    if (!ask || askLeaving) return;
    const done = ask;
    setAskLeaving(true);
    window.setTimeout(() => {
      if (confirmed) {
        const { symbol, name, side, shares: n } = done;
        const at = priceOf(symbol);
        const fx = rateOf(symbol);
        const cur = currencyOf(symbol);
        const amountThere = cents(n * at); // in the share's currency
        const held = heldOf(symbol);
        const average = held.shares ? held.cost / held.shares : 0;
        if (side === "Bought") {
          // Paid from the cash in its currency first, the rest exchanged from CAD (and said so).
          const pay = paymentFor(symbol, n);
          if (!pay) {
            fail("Your cash no longer stretches to that.");
            setAsk(null);
            setAskLeaving(false);
            return;
          }
          setWallet((w) => {
            const next = { ...w };
            if (pay.short > 0) {
              next.CAD = cents((next.CAD ?? 0) - pay.cadPaid);
              next[cur] = cents((next[cur] ?? 0) + pay.short);
            }
            next[cur] = cents((next[cur] ?? 0) - pay.cost);
            return next;
          });
          if (pay.short > 0) {
            setExchanges((e) => [...e, { day, from: "CAD", to: cur, paid: pay.cadPaid, got: pay.short, auto: true }]);
            setMoneyNote({
              key: Date.now(),
              text: `Exchanged ${money.format(pay.cadPaid)} CAD for ${nativeText(pay.short, cur)} at ${rateText(fx, cur)}${
                pay.fromHeld > 0 ? `, with ${nativeText(pay.fromHeld, cur)} you already had,` : ""
              } to pay for ${n} ${sharesWord(n)}.`,
            });
          } else if (cur !== "CAD") {
            setMoneyNote({ key: Date.now(), text: `Paid ${nativeText(pay.cost, cur)} from your ${cur} cash.` });
          }
        } else {
          // Kept in the share's currency, not exchanged back: that is for the player to do.
          setWallet((w) => ({ ...w, [cur]: cents((w[cur] ?? 0) + amountThere) }));
          if (cur !== "CAD")
            setMoneyNote({
              key: Date.now(),
              text: `Sold for ${nativeText(amountThere, cur)}, kept in ${cur}. Exchange it to CAD whenever you like.`,
            });
        }
        // What the shares cost, in CAD at the day's rate (for the average paid).
        const total = cents(amountThere * fx);
        setHoldings((h) => ({
          ...h,
          [symbol]:
            side === "Bought"
              ? { shares: held.shares + n, cost: held.cost + total }
              : { shares: held.shares - n, cost: held.shares === n ? 0 : held.cost - n * average },
        }));
        setTrades((t) => [...t, { symbol, name, day, side, shares: n, price: at, rate: fx }]);
        setFlash({ key: Date.now(), text: `${side === "Bought" ? "+" : "−"}${n}`, side, symbol });
      }
      setAsk(null);
      setAskLeaving(false);
    }, RECAP_OUT_MS);
  }

  // The panel, by stage. It is the same box throughout, easing to each stage's height
  // (EaseHeight) as that stage's parts rise in one after another.
  return (
    <EaseHeight changeKey={status} duration={GROW_MS}>
      {panel()}
    </EaseHeight>
  );

  function panel() {
    if (status === "ready") {
      return (
        <div className="rise-in mt-5 rounded-xl bg-slate-50 p-5">
          <div
            className={`flex flex-wrap items-center gap-4 transition duration-[350ms] ease-out ${
              leaving ? "-translate-y-1 opacity-0 blur-[2px]" : ""
            }`}
          >
            <button type="button" onClick={start} disabled={pending} aria-busy={pending} className={START}>
              {ripple && (
                <span
                  key={ripple.key}
                  aria-hidden
                  className="start-ripple pointer-events-none absolute rounded-full bg-white/35"
                  style={{ left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size }}
                />
              )}
              <span className="grid size-4 place-items-center">
                {launching ? (
                  <StartMark className="start-mark-launch size-3.5" />
                ) : pending ? (
                  <DiamondLoader className="size-4" />
                ) : (
                  <StartMark className="size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.3,1.6,0.5,1)] motion-safe:group-hover:translate-x-[3px]" />
                )}
              </span>
              {pending ? "Starting…" : "Start the test"}
            </button>
            <p
              className={`min-w-0 flex-1 text-sm text-slate-600 transition-opacity duration-300 ${pending ? "opacity-50" : ""}`}
            >
              Day 1&apos;s prices will be shown. Buy as many shares of your {picks.length} picks as you like
              with your {money.format(amount)}, then go day by day to Day {days}.
            </p>
            {error && <p className="w-full text-sm text-red-600">{error}</p>}
          </div>
        </div>
      );
    }

    if (status === "done") {
      const result = verdict(sinceStart);
      // How each pick did over the test, and what trading it made (sales and what is still
      // held, less what was paid).
      const rows = picks.map((p) => {
        const first = prices[p.symbol][0];
        const last = priceOf(p.symbol);
        // Its worth in CAD on Day 1 and at the end: the price and its currency's rate together.
        const firstRate = rates[p.symbol]?.[0] ?? 1;
        const lastRate = rateOf(p.symbol);
        const firstCad = first * firstRate;
        const lastCad = cadOf(p.symbol);
        const traded = trades.filter((t) => t.symbol === p.symbol);
        const made =
          traded.reduce((sum, t) => sum + (t.side === "Sold" ? 1 : -1) * cents(t.shares * t.price * t.rate), 0) +
          heldOf(p.symbol).shares * lastCad;
        return {
          ...p,
          first,
          last,
          firstRate,
          lastRate,
          firstCad,
          lastCad,
          pct: ((last - first) / first) * 100,
          cadPct: ((lastCad - firstCad) / firstCad) * 100,
          made: traded.length ? cents(made) : null,
        };
      });
      // The account's value at the close of each day of the test: the cash and shares after
      // that day's trades, at that day's prices.
      const valueByDay = Array.from({ length: days }, (_, k) => {
        // The cash by currency then, from the trades (in each share's currency) and exchanges
        // made by then, each at that day's rate; and the shares then, at that day's prices.
        const walletThen: Wallet = { CAD: amount };
        const owned: Record<string, number> = {};
        for (const t of trades) {
          if (t.day > k + 1) continue;
          const sign = t.side === "Bought" ? 1 : -1;
          const cur = currencyOf(t.symbol);
          walletThen[cur] = (walletThen[cur] ?? 0) - sign * cents(t.shares * t.price);
          owned[t.symbol] = (owned[t.symbol] ?? 0) + sign * t.shares;
        }
        for (const e of exchanges) {
          if (e.day > k + 1) continue;
          walletThen[e.from] = (walletThen[e.from] ?? 0) - e.paid;
          walletThen[e.to] = (walletThen[e.to] ?? 0) + e.got;
        }
        const cashThen = Object.entries(walletThen).reduce((sum, [c, v]) => sum + v * fxOn(c, k), 0);
        return Object.entries(owned).reduce(
          (sum, [symbol, n]) =>
            // At the price to the cent, as shares are traded and valued in the test.
            sum + n * cents(prices[symbol]?.[k] ?? priceOf(symbol)) * (rates[symbol]?.[k] ?? rateOf(symbol)),
          cashThen,
        );
      });
      const dayName = (k: number) =>
        k === 0 && reveal
          ? `Day 1 · ${longDay(reveal.first)}`
          : k === days - 1 && reveal
            ? `Day ${days} · ${longDay(reveal.last)}`
            : `Day ${k + 1}`;
      return (
        <div ref={panelTop} className="rise-in mt-5 scroll-mt-24 rounded-xl bg-slate-50 p-5">
          {/* The grade, marked in red as on a test paper: a paper with a tick beside the result,
              and the letter on a tile, which opens what the grades mean. */}
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-200">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6"
              >
                <path d="M6 3h8.5L19 7.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v5h5M8 12h5M8 15.5h4" />
                <path
                  className="grade-tick"
                  pathLength={1}
                  d="m13.5 16.5 2 2 3.5-4"
                  stroke="#dc2626"
                  strokeWidth="1.9"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Result · your grade
              </p>
              <p className="result-pop mt-0.5 text-2xl font-bold text-slate-900">{result.label}</p>
              <p className="text-sm text-slate-600">{result.note}</p>
            </div>
            {/* The grade on its tile; under it, the button that folds the scale of grades. */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <span
                aria-label={`Grade ${result.grade}`}
                className={`grade-tile flex size-16 flex-col items-center justify-center rounded-2xl shadow-md shadow-slate-900/10 ring-1 ${
                  result.grade === "S+" ? "bg-slate-900 ring-slate-700" : "bg-white ring-slate-200"
                }`}
              >
                <span
                  className={`text-[9px] font-semibold uppercase tracking-wider ${result.grade === "S+" ? "text-slate-400" : "text-slate-500"}`}
                >
                  Grade
                </span>
                <GradeLetter grade={result.grade} className={`text-2xl ${lookOf(result.grade).text}`} />
              </span>
              <FoldButton
                open={gradesOpen}
                controls="sandbox-grades"
                onClick={() => setGradesOpen(!gradesOpen)}
                className="text-xs"
              />
            </div>
          </div>
          {/* Every grade, worst on the left to best on the right, in their tiers (F; C; B; A; S; S+),
              each with the change in value it stands for, the one earned filled in its colour.
              Every grade's box is the same width (a tier as wide as its grades), so the boxes
              and their ranges line up. Open to begin with; its Fold / Open button folds it. */}
          <div
            id="sandbox-grades"
            className="legend-fold"
            data-closed={gradesOpen ? undefined : ""}
            inert={!gradesOpen}
          >
            <div>
              <ol aria-label="Grades" className="flex items-stretch gap-1.5 pt-3">
                {[["F"], ["C"], ["B−", "B", "B+"], ["A−", "A"], ["S"], ["S+"]].map((tier, t) => (
                  <li
                    key={tier[0]}
                    className="legend-row flex min-w-0 basis-0 gap-0.5 rounded-xl bg-white p-0.5 shadow-sm ring-1 ring-slate-200"
                    style={
                      {
                        "--d": `${gradesOpen ? 80 + t * 50 : (5 - t) * 30}ms`,
                        flexGrow: tier.length,
                      } as React.CSSProperties
                    }
                  >
                    {tier.map((grade) => {
                      const g = GRADES.find((x) => x.grade === grade)!;
                      const mine = grade === result.grade;
                      return (
                        <span
                          key={grade}
                          title={`${g.label}: ${g.note}`}
                          className={`flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-[0.6rem] px-1 py-2 transition-colors duration-200 ${
                            mine
                              ? `${lookOf(grade).fill} shadow-sm`
                              : grade === "S+"
                                ? "bg-slate-900 text-slate-300"
                                : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <GradeLetter
                            grade={grade}
                            className={`text-base ${mine && grade !== "S+" ? "text-white" : lookOf(grade).text}`}
                          />
                          <span
                            className={`whitespace-nowrap text-[10px] leading-none tabular-nums ${mine ? "text-white/85" : grade === "S+" ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {g.range}
                          </span>
                        </span>
                      );
                    })}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          {/* The stretch of time it ran over, now that it can be told. */}
          <div className="mt-3 flex min-h-9 flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">The period</span>
            {reveal ? (
              <span key="period" className="text-fade-in font-semibold text-slate-900">
                {`${longDay(reveal.first)} to ${longDay(reveal.last)}`}
                <span className="ml-2 font-normal text-slate-500">{`${days} trading days`}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-slate-500">
                <DiamondLoader className="size-3" />
                Revealing…
              </span>
            )}
          </div>
          <dl {...enter(0)} className="rise-in mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Stat label="Started with" value={money.format(amount)} />
            <Stat label={`Worth on Day ${days}`} value={<Tween value={value} format={moneyText} />} />
            <Stat
              label="Return"
              value={<span className={tone(sinceStart)}>{pctText(sinceStart)}</span>}
              note={signed(value - amount, money.format(Math.abs(value - amount)))}
            />
          </dl>
          {/* What the account was worth each day: gains above the starting line, losses below. */}
          <div {...enter(1)} className="rise-in mt-5 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Your account over the test</p>
            <p className="text-xs text-slate-500">
              Its value at each day&apos;s close, with your buys (▲) and sales (▼) marked under it. Point
              along it for any day.
            </p>
            <div className="mt-3">
              <ResultChart
                values={valueByDay}
                format={moneyText}
                dayLabel={dayName}
                markers={trades.map((t) => ({ i: t.day - 1, side: t.side }))}
              />
            </div>
          </div>
          {/* How each pick did, and what trading it made. */}
          <div
            {...enter(1)}
            className="rise-in mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Pick, revealed</th>
                  <th className="px-3 py-2 text-right font-medium">Start</th>
                  <th className="px-3 py-2 text-right font-medium">End</th>
                  <th className="px-3 py-2 text-right font-medium">Over the test</th>
                  <th className="px-3 py-2 text-right font-medium">Your trading</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = resultPick === r.symbol;
                  // Its closes before the test, for context (twice the test's length, at least
                  // 40 days, as far as there are any), then the test's own.
                  const before = history[r.symbol] ?? [];
                  const context = Math.min(before.length, Math.max(days * 2, 40));
                  const closes = [...before.slice(before.length - context), ...(prices[r.symbol] ?? [])];
                  return (
                    <Fragment key={r.symbol}>
                      <tr
                        tabIndex={0}
                        onClick={() => {
                          if (!open) setOpenings((o) => ({ ...o, [r.symbol]: (o[r.symbol] ?? 0) + 1 }));
                          setResultPick(open ? null : r.symbol);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          if (!open) setOpenings((o) => ({ ...o, [r.symbol]: (o[r.symbol] ?? 0) + 1 }));
                          setResultPick(open ? null : r.symbol);
                        }}
                        aria-expanded={open}
                        className="result-row group kind-hover cursor-pointer border-t border-slate-100 outline-none focus-visible:bg-slate-50"
                        style={{ "--accent": r.color } as React.CSSProperties}
                      >
                        <td className="px-3 py-2">
                          {/* What it was called in the test, then what it really is; a chevron that
                              points down when its chart is open. */}
                          <span className="flex items-center gap-2">
                            <svg
                              aria-hidden
                              viewBox="0 0 12 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`size-3 shrink-0 text-slate-400 transition duration-300 ease-out group-hover:text-slate-900 ${
                                open ? "rotate-90 text-slate-900" : "motion-safe:group-hover:translate-x-0.5"
                              }`}
                            >
                              <path d="M4.5 2.5 8 6 4.5 9.5" />
                            </svg>
                            <span
                              className="kind-badge grid size-7 shrink-0 place-items-center rounded-md shadow-sm"
                              style={{ background: r.color, color: r.mark, ["--badge" as string]: r.color }}
                            >
                              <KindMark kind={r.kind} className="size-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-xs text-slate-500">{nameOf(r.symbol)}</span>
                              {reveal ? (
                                <span key="real" className="text-fade-in block font-semibold text-slate-900">
                                  {reveal.names[r.symbol] ?? r.symbol}
                                  <span className="ml-1.5 text-xs font-normal text-slate-500">
                                    {r.symbol}
                                  </span>
                                </span>
                              ) : (
                                <span className="block h-4 w-32 animate-pulse rounded bg-slate-100" />
                              )}
                            </span>
                          </span>
                        </td>
                        {/* Its price on Day 1 and at the end; for one in another currency, under
                            each, that day's exchange rate and so the price in CAD. */}
                        {(
                          [
                            [r.first, r.firstRate, r.firstCad, "text-slate-700"],
                            [r.last, r.lastRate, r.lastCad, "font-semibold text-slate-900"],
                          ] as const
                        ).map(([at, fx, inCad, look], i) => (
                          <td key={i} className="whitespace-nowrap px-3 py-2 text-right">
                            <span className={`block ${look}`}>{nativeText(at, r.currency)}</span>
                            {r.currency && r.currency !== "CAD" && (
                              <>
                                <span className="block text-[11px] text-slate-400">{rateText(fx, r.currency)}</span>
                                <span className="block text-[11px] font-semibold text-slate-700">
                                  {`${money.format(inCad)} CAD`}
                                </span>
                              </>
                            )}
                          </td>
                        ))}
                        {/* Its price's change alone; for one in another currency, under it, the
                            change with the exchange rate's move too (what it did in CAD). */}
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {r.currency && r.currency !== "CAD" ? (
                            <>
                              <span className={`block ${tone(r.pct)}`}>
                                <span className="text-[11px] text-slate-400">Price </span>
                                {pctText(r.pct)}
                              </span>
                              <span className={`block ${tone(r.cadPct)}`}>
                                <span className="text-[11px] text-slate-400">With FX </span>
                                {pctText(r.cadPct)}
                              </span>
                            </>
                          ) : (
                            <span className={tone(r.pct)}>{pctText(r.pct)}</span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 text-right ${r.made === null ? "text-slate-400" : tone(r.made)}`}
                        >
                          {r.made === null ? "—" : changeText(r.made)}
                        </td>
                      </tr>
                      <tr aria-hidden={!open}>
                        <td colSpan={5} className="p-0">
                          <div className="legend-fold" data-closed={open ? undefined : ""} inert={!open}>
                            <div>
                              <div className="border-t border-slate-100 bg-slate-50/60 px-3 pb-4 pt-3">
                                <p className="text-xs text-slate-500">
                                  {`${reveal?.names[r.symbol] ?? nameOf(r.symbol)}: its price before and over the test, the test shaded.`}
                                </p>
                                <div className="mt-2">
                                  <ResultChart
                                    key={openings[r.symbol] ?? 0}
                                    values={closes}
                                    band={[context, closes.length - 1]}
                                    bandLabel="Your test"
                                    format={moneyText}
                                    dayLabel={(k) =>
                                      k < context
                                        ? `${context - k} ${context - k === 1 ? "day" : "days"} before`
                                        : dayName(k - context)
                                    }
                                    markers={trades
                                      .filter((t) => t.symbol === r.symbol)
                                      .map((t) => ({ i: context + t.day - 1, side: t.side }))}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* What next: a new set with the same choices, or out, back to before any set. */}
          <div {...enter(2)} className="rise-in mt-5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={tryAgain} className={`${DARK} ${ACTION}`}>
              <RetryMark className="size-4" />
              Try a new set
            </button>
            <button type="button" onClick={exit} className={`${LIGHT} ${ACTION}`}>
              <ExitMark className="size-4" />
              Exit
            </button>
            <p className="text-xs text-slate-500">
              A new set: {picks.length} more picks, from another stretch of time.
            </p>
          </div>
        </div>
      );
    }

    const sinceBefore = cents(value - before.value);
    const left = days - day;
    const canTrade = !pending && !recap && !ask;
    // Moving on: a day, a week or a month, each while that many days are left.
    const steps = [
      { label: "Next day", days: 1, Mark: DayMark },
      { label: "Next week", days: 5, Mark: WeekMark },
      { label: "Next month", days: 21, Mark: MonthMark },
    ].filter((s) => s.days <= left);
    return (
      <div ref={panelTop} className="rise-in relative mt-5 scroll-mt-24 rounded-xl bg-slate-50 p-5">
        <div {...enter(0)}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              {/* A calendar page, its date turning over as the days go by. */}
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-slate-900 shadow-sm ring-1 ring-slate-200">
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
                  <path d="M4.5 4.5h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1ZM3.5 8.5h13M7 2.5v4M13 2.5v4" />
                  <path key={day} className="calendar-tick" d="M7.5 12.5h2M11 12.5h1.5" />
                </svg>
              </span>
              <span>
                Day <Tween value={day} format={dayText} />{" "}
                <span className="font-normal text-slate-500">of {days}</span>
              </span>
            </p>
            <p className="text-sm text-slate-500">
              Account{" "}
              <span className="text-lg font-semibold tabular-nums text-slate-900">
                <Tween value={value} format={moneyText} />
              </span>
            </p>
          </div>
          {/* How far through the test, filling up day by day. */}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-900 transition-[width] duration-[600ms] ease-out"
              style={{ width: `${(day / days) * 100}%` }}
            />
          </div>
        </div>

        {/* The picks: each one's price, the day's change and the shares held; choosing one
            shows its chart and its order tickets below. */}
        <div {...enter(1)} className="rise-in mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-900">
              Investment universe
            </p>
            <p className="text-[11px] text-slate-500">
              The listings you can trade. Choose one to trade it; give it a name of your own with{" "}
              <span className="font-semibold text-slate-500">✎ Add alias</span>.
            </p>
          </div>
          <div className="mt-2">
            <PickBoard
              chosen={swapTo ?? pick.symbol}
              onChoose={choosePick}
              picks={picks.map((p) => {
                const then = lastOf(p.symbol);
                const now = priceOf(p.symbol);
                return {
                  symbol: p.symbol,
                  name: nameOf(p.symbol),
                  kind: p.kind,
                  color: p.color,
                  ink: p.mark,
                  naics: NAICS_GROUPS.find((g) => g.name === p.sector)?.code ?? null,
                  country: p.country,
                  fund: p.kind === "ETF",
                  currency: p.currency,
                  price: now,
                  rate: rateOf(p.symbol),
                  cadMove: cadMoveOf(p.symbol),
                  move: day > 1 && then ? ((now - then) / then) * 100 : null,
                  held: heldOf(p.symbol).shares,
                };
              })}
            />
          </div>
          {/* What the badges mean, as on the Search page: open to begin with, the chosen
              pick's mark and colour picked out. */}
          <BadgeLegend
            sector={null}
            industry={null}
            mark={pick.kind}
            colour={NAICS_GROUPS.find((g) => g.name === pick.sector)?.code ?? null}
          />
        </div>

        {/* The pick shown: its name, its general figures and its chart. Choosing another, its
            parts slide in from that side as they fade up (.pick-swap-in), and the space they
            take eases to the new size rather than jumping. */}
        <div {...enter(2)} className="rise-in mt-5">
          <EaseHeight changeKey={pick.symbol} duration={600}>
            <div
              key={pick.symbol}
              className={`pick-swap-in ${swapTo ? "pick-swap-out" : ""}`}
              style={{ "--dir": swapDir } as React.CSSProperties}
            >
              <div className="flex items-baseline justify-between gap-4">
                <AliasName
                  symbol={pick.symbol}
                  name={pick.name}
                  className="text-base font-semibold text-slate-900"
                />
                {!foreign && (
                  <p className="text-sm text-slate-500">
                    Price{" "}
                    <span className="text-lg font-semibold tabular-nums text-slate-900">
                      <Tween value={price} format={moneyText} />
                    </span>
                    {pick.currency && (
                      <span className="ml-1 rounded bg-slate-200 px-1 py-px text-[10px] font-bold text-slate-700">
                        {pick.currency}
                      </span>
                    )}
                  </p>
                )}
              </div>
              {/* In another currency: its price there, today's exchange rate, and so its price in
                  CAD; then today's change on its price alone, and with the rate's move too. */}
              {foreign && (
                <FxStrip
                  day={day}
                  price={price}
                  currency={pick.currency}
                  rate={rate}
                  pricePct={day > 1 && lastOf(pick.symbol) ? ((price - lastOf(pick.symbol)) / lastOf(pick.symbol)) * 100 : null}
                  cadPct={cadMoveOf(pick.symbol)}
                />
              )}
              {/* Its general info, as the Search page's About has it (but with its name hidden):
                open to begin with; folded, a line saying it opens. */}
              <PickInfo
                pick={pick}
                day={day}
                open={infoOpen}
                openings={infoOpenings}
                onToggle={() => {
                  if (!infoOpen) setInfoOpenings((n) => n + 1);
                  setInfoOpen(!infoOpen);
                }}
              />
              <SandboxChart
                symbol={pick.symbol}
                history={history[pick.symbol] ?? []}
                prices={prices[pick.symbol] ?? []}
                yearStarts={yearStarts[pick.symbol] ?? []}
                trades={trades.filter((t) => t.symbol === pick.symbol)}
                // A price in another currency, as its figure alone (its currency is named above).
                format={foreign ? (x) => plainText(x, pick.currency) : undefined}
                range={chartRange}
                onRange={setChartRange}
                scope={chartScope}
                onScope={setChartScope}
              />
              {/* In another currency than CAD: its rate to CAD over the same days, folded to
                  begin with. */}
              {foreign && rateHistory[pick.symbol] && (
                <FxChart
                  symbol={pick.symbol}
                  day={day}
                  currency={pick.currency}
                  history={rateHistory[pick.symbol].rates}
                  rates={rates[pick.symbol] ?? []}
                  // Where years begin: the history's, then the test's (as the price chart has
                  // them, moved to the rate's history's length).
                  yearStarts={[
                    ...rateHistory[pick.symbol].yearStarts,
                    ...(yearStarts[pick.symbol] ?? [])
                      .filter((i) => i >= (history[pick.symbol]?.length ?? 0))
                      .map((i) => i - (history[pick.symbol]?.length ?? 0) + rateHistory[pick.symbol].rates.length),
                  ]}
                  range={chartRange}
                  onRange={setChartRange}
                  scope={chartScope}
                  onScope={setChartScope}
                />
              )}
            </div>
          </EaseHeight>
        </div>

        {/* Where the money is: the cash, what is invested, the account, and the change since
            the last move; then what is held, as a deck of cards. */}
        <div {...enter(3)} className="rise-in mt-5 border-t border-slate-200 pt-4">
          <dl className="mt-0 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat
              label="Cash"
              value={
                <span className="block">
                  {/* Each currency held (CAD always), with its flag. */}
                  {currencies
                    .filter((c) => c === "CAD" || Math.abs(wallet[c] ?? 0) >= 0.005)
                    .map((c) => (
                      <span key={c} className="flex items-center gap-1.5">
                        <Flag code={c} className="size-3.5" />
                        <Tween value={wallet[c] ?? 0} format={(x) => nativeText(x, c === "CAD" ? "CAD" : c)} />
                        {c === "CAD" && <span className="text-[10px] font-bold text-slate-500">CAD</span>}
                      </span>
                    ))}
                </span>
              }
              note={
                currencies.some((c) => c !== "CAD" && Math.abs(wallet[c] ?? 0) >= 0.005) ? (
                  <>
                    {"≈ "}
                    <Tween value={cashCad} format={moneyText} />
                    {" in CAD, all of it"}
                  </>
                ) : undefined
              }
            />
            <Stat label="Invested" value={<Tween value={invested} format={moneyText} />} />
            <Stat
              label="Account value"
              value={<Tween value={value} format={moneyText} />}
              note={
                <span className={`transition-colors duration-500 ${tone(sinceStart)}`}>
                  <Tween value={sinceStart} format={pctText} /> since Day 1
                </span>
              }
            />
            <Stat
              label={before.day ? `Since Day ${before.day}` : "Since the start"}
              value={
                <span className={`transition-colors duration-500 ${tone(sinceBefore)}`}>
                  <Tween value={sinceBefore} format={changeText} />
                </span>
              }
              note={<Tween value={before.value ? (sinceBefore / before.value) * 100 : 0} format={pctText} />}
            />
          </dl>

          {/* What was just done with the cash (an exchange made to pay, a sale kept in its
              currency), coming in anew each time and going by itself. */}
          {moneyNote && (
            <p
              key={moneyNote.key}
              role="status"
              className="notice-in mt-3 flex items-start gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-md"
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-px size-4 shrink-0"
              >
                <path d="M3.5 7.5h12M12.5 4.5l3 3-3 3M16.5 12.5h-12M7.5 9.5l-3 3 3 3" />
              </svg>
              <span className="min-w-0 flex-1">{moneyNote.text}</span>
              <button
                type="button"
                onClick={() => setMoneyNote(null)}
                aria-label="Dismiss"
                className="shrink-0 rounded px-1 text-white/70 hover:text-white"
              >
                ×
              </button>
            </p>
          )}

          {/* Exchanging currencies, whenever the player likes, at the day's rates. */}
          {currencies.length > 1 && (
            <ExchangePanel
              day={day}
              wallet={wallet}
              currencies={currencies}
              fxNow={fxNow}
              exchanges={exchanges}
              usable={canTrade}
              onExchange={exchange}
            />
          )}

          {/* What is held, as a deck of cards (HoldingsDeck); clicking one chooses its pick. */}
          <div className="mt-5">
            <HoldingsDeck
              cards={picks
                .filter((p) => heldOf(p.symbol).shares > 0)
                .map((p) => ({
                  symbol: p.symbol,
                  name: nameOf(p.symbol),
                  short: aliases[p.symbol] ?? p.kind.replace(/(.)Company$/, "$1"),
                  number: p.name.match(/\((\d+)\)$/)?.[1] ?? "",
                  kind: p.kind,
                  color: p.color,
                  ink: p.ink,
                  mark: p.mark,
                  shares: heldOf(p.symbol).shares,
                  value: heldOf(p.symbol).shares * cadOf(p.symbol),
                  gain: cents(heldOf(p.symbol).shares * cadOf(p.symbol) - heldOf(p.symbol).cost),
                }))}
              selected={swapTo ?? pick.symbol}
              onSelect={choosePick}
            />
          </div>
        </div>

        {/* What is held of the pick shown, then trading it: likewise, a beat behind. */}
        <div {...enter(4)} className="rise-in mt-5">
          <EaseHeight changeKey={pick.symbol} duration={600}>
            <div
              key={pick.symbol}
              className={`pick-swap-in ${swapTo ? "pick-swap-out" : ""}`}
              style={{ "--dir": swapDir, animationDelay: "70ms" } as React.CSSProperties}
            >
              {/* What is held of it: how many shares, what they cost on average, and how they're
                doing; and the badge that floats up after a trade. */}
              <div className="relative mt-4 rounded-lg bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                {flash && flash.symbol === pick.symbol && (
                  <span
                    key={flash.key}
                    aria-hidden
                    className={`trade-flash pointer-events-none absolute -top-2 right-3 rounded-full px-1.5 text-xs font-bold ${
                      flash.side === "Bought" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    }`}
                  >
                    {flash.text}
                  </span>
                )}
                {shares > 0 ? (
                  <p key="holding" className="text-fade-in">
                    You hold{" "}
                    <span className="font-semibold tabular-nums text-slate-900">
                      <Tween value={shares} format={countText} /> {sharesWord(shares)}
                    </span>
                    , bought at an average of{" "}
                    <span className="font-semibold tabular-nums text-slate-900">
                      <Tween value={cost / shares} format={moneyText} />
                    </span>{" "}
                    each: worth{" "}
                    <span className="font-semibold tabular-nums text-slate-900">
                      <Tween value={shares * cadPrice} format={moneyText} />
                    </span>
                    {` on Day ${day}, `}
                    <span
                      className={`font-semibold tabular-nums transition-colors duration-500 ${tone(shares * cadPrice - cost)}`}
                    >
                      <Tween value={shares * cadPrice - cost} format={changeText} />
                    </span>{" "}
                    {foreign ? "on what you paid, in CAD (the exchange rate's moves included)." : "on what you paid."}
                  </p>
                ) : (
                  <p key="none" className="text-fade-in">
                    {`You hold none of it. Day ${day}'s price is `}
                    <span className="font-semibold tabular-nums text-slate-900">
                      {nativeText(price, pick.currency)}
                    </span>
                    {foreign && ` (about ${money.format(cadPrice)} CAD)`}
                    : you can afford up to{" "}
                    <span className="font-semibold tabular-nums text-slate-900">
                      {affordable.toLocaleString("en-CA")} {sharesWord(affordable)}
                    </span>
                    .
                  </p>
                )}
              </div>
            </div>

            {/* Trading it at the day's price: a ticket to buy and a ticket to sell, side by side
              (where the money is shows once, above the holdings). */}
            <div className="mt-3 rounded-lg bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["Bought", "Sold"] as const).map((side) => (
                  <OrderTicket
                    key={side}
                    side={side}
                    text={ticket[side]}
                    size={sizes[side]}
                    most={side === "Bought" ? affordable : shares}
                    price={price}
                    format={(x) => nativeText(x, pick.currency)}
                    box={boxes[side]}
                    locked={working !== side}
                    onActivate={() => {
                      setWorking(side);
                      setError(null);
                    }}
                    usable={canTrade}
                    onText={(text) => {
                      setOrders((o) => ({
                        ...o,
                        [pick.symbol]: { ...(o[pick.symbol] ?? NO_ORDERS), [side]: text },
                      }));
                      setError(null);
                    }}
                    onStep={(change) => step(side, change)}
                    onReview={() => request(side, sizes[side])}
                  />
                ))}
              </div>
              <Notice message={error} attempt={errors} />
            </div>
          </EaseHeight>
        </div>

        {/* Every trade so far, to read by holding and by day (TradeLog). */}
        <div {...enter(5)} className="rise-in mt-5">
          <TradeLog
            trades={trades}
            looks={Object.fromEntries(
              picks.map((p) => [
                p.symbol,
                { kind: p.kind, color: p.color, ink: p.mark, currency: p.currency },
              ]),
            )}
            nameOf={nameOf}
          />
        </div>

        {/* Moving on: by a day, a week or a month while that many are left; then finishing. */}
        <div
          {...enter(5)}
          className="rise-in mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4"
        >
          {/* Leaving the test early (it asks first: nothing done in it is kept). */}
          <button
            type="button"
            onClick={() => setQuitting(true)}
            disabled={pending || recap !== null || ask !== null}
            className={`${LIGHT} ${ACTION} mr-auto`}
          >
            <ExitMark className="size-4" />
            Exit test
          </button>
          {pending && (
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <DiamondLoader className="size-3.5" />
              Loading…
            </span>
          )}
          {steps.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => goTo(day + s.days)}
              disabled={pending || recap !== null || ask !== null}
              className={`${i === 0 ? DARK : LIGHT} ${ACTION}`}
            >
              <s.Mark className="size-4" />
              {s.label}
            </button>
          ))}
          {left === 0 && (
            <button type="button" onClick={() => setFinishing(true)} className={`${DARK} ${ACTION}`}>
              <FinishMark className="size-4" />
              Finish the test
            </button>
          )}
        </div>
        {recap && <RecapCard recap={recap} leaving={recapLeaving} onDone={moveOn} />}
        {finishing && (
          <FinishCard days={days} start={amount} end={value} leaving={finishLeaving} onDone={finish} />
        )}
        {quitting && <QuitCard day={day} trades={trades.length} leaving={quitLeaving} onDone={quit} />}
        {ask && (
          <ConfirmTrade
            ask={ask}
            day={day}
            price={priceOf(ask.symbol)}
            rate={rateOf(ask.symbol)}
            currency={picks.find((p) => p.symbol === ask.symbol)?.currency ?? null}
            cash={cashCad}
            cad={wallet.CAD ?? 0}
            held={wallet[currencyOf(ask.symbol)] ?? 0}
            payment={ask.side === "Bought" ? paymentFor(ask.symbol, ask.shares) : null}
            shares={heldOf(ask.symbol).shares}
            leaving={askLeaving}
            onDone={settle}
          />
        )}
      </div>
    );
  }
}

// For a pick in another currency than CAD, under its name: its price in that currency, times
// the day's exchange rate, makes its price in CAD, as three tiles; then today's change, on its
// price alone and with the exchange rate's move too (what a holding of it did in CAD). The
// figures count to each new day's.
function FxStrip({
  day,
  price,
  currency,
  rate,
  pricePct,
  cadPct,
}: {
  day: number;
  price: number;
  currency: string | null;
  rate: number;
  pricePct: number | null;
  cadPct: number | null;
}) {
  const tile = "min-w-0 flex-1 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200";
  const sign = "shrink-0 self-center text-sm font-semibold text-slate-400";
  return (
    <div className="mt-3 text-sm tabular-nums">
      <div className="flex items-stretch gap-2">
        <div className={tile}>
          <p
            className="flex items-center gap-1.5 text-[11px] text-slate-500"
            title={currency ? `${currencyName(currency)}${usedIn(currency) ? `, used in ${usedIn(currency)}` : ""}` : undefined}
          >
            <span className="truncate">Price in {currency}</span>
          </p>
          <p className="font-semibold text-slate-900">
            <Tween value={price} format={(x) => plainText(x, currency)} />
            <span className="ml-1 text-[10px] font-bold text-slate-500">{currency}</span>
          </p>
        </div>
        <span aria-hidden className={sign}>
          ×
        </span>
        <div className={tile}>
          <p className="text-[11px] text-slate-500">Exchange rate, Day {day}</p>
          <p className="font-semibold text-slate-900">
            <Tween value={rate} format={(x) => rateText(x, currency)} />
          </p>
        </div>
        <span aria-hidden className={sign}>
          =
        </span>
        <div className={`${tile} ring-slate-900`}>
          <p className="text-[11px] text-slate-500">Price in CAD</p>
          <p className="font-semibold text-slate-900">
            <Tween value={price * rate} format={moneyText} />
          </p>
        </div>
      </div>
      {pricePct !== null && cadPct !== null && (
        <p className="mt-1.5 flex flex-wrap justify-end gap-x-4 text-xs text-slate-500">
          <span>
            {`Day ${day}, price alone `}
            <span className={`font-semibold ${tone(pricePct)}`}>
              <Tween value={pricePct} format={pctText} />
            </span>
          </span>
          <span>
            With the exchange rate{" "}
            <span className={`font-semibold ${tone(cadPct)}`}>
              <Tween value={cadPct} format={pctText} />
            </span>
          </span>
        </p>
      )}
    </div>
  );
}

// The chosen pick's general info, above its chart, as the Search page's About has it but with
// nothing that names it (its name, its website): its sector (its badge and NAICS group), its
// industry and place, what it does, and its figures with what funds it; for an ETF, what it
// holds instead (EtfHoldings), its holdings' names hidden. Folded away to begin
// with under a line saying what it holds; its Fold / Open button (or that line) opens it, and
// it stays open or folded as other picks are chosen.
function PickInfo({
  pick,
  day,
  open,
  openings,
  onToggle,
}: {
  pick: Pick;
  day: number;
  open: boolean;
  openings: number;
  onToggle: () => void;
}) {
  const f = pick.figures;
  const funded =
    f && f.totalAssets && f.totalLiabilities !== null && f.totalAssets > 0
      ? Math.min(100, Math.max(0, (f.totalLiabilities / f.totalAssets) * 100))
      : null;
  return (
    <div className="mt-2 rounded-lg bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className="kind-badge grid size-8 shrink-0 place-items-center rounded-lg shadow-sm"
          style={{ background: pick.color, color: pick.mark, ["--badge" as string]: pick.color }}
        >
          <KindMark kind={pick.kind} className="size-4" />
        </span>
        <button type="button" onClick={onToggle} className="group min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-slate-900">General info</span>
          <span className="block truncate text-xs text-slate-500 transition group-hover:text-slate-900">
            {open
              ? pick.line || "About this pick"
              : `${pick.sector ?? (pick.kind === "ETF" ? "A fund" : "Sector unknown")} · open to see what it ${
                  pick.kind === "ETF" ? "does and what it holds" : f ? "does and its figures" : "does"
                }`}
          </span>
        </button>
        <FoldButton open={open} controls={`info-${pick.symbol}`} onClick={onToggle} className="text-xs" />
      </div>
      <div
        id={`info-${pick.symbol}`}
        className="legend-fold"
        data-closed={open ? undefined : ""}
        inert={!open}
      >
        <div>
          <dl className="mt-3 grid gap-x-6 gap-y-2.5 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
            <div className="legend-row" style={{ "--d": open ? "60ms" : "0ms" } as React.CSSProperties}>
              <dt className="text-slate-500">Sector</dt>
              <dd className="font-semibold text-slate-900">
                {pick.sector ?? (pick.kind === "ETF" ? "A fund (no NAICS group)" : "Unknown")}
              </dd>
            </div>
            <div className="legend-row" style={{ "--d": open ? "100ms" : "0ms" } as React.CSSProperties}>
              <dt className="text-slate-500">Industry</dt>
              <dd className="font-semibold text-slate-900">{pick.industry ?? "—"}</dd>
            </div>
            {/* Where it is from, by its country's flag, as the Search page's About has it: where
                a company is based, or where a fund is listed. */}
            <div className="legend-row" style={{ "--d": open ? "110ms" : "0ms" } as React.CSSProperties}>
              <dt className="text-slate-500">{pick.kind === "ETF" ? "Listed in" : "Based in"}</dt>
              <dd className="font-semibold text-slate-900">
                {pick.place ? <Place place={pick.place} country={pick.country} /> : "—"}
              </dd>
            </div>
            {/* The currency it trades in, and where that currency is from, by its flag. */}
            {pick.currency && (
              <div className="legend-row" style={{ "--d": open ? "120ms" : "0ms" } as React.CSSProperties}>
                <dt className="text-slate-500">Trades in</dt>
                <dd className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Flag code={pick.currency} className="size-3.5" />
                  {`${pick.currency} · ${currencyName(pick.currency)}`}
                  {usedIn(pick.currency) && (
                    <span className="font-normal text-slate-500">{`used in ${usedIn(pick.currency)}`}</span>
                  )}
                </dd>
              </div>
            )}
            {pick.about && (
              <div
                className="legend-row sm:col-span-2"
                style={{ "--d": open ? "140ms" : "0ms" } as React.CSSProperties}
              >
                <dt className="text-slate-500">What it does</dt>
                <dd className="mt-0.5 line-clamp-4 text-slate-700">{pick.about}</dd>
              </div>
            )}
          </dl>
          <div
            className="legend-row mt-3 border-t border-slate-100 pt-3"
            style={{ "--d": open ? "180ms" : "0ms" } as React.CSSProperties}
          >
            {f ? (
              <>
                <FigureRow figures={f} />
                {funded !== null && (
                  <div className="mt-2.5">
                    <p className="text-xs text-slate-500">Funded by</p>
                    <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-700 transition-[width] duration-700 ease-out"
                        style={{ width: open ? `${funded}%` : "0%" }}
                      />
                    </div>
                    <p className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-600">
                      <span>Liabilities {Math.round(funded)}%</span>
                      <span>Equity {100 - Math.round(funded)}%</span>
                    </p>
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Today&apos;s figures
                  {f.balanceDate ? ` (balance sheet as of ${figureDay(f.balanceDate)})` : ""}, not from your
                  test&apos;s stretch of time: none are on record for then.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What it holds</p>
                <div className="mt-1.5">
                  {/* Fetched while still folded (and again each new day), so it is ready, at its
                      full size, as the info opens, and stays as it folds; its map slides in
                      afresh at each opening. */}
                  <EtfHoldings
                    entry={{ symbol: pick.symbol, from: pick.from }}
                    day={day}
                    name={pick.name}
                    country={pick.country}
                    replay={openings}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// A company's general figures in a row, above its chart: revenue, total assets, total
// liabilities and employees, counting up as they come into view.
function FigureRow({ figures }: { figures: NonNullable<Figures> }) {
  const items: [string, string][] = [
    ["Total assets", amountText(figures.totalAssets, figures.currency)],
    ["Revenue", amountText(figures.revenue, figures.currency)],
    ["Total liabilities", amountText(figures.totalLiabilities, figures.currency)],
    ["Employees", figureCount(figures.employees)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-sm font-semibold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// The card that asks before the test is left early, over the trading panel (which it dims),
// as the order card does: a warning that nothing done in the test is kept (how far it got,
// how many trades), and that the set-up comes back with the same picks and choices. Keep
// testing (or Escape, or a click beside it) closes it; Exit test leaves.
function QuitCard({
  day,
  trades,
  leaving,
  onDone,
}: {
  day: number;
  trades: number;
  leaving: boolean;
  onDone: (confirmed: boolean) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);

  // Ready for the keyboard (on the safe choice), and in sight, without jumping the page.
  useEffect(() => {
    const el = button.current;
    el?.focus({ preventScroll: true });
    el?.closest("[role=dialog]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  return (
    <div
      className={`absolute inset-0 z-20 grid place-items-center rounded-xl bg-slate-50/70 p-4 backdrop-blur-[2px] ${
        leaving ? "recap-out" : "recap-in"
      }`}
      onClick={() => onDone(false)}
      onKeyDown={(e) => e.key === "Escape" && onDone(false)}
    >
      <div
        role="dialog"
        aria-label="Leave the test?"
        className="recap-card w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <WarnMark className="warn-pop size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Day {day} · leaving early
            </p>
            <p className="text-lg font-semibold text-slate-900">Leave the test?</p>
          </div>
        </div>
        <p className="rise-in mt-4 text-sm text-slate-600" style={{ animationDelay: "100ms" }}>
          Your progress won&apos;t be saved:{" "}
          {day > 1 ? `the ${day - 1} ${day === 2 ? "day" : "days"} gone by` : "this day"}
          {trades ? ` and your ${trades} ${trades === 1 ? "trade" : "trades"}` : ""} will be lost.
        </p>
        <p className="rise-in mt-2 text-sm text-slate-600" style={{ animationDelay: "170ms" }}>
          You&apos;ll go back to the set-up with the same picks and choices, ready to start again.
        </p>
        <div className="rise-in mt-5 flex gap-2" style={{ animationDelay: "240ms" }}>
          <button
            ref={button}
            type="button"
            onClick={() => onDone(false)}
            className={`${DARK} ${ACTION} flex-1 justify-center`}
          >
            Keep testing
          </button>
          <button
            type="button"
            onClick={() => onDone(true)}
            className={`${LIGHT} ${ACTION} flex-1 justify-center hover:border-red-300 hover:text-red-700`}
          >
            <ExitMark className="size-4" />
            Exit test
          </button>
        </div>
      </div>
    </div>
  );
}

// The recap of the days just passed, over the trading panel (which it dims): how long passed;
// what the account was worth then and now, with a little chart of it over those days (over
// more than one day, while anything was held); and how each of the shares held did, by how
// much its price moved and what that made or lost (nothing on the picks not held). It comes alive as it opens: its day, week or month mark
// plays, its rows rise in one after another, and its figures count from where the days began
// to where they ended as the little chart draws itself. Pointing along the little chart shows
// each day's value. It moves on by itself once its timer bar runs out (paused while pointed
// at), or at once when clicked anywhere, or with Escape.
function RecapCard({ recap, leaving, onDone }: { recap: Recap; leaving: boolean; onDone: () => void }) {
  const { from, to, values, positions } = recap;
  const button = useRef<HTMLButtonElement>(null);
  const chart = useRef<HTMLDivElement>(null);
  // Whether the figures have moved on to where the days ended (just after it opens), and the
  // day pointed at along the little chart (an index into `values`), if any.
  const [after, setAfter] = useState(false);
  const [spot, setSpot] = useState<number | null>(null);
  const passed = to - from;
  const start = values[0];
  const end = values[values.length - 1];
  const move = end - start;
  const pct = start ? (move / start) * 100 : 0;
  const Mark = passed === 1 ? MoonMark : passed <= 5 ? WeekMark : MonthMark;
  // The positions, biggest gain first; past SHOWN of them, the list scrolls.
  const held = [...positions].sort((a, b) => b.gain - a.gain);
  const SHOWN = 5;

  // The little chart: the account's value on Day `from` and every day since, in a 100 by 36
  // box.
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const px = (i: number) => (values.length === 1 ? 50 : (i / (values.length - 1)) * 100);
  const py = (v: number) => 32 - ((v - low) / span) * 28;
  const line = values.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(2)},${py(v).toFixed(2)}`).join("");
  const color = move >= 0 ? "#15803d" : "#dc2626";
  const shown = spot ?? values.length - 1;

  // Ready for the keyboard, and in sight, without jumping the page; then the figures move on.
  useEffect(() => {
    const el = button.current;
    el?.focus({ preventScroll: true });
    el?.closest("[role=dialog]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const timer = window.setTimeout(() => setAfter(true), 300);
    return () => window.clearTimeout(timer);
  }, []);

  // The day nearest the pointer along the little chart.
  function point(clientX: number) {
    const rect = chart.current?.getBoundingClientRect();
    if (!rect) return;
    const share = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    setSpot(Math.round(share * (values.length - 1)));
  }

  // One row of the card rising in, `i` rows after the first.
  const row = (i: number) => ({ className: "rise-in", style: { animationDelay: `${100 + i * 70}ms` } });

  return (
    <div
      className={`recap absolute inset-0 z-20 grid place-items-center rounded-xl bg-slate-50/70 p-4 backdrop-blur-[2px] ${
        leaving ? "recap-out" : "recap-in"
      }`}
      onClick={onDone}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
    >
      <div
        role="dialog"
        aria-label={`Day ${from} to Day ${to}`}
        className="recap-card w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className="test-mark-live grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-900">
              <Mark className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {passedText(passed)}
              </p>
              <p className="text-lg font-semibold tabular-nums text-slate-900">
                Day {from} <span className="text-slate-400">→</span> Day{" "}
                <Tween value={after ? to : from} format={dayText} />
              </p>
            </div>
          </div>

          <div {...row(0)}>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">Account value</p>
                <p className="tabular-nums text-slate-900">
                  {money.format(start)} <span className="text-slate-400">→</span>{" "}
                  <span className="font-semibold">
                    <Tween value={after ? end : start} format={moneyText} />
                  </span>
                </p>
              </div>
              <p className={`flex items-center gap-1 text-lg font-bold tabular-nums ${tone(move)}`}>
                <svg
                  aria-hidden
                  viewBox="0 0 10 10"
                  className={`recap-arrow size-2.5 fill-current ${move < 0 ? "rotate-180" : ""}`}
                >
                  {move === 0 ? <rect x="1" y="4" width="8" height="2" rx="1" /> : <path d="M5 1.5 9 8H1Z" />}
                </svg>
                <Tween value={after ? pct : 0} format={pctText} />
              </p>
            </div>
          </div>

          {/* The account over the days just passed, as a little line; pointing along it shows
              each day. Not for a single day, nor while nothing was held (it would be flat). */}
          {passed > 1 && positions.length > 0 && (
            <div {...row(1)}>
              <div
                ref={chart}
                className="relative mt-3 h-16 cursor-crosshair touch-none"
                onPointerMove={(e) => point(e.clientX)}
                onPointerDown={(e) => point(e.clientX)}
                onPointerLeave={() => setSpot(null)}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 100 36"
                  preserveAspectRatio="none"
                  className="size-full overflow-visible"
                >
                  <path
                    d={`${line}L100,36L0,36Z`}
                    fill={color}
                    fillOpacity={0.1}
                    className="chart-area-in"
                    style={{ animationDelay: "400ms" }}
                  />
                  <path
                    d={line}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className="recap-draw"
                  />
                </svg>
                <span
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-[left,top] duration-150 ease-out"
                  style={{
                    left: `${px(shown)}%`,
                    top: `${(py(values[shown]) / 36) * 100}%`,
                    backgroundColor: color,
                  }}
                />
                <span
                  className={`pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded bg-white px-1.5 text-[11px] tabular-nums text-slate-600 shadow-sm transition-[left,opacity] duration-150 ease-out ${
                    spot === null ? "opacity-0" : "opacity-100"
                  }`}
                  style={{ left: `${Math.min(Math.max(px(shown), 14), 86)}%` }}
                >
                  Day {from + shown}: {money.format(values[shown])}
                </span>
              </div>
            </div>
          )}

          {/* How each of the shares held did. */}
          <div {...row(2)}>
            <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {positions.length ? (
                <>
                  <p className="flex justify-between text-xs text-slate-500">
                    <span>Your shares</span>
                    <span>Change · You made (CAD)</span>
                  </p>
                  <ul
                    className={`mt-1 space-y-1 tabular-nums ${held.length > SHOWN ? "max-h-36 overflow-y-auto pr-1" : ""}`}
                  >
                    {held.map((p, i) => (
                      <li
                        key={p.name}
                        className="rise-in flex items-center justify-between gap-3"
                        style={{ animationDelay: `${300 + Math.min(i, 8) * 60}ms` }}
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-slate-900">{p.name}</span> ·{" "}
                          {p.shares.toLocaleString("en-CA")} {sharesWord(p.shares)}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-3">
                          {/* Its price's change; for one in another currency, then the change
                              with the exchange rate's move too, which is what it made in CAD. */}
                          <span className="text-right text-xs leading-tight">
                            <span className={`block ${tone(p.pricePct)}`}>
                              {p.foreign && <span className="text-slate-400">Price </span>}
                              <Tween value={after ? p.pricePct : 0} format={pctText} />
                            </span>
                            {p.foreign && (
                              <span className={`block ${tone(p.pct)}`}>
                                <span className="text-slate-400">With FX </span>
                                <Tween value={after ? p.pct : 0} format={pctText} />
                              </span>
                            )}
                          </span>
                          <span className={`w-20 text-right font-semibold ${tone(p.gain)}`}>
                            <Tween value={after ? p.gain : 0} format={changeText} />
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                "You held no shares, so your money stayed as it was."
              )}
            </div>
          </div>

          <div {...row(3)}>
            <button
              ref={button}
              type="button"
              onClick={onDone}
              className={`${DARK} ${ACTION} mt-4 w-full justify-center`}
            >
              Continue
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-3.5 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          </div>
        </div>
        {/* How long until it moves on by itself. */}
        <span
          aria-hidden
          className="recap-timer block h-1 bg-slate-900"
          style={{ animationDuration: `${RECAP_MS}ms` }}
          onAnimationEnd={(e) => e.animationName === "recap-timer" && onDone()}
        />
      </div>
    </div>
  );
}

// For a pick in another currency than CAD, under its price chart: how many Canadian dollars
// one unit of that currency was worth, day by day, on the same chart as the price's (its
// ranges and With history / Test only shared with it, so the two line up, Day 1 on Day 1),
// with the currency's flag. It changes what a holding is worth in CAD as much as the price
// does. Folded to begin with; its Fold / Open button opens it, the chart easing open.
function FxChart({
  symbol,
  day,
  currency,
  history,
  rates,
  yearStarts,
  range,
  onRange,
  scope,
  onScope,
}: {
  symbol: string;
  day: number; // the test's day now
  currency: string | null;
  history: number[];
  rates: number[];
  yearStarts: number[];
  range: ChartRange;
  onRange: (r: ChartRange) => void;
  scope: "all" | "test";
  onScope: (s: "all" | "test") => void;
}) {
  const [open, setOpen] = useState(false);
  const id = `fx-${symbol}`;
  const now = rates[rates.length - 1] ?? history[history.length - 1] ?? 1;
  const format = (x: number) => moneyFormatter("CAD", rateDecimals(now)).format(x);
  const change = rates.length > 1 ? (rates[rates.length - 1] / rates[0] - 1) * 100 : null;
  return (
    <div className="mt-3 rounded-lg bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        {currency && <Flag code={currency} className="size-6" />}
        <button type="button" onClick={() => setOpen(!open)} className="group min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-slate-900">Exchange rate</span>
          <span className="block truncate text-xs text-slate-500 transition group-hover:text-slate-900">
            {`1 ${currency} = ${format(now)} on Day ${day}`}
            {change !== null && (
              <span className={tone(change)}>{` · ${pctText(change)} since Day 1`}</span>
            )}
            {open ? "" : " · open to see it over the same days as the price"}
          </span>
        </button>
        <FoldButton open={open} controls={id} onClick={() => setOpen(!open)} className="text-xs" />
      </div>
      <div id={id} className="legend-fold" data-closed={open ? undefined : ""} inert={!open}>
        <div>
          <p className="mt-2 text-xs text-slate-500">
            {`How many Canadian dollars one ${currency} was worth each day: a rise makes a holding in ${currency} worth more in CAD, a fall less, whatever its price does.`}
          </p>
          <SandboxChart
            symbol={`${symbol}-fx`}
            exampleDay={false}
            history={history}
            prices={rates}
            yearStarts={yearStarts}
            format={format}
            range={range}
            onRange={onRange}
            scope={scope}
            onScope={onScope}
          />
        </div>
      </div>
    </div>
  );
}

// Exchanging currencies, above the holdings: folded to a line with a button; opened, a "from"
// and a "to" (each a menu of the currencies there are, as the investment universe's filters
// are: each with its flag, its name and what is held of it), how much to exchange (or all of
// it), what that comes to at the day's rates, and the button to do it; under it, the exchanges
// made so far, those made to pay for shares marked so. It eases open and shut, and once open
// lets its menus and outlines reach past its edges. Swapping spins its button as the two menus
// slide past each other into place; All fills the amount with a bump; the amounts count to
// their new values; and an exchange marks its button done as it slides into the list.
function ExchangePanel({
  day,
  wallet,
  currencies,
  fxNow,
  exchanges,
  usable,
  onExchange,
}: {
  day: number;
  wallet: Wallet;
  currencies: string[];
  fxNow: (c: string) => number;
  exchanges: Exchange[];
  usable: boolean;
  onExchange: (from: string, to: string, paid: number) => void;
}) {
  const [open, setOpen] = useState(false);
  // Whether it is open and done opening: only then may what is in it reach past its edges.
  const [settled, setSettled] = useState(false);
  const firstHeld = currencies.find((c) => c !== "CAD" && (wallet[c] ?? 0) > 0);
  const [from, setFrom] = useState(firstHeld ?? "CAD");
  const [to, setTo] = useState(firstHeld ? "CAD" : (currencies.find((c) => c !== "CAD") ?? "CAD"));
  const [text, setText] = useState("");
  // How many times the two have been swapped (the button turns half a turn each time), and
  // whether an exchange has just been made (its button says so for a moment).
  const [swaps, setSwaps] = useState(0);
  const [done, setDone] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  const have = wallet[from] ?? 0;
  const paid = Math.min(Number(text.replace(/,/g, "")) || 0, have);
  const rate = fxNow(from) / fxNow(to);
  const got = Math.floor(paid * rate * 100 + 1e-6) / 100;
  const id = "sandbox-exchange";
  const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function toggle() {
    setSettled(false);
    setOpen(!open);
  }
  // A small bump of the amount's box, so a change made for the player is seen.
  function bump() {
    if (calm()) return;
    box.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }],
      { duration: 280, easing: "ease-out" },
    );
  }
  // The currencies as menu options: flag, code, name, and what is held of it.
  const options = (list: string[]): MenuOption[] =>
    list.map((c) => ({
      value: c,
      label: c,
      hint: `${currencyName(c)} · ${nativeText(wallet[c] ?? 0, c)} held`,
      swatch: <Flag code={c} className="size-5" />,
    }));

  return (
    <div className="mt-3 rounded-lg bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-900">
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
            <path d="M3.5 7.5h12M12.5 4.5l3 3-3 3M16.5 12.5h-12M7.5 9.5l-3 3 3 3" />
          </svg>
        </span>
        <button type="button" onClick={toggle} className="group min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-slate-900">Exchange currency</span>
          <span className="block truncate text-xs text-slate-500 transition group-hover:text-slate-900">
            {`At Day ${day}'s rates, whenever you like. Shares in another currency are paid from cash in it first.`}
          </span>
        </button>
        <FoldButton open={open} controls={id} onClick={toggle} className="text-xs" />
      </div>
      <div
        id={id}
        className="legend-fold"
        data-closed={open ? undefined : ""}
        inert={!open}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && open) setSettled(true);
        }}
      >
        <div style={settled ? { overflow: "visible" } : undefined}>
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 px-0.5 pt-3 pb-0.5 text-sm">
            <div className="grid gap-1 text-xs text-slate-500">
              From
              <span key={`from-${swaps}`} className={swaps ? "fx-swap-from" : ""}>
                <FilterMenu
                  label="Exchange from"
                  value={from}
                  options={options(currencies)}
                  onChange={(c) => {
                    setFrom(c);
                    if (c === to) setTo(currencies.find((x) => x !== c) ?? "CAD");
                  }}
                />
              </span>
            </div>
            <button
              type="button"
              aria-label="Swap from and to"
              onClick={() => {
                setFrom(to);
                setTo(from);
                setText("");
                setSwaps((n) => n + 1);
              }}
              className="mb-0.5 grid size-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.3,1.4,0.5,1)]"
                style={{ transform: `rotate(${swaps * 180}deg)` }}
              >
                <path d="M3.5 7.5h12M12.5 4.5l3 3-3 3M16.5 12.5h-12M7.5 9.5l-3 3 3 3" />
              </svg>
            </button>
            <div className="grid gap-1 text-xs text-slate-500">
              To
              <span key={`to-${swaps}`} className={swaps ? "fx-swap-to" : ""}>
                <FilterMenu
                  label="Exchange to"
                  value={to}
                  options={options(currencies.filter((c) => c !== from))}
                  onChange={setTo}
                />
              </span>
            </div>
            <label className="grid min-w-36 flex-1 gap-1 text-xs text-slate-500">
              {`Amount in ${from}`}
              <span className="flex gap-1">
                <input
                  ref={box}
                  inputMode="decimal"
                  value={text}
                  onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0.00"
                  className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold tabular-nums text-slate-900 transition-colors hover:border-slate-400 focus-visible:border-slate-900 focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setText(String(have));
                    bump();
                  }}
                  disabled={have <= 0}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 active:scale-95 disabled:opacity-40"
                >
                  All
                </button>
              </span>
            </label>
            <button
              type="button"
              disabled={!usable || done || paid <= 0 || got <= 0}
              onClick={() => {
                onExchange(from, to, paid);
                setText("");
                setDone(true);
                window.setTimeout(() => setDone(false), calm() ? 0 : 1100);
              }}
              className={`${DARK} ${ACTION} min-w-28 justify-center`}
            >
              {/* Its words change with a fade: Exchange, then Exchanged with a check drawn in. */}
              <span key={done ? "done" : "go"} className="text-fade-in inline-flex items-center gap-1.5">
                {done && (
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5"
                  >
                    <path className="confirm-check" pathLength={1} d="M3.5 8.5 6.5 11.5 12.5 5" />
                  </svg>
                )}
                {done ? "Exchanged" : "Exchange"}
              </span>
            </button>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Flag code={from} className="size-3.5" />
              <span className="font-semibold tabular-nums text-slate-900">
                <Tween value={paid} format={(x) => nativeText(x, from)} />
              </span>
              {" → "}
              <Flag code={to} className="size-3.5" />
              <span className="font-semibold tabular-nums text-slate-900">
                <Tween value={got} format={(x) => nativeText(x, to)} />
              </span>
            </span>
            <span key={`${from}-${to}`} className="text-fade-in">
              {`1 ${from} = ${rate.toFixed(rateDecimals(rate))} ${to}, Day ${day}`}
            </span>
          </p>
          {exchanges.length > 0 && (
            <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto border-t border-slate-100 pt-2 text-xs text-slate-600">
              {[...exchanges].reverse().map((e, i) => (
                <li
                  key={exchanges.length - i}
                  className={`flex justify-between gap-3 tabular-nums ${i === 0 ? "fx-row-in" : ""}`}
                >
                  <span>{`Day ${e.day}: ${nativeText(e.paid, e.from)} → ${nativeText(e.got, e.to)}`}</span>
                  <span className="text-slate-400">{e.auto ? "to pay for shares" : "by you"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// The card that comes up when the test is finished, as each day's recap does (the night sky's
// moon swinging up as its stars twinkle): congratulations, the days traded, and the account
// from its start to its end with how much that is up or down; then on, by its button or by
// itself once its bar runs out, to the summary. Over the page wherever it is scrolled, the page
// dimmed and softened behind it.
function FinishCard({
  days,
  start,
  end,
  leaving,
  onDone,
}: {
  days: number;
  start: number;
  end: number;
  leaving: boolean;
  onDone: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  // Whether the figures have counted on to the end (just after the card opens).
  const [after, setAfter] = useState(false);
  const pct = start ? ((end - start) / start) * 100 : 0;

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setAfter(true), 300);
    return () => window.clearTimeout(timer);
  }, []);

  // One row of the card rising in, `i` rows after the first.
  const row = (i: number) => ({ className: "rise-in", style: { animationDelay: `${100 + i * 80}ms` } });

  // On the page itself (a portal), so it sits over the screen wherever the page is scrolled,
  // not in the test's panel (whose entrance leaves a transform that would hold it there).
  return createPortal(
    <div
      className={`recap fixed inset-0 z-50 grid place-items-center bg-slate-900/20 p-4 backdrop-blur-[3px] ${
        leaving ? "recap-out" : "recap-in"
      }`}
      onClick={onDone}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
    >
      <div
        role="dialog"
        aria-label="The test is finished"
        className="recap-card w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className="test-mark-live grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-900">
              <MoonMark className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Day {days} · the test is over
              </p>
              <p className="text-lg font-semibold text-slate-900">Congratulations!</p>
            </div>
          </div>

          <p {...row(0)} className="rise-in mt-3 text-sm text-slate-600">
            {`You traded through all ${days} days. Here's how it went.`}
          </p>

          <div {...row(1)}>
            <div className="mt-4 flex items-end justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2.5">
              <div>
                <p className="text-xs text-slate-500">Your account</p>
                <p className="tabular-nums text-slate-900">
                  {money.format(start)} <span className="text-slate-400">→</span>{" "}
                  <span className="font-semibold">
                    <Tween value={after ? end : start} format={moneyText} />
                  </span>
                </p>
              </div>
              <p className={`text-lg font-bold tabular-nums ${tone(pct)}`}>
                <Tween value={after ? pct : 0} format={pctText} />
              </p>
            </div>
          </div>

          <div {...row(2)}>
            <button ref={button} type="button" onClick={onDone} className={`${DARK} ${ACTION} mt-4 w-full justify-center`}>
              See your results
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-3.5 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          </div>
        </div>
        {/* How long until it moves on by itself. */}
        <span
          aria-hidden
          className="recap-timer block h-1 bg-slate-900"
          style={{ animationDuration: `${RECAP_MS}ms` }}
          onAnimationEnd={(e) => e.animationName === "recap-timer" && onDone()}
        />
      </div>
    </div>,
    document.body,
  );
}

// A ticket for one side of an order, buying or selling. Its number of shares is typed in, or
// stepped by 1 or 10 with the buttons either side of it (fewer on the left, more on the
// right), or set to the most there could be (Max: as many as the cash buys; All: every share
// held); a cross clears it. Below, the order's estimated cost or proceeds, or why it can't
// be filled, fading into each other; then Review, which opens the confirming card. One
// ticket is in use at a time: the other is locked, faded but keeping its number, and a click
// anywhere on it (a button laid over it) switches to it.
function OrderTicket({
  side,
  text,
  size,
  most,
  price,
  format = moneyText,
  box,
  locked,
  usable,
  onText,
  onStep,
  onReview,
  onActivate,
}: {
  side: Ask["side"];
  text: string;
  size: number;
  most: number;
  price: number;
  format?: (x: number) => string; // how an amount is written (in the share's currency)
  box: React.RefObject<HTMLInputElement | null>;
  locked: boolean;
  usable: boolean;
  onText: (text: string) => void;
  onStep: (change: { by?: number; to?: number }) => void;
  onReview: () => void;
  onActivate: () => void;
}) {
  const buying = side === "Bought";
  const can = size <= most;
  // A ticket with nothing it could trade (no cash for a share, or no shares) rests unused, as
  // a locked one does, saying why; so it never holds a number that would lock the other.
  const empty = most === 0 && size === 0;
  const resting = locked || empty;
  const live = usable && !resting;
  // A ticket with nothing to trade, in use, says why (a locked one just fades).
  const quiet = empty && !locked;
  const why = buying ? "Not enough cash for a share." : "You hold no shares to sell.";
  // While it rests, its controls fade (a locked one less, under its veil).
  const dim = locked ? "opacity-60" : resting ? "opacity-40" : "";
  const id = `sandbox-${buying ? "buy" : "sell"}-shares`;

  // A button stepping the number by `by`: a round-ended chip with a chevron (up for more, down
  // for fewer) and how many, removing light and adding black. Pointed at, it lifts a touch
  // and its chevron nudges the way it goes; pressed, it dips.
  const nudge = (by: number) => {
    const adding = by > 0;
    return (
      <button
        type="button"
        aria-label={`${adding ? "Add" : "Remove"} ${Math.abs(by)}`}
        title={`${adding ? "Add" : "Remove"} ${Math.abs(by)}`}
        disabled={!live || (!adding && size === 0)}
        onClick={() => onStep({ by })}
        className={`group/nudge flex h-8 min-w-12 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold tabular-nums shadow-sm transition duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-90 warn-cursor disabled:opacity-35 disabled:shadow-none disabled:hover:translate-y-0 ${
          adding
            ? "bg-slate-900 text-white hover:bg-slate-700"
            : "border border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:text-slate-900"
        }`}
      >
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`size-2.5 transition-transform duration-300 ease-[cubic-bezier(0.3,1.6,0.5,1)] ${
            adding
              ? "group-enabled/nudge:group-hover/nudge:-translate-y-0.5"
              : "group-enabled/nudge:group-hover/nudge:translate-y-0.5"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d={adding ? "M2 8 6 4l4 4" : "M2 4l4 4 4-4"} />
        </svg>
        {Math.abs(by)}
      </button>
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onReview();
      }}
      className={`group/ticket relative rounded-xl border p-3 transition duration-300 ${
        locked
          ? "border-slate-100 bg-slate-50/60 hover:border-slate-300"
          : "border-slate-900/20 shadow-md shadow-slate-900/5"
      }`}
    >
      {/* Locked: a soft frosted veil over it, saying so, and a click anywhere on it switches
          to it. Its words drift in out of a blur; pointed at, the veil thins, the words grow a
          touch and their arrows turn half a circle. */}
      {locked && (
        <button
          type="button"
          onClick={onActivate}
          aria-label={`Switch to ${buying ? "buying" : "selling"}`}
          className="group/switch absolute inset-0 z-10 grid cursor-pointer place-items-center rounded-xl bg-white/45 backdrop-blur-[1.5px] transition-colors duration-300 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        >
          <span className="switch-in flex items-center gap-2 rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white shadow-lg shadow-slate-900/20 transition-transform duration-300 ease-[cubic-bezier(0.3,1.5,0.5,1)] group-hover/switch:scale-105">
            {/* Two arrows chasing each other round: pointed at, they turn half a circle. */}
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.3,1.3,0.5,1)] group-hover/switch:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13.2 6.4A5.4 5.4 0 0 0 3.6 4.6M2.8 9.6a5.4 5.4 0 0 0 9.6 1.8" />
              <path d="M3.4 1.9v2.9h2.9M12.6 14.1v-2.9H9.7" />
            </svg>
            Click to switch
          </span>
        </button>
      )}
      <div className={`flex items-center justify-between gap-2 transition-opacity duration-300 ${dim}`}>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <span
            className={`grid size-6 place-items-center rounded-full ${
              buying ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-900"
            }`}
          >
            {buying ? <BuyMark className="size-3.5" /> : <SellMark className="size-3.5" />}
          </span>
          {buying ? "Buy" : "Sell"}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!live || most === 0 || size === most}
            onClick={() => onStep({ to: most })}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 active:scale-95 warn-cursor disabled:opacity-40"
          >
            {buying ? "Max" : "All"} · {most.toLocaleString("en-CA")}
          </button>
          <button
            type="button"
            aria-label={`Clear the ${buying ? "buy" : "sell"} order`}
            disabled={!live || !text}
            onClick={() => onStep({ to: 0 })}
            className={`grid size-6 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 ${
              text ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>

      {/* The number of shares: fewer on the left of it, more on the right. */}
      <div className={`mt-3 flex items-center justify-center gap-1.5 transition-opacity duration-300 ${dim}`}>
        {nudge(-10)}
        {nudge(-1)}
        <label className="sr-only" htmlFor={id}>
          Shares to {buying ? "buy" : "sell"}
        </label>
        <input
          ref={box}
          id={id}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          disabled={!live}
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder="0"
          aria-invalid={!can}
          className={`h-9 w-20 rounded-lg border bg-white px-2 text-center text-sm font-semibold tabular-nums outline-none transition-colors duration-300 [appearance:textfield] disabled:bg-slate-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
            can ? "border-slate-200 text-slate-900 focus:border-slate-400" : "border-red-300 text-red-600"
          }`}
        />
        {nudge(1)}
        {nudge(10)}
      </div>

      {/* The estimate; or why the order can't be filled; or, for a ticket with nothing to
          trade, why: each fades into the next. */}
      <div className={`mt-2 grid text-xs tabular-nums transition-opacity duration-300 ${locked ? dim : ""}`}>
        <p
          aria-hidden={!can || quiet}
          className={`col-start-1 row-start-1 text-center text-slate-500 transition duration-300 ease-out ${
            can && !quiet ? "" : "-translate-y-1 opacity-0"
          }`}
        >
          {buying ? "Est. cost" : "Est. proceeds"}{" "}
          <span className="text-sm font-semibold text-slate-900">
            <Tween value={size * price} format={format} />
          </span>{" "}
          ({size.toLocaleString("en-CA")} × {format(price)})
        </p>
        <p
          aria-hidden={can || quiet}
          className={`col-start-1 row-start-1 flex items-center justify-center gap-1.5 font-medium text-red-600 transition duration-300 ease-out ${
            can || quiet ? "translate-y-1 opacity-0" : ""
          }`}
        >
          <WarnMark className={`size-4 ${can ? "" : "warn-pop"}`} />
          {buying
            ? `Insufficient funds: max ${most.toLocaleString("en-CA")} ${sharesWord(most)}`
            : `Insufficient shares: you hold ${most.toLocaleString("en-CA")}`}
        </p>
        <p
          aria-hidden={!quiet}
          className={`col-start-1 row-start-1 flex items-center justify-center gap-1.5 font-medium text-red-600 transition duration-300 ease-out ${
            quiet ? "" : "translate-y-1 opacity-0"
          }`}
        >
          <WarnMark className={`size-4 ${quiet ? "warn-pop" : ""}`} />
          {why}
        </p>
      </div>

      <button
        type="submit"
        disabled={!live || size === 0 || !can}
        className={`${buying ? DARK : LIGHT} ${ACTION} mt-3 w-full justify-center ${resting ? "opacity-40" : ""}`}
      >
        {buying ? <BuyMark className="size-4" /> : <SellMark className="size-4" />}
        Review {buying ? "buy" : "sell"} order
      </button>
    </form>
  );
}

// The card that confirms a trade, over the trading panel (which it dims), as the recap does:
// buying or selling how many shares, at what price, for how much in all, and the cash and
// shares there will be after; once confirmed it can't be undone. It comes alive as it opens:
// its buy or sell mark keeps moving (the arrow dropping into the box, or rising out of it),
// its rows rise in one after another, the cash and shares count from now to after, and a bar
// of the money (cash, and what the shares are worth) slides to its split after the trade.
// Pointing at Confirm closes the padlock on the warning. Confirmed, a check draws itself on
// the button before the card goes; Escape, or a click beside it, cancels.
function ConfirmTrade({
  ask,
  day,
  price,
  rate,
  currency,
  cash,
  cad,
  held,
  payment,
  shares,
  leaving,
  onDone,
}: {
  ask: Ask;
  day: number;
  price: number; // per share, in the currency it trades in
  rate: number; // CAD for one unit of that currency today (1 for CAD)
  currency: string | null; // what it trades in
  cash: number; // all the cash, in CAD at today's rates
  cad: number; // the cash in CAD
  held: number; // the cash in the share's currency (the same as `cad` for one in CAD)
  payment: Payment | null; // a purchase's: from the cash in its currency, the rest exchanged
  shares: number;
  leaving: boolean;
  onDone: (confirmed: boolean) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const buying = ask.side === "Bought";
  const foreign = Boolean(currency && currency !== "CAD");
  const cur = currency ?? "CAD";
  // What it comes to in the share's currency, and in CAD at today's rate.
  const amount = cents(ask.shares * price);
  const total = cents(amount * rate);
  const cashAfter = cents(buying ? cash - total : cash + total);
  // The cash in CAD and in the share's currency, after: a purchase takes from the share's
  // currency first, exchanging the rest from CAD; a sale's money stays in its currency.
  const cadAfter = cents(buying ? cad - (foreign ? (payment?.cadPaid ?? 0) : amount) : foreign ? cad : cad + amount);
  const heldAfter = cents(buying ? held - (payment?.fromHeld ?? 0) : held + amount);
  const sharesAfter = buying ? shares + ask.shares : shares - ask.shares;
  // Whether the figures have moved on to after the trade (just after the card opens), and
  // whether it has been confirmed (the check drawing itself).
  const [after, setAfter] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  // The share of the money in cash, now and after.
  const worth = (c: number, n: number) => c + n * price * rate || 1;
  const cashShare =
    ((after ? cashAfter : cash) / worth(after ? cashAfter : cash, after ? sharesAfter : shares)) * 100;

  // Ready for the keyboard, and in sight, without jumping the page; then the figures move on.
  useEffect(() => {
    const el = button.current;
    el?.focus({ preventScroll: true });
    el?.closest("[role=dialog]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const timer = window.setTimeout(() => setAfter(true), 350);
    return () => window.clearTimeout(timer);
  }, []);

  function confirm() {
    if (confirmed) return;
    setConfirmed(true);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => onDone(true), calm ? 0 : 520);
  }

  // One row of the card rising in, `i` rows after the first.
  const row = (i: number) => ({ className: "rise-in", style: { animationDelay: `${120 + i * 60}ms` } });

  return (
    <div
      className={`absolute inset-0 z-20 grid place-items-center rounded-xl bg-slate-50/70 p-4 backdrop-blur-[2px] ${
        leaving ? "recap-out" : "recap-in"
      }`}
      onClick={() => !confirmed && onDone(false)}
      onKeyDown={(e) => e.key === "Escape" && !confirmed && onDone(false)}
    >
      <div
        role="dialog"
        aria-label={`${buying ? "Buy" : "Sell"} ${ask.shares} ${sharesWord(ask.shares)}`}
        className="confirm-card recap-card w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span
            className={`test-mark-live grid size-10 shrink-0 place-items-center rounded-full ${
              buying ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-900"
            }`}
          >
            {buying ? <BuyMark className="size-5" /> : <SellMark className="size-5" />}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Day {day} · review your order
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {buying ? "Buy" : "Sell"} {ask.shares.toLocaleString("en-CA")} {sharesWord(ask.shares)}?
            </p>
            <p className="text-xs text-slate-500">{ask.name}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-1.5 text-sm tabular-nums">
          <div {...row(0)}>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Price per share</dt>
              <dd className="text-slate-900">{nativeText(price, currency)}</dd>
            </div>
          </div>
          {/* In another currency: today's rate, which turns it into the CAD paid or received. */}
          {foreign && (
            <div {...row(1)}>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Exchange rate</dt>
                <dd className="text-slate-900">{rateText(rate, currency)}</dd>
              </div>
            </div>
          )}
          <div {...row(1)}>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{buying ? "Total cost" : "You receive"}</dt>
              <dd className="text-right font-semibold text-slate-900">
                {ask.shares.toLocaleString("en-CA")} × {nativeText(price, currency)} ={" "}
                <span className="text-base">{nativeText(amount, cur)}</span>
                {foreign && <span className="block text-xs font-normal text-slate-500">{`≈ ${money.format(total)} CAD`}</span>}
              </dd>
            </div>
          </div>
          {/* How a purchase in another currency is paid: from the cash in it, then exchanged
              from CAD for the rest; a sale's money is kept in its currency. */}
          {foreign && buying && payment && (
            <div {...row(2)}>
              <div className="space-y-0.5 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                {payment.fromHeld > 0 && (
                  <p className="flex justify-between gap-3">
                    <span>{`From your ${cur} cash`}</span>
                    <span className="font-semibold text-slate-900">{nativeText(payment.fromHeld, cur)}</span>
                  </p>
                )}
                {payment.short > 0 && (
                  <p className="flex justify-between gap-3">
                    <span>Exchanged from CAD for you</span>
                    <span className="font-semibold text-slate-900">
                      {`${money.format(payment.cadPaid)} → ${nativeText(payment.short, cur)}`}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
          {foreign && !buying && (
            <div {...row(2)}>
              <p className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                {`The money is kept in ${cur}, not exchanged back: exchange it to CAD whenever you like.`}
              </p>
            </div>
          )}
          <div {...row(2)}>
            <div className="flex justify-between gap-4 border-t border-slate-100 pt-1.5">
              <dt className="text-slate-500">{foreign ? "Cash in CAD" : "Cash"}</dt>
              <dd className="text-slate-900">
                {money.format(cad)} <span className="text-slate-400">→</span>{" "}
                <span className="font-semibold">
                  <Tween value={after ? cadAfter : cad} format={moneyText} />
                </span>
              </dd>
            </div>
            {foreign && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{`Cash in ${cur}`}</dt>
                <dd className="text-slate-900">
                  {nativeText(held, cur)} <span className="text-slate-400">→</span>{" "}
                  <span className="font-semibold">
                    <Tween value={after ? heldAfter : held} format={(x) => nativeText(x, cur)} />
                  </span>
                </dd>
              </div>
            )}
          </div>
          <div {...row(3)}>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Shares</dt>
              <dd className="text-slate-900">
                {shares.toLocaleString("en-CA")} <span className="text-slate-400">→</span>{" "}
                <span className="font-semibold">
                  <Tween value={after ? sharesAfter : shares} format={countText} />
                </span>
              </dd>
            </div>
          </div>
        </dl>

        {/* The money, split between cash and shares: sliding from now to after the trade. */}
        <div {...row(4)} className="rise-in mt-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden>
            <span
              className="h-full bg-slate-400 transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: `${cashShare}%` }}
            />
            <span className="h-full flex-1 border-l-2 border-white bg-slate-900" />
          </div>
          <p className="mt-1 flex justify-between text-xs tabular-nums text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-slate-400" />
              Cash <Tween value={cashShare} format={(x) => `${Math.round(x)}%`} />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-slate-900" />
              In shares <Tween value={100 - cashShare} format={(x) => `${Math.round(x)}%`} />
            </span>
          </p>
        </div>

        <p
          {...row(5)}
          className="confirm-warning rise-in mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 transition-colors duration-300"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0 overflow-visible">
            <path
              className="confirm-shackle"
              d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <rect x="3" y="6.5" width="10" height="7.5" rx="1.5" fill="currentColor" />
          </svg>
          Once confirmed, this trade can&apos;t be undone.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onDone(false)}
            disabled={confirmed}
            className={`${LIGHT} ${ACTION} flex-1 justify-center`}
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-3.5 transition-transform duration-300 group-enabled:group-hover:rotate-90"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
            Cancel
          </button>
          <button
            ref={button}
            type="button"
            onClick={confirm}
            className={`confirm-go ${confirmed ? `${BUTTON} bg-green-700 text-white` : DARK} ${ACTION} flex-1 justify-center`}
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                key={confirmed ? "drawn" : "rest"}
                className={confirmed ? "confirm-check" : ""}
                pathLength={1}
                d="m3 8.5 3.2 3.2L13 4.8"
              />
            </svg>
            {confirmed ? "Order placed" : `Place ${buying ? "buy" : "sell"} order`}
          </button>
        </div>
      </div>
    </div>
  );
}

// A warning under the trading controls (why a trade can't be made, or why prices didn't
// load), with its warning mark. It fades and slides in, opening up room for itself, and when
// it is cleared it fades out as the room closes, keeping its words until it has gone; each
// new attempt (`attempt`) brings it in afresh, so a repeat is noticed.
function Notice({ message, attempt }: { message: string | null; attempt: number }) {
  const [last, setLast] = useState(message);
  if (message && message !== last) setLast(message);
  const open = Boolean(message);
  return (
    <div
      role="alert"
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        {last && (
          <p
            key={attempt}
            className="notice-in mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <WarnMark className="size-4 text-red-600" />
            {open ? message : last}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
      {note && <dd className="text-xs text-slate-500">{note}</dd>}
    </div>
  );
}
