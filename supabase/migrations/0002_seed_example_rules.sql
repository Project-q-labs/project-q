-- ==========================================================================
-- Project Q — Migration 0002: Seed Example Rules as System Rules
-- ==========================================================================
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/mmsbouokrtgeqkcyexud/sql/new
--
-- Purpose:
--   Move the 6 hardcoded example rules from `lib/rules/examples.ts` into
--   the database. Establishes the "system rule" concept: rules owned by
--   Project Q itself (no user_id), shown to everyone on /rules, and
--   available as templates for users to fork in M2.
--
-- Schema change:
--   - Adds `is_system_rule boolean` column to `rules`
--   - Makes `user_id` nullable (system rules have no owner)
--   - CHECK: every row has either a user_id or is_system_rule=true
--
-- Idempotency:
--   - Uses ALTER TABLE IF NOT EXISTS pattern where possible
--   - Re-running this migration is safe: it deletes existing system rules
--     and re-inserts them, preserving all user-owned rules
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1. Schema evolution
-- ---------------------------------------------------------------------------

-- Make user_id nullable (system rules have no owner)
ALTER TABLE rules
  ALTER COLUMN user_id DROP NOT NULL;

-- Add is_system_rule column (defaults to false; only system seeds set true)
ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS is_system_rule boolean NOT NULL DEFAULT false;

-- Stable identifier for system rules (matches lib/rules/examples.ts ids)
-- Allows code to look them up by string instead of UUID.
ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS slug text;

-- Slug must be unique among system rules (NULL allowed for user rules)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_system_slug
  ON rules(slug) WHERE is_system_rule = true;

-- Integrity: every rule must have either an owner or be a system rule
ALTER TABLE rules
  DROP CONSTRAINT IF EXISTS rules_owner_or_system;
ALTER TABLE rules
  ADD CONSTRAINT rules_owner_or_system
  CHECK (user_id IS NOT NULL OR is_system_rule = true);

-- Index for fast "list all system rules" query
CREATE INDEX IF NOT EXISTS idx_rules_system
  ON rules(is_system_rule) WHERE is_system_rule = true AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 2. Seed: 6 example rules (mirrors lib/rules/examples.ts)
-- ---------------------------------------------------------------------------
-- The `spec` JSONB shape:
--   {
--     "category": "Funding" | "Order Flow" | "Macro" | "Risk",
--     "combinator": "AND" | "OR",
--     "conditions": [ { kind, symbol, threshold... } ],
--     "action": { side, description }
--   }
--
-- Strategy: DELETE existing system rules first, then INSERT.
-- This is safe because system rules have no foreign key dependents
-- (rule_evaluations cascades, orders won't reference system rules).
-- Re-running this migration replaces all system rules in place.
-- ---------------------------------------------------------------------------

DELETE FROM rules WHERE is_system_rule = true;

INSERT INTO rules (
    name, slug, spec, is_system_rule, is_active, is_executable, user_id
) VALUES
  (
    'BTC funding extreme — short',
    'btc-funding-extreme-short',
    '{
      "category": "Funding",
      "combinator": "AND",
      "conditions": [
        { "kind": "fundingAprAbove", "symbol": "BTC", "thresholdPct": 25 }
      ],
      "action": {
        "side": "short",
        "description": "Open BTC short with 5% portfolio (mean reversion)"
      }
    }'::jsonb,
    true, false, false, NULL
  ),
  (
    'ETH funding flip — long',
    'eth-funding-flip-long',
    '{
      "category": "Funding",
      "combinator": "AND",
      "conditions": [
        { "kind": "fundingBelow", "symbol": "ETH", "thresholdPct": 0 },
        { "kind": "change24hAbove", "symbol": "ETH", "thresholdPct": -2 }
      ],
      "action": {
        "side": "long",
        "description": "ETH long entry — negative funding + price holding"
      }
    }'::jsonb,
    true, false, false, NULL
  ),
  (
    'SOL momentum — long',
    'sol-momentum-long',
    '{
      "category": "Order Flow",
      "combinator": "AND",
      "conditions": [
        { "kind": "change24hAbove", "symbol": "SOL", "thresholdPct": 5 },
        { "kind": "fundingAprAbove", "symbol": "SOL", "thresholdPct": 5 }
      ],
      "action": {
        "side": "long",
        "description": "SOL momentum long with 3% portfolio"
      }
    }'::jsonb,
    true, false, false, NULL
  ),
  (
    'HYPE OI spike — alert',
    'hype-oi-spike-alert',
    '{
      "category": "Order Flow",
      "combinator": "AND",
      "conditions": [
        { "kind": "oiNotionalAbove", "symbol": "HYPE", "thresholdUsd": 800000000 }
      ],
      "action": {
        "side": "alert",
        "description": "Telegram alert: HYPE OI > $800M, watch for breakout"
      }
    }'::jsonb,
    true, false, false, NULL
  ),
  (
    'BTC deep correction — buy',
    'btc-deep-correction-buy',
    '{
      "category": "Risk",
      "combinator": "AND",
      "conditions": [
        { "kind": "change24hBelow", "symbol": "BTC", "thresholdPct": -5 },
        { "kind": "fundingBelow", "symbol": "BTC", "thresholdPct": 0 }
      ],
      "action": {
        "side": "long",
        "description": "BTC buy the dip — 24h drop + capitulation funding"
      }
    }'::jsonb,
    true, false, false, NULL
  ),
  (
    'DOGE extreme funding — fade',
    'doge-extreme-funding-fade',
    '{
      "category": "Funding",
      "combinator": "AND",
      "conditions": [
        { "kind": "fundingAprAbove", "symbol": "DOGE", "thresholdPct": 50 }
      ],
      "action": {
        "side": "short",
        "description": "Fade DOGE crowded longs — extreme funding short"
      }
    }'::jsonb,
    true, false, false, NULL
  );


-- ---------------------------------------------------------------------------
-- 3. Verify
-- ---------------------------------------------------------------------------
-- After running, check:
--   SELECT slug, name, spec->'category' AS category FROM rules WHERE is_system_rule = true;
-- Expected: 6 rows.
