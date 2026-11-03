import { useId } from "react";
import { Fish } from "@/components/HoldingsDeck";
import { Flower, INNER_EARS, SURPRISE } from "@/components/LogoMark";

// The back of the Strategies page's cards (its decks), framed as the Sandbox's card backs are
// (a white border, a near-black band round a field in the deck's colour, and a white fish in two
// corners), with a cup of coffee on its saucer in the middle, drawn in white brush strokes: a
// thick rim round the coffee (a latte, with a heart poured on it in milk), the
// bowl's sides thickening to its foot, a handle curling back into it on the right, and a
// saucer swept round under it, thin at the back and thick at the front; round the bowl, a ring
// of black diamonds. The cup and saucer are a slightly darker white, the bowl hiding the saucer
// behind it. They are a little narrow and tall, centred on the card.
//
// Behind the cup sits the cat (the logo's head, in black, as big as on the Sandbox's decks),
// her head up over the rim, her paws on it and her tail curled round the saucer. Pointed at, she
// is surprised, as on the Sandbox's deck (three yellow strokes pop out by her ear and her mouth
// opens). Clicked (the deck marked data-happy until the pointer leaves), she is happy instead,
// as on the Sandbox's deck (her mouth a little "ω", two flowers turning by her ear): she tips the
// cup a little to the left and the saucer to the right, and her tail swishes (.strategy-cat-*,
// .strategy-tail, .strategy-cup and .strategy-saucer in globals.css).

// Her head: the logo's, but with more of her face showing here, fluffy lower down too, two more
// tufts sticking out from each cheek below the first, and her jaw's corners tucked in a little.
const HEAD =
  "M35 26 37 12 47 26Q48 24.3 49 26 50 24 51 26 52 24.3 53 26L63 12 65 26V33L67.6 35.2 65 36.8 67 39.4 65 40.6V42L67.6 43.8 65 45.4 66.6 47.6 64.4 48.6Q63 52 60 52H40Q37 52 35.6 48.6L33.4 47.6 35 45.4 32.4 43.8 35 42V40.6L33 39.4 35 36.8 32.4 35.2 35 33Z";
// Her tail: bushy and furry, its outline a few soft locks of fur along both edges,
// leaning towards its tip; already thick where it starts, it fills out well towards its end, a big
// rounded plume. It starts behind the cup, comes out on its left and curls round the front of the
// saucer to the right, its tip turning up by the handle. It is drawn over the cup in one
// piece, hidden where it is behind the cup's upper part.
const TAIL =
  "M116.2 246.9Q102.9 244.8 63.6 252.9Q68.3 253.5 66.1 255.8Q49.1 261.4 24.2 300.2Q27.6 297.0 28.2 300.4Q24.0 322.5 59.0 358.8Q56.5 354.4 59.6 354.4Q72.7 365.7 110.5 374.1Q106.4 370.6 109.1 369.5Q122.9 377.0 158.5 379.7Q154.0 376.4 156.4 374.9Q170.8 381.8 206.7 381.7Q202.0 378.4 204.3 376.6Q219.0 382.8 254.5 380.5Q249.6 377.2 251.8 375.1Q267.4 379.8 307.4 370.3Q302.1 368.1 304.2 365.1Q336.5 355.7 346.3 344.9Q342.5 341.6 340.0 330.7Q347.0 326.3 346.1 313.7Q338.9 313.3 328.5 309.1Q328.9 300.8 320.3 296.0Q308.4 302.0 284.0 317.1Q281.8 315.9 285.3 310.4Q258.4 317.7 246.6 325.8Q244.3 324.2 248.6 320.0Q215.3 323.3 202.4 330.9Q200.1 329.3 204.6 325.7Q171.5 326.8 158.3 332.9Q156.1 331.2 160.9 328.3Q127.5 326.6 114.0 331.2Q112.0 329.4 117.1 327.2Q87.5 321.6 75.0 322.5Q74.0 320.5 79.6 320.5Q65.3 311.3 60.4 306.1Q61.9 305.0 62.9 310.7Q73.5 292.3 79.7 283.1Q81.7 283.4 77.8 287.4Q105.6 281.4 119.8 277.1Z";
// Her left paw (on our right), holding on to the cup's edge where it curves away at the back on
// the right, in front of the corner of her chin: rounded on top, its three toes curling over
// the rim. Her right paw is it mirrored, on the left.
const PAW = "M271 182C271 154 331 154 331 182a10 8.5 0 0 1 -20 0a10 8.5 0 0 1 -20 0a10 8.5 0 0 1 -20 0Z";
// Her colour, the near-black; her outline, eyes and mouth white; inside her ears, grey.
const CAT = "#111214";
const CAT_INK = "white";

