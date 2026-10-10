import { ViewTransition } from "react";

// Templates remount on every navigation to another page (not on ?query changes), so
// this boundary exits with the old page and enters with the new one: the old page
// fades out, the new one fades and rises in (.page-exit / .page-enter in globals.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
