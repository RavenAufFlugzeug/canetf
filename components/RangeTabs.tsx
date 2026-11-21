"use client";

import SlideTabs from "@/components/SlideTabs";

// A chart's range options (the Search page's chart and the Sandbox's), on the site's switch
// (SlideTabs).
export default function RangeTabs<R extends string>({
  ranges,
  range,
  onPick,
}: {
  ranges: readonly R[];
  range: R;
  onPick: (r: R) => void;
}) {
  return (
    <SlideTabs
      label="Chart range"
      value={range}
      onChange={onPick}
      options={ranges.map((r) => ({ value: r, label: r }))}
    />
  );
}