// The saucer: a ring thin at the back, thick at the front (the space between two ellipses).
const SAUCER =
  "M34 318a166 42 0 1 0 332 0a166 42 0 1 0 -332 0ZM44 312a156 32 0 1 0 312 0a156 32 0 1 0 -312 0Z";
// The bowl: its inside (to hide the saucer behind it), and its sides, thickening to its foot.
const INSIDE = "M66 196C68 276 120 322 200 324 280 322 332 276 334 196Z";
const SIDES =
  "M66 196C68 276 120 326 200 328 280 326 332 276 334 196L320 200C316 266 270 306 200 308 130 306 84 266 80 200Z";
const HANDLE = "M318 222Q362 200 366 228 368 254 330 282 310 296 286 300";
// The ring of black diamonds round the bowl, below its rim: along a curve dipping to the
// front, each narrowing as the bowl turns away towards its sides.
const DIAMONDS = Array.from({ length: 5 }, (_, i) => {
  const u = (i - 2) / 2.4; // about -0.83 to 0.83 across the bowl
  const x = 200 + u * 118;
  const y = 258 + 12 * (1 - u * u);
  const w = 22 * Math.sqrt(1 - u * u);
  const h = 25;
  return `M${x - w} ${y}L${x} ${y - h}L${x + w} ${y}L${x} ${y + h}Z`;
}).join("");
// The coffee, a latte: a caramel crema, deepening to brown at the rim.
const CREMA = "oklch(0.74 0.075 64)";
const CREMA_EDGE = "oklch(0.5 0.09 50)";
// The outline, white; and the cup and saucer, a slightly darker white.
const OUTLINE = "white";
const BODY = "oklch(0.92 0.006 250)";
// Poured on it, in milk, a heart with a smaller one above it (a tulip), and the line of the
// pour running down through them, all softened so the milk seems to melt into the crema.
const MILK = "oklch(0.97 0.015 85)";
const HEART =
  "M200 197.4C200 195.2 211 192.7 226.4 193.3C252.2 194.1 250.6 202.5 200 210.7C149.4 202.5 147.8 194.1 173.6 193.3C189 192.7 200 195.2 200 197.4Z";
const SMALL_HEART =
  "M200 187.3C200 186.2 205.3 185 212.7 185.3C225.1 185.7 224.3 189.8 200 193.7C175.7 189.8 174.9 185.7 187.3 185.3C194.7 185 200 186.2 200 187.3Z";

