"use client";

import { useEffect, useState } from "react";
import { CandleChart, generateSyntheticCandles, type CandleData } from "./CandleChart";

/**
 * Wraps CandleChart with synthetic data generation for the M1 preview stub.
 *
 * Why a wrapper: synthetic data uses Math.random() and Date.now(), which
 * would produce different output on server vs client and break hydration.
 * Generating in useEffect (client-only) keeps the SSR HTML stable.
 *
 * In M1, this file goes away — the page will fetch real candles via the
 * Hyperliquid `candleSnapshot` REST endpoint and pass them to <CandleChart>
 * directly.
 */
type Props = {
  symbol: string;
};

// Rough starting prices to make the stub look reasonable per coin.
const BASE_PRICES: Record<string, number> = {
  BTC: 95000,
  ETH: 3400,
  SOL: 175,
  HYPE: 28,
};

export function CandleChartPreview({ symbol }: Props) {
  const [candles, setCandles] = useState<CandleData[]>([]);

  useEffect(() => {
    const startPrice = BASE_PRICES[symbol] ?? 100;
    setCandles(generateSyntheticCandles(60, startPrice, 3600));
  }, [symbol]);

  return <CandleChart candles={candles} height={360} />;
}
