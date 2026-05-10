# Hyperliquid SDK Research — Project Q

> **Status**: Research memo (W2 Day 10 PM).
> **Decision**: Use `@nktkas/hyperliquid` for V1 order execution.
> **Implementation**: M3 (W7-W8). No code changes in W2.

## Why this memo exists

Day 10 AM defined the `ConditionalOrderExecutor` and `TriggeredOrderExecutor` interfaces with stubs that throw `not_implemented`. M3 has to fill those stubs with real Hyperliquid calls. This memo decides which SDK to use, captures the exact call shapes for the four operations we'll need, and lists the gotchas that always burn a day if discovered fresh.

## SDK choice: `@nktkas/hyperliquid`

| Criterion | Result |
|---|---|
| Weekly downloads | ~49,000 (10x competitors) |
| Last release | 7 days before research |
| Hyperliquid official docs lists it? | Yes (one of two named TS SDKs) |
| Privy integration uses it? | Yes (their docs use this SDK) |
| Node 20 compatibility | Use `@deeeed/hyperliquid-node20` fork if needed (Vercel default is Node 20) |
| License | MIT |
| Modular structure | Three clients: `InfoClient`, `ExchangeClient`, `SubscriptionClient` |

Alternatives ruled out:
- `nomeida/hyperliquid` — auto-applies its own referral, conflicts with our builder fee model.
- `LIQD-Labs`, `@hyper-d3x` — minimal adoption, slower updates.

**At M3 start, re-check the latest version** — this is fast-moving.

## Module layout (matches our `lib/orders/` structure)

```
@nktkas/hyperliquid
├── InfoClient          → reads (ignored — we already use REST/WS directly for market data)
├── ExchangeClient      → writes (this is what M3 needs)
└── SubscriptionClient  → WS (we already wrote our own thin WS in workers/hl-ws)
```

We only need `ExchangeClient` for M3.

## Setup pattern

```typescript
import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";

// V1: user signs in their browser wallet (Wagmi / viem WalletClient)
// V2 (post-launch): server-side agent wallet — privateKeyToAccount(agentKey)
const wallet = userBrowserWallet;  // viem WalletClient or ethers Wallet

const transport = new HttpTransport({
  isTestnet: false,  // true for testnet during M3 dev
});

const exchange = new ExchangeClient({
  transport,
  wallet,
  // Optional: sign-once mode for batch operations
});
```

Note: `wallet` accepts viem accounts, ethers signers, or a raw private key. For V1 (browser wallet), we'll pass the user's viem `WalletClient`. For V2, the agent's private key.

## The four call shapes M3 needs

### 1. Conditional limit order (Flow A — `ConditionalOrderExecutor.placeOrder`)

```typescript
// "Buy 0.1 BTC at $90,000 (resting limit)"
const result = await exchange.order({
  orders: [{
    a: 0,                    // asset index — BTC. Lookup table from info.meta()
    b: true,                 // buy = true, sell = false
    p: "90000",              // price as string
    s: "0.1",                // size as string
    r: false,                // reduceOnly
    t: { limit: { tif: "Gtc" } },  // Good-Til-Cancel
    c: clientOrderId,        // our cloid for idempotency
  }],
  grouping: "na",
  builder: {
    b: BUILDER_ADDRESS,      // our builder wallet
    f: 4,                    // 4 bps = 0.04%
  },
});
```

### 2. Conditional stop order (Flow A — stop-market)

```typescript
// "Trigger market buy when BTC hits $90,000"
const result = await exchange.order({
  orders: [{
    a: 0,
    b: true,
    p: "0",                  // ignored for market trigger
    s: "0.1",
    r: false,
    t: {
      trigger: {
        triggerPx: "90000",
        isMarket: true,
        tpsl: "tp"           // "tp" (take-profit) or "sl" (stop-loss); semantics
                             // overlap — Hyperliquid uses both for trigger orders
      }
    },
    c: clientOrderId,
  }],
  grouping: "na",
  builder: { b: BUILDER_ADDRESS, f: 4 },
});
```

### 3. Triggered market order (Flow B — `TriggeredOrderExecutor.executeMarketOrder`)

When our worker detects "funding > 0.05%" and fires a market order:

```typescript
// "Sell 0.1 ETH at market right now"
// IoC (immediate-or-cancel) at a price that crosses spread = market behavior
const midPrice = await info.allMids().then(m => parseFloat(m.ETH));
const slippageCappedPrice = midPrice * 0.995;  // 0.5% slippage cap on sell

const result = await exchange.order({
  orders: [{
    a: 1,                    // ETH index
    b: false,                // sell
    p: slippageCappedPrice.toFixed(2),
    s: "0.1",
    r: false,
    t: { limit: { tif: "Ioc" } },  // Immediate-or-Cancel = market behavior with safety
    c: clientOrderId,
  }],
  grouping: "na",
  builder: { b: BUILDER_ADDRESS, f: 4 },
});
```

**Why IoC + capped price instead of true market**: Hyperliquid's "true market" can fill at any price during volatility spikes. IoC at a slippage-capped price guarantees we don't fill 5% off mid in a flash crash. Cancels remainder if not fully filled.

### 4. Cancel order

```typescript
const result = await exchange.cancel({
  cancels: [{
    a: 0,                    // asset index
    o: hlOrderId,            // Hyperliquid order ID returned by .order()
  }],
});

// Or by client order ID
const result = await exchange.cancelByCloid({
  cancels: [{
    asset: 0,
    cloid: clientOrderId,
  }],
});
```

## Builder Fee setup (one-time per user)

This is critical for our V1 revenue model. **A user must approve our builder once before we can charge fees on their orders.**

