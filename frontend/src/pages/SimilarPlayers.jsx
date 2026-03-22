import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { globalSearch, getPlayer, getSimilarPlayers } from '../api/client'
import api from '../api/client'
import PositionBadge from '../components/PositionBadge'
import RadarChart from '../components/RadarChart'
import { exportToCSV } from '../utils/export'
import { SEASONS } from './Dashboard'

const RADAR_METRICS = [
  { key: 'xg_per90',        label: 'xG/90' },
  { key: 'xa_per90',        label: 'xA/90' },
  { key: 'goals_per90',     label: 'Goals/90' },
  { key: 'assists_per90',   label: 'Assists/90' },
  { key: 'aerials_per90',   label: 'Aerials' },
  { key: 'tackles_per90',   label: 'Tackles' },
]

function PlayerSearchBox({ onSelect, placeholder }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const debounce = useRef(null)

  useEffect(() => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      globalSearch(q).then(r => {
        setResults((r.data || []).filter(x => x.type === 'player'))
        setOpen(true)
      }).catch(() => {})
    }, 300)
    return () => clearTimeout(debounce.current)
  }, [q])

  const select = (item) => {
    setOpen(false)
    setQ('')
    onSelect(item.player_id)
  }

  return (
    <div className="relative">
      <div className="flex items-center bg-surface-container-high rounded-lg px-4 gap-3 border border-outline-variant/20">
        <span className="material-symbols-outlined text-on-surface-variant text-base">person_search</span>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent py-2.5 text-sm text-on-surface placeholder:text-slate-600 focus:outline-none w-full"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-highest rounded-xl shadow-2xl border border-outline-variant/20 z-30 overflow-hidden">
          {results.map((item, i) => (
            <button
              key={i}
              onClick={() => select(item)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-bright transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary text-base">person</span>
              <div>
                <p className="text-sm font-bold text-on-surface">{item.name}</p>
                <p className="text-xs text-on-surface-variant">{item.subtitle} {item.position ? `· ${item.position}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SimilarPlayerRow({ player, onSelect, selected }) {
  const navigate = useNavigate()
  const pct = Math.round(player.similarity || 0)
  const barColor = pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-500'

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 hover:bg-surface-bright cursor-pointer transition-colors group ${selected ? 'bg-blue-600/5' : ''}`}
      onClick={() => navigate(`/players/${player.player_id}`)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors truncate">
            {player.player_name}
          </p>
          <PositionBadge position={player.position_group} />
        </div>
        <p className="text-xs text-on-surface-variant truncate">{player.team_name} · {player.league_name}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-xs font-mono font-bold text-on-surface-variant">xG</p>
          <p className="text-sm font-bold font-mono text-primary">{Number(player.xg_per90 || 0).toFixed(2)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono font-bold text-on-surface-variant">xA</p>
          <p className="text-sm font-bold font-mono text-primary">{Number(player.xa_per90 || 0).toFixed(2)}</p>
        </div>
        <div className="text-right min-w-16">
          <p className="text-xs font-bold text-on-surface-variant mb-1">Match</p>
          <div className="h-1 w-16 bg-surface-container-highest rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs font-bold font-mono text-right mt-0.5" style={{ color: pct >= 85 ? '#22c55e' : pct >= 70 ? '#3b82f6' : '#f59e0b' }}>
            {pct}%
          </p>
        </div>
        <button
          className="text-on-surface-variant hover:text-primary transition-colors p-1"
          onClick={e => { e.stopPropagation(); onSelect(player) }}
          title="Compare"
        >
          <span className="material-symbols-outlined text-base">compare_arrows</span>
        </button>
      </div>
    </div>
  )
}

export default function SimilarPlayers() {
  const [searchParams] = useSearchParams()
  const initId = searchParams.get('player_id')
  const navigate = useNavigate()

  const [targetId, setTargetId] = useState(initId ? Number(initId) : null)
  const [target, setTarget] = useState(null)
  const [similar, setSimilar] = useState([])
  const [comparison, setComparison] = useState(null)
  const [adaptability, setAdaptability] = useState(null)
  const [n, setN] = useState(15)
  const [season, setSeason] = useState('2025-26')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!targetId) return
    setLoading(true)
    const seasonParam = season === 'All Seasons' ? undefined : season
    Promise.all([
      getPlayer(targetId, seasonParam ? { season: seasonParam } : {}),
      getSimilarPlayers(targetId, { n, season: seasonParam }),
    ]).then(([p, s]) => {
      setTarget(p.data)
      setSimilar(s.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [targetId, n, season])

  useEffect(() => {
    if (!targetId) return
    const seasonParam = season === 'All Seasons' ? '2025-26' : season
    api.get(`/api/players/${targetId}/adaptability`, { params: { season: seasonParam } })
      .then(r => setAdaptability(r.data))
      .catch(() => setAdaptability(null))
  }, [targetId, season])

  // Compute top 3 similarity factors (metrics where target ≈ comparison)
  const similarityFactors = comparison && target ? (() => {
    const metrics = [
      { key: 'xg_per90', label: 'xG/90' },
      { key: 'xa_per90', label: 'xA/90' },
      { key: 'aerials_per90', label: 'Aerials' },
      { key: 'tackles_per90', label: 'Tackles' },
    ]
    return metrics
      .filter(m => target[m.key] && comparison[m.key])
      .map(m => ({
        label: m.label,
        diff: Math.abs(target[m.key] - comparison[m.key]) / (Math.max(target[m.key], comparison[m.key]) || 1),
      }))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 3)
      .map(m => m.label)
  })() : []

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Analysis</p>
        <h1 className="text-4xl font-headline font-black text-on-surface">Similar Players</h1>
        <p className="text-on-surface-variant text-sm mt-1">Cosine similarity engine — position-normalised feature vectors.</p>
      </div>

      {/* Player selector */}
      <div className="bg-surface-container rounded-xl p-5 mb-6">
        <label className="label-xs block mb-3">Select Target Player</label>
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <PlayerSearchBox onSelect={setTargetId} placeholder="Search for a player…" />
          </div>
          <div>
            <label className="label-xs block mb-1.5">Season</label>
            <select
              value={season}
              onChange={e => setSeason(e.target.value)}
              className="bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2.5 border border-outline-variant/20 focus:outline-none"
            >
              {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label-xs block mb-1.5">Results</label>
            <select
              value={n}
              onChange={e => setN(Number(e.target.value))}
              className="bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2.5 border border-outline-variant/20 focus:outline-none"
            >
              {[5, 10, 15, 20, 30].map(v => <option key={v} value={v}>{v} players</option>)}
            </select>
          </div>
          {similar.length > 0 && (
            <div className="mt-5">
              <button onClick={() => exportToCSV(similar, 'similar_players')} className="btn-secondary text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">download</span>
                Export
              </button>
            </div>
          )}
        </div>

        {target && (
          <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/20">
              <span className="font-headline font-bold text-primary text-lg">
                {(target.player_name || 'XX').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface">{target.player_name}</p>
              <p className="text-xs text-on-surface-variant">{target.team_name} · {target.league_name}</p>
            </div>
            <PositionBadge position={target.position_group} />
            {similar.length > 0 && (
              <span className="text-xs text-on-surface-variant">
                Comparing against {similar.length} {target.position_group} players with 450+ min
              </span>
            )}
            <button
              onClick={() => navigate(`/players/${target.player_id}`)}
              className="ml-auto text-xs text-primary hover:text-primary-dim font-bold uppercase tracking-wider"
            >
              View Profile →
            </button>
          </div>
        )}
      </div>

      {!targetId ? (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">groups</span>
          <p className="text-on-surface-variant mt-4">Search for a player above to find similar profiles.</p>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array(8).fill(0).map((_, i) => <div key={i} className="h-16 bg-surface-container rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Similar list */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-surface-container rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant/10">
                <p className="label-xs">Similarity Results · {similar.length} found</p>
              </div>
              {similar.length === 0 ? (
                <p className="px-5 py-8 text-center text-on-surface-variant text-sm">No similar players found for this dataset.</p>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {similar.map(p => (
                    <SimilarPlayerRow
                      key={p.player_id}
                      player={p}
                      selected={comparison?.player_id === p.player_id}
                      onSelect={setComparison}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Team Fit Analysis */}
            {adaptability?.teams?.length > 0 && (
              <div className="bg-surface-container rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10">
                  <p className="label-xs">Team Fit Analysis</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Compatibility based on playing style match</p>
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {adaptability.teams.map((team, i) => (
                    <div key={team.team_id} className="flex items-center gap-4 px-5 py-3">
                      <span className="w-6 text-center text-xs font-bold font-mono text-on-surface-variant">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{team.team_name}</p>
                        <p className="text-xs text-on-surface-variant">{team.league_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="h-1 w-20 bg-surface-container-highest rounded-full overflow-hidden mb-1">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.abs(team.compatibility_pct)}%` }}
                          />
                        </div>
                        <p className="text-xs font-bold font-mono text-primary">{Number(team.compatibility_pct || 0).toFixed(0)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Radar comparison */}
          <div className="space-y-4">
            <div className="bg-surface-container rounded-xl p-5">
              <p className="label-xs mb-1">Radar Comparison</p>
              <p className="text-xs text-on-surface-variant mb-4">Click compare icon to overlay a player.</p>
              {target ? (
                <RadarChart
                  metrics={RADAR_METRICS}
                  player={target}
                  comparison={comparison}
                />
              ) : (
                <p className="text-xs text-on-surface-variant text-center py-8">Select a player first.</p>
              )}
            </div>

            {comparison && (
              <div className="bg-surface-container rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="label-xs">Comparing</p>
                  <button onClick={() => setComparison(null)} className="text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-on-surface">{target?.player_name}</p>
                    <p className="text-[11px] text-on-surface-variant">{target?.team_name}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="w-2 h-2 rounded-full bg-tertiary mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-on-surface">{comparison.player_name}</p>
                    <p className="text-[11px] text-on-surface-variant">{comparison.team_name}</p>
                  </div>
                </div>
                {similarityFactors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-outline-variant/10">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">High correlation in:</p>
                    <p className="text-xs text-primary font-bold">{similarityFactors.join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
