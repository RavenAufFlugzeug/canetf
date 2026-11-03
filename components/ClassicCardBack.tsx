import { useId } from "react";
import LogoMark from "@/components/LogoMark";

// The "Classic" deck back, as a playing card's: a white border, then a near-black band round a
// field in its deck's colour, and the logo in the middle (its box open and the cat's head out of
// it): the box outlined in white, her head, eyes and mouth in the near-black; and a white fish
// in two corners. On a deck (.deck-pile), the cat is surprised when it is pointed at and happy
// once it is clicked (.logo-mark-out in globals.css).
const BAND = "#111214";

export default function ClassicCardBack({ color }: { color: string }) {
  const id = `card-back-${useId().replace(/:/g, "")}`;
  return (
    <span className="absolute inset-0 rounded-xl bg-white p-[5px] shadow-md ring-1 ring-black/15">
      <span
        // (Its colour eases to a new one, as the Strategies page's decks are recoloured.)
        className="relative block size-full rounded-lg border-[4px] transition-[background-color] duration-500 ease-[ease]"
        style={{ backgroundColor: color, borderColor: BAND }}
      >
        {/* The emblem: the logo, the cat's head out of her box (.logo-mark-out). */}
        <span className="absolute inset-0 grid place-items-center">
          <LogoMark
            id={id}
            lid={200}
            className="logo-mark-out size-[60px] text-white"
            style={{ ["--mark-paper" as string]: BAND, ["--mark-seam" as string]: "white" }}
          />
        </span>
        {/* A fish in two corners, as on a card's face (the bottom one upside down). */}
        <Fish color="white" className="absolute left-1 top-1.5 h-3 w-[18px]" />
        <Fish color="white" className="absolute bottom-1.5 right-1 h-3 w-[18px] rotate-180" />
      </span>
    </span>
  );
}

// A fish (for the cat), drawn in one line in one colour: its body two arcs from its nose that
// cross at its tail and run on, open, to the tail's two tips, and
// a round eye.
const FISH = "M21 7 16 12C13 17.8 7 17.8 3 12C7 6.2 13 6.2 16 12L21 17";

export function Fish({ color, className }: { color: string; className: string }) {
  return (
    <svg aria-hidden viewBox="1 4.6 22 14.8" className={className}>
      <path
        d={FISH}
        fill="none"
        style={{ stroke: color, transition: "stroke 500ms ease" }}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.3" cy="11.1" r="1.35" style={{ fill: color, transition: "fill 500ms ease" }} />
    </svg>
  );
}
