// LitterBox's logo: a box, seen from above at a corner like the Sandbox mark's cube, with a
// cat inside. Its two front faces meet at the near corner, and its lid is two flaps, each
// hinged on a front edge of the top. It is cardboard: each face a different kraft brown
// (the inside darkest, the flaps catching the light), with thin seams of the background
// between them. The cat takes the colour of the text around it; her eyes and mouth are the
// background's, and her angry mark is red.
//
// Its lid is two flaps, like the welcome page's box: a front one hinged on the top's front
// left edge and a back one on its back right edge, meeting along a seam across the middle
// of the top when closed. They are drawn in three dimensions and seen at the box's own
// angle, so as `lid` (the front flap's angle, in degrees) changes they really swing about
// their hinges: at 0 they lie closed over the top; past 90 they stand up; at 200 the front
// one hangs open, out and down over the front, while the back one, opening less far,
// stands up and back behind. NavLogo eases `lid` between closed (at rest), lifted a little
// (as the cat peeks) and open (once she is out).
//
// Pointed at, or when a surrounding `group` is, the cat peeks out of the box: just her ears
// and the top of her head come up over the rim, with a slight spring. Clicked (the group
// marked data-peek; see NavLogo), her whole head comes up, eyes and all; clicked again
// (data-angry), an angry mark pops up by her head and throbs. It all goes back when let go
// (.logo-mark-cat and .logo-mark-angry in globals.css). She is drawn between the flaps,
// behind the back one and under the front one, so while she only peeks the lid is still
// over her, and only above the box's rim, so she disappears into the box; `id` names the
// clip path that keeps her there, and must be unique on the page.

// The inside, seen through the opening.
const INSIDE = "18,44 50,30 82,44 50,58";
// The front faces, left and right.
const FACES = ["18,44 50,58 50,94 18,80", "50,58 82,44 82,80 50,94"];
// The box in three dimensions: a point on its top is (u, v), u running from the front
// corner towards the right one and v towards the left one, both 0 to 1, and w is the height
// above the top, 1 being the box's own height. Seen at the box's angle, (u, v, w) falls at
// this point of the drawing.
const at = (u: number, v: number, w: number) => [50 + 32 * u - 32 * v, 58 - 14 * u - 14 * v - 36 * w];

// A flap: hinged on an edge of the top (from one corner to another), reaching
// half-way across it, inwards along `inward`, when closed.
type Flap = { hinge: [[number, number], [number, number]]; inward: [number, number]; fill: string };
const FLAP_DEPTH = 0.5;

// A flap's corners in the drawing at an angle (degrees) about its hinge: 0 lying closed
// over the top, 90 standing up, more than 90 folded out past the box's edge.
function flapCorners({ hinge: [a, b], inward: [du, dv] }: Flap, degrees: number) {
  const r = (degrees * Math.PI) / 180;
  const across = FLAP_DEPTH * Math.cos(r);
  const up = FLAP_DEPTH * Math.sin(r);
  return [
    at(a[0], a[1], 0),
    at(b[0], b[1], 0),
    at(b[0] + du * across, b[1] + dv * across, up),
    at(a[0] + du * across, a[1] + dv * across, up),
  ];
}

function flapPath(flap: Flap, degrees: number) {
  return `M${flapCorners(flap, degrees)
    .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")}Z`;
}

// Whether the flap, at this angle, shows its underside rather than the side that faces up
// when it is closed: once it has swung past side-on, its corners run round the other way.
function showsUnderside(flap: Flap, degrees: number) {
  const area = (corners: number[][]) =>
    corners.reduce((sum, [x, y], i) => {
      const [nx, ny] = corners[(i + 1) % corners.length];
      return sum + x * ny - nx * y;
    }, 0);
  return Math.sign(area(flapCorners(flap, degrees))) !== Math.sign(area(flapCorners(flap, 0)));
}

// The back flap opens nearly as far as the front one, folding out behind the box until it
// lies just above flat, its underside turned to us so it stands out against the box: its
// angle for the front flap's one, the same while the lid only lifts.
const backAngle = (front: number) => (front <= 40 ? front : 40 + ((front - 40) * (168 - 40)) / (200 - 40));

// Where the cat shows: anywhere above the box's rim (its top's front edges), across the
// box's width.
const ABOVE_RIM = "18,0 82,0 82,44 50,58 18,44";

