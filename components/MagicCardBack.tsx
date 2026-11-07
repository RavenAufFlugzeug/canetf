import { useId, useState, type MouseEvent } from "react";
import LogoMark from "@/components/LogoMark";
import { LEFT as PEN_LEFT } from "@/components/WatchMark";
import { paletteColor, type PaletteName } from "@/components/EtfBreakdown";

// The "Magic" deck back: a white border, then a near-black band round a night sky, always a deep
// red whatever the deck's colour (dark at the top, a little lighter low down), scattered with
// stars, a few of them twinkling; a white sparkle in two corners and, near the top right one, the Sandbox's moon for
// a day gone by, filled in. In the middle, the cat's head as on the Classic back (the logo's,
// the same size, without her box), an open book standing in front of her, its blank covers
// towards us (dark shades of the deck's colour, the right a little lighter, outlined in white,
// round a spine rounded at both ends) and its cream pages curving up behind them. Beside it, the
// Watch List mark's feather pen: its solid half white, its barbed half a darker shade of the deck's
// colour outlined in white, a dark vein between them.
//
// On a deck (.deck-pile), she is surprised when it is pointed at and happy once it is clicked,
// as on Classic (.logo-mark-out). All the time, she and her book float gently up and down
// together (.magic-float), the book opening and closing a little as it does (.magic-half) and
// its pages turning one after another; the pen, hat, bird, flowers and fish move, the moon
// rocks and the stars twinkle. Her book hides all of her face but her eyes; pointed at, she
// lifts her head a little out of it, so her mouth shows (.magic-cat), the book glows and the
// moon swings up again. Clicked (data-happy, until the pointer leaves), sparkles rise out of
// its pages (.magic-* in globals.css). The sky is drawn in its own units: 100 wide, 130 tall,
// about a px each on the account page's cards;
// the book and quill in px from the card's middle.
const BAND = "#111214";
const MOON = "oklch(0.93 0.1 95)";
// The moon's shape, a crescent (in its own drawing, 20 square).
const MOON_SHAPE = "M10 3.5a5 5 0 0 0 6.5 6.5 6.5 6.5 0 1 1-6.5-6.5Z";
// Where the moon on the right cover sits (in the middle of the cover), slanted as the open cover
// is, and turned to face left (mirrored); its crescent's middle is about 9.5, 10.5 in its own
// drawing.
// On the left cover, its picture: a sun, as the right's moon is drawn (a filled disc and eight
// triangular rays round it, a little apart from it, their corners softened; in its own drawing,
// 20 square), a bright warm gold, slanted as that cover is.
const SUN_RAYS =
  "M11.70 3.50L10.00 0.40L8.30 3.50ZM15.80 6.61L16.79 3.21L13.39 4.20ZM16.50 11.70L19.60 10.00L16.50 8.30ZM13.39 15.80L16.79 16.79L15.80 13.39ZM8.30 16.50L10.00 19.60L11.70 16.50ZM4.20 13.39L3.21 16.79L6.61 15.80ZM3.50 8.30L0.40 10.00L3.50 11.70ZM6.61 4.20L3.21 3.21L4.20 6.61Z";
const SUN = "oklch(0.92 0.14 95)";
// The sky's sun (by day): lighter and brighter still.
const SKY_SUN = "oklch(0.96 0.12 100)";
// Its spots, as the moon's are but star-shaped (four-point sparkles), a little darker: where each
// is and its size, in its own drawing.
const SUN_SPOT = "oklch(0.82 0.15 82)";
const SUN_SPOTS: [number, number, number][] = [
  [8, 8.4, 1.5],
  [12.2, 11.2, 1.2],
  [8.6, 12.4, 0.9],
];
const COVER_SUN = "translate(-15 23.6) skewY(15) scale(0.66) translate(-10 -10)";
// The cover moon's spots: a darker, slightly brown white.
const COVER_MOON_SPOT = "oklch(0.84 0.03 70)";
const COVER_MOON = "translate(15.6 23.4) skewY(-15) scale(-0.85 0.85) translate(-9.5 -10.5)";
// The moon's spots, a little darker than it: [x, y, radius] in its drawing (20 square).
const MOON_SPOT = "oklch(0.84 0.1 88)";
const MOON_SPOTS: [number, number, number][] = [
  [6.4, 11.6, 1.3],
  [9.6, 15.2, 0.95],
  [5.4, 7.9, 0.7],
  [12.6, 14, 0.6],
];
// The pages: cream, so they stand out from the white outlines.
const PAGE = "oklch(0.95 0.035 85)";
// The book's covers, outlined in white, in dark shades of the deck's colour: how much of it, with
// black for the rest. The left one, the right one a little lighter (catching the light), and the
// spine darkest.
const COVER_SHARES = [42, 52, 34];
// The two white lines across the spine, in the book's drawing.
const SPINE_BANDS = "M-5.4 18.6Q0 21 5.4 18.6M-5.4 38.2Q0 40.6 5.4 38.2";

// The book, standing open towards us, its spine at x 0 (in px from the card's middle): its two
// covers, each a slanted panel meeting the spine (its top levelling out near it), the spine rounded at the bottom, and the pages
// behind, white, outlined in thin black: a band along each cover's top, thick at its outer end
// and tapering into it a little way from the spine (so across her face the book's top is the
// covers' level edge, between her eyes and her mouth). The spine is a little wider.
const COVERS = [
  "M-25.5 8C-15 9.4-9.4 13.2-5.4 13.4C-5.7 23-5.1 32-5.4 40.4C-10 39.6-17 36.4-25.5 35C-25.9 26-25.1 17-25.5 8Z",
  "M25.5 8C15 9.4 9.4 13.2 5.4 13.4C5.7 23 5.1 32 5.4 40.4C10 39.6 17 36.4 25.5 35C25.9 26 25.1 17 25.5 8Z",
];
// The spine: a wide panel between the covers, its top and bottom both curving down (as a rounded
// spine does, seen from the front), reaching a little below them. Its sides, and the covers' edges,
// bow a little, as drawn by hand, never ruler straight.
const SPINE =
  "M-5.4 13.4A5.4 1.8 0 0 0 5.4 13.4C5.7 23 5.1 33.6 5.4 41.6A5.4 2.6 0 0 1-5.4 41.6C-5.1 33.6-5.7 23-5.4 13.4Z";
