"use client";

import { useEffect, useRef } from "react";

type Props = {
  symbol: string;
};

/**
 * TradingView Advanced Chart widget embed.
 *
 * Symbol resolution:
 *   We map Hyperliquid pairs to a TradingView symbol of the form
 *   "<EXCHANGE>:<PAIR>" — defaulting to BINANCE perp data, since TV doesn't
 *   yet have native Hyperliquid feeds. The chart is for visualization only;
 *   actual mark/oracle prices in our header & stats come from Hyperliquid.
 *
 *   For pairs without a Binance perp listing (e.g. HYPE), we fall back to
 *   a spot listing or to a rotation of available exchanges.
 */
export function PriceChart({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvId = `tv-chart-${symbol.toLowerCase()}`;

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any prior widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";

    const tvSymbol = mapToTradingViewSymbol(symbol);

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1", // candles
      locale: "en",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      withdateranges: true,
      allow_symbol_change: false,
      save_image: false,
      backgroundColor: "#0A0A0A",
      gridColor: "rgba(255, 255, 255, 0.04)",
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      container_id: tvId,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol, tvId]);

  return (
    <div className="relative h-[480px] w-full md:h-[600px]">
      <div
        ref={containerRef}
        id={tvId}
        className="tradingview-widget-container h-full w-full"
      />
      <div className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        chart · TradingView
      </div>
    </div>
  );
}

/**
 * Map a Hyperliquid symbol to a TradingView "EXCHANGE:PAIR" string.
 *
 * We default to Binance perpetuals for liquidity. For pairs without coverage,
 * fall back to spot or to other exchanges. Unknown pairs default to a
 * Binance USDT spot pair, which TV will resolve gracefully.
 */
function mapToTradingViewSymbol(symbol: string): string {
  const s = symbol.toUpperCase();

  // Hyperliquid native — show on a major perp source
  if (s === "HYPE") return "BYBIT:HYPEUSDT";

  // Pairs with strong Binance perp listings
  const binancePerps = new Set([
    "BTC", "ETH", "SOL", "DOGE", "XRP", "AVAX", "LINK", "ARB",
    "OP", "MATIC", "BNB", "TRX", "LTC", "DOT", "NEAR", "APT",
    "SUI", "TIA", "SEI", "INJ", "FTM", "ATOM", "FIL", "AAVE",
    "UNI", "TON", "PEPE", "WIF", "SHIB", "BONK", "FLOKI",
  ]);

  if (binancePerps.has(s)) return `BINANCE:${s}USDT.P`;

  // Default fallback — Binance spot
  return `BINANCE:${s}USDT`;
}
