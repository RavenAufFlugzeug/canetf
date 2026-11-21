// Every page's frame: the light grey page under the navbar, and a centred column of the
// width the page needs (sm for a small form, md for Search and Account, up to 2xl for the
// Holdings Map and Strategies), its cards (CARD in lib/ui.ts) stacked with room between.
const WIDTHS = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  "2xl": "max-w-6xl",
} as const;

export default function Page({
  width = "md",
  children,
}: {
  width?: keyof typeof WIDTHS;
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 bg-slate-50">
      <section className={`mx-auto ${WIDTHS[width]} space-y-6 px-6 pt-10 pb-12`}>{children}</section>
    </main>
  );
}
