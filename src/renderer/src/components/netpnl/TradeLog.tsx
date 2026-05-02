import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useSession } from '../../stores/sessionStore'

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

export default function TradeLog(): React.JSX.Element {
  const { trades, deleteTrade } = useSession()

  if (trades.length === 0) {
    return (
      <div className="flex-1 px-3 py-6 text-center text-[11px] text-zinc-500">
        No trades logged yet
      </div>
    )
  }

  let running = 0

  return (
    <ul className="flex-1 divide-y divide-white/5 overflow-auto">
      {trades.map((t) => {
        running += Number(t.net_pnl)
        const isWin = Number(t.net_pnl) > 0
        const isLoss = Number(t.net_pnl) < 0
        return (
          <li key={t.id} className="group flex items-center gap-2 px-3 py-1.5 text-[11px]">
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
            <span className="flex-1 truncate font-mono text-zinc-400">
              {fmtAmount(Number(t.gross_pnl))}{' '}
              <span
                className={
                  isWin ? 'text-emerald-300' : isLoss ? 'text-red-300' : 'text-zinc-300'
                }
              >
                → {fmtAmount(Number(t.net_pnl))}
              </span>
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
              {fmtAmount(running)}
            </span>
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
          </li>
        )
      })}
    </ul>
  )
}
