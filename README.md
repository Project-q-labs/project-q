# Project Q

Trigger-based perpetual trading on Hyperliquid. Built for traders who think in conditions, not in clicks.

> Status: Pre-alpha. Internal codename "Project Q". Not yet available to public.

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Postgres + Auth)
- **Cache/Queue**: Upstash Redis
- **Exchange**: Hyperliquid (perpetual DEX)
- **Hosting**: Vercel
- **Notifications**: Telegram Bot API

## Architecture Principle

**API-First.** Every feature ships with a public REST endpoint and WebSocket subscription. The web UI is the first client, not the only one. External agents (AI agents, custom bots, third-party tools) will eventually use the same API surface.

## Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
# Then fill in real values in .env.local

# Start dev server
npm run dev
```

Open <http://localhost:3000> in your browser.

## Production Deployment

Pushes to `main` branch auto-deploy to Vercel.

Environment variables must be set in Vercel Dashboard → Project Settings → Environment Variables.

## Folder Structure

```
project-q/
├── app/                    # Next.js App Router
│   ├── api/v1/            # Public REST API (versioned)
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # Reusable React components
├── lib/                   # Shared utilities
│   ├── supabase/          # Supabase clients
│   └── hyperliquid/       # Hyperliquid SDK wrapper
└── public/                # Static assets
```

## API Endpoints (v0 — placeholders)

- `GET /api/v1/health` — Service health check
- `GET /api/v1/markets` — List supported trading pairs

## License

Proprietary. Do not redistribute.
