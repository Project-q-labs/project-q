import Link from "next/link";
import { PriceTicker } from "@/components/PriceTicker";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg text-ink">
      {/* Live price ticker */}
      <div className="relative z-20">
        <PriceTicker />
      </div>

      {/* Subtle grid background */}
      <div className="absolute inset-0 grid-bg opacity-60" aria-hidden="true" />

      {/* Radial fade overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, transparent 0%, rgba(10,10,10,0.6) 50%, #0a0a0a 100%)",
        }}
        aria-hidden="true"
      />

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10 md:py-6">
        <div className="font-mono text-[13px] tracking-tight">
          <span className="text-signal">●</span>
          <span className="ml-2 text-ink">PROJECT</span>
          <span className="text-ink-mute">.</span>
          <span className="text-ink">Q</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          <span className="hidden md:inline">Internal Alpha</span>
          <span className="hidden md:inline">·</span>
          <span>v0.1.0</span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 md:px-10 md:pt-28">
        {/* Eyebrow */}
        <div
          className="fade-up font-mono text-[11px] uppercase tracking-[0.2em] text-signal"
          style={{ animationDelay: "0.05s" }}
        >
          [ PRE-ALPHA · BUILDING IN STEALTH ]
        </div>

        {/* Headline */}
        <h1
          className="fade-up mt-8 font-sans text-[44px] font-semibold leading-[1.02] tracking-tightest text-ink md:text-[88px]"
          style={{ animationDelay: "0.15s" }}
        >
          Trade by condition,
          <br />
          <span className="text-ink-mute">not by click.</span>
        </h1>

        {/* Sub */}
        <p
          className="fade-up mt-8 max-w-2xl text-[16px] leading-[1.6] text-ink-mute md:text-[18px]"
          style={{ animationDelay: "0.3s" }}
        >
          Trigger-based perpetual trading on Hyperliquid. Set your conditions —
          funding rates, order flow, on-chain signals, macro indicators — and
          let them execute, automatically, with no code.
        </p>

        {/* CTA / status row */}
        <div
          className="fade-up mt-14 flex flex-col gap-6 md:flex-row md:items-center md:gap-8"
          style={{ animationDelay: "0.45s" }}
        >
          <div className="inline-flex items-center gap-3 border border-bg-line bg-bg-panel/60 px-5 py-3 font-mono text-[13px] backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
            </span>
            <span className="text-ink">SYSTEM ONLINE</span>
            <span className="text-ink-faint">·</span>
            <span className="text-ink-mute">building</span>
            <span className="cursor text-signal" />
          </div>
          <div className="font-mono text-[12px] uppercase tracking-widest text-ink-faint">
            Closed alpha — Q1 2026
          </div>
        </div>
      </section>

      {/* Capability grid */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-28 pb-32 md:px-10 md:pt-40">
        <div
          className="fade-up mb-12 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint"
          style={{ animationDelay: "0.6s" }}
        >
          [ WHAT'S BEING BUILT ]
        </div>
        <div className="grid grid-cols-1 gap-px bg-bg-line md:grid-cols-3">
          {capabilities.map((cap, idx) => (
            <div
              key={cap.title}
              className="fade-up bg-bg p-7"
              style={{ animationDelay: `${0.7 + idx * 0.08}s` }}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-signal-dim">
                {cap.tag}
              </div>
              <h3 className="mt-4 text-[20px] font-medium leading-tight text-ink">
                {cap.title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-ink-mute">
                {cap.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer status bar */}
      <footer className="relative z-10 border-t border-bg-line bg-bg-deep">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-ink-faint md:px-10">
          <div className="flex items-center gap-4">
            <span>BACKEND</span>
            <span className="text-ink">Hyperliquid</span>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <span>API</span>
            <Link
              href="/api/v1/health"
              className="text-ink hover:text-signal transition-colors"
            >
              /api/v1/health
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

const capabilities = [
  {
    tag: "01 / DATA",
    title: "Live order flow on every pair",
    body:
      "Funding rate, open interest, long/short ratio, liquidations, CVD — all 30+ pairs, sub-second latency, straight from Hyperliquid.",
  },
  {
    tag: "02 / RULES",
    title: "Compose triggers without code",
    body:
      "Combine price, funding, order flow, on-chain signals, and macro indicators with AND/OR logic. No Python. No webhooks.",
  },
  {
    tag: "03 / EXECUTION",
    title: "Agent-routed, you stay in control",
    body:
      "Hyperliquid Agent Wallet executes; your main wallet keeps custody. Position limits, daily caps, instant pause — built in.",
  },
];
