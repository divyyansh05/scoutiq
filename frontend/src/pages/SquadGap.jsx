import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSquadDiagnostic, getAllTeams } from '../api/client'
import PositionBadge from '../components/PositionBadge'
import ScoreRing from '../components/ScoreRing'

const STATUS_CONFIG = {
  'Adequate':      { color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/20',  icon: 'check_circle' },
  'Thin':          { color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/20',  icon: 'warning' },
  'Critical gap':  { color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20',    icon: 'error' },
}

const POS_TEXT_COLOR = {
  GK:  'text-purple-400',
  DEF: 'text-blue-400',
  MID: 'text-green-400',
  FWD: 'text-red-400',
}

function AcademyCard({ candidate }) {
  const navigate = useNavigate()
  const textColor = candidate.is_young ? 'text-amber-300' : 'text-on-surface-variant'
  return (
    <div
      onClick={() => navigate(`/players/${candidate.player_id}`)}
      className="flex items-center justify-between p-2 rounded hover:bg-surface-bright/20 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold ${textColor}`}>{candidate.player_name}</span>
        <span className="text-[10px] text-on-surface-variant font-mono">Age {candidate.age}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
          candidate.readiness === 'Ready' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
          candidate.readiness === 'Close' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
          'bg-purple-500/10 text-purple-400 border border-purple-500/20'
        }`}>
          {candidate.readiness}
        </span>
      </div>
    </div>
  )
}

function PlayerRow({ player }) {
  const navigate = useNavigate()
  const textColor = player.is_young ? 'text-amber-300' : 'text-on-surface-variant'
  return (
    <div
      onClick={() => navigate(`/players/${player.player_id}`)}
      className="flex items-center justify-between py-1.5 border-b border-outline-variant/10 last:border-0 cursor-pointer hover:bg-surface-bright/20 px-2 rounded transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        {player.is_young && (
          <span className="text-[9px] font-black font-headline text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">U21</span>
        )}
        <span className={`text-xs font-medium truncate ${textColor}`}>{player.player_name}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <span className="text-[10px] text-on-surface-variant font-mono">Age {player.age ?? '—'}</span>
        {player.performance_score != null ? (
          <div className="flex items-center gap-1">
            <ScoreRing score={player.performance_score} size={22} strokeWidth={2.5} />
            <span className="text-[10px] font-mono font-bold text-primary">{player.performance_score}</span>
          </div>
        ) : (
          <span className="text-[10px] text-on-surface-variant">—</span>
        )}
      </div>
    </div>
  )
}

function PositionCard({ data }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[data.status] || STATUS_CONFIG['Adequate']

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-lg ${cfg.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
              {cfg.icon}
            </span>
            <span className={`text-sm font-black font-headline ${POS_TEXT_COLOR[data.position_group] || 'text-on-surface'}`}>
              {data.position_group}
            </span>
            <PositionBadge position={data.position_group} />
          </div>
          <span className={`text-[10px] font-black font-headline px-2.5 py-1 rounded-full border ${cfg.color} ${cfg.border}`}>
            {data.status}
          </span>
        </div>

        <div className="flex items-center gap-6 mb-3">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Players</p>
            <p className="text-2xl font-black font-headline text-on-surface">{data.player_count}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">Avg Score</p>
            <p className="text-2xl font-black font-headline text-primary">
              {data.avg_score != null ? data.avg_score : '—'}
            </p>
          </div>
          <div className="flex-1 text-right">
            {data.signing_needed ? (
              <div className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                <span className="material-symbols-outlined text-red-400 text-sm">person_add</span>
                <span className="text-[10px] font-bold text-red-400">External signing recommended</span>
              </div>
            ) : data.academy_candidates.length > 0 ? (
              <div className="inline-flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-1.5">
                <span className="material-symbols-outlined text-amber-400 text-sm">school</span>
                <span className="text-[10px] font-bold text-amber-400">Internal candidate available</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-1.5">
                <span className="material-symbols-outlined text-green-400 text-sm">check</span>
                <span className="text-[10px] font-bold text-green-400">No action needed</span>
              </div>
            )}
          </div>
        </div>

        {/* Academy candidates */}
        {data.academy_candidates.length > 0 && (
          <div className="space-y-2 mb-2">
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">Promotion Candidates</p>
            {data.academy_candidates.map(c => <AcademyCard key={c.player_name} candidate={c} />)}
          </div>
        )}
      </div>

      {/* Collapsible player list */}
      {data.players.length > 0 && (
        <div className="border-t border-outline-variant/10">
          <button
            className="w-full flex items-center justify-between px-5 py-2.5 text-[10px] text-on-surface-variant hover:text-on-surface hover:bg-surface-bright/30 transition-colors"
            onClick={() => setExpanded(v => !v)}
          >
            <span className="font-bold uppercase tracking-wider">{data.players.length} player{data.players.length !== 1 ? 's' : ''}</span>
            <span className="material-symbols-outlined text-base">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
          {expanded && (
            <div className="px-5 pb-4">
              {data.players.map(p => <PlayerRow key={p.player_name} player={p} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SquadGap() {
  const navigate = useNavigate()
  const [teamId, setTeamId] = useState('')
  const [teams, setTeams] = useState([])
  const [selectedLeague, setSelectedLeague] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [diagnostic, setDiagnostic] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('diagnostic')

  // Load teams
  useEffect(() => {
    getAllTeams()
      .then(r => {
        const data = r.data || []
        const unique = Array.from(
          new Map(data.map(t => [t.team_id, { team_id: t.team_id, team_name: t.team_name, league_name: t.league_name }])).values()
        ).sort((a, b) => a.team_name.localeCompare(b.team_name))
        setTeams(unique)
      })
      .catch(() => {})
  }, [])

  const handleLoad = () => {
    if (!teamId) return
    setLoading(true)
    setError(null)
    setDiagnostic(null)
    getSquadDiagnostic(teamId)
      .then(r => setDiagnostic(r.data || []))
      .catch(() => setError('Failed to load squad diagnostic. Ensure the team has data in the current season.'))
      .finally(() => setLoading(false))
  }

  const selectedTeam = teams.find(t => String(t.team_id) === String(teamId))

  const leagues = Array.from(new Set(teams.map(t => t.league_name).filter(Boolean))).sort()
  const filteredTeams = teams.filter(t => {
    const matchesLeague = !selectedLeague || t.league_name === selectedLeague
    const matchesSearch = !searchTerm || t.team_name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesLeague && matchesSearch
  })

  const summary = diagnostic
    ? {
        adequate: diagnostic.filter(d => d.status === 'Adequate').length,
        thin: diagnostic.filter(d => d.status === 'Thin').length,
        critical: diagnostic.filter(d => d.status === 'Critical gap').length,
        academyCandidates: diagnostic.reduce((acc, d) => acc + d.academy_candidates.length, 0),
      }
    : null

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-headline font-black text-on-surface mb-1">Squad Diagnostic</h1>
        <p className="text-on-surface-variant text-sm">
          Position-by-position gap analysis with academy candidate annotation
        </p>
      </div>

      {/* Team selector */}
      <div className="bg-surface-container rounded-xl p-6 mb-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Filter by League
          </label>
          <select
            value={selectedLeague}
            onChange={e => {
              setSelectedLeague(e.target.value)
              setTeamId('')
            }}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2.5 border border-outline-variant/20 focus:outline-none"
          >
            <option value="">All Leagues</option>
            {leagues.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Search Team
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value)
              setTeamId('')
            }}
            placeholder="Type team name..."
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2.5 border border-outline-variant/20 focus:outline-none"
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
            Select Club
          </label>
          <select
            value={teamId}
            onChange={e => setTeamId(e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2.5 border border-outline-variant/20 focus:outline-none focus:border-primary/40"
          >
            <option value="">Choose a team...</option>
            {filteredTeams.map(t => (
              <option key={t.team_id} value={t.team_id}>{t.team_name} ({t.league_name})</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleLoad}
          disabled={!teamId || loading}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed py-2.5"
        >
          <span className="material-symbols-outlined text-sm">analytics</span>
          {loading ? 'Loading...' : 'Run Diagnostic'}
        </button>
        {selectedTeam && (
          <button
            onClick={() => navigate(`/teams/${teamId}`)}
            className="btn-secondary flex items-center gap-2 text-sm py-2.5"
          >
            <span className="material-symbols-outlined text-sm">shield</span>
            Team Profile
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-red-400">error</span>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-surface-container rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Diagnostic results */}
      {diagnostic && !loading && (
        <>
          {/* Summary strip */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Adequate', value: summary.adequate, color: 'text-green-400', bg: 'bg-green-400/10', icon: 'check_circle' },
                { label: 'Thin', value: summary.thin, color: 'text-amber-400', bg: 'bg-amber-400/10', icon: 'warning' },
                { label: 'Critical Gap', value: summary.critical, color: 'text-red-400', bg: 'bg-red-400/10', icon: 'error' },
                { label: 'Academy Prospects', value: summary.academyCandidates, color: 'text-amber-300', bg: 'bg-amber-300/10', icon: 'school' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
                  <span className={`material-symbols-outlined ${s.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">{s.label}</p>
                    <p className={`text-2xl font-black font-headline ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-outline-variant/10">
            {['diagnostic', 'overview'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab === 'diagnostic' ? 'Diagnostic' : 'Overview'}
              </button>
            ))}
          </div>

          {activeTab === 'diagnostic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {diagnostic.map(pos => <PositionCard key={pos.position_group} data={pos} />)}
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="bg-surface-container rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/10">
                    <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-on-surface-variant">Position</th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-on-surface-variant">Players</th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-on-surface-variant">Avg Score</th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-on-surface-variant">Action</th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-on-surface-variant">Academy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {diagnostic.map(pos => {
                    const cfg = STATUS_CONFIG[pos.status] || STATUS_CONFIG['Adequate']
                    return (
                      <tr key={pos.position_group} className="hover:bg-surface-bright transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-black font-headline ${POS_TEXT_COLOR[pos.position_group] || 'text-on-surface'}`}>
                              {pos.position_group}
                            </span>
                            <PositionBadge position={pos.position_group} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-on-surface">{pos.player_count}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono font-bold text-primary">
                            {pos.avg_score != null ? pos.avg_score : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-black font-headline px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.border}`}>
                            {pos.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pos.signing_needed ? (
                            <span className="text-[10px] font-bold text-red-400">External signing</span>
                          ) : pos.academy_candidates.length > 0 ? (
                            <span className="text-[10px] font-bold text-amber-400">Internal candidate</span>
                          ) : (
                            <span className="text-[10px] text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pos.academy_candidates.length > 0 ? (
                            <span className="text-[10px] font-bold text-amber-300">{pos.academy_candidates.length}</span>
                          ) : (
                            <span className="text-[10px] text-on-surface-variant">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!diagnostic && !loading && !error && (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">analytics</span>
          <p className="text-on-surface-variant mt-4 text-sm">Select a team and run the diagnostic to see position gap analysis.</p>
        </div>
      )}
    </div>
  )
}
