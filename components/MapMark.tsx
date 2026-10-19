// The Holdings Map's mark: a small treemap, like the map itself. A square is split into six
// rounded tiles of different sizes with thin gaps between them: a large one at the top
// left, two stacked at the top right, and three along the bottom. They are shaded in three
// strengths of the text colour around them, darkest for the largest, like a heat map.
//
// Pointed at, or when a surrounding `group` is, the tiles pop one after another, largest
// first, in a quick wave (.map-mark-tile in globals.css).

// The tiles, largest first: [x, y, width, height, opacity].
const TILES = [
  [4, 4, 54, 56, 1],
  [64, 4, 32, 32, 0.7],
  [64, 42, 32, 18, 0.45],
  [4, 66, 30, 30, 0.7],
  [40, 66, 26, 30, 0.45],
  [72, 66, 24, 30, 1],
] as const;

export default function MapMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="1.05 1.05 97.9 97.9" className={`map-mark shrink-0 fill-current ${className}`}>
      {TILES.map(([x, y, width, height, strength], i) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={width}
          height={height}
          rx="6"
          opacity={strength}
          className="map-mark-tile"
          style={{ animationDelay: `${i * 70}ms` }}
        />
      ))}
    </svg>
  );
}
