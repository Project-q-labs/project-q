/**
 * Hyperliquid SDK wrappers — using @nktkas/hyperliquid.
 *
 * This module provides server-side helpers built on top of the official
 * community SDK. Complements the lightweight fetch-based client.ts; use
 * this module for new code requiring typed data + future WebSocket support.
 *
 * Docs: https://nktkas.gitbook.io/hyperliquid
 * SDK:  https://github.com/nktkas/hyperliquid
 *
 * Why SDK over raw fetch:
 *   - Full TypeScript types (no manual definition)
 *   - Auto-handles rate limiting (token bucket)
 *   - WebSocket support (M2 trigger worker)
 *   - Wallet integration (M3 order execution)
 */

import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";

// ─────────────────────────────────────────────────────────────────────────────
// Singleton clients (reused across requests)
// ─────────────────────────────────────────────────────────────────────────────

const transport = new HttpTransport();
export const info = new InfoClient({ transport });

// ─────────────────────────────────────────────────────────────────────────────
// Types — re-exported and extended
// ─────────────────────────────────────────────────────────────────────────────

export type Symbol = "BTC" | "ETH" | "SOL" | "HYPE" | "DOGE";

/**
 * Project Q symbols that we support in V1 alpha.
 * Adjust this list as we expand coverage.
 */
export const SUPPORTED_SYMBOLS: Symbol[] = ["BTC", "ETH", "SOL", "HYPE", "DOGE"];

/**
 * Snapshot of live market data for a single pair.
 * Mapped from Hyperliquid's metaAndAssetCtxs response into a clean shape.
 */
export type MarketSnapshot = {
  symbol: Symbol;
  markPx: number;
  oraclePx: number;
  midPx: number | null;
  basisPct: number; // (mark - oracle) / oracle * 100
  funding1hPct: number; // hourly funding rate as %
  fundingAprPct: number; // annualized (funding1h * 24 * 365)
  openInterestUsd: number; // OI in USD terms
  openInterestBase: number; // OI in base asset
  dayVolumeUsd: number; // 24h notional volume USD
  prevDayPx: number;
  changePct24h: number; // (mark / prevDay - 1) * 100
  maxLeverage: number;
  fetchedAt: number; // unix ms
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch one snapshot per supported symbol.
 *
 * Uses `metaAndAssetCtxs` (single API call) instead of multiple per-symbol
 * calls. Much cheaper for HL rate limiter.
 *
 * Returns a map keyed by symbol. Symbols not found in the HL universe are
 * omitted (rare — only if HL removes a listing).
 */
export async function getSnapshots(): Promise<Record<Symbol, MarketSnapshot>> {
  const [meta, ctxs] = await info.metaAndAssetCtxs();
  const out = {} as Record<Symbol, MarketSnapshot>;
  const now = Date.now();

  for (const sym of SUPPORTED_SYMBOLS) {
    const idx = meta.universe.findIndex((u) => u.name === sym);
    if (idx === -1) continue;

    const ctx = ctxs[idx];
    const u = meta.universe[idx];

    const markPx = parseFloat(ctx.markPx);
    const oraclePx = parseFloat(ctx.oraclePx);
    const midPx = ctx.midPx ? parseFloat(ctx.midPx) : null;
    const prevDayPx = parseFloat(ctx.prevDayPx);
    const funding1h = parseFloat(ctx.funding);

    out[sym] = {
      symbol: sym,
      markPx,
      oraclePx,
      midPx,
      basisPct: oraclePx > 0 ? ((markPx - oraclePx) / oraclePx) * 100 : 0,
      funding1hPct: funding1h * 100,
      fundingAprPct: funding1h * 100 * 24 * 365,
      openInterestUsd: parseFloat(ctx.openInterest) * markPx,
      openInterestBase: parseFloat(ctx.openInterest),
      dayVolumeUsd: parseFloat(ctx.dayNtlVlm),
      prevDayPx,
      changePct24h: prevDayPx > 0 ? ((markPx / prevDayPx) - 1) * 100 : 0,
      maxLeverage: u.maxLeverage,
      fetchedAt: now,
    };
  }

  return out;
}

/**
 * Fetch a single snapshot by symbol. Convenience wrapper around getSnapshots.
 * Returns null if the symbol is not in the HL universe.
 */
export async function getSnapshot(symbol: Symbol): Promise<MarketSnapshot | null> {
  const all = await getSnapshots();
  return all[symbol] ?? null;
}
