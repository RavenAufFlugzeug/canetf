// The Fold / Open button of a section that folds away (a legend, a pick's general info, the
// exchange…): its two arrows point apart to open and together to fold. They are the same two
// arrows either way, each flipping over as the section opens or folds (however that happens:
// this button, or the section's title), its word simply changing; pointed at, the arrows
// spread (or close in) a touch, drawn past the icon's edge rather than cut off there.
export const FOLD_BUTTON =
  "group inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition duration-200 ease-out hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm active:scale-95 active:bg-slate-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";
// Each arrow flips about its own middle (transform), and moves on hover (translate), both eased.
const ARROW = "[transform-box:fill-box] origin-center transition-[transform,translate] duration-300 ease-out";

export default function FoldButton({
  open,
  controls,
  onClick,
  className = "",
}: {
  open: boolean;
  controls: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
      className={`${FOLD_BUTTON} ${className}`}
    >
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3 overflow-visible"
      >
        {/* The top arrow points up (open: apart) or, flipped, down (folded: together); the
            bottom one the other way. Pointed at, they move the way they point. */}
        <path
          d="M3 4.5 6 1.5l3 3"
          className={`${ARROW} ${open ? "motion-safe:group-hover:translate-y-0.5" : "motion-safe:group-hover:-translate-y-0.5"}`}
          style={{ transform: open ? "scaleY(-1)" : "none" }}
        />
        <path
          d="M3 7.5 6 10.5l3-3"
          className={`${ARROW} ${open ? "motion-safe:group-hover:-translate-y-0.5" : "motion-safe:group-hover:translate-y-0.5"}`}
          style={{ transform: open ? "scaleY(-1)" : "none" }}
        />
      </svg>
      {open ? "Close" : "Open"}
    </button>
  );
}
