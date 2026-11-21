// Small line icons used in many places, in the colour of the text around them. Hidden from
// screen readers: whatever holds one says what it does.

type Props = { className?: string };

function Icon({ className = "", strokeWidth = 1.5, children }: Props & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

// A cross: closing something.
export function CloseIcon({ className = "size-3" }: Props) {
  return (
    <Icon className={className} strokeWidth={1.6}>
      <path d="M3 3l6 6M9 3l-6 6" />
    </Icon>
  );
}

// A chevron pointing down: something that opens below (turn it with rotate-180 once open).
export function ChevronDownIcon({ className = "size-3" }: Props) {
  return (
    <Icon className={className}>
      <path d="M3 4.5 6 7.5l3-3" />
    </Icon>
  );
}
