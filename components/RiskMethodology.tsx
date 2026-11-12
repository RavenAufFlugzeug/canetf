"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STEP_FILL } from "@/components/riskColors";
import Swap from "@/components/Swap";
import { POPUP_CARD, POPUP_OUT_MS, popupOverlay } from "@/lib/popup";
import {
  formatMonth,
  MIN_MONTHS,
  periodOf,
  RISK_LEVELS,
  RISK_YEARS,
  type Risk,
} from "@/lib/risk";

// The walkthrough's steps: the calculation, one step at a time over the fund's own data, each
// with a chart to explore and its formula worked with the selected values; then a summary.
// (No description above the charts: each formula panel says what the step does and why.)
const STEPS = [
  { title: "Month-end prices" },
  { title: "Monthly returns" },
  { title: "Standard deviation" },
  { title: "Annualization" },
  { title: "Classification" },
  { title: "Summary" },
] as const;

const pct = (fraction: number, digits = 2) =>
  `${(fraction * 100).toFixed(digits)}%`;
const signed = (fraction: number, digits = 2) =>
  `${fraction > 0 ? "+" : fraction < 0 ? "−" : ""}${pct(Math.abs(fraction), digits)}`;
const price = (p: number) =>
  p.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const calm = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The "Methodology" button in the Risk rating section and, once clicked, its pop-up.
