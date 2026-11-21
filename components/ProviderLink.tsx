"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getProviderCompany } from "@/app/actions/provider";
import CompanyAbout from "@/components/CompanyAbout";
import DiamondLoader from "@/components/DiamondLoader";
import KeyStats from "@/components/KeyStats";
import KindBadge from "@/components/KindBadge";
import PriceChart from "@/components/PriceChart";
import { providerOf } from "@/lib/providers";
import Popup, { usePopupClose } from "@/components/Popup";
import { button as buttonLook, LABEL, FOCUS_RING } from "@/lib/ui";
import CloseButton from "@/components/CloseButton";

type Data = Awaited<ReturnType<typeof getProviderCompany>>;

// A fund's provider in the Search page's fund section, as a link-like button: clicked, it
// opens a pop-up of the company behind it (lib/providers.ts). The provider's name as Yahoo
// gives it, underlined, with a small window mark that nudges up and right when pointed at.
// A provider not known here is plain text.
export default function ProviderLink({ fundFamily }: { fundFamily: string }) {
  const provider = providerOf(fundFamily);
  const [open, setOpen] = useState(false);
  if (!provider) return <>{fundFamily}</>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group/link inline-flex items-center gap-1.5 rounded text-right underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-900 ${FOCUS_RING}`}
      >
        {fundFamily}
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 shrink-0 text-slate-400 transition duration-300 ease-out group-hover/link:text-slate-900 motion-safe:group-hover/link:-translate-y-px motion-safe:group-hover/link:translate-x-px"
        >
          <path d="M9 3h4v4M13 3 8 8M11 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2.5" />
        </svg>
      </button>
      {open && <ProviderCard fundFamily={fundFamily} onClose={() => setOpen(false)} />}
    </>
  );
}

// The pop-up: over the page, dimmed and softly blurred behind it, a card with the company
// behind the provider: how the two are linked, then, for a listed one, its badge, name and
// ticker, its price chart and key figures and its About, as the Search page shows a company,
// with a link to open it there; for a privately owned one, who owns it. It fades and rises
// in, and fades and sinks away when closed (the ×, Escape, or a click beside it).
function ProviderCard({ fundFamily, onClose }: { fundFamily: string; onClose: () => void }) {
  const provider = providerOf(fundFamily)!;
  const { leaving, close } = usePopupClose(onClose);
  const [data, setData] = useState<Data | "loading">(provider.symbol ? "loading" : null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!provider.symbol) return;
    let live = true;
    getProviderCompany(provider.symbol).then(
      (d) => live && setData(d),
      () => live && setData(null),
    );
    return () => {
      live = false;
    };
  }, [provider.symbol]);

  const company = data && data !== "loading" ? data.company : null;

  return (
    <Popup
      label={`${provider.name}, behind ${fundFamily}`}
      leaving={leaving}
      onClose={close}
      initialFocus={button}
      className="my-8 max-w-2xl p-6"
    >
      <div className="flex items-start gap-3">
        {company ? (
          <KindBadge
            sector={company.sector}
            industry={company.industry}
            fundFamily={company.fundFamily}
            category={company.category}
            className="size-11 rounded-xl"
            markClassName="size-5"
          />
        ) : (
          // A building: the company, with no badge to give it.
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <path d="M5 16.5V4.5h7v12M12 8.5h3v8M3.5 16.5h13M7.5 7h2M7.5 10h2M7.5 13h2" />
            </svg>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`${LABEL}`}>
            Behind {fundFamily}
          </p>
          <p className="text-lg font-semibold text-slate-900">{company?.name ?? provider.name}</p>
          {provider.symbol && <p className="text-sm text-slate-500">{provider.symbol}</p>}
        </div>
        <CloseButton ref={button} onClick={close} />
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{provider.about}</p>

      {data === "loading" ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <DiamondLoader className="size-3.5" />
          Loading {provider.name}…
        </p>
      ) : data ? (
        <div className="text-fade-in">
          <PriceChart history={data.history} currency={data.company.currency} exchange={data.exchange} />
          {data.stats && <KeyStats stats={data.stats} currency={data.company.currency} />}
          {data.profile && (
            <CompanyAbout name={data.company.name ?? data.company.symbol} profile={data.profile} />
          )}
          <div className="mt-6 flex justify-end">
            <Link
              href={`/search?symbol=${encodeURIComponent(data.company.symbol)}`}
              className={buttonLook("primary")}
            >
              Open {data.company.symbol} in Search
            </Link>
          </div>
        </div>
      ) : provider.symbol ? (
        <p className="mt-6 text-sm text-slate-500">
          {provider.name}&apos;s prices aren&apos;t in the database yet.
        </p>
      ) : null}
    </Popup>
  );
}
