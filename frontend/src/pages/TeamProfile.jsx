import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { getTeamPriorityPositions, getTeamSwot } from '../api/client'
import PositionBadge from '../components/PositionBadge'
import ScoreRing from '../components/ScoreRing'
import RadarChart from '../components/RadarChart'
import { exportToCSV } from '../utils/export'
const SEASONS = ['All Seasons', '2025-26', '2024-25', '2023-24', '2022-23']

const POSITIONS = ['ALL', 'GK', 'DEF', 'MID', 'WNG', 'FWD']

const COLS = [
  { key: 'player_name', label: 'Player', sortable: false },
  { key: 'position_group', label: 'Pos', sortable: false },
  { key: 'age', label: 'Age', sortable: true },
  { key: 'minutes', label: 'Mins', sortable: true },
  { key: 'goals', label: 'G', sortable: true },
  { key: 'assists', label: 'A', sortable: true },
  { key: 'xg', label: 'xG', sortable: true },
  { key: 'xa', label: 'xA', sortable: true },
  { key: 'aerials_won', label: 'Aer', sortable: true },
  { key: 'tackles_won', label: 'Tkl', sortable: true },
  { key: 'rating', label: 'Rating', sortable: true },
  { key: 'score', label: 'Score', sortable: true },
]

const RADAR_METRICS = [
  { key: 'avg_pass_pct', label: 'Pass Acc%' },
  { key: 'avg_key_passes', label: 'Key Passes' },
  { key: 'avg_aerials', label: 'Aerials' },
  { key: 'avg_tackles', label: 'Tackles' },
  { key: 'avg_recoveries', label: 'Recoveries' },
  { key: 'avg_xg', label: 'xG' },
  { key: 'avg_xa', label: 'xA' },
]

const POS_TEXT_COLOR = {
  GK: 'text-purple-400',
  DEF: 'text-blue-400',
  MID: 'text-green-400',
  FWD: 'text-red-400',
}

