"use client";

import { useId, useState } from "react";
import FoldButton from "@/components/FoldButton";
import KindMark from "@/components/KindMark";
import { KINDS, badgeLook } from "@/lib/kinds";
import { NAICS_GROUPS, naicsOf } from "@/lib/naics";
import { kindOf } from "@/lib/sandbox";
import { PANEL_TITLE, SECTION_TITLE, LINK_TEXT } from "@/lib/ui";
import { ChevronDownIcon } from "@/components/Icons";

// The pop-up under a legend tile when it is pointed at (or focused), as the Sandbox's pick
// cards have: the tile's name in full, and what it means. Its tile is a group/tip. The
// Holdings Map's key uses it too.
export function Tip({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
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
// professional services; one making hardware, manufacturing). Every colour, with the one this
// listing has picked out, then every mark, likewise. Pointed at, a tile shows its name in
// full and what it means (Tip). It folds away and opens again with its Fold / Open button, as
// the Holdings Map's key does: folding, the tiles slip away last first and it closes up;
// opening, it opens out and they cascade back in (.legend-fold and .legend-row in globals.css).
// Without `highlight` (the Watch List's, for many listings at once) none is picked out.
export default function BadgeLegend({
  sector = null,
  industry = null,
  fundFamily = null,
  category = null,
  delay = 0,
  mark,
  colour,
  startOpen = true,
  highlight = true,
  className = "mt-8 border-t border-slate-200 pt-6",
  popup = false,
}: {
  sector?: string | null;
  industry?: string | null;
  fundFamily?: string | null;
  category?: string | null;
  delay?: number;
  // The mark and colour to pick out, when known already (the Sandbox's chosen pick, whose
  // sector stays hidden): its kind, and its NAICS group's code (null for none).
  mark?: string;
  colour?: string | null;
  // Whether it starts open (on the Search page) or folded (in the Sandbox, the Watch List).
  startOpen?: boolean;
  // Whether one listing's mark and colour are picked out (not on the Watch List).
  highlight?: boolean;
  // Its spacing: by default set apart from what is above it by a rule.
  className?: string;
  // Shown in a pop-up (BadgeInfo): always open, with no heading or fold of its own (the pop-up
  // has its title and its close).
  popup?: boolean;
}) {
  const kind = highlight ? (mark ?? kindOf({ sector, industry, fundFamily, category })) : null;
  const naics = !highlight
    ? null
    : colour !== undefined
      ? (NAICS_GROUPS.find((g) => g.code === colour) ?? null)
      : naicsOf(sector, industry);
  const look = badgeLook(kind ?? "", naics);
  const [open, setOpen] = useState(popup || startOpen);
  // Whether it is open and done opening: only then may a tile's pop-up reach past its bottom
  // (while it folds or opens, what is outside it is clipped).
  const [settled, setSettled] = useState(popup || startOpen);
  const id = useId();
  // Each tile's place in the cascade: the colours, then the marks.
  const rows = KINDS.length + NAICS_GROUPS.length;
  const d = (i: number) => ({ "--d": `${open ? 60 + i * 18 : (rows - 1 - i) * 8}ms` }) as React.CSSProperties;

  function toggle() {
    // With motion reduced it opens at once, with no transition to wait for.
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSettled(calm && !open);
    setOpen(!open);
  }

  return (
    <section className={`rise-in ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {!popup && (
        <div className="flex items-center gap-4">
          <h3 className={SECTION_TITLE}>What the icon means</h3>
          <FoldButton open={open} controls={id} onClick={toggle} className="ml-auto text-xs" />
        </div>
      )}
      {/* What a badge is, always in view, folded or not. */}
      <p className={`${popup ? "" : "mt-1"} text-sm text-slate-600`}>
        {"Each icon combines two classifications: its "}
        <span className="font-semibold text-slate-900">colour</span>
        {" shows the NAICS industry group, and its "}
        <span className="font-semibold text-slate-900">symbol</span>
        {" the sector, as reported by Yahoo Finance. The two may differ; an IT-services firm, for example, is classed under professional services in NAICS."}
      </p>
      {/* Folded, a line saying there is more, which opens it: it unfolds as the legend folds
          away, and folds away as the legend opens. */}
      <div className={popup ? "hidden" : "legend-fold"} data-closed={open ? "" : undefined} inert={open}>
        <div>
          <button
            type="button"
            onClick={toggle}
            aria-controls={id}
            className={`legend-row group mt-3 inline-flex items-center gap-2 text-sm ${LINK_TEXT}`}
            style={{ "--d": open ? "0ms" : "260ms" } as React.CSSProperties}
          >
            <span className="flex -space-x-1" aria-hidden>
              {/* A peek at what is folded away: three of its colours. */}
              {NAICS_GROUPS.slice(0, 3).map((g) => (
                <span
                  key={g.code}
                  className="size-3 rounded-full ring-2 ring-white"
                  style={{ background: g.color }}
                />
              ))}
            </span>
            See all {KINDS.length} sectors and {NAICS_GROUPS.length} NAICS groups
            <ChevronDownIcon className="size-3 transition-transform duration-300 ease-out motion-safe:group-hover:translate-y-0.5" />
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
          <p className={`legend-row pt-4 ${PANEL_TITLE}`}>
            NAICS
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
                  style={d(i)}
                >
                  <span
                    aria-hidden
                    className={`naics-swatch size-3.5 shrink-0 rounded-full ${mine ? "legend-pop" : ""}`}
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
          {!naics && kind === "Currency" && (
            <p className="legend-row mt-2 text-xs text-slate-500">
              An exchange rate has no NAICS group: its icon is white with a black outline.
            </p>
          )}

          <p className={`legend-row mt-5 ${PANEL_TITLE}`}>
            Sectors
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
                  style={d(NAICS_GROUPS.length + i)}
                >
                  <span
                    className={`kind-badge grid size-7 shrink-0 place-items-center rounded-full ${
                      mine ? "" : "bg-slate-100 text-slate-700"
                    } ${mine && look.ring ? "ring-[1.5px] ring-inset ring-slate-900" : ""}`}
                    style={
                      mine
                        ? { background: look.background, color: look.color, ["--badge" as string]: look.glow }
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
        </div>
      </div>
    </section>
  );
}
