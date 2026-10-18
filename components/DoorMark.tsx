// Log out's mark: a door in its frame, in the same sharp-edged style as the navbar's chess
// pieces. The frame runs up, across and down (a doorway, open at the bottom); inside it
// stands a plain, solid door. It takes the colour of the text around it.
//
// Pointed at, or when a surrounding `group` is, the door swings open on its left hinge
// (.door-mark-panel in globals.css): it narrows and its far edge drops, as a door does
// turning towards you, then closes again when let go.
export default function DoorMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={`door-mark shrink-0 fill-current ${className}`}>
      {/* The frame: up, across and down. */}
      <path d="M17 98V5h66v93" fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="miter" />
      {/* The door. */}
      <path className="door-mark-panel" d="M27 15h46v83H27Z" />
    </svg>
  );
}
