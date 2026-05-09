-- ==========================================================================
-- Project Q — Initial Database Schema (v0)
-- ==========================================================================
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/mmsbouokrtgeqkcyexud/sql/new
--
-- This sets up the tables that M2 (rules engine) and M3 (order execution)
-- will populate. In M0/M1, only `rules_examples` is referenced (read-only).
--
-- Designed for the non-custodial wallet paradigm:
--   - Users are identified by their wallet address (Hyperliquid main wallet)
--   - No email/password auth at this stage; SIWE comes in M3 (Sign-In with Ethereum)
--   - Future Agent Wallet support — `users` table includes optional fields
--     for delegated key references; populated only when user opts in (V2)
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- Users (populated from M3 onwards via SIWE)
-- ---------------------------------------------------------------------------
-- A user is identified by their primary Hyperliquid wallet address.
-- When they connect via SIWE, we record them here.
--
-- Future (V2): if they opt in to Agent Wallet, we record the agent's
-- public address (NOT the private key — that lives in user-controlled
-- delegation flow on Hyperliquid).
CREATE TABLE IF NOT EXISTS users (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Primary wallet address (lowercase, 0x...)
    wallet_address  text NOT NULL UNIQUE,

    -- Optional: Telegram username for alerts (e.g., "@alice")
    telegram_username   text,
    -- Telegram chat_id used to send messages — populated after /start to bot
    telegram_chat_id    text,

    -- Optional Agent Wallet delegate address (V2)
    -- NULL until user opts in to automated execution
    agent_wallet_address text,

    -- Email for passive notifications (optional)
    email           text,

    -- Lifecycle
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,

    -- Indexes
    CHECK (wallet_address = lower(wallet_address))
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);


-- ---------------------------------------------------------------------------
-- Rules (M2 — user-defined trigger rules)
-- ---------------------------------------------------------------------------
-- A rule is a structured trigger spec + action.
-- Stored as JSONB for flexibility — schema enforced in application code.
--
-- Example payload (matches lib/rules/examples.ts shape):
--   {
--     "category": "Funding",
--     "combinator": "AND",
--     "conditions": [
--       { "kind": "fundingAprAbove", "symbol": "BTC", "thresholdPct": 25 }
--     ],
--     "action": {
--       "side": "short",
--       "executor": "direct_wallet",  -- direct_wallet | agent_wallet (V2)
--       "sizeUsd": 100,                -- alpha cap
--       "sizePctPortfolio": null,
--       "leverage": 5,
--       "tpPct": 3,                    -- take profit
--       "slPct": 2                     -- stop loss
--     }
--   }
CREATE TABLE IF NOT EXISTS rules (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- User-friendly label
    name            text NOT NULL,

    -- Structured rule definition
    spec            jsonb NOT NULL,

    -- Lifecycle
    is_active       boolean NOT NULL DEFAULT false,    -- alerts only when true
    is_executable   boolean NOT NULL DEFAULT false,    -- M3+: orders fire on trigger
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,

    -- Last evaluation
    last_evaluated_at   timestamptz,
    last_triggered_at   timestamptz,
    trigger_count       integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rules_user      ON rules(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rules_active    ON rules(is_active) WHERE is_active = true AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- Rule evaluations (M2 — every time a rule runs, record outcome)
-- ---------------------------------------------------------------------------
-- Used for debugging, history, and "rule performance" UI later.
CREATE TABLE IF NOT EXISTS rule_evaluations (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id         uuid NOT NULL REFERENCES rules(id) ON DELETE CASCADE,

    triggered       boolean NOT NULL,
    snapshot        jsonb,                  -- market state at evaluation time
    notification_sent boolean NOT NULL DEFAULT false,
    order_placed    boolean NOT NULL DEFAULT false,
    order_id        text,                   -- Hyperliquid order id, if any

    evaluated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evals_rule ON rule_evaluations(rule_id, evaluated_at DESC);


-- ---------------------------------------------------------------------------
-- Notifications outbox (M2 — alerts to send via Telegram / email)
-- ---------------------------------------------------------------------------
-- Worker reads pending notifications, sends them, marks sent_at.
CREATE TABLE IF NOT EXISTS notifications (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_id         uuid REFERENCES rules(id) ON DELETE SET NULL,

    channel         text NOT NULL CHECK (channel IN ('telegram','email')),
    payload         jsonb NOT NULL,         -- channel-specific payload

    created_at      timestamptz NOT NULL DEFAULT now(),
    sent_at         timestamptz,
    error           text,
    attempts        integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notifications_unsent ON notifications(created_at) WHERE sent_at IS NULL;


-- ---------------------------------------------------------------------------
-- Orders (M3 — executed orders via Hyperliquid)
-- ---------------------------------------------------------------------------
-- Records every order our system places on Hyperliquid (via direct wallet
-- in V1, optionally via agent wallet in V2).
CREATE TABLE IF NOT EXISTS orders (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_id         uuid REFERENCES rules(id) ON DELETE SET NULL,

    -- Execution mode (the abstraction that lets us add Agent Wallet later)
    executor        text NOT NULL CHECK (executor IN ('direct_wallet','agent_wallet')),

    -- Hyperliquid identifiers
    coin            text NOT NULL,          -- e.g. "BTC"
    side            text NOT NULL CHECK (side IN ('long','short','close')),
    hl_order_id     bigint,                 -- Hyperliquid oid
    hl_client_id    text,                   -- our cloid (UUID-ish)
    hl_tx_hash      text,

    -- Sizing / pricing
    size_base       numeric,                -- size in base asset
    size_usd        numeric,                -- size in USD (notional)
    leverage        integer,
    px              numeric,                -- limit price, NULL for market

    -- Lifecycle
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','open','filled','cancelled','rejected','failed')),
    filled_base     numeric NOT NULL DEFAULT 0,
    filled_usd      numeric NOT NULL DEFAULT 0,
    avg_fill_px     numeric,
    fee_paid        numeric,
    realized_pnl    numeric,

    error           text,

    created_at      timestamptz NOT NULL DEFAULT now(),
    submitted_at    timestamptz,
    filled_at       timestamptz,
    cancelled_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_orders_user      ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_hl        ON orders(hl_order_id);


-- ---------------------------------------------------------------------------
-- Audit log (security — every state-changing action gets recorded)
-- ---------------------------------------------------------------------------
-- M3+: append-only log of who did what, when.
CREATE TABLE IF NOT EXISTS audit_log (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,

    action          text NOT NULL,          -- e.g. "rule.create", "order.submit"
    target_id       uuid,                   -- the entity acted upon
    payload         jsonb,
    ip_address      inet,
    user_agent      text,

    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at DESC);


-- ---------------------------------------------------------------------------
-- Row-Level Security (RLS) — defense in depth
-- ---------------------------------------------------------------------------
-- Enable RLS on all user-data tables. Policies will be added in M3 when
-- SIWE auth is wired up. Until then, all access goes through the
-- service_role key (server-side only).
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_evaluations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

-- No public policies yet — only service_role can read/write.
-- M3 will add policies like:
--   CREATE POLICY "users can read own rules" ON rules FOR SELECT
--     USING (auth.jwt() ->> 'wallet_address' = (SELECT wallet_address FROM users WHERE id = user_id));


-- ---------------------------------------------------------------------------
-- Schema version tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    version         text PRIMARY KEY,
    applied_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version) VALUES ('0001_initial_schema')
ON CONFLICT (version) DO NOTHING;


-- ==========================================================================
-- End of migration 0001
-- ==========================================================================
