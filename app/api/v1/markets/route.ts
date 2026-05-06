import { NextResponse } from "next/server";

/**
 * GET /api/v1/markets
 *
 * Lists supported trading pairs.
 *
 * NOTE: v0 placeholder. M1 (Week 3-4) replaces this with live Hyperliquid
 * meta-data via WebSocket-cached data in Upstash Redis.
 */
export async function GET() {
  // Placeholder static list — to be replaced with live Hyperliquid meta query
  const markets = [
    { symbol: "BTC", maxLeverage: 50, status: "active" },
    { symbol: "ETH", maxLeverage: 50, status: "active" },
    { symbol: "SOL", maxLeverage: 25, status: "active" },
    { symbol: "HYPE", maxLeverage: 10, status: "active" },
  ];

  return NextResponse.json({
    data: markets,
    meta: {
      count: markets.length,
      source: "placeholder",
      cachedAt: null,
    },
  });
}
