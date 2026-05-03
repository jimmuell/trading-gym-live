# Net P\&L Tracker — Build Plan v2 for TradingGYM Live

**Owner:** Jim Mueller **Repo:** `jimmuell/trading-gym-live` (`~/Projects/trading-gym-live`) **Stack:** Electron 39 \+ React 19 \+ Vite 7 \+ TypeScript 5.9 \+ Tailwind 4 **Package manager:** pnpm **Build tool:** Claude Code **Data layer:** Supabase (shared with TradingGYM web app)

---

## 1\. Problem Statement

TradingView shows gross P\&L — ticks × $1.25 per tick for MES. It does not account for commissions, exchange fees, or data fees. This creates a dangerous gap between what a trader *thinks* they made and what actually hits their account.

**Real example from Jim's AMP Futures statement:**

| What TradingView showed | What AMP deposited |
| :---- | :---- |
| \+$430.00 gross | \+$39.45 net |

The gap: **$390.55** consumed by 70 round trips × $1.24/trade commission \+ $45/day CQG data fee.

This is the silent account killer. The Net P\&L Tracker makes this visible *during* the session, not the morning after.

---

## 2\. Architecture Decision: Unified Companion

### What exists today (three overlapping UIs):

| Feature | Web App FAB Drawer | Web Companion Popup | Electron App |
| :---- | :---- | :---- | :---- |
| Pre-trade checklist | ✅ | ✅ (duplicate) | Placeholder |
| Trade logging | ❌ | ✅ | Not built |
| Net P\&L | ❌ | ❌ | Not built |
| Always-on-top | ❌ | ❌ | ✅ |
| Data storage | Supabase | Supabase | None yet |

### What we're building (single companion):

The Electron app becomes the **sole trading companion**. The web companion popup (`/companion`) gets removed from the Lovable app. All trade-time features live in the Electron app, writing to the same Supabase database the web app uses.

**User flow:**

1. User opens TradingGYM web app → Dashboard, learning, strategies, analytics  
2. Ready to trade → clicks **"Launch Session"** on Dashboard  
3. TradingGYM Live (Electron) opens → user switches to trading desktop  
4. Electron panel floats beside TradingView with Checklist \+ Net P\&L tabs  
5. All data persists to Supabase → visible in web app's Analytics page

**No duplicate floating buttons.** The web app's checklist FAB drawer stays for setup/review. The Electron floating button is the only companion toggle during active trading.

---

## 3\. Cost Model (from Jim's trading\_cost\_calculator)

These are the default values. All are user-configurable in Settings.

| Parameter | Default | Source |
| :---- | :---- | :---- |
| Monthly data fee (CQG) | $45.00 | AMP statement |
| Trading days per month | 20 | Standard |
| Daily data cost | $2.25 | $45 ÷ 20 |
| Commission per round trip | $1.24 | AMP/Rithmic rate |
| Data cost per trade | $0.03 | $2.25 ÷ \~70 trades |
| Total cost per trade (1 ct) | $1.27 | Commission \+ data amortization |
| MES tick value | $1.25 | CME spec |
| Break-even ticks (1 ct) | 1.02 | $1.27 ÷ $1.25 |

**Scaling:** Cost per trade × contracts. 2 contracts \= $2.54/trade, 3 \= $3.82.

---

## 4\. Existing Electron App Architecture

Phase A is complete. Key files:

\~/Projects/trading-gym-live/

├── src/

│   ├── main/index.ts          ← Electron main process (BrowserWindow, tray, IPC)

│   ├── preload/index.ts       ← IPC bridge (window.api)

│   └── renderer/src/

│       ├── App.tsx             ← Root: Tab type \= 'checklist' | 'screenshot' | 'settings'

│       ├── components/

│       │   ├── PanelContent.tsx ← Panel shell: Header \+ Sidebar \+ tab content

│       │   ├── Sidebar.tsx      ← Tab icons (Checklist, Screenshot → top; Settings → bottom)

│       │   ├── Header.tsx       ← Title bar with close button

│       │   ├── ChecklistPanel.tsx ← Placeholder — "Checklist coming soon"

│       │   ├── ScreenshotPanel.tsx ← Placeholder

│       │   ├── SettingsPanel.tsx   ← Placeholder

│       │   └── FloatingButton.tsx  ← Floating TG button, toggles panel

