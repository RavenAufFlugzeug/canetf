"use client";

import { createContext, useContext, useState } from "react";

// Whether the Sandbox's test is under way, shared by the test (SandboxTest), which says so as
// it starts and as it is left, and the set-up above it (SetupArea), which folds away while it
// is. Set round them both.
type Stage = { testing: boolean; setTesting: (testing: boolean) => void };

const StageContext = createContext<Stage | null>(null);

export function StageProvider({ children }: { children: React.ReactNode }) {
  const [testing, setTesting] = useState(false);
  return <StageContext.Provider value={{ testing, setTesting }}>{children}</StageContext.Provider>;
}

export function useStage() {
  return useContext(StageContext) ?? { testing: false, setTesting: () => {} };
}

// The Sandbox's set-up (its choices and its picks): while the test is under way it folds away
// (closing up and fading), and opens again when the test is left. It can't be used or tabbed
// into while folded. It clips what spills over its edges only while folded or folding, so its
// hover cards can reach past it when it is open.
export function SetupArea({ children }: { children: React.ReactNode }) {
  const { testing } = useStage();
  // Whether it clips: from the moment it starts folding until it has opened again.
  const [clipped, setClipped] = useState(false);
  const [last, setLast] = useState(testing);
  if (testing !== last) {
    setLast(testing);
    if (testing) setClipped(true);
  }

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        testing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
      aria-hidden={testing}
      inert={testing}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !testing) setClipped(false);
      }}
    >
      <div className={`min-h-0 ${clipped ? "overflow-hidden" : ""}`}>{children}</div>
    </div>
  );
}
