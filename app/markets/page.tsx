import type { Metadata } from "next";
import Link from "next/link";

import { PriceTicker } from "@/components/PriceTicker";
import { MarketsTable } from "@/components/MarketsTable";

export const metadata: Metadata = {
  title: "Markets · Project Q",
  description:
    "All Hyperliquid perpetual markets — funding, open interest, 24h volume.",
  robots: { index: false, follow: false },
};

export default function MarketsPage() {
  return (
    <main className="relative min-h-screen bg-bg text-ink">
      {/* Live ticker at top */}
      <div className="relative z-20">
        <PriceTicker />
      </div>

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-between border-b border-bg-line px-6 py-5 md:px-10 md:py-6">
        <Link href="/" className="font-mono text-[13px] tracking-tight">
          <span className="text-signal">●</span>
          <span className="ml-2 text-ink">PROJECT</span>
          <span className="text-ink-mute">.</span>
          <span className="text-ink">Q</span>
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          MARKETS
        </div>
      </header>

      {/* Page header */}
      <section className="border-b border-bg-line bg-bg-deep">
        <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">
            [ MARKETS ]
          </div>
          <h1 className="mt-4 font-sans text-[32px] font-semibold leading-tight tracking-tightest text-ink md:text-[48px]">
            Every perp.
            <br />
            <span className="text-ink-mute">Funding. OI. Volume.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-[1.6] text-ink-mute md:text-[15px]">
            All Hyperliquid perpetuals, sortable by what matters — funding rate,
            open interest, 24h volume. Click any pair to drill into its order
            flow and chart. Updates every 5 seconds.
          </p>
        </div>
      </section>

      {/* Markets table */}
      <section className="border-b border-bg-line">
        <div className="mx-auto max-w-7xl">
          <MarketsTable />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bg-deep">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-ink-faint md:px-10">
          <div className="flex items-center gap-4">
            <span>BACKEND</span>
            <span className="text-ink">Hyperliquid</span>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <span>API</span>
            <Link
              href="/api/v1/markets"
              className="text-ink hover:text-signal transition-colors"
            >
              /api/v1/markets
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span>©</span>
            <span className="text-ink">2026</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
