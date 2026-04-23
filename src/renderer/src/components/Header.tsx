import { useEffect, useState } from 'react'
import { Minus, Pin, PinOff, X } from 'lucide-react'

const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

type Props = {
  onClose?: () => void
}

export default function Header({ onClose }: Props): React.JSX.Element {
  const [pinned, setPinned] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.api?.getAlwaysOnTop?.().then((v) => {
      if (!cancelled) setPinned(v)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const togglePin = async (): Promise<void> => {
    if (!window.api?.toggleAlwaysOnTop) {
      setPinned((v) => !v)
      return
    }
    const next = await window.api.toggleAlwaysOnTop()
    setPinned(next)
  }

  const minimize = (): void => {
    window.api?.minimize?.()
  }

  return (
    <header
      className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 px-3"
      style={drag}
    >
      <div className="text-sm font-semibold tracking-tight text-zinc-200">TradingGYM Live</div>
      <div className="flex items-center gap-1" style={noDrag}>
        <button
          type="button"
          onClick={togglePin}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-white/10 ${
            pinned ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-200'
          }`}
          aria-label={pinned ? 'Unpin window' : 'Pin window'}
          title={pinned ? 'Always on top (on)' : 'Always on top (off)'}
        >
          {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={minimize}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
          aria-label="Minimize"
          title="Minimize"
        >
          <Minus className="h-4 w-4" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
            aria-label="Close panel"
            title="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  )
}
