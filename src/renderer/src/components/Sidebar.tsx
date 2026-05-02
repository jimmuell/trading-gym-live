import { Camera, ClipboardCheck, DollarSign, Settings } from 'lucide-react'
import type { Tab } from '../App'

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
}

const topItems: { id: Tab; label: string; Icon: typeof ClipboardCheck }[] = [
  { id: 'checklist', label: 'Checklist', Icon: ClipboardCheck },
  { id: 'netpnl', label: 'Net P&L', Icon: DollarSign },
  { id: 'screenshot', label: 'Screenshot', Icon: Camera }
]

const bottomItems: { id: Tab; label: string; Icon: typeof ClipboardCheck }[] = [
  { id: 'settings', label: 'Settings', Icon: Settings }
]

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

function SidebarButton({
  id,
  label,
  Icon,
  active,
  onChange
}: {
  id: Tab
  label: string
  Icon: typeof ClipboardCheck
  active: boolean
  onChange: (t: Tab) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(id)}
      className="relative flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 transition hover:text-zinc-200 focus:outline-none"
      style={noDrag}
      aria-label={label}
      title={label}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-blue-500" />
      )}
      <Icon className={`h-5 w-5 ${active ? 'text-white' : ''}`} />
    </button>
  )
}

export default function Sidebar({ active, onChange }: Props): React.JSX.Element {
  return (
    <nav className="flex w-10 flex-col items-center justify-between border-r border-white/5 bg-black/40 py-2">
      <div className="flex flex-col items-center gap-1">
        {topItems.map((item) => (
          <SidebarButton key={item.id} {...item} active={active === item.id} onChange={onChange} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        {bottomItems.map((item) => (
          <SidebarButton key={item.id} {...item} active={active === item.id} onChange={onChange} />
        ))}
      </div>
    </nav>
  )
}