**Panel behavior:** Floating button at bottom of screen → click expands panel upward → Sidebar on left with icon tabs → main content area on right. Frameless window, tray icon, Cmd+Shift+Space global hotkey. The floating button stays — it's the only companion toggle (no web companion to conflict with anymore).

---

## 5\. Existing Lovable Web App Code (to be removed later)

These files in `jimmuell/tradinggym` will be removed via a Lovable prompt AFTER the Electron replacement is functional:

| File | Purpose | Removal notes |
| :---- | :---- | :---- |
| `src/pages/CompanionPage.tsx` | Web companion popup page | Delete entirely |
| `src/layouts/CompanionLayout.tsx` | Stripped-down companion layout | Delete entirely |
| `src/lib/companion.ts` | `launchCompanionWindow()` popup opener | Delete entirely |
| `src/App.tsx` | `/companion` route entry | Remove the route |
| `src/components/dashboard/LaunchSessionCard.tsx` | Dashboard launch button | Rewire to `tradinggym://launch` protocol |
| `src/hooks/useLogTrade.ts` | Trade logging hook | Keep — Analytics will use it |
| `src/hooks/useTodayLiveTrades.ts` | Today's trades query | Keep — Analytics will use it |

**Do NOT remove yet.** Remove only after Electron Checklist \+ Net P\&L tabs are working with Supabase.

---

## 6\. Supabase Integration

### 6.1 Auth

The Electron app needs to authenticate with Supabase using the same user session as the web app. Approach:

- On first launch, show a login screen (email/password) or a "Connect to TradingGYM" flow  
- Store the Supabase session token securely via Electron's `safeStorage` API  
- Auto-refresh the token on app start  
- If token expires, prompt re-login

Dependencies: `@supabase/supabase-js`

### 6.2 Existing Tables to Use

**`checklist_sessions`** — already used by the web app's checklist. The Electron Checklist tab reads/writes here.

**`live_trades`** — already used by the web companion's trade logger. Schema (from `useLogTrade`):

{

  id: string               // UUID

  user\_id: string           // FK → auth.users

  direction: 'long' | 'short'

  entry\_price: number

  stop\_loss: number

  take\_profit: number

  result: 'win' | 'loss' | 'breakeven' | null

  checklist\_session\_id: string | null  // FK → checklist\_sessions

  opened\_at: string         // timestamp

}

### 6.3 New Table: `trading_sessions`

For Net P\&L session tracking. Needs a Supabase migration (can be run via Lovable SQL editor or direct):

CREATE TABLE trading\_sessions (

  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  user\_id UUID NOT NULL REFERENCES auth.users(id),

  date DATE NOT NULL DEFAULT CURRENT\_DATE,

  started\_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  ended\_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),

  

  \-- Cost model snapshot for this session

  cost\_per\_trade NUMERIC(8,4) NOT NULL DEFAULT 1.27,

  daily\_data\_fee NUMERIC(8,4) NOT NULL DEFAULT 2.25,

  tick\_value NUMERIC(8,4) NOT NULL DEFAULT 1.25,

  

  \-- Risk parameters

  max\_daily\_loss NUMERIC(10,2),

  planned\_trades INTEGER,

  max\_consecutive\_losses INTEGER,

  max\_contracts INTEGER DEFAULT 1,

  

  created\_at TIMESTAMPTZ DEFAULT now()

);

ALTER TABLE trading\_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions" ON trading\_sessions

  FOR ALL USING (auth.uid() \= user\_id)

  WITH CHECK (auth.uid() \= user\_id);

### 6.4 Extend `live_trades` Table

Add columns for Net P\&L tracking:

ALTER TABLE live\_trades

  ADD COLUMN IF NOT EXISTS trading\_session\_id UUID REFERENCES trading\_sessions(id),

  ADD COLUMN IF NOT EXISTS contracts INTEGER DEFAULT 1,

  ADD COLUMN IF NOT EXISTS gross\_pnl NUMERIC(10,2),

  ADD COLUMN IF NOT EXISTS commission NUMERIC(10,4),

  ADD COLUMN IF NOT EXISTS net\_pnl NUMERIC(10,2),

  ADD COLUMN IF NOT EXISTS ticks NUMERIC(10,2),

  ADD COLUMN IF NOT EXISTS strategy TEXT,

  ADD COLUMN IF NOT EXISTS notes TEXT;