```typescript
// User signs once during onboarding
await exchange.approveBuilderFee({
  builder: BUILDER_ADDRESS,    // Project Q's builder wallet (we control)
  maxFeeRate: "0.05%",         // user-side cap — Hyperliquid enforces
});
```

Limits:
- **Perps**: max 0.10% (10 bps). We charge 4 bps = 40% of cap. Safe.
- **Spot**: max 1.00% (100 bps).
- "f" field in order is fee in **tenths of a basis point**: `f: 4` = 0.04% = 4 bps. (verify against latest docs at M3 start — naming has been inconsistent across SDK versions)

UX impact: this approval is a separate signature from any order. We need an onboarding step ("Authorize Project Q to charge builder fees") before the user can place their first order.

## Asset index lookup

Order body uses asset *index* (`a: 0`), not symbol. Indices come from `info.meta()`:

```typescript
const meta = await info.meta();
const assetIndex = meta.universe.findIndex(asset => asset.name === "BTC");
// → 0 for BTC
```

Cache this. Indices are stable — only changes when Hyperliquid lists a new perp.

## Error handling

The SDK throws `ApiRequestError` for exchange errors:

```typescript
try {
  const result = await exchange.order({ ... });
  // success path
} catch (err) {
  if (err instanceof ApiRequestError) {
    // Map err.response to our ExecutorError enum
  }
}
```

Mapping plan (verify against actual error strings during M3):

| SDK error / response | Our `ExecutorError` |
|---|---|
| `"Insufficient margin"` / margin variants | `"insufficient_margin"` |
| `"Price must be"` / size validation errors | `"invalid_price"` / `"invalid_size"` |
| `"Order has zero size"` / sizing errors | `"invalid_size"` |
| User rejects in wallet UI | `"user_rejected"` |
| HTTP 429 / rate limit | `"rate_limited"` |
| Network timeout | `"network_error"` |
| Other API error responses | `"exchange_rejected"` (with `details`) |
| anything else | `"unknown"` |

## Testnet first

Always develop against testnet during M3:
```typescript
const transport = new HttpTransport({ isTestnet: true });
```

Testnet URL is built into the SDK — no manual URL config needed. Test wallet funded via Hyperliquid's faucet. Move to mainnet only after the executor implementation is observed working for a full session against testnet.

## Mapping our interface to SDK calls

```typescript
// lib/orders/conditional.ts (M3 implementation sketch)

import { ExchangeClient, HttpTransport, ApiRequestError } from "@nktkas/hyperliquid";

export class DirectWalletConditionalExecutor implements ConditionalOrderExecutor {
  readonly kind = "conditional_direct_wallet" as const;
  private exchange: ExchangeClient;

  constructor(wallet: WalletClient, isTestnet = false) {
    this.exchange = new ExchangeClient({
      transport: new HttpTransport({ isTestnet }),
      wallet,
    });
  }

  async placeOrder(params: ConditionalOrderParams): Promise<OrderResult> {
    try {
      const assetIndex = await this.lookupAsset(params.coin);
      const sdkOrder = this.toSdkOrder(params, assetIndex);
      const result = await this.exchange.order({
        orders: [sdkOrder],
        grouping: "na",
        builder: { b: BUILDER_ADDRESS, f: BUILDER_FEE_TENTHS_BPS },
      });
      const status = result.response.data.statuses[0];
      if ("resting" in status || "filled" in status) {
        return { success: true, hlOrderId: status.resting?.oid ?? status.filled?.oid };
      }
      return { success: false, error: this.mapError(status), details: JSON.stringify(status) };
    } catch (err) {
      return { success: false, error: this.mapException(err), details: String(err) };
    }
  }

  // ...
}
```

This is design intent only — actual code in M3 may differ as we encounter the API.

## M3 entry checklist

When starting M3, in order:

1. ☐ Re-run `npm view @nktkas/hyperliquid version` and note current version
2. ☐ Check Hyperliquid changelog for any breaking API changes since this memo
3. ☐ Decide Node version (20 vs 24) — pick fork accordingly
4. ☐ Set up testnet wallet, fund from faucet
5. ☐ `npm install @nktkas/hyperliquid viem`
6. ☐ Implement `DirectWalletConditionalExecutor.placeOrder` first (limit only)
7. ☐ Verify against testnet — place + observe order in Hyperliquid testnet UI
8. ☐ Add cancel, modify
9. ☐ Implement `DirectWalletTriggeredExecutor.executeMarketOrder` (IoC pattern)
10. ☐ Add `approveBuilderFee` to onboarding flow
11. ☐ Test all 4 operations on testnet end-to-end
12. ☐ Switch `isTestnet` to false. Manual smoke test with $50.
13. ☐ Roll out to alpha users.

## Open questions for M3 start

1. **Browser-side or server-side signing?** Likely browser-side for V1 (user wallet via Wagmi). But our worker triggers Flow B from the server — does it need to relay back to browser for signature, or do we use a different pattern (websocket push to user's open tab)? Resolve in M2-M3 design.
2. **Builder fee unit**: confirm `f: 4` = 4 bps vs 4 tenths of bps. Test on testnet first.
3. **Multi-order batching**: Hyperliquid allows multiple orders per `order()` call. If two rules fire within 1s, do we batch? Likely yes for atomicity, but adds complexity. Defer to post-alpha unless trivial.
4. **Cloid format**: `c` field expects 16-byte hex. Plan our client order ID generation accordingly (UUID → bytes16).

## What this memo does NOT decide

- Push notification mechanism for V1 Flow B approval (Telegram bot vs PWA push) — design in M2
- Pending approval table schema — design in M3
- Exact onboarding flow for builder fee approval — design in M2-M3
- Frontend wallet connection (Wagmi vs ConnectKit vs RainbowKit) — design in M3
