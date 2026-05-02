import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import {
  COST_DEFAULTS,
  commissionForTrade,
  dailyDataFee,
  netPnl,
  ticksFromGross,
  type CostSettings
} from '../lib/costModel'

export type SessionStatus = 'active' | 'paused' | 'ended'

export type TradingSession = {
  id: string
  user_id: string
  date: string
  started_at: string
  ended_at: string | null
  status: SessionStatus
  cost_per_trade: number
  daily_data_fee: number
  tick_value: number
  max_daily_loss: number | null
  planned_trades: number | null
  max_consecutive_losses: number | null
  max_contracts: number
}

export type Trade = {
  id: string
  user_id: string
  direction: 'long' | 'short'
  gross_pnl: number
  commission: number
  net_pnl: number
  contracts: number
  ticks: number | null
  strategy: string | null
  notes: string | null
  trading_session_id: string
  opened_at: string
  result: 'win' | 'loss' | 'breakeven' | null
}

export type LogTradeInput = {
  grossPnl: number
  contracts: number
  direction: 'long' | 'short'
  strategy?: string | null
  notes?: string | null
}

export type SessionTotals = {
  grossTotal: number
  commissionTotal: number
  dataFeeTotal: number
  netTotal: number
  feeDragPct: number
  tradeCount: number
  winCount: number
  lossCount: number
  largestWin: number
  largestLoss: number
  consecutiveLosses: number
}

export type RiskLimits = {
  maxDailyLoss: number | null
  plannedTrades: number | null
  maxConsecutiveLosses: number | null
}

const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxDailyLoss: null,
  plannedTrades: null,
  maxConsecutiveLosses: null
}

type SessionContextValue = {
  loading: boolean
  error: string | null
  costSettings: CostSettings
  riskLimits: RiskLimits
  session: TradingSession | null
  trades: Trade[]
  startSession: (overrides?: Partial<TradingSession>) => Promise<void>
  endSession: () => Promise<void>
  logTrade: (input: LogTradeInput) => Promise<void>
  deleteTrade: (id: string) => Promise<void>
  refreshTrades: () => Promise<void>
  saveCostSettings: (next: CostSettings) => Promise<void>
  saveRiskLimits: (next: RiskLimits) => Promise<void>
  totals: SessionTotals
}

