# Rule Builder UX — Design Memo

> **Status**: UX wireframe (W2 Day 13, revised after Flow B clarification + business model alignment).
> **Build target**: M2 (W5-W6) for the builder UI; M3 (W7-W8) for the trade screen and execution path.
> **Anchored to**: Day 10 AM order execution split (Flow A conditional / Flow B triggered), Day 10 PM SDK choice (`@nktkas/hyperliquid`), Day 11 AM system rule seeding.
> **Live preview**: `/preview/rule-builder` — interactive mockup for design validation. No save, no execution.

## What we're designing

The rule builder is where users compose their edge in plain English. It's the single most important screen in Project Q — if this feels hard, users bounce. If it feels obvious, we have a product.

But the builder alone is not enough. The full V1 promise is **trigger → alert → trade in our app**. Users compose rules here, our worker watches 24/7, and when a rule fires we route the user through our own trade screen for the actual fill. That last step is where revenue happens (builder fee) and where we differentiate from "alerts-only" services like TradingView.

## V1 vision in one paragraph

A trader writes a rule like "alert me when BTC funding goes above 25%." Our worker watches Hyperliquid every second. When the threshold is hit, we send Telegram + in-app alerts containing a deep link. They tap, land in our trade screen with live metrics and the rule's suggested action pre-filled, adjust if they want, sign once in their wallet, and the order goes to Hyperliquid through our SDK with our builder code attached. We earn a small builder fee (default 4 bps, configurable by us). They keep custody, they keep control, they paid us a few cents because we saved them the journey from intuition → execution.

## Core principle: "Show me a sentence I'd actually say"

A great rule reads like a thought a trader already has:

> "Buy 5% portfolio BTC when funding goes above 25% APR"
> "Alert me when HYPE OI crosses 800M"
> "Short ETH when funding flips negative AND price is holding"

The builder's job is to construct sentences like these without making the user feel like they're filling a form.

## Five user scenarios

### Scenario 1 — Crowded long fade
**Thought**: "DOGE funding looks insane, I want to fade it"
**Rule**: When DOGE funding APR > 50%, short with 3% portfolio
**Flow**: B (triggered) — funding is not a Hyperliquid-native condition
**V1 behavior**: alert → user taps → our trade screen with short pre-filled → user signs → fill

### Scenario 2 — Price breakout buy
**Thought**: "I'll buy BTC if it breaks 100K"
**Rule**: When BTC price crosses above $100,000, buy with 10% portfolio
**Flow**: A (conditional) — Hyperliquid stop-market natively
**V1 behavior**: one-time signature at rule creation, Hyperliquid handles the rest

### Scenario 3 — Multi-condition entry
**Thought**: "I want to long ETH only if funding is negative AND price isn't crashing"
**Rule**: When ETH funding < 0% AND ETH 24h change > -2%, long with 5% portfolio
**Flow**: B (triggered)

### Scenario 4 — Liquidation cascade alert
**Thought**: "Tell me when the market gets liquidated hard"
**Rule**: When total liquidations in last hour > $100M, send alert (no order)
**Flow**: B (triggered, alert-only)
**V1 behavior**: alert only — no trade screen step. User decides what to do separately.

### Scenario 5 — Take profit + stop loss pair
**Thought**: "I'm long ETH from 3500, I want TP at 3800 and SL at 3400"
**Rule**: Two linked orders on existing position
**Flow**: A (both legs are conditional)

## The two execution paths users will experience

### Path A — Hyperliquid-native conditions (🟢 Auto-executed)

```
User writes rule "buy BTC at $100k"
    ↓
User signs once at rule creation
    ↓
Order rests in Hyperliquid order book
    ↓
Price hits → Hyperliquid fills automatically
    ↓
We observe the fill, record in our DB, notify user
```

V1 already gets fully automatic behavior for these — no Agent Wallet needed. Latency: milliseconds.

### Path B — Project Q-watched conditions (🟡 Alert + trade screen)

