# Trade Page UX — Design Memo

> **Status**: UX design (W2 Day 13, v15 — Active Rules tab + Trigger History enhanced + Chart rule indicator).
> **Build target**: M1 (W3-W4) for foundation; M2 (W5-W6) for trigger panel; M3 (W7-W8) for execution.
> **Anchored to**: Day 10 AM order execution split, Day 10 PM SDK (`@nktkas/hyperliquid`), Day 11 AM system rule seeding, **Day 13 signals-framework.md (D1-D17)**.
> **Live preview**: `/preview/trade` and `/preview/trigger-set`.
> **Supersedes**: v1-v14 — earlier iterations.

## v15 changes (Active Rules management workflow)

After v14 live review, founder identified three structural gaps. v15 addresses Active Rules management and Trigger History (Position details deferred to live data phase per founder's call).

### Two new Bottom tabs

1. **Active Rules tab** (Project.Q differentiation, ✦ amber)
   - Status badge: ACTIVE / PAUSED / ARMED
   - Columns: Status / Rule / Conditions / Action (Long/Short) / Size / Created / Last Check / Manage
   - Inline actions: Pause/Resume / Edit / Duplicate / Delete
   - Current symbol rows highlighted with amber tint
   - 4 pre-seeded mock rules (1 ARMED to demo state)

2. **Trigger History tab — enhanced** (was placeholder, now production-quality)
   - Columns: Time / Rule / Symbol / Conditions / Fire Reason / Action / Outcome / PnL
   - Outcome badges: OPEN / CLOSED / SKIPPED / FAILED
   - PnL color-coded (green/red) with USD + %
   - 7 mock history entries covering all outcome types

### Chart rule indicator (new persistent row)

Top of chart area:
```
✦ My Rules · 3 active · ⚡ 1 ARMED · 4 total     Manage rules →
```

- Shows across all symbols (not just current)
- Armed count prominent (alerts user about to fire)
- "Manage rules →" jumps to Active Rules tab
- Removes need for sidebar drawer (keeps UI simple)

### Tab badge counts

Active Rules (4) · Trigger History (7) — instant at-a-glance state.

### Bottom tab order rationale

Standard HL/Based tabs preserved, our 2 differentiation tabs appended at end:

```
Balances | Positions | Outcomes | Open Orders | TWAP | Trade History |
Funding History | Order History | ✦ Active Rules (4) | ✦ Trigger History (7)
                                  └── Project.Q only ──┘
```

Per founder's decision: keep all standard perp DEX tabs (other DEX users expect these), add our differentiation tabs at end with amber emphasis.

### Tab roles reference

| # | Tab | Source | Role |
|---|---|---|---|
| 1 | Balances | HL userState + spotState | Asset balances (perp + spot + total) |
| 2 | Positions | HL userState.assetPositions | Open positions with TP/SL editing |
| 3 | Outcomes | HL prediction markets | Prediction outcome positions |
| 4 | Open Orders | HL openOrders | Pending unfilled orders |
| 5 | TWAP | HL twapHistory | TWAP order progress |
| 6 | Trade History | HL userFills | Executed trade record |
| 7 | Funding History | HL userFunding | Funding payments received/paid |
| 8 | Order History | HL orderStatus | All orders (filled + cancelled) |
| 9 | **Active Rules** | **Project.Q DB** | **✦ Currently-active trigger rules** |
| 10 | **Trigger History** | **Project.Q DB** | **✦ Historical fires with outcomes** |

### Deferred (per founder)

- **Position details enhancement** — emerges naturally when live HL data flows
- **Signal Alerts** (V1.5) — trigger-less notifications
- **Sidebar drawer** (V2) — chart indicator sufficient for now
- **`/rules` page** (V2) — bulk operations, backtest, analytics

### Preserved from v14

- 6 active signal cards + 2 V2 placeholder
- L/S Ratio card with cross-exchange preview
- 22 trigger conditions + 5 popular combos
- Trigger panel: Slippage protection + Auto TP/SL + Mark Price reference
- 3-tab middle column (Book/Trades/Signals)

### Builder fee

5 bps (confirmed in signals-framework.md D9)

## v14 changes (L/S Ratio card + Trigger panel optimization)

After v13 live review, trader feedback identified L/S Ratio missing from the 4 pillars of perp microstructure. v14 adds L/S Ratio as a 6th active signal card and optimizes the Trigger panel with research-backed best practices.

### Structural changes

1. **Signal cards: 7 → 8** (5 active + 2 placeholder → **6 active + 2 placeholder**)
   - New: **Long/Short Ratio** card (between Order Flow and Liquidations)
   - Card content: Ratio + Long/Short % bar + 24h trend sparkline + Cross-exchange preview + Extreme warning
   - Status interpretation: 0.5-0.8 short-heavy, 0.8-1.2 balanced, 1.2-2.0 long-heavy, >2.5 or <0.4 extreme

2. **New trigger conditions (5)**
   - `lsRatioAbove` — L/S > X (e.g. 2.5 for fade)
   - `lsRatioBelow` — L/S < X (e.g. 0.5 for bounce)
   - `lsRatioFlipBullish` — L/S crosses 1.0 upward
   - `lsRatioFlipBearish` — L/S crosses 1.0 downward
   - Total triggers: 17 → 22

3. **New Popular Combinations (2)**
   - "Crowded long + funding extreme" → fade (short)
   - "L/S flip + OI rising" → trend confirmation (long)
   - Total combos: 3 → 5

4. **Trigger panel optimization (research-backed)**
   - **Slippage protection** field added when Execute as = Market (industry standard for conditional orders)
   - **Auto TP/SL toggle** added (OCO pattern: one fills, other cancels)
   - **Mark Price reference indicator** shown for price-based triggers (avoids wick-based false fires)
   - All three based on industry best practices from BingX/Bybit/Crypto.com research

### Why L/S Ratio matters

L/S Ratio reveals current positioning vulnerability — different from Liquidations which shows past consequences:

| Metric | Time | Use |
|---|---|---|
| Liquidations | Lagging (past 1h) | "What happened" |
| L/S Ratio | Live (now) | "What might happen next" |

Combined with Funding (cost) + OI (capital) + Liquidations (consequences), L/S Ratio completes the 4 pillars of perp microstructure analysis.

### Data source

Hyperliquid public API does not expose L/S Ratio. Our worker computes it from `clearinghouseState` snapshots:
- Sample top 500-1000 active traders per market every minute
- Account-weighted L/S ratio (each account counted once)
- Rolling 24h history in Supabase
- HL-only principle preserved (no external API)

### Trigger panel best practices applied

Based on industry research (BingX, Bybit, Crypto.com):

| Feature | Why | Where |
|---|---|---|
| Slippage protection | Volatility wick = bad fill on market execution | THEN section (market only) |
| Auto TP/SL (OCO) | One fills → other cancels, no double-position risk | THEN section |
| Mark Price reference | Last price vulnerable to wick manipulation | Shown for price triggers |
| Hidden conditions | Already hidden from order book (Bybit/HL standard) | (existing) |

### Updated framework summary

- **Active V1 cards (6)**: Funding · OI · Order Flow · **L/S Ratio (NEW)** · Liquidations · Order Book
- **V2 placeholder cards (2)**: On-chain · HL Activity
- **Trigger conditions (22)**: was 17
- **Popular Combinations (5)**: was 3
- **Trigger panel**: Slippage protection + Auto TP/SL + Mark Price reference

### Preserved from v13

- 3-tab middle column (Book / Trades / Signals)
- Order Book ladder + Trades panel
- Default trigger tab with PREVIEW badge
- Condition cards with distance visualization
- Trigger Library modal
- Inline trigger buttons per signal category

### Builder fee

5 bps (confirmed in signals-framework.md D9)

## v13 changes (Order Book/Trades + Trigger panel optimization)

After v12 live review, founder identified that the Order Book + Trades panels (standard on HL/Based) were missing — only Signal microstructure metrics were present. v13 adds these as a 3-tab middle column.

### Structural changes

1. **Middle column: 3-tab structure** (D15)
   - Was (v12): Signals only
   - Now (v13): **Book / Trades / Signals** tabs
   - Default: Book (trader habit)
   - Signals tab visually emphasized: ✦ amber color + count badge (7)

2. **Order Book Ladder** (NEW)
   - Real-time bid/ask depth, ~12 levels each side
   - Columns: Price | Size | Cumulative Total
   - Red asks above, green bids below
   - Mid-price separator with spread display
   - Footer: Bids/Asks total in USD

3. **Trades Panel** (NEW)
   - Recent trades list (~20 fills)
   - Columns: Price | Size | Time ago
   - Buy/Sell color coding

4. **Trigger Order Panel — Major refresh** (D10-D14)
   - Default tab is now **Trigger** with "PREVIEW" badge (D12)
   - PREVIEW alert: "Build rules now, fire when M2 launches"
   - Three sections: **When / Then / Preview**

5. **Condition cards with distance visualization** (D10)
   - Shows: Now (current value) + N% to fire + progress bar
   - ARMED state when threshold reached
   - Inline threshold editing

6. **Inline trigger buttons in Signal categories** (D11 path 1)
   - Each category has 2-4 trigger buttons
   - Funding: APR>X, APR<X, Flip, Cross-exchange Gap
   - OI: 24h change, 1h change
   - Order Flow: Buy%, Large fill, Net flow
   - Liquidations: Total, Long, Short
   - Order Book: Spread, Imbalance

7. **Trigger Library Modal** (D11 path 2)
   - Full 17-condition catalog grouped by category
   - Search bar
   - Popular Combinations section (3 curated combos)
   - Access via "Browse all →" link in Trigger panel

8. **Popular Combinations** (D14)
   - Inline in Trigger panel (when no conditions yet)
   - Also in Trigger Library Modal
   - 3 curated: "Funding extreme + OI rising", "Liquidation cascade + Buy flow", "Cross-exchange gap"
   - Click → auto-fills conditions

9. **OR toggle removed** (D14)
   - Multi-condition rules are AND-only
   - Simpler UX, matches TradingView multi-condition pattern

10. **Market/Limit panel — HL standard fields** (D13)
    - Added: Margin mode (Cross/Isolated), Leverage, GTC/IOC toggle (limit), Post Only (limit)
    - Liquidation Price calculation
    - Order Value calculation
    - Fees: 0.035% HL + 0.05% builder

11. **Trigger panel Preview section** (D13)
    - "If triggered now": Entry price, Position size, Liquidation, Risk %, Fees
    - Direct decision aid before saving rule

12. **Mobile redesign for Market Data**
    - Mobile sub-tabs: Chart / **Market Data** / Trigger (was 3-tab now still 3)
    - Market Data tab contains sub-sub-tabs: Book / Trades / ✦ Signals (7)

### Preserved from v12

- 7 signal categories (5 active + 2 V2 placeholder)
- Cross-exchange funding comparison
- Trigger price line visualization on chart
- Click line → Active Rule view + Cancel
- Chart 600px height
- Mobile Bottom Tab Bar

### Builder fee

5 bps (confirmed in signals-framework.md D9 — alpha policy)

## v12 changes (signals framework reflection)

After Day 13 research phase (signals-framework.md, 697 lines) and decisions D1-D9, the mockup is updated to reflect locked framework decisions.

### Structural changes

1. **Categories: 5 → 7** (5 active + 2 V2 placeholder)
   - Was (v11): Funding / Order Flow / Order Book / On-chain / Wallet Flow
   - **Now (v12)**: Funding / **Open Interest** (new) / Order Flow / **Liquidations** (new) / Order Book / On-chain (V2) / **HL Activity** (V2, renamed from Wallet Flow)

2. **Funding category: Cross-exchange comparison added**
   - HL vs Binance vs Bybit funding rates displayed inline (relative bars)
   - Gap badge with bps when gap > 100 bps
   - New trigger: `fundingGapAbove` (triggers when HL-CEX gap exceeds X bps)
   - Data source: HL `predictedFundings` endpoint (free, no external API)

3. **Open Interest category (NEW)**
   - Total OI value
   - 24h change %, 1h change %
   - 24h trend sparkline
   - Trigger: `oiChange24hAbove`

4. **Liquidations category (NEW)**
   - 1h total
   - Long/Short split with bar visualization
   - Largest liquidation
   - 24h pattern sparkline
   - Triggers: `liquidations1hAbove`, `longLiquidationsAbove`, `shortLiquidationsAbove`

5. **Basis added to top stat bar**
   - (mark - oracle) / oracle as %
   - Visible alongside Mark / Oracle / 24h Change / Volume / OI / Funding

6. **HL Activity placeholder messaging**
   - Renamed from "Wallet Flow" to emphasize our unique edge
   - V2 messaging: "HL-only data, not in any other dashboard"
   - Will include: HLP vault flow, top traders, vault leaders

### Trigger condition catalogue: v9 had 6 → v12 has 17

```
Price (2):           priceAbove, priceBelow
Funding (3):         fundingAprAbove, fundingAprBelow, fundingFlip
OI (2):              oiChange24hAbove, oiChange1hAbove
Order Flow (3):      buyFlowAbove, largeFillDetected, netFlow5minAbove
Liquidations (3):    liquidations1hAbove, longLiquidationsAbove, shortLiquidationsAbove
Order Book (2):      spreadAbove, imbalanceAbove
Cross-exchange (2):  fundingGapAbove, allExchangesCrowded
```

### Smart trigger suggestions (v12)

For Funding category, if cross-exchange gap > 200 bps, a secondary "+ Trigger on Cross-exchange Gap" button appears alongside the regular trigger button. This nudges users to discover the more advanced trigger when the situation warrants it.

### Builder fee update

- v9: 4 bps (mentioned in alert messages)
- **v12: 5 bps** (aligned with confirmed alpha fee policy in signals-framework.md D9)

### Preserved from v9

- Hyperliquid 60/20/20 column ratio (chart/signals/order)
- Chart 600px height (roomy)
- Trigger price line visualization on chart
- Click line → Active Rule view + Cancel
- Non-price trigger badges above chart
- Mobile Bottom Tab Bar (Markets/Trade/Account)
- Mobile sub-tabs (Chart/Signal/Trigger)
- All v9-v11 working features

## v10 changes (Trigger Set marketplace page)

A new top-level menu item **"Trigger Set"** is added to the nav (5th item after Trade / Portfolio / Referrals / Leaderboard). This is a separate page from Trade.

### V1 alpha purpose
A space where:
- **Featured Presets** (curated by Project Q): 6 hand-picked trigger setups across funding / order flow / order book / multi-condition categories — same seed data as `/rules` (Day 11 AM)
- **Community Triggers**: rules other users have publicly shared (mock data in alpha)
- **My Triggers**: empty placeholder for V1 (user's own saved rules from Trade page; full integration in M2)

Each card shows:
- Source (Official badge / @username)
- Title + description
- When/Then clauses
- Tags (Funding, Order Flow, Momentum, Mean Reversion, Multi-condition, etc.)
- Difficulty (Beginner / Intermediate / Advanced)
- Stats (uses, fires/month, likes)
- **"Use this trigger" button** → navigates to /trade/{symbol} with rule pre-filled
- Like button (heart icon, counts but stateless in alpha)

### Filters
- Tag filter (multi-category)
- Difficulty filter (Beginner / Intermediate / Advanced)
- Tabs: Featured Presets / Community / My Triggers

### V2-V3 evolution path

This page is the seed of what becomes the **rule marketplace** later:
- **V2**: User-published triggers, real like/save/fork mechanics, comments
- **V2.5**: Backtest results displayed on each card (P&L, win rate, max drawdown)
- **V3**: **Referral integration** — trigger authors earn a share of fees when their rules are used in actual trades. Aligns with rest of Referrals system.
- **V3+**: Leaderboard for top-performing trigger authors

### Why now (alpha) vs later
- **Now (alpha)**: Browse + use. Validate whether users actually want to share + use community rules. Cheap to ship (read-only catalogue).
- **Later (V2+)**: Build publishing, voting, referral payouts only after demand is proven.

This matches our V1 philosophy: ship the lightest version that answers the question "do users want this?". If yes, invest. If no, deprecate the section.

## v9 changes (vertical spacing + trigger price lines)

User reviewed v8 live mockup and provided two more refinements:

1. **Vertical spacing too compact** — match Hyperliquid's roomier feel
   - Chart height: 460 → **600px**
   - Header padding: ~2.5 → 3 (15% more breathing room)
   - Bottom tabs: min-height 160 → 200px
   - Stat row gap: 5 → 6 spacing units
   - Order panel form fields: tighter to roomier (py-1.5 → py-2)

2. **Trigger visualization on chart** — saved rules need to be visible
   - **Price-based triggers** (Price > X, Price < X) render as horizontal dashed lines on the chart with label "Trigger ↑/↓ $X"
   - **Non-price triggers** (Funding, OI, etc.) show as small "⚡ N-cond" badges above the chart since they can't be plotted by price
   - **Click any trigger line or badge** → Order panel switches to "Active Rule" view showing:
     - The rule's conditions (When clause)
     - The action (direction, size, symbol)
     - Created timestamp
     - **Cancel Rule button** (red, confirmation prompt)
   - **Close × button** to return to normal Order panel
   - Visual cue: clicked rule's line turns green; others stay amber

### Why this matters

Without trigger visualization, the user creates a rule and then forgets about it. With chart lines, they see at a glance what they have running, can iterate (cancel + recreate at better price), and feel confident the rule is "still alive."

This is critical M2 UX — without it, alpha users lose trust in the trigger feature after a few rules.

## Development philosophy — "Hyperliquid baseline, trigger differentiation"

The most important decision in v4 is not a layout choice — it's a **development philosophy**:

> **Adopt Hyperliquid's UI/UX wholesale as our V1 baseline. Add only what makes us different: trigger-based trading. Validate with alpha users. Iterate based on their actual behavior, not our design intuition.**

### Why this beats "design from scratch"

1. **Hyperliquid users are our primary persona** — they already know this interface. Zero learning curve for 95% of the UI.
2. **Design decisions deferred to data, not opinion** — we don't pre-optimize what we can't validate. Alpha users show us where the friction lives.
3. **Engineering velocity** — copying a known-good pattern is faster than inventing one. Time saved goes into the trigger engine, our real differentiator.
4. **Honest positioning** — we're not "the better Hyperliquid UI." We're "Hyperliquid + trigger-based trading."

### The 95/5 split

**95% Hyperliquid baseline (we don't innovate here)**:
- Top nav layout, menu items, button positions
- Pair selector + stats row format
- Margin mode toggle (Cross/10x/Classic)
- Chart placement and controls
- Order panel structure (direction, size, slippage, fees, reduce-only, TP/SL)
- Bottom tabs naming and order
- Mobile Bottom Tab Bar (Markets/Trade/Account)
- Markets sub-tab pattern
- Trade → Connect sheet
- Account → Equity + Perps Overview + Deposit/Withdraw

**5% Our differentiation (this is what we optimize)**:
- Signals replace order book content in middle column (desktop) and in middle sub-tab (mobile)
- Trigger as a third order type tab alongside Market/Limit
- Trigger History as a new bottom tab (desktop)
- Click signal → auto-add trigger condition (cross-tab interaction)

### Alpha learning plan

We **don't decide** the following pre-alpha. We let user behavior tell us:
- Are users naturally finding the Trigger tab, or do we need education?
- How many conditions do power users want (V1 cap is 3)?
- Which signals are most clicked-as-trigger?
- Do mobile users prefer to build triggers on mobile, or just view alerts there?
- Is "Trigger History" tab heavily used, or does Telegram suffice?

These answers from 25 alpha users (W11-W12) reshape M5+ priorities. Until then, **we do not pre-optimize** — we ship the Hyperliquid baseline + trigger differentiation, and learn.

## v4 change (post-screenshot review)

The user reviewed v3 mockup and confirmed the layout structure should match Hyperliquid's exactly. Reasoning: Hyperliquid users land on our app and recognize the interface within 5 seconds. Zero learning curve for the 95% of UI that isn't our differentiation. The 5% that differs is precisely what makes us valuable.

**Decisions locked in v4**:
1. **Top nav menu (desktop)**: 4 items only — Trade, Portfolio, Referrals, Leaderboard
2. **Top right corner**: Connect button, language toggle (🌐), settings (⚙️) — same as Hyperliquid
3. **Pair header row**: Same format — Pair selector | 10x | Mark | Oracle | 24h Change | 24h Volume | OI | Funding/Countdown, with Cross/10x/Classic margin mode toggle on the right
4. **Main layout 3 columns** — same proportions as Hyperliquid:
   - Left (~55%): Chart with timeframe + indicators + tools
   - Middle (~20%): "Order Book area" — but **WE REPLACE with Signals** (our differentiation)
   - Right (~25%): Order panel with Market/Limit/**Trigger** tabs (Trigger replaces "Pro")
5. **Bottom tabs (desktop)**: Same as Hyperliquid — Balances, Positions, Outcomes, Open Orders, TWAP, Trade History, Funding History, Order History — **plus new "Trigger History" tab** (our differentiation)
6. **Mobile pattern — Bottom Tab Bar (Hyperliquid-aligned)**:
   - Three persistent tabs at the bottom: **Markets / Trade / Account** (same as Hyperliquid)
   - **Markets** tab contains sub-tabs **Chart / Signal / Trigger** (our differentiation; Hyperliquid uses Chart / Order Book / Trades)
   - **Trade** tab opens the Connect sheet (wallet connection flow, same as Hyperliquid mobile)
   - **Account** tab shows Account Equity + Perps Overview with Deposit/Perps↔Spot/Withdraw buttons (same as Hyperliquid)
   - This is **page-style navigation**, not bottom sheets — each tab is a full-screen page, just like Hyperliquid's mobile app
   - Mobile header is simplified: hamburger menu (≡) + logo + Connect/🌐/⚙️ on the right
7. The signal bar concept from v3 is replaced by signals occupying the middle column on desktop, and the **Signal sub-tab** within the Markets tab on mobile.

## What we're designing

The trade page. One page where users see live signals, watch the chart, and place orders — including trigger-based orders. This page **is** the rule builder. There's no separate "go to rule builder" detour: the order panel itself accepts triggers as one of its order types.

This matches Hyperliquid's trade page mental model exactly: chart + order panel. We add (1) a signal bar with our worker's intelligence above the chart, and (2) a "Trigger when..." order type alongside Market and Limit in the order panel.

If the page does its job, users never realize they're "using a rule builder." They're just trading.

## The page identity

Hyperliquid users land here and see something familiar:
- Same dark UI grammar
- Same chart in the center
- Same order form on the right

But they notice three differences:
1. **Above the chart**: a compact signal bar showing live Funding, OI, Liquidations, Order Flow for the active pair — with visual intensity (color + bar position).
2. **In the order panel**: a third order type alongside Market and Limit, called "Trigger when...", that lets them define a condition and save the configured order as a rule.
3. **System rule cards** elsewhere (at `/rules`) link directly to this page with the rule's conditions and action pre-filled, ready for the user to review and save as their own.

That's the entire product surface for V1.

## V1 vision in one paragraph

A trader sees BTC funding is high. They open our trade page. The signal bar confirms 11% APR with a red "HIGH" badge. They tap that signal bar row — the right-side order panel auto-fills a trigger condition "BTC Funding APR > 11%". They adjust the threshold to 25% for a meaningful spike, pick Short, set 5% portfolio size, and tap "Save as Rule." Done in 15 seconds. When funding eventually hits 25%, our worker sends Telegram + in-app alerts. The user taps in, lands back on this same trade page, sees the live state, and executes the order with one wallet signature. We earn 4 bps on every fill. They keep custody throughout.

## Why this beats a separate rule builder page

The earlier design (now rejected) had `/rules/new` as a dedicated form-filling page. Three problems:

1. **Context separation kills intent**. Users compose rules while looking at the market they're trading. A separate page forces them to remember what they saw on the chart.
2. **No reuse with the alert→trade flow**. When alerts fire, users need a trade screen anyway. Building two screens (rule builder + trade screen) duplicates UI and engineering.
3. **Hyperliquid users have a clear mental model: "trade pages = where I trade."** Forcing a separate "rule pages = where I make rules" splits that model and adds learning overhead.

By merging both intentions into one screen, we get:
- Less code to write (M1 + M2 + M3 share one page evolving over time)
- Faster user onboarding (one screen to learn)
- Tighter loop between observing markets and acting on them

## Signal categories — 5 expandable cards

Each category has a compact header (~40px tall) showing name, summary, and status badge. Clicking expands to show rich detail.

### 1. Funding
- Summary: APR + direction
- Expanded: 1h rate, APR, 24h avg/peak, direction, 8h sparkline
- Trigger: `Funding APR > X%`

### 2. Order Flow
- Summary: Buy% / status
- Expanded: Buy vs Sell volumes, net flow 5min, avg trade size, recent large fills ($300k+)
- Trigger: `Buy Flow > X%`

### 3. Order Book (replaces Hyperliquid's separate Order Book tab)
- Summary: Spread + tightness
- Expanded: Spread (abs + %), best bid/ask, depth at ±0.1% and ±0.5%, bid-ask imbalance
- Trigger: `OB Imbalance > X%`, `Spread > X bps`
- **Why this differs from Hyperliquid**: HL shows raw order book ladder; we summarize for trigger usability. Power users who want the ladder can still see depth numbers.

### 4. On-chain (V2 placeholder)
- Status: 🔒 Coming in V2
- Will include: exchange flows, stablecoin minting, large wallet moves
- External data via Glassnode / Arkham (integration deferred to post-PMF)

### 5. Wallet Flow (V2 placeholder)
- Status: 🔒 Coming in V2
- Will include: whale activity, new vs returning traders, our user position distribution

### UX patterns

- **Default state**: all collapsed (5 headers fit in ~200px)
- **Expand individual**: click any header
- **Expand all**: toggle in column top
- **Each expansion shows "+ Use as Trigger"** button at bottom
- **V2 placeholders**: expand to show roadmap, no trigger button
- **State shared**: expanding on desktop also expands on mobile (signal sub-tab)

## Layout — Desktop (Hyperliquid 60/20/20)

Hyperliquid's actual measured ratios (from screenshot reference):
- Chart area: ~60%
- Order Book area: ~19% (we use this slot for Signals)
- Order Panel: ~21%

Implementation: `grid-cols-[1fr_280px_320px]` on 1440px+ screens.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Trade Portfolio Referrals Leaderboard           [Connect][🌐][⚙️]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [BTC-USDC▼][10x]  Mark | Oracle | 24h Change | Vol | OI | Funding   Cross 10x Classic │
├────────────────────────────────────┬──────────────┬─────────────────────────┤
│                                    │ Signals      │ [Market][Limit][Trigger]│
│ [5m][1h][D]  Indicators       [⛶]  │ ────         │                         │
│                                    │ FUNDING APR  │ [Buy/Long] [Sell/Short] │
│                                    │ 11.0% ↑      │                         │
│                                    │ ━━●━━ high   │ Available    0 USDC     │
│  Candle Chart                      │ rising       │ Position     0 BTC      │
│                                    │ ────         │                         │
│                                    │ OPEN INTEREST│ Size  [0.00]      BTC   │
│                                    │ $3.42B       │ [─────●──] [ 5 %]       │
│                                    │ ━●━━━ normal │                         │
│                                    │ +5.2% 24h    │ Max slippage [0.5%]     │
│                                    │ ────         │                         │
│                                    │ LIQ 1H       │ [ ] Reduce Only         │
│                                    │ $45M ↓       │ [ ] Take Profit / SL    │
│                                    │ ●━━━━ low    │                         │
│                                    │ long-heavy   │ Liq Price        N/A    │
│ Volume                             │ ────         │ Order Value      N/A    │
│ ▁▁▃▄▅▆▇▅▄▃▂▁▃▄▅                    │ ORDER FLOW   │ Slippage   Est: 0%      │
│                                    │ Buy 56%      │ Fees 0.045% + 0.040%    │
│                                    │ ━━●━ normal  │                         │
│ [5y][1y][6m][3m][1m][5d][1d]       │ neutral      │ [    Connect    ]       │
│                                    │              │                         │
│                                    │ ↳ click +trig│                         │
├────────────────────────────────────┴──────────────┴─────────────────────────┤
│ Balances Positions Outcomes Open Orders TWAP Trade Funding Order [TRIGGER HISTORY] │
├──────────────────────────────────────────────────────────────────────────────┤
│ No open positions yet                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Why this works

A Hyperliquid user lands on this and the muscle memory takes over:
- Same nav location, same pair selector position
- Same stats row
- Same chart-left, order-right structure
- Same bottom tabs

They notice three subtle differences:
1. **Middle column shows signals instead of order book** — because we're a triggers product, not a market making product
2. **Order panel has "Trigger" as a third tab** alongside Market and Limit — our differentiation lives here
3. **A "Trigger History" tab** at the end of the bottom tabs — to show what their rules fired and what action was taken

Everything else is familiar. Learning curve approaches zero. The differentiation is precisely where it should be — in the few places that matter for our value proposition.

## Layout — Mobile (Hyperliquid Bottom Tab Bar pattern)

The mobile experience follows Hyperliquid's mobile pattern exactly. Three persistent bottom tabs: **Markets / Trade / Account**. Each tab is a full-screen page, not a slide-up sheet.

### Markets tab (default)

```
┌─────────────────────────┐
│ ≡ ●PROJECT.Q  [Connect]🌐⚙️│ ← simplified header
├─────────────────────────┤
│ BTC-USDC ▼   80,883     │ ← compact pair info
│ 10x           -3.31%    │
├─────────────────────────┤
│ [Chart] [Signal][Trigger]│ ← sub-tabs
├─────────────────────────┤
│                         │
│ (Chart sub-tab):        │
│  Candle chart           │
│  Timeframes             │
│                         │
│ (Signal sub-tab):       │
│  4 signal cards         │
│  Tap any → adds trigger │
│                         │
│ (Trigger sub-tab):      │
│  Full Order panel       │
│  Market/Limit/Trigger   │
│                         │
├─────────────────────────┤
│ [Markets] Trade  Account│ ← fixed bottom tab bar
└─────────────────────────┘
```

### Trade tab → Connect sheet

```
┌─────────────────────────┐
│ Connect                 │
│                         │
│ [🖥  Link Desktop Wallet]│
│                         │
│ [✉  Log in with Email] │
│                         │
│        ─── OR ───       │
│                         │
│ [🔵 WalletConnect      ]│
│                         │
│ Prefer app-like? Try    │
│ the PWA.                │
│                         │
├─────────────────────────┤
│  Markets [Trade] Account│
└─────────────────────────┘
```

Identical to Hyperliquid's wallet connect screen. Three connection methods + PWA option.

### Account tab → profile

```
┌─────────────────────────┐
│ ≡ ●PROJECT.Q 0x5028…  🌐⚙️│
├─────────────────────────┤
│ Welcome to Project Q!   │
│ Get started here.       │
├─────────────────────────┤
│ Account Equity          │
│ Spot           $0.00    │
│ Perps          $0.00    │
├─────────────────────────┤
│ Perps Overview          │
│ Balance        $0.00    │
│ Unrealized PNL $0.00    │
│ Cross Margin   0.00%    │
│ Maintenance    $0.00    │
│ Cross Account  0.00x    │
│                         │
│ ┌─────────────────────┐ │
│ │      Deposit        │ │
│ └─────────────────────┘ │
│ [Perps⇄Spot] [Withdraw] │
├─────────────────────────┤
│  Markets  Trade [Account]│
└─────────────────────────┘
```

Identical to Hyperliquid's Account screen. Same fields, same buttons.

### Why this works for V1

- **Zero learning curve** — Hyperliquid mobile users already know this layout exactly
- **Each tab is a single focus** — Markets for browsing, Trade for connecting, Account for managing
- **Our differentiation is precisely placed** — only the Markets sub-tabs differ (Chart/Signal/Trigger vs Hyperliquid's Chart/Order Book/Trades), and Bottom Tab labels are identical
- **PWA-friendly** — full-screen page navigation works well with home-screen install

## Signal Bar — design rationale

The signal bar replaces what would have been a side panel of indicator cards. Why a row-based bar instead of stacked cards:

1. **Density** — Four signals fit in ~120px tall rows, leaving the chart 75%+ of viewport
2. **Comparability** — All signals on parallel scales next to each other; eye can scan and compare instantly
3. **Universal layout** — Same row structure works on desktop (wide) and mobile (narrow); just adjust text density
4. **Click-to-trigger** — Each row is a natural action target: "I see this, I want to trigger on it"

### Each row's structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Funding APR  │ 11.0% ↑  │ ━━━━━━━━●━━━━━━━ │ HIGH  │ rising    │
│  (name)        (value)     (intensity bar)   (label)  (trend)   │
└─────────────────────────────────────────────────────────────────┘
```

On click, this row tells the order panel: "Add a trigger condition for BTC Funding APR using 11% as the seed threshold." The user then bumps the threshold to something meaningful (25% for a "spike" rule) and proceeds.

## Order Panel — the three types

### Market (now)

```
Type: ● Market (now)
Slippage cap: [ 0.5 ] %

[Execute Now]
```

Simple immediate execution. Wallet signs, order goes via SDK with builder code attached.

### Limit at price

```
Type: ● Limit
Price: $[ 100000 ]
Time in force: [ GTC ▼ ]

[Place Limit Order]
```

Standard Hyperliquid resting limit. Wallet signs once, exchange handles fill.

### Trigger when... (our differentiator)

```
Type: ● Trigger when...

  ┌─ WHEN ─────────────────────────────┐
  │ [BTC ▼] [Funding APR ▼] [>] [25] % │
  │ + Add condition (max 3)            │
  └────────────────────────────────────┘

  Currently: 11.0% APR · won't fire yet

[Save as Rule]
```

When a second condition is added, AND/OR toggle appears between them. Maximum 3 conditions per rule in V1. Future paid tier may extend this to 5+, decided based on usage patterns post-alpha.

If the current state already satisfies the trigger conditions, the action button shows two options:

```
Currently: 28% APR · WOULD FIRE NOW ⚡

[Save as Rule]   [Execute Now]
```

This is the "live triggering" UX — when a user is building a rule and the conditions already match, we let them act immediately. This naturally connects observation to action.

## Trigger condition limit — V1 cap of 3

**Decision**: V1 alpha allows maximum 3 conditions per rule.

Reasoning:
- Three conditions cover the vast majority of meaningful trading rules (typical: 1-2 conditions)
- UI stays compact in the side panel
- Schema simpler, easier to validate and execute
- Creates a natural product tier boundary for V2:
  - Free: 3 conditions, learn the platform
  - Pro (V2+): 5+ conditions, nested logic, more advanced rules
- Decision on Pro pricing and limit deferred until post-alpha based on actual usage

For now: when a user clicks "+ Add condition" past 3, they see a soft note "More conditions coming with Pro — currently we cap at 3 to keep rules simple. Let us know what you'd want."

This collects qualitative product signal without committing to a monetization timeline.

## Live state in the trigger panel

The "Currently: X" line beneath the WHEN clause is the most important UX element in the trigger panel. It does three things:

1. **Reassurance**: User sees the system is reading real data
2. **Validation**: User sees whether their threshold is realistic ("oh, 25% is rare — currently 11%")
3. **Bridge to action**: When current state matches threshold, the user gets a one-tap path from observing to executing

Mechanically it uses the same evaluation pipeline as the signal bar — there's only one source of truth for "what's happening now."

## System rule → trade page entry

The `/rules` page already lists 6 seeded system rules (Day 11 AM). In V1, each rule card gets a **"Trade" action**:

```
┌─ System Rule Card ──────────────┐
│ BTC funding extreme — short     │
│ Category: Funding               │
│                                 │
│ IF: BTC funding APR > 25%       │
│ THEN: Short BTC, 5% portfolio   │
│                                 │
│            [ Trade BTC →  ]     │
└─────────────────────────────────┘
```

Clicking "Trade" navigates to the trade page for BTC, with:
- Order panel mode pre-set to "Trigger when..."
- Condition pre-filled (BTC Funding APR > 25%)
- Direction pre-set (Short)
- Size pre-set (5%)
- User adjusts what they want, taps "Save as Rule", and now they have their own copy of this rule

This is the **primary onboarding path** for first-time users: discover system rules → tap Trade → land on a fully-loaded trade page → minor edits → save → activated.

## Execution flow — the full V1 promise

When a Trigger rule fires (whether system-template-based or user-built):

```
[Project Q worker detects condition match]
    ↓
[Telegram alert sent + in-app notification]
    ↓
[User taps notification deep link]
    ↓
[Lands on trade page for that pair]
    ↓
[Order panel auto-populated from rule:
   Type = Market (because the trigger has already fired)
   Direction, size, slippage from rule action]
    ↓
[Live signal bar shows current state
   "BTC Funding APR 28% (was 25% at trigger)"]
    ↓
[User confirms or adjusts in 1-3 seconds]
    ↓
[Tap Execute Now → wallet signs → SDK submits with builder code]
    ↓
[Fill confirmed → notification updated → rule's last_fired_at updated]
```

The trade page handles all four roles: rule builder, market observer, trigger fulfillment screen, ad-hoc trader. One page, one mental model.

## Business model — builder fees, dynamically adjustable

Project Q earns revenue through Hyperliquid's Builder Code system. Every order our SDK submits attaches our builder address and a fee parameter. Default: **4 basis points (0.04%) on perp orders**.

### What the user signs once

At first-time onboarding, the user signs an `approveBuilderFee` action authorizing us to charge up to our maximum rate (slightly above our actual charge to give us headroom for future adjustments without re-signing):

```
Approve Project Q to charge builder fees up to 0.05%
on orders placed through our app.
You can revoke this at any time.
```

### Admin-side adjustability

Our per-order builder fee is set in the backend (DB-driven), not hardcoded. Admin can adjust without code deploy. Three motivating use cases:

1. **Competitive response** — match or undercut rival builders
2. **Promotional periods** — temporary fee reductions for power users
3. **Per-market pricing** — different rates for spot vs perp, or specific pairs

**Implementation plan (M3)**:
- DB table `platform_settings` with row per market type
- Auth-gated admin page `/admin/settings`
- Worker reads current fee on every order submission (short-lived cache OK)
- Audit log per change (who, when, old, new)
- Hard upper bound in code: cannot exceed user's approved max
- Default at launch: 4 bps perp, spot TBD

For alpha, an env var with redeploy is acceptable; full admin UI ships post-alpha.

### Cost to user

A user with 5% portfolio sized at $500 sees:
- Hyperliquid taker fee: $0.225 (0.045%)
- Project Q builder fee: $0.200 (0.040%)
- Total: $0.425 per round trip

This is shown explicitly in the order panel before execution. No hidden fees.

## Open ecosystem — the long game

Project Q's rule engine is conceptually portable. V1 proves it on Hyperliquid; V3+ opens it up.

**V1 (M3-M5 alpha)**: Single vertically-integrated app on Hyperliquid. We own everything end-to-end. Builder fee revenue.

**V2 (post-PMF)**: Optional Agent Wallet for hands-free execution. Pro subscription for advanced features (more conditions, more rules, faster execution paths). Builder fee + subscription.

**V3 (later)**: **Rule engine as API**. Other Hyperliquid frontends can call our engine to evaluate user rules and route orders. Revenue tiers:
- Partner uses our engine + embeds our trade screen → builder fee (we earn)
- Partner uses our engine + own trade screen → per-evaluation fee or rev share
- Partner uses our engine for internal use → flat SaaS fee

**V4+**: **Cross-venue support**. The rule "buy BTC when funding > X" deployable to any DEX with a compatible API. Project Q becomes the **rules layer of crypto trading**, venue-agnostic.

### Design principles for V1 to preserve this future

Knowing V3-V4 is the goal, V1 design must:

- **Keep rule schema venue-agnostic** — generic terms (coin, side, size %), not Hyperliquid-specific structures. Already done in current schema.
- **Keep executor abstraction** — Day 10 AM's `ConditionalOrderExecutor` / `TriggeredOrderExecutor` split is the seam for future venues.
- **Treat builder fee as one execution-side variable** — different venues will have different fee mechanisms; engine shouldn't bake Hyperliquid-specific assumptions.
- **Avoid Hyperliquid-only UI affordances** — the trade page should describe what's happening in generic terms when possible, with Hyperliquid-specific bits clearly isolated.

These are principles for ongoing decisions through M2-M3, not standalone tasks.

## Component plan

Components for the trade page (built progressively across M1, M2, M3):

```
components/trade/
├── TradePage.tsx                # top-level page (M1 foundation, M2 trigger, M3 execution)
├── PairSelector.tsx             # BTC/ETH/... dropdown (M1)
├── SignalBar.tsx                # the 4-row signal display (M1)
├── SignalRow.tsx                # individual signal row with intensity bar (M1)
├── PriceChart.tsx               # lightweight-charts wrapper (M1, builds on Day 9 stub)
├── TimeframeSelector.tsx        # 1m/5m/.../1d toggle (M1)
├── ChartOverlays.tsx            # volume, position, trigger lines (M1-M2)
├── OrderPanel.tsx               # right-side panel container (M1 skeleton, M2 trigger, M3 execute)
├── DirectionToggle.tsx          # Long/Short (M1)
├── SizeInput.tsx                # % portfolio with $ equivalent (M1)
├── OrderTypeSelector.tsx        # Market / Limit / Trigger radios (M2)
├── TriggerBuilder.tsx           # WHEN clause editor (M2)
├── ConditionRow.tsx             # one condition with kind/symbol/threshold (M2)
├── CurrentStateIndicator.tsx    # "Currently: X · won't fire" live line (M2)
├── FeeBreakdown.tsx             # Hyperliquid + builder fee transparency (M2)
└── ExecuteButton.tsx            # action button (dynamic label, M3 execution)
```

About 15 components, built progressively. M1 lays foundation (header, signals, chart). M2 adds the trigger flow. M3 wires execution.

## Day-by-day rollout across milestones

**M1 (W3-W4)**:
- Day 15: Pair selector, real candle chart with Hyperliquid data
- Day 16: Timeframe selector, chart overlays (volume, position markers)
- Day 17: Signal bar skeleton, Funding + OI rows
- Day 18: Signal bar — Liquidations + Order Flow rows
- Day 19: M1 polish, mobile responsiveness check
- Day 22-26: Continue, deploy worker, persistence

By end of M1, the trade page exists with signals + chart, no order panel yet (it can be a "coming soon" placeholder for the M1 demo).

**M2 (W5-W6)**:
- Day 1-2: Order panel skeleton, Market and Limit types
- Day 3-4: Trigger type, condition builder, live state indicator
- Day 5: Save as Rule flow, wallet connect, builder fee approval
- Day 6-7: Rule evaluation worker, Telegram alert pipeline
- Day 8-10: Backtest (count mode), polish

**M3 (W7-W8)**:
- Wire SDK execution path
- "Execute Now" actually places orders
- Fill confirmation, order history

## Decisions deferred

| Decision | When |
|---|---|
| Drag-and-drop condition reordering | M2 Day 1 (leaning: no, just delete + re-add) |
| Multiple actions per rule (alert + order) | M2 Day 2 |
| Per-rule daily notional limit | M2 Day 3 (yes, required for alpha) |
| Wallet library — Wagmi vs ConnectKit vs RainbowKit | M3 Day 1 |
| Bottom sheet animation library | M1 Day 19 |
| Telegram bot deep-link format | M2 Day 7 |
| Chart trigger line style (dashed? colored?) | M2 Day 4 |

## What we're NOT doing in V1

- Agent Wallet hands-free execution → V2 (post-PMF)
- Indicator math UI (RSI, MA, MACD) → V2
- Visual drag-drop block builder → never
- Pine Script or DSL → kills no-code positioning
- Cross-venue support → V4+
- Public rule engine API → V3
- Backtest with P&L → post-alpha
- 5+ conditions per rule → V2 Pro tier (TBD)
- Mobile native apps → V5+ (web + PWA sufficient for V1)

## Why this memo matters now

The redesign in v3 is significant. v1 and v2 of this document described a separate `/rules/new` page where users would fill out forms. The user explicitly rejected that approach: rules should be inline with the trade context, not a separate destination.

What stays true from v2:
- Flow A vs B execution model (Day 10 AM design)
- Builder fee dynamic adjustability
- Trigger → Telegram + in-app alert → trade page
- V1 keeps user in custody, V2 adds Agent Wallet option
- Open ecosystem vision (V3+)

What changes:
- Page identity: separate builder → integrated trade page
- Trigger as a separate UX → trigger as an order type (Market/Limit/Trigger)
- Side panel of indicator cards → top signal bar with intensity visualization
- Trade screen as separate screen → trade screen IS this page
- Component split: 10 builder components → 15 trade page components built progressively

The unifying insight, post-redesign:

> One page. Same screen for browsing markets, building rules, and acting on alerts. The trigger is not a separate concept — it's the third order type.

That sentence is the test for every design decision from here on.