// The pages: thickest at the outer end, rising to just under her eyes, then dipping steeply to
// meet the other side's in a small rounded dip at the middle of the spine's top, a thin seam between them (so they are
// two pages, not one). In the narrow dip, the bottom of her head and some of her mouth always
// show. Below, they run on down behind the spine and covers, so nothing shows between.
const PAGES_LEFT =
  "M-25.5 8-23.6 4.8C-16 4.8-9 6-5.5 8.2-3.4 9.8-2.8 13.4-.3 14.4V20H-7.4V13.2C-9 13.2-15 9.4-25.5 8Z";
const PAGES_RIGHT =
  "M25.5 8 23.6 4.8C16 4.8 9 6 5.5 8.2 3.4 9.8 2.8 13.4.3 14.4V20H7.4V13.2C9 13.2 15 9.4 25.5 8Z";
// A page turning, as it starts: lying on the right pages, from the spine's top (where the pages
// meet) along their top to the outer edge, then down that edge. Its fill closes back along the
// pages' foot; its outline doesn't (the fold at the spine is never drawn). While pointed at, it
// changes shape as it turns (.magic-page-fill and .magic-page-edge in globals.css, which hold
// its shape at each step: keep their first one the same as these).
const TURNING_FILL =
  "M0.30 14.40C2.80 13.40 3.40 9.80 5.50 8.20C9.00 6.00 16.00 4.80 23.60 4.80C24.23 5.87 24.87 6.93 25.50 8.00C15.00 9.40 9.40 13.20 5.40 13.40L0.30 14.40Z";
const TURNING_EDGE =
  "M0.30 14.40C2.80 13.40 3.40 9.80 5.50 8.20C9.00 6.00 16.00 4.80 23.60 4.80C24.23 5.87 24.87 6.93 25.50 8.00";

// The Watch List's pen, scaled down, its nib by the right page's top corner: where its nib is,
// and its size. (Its nib is at (40, 80) in its own drawing.)
// The pen's right half, here: shaped as its left half is (a smooth outer edge with one small notch
// in it, rather than the Watch List mark's ragged barbs), but slimmer and ending a little short of
// it: from the foot of its vein, up the vein to the tip, then down its outer edge. In the Watch
// List mark's own drawing.
const PEN_RIGHT_VANE =
  "M51.9 58.9Q66.1 27.6 88.1 2.3C89.6 10.4 87 18.6 82 25.6C78 31.2 74.4 35.6 71.4 40L68.6 39.6 69.6 43.4C67 47.6 62.4 52 57.6 54.6Z";
const PEN = { x: 16.5, y: 9, scale: 0.32 };
// The sparkles that rise out of the book while she is happy: [x, y, size].
const RISING: [number, number, number][] = [
  [-16, -4, 2.6],
  [15, -5, 2.2],
  [21, -3, 2],
];

// A four-point sparkle, 1 unit from its middle to each point.
const SPARKLE = "M0-1C.12-.25.25-.12 1 0 .25.12.12.25 0 1-.12.25-.25.12-1 0-.25-.12-.12-.25 0-1Z";

// The sky's stars, [x, y, radius], and those that twinkle, [x, y, size]: all kept clear of the
// corners' sparkles (top left, bottom right), the moon (top right), the cat (the middle) and the
// gold stars beside her book.
const STARS: [number, number, number][] = [
  [36, 12, 0.6],
  [55, 21, 0.5],
  [12, 40, 0.6],

  [95, 52, 0.6],

  [8, 86, 0.6],
  [20, 110, 0.5],
  [42, 120, 0.6],
  [60, 113, 0.5],
  [86, 98, 0.5],
  [57, 7, 0.5],
];
const TWINKLES: [number, number, number][] = [
  [44, 32, 2.4],

  [12, 98, 2.4],
  [30, 122, 2.2],
  [64, 124, 2],
];

