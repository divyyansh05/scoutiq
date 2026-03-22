import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeagueCoverage } from '../api/client'
import { SEASONS } from './Dashboard'

const LEAGUE_ORDER = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']

const LEAGUE_COLORS = {
  'Premier League': { accent: 'text-purple-400', bg: 'bg-purple-500/10', dot: 'bg-purple-500' },
  'La Liga':        { accent: 'text-red-400',    bg: 'bg-red-500/10',    dot: 'bg-red-500' },
  'Serie A':        { accent: 'text-blue-400',   bg: 'bg-blue-500/10',   dot: 'bg-blue-500' },
  'Bundesliga':     { accent: 'text-amber-400',  bg: 'bg-amber-500/10',  dot: 'bg-amber-500' },
  'Ligue 1':        { accent: 'text-emerald-400',bg: 'bg-emerald-500/10',dot: 'bg-emerald-500' },
}

function coverageColor(pct) {
  if (pct >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-400' }
  if (pct >= 40) return { bar: 'bg-amber-500',   text: 'text-amber-400' }
  return           { bar: 'bg-orange-500',        text: 'text-orange-400' }
}

function CoverageBar({ value, max, pct }) {
  const { bar, text } = coverageColor(pct)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-bold font-mono w-12 text-right ${text}`}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function LeagueCard({ league, rows }) {
  const [expanded, setExpanded] = useState(false)
  const colors = LEAGUE_COLORS[league] || { accent: 'text-primary', bg: 'bg-primary/10', dot: 'bg-primary' }

  // Aggregate across shown rows
  const totalTeams   = rows[0]?.total_teams    || 0
  const totalPlayers = rows.reduce((s, r) => s + (r.total_players || 0), 0)
  const withMinutes  = rows.reduce((s, r) => s + (r.players_with_minutes || 0), 0)
  const withXg       = rows.reduce((s, r) => s + (r.players_with_xg || 0), 0)
  const withDeep     = rows.reduce((s, r) => s + (r.players_with_deep_stats || 0), 0)
  const deepPct      = totalPlayers > 0 ? (withDeep / totalPlayers) * 100 : 0

  return (
    <div className="bg-surface-container rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 flex items-center gap-3 border-b border-outline-variant/10`}>
        <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} shrink-0`} />
        <h3 className={`font-headline font-bold text-base ${colors.accent}`}>{league}</h3>
        <span className="text-xs text-on-surface-variant">{totalTeams} teams</span>
      </div>

      {/* Stats row */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-5 gap-4 border-b border-outline-variant/10">
        {[
          { label: 'Total Players', value: totalPlayers.toLocaleString() },
          { label: 'With Minutes',  value: withMinutes.toLocaleString() },
          { label: 'With xG',       value: withXg.toLocaleString() },
          { label: 'Deep Stats',    value: withDeep.toLocaleString() },
          { label: 'Deep Cov.',     value: `${deepPct.toFixed(0)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{label}</p>
            <p className="text-sm font-bold font-mono text-on-surface">{value}</p>
          </div>
        ))}
      </div>

      {/* Coverage bar */}
      <div className="px-5 py-3 border-b border-outline-variant/10">
        <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Deep Stats Coverage</p>
        <CoverageBar value={withDeep} max={totalPlayers} pct={deepPct} />
      </div>

      {/* Expand button + season breakdown */}
      <div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full px-5 py-3 flex items-center justify-between text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors"
        >
          Season Breakdown
          <span className="material-symbols-outlined text-sm">{expanded ? 'expand_less' : 'expand_more'}</span>
        </button>

        {expanded && (
          <div className="px-5 pb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  {['Season', 'Players', 'Mins', 'xG', 'Deep', 'Cov%', 'Avg xG', 'Avg Rating'].map(h => (
                    <th key={h} className="text-left pb-2 font-bold text-on-surface-variant uppercase tracking-wider text-[9px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {rows.map(r => {
                  const pct = r.total_players > 0
                    ? ((r.players_with_deep_stats / r.total_players) * 100).toFixed(0)
                    : '0'
                  const { text } = coverageColor(Number(pct))
                  return (
                    <tr key={r.season_name} className="hover:bg-surface-bright/30">
                      <td className="py-2 font-mono font-bold text-on-surface">{r.season_name}</td>
                      <td className="py-2 text-on-surface-variant">{r.total_players}</td>
                      <td className="py-2 text-on-surface-variant">{r.players_with_minutes}</td>
                      <td className="py-2 text-on-surface-variant">{r.players_with_xg}</td>
                      <td className="py-2 text-on-surface-variant">{r.players_with_deep_stats}</td>
                      <td className={`py-2 font-bold ${text}`}>{pct}%</td>
                      <td className="py-2 text-on-surface-variant">{Number(r.avg_xg || 0).toFixed(3)}</td>
                      <td className="py-2 text-on-surface-variant">{Number(r.avg_rating || 0).toFixed(2)}</td>
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

export default function LeagueCoverage() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSeason, setActiveSeason] = useState('All')

  useEffect(() => {
    getLeagueCoverage()
      .then(r => setData(r.data?.coverage || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  // Group by league then filter by season
  const grouped = LEAGUE_ORDER.reduce((acc, league) => {
    let rows = data.filter(r => r.league_name === league)
    if (activeSeason !== 'All') {
      rows = rows.filter(r => r.season_name === activeSeason)
    }
    if (rows.length > 0) acc[league] = rows
    return acc
  }, {})

  const seasonTabs = ['All', ...SEASONS.filter(s => s !== 'All Seasons')]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface text-sm mb-6 transition-colors"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Dashboard
      </button>

      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Coverage</p>
        <h1 className="text-4xl font-headline font-black text-on-surface">League Data Coverage</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Data completeness breakdown across all tracked leagues and seasons.
        </p>
      </div>

      {/* Season filter tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {seasonTabs.map(s => (
          <button
            key={s}
            onClick={() => setActiveSeason(s)}
            className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeSeason === s
                ? 'bg-primary text-white'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => <div key={i} className="h-40 bg-surface-container rounded-xl animate-pulse" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">public</span>
          <p className="text-on-surface-variant mt-4">No coverage data available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([league, rows]) => (
            <LeagueCard key={league} league={league} rows={rows} />
          ))}
        </div>
      )}
    </div>
  )
}
