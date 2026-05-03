-- live_trades: webhook-captured trades from TradingView Pine Script alerts
-- Separate from `trades` (manual gross-P&L logging via QuickTradeEntry).
-- Anon-key writes from the local webhook server require permissive INSERT/UPDATE policies
-- scoped by trading_session ownership. Reads remain locked to the owning user.

create table if not exists public.live_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trading_session_id uuid not null references public.trading_sessions(id) on delete cascade,
  direction text not null check (direction in ('long', 'short')),
  entry_price numeric,
  contracts integer not null default 1,
  strategy text,
  commission numeric not null default 0,
  result text check (result in ('win', 'loss', 'breakeven')),
  gross_pnl numeric,
  net_pnl numeric,
  ticks numeric,
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists live_trades_session_idx on public.live_trades (trading_session_id);
create index if not exists live_trades_user_idx on public.live_trades (user_id);
create index if not exists live_trades_open_idx
  on public.live_trades (trading_session_id, direction)
  where result is null;

alter table public.live_trades enable row level security;

drop policy if exists "live_trades select own" on public.live_trades;
create policy "live_trades select own"
  on public.live_trades
  for select
  using (auth.uid() = user_id);

drop policy if exists "live_trades delete own" on public.live_trades;
create policy "live_trades delete own"
  on public.live_trades
  for delete
  using (auth.uid() = user_id);

-- Webhook server runs locally and writes with the anon key.
-- These policies require the trade to reference an existing session owned by user_id.
drop policy if exists "live_trades anon insert via session" on public.live_trades;
create policy "live_trades anon insert via session"
  on public.live_trades
  for insert
  to anon
  with check (
    exists (
      select 1 from public.trading_sessions s
      where s.id = trading_session_id
        and s.user_id = live_trades.user_id
    )
  );

drop policy if exists "live_trades anon update via session" on public.live_trades;
create policy "live_trades anon update via session"
  on public.live_trades
  for update
  to anon
  using (
    exists (
      select 1 from public.trading_sessions s
      where s.id = trading_session_id
        and s.user_id = live_trades.user_id
    )
  )
  with check (
    exists (
      select 1 from public.trading_sessions s
      where s.id = trading_session_id
        and s.user_id = live_trades.user_id
    )
  );

-- Anon needs to look up the active session before inserting.
-- Restrict to active rows only to limit exposure.
drop policy if exists "trading_sessions anon select active" on public.trading_sessions;
create policy "trading_sessions anon select active"
  on public.trading_sessions
  for select
  to anon
  using (status = 'active');

-- Realtime publication so the renderer subscription receives INSERT/UPDATE events.
alter publication supabase_realtime add table public.live_trades;
