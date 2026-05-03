import { ArrowDown, ArrowUp, X, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { useSession, type LiveTrade, type Trade } from '../../stores/sessionStore'

type Row = {
  id: string
  source: 'manual' | 'auto'
  direction: 'long' | 'short'
  contracts: number
  opened_at: string
  gross_pnl: number | null
  net_pnl: number | null
  open: boolean
  entry_price: number | null
}

function fmtAmount(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function manualToRow(t: Trade): Row {
  return {
    id: t.id,
    source: 'manual',
    direction: t.direction,
    contracts: Number(t.contracts),
    opened_at: t.opened_at,
    gross_pnl: Number(t.gross_pnl),
    net_pnl: Number(t.net_pnl),
    open: false,
    entry_price: null
  }
}

function liveToRow(t: LiveTrade): Row {
  const open = t.result === null
  return {
    id: t.id,
    source: 'auto',
    direction: t.direction,
    contracts: Number(t.contracts),
    opened_at: t.opened_at,
    gross_pnl: t.gross_pnl === null ? null : Number(t.gross_pnl),
    net_pnl: t.net_pnl === null ? null : Number(t.net_pnl),
    open,
    entry_price: t.entry_price === null ? null : Number(t.entry_price)
  }
}

export default function TradeLog(): React.JSX.Element {
  const { trades, liveTrades, deleteTrade } = useSession()

  const rows = useMemo<Row[]>(() => {
    const merged: Row[] = [
      ...trades.map(manualToRow),
      ...liveTrades.map(liveToRow)
    ]
    merged.sort((a, b) => a.opened_at.localeCompare(b.opened_at))
    return merged
  }, [trades, liveTrades])

  if (rows.length === 0) {
    return (
      <div className="flex-1 px-3 py-6 text-center text-[11px] text-zinc-500">
        No trades logged yet
      </div>
    )
  }

  let running = 0

  return (
    <ul className="flex-1 divide-y divide-white/5 overflow-auto">
      {rows.map((t) => {
        if (!t.open && t.net_pnl !== null) running += t.net_pnl
        const net = t.net_pnl ?? 0
        const isWin = !t.open && net > 0
        const isLoss = !t.open && net < 0
        return (
          <li key={`${t.source}:${t.id}`} className="group flex items-center gap-2 px-3 py-1.5 text-[11px]">
            <span className="w-10 shrink-0 font-mono text-zinc-500">
              {fmtTime(t.opened_at)}
            </span>
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                t.direction === 'long'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-red-500/15 text-red-300'
              }`}
            >
              {t.direction === 'long' ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
            </span>
            <span className="w-5 shrink-0 text-center font-mono text-zinc-500">
              {t.contracts}c
            </span>
            {t.source === 'auto' && (
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-500/15 text-amber-300"
                title="Captured via webhook"
              >
                <Zap className="h-3 w-3" />
              </span>
            )}
            <span className="flex-1 truncate font-mono text-zinc-400">
              {t.open ? (
                <span className="text-amber-300">
                  open @ {t.entry_price !== null ? t.entry_price.toFixed(2) : '—'}
                </span>
              ) : (
                <>
                  {t.gross_pnl !== null ? fmtAmount(t.gross_pnl) : '—'}{' '}
                  <span
                    className={
                      isWin ? 'text-emerald-300' : isLoss ? 'text-red-300' : 'text-zinc-300'
                    }
                  >
                    → {t.net_pnl !== null ? fmtAmount(t.net_pnl) : '—'}
                  </span>
                </>
              )}
            </span>
            <span
              className={`w-14 shrink-0 text-right font-mono tabular-nums ${
                running > 0
                  ? 'text-emerald-300'
                  : running < 0
                    ? 'text-red-300'
                    : 'text-zinc-400'
              }`}
            >
              {t.open ? '—' : fmtAmount(running)}
            </span>
            {t.source === 'manual' ? (
              <button
                type="button"
                onClick={() => {
                  void deleteTrade(t.id).catch(() => {})
                }}
                className="hidden h-4 w-4 items-center justify-center rounded text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200 group-hover:flex"
                aria-label="Delete trade"
                title="Delete trade"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <span className="h-4 w-4 shrink-0" />
            )}
          </li>
        )
      })}
    </ul>
  )
}
