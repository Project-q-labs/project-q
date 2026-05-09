import type { Metadata } from "next";
import Link from "next/link";

import { PriceTicker } from "@/components/PriceTicker";
import { RuleCard } from "@/components/RuleCard";
import { EXAMPLE_RULES } from "@/lib/rules/examples";

export const metadata: Metadata = {
  title: "Rules · Project Q",
  description:
    "Compose triggers without code. Examples evaluated live against Hyperliquid.",
  robots: { index: false, follow: false },
};

export default function RulesPreviewPage() {
  return (
    <main className="relative min-h-screen bg-bg text-ink">
      {/* Live ticker */}
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
          RULES
        </div>
      </header>

      {/* Page header */}
      <section className="border-b border-bg-line bg-bg-deep">
        <div className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-14">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">
            [ RULES · PREVIEW ]
          </div>
          <h1 className="mt-4 font-sans text-[28px] font-semibold leading-[1.05] tracking-tightest text-ink sm:text-[36px] md:text-[56px]">
            Compose your edge,
            <br />
            <span className="text-ink-mute">in plain English.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-[1.6] text-ink-mute md:text-[16px]">
            Each card below is a real trigger rule, evaluated live against
            Hyperliquid right now. The engine that builds and runs your own
            rules ships in M2 (W5–W6). Today: see what&apos;s possible.
          </p>

          {/* Note pill */}
          <div className="mt-8 inline-flex items-center gap-3 border border-bg-line bg-bg-panel/60 px-4 py-2 font-mono text-[11px] backdrop-blur-sm">
            <span className="text-ink-faint">PREVIEW MODE</span>
            <span className="text-ink-faint">·</span>
            <span className="text-ink-mute">no execution · no signup</span>
          </div>
        </div>
      </section>

      {/* Rules grid */}
      <section className="border-b border-bg-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-px bg-bg-line md:grid-cols-2 lg:grid-cols-3">
            {EXAMPLE_RULES.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        </div>
      </section>

      {/* Coming next */}
      <section className="border-b border-bg-line bg-bg-deep">
        <div className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
            [ M2 — COMING WEEKS 5-6 ]
          </div>
          <h2 className="mt-4 font-sans text-[24px] font-medium leading-tight text-ink md:text-[32px]">
            Build your own rules.
            <br />
            <span className="text-ink-mute">No code. No webhooks.</span>
          </h2>
          <ul className="mt-6 space-y-3 font-sans text-[14px] leading-[1.6] text-ink-mute md:text-[15px]">
            <li className="flex gap-3">
              <span className="text-signal">→</span>
              <span>
                Visual rule builder: drag conditions (price, funding, OI,
                liquidations) into AND/OR logic
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-signal">→</span>
              <span>
                Backtest your rule against the last 30 days before turning
                it on
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-signal">→</span>
              <span>
                Telegram alerts when conditions trigger — even before
                execution is wired
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-signal">→</span>
              <span>
                Hyperliquid Agent Wallet executes (M3) — your main wallet
                stays in your control
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bg-deep">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-ink-faint md:px-10">
          <div className="flex items-center gap-4">
            <span>BACKEND</span>
            <span className="text-ink">Hyperliquid</span>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/markets"
              className="text-ink hover:text-signal transition-colors"
            >
              /markets
            </Link>
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
