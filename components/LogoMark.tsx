// LitterBox's logo: an open box, seen from above at a corner like the Sandbox mark's
// cube, with a cat inside. Its two front faces meet at the near corner; through the opening
// above them shows the shaded inside, and its two front flaps are folded open, out and down
// over the faces, leaving a notch at the near corner. The faces are shaded differently, in
// mixes of the text colour with the background, with thin seams of the background between
// them. It takes the colour of the text around it.
//
// Pointed at, or when a surrounding `group` is, the cat peeks out of the box: just its ears
// and the top of its head come up over the rim, with a slight spring. Clicked (the group
// marked data-peek; see NavLogo), its whole head comes up, eyes and all; clicked again
// (data-angry), an angry mark pops up by her head and throbs. It all goes back when let
// go (.logo-mark-cat and .logo-mark-angry in globals.css). Hidden, it sits behind the front of the box. `id` names the clip path that
// keeps it there; it must be unique on the page.

// The inside, seen through the opening.
const INSIDE = "18,44 50,30 82,44 50,58";
// The front faces, left and right.
const FACES = ["18,44 50,58 50,94 18,80", "50,58 82,44 82,80 50,94"];
// The front flaps, each hinged on a front edge of the opening and folded out and down.
const FLAPS = ["18,44 50,58 38,68 6,54", "50,58 82,44 94,54 62,68"];

// The cat's head, as it is when all the way out: a boxy head, a square with softly rounded
// lower corners, with a pointed ear standing on each top corner.
const HEAD = "M35 26 37 12 47 26H53L63 12 65 26V47Q65 52 60 52H40Q35 52 35 47Z";

// The angry mark that appears by her head when she is clicked a second time, like the
// anger emoji: four short curved strokes set round a point, a quarter turn apart and a
// little tilted, each dipping in towards the point and flaring out at its ends. One stroke
// is drawn above the point (a curve from its start, dipping in, to its end), and the other
// three are it turned a quarter, a half and three quarters of the way round.
const ANGRY_AT = [79, 22] as const;
const ANGRY_STROKE = [
  [-2.7, -9.7],
  [1.4, -2.7],
  [7.2, -7.6],
] as const;
const ANGRY = [0, 90, 180, 270]
  .map((deg) => {
    const [c, s] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    const [p0, p1, p2] = ANGRY_STROKE.map(
      ([x, y]) => `${(ANGRY_AT[0] + x * c - y * s).toFixed(2)} ${(ANGRY_AT[1] + x * s + y * c).toFixed(2)}`,
    );
    return `M${p0}Q${p1} ${p2}`;
  })
  .join("");

// The colour of whatever the mark sits on (see the Watch List's mark), and the text colour
// mixed with it to a given strength, for the faces' shades.
const PAPER = "var(--mark-paper, white)";
const shade = (percent: number) => `color-mix(in srgb, currentColor ${percent}%, ${PAPER})`;

export default function LogoMark({ id, className = "" }: { id: string; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="3.2 15.2 93.6 93.6"
      className={`logo-mark shrink-0 overflow-visible fill-current ${className}`}
      strokeLinejoin="round"
    >
      <defs>
        <clipPath id={id}>
          <polygon points="18,0 82,0 82,80 50,94 18,80" />
        </clipPath>
      </defs>
      {/* The seams: each face is edged in the background colour. */}
      <g style={{ stroke: PAPER }} strokeWidth="3">
        <polygon points={INSIDE} style={{ fill: shade(35) }} />
      </g>
      {/* The cat, kept within the box and the space above it, so none of it shows below. */}
      <g clipPath={`url(#${id})`}>
        <g className="logo-mark-cat">
          <path d={HEAD} style={{ stroke: PAPER }} strokeWidth="4" paintOrder="stroke" />
          {/* Its eyes. */}
          <circle cx="43" cy="39" r="2.8" style={{ fill: PAPER }} />
          <circle cx="57" cy="39" r="2.8" style={{ fill: PAPER }} />
        </g>
      </g>
      <g style={{ stroke: PAPER }} strokeWidth="3">
        <polygon points={FACES[0]} />
        <polygon points={FACES[1]} style={{ fill: shade(70) }} />
        <polygon points={FLAPS[0]} style={{ fill: shade(55) }} />
        <polygon points={FLAPS[1]} style={{ fill: shade(85) }} />
      </g>
      {/* The angry mark, seen only once she is cross. */}
      <path
        d={ANGRY}
        className="logo-mark-angry fill-none stroke-current"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