```
User writes rule "short DOGE when funding > 50%"
    ↓
Rule stored in our DB
    ↓
Our worker watches funding stream 24/7
    ↓
Threshold crossed
    ↓
Telegram alert + in-app alert sent
    "DOGE funding hit 51.2% — open trade screen"
    [Open in Project Q →]
    ↓
User taps deep link
    ↓
Our trade screen loads with:
  - Live current funding (may have shifted since trigger)
  - Live current price
  - Rule's suggested action pre-filled (Short DOGE, 3% portfolio)
  - User can adjust size, type, slippage
    ↓
User taps "Execute"
    ↓
Wallet prompts EIP-712 signature
    ↓
@nktkas/hyperliquid SDK submits order with builder code
    ↓
Hyperliquid fills, we record, user sees confirmation
```

V1 latency: trigger to fill is dependent on user response time (seconds to minutes). The trade screen is honest about this — it shows **current live metrics, not frozen trigger-time metrics**. The user decides whether the opportunity is still valid.

The latency is a feature, not a bug. The user retains decision-making authority. The rule is a notification engine plus a pre-filled order form — not an autonomous trader.

## The builder's anatomy

### Top level: 3 panels

```
┌─────────────────────────────────────────────────────────────┐
│  RULE NAME [_______________]              [Save] [Test]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WHEN (conditions)                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Add condition  ▼                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│                    [AND] / [OR]                             │
│                                                             │
│  THEN (action)                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Choose action  ▼                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  💡 BADGE: 🟢 Auto-executed | 🟡 Alert + Trade Screen      │
│  📊 PREVIEW: Currently 11.0% APR — not triggered            │
└─────────────────────────────────────────────────────────────┘
```

Three panels — WHEN, AND/OR connector, THEN — always visible. No hidden menus, no multi-step wizard. One screen.

### The condition picker

```
┌─────────────────────────────────────┐
│  What should trigger this rule?     │
├─────────────────────────────────────┤
│  🎯 PRICE                           │
│  ⚡ FUNDING                         │
│  📊 OPEN INTEREST                   │
│  💥 LIQUIDATIONS                    │
│  📈 24H CHANGE                      │
│  🕐 TIME (every N min)              │
└─────────────────────────────────────┘
```

