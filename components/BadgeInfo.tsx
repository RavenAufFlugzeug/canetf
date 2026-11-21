"use client";

import { useRef, useState } from "react";
import BadgeLegend from "@/components/BadgeLegend";
import KindMark from "@/components/KindMark";
import Popup, { usePopupClose } from "@/components/Popup";
import CloseButton from "@/components/CloseButton";
import { FOCUS_RING } from "@/lib/ui";

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
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        className={`group/info relative inline-flex shrink-0 items-center gap-1.5 rounded-full normal-case tracking-normal transition duration-200 ${FOCUS_RING} active:scale-95 motion-safe:hover:-translate-y-px ${
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
          onClose={() => setOpen(false)}
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
  const { leaving, close } = usePopupClose(onClose);
  const button = useRef<HTMLButtonElement>(null);

  return (
    <Popup label="Icons" leaving={leaving} onClose={close} initialFocus={button} className="my-8 max-w-3xl p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white">
          <InfoMark className="size-4" />
        </span>
        <h2 className="min-w-0 flex-1 self-center text-lg font-semibold text-slate-900">Icons</h2>
        <CloseButton ref={button} onClick={close} />
      </div>
      <BadgeLegend popup className="mt-3" mark={mark} colour={colour} highlight={highlight} />
    </Popup>
  );
}
