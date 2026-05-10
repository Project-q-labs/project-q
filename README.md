# Project Q

Trigger-based perpetual trading interface on Hyperliquid. Built for traders who think in conditions, not in clicks.

> **Status**: Pre-alpha (W2 of 12). Internal codename "Project Q". Not yet available to public.

## What's live today

Public site: <https://project-q-five.vercel.app>

| Page | Path | Status |
|---|---|---|
| Landing | `/` | ✅ |
| Markets list (230 pairs) | `/markets` | ✅ |
| Pair detail (chart + funding history) | `/markets/[symbol]` | ✅ |
| Rules preview (6 example rules, live evaluation) | `/rules` | ✅ |
| Watchlist (localStorage) | star toggle on any pair | ✅ |
| Visual rule builder | — | M2 (W5–W6) |
| Wallet connect + one-click execution | — | M3 (W7–W9) |
| Macro / wallet / on-chain indicators | — | M4 (W10–W11) |

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind
- **Database**: Supabase (Postgres) — schema v1 in `supabase/migrations/`
- **Cache/queue**: Upstash Redis (M1+)
- **Exchange**: Hyperliquid (perpetual DEX)
- **Hosting**: Vercel (frontend + API), Fly.io (WebSocket worker, M1+)
- **Notifications**: Telegram Bot API (M2+)
- **Monitoring**: Sentry (errors + performance)
- **Wallet**: RainbowKit / WalletConnect (M3+)

## Architecture principles

1. **API-first.** Every feature ships with a versioned REST endpoint at `/api/v1/`. The web UI is one client; external agents use the same surface.
2. **Non-custodial by default.** V1 uses the user's primary wallet — every order requires explicit signature. Agent Wallet (delegated keys) ships in V2.
3. **Executor-agnostic.** Order execution flows through an `OrderExecutor` interface so the rule engine doesn't know whether a wallet is direct or delegated. See `docs/agent-wallet-compatibility.md`.

## Folder structure

```
project-q/
├── app/                          # Next.js App Router
│   ├── api/v1/                  # Public REST API (versioned)
│   ├── markets/                 # Market list + detail pages
│   ├── rules/                   # Rule preview page
│   └── page.tsx                 # Landing
├── components/                   # React components
├── lib/
│   ├── db/                      # Database access (server-only)
│   ├── execution/               # OrderExecutor interface (M2+)
│   ├── hyperliquid/             # Hyperliquid REST + WS clients
│   ├── rules/                   # Rule types + evaluation
│   ├── supabase/                # Supabase client factories
│   └── watchlist/               # Watchlist hook (localStorage)
├── supabase/migrations/          # SQL migrations (run in Supabase SQL Editor)
├── workers/                      # Background workers — separate deployments
│   └── hl-ws/                   # Hyperliquid WebSocket worker (M1+)
└── docs/                         # Architecture decisions + planning
```

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Service health |
| GET | `/api/v1/markets` | All 230 Hyperliquid perp pairs |
| GET | `/api/v1/markets/[symbol]` | Single pair stats |
| GET | `/api/v1/markets/[symbol]/funding` | 7-day hourly funding history |
| GET | `/api/v1/prices` | Top 9 pairs ticker (5s cache) |

## Local development

```bash
npm install
cp .env.example .env.local
# fill in real values from Vercel
npm run dev
```

Open <http://localhost:3000>.

## Database setup

Run `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL Editor:
<https://supabase.com/dashboard/project/mmsbouokrtgeqkcyexud/sql/new>

Creates 6 tables: `users`, `rules`, `rule_evaluations`, `notifications`, `orders`, `audit_log`.

## Deployment

`main` branch → Vercel auto-deploy.

Environment variables: Vercel Dashboard → Project Settings → Environment Variables.
Required keys are listed in `.env.example`. All values are stored in Bitwarden (`Project-q` collection).

## License

Proprietary. Do not redistribute.