### 6.5 New Table: `cost_settings`

User's persistent cost model configuration:

CREATE TABLE cost\_settings (

  user\_id UUID PRIMARY KEY REFERENCES auth.users(id),

  monthly\_data\_fee NUMERIC(8,2) NOT NULL DEFAULT 45.00,

  trading\_days\_per\_month INTEGER NOT NULL DEFAULT 20,

  commission\_per\_trade NUMERIC(8,4) NOT NULL DEFAULT 1.24,

  tick\_value NUMERIC(8,4) NOT NULL DEFAULT 1.25,

  default\_contracts INTEGER NOT NULL DEFAULT 1,

  updated\_at TIMESTAMPTZ DEFAULT now()

);

ALTER TABLE cost\_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings" ON cost\_settings

  FOR ALL USING (auth.uid() \= user\_id)

  WITH CHECK (auth.uid() \= user\_id);

---

## 7\. Feature Spec

### Phase B1 — Net P\&L Tab \+ Supabase Checklist

#### 7.1 Checklist Tab (upgrade from placeholder)

Replace the "Checklist coming soon" placeholder with a real checklist that reads/writes `checklist_sessions` from Supabase. Mirror the same checklist items from the web app. This tab is the trader's pre-session ritual.

#### 7.2 Session Header

At the top of the Net P\&L tab:

- **Session status indicator** — green dot (active), yellow (paused), gray (ended)  
- **Start Session / End Session button** — creates/closes a `trading_sessions` row  
- **Session timer** — elapsed time since session start  
- **Date** — today's date

#### 7.3 The "True P\&L" Display (hero section)

Large, color-coded, impossible to ignore:

What TradingView shows:    \+$430.00

────────────────────────────────────

Commissions:                \-$86.80

Data fee:                    \-$2.25

────────────────────────────────────

Your actual net:            \+$340.95    ← BIG, colored green/red

Fee drag:                    20.7%

Color rules:

- Net P\&L positive → green  
- Net P\&L negative → red  
- Fee drag \> 30% → amber warning  
- Fee drag \> 60% → red warning

#### 7.4 Quick Trade Entry

Minimal-friction form. Fields:

- **Gross P\&L** (dollars) — required, number input with \+/- toggle  
- **Contracts** — defaults to session's maxContracts  
- **Direction** — Long / Short toggle  
- **Strategy** — optional dropdown  
- **\[Log Trade\]** button

Writes to `live_trades` with the new columns (`gross_pnl`, `commission`, `net_pnl`, `trading_session_id`). Commission calculated automatically from cost model.

#### 7.5 Trade Log

Scrollable list below entry form. Each row:

- Time, direction icon, contracts, gross → net, running total  
- Color-coded: green winners, red losers  
- Click to delete (with undo toast)

#### 7.6 Alert System

Escalating alerts as banners at the top of the tab:

**Trade volume (based on plannedTrades):**

- 80%: 🟡 "8 of 10 planned trades used"  
- 100%: 🟠 "Plan complete — additional trades are unplanned"  
- 150%: 🔴 "Significant overtrading"

**Loss (based on maxDailyLoss):**

- 50%: 🟡 "50% of daily limit"  
- 75%: 🟠 "Approaching daily loss limit"  
- 100%: 🔴 "DAILY LOSS LIMIT REACHED" with \[End Session\] and \[Override\] buttons

**Consecutive losses (based on maxConsecutiveLosses):**

- Threshold \- 1: 🟡 warning  
- At threshold: 🔴 mandatory pause recommended

**Fee drag (universal):**

- \> 30%: 🟡  
- \> 50%: 🟠  
- \> 75%: 🔴

#### 7.7 Session Summary

On \[End Session\], show a summary card:

- Gross P\&L vs Net P\&L (the gap highlighted)  
- Trade count (planned vs actual)  
- Fee drag %, win rate  
- Largest winner / loser  
- Plan adherence score

Summary is written to Supabase so the web Analytics page can display it.

### Phase B1.5 — Auto Trade Capture (SHIPPED 2026-05-03)

Added in parallel with B1's manual entry, not a replacement. Eliminates
the gap between firing a strategy in TradingView and remembering to
type the result into `QuickTradeEntry`.

#### Architecture