// Its bookmarks, two in the left pages and one in the right: flat tabs growing out of the middle
// of the pages' edge (halfway between their top and the cover's) and standing up above them, in
// front of them, upright, their foot and square top sloping as the book's edges do on their side,
// as the open book lies. Teal, red and blue from left to
// right (whatever the deck's colour), outlined in white. In the book's drawing.
const BOOKMARKS: { side: 0 | 1; family: PaletteName; d: string }[] = [
  { side: 0, family: "teal", d: "M-20.3 0.95L-16.7 1.78L-16.7 8.24L-20.3 7.42Z" },
  { side: 0, family: "red", d: "M-14.2 4.11L-10.6 4.94L-10.6 9.65L-14.2 8.82Z" },
  { side: 1, family: "blue", d: "M11.7 3.73L15.3 2.91L15.3 8.57L11.7 9.39Z" },
];
// Its clasp, open, in gold outlined in white as the covers are: a strap's tab on each cover's
// outer edge, halfway up it, its sides upright along that edge and its top and bottom sloping as
// the open cover's do (the right one the left's mirrored). In the book's drawing.
const CLASP_TABS = ["M-28.4 17.6-23.6 18.9V25.3L-28.4 24Z", "M28.4 17.6 23.6 18.9V25.3L28.4 24Z"];
const GOLD = "oklch(0.8 0.15 75)";
// The book's glow, by night: tiny warm-gold motes of light rising round it while it glows, each
// drifting up and a little aside, twinkling, and fading away, over and over, out of step
// (.magic-mote): where each starts, its radius, how long after the others it sets off (s), and
// how far aside it drifts, in the book's drawing.
const MOTE = "oklch(0.93 0.14 95)";
// A fish floating in front of the book, low on its right, after the user's drawing, facing left:
// its mouth open, a line behind its head and a keyhole for an eye; a long fin along its back, one
// under its belly, one on its side and a crescent tail; pale blue, its head deeper, its fins
// deeper still, all outlined in black.
// (Each by day, then by night, a little darker.)
// (Changing slowly, easing in and out, as day and night change.)
const FISH_FADE = "fill 1.6s ease-in-out";
const FISH_SKIN = ["oklch(0.87 0.06 235)", "oklch(0.74 0.07 238)"];
const FISH_FIN = ["oklch(0.56 0.13 252)", "oklch(0.46 0.12 255)"];
// Its head, in front of the line behind it, a deeper blue (cut to its body), its eye white.
const FISH_HEAD_SKIN = ["oklch(0.66 0.11 245)", "oklch(0.55 0.11 248)"];
const FISH_HEAD = "M-13-20C-11.5-11-13-1-18.5 9H-44V-20Z";
// Its body and tail, one shape (so its outline runs on smoothly into its tail), after the user's
// drawing: narrowing to a slim waist, then a big crescent tail, its top lobe swept up and back,
// its bottom one down, a curved notch between them.
const FISH_BODY =
  "M-36-13.2C-32-16-27-18.2-22-18.3-19-18.5-16-18.5-13-18.4-3-16.5 10-10.5 23 0.5 28 1.5 35-2 41-3.8 46-5 50-4 51.5-3.2 46-1 41 3.5 40 8 40 12 41.5 17 43.3 20.2 41 20.4 36 17 31 11 29 9.4 27 8.8 25 8.7 20 9.4 14 11 5 11.2-4 11.2-12 10-18.5 8.2-25 7-32 3-39.5-4.3L-29.5-5.8Z";
// Its fins, drawn behind its body: a long slanted one along its back, a small one under its belly.
const FISH_FINS = [
  "M-9-17C-7-21.5-2-22.4 5-22 10-21.4 13.6-18.4 15-15.6 16.6-12.6 17-9.6 15.8-6.5Z",
  "M-12 9.4C-8 12.6-4 15.2-0.6 16.4 1.4 17 2.8 15.8 3 13.6 3.1 12.6 3 11.6 2.6 11Z",
];
// A fin on its side, inside its body behind its head: a triangle pointing down and back.
const FISH_SIDE_FIN = "M-7.7-5.4H4.8L-1 6-8.4-2Z";
const FISH_GILL = "M-13-18C-11.5-11-13-1-18.5 8";
const FISH_EYE =
  "M-22-15.6C-20.3-15.6-19-14.3-19-12.6-19-11.6-19.5-10.8-20.2-10.2L-19.6-8C-19.4-6.8-20.4-5.8-21.6-5.8-22.8-5.8-23.8-6.8-23.6-8L-23.4-10.4C-24.4-11-25-11.7-25-12.6-25-14.3-23.7-15.6-22-15.6Z";
// The motes rising off it while it glows: where each starts (in the fish's drawing), its radius,
// how long after the others it sets off (s), and how far aside it drifts.
const FISH_MOTES: [number, number, number, number, number][] = [
  [-30, -12, 2.6, 0, -5],
  [-14, -20, 2, 0.35, 3],
  [2, -18, 3, 0.7, -3],
  [18, -8, 2.2, 1.05, 5],
  [34, 0, 2.8, 1.4, 2],
  [10, 10, 2.2, 1.75, -4],
  [-20, 8, 2.6, 2.1, 4],
];
const MOTES: [number, number, number, number, number][] = [
  [-34, 22, 0.61, 0.0, -1.7],
  [-31, 6, 0.78, 0.23, -2.1],
  [-28, 32, 0.72, 0.46, -0.7],
  [-36, 14, 0.48, 0.69, 0.0],
  [33, 20, 0.47, 0.92, -0.3],
  [30, 6, 0.48, 1.15, -2.0],
  [35, 30, 0.66, 1.38, 1.6],
  [28, -2, 0.51, 1.61, -1.4],
  [-22, -4, 0.76, 1.84, 2.2],
  [22, -6, 0.74, 2.07, -0.5],
  [-14, 38, 0.94, 2.3, -2.3],
  [14, 40, 0.88, 0.13, -1.1],
  [-38, 26, 0.52, 0.36, -1.9],
  [37, 10, 0.6, 0.59, 1.6],
];

// The sky, at one of four times: two nights and two days. Clicking the moon on the book's right
// cover makes it night (or, at night, the other night); clicking the sun on its left cover makes
// it day (or, by day, the other day). Each sky is a gradient, top to bottom: [offset, colour].
// The nights are deep (a colour mixed mostly with the dark of night): red, as the account page's
// preview, and teal. The days: Teegesellschaft's pastel sky, blue fading to pink, and an early
// morning, lavender fading to a warm peach. By day the gold stars by the book fade (the sky's
// white ones stay, as on Teegesellschaft's), and the corner's moon gives way to a sun.
type SkyName = "night-red" | "night-teal" | "day" | "dawn";
const night = (hue: string): [number, string][] => [
  [0, `color-mix(in oklch, ${hue} 30%, #0a0d1f)`],
  [1, `color-mix(in oklch, ${hue} 62%, #0a0d1f)`],
];
const SKIES: Record<SkyName, [number, string][]> = {
  "night-red": night("oklch(0.58 0.19 25)"),
  "night-teal": night("oklch(0.6 0.12 190)"),
  day: [
    [0, "oklch(0.83 0.075 230)"],
    [0.55, "oklch(0.9 0.045 280)"],
    [1, "oklch(0.93 0.06 15)"],
  ],
  dawn: [
    [0, "oklch(0.76 0.07 285)"],
    [0.55, "oklch(0.87 0.06 340)"],
    [1, "oklch(0.93 0.07 65)"],
  ],
};
const isNight = (sky: SkyName) => sky.startsWith("night");
// (How long the sky takes to change.)
const SKY_FADE = "opacity 900ms ease";

