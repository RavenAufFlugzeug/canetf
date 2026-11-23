"use client";

import { useState } from "react";
import { useSandboxSwap } from "@/components/SandboxSwap";
import { sandboxHref, type Choices } from "@/lib/sandbox";
import { button, field } from "@/lib/ui";

// The day a custom test starts on (the Sandbox's Custom mode): a date, set with its button,
// which goes to the Sandbox's address with it (keeping the other choices) as the area below
// fades (Swap: `swaps`). Not before there is something to test (`ready`), nor after today. A
// day before any of it can be traded is still set, for the page to say from when each can be.
export default function SandboxStart({
  choices,
  start,
  ready,
  swaps,
}: {
  choices: Choices;
  start: string | null;
  ready: boolean;
  swaps: string;
}) {
  const { change, pending, leaving } = useSandboxSwap();
  const [date, setDate] = useState(start ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;
  const setting = pending && leaving === swaps;

  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && ready) change(swaps, () => sandboxHref({ ...choices, start: date }));
      }}
    >
      <input
        type="date"
        aria-label="Start date"
        value={date}
        max={today}
        onChange={(e) => setDate(e.target.value)}
        className={`${field("sm")} tabular-nums`}
      />
      <button
        type="submit"
        disabled={!valid || !ready || date === start || pending}
        aria-busy={setting}
        className={button("primary")}
      >
        Set start
      </button>
    </form>
  );
}