```
TradingView Pine Script alert
        │  (HTTPS POST, JSON body, shared-secret header)
        ▼
Supabase Edge Function: tv-webhook
        │  (validates secret, looks up active session,
        │   computes net P&L using session.cost_per_trade
        │   and session.tick_value, writes via service role)
        ▼
Supabase: live_trades (INSERT on entry, UPDATE on exit)
        │  (Realtime publication: supabase_realtime)
        ▼
Electron renderer: sessionStore live_trades channel
        │  (filter: trading_session_id=eq.<active_session.id>)
        ▼
Net P&L tab — auto-captured trades render with ⚡ badge,
              open trades show "open @ <entry_price>" until exit.
```

#### Edge Function

- **URL:** `https://iwvpbnhsabnioxrlddqx.supabase.co/functions/v1/tv-webhook`
- **Auth:** shared secret `tg-webhook-2026` (override via the
  `WEBHOOK_SECRET` env var on the function — set in the Supabase
  dashboard under Functions → tv-webhook → Secrets).
- **DB writes:** uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS).
- **Payload (entry):**
  ```json
  {"action":"entry","direction":"long","price":5730.00,
   "contracts":1,"strategy":"ORB","ticker":"MES1!"}
  ```
- **Payload (exit):**
  ```json
  {"action":"exit","direction":"long","price":5735.00,
   "contracts":1,"strategy":"ORB","ticker":"MES1!"}
  ```
- **Pine Script alert message template:**
  ```
  {"action":"{{strategy.order.action}}","direction":"{{strategy.order.comment}}",
   "price":{{strategy.order.price}},"contracts":{{strategy.position_size}},
   "strategy":"{{strategy.market_position}}","ticker":"{{ticker}}"}
  ```
- **Function source:** not in this repo; deployed via Supabase
  dashboard / CLI. See `docs/2026-05-03_session_changes.md` for
  RLS history.

#### Local fallback (Electron Express)

`src/main/webhookServer.ts` runs an Express server on
`127.0.0.1:3456` in the Electron main process with the same
`/webhook/health` and `/webhook/trade` routes. Useful for offline /
local Pine Script testing via TradingView Desktop with a webhook
forwarder.

**Caveat:** as shipped, the local server uses the anon key and the
production RLS policies block anon writes. To use the local server
for development you must either (a) load a service role key into
`MAIN_VITE_SUPABASE_*` (do not bundle into a release build), or
(b) temporarily re-add the anon `INSERT`/`UPDATE` policies on
`live_trades` and the `status='active'` anon `SELECT` on
`trading_sessions` (see the original migration file in git history).

#### Two-table split: `trades` vs `live_trades`

| Table         | Source                | Lifecycle              | Provides             |
|---------------|-----------------------|------------------------|----------------------|
| `trades`      | `QuickTradeEntry`     | Closed at insert       | `gross_pnl`, `net_pnl` (trader-supplied) |
| `live_trades` | `tv-webhook` / Express| Open → closed (UPDATE) | `entry_price`, `gross_pnl`/`net_pnl` (computed on exit) |

Both feed into the Net P&L tab via `sessionStore`:
- `refreshTrades` hydrates both arrays in parallel on session change.
- A Realtime channel subscribes to INSERT/UPDATE/DELETE on
  `live_trades` filtered by `trading_session_id`.
- `totals` excludes open `live_trades` (where `result` is null) so
  pending entries don't contribute to win/loss counts or running net.
- `TradeLog` merges and time-sorts both arrays, rendering open
  live trades as "open @ <entry_price>" with no running-total step.

#### Schema (`live_trades`)

```sql
create table public.live_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trading_session_id uuid not null
    references public.trading_sessions(id) on delete cascade,
  direction text not null check (direction in ('long','short')),
  entry_price numeric,
  contracts integer not null default 1,
  strategy text,
  commission numeric not null default 0,
  result text check (result in ('win','loss','breakeven')),
  gross_pnl numeric,
  net_pnl numeric,
  ticks numeric,
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter publication supabase_realtime add table public.live_trades;
```

RLS: authenticated `SELECT`/`DELETE` for the owning user. Inserts
and updates come from the Edge Function via service role and bypass
RLS. Full migration: `migrations/2026-05-03_live_trades.sql`.

#### What B1.5 does NOT change

