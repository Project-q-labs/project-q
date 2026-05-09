# Agent Wallet 호환성 — OrderExecutor 인터페이스 청사진

**문서 종류**: 아키텍처 결정 기록 (ADR)
**작성**: W1 Day 7
**상태**: Draft → M3 시작 시 확정
**관련 결정**: 비수탁 지갑 패러다임 (V1) / Agent Wallet (V2)

---

## 1. 배경 (Why)

Project Q는 트리거 기반 자동 거래를 약속하지만, 알파 단계에서는 두 가지 트레이드오프 사이에서 선택해야 했다:

| 패러다임 | 자동성 | 보안 위험 | 출시 속도 | 책임 |
|---|---|---|---|---|
| Agent Wallet (위임 키 자동 실행) | 100% | 🔴 매우 높음 | 느림 | 우리 시스템 버그 = 사용자 손실 |
| 비수탁 지갑 (사용자 매번 서명) | 0% (알림만) | 🟢 낮음 | 빠름 | 사용자 본인 행동 = 사용자 손실 |

W1에 결정된 방향:
- **V1 (알파~정식 출시)**: 비수탁 지갑. 사용자가 매 주문마다 서명.
- **V2 (정식 출시 후)**: Agent Wallet 옵션 추가. 사용자가 원할 때만 활성화.

이 문서는 **V1 코드가 V2를 자연스럽게 수용할 수 있도록** 인터페이스를 미리 설계한다.

---

## 2. 핵심 추상화: OrderExecutor

모든 주문 실행은 `OrderExecutor` 인터페이스를 통해서만 일어난다. 룰 엔진, UI, 알림 시스템은 이 인터페이스만 안다 — 구체적 구현체가 무엇인지(`DirectWalletExecutor` 또는 `AgentWalletExecutor`)는 모른다.

```typescript
// lib/execution/order-executor.ts (M3에 작성)

export type OrderSide = "long" | "short" | "close";

export type OrderParams = {
  coin: string;                   // "BTC", "ETH", ...
  side: OrderSide;
  sizeUsd: number;                // notional size in USD
  leverage?: number;              // default: 1x
  limitPx?: number;               // undefined → market order
  reduceOnly?: boolean;           // for closing positions
  tpPx?: number;                  // take profit trigger price
  slPx?: number;                  // stop loss trigger price
  clientOrderId: string;          // our cloid (UUID)
};

export type OrderResult = {
  success: boolean;
  hlOrderId?: number;             // Hyperliquid order id (oid)
  hlTxHash?: string;
  filledBase?: number;            // immediately filled
  avgFillPx?: number;
  feePaid?: number;
  error?: {
    code: "rejected" | "insufficient_margin" | "network" | "unknown";
    message: string;
  };
};

export type Position = {
  coin: string;
  side: "long" | "short";
  sizeBase: number;
  entryPx: number;
  unrealizedPnl: number;
  liquidationPx: number;
};

export interface OrderExecutor {
  /**
   * Submit an order to Hyperliquid.
   * Implementations differ in HOW the signature is produced.
   */
  placeOrder(params: OrderParams): Promise<OrderResult>;

  /**
   * Cancel an open order by Hyperliquid order id.
   */
  cancelOrder(coin: string, hlOrderId: number): Promise<OrderResult>;

  /**
   * Fetch current open positions for the connected user.
   */
  getPositions(): Promise<Position[]>;

  /**
   * What kind of executor is this? (for logging, audit, UI hints)
   */
  readonly kind: "direct_wallet" | "agent_wallet";
}
```

---

## 3. V1 구현: DirectWalletExecutor

