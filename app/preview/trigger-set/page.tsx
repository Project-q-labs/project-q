"use client";

import { useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Tag = "Funding" | "Order Flow" | "Order Book" | "Volatility" | "Momentum" | "Mean Reversion" | "Multi-condition";
type Difficulty = "Beginner" | "Intermediate" | "Advanced";

type PresetTrigger = {
  id: string;
  source: "Project Q" | string; // "Project Q" for official, else username
  name: string;
  description: string;
  symbol: string;
  conditions: string[]; // human-readable
  action: string;
  tags: Tag[];
  difficulty: Difficulty;
  uses: number; // how many users adopted this
  fires30d: number; // how often it fires
  likes: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────
const FEATURED_PRESETS: PresetTrigger[] = [
  {
    id: "preset-1",
    source: "Project Q",
    name: "BTC funding extreme — short",
    description: "When BTC funding APR spikes above 25%, longs are paying too much. Fade the crowd.",
    symbol: "BTC",
    conditions: ["BTC Funding APR > 25%"],
    action: "Short 5% portfolio",
    tags: ["Funding", "Mean Reversion"],
    difficulty: "Beginner",
    uses: 142,
    fires30d: 3,
    likes: 28,
  },
  {
    id: "preset-2",
    source: "Project Q",
    name: "DOGE crowded long fade",
    description: "DOGE perpetuals often see funding above 30%. Classic crowded-long setup.",
    symbol: "DOGE",
    conditions: ["DOGE Funding APR > 30%"],
    action: "Short 3% portfolio",
    tags: ["Funding", "Mean Reversion"],
    difficulty: "Beginner",
    uses: 89,
    fires30d: 5,
    likes: 41,
  },
  {
    id: "preset-3",
    source: "Project Q",
    name: "SOL momentum entry",
    description: "Strong buy pressure (>60% buy flow) often precedes continuation. Ride the wave.",
    symbol: "SOL",
    conditions: ["SOL Buy Flow > 60%"],
    action: "Long 5% portfolio",
    tags: ["Order Flow", "Momentum"],
    difficulty: "Intermediate",
    uses: 67,
    fires30d: 12,
    likes: 18,
  },
  {
    id: "preset-4",
    source: "Project Q",
    name: "HYPE breakout buy",
    description: "Buy HYPE if it breaks above $45 with confirming order flow.",
    symbol: "HYPE",
    conditions: ["HYPE Price > $45", "HYPE Buy Flow > 55%"],
    action: "Long 10% portfolio",
    tags: ["Multi-condition", "Momentum"],
    difficulty: "Intermediate",
    uses: 52,
    fires30d: 1,
    likes: 22,
  },
  {
    id: "preset-5",
    source: "Project Q",
    name: "ETH oversold bounce",
    description: "When ETH funding goes negative and recent fills are buy-heavy, look for a bounce.",
    symbol: "ETH",
    conditions: ["ETH Funding APR < -5%", "ETH Buy Flow > 55%"],
    action: "Long 5% portfolio",
    tags: ["Funding", "Multi-condition"],
    difficulty: "Advanced",
    uses: 31,
    fires30d: 2,
    likes: 15,
  },
  {
    id: "preset-6",
    source: "Project Q",
    name: "BTC orderbook imbalance",
    description: "When bid depth heavily outweighs ask depth (>20%), short-term upside likely.",
    symbol: "BTC",
    conditions: ["BTC OB Imbalance > 20%"],
    action: "Long 3% portfolio",
    tags: ["Order Book", "Mean Reversion"],
    difficulty: "Advanced",
    uses: 18,
    fires30d: 8,
    likes: 9,
  },
];

const COMMUNITY_TRIGGERS: PresetTrigger[] = [
  {
    id: "comm-1",
    source: "0xWhale_Hunter",
    name: "Mega liquidation reversal",
    description: "When market-wide liquidations spike and buy flow returns, contrarian long.",
    symbol: "BTC",
    conditions: ["BTC Buy Flow > 60%"],
    action: "Long 5% portfolio",
    tags: ["Order Flow", "Mean Reversion"],
    difficulty: "Advanced",
    uses: 76,
    fires30d: 4,
    likes: 34,
  },
  {
    id: "comm-2",
    source: "QuantTrader_42",
    name: "Funding flip ETH long",
    description: "ETH funding flipping from positive to negative often marks local bottoms.",
    symbol: "ETH",
    conditions: ["ETH Funding APR < 0%"],
    action: "Long 4% portfolio",
    tags: ["Funding"],
    difficulty: "Intermediate",
    uses: 45,
    fires30d: 6,
    likes: 19,
  },
  {
    id: "comm-3",
    source: "SignalSeeker",
    name: "SOL high-funding short",
    description: "SOL with 15%+ funding APR has historically corrected. Fade.",
    symbol: "SOL",
    conditions: ["SOL Funding APR > 15%"],
    action: "Short 3% portfolio",
    tags: ["Funding", "Mean Reversion"],
    difficulty: "Beginner",
    uses: 38,
    fires30d: 8,
    likes: 12,
  },
];

const TAG_COLORS: Record<Tag, string> = {
  "Funding": "border-blue-500/40 bg-blue-500/10 text-blue-300",
  "Order Flow": "border-purple-500/40 bg-purple-500/10 text-purple-300",
  "Order Book": "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  "Volatility": "border-orange-500/40 bg-orange-500/10 text-orange-300",
  "Momentum": "border-signal/40 bg-signal/10 text-signal",
  "Mean Reversion": "border-red-500/40 bg-red-500/10 text-red-300",
  "Multi-condition": "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Beginner: "text-signal",
  Intermediate: "text-amber-300",
  Advanced: "text-red-300",
};

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
function GlobeIcon() { return <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth="1.5"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" strokeWidth="1.5"/></svg>; }
function GearIcon() { return <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" strokeWidth="1.5"/><path d="M19 12a7 7 0 01-.1 1.2l2.1 1.7-2 3.5-2.5-1a7 7 0 01-2.1 1.2l-.4 2.6h-4l-.4-2.6a7 7 0 01-2.1-1.2l-2.5 1-2-3.5 2.1-1.7A7 7 0 015 12c0-.4 0-.8.1-1.2L3 9.1l2-3.5 2.5 1a7 7 0 012.1-1.2L10 2.8h4l.4 2.6a7 7 0 012.1 1.2l2.5-1 2 3.5-2.1 1.7c.1.4.1.8.1 1.2z" strokeWidth="1.5"/></svg>; }
function HamburgerIcon() { return <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="1.5"/></svg>; }
function HeartIcon({ filled }: { filled?: boolean }) { return <svg className="h-3.5 w-3.5" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" strokeWidth="1.5"/></svg>; }
function UseIcon() { return <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeWidth="1.5"/></svg>; }

function IconButton({ children, title }: { children: React.ReactNode; title?: string }) {
  return <button className="border border-bg-line p-1.5 text-ink-mute hover:text-ink" title={title}>{children}</button>;
}

// ═════════════════════════════════════════════════════════════════════════════
// Main page
// ═════════════════════════════════════════════════════════════════════════════
export default function TriggerSetPreviewPage() {
  const [activeTab, setActiveTab] = useState<"featured" | "community" | "mine">("featured");
  const [selectedTag, setSelectedTag] = useState<Tag | "all">("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | "all">("all");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const allTriggers = activeTab === "featured" ? FEATURED_PRESETS : activeTab === "community" ? COMMUNITY_TRIGGERS : [];
  const filtered = allTriggers.filter((p) => {
    if (selectedTag !== "all" && !p.tags.includes(selectedTag)) return false;
    if (selectedDifficulty !== "all" && p.difficulty !== selectedDifficulty) return false;
    return true;
  });

  const toggleLike = (id: string) => {
    const next = new Set(likedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLikedIds(next);
  };

  const handleUseTrigger = (preset: PresetTrigger) => {
    alert(
      `📌 Demo: Use this trigger\n\nIn V1, this navigates to /trade/${preset.symbol} with the rule pre-filled in the Trigger panel. User reviews, optionally adjusts, then clicks "Save as Rule" to activate.\n\nRule: ${preset.name}\nConditions: ${preset.conditions.join(", ")}\nAction: ${preset.action}`
    );
  };

  return (
    <main className="min-h-dvh bg-bg text-ink">
      {/* ═════════════════ DESKTOP HEADER ═════════════════ */}
      <header className="hidden border-b border-bg-line lg:block">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-mono text-sm">
              <span className="text-signal">●</span><span className="font-medium">PROJECT.Q</span>
            </Link>
            <nav className="flex gap-6">
              <Link href="/preview/trade" className="text-sm text-ink-mute hover:text-ink">Trade</Link>
              <a href="#" onClick={(e) => e.preventDefault()} className="text-sm text-ink-mute hover:text-ink">Portfolio</a>
              <a href="#" onClick={(e) => e.preventDefault()} className="text-sm text-ink-mute hover:text-ink">Referrals</a>
              <a href="#" onClick={(e) => e.preventDefault()} className="text-sm text-ink-mute hover:text-ink">Leaderboard</a>
              <span className="text-sm text-signal">Trigger Set</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button className="border border-signal/60 bg-signal/10 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-signal hover:bg-signal/20">Connect</button>
            <IconButton title="Language"><GlobeIcon /></IconButton>
            <IconButton title="Settings"><GearIcon /></IconButton>
          </div>
        </div>
      </header>

      {/* ═════════════════ MOBILE HEADER ═════════════════ */}
      <header className="border-b border-bg-line lg:hidden">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-3">
            <button className="text-ink-mute"><HamburgerIcon /></button>
            <Link href="/" className="flex items-center gap-1.5 font-mono text-sm">
              <span className="text-signal">●</span><span className="font-medium">PROJECT.Q</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button className="border border-signal/60 bg-signal/10 px-3 py-1.5 font-mono text-xs uppercase text-signal">Connect</button>
            <IconButton title="Language"><GlobeIcon /></IconButton>
            <IconButton title="Settings"><GearIcon /></IconButton>
          </div>
        </div>
      </header>

      {/* Preview banner */}
      <div className="border-b border-bg-line bg-bg-panel/40 px-4 py-2">
        <span className="font-mono text-[11px] text-signal">▶ PREVIEW</span>
        <span className="font-mono text-[11px] text-ink-faint"> · </span>
        <span className="font-mono text-[11px] text-ink-mute">Trigger Set mockup (W2 Day 13 v10) — preset & community sharing space</span>
      </div>

      {/* ═════════════════ PAGE CONTENT ═════════════════ */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:py-10">

        {/* Hero / Intro */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight lg:text-3xl">Trigger Set</h1>
          <p className="mt-2 text-sm text-ink-mute">
            Curated presets and community-shared trigger rules. Use any setup with one click.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 border border-amber-500/30 bg-amber-500/5 px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-amber-300">V1 alpha</span>
            <span className="text-[11px] text-ink-mute">Browse + use. V2+ adds publishing, likes, and referral rewards for trigger authors.</span>
          </div>
        </div>

        {/* Tab switcher: Featured / Community / Mine */}
        <div className="mb-6 flex gap-px border-b border-bg-line">
          {([
            { id: "featured", label: "Featured Presets", count: FEATURED_PRESETS.length },
            { id: "community", label: "Community", count: COMMUNITY_TRIGGERS.length },
            { id: "mine", label: "My Triggers", count: 0 },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 font-mono text-xs uppercase tracking-[0.1em] ${
                activeTab === tab.id ? "border-b-2 border-signal text-signal" : "text-ink-mute hover:text-ink"
              }`}
            >
              {tab.label} <span className="ml-1 text-ink-faint">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        {activeTab !== "mine" && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">Filter:</span>

            {/* Tag filter */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedTag("all")}
                className={`border px-2.5 py-1 font-mono text-[10px] uppercase ${
                  selectedTag === "all" ? "border-signal bg-signal/10 text-signal" : "border-bg-line text-ink-mute hover:text-ink"
                }`}
              >
                All
              </button>
              {(["Funding", "Order Flow", "Order Book", "Momentum", "Mean Reversion", "Multi-condition"] as Tag[]).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`border px-2.5 py-1 font-mono text-[10px] uppercase ${
                    selectedTag === tag ? TAG_COLORS[tag] : "border-bg-line text-ink-mute hover:text-ink"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <span className="text-ink-faint">|</span>

            {/* Difficulty filter */}
            <div className="flex gap-1.5">
              {(["all", "Beginner", "Intermediate", "Advanced"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDifficulty(d)}
                  className={`border px-2.5 py-1 font-mono text-[10px] uppercase ${
                    selectedDifficulty === d ? "border-signal bg-signal/10 text-signal" : "border-bg-line text-ink-mute hover:text-ink"
                  }`}
                >
                  {d === "all" ? "All levels" : d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trigger cards grid */}
        {activeTab === "mine" ? (
          <div className="flex flex-col items-center justify-center border border-bg-line bg-bg-panel/30 py-16 text-center">
            <div className="text-4xl">📝</div>
            <p className="mt-3 text-sm text-ink-mute">No saved triggers yet</p>
            <p className="mt-1 text-[11px] text-ink-faint">Go to the Trade page and save a rule to see it here.</p>
            <Link href="/preview/trade" className="mt-4 border border-signal bg-signal/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-signal hover:bg-signal/20">
              Go to Trade →
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-bg-line bg-bg-panel/30 py-12 text-center text-ink-faint">
            No triggers match your filters.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((preset) => (
              <TriggerCard
                key={preset.id}
                preset={preset}
                liked={likedIds.has(preset.id)}
                onLike={() => toggleLike(preset.id)}
                onUse={() => handleUseTrigger(preset)}
              />
            ))}
          </div>
        )}

        {/* V2 teaser */}
        <div className="mt-12 border border-bg-line bg-bg-panel/30 p-6">
          <h3 className="font-mono text-sm uppercase tracking-[0.15em] text-amber-300">Coming in V2</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-mute">
            <li>• Publish your own triggers and earn referral rewards when others use them</li>
            <li>• Backtest each preset with real historical data (P&L, drawdown, win rate)</li>
            <li>• Like, comment, fork community triggers</li>
            <li>• Leaderboard for top performing trigger authors</li>
          </ul>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar (for parity with /preview/trade) */}
      <div className="lg:hidden">
        <BottomTabBar />
      </div>
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Trigger card
// ═════════════════════════════════════════════════════════════════════════════
function TriggerCard({ preset, liked, onLike, onUse }: {
  preset: PresetTrigger;
  liked: boolean;
  onLike: () => void;
  onUse: () => void;
}) {
  return (
    <div className="flex flex-col border border-bg-line bg-bg-panel/30 p-4 transition hover:border-ink-faint">
      {/* Top — source + symbol */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            {preset.source === "Project Q" ? (
              <span className="border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-signal">
                Official
              </span>
            ) : (
              <span className="font-mono text-[10px] text-ink-mute">@{preset.source}</span>
            )}
          </div>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">{preset.symbol}</span>
      </div>

      {/* Title + description */}
      <div className="mt-2">
        <h3 className="font-medium tracking-tight">{preset.name}</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-mute">{preset.description}</p>
      </div>

      {/* Conditions + action */}
      <div className="mt-3 space-y-1.5 border-t border-bg-line pt-3">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">When</span>
          <div className="mt-0.5 space-y-0.5">
            {preset.conditions.map((c, i) => (
              <div key={i} className="font-mono text-[11px] text-ink">→ {c}</div>
            ))}
          </div>
        </div>
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">Then</span>
          <div className="mt-0.5 font-mono text-[11px] text-amber-300">→ {preset.action}</div>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1">
        {preset.tags.map((tag) => (
          <span key={tag} className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${TAG_COLORS[tag]}`}>
            {tag}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center justify-between border-t border-bg-line pt-3 font-mono text-[10px] text-ink-mute">
        <div className="flex items-center gap-3">
          <span title="Difficulty"><span className={DIFFICULTY_COLORS[preset.difficulty]}>●</span> {preset.difficulty}</span>
        </div>
        <div className="flex items-center gap-3">
          <span title="Times used">⚡ {preset.uses}</span>
          <span title="Fires per 30 days">{preset.fires30d}/mo</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onUse}
          className="flex-1 border border-signal bg-signal/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-signal transition hover:bg-signal/20"
        >
          <UseIcon /> <span className="ml-1.5 inline">Use this trigger</span>
        </button>
        <button
          onClick={onLike}
          className={`flex items-center gap-1 border px-2.5 py-2 font-mono text-[10px] transition ${
            liked ? "border-red-500/50 bg-red-500/10 text-red-300" : "border-bg-line text-ink-mute hover:text-ink"
          }`}
          title="Like"
        >
          <HeartIcon filled={liked} />
          <span>{preset.likes + (liked ? 1 : 0)}</span>
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Bottom Tab Bar (mobile only)
// ═════════════════════════════════════════════════════════════════════════════
function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-bg-line bg-bg">
      <div className="flex">
        <Link href="/preview/trade" className="flex flex-1 flex-col items-center gap-1 py-3 text-ink-mute">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 20V10M12 20V4M20 20V14" strokeWidth="2" strokeLinecap="round"/></svg>
          <span className="text-[11px]">Markets</span>
        </Link>
        <Link href="/preview/trade" className="flex flex-1 flex-col items-center gap-1 py-3 text-ink-mute">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" strokeWidth="2"/><circle cx="12" cy="12" r="9" strokeWidth="2"/></svg>
          <span className="text-[11px]">Trade</span>
        </Link>
        <Link href="/preview/trade" className="flex flex-1 flex-col items-center gap-1 py-3 text-ink-mute">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" strokeWidth="2"/><path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" strokeWidth="2"/></svg>
          <span className="text-[11px]">Account</span>
        </Link>
      </div>
    </nav>
  );
}