- Original Phase B2 (Menu Bar Display) and Phase B3 (Risk DNA + Web
  App Integration) keep their numbering and remain unbuilt.
- `QuickTradeEntry` and the `trades` table are untouched. Manual
  logging continues to work alongside auto-captured trades.

### Phase B2 — Tray UX + Panel Layout (SHIPPED 2026-05-03)

**Note:** the original B2 ("Menu Bar Display") was deferred. What shipped under
the B2 banner is a set of UX fixes that became necessary once daily use of
the floating button surfaced edge cases. The Menu Bar Display spec is
preserved below as **Deferred — Menu Bar Display**; it's a candidate for a
later phase.

#### What shipped

- **Tray show/hide toggle** — new "Hide Floating Button" / "Show Floating
  Button" item in the tray context menu. Toggles `mainWindow.show()` /
  `hide()`. Visibility persisted in `state.json` alongside the anchor;
  survives quit/relaunch. If the panel is open when the user hides, it
  collapses to the button first so the next show doesn't pop a full-size
  panel onto the screen.
- **Smart panel expansion direction** — `togglePanel()` picks expansion
  direction based on available work-area room: prefers up + left, falls
  back to down / right when there isn't room. After choosing direction,
  a final clamp pins the expanded window inside `workArea` for cases
  where the button is mid-display and neither side has enough headroom
  for the full 690px panel height.
- **Floating button position preserved across expand/collapse** —
  module-level `collapsedAnchor` saves the bottom-right corner *before*
  expansion. On collapse the button restores from that anchor, so any
  clamping that happened during expansion can't desync the return
  position. Replaces the prior "compute anchor from current bounds"
  approach which drifted whenever macOS clamped the expanded window.
- **Floating button drag fix** — outer ring (`h-16 w-16` div in
  `FloatingButton.tsx`) gained explicit `WebkitAppRegion: 'drag'` +
  `cursor: 'grab'`. The inner button keeps `no-drag` so clicks still
  register. The dark ring is now a reliable drag handle.
- **Global hotkey changed `⌘⇧Space` → `⌃⇧G`** — the original conflicted
  with macOS Spotlight on this user's setup; `globalShortcut.register`
  silently failed. Tray menu accelerator label updated to match.
- **Tray single-click behavior removed** — the previous custom click
  handler tried to be smart (show button if hidden, toggle panel if
  visible). Removing it restores the standard macOS tray behavior:
  click opens the context menu, period. Less surprising, fewer code
  paths.

#### Deferred — Menu Bar Display

The original B2 spec below is **not built**. Listed here so the design
isn't lost; not on the immediate roadmap.

##### 7.8 Menu Bar Readout (deferred)

Persistent macOS menu bar display:

TG  \+$39  │  12 trades  │  🟢

Click → dropdown with summary \+ \[End Session\] \+ \[Open Panel\].

##### 7.9 Menu Bar ↔ Panel Sync (deferred)

Both share same session state from Supabase. Trade logged in panel → menu bar updates instantly.

### Phase B3 — Risk DNA \+ Web App Integration  *(NEXT)*

#### 7.10 Settings Tab — Cost Model \+ Risk Limits

Reads/writes `cost_settings` table in Supabase.

#### 7.11 Checklist → Session Handoff

Starting a session from Checklist tab auto-populates Net P\&L risk parameters.

#### 7.12 Web App Analytics Integration

The TradingGYM web app's Analytics page reads `trading_sessions` \+ `live_trades` to show:

- Historical Net P\&L by day/week/month  
- Fee drag trends  
- Plan adherence over time  
- "You exceeded your daily loss limit 6 of 20 days this month"

#### 7.13 Web App Companion Removal (Lovable Prompt)

After Phase B1 is working:

- Remove `CompanionPage.tsx`, `CompanionLayout.tsx`, `companion.ts`  
- Remove `/companion` route from `App.tsx`  
- Rewire `LaunchSessionCard` to use `tradinggym://launch` custom protocol  
- Keep `useLogTrade` and `useTodayLiveTrades` hooks (Analytics uses them)

---

## 8\. Build Sequence

### Phase B1 — Net P\&L Tab \+ Supabase Checklist (start here)

