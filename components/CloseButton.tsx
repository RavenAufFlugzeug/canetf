import { CloseIcon } from "@/components/Icons";
import { FOCUS_RING } from "@/lib/ui";

// A pop-up's close button, in its top corner: a round button with a cross that turns a
// quarter when pointed at, and dips when pressed. `ref` puts the keyboard on it when the
// pop-up opens (Popup's initialFocus).
export default function CloseButton({
  onClick,
  ref,
  label = "Close",
}: {
  onClick: () => void;
  ref?: React.Ref<HTMLButtonElement>;
  label?: string;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`group grid size-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:scale-90 ${FOCUS_RING}`}
    >
      <CloseIcon className="size-3 transition-transform duration-300 motion-safe:group-hover:rotate-90" />
    </button>
  );
}
