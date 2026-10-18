// Search's mark: a magnifying glass in the navbar's sharp-edged style. Its lens is an
// eight-sided ring rather than a circle, and its handle a square-ended bar running down to
// the right from the rim. It takes the colour of the text around it.
//
// Pointed at, or when a surrounding `group` is, it swings a little about the lens, with
// the other marks' slight spring (.search-mark in globals.css).
export default function SearchMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={`search-mark shrink-0 fill-current ${className}`}>
      {/* The lens: an octagon with a smaller octagon cut out of it. */}
      <path
        fillRule="evenodd"
        d="M73.3 53.8 53.8 73.3H26.2L6.7 53.8V26.2L26.2 6.7h27.6l19.5 19.5ZM61.2 48.8 48.8 61.2H31.2L18.8 48.8V31.2l12.4-12.4h17.6l12.4 12.4Z"
      />
      {/* The handle: a bar from inside the rim, down and to the right. */}
      <polygon points="57,66 66,57 98,89 89,98" />
    </svg>
  );
}