export default function TeamProfile() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [players, setPlayers] = useState([])
  const [season, setSeason] = useState('2025-26')
  const [posFilter, setPosFilter] = useState('ALL')
  const [sortCol, setSortCol] = useState('score')
  const [sortAsc, setSortAsc] = useState(false)
  const [loading, setLoading] = useState(true)
  const [priorityPositions, setPriorityPositions] = useState([])
  const [priorityOpen, setPriorityOpen] = useState(true)
  const [priorityLoading, setPriorityLoading] = useState(false)
  const [swot, setSwot] = useState(null)
  const [swotLoading, setSwotLoading] = useState(false)
  const [swotError, setSwotError] = useState(null)
  const [swotOpen, setSwotOpen] = useState(false)

  const id = teamId

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.get(`/api/teams/${id}`, { params: { season } }),
      api.get(`/api/teams/${id}/players`, { params: { season } }),
    ]).then(([t, p]) => {
      setTeam(t.data)
      setPlayers(p.data?.players || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id, season])

  useEffect(() => {
    if (!id) return
    setPriorityLoading(true)
    getTeamPriorityPositions(id)
      .then(r => setPriorityPositions(r.data || []))
      .catch(() => setPriorityPositions([]))
      .finally(() => setPriorityLoading(false))
  }, [id])

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(v => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  const filtered = players
    .filter(p => posFilter === 'ALL' || p.position_group === posFilter)
    .sort((a, b) => {
      const va = a[sortCol] ?? 0
      const vb = b[sortCol] ?? 0
      return sortAsc ? va - vb : vb - va
    })

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="h-40 bg-surface-container rounded-xl animate-pulse mb-6" />
        <div className="h-96 bg-surface-container rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="p-8 text-center py-32">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant">group</span>
        <p className="text-on-surface-variant mt-4">Team not found.</p>
        <button onClick={() => navigate(-1)} className="btn-primary mt-4">Go Back</button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface text-sm mb-6 transition-colors"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Back
      </button>

      {/* Team header */}
      <div className="bg-surface-container rounded-xl p-7 mb-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
          <span className="material-symbols-outlined text-blue-400 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-headline font-black text-on-surface">{team.team_name}</h1>
          <p className="text-on-surface-variant">{team.league_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {SEASONS.filter(s => s !== 'All Seasons').map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => exportToCSV(filtered, `${team.team_name}_squad`)} className="btn-secondary text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download</span>
            Export
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Squad Size', value: Math.round(team.squad_size || 0) },
          { label: 'Avg Age', value: Number(team.avg_age || 0).toFixed(1) },
          { label: 'Avg Rating', value: Number(team.avg_rating || 0).toFixed(2) },
        ].map(s => (
          <div key={s.label} className="bg-surface-container rounded-xl p-5 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{s.label}</p>
            <p className="text-3xl font-headline font-black text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Priority Positions panel */}
      <div className="bg-surface-container rounded-xl mb-6 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-bright transition-colors"
          onClick={() => setPriorityOpen(v => !v)}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
            <div className="text-left">
              <p className="font-headline font-black text-on-surface text-sm">Priority Positions</p>
              <p className="text-xs text-on-surface-variant">Positional slots where recruiting would most improve squad performance</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-xl">
            {priorityOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {priorityOpen && (
          <div className="px-6 pb-6 border-t border-outline-variant/10">
            {priorityLoading ? (
              <div className="flex gap-4 mt-4">
                {[1, 2, 3].map(i => <div key={i} className="flex-1 h-28 bg-surface-container-high rounded-xl animate-pulse" />)}
              </div>
            ) : priorityPositions.length === 0 ? (
              <p className="text-on-surface-variant text-sm mt-4">No priority position data available for this squad.</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                {priorityPositions.map((pos) => {
                  const rankColors = ['text-amber-400', 'text-slate-300', 'text-orange-600']
                  const rankBgs = ['bg-amber-400/10', 'bg-slate-300/10', 'bg-orange-600/10']
                  const rankBorders = ['border-amber-400/20', 'border-slate-300/20', 'border-orange-600/20']
                  const idx = (pos.priority_rank || 1) - 1
                  return (
                    <div
                      key={pos.position_group}
                      className={`flex-1 rounded-xl border p-4 ${rankBgs[idx]} ${rankBorders[idx]}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black font-headline ${POS_TEXT_COLOR[pos.position_group] || 'text-on-surface'}`}>
                            {pos.position_group}
                          </span>
                          <PositionBadge position={pos.position_group} />
                        </div>
                        <span className={`text-[10px] font-black font-headline px-2 py-0.5 rounded-full border ${rankColors[idx]} ${rankBorders[idx]}`}>
                          #{pos.priority_rank}
                        </span>
                      </div>

                      {/* Gap indicator */}
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-on-surface-variant mb-1">
                          <span>Squad avg</span>
                          <span>League avg</span>
                        </div>
                        <div className="relative h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className="absolute left-0 top-0 h-full bg-red-500/70 rounded-full"
                            style={{ width: `${Math.min((pos.squad_avg_score / 100) * 100, 100)}%` }}
                          />
                          <div
                            className="absolute top-0 h-full w-0.5 bg-blue-400"
                            style={{ left: `${Math.min(pos.league_avg_score, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono mt-1">
                          <span className="text-red-400">{pos.squad_avg_score}</span>
                          <span className="text-blue-400">{pos.league_avg_score}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="text-center">
                          <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Gap</p>
                          <p className="text-lg font-black font-headline text-red-400">{pos.gap_score}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Uplift</p>
                          <p className="text-lg font-black font-headline text-green-400">+{pos.uplift_potential}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Players</p>
                          <p className="text-lg font-black font-headline text-on-surface">{pos.squad_player_count}</p>
                        </div>
                      </div>

                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{pos.justification}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Squad table */}
        <div className="xl:col-span-2 bg-surface-container rounded-xl overflow-hidden">
          {/* Position filter tabs */}
          <div className="flex items-center gap-1 p-3 border-b border-outline-variant/10 flex-wrap">
            {POSITIONS.map(pos => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  posFilter === pos ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-bright'
                }`}
              >
                {pos}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-on-surface-variant">{filtered.length} players</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  {COLS.map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-3 text-left font-bold uppercase tracking-wider text-on-surface-variant ${col.sortable ? 'cursor-pointer hover:text-on-surface' : ''}`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      {col.label}
                      {sortCol === col.key && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtered.map(p => (
                  <tr
                    key={p.player_id}
                    className="hover:bg-surface-bright cursor-pointer transition-colors"
                    onClick={() => navigate(`/players/${p.player_id}`)}
                  >
                    <td className="px-3 py-3 font-bold text-on-surface">{p.player_name}</td>
                    <td className="px-3 py-3"><PositionBadge position={p.position_group} /></td>
                    <td className="px-3 py-3 font-mono text-on-surface-variant">{Math.round(p.age || 0)}</td>
                    <td className="px-3 py-3 font-mono text-on-surface-variant">{Math.round(p.minutes || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 font-mono text-on-surface-variant">{Math.round(p.goals || 0)}</td>
                    <td className="px-3 py-3 font-mono text-on-surface-variant">{Math.round(p.assists || 0)}</td>
                    <td className="px-3 py-3 font-mono text-primary">{Number(p.xg || 0).toFixed(2)}</td>
                    <td className="px-3 py-3 font-mono text-primary">{Number(p.xa || 0).toFixed(2)}</td>
                    <td className="px-3 py-3 font-mono text-on-surface-variant">{Math.round(p.aerials_won || 0)}</td>
                    <td className="px-3 py-3 font-mono text-on-surface-variant">{Math.round(p.tackles_won || 0)}</td>
                    <td className="px-3 py-3 font-mono text-on-surface-variant">{Number(p.rating || 0).toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <ScoreRing score={p.score || 0} size={28} strokeWidth={3} />
                        <span className="font-mono font-bold text-primary text-[10px]">{Math.round(p.score || 0)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team radar */}
        <div className="bg-surface-container rounded-xl p-5">
          <p className="label-xs mb-1">Team Profile</p>
          <p className="text-xs text-on-surface-variant mb-4">Average metrics vs league</p>
          <RadarChart metrics={RADAR_METRICS} player={team} />
        </div>
      </div>

      {/* SWOT Analysis — collapsible panel */}
      <div className="bg-surface-container rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => {
            const next = !swotOpen
            setSwotOpen(next)
            if (next && !swot && !swotLoading) {
              setSwotLoading(true)
              setSwotError(null)
              getTeamSwot(id)
                .then(res => setSwot(res.data))
                .catch(() => setSwotError('Failed to load SWOT analysis.'))
                .finally(() => setSwotLoading(false))
            }
          }}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-bright transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
            <div>
              <p className="font-bold text-on-surface text-sm">SWOT Analysis</p>
              <p className="text-[10px] text-on-surface-variant">Squad strengths, weaknesses, opportunities &amp; threats — {swot?.season ?? 'current season'}</p>
            </div>
          </div>
          <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${swotOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </button>
        {swotOpen && (
          <div className="px-6 pb-6">
            {swotLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map(i => <div key={i} className="h-36 bg-surface-bright rounded-xl animate-pulse" />)}
              </div>
            )}
            {swotError && !swotLoading && <p className="text-red-400 text-sm text-center py-6">{swotError}</p>}
            {swot && !swotLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SwotQuadrant icon="trending_up" title="Strengths" items={swot.swot.strengths} colorClass="border-green-500/40" headerClass="text-green-400" badgeClass="bg-green-500/10 text-green-400" />
                <SwotQuadrant icon="trending_down" title="Weaknesses" items={swot.swot.weaknesses} colorClass="border-red-500/40" headerClass="text-red-400" badgeClass="bg-red-500/10 text-red-400" />
                <SwotQuadrant icon="lightbulb" title="Opportunities" items={swot.swot.opportunities} colorClass="border-blue-500/40" headerClass="text-blue-400" badgeClass="bg-blue-500/10 text-blue-400" showPercentile />
                <SwotQuadrant icon="warning" title="Threats" items={swot.swot.threats} colorClass="border-amber-500/40" headerClass="text-amber-400" badgeClass="bg-amber-500/10 text-amber-400" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SwotQuadrant({ icon, title, items, colorClass, headerClass, badgeClass, showPercentile }) {
  return (
    <div className={`rounded-xl border-2 ${colorClass} bg-surface-bright/40 p-4`}>
      <div className={`flex items-center gap-2 mb-3 ${headerClass}`}>
        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest">{title}</span>
      </div>
      {items && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-on-surface-variant">
              <span className={`material-symbols-outlined text-xs mt-0.5 shrink-0 ${headerClass}`}>fiber_manual_record</span>
              <span className="flex-1 leading-relaxed">{item.text}</span>
              {showPercentile && item.percentile != null && (
                <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{item.percentile}th</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-on-surface-variant/50 italic">None identified</p>
      )}
    </div>
  )
}
