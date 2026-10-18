// The home page's mark: a chess rook built from plain shapes, like the account mark's
// pawn. Three square battlements on a rectangular band, a body that widens towards the
// bottom, and a rectangular base, overlapping into one silhouette. It takes the colour of
// the text around it.
//
// Pointed at, or when a surrounding `group` is, it tips over to the left a little on its
// base, as the pawn does (.home-mark in globals.css).
export default function HomeMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={`home-mark shrink-0 fill-current ${className}`}>
      {/* Battlements: three squares. */}
      <rect x="18" y="4" width="16" height="16" />
      <rect x="42" y="4" width="16" height="16" />
      <rect x="66" y="4" width="16" height="16" />
      {/* The band under them: a rectangle. */}
      <rect x="18" y="18" width="64" height="14" />
      {/* Body: widening towards the base. */}
      <polygon points="29,31 71,31 77,84 23,84" />
      {/* Base: a rectangle. */}
      <rect x="12" y="83" width="76" height="15" />
    </svg>
  );
}
