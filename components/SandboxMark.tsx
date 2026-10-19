// The Sandbox page's mark: a cube, seen from above at a corner, drawn as a soft outline
// with rounded corners. On its top face lies a 2 × 2 chessboard, seen in the same
// perspective: its two dark squares (the far one and the near one) are drawn, and the two
// light ones show whatever is behind. Used as the page's link in the navbar. It takes the
// colour of the text around it.
//
// Pointed at, or when a surrounding `group` is, the cube rolls over a little, tilting
// with a slight spring, and rolls back when let go (.sandbox-mark in globals.css).

// The cube's outline, from its top corner round clockwise, and the three edges meeting at
// its near corner in the middle.
const OUTLINE = "M50 6 88 28 88 72 50 94 12 72 12 28Z";
const EDGES = "M12 28 50 50 88 28M50 50V94";

// The board's dark squares on the top face, the far one and then the near one, each kept
// clear of the edges around it.
const DARK = ["50,12.6 62.2,19.6 50,26.7 37.8,19.6", "50,29.3 62.2,36.4 50,43.4 37.8,36.4"];

export default function SandboxMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="-0.5 -0.5 101 101"
      className={`sandbox-mark shrink-0 fill-none stroke-current ${className}`}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d={OUTLINE} strokeWidth="7" />
      <path d={EDGES} strokeWidth="7" />
      {DARK.map((points) => (
        <polygon key={points} points={points} strokeWidth="2" className="fill-current" />
      ))}
    </svg>
  );
}
