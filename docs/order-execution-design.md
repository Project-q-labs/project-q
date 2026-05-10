# Order Execution Design — Project Q

> **Status**: Design memo (W2 Day 10 AM).
> **Code**: `lib/orders/{conditional,triggered,types,index}.ts` — interfaces and stubs.
> **Implementation**: M3 (W7-W8) for V1.

## TL;DR

Project Q has **two distinct order execution flows** because Hyperliquid only accepts price- and time-based conditions natively. Indicator-based, volume-based, funding-based, and on-chain-based triggers cannot be expressed as Hyperliquid orders directly — they must be watched by our server.

This shapes everything downstream: rule builder UX, alert system, order submission pipeline, latency expectations, V1 vs V2 boundaries.

## Two execution flows

### Flow A: Conditional (Hyperliquid-native)

```
User sets rule
    ↓
Project Q calls placeStopOrder(...)  ← user signs ONCE
    ↓
Hyperliquid holds the order
    ↓
Price condition met
    ↓
Hyperliquid auto-fills              ← no further user action
    ↓
Project Q observes via WS / fill webhook
```

**Properties:**
- ✅ V1 already fully automatic — no Agent Wallet needed
- ✅ Sub-millisecond execution latency (exchange-side)
- ✅ No risk of Project Q downtime breaking execution
- ❌ Limited to price/time conditions

**Code:** `ConditionalOrderExecutor` interface, `DirectWalletConditionalExecutor` impl.

### Flow B: Triggered (Project Q-watched)

```
User sets rule
    ↓
Rule stored in our DB
    ↓
WS worker watches indicator stream
    ↓
Condition met
    ↓
Worker calls executor.executeMarketOrder(...)
    ↓
V1: notification → user taps → wallet signs → submitted
V2: Agent Wallet signs automatically (post-launch)
    ↓
Project Q observes fill via WS
```

**Properties:**
- ✅ Supports any condition we can compute (funding, OI, RSI, on-chain, etc.)
- ✅ This is Project Q's actual differentiator
- ❌ V1 needs user tap to execute (~5-30s latency from condition met to filled)
- ❌ Requires our server uptime
- ❌ Slippage risk between trigger and fill

**Code:** `TriggeredOrderExecutor` interface, `DirectWalletTriggeredExecutor` impl.

## Rule → Flow mapping

When a user creates a rule, we classify it during validation:

| Rule type | Flow | V1 latency | V1 user action |
|---|---|---|---|
| "BTC price hits $X" | A (Conditional) | ~ms | None after setup |
| "BTC drops Y% from peak" | B (Triggered) | seconds | Tap to approve |
| "Funding > X%" | B (Triggered) | seconds | Tap to approve |
| "Volume > N x average" | B (Triggered) | seconds | Tap to approve |
| "RSI crosses X" | B (Triggered) | seconds | Tap to approve |
| "Liquidation cascade > $Y" | B (Triggered) | seconds | Tap to approve |
| "Stop-loss / take-profit" | A (Conditional) | ~ms | None after setup |
| "Pair trade BTC/ETH ratio" | B (Triggered) | seconds | Tap to approve |

The split roughly maps to:
- **Flow A**: classic "set and forget" stop/limit orders — Hyperliquid already does these well.
- **Flow B**: everything Project Q is actually being built for — the smart triggers that need indicator awareness.

## V1 user experience for Flow B

The "tap to approve" is the V1 compromise. Mitigation strategy:

1. **Channel**: Push via Telegram bot (already wired in M0) — fastest delivery.
2. **One-tap UX**: Notification deep-links into Project Q with rule + proposed order pre-filled. User just signs in their wallet.
3. **Time-limited approval**: If user doesn't approve within N minutes (configurable per rule), the trigger expires. This avoids stale fills at much-changed prices.
4. **Slippage cap**: Every triggered order carries a `maxSlippage` parameter. If price moves beyond the cap before signature, frontend cancels.
5. **"Always-approve" hint**: We can show "Want this automatic? V2 Agent Wallet (coming soon)" — gently tees up V2 without dependence.

For users actively at their device, this can feel near-automatic. For users away from device, expiry handles the staleness problem.

## V2 (post-launch) — what changes

Only the Flow B implementation changes. The interface stays the same:

```typescript
class AgentWalletTriggeredExecutor implements TriggeredOrderExecutor {
  readonly kind = "triggered_agent_wallet" as const;

  async executeMarketOrder(params: TriggeredOrderParams): Promise<OrderResult> {
    // 1. Sign with delegated agent key (no user prompt)
    // 2. Submit immediately via /exchange
    // 3. Return result synchronously
  }
}
```

The rule engine, alert system, and UI never branch on `kind` — they just call `executor.executeMarketOrder(...)`. Adding V2 means: add the class, route users who've authorized an agent to it via factory.

## DB implications

Current schema has `orders.executor` enum: `"direct_wallet" | "agent_wallet"`. To accommodate the conditional/triggered split, we should evolve to:

```sql
orders.executor enum:
  - "conditional_direct_wallet"   -- Flow A, V1 (current)
  - "triggered_direct_wallet"     -- Flow B, V1 (current)
  - "triggered_agent_wallet"      -- Flow B, V2 (future)
```

**Migration is deferred to M3** when we actually need the discrimination. Day 10 AM does NOT change the DB.

## What this means for the rule builder (M2)

When we build the rule builder UI in M2, we need:

1. **Condition selector** that classifies the rule on the fly — show users a small badge:
   - 🟢 "Auto-execute on Hyperliquid" (Flow A)
   - 🟡 "Approve on alert" (Flow B, V1)
2. **Latency expectations** in the rule preview: "This rule will execute in ~ms" vs "in ~seconds (after approval)".
3. **Slippage controls** only shown for Flow B rules.

This dual nature is actually a UX feature — users will appreciate knowing whether their rule is exchange-guaranteed or Project Q-watched.

## What this does NOT cover

- Hyperliquid's actual signing scheme — Day 10 PM (SDK research)
- Real `placeOrder()` implementation — M3
- Push notification routing & approval UI — M3
- Pending approval table schema — M3
- Telegram bot ↔ web app deep-linking — M2-M3

## Open questions for M2 / M3

1. **Approval UX channel**: Telegram bot vs PWA push vs both? (Telegram is faster + already wired; PWA is more "native" feel.)
2. **Approval expiry default**: 1 minute? 5 minutes? Per-rule configurable?
3. **Multi-rule batching**: If two rules fire within 1s for the same coin, batch into one signature? Probably yes, but adds complexity — defer to post-alpha.
4. **Failed approval recovery**: If user approves but transaction fails (e.g., margin moved), do we retry? Show a re-approve button? — Decide in M3.
