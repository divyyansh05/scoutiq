import { useNavigate } from 'react-router-dom'

function Initials({ name }) {
  const parts = (name || 'XX').split(' ')
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.substring(0, 2)
  return (
    <div className="w-8 h-8 rounded-full bg-surface-container-highest border-2 border-background flex items-center justify-center">
      <span className="text-[10px] font-bold text-primary">{initials.toUpperCase()}</span>
    </div>
  )
}

export default function ComparisonBar({ selected, onClear }) {
  const navigate = useNavigate()
  if (!selected || selected.length < 1) return null

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div className="glass-panel px-6 py-4 rounded-full flex items-center gap-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {selected.slice(0, 4).map(p => (
              <Initials key={p.player_id} name={p.player_name} />
            ))}
          </div>
          <span className="text-xs font-bold font-headline tracking-wide text-on-surface">
            <span className="text-primary">{selected.length}</span> Player{selected.length > 1 ? 's' : ''} Selected
          </span>
        </div>
        <div className="w-px h-6 bg-outline-variant/20" />
        {selected.length >= 2 && (
          <button
            onClick={() => navigate(`/similar?player_id=${selected[0].player_id}`)}
            className="bg-primary text-white px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all"
          >
            VIEW SIMILARITY
          </button>
        )}
        <button
          onClick={onClear}
          className="text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