export default function RiskMethodology({
  risk,
  symbol,
}: {
  risk: Risk;
  symbol: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-left text-sm font-semibold text-slate-900 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        Methodology
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 text-slate-500 transition duration-300 ease-out group-hover:text-slate-900 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
        >
          <path d="M9 3h4v4M13 3 8 8M11 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2.5" />
        </svg>
      </button>
      {open && (
        <Methodology
          risk={risk}
          symbol={symbol}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// The pop-up. A rated fund gets the walkthrough (Back / Next); one not rated yet, the method
// in brief, the bands and the limitations.
function Methodology({
  risk,
  symbol,
  onClose,
}: {
  risk: Risk;
  symbol: string;
  onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  // The step shown and, for a moment after a change of view, the one leaving: the two
  // cross-fade (.fade-text-out / .fade-text-in, as the Sandbox's changing text does).
  const [view, setView] = useState<{ now: number; before: number | null }>({
    now: 0,
    before: null,
  });
  const step = view.now;
  // What is picked on each step's chart, kept while moving between steps.
  const [picks, setPicks] = useState<Picks>(() => ({
    close: risk.closes.length - 1,
    ret: Math.max(risk.returns.indexOf(risk.worst!), 0),
    horizon: 12,
    band: risk.level ?? 0,
  }));
  // The step a tag is pointed at (previewed in the step bar), and the arrival flash after a tag
  // is clicked: the destination's formula panel pulses once, so the eye lands on it.
  const [preview, setPreview] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ n: number; step: number } | null>(null);
  // Going to a step; from a tag, with `pick` (what to select there, possibly nothing).
  const goTo: GoTo = (next, pick) => {
    if (pick) {
      setPicks((p) => ({ ...p, ...pick }));
      setPreview(null);
      if (!calm()) setFlash((f) => ({ n: (f?.n ?? 0) + 1, step: next }));
    }
    if (next === view.now) return;
    const swap = viewOf(next) !== viewOf(view.now) && !calm();
    setView({ now: next, before: swap ? view.now : null });
  };
  useEffect(() => {
    if (!flash) return;
    const done = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(done);
  }, [flash]);
  useEffect(() => {
    if (view.before === null) return;
    const gone = window.setTimeout(
      () => setView((v) => ({ ...v, before: null })),
      SWAP_OUT_MS,
    );
    return () => window.clearTimeout(gone);
  }, [view.before]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const rated =
    risk.level !== null && risk.stdDev !== null && risk.closes.length > 1;

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, calm() ? 0 : POPUP_OUT_MS);
  };

  useEffect(() => closeButton.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const last = STEPS.length - 1;

  return createPortal(
    <div className={popupOverlay(leaving)} onClick={close}>
      <div
        role="dialog"
        aria-label={`Risk rating methodology for ${symbol}`}
        onClick={(e) => e.stopPropagation()}
        className={`${POPUP_CARD} my-8 max-w-2xl p-6`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Methodology
            </p>
            <p className="text-lg font-semibold text-slate-900">
              Risk rating · {symbol}
            </p>
            <p className="text-sm text-slate-500">
              CSA risk classification methodology (National Instrument 81-102,
              Appendix F)
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label="Close"
            className="group grid size-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="size-3 transition-transform duration-300 group-hover:rotate-90"
            >
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        {rated ? (
          <>
            {/* The steps: the current one dark, those visited mid-grey; each can be picked. */}
            <ol className="mt-4 grid grid-cols-6 gap-1.5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === step ? "step" : undefined}
                    className="group w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                  >
                    <span
                      className="block h-1 origin-bottom rounded-full transition-[background-color,transform,box-shadow] duration-300 ease-out group-hover:scale-y-150"
                      style={{
                        background:
                          i === step
                            ? "#0f172a"
                            : i === preview
                              ? "#475569"
                              : i < step
                                ? "#94a3b8"
                                : "#e2e8f0",
                        transform: i === preview ? "scaleY(2)" : undefined,
                        boxShadow: i === preview ? "0 0 0 3px #e2e8f0" : undefined,
                      }}
                    />
                    <span
                      className={`mt-1.5 block text-[11px] leading-tight font-medium transition-colors duration-300 ease-out group-hover:text-slate-900 ${
                        i === step || i === preview
                          ? "text-slate-900"
                          : "text-slate-400"
                      }`}
                    >
                      {i + 1}
                      <span className="max-sm:hidden">. {s.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            {/* The step area eases to each step's height, so the pop-up grows and shrinks smoothly. */}
            <SmoothHeight>
              {/* The step's chart and formula. A change of view cross-fades: the old one fades and
                drifts up as the new one rises in, stacked in the same place. Steps 1–3 share one
                chart, which changes in place. */}
              <div className="mt-3 grid">
                {(view.before !== null ? [view.before, step] : [step]).map(
                  (s) => (
                    <div
                      key={viewOf(s)}
                      inert={s !== step}
                      className={`col-start-1 row-start-1 min-w-0 ${
                        s !== step
                          ? "fade-text-out pointer-events-none"
                          : "fade-text-in"
                      }`}
                    >
                      <Nav.Provider
                        value={{
                          preview: setPreview,
                          flash: s === step && flash?.step === s ? flash.n : 0,
                        }}
                      >
                        <Walkthrough
                          risk={risk}
                          step={s}
                          picks={picks}
                          setPicks={setPicks}
                          goTo={goTo}
                        />
                      </Nav.Provider>
                    </div>
                  ),
                )}
              </div>
            </SmoothHeight>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                disabled={step === 0}
                className={NAV_BUTTON}
              >
                Back
              </button>
              {/* Where we are; on narrow screens (where the step bar shows only numbers), its name. */}
              <span className="text-center text-xs text-slate-500 tabular-nums">
                Step {step + 1} of {STEPS.length}
                <span className="block font-semibold text-slate-900 sm:hidden">
                  {STEPS[step].title}
                </span>
              </span>
              <button
                type="button"
                onClick={() => (step < last ? goTo(step + 1) : close())}
                className={NEXT_BUTTON}
              >
                {step < last ? "Next" : "Close"}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
            <p className="rounded-lg bg-slate-50 px-3 py-2">
              This fund has {risk.months}{" "}
              {risk.months === 1 ? "month" : "months"} of returns; a rating
              requires at least {MIN_MONTHS}. The calculation is shown once
              enough history is available.
            </p>
            <MethodSteps />
            <Bands level={null} />
            <Limitations />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// What is picked on each step's chart: a month-end (step 1), a month's return (steps 2–3), a
// horizon in months (4) and a band (5).
type Picks = { close: number; ret: number; horizon: number; band: number };

// Going to a step: from a tag, with what to select there (`pick`, possibly nothing).
type GoTo = (step: number, pick?: Partial<Picks>) => void;

// For the tags and formula panels in a step's view: showing a step in the step bar while a tag
// is pointed at, and the arrival flash (a number that changes with each arrival; 0 for none).
const Nav = createContext<{ preview: (step: number | null) => void; flash: number }>({
  preview: () => {},
  flash: 0,
});
const FLASH_MS = 1800; // .risk-flash in globals.css, with its delay

// Which view a step is in: steps 1–3 share one chart (0); the others are each their own.
const viewOf = (step: number) => (step <= 2 ? 0 : step);
const SWAP_OUT_MS = 520; // .fade-text-out in globals.css
// How a band grows when picked (and its outline with it).
const BAND_EASE = "300ms cubic-bezier(0.22, 1, 0.36, 1)";

const BUTTON =
  "inline-flex min-w-20 items-center justify-center rounded-lg border px-4 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
const NAV_BUTTON = `${BUTTON} border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50`;
const NEXT_BUTTON = `${BUTTON} border-slate-900 bg-slate-900 text-white hover:border-slate-700 hover:bg-slate-700`;

// The chart's frame (in SVG units) and its plot area.
const W = 560;
const H = 240;
const L = 48;
const R = 8;
const T = 14;
const B = 24;
const IW = W - L - R;
const IH = H - T - B;

// How a picked point, bar or band follows the pointer: briefly eased, not jumped.
const FOLLOW = "180ms cubic-bezier(0.25, 0.8, 0.3, 1)";
const COLOUR = "250ms ease-out";

// What each step shows: the chart (steps 1–3), the horizon chart (4), the bands (5) or the
// summary (6); under it the step's formula, worked with the selected values, and why the
// highlighted data is the data used.
function Walkthrough({
  risk,
  step,
  picks,
  setPicks,
  goTo,
}: {
  risk: Risk;
  step: number;
  picks: Picks;
  setPicks: React.Dispatch<React.SetStateAction<Picks>>;
  goTo: GoTo;
}) {
  const { closes, returns } = risk;
  const n = returns.length;
  const { close: pickedClose, ret: pickedReturn, horizon, band } = picks;
  const setPickedClose = (close: number) => setPicks((p) => ({ ...p, close }));
  const setPickedReturn = (ret: number) => setPicks((p) => ({ ...p, ret }));
  const setHorizon = (horizon: number) => setPicks((p) => ({ ...p, horizon }));
  const setBand = (band: number) => setPicks((p) => ({ ...p, band }));

  if (step <= 2) {
    return (
      <>
        <ReturnsChart
          risk={risk}
          step={step}
          picked={step === 0 ? pickedClose : pickedReturn}
          onPick={step === 0 ? setPickedClose : setPickedReturn}
        />
        <Formula key={`f-${step}`}>
          {step === 0 && (
            <>
              <Line>
                <V>P</V>
                <Sub>t</Sub> = closing price on the last trading day of month{" "}
                <V>t</V>
              </Line>
              <Line id={pickedClose}>
                <V>P</V>
                <Sub>{formatMonth(closes[pickedClose].month)}</Sub> ={" "}
                <strong className="text-slate-900">
                  {price(closes[pickedClose].close)}
                </strong>{" "}
                <span className="font-sans text-xs text-slate-500">
                  (close of {closes[pickedClose].date})
                </span>
              </Line>
              <Why>
                The method measures monthly returns, so only the {closes.length}{" "}
                month-end closes (dark points, {periodOf(risk)}) are used. Daily
                prices in between (grey line) are not, nor is the month still in
                progress, whose last price is not yet final.
              </Why>
            </>
          )}
          {step === 1 && (
            <ReturnFormula risk={risk} i={pickedReturn} n={n} goTo={goTo} />
          )}
          {step === 2 && (
            <DeviationFormula risk={risk} i={pickedReturn} goTo={goTo} />
          )}
        </Formula>
      </>
    );
  }
  if (step === 3) {
    return (
      <div className="text-fade-in">
        <HorizonChart
          monthly={risk.monthlyStdDev!}
          horizon={horizon}
          onPick={setHorizon}
        />
        <Formula key="f-3">
          <Line>
            σ<Sub>k months</Sub> = <V>s</V> × √<V>k</V>
          </Line>
          <Line id={horizon}>
            σ<Sub>{horizon}</Sub> = {pct(risk.monthlyStdDev!, 3)}
            <From
              step={2}
              what="s, the monthly standard deviation"
              goTo={goTo}
            />
            × √{horizon} = {pct(risk.monthlyStdDev!, 3)} ×{" "}
            {Math.sqrt(horizon).toFixed(3)} ={" "}
            <strong className="text-slate-900">
              {pct(risk.monthlyStdDev! * Math.sqrt(horizon))}
            </strong>
          </Line>
          <Why>
            Risk levels are set on an annual basis, so k = 12 (outlined) is
            used: {pct(risk.monthlyStdDev!, 3)} × √12 ={" "}
            {risk.stdDev!.toFixed(2)}%. Treating months as independent,
            variances add over time, so the standard deviation grows with the
            square root of the number of months, not in proportion to it.
          </Why>
        </Formula>
      </div>
    );
  }
  if (step === 4) {
    const lower = band === 0 ? 0 : RISK_LEVELS[band - 1].upTo!;
    const upper = RISK_LEVELS[band].upTo;
    const inside =
      risk.stdDev! >= lower && (upper === null || risk.stdDev! < upper);
    return (
      <div className="text-fade-in">
        <BandsChart
          annual={risk.stdDev!}
          level={risk.level!}
          picked={band}
          onPick={setBand}
        />
        <Formula key="f-4">
          <Line id={band}>
            {RISK_LEVELS[band].name}: {lower}% ≤ σ
            {upper === null ? "" : ` < ${upper}%`}
          </Line>
          <Line id={band}>
            σ = {risk.stdDev!.toFixed(2)}%
            <From
              step={3}
              what="σ, the annualized standard deviation"
              pick={{ horizon: 12 }}
              goTo={goTo}
            />
            {inside ? (
              <>
                falls in this band →{" "}
                <strong className="text-slate-900">
                  {RISK_LEVELS[risk.level!].name}
                </strong>
              </>
            ) : (
              <>is outside this band</>
            )}
          </Line>
          <Why>
            Only the annualized standard deviation (σ) is used: the CSA
            methodology defines the five bands by it, and the rating is the band
            that contains it (outlined).
          </Why>
        </Formula>
      </div>
    );
  }
  return <Summary risk={risk} goTo={goTo} />;
}

// Step 2's formula: the picked month's return from the two prices.
function ReturnFormula({
  risk,
  i,
  n,
  goTo,
}: {
  risk: Risk;
  i: number;
  n: number;
  goTo: GoTo;
}) {
  const r = risk.returns[i];
  const now = risk.closes[i + 1];
  const before = risk.closes[i];
  return (
    <>
      <Line>
        <V>r</V>
        <Sub>t</Sub> = <V>P</V>
        <Sub>t</Sub> ÷ <V>P</V>
        <Sub>t−1</Sub> − 1
      </Line>
      <Line id={i}>
        <V>r</V>
        <Sub>{formatMonth(r.month)}</Sub> = {price(now.close)}
        <From
          step={0}
          what={`the month-end price of ${formatMonth(now.month)}`}
          pick={{ close: i + 1 }}
          goTo={goTo}
        />
        ÷ {price(before.close)}
        <From
          step={0}
          what={`the month-end price of ${formatMonth(before.month)}`}
          pick={{ close: i }}
          goTo={goTo}
        />
        − 1 = <strong className="text-slate-900">{signed(r.change)}</strong>
      </Line>
      <Why id={i}>
        Each return uses two consecutive month-end prices (the two points
        marked, {formatMonth(before.month)} and {formatMonth(now.month)}), so
        every return covers exactly one month. Percentage changes rather than
        prices are used so that funds at any price level compare. {n} returns in
        all.
      </Why>
    </>
  );
}

// Step 3's formulas: the mean, the picked month's deviation from it, and the standard deviation.
function DeviationFormula({
  risk,
  i,
  goTo,
}: {
  risk: Risk;
  i: number;
  goTo: GoTo;
}) {
  const n = risk.returns.length;
  const r = risk.returns[i];
  const mean = risk.average!;
  const sum = mean * n;
  const deviation = r.change - mean;
  const squares = risk.monthlyStdDev! ** 2 * (n - 1);
  return (
    <>
      <Line>
        <V>r̄</V> = Σ<V>r</V>
        <Sub>t</Sub> ÷ <V>n</V> = {signed(sum)} ÷ {n}
        <From
          step={1}
          what="the sum and number of the monthly returns"
          goTo={goTo}
        />
        = <strong className="text-slate-900">{signed(mean)}</strong>
      </Line>
      <Line id={i}>
        <V>r</V>
        <Sub>{formatMonth(r.month)}</Sub> − <V>r̄</V> = {signed(r.change)}
        <From
          step={1}
          what={`the return of ${formatMonth(r.month)}`}
          pick={{ ret: i }}
          goTo={goTo}
        />
        − {mean < 0 ? `(${signed(mean)})` : pct(mean)} ={" "}
        <strong className="text-slate-900">{signed(deviation)}</strong>;
        squared: {(deviation ** 2).toFixed(5)}
      </Line>
      <Line>
        <V>s</V> = √( Σ(<V>r</V>
        <Sub>t</Sub> − <V>r̄</V>)² ÷ (<V>n</V> − 1) ) = √( {squares.toFixed(5)} ÷{" "}
        {n - 1} ) ={" "}
        <strong className="text-slate-900">
          {pct(risk.monthlyStdDev!, 3)}
        </strong>
      </Line>
      <Why>
        {`All ${n} returns are used, `}each measured from the mean (dashed line;
        the marked bar&rsquo;s distance is shown in red). Squaring makes rises
        and falls count equally and weighs large moves more; dividing by{" "}
        <V>n</V> − 1 corrects for the mean being taken from the same returns.
        Darker bars lie more than one standard deviation from the mean.
      </Why>
    </>
  );
}

// A picked index kept in range (a return's index can be one past the last month-end's).
const inRange = (i: number, length: number) =>
  Math.min(Math.max(i, 0), length - 1);

// Steps 1–3's chart, on a time axis from the first month-end used to the latest price.
// Step 1: the daily prices (grey) with the month-end closes used marked, the month in progress
// set apart. Step 2: the monthly returns as bars (each spanning its month) growing from zero,
// the prices faint behind them and the two month-ends behind the picked return marked. Step 3:
// the mean and the band one standard deviation either side, bars outside it darker, and the
// picked return's distance from the mean. A point or bar is picked by pointing, tapping or the
// arrow keys; the highlight glides to it.
function ReturnsChart({
  risk,
  step,
  picked,
  onPick,
}: {
  risk: Risk;
  step: number;
  picked: number;
  onPick: (i: number) => void;
}) {
  const { closes, returns, days } = risk;
  const average = risk.average!;
  const sd = risk.monthlyStdDev!;
  const n = returns.length;
  const svg = useRef<SVGSVGElement>(null);
  // The lines draw in on the first frame after opening.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const still = typeof window !== "undefined" && calm();
  const ease = (what: string) => (still ? "none" : what);

  // Time axis: from the first month-end used to the latest daily price.
  const time = (date: string) => Date.parse(`${date}T00:00:00Z`);
  const first = time(closes[0].date);
  const lastDay = days.length
    ? days[days.length - 1].date
    : closes[closes.length - 1].date;
  const span = Math.max(time(lastDay) - first, 1);
  const tx = (date: string) => L + ((time(date) - first) / span) * IW;

  const all = [...days.map((d) => d.close), ...closes.map((c) => c.close)];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const room = (hi - lo) * 0.08 || 1;
  const py = (v: number) =>
    T + IH - ((v - lo + room) / (hi - lo + 2 * room)) * IH;
  const lastClose = closes[closes.length - 1];
  const used = days.filter((d) => d.date <= lastClose.date);
  const later = days.filter((d) => d.date >= lastClose.date);
  const path = (pts: { date: string; close: number }[]) =>
    pts
      .map(
        (d, i) =>
          `${i ? "L" : "M"}${tx(d.date).toFixed(1)} ${py(d.close).toFixed(1)}`,
      )
      .join("");

  const reach =
    Math.max(
      ...returns.map((r) => Math.abs(r.change)),
      Math.abs(average) + sd,
    ) * 1.12;
  const zero = T + IH / 2;
  const ry = (r: number) => zero - (r / reach) * (IH / 2);
  // Each return's bar spans its month: from the month-end before to its own.
  const bar = (i: number) => {
    const x0 = tx(closes[i].date);
    const x1 = tx(closes[i + 1].date);
    const gap = x1 - x0 >= 8 ? 2 : x1 - x0 >= 3 ? 1 : 0;
    return {
      x: x0 + gap / 2,
      w: Math.max(x1 - x0 - gap, 0.6),
      mid: (x0 + x1) / 2,
    };
  };
  const prices = step === 0;
  const count = prices ? closes.length : n;

  // From a pointer's position to the nearest month-end (step 1) or the month under it.
  const pick = (clientX: number) => {
    const box = svg.current!.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * W;
    let i = 0;
    if (prices) {
      let best = Infinity;
      closes.forEach((c, j) => {
        const d = Math.abs(tx(c.date) - x);
        if (d < best) {
          best = d;
          i = j;
        }
      });
    } else {
      while (i < n - 1 && tx(closes[i + 1].date) < x) i++;
    }
    if (i !== picked) onPick(i);
  };
  const key = (e: React.KeyboardEvent) => {
    const move = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!move) return;
    e.preventDefault();
    onPick(inRange(picked + move, count));
  };

  const halo = {
    stroke: "#ffffff",
    strokeWidth: 3,
    paintOrder: "stroke" as const,
    strokeLinejoin: "round" as const,
  };
  const fade = (on: boolean, to = 1) => ({
    opacity: on ? to : 0,
    transition: ease("opacity 500ms ease-out"),
  });
  const glide = (x: number, y = 0) => ({
    transform: `translate(${x}px, ${y}px)`,
    transition: ease(`transform ${FOLLOW}`),
  });

  // The picked point: where it is and its label (kept inside the frame).
  const pc = closes[inRange(picked, closes.length)];
  const pr = returns[inRange(picked, n)];
  const pb = bar(inRange(picked, n));
  const pickX = prices ? tx(pc.date) : pb.mid;
  const tipX = Math.min(Math.max(pickX, L + 62), W - R - 62);
  const tip = prices
    ? `${formatMonth(pc.month)} · ${price(pc.close)}`
    : `${formatMonth(pr.month)} · ${signed(pr.change)}`;
  // Step 2: the month-ends the picked return is worked from.
  const pair = [closes[inRange(picked, n)], closes[inRange(picked, n) + 1]];
  const devTop = ry(Math.max(pr.change, average));
  const devHeight = Math.max(Math.abs(ry(pr.change) - ry(average)), 0.5);

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      tabIndex={0}
      role="img"
      aria-label={`${prices ? "Month-end prices" : "Monthly returns"}, ${periodOf(risk)}. Selected: ${tip}. Use the arrow keys to move.`}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => pick(e.clientX)}
      onKeyDown={key}
      className="mt-1 w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      {/* Grid and axis labels: prices, then returns. */}
      <g style={fade(prices)}>
        {[hi, (hi + lo) / 2, lo].map((v) => (
          <g key={`p-${v}`}>
            <line x1={L} x2={W - R} y1={py(v)} y2={py(v)} stroke="#e2e8f0" />
            <text
              x={L - 6}
              y={py(v) + 3.5}
              textAnchor="end"
              className="fill-slate-500 text-[10px] tabular-nums"
            >
              {price(v)}
            </text>
          </g>
        ))}
      </g>
      <g style={fade(!prices)}>
        {[reach * 0.85, 0, -reach * 0.85].map((r) => (
          <g key={`r-${r}`}>
            <line
              x1={L}
              x2={W - R}
              y1={ry(r)}
              y2={ry(r)}
              stroke={r === 0 ? "#94a3b8" : "#e2e8f0"}
            />
            <text
              x={L - 6}
              y={ry(r) + 3.5}
              textAnchor="end"
              className="fill-slate-500 text-[10px] tabular-nums"
            >
              {r === 0 ? "0%" : signed(r, 0)}
            </text>
          </g>
        ))}
      </g>

      {/* The month in progress, left out: shaded and labelled in step 1. */}
      {later.length > 1 && (
        <g style={fade(prices)}>
          <rect
            x={tx(lastClose.date)}
            y={T}
            width={W - R - tx(lastClose.date)}
            height={IH}
            fill="#f1f5f9"
          />
          <text
            x={W - R - 2}
            y={T + IH - 5}
            textAnchor="end"
            className="fill-slate-500 text-[10px]"
            style={halo}
          >
            month in progress (excluded)
          </text>
        </g>
      )}

      {/* The spotlight behind the picked month's bar, gliding. */}
      <rect
        x={0}
        y={T}
        width={pb.w + 4}
        height={IH}
        rx={3}
        fill="#e2e8f0"
        style={{ ...glide(pb.x - 2), opacity: prices ? 0 : 0.8 }}
      />

      {/* The band within one standard deviation of the mean, opening from the mean. */}
      <rect
        x={L}
        width={IW}
        y={ry(average + sd)}
        height={ry(average - sd) - ry(average + sd)}
        fill="#0f172a"
        fillOpacity={0.07}
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          transform: `scaleY(${step >= 2 ? 1 : 0})`,
          transition: ease("transform 700ms ease-out"),
        }}
      />

      {/* The daily prices: the line in step 1, faint behind the bars in step 2. */}
      <g style={fade(step <= 1, prices ? 1 : 0.22)}>
        <path
          d={path(used)}
          pathLength={1}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.25}
          strokeLinejoin="round"
          strokeDasharray="1 1"
          style={{
            strokeDashoffset: drawn || still ? 0 : 1,
            transition: ease("stroke-dashoffset 1.6s ease-in-out"),
          }}
        />
        {later.length > 1 && (
          <path
            d={path(later)}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={1.25}
            strokeDasharray="2 2"
          />
        )}
      </g>

      {/* The monthly returns, growing from zero one after another. */}
      {returns.map((r, i) => {
        const b = bar(i);
        const outside = Math.abs(r.change - average) > sd;
        const isPicked = !prices && i === picked;
        return (
          <rect
            key={r.month}
            x={b.x}
            width={b.w}
            y={ry(Math.max(r.change, 0))}
            height={Math.max(Math.abs(ry(r.change) - zero), 0.6)}
            rx={Math.min(1.5, b.w / 2)}
            fill={
              isPicked
                ? "#0f172a"
                : step >= 2 && outside
                  ? "#475569"
                  : "#94a3b8"
            }
            fillOpacity={isPicked || step < 2 || outside ? 1 : 0.8}
            style={{
              transformBox: "fill-box",
              transformOrigin: r.change >= 0 ? "bottom" : "top",
              transform: `scaleY(${step >= 1 ? 1 : 0})`,
              transition: still
                ? "none"
                : `transform 450ms ease-out ${step === 1 ? (i * 900) / n : 0}ms, fill ${COLOUR}, fill-opacity ${COLOUR}`,
            }}
          />
        );
      })}

      {/* Step 1: the month-end closes used, marked on the daily line, and the picked one. */}
      <g style={fade(prices)}>
        {closes.map((c, i) => (
          <circle
            key={c.month}
            cx={tx(c.date)}
            cy={py(c.close)}
            r={closes.length > 90 ? 1.7 : 2.2}
            fill="#0f172a"
            style={{
              opacity: drawn || still ? 1 : 0,
              transition: ease(
                `opacity 300ms ease-out ${300 + (i * 1200) / closes.length}ms`,
              ),
            }}
          />
        ))}
        <g style={glide(tx(pc.date))}>
          <line
            x1={0}
            x2={0}
            y1={T + 16}
            y2={T + IH}
            stroke="#94a3b8"
            strokeDasharray="2 3"
          />
        </g>
        <g style={glide(tx(pc.date), py(pc.close))}>
          <circle r={5} fill="#0f172a" stroke="#ffffff" strokeWidth={2} />
        </g>
      </g>

      {/* Step 2: the two month-end prices behind the picked return, gliding with it. */}
      <g style={fade(step === 1)}>
        {pair.map((c, k) => (
          <g key={k} style={glide(tx(c.date), py(c.close))}>
            <circle
              r={3.5}
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth={1.75}
            />
            <text
              y={-8}
              dx={k ? 3 : -3}
              textAnchor={k ? "start" : "end"}
              className="fill-slate-900 text-[10px] font-semibold"
              style={halo}
            >
              P
              <tspan baselineShift="sub" fontSize={8}>
                {k ? "t" : "t−1"}
              </tspan>
            </text>
          </g>
        ))}
      </g>

      {/* Step 3: the mean, the band's edges, and the picked return's distance from the mean. */}
      <g style={fade(step >= 2)}>
        <line
          x1={L}
          x2={W - R}
          y1={ry(average)}
          y2={ry(average)}
          stroke="#0f172a"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={W - R - 4}
          y={ry(average + sd) - 4}
          textAnchor="end"
          className="fill-slate-700 text-[10px] font-semibold"
          style={halo}
        >
          r̄ + s ({signed(average + sd)})
        </text>
        <text
          x={W - R - 4}
          y={ry(average - sd) + 11}
          textAnchor="end"
          className="fill-slate-700 text-[10px] font-semibold"
          style={halo}
        >
          r̄ − s ({signed(average - sd)})
        </text>
        <rect
          x={0}
          y={0}
          width={2.5}
          height={1}
          fill="#e11d48"
          style={{
            transformOrigin: "0 0",
            transform: `translate(${pb.x + pb.w + 1.5}px, ${devTop}px) scaleY(${devHeight})`,
            transition: ease(`transform ${FOLLOW}`),
          }}
        />
      </g>

      {/* The picked point's month and value, gliding with it. */}
      <g style={glide(tipX, T + 2)}>
        <text
          key={tip}
          textAnchor="middle"
          dominantBaseline="hanging"
          className="swap-in fill-slate-900 text-[11px] font-semibold tabular-nums"
          style={halo}
        >
          {tip}
        </text>
      </g>

      {/* The period, at the ends of the time axis. */}
      <text x={L} y={H - 6} className="fill-slate-500 text-[10px]">
        {formatMonth(closes[0].month)}
      </text>
      <text
        x={tx(lastClose.date)}
        y={H - 6}
        textAnchor="end"
        className="fill-slate-500 text-[10px]"
      >
        {formatMonth(lastClose.month)}
      </text>
    </svg>
  );
}

// Step 4's chart: the monthly standard deviation scaled to 1–12 months (s × √k), a column per
// horizon; 12 (the annualized figure, the one used) outlined, the picked one dark with its
// value. Columns grow in on arrival; picking glides the spotlight across.
function HorizonChart({
  monthly,
  horizon,
  onPick,
}: {
  monthly: number;
  horizon: number;
  onPick: (k: number) => void;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setGrown(true)),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  const still = typeof window !== "undefined" && calm();
  const ease = (what: string) => (still ? "none" : what);
  const top = monthly * Math.sqrt(12) * 1.18;
  const ks = Array.from({ length: 12 }, (_, i) => i + 1);
  const slot = IW / 12;
  const key = (e: React.KeyboardEvent) => {
    const move = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!move) return;
    e.preventDefault();
    onPick(Math.min(Math.max(horizon + move, 1), 12));
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      tabIndex={0}
      onKeyDown={key}
      onPointerLeave={() => onPick(12)}
      className="mt-1 w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      role="img"
      aria-label={`Standard deviation scaled to ${horizon} months: ${pct(monthly * Math.sqrt(horizon))}. Use the arrow keys to change.`}
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={L}
            x2={W - R}
            y1={T + IH - f * IH}
            y2={T + IH - f * IH}
            stroke={f ? "#e2e8f0" : "#94a3b8"}
          />
          <text
            x={L - 6}
            y={T + IH - f * IH + 3.5}
            textAnchor="end"
            className="fill-slate-500 text-[10px] tabular-nums"
          >
            {pct(top * f, 0)}
          </text>
        </g>
      ))}
      {/* The spotlight behind the picked column, gliding. */}
      <rect
        x={0}
        y={T}
        width={slot}
        height={IH}
        rx={6}
        fill="#f1f5f9"
        style={{
          transform: `translateX(${L + (horizon - 1) * slot}px)`,
          transition: ease(`transform ${FOLLOW}`),
        }}
      />
      {ks.map((k, i) => {
        const v = monthly * Math.sqrt(k);
        const h = (v / top) * IH;
        const x = L + i * slot + 6;
        const w = slot - 12;
        const picked = k === horizon;
        return (
          <g
            key={k}
            onPointerEnter={() => onPick(k)}
            onPointerDown={() => onPick(k)}
            className="cursor-pointer"
          >
            <rect
              x={L + i * slot}
              y={T}
              width={slot}
              height={IH + B}
              fill="transparent"
            />
            <rect
              x={x}
              width={w}
              y={T + IH - h}
              height={h}
              rx={4}
              fill={picked ? "#0f172a" : k === 12 ? "#64748b" : "#cbd5e1"}
              stroke={k === 12 ? "#0f172a" : "none"}
              strokeWidth={k === 12 ? 1.5 : 0}
              style={{
                transformBox: "fill-box",
                transformOrigin: "bottom",
                transform: `scaleY(${grown || still ? 1 : 0})`,
                transition: still
                  ? "none"
                  : `transform 500ms ease-out ${i * 50}ms, fill ${COLOUR}`,
              }}
            />
            <text
              x={x + w / 2}
              y={T + IH - h - 5}
              textAnchor="middle"
              className="fill-slate-900 text-[10px] font-semibold tabular-nums"
              style={{
                opacity: (grown || still) && (picked || k === 12) ? 1 : 0,
                transition: ease("opacity 250ms ease-out"),
              }}
            >
              {pct(v)}
            </text>
            <text
              x={x + w / 2}
              y={H - 6}
              textAnchor="middle"
              className={`text-[10px] tabular-nums ${picked ? "fill-slate-900 font-semibold" : "fill-slate-500"}`}
            >
              {k === 12 ? "12 (1 yr)" : k === 1 ? "1 (= s)" : k}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Step 5's chart: the five bands along a scale of annualized standard deviation, and a marker
// moving from 0 to the fund's figure; the fund's band outlined. A band is picked by pointing,
// tapping or focusing it.
function BandsChart({
  annual,
  level,
  picked,
  onPick,
}: {
  annual: number;
  level: number;
  picked: number;
  onPick: (band: number) => void;
}) {
  const top = Math.max(25, Math.ceil((annual + 3) / 5) * 5);
  const x = (v: number) => `${(Math.min(v, top) / top) * 100}%`;
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setArrived(true)),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  const still = typeof window !== "undefined" && calm();
  const edges = [0, ...RISK_LEVELS.map((l) => l.upTo ?? top)];

  return (
    <div className="mt-1 flex aspect-[560/240] flex-col justify-center rounded-lg px-2">
      <div className="relative pt-10">
        <div
          className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
          style={{
            left: arrived || still ? x(annual) : "0%",
            transition: still
              ? "none"
              : "left 1.4s cubic-bezier(0.3, 0.7, 0.2, 1)",
          }}
        >
          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
            σ = {annual.toFixed(2)}%{" "}
            <span className="font-normal text-slate-300">· step 4</span>
          </span>
          <span className="h-4 w-px bg-slate-900" />
        </div>
        {/* Pointing at a band shows it; leaving the bands returns to the fund's own. */}
        <div className="flex h-8 gap-0.5" onPointerLeave={() => onPick(level)}>
          {RISK_LEVELS.map((l, i) => (
            <button
              key={l.name}
              type="button"
              onPointerEnter={() => onPick(i)}
              onClick={() => onPick(i)}
              onFocus={() => onPick(i)}
              aria-label={`${l.name}: ${edges[i]}% ${l.upTo === null ? "or more" : `to less than ${l.upTo}%`}`}
              className="relative h-full rounded-[3px] outline-none first:rounded-l-md last:rounded-r-md focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-slate-400"
              style={{ width: `${((edges[i + 1] - edges[i]) / top) * 100}%` }}
            >
              {/* The band: picked, it grows taller by its own height (not stretched), so its
                  corners stay round as it eases. */}
              <span
                aria-hidden
                className="absolute inset-x-0 rounded-[inherit]"
                style={{
                  top: i === picked ? -5 : 0,
                  bottom: i === picked ? -5 : 0,
                  background: STEP_FILL[i],
                  opacity: i === picked || i === level ? 1 : 0.45,
                  // The fund's band: outlined just inside its own edge (a dark line, a fine white
                  // gap within), so the outline never reaches the bands beside it.
                  boxShadow: i === level ? "inset 0 0 0 1.5px #0f172a, inset 0 0 0 3px #ffffff" : undefined,
                  transition: still ? "none" : `top ${BAND_EASE}, bottom ${BAND_EASE}, opacity 300ms ease-out`,
                }}
              />
            </button>
          ))}
        </div>
        <div className="relative mt-2 h-4 text-[10px] text-slate-500 tabular-nums">
          {edges.slice(0, -1).map((e) => (
            <span
              key={e}
              className="absolute -translate-x-1/2 first:translate-x-0"
              style={{ left: x(e) }}
            >
              {e}%
            </span>
          ))}
        </div>
        <div className="relative mt-1 h-4 text-[11px] text-slate-600">
          {RISK_LEVELS.map((l, i) => (
            <span
              key={l.name}
              className={`absolute -translate-x-1/2 font-medium whitespace-nowrap transition-colors duration-300 ease-out max-sm:hidden ${
                i === picked ? "text-slate-900" : "text-slate-400"
              }`}
              style={{ left: x((edges[i] + edges[i + 1]) / 2) }}
            >
              {l.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Step 6: the key values, each tagged with the step it comes from (going back to it), then the
// limitations.
function Summary({ risk, goTo }: { risk: Risk; goTo: GoTo }) {
  // (A symbol is kept with the word before it, so a wrapping label breaks before both.)
  const rows: [string, string, number, Partial<Picks>][] = [
    ["Period", periodOf(risk) ?? "—", 0, {}],
    ["Monthly returns\u00a0(n)", String(risk.months), 1, {}],
    [
      "Best month",
      `${signed(risk.best!.change)} (${formatMonth(risk.best!.month)})`,
      1,
      { ret: risk.returns.indexOf(risk.best!) },
    ],
    [
      "Worst month",
      `${signed(risk.worst!.change)} (${formatMonth(risk.worst!.month)})`,
      1,
      { ret: risk.returns.indexOf(risk.worst!) },
    ],
    ["Mean monthly return\u00a0(r̄)", signed(risk.average!), 2, {}],
    ["Monthly standard deviation\u00a0(s)", pct(risk.monthlyStdDev!, 3), 2, {}],
    ["Annualized standard deviation\u00a0(σ)", `${risk.stdDev!.toFixed(2)}%`, 3, { horizon: 12 }],
    ["Risk rating", RISK_LEVELS[risk.level!].name, 4, { band: risk.level! }],
  ];
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
        {rows.map(([label, value, from, pick], i) => (
          <div
            key={label}
            className="rise-in flex items-center justify-between gap-3 border-b border-slate-200 py-2"
            style={{ animationDelay: `${200 + i * 40}ms` }}
          >
            <dt className="text-slate-600">{label}</dt>
            <dd className="flex items-center text-right font-semibold tabular-nums text-slate-900">
              {value}
              <From step={from} what={label} pick={pick} goTo={goTo} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="text-sm leading-relaxed text-slate-600">
        <Limitations />
      </div>
    </div>
  );
}

// The method in brief (for a fund not rated yet).
function MethodSteps() {
  return (
    <ol className="list-decimal space-y-1 pl-5">
      <li>
        Month-end closing prices for up to the last {RISK_YEARS} years; the
        current month is excluded.
      </li>
      <li>Monthly return: month-end close ÷ previous month-end close − 1.</li>
      <li>Sample standard deviation of the monthly returns.</li>
      <li>Annualized: monthly standard deviation × √12.</li>
      <li>Classified by the bands below.</li>
    </ol>
  );
}

// The five bands as a table, the fund's (if rated) picked out.
function Bands({ level }: { level: number | null }) {
  return (
    <table className="w-full max-w-md text-xs tabular-nums">
      <thead>
        <tr className="text-left text-slate-500">
          <th className="py-1 font-medium">Level</th>
          <th className="py-1 text-right font-medium">
            Annualized standard deviation
          </th>
        </tr>
      </thead>
      <tbody>
        {RISK_LEVELS.map((l, i) => {
          const from = i === 0 ? 0 : RISK_LEVELS[i - 1].upTo;
          return (
            <tr
              key={l.name}
              className={`border-t border-slate-200 ${i === level ? "bg-slate-50 font-semibold text-slate-900" : ""}`}
            >
              <td className="py-1 pl-1">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: STEP_FILL[i] }}
                  />
                  {l.name}
                </span>
              </td>
              <td className="py-1 pr-1 pl-4 text-right whitespace-nowrap">
                {l.upTo === null
                  ? `${from}% or more`
                  : `${from}% to less than ${l.upTo}%`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Limitations() {
  return (
    <div>
      <p className="font-semibold text-slate-900">Limitations</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>
          Funds with less than {RISK_YEARS} years of history are rated on
          available history (minimum {MIN_MONTHS / 12} years); the official
          method substitutes a reference index for missing years.
        </li>
        <li>
          Price returns are used; the official method uses total returns, with
          distributions reinvested.
        </li>
        <li>Returns are in the fund&rsquo;s trading currency.</li>
        <li>
          The rating published in the fund&rsquo;s ETF Facts is authoritative
          and may be higher. Past volatility does not indicate future results.
        </li>
      </ul>
    </div>
  );
}

// Its content, in a box whose height follows the content's, eased: when a step takes more or
// less room (or a cross-fade ends), the box (and the centred pop-up around it) grows or shrinks
// smoothly instead of jumping. Clipped while it eases, with a little margin for focus rings.
// With motion reduced, it simply follows.
const HEIGHT_EASE = "height 450ms cubic-bezier(0.22, 1, 0.36, 1)";

function SmoothHeight({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      style={{
        height: height ?? "auto",
        overflow: "clip",
        overflowClipMargin: 6,
        transition:
          typeof window !== "undefined" && calm() ? "none" : HEIGHT_EASE,
      }}
    >
      {/* (flow-root: the content's margins stay inside it, so they are measured.) */}
      <div ref={inner} className="flow-root">
        {children}
      </div>
    </div>
  );
}

// A value carried over from an earlier step: a small tag naming the step. Pointed at (or
// focused), a card rises above it saying what the value is and where it comes from, and that
// step lights up in the step bar; clicked, it goes back there with the value selected (`pick`)
// and that step's formula panel pulses once.
function From({
  step,
  what,
  pick = {},
  goTo,
}: {
  step: number;
  what: string;
  pick?: Partial<Picks>;
  goTo: GoTo;
}) {
  const nav = useContext(Nav);
  const selects = Object.keys(pick).length > 0;
  return (
    <span className="group/from relative mx-1 inline-flex -translate-y-px align-middle">
      <button
        type="button"
        onClick={() => goTo(step, pick)}
        onPointerEnter={() => nav.preview(step)}
        onPointerLeave={() => nav.preview(null)}
        onFocus={() => nav.preview(step)}
        onBlur={() => nav.preview(null)}
        aria-label={`${what}: from step ${step + 1}, ${STEPS[step].title}. Go back to it.`}
        className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 bg-white px-1.5 font-sans text-[10px] leading-4 font-medium whitespace-nowrap text-slate-600 transition duration-200 ease-out hover:border-slate-900 hover:bg-slate-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400 active:scale-90 motion-reduce:transition-none"
      >
        <svg
          aria-hidden
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-2.5 transition-transform duration-300 ease-out group-hover/from:-translate-x-px motion-reduce:transition-none"
        >
          <path d="M4 2.5 1.8 4.7 4 6.9M2 4.7h4a2.2 2.2 0 0 1 0 4.4H5" />
        </svg>
        step {step + 1}
      </button>
      {/* The card: above the tag, its right edge on the tag's, so it stays inside the pop-up. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 w-56 translate-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-sans text-[11px] leading-snug font-normal whitespace-normal text-slate-600 opacity-0 shadow-lg shadow-slate-300/50 transition duration-200 ease-out group-focus-within/from:translate-y-0 group-focus-within/from:opacity-100 group-hover/from:translate-y-0 group-hover/from:opacity-100 motion-reduce:transition-none"
      >
        <span className="block font-semibold text-slate-900">
          From step {step + 1}: {STEPS[step].title}
        </span>
        {what[0].toUpperCase() + what.slice(1)}.{" "}
        <span className="text-slate-500">
          Click to go back{selects ? " with it selected" : ""}.
        </span>
      </span>
    </span>
  );
}

// The formula panel under each chart, and its parts.
function Formula({ children }: { children: React.ReactNode }) {
  const { flash } = useContext(Nav);
  return (
    <div className="text-fade-in relative isolate mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 tabular-nums">
      {/* Arrived at from a tag: a pulse round the panel (.risk-flash in globals.css). */}
      {flash > 0 && (
        <span key={flash} aria-hidden className="risk-flash pointer-events-none absolute -inset-px -z-10 rounded-lg" />
      )}
      {children}
    </div>
  );
}
// A formula line; with `id`, its words cross-fade whenever the id changes (a new pick).
const Line = ({ id, children }: { id?: number; children: React.ReactNode }) => (
  <p className="font-serif text-[15px] break-words">
    {id === undefined ? children : <Swap id={id}>{children}</Swap>}
  </p>
);
// Why the highlighted data is the data the step uses (cross-fading by `id`, as a Line does).
const Why = ({ id, children }: { id?: number; children: React.ReactNode }) => (
  <p className="!mt-3 border-t border-slate-200 pt-2.5 font-sans text-xs leading-relaxed text-slate-600">
    <span className="font-semibold text-slate-900">Why this data: </span>
    {id === undefined ? children : <Swap id={id} inline>{children}</Swap>}
  </p>
);

const V = ({ children }: { children: React.ReactNode }) => <i>{children}</i>;
const Sub = ({ children }: { children: React.ReactNode }) => (
  <sub className="text-[0.7em]">{children}</sub>
);
