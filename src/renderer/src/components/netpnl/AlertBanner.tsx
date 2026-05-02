import { AlertTriangle } from 'lucide-react'
import { useSession } from '../../stores/sessionStore'
import {
  FEE_DRAG_THRESHOLDS,
  LOSS_THRESHOLDS,
  TRADE_VOLUME_THRESHOLDS
} from '../../lib/costModel'

type AlertLevel = 'warn' | 'alert' | 'danger'
type Alert = { level: AlertLevel; message: string; key: string }

const styles: Record<AlertLevel, string> = {
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  alert: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  danger: 'border-red-500/40 bg-red-500/15 text-red-200'
}

export default function AlertBanner(): React.JSX.Element | null {
  const { session, totals, trades } = useSession()
  if (!session || session.status !== 'active') return null

  const alerts: Alert[] = []

  if (totals.grossTotal !== 0) {
    if (totals.feeDragPct > FEE_DRAG_THRESHOLDS.danger) {
      alerts.push({
        level: 'danger',
        message: `Fee drag ${totals.feeDragPct.toFixed(0)}%`,
        key: 'feedrag'
      })
    } else if (totals.feeDragPct > FEE_DRAG_THRESHOLDS.alert) {
      alerts.push({
        level: 'alert',
        message: `Fee drag ${totals.feeDragPct.toFixed(0)}%`,
        key: 'feedrag'
      })
    } else if (totals.feeDragPct > FEE_DRAG_THRESHOLDS.warn) {
      alerts.push({
        level: 'warn',
        message: `Fee drag ${totals.feeDragPct.toFixed(0)}%`,
        key: 'feedrag'
      })
    }
  }

  if (session.planned_trades && session.planned_trades > 0) {
    const ratio = trades.length / session.planned_trades
    if (ratio >= TRADE_VOLUME_THRESHOLDS.danger) {
      alerts.push({
        level: 'danger',
        message: `Significant overtrading (${trades.length}/${session.planned_trades})`,
        key: 'volume'
      })
    } else if (ratio >= TRADE_VOLUME_THRESHOLDS.alert) {
      alerts.push({
        level: 'alert',
        message: `Plan complete — ${trades.length}/${session.planned_trades}`,
        key: 'volume'
      })
    } else if (ratio >= TRADE_VOLUME_THRESHOLDS.warn) {
      alerts.push({
        level: 'warn',
        message: `${trades.length}/${session.planned_trades} planned trades used`,
        key: 'volume'
      })
    }
  }

  if (session.max_daily_loss && totals.netTotal < 0) {
    const ratio = Math.abs(totals.netTotal) / session.max_daily_loss
    if (ratio >= LOSS_THRESHOLDS.danger) {
      alerts.push({ level: 'danger', message: 'DAILY LOSS LIMIT REACHED', key: 'loss' })
    } else if (ratio >= LOSS_THRESHOLDS.alert) {
      alerts.push({
        level: 'alert',
        message: 'Approaching daily loss limit',
        key: 'loss'
      })
    } else if (ratio >= LOSS_THRESHOLDS.warn) {
      alerts.push({ level: 'warn', message: '50% of daily loss limit', key: 'loss' })
    }
  }

  if (session.max_consecutive_losses && totals.consecutiveLosses > 0) {
    if (totals.consecutiveLosses >= session.max_consecutive_losses) {
      alerts.push({
        level: 'danger',
        message: `${totals.consecutiveLosses} consecutive losses — pause`,
        key: 'consec'
      })
    } else if (totals.consecutiveLosses === session.max_consecutive_losses - 1) {
      alerts.push({
        level: 'warn',
        message: `${totals.consecutiveLosses} consecutive losses`,
        key: 'consec'
      })
    }
  }

  if (alerts.length === 0) return null

  return (
    <div className="space-y-1 border-b border-white/5 px-3 py-2">
      {alerts.map((a) => (
        <div
          key={a.key}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${styles[a.level]}`}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="flex-1">{a.message}</span>
        </div>
      ))}
    </div>
  )
}
