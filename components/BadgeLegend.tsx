"use client";

import { useId, useState } from "react";
import FoldButton from "@/components/FoldButton";
import KindMark from "@/components/KindMark";
import { KINDS } from "@/lib/kinds";
import { NAICS_GROUPS, markOn, naicsOf } from "@/lib/naics";
import { kindOf } from "@/lib/sandbox";

// The pop-up under a legend tile when it is pointed at (or focused), as the Sandbox's pick
// cards have: the tile's name in full, and what it means. Its tile is a group/tip.
function Tip({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 max-w-[80vw] translate-y-1 rounded-lg border border-slate-200 bg-white p-3 text-left font-normal opacity-0 shadow-lg shadow-slate-300/50 transition duration-200 ease-out group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-focus-visible/tip:translate-y-0 group-focus-visible/tip:opacity-100"
    >
      <span
        aria-hidden
        className="absolute -top-[5.5px] left-5 size-2.5 rotate-45 border-l border-t border-slate-200 bg-white"
      />
      <span className="block text-sm font-semibold text-slate-900">{title}</span>
      {sub && <span className="mt-0.5 block text-xs font-medium text-slate-700">{sub}</span>}
      {children && <span className="mt-1.5 block text-xs leading-relaxed text-slate-600">{children}</span>}
    </span>
  );
}

