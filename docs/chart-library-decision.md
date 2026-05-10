# Chart Library Decision — Project Q

> **Decision**: `lightweight-charts` v5
> **Date**: W2 Day 9 PM
> **Status**: Stub built and verified. Real data integration deferred to M1.

## TL;DR

We will use **`lightweight-charts`** (TradingView's open-source library, MIT-licensed) to replace the current TradingView iframe in M1.

| Criterion | Why it wins |
|---|---|
| Built for finance | Native candlestick/OHLC support, time-series first |
| Performance | Canvas rendering, ~60 fps even on mobile, handles thousands of candles |
| Bundle size | ~45KB gzipped (smaller than ApexCharts at ~140KB) |
| Familiarity | Visually similar to the current TradingView iframe — no UX regression |
| License | Apache 2.0, requires only "powered by TradingView" attribution |

## Candidates evaluated

### 1. `lightweight-charts` v5 ✅ (chosen)

- **Vendor**: TradingView (official, open source)
- **Latest**: v5.2.0 (May 2026)
- **Renderer**: HTML5 Canvas
- **Strengths**: Built specifically for crypto/financial use cases. Smooth real-time updates. Small bundle. Mobile-friendly.
- **Weaknesses**: Limited chart types — only candlestick, line, area, histogram, bar. We don't need pie/radar charts so this isn't a problem.
- **License**: Apache 2.0 with attribution requirement ("Powered by TradingView" badge or similar). Acceptable for our use case.
- **React integration**: No official wrapper, but the `useRef + useEffect` pattern is simple and well-documented.

### 2. ApexCharts

- **Renderer**: SVG
- **Strengths**: Many chart types, good for general dashboards, polished out-of-box look.
- **Weaknesses**: SVG rendering is slower with large datasets. Bundle is larger (~140KB). Less optimized for crypto-style high-frequency updates.
- **Verdict**: Overkill for a focused trading screen.

### 3. Recharts

- **Renderer**: SVG (via React components)
- **Strengths**: Native React feel, declarative API.
- **Weaknesses**: No first-class candlestick component. SVG hits a performance wall around 5,000+ points. Building a crypto chart with Recharts means hand-rolling rectangles and wicks.
- **Verdict**: Wrong tool for the job.

### 4. uPlot

- **Renderer**: Canvas
- **Strengths**: Even smaller and faster than lightweight-charts.
- **Weaknesses**: Sparse documentation. No built-in candlestick — we'd build it from primitives.
- **Verdict**: Save the engineering effort. lightweight-charts gives us 95% of uPlot's performance with 10% of the work.

## Why not keep the TradingView iframe?

The current iframe approach has three blockers:

1. **Data inconsistency** — TradingView's iframe shows TradingView's price feed, not Hyperliquid's. Even small discrepancies (10-20 bps) break user trust on a trading product.
2. **Limited interactivity** — We can't draw rule-derived markers (entry/exit triggers, alert lines) on top of an iframe.
3. **Latency** — TradingView's data is delayed for free-tier embeds. Hyperliquid pushes via WebSocket in real-time.

By owning the chart, we get pixel-perfect control over what's drawn (rule markers, liquidation pins, funding spike highlights) and we use Hyperliquid's data directly so the chart matches the orders the user is placing.

## M1 implementation plan (not done in W2)

This work is **deferred to M1 Week 3-4**. W2 only proves the library works with our build.

1. Wire `candleSnapshot` REST endpoint to fetch initial 1m/5m/15m/1h history
   - Endpoint: `POST https://api.hyperliquid.xyz/info` with `{"type":"candleSnapshot","req":{"coin":"BTC","interval":"1h","startTime":...,"endTime":...}}`
   - Returns `{t, T, s, i, o, c, h, l, v, n}[]` per candle
2. Subscribe to WS `candle` channel for live updates on the active interval
3. Replace `<TradingViewEmbed>` in `app/markets/[symbol]/page.tsx` with `<CandleChart>`
4. Add interval toggle (1m / 5m / 15m / 1h / 4h / 1d)
5. Add "Powered by TradingView" attribution per license
6. Layer rule-derived markers on top (M2+)

## Stub deliverable (this commit)

- `components/CandleChart.tsx` — accepts `candles: CandleData[]` prop, renders a working candlestick chart with Project Q's dark color scheme
- Used on `/markets/[symbol]` below the existing TradingView iframe (side-by-side for now) so we can visually compare
- Placeholder data: 30 candles of synthetic BTC data
- Removes nothing yet — TradingView iframe stays until M1

## Hyperliquid candle data format (reference)

From the WebSocket types:

```ts
interface Candle {
  t: number;  // open time, ms
  T: number;  // close time, ms
  s: string;  // coin, e.g. "BTC"
  i: string;  // interval, e.g. "1m"
  o: number;  // open
  c: number;  // close
  h: number;  // high
  l: number;  // low
  v: number;  // volume (base unit)
  n: number;  // trade count
}
```

This maps cleanly to lightweight-charts' `CandlestickData`:

```ts
{ time: t / 1000, open: o, high: h, low: l, close: c }
```

A trivial transform — no impedance mismatch.
