import { NextResponse } from "next/server";
import { getMeta } from "@/lib/hyperliquid/client";

/**
 * GET /api/v1/markets
 *
 * Returns the full list of perpetual markets available on Hyperliquid,
 * with leverage limits and decimals config. Cached for 5 minutes upstream.
 *
 * Response:
 *   {
 *     data: [{ symbol, maxLeverage, szDecimals }, ...],
 *     meta: { count, source, fetchedAt }
 *   }
 */
export const revalidate = 300; // 5 min ISR cache

export async function GET() {
  try {
    const meta = await getMeta();

    const markets = meta.universe.map((u, idx) => ({
      symbol: u.name,
      assetIndex: idx,
      maxLeverage: u.maxLeverage,
      szDecimals: u.szDecimals,
      onlyIsolated: u.onlyIsolated ?? false,
    }));

    return NextResponse.json({
      data: markets,
      meta: {
        count: markets.length,
        source: "hyperliquid",
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch markets",
        detail: message,
      },
      { status: 502 }
    );
  }
}
