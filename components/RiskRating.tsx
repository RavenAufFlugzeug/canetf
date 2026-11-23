import Link from "next/link";
import RiskMethodology from "@/components/RiskMethodology";
import RiskScale from "@/components/RiskScale";
import { STEP_FILL } from "@/components/riskColors";
import { MIN_MONTHS, RISK_LEVELS, RISK_YEARS, spanOf, type Risk } from "@/lib/risk";

// The five steps in a row, each in its own colour: the fund's level lit, the others visible but
// faint (all faint when not rated). `small` (the map's chip) also outlines the fund's level,
// which at that size is otherwise hard to pick out.
function Scale({ level, small = false, className = "" }: { level: number | null; small?: boolean; className?: string }) {
  return (
    <span aria-hidden className={`flex gap-0.5 ${className}`}>
      {RISK_LEVELS.map((l, i) => (
        <span
          key={l.name}
          className={`h-full flex-1 rounded-[2px] first:rounded-l-full last:rounded-r-full ${i === level ? "relative z-10" : ""}`}
          style={{
            background: STEP_FILL[i],
            opacity: i === level ? 1 : 0.22,
            boxShadow: i === level && small ? "0 0 0 1px #ffffff, 0 0 0 2px #0f172a" : undefined,
          }}
        />
      ))}
    </span>
  );
}

// A small chip for a fund's rating (the Holdings Map's heading), linking to the Search page's
// Risk rating section.
export function RiskChip({ symbol, risk }: { symbol: string; risk: Risk }) {
  const rated = risk.level !== null;
  return (
    <Link
      href={`/search?symbol=${encodeURIComponent(symbol)}#risk`}
      title="Risk rating based on the volatility of monthly returns. Select for details."
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition duration-200 ease-out hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
    >
      <Scale level={risk.level} small className="h-1.5 w-12" />
      {rated ? `Risk: ${RISK_LEVELS[risk.level!].name}` : "Risk: not rated"}
    </Link>
  );
}

// A fund's Risk rating section (Search page, Holdings Map detail): the level on a five-step
// scale, the figure behind it, and the Methodology button, which opens a step-by-step
// walkthrough of the calculation.
export default function RiskRating({ risk, symbol, delay = 520 }: { risk: Risk; symbol: string; delay?: number }) {
  const rated = risk.level !== null && risk.stdDev !== null;

  return (
    <div id="risk" className="mt-8 scroll-mt-6 border-t border-slate-200 pt-6">
      <h3 className="rise-in text-lg font-semibold text-slate-900" style={{ animationDelay: `${delay}ms` }}>
        Risk rating
      </h3>

      <div className="rise-in mt-4" style={{ animationDelay: `${delay + 40}ms` }}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-base font-semibold text-slate-900">{rated ? RISK_LEVELS[risk.level!].name : "Not rated"}</p>
          {rated && (
            <p className="text-sm text-slate-600">
              Annualized volatility{" "}
              <span className="font-semibold tabular-nums text-slate-900">{risk.stdDev!.toFixed(1)}%</span>
            </p>
          )}
        </div>
        <RiskScale level={risk.level} stdDev={risk.stdDev} />
        {/* How it is worked out is left to the Methodology; only what qualifies this fund's
            rating is said here: a history shorter than the method's, or too short to rate. */}
        {(!rated || risk.months < RISK_YEARS * 12) && (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {rated
              ? `Based on ${spanOf(risk.months)} of history rather than ${RISK_YEARS} years; treat as an estimate.`
              : `A rating requires at least ${MIN_MONTHS} months of returns; ${risk.months} ${
                  risk.months === 1 ? "is" : "are"
                } available.`}
          </p>
        )}
      </div>

      {/* The methodology, as a step-by-step walkthrough of the calculation (a pop-up). */}
      <div className="rise-in mt-4" style={{ animationDelay: `${delay + 80}ms` }}>
        <RiskMethodology risk={risk} symbol={symbol} />
      </div>
    </div>
  );
}
