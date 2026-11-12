"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getDividendHistory } from "@/app/actions/dividends";
import DiamondLoader from "@/components/DiamondLoader";
import Swap from "@/components/Swap";
import Tween from "@/components/Tween";
import { POPUP_CARD, POPUP_OUT_MS, popupOverlay } from "@/lib/popup";

type History = NonNullable<Awaited<ReturnType<typeof getDividendHistory>>>;
// One calendar year of dividends: its total per share, its payments, its yield at its last
// close, and whether it is the year still going (its total so far).
type Year = {
  year: string;
  total: number;
  payments: { date: string; amount: number }[];
  yield: number | null;
  partial: boolean;
};

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const day = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const dayOf = (date: string) => day.format(new Date(`${date}T00:00:00Z`));
// An amount per share: to the cent, finer when small (0.0910).
const amountText = (n: number, currency: string | null) =>
  `${n.toLocaleString("en-CA", { minimumFractionDigits: n < 1 ? 4 : 2, maximumFractionDigits: n < 1 ? 4 : 2 })}${
    currency ? ` ${currency}` : ""
  }`;

// The years from the first dividend to the latest close's (years without one in between kept,
// at nothing).
function yearsOf({ payments, yearEnds }: History): Year[] {
  if (!payments.length) return [];
  const first = Number(payments[0].date.slice(0, 4));
  const last = Number(yearEnds.at(-1)?.year ?? payments.at(-1)!.date.slice(0, 4));
  const closes = new Map(yearEnds.map((y) => [y.year, y.close]));
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const year = String(first + i);
    const these = payments.filter((p) => p.date.startsWith(year));
    const total = these.reduce((sum, p) => sum + p.amount, 0);
    const close = closes.get(year);
    return { year, total, payments: these, yield: close ? total / close : null, partial: i === last - first };
  });
}

// The dividend row's "History" button, and its pop-up: the listing's cash dividends per share
// by calendar year as bars (the year still going lighter, "so far"), each year picked by
// pointing, tapping or the arrow keys, the spotlight gliding to it; under it, that year's total,
// payments, yield at its last close and change from the year before, the words cross-fading.
export default function DividendHistory({ symbol, currency }: { symbol: string; currency: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/hist ml-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pr-2.5 pl-1.5 align-middle text-[11px] font-medium text-slate-600 shadow-sm transition duration-200 ease-out hover:border-slate-900 hover:bg-slate-900 hover:text-white hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:scale-95"
      >
        <HistoryMark className="size-4" />
        History
      </button>
      {open && <HistoryCard symbol={symbol} currency={currency} onClose={() => setOpen(false)} />}
    </>
  );
}

// The History button's mark: three bars stepping up to the right. Pointed at, they grow up one
// after another (.hist-bar in globals.css). It takes the button's text colour.
function HistoryMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`shrink-0 overflow-visible ${className}`}>
      {/* Bars stepping up to the right: growth paid out over the years. */}
      <rect className="hist-bar" x="1.5" y="9" width="3" height="5.5" rx="1" fill="currentColor" opacity="0.5" />
      <rect
        className="hist-bar"
        x="6.5"
        y="5.5"
        width="3"
        height="9"
        rx="1"
        fill="currentColor"
        opacity="0.75"
        style={{ animationDelay: "70ms" }}
      />
      <rect
        className="hist-bar"
        x="11.5"
        y="2"
        width="3"
        height="12.5"
        rx="1"
        fill="currentColor"
        style={{ animationDelay: "140ms" }}
      />
    </svg>
  );
}

// The chart's frame, in SVG units.
const W = 560;
const H = 220;
const L = 52;
const R = 8;
const T = 22;
const B = 24;
const IW = W - L - R;
const IH = H - T - B;
const GLIDE = "260ms cubic-bezier(0.22, 1, 0.36, 1)";

