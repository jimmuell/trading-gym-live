import { useEffect, useState } from 'react'
import { Loader2, Play, Square } from 'lucide-react'
import { useSession } from '../../stores/sessionStore'

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export default function SessionHeader(): React.JSX.Element {
  const { session, startSession, endSession } = useSession()
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!session || session.status !== 'active') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [session])

  const status = session?.status ?? 'inactive'
  const dotColor =
    status === 'active'
      ? 'bg-emerald-400'
      : status === 'paused'
        ? 'bg-amber-400'
        : status === 'ended'
          ? 'bg-zinc-500'
          : 'bg-zinc-700'

  const startedAt = session ? new Date(session.started_at).getTime() : 0
  const endedAt = session?.ended_at ? new Date(session.ended_at).getTime() : 0
  const elapsed =
    session && session.status === 'active'
      ? now - startedAt
      : session && endedAt
        ? endedAt - startedAt
        : 0

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  const onStart = async (): Promise<void> => {
    setBusy(true)
    try {
      await startSession()
    } catch {
      /* error surfaced via store */
    }
    setBusy(false)
  }
  const onEnd = async (): Promise<void> => {
    setBusy(true)
    try {
      await endSession()
    } catch {
      /* error surfaced via store */
    }
    setBusy(false)
  }

  return (
    <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-zinc-200">
            {status === 'active'
              ? 'Trading'
              : status === 'ended'
                ? 'Session ended'
                : status === 'paused'
                  ? 'Paused'
                  : 'No session'}
          </div>
          <div className="text-[10px] text-zinc-500">
            {today}
            {session ? ` · ${formatDuration(elapsed)}` : ''}
          </div>
        </div>
      </div>
      {!session || session.status === 'ended' ? (
        <button
          type="button"
          onClick={onStart}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:bg-zinc-700"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Start
        </button>
      ) : (
        <button
          type="button"
          onClick={onEnd}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-500 disabled:bg-zinc-700"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
          End
        </button>
      )}
    </div>
  )
}
