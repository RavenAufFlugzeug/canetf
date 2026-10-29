import KindMark from "@/components/KindMark";
import { markOn, naicsOf } from "@/lib/naics";
import { kindOf } from "@/lib/sandbox";

// A company's or fund's badge: a rounded square in its NAICS sector's colour (a fund's dark
// slate, an unclassified company's grey) with the mark of its kind on it (KindMark: a chip for
// tech, a mine cart for mining…), as the Sandbox's cards have, and its sector named when it is
// pointed at. Pointed at, it lifts and glows in its colour, a sheen sweeps over it, and its mark
// moves its own way (.kind-badge in globals.css). Used on the Search page and the Watch List.
export default function KindBadge({
  sector,
  industry,
  fundFamily = null,
  category = null,
  className = "size-7",
  markClassName = "size-4",
  shine = true,
}: {
  sector: string | null;
  industry: string | null;
  fundFamily?: string | null;
  category?: string | null;
  className?: string;
  markClassName?: string;
  // Whether a sheen sweeps across it when pointed at (not on the Search page's big one).
  shine?: boolean;
}) {
  const naics = naicsOf(sector, industry);
  const kind = kindOf({ sector, industry, fundFamily, category });
  const fund = kind === "ETF";
  return (
    <span
      title={naics?.name ?? (fund ? "Fund" : "Unclassified")}
      className={`kind-badge ${shine ? "" : "kind-badge-plain"} grid shrink-0 place-items-center rounded-lg shadow-sm ${className}`}
      style={{
        // Its colour, for the glow when it is pointed at.
        ["--badge" as string]: naics?.color ?? (fund ? "#1e293b" : "oklch(0.80 0 0)"),
        background: naics?.color ?? (fund ? "#1e293b" : "oklch(0.80 0 0)"),
        color: (naics && markOn(naics)) ?? (fund ? "#ffffff" : "#0f172a"),
      }}
    >
      <KindMark kind={kind} className={markClassName} />
    </span>
  );
}
