/**
 * Database row types — mirrors Supabase migration 0001.
 *
 * Each type matches a row in the corresponding table. We use camelCase
 * here even though Postgres uses snake_case; the helper functions
 * (lib/db/*.ts) handle the translation at the boundary.
 *
 * When the schema evolves (migration 0002+), update both the SQL file
 * and this file together.
 */

// ─────────────────────────────────────────────────────────────────────────────
// users
// ─────────────────────────────────────────────────────────────────────────────
export type UserRow = {
  id: string;
  walletAddress: string;
  telegramUsername: string | null;
  telegramChatId: string | null;
  agentWalletAddress: string | null;   // V2 — null until user opts in
  email: string | null;
  createdAt: string;                   // ISO timestamp
  lastSeenAt: string;
  deletedAt: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// rules
// ─────────────────────────────────────────────────────────────────────────────
export type RuleSpec = {
  category: "Funding" | "Order Flow" | "Macro" | "Risk";
  combinator: "AND" | "OR";
  conditions: Array<{
    kind: string;
    [key: string]: unknown;
  }>;
  action: {
    side: "long" | "short" | "alert" | "close";
    executor: "direct_wallet" | "agent_wallet";
    sizeUsd?: number;
    sizePctPortfolio?: number;
    leverage?: number;
    tpPct?: number;
    slPct?: number;
    description?: string;
  };
};

export type RuleRow = {
  id: string;
  userId: string;
  name: string;
  spec: RuleSpec;
  isActive: boolean;
  isExecutable: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  triggerCount: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// rule_evaluations
// ─────────────────────────────────────────────────────────────────────────────
export type RuleEvaluationRow = {
  id: string;
  ruleId: string;
  triggered: boolean;
  snapshot: Record<string, unknown> | null;
  notificationSent: boolean;
  orderPlaced: boolean;
  orderId: string | null;
  evaluatedAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// notifications
// ─────────────────────────────────────────────────────────────────────────────
export type NotificationRow = {
  id: string;
  userId: string;
  ruleId: string | null;
  channel: "telegram" | "email";
  payload: Record<string, unknown>;
  createdAt: string;
  sentAt: string | null;
  error: string | null;
  attempts: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// orders
// ─────────────────────────────────────────────────────────────────────────────
export type OrderRow = {
  id: string;
  userId: string;
  ruleId: string | null;
  executor: "direct_wallet" | "agent_wallet";

  coin: string;
  side: "long" | "short" | "close";
  hlOrderId: number | null;
  hlClientId: string | null;
  hlTxHash: string | null;

  sizeBase: number | null;
  sizeUsd: number | null;
  leverage: number | null;
  px: number | null;

  status:
    | "pending"
    | "open"
    | "filled"
    | "cancelled"
    | "rejected"
    | "failed";
  filledBase: number;
  filledUsd: number;
  avgFillPx: number | null;
  feePaid: number | null;
  realizedPnl: number | null;
  error: string | null;

  createdAt: string;
  submittedAt: string | null;
  filledAt: string | null;
  cancelledAt: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// audit_log
// ─────────────────────────────────────────────────────────────────────────────
export type AuditLogRow = {
  id: string;
  userId: string | null;
  action: string;
  targetId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};
