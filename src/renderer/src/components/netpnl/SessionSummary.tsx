import { useState } from 'react'
import { X } from 'lucide-react'
import { useSession } from '../../stores/sessionStore'

function fmt(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

function Stat({
  label,
  value,
  valueColor
}: {
  label: string
  value: string
  valueColor?: string
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-mono tabular-nums ${valueColor ?? 'text-zinc-200'}`}>{value}</span>
    </div>
  )
}

export default function SessionSummary(): React.JSX.Element | null {
  const { session, totals } = useSession()
  const [dismissed, setDismissed] = useState(false)

  if (!session || session.status !== 'ended' || dismissed) return null

  const { grossTotal, netTotal, tradeCount, winCount, lossCount, largestWin, largestLoss } =
    totals
  const gap = grossTotal - netTotal
  const winRate = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0
  const planned = session.planned_trades
  const adherence = planned ? Math.min(100, (tradeCount / planned) * 100) : null

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-gray-900/95 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-zinc-100">Session summary</div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
          aria-label="Close summary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 overflow-auto text-[11px]">
        <div className="rounded-md border border-white/10 bg-black/30 p-2">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            Gross vs Net
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-zinc-300">{fmt(grossTotal)}</span>
            <span className="text-zinc-500">→</span>
            <span
              className={`font-mono text-base font-bold tabular-nums ${
                netTotal >= 0 ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {fmt(netTotal)}
            </span>
          </div>
          <div className="mt-1 text-right text-[10px] text-amber-300">
            Gap: -${Math.abs(gap).toFixed(2)}
          </div>
        </div>

        <Stat
          label="Trades"
          value={`${tradeCount}${planned ? ` / ${planned} planned` : ''}`}
        />
        <Stat label="Win rate" value={`${winRate.toFixed(0)}% (${winCount}W ${lossCount}L)`} />
        <Stat label="Largest win" value={fmt(largestWin)} valueColor="text-emerald-300" />
        <Stat label="Largest loss" value={fmt(largestLoss)} valueColor="text-red-300" />
        {adherence !== null && (
          <Stat label="Plan adherence" value={`${adherence.toFixed(0)}%`} />
        )}
      </div>
    </div>
  )
}
