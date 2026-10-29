"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getSandboxSetHistory, getSandboxSetPrices } from "@/app/actions/sandbox";
import DiamondLoader from "@/components/DiamondLoader";
import FoldButton from "@/components/FoldButton";
import HoldingsDeck from "@/components/HoldingsDeck";
import KindMark from "@/components/KindMark";
import PickBoard from "@/components/PickBoard";
import {
  type Figures,
  amountText,
  countText as figureCount,
  dayText as figureDay,
} from "@/components/PickCards";
import { AliasName, useAliases } from "@/components/SandboxAliases";
import { useStage } from "@/components/SandboxStage";
import SandboxChart from "@/components/SandboxChart";
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
  about: string | null; // what it does, its name hidden
  sector: string | null; // its NAICS group's name
  currency: string | null; // what it trades in
  figures: Figures;
};
type Side = "Bought" | "Sold";
type Trade = { symbol: string; name: string; day: number; side: Side; shares: number; price: number };
// A trade waiting to be confirmed.
type Ask = { symbol: string; name: string; side: Side; shares: number };
// What is held of a pick: how many shares, and what they cost (for their average price; a sale
// takes its shares out at that average).
type Holding = { shares: number; cost: number };
// What happened over the days just passed, shown before they come in: from Day `from` to
// Day `to`, the account's value on each of those days (at the shares held throughout), how
// each pick moved, and how each position did; with each pick's new closes and which of
// those days (by number) begin a new year, to bring in once it is seen.
type Recap = {
  from: number;
  to: number;
  values: number[];
  moves: { name: string; pct: number }[];
  positions: { name: string; shares: number; gain: number }[];
  days: Record<string, { closes: number[]; yearStarts: number[] }>;
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
function verdict(pct: number) {
  if (pct >= 10)
    return { label: "Gain", tone: "text-green-700", note: "You grew your money by 10% or more." };
  if (pct <= -10) return { label: "Loss", tone: "text-red-600", note: "You lost 10% or more of your money." };
  if (pct > 5) return { label: "Above average", tone: "text-green-700", note: "Up between 5% and 10%." };
  if (pct < -5) return { label: "Below average", tone: "text-red-600", note: "Down between 5% and 10%." };
  return { label: "Average", tone: "text-slate-900", note: "Within 5% of where you started." };
}

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
  const [quitLeaving, setQuitLeaving] = useState(false);
  const panelTop = useRef<HTMLDivElement>(null);
  // Each pick's closes so far, Day 1 first (today is the last); its closes before Day 1, for
  // the chart to look back on; and where each year begins among them all (by index), for
  // the chart's YTD range.
  const [prices, setPrices] = useState<Record<string, number[]>>({});
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [yearStarts, setYearStarts] = useState<Record<string, number[]>>({});
  const [cash, setCash] = useState(amount);
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
  // Whether the chosen pick's general info is open (hidden to begin with).
  const [infoOpen, setInfoOpen] = useState(false);
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
  const invested = picks.reduce((sum, p) => sum + heldOf(p.symbol).shares * priceOf(p.symbol), 0);
  const value = cents(cash + invested);
  const sinceStart = ((value - amount) / amount) * 100;

  // The pick shown, and its figures.
  const pick = picks.find((p) => p.symbol === selected) ?? picks[0];
  const price = priceOf(pick.symbol);
  const { shares, cost } = heldOf(pick.symbol);
  const affordable = price > 0 ? Math.floor(cash / price) : 0;
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
      setBefore({ day: 0, value: amount });
      setPrices(each((s) => dayOne[s].closes));
      setOrders({});
      setStatus("trading");
      setLeaving(false);
      setTesting(true);
      // The set-up folds away above; keep the test in sight as it does.
      window.setTimeout(
        () => panelTop.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" }),
        60,
      );
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
          cash +
            picks.reduce(
              (sum, p) =>
                sum +
                heldOf(p.symbol).shares * (k === 0 ? priceOf(p.symbol) : loaded[p.symbol].closes[k - 1]),
              0,
            ),
        ),
      );
      const endOf = (s: string) => loaded[s].closes[steps - 1];
      setRecap({
        from: day,
        to: next,
        values,
        moves: picks.map((p) => ({
          name: nameOf(p.symbol),
          pct: ((endOf(p.symbol) - priceOf(p.symbol)) / priceOf(p.symbol)) * 100,
        })),
        positions: picks
          .filter((p) => heldOf(p.symbol).shares > 0)
          .map((p) => ({
            name: nameOf(p.symbol),
            shares: heldOf(p.symbol).shares,
            gain: cents(heldOf(p.symbol).shares * (endOf(p.symbol) - priceOf(p.symbol))),
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
      setHistory({});
      setYearStarts({});
      setCash(amount);
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
      return fail(`You can afford at most ${affordable} ${sharesWord(affordable)} today.`);
    if (side === "Sold" && n > shares) return fail(`You only hold ${shares} ${sharesWord(shares)}.`);
    setError(null);
    setAsk({ symbol: pick.symbol, name: nameOf(pick.symbol), side, shares: n });
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
        const held = heldOf(symbol);
        const average = held.shares ? held.cost / held.shares : 0;
        setCash((c) => cents(side === "Bought" ? c - n * at : c + n * at));
        setHoldings((h) => ({
          ...h,
          [symbol]:
            side === "Bought"
              ? { shares: held.shares + n, cost: held.cost + n * at }
              : { shares: held.shares - n, cost: held.shares === n ? 0 : held.cost - n * average },
        }));
        setTrades((t) => [...t, { symbol, name, day, side, shares: n, price: at }]);
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
        const traded = trades.filter((t) => t.symbol === p.symbol);
        const made =
          traded.reduce((sum, t) => sum + (t.side === "Sold" ? 1 : -1) * t.shares * t.price, 0) +
          heldOf(p.symbol).shares * last;
        return { ...p, pct: ((last - first) / first) * 100, made: traded.length ? cents(made) : null };
      });
      return (
        <div className="rise-in mt-5 rounded-xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Result</p>
          <p className={`result-pop mt-1 text-2xl font-bold ${result.tone}`}>{result.label}</p>
          <p className="text-sm text-slate-600">{result.note}</p>
          <dl {...enter(0)} className="rise-in mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Stat label="Started with" value={money.format(amount)} />
            <Stat label={`Worth on Day ${days}`} value={<Tween value={value} format={moneyText} />} />
            <Stat
              label="Return"
              value={<span className={tone(sinceStart)}>{pctText(sinceStart)}</span>}
              note={signed(value - amount, money.format(Math.abs(value - amount)))}
            />
          </dl>
          {/* How each pick did, and what trading it made. */}
          <div
            {...enter(1)}
            className="rise-in mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Pick</th>
                  <th className="px-3 py-2 text-right font-medium">Over the test</th>
                  <th className="px-3 py-2 text-right font-medium">Your trading</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-slate-900">{nameOf(r.symbol)}</td>
                    <td className={`px-3 py-1.5 text-right ${tone(r.pct)}`}>{pctText(r.pct)}</td>
                    <td
                      className={`px-3 py-1.5 text-right ${r.made === null ? "text-slate-400" : tone(r.made)}`}
                    >
                      {r.made === null ? "—" : changeText(r.made)}
                    </td>
                  </tr>
                ))}
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
            <p className="text-lg font-semibold text-slate-900">
              Day <Tween value={day} format={dayText} />{" "}
              <span className="font-normal text-slate-500">of {days}</span>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your picks</p>
            <p className="text-[11px] text-slate-400">
              Choose one to trade it. Give it a name of your own with{" "}
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
                  currency: p.currency,
                  price: now,
                  move: day > 1 && then ? ((now - then) / then) * 100 : null,
                  held: heldOf(p.symbol).shares,
                };
              })}
            />
          </div>
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
              </div>
              {/* Its general info, as the Search page's About has it (but with its name hidden):
                folded away to begin with, a line saying it opens. */}
              <PickInfo pick={pick} open={infoOpen} onToggle={() => setInfoOpen(!infoOpen)} />
              <SandboxChart
                symbol={pick.symbol}
                history={history[pick.symbol] ?? []}
                prices={prices[pick.symbol] ?? []}
                yearStarts={yearStarts[pick.symbol] ?? []}
                trades={trades.filter((t) => t.symbol === pick.symbol)}
              />
            </div>
          </EaseHeight>
        </div>

        {/* Where the money is: the cash, what is invested, the account, and the change since
            the last move; then what is held, as a deck of cards. */}
        <div {...enter(3)} className="rise-in mt-5 border-t border-slate-200 pt-4">
          <dl className="mt-0 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Cash" value={<Tween value={cash} format={moneyText} />} />
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
                  value: heldOf(p.symbol).shares * priceOf(p.symbol),
                  gain: cents(heldOf(p.symbol).shares * priceOf(p.symbol) - heldOf(p.symbol).cost),
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
                      <Tween value={shares * price} format={moneyText} />
                    </span>{" "}
                    today,{" "}
                    <span
                      className={`font-semibold tabular-nums transition-colors duration-500 ${tone(shares * price - cost)}`}
                    >
                      <Tween value={shares * price - cost} format={changeText} />
                    </span>{" "}
                    on what you paid.
                  </p>
                ) : (
                  <p key="none" className="text-fade-in">
                    You hold none of it. Today&apos;s price is{" "}
                    <span className="font-semibold tabular-nums text-slate-900">
                      {money.format(price)}
                      {pick.currency ? ` ${pick.currency}` : ""}
                    </span>
                    : you can afford up to{" "}
                    <span className="font-semibold tabular-nums text-slate-900">
                      {affordable.toLocaleString("en-CA")} {sharesWord(affordable)}
                    </span>
                    .
                  </p>
                )}
              </div>
            </div>

            {/* Trading it at today's price: where the money is (and would be, after the order
              being entered), then a ticket to buy and a ticket to sell, side by side. */}
            <div className="mt-3 rounded-lg bg-white p-4 shadow-sm">
              <MoneyTiles
                cash={cash}
                shares={shares}
                price={price}
                account={value}
                side={working}
                size={sizes[working]}
                fills={working === "Sold" ? sizes.Sold <= shares : sizes.Bought <= affordable}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(["Bought", "Sold"] as const).map((side) => (
                  <OrderTicket
                    key={side}
                    side={side}
                    text={ticket[side]}
                    size={sizes[side]}
                    most={side === "Bought" ? affordable : shares}
                    price={price}
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
            <button type="button" onClick={() => setStatus("done")} className={`${DARK} ${ACTION}`}>
              <FinishMark className="size-4" />
              Finish the test
            </button>
          )}
        </div>
        {recap && <RecapCard recap={recap} leaving={recapLeaving} onDone={moveOn} />}
        {quitting && <QuitCard day={day} trades={trades.length} leaving={quitLeaving} onDone={quit} />}
        {ask && (
          <ConfirmTrade
            ask={ask}
            day={day}
            price={priceOf(ask.symbol)}
            currency={picks.find((p) => p.symbol === ask.symbol)?.currency ?? null}
            cash={cash}
            shares={heldOf(ask.symbol).shares}
            leaving={askLeaving}
            onDone={settle}
          />
        )}
      </div>
    );
  }
}

