// The Watch List's mark: a book with a feather pen, in the navbar's sharp-edged style.
// Closed, the book shows its cover, with a thin line marking the spine on the left; at its
// right stands the pen, leaning in across it: a big, wide feather narrowing into a fine
// quill that ends in a sharp nib on the book. A thin gap is cut around the pen (an SVG
// mask) so it stays clear against the book. It takes the colour of the text around it.
//
// It stands straight at rest. Pointed at, or when a surrounding `group` is, the mark tilts
// a little and the book opens (globals.css, .watch-mark-*): the cover folds away to its
// spine on the left while the two pages, white inside a dark outline, spread out from the
// middle, and the pen dips towards the page as if to write. All of it reverses when let
// go. `id` names the mask; it must be unique on the page.

// The pen, from its tip: the feather widens, then narrows into the quill, down to the nib.
const PEN = "99,2 96.2,33.5 73.4,51.7 52,86 70,49.7 73.6,20.9";

export default function WatchMark({ id, className = "" }: { id: string; className?: string }) {
  return (
    // The drawing is framed on the book alone (open or closed), so the book lines up with
    // the navbar's other icons; the pen reaches out past the frame's top.
    <svg aria-hidden viewBox="-2 12 92 90" className={`watch-mark shrink-0 overflow-visible fill-current ${className}`}>
      <defs>
        {/* The gap around the pen, cut out of the book. */}
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="white" />
          <polygon
            points={PEN}
            className="watch-mark-pen"
            fill="black"
            stroke="black"
            strokeWidth="7"
            strokeLinejoin="miter"
          />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        {/* Closed: the cover, with the spine's line cut through it near the left edge. */}
        <path className="watch-mark-cover" fillRule="evenodd" d="M4 16h66v82H4Zm7 0h3v82h-3Z" />
        {/* Open: two white pages in a dark outline, either side of the middle, which sits
            lower than their outer edges, so the book opens up into a shallow V. */}
        <g fill="white" stroke="currentColor" strokeWidth="5" strokeLinejoin="miter">
          <polygon className="watch-mark-page" points="2.5,19 43,25 43,98 2.5,93" />
          <polygon className="watch-mark-page watch-mark-page-right" points="47,25 87.5,19 87.5,93 47,98" />
        </g>
      </g>
      <polygon points={PEN} className="watch-mark-pen" />
    </svg>
  );
}
