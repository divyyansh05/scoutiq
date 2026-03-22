import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRankings } from '../api/client'
import PositionBadge from '../components/PositionBadge'
import { exportToCSV } from '../utils/export'
import { SEASONS } from './Dashboard'

const POSITIONS_FILTER = ['', 'GK', 'DEF', 'MID', 'WNG', 'FWD']
const LEAGUES = ['', 'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']

const MEDAL = { 1: '#f59e0b', 2: '#94a3b8', 3: '#cd7c3f' }

export default function Rankings() {
  const navigate = useNavigate()
  const [data, setData] = useState({ rankings: [], metric: 'xg', metric_label: 'xG', per90: true, total: 0, available_metrics: [] })
  const [controls, setControls] = useState({
    metric: 'xg',
    season: '2025-26',
    position: '',
    league: '',
    min_minutes: 450,
    per90: true,
    limit: 50,
  })
  const [loading, setLoading] = useState(false)

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRankings(controls)
      setData(res.data)
    } catch {
      setData(d => ({ ...d, rankings: [] }))
    } finally {
      setLoading(false)
    }
  }, [controls])

  useEffect(() => { fetchRankings() }, [fetchRankings])

  const setC = (k, v) => setControls(c => ({ ...c, [k]: v }))

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Analysis</p>
          <h1 className="text-4xl font-headline font-black text-on-surface">Statistical Rankings</h1>
          <p className="text-on-surface-variant text-sm mt-1">Cross-league leaderboard for any metric.</p>
        </div>
        <button onClick={() => exportToCSV(data.rankings, `rankings_${controls.metric}`)} className="btn-secondary flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">download</span>
          Export CSV
        </button>
      </div>

      {/* Controls */}
      <div className="bg-surface-container rounded-xl p-5 mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
        <div>
          <label className="label-xs block mb-1.5">Season</label>
          <select
            value={controls.season}
            onChange={e => setC('season', e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {SEASONS.filter(s => s !== 'All Seasons').map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Metric</label>
          <select
            value={controls.metric}
            onChange={e => setC('metric', e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {(data.available_metrics || []).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Position</label>
          <select
            value={controls.position}
            onChange={e => setC('position', e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {POSITIONS_FILTER.map(p => <option key={p} value={p}>{p || 'All'}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">League</label>
          <select
            value={controls.league}
            onChange={e => setC('league', e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {LEAGUES.map(l => <option key={l} value={l}>{l || 'All Leagues'}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Min Min.</label>
          <div className="flex items-center gap-2">
            <input
              type="range" min="100" max="2000" step="50"
              value={controls.min_minutes}
              onChange={e => setC('min_minutes', Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-xs font-mono font-bold text-primary w-10">{controls.min_minutes}</span>
          </div>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Per-90</label>
          <button
            onClick={() => setC('per90', !controls.per90)}
            className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              controls.per90 ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {controls.per90 ? 'Per-90 ON' : 'Per-90 OFF'}
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-2">
          {Array(10).fill(0).map((_, i) => <div key={i} className="h-14 bg-surface-container rounded-xl animate-pulse" />)}
        </div>
      ) : data.rankings.length === 0 ? (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">leaderboard</span>
          <p className="text-on-surface-variant mt-4">No data found. Try adjusting filters.</p>
        </div>
      ) : (
        <div className="bg-surface-container rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <p className="label-xs">{data.metric_label} {data.per90 ? '(Per 90)' : '(Total)'} · {data.total} players</p>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {data.rankings.map(p => {
              const rank = p.rank
              const medalColor = MEDAL[rank]
              return (
                <div
                  key={`${p.player_id}-${rank}`}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-surface-bright cursor-pointer transition-colors ${rank <= 3 ? 'bg-surface-container-high/50' : ''}`}
                  onClick={() => navigate(`/players/${p.player_id}`)}
                >
                  <span
                    className="w-8 text-center text-sm font-headline font-black shrink-0"
                    style={{ color: medalColor || '#a3aac4' }}
                  >
                    #{rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-bold text-on-surface truncate">{p.player_name}</p>
                    <p className="text-xs text-on-surface-variant truncate">{p.team_name} · {p.league_name}</p>
                  </div>
                  <PositionBadge position={p.position_group} />
                  <div className="text-right shrink-0">
                    <p className="text-xs text-on-surface-variant">Age {p.age}</p>
                  </div>
                  <div className="text-right shrink-0 min-w-16">
                    <p className="text-2xl font-headline font-black text-primary">
                      {Number(p.metric_value || 0).toFixed(3)}
                    </p>
                    <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">{data.metric_label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
