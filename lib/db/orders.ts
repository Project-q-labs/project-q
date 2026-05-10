/**
 * Database access for the `orders` table.
 *
 * This is the audit trail of every order our system places on Hyperliquid.
 *
 * The `executor` field is critical — it records WHICH executor placed the
 * order (direct_wallet vs agent_wallet). This makes V1/V2 transparent at
 * the persistence layer.
 *
 * Lifecycle:
 *   pending  → user clicked "execute", awaiting wallet signature
 *   open     → submitted to Hyperliquid, waiting for fill
 *   filled   → completely filled
 *   cancelled → user or system cancelled
 *   rejected → Hyperliquid rejected (insufficient margin, etc.)
 *   failed   → exception during submit (network, signature, etc.)
 */
import { createServerClient } from "@/lib/supabase/server";
import type { OrderRow } from "./types";

const TABLE = "orders";

/**
 * Insert a new order row at the moment the user (or rule) initiates it.
 * Status starts at 'pending'. Returns the persisted row with generated id.
 */
export async function createOrder(params: {
  userId: string;
  ruleId?: string | null;
  executor: "direct_wallet" | "agent_wallet";
  coin: string;
  side: "long" | "short" | "close";
  hlClientId: string; // our client order id (UUID)
  sizeUsd?: number;
  sizeBase?: number;
  leverage?: number;
  px?: number; // limit price; null = market
}): Promise<OrderRow> {
  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .insert({
      user_id: params.userId,
      rule_id: params.ruleId ?? null,
      executor: params.executor,
      coin: params.coin,
      side: params.side,
      hl_client_id: params.hlClientId,
      size_usd: params.sizeUsd ?? null,
      size_base: params.sizeBase ?? null,
      leverage: params.leverage ?? null,
      px: params.px ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(`createOrder: ${error.message}`);
  return rowToOrder(data);
}

/** Mark an order as submitted to Hyperliquid (status='open'). */
export async function markSubmitted(
  orderId: string,
  hlOrderId: number,
  hlTxHash?: string
): Promise<void> {
  const client = createServerClient();
  const { error } = await client
    .from(TABLE)
    .update({
      status: "open",
      hl_order_id: hlOrderId,
      hl_tx_hash: hlTxHash ?? null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw new Error(`markSubmitted: ${error.message}`);
}

/** Mark an order as filled (fully or partially based on params). */
export async function markFilled(
  orderId: string,
  fill: {
    filledBase: number;
    filledUsd: number;
    avgFillPx: number;
    feePaid?: number;
    realizedPnl?: number;
    fullyFilled: boolean;
  }
): Promise<void> {
  const client = createServerClient();
  const update: Record<string, unknown> = {
    filled_base: fill.filledBase,
    filled_usd: fill.filledUsd,
    avg_fill_px: fill.avgFillPx,
    fee_paid: fill.feePaid ?? null,
    realized_pnl: fill.realizedPnl ?? null,
  };
  if (fill.fullyFilled) {
    update.status = "filled";
    update.filled_at = new Date().toISOString();
  }

  const { error } = await client.from(TABLE).update(update).eq("id", orderId);
  if (error) throw new Error(`markFilled: ${error.message}`);
}

/** Mark an order as cancelled. */
export async function markCancelled(orderId: string): Promise<void> {
  const client = createServerClient();
  const { error } = await client
    .from(TABLE)
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw new Error(`markCancelled: ${error.message}`);
}

/** Mark an order as rejected by Hyperliquid (e.g. insufficient margin). */
export async function markRejected(
  orderId: string,
  reason: string
): Promise<void> {
  const client = createServerClient();
  const { error } = await client
    .from(TABLE)
    .update({
      status: "rejected",
      error: reason,
    })
    .eq("id", orderId);
  if (error) throw new Error(`markRejected: ${error.message}`);
}

/** Mark an order as failed before it reached Hyperliquid. */
export async function markFailed(
  orderId: string,
  reason: string
): Promise<void> {
  const client = createServerClient();
  const { error } = await client
    .from(TABLE)
    .update({
      status: "failed",
      error: reason,
    })
    .eq("id", orderId);
  if (error) throw new Error(`markFailed: ${error.message}`);
}

/** Fetch a user's order history (most recent first). */
export async function listOrders(
  userId: string,
  limit = 50
): Promise<OrderRow[]> {
  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listOrders: ${error.message}`);
  return (data ?? []).map(rowToOrder);
}

/** Daily executed notional for a user — used for safety caps (M4). */
export async function getDailyNotional(userId: string): Promise<number> {
  const client = createServerClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from(TABLE)
    .select("filled_usd")
    .eq("user_id", userId)
    .gte("filled_at", since);
  if (error) throw new Error(`getDailyNotional: ${error.message}`);
  return (data ?? []).reduce<number>(
    (acc, row) => acc + ((row.filled_usd as number) ?? 0),
    0
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function rowToOrder(row: Record<string, unknown>): OrderRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    ruleId: row.rule_id as string | null,
    executor: row.executor as "direct_wallet" | "agent_wallet",
    coin: row.coin as string,
    side: row.side as "long" | "short" | "close",
    hlOrderId: (row.hl_order_id as number | null) ?? null,
    hlClientId: row.hl_client_id as string | null,
    hlTxHash: row.hl_tx_hash as string | null,
    sizeBase: (row.size_base as number | null) ?? null,
    sizeUsd: (row.size_usd as number | null) ?? null,
    leverage: (row.leverage as number | null) ?? null,
    px: (row.px as number | null) ?? null,
    status: row.status as OrderRow["status"],
    filledBase: (row.filled_base as number) ?? 0,
    filledUsd: (row.filled_usd as number) ?? 0,
    avgFillPx: (row.avg_fill_px as number | null) ?? null,
    feePaid: (row.fee_paid as number | null) ?? null,
    realizedPnl: (row.realized_pnl as number | null) ?? null,
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
    submittedAt: (row.submitted_at as string | null) ?? null,
    filledAt: (row.filled_at as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
  };
}
