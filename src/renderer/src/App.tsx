import { useState } from 'react'

type Shortcut = { keys: string; label: string }

const SHORTCUTS: Shortcut[] = [
  { keys: 'Ctrl+A', label: 'Jump to start of line' },
  { keys: 'Ctrl+E', label: 'Jump to end of line' },
  { keys: 'Ctrl+W', label: 'Delete previous word' },
  { keys: 'Ctrl+U', label: 'Delete to line start' },
  { keys: 'Ctrl+K', label: 'Delete to end of line' }
]

const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

const isElectron = typeof window !== 'undefined' && !!window.api?.togglePanel

function App(): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const toggle = async (): Promise<void> => {
    if (!window.api?.togglePanel) {
      setExpanded((v) => !v)
      return
    }
    const next = await window.api.togglePanel()
    setExpanded(next)
  }

  const frameClass = isElectron
    ? 'relative h-screen w-screen'
    : `relative mx-auto my-10 overflow-hidden rounded-2xl ring-1 ring-white/10 ${
        expanded ? 'h-[420px] w-[360px] transition-all duration-200' : 'h-[120px] w-[120px]'
      }`

  return (
    <div className={frameClass} style={drag}>
      <div
        className={`absolute left-4 top-4 bottom-32 right-4 rounded-2xl bg-zinc-900/90 text-zinc-100 shadow-2xl backdrop-blur-md ${
          expanded
            ? 'opacity-100 translate-y-0 transition-all duration-200'
            : 'pointer-events-none opacity-0 translate-y-2'
        }`}
        style={noDrag}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h1 className="text-sm font-semibold tracking-tight">Claude Code shortcuts</h1>
          <button
            type="button"
            onClick={toggle}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
            style={noDrag}
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col gap-1 p-3">
          {SHORTCUTS.map((s) => (
            <li
              key={s.keys}
              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/5"
            >
              <span className="text-sm text-zinc-200">{s.label}</span>
              <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs text-zinc-300">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute bottom-0 right-0 flex h-24 w-24 items-center justify-center rounded-full bg-blue-950/90 shadow-[0_10px_30px_rgba(30,58,138,0.5)]">
        <button
          type="button"
          onClick={toggle}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-blue-400 to-blue-600 shadow-inner transition active:scale-95"
          style={noDrag}
          aria-label={expanded ? 'Close panel' : 'Open panel'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-white"
          >
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="m9 14 2 2 4-4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default App