export default function StrategyCardBack({ color }: { color: string }) {
  const id = `coffee-${useId().replace(/:/g, "")}`;
  return (
    <span className="absolute inset-0 rounded-xl bg-white p-[5px] shadow-md ring-1 ring-black/15">
      <span
        className="relative block size-full rounded-lg border-[4px] transition-[background-color] duration-500 ease-[ease]"
        style={{ backgroundColor: color, borderColor: "#111214" }}
      >
        <span className="absolute inset-0 grid place-items-center">
          <svg aria-hidden viewBox="40 145 320 240" className="w-[47.2%] translate-y-[26%] overflow-visible">
            {/* Drawn wide, then narrowed and stretched up about its centre, so it stands taller. */}
            <g transform="translate(200 263) scale(0.86 1.12) translate(-200 -263)">
              <g className="strategy-saucer">
                <ellipse cx="200" cy="318" rx="166" ry="42" fill={BODY} />
                <path fillRule="evenodd" fill={OUTLINE} d={SAUCER} />
              </g>
              {/* The cat, behind the cup, her head up over its rim. */}
              <g>
                {/* (Scaled to the Sandbox cat's size, undoing the cup's narrowing so she isn't stretched.) */}
                <g transform="translate(-91 -62) scale(5.819 4.469)">
                  <path d={HEAD} stroke={CAT_INK} strokeWidth="2.6" strokeLinejoin="round" />
                  <path d={HEAD} fill={CAT} stroke={CAT} strokeWidth="1.2" strokeLinejoin="round" />
                  <path d={INNER_EARS} fill="oklch(0.45 0 0)" />
                  <circle cx="43" cy="39" r="2.8" fill={CAT_INK} />
                  <circle cx="57" cy="39" r="2.8" fill={CAT_INK} />
                  <path
                    d="M47.9 46.5 50 44.3 52.1 46.5"
                    className="strategy-cat-mouth"
                    fill="none"
                    stroke={CAT_INK}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M48.15 46.25H51.85L50 44.55Z"
                    className="strategy-cat-gasp"
                    fill={CAT_INK}
                    stroke={CAT_INK}
                    strokeWidth="2.1"
                    strokeLinejoin="round"
                  />
                  <g className="strategy-cat-surprise" fill="none" strokeLinecap="round">
                    <path d={SURPRISE} stroke="white" strokeWidth="4.6" />
                    <path d={SURPRISE} stroke="#facc15" strokeWidth="2.4" />
                  </g>
                  {/* Happy: a little "ω" for her mouth, and two flowers by her ear, as on the
                      Sandbox's deck. */}
                  <path
                    d="M46.8 45C47 47.9 49.7 48 50 45.6 50.3 48 53 47.9 53.2 45"
                    className="strategy-cat-smile"
                    fill="none"
                    stroke={CAT_INK}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <g className="strategy-cat-flowers">
                    <Flower x={68.5} y={9.5} size={1.75} spin="logo-mark-spin" />
                    <Flower x={77} y={20.5} size={1.1} spin="logo-mark-spin-back" />
                  </g>
                </g>
              </g>
              {/* The cup, in two parts with the tail between them; both tip together. */}
              <clipPath id={`${id}-bowl`}>
                <path d={INSIDE} />
              </clipPath>
              <g className="strategy-cup">
                <path d={HANDLE} fill="none" stroke={OUTLINE} strokeWidth="18" strokeLinecap="round" />
                <path d={INSIDE} fill={BODY} />
                <path d={DIAMONDS} fill="#111214" clipPath={`url(#${id}-bowl)`} />
                <path d={SIDES} fill={OUTLINE} />
                <ellipse cx="200" cy="196" rx="134" ry="30" fill={BODY} stroke={OUTLINE} strokeWidth="14" />
              </g>
              {/* Her tail, hidden behind the cup's upper part (the start of it), in front of its foot
                  (the rest, curling round it). */}
              <mask id={`${id}-tail`}>
                <rect x="0" y="0" width="400" height="400" fill="white" />
                <clipPath id={`${id}-upper`}>
                  <rect x="0" y="0" width="400" height="292" />
                </clipPath>
                <g clipPath={`url(#${id}-upper)`} fill="black">
                  <g className="strategy-cup">
                    <path d={INSIDE} />
                    <path d={SIDES} />
                  </g>
                </g>
              </mask>
              <g mask={`url(#${id}-tail)`}>
                <g className="strategy-tail">
                  <path d={TAIL} stroke={CAT_INK} strokeWidth="7" strokeLinejoin="round" />
                  <path d={TAIL} fill={CAT} stroke={CAT} strokeWidth="1.5" strokeLinejoin="round" />
                </g>
              </g>
              <defs>
                <radialGradient id={`${id}-coffee`}>
                  <stop offset="0.5" stopColor={CREMA} />
                  <stop offset="1" stopColor={CREMA_EDGE} />
                </radialGradient>
                <filter id={`${id}-soft`} x="-20%" y="-60%" width="140%" height="220%">
                  <feGaussianBlur stdDeviation="1.1" />
                </filter>
              </defs>
              <clipPath id={`${id}-latte`}>
                <ellipse cx="200" cy="199" rx="110" ry="19" />
              </clipPath>
              <g className="strategy-cup">
                <ellipse cx="200" cy="199" rx="110" ry="19" fill={`url(#${id}-coffee)`} />
                {/* The pour, turned on the coffee's surface (unflattened, turned, flattened again),
                  so the heart points off to one side rather than straight out. */}
                <g clipPath={`url(#${id}-latte)`}>
                  <g
                    filter={`url(#${id}-soft)`}
                    transform="translate(200 199) scale(1 0.2) rotate(-28) scale(1 5) translate(-200 -199)"
                  >
                    <path d={HEART} fill={MILK} />
                    <path d={SMALL_HEART} fill={MILK} />
                    <path d="M200 184V209" stroke={CREMA} strokeWidth="1.6" strokeLinecap="round" />
                  </g>
                </g>
                {/* Her paws, holding on to the cup's edge at the back on either side (her right one
                  the left one mirrored). */}
                {["", "translate(400 0) scale(-1 1)"].map((flip) => (
                  <g key={flip || "left"} transform={flip || undefined}>
                    <path d={PAW} stroke={CAT_INK} strokeWidth="7" strokeLinejoin="round" />
                    <path d={PAW} fill={CAT} stroke={CAT} strokeWidth="1.5" strokeLinejoin="round" />
                  </g>
                ))}
              </g>
            </g>
          </svg>
        </span>
        {/* A fish in two corners, as on the Sandbox's card backs (the bottom one upside down). */}
        <Fish color="white" className="absolute left-1 top-1.5 h-3 w-[18px]" />
        <Fish color="white" className="absolute bottom-1.5 right-1 h-3 w-[18px] rotate-180" />
      </span>
    </span>
  );
}