1. Add Supabase client (`@supabase/supabase-js`) \+ auth flow (login screen, token storage via `safeStorage`)  
2. Replace `ChecklistPanel.tsx` placeholder with real Supabase-connected checklist  
3. Add `'netpnl'` to `Tab` union type, add DollarSign icon to `Sidebar.tsx`  
4. Create `NetPnlPanel.tsx` — the full tab component  
5. Create `src/renderer/src/lib/supabase.ts` — Supabase client singleton  
6. Create `src/renderer/src/lib/costModel.ts` — cost calculations \+ alert thresholds  
7. Create `src/renderer/src/stores/sessionStore.ts` — session \+ trade state (React context or zustand, backed by Supabase)  
8. Build sub-components:  
   - `netpnl/SessionHeader.tsx`  
   - `netpnl/TruePnlDisplay.tsx`  
   - `netpnl/QuickTradeEntry.tsx`  
   - `netpnl/TradeLog.tsx`  
   - `netpnl/AlertBanner.tsx`  
   - `netpnl/SessionSummary.tsx`  
9. Wire `NetPnlPanel` in `PanelContent.tsx`  
10. Add cost settings UI to `SettingsPanel.tsx`  
11. Run Supabase migrations for `trading_sessions`, `live_trades` alterations, `cost_settings`

### Phase B2 — Menu Bar Display

1. Tray menu bar item via Electron `Tray` API  
2. Dynamic tray title from session metrics  
3. IPC: renderer → main for tray updates  
4. Tray click → dropdown

### Phase B3 — Risk DNA \+ Web Integration

1. Checklist → session handoff  
2. Analytics integration (Lovable prompt)  
3. Web companion removal (Lovable prompt)  
4. Custom protocol handler (`tradinggym://launch`)

---

## 9\. Technical Notes

### Supabase Config

// src/renderer/src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js'

const SUPABASE\_URL \= 'https://iwvpbnhsabnioxrlddqx.supabase.co'

const SUPABASE\_ANON\_KEY \= '...' // Same anon key as web app

export const supabase \= createClient(SUPABASE\_URL, SUPABASE\_ANON\_KEY)

Auth token stored via Electron `safeStorage` in main process, passed to renderer via IPC preload bridge.

### Dependencies to Add

pnpm add @supabase/supabase-js uuid

pnpm add \-D @types/uuid

### File Structure After Phase B1

src/renderer/src/

├── components/

│   ├── PanelContent.tsx        ← updated: adds netpnl tab

│   ├── Sidebar.tsx             ← updated: adds DollarSign icon

│   ├── ChecklistPanel.tsx      ← rewritten: real Supabase checklist

│   ├── auth/

│   │   └── LoginScreen.tsx     ← Supabase email/password login

│   ├── netpnl/

│   │   ├── NetPnlPanel.tsx

│   │   ├── SessionHeader.tsx

│   │   ├── TruePnlDisplay.tsx

│   │   ├── QuickTradeEntry.tsx

│   │   ├── TradeLog.tsx

│   │   ├── AlertBanner.tsx

│   │   └── SessionSummary.tsx

│   └── ... (existing components unchanged)

├── stores/

│   └── sessionStore.ts         ← Supabase-backed session \+ trade state

├── lib/

│   ├── supabase.ts             ← Supabase client \+ auth helpers

│   └── costModel.ts            ← cost calculations \+ alert thresholds

### IPC Channels to Add

interface NetPnlAPI {

  // Auth (main process handles secure token storage)

  getAuthToken: () \=\> Promise\<string | null\>

  saveAuthToken: (token: string) \=\> Promise\<void\>

  clearAuthToken: () \=\> Promise\<void\>

  // Menu bar updates

  updateMenuBar: (metrics: SessionMetrics) \=\> void

}

---

## 10\. Design Guidelines

- **Dark theme only** — matches existing app (bg-gray-900/90, text-zinc-100)  
- **Compact layout** — panel is \~320px content area  
- **Color language:** green \= profit, red \= loss, amber \= warning, blue \= info  
- **Alerts are non-blocking** — banners, not modals. Override button on loss limit is the only gate.  
- **Numbers are king** — large, monospace, color-coded  
- **Instant feedback** — logging a trade updates all metrics immediately (optimistic UI, Supabase write in background)

---

## 11\. What NOT to Build Yet

- No broker API integration (manual entry only for MVP)  
- No mobile companion  
- No chart overlay or TradingView plugin  
- No import from CSV/broker statements  
- No multi-account support  
- No web companion (being removed, not replaced)

