import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// NOTE: The web app's `checklist_sessions` schema isn't documented in this repo.
// This component assumes the table has at minimum:
//   id uuid pk, user_id uuid, date date, items jsonb, completed_at timestamptz null, created_at timestamptz
// `items` is stored as: { [key: string]: boolean }
// If the actual schema differs, this is the only file that needs to change.
const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'mental_state', label: 'Calm, focused, well-rested' },
  { key: 'market_context', label: 'News + market context reviewed' },
  { key: 'key_levels', label: 'Key levels marked on chart' },
  { key: 'trade_plan', label: 'Entry, stop, target defined' },
  { key: 'risk_sized', label: 'Position size within risk limits' },
  { key: 'daily_loss', label: 'Daily loss limit acknowledged' },
  { key: 'no_revenge', label: 'Not chasing or revenge trading' }
]

type ItemsState = Record<string, boolean>

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ChecklistPanel(): React.JSX.Element {
  const { user } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [items, setItems] = useState<ItemsState>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      const date = todayIso()
      const { data, error: err } = await supabase
        .from('checklist_sessions')
        .select('id, items, completed_at')
        .eq('user_id', user!.id)
        .eq('date', date)
        .maybeSingle()

      if (cancelled) return

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      if (data) {
        setSessionId(data.id)
        setItems((data.items as ItemsState | null) ?? {})
      } else {
        const initial: ItemsState = {}
        const { data: created, error: insertErr } = await supabase
          .from('checklist_sessions')
          .insert({ user_id: user!.id, date, items: initial })
          .select('id')
          .single()

        if (cancelled) return

        if (insertErr) {
          setError(insertErr.message)
        } else if (created) {
          setSessionId(created.id)
          setItems(initial)
        }
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const persist = useCallback(
    (next: ItemsState) => {
      if (!sessionId) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        const allChecked = CHECKLIST_ITEMS.every((it) => next[it.key])
        const { error: err } = await supabase
          .from('checklist_sessions')
          .update({
            items: next,
            completed_at: allChecked ? new Date().toISOString() : null
          })
          .eq('id', sessionId)
        if (err) setError(err.message)
      }, 250)
    },
    [sessionId]
  )

  const toggle = (key: string): void => {
    const next = { ...items, [key]: !items[key] }
    setItems(next)
    persist(next)
  }

  const completedCount = useMemo(
    () => CHECKLIST_ITEMS.filter((it) => items[it.key]).length,
    [items]
  )
  const allDone = completedCount === CHECKLIST_ITEMS.length

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-100">Pre-Trade Checklist</div>
        <div className="text-xs text-zinc-500">
          {completedCount} of {CHECKLIST_ITEMS.length} complete
          {allDone && <span className="ml-1 text-emerald-400">— ready</span>}
        </div>
      </div>

      {error && (
        <div className="m-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <ul className="flex-1 space-y-1 overflow-auto p-3">
        {CHECKLIST_ITEMS.map((it) => {
          const checked = !!items[it.key]
          return (
            <li key={it.key}>
              <button
                type="button"
                onClick={() => toggle(it.key)}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition ${
                  checked
                    ? 'bg-emerald-500/10 text-emerald-200'
                    : 'text-zinc-200 hover:bg-white/5'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'
                      : 'border-zinc-600 bg-transparent'
                  }`}
                >
                  {checked && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className={checked ? 'line-through opacity-70' : ''}>{it.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
