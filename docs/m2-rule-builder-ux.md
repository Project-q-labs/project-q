# Trade Page UX — Design Memo

> **Status**: UX design (W2 Day 13, v3 — major redesign after founder review).
> **Build target**: M1 (W3-W4) for foundation; M2 (W5-W6) for trigger panel; M3 (W7-W8) for execution.
> **Anchored to**: Day 10 AM order execution split, Day 10 PM SDK (`@nktkas/hyperliquid`), Day 11 AM system rule seeding.
> **Live preview**: `/preview/trade` — interactive mockup.
> **Supersedes**: v1 and v2 of this document (separate rule builder page concept) — that approach is rejected.

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

## Layout — Desktop

```
┌──────────────────────────────────────────────────────────────────────────┐
│ PriceTicker (live, top)                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│ Header: [BTC ▼ pair selector]              $80,883  +1.2% 24h           │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─ SIGNAL BAR ────────────────────────────────────────────────────────┐ │
│ │ Funding APR  11.0% ↑    ━━━━━━━━●━━━━━━━━━━━━━  HIGH   rising      │ │
│ │ Open Interest $3.42B    ━━━━━━━━━━●━━━━━━━━━━━  normal +5.2% 24h   │ │
│ │ Liquidations $45M (1h)  ━━━━●━━━━━━━━━━━━━━━━━  low    long-heavy  │ │
│ │ Order Flow   Buy 56%    ━━━━━━━━━●━━━━━━━━━━━━  neutral            │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────┬──────────────────────────────┤
│                                           │ ORDER                        │
│ [1m][5m][15m][1h][4h][1d]   [Vol][Trig]   │ [⚪ Long]  [⚫ Short]         │
│                                           │                              │
│                                           │ Size: [ 5 ] %                │
│                                           │ ~$500 at $10k equity         │
│                                           │                              │
│             Candle Chart                  │ Type:                        │
│        (lightweight-charts)               │  ⚪ Market (now)             │
│                                           │  ⚪ Limit at $___            │
│                                           │  ● Trigger when...           │
│                                           │                              │
│                                           │  ┌─ WHEN ─────────────────┐  │
│                                           │  │ BTC Funding APR > 25%  │  │
│                                           │  │ + Add condition (max 3)│  │
│                                           │  └────────────────────────┘  │
│                                           │                              │
│                                           │ Currently: 11% (won't fire)  │
│                                           │                              │
│                                           │ Fees: 0.085% (~$0.43)        │
│                                           │                              │
│                                           │ [Save as Rule]               │
└───────────────────────────────────────────┴──────────────────────────────┘
```

### Three regions

**Region 1 — Signal Bar (top, full width)**
- 4 rows: Funding / OI / Liquidations / Order Flow
- Each row: name + numeric value + intensity bar + textual label + trend
- Intensity bar uses range-appropriate scales (e.g. Funding APR 0-50%)
- Color-coded position: green (low) → yellow (normal) → red (high/extreme)
- **Clicking a row** pre-fills a trigger condition in the order panel based on that signal's current value

**Region 2 — Chart (center, takes most space)**
- lightweight-charts v5 candlestick
- Timeframe toggle on top: 1m / 5m / 15m / 1h / 4h / 1d
- Overlays:
  - Volume bars (bottom of chart)
  - Crosshair tooltip with OHLC
  - User's open position markers (entry, liquidation)
  - **Trigger threshold lines** (horizontal, when user is configuring a trigger)

**Region 3 — Order Panel (right, fixed width)**
- Direction toggle: Long / Short
- Size in % portfolio (with $ equivalent)
- Three order types as radio:
  - **Market (now)** — immediate execution
  - **Limit at $___** — resting order on Hyperliquid
  - **Trigger when...** — conditional rule, our differentiator
- When Trigger is selected: condition builder appears with WHEN clause
- "Currently: X (won't fire)" or "Currently: X · WOULD FIRE NOW" live indicator
- Fee preview (Hyperliquid + Project Q transparency)
- Action button changes by mode:
  - Market → "Execute Now"
  - Limit → "Place Limit Order"
  - Trigger → "Save as Rule" (or "Execute Now" if condition already met)

## Layout — Mobile

Mobile uses a **Bottom Sheet** pattern (Uber/Apple Maps style):

### Default state (chart-focused)

```
┌─────────────────────────┐
│ BTC ▼      $80,883 ↑   │ ← Header
├─────────────────────────┤
│ Fund 11%↑ ━━●━ HIGH    │ ← Signal Bar (compact)
│ OI $3.4B  ━●━━ normal  │
│ Liq $45M  ●━━━ low     │
│ Flow 56%  ━━●━ neutral │
├─────────────────────────┤
│                         │
│                         │
│        Chart            │ ← Chart fills most space
│                         │
│                         │
├═════════════════════════┤
│  ▔▔▔  Trade BTC      ▲  │ ← Collapsed Bottom Sheet (60px)
└─────────────────────────┘
```

### Sheet partially pulled up

```
┌─────────────────────────┐
│ BTC ▼      $80,883 ↑   │
│ (Signal Bar)           │
├─────────────────────────┤
│        Chart (smaller)  │
├═════════════════════════┤
│  ▔▔▔                    │
│ [Long] [Short]          │
│ Size: [ 5 ] %           │ ← Bottom Sheet expanded
│ Type: ● Trigger when... │
│                         │
│   BTC Funding > 25%     │
│   + Add (max 3)         │
│                         │
│ [Save as Rule]          │
└─────────────────────────┘
```

The sheet expands as the user drags up or taps the handle. Chart compresses (but never disappears). Order/Trigger gets the space it needs to be fully usable.

This works because:
- Chart is most valuable in default state (analysis time > order time)
- Order panel needs space only when actively placing orders
- Bottom sheet is now a familiar mobile pattern (Uber, Apple Maps, Spotify use it)

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
