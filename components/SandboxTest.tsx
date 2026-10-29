"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getSandboxHistory, getSandboxPrices } from "@/app/actions/sandbox";
import DiamondLoader from "@/components/DiamondLoader";
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
import Tween from "@/components/Tween";
import { tradingSpan } from "@/lib/tradingTime";

// The Sandbox's trading test. Starting with `amount` dollars, the player sees Day 1's
// closing price of the hidden company or ETF, buys or sells whole shares at it, then moves
// on a day, a week (5 trading days) or a month (21) at a time to Day `days`, seeing how
// their holdings change and a chart of every day so far, and is rated at the end. Prices
// count as dollars as they are (no exchange rate). Each day's price is fetched only when
// that day comes, so the days ahead aren't in the page. Moving on is smooth: the day, the
// price and what the holdings are worth count to their new figures (Tween) as the chart's
// new days slide in (SandboxChart) and the progress bar fills. Trading is by order tickets,
// one to buy and one to sell (OrderTicket), one in use at a time (clicking the other switches,
// each keeping its number until the test moves on): a number of shares, typed in or stepped
// up and down by 1 or 10, its estimated cost or proceeds and where the cash and the
// shares would end up shown as it changes (MoneyTiles); then reviewed and confirmed
// (ConfirmTrade), which places the order, for good: once made,
// a badge floats up from the holdings, the figures count to their new values, the trade
// slides into the log and a mark pops up on the chart where it was made.
type Trade = { day: number; side: "Bought" | "Sold"; shares: number; price: number };
// A trade waiting to be confirmed.
type Ask = { side: "Bought" | "Sold"; shares: number };
// What happened over the days just passed, shown before they come in: from Day `from` (at
// `start`) to Day `to` (at `end`), their closes, their lowest and highest, and the shares
// held throughout; and which of those days (by number) begin a new year.
type Recap = {
  from: number;
  to: number;
  start: number;
  end: number;
  closes: number[];
  shares: number;
  yearStarts: number[];
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
const GROW_MS = 750;
const pause = (ms: number) => new Promise((done) => window.setTimeout(done, ms));

// One part of the trading panel rising in, `i` parts after the first, as the test starts.
const enter = (i: number) => ({
  className: "rise-in",
  style: { animationDelay: `${120 + i * 110}ms`, animationDuration: "700ms" },
});

export default function SandboxTest({
  symbol,
  from,
  days,
  amount,
  pickKey,
  testKey,
  againHref,
}: {
  symbol: string;
  from: string;
  days: number;
  amount: number;
  // The keys of the Sandbox's areas this test is in (the pick's, and the test's own: see
  // SandboxSwap), and the address for trying the pick again (the same choices, another Day 1).
  pickKey: string;
  testKey: string;
  againHref: string;
}) {
  const { change } = useSandboxSwap();
  const [status, setStatus] = useState<"ready" | "trading" | "done">("ready");
  // The closes of every day so far, Day 1 first: today is the last.
  const [prices, setPrices] = useState<number[]>([]);
  // Every close before Day 1, loaded when the test starts, for the chart to look back on.
  const [history, setHistory] = useState<number[]>([]);
  // Where each year begins among every day (the history, then the test's days), by index,
  // for the chart's YTD range.
  const [yearStarts, setYearStarts] = useState<number[]>([]);
  const [cash, setCash] = useState(amount);
  const [shares, setShares] = useState(0);
  // What the shares held cost, for their average price (a sale takes its shares out at that
  // average).
  const [cost, setCost] = useState(0);
  // A trade asked for and waiting to be confirmed, and whether its card is going away.
  const [ask, setAsk] = useState<Ask | null>(null);
  const [askLeaving, setAskLeaving] = useState(false);
  // The badge that floats up from the holdings after a trade ("+10", "−5"), keyed so each
  // trade starts a new one; and how many errors there have been, so each one comes in anew.
  const [flash, setFlash] = useState<{ key: number; text: string; side: Ask["side"] } | null>(null);
  const [errors, setErrors] = useState(0);
  // The two order tickets' numbers of shares, as typed (or stepped), and their boxes, which
  // give a little bump when stepped so the change is seen.
  const [orders, setOrders] = useState<Record<Ask["side"], string>>({ Bought: "", Sold: "" });
  // The ticket in use (clicking the other switches to it); the other keeps its number, locked.
  const [working, setWorking] = useState<Ask["side"]>("Bought");
  const boxes = { Bought: useRef<HTMLInputElement>(null), Sold: useRef<HTMLInputElement>(null) };
  const noOrders = { Bought: "", Sold: "" };

  // Steps a ticket's number of shares: by `by` (never below none), or to `to`.
  function step(side: Ask["side"], { by, to }: { by?: number; to?: number }) {
    const next = Math.max(to ?? sizes[side] + (by ?? 0), 0);
    setOrders((o) => ({ ...o, [side]: next ? String(next) : "" }));
    setError(null);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      boxes[side].current?.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
        { duration: 260, easing: "ease-out" },
      );
    }
  }
  // What everything was worth on the day moved on from (0 before Day 1), for the change since.
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

  // Starts the test: loads Day 1's price and the history before it, with the loading mark
  // showing for a moment at least, then fades the start panel's contents away and moves on
  // to trading. With reduced motion, it moves on as soon as the prices are in.
  function begin() {
    setError(null);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    startTransition(async () => {
      const [[dayOne, past]] = await Promise.all([
        Promise.all([getSandboxPrices(symbol, from, 1, 1), getSandboxHistory(symbol, from)]),
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
      setHistory(past.closes);
      setYearStarts(past.yearStarts);
      setBefore({ day: 0, value: amount });
      setPrices(dayOne.closes);
      setOrders(noOrders);
      setStatus("trading");
      setLeaving(false);
    });
  }

  const day = prices.length;
  // Today's price, to the cent, as shown: what shares are bought and sold at.
  const price = cents(prices[day - 1] ?? 0);
  const value = cents(cash + shares * price);
  const sinceStart = ((value - amount) / amount) * 100;
  const affordable = price > 0 ? Math.floor(cash / price) : 0;
  // Each ticket's number of shares, as a count (0 while none is set). Both are kept until the
  // test moves on.
  const sizeOf = (text: string) => {
    const n = Number(text);
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  const sizes = { Bought: sizeOf(orders.Bought), Sold: sizeOf(orders.Sold) };

  // Moves on to Day `next`, in two beats: the days since are loaded and summed up first (a
  // recap over the panel: how the price went and what it did to the shares held); then, as
  // it fades, they come in (moveOn), the chart sliding on and the figures counting.
  function goTo(next: number) {
    setError(null);
    startTransition(async () => {
      const days = await getSandboxPrices(symbol, from, day + 1, next);
      if (days === null) {
        setError("Those days' prices couldn't be loaded. Try again.");
        return;
      }
      const { closes } = days;
      setRecap({
        from: day,
        to: next,
        start: price,
        end: closes[closes.length - 1],
        closes,
        shares,
        yearStarts: days.yearStarts,
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
      setPrices((p) => [...p, ...done.closes]);
      setYearStarts((y) => [...y, ...done.yearStarts.map((d) => history.length + d - 1)]);
      setOrders(noOrders);
      setRecap(null);
      setRecapLeaving(false);
    }, RECAP_OUT_MS);
  }

  // After the test: the same pick again, from another Day 1, the page gliding up to its
  // timeframe so it can be chosen afresh (the testing ground fades meanwhile); or out, back
  // to before any pick (everything below the pick fades).
  function tryAgain() {
    change(testKey, () => againHref);
    document.getElementById("sandbox-timeframe")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exit() {
    change(pickKey, () => "/sandbox");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function fail(message: string) {
    setError(message);
    setErrors((n) => n + 1);
  }

  // Asks to buy or sell `n` shares at today's price: if it can be done, the confirming card
  // comes up; if not, why not.
  function request(side: Ask["side"], n: number) {
    if (!Number.isInteger(n) || n < 1) return fail("Enter a whole number of shares.");
    if (side === "Bought" && n > affordable)
      return fail(`You can afford at most ${affordable} ${sharesWord(affordable)} today.`);
    if (side === "Sold" && n > shares) return fail(`You only hold ${shares} ${sharesWord(shares)}.`);
    setError(null);
    setAsk({ side, shares: n });
  }

  // Closes the confirming card; confirmed, the trade is made as it goes, for good.
  function settle(confirmed: boolean) {
    if (!ask || askLeaving) return;
    const done = ask;
    setAskLeaving(true);
    window.setTimeout(() => {
      if (confirmed) {
        const { side, shares: n } = done;
        const average = shares ? cost / shares : 0;
        setCash((c) => cents(side === "Bought" ? c - n * price : c + n * price));
        setShares((s) => (side === "Bought" ? s + n : s - n));
        setCost((c) => (side === "Bought" ? c + n * price : shares === n ? 0 : c - n * average));
        setTrades((t) => [...t, { day, side, shares: n, price }]);
        setFlash({ key: Date.now(), text: `${side === "Bought" ? "+" : "−"}${n}`, side });
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
              Day 1&apos;s price will be shown. Buy as many shares as you like with your{" "}
              {money.format(amount)}, then go day by day to Day {days}.
            </p>
            {error && <p className="w-full text-sm text-red-600">{error}</p>}
          </div>
        </div>
      );
    }

    if (status === "done") {
      const result = verdict(sinceStart);
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
          <div {...enter(1)}>
            <SandboxChart
              symbol={symbol}
              history={history}
              prices={prices}
              yearStarts={yearStarts}
              trades={trades}
            />
          </div>
          {/* What next: the same pick again (choosing its timeframe and amount afresh, and
              always from another Day 1), or out, back to before any pick. */}
          <div {...enter(2)} className="rise-in mt-5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={tryAgain} className={`${DARK} ${ACTION}`}>
              <RetryMark className="size-4" />
              Try this pick again
            </button>
            <button type="button" onClick={exit} className={`${LIGHT} ${ACTION}`}>
              <ExitMark className="size-4" />
              Exit
            </button>
            <p className="text-xs text-slate-500">
              Trying again keeps this pick; you&apos;ll start from another point in its history.
            </p>
          </div>
        </div>
      );
    }

    const change = cents(value - before.value);
    const left = days - day;
    const canTrade = !pending && !recap && !ask;
    // Moving on: a day, a week or a month, each while that many days are left.
    const steps = [
      { label: "Next day", days: 1, Mark: DayMark },
      { label: "Next week", days: 5, Mark: WeekMark },
      { label: "Next month", days: 21, Mark: MonthMark },
    ].filter((s) => s.days <= left);
    return (
      <div className="rise-in relative mt-5 rounded-xl bg-slate-50 p-5">
        <div {...enter(0)}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-lg font-semibold text-slate-900">
              Day <Tween value={day} format={dayText} />{" "}
              <span className="font-normal text-slate-500">of {days}</span>
            </p>
            <p className="text-sm text-slate-500">
              Price{" "}
              <span className="text-lg font-semibold tabular-nums text-slate-900">
                <Tween value={price} format={moneyText} />
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

        <div {...enter(1)}>
          <SandboxChart
            symbol={symbol}
            history={history}
            prices={prices}
            yearStarts={yearStarts}
            trades={trades}
          />
        </div>

        <dl {...enter(2)} className="rise-in mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Cash" value={<Tween value={cash} format={moneyText} />} />
          <Stat
            label="Shares held"
            value={
              <span className="relative">
                <Tween value={shares} format={countText} />
                {flash && (
                  <span
                    key={flash.key}
                    aria-hidden
                    className={`trade-flash pointer-events-none absolute -top-1 left-full ml-2 rounded-full px-1.5 text-xs font-bold ${
                      flash.side === "Bought" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    }`}
                  >
                    {flash.text}
                  </span>
                )}
              </span>
            }
            note={<Tween value={shares * price} format={moneyText} />}
          />
          <Stat
            label="Total value"
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
              <span className={`transition-colors duration-500 ${tone(change)}`}>
                <Tween value={change} format={changeText} />
              </span>
            }
            note={<Tween value={before.value ? (change / before.value) * 100 : 0} format={pctText} />}
          />
        </dl>

        {/* What is held: how many shares, what they cost on average, and how they're doing. */}
        <div
          {...enter(3)}
          className="rise-in mt-5 rounded-lg bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"
        >
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
              You hold no shares. Today&apos;s price is{" "}
              <span className="font-semibold tabular-nums text-slate-900">{money.format(price)}</span>: you
              can afford up to{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {affordable.toLocaleString("en-CA")} {sharesWord(affordable)}
              </span>
              .
            </p>
          )}
        </div>

        {/* Trading at today's price: where the money is (and would be, after the order being
            entered), then a ticket to buy and a ticket to sell, side by side. */}
        <div {...enter(4)} className="rise-in mt-3 rounded-lg bg-white p-4 shadow-sm">
          <MoneyTiles
            cash={cash}
            shares={shares}
            price={price}
            side={working}
            size={sizes[working]}
            fills={working === "Sold" ? sizes.Sold <= shares : sizes.Bought <= affordable}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(["Bought", "Sold"] as const).map((side) => (
              <OrderTicket
                key={side}
                side={side}
                text={orders[side]}
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
                  setOrders((o) => ({ ...o, [side]: text }));
                  setError(null);
                }}
                onStep={(change) => step(side, change)}
                onReview={() => request(side, sizes[side])}
              />
            ))}
          </div>
          <Notice message={error} attempt={errors} />
        </div>

        {/* Moving on: by a day, a week or a month while that many are left; then finishing. */}
        <div
          {...enter(5)}
          className="rise-in mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4"
        >
          {pending && (
            <span className="mr-auto flex items-center gap-2 text-sm text-slate-500">
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
        {/* Every trade so far, the latest first: each new one slides in, lit up a moment. */}
        {trades.length > 0 && (
          <div className="mt-5 border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your trades</p>
            <ol className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
              {trades
                .map((t, i) => (
                  <li
                    key={i}
                    className="trade-row flex items-center justify-between gap-4 rounded-md px-2 py-1.5 tabular-nums"
                  >
                    <span className="flex items-center gap-2 text-slate-600">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                          t.side === "Bought" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}
                      >
                        {t.side === "Bought" ? "BUY" : "SELL"}
                      </span>
                      <span>
                        Day {t.day}:{" "}
                        <span className="font-semibold text-slate-900">
                          {t.shares.toLocaleString("en-CA")} {sharesWord(t.shares)}
                        </span>{" "}
                        at {money.format(t.price)}
                      </span>
                    </span>
                    <span className={t.side === "Bought" ? "text-slate-900" : "text-green-700"}>
                      {t.side === "Bought" ? "−" : "+"}
                      {money.format(t.shares * t.price)}
                    </span>
                  </li>
                ))
                .reverse()}
            </ol>
          </div>
        )}

        {recap && <RecapCard recap={recap} leaving={recapLeaving} onDone={moveOn} />}
        {ask && (
          <ConfirmTrade
            ask={ask}
            day={day}
            price={price}
            cash={cash}
            shares={shares}
            leaving={askLeaving}
            onDone={settle}
          />
        )}
      </div>
    );
  }
}

// The recap of the days just passed, over the trading panel (which it dims): how long
// passed, the price then and now, a little chart of those days and their low and high (over
// more than one day), and what the move did to the shares held. It comes alive as it opens: its day, week or month mark
// plays, its rows rise in one after another, and its figures count from where the days began
// to where they ended (the day, the price, the change, the shares' gain or loss) as the
// little chart draws itself and the end of the low-to-high bar slides from the start to now.
// Pointing along the little chart shows each day's price. It moves on by itself once its
// timer bar runs out (paused while pointed at, and it says so), or at once when clicked
// anywhere, or with Escape.
function RecapCard({ recap, leaving, onDone }: { recap: Recap; leaving: boolean; onDone: () => void }) {
  const { from, to, start, end, closes, shares } = recap;
  const button = useRef<HTMLButtonElement>(null);
  const chart = useRef<HTMLDivElement>(null);
  // Whether the figures have moved on to where the days ended (just after it opens), and the
  // day pointed at along the little chart (an index into `path`), if any.
  const [after, setAfter] = useState(false);
  const [spot, setSpot] = useState<number | null>(null);
  const passed = to - from;
  const move = end - start;
  const pct = start ? (move / start) * 100 : 0;
  const held = cents(shares * move);
  const low = Math.min(start, ...closes);
  const high = Math.max(start, ...closes);
  const Mark = passed === 1 ? MoonMark : passed <= 5 ? WeekMark : MonthMark;

  // The little chart: Day `from` (the start) and every day since, in a 100 by 36 box.
  const path = [start, ...closes];
  const span = high - low || 1;
  const px = (i: number) => (path.length === 1 ? 50 : (i / (path.length - 1)) * 100);
  const py = (v: number) => 32 - ((v - low) / span) * 28;
  const line = path.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(2)},${py(v).toFixed(2)}`).join("");
  const color = move >= 0 ? "#15803d" : "#dc2626";
  const shown = spot ?? path.length - 1;
  // Where a price sits between the low and the high, as a share of the way.
  const along = (v: number) => (high === low ? 50 : ((v - low) / (high - low)) * 100);

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
    setSpot(Math.round(share * (path.length - 1)));
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
                <p className="text-xs text-slate-500">Price</p>
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

          {/* The days just passed, drawn as a little line; pointing along it shows each day.
              Not for a single day, whose line would be just the price then and now. */}
          {passed > 1 && (
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
                {/* The day shown: today at first, or the one pointed at. */}
                <span
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-[left,top] duration-150 ease-out"
                  style={{
                    left: `${px(shown)}%`,
                    top: `${(py(path[shown]) / 36) * 100}%`,
                    backgroundColor: color,
                  }}
                />
                <span
                  className={`pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded bg-white px-1.5 text-[11px] tabular-nums text-slate-600 shadow-sm transition-[left,opacity] duration-150 ease-out ${
                    spot === null ? "opacity-0" : "opacity-100"
                  }`}
                  style={{ left: `${Math.min(Math.max(px(shown), 14), 86)}%` }}
                >
                  Day {from + shown}: {money.format(path[shown])}
                </span>
              </div>
            </div>
          )}

          {/* Where the days began and ended, between their low and high. */}
          {passed > 1 && (
            <div {...row(2)}>
              <div className="mt-3">
                <div className="relative h-1.5 rounded-full bg-slate-200">
                  <span
                    className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-400 bg-white"
                    style={{ left: `${along(start)}%` }}
                    title="Where it began"
                  />
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-[left] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ left: `${along(after ? end : start)}%`, backgroundColor: color }}
                    title="Where it ended"
                  />
                </div>
                <p className="mt-1.5 flex justify-between text-xs tabular-nums text-slate-500">
                  <span>Low {money.format(low)}</span>
                  <span>High {money.format(high)}</span>
                </p>
              </div>
            </div>
          )}

          <div {...row(3)}>
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {shares > 0 ? (
                <>
                  Your {shares.toLocaleString("en-CA")} {sharesWord(shares)} {held >= 0 ? "gained" : "lost"}{" "}
                  <span className={`font-semibold tabular-nums ${tone(held)}`}>
                    <Tween value={after ? Math.abs(held) : 0} format={moneyText} />
                  </span>
                  .
                </>
              ) : (
                "You held no shares, so your money stayed as it was."
              )}
            </p>
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

// Where the money is: the cash, what the shares held are worth, and the two together. While
// an order is being entered (that can be filled), the cash and the shares show where they
// would end up after it, and by how much, below their figures; it all counts to each new
// value, and the projections open and close smoothly.
function MoneyTiles({
  cash,
  shares,
  price,
  side,
  size,
  fills,
}: {
  cash: number;
  shares: number;
  price: number;
  side: Ask["side"] | null;
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
          <Tween value={cash + shares * price} format={moneyText} />
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
  cash,
  shares,
  leaving,
  onDone,
}: {
  ask: Ask;
  day: number;
  price: number;
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
          </div>
        </div>

        <dl className="mt-4 space-y-1.5 text-sm tabular-nums">
          <div {...row(0)}>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Price per share</dt>
              <dd className="text-slate-900">{money.format(price)}</dd>
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
