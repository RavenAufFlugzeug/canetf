"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BadgeLegend from "@/components/BadgeLegend";
import KindMark from "@/components/KindMark";
import { POPUP_CARD, POPUP_OUT_MS, popupOverlay } from "@/lib/popup";

// The "i" drawn in the info button and the pop-up's title.
function InfoMark({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
    >
      <path d="M8 7v4.5" />
      <path d="M8 4.4v.1" strokeWidth="2.2" />
    </svg>
  );
}

// What the icons (badges) mean, behind a small button (an "i" in a ring) set beside a list of
// badged listings: pointed at, it lifts and darkens; clicked, the badge legend (BadgeLegend)
// opens in a pop-up over the page, dimmed and softly blurred behind it, with the listing's own
// mark and colour picked out when given. The pop-up fades and rises in, and fades and sinks
// away when closed (the ×, Escape, or a click beside it), focus going back to the button.
// The icon the button always shows (the same wherever it is), one of those it explains.
const BUTTON_ICON = "FinanceCompany";

export default function BadgeInfo({
  mark,
  colour,
  highlight = true,
  label = "Icons",
  labelled = false,
}: {
  mark?: string; // the kind to pick out (the listing chosen)
  colour?: string | null; // its NAICS group's code
  highlight?: boolean;
  label?: string;
  // With a word beside it ("Icons?") and, in place of the "i", one of the icons it explains
  // (always the same, drawn plainly in the button's colour), so it plainly says what it is for
  // and asks to be clicked; its outline pulses softly a few times as it first appears.
  labelled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={`${label}: what they mean (click)`}
        aria-haspopup="dialog"
        className={`group/info relative inline-flex shrink-0 items-center gap-1.5 rounded-full normal-case tracking-normal transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:scale-95 motion-safe:hover:-translate-y-px ${
          labelled
            ? "border border-slate-300 bg-white px-2.5 py-1 text-[11px] leading-none font-semibold text-slate-700 hover:border-slate-900 hover:bg-slate-900 hover:text-white"
            : ""
        }`}
      >
        {labelled ? (
          <>
            {/* A soft outline pulses out from the button a few times as it first appears, so
                it is noticed. */}
            <span
              aria-hidden
              className="info-ping pointer-events-none absolute inset-0 rounded-full border border-slate-900"
            />
            {/* One of the icons it explains (always the same one), drawn plainly in the
                button's own colour, and still. */}
            <KindMark kind={BUTTON_ICON} className="size-3.5" />
          </>
        ) : (
          <span className="grid size-5 shrink-0 place-items-center rounded-full text-slate-500 ring-1 ring-slate-300 transition duration-200 group-hover/info:bg-slate-900 group-hover/info:text-white group-hover/info:ring-slate-900">
            <InfoMark className="size-3" />
          </span>
        )}
        {labelled && "Icons?"}
      </button>
      {open && (
        <LegendPopup
          mark={mark}
          colour={colour}
          highlight={highlight}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}

function LegendPopup({
  mark,
  colour,
  highlight,
  onClose,
}: {
  mark?: string;
  colour?: string | null;
  highlight: boolean;
  onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    if (leaving) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    window.setTimeout(onClose, calm ? 0 : POPUP_OUT_MS);
  };

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return createPortal(
    <div className={popupOverlay(leaving)} onClick={close}>
      <div
        role="dialog"
        aria-label="Icons"
        onClick={(e) => e.stopPropagation()}
        className={`${POPUP_CARD} my-8 max-w-3xl p-6`}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white">
            <InfoMark className="size-4" />
          </span>
          <h2 className="min-w-0 flex-1 self-center text-lg font-semibold text-slate-900">Icons</h2>
          <button
            ref={button}
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
        <BadgeLegend popup className="mt-3" mark={mark} colour={colour} highlight={highlight} />
      </div>
    </div>,
    document.body,
  );
}
