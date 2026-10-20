"use client";

import { useState, useTransition } from "react";
import { getSandboxHistory, getSandboxPrices } from "@/app/actions/sandbox";
import SandboxChart from "@/components/SandboxChart";

// The Sandbox's trading test. Starting with `amount` dollars, the player sees Day 1's
// closing price of the hidden company or ETF, buys or sells whole shares at it, then moves
// on a day, a week (5 trading days) or a month (21) at a time to Day `days`, seeing how
// their holdings change and a chart of every day so far, and is rated at the end. Prices
// count as dollars as they are (no exchange rate). Each day's price is fetched only when
// that day comes, so the days ahead aren't in the page.
type Trade = { day: number; side: "Bought" | "Sold"; shares: number; price: number };

// How a test went, by its return: a gain or loss of 10% or more, average within 5%, and
// above or below average in between.
function verdict(pct: number) {
  if (pct >= 10) return { label: "Gain", tone: "text-green-700", note: "You grew your money by 10% or more." };
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

const BUTTON =
  "rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-40";
const DARK = `${BUTTON} bg-slate-900 text-white hover:bg-slate-700`;
const LIGHT = `${BUTTON} border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50`;

export default function SandboxTest({
  symbol,
  from,
  days,
  amount,
}: {
  symbol: string;
  from: string;
  days: number;
  amount: number;
}) {
  const [status, setStatus] = useState<"ready" | "trading" | "done">("ready");
  // The closes of every day so far, Day 1 first: today is the last.
  const [prices, setPrices] = useState<number[]>([]);
  // Every close before Day 1, loaded when the test starts, for the chart to look back on.
  const [history, setHistory] = useState<number[]>([]);
  const [cash, setCash] = useState(amount);
  const [shares, setShares] = useState(0);
  // What everything was worth on the day moved on from (0 before Day 1), for the change since.
  const [before, setBefore] = useState({ day: 0, value: amount });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const day = prices.length;
  const price = prices[day - 1] ?? 0;
  const value = cents(cash + shares * price);
  const sinceStart = ((value - amount) / amount) * 100;
  const affordable = price > 0 ? Math.floor(cash / price) : 0;
  const qty = Number(quantity);
  const validQty = Number.isInteger(qty) && qty > 0;

  // Moves on to Day `next`: the prices of the days since, and today's value to measure the
  // change from.
  function goTo(next: number) {
    setError(null);
    startTransition(async () => {
      const [closes, past] = await Promise.all([
        getSandboxPrices(symbol, from, day + 1, next),
        day === 0 ? getSandboxHistory(symbol, from) : history,
      ]);
      if (closes === null || past === null) {
        setError("Those days' prices couldn't be loaded. Try again.");
        return;
      }
      setHistory(past);
      setBefore({ day, value: day === 0 ? amount : value });
      setPrices((p) => [...p, ...closes]);
      setQuantity("");
      setStatus("trading");
    });
  }

  function trade(side: "Bought" | "Sold") {
    if (!validQty) return setError("Enter a whole number of shares.");
    if (side === "Bought" && qty > affordable)
      return setError(`You can afford at most ${affordable} ${affordable === 1 ? "share" : "shares"}.`);
    if (side === "Sold" && qty > shares)
      return setError(`You only hold ${shares} ${shares === 1 ? "share" : "shares"}.`);
    setError(null);
    setCash((c) => cents(side === "Bought" ? c - qty * price : c + qty * price));
    setShares((s) => (side === "Bought" ? s + qty : s - qty));
    setTrades((t) => [...t, { day, side, shares: qty, price }]);
    setQuantity("");
  }

  if (status === "ready") {
    return (
      <div className="rise-in mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4">
        <button type="button" onClick={() => goTo(1)} disabled={pending} className={DARK}>
          {pending ? "Starting…" : "Start the test"}
        </button>
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          Day 1&apos;s price will be shown. Buy as many shares as you like with your{" "}
          {money.format(amount)}, then go day by day to Day {days}.
        </p>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (status === "done") {
    const result = verdict(sinceStart);
    return (
      <div className="rise-in mt-5 rounded-xl bg-slate-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Result</p>
        <p className={`mt-1 text-2xl font-bold ${result.tone}`}>{result.label}</p>
        <p className="text-sm text-slate-600">{result.note}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Stat label="Started with" value={money.format(amount)} />
          <Stat label={`Worth on Day ${days}`} value={money.format(value)} />
          <Stat
            label="Return"
            value={<span className={tone(sinceStart)}>{pctText(sinceStart)}</span>}
            note={signed(value - amount, money.format(Math.abs(value - amount)))}
          />
        </dl>
        <SandboxChart history={history} prices={prices} />
        <button
          type="button"
          onClick={() => {
            setStatus("ready");
            setPrices([]);
            setHistory([]);
            setCash(amount);
            setShares(0);
            setBefore({ day: 0, value: amount });
            setTrades([]);
          }}
          className={`${LIGHT} mt-5`}
        >
          Try this pick again
        </button>
      </div>
    );
  }

  const change = cents(value - before.value);
  const left = days - day;
  // Moving on: a day, a week or a month, each while that many days are left.
  const steps = [
    { label: "Next day", days: 1 },
    { label: "Next week", days: 5 },
    { label: "Next month", days: 21 },
  ].filter((s) => s.days <= left);
  return (
    <div className="rise-in mt-5 rounded-xl bg-slate-50 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-lg font-semibold text-slate-900">
          Day {day} <span className="font-normal text-slate-500">of {days}</span>
        </p>
        <p className="text-sm text-slate-500">
          Price <span className="text-lg font-semibold tabular-nums text-slate-900">{money.format(price)}</span>
        </p>
      </div>
      {/* How far through the test, filling up day by day. */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-900 transition-[width] duration-500 ease-out"
          style={{ width: `${(day / days) * 100}%` }}
        />
      </div>

      <SandboxChart history={history} prices={prices} />

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Stat label="Cash" value={money.format(cash)} />
        <Stat label="Shares held" value={shares.toLocaleString("en-CA")} note={money.format(shares * price)} />
        <Stat
          label="Total value"
          value={money.format(value)}
          note={<span className={tone(sinceStart)}>{pctText(sinceStart)} since Day 1</span>}
        />
        <Stat
          label={before.day ? `Since Day ${before.day}` : "Since the start"}
          value={<span className={tone(change)}>{signed(change, money.format(Math.abs(change)))}</span>}
          note={pctText(before.value ? (change / before.value) * 100 : 0)}
        />
      </dl>

      {/* Buy or sell whole shares at today's price. */}
      <form
        className="mt-5 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          trade("Bought");
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Shares
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 tabular-nums text-slate-900"
          />
        </label>
        <button type="submit" disabled={pending || affordable === 0} className={DARK}>
          Buy
        </button>
        <button type="button" onClick={() => trade("Sold")} disabled={pending || shares === 0} className={LIGHT}>
          Sell
        </button>
        <span className="flex gap-3 pb-2 text-xs text-slate-500">
          <button type="button" onClick={() => setQuantity(String(affordable))} className="hover:text-slate-900 hover:underline">
            Max to buy: {affordable}
          </button>
          {shares > 0 && (
            <button type="button" onClick={() => setQuantity(String(shares))} className="hover:text-slate-900 hover:underline">
              Sell all: {shares}
            </button>
          )}
        </span>
      </form>

      {/* Moving on: by a day, a week or a month while that many are left; then finishing. */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
        {pending && <span className="mr-auto text-sm text-slate-500">Loading…</span>}
        {steps.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => goTo(day + s.days)}
            disabled={pending}
            className={i === 0 ? DARK : LIGHT}
          >
            {s.label} →
          </button>
        ))}
        {left === 0 && (
          <button type="button" onClick={() => setStatus("done")} className={DARK}>
            Finish the test
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {validQty && !error && (
        <p className="mt-2 text-xs text-slate-500">
          {qty} {qty === 1 ? "share" : "shares"} at today&apos;s price: {money.format(qty * price)}
        </p>
      )}

      {trades.length > 0 && (
        <ol className="mt-5 max-h-40 space-y-1 overflow-y-auto border-t border-slate-200 pt-3 text-xs text-slate-600">
          {trades
            .map((t, i) => (
              <li key={i} className="flex justify-between gap-4 tabular-nums">
                <span>
                  Day {t.day}: {t.side} {t.shares} {t.shares === 1 ? "share" : "shares"} at {money.format(t.price)}
                </span>
                <span>{money.format(t.shares * t.price)}</span>
              </li>
            ))
            .reverse()}
        </ol>
      )}
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
