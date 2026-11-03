import { Fish } from "@/components/HoldingsDeck";

// The back of the Strategies page's cards (its decks), framed as the Sandbox's card backs are
// (a white border, a near-black band round a field in the deck's colour, a white fish in two
// corners), with nothing in the middle. Its colour eases to a new one as the deck is
// recoloured.
export default function StrategyCardBack({ color }: { color: string }) {
  return (
    <span className="absolute inset-0 rounded-xl bg-white p-[5px] shadow-md ring-1 ring-black/15">
      <span
        className="relative block size-full rounded-lg border-[4px] transition-[background-color] duration-500 ease-[ease]"
        style={{ backgroundColor: color, borderColor: "#111214" }}
      >
        <Fish color="white" className="absolute left-1 top-1.5 h-3 w-[18px]" />
        <Fish color="white" className="absolute bottom-1.5 right-1 h-3 w-[18px] rotate-180" />
      </span>
    </span>
  );
}
