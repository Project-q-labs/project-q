"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type UTCTimestamp,
  type IPriceLine,
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

/**
 * Price line for visualizing saved trigger rules on the chart.
 * Each line has an ID so users can click and identify which rule it represents.
 */
export type PriceLine = {
  id: string;
  price: number;
  label: string; // e.g. "Trigger: BTC > $100k"
  color?: string;
};

type Props = {
  candles: CandleData[];
  height?: number;
  priceLines?: PriceLine[];
  onPriceLineClick?: (lineId: string) => void;
  hideHeader?: boolean;
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
export function CandleChart({ candles, height = 400, priceLines = [], onPriceLineClick, hideHeader = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const onClickRef = useRef(onPriceLineClick);
  onClickRef.current = onPriceLineClick;

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
      priceLinesRef.current = new Map();
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

  // Sync price lines (trigger visualizations)
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    const currentMap = priceLinesRef.current;

    // Remove price lines that no longer exist in props
    const incomingIds = new Set(priceLines.map((p) => p.id));
    currentMap.forEach((line, id) => {
      if (!incomingIds.has(id)) {
        series.removePriceLine(line);
        currentMap.delete(id);
      }
    });

    // Add or update price lines
    priceLines.forEach((p) => {
      const existing = currentMap.get(p.id);
      const options = {
        price: p.price,
        color: p.color ?? "#f59e0b", // amber-500
        lineWidth: 2 as 1 | 2 | 3 | 4,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: p.label,
      };
      if (existing) {
        existing.applyOptions(options);
      } else {
        const line = series.createPriceLine(options);
        currentMap.set(p.id, line);
      }
    });
  }, [priceLines]);

  // Handle clicks on price lines — lightweight-charts doesn't natively support
  // per-line click handlers, so we approximate by checking click coordinates.
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    const chart = chartRef.current;
    const series = seriesRef.current;

    const handler = (param: { point?: { x: number; y: number } }) => {
      if (!param.point || !onClickRef.current) return;
      const clickPrice = series.coordinateToPrice(param.point.y);
      if (clickPrice === null) return;

      // Find the nearest price line within a tolerance band
      let nearest: { id: string; distance: number } | null = null;
      priceLines.forEach((p) => {
        const distance = Math.abs(p.price - Number(clickPrice));
        const tolerance = p.price * 0.005; // 0.5%
        if (distance < tolerance && (!nearest || distance < nearest.distance)) {
          nearest = { id: p.id, distance };
        }
      });

      if (nearest !== null) {
        const found = nearest as { id: string; distance: number };
        onClickRef.current(found.id);
      }
    };

    chart.subscribeClick(handler);
    return () => {
      chart.unsubscribeClick(handler);
    };
  }, [priceLines]);

  if (hideHeader) {
    return <div ref={containerRef} style={{ height }} className="w-full" />;
  }

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