User picks one → expands to specifics:

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ FUNDING                                             │
│                                                         │
│  For:  [BTC ▼]   on Hyperliquid                         │
│                                                         │
│  When:  [APR ▼]  [is greater than ▼]  [25] %            │
│                                                         │
│  Currently: 11.0% APR  (would not trigger)              │
└─────────────────────────────────────────────────────────┘
```

The "Currently" line is **live**. Pulls from the same evaluation engine as `/rules`. As user adjusts the threshold, they see immediately whether it would fire right now.

### The action picker

```
┌─────────────────────────────────────────────────────────┐
│  What should happen when triggered?                     │
├─────────────────────────────────────────────────────────┤
│  💰 OPEN TRADE SCREEN with pre-filled order             │
│       Alert + deep link to our trade screen             │
│       You'll see live metrics and decide                │
│                                                         │
│  🚨 ALERT ONLY                                          │
│       Send a notification, no trade screen              │
│                                                         │
│  ⛔ CLOSE POSITION                                      │
│       Pre-fill exit order for existing position         │
└─────────────────────────────────────────────────────────┘
```

The "Open Trade Screen" option expands to pre-fill defaults:

```
┌─────────────────────────────────────────────────────────┐
│  💰 OPEN TRADE SCREEN — Pre-fill defaults               │
│                                                         │
│  Direction: [⚪ Buy / Long] [⚫ Sell / Short]            │
│                                                         │
│  Suggested size:  [5] % of portfolio                    │
│  (Adjustable when trade screen opens)                   │
│                                                         │
│  Type:  [Market] [Limit at __] [Stop at __]             │
│                                                         │
│  Max slippage: [0.5] % (caps market orders)             │
│                                                         │
│  Reduce only: ☐                                         │
└─────────────────────────────────────────────────────────┘
```

Important wording shift from v1 of this memo: the action panel describes a **trade screen invocation**, not an order placement. The order happens on the trade screen, with the user's final tap.

### The Flow A / Flow B badge

Calculated automatically from conditions. Users never pick Flow A or B explicitly.

**Case A — Hyperliquid-native (price/time only)**:
```
┌────────────────────────────────────────────────────────┐
│ 🟢 AUTO-EXECUTED                                       │
│ Hyperliquid runs this rule directly. You sign once    │
│ now; the exchange fills when conditions hit.          │
│ Latency: milliseconds.                                 │
└────────────────────────────────────────────────────────┘
```

**Case B — Project Q-watched (indicators, funding, OI, etc.)**:
```
┌────────────────────────────────────────────────────────┐
│ 🟡 ALERT + TRADE SCREEN                                │
│ Project Q watches 24/7. When the rule triggers,       │
│ we'll send Telegram + in-app alerts with a link to    │
│ our trade screen, where the order is pre-filled and   │
│ you confirm with one tap. You're always in control.   │
│                                                        │
│ → Coming in V2: optional Agent Wallet for hands-free   │
│   execution (with regulatory groundwork to follow).    │
└────────────────────────────────────────────────────────┘
```

The mention of V2 is intentional — sets expectation that hands-free comes later, and clarifies V1's compromise.

## The trade screen (M3, the heart of V1's revenue path)

When a Flow B rule fires and the user taps the alert, they land on a trade screen specifically designed for trigger-driven execution.

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to my rules                                         │
│                                                             │
│  Rule triggered: "DOGE funding fade"                        │
│  Fired 38 seconds ago when funding hit 50.1% APR            │
│                                                             │
│  ┌── Live metrics ─────────────────────────────────────┐    │
│  │ DOGE funding APR:  51.2%  (was 50.1% at trigger)    │    │
│  │ DOGE price:        $0.1248                           │    │
│  │ 24h change:        +2.3%                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌── Pre-filled order from your rule ──────────────────┐    │
│  │ Action:    SHORT DOGE                                │    │
│  │ Size:      3% of portfolio  ($300 at $10k equity)   │    │
│  │ Type:      Market with 0.5% slippage cap             │    │
│  │                                                      │    │
│  │ [Edit] to adjust before executing                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌── Estimated cost ───────────────────────────────────┐    │
│  │ Hyperliquid fee (taker):  $0.135                     │    │
│  │ Project Q fee (0.04%):    $0.120                     │    │
│  │ Total estimated cost:     $0.255                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [Cancel]                            [Execute trade →]      │
└─────────────────────────────────────────────────────────────┘
```

Tap Execute → wallet signature prompt → SDK submits with our builder code → fill confirmed → user back on rule detail page with fill receipt.

Critical UX elements:
- **Live metrics, not frozen** — user sees what's true *now*, decides accordingly
- **Trigger-time context preserved** — "was 50.1% at trigger" so user understands what fired the rule
- **Pre-fill from rule, but editable** — respects rule intent without locking the user in
- **Cost transparency** — both Hyperliquid's fee and our builder fee shown explicitly
- **One-tap execute** — the only friction is the wallet signature, not our UI

## Business model — builder fees, configurable

Project Q earns revenue through Hyperliquid's Builder Code system. We attach our builder address and a fee parameter to every order our trade screen submits. Default: **4 basis points (0.04%) on perp orders**.

### What the user signs

At first-time onboarding (or first time they create a rule that will route through our trade screen), the user signs an `approveBuilderFee` action authorizing us to charge **up to** our maximum rate.

```
Wallet signature prompt:

  Approve Project Q to charge builder fees up to 0.05%
  on orders you place through our app.

  You can revoke this at any time.

  [Cancel]  [Sign]
```

