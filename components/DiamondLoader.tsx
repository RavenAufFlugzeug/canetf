// A loading mark: four small diamonds set as one big diamond (top, right, bottom and left),
// which fade out and back in one after another, going round clockwise (.diamond-loader in
// globals.css). With reduced motion they stay still. It takes the colour of the text around
// it; `label` names it for screen readers when it stands alone.

// Where each small diamond sits, in the order they fade: top, right, bottom, left.
const SPOTS = [
  [8, 3.6],
  [12.4, 8],
  [8, 12.4],
  [3.6, 8],
] as const;

export default function DiamondLoader({ className = "", label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`diamond-loader shrink-0 fill-current ${className}`}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {SPOTS.map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y - 3.2}l3.2 3.2-3.2 3.2-3.2-3.2Z`}
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </svg>
  );
}
