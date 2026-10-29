// The Fold / Open button of a legend that folds away (the Holdings Map's sector key, the Search
// page's badge legend): its two arrows point together to fold and apart to open, and close in
// (or spread) a touch when pointed at.
export const FOLD_BUTTON =
  "group inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition duration-200 ease-out hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm active:scale-95 active:bg-slate-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";
const ARROW = "transition-transform duration-300 ease-out";

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
        className="size-3"
      >
        {open ? (
          <>
            <path d="M3 1.5 6 4.5l3-3" className={`${ARROW} motion-safe:group-hover:translate-y-0.5`} />
            <path d="M3 10.5 6 7.5l3 3" className={`${ARROW} motion-safe:group-hover:-translate-y-0.5`} />
          </>
        ) : (
          <>
            <path d="M3 4.5 6 1.5l3 3" className={`${ARROW} motion-safe:group-hover:-translate-y-0.5`} />
            <path d="M3 7.5 6 10.5l3-3" className={`${ARROW} motion-safe:group-hover:translate-y-0.5`} />
          </>
        )}
      </svg>
      {open ? "Fold" : "Open"}
    </button>
  );
}
