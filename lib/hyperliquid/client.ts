/**
 * Hyperliquid REST API client.
 *
 * Wraps the official Hyperliquid public API endpoints. No API key required
 * for read operations. Uses POST requests (Hyperliquid convention).
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 *
 * NOTE: M0 placeholder. M1 (Week 3-4) adds caching, retry logic,
 * and WebSocket subscription manager.
 */

const API_URL = process.env.HYPERLIQUID_API_URL ?? "https://api.hyperliquid.xyz";

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
 * Fetch perpetuals metadata (list of all available pairs and their config).
 */
export async function getMeta(): Promise<Meta> {
  const res = await fetch(`${API_URL}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
    next: { revalidate: 300 }, // Cache for 5 min
  });

  if (!res.ok) {
    throw new Error(`Hyperliquid meta fetch failed: ${res.status}`);
  }

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
    cache: "no-store", // Real-time prices, never cache
  });

  if (!res.ok) {
    throw new Error(`Hyperliquid allMids fetch failed: ${res.status}`);
  }

  return res.json();
}
