# M1 Detailed Plan — Project Q (W3-W4)

> **Status**: Plan written W2 Day 12 PM.
> **Re-review**: Day 14 (W2 retrospective).
> **Adjusts**: This plan is a forecast — daily checkpoints may shift it.

## What M1 is

M1 is the first milestone where Project Q stops being "scaffolding" and starts being **a thing trades-curious people would actually use**. The defining shift: by end of M1, a visitor lands on the site, sees real Hyperliquid data through our own pipeline (not iframes), and gets value from it without signing up.

This is the demo-able alpha foundation. M2 builds the rule engine on top; M3 wires execution. But M1 is when the product first feels real.

## Goals — by end of W4

A visitor arriving at https://project-q-five.vercel.app/markets/BTC will see:

1. **Self-hosted candle chart** with real Hyperliquid candles (not synthetic stub, not TradingView iframe)
2. **Multi-timeframe toggle** (1m / 5m / 15m / 1h / 4h / 1d)
3. **Live liquidation feed** below the chart — last 50 liquidations, real-time updates
4. **Funding APR comparison strip** — current funding for BTC vs ETH vs SOL vs HYPE side-by-side, ranked
5. **Volume profile** on the chart (24h volume by price level)
6. **OI delta indicator** — open interest 24h change, color-coded

Plus, behind the scenes:
- WebSocket worker deployed and running 24/7 (Railway, decided in W2)
- Liquidations stored in Supabase (queryable history)
- Historical funding cached for fast load
- Chart loads in under 1 second on mobile

## What M1 does NOT include

- Rule builder UI (M2 — W5-W6)
- Telegram alerts (M2)
- User accounts / wallet connect (M3)
- Order execution (M3)
- Backtesting (post-alpha)

The principle: M1 makes the **read** path excellent. M2 adds **rules**. M3 adds **write** (orders).

## Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Hyperliquid `candleSnapshot` returns slow / unreliable for some pairs | Med | High | Cache aggressively in Supabase; fall back to last cached candles on error |
| Liquidation feed too sparse (no Hyperliquid global feed) | High | Med | Aggregate from `userEvents` of top traders; or use 24h liquidation API summary as proxy |
| WebSocket dropouts cause visible chart gaps | Med | Med | Already-built reconnect (Day 9 AM) + buffered reconcile via REST snapshot |
| Mobile chart performance on lightweight-charts | Low | Med | Already chosen for 60fps; verified in W2 stub |
| Railway $5 credit insufficient for new workloads | Low | Low | Single small worker, monitor billing daily for first week |
| Visual polish slips, M1 looks rough | Med | High | Reserve Day 18 for design pass before W4 retrospective |

## Daily breakdown — W3 (Days 15-19)

### Day 15 (Mon) — Foundation: Real candles via REST

**Goal**: Replace synthetic stub data with actual Hyperliquid `candleSnapshot` REST calls.

**Morning** (3h):
- New endpoint: `app/api/v1/markets/[symbol]/candles/route.ts`
- Calls Hyperliquid `info` POST with `{type: "candleSnapshot", req: {coin, interval, startTime, endTime}}`
- Returns shape compatible with `CandleData` from W2
- Caching layer: 5s for live intervals (1m, 5m), 60s for hourly+, via Vercel edge cache headers

**Afternoon** (2h):
- `CandleChartPreview` → `CandleChart` swap on `/markets/[symbol]`
- Pass real `candles` prop fetched from new endpoint
- Remove `lib/rules/examples.ts` synthetic generator (production code only — keep for tests if useful)
- Verify: BTC chart shows real prices matching Hyperliquid app within 0.05%

**Verify**:
- Chart renders for BTC, ETH, SOL, HYPE, DOGE, XRP, AVAX, LINK, ARB
- 1h interval default, last 200 candles
- Loading state visible during fetch

### Day 16 (Tue) — Multi-timeframe toggle

**Goal**: Let user switch between 1m / 5m / 15m / 1h / 4h / 1d.

**Morning** (3h):
- New component: `<TimeframeSelector>` — segmented control, active state styled
- Lift candle data fetch to client component using SWR or simple useEffect
- URL state: `/markets/BTC?tf=1h` so it's bookmarkable

