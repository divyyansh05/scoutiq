import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWeightedRanking } from '../api/client'
import PositionBadge from '../components/PositionBadge'
import { exportToCSV } from '../utils/export'
import { SEASONS } from './Dashboard'

const METRIC_GROUPS = {
  ATTACKING: [
    { key: 'xg', label: 'xG' }, { key: 'xa', label: 'xA' }, { key: 'npxg', label: 'npxG' },
    { key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' },
    { key: 'big_chances_created', label: 'Big Chances Created' },
    { key: 'shots_inside_box', label: 'Shots Inside Box' },
    { key: 'dribbles_completed', label: 'Successful Dribbles' },
  ],
  DEFENSIVE: [
    { key: 'aerials_won', label: 'Aerial Duels Won' }, { key: 'aerial_win_pct', label: 'Aerial Win%' },
    { key: 'tackles_won', label: 'Tackles Won' }, { key: 'tackles_won_pct', label: 'Tackles Won%' },
    { key: 'interceptions', label: 'Interceptions' }, { key: 'clearances', label: 'Clearances' },
    { key: 'recoveries', label: 'Recoveries' }, { key: 'dispossessed', label: 'Dispossessed' },
  ],
  PASSING: [
    { key: 'key_passes', label: 'Key Passes' }, { key: 'accurate_passes_pct', label: 'Pass Accuracy%' },
    { key: 'accurate_final_third', label: 'Final Third Passes' },
    { key: 'possession_won_att_third', label: 'Poss. Won Att Third' },
  ],
  GENERAL: [
    { key: 'sofascore_rating', label: 'SofaScore Rating' },
    { key: 'big_chances_missed', label: 'Big Chances Missed' },
  ],
}

const POSITIONS = ['', 'GK', 'DEF', 'MID', 'WNG', 'FWD']
const LEAGUES = ['', 'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']

function stars(score) {
  const n = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 45 ? 2 : 1
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

export default function MetricWeighting() {
  const navigate = useNavigate()
  const [weights, setWeights] = useState({})
  const [season, setSeason] = useState('2025-26')
  const [position, setPosition] = useState('')
  const [league, setLeague] = useState('')
  const [minMinutes, setMinMinutes] = useState(450)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [calculated, setCalculated] = useState(false)

  const setWeight = (key, val) => setWeights(w => ({ ...w, [key]: Number(val) }))

  const activeWeights = Object.fromEntries(Object.entries(weights).filter(([, v]) => v > 0))

  const handleCalculate = async () => {
    if (Object.keys(activeWeights).length === 0) return
    setLoading(true)
    try {
      const res = await getWeightedRanking({
        weights: activeWeights,
        season,
        position: position || null,
        league: league || null,
        min_minutes: minMinutes,
        limit: 50,
      })
      setResults(res.data.players || [])
      setCalculated(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setWeights({})
    setResults([])
    setCalculated(false)
  }

  const activeMetrics = Object.keys(activeWeights)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Intelligence</p>
        <h1 className="text-4xl font-headline font-black text-on-surface">Metric Weighting</h1>
        <p className="text-on-surface-variant text-sm mt-1">Build your own scout score. Assign weights 0–5 to any metric.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left panel: controls */}
        <div className="xl:col-span-1 space-y-4">
          {/* Filters */}
          <div className="bg-surface-container rounded-xl p-5 space-y-4">
            <p className="label-xs">Filters</p>
            <div>
              <label className="label-xs block mb-1.5">Season</label>
              <select value={season} onChange={e => setSeason(e.target.value)}
                className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none">
                {SEASONS.filter(s => s !== 'All Seasons').map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs block mb-1.5">Position</label>
              <select value={position} onChange={e => setPosition(e.target.value)}
                className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none">
                {POSITIONS.map(p => <option key={p} value={p}>{p || 'All'}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs block mb-1.5">League</label>
              <select value={league} onChange={e => setLeague(e.target.value)}
                className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none">
                {LEAGUES.map(l => <option key={l} value={l}>{l || 'All Leagues'}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs block mb-1.5">Min Minutes: {minMinutes}</label>
              <input type="range" min="100" max="2000" step="50" value={minMinutes}
                onChange={e => setMinMinutes(Number(e.target.value))}
                className="w-full accent-blue-500" />
            </div>
          </div>

          {/* Metric sliders */}
          {Object.entries(METRIC_GROUPS).map(([group, metrics]) => (
            <div key={group} className="bg-surface-container rounded-xl p-5">
              <p className="label-xs mb-3">{group}</p>
              <div className="space-y-3">
                {metrics.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold flex-1 ${weights[key] > 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {label}
                    </span>
                    <input
                      type="range" min="0" max="5" step="1"
                      value={weights[key] || 0}
                      onChange={e => setWeight(key, e.target.value)}
                      className="w-24 accent-blue-500"
                    />
                    <span className={`text-xs font-mono font-bold w-4 text-right ${weights[key] > 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {weights[key] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleCalculate}
              disabled={Object.keys(activeWeights).length === 0 || loading}
              className="btn-primary flex-1 disabled:opacity-40"
            >
              {loading ? 'Calculating…' : 'Calculate'}
            </button>
            <button onClick={handleReset} className="btn-secondary">Reset</button>
          </div>
          {Object.keys(activeWeights).length > 0 && (
            <p className="text-xs text-on-surface-variant text-center">
              {Object.keys(activeWeights).length} metric{Object.keys(activeWeights).length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Right panel: results */}
        <div className="xl:col-span-2">
          {!calculated ? (
            <div className="bg-surface-container rounded-xl flex flex-col items-center justify-center py-32">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4">tune</span>
              <p className="text-on-surface-variant text-sm">Set weights on the left, then click Calculate.</p>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {Array(10).fill(0).map((_, i) => <div key={i} className="h-14 bg-surface-container rounded-xl animate-pulse" />)}
            </div>
          ) : results.length === 0 ? (
            <div className="bg-surface-container rounded-xl flex flex-col items-center justify-center py-32">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4">search_off</span>
              <p className="text-on-surface-variant text-sm">No players found. Try loosening filters.</p>
            </div>
          ) : (
            <div className="bg-surface-container rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
                <p className="label-xs">{results.length} players ranked</p>
                <button onClick={() => exportToCSV(results, 'weighted_ranking')} className="btn-secondary text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">download</span>
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant/10">
                      <th className="px-3 py-3 text-left font-bold uppercase tracking-wider text-on-surface-variant w-10">#</th>
                      <th className="px-3 py-3 text-left font-bold uppercase tracking-wider text-on-surface-variant">Player</th>
                      <th className="px-3 py-3 text-left font-bold uppercase tracking-wider text-on-surface-variant">Pos</th>
                      <th className="px-3 py-3 text-left font-bold uppercase tracking-wider text-on-surface-variant">Team</th>
                      <th className="px-3 py-3 text-left font-bold uppercase tracking-wider text-on-surface-variant">Score</th>
                      {activeMetrics.slice(0, 4).map(m => (
                        <th key={m} className="px-3 py-3 text-right font-bold uppercase tracking-wider text-on-surface-variant">{m.replace(/_/g,' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {results.map(p => (
                      <tr
                        key={p.player_id}
                        className="hover:bg-surface-bright cursor-pointer transition-colors"
                        onClick={() => navigate(`/players/${p.player_id}`)}
                      >
                        <td className="px-3 py-3 font-mono font-bold text-on-surface-variant">#{p.rank}</td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-on-surface">{p.player_name}</p>
                          <p className="text-on-surface-variant">{p.league_name}</p>
                        </td>
                        <td className="px-3 py-3"><PositionBadge position={p.position_group} /></td>
                        <td className="px-3 py-3 text-on-surface-variant">{p.team_name}</td>
                        <td className="px-3 py-3">
                          <p className="font-mono font-bold text-primary">{Number(p.composite_score || 0).toFixed(1)}</p>
                          <p className="text-amber-400">{stars(p.composite_score || 0)}</p>
                        </td>
                        {activeMetrics.slice(0, 4).map(m => (
                          <td key={m} className="px-3 py-3 text-right font-mono text-primary">
                            {Number(p[m] || 0).toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
