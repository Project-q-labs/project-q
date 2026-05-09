/**
 * Hyperliquid REST API client.
 *
 * Wraps the official Hyperliquid public API endpoints. No API key required
 * for read operations. Uses POST requests (Hyperliquid convention).
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

const API_URL = process.env.HYPERLIQUID_API_URL ?? "https://api.hyperliquid.xyz";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Universe = {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
};

export type Meta = {
  universe: Universe[];
};

/**
 * Asset context — per-pair real-time stats.
 *
 * All numeric fields come as strings from the API; cast to number at use site.
 *
 *   funding         → current funding rate (e.g. "0.0000125" = 0.00125% per hour)
 *   openInterest    → total open interest, in base asset
 *   prevDayPx       → mark price 24 hours ago
 *   dayNtlVlm       → 24h notional volume in USD
 *   dayBaseVlm      → 24h volume in base asset
 *   premium         → mark - oracle / oracle (small number)
 *   oraclePx        → oracle price
 *   markPx          → mark price (used for PnL)
 *   midPx           → mid of best bid/ask
 *   impactPxs       → [bestBid, bestAsk] approximated impact prices
 */
export type AssetCtx = {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  dayBaseVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx?: string;
  impactPxs?: [string, string];
};

export type MetaAndAssetCtxs = [Meta, AssetCtx[]];

export type CandleSnapshot = Array<{
  t: number; // open time, ms
  T: number; // close time, ms
  s: string; // symbol
  i: string; // interval
  o: string; // open
  c: string; // close
  h: string; // high
  l: string; // low
  v: string; // volume in base asset
  n: number; // trade count
}>;

// ─────────────────────────────────────────────────────────────────────────────
// API methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch perpetuals metadata (list of all available pairs and their config).
 */
export async function getMeta(): Promise<Meta> {
  const res = await fetch(`${API_URL}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`Hyperliquid meta failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch all mid prices (mark prices) keyed by coin name.
 */
export async function getAllMids(): Promise<Record<string, string>> {
  const res = await fetch(`${API_URL}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Hyperliquid allMids failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch meta and asset contexts in one call. This is the most efficient way
 * to get full per-pair stats (funding, OI, 24h volume, etc.).
 *
 * Returns a tuple: [meta, assetCtxs] where assetCtxs[i] corresponds to
 * meta.universe[i].
 */
export async function getMetaAndAssetCtxs(): Promise<MetaAndAssetCtxs> {
  const res = await fetch(`${API_URL}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Hyperliquid metaAndAssetCtxs failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Resolve a single pair's metadata + context by symbol (e.g. "BTC", "ETH").
 *
 * Returns null if the symbol is not found in Hyperliquid's universe.
 */
export async function getMarketBySymbol(symbol: string): Promise<{
  meta: Universe;
  ctx: AssetCtx;
  assetIndex: number;
} | null> {
  const [meta, ctxs] = await getMetaAndAssetCtxs();
  const idx = meta.universe.findIndex(
    (u) => u.name.toLowerCase() === symbol.toLowerCase()
  );

  if (idx === -1) return null;

  return {
    meta: meta.universe[idx],
    ctx: ctxs[idx],
    assetIndex: idx,
  };
}

/**
 * Fetch candlesticks for a pair / interval / time window.
 *
 * Intervals: "1m", "5m", "15m", "1h", "4h", "1d"
 */
export async function getCandles(
  symbol: string,
  interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d",
  startTimeMs: number,
  endTimeMs: number
): Promise<CandleSnapshot> {
  const res = await fetch(`${API_URL}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin: symbol,
        interval,
        startTime: startTimeMs,
        endTime: endTimeMs,
      },
    }),
    next: { revalidate: 30 }, // 30 sec cache; client polls fresh
  });

  if (!res.ok) {
    throw new Error(`Hyperliquid candles failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Single funding history entry from Hyperliquid.
 *
 *   coin           → symbol (e.g. "BTC")
 *   fundingRate    → funding rate as string (e.g. "0.0000125" = 0.00125%/h)
 *   premium        → mark - oracle / oracle at funding time
 *   time           → timestamp in milliseconds
 */
export type FundingHistoryEntry = {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
};

/**
 * Fetch hourly funding rate history for a pair.
 *
 * Hyperliquid pays funding every hour. This endpoint returns historical
 * funding rates between startTime and endTime (defaults to last 7 days).
 *
 * Most recent entries first? — Actually Hyperliquid returns them in
 * chronological order (oldest first). We sort at use site if needed.
 */
export async function getFundingHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs?: number
): Promise<FundingHistoryEntry[]> {
  const body: Record<string, unknown> = {
    type: "fundingHistory",
    coin: symbol,
    startTime: startTimeMs,
  };
  if (endTimeMs !== undefined) body.endTime = endTimeMs;

  const res = await fetch(`${API_URL}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 60 }, // 1 min cache
  });

  if (!res.ok) {
    throw new Error(`Hyperliquid fundingHistory failed: ${res.status}`);
  }
  return res.json();
}
