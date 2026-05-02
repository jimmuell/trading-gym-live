import { useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export default function LoginScreen(): React.JSX.Element {
  const { signIn, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  console.log('[login] supabase env', {
    url: import.meta.env.VITE_SUPABASE_URL,
    keyPresent: Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    keyLen: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.length ?? 0
  })

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: err } = await signIn(email.trim(), password)
      if (err) {
        console.error('[login] signIn error:', err)
        setError(err)
      }
    } catch (caught) {
      console.error('[login] signIn threw:', caught)
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6" style={noDrag}>
      <div className="flex flex-col items-center gap-1">
        <div className="text-base font-semibold text-zinc-100">TradingGYM Live</div>
        <div className="text-xs text-zinc-500">Sign in to your TradingGYM account</div>
      </div>

      {!configured && (
        <div className="w-full rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
          Supabase env vars are missing. Set <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in
          <code> .env.local</code> and restart <code>pnpm dev</code>.
        </div>
      )}

      <form onSubmit={onSubmit} className="flex w-full flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-zinc-100 outline-none ring-blue-500/40 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-zinc-100 outline-none ring-blue-500/40 focus:ring-2"
          />
        </label>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !configured}
          className="mt-1 flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
