import { ClipboardCheck } from 'lucide-react'

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

type Props = {
  onClick: () => void
  expanded: boolean
}

export default function FloatingButton({ onClick, expanded }: Props): React.JSX.Element {
  return (
    <div className="absolute bottom-0 right-0 z-10 flex h-20 w-20 items-center justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-950/90 shadow-[0_10px_30px_rgba(30,58,138,0.5)]">
        <button
          type="button"
          onClick={onClick}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-blue-400 to-blue-600 shadow-inner transition active:scale-95"
          style={noDrag}
          aria-label={expanded ? 'Close panel' : 'Open panel'}
        >
          <ClipboardCheck className="h-5 w-5 text-white" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