// Her witch hat, drawn in her head's own units (her ears' tips at y 12, her head 35 to 65 wide),
// in an SVG laid exactly over the head's. Its brim: on the left, a thick rounded lobe, its outside
// (its top), over her left ear; on the right, a long rounded oval running out past the cone, its
// inside (darker), the brim tilting up there. Her right ear (on our right) stands up between the two, in front. The
// cone rises over the right of the hat, its tip curling over to the right,
// its right side coming down to the brim partway along it. Outlined in white;
// dark purple by night, lighter by day. On its band at the front, two pansies, a big one and a
// small one (PANSY_PETALS).
const HAT_CONE =
  "M38 16C40 9 45 3 49 1 53 -3 58 -8 62 -10 66 -11.4 70 -11.6 72.2 -10.9 76 -8 79 -2 80.8 4.7 78 0.2 75 -3.2 71 -5.4 69.8 -2 69.4 2 69.6 5.6 71 10 73.6 14.6 76.8 17.6L60 20Z";
const HAT_BRIM =
  "M14.5 12.4C22 10.2 31.4 9 40.6 9.4 47 9.8 53 12.4 58.9 15.4 57.4 17 56 18 54.8 19 50 21.6 45 23 41.6 23.6 34 25 28 26 24.2 25.9 19 25.8 15.4 23 14.8 19 14.4 16.4 14.3 14 14.5 12.4Z";
// The band round the cone: drawn wider than the cone, then cut to it (so it runs exactly from one
// side of the cone to the other).
const HAT_BAND = "M34 6.4C46 4.4 60 4.8 76 8.2L76 11.6C60 8.2 46 7.8 34 9.8Z";
// Its shading, minimal, lit from the upper right (where the sun and moon are): a soft shadow down
// the cone's left side and inside its curled tip.
// The brim's shading, the light coming from the upper right: a crescent round its far (left) end
// and along its underside, away from the light.
const HAT_BRIM_SHADE =
  "M41.6 23.6C34 25 28 26 24.2 25.9 19 25.8 15.4 23 14.8 19 14.4 16.4 14.3 14 14.5 12.4 17.4 12.6 19.4 14 20.4 16.6 21.6 19.8 25.4 22 30.4 22.9 34.4 23.6 38.4 23.8 41.6 23.6Z";
// A little long-tailed tit resting on the brim's left side, after the user's drawing (drawn about
// its feet, then placed): a soft, tall white body, sleepy eyes and a small beak turned a little to
// our left, a big wing sweeping out on our right, a flat tail out
// behind it along the brim and two little three-toed feet.
// Its colours, after a real one: white, with a near-black back, wing and tail (the wing and tail
// outlined thinly in white).
const BIRD_DARK = "oklch(0.27 0.01 285)";
const BIRD_BODY =
  "M-3.5-7.9C-3.5-9.6-2.5-10.9 0-11 2.2-11.1 3.3-10 3.3-8.1 3.5-5.9 5-3.6 6.1-2.4 6.4-1.4 5.5-0.8 4.8-0.5 3-0.1 0.8 0.1-0.8 0-2.5-0.4-3.9-1.4-4.1-3.4-4.2-4.6-3.5-5.4-3.5-7.9Z";
const BIRD_WING =
  "M3.5-7.4C3.1-5.9 3.8-4.4 5-3.4 6-2.9 7.5-3 8.5-3.6 7.5-4.4 6.8-5.4 6.3-6.1 5.5-6.9 4.5-7.1 3.5-7.4Z";
const BIRD_TAIL = "M6.1-1.5C7.3-1.4 8.5-1.5 9.3-1.5 9.3-0.8 8-0.3 6.5 0 5.8-0.1 5.1-0.4 4.8-0.5Z";
const BIRD_EYES = "M-2.55-7.2H-1.8M0-7.75 1.1-7.9";
const BIRD_BEAK = "M-1.1-6.9-0.4-7-0.6-6.25Z";
const BIRD_FEET =
  "M-0.1 0-0.25 0.65M-1 0.9-0.25 0.65-0.4 1.25M-0.25 0.65 0.3 0.75M4.9-0.4 4.8 0.4M4 0.5 4.8 0.4 4.6 0.9M4.8 0.4 5.3 0.6";
const HAT_CONE_SHADE =
  "M38 16C40 9 45 3 49 1 53 -3 58 -8 62 -10 58.4 -7 54 -2 51.4 2 48.4 6 46.6 11 46 16ZM71 -5.4C75 -3.2 78 0.2 80.8 4.7 79 -2 76 -8 72.2 -10.9 72.4 -9 71.8 -7 71 -5.4Z";
const HAT_BRIM_INSIDE =
  "M58.9 15.4C62 17 70 15.8 75.2 16.9 80 17.8 85 19 87.4 20.2 89 21 88.6 22.4 86.6 23 82.6 24.2 78 25 73 25.5 70 25.8 68 25.9 66.6 25.9 64 26 62 26 60 26L58.9 15.4Z";
