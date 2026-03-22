import { useNavigate } from 'react-router-dom'
import PositionBadge from './PositionBadge'

function Initials({ name }) {
  const parts = (name || 'UN').split(' ')
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : (name || 'UN').substring(0, 2)
  return (
    <div className="w-14 h-14 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant/20">
      <span className="font-headline font-bold text-primary text-lg">{initials.toUpperCase()}</span>
    </div>
  )
}

export default function PlayerCard({ player, selected, onToggleSelect }) {
  const navigate = useNavigate()
  const {
    player_id, player_name, position_group, team_name, league_name,
    season_name, score, xg_per90, xa_per90, aerials_per90, rating
  } = player

  return (
    <div
      className={`
        bg-surface-container hover:bg-surface-bright transition-all duration-300
        rounded-xl p-5 relative group overflow-hidden cursor-pointer
        ${selected ? 'ring-2 ring-primary/60' : ''}
      `}
      onClick={() => navigate(`/players/${player_id}`)}
    >
      {/* Checkbox */}
      <div className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect && onToggleSelect(player)}
          className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
          title="Add to comparison"
        />
      </div>

      <div className="flex gap-4">
        <Initials name={player_name} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className="font-headline font-bold text-on-surface text-base truncate">{player_name}</h3>
            <PositionBadge position={position_group} />
          </div>
          <p className="text-xs text-on-surface-variant truncate">{team_name} · {league_name}</p>
          {season_name && (
            <p className="text-[10px] font-bold text-primary font-mono tracking-wider mt-1">
              SEASON: {season_name}
            </p>
          )}
        </div>

        {score != null && (
          <div className="shrink-0 text-right">
            <div className="text-xl font-headline font-bold text-primary">{Math.round(score)}</div>
            <div className="text-[9px] text-primary/60 font-bold uppercase tracking-widest">Score</div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="mt-4 pt-4 border-t border-outline-variant/10 grid grid-cols-4 gap-2">
        {[
          { label: 'XG/90', value: xg_per90 != null ? Number(xg_per90).toFixed(2) : '—' },
          { label: 'XA/90', value: xa_per90 != null ? Number(xa_per90).toFixed(2) : '—' },
          { label: 'AERIALS', value: aerials_per90 != null ? Number(aerials_per90).toFixed(1) : '—' },
          { label: 'RATING', value: rating != null ? Number(rating).toFixed(2) : '—' },
        ].map((stat, i) => (
          <div key={i} className={`text-center ${i > 0 ? 'border-l border-outline-variant/10' : ''}`}>
            <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">{stat.label}</p>
            <p className="text-sm font-mono font-bold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
