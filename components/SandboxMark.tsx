// The Sandbox page's mark: a 2 × 2 chessboard in a thin frame. Its two dark squares (top
// left and bottom right) are drawn; the two light ones show whatever is behind. Used on the
// page's heading (where `popIn` makes the squares pop in one after the other as the page
// opens) and as its link in the navbar. It takes the colour of the text around it.
//
// Pointed at, or when a surrounding `group` is, the board rolls over a little, tilting
// with a slight spring, and rolls back when let go (.sandbox-mark in globals.css).
const FRAME = 6; // the frame's width, in the 100-unit drawing
const CELL = (100 - 2 * FRAME) / 2;

// The dark squares: [row, column].
const DARK = [
  [0, 0],
  [1, 1],
] as const;

export default function SandboxMark({ className = "", popIn = false }: { className?: string; popIn?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={`sandbox-mark shrink-0 fill-current stroke-current ${className}`}>
      <rect x={FRAME / 2} y={FRAME / 2} width={100 - FRAME} height={100 - FRAME} fill="none" strokeWidth={FRAME} />
      {DARK.map(([row, col], i) => (
        <rect
          key={`${row}-${col}`}
          x={FRAME + col * CELL}
          y={FRAME + row * CELL}
          width={CELL}
          height={CELL}
          stroke="none"
          className={popIn ? "tile-in" : undefined}
          style={
            popIn ? { transformBox: "fill-box", transformOrigin: "center", animationDelay: `${i * 140}ms` } : undefined
          }
        />
      ))}
    </svg>
  );
}