// The cat's head, as it is when all the way out: a boxy head, a square with softly rounded
// lower corners, with a pointed ear standing on each top corner. It is fluffy: two small
// tufts of fur stick out from each cheek, beside the eyes, a little fluff rises between the
// ears, and every corner, ear tips included, is softened (drawn with a rounded edge of its
// own colour).
const HEAD =
  "M35 26 37 12 47 26Q48 24.3 49 26 50 24 51 26 52 24.3 53 26L63 12 65 26V33L67.6 35.2 65 36.8 67 39.4 65 40.6V47Q65 52 60 52H40Q35 52 35 47V40.6L33 39.4 35 36.8 32.4 35.2 35 33Z";
// The inside of each ear, a lighter shade of her fur.
const INNER_EARS = "M38.4 17.5 43.6 24.5H37.6ZM61.6 17.5 56.4 24.5H62.4Z";

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

// The colour of whatever the mark sits on (see the Watch List's mark), for the seams.
const PAPER = "var(--mark-paper, white)";

// The cardboard's browns, darkest to lightest: the inside, the left face (in shadow), the
// right face, and the two flaps (the back one a touch darker than the front), then the back
// flap's underside, plainer and in shade.
const CARDBOARD = {
  inside: "oklch(0.47 0.07 60)",
  left: "oklch(0.62 0.10 62)",
  right: "oklch(0.72 0.09 66)",
  backFlap: "oklch(0.76 0.08 70)",
  frontFlap: "oklch(0.82 0.07 72)",
  backFlapUnderside: "oklch(0.64 0.06 64)",
};

// The two flaps: each hinge's corners, then the way in. The front one is hinged on the
// top's front left edge, the back one on its back right edge.
const FRONT_FLAP: Flap = { hinge: [[0, 0], [0, 1]], inward: [1, 0], fill: CARDBOARD.frontFlap };
const BACK_FLAP: Flap = { hinge: [[1, 0], [1, 1]], inward: [-1, 0], fill: CARDBOARD.backFlap };

export default function LogoMark({
  id,
  lid = 0,
  className = "",
}: {
  id: string;
  lid?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="3.2 15.2 93.6 93.6"
      className={`logo-mark shrink-0 overflow-visible fill-current ${className}`}
      strokeLinejoin="round"
    >
      <defs>
        <clipPath id={id}>
          <polygon points={ABOVE_RIM} />
        </clipPath>
      </defs>
      {/* The seams: each face is edged in the background colour. */}
      <g style={{ stroke: PAPER }} strokeWidth="3">
        <polygon points={INSIDE} style={{ fill: CARDBOARD.inside }} />
      </g>
      <g style={{ stroke: PAPER }} strokeWidth="3">
        {/* The back flap, then the front faces, so as it folds down behind the box the faces
            stand in front of it; both are behind the cat. */}
        <path
          d={flapPath(BACK_FLAP, backAngle(lid))}
          style={{
            fill: showsUnderside(BACK_FLAP, backAngle(lid)) ? CARDBOARD.backFlapUnderside : BACK_FLAP.fill,
          }}
        />
        <polygon points={FACES[0]} style={{ fill: CARDBOARD.left }} />
        <polygon points={FACES[1]} style={{ fill: CARDBOARD.right }} />
      </g>
      {/* The cat, between the flaps and only above the box's rim, so she disappears into it. */}
      <g clipPath={`url(#${id})`}>
        <g className="logo-mark-cat">
          {/* A thin rim of the background around her head, keeping it clear of the box. */}
          <path d={HEAD} style={{ stroke: PAPER }} strokeWidth="5.5" strokeLinejoin="round" />
          {/* Her head, its edge rounded off in its own colour, so it looks soft. */}
          <path d={HEAD} className="stroke-current" strokeWidth="2" strokeLinejoin="round" />
          <path d={INNER_EARS} style={{ fill: `color-mix(in srgb, currentColor 55%, ${PAPER})` }} />
          {/* Her eyes. */}
          <circle cx="43" cy="39" r="2.8" style={{ fill: PAPER }} />
          <circle cx="57" cy="39" r="2.8" style={{ fill: PAPER }} />
          {/* Her mouth: a small "^" between and just below her eyes. */}
          <path
            d="M48.2 46.2 50 44.4 51.8 46.2"
            fill="none"
            style={{ stroke: PAPER }}
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      {/* The front flap, over the cat: closed or lifted, the lid is still on top of her; open,
          it hangs down over the front, below her. */}
      <path
        d={flapPath(FRONT_FLAP, lid)}
        style={{ fill: FRONT_FLAP.fill, stroke: PAPER }}
        strokeWidth="3"
      />
      {/* The angry mark, in red, seen only once she is cross. */}
      <path
        d={ANGRY}
        className="logo-mark-angry fill-none stroke-red-600"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
