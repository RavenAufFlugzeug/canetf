// Search's mark: a magnifying glass with a star. Its lens is a round ring left open at the
// top right, where a four-pointed star sits, drawn in outline; a square-ended handle runs
// down to the right. It takes the colour of the text around it.
//
// Pointed at, or when a surrounding `group` is, the glass swings a little about its lens
// and the star twinkles, popping as it turns a quarter turn (.search-mark and
// .search-mark-star in globals.css).
const LENS = "M64.5 53.7A26.8 26.8 0 1 1 43.6 23.8";
const STAR = "67,7 72.3,17.7 83,23 72.3,28.3 67,39 61.7,28.3 51,23 61.7,17.7";
const HANDLE = "M54.9 66.9 83 95";

export default function SearchMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="3.6 15.6 86.6 86.6"
      className={`search-mark shrink-0 overflow-visible fill-none stroke-current ${className}`}
      strokeLinejoin="miter"
    >
      {/* The lens: a ring, open at the top right. */}
      <path d={LENS} strokeWidth="10" strokeLinecap="round" />
      {/* The star in the opening. */}
      <polygon points={STAR} strokeWidth="6" className="search-mark-star" />
      {/* The handle. */}
      <path d={HANDLE} strokeWidth="13" />
    </svg>
  );
}
