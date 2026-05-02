import { useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, PlusCircle } from 'lucide-react'
import { useSession } from '../../stores/sessionStore'

export default function QuickTradeEntry(): React.JSX.Element {
  const { session, costSettings, logTrade } = useSession()
  const [grossInput, setGrossInput] = useState('')
  const [contracts, setContracts] = useState<number>(costSettings.defaultContracts)
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [strategy, setStrategy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sign, setSign] = useState<1 | -1>(1)

  const disabled = !session || session.status !== 'active'

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (disabled || busy) return
    const parsed = parseFloat(grossInput)
    if (!Number.isFinite(parsed)) {
      setError('Enter a valid number')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await logTrade({
        grossPnl: parsed * sign,
        contracts,
        direction,
        strategy: strategy.trim() || null
      })
      setGrossInput('')
      setStrategy('')
      setSign(1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Log failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 border-b border-white/5 p-3">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setSign(sign === 1 ? -1 : 1)}
          disabled={disabled}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-sm font-semibold transition ${
            sign === 1
              ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
              : 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
          } disabled:opacity-50`}
          aria-label="Toggle sign"
        >
          {sign === 1 ? '+' : '−'}
        </button>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="Gross P&L"
          value={grossInput}
          onChange={(e) => setGrossInput(e.target.value)}
          disabled={disabled}
          className="flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-sm tabular-nums text-zinc-100 outline-none ring-blue-500/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <input
          type="number"
          min={1}
          max={50}
          step={1}
          value={contracts}
          onChange={(e) => setContracts(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={disabled}
          className="w-12 rounded-md border border-white/10 bg-black/40 px-1.5 py-1.5 text-center font-mono text-sm tabular-nums text-zinc-100 outline-none ring-blue-500/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Contracts"
        />
      </div>

      <div className="flex gap-1.5">
        <div className="flex flex-1 overflow-hidden rounded-md ring-1 ring-white/10">
          <button
            type="button"
            onClick={() => setDirection('long')}
            disabled={disabled}
            className={`flex flex-1 items-center justify-center gap-1 py-1 text-xs font-medium transition ${
              direction === 'long'
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-black/40 text-zinc-400 hover:text-zinc-200'
            } disabled:opacity-50`}
          >
            <ArrowUp className="h-3 w-3" /> Long
          </button>
          <button
            type="button"
            onClick={() => setDirection('short')}
            disabled={disabled}
            className={`flex flex-1 items-center justify-center gap-1 py-1 text-xs font-medium transition ${
              direction === 'short'
                ? 'bg-red-500/20 text-red-200'
                : 'bg-black/40 text-zinc-400 hover:text-zinc-200'
            } disabled:opacity-50`}
          >
            <ArrowDown className="h-3 w-3" /> Short
          </button>
        </div>
        <input
          type="text"
          placeholder="Strategy"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          disabled={disabled}
          className="w-28 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-100 outline-none ring-blue-500/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-1.5 text-[11px] text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || busy || !grossInput}
        className="flex items-center justify-center gap-1.5 rounded-md bg-blue-600 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <PlusCircle className="h-3.5 w-3.5" />
        )}
        Log Trade
      </button>
    </form>
  )
}
