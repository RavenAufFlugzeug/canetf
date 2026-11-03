// The Strategies page's mark: a white knight in front of a black king, as a pair of
// chess pieces drawn together. The knight, on the left, a little bigger than the account's pawn
// (on the same baseline, its ears rising a touch above the pawn's top), is drawn in rounded
// lines and filled white, facing left, away from the king: two pointed ears, the face sloping
// down to the nose and a rounded muzzle, the throat, the front of the neck curving down to a
// flared base, and the back of the neck sweeping down; along it, a mane drawn as a band ending
// in a notch. Inside it, its eye and a curve for its cheek. The king, behind it on the right, is
// built from plain shapes in the pawn's angular style, a little broader than the pawn and much
// taller, rising past the top of the box (as Search's star and the Watch List's pen reach past
// theirs): a cross on top, a crown flaring out over a collar, a tapering body and a base,
// overlapping into one silhouette. A white edge round the knight keeps it apart from the king,
// so it reads as the nearer piece. The black takes the colour of the text around it.
//
// Its box is the pawn's, widened to the right for the king: 144 × 102 (so give it a width of
// about 1.4 times its height).
//
// Pointed at, or when a surrounding `group` is, the two pieces tip apart a little on their
// bases, the knight to the left and the king to the right, and spring upright again when let
// go, as the navbar's other marks move (.strategy-mark-knight and .strategy-mark-king in
// globals.css).

// The knight's outline, its mane's inner edge and its cheek, drawn facing right (the mark turns it to face left).
const KNIGHT =
  "M17.5 95.5L82.5 95.5L78.9 87.6L73.2 87.6L71.5 76.9L67.3 65.2L62.1 56.9L58 49.9L59.3 47.7L70.6 51.6L74.4 51L80.2 44.8L79.9 42.6L71.5 32.3L65.6 16.2L63.6 4.5L56.8 10.3L52.7 13L49.8 17.3L40.3 20.6L30.5 27.1L24 36.6L21.8 48.4L23.5 63L30.2 70L36.3 65.7L24.5 87.6L22.3 87.6Z";
const MANE = "M36.3 65.7L33.3 51.4L34 38.1L40.3 28.6L52.9 21.3L56.8 10.3";
const CHEEK = "M46.8 38.4Q48.1 46.2 58.2 45.7";

export default function StrategyMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="-1 -1 144 102"
      className={`strategy-mark shrink-0 overflow-visible ${className}`}
    >
      {/* The king: cross, crown, collar, body and base. */}
      <g className="strategy-mark-king fill-current">
        <path d="M95 -40h10v24h-10ZM87 -34h26v9h-26Z" />
        <polygon points="74,-18 126,-18 117,10 83,10" />
        <rect x="78" y="8" width="44" height="12" />
        <polygon points="88,18 112,18 128,84 72,84" />
        <rect x="58" y="82" width="84" height="16" />
      </g>
      {/* The knight, in front (a tenth bigger than the pawn, turned to face left): its white edge,
          itself, its mane, its cheek and its eye. */}
      <g transform="translate(50 95.5) scale(-1.1 1.1) translate(-50 -95.5)">
        <g className="strategy-mark-knight" strokeLinejoin="round" strokeLinecap="round" fill="none">
          <path d={KNIGHT} fill="white" stroke="white" strokeWidth="13" />
          <path d={KNIGHT} fill="white" stroke="currentColor" strokeWidth="5" />
          <path d={MANE} stroke="currentColor" strokeWidth="5" />
          <path d={CHEEK} stroke="currentColor" strokeWidth="4" />
          <circle cx="58.0" cy="34.5" r="3.2" className="fill-current" />
        </g>
      </g>
    </svg>
  );
}
