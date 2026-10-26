// The Sandbox test's button marks, each taking the colour of the text around it and coming
// alive when its button (a surrounding `group`) is pointed at (.test-mark-* in globals.css):
//  - buying: an open box with an arrow that drops into it;
//  - selling: the same box with an arrow that rises out of it;
//  - the next day: a sun on the horizon that comes up as its rays shine out;
//  - the next week: a calendar whose week row fills in from left to right;
//  - the next month: a calendar whose days pop in one after another;
//  - finishing: a flag that waves;
//  - trying again: a circling arrow that spins round once;
//  - exiting: a door with an arrow that steps out of it.

type Props = { className?: string };

function Mark({ className = "", children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`test-mark shrink-0 overflow-visible ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// The open box that buying and selling share, like the logo's.
const BOX = "M3 11v4.5A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5V11";

export function BuyMark(props: Props) {
  return (
    <Mark {...props}>
      <path d={BOX} />
      <path className="test-mark-drop" d="M10 2.5v8.5M6.5 7.5 10 11l3.5-3.5" />
    </Mark>
  );
}

export function SellMark(props: Props) {
  return (
    <Mark {...props}>
      <path d={BOX} />
      <path className="test-mark-rise" d="M10 12V3.5M6.5 7 10 3.5 13.5 7" />
    </Mark>
  );
}

export function DayMark(props: Props) {
  return (
    <Mark {...props}>
      <path
        className="test-mark-rays"
        d="M10 3.5v1.6M4.4 6.4l1.1 1.1M15.6 6.4l-1.1 1.1M2.5 11.5h1.6M15.9 11.5h1.6"
      />
      <path className="test-mark-sun" d="M5.8 14.5a4.2 4.2 0 0 1 8.4 0" />
      <path d="M2 14.5h16M6.5 17.5h7" />
    </Mark>
  );
}

// A calendar's frame: its page, the line under its heading and its two rings.
const CALENDAR =
  "M4.5 4.5h11A1.5 1.5 0 0 1 17 6v9.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5V6a1.5 1.5 0 0 1 1.5-1.5ZM3 8.5h14M7 2.5v3.5M13 2.5v3.5";

export function WeekMark(props: Props) {
  return (
    <Mark {...props}>
      <path d={CALENDAR} />
      <rect
        className="test-mark-week"
        x="5.5"
        y="11"
        width="9"
        height="2.6"
        rx="1.3"
        fill="currentColor"
        stroke="none"
      />
    </Mark>
  );
}

export function MonthMark(props: Props) {
  return (
    <Mark {...props}>
      <path d={CALENDAR} />
      {[
        [6.5, 11.5],
        [10, 11.5],
        [13.5, 11.5],
        [6.5, 14.5],
        [10, 14.5],
        [13.5, 14.5],
      ].map(([cx, cy], i) => (
        <circle
          key={i}
          className="test-mark-date"
          cx={cx}
          cy={cy}
          r="1"
          fill="currentColor"
          stroke="none"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </Mark>
  );
}

// A warning: a rounded triangle with an exclamation mark in it (for a trade that can't be
// made as it stands). It stays still.
export function WarnMark({ className = "" }: Props) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.6 3.4a1.6 1.6 0 0 1 2.8 0l6.3 11.2a1.6 1.6 0 0 1-1.4 2.4H3.7a1.6 1.6 0 0 1-1.4-2.4Z" />
      <path d="M10 8v3.6" />
      <circle cx="10" cy="14.1" r="0.4" fill="currentColor" />
    </svg>
  );
}

export function RetryMark(props: Props) {
  return (
    <Mark {...props}>
      <g className="test-mark-spin">
        <path d="M16 10a6 6 0 1 1-1.8-4.3" />
        <path d="M14.8 2.8v3.4h-3.4" />
      </g>
    </Mark>
  );
}

export function ExitMark(props: Props) {
  return (
    <Mark {...props}>
      <path d="M11 3.5H5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h6" />
      <path className="test-mark-out" d="M8.5 10h8.5M14 7l3 3-3 3" />
    </Mark>
  );
}

export function FinishMark(props: Props) {
  return (
    <Mark {...props}>
      <path d="M5 17.5V2.5" />
      <path
        className="test-mark-flag"
        d="M5 3.5h9.5l-2.2 3.2 2.2 3.3H5"
        fill="currentColor"
        fillOpacity="0.25"
      />
    </Mark>
  );
}