```typescript
// lib/execution/direct-wallet-executor.ts (M3에 작성)

import { OrderExecutor, OrderParams, OrderResult, Position } from "./order-executor";
// import { useAccount, useSignTypedData } from "wagmi";  // RainbowKit/WalletConnect

/**
 * V1 — User signs every order themselves via their connected wallet
 * (MetaMask, Rabby, Coinbase Wallet, etc.).
 *
 * Flow:
 *   1. UI calls placeOrder(params)
 *   2. We construct the Hyperliquid action payload + EIP-712 typed data
 *   3. Show wallet popup → user reviews & signs
 *   4. POST signed payload to Hyperliquid /exchange endpoint
 *   5. Return result
 *
 * Cannot be used for true automation — a human must approve each click.
 * Used for: rule-triggered alert + "execute now" button in the UI.
 */
export class DirectWalletExecutor implements OrderExecutor {
  readonly kind = "direct_wallet" as const;

  constructor(private walletAddress: string, private signer: WalletSigner) {}

  async placeOrder(params: OrderParams): Promise<OrderResult> {
    // 1. Build Hyperliquid action payload
    // 2. Wallet popup for user signature (EIP-712)
    // 3. POST to https://api.hyperliquid.xyz/exchange
    // 4. Parse response, persist to `orders` table with executor='direct_wallet'
    throw new Error("Implement in M3");
  }

  async cancelOrder(coin: string, hlOrderId: number): Promise<OrderResult> {
    throw new Error("Implement in M3");
  }

  async getPositions(): Promise<Position[]> {
    // Read-only — no signature needed; query Hyperliquid clearinghouseState
    throw new Error("Implement in M3");
  }
}

/** Abstract wallet signer — actual impl wraps wagmi/RainbowKit hooks */
interface WalletSigner {
  signTypedData(domain: object, types: object, message: object): Promise<string>;
}
```

---

## 4. V2 구현: AgentWalletExecutor

V2에서 추가될 코드. **인터페이스가 같으므로 룰 엔진 코드는 한 줄도 변경되지 않는다**.

```typescript
// lib/execution/agent-wallet-executor.ts (V2)

import { OrderExecutor, OrderParams, OrderResult, Position } from "./order-executor";

/**
 * V2 — Agent Wallet executes on user's behalf.
 *
 * Setup (one-time):
 *   1. User generates a delegate key via Hyperliquid's "approve agent" flow
 *   2. User submits the approval tx with their main wallet
 *   3. Agent key is stored encrypted in our backend (or user's browser)
 *   4. Our system can now sign orders on user's behalf using the agent key
 *
 * Flow (per order):
 *   1. Rule engine triggers
 *   2. Server signs order with stored agent key (no user interaction)
 *   3. POST to Hyperliquid /exchange
 *   4. Notify user via Telegram of executed order
 *
 * Used for: full automation. User never sees a wallet popup.
 *
 * Security caveats:
 *   - Agent key has limited scope (set by user during delegation)
 *   - User can revoke agent at any time on Hyperliquid
 *   - Per-rule daily caps still apply
 *   - We never have access to user's main wallet
 */
export class AgentWalletExecutor implements OrderExecutor {
  readonly kind = "agent_wallet" as const;

  constructor(
    private userId: string,
    private agentKeyRef: string,      // KMS or encrypted vault reference
  ) {}

  async placeOrder(params: OrderParams): Promise<OrderResult> {
    // 1. Fetch agent private key from secure store (KMS / Vault)
    // 2. Sign order payload server-side (no user interaction)
    // 3. POST to Hyperliquid /exchange
    // 4. Persist to `orders` table with executor='agent_wallet'
    throw new Error("Implement in V2 (after alpha)");
  }

  async cancelOrder(coin: string, hlOrderId: number): Promise<OrderResult> {
    throw new Error("Implement in V2");
  }

  async getPositions(): Promise<Position[]> {
    throw new Error("Implement in V2");
  }
}
```

---

## 5. 룰 엔진과의 결합

룰 엔진(M2)은 OrderExecutor 인터페이스에만 의존한다. 어떤 executor가 주입되었는지는 모른다.

