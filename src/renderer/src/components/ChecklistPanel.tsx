import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// Mirrors the web app's data model in jimmuell/tradinggym:
//   src/hooks/useChecklistSession.ts, src/hooks/useChecklistTemplates.ts
// Local app reads + writes prep items only; execution items are web-app-only.
// Side-effect columns (sp-1..sp-4) follow updatePrep() in ChecklistContent.tsx.

type ChecklistItem = {
  id: string
  label: string
  type: 'toggle' | 'select' | 'input'
  is_core?: boolean
  options?: string[]
  input_type?: 'currency' | 'text'
}

type ChecklistTemplate = {
  id: string
  user_id: string
  strategy_name: string
  session_prep_items: ChecklistItem[]
  execution_items: ChecklistItem[]
  is_default: boolean
}

type ChecklistSession = {
  id: string
  user_id: string
  template_id: string
  strategy_name: string
  session_date: string
  session_prep_completed: Record<string, string | boolean | number>
  execution_completed: Record<string, string | boolean | number>
  prep_complete: boolean
  execution_complete: boolean
  emotional_readiness: boolean
  max_daily_loss: number | null
  trading_session: string | null
  htf_bias: string | null
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const isItemComplete = (item: ChecklistItem, value: unknown): boolean => {
  if (item.type === 'toggle') return value === true
  if (value === undefined || value === null) return false
  return String(value).trim().length > 0
}

export default function ChecklistPanel(): React.JSX.Element {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<ChecklistTemplate[] | null>(null)
  const [session, setSession] = useState<ChecklistSession | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const creatingRef = useRef<Promise<ChecklistSession | null> | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load(): Promise<void> {
      setLoading(true)
      setError(null)

      const [tplRes, sessRes] = await Promise.all([
        supabase
          .from('checklist_templates')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('checklist_sessions')
          .select('*')
          .eq('session_date', todayIso())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])

      if (cancelled) return

      if (tplRes.error) {
        setError(tplRes.error.message)
        setLoading(false)
        return
      }
      if (sessRes.error) {
        setError(sessRes.error.message)
        setLoading(false)
        return
      }

      let tpls = (tplRes.data ?? []) as ChecklistTemplate[]

      if (tpls.length === 0) {
        const { error: seedErr } = await supabase.rpc('seed_default_checklists', {
          target_user_id: user!.id
        })
        if (cancelled) return
        if (seedErr) {
          setError(seedErr.message)
          setLoading(false)
          return
        }
        const reload = await supabase
          .from('checklist_templates')
          .select('*')
          .order('created_at', { ascending: true })
        if (cancelled) return
        if (reload.error) {
          setError(reload.error.message)
          setLoading(false)
          return
        }
        tpls = (reload.data ?? []) as ChecklistTemplate[]
      }

      const sess = (sessRes.data ?? null) as ChecklistSession | null
      setTemplates(tpls)
      setSession(sess)
      setSelectedTemplateId(sess?.template_id ?? tpls[0]?.id ?? null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const activeTemplate = useMemo<ChecklistTemplate | null>(() => {
    if (!templates) return null
    return templates.find((t) => t.id === selectedTemplateId) ?? templates[0] ?? null
  }, [templates, selectedTemplateId])

  const ensureSession = useCallback(async (): Promise<ChecklistSession | null> => {
    if (session) return session
    if (creatingRef.current) return creatingRef.current
    if (!user?.id || !activeTemplate) return null

    const promise = (async (): Promise<ChecklistSession | null> => {
      const { data, error: err } = await supabase
        .from('checklist_sessions')
        .insert({
          user_id: user.id,
          template_id: activeTemplate.id,
          strategy_name: activeTemplate.strategy_name,
          session_date: todayIso()
        })
        .select()
        .single()
      if (err) {
        setError(err.message)
        return null
      }
      const created = data as ChecklistSession
      setSession(created)
      return created
    })()

    creatingRef.current = promise
    try {
      return await promise
    } finally {
      creatingRef.current = null
    }
  }, [session, user?.id, activeTemplate])

  const updatePrep = useCallback(
    async (item: ChecklistItem, value: string | boolean | number): Promise<void> => {
      const s = await ensureSession()
      if (!s) return

      const next = { ...(s.session_prep_completed ?? {}), [item.id]: value }
      const patch: Record<string, unknown> = { session_prep_completed: next }
      if (item.id === 'sp-1' && item.input_type === 'currency') {
        const num = Number(value)
        patch.max_daily_loss = Number.isFinite(num) ? num : null
      }
      if (item.id === 'sp-2') patch.trading_session = String(value)
      if (item.id === 'sp-3') patch.htf_bias = String(value)
      if (item.id === 'sp-4') patch.emotional_readiness = value === true

      setSession((cur) =>
        cur ? ({ ...cur, ...patch, session_prep_completed: next } as ChecklistSession) : cur
      )

      const { error: err } = await supabase
        .from('checklist_sessions')
        .update(patch)
        .eq('id', s.id)
      if (err) setError(err.message)
    },
    [ensureSession]
  )

  const prepValues = session?.session_prep_completed ?? {}
  const prepItems = activeTemplate?.session_prep_items ?? []
  const completedCount = prepItems.filter((it) => isItemComplete(it, prepValues[it.id])).length
  const allDone = prepItems.length > 0 && completedCount === prepItems.length

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
          {activeTemplate?.strategy_name ?? '—'} · {completedCount} of {prepItems.length} complete
          {allDone && <span className="ml-1 text-emerald-400">— ready</span>}
        </div>
      </div>

      {templates && templates.length > 1 && !session && (
        <div className="border-b border-white/5 px-4 py-2">
          <select
            value={activeTemplate?.id ?? ''}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.strategy_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="m-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <ul className="flex-1 space-y-2 overflow-auto p-3">
        {prepItems.map((item) => (
          <li key={item.id}>
            <PrepItemRow
              item={item}
              value={prepValues[item.id]}
              onCommit={(v) => updatePrep(item, v)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function PrepItemRow({
  item,
  value,
  onCommit
}: {
  item: ChecklistItem
  value: unknown
  onCommit: (v: string | boolean | number) => void
}): React.JSX.Element {
  const initial =
    typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  const [draft, setDraft] = useState<string>(initial)

  useEffect(() => {
    setDraft(initial)
  }, [initial])

  const complete = isItemComplete(item, value)

  if (item.type === 'select' && item.options) {
    return (
      <div className="flex flex-col gap-1 rounded-md px-2 py-2">
        <label className="text-xs text-zinc-400">{item.label}</label>
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onCommit(e.target.value)}
          className="rounded-md border border-white/10 bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
        >
          <option value="">Select…</option>
          {item.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (item.type === 'input') {
    return (
      <div className="flex flex-col gap-1 rounded-md px-2 py-2">
        <label className="text-xs text-zinc-400">{item.label}</label>
        <input
          type={item.input_type === 'currency' ? 'number' : 'text'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft === initial) return
            onCommit(item.input_type === 'currency' ? Number(draft) : draft)
          }}
          className="rounded-md border border-white/10 bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onCommit(!complete)}
      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition ${
        complete ? 'bg-emerald-500/10 text-emerald-200' : 'text-zinc-200 hover:bg-white/5'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
          complete
            ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'
            : 'border-zinc-600 bg-transparent'
        }`}
      >
        {complete && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className={complete ? 'line-through opacity-70' : ''}>{item.label}</span>
    </button>
  )
}
