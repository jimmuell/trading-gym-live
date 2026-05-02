import { useEffect, useState } from 'react'
import { Check, Loader2, LogOut, Save } from 'lucide-react'
import { useSession, type RiskLimits } from '../stores/sessionStore'
import { dailyDataFee, type CostSettings } from '../lib/costModel'
import { useAuth } from '../auth/AuthContext'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function NumField({
  label,
  hint,
  value,
  onChange,
  step = '0.01',
  min,
  max,
  optional
}: {
  label: string
  hint?: string
  value: number | null
  onChange: (n: number | null) => void
  step?: string
  min?: number
  max?: number
  optional?: boolean
}): React.JSX.Element {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px]">
      <div className="min-w-0 flex-1">
        <div className="text-zinc-300">{label}</div>
        {hint && <div className="text-[10px] text-zinc-500">{hint}</div>}
      </div>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        placeholder={optional ? '—' : ''}
        value={value === null ? '' : value}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onChange(optional ? null : 0)
          else {
            const n = parseFloat(v)
            onChange(Number.isFinite(n) ? n : 0)
          }
        }}
        className="w-20 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-right font-mono text-xs tabular-nums text-zinc-100 outline-none ring-blue-500/40 focus:ring-2"
      />
    </label>
  )
}

function SaveButton({
  state,
  disabled,
  onClick,
  label = 'Save'
}: {
  state: SaveState
  disabled?: boolean
  onClick: () => void
  label?: string
}): React.JSX.Element {
  const Icon =
    state === 'saving' ? Loader2 : state === 'saved' ? Check : Save
  const text = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : label
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === 'saving'}
      className={`mt-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 ${
        state === 'saved'
          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
          : 'bg-blue-600 text-white hover:bg-blue-500'
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${state === 'saving' ? 'animate-spin' : ''}`} />
      {text}
    </button>
  )
}

export default function SettingsPanel(): React.JSX.Element {
  const { costSettings, riskLimits, saveCostSettings, saveRiskLimits, session } = useSession()
  const { signOut, user } = useAuth()

  const [draftCost, setDraftCost] = useState<CostSettings>(costSettings)
  const [draftRisk, setDraftRisk] = useState<RiskLimits>(riskLimits)
  const [costState, setCostState] = useState<SaveState>('idle')
  const [riskState, setRiskState] = useState<SaveState>('idle')
  const [costError, setCostError] = useState<string | null>(null)
  const [riskError, setRiskError] = useState<string | null>(null)

  useEffect(() => {
    setDraftCost(costSettings)
  }, [costSettings])

  useEffect(() => {
    setDraftRisk(riskLimits)
  }, [riskLimits])

  const dailyData = dailyDataFee(draftCost)

  const onSaveCost = async (): Promise<void> => {
    setCostState('saving')
    setCostError(null)
    try {
      await saveCostSettings(draftCost)
      setCostState('saved')
      setTimeout(() => setCostState('idle'), 1500)
    } catch (err) {
      setCostState('error')
      setCostError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const onSaveRisk = async (): Promise<void> => {
    setRiskState('saving')
    setRiskError(null)
    try {
      await saveRiskLimits(draftRisk)
      setRiskState('saved')
      setTimeout(() => setRiskState('idle'), 1500)
    } catch (err) {
      setRiskState('error')
      setRiskError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const sessionActive = session?.status === 'active'

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <div>
          <div className="text-xs font-semibold text-zinc-100">Settings</div>
          {user?.email && (
            <div className="truncate text-[10px] text-zinc-500">{user.email}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <section className="flex flex-col gap-2 border-b border-white/5 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
            Cost Model
          </h3>
          <span className="text-[10px] text-zinc-500">synced</span>
        </div>

        <NumField
          label="Monthly data fee"
          hint="CQG / data provider, $/mo"
          value={draftCost.monthlyDataFee}
          onChange={(n) => setDraftCost({ ...draftCost, monthlyDataFee: n ?? 0 })}
        />
        <NumField
          label="Trading days / month"
          value={draftCost.tradingDaysPerMonth}
          onChange={(n) =>
            setDraftCost({ ...draftCost, tradingDaysPerMonth: Math.max(1, Math.round(n ?? 1)) })
          }
          step="1"
          min={1}
          max={31}
        />
        <NumField
          label="Commission per trade"
          hint="round-trip, $/contract"
          value={draftCost.commissionPerTrade}
          onChange={(n) => setDraftCost({ ...draftCost, commissionPerTrade: n ?? 0 })}
        />
        <NumField
          label="Tick value"
          hint="MES = $1.25"
          value={draftCost.tickValue}
          onChange={(n) => setDraftCost({ ...draftCost, tickValue: n ?? 0 })}
        />
        <NumField
          label="Default contracts"
          value={draftCost.defaultContracts}
          onChange={(n) =>
            setDraftCost({ ...draftCost, defaultContracts: Math.max(1, Math.round(n ?? 1)) })
          }
          step="1"
          min={1}
          max={50}
        />

        <div className="mt-1 flex items-center justify-between rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[10px]">
          <span className="text-zinc-500">Daily data cost</span>
          <span className="font-mono tabular-nums text-zinc-300">
            ${dailyData.toFixed(2)}
          </span>
        </div>

        {costError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-1.5 text-[11px] text-red-300">
            {costError}
          </div>
        )}

        <SaveButton state={costState} onClick={onSaveCost} label="Save cost model" />
      </section>

      <section className="flex flex-col gap-2 border-b border-white/5 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
            Risk Limits
          </h3>
          <span className="text-[10px] text-zinc-500">applied at session start</span>
        </div>

        <NumField
          label="Max daily loss"
          hint="$ — alert at 50/75/100%"
          value={draftRisk.maxDailyLoss}
          onChange={(n) => setDraftRisk({ ...draftRisk, maxDailyLoss: n })}
          step="1"
          min={0}
          optional
        />
        <NumField
          label="Planned trades"
          hint="alert at 80/100/150%"
          value={draftRisk.plannedTrades}
          onChange={(n) =>
            setDraftRisk({
              ...draftRisk,
              plannedTrades: n === null ? null : Math.max(1, Math.round(n))
            })
          }
          step="1"
          min={1}
          optional
        />
        <NumField
          label="Max consecutive losses"
          value={draftRisk.maxConsecutiveLosses}
          onChange={(n) =>
            setDraftRisk({
              ...draftRisk,
              maxConsecutiveLosses: n === null ? null : Math.max(1, Math.round(n))
            })
          }
          step="1"
          min={1}
          optional
        />

        {sessionActive && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1.5 text-[10px] text-amber-200">
            Active session in progress — changes apply to your next session.
          </div>
        )}

        {riskError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-1.5 text-[11px] text-red-300">
            {riskError}
          </div>
        )}

        <SaveButton state={riskState} onClick={onSaveRisk} label="Save risk limits" />
      </section>
    </div>
  )
}