// The whole brim's outline, in one line: round the outside's lower edge, its left end and its top,
// on along the inside's top (the brim twisting there, behind her ear) and round its right end, back
// along its lower edge to her head, ending just where it meets her outline (the hat is drawn 1.12
// times its size about (50, 24): there, her outline's outer edge).
const HAT_BRIM_EDGE =
  "M54.8 19C50 21.6 45 23 41.6 23.6 34 25 28 26 24.2 25.9 19 25.8 15.4 23 14.8 19 14.4 16.4 14.3 14 14.5 12.4 22 10.2 31.4 9 40.6 9.4 47 9.8 53 12.4 58.9 15.4 62 17 70 15.8 75.2 16.9 80 17.8 85 19 87.4 20.2 89 21 88.6 22.4 86.6 23 82.6 24.2 78 25 73 25.5 70.4 25.72 67.6 25.78 64.8 25.78";
// Her right ear (on our right), drawn again over the hat, so it stands up whole in front of the
// brim: its outline along its outer side, ending flat at the top of her head (her own outline
// carries on from there, just where this one is), and along its inner side, stopping short of its
// foot in a soft round end.
// The top of her head under the hat, filled in white (her own tufts and outline there would show
// in bits between the brim and her ear), so her head runs smoothly up into the hat.
const HEAD_TOP = "M44 21.4H57V28.6H44Z";
const HAT_EAR = "M53 26 63 12 65 26Z";
const HAT_EAR_INNER_EDGE = "M55.2 22.9 63 12";
const HAT_EAR_OUTER_EDGE = "M63 12 65 26";
// Its two pansies, each its own size, turned its own way, and in its own colour (hue): where,
// how big, turned how far, and hue.
const FLOWERS: [number, number, number, number, number][] = [
  [50.6, 7.4, 1.45, -14, 305],
  [60, 6.4, 1.05, 22, 350],
];
// A pansy, simply: five rounded petals (two at the back, the right one darker, one at each side,
// and a big one at the bottom) round a yellow heart; outlined in gold. In its own units, its heart at 0, 0, about 8 across: [cx, cy, rx, ry, turn, lightness]
// (its hue the flower's).
const PANSY_PETALS: [number, number, number, number, number, number][] = [
  [1.2, -2, 1.8, 2, 20, 0.6],
  [-1, -2.1, 1.8, 2.1, -20, 0.72],
  [-2.3, 0.1, 1.7, 1.5, 0, 0.67],
  [2.3, 0.1, 1.7, 1.5, 0, 0.67],
  [0, 1.9, 1.9, 1.9, 0, 0.72],
];

