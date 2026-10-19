// Log in's mark: a solid key with sharp edges, lying on its side. Its bow is a diamond with
// a smaller diamond cut through it; its shaft is a straight bar with a square end, and its
// two teeth are rectangles. Used as the navbar's Log in link. It takes the colour of the
// text around it.
//
// The key is long and low, so it is framed (like the navbar's other marks) on the average
// of its width and height: it stands about as tall as the others, its ends reaching a
// little past its box. Pointed at, or when a surrounding `group` is, it turns as if
// unlocking, with the Sandbox mark's slight spring (.key-mark in globals.css).
export default function KeyMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="2.95 2.95 18.1 18.1" className={`key-mark shrink-0 overflow-visible fill-current ${className}`}>
      {/* The bow: a diamond, with a smaller diamond cut out of its middle. */}
      <path fillRule="evenodd" d="M0.6 12 6.2 6.4l5.6 5.6-5.6 5.6L0.6 12Zm3.5 0 2.1-2.1 2.1 2.1-2.1 2.1L4.1 12Z" />
      {/* The shaft, a straight bar with a square end, and two rectangular teeth. */}
      <path d="M10.8 10.7h12.6v2.6H10.8Z" />
      <path d="M16.6 13.3h2v3h-2Z" />
      <path d="M20.6 13.3h2.8v3.6h-2.8Z" />
    </svg>
  );
}
