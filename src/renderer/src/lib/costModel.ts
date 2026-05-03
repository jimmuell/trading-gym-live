export const COST_DEFAULTS = {
  monthlyDataFee: 45.0,
  tradingDaysPerMonth: 20,
  commissionPerTrade: 1.24,
  tickValue: 1.25,
  defaultContracts: 1
}

export type CostSettings = typeof COST_DEFAULTS

export function dailyDataFee(s: CostSettings): number {
  if (s.tradingDaysPerMonth <= 0) return 0
  return s.monthlyDataFee / s.tradingDaysPerMonth
}

export function commissionForTrade(contracts: number, s: CostSettings): number {
  return Math.max(0, contracts) * s.commissionPerTrade
}

export function netPnl(grossPnl: number, contracts: number, s: CostSettings): number {
  return grossPnl - commissionForTrade(contracts, s)
}

export function ticksFromGross(grossPnl: number, contracts: number, s: CostSettings): number {
  if (contracts <= 0 || s.tickValue <= 0) return 0
  return grossPnl / (s.tickValue * contracts)
}

export const FEE_DRAG_THRESHOLDS = { warn: 30, alert: 50, danger: 75 }
export const TRADE_VOLUME_THRESHOLDS = { warn: 0.8, alert: 1.0, danger: 1.5 }
export const LOSS_THRESHOLDS = { warn: 0.5, alert: 0.75, danger: 1.0 }
