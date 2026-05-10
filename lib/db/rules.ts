/**
 * Database access for the `rules` table.
 *
 * Rules are user-defined trigger specifications. The `spec` column is JSONB
 * and matches the RuleSpec type. Validation is enforced in application code,
 * not at the DB level.
 *
 * Lifecycle states:
 *   - is_active=false → rule exists but doesn't evaluate
 *   - is_active=true, is_executable=false → evaluates + alerts only (M2)
 *   - is_active=true, is_executable=true → evaluates + alerts + auto-executes (M3+)
 */
import { createServerClient } from "@/lib/supabase/server";
import type { RuleRow, RuleSpec } from "./types";

const TABLE = "rules";

/** List all active rules for a user. */
export async function listRules(userId: string): Promise<RuleRow[]> {
  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listRules: ${error.message}`);
  return (data ?? []).map(rowToRule);
}

/** Fetch a single rule by id (with ownership check). */
export async function getRule(
  ruleId: string,
  userId: string
): Promise<RuleRow | null> {
  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("id", ruleId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getRule: ${error.message}`);
  return data ? rowToRule(data) : null;
}

/** Create a new rule. */
export async function createRule(params: {
  userId: string;
  name: string;
  spec: RuleSpec;
  isActive?: boolean;
  isExecutable?: boolean;
}): Promise<RuleRow> {
  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .insert({
      user_id: params.userId,
      name: params.name,
      spec: params.spec,
      is_active: params.isActive ?? false,
      is_executable: params.isExecutable ?? false,
    })
    .select("*")
    .single();

  if (error) throw new Error(`createRule: ${error.message}`);
  return rowToRule(data);
}

/** Update a rule's spec or lifecycle flags. */
export async function updateRule(
  ruleId: string,
  userId: string,
  patch: Partial<{
    name: string;
    spec: RuleSpec;
    isActive: boolean;
    isExecutable: boolean;
  }>
): Promise<RuleRow> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.spec !== undefined) update.spec = patch.spec;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.isExecutable !== undefined) update.is_executable = patch.isExecutable;

  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .update(update)
    .eq("id", ruleId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(`updateRule: ${error.message}`);
  return rowToRule(data);
}

/** Soft delete a rule. */
export async function deleteRule(ruleId: string, userId: string): Promise<void> {
  const client = createServerClient();
  const { error } = await client
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", ruleId)
    .eq("user_id", userId);
  if (error) throw new Error(`deleteRule: ${error.message}`);
}

/** Increment trigger counter and update timestamps after an evaluation fires. */
export async function recordTrigger(ruleId: string): Promise<void> {
  const client = createServerClient();
  const now = new Date().toISOString();
  // Postgres-side increment
  const { error } = await client.rpc("increment_rule_trigger", {
    rule_id: ruleId,
    now_ts: now,
  });
  // RPC may not exist yet — silent fallback to direct update
  if (error) {
    const { error: e2 } = await client
      .from(TABLE)
      .update({
        last_triggered_at: now,
        last_evaluated_at: now,
      })
      .eq("id", ruleId);
    if (e2) throw new Error(`recordTrigger: ${e2.message}`);
  }
}

/** Mark only that an evaluation happened (no trigger). */
export async function recordEvaluation(ruleId: string): Promise<void> {
  const client = createServerClient();
  const { error } = await client
    .from(TABLE)
    .update({ last_evaluated_at: new Date().toISOString() })
    .eq("id", ruleId);
  if (error) throw new Error(`recordEvaluation: ${error.message}`);
}

/** List all rules across all users that are currently active.
 *  Used by the rule engine worker (M2). */
export async function listAllActiveRules(): Promise<RuleRow[]> {
  const client = createServerClient();
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) throw new Error(`listAllActiveRules: ${error.message}`);
  return (data ?? []).map(rowToRule);
}

// ─────────────────────────────────────────────────────────────────────────────
function rowToRule(row: Record<string, unknown>): RuleRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    spec: row.spec as RuleSpec,
    isActive: row.is_active as boolean,
    isExecutable: row.is_executable as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: row.deleted_at as string | null,
    lastEvaluatedAt: row.last_evaluated_at as string | null,
    lastTriggeredAt: row.last_triggered_at as string | null,
    triggerCount: (row.trigger_count as number) ?? 0,
  };
}