**Afternoon** (2h):
- Smart history windows per interval (e.g., 1m = last 4h, 1d = last 6 months)
- Loading skeleton while switching intervals
- Persist preference in localStorage

**Verify**:
- Switching is under 500ms (cache hit)
- Browser back/forward navigates timeframes
- Mobile tap targets ≥ 44px

### Day 17 (Wed) — Liquidations feed (read path)

**Goal**: A live-updating liquidation list visible on the pair page.

**Morning** (3h):
- DB table use: `liquidations` (already in schema 0001) — verify columns
- Worker addition: `workers/hl-ws/src/liquidations.ts` — subscribes to a chosen approach for liquidation data
- Decision needed at Day 17 start: do we use Hyperliquid's `notification` channel? `liquidations` if exists by then? Or build a synthetic liquidation feed by watching large position closes from the trades feed?
- Whichever path: insert into Supabase

**Afternoon** (2h):
- API: `app/api/v1/markets/[symbol]/liquidations/route.ts` — last 50, sorted by time desc
- Component: `<LiquidationFeed>` — real-time via SWR refresh interval (3s) or Supabase realtime subscription
- Style: red for longs liquidated, green for shorts; size formatted compact

**Verify**:
- New liquidations appear within 5s of detection
- Feed survives page reload (DB-backed)
- Filter to current pair only

### Day 18 (Thu) — Funding strip + Volume profile

**Goal**: Two new widgets that pack high-density info.

**Morning** (3h):
- `<FundingStrip>` — horizontal scroll on mobile, grid on desktop
- Shows BTC, ETH, SOL, HYPE, DOGE, XRP, AVAX, LINK, ARB, BNB
- For each: name, current funding APR, color (green positive, red negative)
- Sorted descending by APR
- Refresh every 30s

**Afternoon** (3h):
- `<VolumeProfile>` overlay on candle chart
- Aggregate: 24h volume bucketed by price
- Plot as horizontal histogram on right side of chart
- Use `lightweight-charts` histogram series, separate price scale
- Toggle on/off

**Verify**:
- Funding strip loads under 200ms (parallel calls cached)
- Volume profile doesn't break candle chart performance

### Day 19 (Fri) — OI indicator + W3 polish day

**Goal**: Add OI delta widget, fix all bugs from W3.

**Morning** (3h):
- `<OIDeltaIndicator>` — current OI, 24h change, percentage
- New API: `/api/v1/markets/[symbol]/oi-history` returning OI snapshot every hour for 24h
- Sparkline visualization
- Place in stat row alongside funding

**Afternoon** (3h):
- W3 retrospective: list bugs, polish issues, slow loads
- Fix all issues that block alpha showability
- Mobile QA pass — all pages work on iPhone SE width (375px)
- Push to staging, verify Vercel build clean

## Daily breakdown — W4 (Days 22-26)

### Day 22 (Mon) — Worker production deploy + persistence

**Goal**: Move worker from "lives on Claude's laptop" to 24/7 cloud.

**Morning** (3h):
- Railway account creation
- `railway.json` already from W2 prep (or write now)
- Connect GitHub, deploy `workers/hl-ws/`
- Environment vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- Verify connection from Railway → Supabase → write test row

**Afternoon** (2h):
- Add liquidation persistence (insert to DB on every captured event)
- Add reconnect log row (track stability metrics)
- Verify worker survives 4-hour idle period without interruption

**Verify**:
- Logs visible in Railway dashboard
- /healthz responds 200 from outside
- Sentry captures any worker errors (via DSN)

### Day 23 (Tue) — Hyperliquid Discord active monitoring

**Goal**: Stay connected to ecosystem signal.

**Morning** (1h):
- (Founder action) Join Hyperliquid Discord
- Identify 2-3 useful channels: developer, community, builder discussions
- Skim recent week of messages for relevant info (API changes, builder code updates)

**Afternoon** (4h):
- (Code) Add "Powered by Project Q" attribution where appropriate
- Polish landing page header — add "M1 / Live" badge with subtle pulse
- /markets list page: improve loading state, fix any visible jank
- Verify all pages render correctly with real data

