import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats, getTopPerformers } from '../api/client'
import ScoreRing from '../components/ScoreRing'
import PositionBadge from '../components/PositionBadge'
import useApiError from '../hooks/useApiError'
import ErrorBanner from '../components/ErrorBanner'
import { useSeasons } from '../hooks/useSeasons'
import { formatDateTime } from '../utils/format'

// Removed: SEASONS hardcoded array — all pages now use useSeasons() hook

function StatCard({ icon, label, value, sub, onClick }) {
  return (
    <div
      className="bg-surface-container rounded-xl p-6 flex items-start gap-4 cursor-pointer hover:bg-surface-bright transition-colors"
      onClick={onClick}
    >
      <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{label}</p>
        <p className="text-3xl font-headline font-black text-primary">{value}</p>
        {sub && <p className="text-xs text-on-surface-variant mt-1">{sub}</p>}
      </div>
      <span className="ml-auto material-symbols-outlined text-outline text-base self-center opacity-40">arrow_forward</span>
    </div>
  )
}

function PerformerRow({ player, rank }) {
  const navigate = useNavigate()
  const pct = Math.round(100 - (player.percentile || 0))
  const posLabel = player.position_group || 'Player'

  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-bright transition-colors cursor-pointer group"
      onClick={() => navigate(`/players/${player.player_id}`)}
    >
      <span className="w-6 text-center text-xs font-bold font-mono text-on-surface-variant">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="font-headline font-bold text-sm text-on-surface truncate group-hover:text-primary transition-colors">
          {player.player_name || player.name}
        </p>
        <p className="text-[11px] text-on-surface-variant truncate">
          {player.team_name} · {player.league_name}
        </p>
      </div>
      <PositionBadge position={player.position_group} />
      <div className="text-center shrink-0">
        <ScoreRing score={player.score} size={40} strokeWidth={4} />
        <p className="text-[9px] text-on-surface-variant mt-0.5 leading-none">
          Top {pct < 1 ? 1 : pct}% {posLabel}s
        </p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [performers, setPerformers] = useState([])
  const [competition, setCompetition] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const [error, handleError, clearError] = useApiError()
  const { seasonOptions } = useSeasons()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getDashboardStats(),
      getTopPerformers({ competition: competition || undefined, limit: 10 }),
    ])
      .then(([s, p]) => {
        setStats(s.data)
        setPerformers(p.data?.performers || [])
      })
      .catch(handleError)
      .finally(() => setLoading(false))
  }, [competition])

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <ErrorBanner error={error} onClose={clearError} />
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Overview</p>
          <h1 className="text-4xl font-headline font-black text-on-surface leading-tight">
            Scouting Dashboard
          </h1>
          <p className="text-on-surface-variant text-sm mt-2">Real-time player intelligence across all tracked leagues.</p>
        </div>

        {/* Competition filter */}
        <select
          value={competition}
          onChange={e => setCompetition(e.target.value)}
          className="bg-surface-container border border-outline-variant/20 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50"
        >
          <option value="">All Competitions</option>
          {seasonOptions.filter(s => s.name).map(s => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-surface-container rounded-xl p-6 h-24 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              icon="group"
              label="Players Tracked"
              value={(stats?.total_players || 0).toLocaleString()}
              sub="Across all competitions"
              onClick={() => navigate('/players')}
            />
            <StatCard
              icon="analytics"
              label="Match Records"
              value={(stats?.total_records || 0).toLocaleString()}
              sub={`${(stats?.total_scores || 0).toLocaleString()} performance scores`}
              onClick={() => navigate('/rankings')}
            />
            <StatCard
              icon="public"
              label="Competitions"
              value={stats?.leagues_covered || 0}
              sub="Global coverage"
              onClick={() => navigate('/coverage')}
            />
          </>
        )}
      </div>

      {stats?.last_updated && (
        <p className="text-xs text-on-surface-variant/50 text-center mt-2 mb-6">
          Data last updated: {formatDateTime(stats.last_updated)}
        </p>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3 mb-10">
        {[
          { icon: 'search',       label: 'Player Search',   path: '/players',   color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400' },
          { icon: 'star',         label: 'Emerging Talent', path: '/talent',    color: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400' },
          { icon: 'groups',       label: 'Similar Players', path: '/similar',   color: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400' },
          { icon: 'scatter_plot', label: 'Scatter Analysis',path: '/scatter',   color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400' },
        ].map(({ icon, label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`${color} rounded-xl p-5 flex flex-col gap-3 transition-all text-left`}
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            <span className="font-headline font-bold text-xs uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top Performers */}
        <div className="xl:col-span-2 bg-surface-container rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Performance</p>
              <h2 className="font-headline font-bold text-base text-on-surface mt-0.5">Top Performers</h2>
            </div>
            <button
              onClick={() => navigate('/players')}
              className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary-dim transition-colors flex items-center gap-1"
            >
              See All <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          {loading ? (
            <div className="divide-y divide-outline-variant/10">
              {Array(5).fill(0).map((_, i) => <div key={i} className="h-16 animate-pulse bg-surface-container-high m-2 rounded-lg" />)}
            </div>
          ) : performers.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">database</span>
              <p className="text-on-surface-variant text-sm mt-3">No data for {season}. Try a different season.</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {performers.map((p, i) => (
                <PerformerRow key={p.player_id} player={p} rank={i + 1} />
              ))}
            </div>
          )}
        </div>

        {/* Top Competitions panel */}
        <div className="bg-surface-container rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Coverage</p>
              <h2 className="font-headline font-bold text-base text-on-surface mt-0.5">Top Competitions</h2>
            </div>
            <button
              onClick={() => navigate('/coverage')}
              className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center hover:bg-blue-500/20 transition-colors"
            >
              <span className="material-symbols-outlined text-blue-400 text-base">public</span>
            </button>
          </div>
          <div className="p-4 space-y-2">
            {(stats?.competition_breakdown || stats?.league_breakdown || []).slice(0, 8).map(comp => (
              <div key={comp.competition_name || comp.league_name}
                className="flex items-center justify-between text-sm py-1.5 border-b border-outline-variant/5 last:border-0"
              >
                <span className="text-on-surface-variant text-xs truncate max-w-[65%]">
                  {comp.competition_name || comp.league_name}
                </span>
                <span className="font-mono font-bold text-primary text-xs shrink-0">
                  {(comp.players || 0).toLocaleString()} players
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
