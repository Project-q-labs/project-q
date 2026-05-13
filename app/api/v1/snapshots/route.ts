import { NextResponse } from "next/server";
import { getSnapshots } from "@/lib/hyperliquid/sdk";

/**
 * GET /api/v1/snapshots
 *
 * Returns rich market data for all supported symbols (BTC, ETH, SOL, HYPE, DOGE).
 *
 * Used by the Trade page to populate the top stat bar and the Funding/OI
 * signal cards with live data instead of mocks.
 *
 * Response shape (per symbol):
 *   {
 *     symbol: "BTC",
 *     markPx: 80883.5,
 *     oraclePx: 80877,
 *     basisPct: 0.0074,
 *     funding1hPct: 0.0046,
 *     fundingAprPct: 11.04,
 *     openInterestUsd: 3420000000,
 *     dayVolumeUsd: 260622586,
 *     changePct24h: -3.31,
 *     ...
 *   }
 *
 * Cache strategy:
 *   - 2 sec edge cache + 10 sec stale-while-revalidate
 *   - Even with many simultaneous users, HL gets at most one call every 2 sec
 *   - Clients poll every 5 sec → always get fresh data within 2 sec window
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const snapshots = await getSnapshots();

    return NextResponse.json(
      {
        data: snapshots,
        meta: {
          source: "hyperliquid",
          fetchedAt: new Date().toISOString(),
          symbolCount: Object.keys(snapshots).length,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=2, stale-while-revalidate=10",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch market snapshots",
        detail: message,
      },
      { status: 502 }
    );
  }
}