```typescript
// lib/rules/engine.ts (M2-M3)

class RuleEngine {
  constructor(private executor: OrderExecutor) {}

  async onTrigger(rule: Rule, snapshot: MarketSnapshot) {
    // 1. Send notification regardless of execution availability
    await sendNotification(rule, snapshot);

    // 2. If rule is set to auto-execute AND executor supports it, place order
    if (rule.autoExecute) {
      // Direct wallet can't auto-execute (user must click in UI)
      if (this.executor.kind === "direct_wallet") {
        // Send a "ready to execute" alert with deep link to /execute?ruleId=...
        await sendExecutionReadyAlert(rule);
      } else {
        // Agent wallet: execute immediately, no user interaction
        const result = await this.executor.placeOrder(rule.toOrderParams());
        await persistOrder(rule, result, this.executor.kind);
      }
    }
  }
}
```

이 코드는 V1과 V2 모두에서 작동한다. `executor.kind`만 다르게 분기.

---

## 6. DB 스키마와의 일치

`supabase/migrations/0001_initial_schema.sql`의 `orders` 테이블에 이미 다음 컬럼이 있다:

```sql
executor text NOT NULL CHECK (executor IN ('direct_wallet','agent_wallet'))
```

이로 인해 어떤 executor가 어떤 주문을 발행했는지 DB 레벨에서 추적 가능.
보안 감사 시: "이 주문이 사용자 직접 서명인가, 위임 키 서명인가?" 즉시 답할 수 있음.

또 `users` 테이블에 다음 컬럼이 미리 있다:

```sql
agent_wallet_address text   -- NULL until user opts in to V2
```

V2 출시 시 사용자가 Agent Wallet을 활성화하면 이 필드에 위임 주소가 저장됨. V1 사용자는 이 필드가 NULL.

---

## 7. 보안 고려사항

### V1 (DirectWalletExecutor)
- 우리는 **사용자 개인키를 절대 보유하지 않음**
- 모든 서명은 사용자 브라우저 + 지갑 확장 프로그램에서
- 사용자 자금에 접근 권한 없음
- 보안 감사 표면적 작음 (서버는 분석 데이터 제공만)

### V2 (AgentWalletExecutor)
- Agent 키는 **사용자 메인 자금에 접근 못 하는 별도 키**
- Hyperliquid의 위임 메커니즘이 권한 범위를 제한 (선물 거래만)
- 우리 서버는 Agent 키를 **암호화하여 KMS/Vault에 저장**
- 사용자는 언제든 Hyperliquid에서 위임 취소 가능
- 키 유출 시 영향: 사용자가 Agent 잔고에 둔 금액에 한정 (메인 자금은 안전)
- V2 출시 전 외부 보안 감사 필수

---

## 8. 마이그레이션 전략 (V1 → V2)

V2 출시 시 사용자별 마이그레이션 흐름:

```
[V1 사용자] → /settings/automation 접속
            → "Enable automated trading" 토글
            → 안내: "별도 Agent Wallet 생성 + 권한 설정"
            → Hyperliquid 위임 트랜잭션 (사용자 메인 지갑으로 1회 서명)
            → users.agent_wallet_address 업데이트
            → 룰 별 "auto-execute" 토글 활성화 가능
            → 이제부터 룰 발동 시 자동 실행
```

기존 V1 룰들은 그대로 동작. 사용자는 룰별로 자동/수동 선택 가능.

---

## 9. 결론 및 다음 단계

이 청사진은 W3-W4(M1)에 다음 형태로 코드에 들어간다:

1. `lib/execution/order-executor.ts` — 인터페이스 + 타입 정의 (코드 ~200줄)
2. `lib/execution/direct-wallet-executor.ts` — V1 구현 스켈레톤 (M3 본격 작성)
3. `lib/execution/agent-wallet-executor.ts` — V2 placeholder (NotImplementedError throws)

**즉시 작성하지 않는 이유**: M2 룰 엔진이 먼저 와야 OrderExecutor 인터페이스를 사용할 클라이언트가 생긴다. M1엔 인터페이스 정의만, M2엔 mock executor, M3엔 실제 DirectWalletExecutor.

**핵심 원칙**: V1 코드 어디서도 `agent_wallet`이라는 단어를 검색해서 if-else로 분기하지 않는다. 오직 `kind` 필드를 통한 폴리모피즘으로만.
