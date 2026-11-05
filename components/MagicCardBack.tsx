import { useId } from "react";
import LogoMark from "@/components/LogoMark";
import { LEFT as PEN_LEFT, RIGHT as PEN_RIGHT } from "@/components/WatchMark";

// The "Magic" deck back: a white border, then a near-black band round a night sky in the deck's
// colour (dark at the top, a little lighter low down) scattered with stars, a few of them
// twinkling; a white sparkle in two corners and, near the top right one, the Sandbox's moon for
// a day gone by, filled in. In the middle, the cat's head as on the Classic back (the logo's,
// the same size, without her box), an open book standing in front of her, its blank covers
// towards us (brown, the right a little lighter, outlined in white, round a rounded spine) and its pages curving up behind them in gold. Beside it floats the Watch List mark's feather pen, slowly: its solid half white,
// its barbed half a slightly darker white, a dark vein between them.
//
// On a deck (.deck-pile), she is surprised when it is pointed at and happy once it is clicked,
// as on Classic (.logo-mark-out). Her book hides all of her face but her eyes; pointed at, she
// lifts her head a little out of it, so her mouth shows (.magic-cat), and she and her book
// float gently up and down together (.magic-float), the book opening and closing a little as
// it does (.magic-half); the moon swings up, then rocks and glows as its
// stars twinkle, and so do the sky's; and the book's pages turn, one after another. Clicked
// (data-happy, until the pointer leaves), the book glows and sparkles rise out of its pages
// (.magic-* in globals.css). The sky
// is drawn in its own units: 100 wide, 130 tall, about a px each on the account page's cards;
// the book and quill in px from the card's middle.
const BAND = "#111214";
const MOON = "oklch(0.93 0.1 95)";
// The moon's spots, a little darker than it: [x, y, radius] in its drawing (20 square).
const MOON_SPOT = "oklch(0.84 0.1 88)";
const MOON_SPOTS: [number, number, number][] = [
  [6.4, 11.6, 1.3], [9.6, 15.2, 0.95], [5.4, 7.9, 0.7], [12.6, 14, 0.6],
];
const PAGE = "white";
// The book's covers, brown, outlined in white: the left one dark brown, the right one a little
// lighter (catching the light), and the spine darkest.
const COVER_SHADES = ["oklch(0.38 0.06 50)", "oklch(0.46 0.07 55)", "oklch(0.3 0.05 45)"];

// The book, standing open towards us, its spine at x 0 (in px from the card's middle): its two
// covers, each a slanted panel meeting the spine (its top levelling out near it), the spine rounded at the bottom, and the pages
// behind, white, outlined in thin black: a band along each cover's top, thick at its outer end
// and tapering into it a little way from the spine (so across her face the book's top is the
// covers' level edge, between her eyes and her mouth). The spine is a little wider.
const COVERS = ["M-25.5 8C-15 9.4-9 13.2-4.4 13.4V35.4L-25.5 30Z", "M25.5 8C15 9.4 9 13.2 4.4 13.4V35.4L25.5 30Z"];
const SPINE = "M-4.4 13.4H4.4V33.4A4.4 4.4 0 0 1-4.4 33.4Z";
const PAGES_LEFT = "M-25.5 8-23.4 2C-17 2.4-12.4 9.4-9 13.2Z";
const PAGES_RIGHT = "M25.5 8 23.4 2C17 2.4 12.4 9.4 9 13.2Z";
// A page turning: the right pages' top, swung over to the left about the spine (fading out as
// it passes over her face).
const TURNING = "M9 13.2C12.4 9.4 17 2.4 23.4 2";

// The Watch List's pen, scaled down, its nib by the right page's top corner: where its nib is,
// and its size. (Its nib is at (40, 80) in its own drawing.)
const PEN = { x: 23, y: -3, scale: 0.32 };
const PEN_SHADE = "oklch(0.86 0.01 260)";
// The sparkles that rise out of the book while she is happy: [x, y, size].
const RISING: [number, number, number][] = [
  [-16, -4, 2.6], [15, -5, 2.2], [21, -3, 2],
];

// A four-point sparkle, 1 unit from its middle to each point.
const SPARKLE = "M0-1C.12-.25.25-.12 1 0 .25.12.12.25 0 1-.12.25-.25.12-1 0-.25-.12-.12-.25 0-1Z";

// The sky's stars, [x, y, radius], and those that twinkle, [x, y, size]: all kept clear of the
// corners' sparkles (top left, bottom right), the moon (top right) and the cat (the middle).
const STARS: [number, number, number][] = [
  [36, 12, 0.6], [55, 21, 0.5], [12, 40, 0.6], [24, 58, 0.5], [95, 52, 0.6], [95, 80, 0.5],
  [8, 86, 0.6], [20, 110, 0.5], [42, 120, 0.6], [60, 113, 0.5], [86, 98, 0.5], [57, 7, 0.5],
];
const TWINKLES: [number, number, number][] = [
  [44, 32, 2.4], [10, 70, 2.4], [12, 98, 2.4], [30, 122, 2.2], [64, 124, 2],
];

