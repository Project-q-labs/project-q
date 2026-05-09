import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { PriceTicker } from "@/components/PriceTicker";
import { MarketHeader } from "@/components/MarketHeader";
import { MarketStats } from "@/components/MarketStats";
import { PriceChart } from "@/components/PriceChart";
import { FundingHistory } from "@/components/FundingHistory";
import { getMeta } from "@/lib/hyperliquid/client";

export const dynamic = "force-dynamic";

type Props = {
  params: { symbol: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const symbol = params.symbol.toUpperCase();
  return {
    title: `${symbol} Perp · Project Q`,
    description: `Real-time funding, OI, and order flow for ${symbol} perpetual on Hyperliquid.`,
    robots: { index: false, follow: false },
  };
}

/**
 * Validate symbol against Hyperliquid's universe at request time.
 * If unknown, return 404. Otherwise render the analysis page.
 */
export default async function MarketDetailPage({ params }: Props) {
  const symbol = params.symbol.toUpperCase();

  // Server-side validation: is this a real Hyperliquid pair?
  let isValid = false;
  try {
    const meta = await getMeta();
    isValid = meta.universe.some(
      (u) => u.name.toUpperCase() === symbol
    );
  } catch {
    // If meta lookup fails, optimistically render (client will show error)
    isValid = true;
  }

  if (!isValid) notFound();

  return (
    <main className="relative min-h-screen bg-bg text-ink">
      {/* Live ticker at top — same as landing */}
      <div className="relative z-20">
        <PriceTicker />
      </div>

      {/* Top nav (same minimal style as landing) */}
      <header className="relative z-10 flex items-center justify-between border-b border-bg-line px-6 py-5 md:px-10 md:py-6">
        <Link href="/" className="font-mono text-[13px] tracking-tight">
          <span className="text-signal">●</span>
          <span className="ml-2 text-ink">PROJECT</span>
          <span className="text-ink-mute">.</span>
          <span className="text-ink">Q</span>
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          MARKET · {symbol}
        </div>
      </header>

      {/* Pair name + price + 24h change */}
      <MarketHeader symbol={symbol} />

      {/* Stats grid */}
      <section className="border-b border-bg-line">
        <div className="mx-auto max-w-7xl">
          <MarketStats symbol={symbol} />
        </div>
      </section>

      {/* Chart */}
      <section className="border-b border-bg-line bg-bg-deep">
        <div className="mx-auto max-w-7xl px-2 py-4 md:px-6 md:py-6">
          <PriceChart symbol={symbol} />
        </div>
      </section>

      {/* Funding history */}
      <section className="border-b border-bg-line">
        <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
          <FundingHistory symbol={symbol} />
        </div>
      </section>

      {/* Coming-next teaser */}
      <section className="border-b border-bg-line">
        <div className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-14">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
            [ COMING NEXT ]
          </div>
          <h2 className="mt-4 font-sans text-[24px] font-medium leading-tight text-ink md:text-[32px]">
            Liquidations, smart-money positions,
            <br />
            <span className="text-ink-mute">and one-click execution.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[14px] leading-[1.6] text-ink-mute md:text-[15px]">
            Real-time liquidation feed (M1), top trader positions on
            Hyperliquid (M3-M4), and one-click order execution via your
            connected wallet (M3). Today: live funding history, open
            interest, and 24h volume — straight from Hyperliquid.
          </p>
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
              href={`/api/v1/markets/${symbol}`}
              className="text-ink hover:text-signal transition-colors"
            >
              /api/v1/markets/{symbol}
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
