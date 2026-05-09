import { NextResponse } from "next/server";
import { getFundingHistory } from "@/lib/hyperliquid/client";

/**
 * GET /api/v1/markets/:symbol/funding?days=7
 *
 * Returns hourly funding rate history for the past N days (default 7).
 *
 * Response:
 *   {
 *     data: {
 *       symbol,
 *       entries: [{ time, fundingRate, premium }, ...],   // chronological
 *       summary: {
 *         currentFunding,
 *         averageFunding7d,
 *         averageFundingApr7d,
 *         minFunding,
 *         maxFunding,
 *         positiveHours,    // # of hours where funding > 0 (longs paid shorts)
 *         negativeHours,    // # of hours where funding < 0
 *         totalSampleSize,
 *       }
 *     },
 *     meta: { source, fetchedAt, lookbackDays }
 *   }
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase();
  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10), 1), 30) : 7;

  const endTimeMs = Date.now();
  const startTimeMs = endTimeMs - days * 24 * 60 * 60 * 1000;

  try {
    const entries = await getFundingHistory(symbol, startTimeMs, endTimeMs);

    // Convert string rates to numbers and sort chronologically
    const normalized = entries
      .map((e) => ({
        time: e.time,
        fundingRate: parseFloat(e.fundingRate),
        premium: parseFloat(e.premium),
      }))
      .sort((a, b) => a.time - b.time);

    if (normalized.length === 0) {
      return NextResponse.json(
        {
          data: {
            symbol,
            entries: [],
            summary: null,
          },
          meta: {
            source: "hyperliquid",
            fetchedAt: new Date().toISOString(),
            lookbackDays: days,
          },
        },
        { status: 200 }
      );
    }

    const fundings = normalized.map((e) => e.fundingRate);
    const sum = fundings.reduce((acc, v) => acc + v, 0);
    const avg = sum / fundings.length;
    const min = Math.min(...fundings);
    const max = Math.max(...fundings);
    const positiveHours = fundings.filter((v) => v > 0).length;
    const negativeHours = fundings.filter((v) => v < 0).length;
    const current = normalized[normalized.length - 1].fundingRate;

    return NextResponse.json(
      {
        data: {
          symbol,
          entries: normalized,
          summary: {
            currentFunding: current,
            averageFunding7d: avg,
            averageFundingApr7d: avg * 24 * 365 * 100,
            minFunding: min,
            maxFunding: max,
            positiveHours,
            negativeHours,
            totalSampleSize: fundings.length,
          },
        },
        meta: {
          source: "hyperliquid",
          fetchedAt: new Date().toISOString(),
          lookbackDays: days,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch funding history", detail: message, symbol },
      { status: 502 }
    );
  }
}
