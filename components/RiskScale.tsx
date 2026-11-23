"use client";

import { useState } from "react";
import { STEP_FILL } from "@/components/riskColors";
import Swap from "@/components/Swap";
import { RISK_LEVELS } from "@/lib/risk";

// How a level grows and its card glides: unhurried, settling softly.
const EASE = "340ms cubic-bezier(0.22, 1, 0.36, 1)";
const FADE = "220ms ease-out";

// The Search page's risk scale: the five levels in their colours, the fund's lit, the others
// faint, with their names below. Pointing at (or focusing) a level grows it and brings up its
// colour, darkens its name, and shows a card above it with its range and how it compares with
// the fund. The card appears where it is needed (no slide from elsewhere), then glides from
// level to level with its words cross-fading (Swap), and fades where it is when the pointer
// leaves.
export default function RiskScale({ level, stdDev }: { level: number | null; stdDev: number | null }) {
  // The level pointed at (null: none), the last one (where the card stays as it fades), and
  // whether the card is already showing, so it glides rather than appearing mid-slide.
  const [hover, setHover] = useState<number | null>(null);
  const [last, setLast] = useState(level ?? 0);
  const [glide, setGlide] = useState(false);
  const enter = (i: number) => {
    setGlide(hover !== null);
    setHover(i);
    setLast(i);
  };
  const leave = () => {
    setHover(null);
    setGlide(false);
  };

  const end = RISK_LEVELS.length - 1;
  const shown = hover ?? last;
  const lower = shown === 0 ? 0 : RISK_LEVELS[shown - 1].upTo;
  const upper = RISK_LEVELS[shown].upTo;
  let compare: string | null = null;
  if (level !== null && stdDev !== null) {
    compare =
      shown === level
        ? `This fund (${stdDev.toFixed(1)}%) falls in this range.`
        : `${shown < level ? "Lower" : "Higher"} risk than this fund (${stdDev.toFixed(1)}%).`;
  }

  return (
    <div className="relative mt-2.5" onPointerLeave={leave}>
      {/* The card above the level pointed at, kept inside the scale at either end. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-full z-20 mb-3 w-72 max-w-[85vw] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-snug text-slate-600 shadow-lg shadow-slate-300/50 motion-reduce:!transition-none"
        style={{
          left: `${((shown + 0.5) / RISK_LEVELS.length) * 100}%`,
          transform: `translate(${shown === 0 ? "-12%" : shown === end ? "-88%" : "-50%"}, ${hover === null ? 4 : 0}px)`,
          opacity: hover === null ? 0 : 1,
          transition: glide ? `left ${EASE}, transform ${EASE}, opacity ${FADE}` : `transform ${EASE}, opacity ${FADE}`,
        }}
      >
        <Swap id={shown}>
          <span className="block">
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="size-2 rounded-full" style={{ background: STEP_FILL[shown] }} />
              {RISK_LEVELS[shown].name}
            </span>
            <span className="mt-0.5 block whitespace-nowrap">
              Annualized volatility {upper === null ? `of ${lower}% or more` : `from ${lower}% to less than ${upper}%`}.
            </span>
            {compare && <span className="mt-0.5 block text-slate-500">{compare}</span>}
          </span>
        </Swap>
      </div>

      <div className="flex h-2.5 gap-0.5">
        {RISK_LEVELS.map((l, i) => {
          const on = hover === i;
          return (
            <button
              key={l.name}
              type="button"
              onPointerEnter={() => enter(i)}
              onFocus={() => enter(i)}
              onBlur={leave}
              aria-label={`${l.name}: annualized volatility ${
                l.upTo === null ? `of ${i === 0 ? 0 : RISK_LEVELS[i - 1].upTo}% or more` : `under ${l.upTo}%`
              }${i === level ? ", this fund's level" : ""}`}
              className="relative h-full flex-1 cursor-default rounded-[2px] outline-none first:rounded-l-full last:rounded-r-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400"
            >
              {/* The level: grows by its own height when pointed at, so its ends stay round. */}
              <span
                className="absolute inset-x-0 rounded-[inherit] motion-reduce:!transition-none"
                style={{
                  top: on ? -3 : 0,
                  bottom: on ? -3 : 0,
                  background: STEP_FILL[i],
                  opacity: i === level ? 1 : on ? 0.75 : 0.22,
                  transition: `top ${EASE}, bottom ${EASE}, opacity ${EASE}`,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* The levels' names (the ends only on narrow screens); the fund's in bold, the one
          pointed at darkened. */}
      <div className="mt-1.5 flex gap-0.5 text-[11px] leading-tight">
        {RISK_LEVELS.map((l, i) => (
          <span
            key={l.name}
            className={`flex-1 text-center transition-colors duration-300 ease-out first:text-left last:text-right ${
              i === level ? "font-semibold" : ""
            } ${i === level || hover === i ? "text-slate-900" : "text-slate-500"} ${
              i > 0 && i < end ? "max-sm:invisible" : ""
            }`}
          >
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
