/**
 * Database access for the `users` table.
 *
 * V1 (current): users are identified by their wallet address (lowercase).
 *   When they connect via SIWE (M3), we upsert their row here.
 *
 * V2: when a user opts in to Agent Wallet, we set `agent_wallet_address`.
 *
 * All functions here use the service-role Supabase client (server-side only).
 * Never invoke from the browser bundle.
 */
import { createServerClient } from "@/lib/supabase/server";
import type { UserRow } from "./types";

const TABLE = "users";

/**
 * Find a user by their wallet address. Returns null if not found.
 */
export async function getUserByWallet(
  walletAddress: string
): Promise<UserRow | null> {
  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getUserByWallet: ${error.message}`);
  return data ? rowToUser(data) : null;
}

/**
 * Get a user by their internal UUID.
 */
export async function getUserById(id: string): Promise<UserRow | null> {
  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getUserById: ${error.message}`);
  return data ? rowToUser(data) : null;
}

/**
 * Create a user from their wallet address — used when a wallet connects
 * for the first time.
 */
export async function createUser(walletAddress: string): Promise<UserRow> {
  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .insert({ wallet_address: walletAddress.toLowerCase() })
    .select("*")
    .single();

  if (error) throw new Error(`createUser: ${error.message}`);
  return rowToUser(data);
}

/**
 * Idempotent upsert — used at the start of every authenticated request.
 * Updates `last_seen_at` and inserts if missing.
 */
export async function touchUser(walletAddress: string): Promise<UserRow> {
  const existing = await getUserByWallet(walletAddress);
  if (existing) {
    const client = createServerClient();
    const { data, error } = await client
      .from(TABLE)
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`touchUser: ${error.message}`);
    return rowToUser(data);
  }
  return createUser(walletAddress);
}

/**
 * Update Telegram identifiers — set after the user runs /start in our bot.
 */
export async function setTelegramInfo(
  userId: string,
  telegramUsername: string,
  telegramChatId: string
): Promise<void> {
  const client = createServerClient();
  const { error } = await client
    .from(TABLE)
    .update({
      telegram_username: telegramUsername,
      telegram_chat_id: telegramChatId,
    })
    .eq("id", userId);
  if (error) throw new Error(`setTelegramInfo: ${error.message}`);
}

/**
 * V2 — Set the user's agent wallet address after they delegate.
 */
export async function setAgentWallet(
  userId: string,
  agentWalletAddress: string
): Promise<void> {
  const client = createServerClient();
  const { error } = await client
    .from(TABLE)
    .update({ agent_wallet_address: agentWalletAddress.toLowerCase() })
    .eq("id", userId);
  if (error) throw new Error(`setAgentWallet: ${error.message}`);
}

/** Soft delete — sets deleted_at, preserves audit log linkage. */
export async function softDeleteUser(userId: string): Promise<void> {
  const client = createServerClient();
  const { error } = await client
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(`softDeleteUser: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal — translate snake_case rows from Postgres to camelCase types
// ─────────────────────────────────────────────────────────────────────────────
function rowToUser(row: Record<string, unknown>): UserRow {
  return {
    id: row.id as string,
    walletAddress: row.wallet_address as string,
    telegramUsername: row.telegram_username as string | null,
    telegramChatId: row.telegram_chat_id as string | null,
    agentWalletAddress: row.agent_wallet_address as string | null,
    email: row.email as string | null,
    createdAt: row.created_at as string,
    lastSeenAt: row.last_seen_at as string,
    deletedAt: row.deleted_at as string | null,
  };
}
