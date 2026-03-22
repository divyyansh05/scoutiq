import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTalents } from '../api/client'
import PositionBadge from '../components/PositionBadge'
import ScoreRing from '../components/ScoreRing'
import { SEASONS } from './Dashboard'

function TalentCard({ player }) {
  const navigate = useNavigate()
  const pct = Math.round(player.percentile || 0)

  return (
    <div
      className="bg-surface-container hover:bg-surface-bright transition-all rounded-xl p-5 cursor-pointer group"
      onClick={() => navigate(`/players/${player.player_id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant/20">
            <span className="font-headline font-bold text-primary text-base">
              {(player.player_name || 'XX').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors truncate">
              {player.player_name}
            </p>
            <p className="text-xs text-on-surface-variant truncate">{player.team_name}</p>
          </div>
        </div>
        <ScoreRing score={player.score || 0} size={44} strokeWidth={4} />
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <PositionBadge position={player.position_group} />
        <span className="chip bg-amber-500/10 text-amber-400">Age {player.age}</span>
        <span className="chip bg-emerald-500/10 text-emerald-400">{player.score_label}</span>
        <span className="chip">{player.league_name}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 pt-4 border-t border-outline-variant/10">
        {[
          { label: 'xG/90', value: Number(player.xg_per90 || 0).toFixed(2) },
          { label: 'xA/90', value: Number(player.xa_per90 || 0).toFixed(2) },
          { label: 'Rating', value: Number(player.rating || 0).toFixed(2) },
          { label: 'Pct.', value: `${pct}th` },
        ].map((s, i) => (
          <div key={i} className={`text-center ${i > 0 ? 'border-l border-outline-variant/10' : ''}`}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">{s.label}</p>
            <p className="text-sm font-mono font-bold text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Percentile bar */}
      <div className="mt-3">
        <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function EmergingTalent() {
  const [filters, setFilters] = useState({ max_age: 23, min_minutes: 450, top_percentile: 75 })
  const [season, setSeason] = useState('2025-26')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const seasonParam = season === 'All Seasons' ? undefined : season
      const res = await getTalents({ ...filters, season: seasonParam })
      setResults(res.data || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [filters, season])

  useEffect(() => { fetch() }, [fetch])

  const setF = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Scout</p>
        <h1 className="text-4xl font-headline font-black text-on-surface">Emerging Talent</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Young players outperforming their age cohort — ranked by composite score.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-surface-container rounded-xl p-5 mb-6 flex flex-wrap gap-6 items-end">
        <div>
          <label className="label-xs block mb-1.5">Season</label>
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Max Age</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min="17" max="30" step="1"
              value={filters.max_age}
              onChange={e => setF('max_age', Number(e.target.value))}
              className="w-32 accent-blue-500"
            />
            <span className="text-sm font-bold font-mono text-primary w-8">U-{filters.max_age}</span>
          </div>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Min Minutes</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min="100" max="2000" step="50"
              value={filters.min_minutes}
              onChange={e => setF('min_minutes', Number(e.target.value))}
              className="w-32 accent-blue-500"
            />
            <span className="text-sm font-bold font-mono text-primary w-12">{filters.min_minutes}</span>
          </div>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Min Percentile</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min="50" max="99" step="5"
              value={filters.top_percentile}
              onChange={e => setF('top_percentile', Number(e.target.value))}
              className="w-32 accent-blue-500"
            />
            <span className="text-sm font-bold font-mono text-primary w-12">≥{filters.top_percentile}th</span>
          </div>
        </div>

        <div className="ml-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Found</p>
          <p className="text-2xl font-headline font-black text-primary">{results.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-48 bg-surface-container rounded-xl animate-pulse" />)}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">star</span>
          <p className="text-on-surface-variant mt-4">No talents found. Try loosening the filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map(p => <TalentCard key={p.player_id} player={p} />)}
        </div>
      )}
    </div>
  )
}
