import Header from './Header'
import Sidebar from './Sidebar'
import ChecklistPanel from './ChecklistPanel'
import ScreenshotPanel from './ScreenshotPanel'
import SettingsPanel from './SettingsPanel'
import type { Tab } from '../App'

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

type Props = {
  tab: Tab
  onTabChange: (t: Tab) => void
  onClose: () => void
}

export default function PanelContent({ tab, onTabChange, onClose }: Props): React.JSX.Element {
  return (
    <div
      className="absolute left-0 right-0 top-0 bottom-[90px] flex flex-col overflow-hidden rounded-2xl bg-gray-900/90 text-zinc-100 shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
      style={noDrag}
    >
      <Header onClose={onClose} />
      <div className="flex min-h-0 flex-1">
        <Sidebar active={tab} onChange={onTabChange} />
        <main className="min-w-0 flex-1 overflow-auto">
          {tab === 'checklist' && <ChecklistPanel />}
          {tab === 'screenshot' && <ScreenshotPanel />}
          {tab === 'settings' && <SettingsPanel />}
        </main>
      </div>
    </div>
  )
}
