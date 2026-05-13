# Signals Framework — Decisions Memo (W2 Day 13)

> **Status**: Phase 2 framework decisions made. Pending: layout design → mockup v12.
> **Phase 1**: Web research on industry tools + perp trader literature (complete).
> **Phase 2**: Framework decisions with founder (complete — see "Decisions" section).
> **Phase 3**: Layout design (in progress).
> **Phase 4**: Mockup v12 update (pending).
> **Author**: Project Q research session.

## Why this document exists

Signals and triggers are Project Q's **core differentiation**. Other parts of the UI (chart, header, bottom tabs) are 95% Hyperliquid baseline. But the middle column (signals) and the trigger order type **must be substantively better** than what's available elsewhere, or we have no reason to exist.

This memo synthesizes 8+ research sources on what perp traders actually use, then maps to what we can realistically ship in V1 alpha with Hyperliquid's API.

# Decisions (locked)

The following decisions are made and ready to be reflected in the v12 mockup.

## D1: Signal Category Structure — 7 categories (5 active + 2 V2 placeholder)

```
V1 alpha (5 categories with live data):
1. Funding              — APR, regime, history, + cross-exchange comparison
2. Open Interest        — Total, 24h/1h change, trend
3. Order Flow           — CVD, Buy%, net flow, large fills
4. Liquidations         — 1h total, long/short split, recent events
5. Order Book           — Spread, depth ±0.1%/0.5%, imbalance

V2 placeholder (Coming Soon):
6. On-chain             — Glassnode/Arkham (exchange flows, stablecoin minting, whale wallets)
7. HL Activity          — HLP vault flow, top traders, vault leaders (our unique edge)
```

Rationale:
- Aligns with the universal "4 pillars" perp trader mental model (Funding/OI/CVD/Liquidations)
- Adds Order Book (5th essential pillar — what HL has but our trigger system surfaces)
- Two V2 placeholders preserve our long-term differentiation story:
  - On-chain (V2): External API integration (Glassnode/Arkham)
  - HL Activity (V2): Our **unique edge** — no other dashboard can show HLP vault flows + HL top traders

## D2: V1 Ship Scope — Tier 1 + 2 (all HL API-derivable signals)

Confirmed shipping in V1 alpha:

| Tier | Signal | Difficulty | HL data source |
|---|---|---|---|
| 1 | Funding APR + history | Easy (0.5d) | `metaAndAssetCtxs` + `fundingHistory` |
| 1 | OI + 24h/1h change | Easy (1d, needs DB history) | `metaAndAssetCtxs` |
| 1 | CVD / Buy% / Large fills | Medium (2-3d) | WS `trades` → worker aggregation |
| 1 | Liquidations 1h | Medium (2-3d) | WS `trades` + liq flag |
| 2 | Order Book (Spread/Depth/Imbalance) | Medium (2d) | WS `l2Book` |
| 2 | Basis (mark-oracle premium) | Easy (0.5d) | `metaAndAssetCtxs` |
| 2 | Cross-exchange funding | Easy (0.5d) | `predictedFundings` (HL provides Bin/Bybit data) |

Total V1 implementation: **8-10 days** (M1 + early M2).

Tier 3 (HLP vault, cascade detection, top trader tracking) → V2 after alpha validation.
Tier 4 (external data: on-chain, whales, multi-exchange heatmap) → V2-V3.

## D3: Cross-exchange Funding — Confirmed for V1

**Implementation confirmed feasible**: HL's `predictedFundings` endpoint provides Binance, Bybit, and HL funding rates together in one response.

```json
[
  ["AVAX", [
    ["BinPerp", { "fundingRate": "0.0001", "nextFundingTime": ... }],
    ["HlPerp",  { "fundingRate": "0.0000125", "nextFundingTime": ... }],
    ["BybitPerp", { "fundingRate": "0.0001", "nextFundingTime": ... }]
  ]]
]
```

