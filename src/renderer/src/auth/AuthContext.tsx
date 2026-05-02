import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'

type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

type AuthContextValue = {
  status: AuthStatus
  session: Session | null
  user: User | null
  configured: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let cancelled = false

    async function hydrate(): Promise<void> {
      if (!supabaseConfigured) {
        if (!cancelled) setStatus('signed-out')
        return
      }
      try {
        const stored = await window.api?.auth?.getToken?.()
        if (stored) {
          const parsed = JSON.parse(stored) as { access_token: string; refresh_token: string }
          const { data, error } = await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token
          })
          if (!cancelled) {
            if (error || !data.session) {
              await window.api?.auth?.clearToken?.()
              setSession(null)
              setStatus('signed-out')
            } else {
              setSession(data.session)
              setStatus('signed-in')
            }
            return
          }
        }
        if (!cancelled) {
          setSession(null)
          setStatus('signed-out')
        }
      } catch (err) {
        console.error('[auth] hydrate failed:', err)
        if (!cancelled) {
          setSession(null)
          setStatus('signed-out')
        }
      }
    }

    hydrate()

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      if (cancelled) return
      setSession(next)
      setStatus(next ? 'signed-in' : 'signed-out')
      if (next) {
        const payload = JSON.stringify({
          access_token: next.access_token,
          refresh_token: next.refresh_token
        })
        window.api?.auth?.saveToken?.(payload).catch((err) => {
          console.error('[auth] saveToken failed:', err)
        })
      } else if (event === 'SIGNED_OUT') {
        window.api?.auth?.clearToken?.().catch(() => {})
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      configured: supabaseConfigured,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      signOut: async () => {
        await supabase.auth.signOut()
      }
    }),
    [status, session]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
