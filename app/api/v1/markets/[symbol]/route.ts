import { NextResponse } from "next/server";
import { getMarketBySymbol } from "@/lib/hyperliquid/client";

/**
 * GET /api/v1/markets/:symbol
 *
 * Returns full real-time stats for a single perpetual pair.
 *
 * Response:
 *   {
 *     data: {
 *       symbol, assetIndex, maxLeverage, szDecimals,
 *       markPx, midPx, oraclePx, prevDayPx,
 *       funding, openInterest,
 *       dayNtlVlm, dayBaseVlm,
 *       premium,
 *     },
 *     meta: { source, fetchedAt }
 *   }
 *
 * Returns 404 if symbol unknown.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase();

  try {
    const market = await getMarketBySymbol(symbol);

    if (!market) {
      return NextResponse.json(
        { error: "Market not found", symbol },
        { status: 404 }
      );
    }

    const { meta, ctx, assetIndex } = market;

    return NextResponse.json(
      {
        data: {
          symbol: meta.name,
          assetIndex,
          maxLeverage: meta.maxLeverage,
          szDecimals: meta.szDecimals,
          onlyIsolated: meta.onlyIsolated ?? false,

          markPx: parseFloat(ctx.markPx),
          midPx: ctx.midPx ? parseFloat(ctx.midPx) : null,
          oraclePx: parseFloat(ctx.oraclePx),
          prevDayPx: parseFloat(ctx.prevDayPx),

          funding: parseFloat(ctx.funding),
          openInterest: parseFloat(ctx.openInterest),

          dayNtlVlm: parseFloat(ctx.dayNtlVlm),
          dayBaseVlm: parseFloat(ctx.dayBaseVlm),

          premium: parseFloat(ctx.premium),
        },
        meta: {
          source: "hyperliquid",
          fetchedAt: new Date().toISOString(),
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
      { error: "Failed to fetch market", detail: message, symbol },
      { status: 502 }
    );
  }
}
