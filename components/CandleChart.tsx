"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

/**
 * Candle data shape that maps directly from Hyperliquid's `candleSnapshot`
 * REST response (keys renamed to be readable):
 *
 *   Hyperliquid: { t: 1700000000000, o: 95000, h: 95500, l: 94800, c: 95300, ... }
 *   Our shape:   { time: 1700000000,  open: 95000, high: 95500, low: 94800, close: 95300 }
 *
 * Note: `time` is seconds (UTCTimestamp), not milliseconds. We divide by 1000
 * when transforming Hyperliquid data in M1.
 */
export type CandleData = {
  time: number; // seconds since epoch
  open: number;
  high: number;
  low: number;
  close: number;
};

type Props = {
  candles: CandleData[];
  height?: number;
};

/**
 * Stub candlestick chart — Day 9 PM.
 *
 * Builds and renders correctly with lightweight-charts v5. M1 will:
 *  - Replace the synthetic candles with `candleSnapshot` REST data
 *  - Subscribe to WS `candle` channel for live updates
 *  - Add interval toggle (1m/5m/15m/1h/4h/1d)
 *  - Add "Powered by TradingView" attribution per the library's license
 */
export function CandleChart({ candles, height = 400 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);

  // Create chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af", // text-zinc-400
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1f2937" }, // zinc-800-ish
        horzLines: { color: "#1f2937" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#374151", // zinc-700
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
      crosshair: {
        mode: 0, // Normal crosshair
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", // emerald-500
      downColor: "#ef4444", // red-500
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    seriesRef.current = series;

    // Resize observer for responsive width
    const resizeObserver = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  // Update data when candles prop changes
  useEffect(() => {
    if (!seriesRef.current) return;
    const data: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">
          Candle Chart{" "}
          <span className="text-xs font-normal text-zinc-500">
            (M1 stub — synthetic data)
          </span>
        </h3>
        <span className="text-[10px] text-zinc-600">
          Powered by TradingView
        </span>
      </div>
      <div ref={containerRef} style={{ height }} />
    </div>
  );
}

/**
 * Generate plausible-looking synthetic candles for the stub demo.
 * Random walk anchored to a starting price.
 */
export function generateSyntheticCandles(
  count: number,
  startPrice: number,
  intervalSeconds: number = 3600
): CandleData[] {
  const candles: CandleData[] = [];
  let prev = startPrice;
  const nowSec = Math.floor(Date.now() / 1000);
  const startTime = nowSec - count * intervalSeconds;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalSeconds;
    const drift = (Math.random() - 0.48) * prev * 0.015; // slight upward bias
    const open = prev;
    const close = Math.max(prev + drift, prev * 0.97);
    const high = Math.max(open, close) + Math.random() * prev * 0.005;
    const low = Math.min(open, close) - Math.random() * prev * 0.005;
    candles.push({ time, open, high, low, close });
    prev = close;
  }

  return candles;
}