function WitchHat({ id, night }: { id: string; night: boolean }) {
  const hat = night ? "oklch(0.28 0.11 305)" : "oklch(0.46 0.14 305)";
  // Its shading: the same purple, a little darker (its shadowed side and inside) and lighter.
  const shade = night ? "oklch(0.21 0.09 305)" : "oklch(0.37 0.13 305)";
  // The inside of the brim: a little darker still.
  const inside = night ? "oklch(0.18 0.07 305)" : "oklch(0.33 0.12 305)";
  const band = night ? "oklch(0.6 0.16 335)" : "oklch(0.74 0.13 335)";
  const ease = { transition: "fill 900ms ease" };
  return (
    <svg
      aria-hidden
      viewBox="3.2 15.2 93.6 93.6"
      className="magic-cat pointer-events-none absolute left-1/2 top-[calc(50%+17px)] size-[60px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
    >
      {/* (Her head is drawn 6 lower than its own units in the logo, out of her box.) */}
      <g transform="translate(0 6)">
        {/* Each part filled, then shaded, then outlined (so the shading never covers an outline). */}
        <path d={HEAD_TOP} fill="white" />
        {/* The hat, a little bigger than drawn, about where it sits on her head. */}
        <g transform="translate(50 24) scale(1.2) translate(-50 -24)">
          {/* The cone swaying a little while pointed at (.magic-hat), about where it meets the brim,
              which stays still on her head so it never comes away from her ears. */}
          <g className="magic-hat">
            <path
              d={HAT_CONE}
              stroke="white"
              strokeWidth="2.4"
              strokeLinejoin="round"
              style={{ fill: hat, ...ease }}
            />
            <path d={HAT_CONE_SHADE} style={{ fill: shade, ...ease }} />
            <clipPath id={`${id}-cone`}>
              <path d={HAT_CONE} />
            </clipPath>
            <path d={HAT_BAND} clipPath={`url(#${id}-cone)`} style={{ fill: band, ...ease }} />
            <path d={HAT_CONE} fill="none" stroke="white" strokeWidth="2.4" strokeLinejoin="round" />
          </g>
          <path d={HAT_BRIM} style={{ fill: hat, ...ease }} />
          <path d={HAT_BRIM_SHADE} style={{ fill: shade, ...ease }} />
          <path d={HAT_BRIM_INSIDE} style={{ fill: inside, ...ease }} />
          <path
            d={HAT_BRIM_EDGE}
            fill="none"
            stroke="white"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
          {/* The bird on the brim, bobbing a little while pointed at (.magic-bird). */}
          <g transform="translate(25 15) scale(1.35)">
            <g className="magic-bird">
              <path d={BIRD_FEET} fill="none" stroke={BAND} strokeWidth="0.55" strokeLinecap="round" />
              <path
                d={BIRD_TAIL}
                fill={BIRD_DARK}
                stroke="white"
                strokeWidth="1.1"
                strokeLinejoin="round"
                paintOrder="stroke"
              />
              <path d={BIRD_BODY} fill="white" stroke={BAND} strokeWidth="2.1" paintOrder="stroke" />
              <clipPath id={`${id}-bird`}>
                <path d={BIRD_BODY} />
              </clipPath>
              <g clipPath={`url(#${id}-bird)`}>
                <ellipse cx="1" cy="0.2" rx="6" ry="1.6" fill="oklch(0.9 0.008 60)" />
                <ellipse cx="3.8" cy="-7.4" rx="1.5" ry="2" fill={BIRD_DARK} />
              </g>
              {/* (Its wing a little bigger than drawn, about where it meets its shoulder.) */}
              <g transform="translate(2.9 -6.9) scale(1.22) translate(-3.6 6.4)">
                <path
                  d={BIRD_WING}
                  fill={BIRD_DARK}
                  stroke="white"
                  strokeWidth="0.9"
                  strokeLinejoin="round"
                  paintOrder="stroke"
                />
                <path
                  d="M4.4-4.9C5.4-4 6.6-3.7 7.8-3.9"
                  fill="none"
                  stroke="oklch(0.86 0.01 285)"
                  strokeWidth="0.37"
                  strokeLinecap="round"
                />
              </g>
              {/* Its eyes: closed, sleepy lines by night, open dots (like hers) by day. */}
              <path
                d={BIRD_EYES}
                fill="none"
                stroke={BAND}
                strokeWidth="0.55"
                strokeLinecap="round"
                style={{ opacity: night ? 1 : 0, transition: "opacity 600ms ease" }}
              />
              <g fill={BAND} style={{ opacity: night ? 0 : 1, transition: "opacity 600ms ease" }}>
                <circle cx="-2.2" cy="-7.15" r="0.6" />
                <circle cx="0.55" cy="-7.75" r="0.6" />
              </g>
              <path d={BIRD_BEAK} fill={BAND} stroke={BAND} strokeWidth="0.4" strokeLinejoin="round" />
            </g>
          </g>
          {/* The flowers on the ribbon, swaying with the cone. */}
          <g className="magic-hat">
            {FLOWERS.map(([x, y, size, turn, hue]) => (
              <g key={x} transform={`translate(${x} ${y}) rotate(${turn}) scale(${size})`}>
                {/* (Swaying a little while pointed at, each on its own beat: .magic-pansy.) */}
                <g className="magic-pansy" style={{ animationDelay: `${hue === 305 ? 0 : -0.7}s` }}>
                  {/* Gold outline, drawn under the petals so it runs only round their edge. */}
                  {PANSY_PETALS.map(([cx, cy, rx, ry, petalTurn]) => (
                    <ellipse
                      key={`o${cx}${cy}`}
                      cx={cx}
                      cy={cy}
                      rx={rx}
                      ry={ry}
                      transform={`rotate(${petalTurn} ${cx} ${cy})`}
                      fill="none"
                      stroke={GOLD}
                      strokeWidth="1.4"
                    />
                  ))}
                  {PANSY_PETALS.map(([cx, cy, rx, ry, petalTurn, light]) => (
                    <ellipse
                      key={`p${cx}${cy}`}
                      cx={cx}
                      cy={cy}
                      rx={rx}
                      ry={ry}
                      transform={`rotate(${petalTurn} ${cx} ${cy})`}
                      fill={`oklch(${light} 0.13 ${hue})`}
                    />
                  ))}
                  <circle r="0.9" fill="#facc15" />
                </g>
              </g>
            ))}
          </g>
        </g>
        <path d={HAT_EAR_INNER_EDGE} fill="none" stroke={BAND} strokeWidth="5.5" strokeLinecap="round" />
        <path
          d={HAT_EAR_OUTER_EDGE}
          fill="none"
          stroke={BAND}
          strokeWidth="5.5"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        <path d={HAT_EAR} fill="white" stroke="white" strokeWidth="2" strokeLinejoin="round" />
        <path d="M61.6 17.5 56.4 24.5H62.4Z" fill={`color-mix(in srgb, white 55%, ${BAND})`} />
        {/* (Closing the hairline seam where this outline meets her own, on her outline's dark band.) */}
        <path d="M65.9 25.2H67.8V27.6H65.9Z" fill={BAND} />
      </g>
    </svg>
  );
}

