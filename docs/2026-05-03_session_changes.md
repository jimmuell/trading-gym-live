# Session Changes — 2026-05-03

Phase B1.5 — Auto Trade Capture. Pine Script alerts now write trade
entries and exits straight into Supabase, the Electron renderer picks
them up via Realtime, and the Net P&L tab updates with zero manual
input. The local Express server stays as a development fallback; the
production path is a Supabase Edge Function (`tv-webhook`).

## 1. Webhook auto-capture pipeline

### What shipped
- `src/main/webhookServer.ts` — Express on `127.0.0.1:3456` with
  `GET /webhook/health` and `POST /webhook/trade`. Local-only fallback
  for dev / when the user isn't running TradingView through the cloud.
- `src/main/index.ts` — starts the server on `whenReady`, stops on
  `will-quit`, exposes `webhook:get-status` IPC.
- `src/main/env.d.ts` — types for the new `MAIN_VITE_*` env vars.
- `src/preload/index.ts` — `window.api.webhook.getStatus()`.

### Edge Function (production path)
A Supabase Edge Function `tv-webhook` is deployed at:

```
https://iwvpbnhsabnioxrlddqx.supabase.co/functions/v1/tv-webhook
```

It accepts the same `{action, direction, price, contracts, strategy}`
payload as the Electron Express server, validates the shared secret
`tg-webhook-2026` (override via the `WEBHOOK_SECRET` env var on the
function), and writes to `live_trades` using the **service role key**
(bypassing RLS). TradingView alerts hit this URL — not the local
Express server — for any trader running the Electron app remotely or
without a tunnel.

### Realtime in the renderer
- `src/renderer/src/stores/sessionStore.tsx` — new `LiveTrade` type,
  `liveTrades` state, hydration via `refreshTrades`, and a per-session
  Supabase channel that handles INSERT/UPDATE/DELETE filtered by
  `trading_session_id=eq.<session.id>`. Closed live trades feed into
  `totals` alongside manual trades, sorted chronologically by
  `opened_at` so the consecutive-loss counter stays correct.
- `src/renderer/src/components/netpnl/TradeLog.tsx` — merges
  `trades` + `liveTrades` into one time-sorted list. Auto trades
  show a ⚡ badge; open trades (no exit yet) render as
  "open @ <entry_price>" with no running-total contribution.

## 2. Schema — `live_trades` created fresh

The build plan (§6.2) said `live_trades` "already used by the web
companion's trade logger" with columns
`{stop_loss, take_profit, checklist_session_id, …}`. **In this
project's Supabase, the table did not exist** — the web companion was
removed before that schema landed. So the migration creates the table
fresh with the columns this app needs:

```sql
id uuid pk, user_id uuid, trading_session_id uuid,
direction text, entry_price numeric, contracts int,
strategy text, commission numeric,
result text nullable, gross_pnl numeric nullable,
net_pnl numeric nullable, ticks numeric nullable,
opened_at timestamptz, created_at timestamptz
```

No collision with the web app — there's no `live_trades` to alter.

Migration: `migrations/2026-05-03_live_trades.sql`. Includes indexes,
RLS policies, and `ALTER PUBLICATION supabase_realtime ADD TABLE
live_trades` so the renderer subscription receives events.

## 3. Two-table split: `trades` vs `live_trades`

Phase B1 shipped `QuickTradeEntry` writing to a `trades` table (gross
P&L provided by the trader, immediately closed). The webhook needs an
entry/exit lifecycle (open trades exist before the exit lands), so it
writes to `live_trades` instead.

Both feed the Net P&L tab:

| Table         | Source              | Lifecycle              | Has entry_price | Has gross/net at insert |
|---------------|---------------------|------------------------|-----------------|-------------------------|
| `trades`      | `QuickTradeEntry`   | Closed at insert       | No              | Yes                     |
| `live_trades` | `tv-webhook` / Express | Open → closed (UPDATE) | Yes             | No, set on exit         |

