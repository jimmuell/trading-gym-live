import express from 'express'
import type { Request, Response } from 'express'
import type { Server } from 'http'
import { createClient } from '@supabase/supabase-js'

const WEBHOOK_PORT = 3456
const TICK_SIZE = 0.25 // MES / ES

let server: Server | null = null
let running = false

type TradePayload = {
  action?: string
  direction?: string
  price?: number | string
  contracts?: number | string
  strategy?: string
  ticker?: string
}

export function startWebhookServer(supabaseUrl: string, supabaseKey: string): void {
  if (server) return
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[webhook] Missing Supabase URL or key — webhook server not started.')
    return
  }

  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })

  const app = express()
  app.use(express.json())

  app.get('/webhook/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'tradinggym-live-webhook' })
  })

  app.post('/webhook/trade', async (req: Request, res: Response) => {
    try {
      const data = (req.body ?? {}) as TradePayload
      if (!data.action) {
        res.status(400).json({ error: 'Invalid payload' })
        return
      }

      const action = String(data.action).toLowerCase()
      const direction = String(data.direction ?? '').toLowerCase()
      if (direction !== 'long' && direction !== 'short') {
        res.status(400).json({ error: 'Invalid direction' })
        return
      }

      const price = Number.parseFloat(String(data.price ?? '0'))
      const contracts = Math.max(1, Number.parseInt(String(data.contracts ?? '1'), 10) || 1)
      const strategyName = String(data.strategy ?? 'unknown')

      if (!Number.isFinite(price) || price <= 0) {
        res.status(400).json({ error: 'Invalid price' })
        return
      }

      const { data: sessions, error: sessError } = await sb
        .from('trading_sessions')
        .select('*')
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)

      if (sessError) {
        console.error('[webhook] session lookup failed:', sessError.message)
        res.status(500).json({ error: sessError.message })
        return
      }
      if (!sessions || sessions.length === 0) {
        res.status(400).json({ error: 'No active trading session' })
        return
      }

      const session = sessions[0]
      const sessionId: string = session.id
      const userId: string = session.user_id
      const commissionPerRt = Number.parseFloat(String(session.cost_per_trade ?? '1.27')) || 1.27
      const tickValue = Number.parseFloat(String(session.tick_value ?? '1.25')) || 1.25

      if (action === 'entry') {
        const trade = {
          user_id: userId,
          trading_session_id: sessionId,
          direction,
          entry_price: price,
          contracts,
          strategy: strategyName,
          commission: Math.round(commissionPerRt * contracts * 10000) / 10000,
          opened_at: new Date().toISOString()
        }

        const { data: result, error } = await sb
          .from('live_trades')
          .insert(trade)
          .select()
          .single()

        if (error) {
          console.error('[webhook] entry insert failed:', error.message)
          res.status(500).json({ error: error.message })
          return
        }

        console.log(
          `[webhook] entry logged: ${direction} ${contracts}c @ ${price} (${strategyName})`
        )
        res.json({ status: 'entry_logged', trade_id: result.id })
        return
      }

      if (action === 'exit') {
        const { data: openTrades, error: findError } = await sb
          .from('live_trades')
          .select('*')
          .eq('trading_session_id', sessionId)
          .eq('direction', direction)
          .is('result', null)
          .order('opened_at', { ascending: false })
          .limit(1)

        if (findError) {
          console.error('[webhook] open-trade lookup failed:', findError.message)
          res.status(500).json({ error: findError.message })
          return
        }
        if (!openTrades || openTrades.length === 0) {
          res.status(400).json({ error: 'No matching open trade' })
          return
        }

        const trade = openTrades[0]
        const entryPrice = Number.parseFloat(String(trade.entry_price))
        const cts = Math.max(1, Number.parseInt(String(trade.contracts ?? '1'), 10) || 1)

        const ticks =
          direction === 'long' ? (price - entryPrice) / TICK_SIZE : (entryPrice - price) / TICK_SIZE
        const grossPnl = ticks * tickValue * cts
        const commission = commissionPerRt * cts
        const netPnl = grossPnl - commission
        const result: 'win' | 'loss' | 'breakeven' =
          grossPnl > 0 ? 'win' : grossPnl < 0 ? 'loss' : 'breakeven'

        const update = {
          result,
          gross_pnl: Math.round(grossPnl * 100) / 100,
          net_pnl: Math.round(netPnl * 100) / 100,
          ticks: Math.round(ticks * 100) / 100,
          commission: Math.round(commission * 10000) / 10000
        }

        const { error: updateError } = await sb
          .from('live_trades')
          .update(update)
          .eq('id', trade.id)

        if (updateError) {
          console.error('[webhook] exit update failed:', updateError.message)
          res.status(500).json({ error: updateError.message })
          return
        }

        console.log(
          `[webhook] exit logged: ${direction} ${cts}c → gross ${update.gross_pnl}, net ${update.net_pnl}`
        )
        res.json({
          status: 'exit_logged',
          gross_pnl: update.gross_pnl,
          net_pnl: update.net_pnl
        })
        return
      }

      res.status(400).json({ error: 'Unknown action' })
    } catch (err) {
      console.error('[webhook] internal error:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  server = app.listen(WEBHOOK_PORT, '127.0.0.1', () => {
    running = true
    console.log(`[webhook] listening on http://127.0.0.1:${WEBHOOK_PORT}`)
  })

  server.on('error', (err) => {
    running = false
    console.error('[webhook] server error:', err)
  })
}

export function stopWebhookServer(): void {
  if (server) {
    server.close()
    server = null
    running = false
    console.log('[webhook] stopped')
  }
}

export function getWebhookPort(): number {
  return WEBHOOK_PORT
}

export function isWebhookRunning(): boolean {
  return running
}