### Day 24 (Wed) — Performance pass

**Goal**: Sub-second loads, no jank.

**Morning** (3h):
- Lighthouse pass on `/`, `/markets`, `/markets/BTC`
- Target: Performance > 90, FCP < 1s, LCP < 2.5s
- Address top 3 issues per page (likely: image optimization, font loading, JS bundle size)

**Afternoon** (3h):
- Bundle analysis: `npm run build` + analyze
- Lazy-load heavy components (CandleChart, FundingHistory)
- Verify mobile performance on real device (use throttled Chrome DevTools)

**Verify**:
- /markets/BTC loads under 1s on simulated 4G
- Chart interactions remain at 60fps

### Day 25 (Thu) — M1 polish + readiness check

**Goal**: M1 should look like a real product, not a prototype.

**Morning** (3h):
- Design pass: typography rhythm, spacing consistency, color contrast
- Empty states for every async fetch (loading, error, empty)
- Error boundary on every route

**Afternoon** (3h):
- Write `docs/m1-completion.md` — what works, what doesn't, demo screenshots
- Internal demo to self: walk through every page as a new visitor
- Note rough edges, file as M2 backlog

### Day 26 (Fri) — M1 retrospective + M2 planning

**Goal**: Close M1 with confidence; line up M2.

**Morning** (3h):
- M1 retrospective in `docs/m1-retro.md`:
  - What shipped vs planned
  - What slipped (rules engine? no, that was M2 — this is fine)
  - Performance metrics achieved
  - Hyperliquid API gotchas discovered
- Update README with M1 status

**Afternoon** (3h):
- M2 (W5-W6) detailed plan in `docs/m2-detailed-plan.md`
- M2 scope: rule builder UI, evaluation engine, alert system (Telegram)
- Daily breakdown for W5-W6
- Carry forward any M1 backlog

## Decisions deferred to M1 (need to make on these days)

| Decision | When | Why deferred |
|---|---|---|
| Liquidation data approach (notification channel vs synthetic) | Day 17 morning | Need to verify Hyperliquid's current API state then |
| Whether to add 4h interval | Day 16 | Maybe redundant with 1h+1d; user feedback |
| Volume profile aggregation method | Day 18 morning | Library quirks not yet known |
| Railway worker memory limit | Day 22 | Depends on observed RAM usage in PoC stage |
| When to remove TradingView iframe (Day 15 vs Day 19) | Day 15 | If self-chart not visually as good, keep iframe alongside until Day 19 polish |

## Definition of Done — M1

By W4 Friday EOD, all of these must be true:

- [ ] `/markets/BTC` shows self-hosted candle chart with real data
- [ ] Multi-timeframe toggle works (6 intervals)
- [ ] Liquidation feed visible and live-updating
- [ ] Funding strip with 10+ pairs ranked by APR
- [ ] Volume profile on chart (toggle-able)
- [ ] OI delta indicator on pair page
- [ ] Worker deployed to Railway, healthz returns 200
- [ ] Liquidations persisting to Supabase
- [ ] Sentry capturing worker errors
- [ ] Mobile-tested on actual phone (not just DevTools)
- [ ] All pages load under 2s on 4G
- [ ] No console errors in production browser
- [ ] M1 retro document written

## Carry from W2

These W2 deliverables feed directly into M1:

| W2 deliverable | M1 day used | How |
|---|---|---|
| Day 8 AM DB helpers | Day 17, 22 | `recordLiquidation`, queries for feed |
| Day 8 PM-9 AM WS worker | Day 22 | Deploy as-is, add liquidation handler |
| Day 9 PM CandleChart stub | Day 15 | Becomes production chart with real data |
| Day 10 AM OrderExecutor interfaces | (M3) | Sits idle until M3 |
| Day 10 PM Hyperliquid SDK memo | (M3) | Reference doc when M3 starts |
| Day 11 AM rule DB seed | (M2) | Foundation for rule listings |
| Day 11 PM Sentry verify | Day 22+ | Worker errors flow to Sentry |

Nothing from W2 is wasted. Everything plugs in.