export default function MagicCardBack({ color }: { color: string }) {
  const id = `magic-${useId().replace(/:/g, "")}`;
  // The sky, in the deck's colour: deep at the top, a little lighter towards the bottom.
  const sky = (share: number) => `color-mix(in oklch, ${color} ${share}%, #0a0d1f)`;
  return (
    <span className="absolute inset-0 rounded-xl bg-white p-[5px] shadow-md ring-1 ring-black/15">
      <span className="relative block size-full">
        <span aria-hidden className="absolute inset-[3px] overflow-hidden rounded-[6px]">
          <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice" className="block size-full">
            <defs>
              <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: sky(30), transition: "stop-color 500ms ease" }} />
                <stop offset="1" style={{ stopColor: sky(62), transition: "stop-color 500ms ease" }} />
              </linearGradient>
            </defs>
            <rect width="100" height="130" fill={`url(#${id}-sky)`} />
            {STARS.map(([x, y, r]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="white" opacity="0.85" />
            ))}
            {TWINKLES.map(([x, y, size], i) => (
              <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${size})`}>
                <path
                  d={SPARKLE}
                  fill="white"
                  className="magic-twinkle"
                  style={{ animationDelay: `${-i * 0.35}s` }}
                />
              </g>
            ))}
          </svg>
        </span>
        <span aria-hidden className="absolute inset-0 rounded-lg border-[4px] border-[#111214]" />

        {/* The cat's head, as on Classic (the logo's, the same size), moved down so that without
            her box she sits in the middle. */}
        <span className="magic-float absolute inset-0 grid place-items-center">
          <LogoMark
            id={`${id}-cat`}
            headOnly
            className="magic-cat logo-mark-out size-[60px] translate-y-[14px] text-white"
            style={{ ["--mark-paper" as string]: BAND }}
          />
        </span>

        {/* The book in front of her and the quill floating beside it, in px from the card's
            middle. */}
        <span className="magic-float pointer-events-none absolute inset-0 grid place-items-center">
          <svg aria-hidden viewBox="-45 -32 90 64" className="h-16 w-[90px] overflow-visible" strokeLinejoin="round">
            {/* The sparkles rising out of its pages, either side of her, while she is happy. */}
            {RISING.map(([x, y, size], i) => (
              <g key={x} transform={`translate(${x} ${y}) scale(${size})`}>
                <path
                  d={SPARKLE}
                  fill={MOON}
                  className="magic-rising"
                  style={{ animationDelay: `${i * 0.35}s` }}
                />
              </g>
            ))}
            {/* The book, glowing while she is happy. */}
            {/* (Set high, so its top hides all of her face but her eyes; her resting mouth is hidden
                too, .magic-cat in globals.css.) */}
            <g className="magic-book" transform="translate(0 -6)" strokeLinejoin="round" strokeLinecap="round">
              {/* Each half (its pages and cover) opens and closes a little as the book floats,
                  narrowing and widening from its edge at the spine (.magic-half). */}
              {[0, 1].map((side) => (
                <g key={side} className={`magic-half magic-half-${side ? "right" : "left"}`}>
                  <path d={side ? PAGES_RIGHT : PAGES_LEFT} fill={PAGE} stroke={BAND} strokeWidth="0.8" />
                  {/* Pages turning from right to left, one after the other, while pointed at. */}
                  {side === 1 &&
                    [0, 1].map((n) => (
                      <path
                        key={n}
                        d={TURNING}
                        fill="none"
                        stroke={BAND}
                        strokeWidth="0.8"
                        className="magic-page"
                        style={{ animationDelay: `${n * 0.9}s` }}
                      />
                    ))}
                  <path d={COVERS[side]} fill={COVER_SHADES[side]} stroke="white" strokeWidth="1.6" />
                </g>
              ))}
              <path d={SPINE} fill={COVER_SHADES[2]} stroke="white" strokeWidth="1.6" />
            </g>
            {/* The pen, floating slowly beside the book. */}
            <g className="magic-quill">
              <g transform={`translate(${PEN.x - 40 * PEN.scale} ${PEN.y - 80 * PEN.scale}) scale(${PEN.scale})`}>
                <path d={PEN_RIGHT} fill={PEN_SHADE} />
                {/* The vein: a dark rim drawn under the solid half, so only its outer half shows. */}
                <path
                  d={PEN_LEFT}
                  fill="white"
                  stroke={`color-mix(in oklch, ${color} 40%, #0a0d1f)`}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  paintOrder="stroke"
                />
              </g>
            </g>
          </svg>
        </span>

        <Sparkle color="white" className="absolute left-[8px] top-[8px] size-4" />
        <Sparkle color="white" className="absolute bottom-[8px] right-[8px] size-4 rotate-180" />
        {/* The moon, a little in from its corner: the Sandbox's for a day gone by, filled in. */}
        <span className="magic-moon absolute right-[13px] top-[13px]">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="size-6 overflow-visible"
            stroke={MOON}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* The moon, with a few slightly darker round spots, like a cheese's holes. */}
            <g className="magic-moon-body">
              <path fill={MOON} d="M10 3.5a5 5 0 0 0 6.5 6.5 6.5 6.5 0 1 1-6.5-6.5Z" />
              <g fill={MOON_SPOT} stroke="none">
                {MOON_SPOTS.map(([x, y, r]) => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
                ))}
              </g>
            </g>
            <path className="magic-moon-star" fill="none" d="M15.5 2v2.4M14.3 3.2h2.4" strokeWidth="1.4" />
            <path
              className="magic-moon-star"
              fill="none"
              d="M18.2 6.4v1.6M17.4 7.2H19"
              strokeWidth="1.3"
              style={{ animationDelay: "400ms" }}
            />
          </svg>
        </span>
      </span>
    </span>
  );
}

// A four-point sparkle, where the Classic back has fish and Teegesellschaft clovers (and, on the
// card faces, the Magic back's suit), in the given colour.
export function Sparkle({ color, className }: { color: string; className: string }) {
  return (
    <svg aria-hidden viewBox="-1.05 -1.05 2.1 2.1" className={className}>
      <path d={SPARKLE} style={{ fill: color, transition: "fill 500ms ease" }} />
    </svg>
  );
}