- One-time signature per user
- User-facing max can be slightly above our actual charge (e.g. 0.05% headroom against our 0.04% charge) so we can adjust without re-signing
- Hyperliquid enforces this max on-chain regardless of what we request per order
- Hard cap from Hyperliquid: 0.1% on perps, 1% on spot

### Fee configurability — admin tooling

Our actual builder fee per order is **set in our backend, not hardcoded** — adjustable by admin at any time without code deploy. Three reasons:

1. **Competition response** — if a rival builder undercuts us, we adjust
2. **Volume-based promotions** — temporary fee reductions for power users or campaigns
3. **Per-market pricing** — we may want different rates for spot vs perp, or for specific pairs

**Implementation plan (M3)**:
- DB table `platform_settings` with rows for builder fee per market type
- Admin-only page `/admin/settings` (auth-gated) to edit values
- Worker reads current fee from DB on every order submission (no cache, or short-lived cache with revalidation)
- Audit log: every change recorded with admin user, timestamp, old value, new value
- Hard upper bound enforced in code: cannot exceed user's approved max
- Default value at launch: **4 bps (0.04%) for perps**, spot TBD

This admin tooling itself is **not a M2/M3 priority** — for alpha we can keep the value in an env var and redeploy when changing it. But the architecture (read from a single source per order) is set up so the admin UI is a small later addition.

## Open ecosystem — the longer game

Project Q's rule engine is conceptually portable. Once V1 proves it on Hyperliquid, the engine itself becomes the product. Other DEX interfaces, wallet apps, even centralized exchanges could embed our trigger-and-route engine as a feature.

### Phased rollout

**V1 (M3-M5 alpha)**: Project Q operates as a single, vertically-integrated app on Hyperliquid. We own the rules, the alerts, the trade screen, the builder fee revenue. No external integrations.

**V2 (after PMF)**: Agent Wallet option, Pro subscription. Still single-app, but offering hands-free execution as an upgrade.

**V3 (later)**: **Rule engine as an API**. Other Hyperliquid interfaces can call our engine to evaluate rules and route fills. Revenue model:
- Tier A — partner uses our engine, embeds our trade screen → we get builder fee
- Tier B — partner uses our engine, their own trade screen → we get a smaller per-call or revenue-share fee
- Tier C — partner uses our rule storage + engine for internal use → flat SaaS fee

**V4+ (mature)**: Cross-DEX support. The same rule "buy BTC when funding > X" should be deployable to any DEX with a compatible API and builder mechanism. Project Q becomes the **rules layer of crypto trading**, agnostic to venue.

### What this means for V1 design choices

Knowing V3-V4 is the goal, V1 design needs to:

- **Keep the rule schema venue-agnostic** — current spec uses generic terms (coin, side, size %) not Hyperliquid-specific structures. Already done.
- **Keep the executor abstraction** — Day 10 AM's `OrderExecutor` interface split (conditional vs triggered) is exactly the seam where future venues plug in.
- **Treat builder fee as one execution-side variable** — different venues will have different fee mechanisms (Builder Codes, white-label fees, referral splits). The engine itself shouldn't bake in Hyperliquid's specific model.
- **Avoid Hyperliquid-only UI affordances** — e.g., when showing fee info on the trade screen, don't assume Hyperliquid's exact maker/taker split is universal.

These are not M2 decisions — they're principles to keep in mind as M2 is built so we don't paint ourselves into a corner.

## Mobile considerations

Project Q's target persona (semi-quant traders, $10-500k capital) skews desktop, but trades happen on phones during life. Mobile must work for:
- Browsing system rules (read-only) → easy
- Editing a rule's threshold (single field edit) → must work
- Receiving alerts and reaching the trade screen → critical
- **Trade screen execution on mobile** → critical (most alerts will be acted on from phone)

Mobile compromise: builder collapses panels vertically, condition picker becomes a bottom sheet, threshold input gets a numeric keyboard. The trade screen is designed mobile-first because that's where alerts land.

