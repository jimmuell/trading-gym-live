import { useEffect, useState } from 'react'
import FloatingButton from './components/FloatingButton'
import PanelContent from './components/PanelContent'

export type Tab = 'checklist' | 'screenshot' | 'settings'

const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties

function App(): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<Tab>('checklist')

  useEffect(() => {
    let cancelled = false
    window.api?.getPanelState?.().then((s) => {
      if (!cancelled) setExpanded(s)
    })
    const unsub = window.api?.onPanelState?.(setExpanded)
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const toggle = async (): Promise<void> => {
    const optimistic = !expanded
    setExpanded(optimistic)
    if (!window.api?.togglePanel) return
    const actual = await window.api.togglePanel()
    if (actual !== optimistic) setExpanded(actual)
  }

  return (
    <div className="relative h-screen w-screen" style={drag}>
      {expanded && <PanelContent tab={tab} onTabChange={setTab} onClose={toggle} />}
      <FloatingButton onClick={toggle} expanded={expanded} />
    </div>
  )
}

export default App