function HistoryCard({
  symbol,
  currency,
  onClose,
}: {
  symbol: string;
  currency: string | null;
  onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [data, setData] = useState<History | null | "loading">("loading");
  const [picked, setPicked] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, calm() ? 0 : POPUP_OUT_MS);
  };
  useEffect(() => {
    let live = true;
    getDividendHistory(symbol).then(
      (d) => live && setData(d),
      () => live && setData(null),
    );
    return () => {
      live = false;
    };
  }, [symbol]);
  useEffect(() => closeButton.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const years = data && data !== "loading" ? yearsOf(data) : [];
  // The bars grow in once the history has come.
  useEffect(() => {
    if (!years.length) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(frame);
  }, [years.length]);

  // The year shown: the one picked, else the last full year (the latest when there is no other).
  const fallback = years.length > 1 ? years.length - 2 : years.length - 1;
  const at = picked ?? fallback;
  const shown = years[at];
  const before = at > 0 ? years[at - 1] : null;
  const change = shown && before && before.total > 0 && !shown.partial ? shown.total / before.total - 1 : null;

  const top = Math.max(...years.map((y) => y.total), 0) * 1.15 || 1;
  const slot = IW / Math.max(years.length, 1);
  const gap = slot >= 14 ? 4 : slot >= 6 ? 2 : 1;
  const yOf = (v: number) => T + IH - (v / top) * IH;
  const pick = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box || !years.length) return;
    const x = ((clientX - box.left) / box.width) * W;
    setPicked(Math.min(Math.max(Math.floor((x - L) / slot), 0), years.length - 1));
  };
  const still = typeof window !== "undefined" && calm();
  // Year labels: all when they fit, else every few.
  const every = Math.ceil(years.length / 12);

  return createPortal(
    // (Fading in a little more slowly than other pop-ups: .popup-slow in globals.css.)
    <div className={`popup-slow ${popupOverlay(leaving)}`} onClick={close}>
      <div
        role="dialog"
        aria-label={`Dividend history of ${symbol}`}
        onClick={(e) => e.stopPropagation()}
        className={`${POPUP_CARD} my-8 max-w-2xl p-6`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dividend history</p>
            <p className="text-lg font-semibold text-slate-900">{symbol}</p>
            <p className="text-sm text-slate-500">
              Cash dividends per share by calendar year, by ex-dividend date{currency ? ` (${currency})` : ""}.
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

        {data === "loading" ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <DiamondLoader className="size-3.5" />
            Loading dividends…
          </p>
        ) : !years.length ? (
          <p className="mt-6 text-sm text-slate-600">No cash dividends are on record for {symbol}.</p>
        ) : (
          <div className="text-fade-in">
            <svg
              ref={svg}
              viewBox={`0 0 ${W} ${H}`}
              tabIndex={0}
              role="img"
              aria-label={`Dividends per year, ${years[0].year} to ${years.at(-1)!.year}. Selected: ${shown.year}, ${amountText(shown.total, currency)}. Use the arrow keys to move.`}
              onPointerMove={(e) => pick(e.clientX)}
              onPointerDown={(e) => pick(e.clientX)}
              onPointerLeave={() => setPicked(null)}
              onKeyDown={(e) => {
                const move = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
                if (!move) return;
                e.preventDefault();
                setPicked(Math.min(Math.max(at + move, 0), years.length - 1));
              }}
              className="mt-4 w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {[0, 0.5, 1].map((f) => (
                <g key={f}>
                  <line x1={L} x2={W - R} y1={yOf(top * f)} y2={yOf(top * f)} stroke={f ? "#e2e8f0" : "#94a3b8"} />
                  <text
                    x={L - 6}
                    y={yOf(top * f) + 3.5}
                    textAnchor="end"
                    className="fill-slate-500 text-[10px] tabular-nums"
                  >
                    {(top * f).toFixed(top < 1 ? 2 : 1)}
                  </text>
                </g>
              ))}
              {/* The spotlight behind the year shown, gliding. */}
              <rect
                x={0}
                y={T - 18}
                width={slot}
                height={IH + 18}
                rx={6}
                fill="#f1f5f9"
                style={{ transform: `translateX(${L + at * slot}px)`, transition: still ? "none" : `transform ${GLIDE}` }}
              />
              {years.map((y, i) => {
                const h = Math.max((y.total / top) * IH, y.total > 0 ? 1 : 0);
                const on = i === at;
                return (
                  <g key={y.year}>
                    <rect
                      x={L + i * slot + gap / 2}
                      width={slot - gap}
                      y={T + IH - h}
                      height={h}
                      rx={Math.min(3, (slot - gap) / 2)}
                      fill={on ? "#0f172a" : y.partial ? "#cbd5e1" : "#64748b"}
                      style={{
                        transformBox: "fill-box",
                        transformOrigin: "bottom",
                        transform: `scaleY(${grown || still ? 1 : 0})`,
                        transition: still ? "none" : `transform 500ms ease-out ${i * 25}ms, fill 250ms ease-out`,
                      }}
                    />
                    {(i % every === 0 || i === years.length - 1) && (
                      <text
                        x={L + i * slot + slot / 2}
                        y={H - 6}
                        textAnchor="middle"
                        className={`text-[10px] tabular-nums transition-colors duration-200 ${on ? "fill-slate-900 font-semibold" : "fill-slate-500"}`}
                      >
                        {y.partial ? `${y.year}*` : y.year}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* The year shown's total, over its bar, gliding with it. */}
              <g
                style={{
                  transform: `translate(${Math.min(Math.max(L + at * slot + slot / 2, L + 30), W - R - 30)}px, ${yOf(shown.total) - 6}px)`,
                  transition: still ? "none" : `transform ${GLIDE}`,
                }}
              >
                <text
                  key={shown.year}
                  textAnchor="middle"
                  className="swap-in fill-slate-900 text-[11px] font-semibold tabular-nums"
                  style={{ stroke: "#ffffff", strokeWidth: 3, paintOrder: "stroke" }}
                >
                  {shown.total.toFixed(shown.total < 1 ? 4 : 2)}
                </text>
              </g>
            </svg>
            <p className="mt-1 text-[11px] text-slate-500">* {years.at(-1)!.year} so far.</p>

            {/* The year shown: its figures (the labels cross-fading, the numbers counting to
                the new year's), then its payments, rising in one after another. */}
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <Figure label={<Swap id={at}>{shown.partial ? `${shown.year} so far` : shown.year}</Swap>}>
                  <Tween value={shown.total} format={(x) => amountText(x, currency)} />
                </Figure>
                <Figure label="Payments">
                  <Tween value={shown.payments.length} format={(x) => String(Math.round(x))} />
                </Figure>
                <Figure label={<Swap id={at}>{shown.partial ? "Yield so far" : "Yield at year-end"}</Swap>}>
                  {shown.yield === null ? "—" : <Tween value={shown.yield * 100} format={(x) => `${x.toFixed(2)}%`} />}
                </Figure>
                <Figure label={<Swap id={at}>{before ? `vs ${before.year}` : "vs year before"}</Swap>}>
                  {change === null ? (
                    "—"
                  ) : (
                    <span
                      className={`transition-colors duration-300 ${change > 0 ? "text-green-700" : change < 0 ? "text-red-600" : ""}`}
                    >
                      <Tween
                        value={change * 100}
                        format={(x) => `${x > 0.05 ? "+" : x < -0.05 ? "−" : ""}${Math.abs(x).toFixed(1)}%`}
                      />
                    </span>
                  )}
                </Figure>
              </dl>
              {shown.payments.length > 0 && (
                <ul
                  key={shown.year}
                  className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-200 pt-3 text-xs tabular-nums"
                >
                  {shown.payments.map((p, i) => (
                    <li
                      key={p.date}
                      className="chip-in rounded-full bg-white px-2 py-0.5 text-slate-600 ring-1 ring-slate-200 transition-colors duration-200 hover:bg-amber-50 hover:ring-amber-300"
                      style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}
                    >
                      {dayOf(p.date)} · <span className="font-semibold text-slate-900">{amountText(p.amount, null)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Figure({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{children}</dd>
    </div>
  );
}
