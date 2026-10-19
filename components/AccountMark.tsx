// The signed-in user's mark: a chess pawn built from plain shapes in the Sandbox mark's
// angular style. A diamond head sits into a rectangular collar; under it a triangle body
// (its tip hidden behind the collar, so it comes out wide) stands on a rectangular base.
// The parts overlap into one silhouette. It takes the colour of the text around it.
//
// Pointed at, or when a surrounding `group` is, it tips over to the left a little on its
// base, like a nudged chess piece, with the Sandbox mark's slight spring (.account-mark in
// globals.css).
const PAWN = (
  <>
    {/* Head: a diamond. */}
    <polygon points="50,2 71,23 50,44 29,23" />
    {/* Collar: a rectangle. */}
    <rect x="30" y="38" width="40" height="9" />
    {/* Body: a triangle. */}
    <polygon points="50,20 80,88 20,88" />
    {/* Base: a rectangle. */}
    <rect x="12" y="86" width="76" height="12" />
  </>
);

export default function AccountMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="-1 -1 102 102" className={`account-mark shrink-0 fill-current ${className}`}>
      {PAWN}
    </svg>
  );
}