const SessionContext = createContext<SessionContextValue | null>(null)

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function SessionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user } = useAuth()
  const [costSettings, setCostSettings] = useState<CostSettings>(COST_DEFAULTS)
  const [riskLimits, setRiskLimits] = useState<RiskLimits>(DEFAULT_RISK_LIMITS)
  const [session, setSession] = useState<TradingSession | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load(): Promise<void> {
      setLoading(true)
      setError(null)

      const [csRes, sesRes] = await Promise.all([
        supabase.from('cost_settings').select('*').eq('user_id', user!.id).maybeSingle(),
        supabase
          .from('trading_sessions')
          .select('*')
          .eq('user_id', user!.id)
          .eq('date', todayIso())
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])

      if (cancelled) return

      if (csRes.error && csRes.error.code !== 'PGRST116') {
        console.warn('[sessionStore] cost_settings load:', csRes.error.message)
      }
      if (csRes.data) {
        const cs = csRes.data
        setCostSettings({
          monthlyDataFee: Number(cs.monthly_data_fee ?? COST_DEFAULTS.monthlyDataFee),
          tradingDaysPerMonth: Number(
            cs.trading_days_per_month ?? COST_DEFAULTS.tradingDaysPerMonth
          ),
          commissionPerTrade: Number(
            cs.commission_per_trade ?? COST_DEFAULTS.commissionPerTrade
          ),
          tickValue: Number(cs.tick_value ?? COST_DEFAULTS.tickValue),
          defaultContracts: Number(cs.default_contracts ?? COST_DEFAULTS.defaultContracts)
        })
        setRiskLimits({
          maxDailyLoss: cs.max_daily_loss === null || cs.max_daily_loss === undefined
            ? null
            : Number(cs.max_daily_loss),
          plannedTrades: cs.planned_trades === null || cs.planned_trades === undefined
            ? null
            : Number(cs.planned_trades),
          maxConsecutiveLosses:
            cs.max_consecutive_losses === null || cs.max_consecutive_losses === undefined
              ? null
              : Number(cs.max_consecutive_losses)
        })
      }

      if (sesRes.error) {
        setError(sesRes.error.message)
      } else {
        setSession((sesRes.data as TradingSession | null) ?? null)
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const refreshTrades = useCallback(async (): Promise<void> => {
    if (!session) {
      setTrades([])
      return
    }
    const { data, error: err } = await supabase
      .from('trades')
      .select('*')
      .eq('trading_session_id', session.id)
      .order('opened_at', { ascending: true })
    if (err) {
      setError(err.message)
      return
    }
    setTrades((data as Trade[]) ?? [])
  }, [session])

  useEffect(() => {
    refreshTrades()
  }, [refreshTrades])

  const startSession = useCallback(
    async (overrides: Partial<TradingSession> = {}): Promise<void> => {
      if (!user) return
      setError(null)
      const payload = {
        user_id: user.id,
        date: todayIso(),
        status: 'active' as const,
        cost_per_trade: costSettings.commissionPerTrade,
        daily_data_fee: dailyDataFee(costSettings),
        tick_value: costSettings.tickValue,
        max_contracts: costSettings.defaultContracts,
        max_daily_loss: riskLimits.maxDailyLoss,
        planned_trades: riskLimits.plannedTrades,
        max_consecutive_losses: riskLimits.maxConsecutiveLosses,
        ...overrides
      }
      const { data, error: err } = await supabase
        .from('trading_sessions')
        .insert(payload)
        .select('*')
        .single()
      if (err) {
        setError(err.message)
        throw new Error(err.message)
      }
      setSession(data as TradingSession)
      setTrades([])
    },
    [user, costSettings, riskLimits]
  )

  const endSession = useCallback(async (): Promise<void> => {
    if (!session) return
    setError(null)
    const { data, error: err } = await supabase
      .from('trading_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', session.id)
      .select('*')
      .single()
    if (err) {
      setError(err.message)
      throw new Error(err.message)
    }
    setSession(data as TradingSession)
  }, [session])

  const logTrade = useCallback(
    async (input: LogTradeInput): Promise<void> => {
      if (!user || !session) return
      setError(null)
      const commission = commissionForTrade(input.contracts, costSettings)
      const net = netPnl(input.grossPnl, input.contracts, costSettings)
      const ticks = ticksFromGross(input.grossPnl, input.contracts, costSettings)
      const result: Trade['result'] = net > 0 ? 'win' : net < 0 ? 'loss' : 'breakeven'
      const payload = {
        user_id: user.id,
        trading_session_id: session.id,
        session_type: 'live',
        direction: input.direction,
        contracts: input.contracts,
        gross_pnl: input.grossPnl,
        commission,
        net_pnl: net,
        ticks: Number(ticks.toFixed(2)),
        strategy: input.strategy ?? null,
        notes: input.notes ?? null,
        opened_at: new Date().toISOString(),
        result
      }
      const { data, error: err } = await supabase
        .from('trades')
        .insert(payload)
        .select('*')
        .single()
      if (err) {
        setError(err.message)
        throw new Error(err.message)
      }
      setTrades((prev) => [...prev, data as Trade])
    },
    [user, session, costSettings]
  )

  const deleteTrade = useCallback(async (id: string): Promise<void> => {
    setError(null)
    const { error: err } = await supabase.from('trades').delete().eq('id', id)
    if (err) {
      setError(err.message)
      throw new Error(err.message)
    }
    setTrades((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const saveCostSettings = useCallback(
    async (next: CostSettings): Promise<void> => {
      if (!user) return
      setError(null)
      const payload = {
        user_id: user.id,
        monthly_data_fee: next.monthlyDataFee,
        trading_days_per_month: next.tradingDaysPerMonth,
        commission_per_trade: next.commissionPerTrade,
        tick_value: next.tickValue,
        default_contracts: next.defaultContracts,
        updated_at: new Date().toISOString()
      }
      const { error: err } = await supabase
        .from('cost_settings')
        .upsert(payload, { onConflict: 'user_id' })
      if (err) {
        setError(err.message)
        throw new Error(err.message)
      }
      setCostSettings(next)
    },
    [user]
  )

  const saveRiskLimits = useCallback(
    async (next: RiskLimits): Promise<void> => {
      if (!user) return
      setError(null)
      const payload = {
        user_id: user.id,
        max_daily_loss: next.maxDailyLoss,
        planned_trades: next.plannedTrades,
        max_consecutive_losses: next.maxConsecutiveLosses,
        updated_at: new Date().toISOString()
      }
      const { error: err } = await supabase
        .from('cost_settings')
        .upsert(payload, { onConflict: 'user_id' })
      if (err) {
        setError(err.message)
        throw new Error(err.message)
      }
      setRiskLimits(next)
    },
    [user]
  )

  const totals = useMemo<SessionTotals>(() => {
    let grossTotal = 0
    let commissionTotal = 0
    let tradeNetTotal = 0
    let winCount = 0
    let lossCount = 0
    let largestWin = 0
    let largestLoss = 0
    let consecutive = 0
    for (const t of trades) {
      const g = Number(t.gross_pnl)
      const c = Number(t.commission)
      const n = Number(t.net_pnl)
      grossTotal += g
      commissionTotal += c
      tradeNetTotal += n
      if (n > 0) {
        winCount++
        consecutive = 0
        largestWin = Math.max(largestWin, n)
      } else if (n < 0) {
        lossCount++
        consecutive++
        largestLoss = Math.min(largestLoss, n)
      }
    }
    const dataFeeTotal = session
      ? Number(session.daily_data_fee)
      : dailyDataFee(costSettings)
    const sessionNet = tradeNetTotal - dataFeeTotal
    const totalCosts = commissionTotal + dataFeeTotal
    const feeDrag = grossTotal !== 0 ? (totalCosts / Math.abs(grossTotal)) * 100 : 0
    return {
      grossTotal,
      commissionTotal,
      dataFeeTotal,
      netTotal: sessionNet,
      feeDragPct: feeDrag,
      tradeCount: trades.length,
      winCount,
      lossCount,
      largestWin,
      largestLoss,
      consecutiveLosses: consecutive
    }
  }, [trades, session, costSettings])

  const value: SessionContextValue = {
    loading,
    error,
    costSettings,
    riskLimits,
    session,
    trades,
    startSession,
    endSession,
    logTrade,
    deleteTrade,
    refreshTrades,
    saveCostSettings,
    saveRiskLimits,
    totals
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