`sessionStore.tsx` exposes both arrays. `TradeLog` merges and
time-sorts them; `totals` excludes any `live_trade` whose `result` is
still null (open trades don't contribute to win/loss counts or
running net). The ⚡ badge in the trade log is the only visual
distinction between sources.

## 4. RLS — anon path didn't work, Edge Function path does

### What was tried first
The original migration enabled RLS on `live_trades` and added two
permissive policies for the `anon` role:

```sql
create policy "live_trades anon insert via session" on live_trades
  for insert to anon
  with check (exists (select 1 from trading_sessions s
    where s.id = trading_session_id and s.user_id = live_trades.user_id));
create policy "live_trades anon update via session" on live_trades
  for update to anon ...;
-- plus an anon SELECT policy on trading_sessions filtered to status='active'
```

The intent: let the Electron Express server use the anon key without
auth context, gated by the FK. **It didn't work.** The Supabase JS
client's `createClient(url, anonKey)` without a session attached
behaves differently than expected against `for ... to anon` policies
in this project — inserts returned 401/403 even with the policies in
place.

### What works
The Edge Function route uses `SUPABASE_SERVICE_ROLE_KEY` (server-side
secret, never exposed to the client). Service role bypasses RLS
entirely, so the function can write any user's `live_trades` row as
long as the trading session lookup returns a match. The shared secret
on the inbound request prevents abuse.

### What changed in the migration
The anon `INSERT`/`UPDATE` policies on `live_trades` and the
`status='active'` anon SELECT on `trading_sessions` were **removed**.
RLS stays enabled with authenticated-only `SELECT` and `DELETE`
policies for the owning user. The Edge Function bypasses RLS via the
service role key.

The local Express server in `src/main/webhookServer.ts` will only
work if you (a) use a service role key in `MAIN_VITE_SUPABASE_*` —
not recommended for a client-distributed app — or (b) re-add the
anon policies for local development. As shipped, the local server
is wired up but its writes will fail against the locked-down RLS;
the Edge Function is the only working production path.

## 5. Phase numbering correction

The git commit `5899a86` was titled **"Phase B2: auto trade capture"**.
That's wrong — the build plan reserves B2 for the Menu Bar Display
feature. This work is **Phase B1.5 — Auto Trade Capture**, parallel
to B1's manual logging, not a replacement for B2.

The build plan (`docs/NetPnL_Tracker_Build_Plan_v2.md`) has been
amended with a Phase B1.5 (SHIPPED) section between Phase B1 and the
original Phase B2. Original B2 (Menu Bar) and B3 (Risk DNA + Web
App) keep their numbering and remain unbuilt.

## 6. Files touched

```
A  docs/2026-05-03_session_changes.md   (this file)
A  migrations/2026-05-03_live_trades.sql
A  src/main/env.d.ts
A  src/main/webhookServer.ts
M  .env.example
M  README.md
M  docs/NetPnL_Tracker_Build_Plan_v2.md  (Phase B1.5 addendum)
M  package.json                          (express + @types/express)
M  pnpm-lock.yaml
M  src/main/index.ts                     (start/stop server, IPC)
M  src/preload/index.ts                  (window.api.webhook)
M  src/renderer/src/components/netpnl/TradeLog.tsx
M  src/renderer/src/stores/sessionStore.tsx
```

Plus the Supabase Edge Function `tv-webhook` (deployed via the
Supabase dashboard / CLI; not in this repo).

## 7. Open follow-ups

- **Local Express server vs. Edge Function:** the Express server is
  shipped but RLS now blocks its writes. Either delete it, gate it
  behind a dev-only env flag, or run it with a service role key
  loaded from a separate `.env` (never bundled into the production
  build). Current state: dead code on the production path.
- **Menu Bar Display (Phase B2)** — still unbuilt; the build plan
  spec stands.
- **Risk DNA + Web App Integration (Phase B3)** — still unbuilt.
- **Edge Function source** — not in this repo. Should live in
  `supabase/functions/tv-webhook/` if the user adopts the Supabase
  CLI workflow, otherwise document the deployment process here.
