import { NextResponse } from "next/server";
import { getMetaAndAssetCtxs } from "@/lib/hyperliquid/client";

/**
 * GET /api/v1/markets
 *
 * Returns the full list of perpetual markets with real-time stats:
 * mark price, 24h change, funding, OI, volume, max leverage.
 *
 * One request = full market overview. Used by the markets list page
 * and any external client that needs a snapshot of all pairs.
 *
 * Response:
 *   {
 *     data: [{
 *       symbol, assetIndex, maxLeverage,
 *       markPx, prevDayPx, change24hPct,
 *       funding, fundingApr,
 *       openInterest, openInterestNotional,
 *       dayNtlVlm, dayBaseVlm
 *     }, ...],
 *     meta: { count, source, fetchedAt }
 *   }
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [meta, ctxs] = await getMetaAndAssetCtxs();

    const markets = meta.universe.map((u, idx) => {
      const ctx = ctxs[idx];
      const markPx = parseFloat(ctx.markPx);
      const prevDayPx = parseFloat(ctx.prevDayPx);
      const funding = parseFloat(ctx.funding);
      const openInterest = parseFloat(ctx.openInterest);

      const change24hPct =
        prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;

      // Funding rate is hourly on Hyperliquid; annualize: hourly * 24 * 365
      const fundingApr = funding * 24 * 365 * 100;

      return {
        symbol: u.name,
        assetIndex: idx,
        maxLeverage: u.maxLeverage,
        szDecimals: u.szDecimals,

        markPx,
        prevDayPx,
        change24hPct,

        funding,
        fundingApr,

        openInterest,
        openInterestNotional: openInterest * markPx,

        dayNtlVlm: parseFloat(ctx.dayNtlVlm),
        dayBaseVlm: parseFloat(ctx.dayBaseVlm),
      };
    });

    return NextResponse.json(
      {
        data: markets,
        meta: {
          count: markets.length,
          source: "hyperliquid",
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3, stale-while-revalidate=15",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch markets", detail: message },
      { status: 502 }
    );
  }
}