## The "Use as Template" flow

System rules from `/rules` need a one-tap path into the builder:

```
[System rule card]                          [Use as template →]
                                                   ↓
                              [Builder opens with rule pre-filled]
                              [User can edit / save / test]
```

This is the most important conversion path in alpha — system rule shows what's possible, "Use as template" is the friction-free hook into rule creation, which is the friction-free hook into the trade screen, which is the friction-free hook into our revenue.

## Decisions deferred to M2/M3

| Decision | When to decide |
|---|---|
| Drag-and-drop condition reordering | M2 Day 1 — leaning no, delete + re-add suffices |
| Multiple actions per rule (alert + order) | M2 Day 2 — leaning yes, simple list |
| Per-rule daily notional limit (safety) | M2 Day 3 — yes, required for alpha |
| Nested conditions ((A AND B) OR C) | M2 Day 4 — defer to post-alpha |
| Trade screen design system (colors, density) | M3 Day 1 — likely matches Hyperliquid feel |
| Wallet library — Wagmi vs ConnectKit vs RainbowKit | M3 Day 1 |
| Telegram bot vs PWA push as primary alert | M2 — decision based on alpha tester preference |
| Backtest depth (just count vs P&L) | M2 Day 5 — V1 just count |

## What we're explicitly NOT doing in V1

- **Agent Wallet hands-free execution** — V2 only, after PMF validation
- **Indicator math UI** (RSI period, MA cross) — V2
- **Visual drag-drop blocks** — overengineered for V1's condition set
- **Pine Script or DSL** — kills no-code positioning
- **TradingView Alerts integration** — separate product surface
- **Cross-venue support** — V4+ goal, not V1
- **Public engine API for third parties** — V3 goal
- **Variable slippage tracking analytics** — post-alpha
- **Backtest P&L estimation** — M5+

## Component plan for M2 build

```
components/rules/
├── RuleBuilder.tsx              # top-level builder page
├── ConditionList.tsx            # WHEN panel
├── ConditionRow.tsx             # one condition row
├── ConditionPicker.tsx          # add-condition expansion
├── ActionPanel.tsx              # THEN panel
├── OrderActionForm.tsx          # pre-fill defaults config
├── AlertActionForm.tsx          # alert-only config
├── FlowBadge.tsx                # auto/approve badge
├── BacktestSummary.tsx          # test results
└── UseAsTemplateButton.tsx      # action on system rule cards

components/trade/   (built in M3, sketched here)
├── TradeScreen.tsx              # the post-alert trade flow
├── LiveMetricsPanel.tsx         # current vs trigger-time
├── PreFilledOrderForm.tsx       # rule action with edit
├── FeeBreakdown.tsx             # Hyperliquid + builder fee shown
└── ExecuteButton.tsx            # wallet signature trigger
```

About 15 components total across M2 + M3.

## Day-by-day M2 sketch (verified against M1 plan)

- **W5 Day 1-2**: Builder skeleton, condition picker for funding + 24h change
- **W5 Day 3-4**: Action panel, Flow A/B badge
- **W5 Day 5**: Save flow, wallet connect, `approveBuilderFee` flow
- **W6 Day 1-2**: Rule evaluation worker (reads rules from DB, fires triggers)
- **W6 Day 3**: Telegram alert pipeline with deep-link to trade screen
- **W6 Day 4-5**: Backtest "trigger count" mode, polish, M2 retro

M3 will then build the actual trade screen and SDK integration.

## Why this memo matters now

By the time M2 starts, the design above will feel obvious — but only because it's written down now. The W3-W4 (M1) work will subtly shape user expectations through the markets pages and live preview. When M2 starts, the original UX intent must survive contact with implementation:

> Rules are sentences. The builder helps users say them clearly. Alerts deliver them at the right moment. The trade screen makes the order one tap away — with live truth, the rule's intent pre-filled, transparent costs, and the user's final word.

That paragraph is the test for every M2 and M3 design decision.
