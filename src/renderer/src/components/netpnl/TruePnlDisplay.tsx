import { useSession } from '../../stores/sessionStore'

function fmt(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}$${Math.abs(amount).toFixed(2)}`
}

function Row({
  label,
  value,
  muted
}: {
  label: string
  value: string
  muted?: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-zinc-500' : 'text-zinc-300'}>{label}</span>
      <span className={`font-mono tabular-nums ${muted ? 'text-zinc-400' : 'text-zinc-200'}`}>
        {value}
      </span>
    </div>
  )
}

export default function TruePnlDisplay(): React.JSX.Element {
  const { totals, session } = useSession()
  const { grossTotal, commissionTotal, dataFeeTotal, netTotal, feeDragPct } = totals

  const netColor =
    netTotal > 0 ? 'text-emerald-400' : netTotal < 0 ? 'text-red-400' : 'text-zinc-300'
  const dragColor =
    feeDragPct > 60 ? 'text-red-400' : feeDragPct > 30 ? 'text-amber-400' : 'text-zinc-500'

  return (
    <div className="border-b border-white/5 p-3">
      <div className="space-y-1 text-[11px]">
        <Row label="Gross (TradingView)" value={fmt(grossTotal)} muted />
        <Row label="Commissions" value={`-$${Math.abs(commissionTotal).toFixed(2)}`} muted />
        <Row label="Data fee" value={`-$${Math.abs(dataFeeTotal).toFixed(2)}`} muted />
      </div>
      <div className="mt-2 border-t border-white/10 pt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Net P&amp;L</span>
          <span className={`font-mono text-2xl font-bold tabular-nums ${netColor}`}>
            {fmt(netTotal)}
          </span>
        </div>
        {grossTotal !== 0 && (
          <div className="mt-1 flex items-center justify-between text-[10px]">
            <span className="text-zinc-500">Fee drag</span>
            <span className={`font-mono ${dragColor}`}>{feeDragPct.toFixed(1)}%</span>
          </div>
        )}
        {!session && (
          <div className="mt-2 text-[10px] italic text-zinc-500">Start a session to log trades</div>
        )}
      </div>
    </div>
  )
}
