import { useState, useEffect } from 'react'
import { getTeamStyles } from '../api/client'
import { SEASONS } from './Dashboard'

const STYLE_COLORS = {
  'High Press':     { bg: 'bg-red-500/10',    text: 'text-red-400',     dot: 'bg-red-500' },
  'Possession':     { bg: 'bg-blue-500/10',   text: 'text-blue-400',    dot: 'bg-blue-500' },
  'Counter Attack': { bg: 'bg-amber-500/10',  text: 'text-amber-400',   dot: 'bg-amber-500' },
  'Direct Play':    { bg: 'bg-orange-500/10', text: 'text-orange-400',  dot: 'bg-orange-500' },
  'Defensive Block':{ bg: 'bg-slate-500/10',  text: 'text-slate-400',   dot: 'bg-slate-500' },
  'Unknown':        { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', dot: 'bg-outline' },
}

function StatMini({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="text-xs font-mono font-bold text-primary">{typeof value === 'number' ? value.toFixed(2) : value}</p>
    </div>
  )
}

function TeamCard({ team }) {
  const style = team.style || 'Unknown'
  const colors = STYLE_COLORS[style] || STYLE_COLORS['Unknown']

  return (
    <div className="bg-surface-container hover:bg-surface-bright transition-all rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-headline font-bold text-on-surface text-sm truncate">{team.team_name}</p>
          <p className="text-[11px] text-on-surface-variant truncate">{team.league_name}</p>
        </div>
        <span className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-[9px] font-bold rounded-full uppercase tracking-tight shrink-0 flex items-center gap-1`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          {style}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 pt-3 border-t border-outline-variant/10">
        <StatMini label="xG" value={team.avg_xg} />
        <StatMini label="Shots" value={team.avg_shots} />
        <StatMini label="Tackles" value={team.avg_tackles} />
        <StatMini label="Pass%" value={team.avg_pass_accuracy} />
      </div>
    </div>
  )
}

export default function TeamStyle() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeStyle, setActiveStyle] = useState('All')
  const [season, setSeason] = useState('2025-26')

  useEffect(() => {
    setLoading(true)
    const seasonParam = season === 'All Seasons' ? undefined : season
    getTeamStyles({ season: seasonParam })
      .then(r => setTeams(r.data || []))
      .catch(() => setTeams([]))
      .finally(() => setLoading(false))
  }, [season])

  const styles = ['All', ...Object.keys(STYLE_COLORS).filter(s => s !== 'Unknown')]
  const filtered = activeStyle === 'All' ? teams : teams.filter(t => t.style === activeStyle)

  // Group counts
  const counts = teams.reduce((acc, t) => {
    acc[t.style] = (acc[t.style] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Analytics</p>
          <h1 className="text-4xl font-headline font-black text-on-surface">Team Style</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            K-means clustering on aggregate team statistics reveals playing style fingerprints.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container rounded-xl p-1">
          {SEASONS.map(s => (
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

      {/* Style distribution */}
      {!loading && teams.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {Object.entries(counts).map(([style, count]) => {
            const colors = STYLE_COLORS[style] || STYLE_COLORS['Unknown']
            return (
              <div key={style} className={`${colors.bg} rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-headline font-black ${colors.text}`}>{count}</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${colors.text} opacity-70 mt-1`}>{style}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Style filter tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {styles.map(s => {
          const colors = STYLE_COLORS[s] || {}
          const isActive = activeStyle === s
          return (
            <button
              key={s}
              onClick={() => setActiveStyle(s)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                isActive
                  ? (s === 'All' ? 'bg-primary text-white' : `${colors.bg} ${colors.text}`)
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'
              }`}
            >
              {s}
              {s !== 'All' && counts[s] ? ` · ${counts[s]}` : ''}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(9).fill(0).map((_, i) => <div key={i} className="h-28 bg-surface-container rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">hub</span>
          <p className="text-on-surface-variant mt-4">
            {teams.length === 0
              ? 'No team data available. Connect your football database.'
              : 'No teams match this style.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => <TeamCard key={t.team_id} team={t} />)}
        </div>
      )}
    </div>
  )
}
