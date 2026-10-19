// The Watch List's mark: a feather pen laid across a closed book. The book is solid, with
// rounded corners, tilted back a little to the left, the edge of its pages showing along
// its bottom and round its bottom right corner. The pen, slender and curving, crosses it
// from beyond its top corner to its nib by its bottom left corner, a thin gap cut around
// it to keep it clear of the book. The pen is split down its vein into two halves: the
// left half is solid, with a notch in its edge, and runs on into the quill, which ends in
// a fine nib; the right half is the colour of the background, its edge broken into barbs.
// A thin line of the background colour between them is the vein. It takes the colour of the text around it.
//
// Pointed at, or when a surrounding `group` is, the pen dips about its nib as if to write,
// and rises again when let go (.watch-mark-pen in globals.css). Its tip may swing past the
// drawing's box, so it is let show outside it. `id` names the gap's mask; it must be
// unique on the page.

// The pen's left half and quill, from the tip: down the left edge, in and out of the
// notch, down the quill to the nib, then back up the vein to the tip.
const LEFT =
  "M88.1 2.3C75.6 5.4 64.7 11.7 58.4 19.5C52.2 27.3 46 35.1 43.2 43.2L46.6 45.2 42.5 48.9C41.7 55.4 42.5 63.2 43.6 67.8L40 80 48.2 67.5Q63.1 31 88.1 2.3Z";

// The pen's right half, from the foot of its vane: up the vein to the tip, then down the
// right edge, in and out between the barbs, and back to the vein.
const RIGHT =
  "M51.9 58.9Q66.1 27.6 88.1 2.3C89.6 11.7 87.3 20.3 81.8 28.1L75.6 29.6 77.9 39 70.1 41.3 70.9 49.9 63.1 51.5 60 58.5Z";

// The book, before it is tilted: its cover, and the edge of its pages along its bottom,
// wrapping a little way round the corner on the right.
const COVER = "M30 17H70Q76 17 76 23V73Q76 79 70 79H30Q24 79 24 73V23Q24 17 30 17Z";
const EDGE = "M36 85H76Q82 85 82 79V68";

// The colour of whatever the mark sits on, for the pen's light half and vein: white unless
// the surroundings set --mark-paper (as the welcome page's cards do, whose badge changes
// colour), so they always read as the background showing through.
const PAPER = "var(--mark-paper, white)";

export default function WatchMark({ id, className = "" }: { id: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="12 6.7 86.9 86.9" className={`watch-mark shrink-0 overflow-visible fill-current ${className}`}>
      <defs>
        {/* A thin gap around the pen, cut out of the book; it dips with the pen. */}
        <mask id={id} maskUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140">
          <rect x="-20" y="-20" width="140" height="140" fill="white" />
          <g className="watch-mark-pen" fill="black" stroke="black" strokeWidth="4.5" strokeLinejoin="round">
            <path d={RIGHT} />
            <path d={LEFT} />
          </g>
        </mask>
      </defs>
      {/* The book, tilted back a little to the left. */}
      <g mask={`url(#${id})`}>
        <g transform="rotate(-28 50 48)">
          <path d={COVER} />
          <path d={EDGE} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </g>
      </g>
      <g className="watch-mark-pen">
        <path d={RIGHT} style={{ fill: PAPER }} />
        {/* The vein: a light rim drawn under the left half, so only its outer half shows. */}
        <path d={LEFT} style={{ stroke: PAPER }} strokeWidth="2.5" strokeLinejoin="round" paintOrder="stroke" />
      </g>
    </svg>
  );
}
