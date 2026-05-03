# TradingGYM Live

The Electron desktop companion for TradingGYM — a floating, always-on-top
panel that sits beside your charts during a trading session.

**Repo:** [`jimmuell/trading-gym-live`](https://github.com/jimmuell/trading-gym-live)

## Features

- **Pre-trade checklist** — runs the same `checklist_sessions` /
  `checklist_templates` schema as the TradingGYM web app so prep state
  syncs across both surfaces.
- **Net P&L tracker** — real net P&L during the session, not the
  morning-after surprise. Surfaces the gap between TradingView's gross
  number and what actually deposits to your futures account
  (commissions, exchange fees, monthly data fee amortized per trade).
- **Auto trade capture** — a Supabase Edge Function (`tv-webhook`)
  receives TradingView Pine Script alerts and writes entries / exits
  straight into Supabase. The Electron renderer subscribes via
  Supabase Realtime and updates the Net P&L tab with zero manual
  input. A local Express server (`127.0.0.1:3456`) is wired up as a
  development fallback. See
  [docs/2026-05-03_session_changes.md](docs/2026-05-03_session_changes.md).
- **Cost model + risk limits** — per-user `cost_settings` row in
  Supabase. Configure monthly data fee, commission per trade, tick
  value, default contracts, max daily loss, planned trade count, max
  consecutive losses. Risk limits are snapshotted into the
  `trading_sessions` row at session start.
- **Floating button + tray** — the panel collapses to an 80×80
  always-on-top button anchored to a screen corner. Toggle with
  `Cmd/Ctrl+Shift+Space` or the system tray icon.

## Stack

| Layer            | Tech                                     |
|------------------|------------------------------------------|
| Desktop shell    | Electron 39                              |
| Bundler          | electron-vite 5                          |
| UI               | React 19, TypeScript 5.9                 |
| Styling          | Tailwind CSS 4                           |
| Build tool       | Vite 7                                   |
| Data layer       | Supabase (Postgres + Realtime + Auth)    |
| Webhook receiver | Supabase Edge Function (production), Express on `127.0.0.1:3456` (local dev) |
| Package manager  | pnpm                                     |

## Setup

```bash
pnpm install
cp .env.example .env.local
# fill in Supabase URL + anon key in .env.local
pnpm dev
```

`.env.local` needs four keys (renderer + main process; same project
for both):

```
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon key>"
MAIN_VITE_SUPABASE_URL="https://<project>.supabase.co"
MAIN_VITE_SUPABASE_PUBLISHABLE_KEY="<anon key>"
```

Apply database migrations from `migrations/` in the Supabase SQL
editor before first run. The most recent one
(`2026-05-03_live_trades.sql`) creates the `live_trades` table for
auto-captured trades.

## Scripts

| Command          | What it does                                |
|------------------|---------------------------------------------|
| `pnpm dev`       | Run Electron with the Vite dev server       |
| `pnpm typecheck` | TypeScript strict-mode check (node + web)   |
| `pnpm lint`      | ESLint with React + Prettier rules          |
| `pnpm format`    | Prettier write across the repo              |
| `pnpm build`     | Typecheck + electron-vite production build  |
| `pnpm build:mac` | Build a macOS distributable                 |

## Project layout

```
src/
├── main/
│   ├── index.ts          ← Electron main: BrowserWindow, tray, IPC, hotkey
│   ├── webhookServer.ts  ← Local Express webhook (dev fallback)
│   └── env.d.ts          ← MAIN_VITE_* env types
├── preload/
│   └── index.ts          ← Context-isolated bridge: window.api.*
└── renderer/src/
    ├── App.tsx
    ├── auth/             ← Supabase auth context, persisted via safeStorage
    ├── components/
    │   ├── ChecklistPanel.tsx
    │   ├── SettingsPanel.tsx
    │   ├── netpnl/       ← Net P&L tab (TradeLog, QuickTradeEntry, …)
    │   └── auth/LoginScreen.tsx
    ├── lib/
    │   ├── costModel.ts
    │   └── supabase.ts
    └── stores/
        └── sessionStore.tsx  ← Session, trades, live_trades, totals
```

## Documentation

- [`docs/NetPnL_Tracker_Build_Plan_v2.md`](docs/NetPnL_Tracker_Build_Plan_v2.md) — full feature spec and phase plan
- [`docs/2026-05-02_session_changes.md`](docs/2026-05-02_session_changes.md) — checklist schema match + settings UX polish
- [`docs/2026-05-03_session_changes.md`](docs/2026-05-03_session_changes.md) — Phase B1.5 auto trade capture

## License

Private — all rights reserved.
