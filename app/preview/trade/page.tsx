"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CandleChart, generateSyntheticCandles, type CandleData, type PriceLine } from "@/components/CandleChart";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Symbol = "BTC" | "ETH" | "SOL" | "HYPE" | "DOGE";
type CategoryKind = "funding" | "oi" | "orderFlow" | "lsRatio" | "liquidations" | "orderBook" | "onChain" | "hlActivity";
type ConditionKind =
  | "priceAbove" | "priceBelow"
  | "fundingAprAbove" | "fundingAprBelow" | "fundingFlip"
  | "oiChange24hAbove" | "oiChange1hAbove"
  | "buyFlowAbove" | "largeFillDetected" | "netFlow5minAbove"
  | "lsRatioAbove" | "lsRatioBelow" | "lsRatioFlipBullish" | "lsRatioFlipBearish"
  | "liquidations1hAbove" | "longLiquidationsAbove" | "shortLiquidationsAbove"
  | "spreadAbove" | "imbalanceAbove"
  | "fundingGapAbove" | "allExchangesCrowded";
type OrderType = "market" | "limit" | "trigger";
type Side = "long" | "short";
type MarginMode = "cross" | "isolated";
type BottomTab = "balances" | "positions" | "outcomes" | "openOrders" | "twap" | "tradeHistory" | "fundingHistory" | "orderHistory" | "triggerHistory";
type MobileTab = "markets" | "trade" | "account";
type MarketsSubTab = "chart" | "marketData" | "trigger";
type MarketDataSubTab = "book" | "trades" | "signal";
type MiddleTab = "book" | "trades" | "signals";
type CategoryStatus = "low" | "normal" | "high" | "extreme" | "tight" | "v2";

type TriggerCondition = {
  id: string;
  kind: ConditionKind;
  threshold: number;
  symbol: Symbol;
};

type SavedRule = {
  id: string;
  symbol: Symbol;
  conditions: TriggerCondition[];
  side: Side;
  sizePct: number;
  executionType: "market" | "limit";
  createdAt: number;
};

// Popular combinations (D14)
type PopularCombo = {
  id: string;
  name: string;
  description: string;
  conditionTemplates: { kind: ConditionKind; thresholdMultiplier: number }[];
  side: Side;
  category: string;
};

