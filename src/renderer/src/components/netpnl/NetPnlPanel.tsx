import { Loader2 } from 'lucide-react'
import { useSession } from '../../stores/sessionStore'
import SessionHeader from './SessionHeader'
import TruePnlDisplay from './TruePnlDisplay'
import QuickTradeEntry from './QuickTradeEntry'
import TradeLog from './TradeLog'
import AlertBanner from './AlertBanner'
import SessionSummary from './SessionSummary'

export default function NetPnlPanel(): React.JSX.Element {
  const { loading, error } = useSession()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <SessionHeader />
      <AlertBanner />
      <TruePnlDisplay />
      <QuickTradeEntry />
      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-300">
          {error}
        </div>
      )}
      <TradeLog />
      <SessionSummary />
    </div>
  )
}