// What a listing's badge means (KindBadge), under a company on the Search page: its mark comes
// from the listing's sector as Yahoo Finance gives it, and its colour from the NAICS sector
// group that works out to, which can differ (a technology firm in IT services is
// professional services; one making hardware, manufacturing). Every mark, with the one this
// listing has picked out, then every colour, likewise. Pointed at, a tile shows its name in
// full and what it means (Tip). It folds away and opens again with its Fold / Open button, as
// the Holdings Map's key does: folding, the tiles slip away last first and it closes up;
// opening, it opens out and they cascade back in (.legend-fold and .legend-row in globals.css).
export default function BadgeLegend({
  sector,
  industry,
  fundFamily = null,
  category = null,
  delay = 0,
}: {
  sector: string | null;
  industry: string | null;
  fundFamily?: string | null;
  category?: string | null;
  delay?: number;
}) {
  const kind = kindOf({ sector, industry, fundFamily, category });
  const naics = naicsOf(sector, industry);
  const fund = kind === "ETF";
  const [open, setOpen] = useState(true);
  // Whether it is open and done opening: only then may a tile's pop-up reach past its bottom
  // (while it folds or opens, what is outside it is clipped).
  const [settled, setSettled] = useState(true);
  const id = useId();
  // Each tile's place in the cascade: the marks, then the colours.
  const rows = KINDS.length + NAICS_GROUPS.length;
  const d = (i: number) => ({ "--d": `${open ? 60 + i * 18 : (rows - 1 - i) * 8}ms` }) as React.CSSProperties;

  function toggle() {
    // With motion reduced it opens at once, with no transition to wait for.
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSettled(calm && !open);
    setOpen(!open);
  }

  return (
    <section className="rise-in mt-8 border-t border-slate-200 pt-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-4">
        <h3 className="text-lg font-semibold text-slate-900">What the badge means</h3>
        <FoldButton open={open} controls={id} onClick={toggle} className="ml-auto text-xs" />
      </div>
      {/* What a badge is, always in view, folded or not. */}
      <p className="mt-1 text-sm text-slate-600">
        A badge has two parts. Its <span className="font-semibold text-slate-900">mark</span>
        {" comes from the listing’s sector as Yahoo Finance gives it; its "}
        <span className="font-semibold text-slate-900">colour</span> from the NAICS sector group that works
        out to. The two can differ: a technology firm in IT services counts as professional services, one
        making hardware as manufacturing.
      </p>
      {/* Folded, a line saying there is more, which opens it: it unfolds as the legend folds
          away, and folds away as the legend opens. */}
      <div className="legend-fold" data-closed={open ? "" : undefined} inert={open}>
        <div>
          <button
            type="button"
            onClick={toggle}
            aria-controls={id}
            className="legend-row group mt-3 inline-flex items-center gap-2 rounded-md text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            style={{ "--d": open ? "0ms" : "260ms" } as React.CSSProperties}
          >
            <span className="flex -space-x-1" aria-hidden>
              {/* A peek at what is folded away: three of its colours. */}
              {NAICS_GROUPS.slice(0, 3).map((g) => (
                <span
                  key={g.code}
                  className="size-3 rounded-sm ring-2 ring-white"
                  style={{ background: g.color }}
                />
              ))}
            </span>
            See all {KINDS.length} marks and {NAICS_GROUPS.length} colours
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3 transition-transform duration-300 ease-out motion-safe:group-hover:translate-y-0.5"
            >
              <path d="M3 4.5 6 7.5l3-3" />
            </svg>
          </button>
        </div>
      </div>
      <div
        id={id}
        className="legend-fold"
        data-closed={open ? undefined : ""}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && open) setSettled(true);
        }}
      >
        {/* The folding element's only child; nothing outside it shows unless it has settled open. */}
        <div style={settled ? { overflow: "visible" } : undefined}>
          <p className="legend-row pt-4 text-xs font-semibold uppercase tracking-wide text-slate-900">
            Marks: the sector
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {KINDS.map((k, i) => {
              const mine = k.kind === kind;
              return (
                <li
                  key={k.kind}
                  tabIndex={0}
                  className={`group/tip kind-hover legend-row legend-tile relative flex outline-none hover:z-20 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-slate-300 items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                    mine
                      ? "border-slate-900 bg-white shadow-md shadow-slate-900/10"
                      : "border-transparent hover:border-slate-200 hover:bg-white"
                  }`}
                  style={d(i)}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-lg ${
                      mine ? "legend-pop text-white" : "bg-slate-100 text-slate-700"
                    }`}
                    style={
                      mine
                        ? {
                            background: naics?.color ?? (fund ? "#1e293b" : "oklch(0.80 0 0)"),
                            color: (naics && markOn(naics)) ?? (fund ? "#fff" : "#0f172a"),
                          }
                        : undefined
                    }
                  >
                    <KindMark kind={k.kind} className="size-4" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-xs font-semibold text-slate-900">{k.label}</span>
                    <span className="block truncate text-[11px] text-slate-500">{k.from}</span>
                  </span>
                  <Tip title={k.label} sub={`Yahoo sector: ${k.from}`}>
                    {k.about}
                  </Tip>
                </li>
              );
            })}
          </ul>

          <p className="legend-row mt-5 text-xs font-semibold uppercase tracking-wide text-slate-900">
            Colours: the NAICS group
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {NAICS_GROUPS.map((g, i) => {
              const mine = g.code === naics?.code;
              return (
                <li
                  key={g.code}
                  tabIndex={0}
                  className={`group/tip naics-row legend-row legend-tile relative flex outline-none hover:z-20 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-slate-300 items-center gap-2 rounded-md px-2 py-1 text-xs transition ${
                    mine
                      ? "bg-white font-semibold text-slate-900 shadow-md shadow-slate-900/10 ring-1 ring-slate-900"
                      : "text-slate-600 hover:bg-white"
                  }`}
                  style={d(KINDS.length + i)}
                >
                  <span
                    aria-hidden
                    className={`naics-swatch size-3.5 shrink-0 rounded ${mine ? "legend-pop" : ""}`}
                    style={{ background: g.color, ["--swatch" as string]: g.color }}
                  />
                  <span className="tabular-nums font-medium text-slate-900">{g.code.replace("-", "–")}</span>
                  <span className="min-w-0 truncate">{g.name}</span>
                  <Tip
                    title={g.name}
                    sub={`NAICS ${g.code.includes("-") ? "sectors" : "sector"} ${g.code.replace("-", "\u2013")}`}
                  />
                </li>
              );
            })}
          </ul>
          {fund && (
            <p className="legend-row mt-2 text-xs text-slate-500">
              A fund has no NAICS group: its badge is dark slate.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