const POPULAR_COMBOS: PopularCombo[] = [
  {
    id: "combo-1",
    name: "Funding extreme + OI rising",
    description: "Over-leveraged longs about to unwind. Classic mean reversion fade.",
    conditionTemplates: [
      { kind: "fundingAprAbove", thresholdMultiplier: 1.3 },
      { kind: "oiChange24hAbove", thresholdMultiplier: 1.5 },
    ],
    side: "short",
    category: "Mean Reversion",
  },
  {
    id: "combo-2",
    name: "Liquidation cascade + Buy flow",
    description: "Longs purged + buyers stepping in = local bottom likely.",
    conditionTemplates: [
      { kind: "longLiquidationsAbove", thresholdMultiplier: 1.5 },
      { kind: "buyFlowAbove", thresholdMultiplier: 1.1 },
    ],
    side: "long",
    category: "Bounce Play",
  },
  {
    id: "combo-3",
    name: "Cross-exchange funding gap",
    description: "HL funding far above CEX = HL crowd over-leveraged.",
    conditionTemplates: [
      { kind: "fundingGapAbove", thresholdMultiplier: 1.2 },
    ],
    side: "short",
    category: "Arbitrage",
  },
  {
    id: "combo-4",
    name: "Crowded long + funding extreme",
    description: "Long-heavy positioning + extreme funding = classic fade setup.",
    conditionTemplates: [
      { kind: "lsRatioAbove", thresholdMultiplier: 1.15 },
      { kind: "fundingAprAbove", thresholdMultiplier: 1.3 },
    ],
    side: "short",
    category: "Mean Reversion",
  },
  {
    id: "combo-5",
    name: "L/S flip + OI rising",
    description: "Sentiment shift confirmed by capital flowing in = trend confirmation.",
    conditionTemplates: [
      { kind: "lsRatioFlipBullish", thresholdMultiplier: 1.0 },
      { kind: "oiChange1hAbove", thresholdMultiplier: 1.5 },
    ],
    side: "long",
    category: "Trend Confirmation",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────
type SymbolDetail = {
  mark: number;
  oracle: number;
  change24h: number;
  volume24h: number;
  oi: number;
  fundingPct: number;
  countdown: string;
  basis: number;
  funding: {
    rate1h: number; apr: number; avg24h: number; peak24h: number;
    direction: "long pays short" | "short pays long";
    trend: "rising" | "falling" | "stable";
    sparkline: number[]; status: CategoryStatus; summary: string;
    cex: { hl: number; binance: number; bybit: number; gapBps: number };
  };
  openInterest: {
    total: number; change24hPct: number; change1hPct: number;
    sparkline: number[]; status: CategoryStatus; summary: string;
  };
  orderFlow: {
    buyPct: number; sellPct: number; buyUsd: number; sellUsd: number;
    netUsd: number; avgTradeUsd: number;
    largeFills: { price: number; sizeUsd: number; side: "BUY" | "SELL"; secondsAgo: number }[];
    status: CategoryStatus; summary: string;
  };
  lsRatio: {
    ratio: number; // longAccountPct / shortAccountPct
    longAccountPct: number; // 0-100
    shortAccountPct: number; // 0-100
    trend24h: "rising" | "falling" | "stable";
    sparkline: number[]; // 7-12 historical values
    status: CategoryStatus; summary: string;
    crossExchange: { hl: number; binance: number; bybit: number }; // V2 expansion preview
  };
  liquidations: {
    total1hUsd: number; longUsd: number; shortUsd: number;
    largestUsd: number; largestSide: "long" | "short";
    pattern24h: number[]; status: CategoryStatus; summary: string;
  };
  orderBook: {
    spreadAbs: number; spreadPct: number; bestBid: number; bestAsk: number;
    depth01: { bids: number; asks: number };
    depth05: { bids: number; asks: number };
    imbalance: number; status: CategoryStatus; summary: string;
  };
  // NEW v13: Order Book ladder & Trades
  bookLadder: { bids: { price: number; size: number; total: number }[]; asks: { price: number; size: number; total: number }[] };
  recentTrades: { price: number; size: number; side: "BUY" | "SELL"; secondsAgo: number }[];
};

// Helper to generate book ladder around mark price
function genBook(mark: number, tickSize: number = 1, levels: number = 12): { bids: { price: number; size: number; total: number }[]; asks: { price: number; size: number; total: number }[] } {
  const bids: { price: number; size: number; total: number }[] = [];
  const asks: { price: number; size: number; total: number }[] = [];
  let bidTotal = 0;
  let askTotal = 0;
  for (let i = 0; i < levels; i++) {
    const bidPrice = mark - tickSize * (i + 1);
    const askPrice = mark + tickSize * (i + 1);
    const bidSize = +(0.5 + Math.random() * 5).toFixed(2);
    const askSize = +(0.5 + Math.random() * 5).toFixed(2);
    bidTotal += bidSize;
    askTotal += askSize;
    bids.push({ price: bidPrice, size: bidSize, total: +bidTotal.toFixed(2) });
    asks.push({ price: askPrice, size: askSize, total: +askTotal.toFixed(2) });
  }
  return { bids, asks: asks.reverse() }; // asks display top-down high→low
}

function genTrades(mark: number, count: number = 20): { price: number; size: number; side: "BUY" | "SELL"; secondsAgo: number }[] {
  const trades = [];
  for (let i = 0; i < count; i++) {
    const offset = (Math.random() - 0.5) * mark * 0.0002;
    trades.push({
      price: +(mark + offset).toFixed(mark < 1 ? 4 : mark < 100 ? 3 : mark < 1000 ? 2 : 0),
      size: +(0.01 + Math.random() * 1).toFixed(3),
      side: Math.random() > 0.45 ? "BUY" as const : "SELL" as const,
      secondsAgo: +(i * (0.3 + Math.random() * 2)).toFixed(1),
    });
  }
  return trades;
}

const SYMBOL_DATA: Record<Symbol, SymbolDetail> = {
  BTC: {
    mark: 80883, oracle: 80877, change24h: -3.31, volume24h: 260622586, oi: 3.42e9, fundingPct: 0.0013, countdown: "00:32:36",
    basis: 0.0074,
    funding: {
      rate1h: 0.0046, apr: 11.04, avg24h: 8.2, peak24h: 12.1,
      direction: "long pays short", trend: "rising",
      sparkline: [3, 4, 5, 6, 8, 9, 11], status: "high", summary: "APR 11.0% ↑ · Long pays",
      cex: { hl: 11.04, binance: 5.20, bybit: 6.10, gapBps: 584 },
    },
    openInterest: { total: 3.42e9, change24hPct: 5.2, change1hPct: 0.8,
      sparkline: [3.10, 3.15, 3.20, 3.25, 3.30, 3.38, 3.42], status: "normal", summary: "$3.42B · +5.2% 24h" },
    orderFlow: {
      buyPct: 56, sellPct: 44, buyUsd: 12.3e6, sellUsd: 9.7e6, netUsd: 2.6e6, avgTradeUsd: 4200,
      largeFills: [
        { price: 80883, sizeUsd: 580000, side: "BUY", secondsAgo: 0.3 },
        { price: 80879, sizeUsd: 420000, side: "SELL", secondsAgo: 1.2 },
        { price: 80885, sizeUsd: 380000, side: "BUY", secondsAgo: 2.8 },
      ],
      status: "normal", summary: "Buy 56% · neutral",
    },
    lsRatio: {
      ratio: 1.45, longAccountPct: 59.2, shortAccountPct: 40.8,
      trend24h: "stable", sparkline: [1.42, 1.40, 1.38, 1.41, 1.43, 1.45, 1.45],
      status: "normal", summary: "1.45 · slight long bias",
      crossExchange: { hl: 1.45, binance: 1.32, bybit: 1.38 },
    },
    liquidations: { total1hUsd: 45e6, longUsd: 28e6, shortUsd: 17e6,
      largestUsd: 4.2e6, largestSide: "long",
      pattern24h: [1, 1, 2, 3, 1, 1, 1, 2, 5, 6, 7, 5, 3, 2, 1, 1],
      status: "low", summary: "$45M (1h) · long-heavy" },
    orderBook: { spreadAbs: 0.001, spreadPct: 0.0024, bestBid: 80882, bestAsk: 80884,
      depth01: { bids: 4.2e6, asks: 3.8e6 }, depth05: { bids: 18.7e6, asks: 16.4e6 },
      imbalance: 10, status: "tight", summary: "Spread 0.002% · tight" },
    bookLadder: genBook(80883, 1),
    recentTrades: genTrades(80883),
  },
  ETH: {
    mark: 2336, oracle: 2335, change24h: 0.72, volume24h: 142000000, oi: 1.28e9, fundingPct: -0.0024, countdown: "00:32:36",
    basis: 0.0043,
    funding: {
      rate1h: -0.0024, apr: -8.5, avg24h: -6.2, peak24h: -10.1,
      direction: "short pays long", trend: "falling",
      sparkline: [-3, -4, -5, -6, -7, -8, -8.5], status: "normal", summary: "APR -8.5% · Short pays",
      cex: { hl: -8.5, binance: -4.2, bybit: -5.0, gapBps: -350 },
    },
    openInterest: { total: 1.28e9, change24hPct: -2.1, change1hPct: -0.3,
      sparkline: [1.35, 1.34, 1.32, 1.30, 1.29, 1.28, 1.28], status: "normal", summary: "$1.28B · -2.1% 24h" },
    orderFlow: { buyPct: 52, sellPct: 48, buyUsd: 5.6e6, sellUsd: 5.2e6, netUsd: 0.4e6, avgTradeUsd: 3100,
      largeFills: [
        { price: 2336, sizeUsd: 220000, side: "BUY", secondsAgo: 0.5 },
        { price: 2335, sizeUsd: 180000, side: "SELL", secondsAgo: 2.1 },
      ],
      status: "normal", summary: "Buy 52% · neutral" },
    lsRatio: {
      ratio: 0.78, longAccountPct: 43.8, shortAccountPct: 56.2,
      trend24h: "falling", sparkline: [0.95, 0.92, 0.88, 0.85, 0.82, 0.80, 0.78],
      status: "high", summary: "0.78 · short-heavy (contrarian)",
      crossExchange: { hl: 0.78, binance: 0.91, bybit: 0.85 },
    },
    liquidations: { total1hUsd: 12e6, longUsd: 5e6, shortUsd: 7e6,
      largestUsd: 1.1e6, largestSide: "short",
      pattern24h: [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 3, 2, 1, 1, 1],
      status: "low", summary: "$12M (1h) · balanced" },
    orderBook: { spreadAbs: 0.001, spreadPct: 0.0043, bestBid: 2335, bestAsk: 2336,
      depth01: { bids: 1.8e6, asks: 2.1e6 }, depth05: { bids: 8.4e6, asks: 9.2e6 },
      imbalance: -8, status: "tight", summary: "Spread 0.004% · ask-heavy" },
    bookLadder: genBook(2336, 0.1),
    recentTrades: genTrades(2336),
  },
  SOL: {
    mark: 95.17, oracle: 95.15, change24h: 3.4, volume24h: 89000000, oi: 580e6, fundingPct: 0.0042, countdown: "00:32:36",
    basis: 0.0210,
    funding: {
      rate1h: 0.0042, apr: 14.3, avg24h: 11.2, peak24h: 16.8,
      direction: "long pays short", trend: "rising",
      sparkline: [8, 9, 11, 12, 13, 14, 14.3], status: "high", summary: "APR 14.3% ↑ · spiking",
      cex: { hl: 14.3, binance: 9.8, bybit: 10.5, gapBps: 380 },
    },
    openInterest: { total: 580e6, change24hPct: 8.4, change1hPct: 1.2,
      sparkline: [510, 525, 540, 555, 565, 575, 580], status: "high", summary: "$580M · +8.4% 24h" },
    orderFlow: { buyPct: 64, sellPct: 36, buyUsd: 4.8e6, sellUsd: 2.7e6, netUsd: 2.1e6, avgTradeUsd: 2800,
      largeFills: [
        { price: 95.17, sizeUsd: 340000, side: "BUY", secondsAgo: 0.2 },
        { price: 95.15, sizeUsd: 290000, side: "BUY", secondsAgo: 1.5 },
      ],
      status: "high", summary: "Buy 64% · buy pressure" },
    lsRatio: {
      ratio: 1.92, longAccountPct: 65.7, shortAccountPct: 34.3,
      trend24h: "rising", sparkline: [1.45, 1.55, 1.65, 1.75, 1.82, 1.88, 1.92],
      status: "high", summary: "1.92 · long-heavy",
      crossExchange: { hl: 1.92, binance: 1.65, bybit: 1.72 },
    },
    liquidations: { total1hUsd: 18e6, longUsd: 6e6, shortUsd: 12e6,
      largestUsd: 2.1e6, largestSide: "short",
      pattern24h: [1, 1, 1, 2, 2, 1, 1, 2, 3, 4, 5, 4, 3, 2, 1, 1],
      status: "normal", summary: "$18M (1h) · short squeeze" },
    orderBook: { spreadAbs: 0.01, spreadPct: 0.0105, bestBid: 95.16, bestAsk: 95.17,
      depth01: { bids: 0.9e6, asks: 0.7e6 }, depth05: { bids: 4.2e6, asks: 3.6e6 },
      imbalance: 15, status: "normal", summary: "Spread 0.01% · bid-heavy" },
    bookLadder: genBook(95.17, 0.01),
    recentTrades: genTrades(95.17),
  },
  HYPE: {
    mark: 41.483, oracle: 41.477, change24h: -3.31, volume24h: 260622586, oi: 380e6, fundingPct: 0.0013, countdown: "00:32:36",
    basis: 0.0145,
    funding: {
      rate1h: 0.0092, apr: 22.1, avg24h: 18.5, peak24h: 26.4,
      direction: "long pays short", trend: "rising",
      sparkline: [12, 14, 16, 18, 20, 21, 22.1], status: "extreme", summary: "APR 22.1% ↑ · very high",
      cex: { hl: 22.1, binance: 0, bybit: 0, gapBps: 2210 },
    },
    openInterest: { total: 380e6, change24hPct: 12.5, change1hPct: 2.1,
      sparkline: [320, 335, 345, 355, 365, 375, 380], status: "high", summary: "$380M · +12.5% 24h" },
    orderFlow: { buyPct: 58, sellPct: 42, buyUsd: 8.1e6, sellUsd: 5.9e6, netUsd: 2.2e6, avgTradeUsd: 3500,
      largeFills: [{ price: 41.483, sizeUsd: 420000, side: "BUY", secondsAgo: 0.4 }],
      status: "normal", summary: "Buy 58% · slight buy" },
    lsRatio: {
      ratio: 2.34, longAccountPct: 70.1, shortAccountPct: 29.9,
      trend24h: "rising", sparkline: [1.85, 1.95, 2.05, 2.15, 2.22, 2.28, 2.34],
      status: "extreme", summary: "2.34 · very long-heavy",
      crossExchange: { hl: 2.34, binance: 0, bybit: 0 }, // HYPE only on HL
    },
    liquidations: { total1hUsd: 24e6, longUsd: 18e6, shortUsd: 6e6,
      largestUsd: 3.2e6, largestSide: "long",
      pattern24h: [2, 2, 3, 3, 2, 2, 3, 4, 5, 6, 7, 6, 4, 3, 2, 2],
      status: "high", summary: "$24M (1h) · longs paying" },
    orderBook: { spreadAbs: 0.001, spreadPct: 0.0024, bestBid: 41.482, bestAsk: 41.484,
      depth01: { bids: 2.1e6, asks: 1.8e6 }, depth05: { bids: 9.4e6, asks: 8.1e6 },
      imbalance: 14, status: "tight", summary: "Spread 0.002% · bid-heavy" },
    bookLadder: genBook(41.483, 0.001),
    recentTrades: genTrades(41.483),
  },
  DOGE: {
    mark: 0.1098, oracle: 0.1097, change24h: 5.2, volume24h: 67000000, oi: 410e6, fundingPct: 0.0118, countdown: "00:32:36",
    basis: 0.0911,
    funding: {
      rate1h: 0.0161, apr: 38.7, avg24h: 32.4, peak24h: 42.1,
      direction: "long pays short", trend: "rising",
      sparkline: [25, 28, 32, 34, 36, 38, 38.7], status: "extreme", summary: "APR 38.7% ↑ · fade signal",
      cex: { hl: 38.7, binance: 28.5, bybit: 30.2, gapBps: 850 },
    },
    openInterest: { total: 410e6, change24hPct: 15.8, change1hPct: 2.8,
      sparkline: [340, 360, 375, 385, 395, 405, 410], status: "high", summary: "$410M · +15.8% 24h" },
    orderFlow: { buyPct: 61, sellPct: 39, buyUsd: 3.2e6, sellUsd: 2.0e6, netUsd: 1.2e6, avgTradeUsd: 1800,
      largeFills: [{ price: 0.1098, sizeUsd: 180000, side: "BUY", secondsAgo: 0.8 }],
      status: "high", summary: "Buy 61% · crowded long" },
    lsRatio: {
      ratio: 2.81, longAccountPct: 73.8, shortAccountPct: 26.2,
      trend24h: "rising", sparkline: [2.10, 2.25, 2.40, 2.55, 2.65, 2.73, 2.81],
      status: "extreme", summary: "2.81 · extreme crowded long",
      crossExchange: { hl: 2.81, binance: 2.15, bybit: 2.32 },
    },
    liquidations: { total1hUsd: 8e6, longUsd: 2e6, shortUsd: 6e6,
      largestUsd: 0.9e6, largestSide: "short",
      pattern24h: [1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 4, 3, 2, 1, 1, 1],
      status: "normal", summary: "$8M (1h) · short squeeze" },
    orderBook: { spreadAbs: 0.0001, spreadPct: 0.091, bestBid: 0.1097, bestAsk: 0.1098,
      depth01: { bids: 0.5e6, asks: 0.4e6 }, depth05: { bids: 2.1e6, asks: 1.8e6 },
      imbalance: 11, status: "normal", summary: "Spread 0.09% · bid-heavy" },
    bookLadder: genBook(0.1098, 0.0001),
    recentTrades: genTrades(0.1098),
  },
};

const CONDITION_LABELS: Record<ConditionKind, { label: string; unit: string; category: string }> = {
  priceAbove: { label: "Price >", unit: "USD", category: "Price" },
  priceBelow: { label: "Price <", unit: "USD", category: "Price" },
  fundingAprAbove: { label: "Funding APR >", unit: "%", category: "Funding" },
  fundingAprBelow: { label: "Funding APR <", unit: "%", category: "Funding" },
  fundingFlip: { label: "Funding flips sign", unit: "", category: "Funding" },
  oiChange24hAbove: { label: "OI 24h change >", unit: "%", category: "OI" },
  oiChange1hAbove: { label: "OI 1h change >", unit: "%", category: "OI" },
  buyFlowAbove: { label: "Buy Flow >", unit: "%", category: "Order Flow" },
  largeFillDetected: { label: "Large fill >", unit: "USD", category: "Order Flow" },
  netFlow5minAbove: { label: "Net flow 5min >", unit: "USD", category: "Order Flow" },
  lsRatioAbove: { label: "L/S Ratio >", unit: "", category: "Long/Short Ratio" },
  lsRatioBelow: { label: "L/S Ratio <", unit: "", category: "Long/Short Ratio" },
  lsRatioFlipBullish: { label: "L/S flips bullish (>1)", unit: "", category: "Long/Short Ratio" },
  lsRatioFlipBearish: { label: "L/S flips bearish (<1)", unit: "", category: "Long/Short Ratio" },
  liquidations1hAbove: { label: "Liquidations 1h >", unit: "USD", category: "Liquidations" },
  longLiquidationsAbove: { label: "Long liq 1h >", unit: "USD", category: "Liquidations" },
  shortLiquidationsAbove: { label: "Short liq 1h >", unit: "USD", category: "Liquidations" },
  spreadAbove: { label: "Spread >", unit: "bps", category: "Order Book" },
  imbalanceAbove: { label: "OB Imbalance >", unit: "%", category: "Order Book" },
  fundingGapAbove: { label: "HL-CEX funding gap >", unit: "bps", category: "Cross-exchange" },
  allExchangesCrowded: { label: "All exchanges funding >", unit: "%", category: "Cross-exchange" },
};

// Get current value for a condition given current symbol data
function getCurrentValue(kind: ConditionKind, data: SymbolDetail): number {
  switch (kind) {
    case "priceAbove":
    case "priceBelow": return data.mark;
    case "fundingAprAbove":
    case "fundingAprBelow": return data.funding.apr;
    case "fundingFlip": return data.funding.apr;
    case "oiChange24hAbove": return data.openInterest.change24hPct;
    case "oiChange1hAbove": return data.openInterest.change1hPct;
    case "buyFlowAbove": return data.orderFlow.buyPct;
    case "largeFillDetected": return Math.max(...data.orderFlow.largeFills.map(f => f.sizeUsd), 0);
    case "netFlow5minAbove": return Math.abs(data.orderFlow.netUsd);
    case "lsRatioAbove":
    case "lsRatioBelow": return data.lsRatio.ratio;
    case "lsRatioFlipBullish":
    case "lsRatioFlipBearish": return data.lsRatio.ratio;
    case "liquidations1hAbove": return data.liquidations.total1hUsd;
    case "longLiquidationsAbove": return data.liquidations.longUsd;
    case "shortLiquidationsAbove": return data.liquidations.shortUsd;
    case "spreadAbove": return data.orderBook.spreadPct * 10000;
    case "imbalanceAbove": return Math.abs(data.orderBook.imbalance);
    case "fundingGapAbove": return Math.abs(data.funding.cex.gapBps);
    case "allExchangesCrowded": return Math.min(data.funding.cex.hl, data.funding.cex.binance, data.funding.cex.bybit);
  }
}

// Format value for display
function formatConditionValue(kind: ConditionKind, value: number): string {
  const unit = CONDITION_LABELS[kind].unit;
  if (unit === "USD" && kind === "priceAbove" || unit === "USD" && kind === "priceBelow") {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  if (unit === "USD") return formatBig(value);
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "bps") return `${value.toFixed(0)} bps`;
  return value.toFixed(2);
}

// Distance to fire (0 = far, 100 = fired)
function getDistanceToFire(kind: ConditionKind, current: number, threshold: number): number {
  // Below-style conditions are reversed
  if (kind === "priceBelow" || kind === "fundingAprBelow") {
    if (current <= threshold) return 100;
    // Distance shrinks as current approaches threshold from above
    const ratio = threshold / current;
    return Math.max(0, Math.min(100, ratio * 100));
  }
  // Default: above-style
  if (current >= threshold) return 100;
  const ratio = current / threshold;
  return Math.max(0, Math.min(100, ratio * 100));
}

function categoryColor(status: CategoryStatus) {
  switch (status) {
    case "low": return { text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/40" };
    case "tight":
    case "normal": return { text: "text-blue-300", bg: "bg-blue-500/10", border: "border-blue-500/30" };
    case "high": return { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30" };
    case "extreme": return { text: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30" };
    case "v2": return { text: "text-ink-faint", bg: "bg-bg-line/50", border: "border-bg-line" };
  }
}

function formatBig(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function formatBps(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(0)} bps`;
}

const MOCK_TRIGGER_HISTORY = [
  { time: "2026-05-11 14:23", rule: "BTC funding extreme — short", trigger: "Funding APR > 25%", fired: "11.2% (watching)", status: "watching" as const, action: undefined as string | undefined },
  { time: "2026-05-10 09:15", rule: "DOGE crowded long fade", trigger: "Funding APR > 30%", fired: "38.7% ✓ fired", status: "executed" as const, action: "Short DOGE 3% @ $0.1102" },
  { time: "2026-05-09 18:42", rule: "SOL momentum entry", trigger: "Buy Flow > 60%", fired: "64% ✓ fired", status: "executed" as const, action: "Long SOL 5% @ $94.20" },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function TradePreviewPage() {
  const [symbol, setSymbol] = useState<Symbol>("BTC");
  const [side, setSide] = useState<Side>("long");
  const [sizePct, setSizePct] = useState(0);
  const [sizeRaw, setSizeRaw] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("trigger"); // D12: trigger default
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [leverage, setLeverage] = useState(10);
  const [marginMode, setMarginMode] = useState<MarginMode>("cross");
  const [triggerConditions, setTriggerConditions] = useState<TriggerCondition[]>([]);
  const [executionType, setExecutionType] = useState<"market" | "limit">("market");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpsl, setTpsl] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [tif, setTif] = useState<"GTC" | "IOC">("GTC");
  const [bottomTab, setBottomTab] = useState<BottomTab>("positions");

  const [savedRules, setSavedRules] = useState<SavedRule[]>([]);
  const [viewingRuleId, setViewingRuleId] = useState<string | null>(null);

  const [mobileTab, setMobileTab] = useState<MobileTab>("markets");
  const [marketsSubTab, setMarketsSubTab] = useState<MarketsSubTab>("chart");
  const [marketDataSubTab, setMarketDataSubTab] = useState<MarketDataSubTab>("book");

  // Middle column tab state (D15)
  const [middleTab, setMiddleTab] = useState<MiddleTab>("book"); // default: order book (trader habit)

  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryKind>>(new Set());
  const [showTriggerLibrary, setShowTriggerLibrary] = useState(false);

  const toggleCategory = (kind: CategoryKind) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(kind)) newSet.delete(kind);
    else newSet.add(kind);
    setExpandedCategories(newSet);
  };
  const expandAll = () => setExpandedCategories(new Set(["funding", "oi", "orderFlow", "lsRatio", "liquidations", "orderBook", "onChain", "hlActivity"]));
  const collapseAll = () => setExpandedCategories(new Set());

  const [candles, setCandles] = useState<CandleData[]>([]);
  useEffect(() => {
    setCandles(generateSyntheticCandles(80, SYMBOL_DATA[symbol].mark, 3600));
  }, [symbol]);

  const data = SYMBOL_DATA[symbol];

  const addTriggerCondition = (kind: ConditionKind, suggestedThreshold: number) => {
    if (triggerConditions.length >= 3) {
      alert("V1 alpha allows maximum 3 trigger conditions per rule.\nPro tier (V2) will extend this.");
      return;
    }
    setTriggerConditions([
      ...triggerConditions,
      { id: `c_${Math.random().toString(36).slice(2, 9)}`, kind, threshold: suggestedThreshold, symbol },
    ]);
    setOrderType("trigger");
    setMarketsSubTab("trigger");
    setViewingRuleId(null);
  };

  // Apply a popular combo (D14)
  const applyCombo = (combo: PopularCombo) => {
    if (triggerConditions.length > 0) {
      if (!confirm("This will replace your current trigger conditions. Continue?")) return;
    }
    const newConditions: TriggerCondition[] = combo.conditionTemplates.map((t) => {
      const currentVal = getCurrentValue(t.kind, data);
      return {
        id: `c_${Math.random().toString(36).slice(2, 9)}`,
        kind: t.kind,
        threshold: +(Math.abs(currentVal) * t.thresholdMultiplier).toFixed(2),
        symbol,
      };
    });
    setTriggerConditions(newConditions);
    setSide(combo.side);
    setSizePct(3);
    setOrderType("trigger");
    setMarketsSubTab("trigger");
    setViewingRuleId(null);
  };

  const triggerEvaluation = useMemo(() => {
    if (triggerConditions.length === 0) return { matches: false };
    // AND only (D14)
    const results = triggerConditions.map((c) => {
      const sym = SYMBOL_DATA[c.symbol];
      switch (c.kind) {
        case "priceAbove": return sym.mark > c.threshold;
        case "priceBelow": return sym.mark < c.threshold;
        case "fundingAprAbove": return sym.funding.apr > c.threshold;
        case "fundingAprBelow": return sym.funding.apr < c.threshold;
        case "fundingFlip": return false;
        case "oiChange24hAbove": return sym.openInterest.change24hPct > c.threshold;
        case "oiChange1hAbove": return sym.openInterest.change1hPct > c.threshold;
        case "buyFlowAbove": return sym.orderFlow.buyPct > c.threshold;
        case "largeFillDetected": return sym.orderFlow.largeFills.some(f => f.sizeUsd > c.threshold);
        case "netFlow5minAbove": return Math.abs(sym.orderFlow.netUsd) > c.threshold;
        case "lsRatioAbove": return sym.lsRatio.ratio > c.threshold;
        case "lsRatioBelow": return sym.lsRatio.ratio < c.threshold;
        case "lsRatioFlipBullish": return sym.lsRatio.ratio > 1.0;
        case "lsRatioFlipBearish": return sym.lsRatio.ratio < 1.0;
        case "liquidations1hAbove": return sym.liquidations.total1hUsd > c.threshold;
        case "longLiquidationsAbove": return sym.liquidations.longUsd > c.threshold;
        case "shortLiquidationsAbove": return sym.liquidations.shortUsd > c.threshold;
        case "spreadAbove": return sym.orderBook.spreadPct * 10000 > c.threshold;
        case "imbalanceAbove": return Math.abs(sym.orderBook.imbalance) > c.threshold;
        case "fundingGapAbove": return Math.abs(sym.funding.cex.gapBps) > c.threshold;
        case "allExchangesCrowded":
          return sym.funding.cex.hl > c.threshold && sym.funding.cex.binance > c.threshold && sym.funding.cex.bybit > c.threshold;
      }
    });
    return { matches: results.every(Boolean) };
  }, [triggerConditions]);

  const removeCondition = (id: string) => setTriggerConditions(triggerConditions.filter(c => c.id !== id));
  const updateConditionThreshold = (id: string, threshold: number) =>
    setTriggerConditions(triggerConditions.map(c => c.id === id ? { ...c, threshold } : c));

  const handleSaveAsRule = () => {
    if (triggerConditions.length === 0) {
      alert("Add a trigger condition first.");
      return;
    }
    const newRule: SavedRule = {
      id: `rule_${Math.random().toString(36).slice(2, 9)}`,
      symbol,
      conditions: triggerConditions.map(c => ({ ...c })),
      side,
      sizePct,
      executionType,
      createdAt: Date.now(),
    };
    setSavedRules([...savedRules, newRule]);
    setTriggerConditions([]);
    alert(`Demo: Rule saved\n\n${newRule.conditions.length} condition(s) — AND\nExecution: ${executionType.toUpperCase()} ${side} ${sizePct}% portfolio\n\nIn M2 this saves to Supabase and our worker watches 24/7. Click trigger lines on chart to view/cancel rules.`);
  };

  const handleCancelRule = (ruleId: string) => {
    setSavedRules(savedRules.filter(r => r.id !== ruleId));
    if (viewingRuleId === ruleId) setViewingRuleId(null);
  };

  const priceLines: PriceLine[] = useMemo(() => {
    const lines: PriceLine[] = [];
    savedRules
      .filter(r => r.symbol === symbol)
      .forEach((rule) => {
        rule.conditions.forEach((c) => {
          if (c.kind === "priceAbove" || c.kind === "priceBelow") {
            lines.push({
              id: rule.id,
              price: c.threshold,
              label: `Trigger ${rule.side === "long" ? "↑" : "↓"} ${c.kind === "priceAbove" ? ">" : "<"} $${c.threshold.toLocaleString()}`,
              color: viewingRuleId === rule.id ? "#10b981" : "#f59e0b",
            });
          }
        });
      });
    return lines;
  }, [savedRules, symbol, viewingRuleId]);

  const handlePriceLineClick = (ruleId: string) => {
    setViewingRuleId(ruleId === viewingRuleId ? null : ruleId);
    setOrderType("trigger");
  };

  const nonPriceRulesForSymbol = savedRules.filter(r => r.symbol === symbol && !r.conditions.some(c => c.kind === "priceAbove" || c.kind === "priceBelow"));

  const handleAction = () => {
    if (orderType === "trigger") {
      if (triggerConditions.length === 0 && viewingRuleId === null) {
        alert("Add a trigger condition first.");
        return;
      }
      if (viewingRuleId !== null) return;
      handleSaveAsRule();
    } else {
      alert(`Demo: ${orderType} ${side} ${sizePct}%\n\nIn M3, signs with wallet → Hyperliquid SDK with 5 bps builder code.`);
    }
  };

  return (
    <main className="min-h-dvh bg-bg text-ink">
      {/* ═════════════════ DESKTOP ═════════════════ */}
      <div className="hidden lg:block">
        <DesktopHeader symbol={symbol} setSymbol={(s) => { setSymbol(s); setTriggerConditions([]); setViewingRuleId(null); }} data={data} />
        <div className="border-b border-bg-line bg-bg-panel/40 px-4 py-2">
          <span className="font-mono text-[11px] text-signal">▶ PREVIEW</span>
          <span className="font-mono text-[11px] text-ink-faint"> · </span>
          <span className="font-mono text-[11px] text-ink-mute">Trade page mockup (W2 Day 13 v14) — 6 active signal cards · 22 triggers · L/S Ratio · 5 popular combos</span>
        </div>

        <div className="grid grid-cols-[1fr_300px_320px]">
          <div className="border-r border-bg-line">
            <ChartColumn
              candles={candles}
              symbol={symbol}
              priceLines={priceLines}
              onPriceLineClick={handlePriceLineClick}
              nonPriceRules={nonPriceRulesForSymbol}
              onShowRule={handlePriceLineClick}
            />
          </div>
          <div className="border-r border-bg-line">
            <MiddleColumn
              activeTab={middleTab}
              setActiveTab={setMiddleTab}
              data={data}
              symbol={symbol}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
              onAddTrigger={addTriggerCondition}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
            />
          </div>
          <aside>
            <OrderColumn
              data={data} symbol={symbol}
              side={side} setSide={setSide}
              sizePct={sizePct} setSizePct={setSizePct}
              sizeRaw={sizeRaw} setSizeRaw={setSizeRaw}
              orderType={orderType} setOrderType={setOrderType}
              limitPrice={limitPrice} setLimitPrice={setLimitPrice}
              slippage={slippage} setSlippage={setSlippage}
              leverage={leverage} setLeverage={setLeverage}
              marginMode={marginMode} setMarginMode={setMarginMode}
              triggerConditions={triggerConditions}
              triggerEvaluation={triggerEvaluation}
              onRemoveCondition={removeCondition}
              onUpdateThreshold={updateConditionThreshold}
              reduceOnly={reduceOnly} setReduceOnly={setReduceOnly}
              tpsl={tpsl} setTpsl={setTpsl}
              postOnly={postOnly} setPostOnly={setPostOnly}
              tif={tif} setTif={setTif}
              executionType={executionType} setExecutionType={setExecutionType}
              onAction={handleAction}
              savedRules={savedRules}
              viewingRuleId={viewingRuleId}
              onCloseRuleView={() => setViewingRuleId(null)}
              onCancelRule={handleCancelRule}
              onAddPriceCondition={(kind, threshold) => addTriggerCondition(kind, threshold)}
              onOpenLibrary={() => setShowTriggerLibrary(true)}
              onApplyCombo={applyCombo}
            />
          </aside>
        </div>

        <BottomTabsArea activeTab={bottomTab} onTabChange={setBottomTab} />
      </div>

      {/* ═════════════════ MOBILE ═════════════════ */}
      <div className="lg:hidden">
        <MobileHeader showConnect={mobileTab !== "trade"} onConnectClick={() => setMobileTab("trade")} />
        <div className="border-b border-bg-line bg-bg-panel/40 px-3 py-1.5">
          <span className="font-mono text-[10px] text-signal">▶ PREVIEW</span>
          <span className="font-mono text-[10px] text-ink-faint"> · </span>
          <span className="font-mono text-[10px] text-ink-mute">Mobile (Day 13 v13)</span>
        </div>

        <div className="pb-[68px]">
          {mobileTab === "markets" && (
            <MobileMarkets
              symbol={symbol} setSymbol={(s) => { setSymbol(s); setTriggerConditions([]); setViewingRuleId(null); }}
              data={data} candles={candles}
              priceLines={priceLines}
              onPriceLineClick={handlePriceLineClick}
              nonPriceRules={nonPriceRulesForSymbol}
              subTab={marketsSubTab} setSubTab={setMarketsSubTab}
              marketDataSubTab={marketDataSubTab} setMarketDataSubTab={setMarketDataSubTab}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
              onAddTrigger={addTriggerCondition}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              side={side} setSide={setSide}
              sizePct={sizePct} setSizePct={setSizePct}
              sizeRaw={sizeRaw} setSizeRaw={setSizeRaw}
              orderType={orderType} setOrderType={setOrderType}
              limitPrice={limitPrice} setLimitPrice={setLimitPrice}
              slippage={slippage} setSlippage={setSlippage}
              leverage={leverage} setLeverage={setLeverage}
              marginMode={marginMode} setMarginMode={setMarginMode}
              triggerConditions={triggerConditions}
              triggerEvaluation={triggerEvaluation}
              onRemoveCondition={removeCondition}
              onUpdateThreshold={updateConditionThreshold}
              reduceOnly={reduceOnly} setReduceOnly={setReduceOnly}
              tpsl={tpsl} setTpsl={setTpsl}
              postOnly={postOnly} setPostOnly={setPostOnly}
              tif={tif} setTif={setTif}
              executionType={executionType} setExecutionType={setExecutionType}
              onAction={handleAction}
              savedRules={savedRules}
              viewingRuleId={viewingRuleId}
              onCloseRuleView={() => setViewingRuleId(null)}
              onCancelRule={handleCancelRule}
              onAddPriceCondition={(kind, threshold) => addTriggerCondition(kind, threshold)}
              onOpenLibrary={() => setShowTriggerLibrary(true)}
              onApplyCombo={applyCombo}
            />
          )}
          {mobileTab === "trade" && <MobileTradeConnect />}
          {mobileTab === "account" && <MobileAccount />}
        </div>

        <BottomTabBar activeTab={mobileTab} onTabChange={setMobileTab} />
      </div>

      {/* Trigger Library Modal */}
      {showTriggerLibrary && (
        <TriggerLibraryModal
          symbol={symbol}
          data={data}
          onClose={() => setShowTriggerLibrary(false)}
          onSelectCondition={(kind, threshold) => { addTriggerCondition(kind, threshold); setShowTriggerLibrary(false); }}
          onApplyCombo={(combo) => { applyCombo(combo); setShowTriggerLibrary(false); }}
        />
      )}
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ICONS / SHARED
// ═════════════════════════════════════════════════════════════════════════════
function GlobeIcon() { return <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth="1.5"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" strokeWidth="1.5"/></svg>; }
function GearIcon() { return <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" strokeWidth="1.5"/><path d="M19 12a7 7 0 01-.1 1.2l2.1 1.7-2 3.5-2.5-1a7 7 0 01-2.1 1.2l-.4 2.6h-4l-.4-2.6a7 7 0 01-2.1-1.2l-2.5 1-2-3.5 2.1-1.7A7 7 0 015 12c0-.4 0-.8.1-1.2L3 9.1l2-3.5 2.5 1a7 7 0 012.1-1.2L10 2.8h4l.4 2.6a7 7 0 012.1 1.2l2.5-1 2 3.5-2.1 1.7c.1.4.1.8.1 1.2z" strokeWidth="1.5"/></svg>; }
function HamburgerIcon() { return <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="1.5"/></svg>; }
function ChevronDown({ rotated }: { rotated?: boolean }) { return <svg className={`h-4 w-4 transition-transform ${rotated ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" strokeWidth="2"/></svg>; }

function IconButton({ children, title }: { children: React.ReactNode; title?: string }) {
  return <button className="border border-bg-line p-1.5 text-ink-mute hover:text-ink" title={title}>{children}</button>;
}

// ═════════════════════════════════════════════════════════════════════════════
// DESKTOP HEADER
// ═════════════════════════════════════════════════════════════════════════════
function DesktopHeader({ symbol, setSymbol, data }: { symbol: Symbol; setSymbol: (s: Symbol) => void; data: SymbolDetail }) {
  return (
    <header className="border-b border-bg-line">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-mono text-sm">
            <span className="text-signal">●</span><span className="font-medium">PROJECT.Q</span>
          </Link>
          <nav className="flex gap-6">
            <a href="#" onClick={(e) => e.preventDefault()} className="text-sm text-signal">Trade</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-sm text-ink-mute hover:text-ink">Portfolio</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-sm text-ink-mute hover:text-ink">Referrals</a>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-sm text-ink-mute hover:text-ink">Leaderboard</a>
            <Link href="/preview/trigger-set" className="text-sm text-ink-mute hover:text-ink">Trigger Set</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button className="border border-signal/60 bg-signal/10 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-signal hover:bg-signal/20">Connect</button>
          <IconButton title="Language"><GlobeIcon /></IconButton>
          <IconButton title="Settings"><GearIcon /></IconButton>
        </div>
      </div>
      <div className="flex items-center gap-4 overflow-x-auto border-t border-bg-line px-4 py-3">
        <div className="flex items-center gap-2 shrink-0">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value as Symbol)}
            className="border border-bg-line bg-bg-panel px-3 py-2 font-mono text-sm outline-none focus:border-signal">
            {(["BTC", "ETH", "SOL", "HYPE", "DOGE"] as Symbol[]).map(s => <option key={s} value={s}>{s}-USDC</option>)}
          </select>
          <span className="border border-bg-line bg-bg-panel px-2 py-2 font-mono text-xs text-ink-mute">10x</span>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <Stat label="Mark" value={data.mark.toLocaleString()} />
          <Stat label="Oracle" value={data.oracle.toLocaleString()} />
          <Stat label="Basis" value={`${data.basis > 0 ? "+" : ""}${data.basis.toFixed(3)}%`} color={data.basis > 0 ? "text-signal" : "text-red-400"} />
          <Stat label="24h Change" value={`${data.change24h > 0 ? "+" : ""}${data.change24h.toFixed(2)}%`} color={data.change24h > 0 ? "text-signal" : "text-red-400"} />
          <Stat label="24h Volume" value={formatBig(data.volume24h)} />
          <Stat label="Open Interest" value={formatBig(data.oi)} />
          <Stat label="Funding / Countdown" value={`${data.fundingPct.toFixed(4)}%`} sub={data.countdown} />
        </div>
        <div className="ml-auto flex items-center gap-px border border-bg-line shrink-0">
          {["Cross", "10x", "Classic"].map((m, i) => (
            <button key={m} className={`px-3 py-1.5 font-mono text-[11px] ${i === 0 ? "bg-bg-panel text-ink" : "text-ink-mute hover:text-ink"}`}>{m}</button>
          ))}
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col leading-tight shrink-0">
      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono text-sm ${color ?? "text-ink"}`}>{value}</span>
        {sub && <span className="font-mono text-[10px] text-ink-mute">{sub}</span>}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CHART COLUMN (preserved from v12)
// ═════════════════════════════════════════════════════════════════════════════
function ChartColumn({
  candles, symbol, priceLines, onPriceLineClick, nonPriceRules, onShowRule,
}: {
  candles: CandleData[]; symbol: Symbol;
  priceLines: PriceLine[];
  onPriceLineClick: (id: string) => void;
  nonPriceRules: SavedRule[];
  onShowRule: (id: string) => void;
}) {
  const [tf, setTf] = useState("1h");
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          {["5m", "1h", "D"].map(t => (
            <button key={t} onClick={() => setTf(t)} className={`font-mono ${tf === t ? "text-ink" : "text-ink-mute hover:text-ink"}`}>{t}</button>
          ))}
          <span className="text-ink-faint">|</span>
          <button className="font-mono text-ink-mute hover:text-ink" title="100+ indicators (RSI/MACD/BB/EMA/VWAP) via TradingView Advanced Charts (M1)">ƒ Indicators</button>
        </div>
        <div className="flex items-center gap-3">
          {nonPriceRules.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Active triggers:</span>
              {nonPriceRules.map((rule) => (
                <button key={rule.id} onClick={() => onShowRule(rule.id)}
                  className="border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300 hover:bg-amber-500/20"
                  title={`Show rule details (${rule.conditions.length} cond)`}>
                  ⚡ {rule.conditions.length}-cond
                </button>
              ))}
            </div>
          )}
          <button className="text-ink-mute hover:text-ink" title="Fullscreen">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6" strokeWidth="1.5"/></svg>
          </button>
        </div>
      </div>

      <CandleChart candles={candles} height={600} priceLines={priceLines} onPriceLineClick={onPriceLineClick} hideHeader />

      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-mute">
        <div className="flex gap-3 font-mono">
          {["5y", "1y", "6m", "3m", "1m", "5d", "1d"].map(r => <button key={r} className="hover:text-ink">{r}</button>)}
        </div>
        <div className="flex items-center gap-3">
          {priceLines.length > 0 && (
            <span className="font-mono text-[10px] text-amber-300">
              {priceLines.length} trigger line{priceLines.length > 1 ? "s" : ""} on chart — click to view
            </span>
          )}
          <span className="font-mono">{symbol}-USD · Synthetic</span>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MIDDLE COLUMN — 3 tabs (Book / Trades / Signals)
// ═════════════════════════════════════════════════════════════════════════════
type MiddleColumnProps = {
  activeTab: MiddleTab;
  setActiveTab: (t: MiddleTab) => void;
  data: SymbolDetail;
  symbol: Symbol;
  expandedCategories: Set<CategoryKind>;
  onToggleCategory: (kind: CategoryKind) => void;
  onAddTrigger: (kind: ConditionKind, threshold: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

function MiddleColumn(props: MiddleColumnProps) {
  const { activeTab, setActiveTab, data, symbol } = props;
  return (
    <div className="flex h-full flex-col">
      {/* Tab header */}
      <div className="flex border-b border-bg-line">
        <TabButton active={activeTab === "book"} onClick={() => setActiveTab("book")} label="Book" />
        <TabButton active={activeTab === "trades"} onClick={() => setActiveTab("trades")} label="Trades" />
        <TabButton active={activeTab === "signals"} onClick={() => setActiveTab("signals")} label="Signals" emphasis count={8} />
      </div>
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "book" && <OrderBookLadder data={data} symbol={symbol} />}
        {activeTab === "trades" && <TradesPanel data={data} symbol={symbol} />}
        {activeTab === "signals" && <SignalsPanel {...props} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, emphasis, count }: { active: boolean; onClick: () => void; label: string; emphasis?: boolean; count?: number }) {
  const base = "flex-1 px-3 py-2.5 font-mono text-xs uppercase tracking-[0.1em] transition-colors";
  let cls = "";
  if (active) {
    cls = emphasis ? "border-b-2 border-amber-400 text-amber-300 bg-amber-500/5" : "border-b-2 border-signal text-signal";
  } else {
    cls = emphasis ? "text-amber-400/70 hover:text-amber-300 bg-amber-500/5" : "text-ink-mute hover:text-ink";
  }
  return (
    <button onClick={onClick} className={`${base} ${cls}`}>
      {emphasis && <span className="mr-1">✦</span>}{label}{count !== undefined && <span className="ml-1.5 text-[10px] opacity-70">({count})</span>}
    </button>
  );
}

// ── Tab 1: Order Book Ladder ─────────────────────────────────────────────────
function OrderBookLadder({ data, symbol }: { data: SymbolDetail; symbol: Symbol }) {
  const maxBidSize = Math.max(...data.bookLadder.bids.map(b => b.size));
  const maxAskSize = Math.max(...data.bookLadder.asks.map(a => a.size));
  const maxSize = Math.max(maxBidSize, maxAskSize);

  const fmtPrice = (p: number) => p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(3) : p.toFixed(0);
  const fmtSize = (s: number) => s < 1 ? s.toFixed(3) : s.toFixed(2);

  return (
    <div className="p-3">
      <div className="mb-2 grid grid-cols-3 gap-2 border-b border-bg-line pb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        <span>Price (USD)</span>
        <span className="text-right">Size ({symbol})</span>
        <span className="text-right">Total</span>
      </div>
      {/* Asks (red, displayed top-down: highest price first) */}
      <div className="space-y-0.5">
        {data.bookLadder.asks.map((a, i) => (
          <div key={`ask-${i}`} className="relative grid grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="absolute inset-y-0 right-0 bg-red-500/10" style={{ width: `${(a.size / maxSize) * 100}%` }} />
            <span className="relative text-red-400">{fmtPrice(a.price)}</span>
            <span className="relative text-right text-ink">{fmtSize(a.size)}</span>
            <span className="relative text-right text-ink-mute">{fmtSize(a.total)}</span>
          </div>
        ))}
      </div>
      {/* Mid price separator */}
      <div className="my-2 flex items-center justify-between border-y border-bg-line px-1 py-1.5">
        <span className="font-mono text-sm text-ink">{fmtPrice(data.mark)}</span>
        <span className="font-mono text-[10px] text-ink-mute">Spread {data.orderBook.spreadAbs} ({data.orderBook.spreadPct.toFixed(4)}%)</span>
      </div>
      {/* Bids (green) */}
      <div className="space-y-0.5">
        {data.bookLadder.bids.map((b, i) => (
          <div key={`bid-${i}`} className="relative grid grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="absolute inset-y-0 right-0 bg-signal/10" style={{ width: `${(b.size / maxSize) * 100}%` }} />
            <span className="relative text-signal">{fmtPrice(b.price)}</span>
            <span className="relative text-right text-ink">{fmtSize(b.size)}</span>
            <span className="relative text-right text-ink-mute">{fmtSize(b.total)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-bg-line pt-2 font-mono text-[10px]">
        <div className="flex justify-between"><span className="text-ink-mute">Bids total</span><span className="text-signal">{formatBig(data.orderBook.depth05.bids)}</span></div>
        <div className="flex justify-between"><span className="text-ink-mute">Asks total</span><span className="text-red-400">{formatBig(data.orderBook.depth05.asks)}</span></div>
      </div>
      <p className="mt-3 font-mono text-[9px] text-ink-faint">M1: Live data via HL WS l2Book (20 levels). Synthetic in mockup.</p>
    </div>
  );
}

// ── Tab 2: Trades Panel ──────────────────────────────────────────────────────
function TradesPanel({ data, symbol }: { data: SymbolDetail; symbol: Symbol }) {
  const fmtPrice = (p: number) => p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(3) : p.toFixed(0);
  const fmtSize = (s: number) => s < 1 ? s.toFixed(3) : s.toFixed(2);
  return (
    <div className="p-3">
      <div className="mb-2 grid grid-cols-3 gap-2 border-b border-bg-line pb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        <span>Price (USD)</span>
        <span className="text-right">Size ({symbol})</span>
        <span className="text-right">Time</span>
      </div>
      <div className="space-y-0.5">
        {data.recentTrades.map((t, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 font-mono text-[11px]">
            <span className={t.side === "BUY" ? "text-signal" : "text-red-400"}>{fmtPrice(t.price)}</span>
            <span className="text-right text-ink">{fmtSize(t.size)}</span>
            <span className="text-right text-ink-mute">{t.secondsAgo}s</span>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[9px] text-ink-faint">M1: Live trades via HL WS trades. Synthetic in mockup.</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SIGNALS PANEL — 7 categories (preserved from v12, with D11 enhancement)
// ═════════════════════════════════════════════════════════════════════════════
function SignalsPanel(props: MiddleColumnProps) {
  const { data, expandedCategories, onToggleCategory, onAddTrigger, onExpandAll, onCollapseAll } = props;
  const allExpanded = expandedCategories.size === 8;
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between border-b border-bg-line pb-2">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-amber-300">✦ Signals — our edge</span>
        <button onClick={allExpanded ? onCollapseAll : onExpandAll}
          className="font-mono text-[10px] uppercase text-ink-mute hover:text-ink">
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="space-y-2">
        <FundingCategory data={data} expandedCategories={expandedCategories} onToggleCategory={onToggleCategory} onAddTrigger={onAddTrigger} />
        <OICategory data={data} expandedCategories={expandedCategories} onToggleCategory={onToggleCategory} onAddTrigger={onAddTrigger} />
        <OrderFlowCategory data={data} expandedCategories={expandedCategories} onToggleCategory={onToggleCategory} onAddTrigger={onAddTrigger} />
        <LSRatioCategory data={data} expandedCategories={expandedCategories} onToggleCategory={onToggleCategory} onAddTrigger={onAddTrigger} />
        <LiquidationsCategory data={data} expandedCategories={expandedCategories} onToggleCategory={onToggleCategory} onAddTrigger={onAddTrigger} />
        <OrderBookCategory data={data} expandedCategories={expandedCategories} onToggleCategory={onToggleCategory} onAddTrigger={onAddTrigger} />
        <OnChainCategory expandedCategories={expandedCategories} onToggleCategory={onToggleCategory} />
        <HLActivityCategory expandedCategories={expandedCategories} onToggleCategory={onToggleCategory} />
      </div>
      <p className="mt-4 border-t border-bg-line pt-3 font-mono text-[10px] text-ink-faint">
        6 active signal cards + 2 V2 placeholders. Each exposes multiple trigger options.
      </p>
    </div>
  );
}

type CategoryProps = {
  data: SymbolDetail;
  expandedCategories: Set<CategoryKind>;
  onToggleCategory: (kind: CategoryKind) => void;
  onAddTrigger: (kind: ConditionKind, threshold: number) => void;
};

function CategoryHeader({ name, summary, status, expanded, onToggle }: {
  name: string; summary: string; status: CategoryStatus; expanded: boolean; onToggle: () => void;
}) {
  const c = categoryColor(status);
  return (
    <button onClick={onToggle} className={`flex w-full items-center justify-between border ${c.border} ${c.bg} px-3 py-2 text-left transition hover:opacity-90`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">{name}</span>
          <span className={`font-mono text-[9px] uppercase ${c.text}`}>{status === "v2" ? "V2" : status}</span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-ink">{summary}</div>
      </div>
      <span className="ml-2 text-ink-faint"><ChevronDown rotated={expanded} /></span>
    </button>
  );
}

// Trigger button (used inline in each category)
function TriggerBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.05em] text-amber-300 hover:bg-amber-500/20 transition">
      + {label}
    </button>
  );
}

function FundingCategory({ data, expandedCategories, onToggleCategory, onAddTrigger }: CategoryProps) {
  const expanded = expandedCategories.has("funding");
  const f = data.funding;
  const cexMax = Math.max(Math.abs(f.cex.hl), Math.abs(f.cex.binance), Math.abs(f.cex.bybit), 1);
  return (
    <div>
      <CategoryHeader name="Funding" summary={f.summary} status={f.status} expanded={expanded} onToggle={() => onToggleCategory("funding")} />
      {expanded && (
        <div className="mt-1.5 space-y-2 border border-bg-line bg-bg-panel/30 p-3">
          <DetailRow label="Rate (1h)" value={`${f.rate1h.toFixed(4)}%`} />
          <DetailRow label="APR" value={`${f.apr.toFixed(2)}%`} valueColor={f.trend === "rising" ? "text-signal" : "text-ink"} suffix={f.trend === "rising" ? "↑" : f.trend === "falling" ? "↓" : ""} />
          <DetailRow label="24h avg" value={`${f.avg24h.toFixed(1)}%`} />
          <DetailRow label="24h peak" value={`${f.peak24h.toFixed(1)}%`} />
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">8h history</div>
            <Sparkline data={f.sparkline} />
          </div>
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Cross-exchange (1h)</span>
              <span className={`font-mono text-[10px] ${Math.abs(f.cex.gapBps) > 100 ? "text-amber-300" : "text-ink-mute"}`}>
                ⚡ {formatBps(f.cex.gapBps)}
              </span>
            </div>
            <CexFundingRow label="HL" value={f.cex.hl} max={cexMax} highlight />
            <CexFundingRow label="Binance" value={f.cex.binance} max={cexMax} />
            <CexFundingRow label="Bybit" value={f.cex.bybit} max={cexMax} />
          </div>
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Add trigger</div>
            <div className="grid grid-cols-2 gap-1.5">
              <TriggerBtn label={`APR > ${Math.ceil(Math.abs(f.apr) * 1.3)}%`} onClick={() => onAddTrigger("fundingAprAbove", Math.ceil(Math.abs(f.apr) * 1.3))} />
              <TriggerBtn label={`APR < ${Math.floor(f.apr * 0.5)}%`} onClick={() => onAddTrigger("fundingAprBelow", Math.floor(f.apr * 0.5))} />
              <TriggerBtn label="Flip sign" onClick={() => onAddTrigger("fundingFlip", 0)} />
              <TriggerBtn label={`Gap > ${Math.max(Math.floor(Math.abs(f.cex.gapBps) * 0.9), 100)} bps`} onClick={() => onAddTrigger("fundingGapAbove", Math.max(Math.floor(Math.abs(f.cex.gapBps) * 0.9), 100))} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CexFundingRow({ label, value, max, highlight }: { label: string; value: number; max: number; highlight?: boolean }) {
  const width = Math.min(Math.abs(value) / max * 100, 100);
  const positive = value > 0;
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className={`w-14 shrink-0 font-mono text-[10px] ${highlight ? "text-signal" : "text-ink-mute"}`}>{label}</span>
      <span className={`w-12 shrink-0 text-right font-mono text-[10px] ${value === 0 ? "text-ink-faint" : positive ? "text-amber-300" : "text-blue-300"}`}>
        {value === 0 ? "—" : `${value.toFixed(1)}%`}
      </span>
      <div className="flex-1 h-1 overflow-hidden rounded-sm bg-bg-line">
        <div className={`h-full ${positive ? "bg-amber-400/60" : "bg-blue-400/60"}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function OICategory({ data, expandedCategories, onToggleCategory, onAddTrigger }: CategoryProps) {
  const expanded = expandedCategories.has("oi");
  const oi = data.openInterest;
  return (
    <div>
      <CategoryHeader name="Open Interest" summary={oi.summary} status={oi.status} expanded={expanded} onToggle={() => onToggleCategory("oi")} />
      {expanded && (
        <div className="mt-1.5 space-y-2 border border-bg-line bg-bg-panel/30 p-3">
          <DetailRow label="Total OI" value={formatBig(oi.total)} />
          <DetailRow label="24h change" value={`${oi.change24hPct > 0 ? "+" : ""}${oi.change24hPct.toFixed(1)}%`}
            valueColor={oi.change24hPct > 0 ? "text-signal" : "text-red-400"} />
          <DetailRow label="1h change" value={`${oi.change1hPct > 0 ? "+" : ""}${oi.change1hPct.toFixed(1)}%`}
            valueColor={oi.change1hPct > 0 ? "text-signal" : "text-red-400"} />
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">24h trend</div>
            <Sparkline data={oi.sparkline} />
          </div>
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Add trigger</div>
            <div className="grid grid-cols-2 gap-1.5">
              <TriggerBtn label={`24h > ${Math.ceil(Math.abs(oi.change24hPct) * 1.3)}%`} onClick={() => onAddTrigger("oiChange24hAbove", Math.ceil(Math.abs(oi.change24hPct) * 1.3))} />
              <TriggerBtn label={`1h > ${Math.max(Math.ceil(Math.abs(oi.change1hPct) * 1.5), 1)}%`} onClick={() => onAddTrigger("oiChange1hAbove", Math.max(Math.ceil(Math.abs(oi.change1hPct) * 1.5), 1))} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderFlowCategory({ data, expandedCategories, onToggleCategory, onAddTrigger }: CategoryProps) {
  const expanded = expandedCategories.has("orderFlow");
  const f = data.orderFlow;
  return (
    <div>
      <CategoryHeader name="Order Flow" summary={f.summary} status={f.status} expanded={expanded} onToggle={() => onToggleCategory("orderFlow")} />
      {expanded && (
        <div className="mt-1.5 space-y-2 border border-bg-line bg-bg-panel/30 p-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal">Buy {f.buyPct}%</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-red-400">{f.sellPct}% Sell</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-bg-line">
              <div className="bg-signal" style={{ width: `${f.buyPct}%` }} />
              <div className="bg-red-500" style={{ width: `${f.sellPct}%` }} />
            </div>
          </div>
          <DetailRow label="Buy volume" value={formatBig(f.buyUsd)} />
          <DetailRow label="Sell volume" value={formatBig(f.sellUsd)} />
          <DetailRow label="Net flow 5min" value={`${f.netUsd > 0 ? "+" : ""}${formatBig(Math.abs(f.netUsd))}`} valueColor={f.netUsd > 0 ? "text-signal" : "text-red-400"} />
          <DetailRow label="Avg trade size" value={formatBig(f.avgTradeUsd)} />
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Recent large fills ($300k+)</div>
            <div className="space-y-1 font-mono text-[10px]">
              {f.largeFills.map((fill, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className={fill.side === "BUY" ? "text-signal" : "text-red-400"}>
                    {fill.side === "BUY" ? "↑" : "↓"} {formatBig(fill.sizeUsd)}
                  </span>
                  <span className="text-ink-mute">@ {fill.price.toLocaleString()} · {fill.secondsAgo}s ago</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Add trigger</div>
            <div className="grid grid-cols-2 gap-1.5">
              <TriggerBtn label={`Buy > ${Math.min(Math.ceil(f.buyPct * 1.1), 90)}%`} onClick={() => onAddTrigger("buyFlowAbove", Math.min(Math.ceil(f.buyPct * 1.1), 90))} />
              <TriggerBtn label={`Large fill > $300k`} onClick={() => onAddTrigger("largeFillDetected", 300000)} />
              <TriggerBtn label={`Net flow > ${formatBig(Math.abs(f.netUsd) * 1.5)}`} onClick={() => onAddTrigger("netFlow5minAbove", Math.abs(f.netUsd) * 1.5)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── L/S Ratio (NEW v14) ──────────────────────────────────────────────────────
function LSRatioCategory({ data, expandedCategories, onToggleCategory, onAddTrigger }: CategoryProps) {
  const expanded = expandedCategories.has("lsRatio");
  const ls = data.lsRatio;
  const trendArrow = ls.trend24h === "rising" ? "↑" : ls.trend24h === "falling" ? "↓" : "→";
  // Status interpretation:
  // ratio > 2.0 = extreme long bias (fade signal)
  // ratio < 0.5 = extreme short bias (bounce signal)
  // ratio 0.8-1.2 = balanced
  const isExtreme = ls.ratio > 2.5 || ls.ratio < 0.4;
  const isLongBias = ls.ratio > 1.0;
  return (
    <div>
      <CategoryHeader name="Long/Short Ratio" summary={ls.summary} status={ls.status} expanded={expanded} onToggle={() => onToggleCategory("lsRatio")} />
      {expanded && (
        <div className="mt-1.5 space-y-2 border border-bg-line bg-bg-panel/30 p-3">
          <DetailRow label="Ratio" value={`${ls.ratio.toFixed(2)} ${trendArrow}`}
            valueColor={isExtreme ? "text-red-400" : isLongBias ? "text-amber-300" : "text-blue-300"} />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal">Long {ls.longAccountPct.toFixed(1)}%</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-red-400">{ls.shortAccountPct.toFixed(1)}% Short</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-bg-line">
              <div className="bg-signal" style={{ width: `${ls.longAccountPct}%` }} />
              <div className="bg-red-500" style={{ width: `${ls.shortAccountPct}%` }} />
            </div>
          </div>
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">24h trend</div>
            <Sparkline data={ls.sparkline} />
          </div>
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Cross-exchange</span>
              <span className="font-mono text-[9px] uppercase text-ink-faint">V2 expansion</span>
            </div>
            <div className="space-y-0.5">
              <CexLSRow label="HL" value={ls.crossExchange.hl} highlight />
              <CexLSRow label="Binance" value={ls.crossExchange.binance} />
              <CexLSRow label="Bybit" value={ls.crossExchange.bybit} />
            </div>
          </div>
          {isExtreme && (
            <div className={`border ${ls.ratio > 1 ? "border-red-500/40 bg-red-500/5 text-red-300" : "border-blue-500/40 bg-blue-500/5 text-blue-300"} px-2 py-1 font-mono text-[10px]`}>
              ⚠ Extreme {ls.ratio > 1 ? "long-heavy" : "short-heavy"} — contrarian setup
            </div>
          )}
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Add trigger</div>
            <div className="grid grid-cols-2 gap-1.5">
              <TriggerBtn label={`L/S > ${(ls.ratio * 1.2).toFixed(1)}`} onClick={() => onAddTrigger("lsRatioAbove", +(ls.ratio * 1.2).toFixed(2))} />
              <TriggerBtn label={`L/S < ${(ls.ratio * 0.7).toFixed(1)}`} onClick={() => onAddTrigger("lsRatioBelow", +(ls.ratio * 0.7).toFixed(2))} />
              <TriggerBtn label="Flip bullish (>1)" onClick={() => onAddTrigger("lsRatioFlipBullish", 1.0)} />
              <TriggerBtn label="Flip bearish (<1)" onClick={() => onAddTrigger("lsRatioFlipBearish", 1.0)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CexLSRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  if (value === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className={`w-14 shrink-0 font-mono text-[10px] ${highlight ? "text-signal" : "text-ink-mute"}`}>{label}</span>
        <span className="font-mono text-[10px] text-ink-faint">—</span>
      </div>
    );
  }
  const isLong = value > 1.0;
  const widthPct = Math.min((isLong ? value : 1 / value) / 3 * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className={`w-14 shrink-0 font-mono text-[10px] ${highlight ? "text-signal" : "text-ink-mute"}`}>{label}</span>
      <span className={`w-12 shrink-0 text-right font-mono text-[10px] ${isLong ? "text-amber-300" : "text-blue-300"}`}>
        {value.toFixed(2)}
      </span>
      <div className="flex-1 h-1 overflow-hidden rounded-sm bg-bg-line">
        <div className={`h-full ${isLong ? "bg-amber-400/60" : "bg-blue-400/60"}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function LiquidationsCategory({ data, expandedCategories, onToggleCategory, onAddTrigger }: CategoryProps) {
  const expanded = expandedCategories.has("liquidations");
  const l = data.liquidations;
  const longPct = (l.longUsd / l.total1hUsd) * 100;
  const shortPct = (l.shortUsd / l.total1hUsd) * 100;
  return (
    <div>
      <CategoryHeader name="Liquidations" summary={l.summary} status={l.status} expanded={expanded} onToggle={() => onToggleCategory("liquidations")} />
      {expanded && (
        <div className="mt-1.5 space-y-2 border border-bg-line bg-bg-panel/30 p-3">
          <DetailRow label="Total 1h" value={formatBig(l.total1hUsd)} />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-red-400">Long liq {longPct.toFixed(0)}%</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-blue-300">{shortPct.toFixed(0)}% Short</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-bg-line">
              <div className="bg-red-500" style={{ width: `${longPct}%` }} />
              <div className="bg-blue-500" style={{ width: `${shortPct}%` }} />
            </div>
          </div>
          <DetailRow label="Long liq" value={formatBig(l.longUsd)} valueColor="text-red-400" />
          <DetailRow label="Short liq" value={formatBig(l.shortUsd)} valueColor="text-blue-300" />
          <DetailRow label="Largest" value={`${formatBig(l.largestUsd)} ${l.largestSide}`} />
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">24h pattern</div>
            <Sparkline data={l.pattern24h} />
          </div>
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Add trigger</div>
            <div className="grid grid-cols-2 gap-1.5">
              <TriggerBtn label={`Total > ${formatBig(l.total1hUsd * 1.5)}`} onClick={() => onAddTrigger("liquidations1hAbove", l.total1hUsd * 1.5)} />
              <TriggerBtn label={`Long > ${formatBig(l.longUsd * 1.5)}`} onClick={() => onAddTrigger("longLiquidationsAbove", l.longUsd * 1.5)} />
              <TriggerBtn label={`Short > ${formatBig(l.shortUsd * 1.5)}`} onClick={() => onAddTrigger("shortLiquidationsAbove", l.shortUsd * 1.5)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderBookCategory({ data, expandedCategories, onToggleCategory, onAddTrigger }: CategoryProps) {
  const expanded = expandedCategories.has("orderBook");
  const b = data.orderBook;
  return (
    <div>
      <CategoryHeader name="Order Book" summary={b.summary} status={b.status} expanded={expanded} onToggle={() => onToggleCategory("orderBook")} />
      {expanded && (
        <div className="mt-1.5 space-y-2 border border-bg-line bg-bg-panel/30 p-3">
          <DetailRow label="Spread" value={`${b.spreadAbs} (${b.spreadPct.toFixed(4)}%)`} />
          <DetailRow label="Best bid" value={b.bestBid.toLocaleString()} valueColor="text-signal" />
          <DetailRow label="Best ask" value={b.bestAsk.toLocaleString()} valueColor="text-red-400" />
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Depth ±0.1%</div>
            <DetailRow label="  Bids" value={formatBig(b.depth01.bids)} />
            <DetailRow label="  Asks" value={formatBig(b.depth01.asks)} />
          </div>
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Depth ±0.5%</div>
            <DetailRow label="  Bids" value={formatBig(b.depth05.bids)} />
            <DetailRow label="  Asks" value={formatBig(b.depth05.asks)} />
          </div>
          <DetailRow label="Imbalance" value={`${b.imbalance > 0 ? "+" : ""}${b.imbalance}% ${b.imbalance > 0 ? "(bid-heavy)" : "(ask-heavy)"}`} valueColor={b.imbalance > 0 ? "text-signal" : "text-red-400"} />
          <div className="border-t border-bg-line pt-2">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Add trigger</div>
            <div className="grid grid-cols-2 gap-1.5">
              <TriggerBtn label={`Spread > ${Math.ceil(b.spreadPct * 10000 * 2)} bps`} onClick={() => onAddTrigger("spreadAbove", Math.ceil(b.spreadPct * 10000 * 2))} />
              <TriggerBtn label={`Imbalance > ${Math.ceil(Math.abs(b.imbalance) * 1.5)}%`} onClick={() => onAddTrigger("imbalanceAbove", Math.ceil(Math.abs(b.imbalance) * 1.5))} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OnChainCategory({ expandedCategories, onToggleCategory }: { expandedCategories: Set<CategoryKind>; onToggleCategory: (kind: CategoryKind) => void }) {
  const expanded = expandedCategories.has("onChain");
  return (
    <div>
      <CategoryHeader name="On-chain" summary="🔒 Coming in V2" status="v2" expanded={expanded} onToggle={() => onToggleCategory("onChain")} />
      {expanded && (
        <div className="mt-1.5 space-y-2 border border-bg-line bg-bg-panel/30 p-3">
          <div className="text-center"><div className="text-3xl">🔒</div><div className="mt-2 font-mono text-xs text-ink-mute">Coming in V2</div></div>
          <div className="border-t border-bg-line pt-2 font-mono text-[10px] text-ink-faint">
            Will include (via Glassnode / Arkham):
            <ul className="mt-1 ml-3 space-y-0.5 list-disc list-inside">
              <li>Exchange inflow / outflow</li>
              <li>Stablecoin minting</li>
              <li>Whale wallet movements</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function HLActivityCategory({ expandedCategories, onToggleCategory }: { expandedCategories: Set<CategoryKind>; onToggleCategory: (kind: CategoryKind) => void }) {
  const expanded = expandedCategories.has("hlActivity");
  return (
    <div>
      <CategoryHeader name="HL Activity" summary="🔒 Unique edge (V2)" status="v2" expanded={expanded} onToggle={() => onToggleCategory("hlActivity")} />
      {expanded && (
        <div className="mt-1.5 space-y-2 border border-bg-line bg-bg-panel/30 p-3">
          <div className="text-center"><div className="text-3xl">⚡</div><div className="mt-2 font-mono text-xs text-amber-300">Our V2 unique edge</div></div>
          <div className="border-t border-bg-line pt-2 font-mono text-[10px] text-ink-faint">
            Hyperliquid-only data, not in any other dashboard:
            <ul className="mt-1 ml-3 space-y-0.5 list-disc list-inside">
              <li>HLP vault position changes</li>
              <li>Top HL trader positioning</li>
              <li>Vault leader trades</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, valueColor, suffix }: { label: string; value: string; valueColor?: string; suffix?: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px]">
      <span className="text-ink-mute">{label}</span>
      <span className={`font-mono ${valueColor ?? "text-ink"}`}>{value}{suffix && <span className="ml-1">{suffix}</span>}</span>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return (
    <div className="flex h-10 items-end gap-0.5">
      {data.map((v, i) => {
        const h = ((v - min) / range) * 100;
        return <div key={i} className="flex-1 bg-signal/50" style={{ height: `${Math.max(h, 5)}%` }} />;
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ORDER COLUMN — D12 (default trigger + PREVIEW) + D13 (HL-spec fields) + D14 (popular combos)
// ═════════════════════════════════════════════════════════════════════════════
type OrderColumnProps = {
  data: SymbolDetail; symbol: Symbol;
  side: Side; setSide: (s: Side) => void;
  sizePct: number; setSizePct: (n: number) => void;
  sizeRaw: string; setSizeRaw: (s: string) => void;
  orderType: OrderType; setOrderType: (t: OrderType) => void;
  limitPrice: string; setLimitPrice: (s: string) => void;
  slippage: number; setSlippage: (n: number) => void;
  leverage: number; setLeverage: (n: number) => void;
  marginMode: MarginMode; setMarginMode: (m: MarginMode) => void;
  triggerConditions: TriggerCondition[];
  triggerEvaluation: { matches: boolean };
  onRemoveCondition: (id: string) => void;
  onUpdateThreshold: (id: string, threshold: number) => void;
  reduceOnly: boolean; setReduceOnly: (b: boolean) => void;
  tpsl: boolean; setTpsl: (b: boolean) => void;
  postOnly: boolean; setPostOnly: (b: boolean) => void;
  tif: "GTC" | "IOC"; setTif: (t: "GTC" | "IOC") => void;
  executionType: "market" | "limit"; setExecutionType: (t: "market" | "limit") => void;
  onAction: () => void;
  savedRules: SavedRule[];
  viewingRuleId: string | null;
  onCloseRuleView: () => void;
  onCancelRule: (id: string) => void;
  onAddPriceCondition: (kind: ConditionKind, threshold: number) => void;
  onOpenLibrary: () => void;
  onApplyCombo: (combo: PopularCombo) => void;
};

function OrderColumn(props: OrderColumnProps) {
  const { savedRules, viewingRuleId, onCloseRuleView, onCancelRule } = props;
  const viewedRule = savedRules.find(r => r.id === viewingRuleId) ?? null;

  if (viewedRule) {
    return <ActiveRuleView rule={viewedRule} onClose={onCloseRuleView} onCancel={() => onCancelRule(viewedRule.id)} />;
  }

  return (
    <div className="p-4">
      {/* Tab header with Trigger emphasis (D12) */}
      <div className="mb-3 flex gap-px border-b border-bg-line">
        <OrderTypeTab kind="market" active={props.orderType === "market"} onClick={() => props.setOrderType("market")} label="Market" />
        <OrderTypeTab kind="limit" active={props.orderType === "limit"} onClick={() => props.setOrderType("limit")} label="Limit" />
        <OrderTypeTab kind="trigger" active={props.orderType === "trigger"} onClick={() => props.setOrderType("trigger")} label="Trigger" emphasis />
      </div>

      {/* D12: Trigger PREVIEW alert when trigger tab active */}
      {props.orderType === "trigger" && (
        <div className="mb-3 border border-amber-500/40 bg-amber-500/5 p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-amber-300">⚡ Preview</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-mute">
            Our core feature. Full execution in <span className="text-amber-300">M2 (W5-W6)</span>. Build rules now — they fire when M2 launches.
          </p>
        </div>
      )}

      {props.orderType === "market" && <MarketLimitPanel {...props} isLimit={false} />}
      {props.orderType === "limit" && <MarketLimitPanel {...props} isLimit={true} />}
      {props.orderType === "trigger" && <TriggerPanel {...props} />}
    </div>
  );
}

function OrderTypeTab({ active, onClick, label, emphasis }: { kind: OrderType; active: boolean; onClick: () => void; label: string; emphasis?: boolean }) {
  const base = "px-3 py-2.5 font-mono text-xs uppercase tracking-[0.1em] transition-colors";
  let cls = "";
  if (active) {
    cls = emphasis ? "border-b-2 border-amber-400 text-amber-300" : "border-b-2 border-signal text-signal";
  } else {
    cls = emphasis ? "text-amber-400/70 hover:text-amber-300" : "text-ink-mute hover:text-ink";
  }
  return <button onClick={onClick} className={`${base} ${cls}`}>{emphasis && "★ "}{label}</button>;
}

// ── Market & Limit Panel (D13) ───────────────────────────────────────────────
function MarketLimitPanel(props: OrderColumnProps & { isLimit: boolean }) {
  const { data, symbol, side, setSide, sizePct, setSizePct, sizeRaw, setSizeRaw, limitPrice, setLimitPrice,
    slippage, setSlippage, leverage, setLeverage, marginMode, setMarginMode,
    reduceOnly, setReduceOnly, tpsl, setTpsl, postOnly, setPostOnly, tif, setTif, onAction, isLimit } = props;

  return (
    <>
      {/* Long/Short toggle */}
      <div className="flex gap-px border border-bg-line">
        <button onClick={() => setSide("long")} className={`flex-1 px-2 py-2.5 font-mono text-xs ${side === "long" ? "bg-signal/15 text-signal" : "text-ink-mute"}`}>Buy / Long</button>
        <button onClick={() => setSide("short")} className={`flex-1 px-2 py-2.5 font-mono text-xs ${side === "short" ? "bg-red-500/15 text-red-400" : "text-ink-mute"}`}>Sell / Short</button>
      </div>

      {/* Margin mode + Leverage */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Margin</label>
          <div className="mt-1 flex gap-px border border-bg-line">
            {(["cross", "isolated"] as MarginMode[]).map(m => (
              <button key={m} onClick={() => setMarginMode(m)} className={`flex-1 px-2 py-1.5 font-mono text-[10px] uppercase ${marginMode === m ? "bg-signal/15 text-signal" : "text-ink-mute"}`}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Leverage</label>
          <div className="mt-1 flex items-center border border-bg-line bg-bg">
            <input type="number" min="1" max="50" value={leverage} onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
              className="flex-1 bg-transparent px-2 py-1.5 font-mono text-sm outline-none" />
            <span className="pr-2 font-mono text-xs text-ink-faint">x</span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[11px]">
        <div className="flex justify-between"><span className="text-ink-faint">Available to Trade</span><span className="font-mono text-ink-mute">0.00 USDC</span></div>
        <div className="flex justify-between"><span className="text-ink-faint">Current Position</span><span className="font-mono text-ink-mute">0.00 {symbol}</span></div>
      </div>

      {isLimit && (
        <div className="mt-3">
          <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Price (USDC)</label>
          <input type="text" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={data.mark.toLocaleString()}
            className="mt-1 w-full border border-bg-line bg-bg px-2.5 py-2 font-mono text-sm outline-none focus:border-signal" />
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">Size</label>
          <span className="font-mono text-[10px] text-ink-faint">{symbol}</span>
        </div>
        <input type="text" value={sizeRaw} onChange={(e) => setSizeRaw(e.target.value)} placeholder="0.00"
          className="w-full border border-bg-line bg-bg px-2.5 py-2 font-mono text-sm outline-none focus:border-signal" />
        <div className="mt-2 flex items-center gap-2">
          <input type="range" min="0" max="100" value={sizePct} onChange={(e) => setSizePct(parseInt(e.target.value))} className="flex-1 accent-signal" />
          <div className="flex items-center border border-bg-line bg-bg">
            <input type="number" value={sizePct} onChange={(e) => setSizePct(parseFloat(e.target.value) || 0)}
              className="w-12 bg-transparent px-1 py-1 text-right font-mono text-xs outline-none" />
            <span className="px-1 font-mono text-xs text-ink-faint">%</span>
          </div>
        </div>
      </div>

      {!isLimit && (
        <div className="mt-3">
          <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Max slippage</label>
          <div className="mt-1 flex items-center border border-bg-line bg-bg">
            <input type="number" step="0.1" value={slippage} onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
              className="flex-1 bg-transparent px-2.5 py-1.5 font-mono text-sm outline-none" />
            <span className="pr-2 font-mono text-xs text-ink-faint">%</span>
          </div>
        </div>
      )}

      {isLimit && (
        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Time in force</label>
            <div className="mt-1 flex gap-px border border-bg-line">
              {(["GTC", "IOC"] as const).map(t => (
                <button key={t} onClick={() => setTif(t)} className={`flex-1 px-2 py-1.5 font-mono text-[10px] uppercase ${tif === t ? "bg-signal/15 text-signal" : "text-ink-mute"}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} className="accent-signal" />
          <span className="text-ink-mute">Reduce Only</span>
        </label>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={tpsl} onChange={(e) => setTpsl(e.target.checked)} className="accent-signal" />
          <span className="text-ink-mute">Take Profit / Stop Loss</span>
        </label>
        {isLimit && (
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={postOnly} onChange={(e) => setPostOnly(e.target.checked)} className="accent-signal" />
            <span className="text-ink-mute">Post Only (ALO)</span>
          </label>
        )}
      </div>

      <div className="mt-3 space-y-1 text-[10px]">
        <div className="flex justify-between"><span className="text-ink-faint">Liquidation Price</span><span className="font-mono text-ink-mute">{sizePct > 0 ? `$${(data.mark * (side === "long" ? (1 - 1/leverage * 0.9) : (1 + 1/leverage * 0.9))).toFixed(2)}` : "N/A"}</span></div>
        <div className="flex justify-between"><span className="text-ink-faint">Order Value</span><span className="font-mono text-ink-mute">{sizePct > 0 ? `$${(sizePct * 100).toFixed(2)}` : "N/A"}</span></div>
        {!isLimit && <div className="flex justify-between"><span className="text-ink-faint">Slippage</span><span className="font-mono text-ink-mute">Est: 0.01% / Max: {slippage}%</span></div>}
        <div className="flex justify-between"><span className="text-ink-faint">Fees</span><span className="font-mono text-ink-mute">0.035% HL + 0.05% builder</span></div>
      </div>

      <button onClick={onAction}
        className="mt-4 w-full border border-signal bg-signal/15 px-4 py-3 font-mono text-xs uppercase tracking-[0.1em] text-signal hover:bg-signal/25">
        Connect
      </button>
    </>
  );
}

// ── Trigger Panel (D10, D11, D13, D14) ───────────────────────────────────────
function TriggerPanel(props: OrderColumnProps) {
  const { data, symbol, side, setSide, sizePct, setSizePct,
    triggerConditions, triggerEvaluation, onRemoveCondition, onUpdateThreshold,
    executionType, setExecutionType, leverage, setLeverage, marginMode, setMarginMode,
    onAction, onAddPriceCondition, onOpenLibrary, onApplyCombo, savedRules } = props;

  return (
    <>
      {/* Long/Short toggle */}
      <div className="flex gap-px border border-bg-line">
        <button onClick={() => setSide("long")} className={`flex-1 px-2 py-2.5 font-mono text-xs ${side === "long" ? "bg-signal/15 text-signal" : "text-ink-mute"}`}>Buy / Long</button>
        <button onClick={() => setSide("short")} className={`flex-1 px-2 py-2.5 font-mono text-xs ${side === "short" ? "bg-red-500/15 text-red-400" : "text-ink-mute"}`}>Sell / Short</button>
      </div>

      {/* ═══ WHEN section (D11, D14) ═══ */}
      <div className="mt-3 border-l-2 border-amber-500/40 pl-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-amber-300">When (all true) {triggerConditions.length}/3</span>
          <button onClick={onOpenLibrary} className="font-mono text-[10px] text-ink-mute hover:text-amber-300">
            Browse all →
          </button>
        </div>

        {triggerConditions.length === 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] text-ink-faint">
              Add a condition from Signals panel, Trigger Library, or quick price triggers:
            </p>
            <div className="flex gap-1.5">
              <button onClick={() => onAddPriceCondition("priceAbove", Math.ceil(data.mark * 1.02))}
                className="flex-1 border border-bg-line bg-bg px-2 py-2 font-mono text-[10px] text-ink-mute hover:border-signal hover:text-signal">
                Price &gt; ${Math.ceil(data.mark * 1.02).toLocaleString()}
              </button>
              <button onClick={() => onAddPriceCondition("priceBelow", Math.floor(data.mark * 0.98))}
                className="flex-1 border border-bg-line bg-bg px-2 py-2 font-mono text-[10px] text-ink-mute hover:border-signal hover:text-signal">
                Price &lt; ${Math.floor(data.mark * 0.98).toLocaleString()}
              </button>
            </div>

            {/* Popular combinations (D14) */}
            <div className="border-t border-bg-line pt-2">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Popular combinations</div>
              <div className="space-y-1.5">
                {POPULAR_COMBOS.slice(0, 3).map((combo) => (
                  <button key={combo.id} onClick={() => onApplyCombo(combo)}
                    className="w-full border border-bg-line bg-bg-panel/30 p-2 text-left transition hover:border-amber-500/40 hover:bg-amber-500/5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-amber-300">{combo.name}</span>
                      <span className={`font-mono text-[9px] uppercase ${combo.side === "long" ? "text-signal" : "text-red-400"}`}>{combo.side}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-ink-faint">{combo.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {triggerConditions.map((c, idx) => (
              <div key={c.id}>
                {idx > 0 && <div className="my-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">AND</div>}
                <ConditionCard condition={c} data={data}
                  onUpdateThreshold={(t) => onUpdateThreshold(c.id, t)}
                  onRemove={() => onRemoveCondition(c.id)} />
              </div>
            ))}
          </div>
        )}

        {triggerConditions.length > 0 && (
          <div className={`mt-2 border px-2 py-1.5 font-mono text-[10px] ${triggerEvaluation.matches ? "border-signal/40 bg-signal/5 text-signal" : "border-bg-line text-ink-mute"}`}>
            {triggerEvaluation.matches ? "● ALL CONDITIONS MET — WOULD FIRE NOW" : "○ waiting for conditions…"}
          </div>
        )}
      </div>

      {/* ═══ THEN section ═══ */}
      <div className="mt-3 border-l-2 border-signal/40 pl-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-signal">Then (when fires)</div>

        {/* Execution type (Market vs Limit when triggered) */}
        <div className="mb-2">
          <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Execute as</label>
          <div className="mt-1 flex gap-px border border-bg-line">
            {(["market", "limit"] as const).map(t => (
              <button key={t} onClick={() => setExecutionType(t)} className={`flex-1 px-2 py-1.5 font-mono text-[10px] uppercase ${executionType === t ? "bg-signal/15 text-signal" : "text-ink-mute"}`}>{t}</button>
            ))}
          </div>
        </div>

        {/* Margin + Leverage */}
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Margin</label>
            <div className="mt-1 flex gap-px border border-bg-line">
              {(["cross", "isolated"] as MarginMode[]).map(m => (
                <button key={m} onClick={() => setMarginMode(m)} className={`flex-1 px-1 py-1 font-mono text-[9px] uppercase ${marginMode === m ? "bg-signal/15 text-signal" : "text-ink-mute"}`}>
                  {m.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Leverage</label>
            <div className="mt-1 flex items-center border border-bg-line bg-bg">
              <input type="number" min="1" max="50" value={leverage} onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
                className="flex-1 bg-transparent px-2 py-1 font-mono text-xs outline-none" />
              <span className="pr-1 font-mono text-[10px] text-ink-faint">x</span>
            </div>
          </div>
        </div>

        {/* Size */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Size (% portfolio)</label>
          <div className="mt-1 flex items-center gap-2">
            <input type="range" min="0" max="100" value={sizePct} onChange={(e) => setSizePct(parseInt(e.target.value))} className="flex-1 accent-signal" />
            <div className="flex items-center border border-bg-line bg-bg">
              <input type="number" value={sizePct} onChange={(e) => setSizePct(parseFloat(e.target.value) || 0)}
                className="w-12 bg-transparent px-1 py-1 text-right font-mono text-xs outline-none" />
              <span className="px-1 font-mono text-xs text-ink-faint">%</span>
            </div>
          </div>
        </div>

        {/* Slippage protection (market execution only) */}
        {executionType === "market" && (
          <div className="mt-2">
            <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Max slippage</label>
            <div className="mt-1 flex items-center border border-bg-line bg-bg">
              <input type="number" step="0.1" value={props.slippage} onChange={(e) => props.setSlippage(parseFloat(e.target.value) || 0)}
                className="flex-1 bg-transparent px-2 py-1 font-mono text-xs outline-none" />
              <span className="pr-2 font-mono text-[10px] text-ink-faint">%</span>
            </div>
            <p className="mt-1 font-mono text-[9px] text-ink-faint">Protects against bad fills when trigger fires during volatility.</p>
          </div>
        )}

        {/* TP/SL toggle (OCO pattern) */}
        <div className="mt-2">
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={props.tpsl} onChange={(e) => props.setTpsl(e.target.checked)} className="accent-signal" />
            <span className="text-ink-mute">Auto Take Profit / Stop Loss</span>
          </label>
          {props.tpsl && (
            <div className="mt-1.5 ml-5 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] uppercase tracking-[0.1em] text-ink-faint">TP (% gain)</label>
                <div className="mt-0.5 flex items-center border border-bg-line bg-bg">
                  <input type="number" step="1" defaultValue={5} className="flex-1 bg-transparent px-1 py-0.5 font-mono text-[10px] outline-none" />
                  <span className="pr-1 font-mono text-[9px] text-signal">%</span>
                </div>
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-[0.1em] text-ink-faint">SL (% loss)</label>
                <div className="mt-0.5 flex items-center border border-bg-line bg-bg">
                  <input type="number" step="1" defaultValue={2} className="flex-1 bg-transparent px-1 py-0.5 font-mono text-[10px] outline-none" />
                  <span className="pr-1 font-mono text-[9px] text-red-400">%</span>
                </div>
              </div>
            </div>
          )}
          <p className="mt-1 font-mono text-[9px] text-ink-faint">OCO pattern: one fills → other auto-cancels.</p>
        </div>

        {/* Price reference for price-based triggers */}
        {triggerConditions.some(c => c.kind === "priceAbove" || c.kind === "priceBelow") && (
          <div className="mt-2 border border-bg-line bg-bg-panel/50 p-2 text-[10px]">
            <span className="font-mono text-ink-faint">Price reference:</span>
            <span className="ml-1.5 font-mono text-signal">Mark Price</span>
            <p className="mt-0.5 font-mono text-[9px] text-ink-faint">Avoids wick-based false triggers. Industry best practice.</p>
          </div>
        )}
      </div>

      {/* ═══ PREVIEW section (D13) ═══ */}
      <div className="mt-3 border-l-2 border-blue-500/40 pl-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-blue-300">Preview (if triggered now)</div>
        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between"><span className="text-ink-faint">Entry price</span><span className="font-mono text-ink">${data.mark.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-ink-faint">Position size</span><span className="font-mono text-ink-mute">{sizePct > 0 ? `~$${(sizePct * 100).toFixed(0)}` : "—"}</span></div>
          <div className="flex justify-between"><span className="text-ink-faint">Liquidation</span><span className="font-mono text-ink-mute">{sizePct > 0 ? `$${(data.mark * (side === "long" ? (1 - 1/leverage * 0.9) : (1 + 1/leverage * 0.9))).toFixed(0)}` : "—"}</span></div>
          <div className="flex justify-between"><span className="text-ink-faint">Risk / trade</span><span className="font-mono text-ink-mute">{sizePct > 0 ? `${sizePct.toFixed(1)}% of equity` : "—"}</span></div>
          <div className="flex justify-between"><span className="text-ink-faint">Fees</span><span className="font-mono text-ink-mute">0.035% HL + 0.05% builder</span></div>
        </div>
      </div>

      {/* Save button */}
      <button onClick={onAction}
        className={`mt-4 w-full px-4 py-3 font-mono text-xs uppercase tracking-[0.1em] ${
          triggerConditions.length === 0
            ? "border border-bg-line bg-bg-panel text-ink-faint cursor-not-allowed"
            : triggerEvaluation.matches
              ? "border border-signal bg-signal/15 text-signal hover:bg-signal/25"
              : "border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
        }`}>
        {triggerConditions.length === 0 ? "Add a condition first" : triggerEvaluation.matches ? "★ Save Rule (would fire now)" : "★ Save as Rule"}
      </button>

      {savedRules.length > 0 && (
        <div className="mt-3 border-t border-bg-line pt-2 text-center">
          <p className="font-mono text-[10px] text-ink-faint">{savedRules.length} saved rule{savedRules.length > 1 ? "s" : ""} — click chart lines to view</p>
        </div>
      )}
    </>
  );
}

// ── Condition Card (D10) ─────────────────────────────────────────────────────
function ConditionCard({ condition, data, onUpdateThreshold, onRemove }: {
  condition: TriggerCondition;
  data: SymbolDetail;
  onUpdateThreshold: (t: number) => void;
  onRemove: () => void;
}) {
  const meta = CONDITION_LABELS[condition.kind];
  const currentVal = getCurrentValue(condition.kind, data);
  const distance = getDistanceToFire(condition.kind, currentVal, condition.threshold);
  const willFire = distance >= 100;

  return (
    <div className={`border ${willFire ? "border-signal/50 bg-signal/5" : "border-bg-line bg-bg"} px-2.5 py-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] text-ink-mute">{condition.symbol} · {meta.category}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5 font-mono text-[11px] text-ink">
            <span>{meta.label}</span>
            <input type="number" step="0.5" value={condition.threshold} onChange={(e) => onUpdateThreshold(parseFloat(e.target.value) || 0)}
              className="w-16 border border-bg-line bg-bg-panel px-1 py-0.5 text-right outline-none focus:border-signal" />
            <span className="text-ink-mute">{meta.unit}</span>
          </div>
        </div>
        <button onClick={onRemove} className="text-ink-faint hover:text-red-400" aria-label="Remove">×</button>
      </div>
      {/* D10: Current value + distance + progress bar */}
      <div className="mt-1.5">
        <div className="flex items-baseline justify-between font-mono text-[10px]">
          <span className="text-ink-faint">Now: <span className="text-ink">{formatConditionValue(condition.kind, currentVal)}</span></span>
          <span className={willFire ? "text-signal font-medium" : "text-ink-mute"}>
            {willFire ? "● ARMED" : `${distance.toFixed(0)}% to fire`}
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-sm bg-bg-line">
          <div className={`h-full ${willFire ? "bg-signal" : "bg-amber-400/70"}`} style={{ width: `${distance}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Active Rule View (preserved from v12) ────────────────────────────────────
function ActiveRuleView({ rule, onClose, onCancel }: { rule: SavedRule; onClose: () => void; onCancel: () => void }) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between border-b border-bg-line pb-2.5">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-amber-300">Active Rule</span>
        <button onClick={onClose} className="font-mono text-[10px] uppercase text-ink-mute hover:text-ink">close ×</button>
      </div>
      <div className="space-y-3">
        <div className="border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-300">When triggered</div>
          <div className="space-y-1.5">
            {rule.conditions.map((c, idx) => (
              <div key={c.id}>
                {idx > 0 && <div className="my-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">AND</div>}
                <div className="font-mono text-xs text-ink">
                  {rule.symbol} {CONDITION_LABELS[c.kind].label} {c.threshold}{CONDITION_LABELS[c.kind].unit ? ` ${CONDITION_LABELS[c.kind].unit}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-bg-line bg-bg-panel/30 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">Then execute</div>
          <DetailRow label="Direction" value={rule.side === "long" ? "Buy / Long" : "Sell / Short"} valueColor={rule.side === "long" ? "text-signal" : "text-red-400"} />
          <DetailRow label="Execute as" value={rule.executionType.toUpperCase()} />
          <DetailRow label="Size" value={`${rule.sizePct}% portfolio`} />
          <DetailRow label="Symbol" value={`${rule.symbol}-USDC`} />
        </div>
        <div className="font-mono text-[10px] text-ink-faint">Created {new Date(rule.createdAt).toLocaleString()}</div>
        <button onClick={() => { if (confirm("Cancel this rule?")) onCancel(); }}
          className="w-full border border-red-500/50 bg-red-500/10 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-red-400 hover:bg-red-500/20">
          Cancel Rule
        </button>
        <p className="font-mono text-[10px] text-ink-faint">
          Demo: in V1 (M2), our worker watches this rule 24/7 and sends Telegram + in-app alerts. Builder fee: 5 bps.
        </p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TRIGGER LIBRARY MODAL (D11)
// ═════════════════════════════════════════════════════════════════════════════
function TriggerLibraryModal({ symbol, data, onClose, onSelectCondition, onApplyCombo }: {
  symbol: Symbol;
  data: SymbolDetail;
  onClose: () => void;
  onSelectCondition: (kind: ConditionKind, threshold: number) => void;
  onApplyCombo: (combo: PopularCombo) => void;
}) {
  const [search, setSearch] = useState("");
  const allConditions = Object.entries(CONDITION_LABELS) as [ConditionKind, typeof CONDITION_LABELS[ConditionKind]][];

  // Group by category
  const grouped = allConditions.reduce((acc, [kind, meta]) => {
    if (!acc[meta.category]) acc[meta.category] = [];
    if (!search || meta.label.toLowerCase().includes(search.toLowerCase()) || meta.category.toLowerCase().includes(search.toLowerCase())) {
      acc[meta.category].push({ kind, meta });
    }
    return acc;
  }, {} as Record<string, { kind: ConditionKind; meta: typeof CONDITION_LABELS[ConditionKind] }[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-bg-line bg-bg" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 border-b border-bg-line bg-bg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-[0.15em] text-amber-300">Trigger Library</h2>
            <button onClick={onClose} className="font-mono text-xs uppercase text-ink-mute hover:text-ink">close ×</button>
          </div>
          <p className="mt-1 text-[11px] text-ink-mute">22 trigger conditions + 5 popular combos for {symbol}</p>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conditions…"
            className="mt-2 w-full border border-bg-line bg-bg-panel px-3 py-2 font-mono text-xs outline-none focus:border-amber-500/50" />
        </div>

        <div className="p-4">
          {/* Popular combinations */}
          <div className="mb-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-300">★ Popular Combinations</div>
            <div className="space-y-2">
              {POPULAR_COMBOS.map((combo) => (
                <button key={combo.id} onClick={() => onApplyCombo(combo)}
                  className="w-full border border-bg-line bg-bg-panel/30 p-3 text-left transition hover:border-amber-500/40 hover:bg-amber-500/5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-amber-300">{combo.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase text-ink-faint">{combo.category}</span>
                      <span className={`font-mono text-[9px] uppercase ${combo.side === "long" ? "text-signal" : "text-red-400"}`}>{combo.side}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-mute">{combo.description}</p>
                  <div className="mt-1.5 font-mono text-[10px] text-ink-faint">
                    {combo.conditionTemplates.length} condition{combo.conditionTemplates.length > 1 ? "s" : ""}: {combo.conditionTemplates.map(t => CONDITION_LABELS[t.kind].label).join(" + ")}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* All conditions by category */}
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">All Conditions (22)</div>
          {Object.entries(grouped).map(([category, conditions]) => (
            conditions.length > 0 && (
              <div key={category} className="mb-4">
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">{category} ({conditions.length})</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {conditions.map(({ kind, meta }) => {
                    const currentVal = getCurrentValue(kind, data);
                    const suggestedThreshold = +(Math.abs(currentVal) * 1.3).toFixed(2);
                    return (
                      <button key={kind} onClick={() => onSelectCondition(kind, suggestedThreshold)}
                        className="flex flex-col border border-bg-line bg-bg-panel/30 p-2 text-left transition hover:border-amber-500/40 hover:bg-amber-500/5">
                        <span className="font-mono text-[11px] text-ink">{meta.label}</span>
                        <span className="mt-0.5 font-mono text-[10px] text-ink-mute">
                          Now: {formatConditionValue(kind, currentVal)} · Suggested {meta.unit === "USD" ? formatBig(suggestedThreshold) : `${suggestedThreshold}${meta.unit}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BOTTOM TABS (Desktop)
// ═════════════════════════════════════════════════════════════════════════════
function BottomTabsArea({ activeTab, onTabChange }: { activeTab: BottomTab; onTabChange: (t: BottomTab) => void }) {
  const tabs: { id: BottomTab; label: string }[] = [
    { id: "balances", label: "Balances" }, { id: "positions", label: "Positions" }, { id: "outcomes", label: "Outcomes" },
    { id: "openOrders", label: "Open Orders" }, { id: "twap", label: "TWAP" }, { id: "tradeHistory", label: "Trade History" },
    { id: "fundingHistory", label: "Funding History" }, { id: "orderHistory", label: "Order History" }, { id: "triggerHistory", label: "Trigger History" },
  ];
  return (
    <div className="border-t border-bg-line">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-bg-line px-3">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)}
            className={`shrink-0 px-3 py-3 font-mono text-xs ${activeTab === t.id ? "text-signal border-b-2 border-signal" : "text-ink-mute hover:text-ink"}`}>
            {t.label}
            {t.id === "triggerHistory" && <span className="ml-1.5 inline-block rounded-sm bg-amber-500/20 px-1 py-px text-[9px] text-amber-300">Project.Q</span>}
          </button>
        ))}
      </div>
      <div className="min-h-[200px] p-4 text-sm">
        {activeTab === "triggerHistory" ? <TriggerHistoryTable /> : (
          <p className="text-ink-faint">{activeTab === "positions" ? "No open positions yet" : `No data yet — connect wallet to see your ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()}`}</p>
        )}
      </div>
    </div>
  );
}

function TriggerHistoryTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-bg-line text-left text-ink-faint">
            <th className="py-2 px-2 font-mono text-[10px] uppercase">Time</th>
            <th className="py-2 px-2 font-mono text-[10px] uppercase">Rule</th>
            <th className="py-2 px-2 font-mono text-[10px] uppercase">Trigger</th>
            <th className="py-2 px-2 font-mono text-[10px] uppercase">State</th>
            <th className="py-2 px-2 font-mono text-[10px] uppercase">Action</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_TRIGGER_HISTORY.map((h, i) => (
            <tr key={i} className="border-b border-bg-line/40">
              <td className="py-2 px-2 font-mono text-[11px] text-ink-mute">{h.time}</td>
              <td className="py-2 px-2 text-ink">{h.rule}</td>
              <td className="py-2 px-2 font-mono text-[11px] text-ink-mute">{h.trigger}</td>
              <td className="py-2 px-2"><span className={`font-mono text-[10px] uppercase ${h.status === "executed" ? "text-signal" : "text-ink-mute"}`}>{h.fired}</span></td>
              <td className="py-2 px-2 font-mono text-[11px] text-ink-mute">{h.action ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 font-mono text-[10px] text-ink-faint">Mock data — V1 shows your real trigger fires (M2/M3).</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MOBILE
// ═════════════════════════════════════════════════════════════════════════════
function MobileHeader({ showConnect, onConnectClick }: { showConnect: boolean; onConnectClick: () => void }) {
  return (
    <header className="border-b border-bg-line">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-3">
          <button className="text-ink-mute"><HamburgerIcon /></button>
          <Link href="/" className="flex items-center gap-1.5 font-mono text-sm">
            <span className="text-signal">●</span><span className="font-medium">PROJECT.Q</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {showConnect && (
            <button onClick={onConnectClick} className="border border-signal/60 bg-signal/10 px-3 py-1.5 font-mono text-xs uppercase text-signal">Connect</button>
          )}
          <IconButton title="Language"><GlobeIcon /></IconButton>
          <IconButton title="Settings"><GearIcon /></IconButton>
        </div>
      </div>
    </header>
  );
}

type MobileMarketsProps = OrderColumnProps & {
  setSymbol: (s: Symbol) => void;
  candles: CandleData[];
  priceLines: PriceLine[];
  onPriceLineClick: (id: string) => void;
  nonPriceRules: SavedRule[];
  subTab: MarketsSubTab;
  setSubTab: (t: MarketsSubTab) => void;
  marketDataSubTab: MarketDataSubTab;
  setMarketDataSubTab: (t: MarketDataSubTab) => void;
  expandedCategories: Set<CategoryKind>;
  onToggleCategory: (kind: CategoryKind) => void;
  onAddTrigger: (kind: ConditionKind, threshold: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

function MobileMarkets(props: MobileMarketsProps) {
  const { symbol, setSymbol, data, candles, subTab, setSubTab, priceLines, onPriceLineClick, nonPriceRules,
    marketDataSubTab, setMarketDataSubTab } = props;
  return (
    <div>
      <div className="border-b border-bg-line px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value as Symbol)}
              className="border-0 bg-transparent pr-6 font-medium text-lg outline-none">
              {(["BTC", "ETH", "SOL", "HYPE", "DOGE"] as Symbol[]).map(s => <option key={s} value={s}>{s}-USDC</option>)}
            </select>
            <span className="text-[10px] text-signal">10x</span>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg">{data.mark.toLocaleString()}</div>
            <div className={`font-mono text-xs ${data.change24h > 0 ? "text-signal" : "text-red-400"}`}>
              {data.change24h > 0 ? "+" : ""}{data.change24h.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
      <div className="border-b border-bg-line">
        <div className="flex">
          {(["chart", "marketData", "trigger"] as MarketsSubTab[]).map((t) => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`flex-1 py-3 text-center font-medium text-sm ${
                subTab === t
                  ? t === "trigger" ? "border-b-2 border-amber-400 text-amber-300" : "border-b-2 border-signal text-signal"
                  : "text-ink-mute"
              }`}>
              {t === "chart" && "Chart"}
              {t === "marketData" && "Market Data"}
              {t === "trigger" && "★ Trigger"}
            </button>
          ))}
        </div>
      </div>
      <div>
        {subTab === "chart" && (
          <MobileChartTab candles={candles} symbol={symbol} priceLines={priceLines} onPriceLineClick={(id) => { onPriceLineClick(id); setSubTab("trigger"); }} nonPriceRules={nonPriceRules} onShowRule={(id) => { onPriceLineClick(id); setSubTab("trigger"); }} />
        )}
        {subTab === "marketData" && (
          <MobileMarketData
            data={data} symbol={symbol}
            marketDataSubTab={marketDataSubTab}
            setMarketDataSubTab={setMarketDataSubTab}
            expandedCategories={props.expandedCategories}
            onToggleCategory={props.onToggleCategory}
            onAddTrigger={props.onAddTrigger}
            onExpandAll={props.onExpandAll}
            onCollapseAll={props.onCollapseAll}
          />
        )}
        {subTab === "trigger" && <OrderColumn {...props} />}
      </div>
    </div>
  );
}

// Mobile Market Data tab (Book / Trades / Signal sub-tabs)
function MobileMarketData(props: {
  data: SymbolDetail;
  symbol: Symbol;
  marketDataSubTab: MarketDataSubTab;
  setMarketDataSubTab: (t: MarketDataSubTab) => void;
  expandedCategories: Set<CategoryKind>;
  onToggleCategory: (kind: CategoryKind) => void;
  onAddTrigger: (kind: ConditionKind, threshold: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const { data, symbol, marketDataSubTab, setMarketDataSubTab } = props;
  return (
    <div>
      <div className="flex border-b border-bg-line">
        <button onClick={() => setMarketDataSubTab("book")} className={`flex-1 py-2.5 font-mono text-xs uppercase tracking-[0.1em] ${marketDataSubTab === "book" ? "border-b-2 border-signal text-signal" : "text-ink-mute"}`}>Book</button>
        <button onClick={() => setMarketDataSubTab("trades")} className={`flex-1 py-2.5 font-mono text-xs uppercase tracking-[0.1em] ${marketDataSubTab === "trades" ? "border-b-2 border-signal text-signal" : "text-ink-mute"}`}>Trades</button>
        <button onClick={() => setMarketDataSubTab("signal")} className={`flex-1 py-2.5 font-mono text-xs uppercase tracking-[0.1em] ${marketDataSubTab === "signal" ? "border-b-2 border-amber-400 text-amber-300 bg-amber-500/5" : "text-amber-400/70 bg-amber-500/5"}`}>✦ Signals (8)</button>
      </div>
      <div>
        {marketDataSubTab === "book" && <OrderBookLadder data={data} symbol={symbol} />}
        {marketDataSubTab === "trades" && <TradesPanel data={data} symbol={symbol} />}
        {marketDataSubTab === "signal" && <SignalsPanel
          activeTab="signals" setActiveTab={() => {}}
          data={data} symbol={symbol}
          expandedCategories={props.expandedCategories}
          onToggleCategory={props.onToggleCategory}
          onAddTrigger={props.onAddTrigger}
          onExpandAll={props.onExpandAll}
          onCollapseAll={props.onCollapseAll}
        />}
      </div>
    </div>
  );
}

function MobileChartTab({
  candles, symbol, priceLines, onPriceLineClick, nonPriceRules, onShowRule,
}: {
  candles: CandleData[]; symbol: Symbol;
  priceLines: PriceLine[]; onPriceLineClick: (id: string) => void;
  nonPriceRules: SavedRule[]; onShowRule: (id: string) => void;
}) {
  const [tf, setTf] = useState("1h");
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-3 text-xs">
        {["5m", "1h", "D"].map(t => (
          <button key={t} onClick={() => setTf(t)} className={`font-mono ${tf === t ? "text-ink" : "text-ink-mute"}`}>{t}</button>
        ))}
        <span className="text-ink-faint">|</span>
        <button className="font-mono text-ink-mute">ƒ Indicators</button>
      </div>
      {nonPriceRules.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Active:</span>
          {nonPriceRules.map((rule) => (
            <button key={rule.id} onClick={() => onShowRule(rule.id)}
              className="shrink-0 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
              ⚡ {rule.conditions.length}-cond
            </button>
          ))}
        </div>
      )}
      <CandleChart candles={candles} height={420} priceLines={priceLines} onPriceLineClick={onPriceLineClick} hideHeader />
      <div className="mt-3 flex justify-between text-[11px]">
        <div className="flex gap-2 font-mono text-ink-mute">
          {["5y", "1y", "6m", "3m", "1m", "5d", "1d"].map(r => <button key={r}>{r}</button>)}
        </div>
        <span className="font-mono text-ink-faint">{symbol}-USD</span>
      </div>
      {priceLines.length > 0 && (
        <p className="mt-2 text-center font-mono text-[10px] text-amber-300">Tap a trigger line to view / cancel rule →</p>
      )}
    </div>
  );
}

function MobileTradeConnect() {
  const handleConnect = (method: string) => alert(`Demo: ${method}\n\nIn V1, this triggers real wallet connection.`);
  return (
    <div className="p-5">
      <h2 className="mb-4 text-xl">Connect</h2>
      <div className="space-y-3">
        <button onClick={() => handleConnect("Link Desktop Wallet")}
          className="flex w-full items-center gap-3 border border-bg-line bg-bg-panel/60 p-4 text-left transition active:bg-bg-panel">
          <svg className="h-5 w-5 text-ink-mute" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="1" strokeWidth="1.5"/><path d="M2 19h20" strokeWidth="1.5"/></svg>
          <span>Link Desktop Wallet</span>
        </button>
        <button onClick={() => handleConnect("Log in with Email")}
          className="flex w-full items-center gap-3 border border-bg-line bg-bg-panel/60 p-4 text-left transition active:bg-bg-panel">
          <svg className="h-5 w-5 text-ink-mute" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1" strokeWidth="1.5"/><path d="M3 7l9 7 9-7" strokeWidth="1.5"/></svg>
          <span>Log in with Email</span>
        </button>
        <div className="flex items-center gap-2 py-2">
          <div className="h-px flex-1 bg-bg-line"/><span className="font-mono text-[10px] text-ink-faint">OR</span><div className="h-px flex-1 bg-bg-line"/>
        </div>
        <button onClick={() => handleConnect("WalletConnect")}
          className="flex w-full items-center gap-3 border border-bg-line bg-bg-panel/60 p-4 text-left transition active:bg-bg-panel">
          <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6.5 9.5c3-3 7-3 10 0l.4.4c.2.2.2.4 0 .6l-1.3 1.3c-.1.1-.2.1-.3 0l-.5-.5c-2.1-2-5.4-2-7.5 0l-.6.6c-.1.1-.2.1-.3 0L5.1 10.6c-.2-.2-.2-.4 0-.6l1.4-.5zM19.6 13l1.2 1.2c.2.2.2.4 0 .6l-5.4 5.3c-.2.2-.4.2-.6 0L11 16.5c-.1 0-.1 0-.2 0l-3.8 3.7c-.2.2-.4.2-.6 0L1 14.8c-.2-.2-.2-.4 0-.6L2.2 13c.2-.2.4-.2.6 0l3.8 3.7c.1.1.2.1.3 0l3.8-3.7c.2-.2.4-.2.6 0l3.8 3.7c.1.1.2.1.3 0l3.8-3.7c.2-.2.4-.2.5 0z"/></svg>
          <span>WalletConnect</span>
        </button>
      </div>
      <p className="mt-6 text-center font-mono text-[10px] text-ink-faint">Demo mode</p>
    </div>
  );
}

function MobileAccount() {
  return (
    <div>
      <div className="bg-signal/10 px-4 py-3 text-sm">
        <span className="text-ink-mute">Welcome to Project Q! Get started </span><button className="text-signal underline">here</button>.
      </div>
      <div className="p-4">
        <h3 className="mb-3 text-base">Account Equity</h3>
        <div className="space-y-2 border-b border-bg-line pb-4">
          <MobileRow label="Spot" value="$0.00" /><MobileRow label="Perps" value="$0.00" />
        </div>
        <h3 className="mb-3 mt-5 text-base">Perps Overview</h3>
        <div className="space-y-2">
          <MobileRow label="Balance" value="$0.00" /><MobileRow label="Unrealized PNL" value="$0.00" />
          <MobileRow label="Cross Margin Ratio" value="0.00%" valueColor="text-signal" />
          <MobileRow label="Maintenance Margin" value="$0.00" /><MobileRow label="Cross Account Leverage" value="0.00x" />
        </div>
      </div>
    </div>
  );
}

function MobileRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-mute underline decoration-dotted">{label}</span>
      <span className={`font-mono ${valueColor ?? "text-ink"}`}>{value}</span>
    </div>
  );
}

function BottomTabBar({ activeTab, onTabChange }: { activeTab: MobileTab; onTabChange: (t: MobileTab) => void }) {
  const tabs: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
    { id: "markets", label: "Markets", icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 20V10M12 20V4M20 20V14" strokeWidth="2" strokeLinecap="round"/></svg> },
    { id: "trade", label: "Trade", icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" strokeWidth="2"/><circle cx="12" cy="12" r="9" strokeWidth="2"/></svg> },
    { id: "account", label: "Account", icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" strokeWidth="2"/><path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" strokeWidth="2"/></svg> },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-bg-line bg-bg">
      <div className="flex">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 transition ${activeTab === t.id ? "text-signal" : "text-ink-mute"}`}>
            {t.icon}<span className="text-[11px]">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
