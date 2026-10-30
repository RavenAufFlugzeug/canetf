import KindMark from "@/components/KindMark";
import { badgeLook } from "@/lib/kinds";
import { naicsOf } from "@/lib/naics";
import { kindOf } from "@/lib/sandbox";

// A company's or fund's badge: a rounded square in its NAICS sector's colour (a fund's dark
// slate, an exchange rate's white with a black outline, an unclassified company's grey) with the mark of its kind on it (KindMark: a chip for
// tech, a mine cart for mining…), as the Sandbox's cards have, and its sector named when it is
// pointed at. Pointed at, it lifts and glows in its colour and its mark moves its own way
// (.kind-badge in globals.css), as every badge in the app does.
export default function KindBadge({
  sector,
  industry,
  fundFamily = null,
  category = null,
  className = "size-7",
  markClassName = "size-4",
}: {
  sector: string | null;
  industry: string | null;
  fundFamily?: string | null;
  category?: string | null;
  className?: string;
  markClassName?: string;
}) {
  const naics = naicsOf(sector, industry);
  const kind = kindOf({ sector, industry, fundFamily, category });
  const look = badgeLook(kind, naics);
  return (
    <span
      title={naics?.name ?? (kind === "ETF" ? "Fund" : kind === "Currency" ? "Exchange rate" : "Unclassified")}
      className={`kind-badge grid shrink-0 place-items-center rounded-lg shadow-sm ${
        look.ring ? "ring-[1.5px] ring-inset ring-slate-900" : ""
      } ${className}`}
      style={{
        // Its colour, for the glow when it is pointed at.
        ["--badge" as string]: look.glow,
        background: look.background,
        color: look.color,
      }}
    >
      <KindMark kind={kind} className={markClassName} />
    </span>
  );
}
