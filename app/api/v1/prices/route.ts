import { NextResponse } from "next/server";
import { getAllMids } from "@/lib/hyperliquid/client";

/**
 * GET /api/v1/prices
 *
 * Returns current mid prices for all Hyperliquid perpetual markets.
 * Always fresh (no cache). Intended for ticker/dashboard polling at
 * 5-second intervals.
 *
 * Response:
 *   {
 *     data: [{ symbol, mid }, ...],
 *     meta: { count, source, fetchedAt }
 *   }
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const mids = await getAllMids();

    const prices = Object.entries(mids).map(([symbol, mid]) => ({
      symbol,
      mid: parseFloat(mid),
    }));

    return NextResponse.json(
      {
        data: prices,
        meta: {
          count: prices.length,
          source: "hyperliquid",
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        headers: {
          // Allow short edge caching to absorb traffic spikes; clients
          // can still poll fresh every 5s.
          "Cache-Control": "public, s-maxage=2, stale-while-revalidate=10",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch prices",
        detail: message,
      },
      { status: 502 }
    );
  }
}