---

## 12\. Supabase Migrations

Run these in the Lovable SQL editor or Supabase dashboard before starting the Electron build:

\-- Migration 1: trading\_sessions table

CREATE TABLE IF NOT EXISTS trading\_sessions (

  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),

  user\_id UUID NOT NULL REFERENCES auth.users(id),

  date DATE NOT NULL DEFAULT CURRENT\_DATE,

  started\_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  ended\_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),

  cost\_per\_trade NUMERIC(8,4) NOT NULL DEFAULT 1.27,

  daily\_data\_fee NUMERIC(8,4) NOT NULL DEFAULT 2.25,

  tick\_value NUMERIC(8,4) NOT NULL DEFAULT 1.25,

  max\_daily\_loss NUMERIC(10,2),

  planned\_trades INTEGER,

  max\_consecutive\_losses INTEGER,

  max\_contracts INTEGER DEFAULT 1,

  created\_at TIMESTAMPTZ DEFAULT now()

);

ALTER TABLE trading\_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions" ON trading\_sessions

  FOR ALL USING (auth.uid() \= user\_id)

  WITH CHECK (auth.uid() \= user\_id);

\-- Migration 2: extend live\_trades

ALTER TABLE live\_trades

  ADD COLUMN IF NOT EXISTS trading\_session\_id UUID REFERENCES trading\_sessions(id),

  ADD COLUMN IF NOT EXISTS contracts INTEGER DEFAULT 1,

  ADD COLUMN IF NOT EXISTS gross\_pnl NUMERIC(10,2),

  ADD COLUMN IF NOT EXISTS commission NUMERIC(10,4),

  ADD COLUMN IF NOT EXISTS net\_pnl NUMERIC(10,2),

  ADD COLUMN IF NOT EXISTS ticks NUMERIC(10,2),

  ADD COLUMN IF NOT EXISTS strategy TEXT,

  ADD COLUMN IF NOT EXISTS notes TEXT;

\-- Migration 3: cost\_settings table

CREATE TABLE IF NOT EXISTS cost\_settings (

  user\_id UUID PRIMARY KEY REFERENCES auth.users(id),

  monthly\_data\_fee NUMERIC(8,2) NOT NULL DEFAULT 45.00,

  trading\_days\_per\_month INTEGER NOT NULL DEFAULT 20,

  commission\_per\_trade NUMERIC(8,4) NOT NULL DEFAULT 1.24,

  tick\_value NUMERIC(8,4) NOT NULL DEFAULT 1.25,

  default\_contracts INTEGER NOT NULL DEFAULT 1,

  updated\_at TIMESTAMPTZ DEFAULT now()

);

ALTER TABLE cost\_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings" ON cost\_settings

  FOR ALL USING (auth.uid() \= user\_id)

  WITH CHECK (auth.uid() \= user\_id);

---

## 13\. Claude Code Session Kickoff

### First prompt:

Read this build plan: NetPnL\_Tracker\_Build\_Plan\_v2.md

We're building Phase B1 for TradingGYM Live — the Net P\&L tab

with Supabase integration.

Start with steps 1-3: add Supabase client \+ auth flow (login

screen with email/password, token persistence via safeStorage),

then replace the ChecklistPanel placeholder with a real

Supabase-connected checklist. Then add the netpnl tab to

the sidebar.

Repo: \~/Projects/trading-gym-live

Package manager: pnpm

Run: pnpm dev to test

Supabase URL: https://iwvpbnhsabnioxrlddqx.supabase.co

Anon key: (will provide)

### Workflow rules:

- Use `pnpm`, not npm  
- `pnpm dev` to launch for testing  
- Keep existing Phase A components (FloatingButton, Sidebar, Header) working  
- All new components in `src/renderer/src/components/netpnl/`  
- TypeScript strict mode — no `any`  
- Tailwind 4 for all styling  
- Supabase writes are optimistic — update UI immediately, sync in background  
- RLS policies use `auth.uid()` — verify WITH CHECK on every new policy

---

*TradingGYM — No Pain, No Gain* *Net P\&L Tracker Build Plan v2 — May 2, 2026* *Changes from v1: Supabase replaces electron-store, web companion removal planned, unified companion architecture*  