Properties:
- ✅ No external API keys needed (HL provides all)
- ✅ Free, low rate-limit risk
- ✅ Hourly update frequency (matches funding rate's natural cadence)
- ✅ Implementation: 0.5 days

5 new trigger conditions enabled:
1. `fundingGapAbove` — HL funding − CEX avg funding > X bps
2. `crossExchangeFlip` — HL funding sign flips opposite from CEX
3. `cexFundingSpike` — CEX funding 1h change > X bps
4. `hlFundingHigherThanCex` — HL > CEX by X% APR
5. `allExchangesCrowded` — All venues > X% APR (market-wide over-positioning)

Why 1h cadence is sufficient:
- Funding rate is intrinsically a slow signal (hourly/8-hourly payments)
- Cross-exchange arbitrage gaps persist for days/weeks, not minutes
- Sentiment shifts meaningful at hour-level, noise-only at second-level

## D4: Token Listing Roadmap

| Phase | Available tokens | Approach |
|---|---|---|
| V1 alpha (W11-W12) | 5-10 HL tokens (BTC/ETH/SOL/HYPE/DOGE + few more) | Selective from HL's existing listings |
| V2 (post-PMF, 6-12mo) | All HL major tokens (50-100) | Full HL coverage |
| V3 (Series A+, 12-18mo) | + Project Q-listed tokens via HIP-3 | Deploy own perp DEX on HL |
| V4+ (Series B+, 18-24mo) | Multi-venue listings | Cross-venue rule engine |

### HIP-3 (Builder-Deployed Perpetuals) — Our V3 path

Hyperliquid's HIP-3 (launched October 2025) enables permissionless perp market deployment:
- Stake 500,000 HYPE (~$25M at current prices)
- Deploy unlimited perp markets on HL infrastructure
- First 3 markets free; additional markets via Dutch auction
- Fees split 50/50 deployer/protocol
- We control oracle, leverage limits, fee structure
- Inherits HL's matching engine and margining (CEX-grade execution)

**V3 entry strategies**:
1. **Direct staking**: Wait until Project Q has $25M+ buffer (likely Series B)
2. **Crowdfunding via EaaS** (Kinetiq Launch model):
   - Kinetiq aggregates kHYPE from holders to meet 500k stake
   - Revenue share with kHYPE backers
   - Project Q focuses on market design + trader acquisition
   - Lower capital barrier → potentially viable post-Series A

**What HIP-3 unlocks for us**:
- Long-tail tokens (pre-TGE projects, niche tokens) not available on CEX
- Custom market parameters optimized for trigger trading
- Builder fee revenue 50/50 (vs current builder code 4 bps)
- Strategic moat: "any token, with trigger-based execution"

**V1 alpha implication**: We don't need HIP-3 to ship. V1 uses HL's existing tokens. HIP-3 is a V3+ optionality, but mentioning it in the memo because it shapes our long-term token strategy.

## D5: Visualization patterns (preliminary — pending layout design)

For each of the 5 active V1 categories, the mockup needs:

### Compact summary (always visible, ~40-60px tall)
- Category name (Funding / OI / Order Flow / Liquidations / Order Book)
- Status label (low / normal / high / extreme / tight / v2)
- Key 1-liner metric (APR % / OI value / Buy% / Liq $ / Spread bps)
- Trend arrow (↑ / ↓ / flat)

### Expanded detail (when card opened)
- Multiple data fields (5-10 detail rows)
- Visualizations as appropriate:
  - Sparklines (Funding history, OI trend)
  - Bar splits (Buy% vs Sell%, Long liq vs Short liq)
  - Tables (recent large fills, depth levels)
  - Number grids (cross-exchange funding comparison)
- "+ Use as Trigger" button at bottom (with relevant default threshold)

### Critical UX: Layout must accommodate
- All 7 category headers visible at once (~280-350px total when collapsed)
- Multiple categories expandable simultaneously (scroll if needed)
- Mobile: same structure but stacked vertically in Signal sub-tab

## D6: Trigger Condition Catalogue — V1 alpha (17 conditions total)

```
Price (already in v9):
  priceAbove, priceBelow

Funding (3):
  fundingAprAbove, fundingAprBelow, fundingFlip

OI (2):
  oiChange24hAbove, oiChange1hAbove

Order Flow (3):
  buyFlowAbove, largeFillDetected, netFlow5minAbove

Liquidations (3):
  liquidations1hAbove, longLiquidationsAbove, shortLiquidationsAbove

Order Book (2):
  spreadAbove, imbalanceAbove

Cross-exchange (2):
  fundingGapAbove, allExchangesCrowded
```

Total: **2 price + 15 signal-based = 17 conditions**. Covers ~95% of meaningful perp trading rules.

V2+ additions: HLP-based triggers, divergence detection (price vs CVD), liquidation cascade detection, on-chain triggers.

## D7: Workflow (signal → trigger) — v9 pattern confirmed

Preserved workflow:
1. User expands signal category
2. Reviews detail
3. Clicks "+ Use as Trigger" inside expanded card
4. Order panel auto-fills trigger condition + suggested threshold (current value × 1.3)
5. User adjusts threshold/side/size
6. Saves as Rule

Plus existing v9 features:
- Price triggers via quick buttons in Trigger tab
- Chart price line visualization for saved price triggers
- Click trigger line → view rule + cancel
- Non-price trigger badges above chart

V2+ enhancements (deferred):
- Pre-built strategy templates (e.g., "funding extreme + OI rising → short")
- Divergence detector (auto-detect price vs CVD disagreement)
- Visual trigger editor (drag price lines on chart)

## D8: Chart technical indicators — TradingView Advanced Charts (NOT in Signals column)

**Decision**: Technical indicators (RSI, MACD, Bollinger Bands, EMA, VWAP, ATR, etc.) are NOT in the Signals column. They live in the chart area, accessed via "ƒ Indicators" button.

**Reasoning**:
- Technical indicators are time-series data — best visualized as chart overlays/subplots
- Pro perp traders use them less than microstructure (Phase 1 research confirmed)
- Already universal in TradingView ecosystem — no reason to reinvent
- Signals column reserved for our unique differentiation (perp microstructure)

**Implementation plan**:
- **Current (W2 mockup)**: `lightweight-charts v5.2.0` (free, open-source, TradingView family)
- **M1 first task**: Apply for **TradingView Advanced Charts** library (https://www.tradingview.com/charting-library/)
  - Free, requires application + approval (~few days to 1 week)
  - 100+ built-in technical indicators (RSI, MACD, BB, EMA, VWAP, ATR, Ichimoku, Fibonacci, etc.)
  - Same library used by Hyperliquid → matches our 95% Hyperliquid consistency principle
- **While waiting for approval**: Continue with `lightweight-charts`
- **After approval**: Swap CandleChart component, all 100+ indicators automatically available

**No additional dev work needed** beyond library swap — TradingView handles all indicator rendering, settings, calculations.

## D9: Hyperliquid integration level — Builder Code (NOT HIP-3)

Critical clarification on what we use from Hyperliquid:

### Three integration levels exist:

| Level | What | HYPE Staking? | Our use |
|---|---|---|---|
| **L1: Public API** | Read prices, place orders | ❌ Not required | ✅ V1 alpha |
| **L2: Builder Code** | Earn fees on routed trades | ❌ Not required | ✅ V1 alpha (revenue source) |
| **L3: HIP-3 (Builder-Deployed Perps)** | Deploy own perp DEX | ✅ 500k HYPE (~$25M) | ⏳ V3+ only |

### V1 alpha business model — clarified

```
Hyperliquid Protocol (L1 + Order Book + HLP)
         ↓ Public API (free, no staking)
Project Q Frontend
   - Signal analysis (HL data → our worker aggregation)
   - Trigger-based trading
   - TradingView Advanced Charts (separate library)
   - Trigger Set sharing
         ↓ Order with builder code (our address + fee value)
HL collects HL fee + our Builder Fee → routes our portion to us
```

### Builder Fee — Our fee is configurable, not a fixed cut

**Critical correction**: Builder Fee is NOT a fixed rate that HL pays us. We configure it ourselves per order, within limits.

**Fee structure**:
```
Total user fee = HL's standard fee (Maker/Taker, ~2-3 bps)
                 + Builder Fee (we set, 0-10 bps for perp)
                 = User pays this total
HL automatically sends Builder Fee portion to our address.
```

**How fee is configured**:
1. User one-time `approveBuilderFee` action — sets MAX rate they allow us
   - Perp: up to 10 bps (0.10%)
   - Spot: up to 100 bps (1.00%)
2. Each order includes `builder: { b: <our address>, f: <fee value> }`
   - `f` is in **tenths of basis points**: `f: 40` = 4 bps, `f: 100` = 10 bps (perp max)
   - We can set different `f` per order (different markets, tiers, promotions, etc.)

### Possible fee strategies (we choose)

| Strategy | Example | Pros | Cons |
|---|---|---|---|
| **Single flat rate** | 4 bps for all trades | Simple | No differentiation |
| **Tier-based** | Free 5bps / Pro 2bps / Obsidian 1.16bps | Subscription incentive | Tier management |
| **Market-specific** | Major 2bps / Alt 5bps / Trigger +1bp | Monetize differentiation | Complex |
| **Profit-based** | 0bps on loss / 10bps on realized profit | User-friendly | Variable revenue |
| **Dynamic** | Alpha 0bps → 5bps later | Low barrier launch | Migration complexity |
| **Maker/Taker split** | Maker 1bp / Taker 5bps | Liquidity incentive | User education |

### Market benchmark (existing builders)

| Builder | Fee | Lifetime revenue |
|---|---|---|
| Phantom Wallet | ~5 bps | $100k+/day |
| PVP.trade | 5-10 bps | $7.2M |
| Hyperdash | 1.16-10 bps (tier) | growing |
| HeyAnon HUD | profit-based 10 bps | growing |
| **Industry average** | **5-10 bps** | — |

Total ecosystem: $40M+ paid to builders since launch. ~40% of HL daily active users now trade through third-party frontends.

### Project Q V1 alpha fee policy (CONFIRMED)

**Phase 1 — Alpha (W11-W12) and V1 launch**: **5 bps** (Builder Fee `f: 50`)
- Rationale: market-average rate, validates real willingness to pay
- Sustains modest revenue during PMF validation
- Industry benchmark: Phantom/PVP.trade range from 5-10 bps

**Phase 2 — Post-PMF (V2 product maturity)**: **Up to 10 bps** (Builder Fee `f: 100`, perp max)
- After PMF confirmed and product features deepen (HL Activity signals, divergence detection, advanced triggers)
- Justifies premium positioning relative to other builders
- Or introduce tier system: Free 5bps / Pro 8bps / Premium 10bps

**Phase 3 — V3+ (HIP-3 own perp DEX)**: deployer fee 50/50 split (separate model, applies to our own listed tokens)

**Implementation note**: The Day 8 decision ("Builder Fee admin-configurable") is preserved. Initial default value updated:
- `admin_config.builder_fee_bps = 5` (was 4 in Day 8 spec)
- Changeable without code deploy
- Can be raised to 10 once V2 launches

### Builder Code requirements

- ❌ NO HYPE staking required
- ✅ Builder address (any wallet address)
- ✅ 100 USDC in builder account (initial setup, one-time)
- ✅ User one-time approval of our builder fee (`approveBuilderFee` transaction)
- ✅ Fees accumulate in builder account, claimable via referral reward system
- ✅ All builder code data publicly available (LZ4 format on HL stats)

→ Project Q's path to revenue: same model as Phantom/PVP.trade/Hyperdash. Our differentiation is the signal + trigger UX, not the fee mechanism.

## D10: Trigger Condition Display — Current Value + Distance Visualization

**Decision**: Each trigger condition card shows current value, threshold, and visual distance to fire.

**Pattern**:
```
BTC Funding APR > 25%
Now: 11.04%  →  56% to fire
████████░░░░░░░░░░░░░░  (44% progress bar)
```

**Rationale**:
- Pro perp traders need real-time feedback ("How close am I to firing?")
- Reduces cognitive load (no mental calculation)
- Distance % is universal across all condition types
- Progress bar gives at-a-glance awareness

**Implementation note**: Distance calculation depends on condition type:
- `>X` triggers: progress = current/threshold (clamped 0-100%)
- `<X` triggers: inverse (closer to threshold = more progress)
- Binary triggers (e.g., flip): show "armed/unarmed" instead

## D11: 17-Condition Entry Points — Hybrid B+C

**Decision**: Two complementary entry paths to triggers.

### Path 1: In-context (Signal card expansion)
Each signal category expansion shows ALL relevant triggers for that category as inline buttons:
```
Funding card expanded:
  ...funding data...
  + Add trigger:
  [APR > 25] [APR < -5] [Flip] [Gap > 100]
```
Serves users browsing signals → seeing context → adding trigger immediately.

### Path 2: Trigger Library (separate modal)
Order panel has "Browse all triggers" button → opens modal with:
- Full 17-condition catalog grouped by category
- Search bar (filter by name)
- "Popular combinations" section
Serves users starting from trigger intent → discovering all options.

**Why hybrid (B+C)**:
- B alone misses: full catalog overview, search, recommendations
- C alone misses: in-context flow from signals
- Combined: progressive disclosure (B for casual, C for power users)

## D12: Trigger Visual Priority — Default Tab + PREVIEW Badge

**Decision**: Trigger is the default selected tab in Order panel, visually distinguished with "PREVIEW" badge.

**Pattern**:
```
Order Panel:
┌──────────────────────────────────┐
│ Market | Limit | ★ TRIGGER PREVIEW │
│                  └─ default selected │
├──────────────────────────────────┤
│ ⚡ Trigger trading is our core    │
│   feature. Currently in preview  │
│   — full execution in M2 (W5-W6).│
│   Build rules now; they fire     │
│   when M2 launches.              │
└──────────────────────────────────┘
```

**Rationale**:
- Trigger is core differentiation (must signal on first page load)
- Market/Limit work in alpha (real trades possible) — preserved as accessible options
- "PREVIEW" badge sets honest expectations
- Users build rules now → ready when M2 launches

## D13: Order Panel Information Density — HL Standard + Trigger Optimization

**Decision**: Market/Limit panels match Hyperliquid/Based standards. Trigger panel adds trigger-specific information.

### Market & Limit panels (HL baseline)

Required fields (all must be present):
- Available to Trade
- Current Position
- Size input + percentage slider
- Leverage selector (e.g., 10x)
- Margin mode (Cross / Isolated)
- Reduce Only checkbox
- TP/SL section (Mark price triggered)
- Liquidation Price (calculated when size > 0)
- Order Value (calculated)
- Fees (HL fee + 5 bps builder, shown together)

Market-specific: Slippage (Estimated + Max)
Limit-specific: Limit Price input, Post Only (ALO), GTC / IOC toggle

Advanced (V1.5 / V2): TWAP, Trailing Stop, Chase Orders, Scale Orders, Position Alerts

### Trigger panel (optimized for differentiation)

**Three sections**:

1. **When** (trigger conditions):
   - Up to 3 conditions, AND-combined only (D14)
   - Each condition card: D10 pattern (current value + distance + progress bar)
   - "Browse all triggers" button → D11 modal
   - "Popular combinations" inline suggestions

2. **Then** (action on trigger):
   - Direction (Long / Short)
   - Size (% portfolio)
   - Order type to use when fires: Market or Limit
   - Auto TP/SL toggle (optional)

3. **Preview** (expected outcome):
   - "If triggered now: Entry $X, Liq $Y, Size $Z"
   - Estimated fees (HL + 5 bps builder)
   - Risk per trade % (Position size / Equity)

4. **Action**: "Save as Rule" button (amber, distinctive) + "PREVIEW" badge

## D14: Multi-condition UX — Manual AND + Recommended Patterns

**Decision**: Three-tier approach to multi-condition rules.

### V1 alpha: Manual + Recommendations

**Manual composition**:
- **AND-only** (OR removed — research showed low usage, adds complexity)
- Max 3 conditions per rule
- Per-condition: select from D11 catalog

**Recommended Combinations** (new section):
Inline in Trigger panel, 3-5 "Popular patterns" cards:
```
Popular combinations:
• "Funding extreme + OI rising" → mean reversion fade
• "Liquidation cascade + Buy flow > 60%" → bounce play
• "Cross-exchange gap > 100 bps" → arbitrage opportunity
```
Click on a pattern → auto-fills all conditions, ready to adjust.

### V2: Pre-built Strategy Templates (Coinrule model)
- Strategy templates page (extends Trigger Set marketplace)
- One-click activation, 350+ templates aspirational
- Categorized: Trend / Mean Reversion / Arbitrage / Funding plays
- Backtest results displayed per template

### V3+: AI Suggester (LuxAlgo Quant pattern)
- Natural language → rule generation
- AI recommends based on user's past rules
- Automated threshold tuning

**Rationale**:
- V1 keeps scope tight while adding curated value
- V2-V3 progression aligns with long-term differentiation
- OR removed: TradingView multi-condition launch (Oct 2025) used AND-priority pattern, validated

## D15: Tabbed Middle Column — Order Book / Trades / Signals

**Decision**: Replace the current Signals column with a tabbed middle column hosting THREE views.

### Rationale

Industry standard (Hyperliquid, Based, Bybit, Binance) places real-time Order Book + Trades panels alongside the chart and order entry. These are essential for active trade execution (where to place limit orders, gauging buy/sell pressure, spotting whale fills).

The current v12 Signals column conflates two different uses of "Order Book":
1. **Trader's execution tool** (full ladder for placing orders) — missing in v12
2. **Microstructure signal** (Spread/Imbalance/Depth metrics for triggers) — present in v12

These serve different purposes and should coexist. Adding Order Book + Trades panels does not displace Signals; all three share a middle column via tab switching.

### Layout (1440px desktop)

```
┌──────────────────────────────────────────────────────────────┐
│   Chart 56%      │   Middle 22%    │   Order 22%             │
│   ~800px         │   ~300px        │   ~320px                │
│                  │                 │                         │
│                  │  ┌─ Book | Trades | Signals ─┐ ← 3 tabs   │
│                  │  │                            │             │
│                  │  │  [Active tab content]      │             │
│                  │  │                            │             │
│                  │  └────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

### Tab 1: Order Book (full ladder)

Real-time bid/ask ladder, ~15-20 levels, refreshing via HL WS `l2Book`:
- Asks (red) above, Bids (green) below
- Columns: Price | Size | Cumulative Total
- Mid-price separator (with spread display)
- Footer: Spread / Total bids / Total asks

### Tab 2: Trades (recent fills)

Real-time trade stream via HL WS `trades`:
- Most recent 30-50 trades
- Columns: Price | Size | Time
- Buy (green) / Sell (red) color coding
- Auto-scroll, with manual scroll on hover

### Tab 3: Signals (current v12 content)

The current 7-category expandable signal column moves into this tab without major changes. Note: column width increases from 280px → 300px, allowing slightly richer per-card layouts (Cross-exchange comparison gets more space).

### Default tab

**Signals** is default selected (our differentiation). Users can switch to Order Book or Trades anytime. This balances:
- Trader's habit: expects Order Book where it usually is (alongside chart)
- Our identity: signals are why people come to Project Q

### Mobile pattern

Bottom Tab Bar remains 3 tabs (Markets / Trade / Account). The Markets page sub-tabs expand from 3 → 4:
```
[Chart]  [Market Data]  [Trigger]
```
"Market Data" tab contains internal sub-tabs: Book / Trades / Signal (same as desktop).

### Data source clarification

| Panel | Data source | Update frequency | Existing in v12? |
|---|---|---|---|
| **Order Book (full ladder)** | HL WS `l2Book` (20 levels) | Real-time | ❌ NEW in v13 |
| **Trades (recent fills)** | HL WS `trades` | Real-time | ❌ NEW in v13 |
| **Signals (Order Book metrics card)** | Same `l2Book` WS, our worker aggregates Spread/Imbalance/Depth | Real-time | ✅ v12 |

The Order Book ladder (Tab 1) and the Order Book signal card (inside Tab 3) draw from the same WS feed but serve different purposes — ladder is execution, card is for triggers.

### Why this matters

Without Order Book + Trades panels, Project Q feels like an "analytics dashboard with a buy button" — not a real trading interface. Active traders constantly reference order book depth and recent fill velocity. Even our trigger feature benefits: users see live conditions (Order Book ladder) → make better trigger threshold decisions.

This change brings parity with Hyperliquid/Based on the table-stakes side, while preserving our signals + trigger differentiation in the same middle column.

## D16: Long/Short Ratio — New Active Signal Card

**Decision**: Add Long/Short Ratio as a 6th active signal category (5 → 6 active + 1 V2 placeholder).

### Background

After v13 live review, trader feedback identified a gap: the 4 pillars of perp trading microstructure are **Funding + Open Interest + Long/Short Ratio + Liquidations**. v13 had three of four — L/S Ratio was missing.

### Why L/S Ratio matters (different from Liquidations)

L/S Ratio and Liquidations measure fundamentally different things:

| Metric | What it measures | Time | Use |
|---|---|---|---|
| **Liquidations** | Positions already wiped out | Lagging (past 1h) | "What happened" |
| **L/S Ratio** | Positions currently held | Live (now) | "What might happen next" |

L/S Ratio reveals positioning vulnerability before liquidations occur:
- Crowded long + funding extreme → likely downside liquidation fuel
- Crowded short + bullish catalyst → likely short squeeze fuel
- L/S Ratio extreme → entry timing for contrarian play

Per trader-grade research:
> "Used well, L/S Ratio helps answer three trader questions: Is the move supported or crowded? Where is the liquidation fuel? Should you trade with momentum or fade it?"

### Card placement

After v13's `Funding / OI / Order Flow / Liquidations / Order Book / On-chain / HL Activity`, the new order is:

**`Funding / OI / Order Flow / Long/Short Ratio / Liquidations / Order Book / On-chain / HL Activity`**

L/S Ratio sits between Order Flow and Liquidations because:
- Order Flow = buy/sell pressure (live trade flow)
- L/S Ratio = positioning result of that flow (live positions)
- Liquidations = consequence of positioning meeting price action (past)

Natural left-to-right reading: live flow → current positioning → past consequences.

### Card content (V1)

```
Long/Short Ratio    [HIGH] 1.92
├ Ratio: 1.92 (long-heavy)
├ Long accounts: 65.7%
├ Short accounts: 34.3%
├ 24h trend: ████████ ↑ rising
├ Cross-exchange (V2 expansion):
│   HL: 1.92, Binance: 1.45, Bybit: 1.62
└ + Add trigger:
    [L/S > 2.5]  [L/S < 0.8]
    [Flip bullish] [Flip bearish]
```

### Data source — HL aggregation strategy

Hyperliquid public API does not expose L/S Ratio directly. Our worker computes it from `clearinghouseState` snapshots:

**V1 alpha approach** (HL-only, no external API):
- Sample top 500-1000 active traders per market every minute
- Compute account-weighted L/S ratio (each account counted once)
- Store rolling 24h history in Supabase

**Trade-off acknowledged**:
- Not as comprehensive as Coinglass (samples top traders, not all)
- But maintains HL-only principle (no $29-99/month subscription)
- More accurate for HL-specific behavior than CEX-aggregated ratios

**Future enhancements**:
- V2: Position-size-weighted L/S ratio (not just account count)
- V2: Top trader L/S vs Retail L/S divergence (HL Activity card)
- V3: HLP vault L/S exposure

### Trigger conditions (5 new)

| Condition | Trigger when | Use case |
|---|---|---|
| `lsRatioAbove` | L/S > X (e.g. 2.5) | Crowded long fade |
| `lsRatioBelow` | L/S < X (e.g. 0.5) | Crowded short bounce |
| `lsRatioFlipBullish` | L/S crosses 1.0 upward | Trend turning bullish |
| `lsRatioFlipBearish` | L/S crosses 1.0 downward | Trend turning bearish |
| `lsRatioExtremeWithFunding` | L/S > X AND |funding| > Y | Conviction fade (V1.5) |

### Popular Combinations expanded (3 → 5)

New L/S-based combos for the Trigger Library and inline suggestions:

| # | Name | Conditions | Side | Rationale |
|---|---|---|---|---|
| 1 | Funding extreme + OI rising | fundingAprAbove + oiChange24hAbove | short | (existing) |
| 2 | Liquidation cascade + Buy flow | longLiquidationsAbove + buyFlowAbove | long | (existing) |
| 3 | Cross-exchange funding gap | fundingGapAbove | short | (existing) |
| 4 | **Crowded long + funding extreme** | lsRatioAbove + fundingAprAbove | short | (NEW) Classic fade setup |
| 5 | **L/S flip + OI rising** | lsRatioFlipBullish + oiChange1hAbove | long | (NEW) Trend confirmation |

### Updated framework summary

- **Active V1 cards (6)**: Funding · OI · Order Flow · **L/S Ratio (NEW)** · Liquidations · Order Book
- **V2 placeholder cards (2)**: On-chain · HL Activity (Top trader / HLP)
- **Trigger conditions (17 → 22)**: Added 5 L/S Ratio triggers
- **Popular Combinations (3 → 5)**: Added 2 L/S-based combos

This brings us to the full 4-pillars standard while preserving HL-only data origin and reserving HL Activity (Top trader / HLP) as our V2 unique differentiation.

## D17: Active Rules Management & Trigger History UX

**Decision**: Add dedicated Bottom tab management for trigger rules — our core differentiation surfaced as first-class workflow.

### Background

After v14 live review, founder identified three structural gaps:
1. **Active Rules management** — rule access only via chart click was insufficient for managing 5+ rules
2. **Position details** — placeholder content needed enhancement (deferred to live data phase)
3. **Alert/Trigger History** — existing tab was placeholder mock without proper outcome tracking

v15 addresses #1 and #3. #2 is deferred to live data phase (founder's call: position details emerge naturally when real trading begins).

### Two new dedicated Bottom tabs

| Tab | Role | Project.Q-only data | Visual treatment |
|---|---|---|---|
| **Active Rules** | Manage currently-active trigger rules | ✅ Yes | ✦ amber emphasis |
| **Trigger History** | Historical record of rule fires + outcomes | ✅ Yes | ✦ amber emphasis |

These differ from standard HL exchange tabs (Balances/Positions/Orders) by being **outcome-focused on Project.Q's unique value** (rule-based trading + history).

### Active Rules tab — column structure

```
Status | Rule | Conditions (AND) | Action | Size | Created | Last Check | Manage
●ACTIVE BTC...  Funding>25%      ↓Short  5%    2h ago    just now    [⏸][✎][⎘][×]
⏸PAUSED SOL...  Buy Flow>65%     ↑Long   3%    1d ago    —           [▶][✎][⎘][×]
⚡ARMED  HYPE... L/S>2.5+Fund>20% ↓Short  4%    5h ago    just now    [⏸][✎][⎘][×]
```

**Status types**:
- `active` — Worker is monitoring, conditions not yet met
- `paused` — User-paused; not being monitored
- `armed` — ALL conditions currently met; would fire immediately when execution layer is live (M2+)

**Actions**:
- ⏸/▶ — Pause / Resume (toggle)
- ✎ — Edit (open rule editor with all conditions)
- ⎘ — Duplicate (clone rule)
- × — Delete (confirm before action)

**Highlighting**: Rows for the currently-selected symbol get amber background tint for quick context.

### Trigger History tab — column structure

```
Time | Rule | Symbol | Conditions | Fire Reason | Action Taken | Outcome | PnL
2h ago DOGE crowded long fade DOGE Funding>30% AND L/S>2.5 Funding hit 38.7% Short DOGE 3% @ $0.1102 [OPEN] +$24.50 +4.2%
18h ago SOL momentum entry SOL Buy Flow>60% AND OI 1h>1% Buy flow hit 64% Long SOL 5% @ $94.20 [CLOSED] +$48.10 +1.03%
1d ago ETH funding flip ETH Funding flips bearish Funding turned negative Short ETH 4% @ $2,348 [CLOSED] -$12.40 -0.53%
2d ago BTC funding extreme BTC Funding APR > 25% Funding APR hit 26.4% Position already open — skipped [SKIPPED] —
```

**Outcome badges**:
- `OPEN` — Trade executed, position still active (amber)
- `CLOSED` — Trade executed and closed (signal green)
- `SKIPPED` — Conditions met but trade not executed (e.g., insufficient balance, already in position, Reduce Only conflict)
- `FAILED` — Execution attempt failed (red)

**PnL display**:
- Realized PnL in USD + %
- Color-coded (green/red)
- Empty for SKIPPED/FAILED outcomes

### Chart rule indicator (new)

Top of chart shows persistent rule status across all symbols:

```
┌─────────────────────────────────────────────────────────────────┐
│ ✦ My Rules · 3 active · ⚡ 1 ARMED · 4 total       Manage rules → │
└─────────────────────────────────────────────────────────────────┘
[5m] [1h] [D] | ƒ Indicators        BTC triggers: ⚡ 2-cond ⚡ 3-cond
[Chart...]
```

Clicking "Manage rules →" auto-switches Bottom tab to Active Rules.
Armed count is prominently displayed (amber bold) to alert users when a rule is about to fire.

### Tab badge counts

```
Active Rules (4)    Trigger History (7)
```

Numbers help users see at-a-glance:
- How many rules are active
- How many fires happened recently

Color: amber background (✦ Project.Q signature)

### Pre-seeded mock data (4 active rules + 7 history entries)

To demonstrate functionality in alpha:

**Active Rules** (preserved across page reloads — would be Supabase in V1):
1. BTC funding extreme — short (active)
2. SOL momentum entry (paused)
3. HYPE crowded long (armed — conditions actually met in mock data)
4. DOGE liquidation bounce (active)

**Trigger History** (7 entries covering all outcome types):
- 2 fires with open positions (recent)
- 4 fires closed (mix of profitable / losing)
- 1 fire skipped (showing edge case)

### Rationale

**Why these are first-class tabs, not afterthoughts**:
- Project.Q's core value = trigger-based trading
- Without robust rule management, users can't trust the system
- Trigger History with PnL = transparency = retention
- Chart indicator = passive awareness during active trading

**Comparison with alternative designs**:
- Sidebar drawer — rejected: complexity + duplicates Bottom tab data
- Separate `/rules` page — deferred to V2 for power users
- Bottom tab only — chosen: standard pattern, single source of truth, scales

### V2 enhancements (deferred)

- Sidebar drawer for trade-time monitoring (currently chart indicator suffices)
- Separate `/rules` page with advanced features:
  - Bulk operations (pause all, delete all)
  - Search/filter/sort
  - Backtest preview
  - Rule analytics (fire rate, win rate)
- Position details enhancement (when live data flows)
- Signal Alerts tab (trigger-less notifications)

---

# Phase 1 Reference — Research Background

The following sections preserve the research that informed the above decisions. Skip if you only need the spec.



## What perp traders actually use — the 4 pillars

Universal across CryptoCred (most cited guide), Coinglass (most used dashboard), Velo (institutional), and trader blogs:

> **"No single signal works. Funding + OI + CVD + Liquidations together form the lens through which perp trading reality is read."**

### Pillar 1 — Funding Rates

**What it is**: Periodic payment between longs and shorts. Positive = longs pay (crowded long). Negative = shorts pay (crowded short).

**Why it matters**:
- Real-time sentiment gauge
- Positioning crowdedness indicator (not pure forecast)
- Mechanically tethers perp to spot
- High positive funding → market vulnerable to long squeeze when sentiment shifts
- Extreme funding (top/bottom 5% historically) is often a contrarian setup

**HL specifics**:
- Funding paid hourly (1/8 of 8h rate)
- Capped at 4%/hour (much higher than CEX)
- Formula: `(premium index + clamp(interest rate - premium))`
- Premium sampled every 5 seconds, averaged over the hour

**Most useful framings**:
- Current APR (annualized)
- Funding regime: Neutral / Extreme-positive (overheated longs) / Extreme-negative (panic shorts)
- Divergence: price falling but funding still positive (longs not capitulating yet = more downside likely)
- Cross-exchange: HL funding vs Binance funding (arbitrage signal)

**Common mistakes**:
- Reading funding as a pure reversal signal (it's positioning, not forecast)
- Ignoring funding when at baseline (then no signal)
- Not contextualizing with OI changes

### Pillar 2 — Open Interest (OI)

**What it is**: Total notional value of all open contracts. Increases when new positions open, decreases when positions close (voluntary or liquidated).

**Why it matters**:
- Scale of leveraged positioning
- Trend strength indicator (with price context)
- OI is always 50% longs / 50% shorts technically; changes reflect "net aggression"

**Most useful framings** (CryptoCred's combinations):
| Price | OI | Interpretation |
|---|---|---|
| ↑ | ↑ | Leveraged longs piling in (trend continuation likely) |
| ↑ | ↓ | Short covering rally (often weaker) |
| ↓ | ↑ | Leveraged shorts piling in (trend continuation likely) |
| ↓ | ↓ | Long capitulation (forced unwind) |
| Flat | ↑ | New positions balanced, vol may expand soon |
| Flat | ↓ | Position unwinding, leverage cooling |

**Trigger value**:
- OI 24h change > X% (extreme positioning shift)
- OI at ATH (over-leveraged warning)
- OI vs spot volume ratio (derivative-led vs spot-led move)

### Pillar 3 — Order Flow / CVD (Cumulative Volume Delta)

**What it is**: Sum of (market buys - market sells) over time. Shows aggressive participation.

**Why it matters**:
- Reveals who's taking liquidity (aggressors)
- Most useful for **divergence**:
  - Price up + CVD down = absorption (rally is fake, sellers winning)
  - Price down + CVD up = absorption (selling is being absorbed, bottom likely)
- Spot CVD vs Perp CVD divergence is a powerful confluence

**Most useful framings**:
- Net flow 5min / 1h / 24h (in USD)
- Buy% vs Sell% (in volume terms)
- Recent large fills ($X+ threshold)
- Divergence at key levels

**Trigger value**:
- Buy flow > X% (e.g., 65%+ buying pressure)
- Large fill > $X (whale entry alert)
- CVD divergence (advanced, V2+)

### Pillar 4 — Liquidations

**What it is**: Forced position closures when margin runs out. Creates cascading effects.

**Why it matters**:
- Liquidation cascades amplify price moves
- Liquidation clusters are "magnets" — price gravitates there
- Volume of liquidations shows leverage purge intensity

**Coinglass signature feature**: **Liquidation Heatmap** — visualizes where leveraged positions are concentrated. Where price is likely to be "pulled" toward.

**Most useful framings**:
- Total liquidations in last 1h / 24h (USD value)
- Long vs Short liquidations split (which side is getting wrecked)
- Liquidation heatmap (price levels with stacked positions)
- Liquidation cascade detection (rapid increase in 1-min liquidations)

**Trigger value**:
- Liquidations 1h > $X (cascade entry/exit signal)
- Specific liquidation price level reached
- Long/short liquidation imbalance > X (one-sided wreckage)

## Supporting pillars

Beyond the 4 main, these are commonly cited:

### Order Book (L2)
- Spread (tightness)
- Depth at ±0.1% / ±0.5%
- Bid-ask imbalance (% net interest at top of book)
- Wall detection (large resting order at specific price)

**Trigger value**:
- Spread > X bps (volatility incoming)
- Imbalance > X% (short-term direction bias)

### Basis (Perp - Spot premium)
- Annualized 3-month futures basis (institutional metric)
- Perp mark vs spot (instant basis)
- High positive basis = bullish, willingness to pay carry
- Negative basis = bearish, paying to be hedged

**Trigger value** (V2): Basis > X% (carry trade entry)

### Cross-exchange Funding Divergence
- HL funding vs Binance vs Bybit on same coin
- Divergence > 0.1% = arbitrage signal
- Useful for spotting venue-specific pressure

### On-chain / Wallet flow (V2+)
- Exchange inflow / outflow (selling pressure incoming?)
- Stablecoin minting (new buying power)
- Whale wallet activity (large addresses moving)
- Requires: Glassnode / Nansen / Arkham API integration

### HL-specific (our unique edge)
- **HLP vault flows** — when HLP changes positioning, it signals market-making side adjustments
- **Hyperliquid leaderboard activity** — top trader positioning shifts
- **HL vault leader trades** — top vault leaders entering positions
- **HL-only assets**: HYPE-specific signals not visible on CEX dashboards

## What we can ship in V1 alpha (Hyperliquid API check)

Cross-referenced against Hyperliquid's documented API endpoints:

### ✅ V1 alpha — available directly from HL API

| Signal | HL endpoint | Update frequency |
|---|---|---|
| Funding rate (current) | `metaAndAssetCtxs` | Hourly |
| Funding rate (predicted) | `predictedFundings` | Hourly |
| Funding rate history | `fundingHistory` | Hourly |
| Cross-exchange funding | `predictedFundings` (includes BinPerp, BybitPerp) | Hourly |
| Open Interest | `metaAndAssetCtxs.openInterest` | Real-time |
| Trades (with side) | WS `trades` subscription | Real-time |
| Order book (L2) | WS `l2Book` subscription | Real-time |
| Mark/Oracle/Premium | `metaAndAssetCtxs` | Real-time |
| OHLCV candles | `candleSnapshot` + WS `candle` | Real-time |
| Liquidations | WS `userEvents` (own) + computed from trades | Real-time |
| HLP vault data | `vaultDetails` for HLP address | Each block |
| HL leaderboard | `/leaderboard` endpoint | Periodic |
| Vault leader activity | `vaultDetails` for top vaults | Each block |

We can derive (with worker calculation):
- ✅ CVD (from trade events with side data)
- ✅ Bid-ask spread + imbalance (from L2 snapshots)
- ✅ Basis (mark - oracle)
- ✅ Large fill detection (filter trades by size threshold)
- ✅ Liquidation cascade detection (rate-of-change on liquidations)

### ❌ V1 alpha — requires external integration

| Signal | Required source | V2 plan |
|---|---|---|
| Exchange inflow/outflow | Glassnode / Coinmetrics | V2 |
| Stablecoin minting | Glassnode / Etherscan | V2 |
| Whale wallet alerts | Arkham / Nansen | V2 |
| Liquidation heatmap (multi-exchange) | Coinglass API | V2 |
| Long/short ratio (cross-exchange) | Coinglass API | V2 |
| On-chain orderflow | Nansen / Custom indexer | V2-V3 |

## Decision points for Phase 2 (with founder)

### D1. Category structure — 5 categories or different?

Current v9 mockup uses: **Funding · Order Flow · Order Book · On-chain · Wallet Flow**

Alternative structures to consider:
- **Option A (current 5)**: Funding / Order Flow / Order Book / On-chain (V2) / Wallet Flow (V2)
- **Option B (4 pillars)**: Funding / OI / CVD / Liquidations (most aligned with trader mental model)
- **Option C (6-7 expanded)**: Funding / OI / CVD / Liquidations / Order Book / Basis / On-chain (V2)
- **Option D (themed)**: Sentiment (Funding+OI) / Order Flow (CVD+Liq) / Microstructure (Book+Spread) / On-chain (V2)

**Founder input needed**: Which mental model matches how P1 trader thinks?

### D2. V1 alpha — how many of HL-derivable signals to ship?

Ranked by impact + ease:

**Tier 1 (must-have, easy, high signal)**:
1. ✅ Funding APR + regime + sparkline
2. ✅ OI + 24h change
3. ✅ Liquidations 1h (long/short split)
4. ✅ CVD / Buy% / Net flow + recent large fills

**Tier 2 (should-have, moderate effort)**:
5. ✅ Spread + Order Book imbalance + Depth
6. ✅ Basis (mark - oracle premium)
7. ✅ Cross-exchange funding divergence (HL vs Bin vs Bybit)

**Tier 3 (nice-to-have, more effort)**:
8. HLP vault flow (our unique edge)
9. Liquidation cascade detection (rate-of-change)
10. Top trader positioning (HL leaderboard delta)

**Tier 4 (V2)**:
11-15. External data (on-chain, whale flows, heatmap)

**Founder input needed**: Which Tier 1-3 ship in V1 alpha? Tier 1 is ~certain. Tier 2-3 are optional based on engineering budget.

### D3. Trigger condition catalogue — V1 alpha

Each signal becomes potentially N trigger conditions. Proposed catalogue:

**Funding**:
- `fundingAprAbove` — APR > X% (long fade signal)
- `fundingAprBelow` — APR < X% (short fade signal)
- `fundingCrossExchangeDelta` — HL funding - Bin funding > X% (V2)

**OI**:
- `oiAbove` — total OI > X (over-leveraged warning)
- `oiChange24hAbove` — OI 24h change > X% (positioning shift)
- `oiChange1hAbove` — OI 1h change > X% (acute shift)

**CVD / Order Flow**:
- `buyFlowAbove` — Buy% > X (buy pressure)
- `netFlow5minAbove` — net flow > $X (aggressive entry)
- `largeFillDetected` — single fill > $X (whale alert)

**Liquidations**:
- `liquidations1hAbove` — total $ > X (cascade signal)
- `longLiquidationsAbove` — long liq $ > X (squeeze incoming)
- `shortLiquidationsAbove` — short liq $ > X
- `liquidationCascade` — rate-of-change > X (V2)

**Order Book**:
- `spreadAbove` — spread bps > X (volatility incoming)
- `imbalanceAbove` — |imbalance| > X% (direction bias)
- `depthBelow` — depth ±0.5% < X (liquidity drying up)

**Price** (basic, must-have):
- `priceAbove` — price > X (already in v9)
- `priceBelow` — price < X (already in v9)
- `priceChangePercent1h` — abs(1h change) > X% (volatility trigger)

**Basis**:
- `basisAbove` — mark - oracle > X% (premium widening)
- `basisBelow` — discount > X%

**Founder input needed**: Which of these ship in V1? Which max-3 conditions are most likely combined?

### D4. Visualization patterns — per category

Each signal needs:
1. **Compact summary** (always visible, 1-line)
2. **Expanded detail** (when card opened)

Current v9 patterns:
- Number + label + intensity bar — good for Funding, OI, single-value
- Bar split + bar chart — good for Order Flow (Buy% vs Sell%)
- Table — good for large fills, depth levels
- Sparkline — good for trends
- Heatmap — would be powerful for liquidations (V2)

**Founder input needed**: For each signal, is the visualization helpful or just decoration? P1 trader perspective.

### D5. Workflow — signal → trigger UX

Current flow (v9):
1. User expands a signal category
2. Reviews detail
3. Clicks "+ Use as Trigger"
4. Order panel auto-fills with that condition + suggested threshold (current × 1.3)
5. User adjusts threshold, side, size
6. Saves as rule

**Alternatives**:
- Pre-built strategy templates (e.g., "Funding extreme + OI rising → short")
- Multi-signal divergence detector (CVD vs price)
- Visual trigger editor (drag price line on chart for priceAbove/priceBelow)

**Founder input needed**: Is current flow good, or does it need refinement?

## Recommended V1 alpha shipping plan

Based on research, the proposed V1 alpha minimum:

### Category structure: Option B + extras (4 pillars + Order Book)

```
1. Funding         — APR, history, direction, cross-exchange (Tier 1+2)
2. Open Interest   — Total, 24h change, 1h change, trend (Tier 1)
3. Order Flow      — CVD, Buy%, net flow, large fills (Tier 1)
4. Liquidations    — Total 1h, long/short split, recent (Tier 1)
5. Order Book      — Spread, depth, imbalance (Tier 2)
6. On-chain        — V2 placeholder (Tier 4)
7. Wallet Flow     — V2 placeholder (Tier 4)
```

Renaming "Wallet Flow" → "HL Activity" (V2) where we include HLP, top traders, vault leader signals — our unique edge.

### Trigger conditions in V1: 12 conditions

```
Funding:        fundingAprAbove, fundingAprBelow
OI:             oiChange24hAbove, oiChange1hAbove
Order Flow:     buyFlowAbove, largeFillDetected
Liquidations:   liquidations1hAbove, longLiquidationsAbove, shortLiquidationsAbove
Order Book:     spreadAbove, imbalanceAbove
Price:          priceAbove, priceBelow
```

This gives enough variety for ~95% of meaningful perp trading rules while keeping the V1 implementation tractable.

### Visualization preserved from v9 with tightening
- Compact header: name + key metric + status
- Expand: tables + bars + sparklines
- Single "+ Use as Trigger" button per category, with smart threshold suggestion

### Workflow preserved from v9
- Expand → review → click trigger → adjust → save
- Optional V2: pre-built strategy templates

## Key insights for the founder

1. **No signal works alone**. The most accurate UX is showing multiple signals together so the user can spot convergence/divergence. Our 5+ category view aligns with this.

2. **Divergence > absolute level**. The strongest trader edge is when signals disagree with price action (e.g., price up but CVD down = absorption). V2 should explicitly highlight divergences. V1 alpha gives raw data; V2 adds derived divergence detection.

3. **Liquidation heatmap is the killer feature** of Coinglass. We can't fully replicate (multi-exchange data), but we can show **HL-specific liquidation clusters** which no one else does. This is genuine unique edge.

4. **Cross-exchange funding** (HL vs Binance vs Bybit) is uniquely available via HL's `predictedFundings` endpoint. Ship in V1 — quick win.

5. **HLP and vault leader activity** is uniquely ours. No one else can show "HLP just shifted $5M into short positions on BTC." Worth investing engineering effort.

6. **Don't over-build V1**. P1 trader will tell us which signals they actually use. Ship the 4 pillars + order book + price = 12 conditions, watch alpha behavior, then iterate.

## What's next (Phase 2)

1. Founder reads this memo
2. Decisions on D1-D5
3. We update `signals-framework.md` with final decisions (this file becomes the framework spec)
4. Update mockup `/preview/trade` to reflect final framework (v12)
5. Day 14: W2 retrospective + W3 plan (signal framework now baked in)
6. Day 15+ (M1): Build the actual signal pipeline using HL API + worker

## Appendix — Research sources

1. CryptoCred — "Comprehensive Guide to Crypto Futures Indicators" (canonical perp trader guide)
2. Coinglass — Top 10 indicators, liquidation heatmap concept
3. Velo — Institutional derivatives data structure
4. Laevitas — Options + perp data depth
5. Amberdata — Funding rates as positioning signal
6. CoinAPI — Historical perp data structure
7. Hyperliquid API docs — what's available natively
8. XT Exchange — Liquidation cascade mechanics (2026 piece)
9. Bookmap — CVD divergence patterns
10. TradingRiot — Practical perp trading insights
