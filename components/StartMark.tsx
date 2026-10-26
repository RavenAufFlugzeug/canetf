// The Sandbox test's start mark: a rounded play triangle. Clicked, its button launches it
// (.start-mark-launch in globals.css): it stretches and shoots forwards out of sight. It
// takes the colour of the text around it.
export default function StartMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="7 2 11 12"
      className={`shrink-0 overflow-visible ${className}`}
      fill="currentColor"
    >
      <path
        d="M8 3.6v8.8a1 1 0 0 0 1.5.86l7.3-4.4a1 1 0 0 0 0-1.72L9.5 2.74A1 1 0 0 0 8 3.6Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