export default function MagicCardBack({ color }: { color: string }) {
  const id = `magic-${useId().replace(/:/g, "")}`;
  // The time of day (whatever the deck's colour: only the book and pen take that).
  const [sky, setSky] = useState<SkyName>("night-red");
  const nightTime = isNight(sky);
  // Clicking the sun or moon on the book changes only the sky (not, as a click elsewhere on the
  // card does, the deck).
  const pick = (next: (sky: SkyName) => SkyName) => (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setSky(next);
  };
  const toDay = pick((now) => (now === "day" ? "dawn" : "day"));
  const toNight = pick((now) => (now === "night-red" ? "night-teal" : "night-red"));
  // Whether the fish is glowing (clicked on and off; like the sun and moon, not opening the deck).
  const [fishGlow, setFishGlow] = useState(false);
  const toggleFish = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setFishGlow((on) => !on);
  };
  // A darker shade of the deck's colour (for the book's covers and the pen's barbs).
  const cover = (share: number) => `color-mix(in oklch, ${color} ${share}%, black)`;
  // The book's covers and spine: as dark by night; by day a little lighter, easing as it changes.
  const bookCover = (share: number) => cover(nightTime ? share : share + 18);
  return (
    <span className="absolute inset-0 rounded-xl bg-white p-[5px] shadow-md ring-1 ring-black/15">
      <span className="relative block size-full">
        <span aria-hidden className="absolute inset-[3px] overflow-hidden rounded-[6px]">
          <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice" className="block size-full">
            <defs>
              {(Object.keys(SKIES) as SkyName[]).map((name) => (
                <linearGradient key={name} id={`${id}-${name}`} x1="0" y1="0" x2="0" y2="1">
                  {SKIES[name].map(([offset, stop]) => (
                    <stop key={offset} offset={offset} stopColor={stop} />
                  ))}
                </linearGradient>
              ))}
            </defs>
            {/* Each sky, the one for now shown, the others faded out (so they cross-fade). */}
            {(Object.keys(SKIES) as SkyName[]).map((name) => (
              <rect
                key={name}
                width="100"
                height="130"
                fill={`url(#${id}-${name})`}
                style={{ opacity: name === sky ? 1 : 0, transition: SKY_FADE }}
              />
            ))}
            {/* The stars, by night and day (white, as on Teegesellschaft's sky). */}
            <g>
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
            </g>
          </svg>
        </span>
        <span aria-hidden className="absolute inset-0 rounded-lg border-[4px] border-[#111214]" />

        {/* The cat's head, as on Classic (the logo's, the same size), moved down so that without
            her box she sits in the middle. */}
        <span className="magic-float absolute inset-0 grid -translate-y-1 place-items-center">
          {/* A warm light from the book's pages, while she is happy, behind her and the book (so she
              stays crisp in front of it), gently swelling and settling (.magic-light). */}
          <span className="magic-light absolute left-1/2 top-1/2 h-[64px] w-[112px] -translate-x-1/2 translate-y-[-2px] rounded-full" />
          {/* Her chest, white, behind her head and lifting with it: all the book shows of it is in
              the dip where its pages meet, so that never shows the sky. */}
          <span className="magic-cat absolute left-1/2 top-1/2 h-4 w-6 -translate-x-1/2 translate-y-[11px] bg-white" />
          <LogoMark
            id={`${id}-cat`}
            headOnly
            className="magic-cat logo-mark-out size-[60px] translate-y-[17px] text-white"
            style={{ ["--mark-paper" as string]: BAND }}
          />
          {/* Over the bottom of her head, white, lifting with it: while she raises her head, it
              hides her head's bottom outline, so in the dip between the pages her head runs on
              into her chest (.magic-chin). */}
          <span className="magic-cat magic-chin absolute left-1/2 top-1/2 h-[3.6px] w-3 -translate-x-1/2 translate-y-[13.4px] bg-white" />
          {/* Her witch hat, laid over her head in its drawing (so it lifts with her). */}
          <WitchHat id={`${id}-hat`} night={nightTime} />
        </span>

        {/* The book in front of her and the quill floating beside it, in px from the card's
            middle. */}
        <span className="magic-float pointer-events-none absolute inset-0 grid -translate-y-1 place-items-center">
          <svg
            aria-hidden
            viewBox="-45 -32 90 64"
            className="absolute left-1/2 top-1/2 h-[78px] w-[109px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
            strokeLinejoin="round"
          >
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
            {/* The pen beside the book, behind it (floating slowly while pointed at). */}
            <g className="magic-quill">
              <g
                transform={`translate(${PEN.x - 40 * PEN.scale} ${PEN.y - 80 * PEN.scale}) scale(${PEN.scale})`}
              >
                {/* Its barbed half in a darker shade of the deck's colour, thinly outlined in white. */}
                <path
                  d={PEN_RIGHT_VANE}
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  style={{ fill: cover(70), transition: "fill 500ms ease" }}
                />
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
            {/* Motes of light rising round the book while it glows, by night. */}
            <g style={{ opacity: nightTime ? 1 : 0, transition: SKY_FADE }}>
              {MOTES.map(([x, y, r, delay, drift]) => (
                <circle
                  key={`${x}-${y}`}
                  cx={x}
                  cy={y}
                  r={r * 1.5}
                  fill={MOTE}
                  className="magic-mote"
                  style={{ animationDelay: `${delay}s`, ["--drift" as string]: `${drift}px` }}
                />
              ))}
            </g>
            {/* The book, glowing while she is happy. */}
            {/* (Set high, so its top hides all of her face but her eyes; her resting mouth is hidden
                too, .magic-cat in globals.css.) */}
            <g
              className="magic-book"
              transform="translate(0 -2)"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              {/* A page turning from right to left now and then, while pointed at: behind both
                  halves' pages, so only what rises above them shows and its edges end where they
                  meet the pages' top (the pages' outline never broken), opening and closing with
                  the book about its middle (.magic-half-middle). */}
              <g className="magic-half magic-half-middle">
                <path d={TURNING_FILL} fill={PAGE} className="magic-page magic-page-fill" />
                <path
                  d={TURNING_EDGE}
                  fill="none"
                  stroke={BAND}
                  strokeWidth="0.8"
                  className="magic-page magic-page-edge"
                />
              </g>
              {/* Each half (its pages and cover) opens and closes a little as the book floats,
                  narrowing and widening from its edge at the spine (.magic-half). */}
              {[0, 1].map((side) => (
                <g key={side} className={`magic-half magic-half-${side ? "right" : "left"}`}>
                  <path d={side ? PAGES_RIGHT : PAGES_LEFT} fill={PAGE} stroke={BAND} strokeWidth="0.8" />
                  {BOOKMARKS.map(
                    (mark) =>
                      mark.side === side && (
                        <path
                          key={mark.d}
                          d={mark.d}
                          stroke="white"
                          strokeWidth="0.7"
                          strokeLinejoin="round"
                          style={{ fill: paletteColor(mark.family), transition: "fill 500ms ease" }}
                        />
                      ),
                  )}

                  <path
                    d={COVERS[side]}
                    className="magic-cover"
                    stroke="white"
                    strokeWidth="1.6"
                    style={{ fill: bookCover(COVER_SHARES[side]), transition: "fill 900ms ease" }}
                  />
                  {side === 0 && (
                    <g
                      transform={COVER_SUN}
                      onClick={toDay}
                      style={{ pointerEvents: "all", cursor: "pointer" }}
                    >
                      {/* (All of it, round, takes the click.) */}
                      <circle cx="10" cy="10" r="10" fill="transparent" />
                      <circle cx="10" cy="10" r="5" fill={SUN} />
                      {SUN_SPOTS.map(([x, y, size]) => (
                        <path
                          key={`${x}-${y}`}
                          d={SPARKLE}
                          transform={`translate(${x} ${y}) scale(${size})`}
                          fill={SUN_SPOT}
                        />
                      ))}
                      <path d={SUN_RAYS} fill={SUN} stroke={SUN} strokeWidth="0.7" strokeLinejoin="round" />
                    </g>
                  )}
                  {/* On the right cover, its picture: the sky's moon, spots, stars and all, in white
                      (its spots a darker, warmer white), slanted to lie on the open cover. */}
                  {side === 1 && (
                    <g
                      transform={COVER_MOON}
                      onClick={toNight}
                      style={{ pointerEvents: "all", cursor: "pointer" }}
                    >
                      {/* (All of it, round, hollow and stars too, takes the click.) */}
                      <circle cx="10.5" cy="9.5" r="10" fill="transparent" />
                      <path d={MOON_SHAPE} fill="white" />
                      {MOON_SPOTS.map(([x, y, r]) => (
                        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={COVER_MOON_SPOT} />
                      ))}
                      <path
                        d="M14.5 2.6v2.4M13.3 3.8h2.4M17 7v1.6M16.2 7.8h1.6"
                        fill="none"
                        stroke="white"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </g>
                  )}
                  <path d={CLASP_TABS[side]} fill={GOLD} stroke="white" strokeWidth="1.2" />
                </g>
              ))}
              <path
                d={SPINE}
                className="magic-cover"
                stroke="white"
                strokeWidth="1.6"
                style={{ fill: bookCover(COVER_SHARES[2]), transition: "fill 900ms ease" }}
              />
              {/* Two lines across the spine, near its top and bottom, white as its outline is,
                  curving with it (it is round). */}
              <path d={SPINE_BANDS} fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          </svg>
        </span>

        {/* The fish, in front of the book, low on its right (over its right cover's foot, by the spine), gently
            bobbing while pointed at (.magic-fish-swim); drawn with room round it for its glow and motes. */}
        <span className="magic-float pointer-events-none absolute inset-0 -translate-y-1">
          <span
            data-glow={fishGlow ? "" : undefined}
            className="magic-fish absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: "calc(50% + 14px)", top: "calc(50% + 42px)", width: 40, height: 26.2 }}
          >
            <svg viewBox="-64 -52 128 84" className="block size-full overflow-visible">
              <g className="magic-fish-swim">
                {FISH_MOTES.map(([x, y, r, delay, drift]) => (
                  <circle
                    key={`${x}-${y}`}
                    cx={x}
                    cy={y}
                    r={r}
                    fill={MOTE}
                    className="magic-fish-mote"
                    style={{ animationDelay: `${delay}s`, ["--drift" as string]: `${drift}px` }}
                  />
                ))}
                <g
                  className="pointer-events-auto cursor-pointer"
                  onClick={toggleFish}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  {FISH_FINS.map((d) => (
                    <path
                      key={d}
                      d={d}
                      stroke={BAND}
                      strokeWidth="6.2"
                      paintOrder="stroke"
                      style={{ fill: FISH_FIN[nightTime ? 1 : 0], transition: FISH_FADE }}
                    />
                  ))}
                  <path
                    d={FISH_BODY}
                    style={{ fill: FISH_SKIN[nightTime ? 1 : 0], transition: FISH_FADE }}
                    stroke={BAND}
                    strokeWidth="7.5"
                    paintOrder="stroke"
                  />
                  <clipPath id={`${id}-fish`}>
                    <path d={FISH_BODY} />
                  </clipPath>
                  <path
                    d={FISH_HEAD}
                    style={{ fill: FISH_HEAD_SKIN[nightTime ? 1 : 0], transition: FISH_FADE }}
                    clipPath={`url(#${id}-fish)`}
                  />
                  <path d={FISH_GILL} fill="none" stroke={BAND} strokeWidth="3.2" />
                  <path
                    d={FISH_SIDE_FIN}
                    stroke={BAND}
                    strokeWidth="2.6"
                    style={{ fill: FISH_FIN[nightTime ? 1 : 0], transition: FISH_FADE }}
                  />
                  <path
                    d={FISH_EYE}
                    fill="white"
                    stroke={BAND}
                    strokeWidth="1.4"
                    transform="translate(-22 -10.7) scale(1.75) translate(22 10.7)"
                  />
                </g>
              </g>
            </svg>
          </span>
        </span>

        {/* The corners' sparkles; and the moon by night, by day a sun in its place. */}
        <span className="contents">
          <Sparkle color="white" className="absolute left-[8px] top-[8px] size-4" />
          <Sparkle color="white" className="absolute bottom-[8px] right-[8px] size-4 rotate-180" />
        </span>
        <span
          aria-hidden
          className={`absolute right-[13px] top-[13px] transition-opacity duration-[900ms] ${nightTime ? "opacity-0" : ""}`}
        >
          {/* By day, the sun: pointed at, it swings up as the moon does, then glows, its rays
              slowly turning and its disc gently swelling (.magic-sun in globals.css). */}
          <svg viewBox="0 0 20 20" className="magic-sun size-6 overflow-visible">
            <g className="magic-sun-body">
              <path
                d={SUN_RAYS}
                fill={SKY_SUN}
                stroke={SKY_SUN}
                strokeWidth="0.7"
                strokeLinejoin="round"
                className="magic-sun-rays"
              />
              <circle cx="10" cy="10" r="5" fill={SKY_SUN} className="magic-sun-disc" />
            </g>
          </svg>
        </span>
        {/* The moon, a little in from its corner: the Sandbox's for a day gone by, filled in. */}
        <span
          className={`absolute right-[13px] top-[13px] transition-opacity duration-[900ms] ${nightTime ? "" : "opacity-0"}`}
        >
          <span className="magic-moon block">
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
                <path fill={MOON} d={MOON_SHAPE} />
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
