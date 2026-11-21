import Link from "next/link";
import { button } from "@/lib/ui";

// A short message panel in place of something that can't be shown yet (signed out, or an
// empty watch list): a line of text and a button, after an icon when it has one, used by
// the Sandbox page's watch list section and the Watch List page. The panel rises in;
// pointing at it brightens its border and stirs the icon (a navbar mark, being in a
// `group`, plays its own animation), and the button lifts with its arrow sliding forward,
// like the Search page's map button.
export default function Prompt({
  icon,
  text,
  href,
  action,
}: {
  icon?: React.ReactNode;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <div
      className="rise-in group group/prompt mt-2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition duration-300 ease-out hover:border-slate-300 hover:bg-white hover:shadow-sm"
      style={{ animationDelay: "120ms" }}
    >
      {icon}
      <p className="min-w-0 flex-1 text-sm text-slate-600">{text}</p>
      <Link
        href={href}
        className={`group/button shrink-0 ${button("primary")}`}
      >
        {action}
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 transition-transform duration-300 ease-out motion-safe:group-hover/button:translate-x-1"
        >
          <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
        </svg>
      </Link>
    </div>
  );
}
