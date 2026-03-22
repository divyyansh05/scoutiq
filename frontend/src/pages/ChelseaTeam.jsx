import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getChelseaFull } from '../api/client'
import { SEASONS } from './Dashboard'
import PositionBadge from '../components/PositionBadge'
import ScoreRing from '../components/ScoreRing'

const POSITIONS = ['All', 'GK', 'DEF', 'MID', 'WNG', 'FWD']

const POSITION_MAP = {
  GK: 'GK', Goalkeeper: 'GK',
  CB: 'DEF', 'Center Back': 'DEF', RB: 'DEF', LB: 'DEF', RWB: 'DEF', LWB: 'DEF',
  DC: 'DEF', DL: 'DEF', DR: 'DEF',
  CM: 'MID', DM: 'MID', AM: 'MID', CDM: 'MID', CAM: 'MID', MC: 'MID',
  LW: 'WNG', RW: 'WNG', LM: 'WNG', RM: 'WNG', ML: 'WNG', MR: 'WNG',
  ST: 'FWD', CF: 'FWD', SS: 'FWD', FW: 'FWD',
}

function normalizePos(pos) {
  if (!pos) return 'MID'
  return POSITION_MAP[pos.trim()] || 'MID'
}

const COLS = [
  { key: 'player_name', label: 'Player',   num: false },
  { key: 'position',    label: 'Pos',      num: false },
  { key: 'age',         label: 'Age',      num: true  },
  { key: 'minutes',     label: 'Mins',     num: true  },
  { key: 'goals',       label: 'Gls',      num: true  },
  { key: 'assists',     label: 'Ast',      num: true  },
  { key: 'xg',         label: 'xG',       num: true  },
  { key: 'xa',         label: 'xA',       num: true  },
  { key: 'aerials_won', label: 'Aerials',  num: true  },
  { key: 'rating',      label: 'Rating',   num: true  },
  { key: 'score',       label: 'Score',    num: true  },
]

export default function ChelseaTeam() {
  const navigate = useNavigate()
  const [season, setSeason] = useState('2025-26')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sortCol, setSortCol] = useState('minutes')
  const [sortAsc, setSortAsc] = useState(false)
  const [posFilter, setPosFilter] = useState('All')

  const seasonOptions = SEASONS.filter(s => s !== 'All Seasons')

  useEffect(() => {
    setLoading(true)
    getChelseaFull(season)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [season])

  const handleSort = useCallback((col) => {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }, [sortCol])

  const players = data?.players || []

  // Apply position filter
  const filtered = posFilter === 'All'
    ? players
    : players.filter(p => {
        const pg = p.position_group || normalizePos(p.position)
        return pg === posFilter
      })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortCol] ?? 0
    const vb = b[sortCol] ?? 0
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    return sortAsc ? va - vb : vb - va
  })

  // Summary stats
  const avgAge   = players.length ? (players.reduce((s, p) => s + (p.age || 0), 0) / players.length).toFixed(1) : '—'
  const avgScore = players.length ? Math.round(players.reduce((s, p) => s + (p.score || 0), 0) / players.length) : '—'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface text-sm mb-6 transition-colors"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Dashboard
      </button>

      {/* Team header */}
      <div className="bg-surface-container rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
          <span className="material-symbols-outlined text-blue-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-headline font-black text-on-surface">Chelsea FC</h1>
          <p className="text-on-surface-variant mt-0.5">Premier League</p>
        </div>

        {/* Season selector */}
        <div className="flex items-center gap-2 bg-surface-container-high rounded-xl p-1">
          {seasonOptions.map(s => (
            <button
              key={s}
              onClick={() => setSeason(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                season === s ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Squad overview stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Squad Size', value: players.length || '—' },
          { label: 'Avg Age',    value: avgAge },
          { label: 'Avg Score',  value: avgScore },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-container rounded-xl p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{label}</p>
            <p className="text-3xl font-headline font-black text-primary">{value}</p>
          </div>
        ))}
      </div>

      {/* Position filter pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {POSITIONS.map(pos => (
          <button
            key={pos}
            onClick={() => setPosFilter(pos)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              posFilter === pos
                ? 'bg-primary text-white'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'
            }`}
          >
            {pos}
          </button>
        ))}
        <span className="text-xs text-on-surface-variant ml-2">{sorted.length} players</span>
      </div>

      {/* Table */}
      <div className="bg-surface-container rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">
            {Array(10).fill(0).map((_, i) => <div key={i} className="h-10 bg-surface-container-high rounded-lg animate-pulse" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">person_off</span>
            <p className="text-on-surface-variant mt-3">No players found for {season}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-outline-variant/10">
                <tr>
                  {COLS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-3 text-left cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary">
                        {col.label}
                        {sortCol === col.key && (
                          <span className="material-symbols-outlined text-xs text-primary">
                            {sortAsc ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {sorted.map(player => {
                  const pg = player.position_group || normalizePos(player.position)
                  return (
                    <tr
                      key={player.player_id}
                      onClick={() => navigate(`/players/${player.player_id}`)}
                      className="hover:bg-surface-bright transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold text-on-surface group-hover:text-primary transition-colors truncate max-w-40">
                          {player.player_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <PositionBadge position={pg} />
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono">{player.age || '—'}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono">{Math.round(player.minutes || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono">{player.goals || 0}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono">{player.assists || 0}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono">{Number(player.xg || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono">{Number(player.xa || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono">{player.aerials_won || 0}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono">{Number(player.rating || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {player.score > 0 ? (
                          <ScoreRing score={player.score} size={32} strokeWidth={3} />
                        ) : (
                          <span className="text-on-surface-variant text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