// The chosen pick's general info, above its chart, as the Search page's About has it but with
// nothing that names it (its name, its website): its sector (its badge and NAICS group), its
// industry and place, what it does, and its figures with what funds it. Folded away to begin
// with under a line saying what it holds; its Fold / Open button (or that line) opens it, and
// it stays open or folded as other picks are chosen.
function PickInfo({ pick, open, onToggle }: { pick: Pick; open: boolean; onToggle: () => void }) {
  const f = pick.figures;
  const funded =
    f && f.totalAssets && f.totalLiabilities !== null && f.totalAssets > 0
      ? Math.min(100, Math.max(0, (f.totalLiabilities / f.totalAssets) * 100))
      : null;
  return (
    <div className="mt-2 rounded-lg bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className="kind-badge kind-badge-plain grid size-8 shrink-0 place-items-center rounded-lg shadow-sm"
          style={{ background: pick.color, color: pick.mark, ["--badge" as string]: pick.color }}
        >
          <KindMark kind={pick.kind} className="size-4" />
        </span>
        <button type="button" onClick={onToggle} className="group min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-slate-900">General info</span>
          <span className="block truncate text-xs text-slate-500 transition group-hover:text-slate-900">
            {open
              ? pick.line || "About this pick"
              : `${pick.sector ?? (pick.kind === "ETF" ? "A fund" : "Sector unknown")} · open to see what it does${
                  f ? " and its figures" : ""
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
              <dt className="text-slate-500">Industry and place</dt>
              <dd className="font-semibold text-slate-900">{pick.line || "—"}</dd>
            </div>
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
              <p className="text-xs text-slate-500">A fund: no company figures.</p>
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
// more than one day, while anything was held); the biggest risers and fallers among the
// picks; and how each position did. It comes alive as it opens: its day, week or month mark
// plays, its rows rise in one after another, and its figures count from where the days began
// to where they ended as the little chart draws itself. Pointing along the little chart shows
// each day's value. It moves on by itself once its timer bar runs out (paused while pointed
// at), or at once when clicked anywhere, or with Escape.
function RecapCard({ recap, leaving, onDone }: { recap: Recap; leaving: boolean; onDone: () => void }) {
  const { from, to, values, moves, positions } = recap;
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
  // The biggest riser and faller among the picks (just the one, with a single pick).
  const ranked = [...moves].sort((a, b) => b.pct - a.pct);
  const movers = ranked.length > 1 ? [ranked[0], ranked[ranked.length - 1]] : ranked;
  const SHOWN = 4;

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

          {/* The biggest riser and faller among the picks. */}
          <div {...row(2)}>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500">Biggest moves</p>
              <ul className="mt-1 space-y-0.5 text-sm tabular-nums">
                {movers.map((m) => (
                  <li key={m.name} className="flex justify-between gap-3">
                    <span className="truncate text-slate-700">{m.name}</span>
                    <span className={`font-semibold ${tone(m.pct)}`}>
                      <Tween value={after ? m.pct : 0} format={pctText} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* How each position did. */}
          <div {...row(3)}>
            <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {positions.length ? (
                <>
                  <p className="text-xs text-slate-500">Your positions</p>
                  <ul className="mt-1 space-y-0.5 tabular-nums">
                    {positions.slice(0, SHOWN).map((p) => (
                      <li key={p.name} className="flex justify-between gap-3">
                        <span className="truncate">
                          {p.name} · {p.shares.toLocaleString("en-CA")} {sharesWord(p.shares)}
                        </span>
                        <span className={`font-semibold ${tone(p.gain)}`}>
                          <Tween value={after ? p.gain : 0} format={changeText} />
                        </span>
                      </li>
                    ))}
                  </ul>
                  {positions.length > SHOWN && (
                    <p className="mt-0.5 text-xs text-slate-400">and {positions.length - SHOWN} more</p>
                  )}
                </>
              ) : (
                "You held no shares, so your money stayed as it was."
              )}
            </div>
          </div>

          <div {...row(4)}>
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

// Where the money is: the cash, what the shares held of the pick shown are worth, and the
// whole account (`account`: the cash and every position). While
// an order is being entered (that can be filled), the cash and the shares show where they
// would end up after it, and by how much, below their figures; it all counts to each new
// value, and the projections open and close smoothly.
function MoneyTiles({
  cash,
  shares,
  price,
  account,
  side,
  size,
  fills,
}: {
  cash: number;
  shares: number;
  price: number;
  account: number;
  side: Side | null;
  size: number;
  fills: boolean;
}) {
  const showing = side !== null && size > 0 && fills;
  const total = size * price;
  const cashAfter = side === "Sold" ? cash + total : cash - total;
  const sharesAfter = side === "Sold" ? shares - size : shares + size;
  const tile = "rounded-lg bg-slate-50 px-3 py-2";

  // What a figure would become after the order, and by how much, opening below it.
  const after = (now: number, then: number, format: (x: number) => string, text: (x: number) => string) => (
    <dd
      className={`grid text-xs tabular-nums transition-[grid-template-rows,opacity] duration-300 ease-out ${
        showing ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
      aria-hidden={!showing}
    >
      <span className="overflow-hidden text-slate-500">
        → <Tween value={then} format={format} />{" "}
        <span className={`font-semibold ${tone(then - now)}`}>
          (<Tween value={then - now} format={text} />)
        </span>
      </span>
    </dd>
  );

  return (
    <dl className="grid grid-cols-3 gap-2 text-sm tabular-nums">
      <div className={tile}>
        <dt className="text-xs text-slate-500">Cash</dt>
        <dd className="font-semibold text-slate-900">
          <Tween value={cash} format={moneyText} />
        </dd>
        {after(cash, cashAfter, moneyText, changeText)}
      </div>
      <div className={tile}>
        <dt className="text-xs text-slate-500">
          Position · <Tween value={shares} format={countText} /> {sharesWord(shares)}
        </dt>
        <dd className="font-semibold text-slate-900">
          <Tween value={shares * price} format={moneyText} />
        </dd>
        {after(shares * price, sharesAfter * price, moneyText, changeText)}
      </div>
      <div className={tile}>
        <dt className="text-xs text-slate-500">Account value</dt>
        <dd className="font-semibold text-slate-900">
          <Tween value={account} format={moneyText} />
        </dd>
      </div>
    </dl>
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
            <Tween value={size * price} format={moneyText} />
          </span>{" "}
          ({size.toLocaleString("en-CA")} × {money.format(price)})
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
  currency,
  cash,
  shares,
  leaving,
  onDone,
}: {
  ask: Ask;
  day: number;
  price: number;
  currency: string | null; // what it trades in
  cash: number;
  shares: number;
  leaving: boolean;
  onDone: (confirmed: boolean) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const buying = ask.side === "Bought";
  const total = cents(ask.shares * price);
  const cashAfter = cents(buying ? cash - total : cash + total);
  const sharesAfter = buying ? shares + ask.shares : shares - ask.shares;
  // Whether the figures have moved on to after the trade (just after the card opens), and
  // whether it has been confirmed (the check drawing itself).
  const [after, setAfter] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  // The share of the money in cash, now and after.
  const worth = (c: number, n: number) => c + n * price || 1;
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
              <dd className="text-slate-900">
                {money.format(price)}
                {currency && <span className="ml-1 text-xs font-semibold text-slate-500">{currency}</span>}
              </dd>
            </div>
          </div>
          <div {...row(1)}>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{buying ? "Total cost" : "You receive"}</dt>
              <dd className="font-semibold text-slate-900">
                {ask.shares.toLocaleString("en-CA")} × {money.format(price)} ={" "}
                <span className="text-base">{money.format(total)}</span>
              </dd>
            </div>
          </div>
          <div {...row(2)}>
            <div className="flex justify-between gap-4 border-t border-slate-100 pt-1.5">
              <dt className="text-slate-500">Cash</dt>
              <dd className="text-slate-900">
                {money.format(cash)} <span className="text-slate-400">→</span>{" "}
                <span className="font-semibold">
                  <Tween value={after ? cashAfter : cash} format={moneyText} />
                </span>
              </dd>
            </div>
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
