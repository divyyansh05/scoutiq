import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { comparePlayers } from '../api/client'
import useApiError from '../hooks/useApiError'
import ErrorBanner from '../components/ErrorBanner'
import ScoreRing from '../components/ScoreRing'
import RadarChart from '../components/RadarChart'
import { fmt, formatMarketValue } from '../utils/format'

const COMPARE_METRICS = [
  { label: 'Performance Score', key: 'score', format: v => v != null ? Math.round(v) : '—', higherIsBetter: true },
  { label: 'REAP', key: 'reap_score', format: v => v != null ? Number(v).toFixed(2) : '—', higherIsBetter: true },
  { label: 'Percentile', key: 'percentile', format: v => v != null ? `${Math.round(v)}th` : '—', higherIsBetter: true },
  { label: 'Market Value', key: 'market_value_eur', format: v => formatMarketValue(v) || '—', higherIsBetter: false },
  { label: 'Value/Money', key: 'value_for_money', format: v => v != null ? Number(v).toFixed(1) : '—', higherIsBetter: true },
  { label: 'Minutes', key: 'minutes_played', format: v => v != null ? v.toLocaleString() : '—', higherIsBetter: true },
  { label: 'Goals', key: 'goals', format: v => v ?? '—', higherIsBetter: true },
  { label: 'Assists', key: 'assists', format: v => v ?? '—', higherIsBetter: true },
  { label: 'xG', key: 'xg', format: v => fmt(v, 2), higherIsBetter: true },
  { label: 'xA', key: 'xa', format: v => fmt(v, 2), higherIsBetter: true },
  { label: 'xG Chain', key: 'xg_chain', format: v => fmt(v, 2), higherIsBetter: true },
  { label: 'Tackles', key: 'tackles_won', format: v => v ?? '—', higherIsBetter: true },
  { label: 'Interceptions', key: 'interceptions', format: v => v ?? '—', higherIsBetter: true },
  { label: 'Key Passes', key: 'key_passes', format: v => v ?? '—', higherIsBetter: true },
  { label: 'Dribbles', key: 'successful_dribbles', format: v => v ?? '—', higherIsBetter: true },
  { label: 'Aerial Won', key: 'aerials_won', format: v => v ?? '—', higherIsBetter: true },
  { label: 'Rating', key: 'rating', format: v => fmt(v, 1), higherIsBetter: true },
]

export default function Compare() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, handleError, clearError] = useApiError()

  const ids = searchParams.get('ids')

  useEffect(() => {
    if (!ids) return
    setLoading(true)
    clearError()
    comparePlayers(ids.split(',').filter(Boolean))
      .then(res => setPlayers(Array.isArray(res.data) ? res.data : []))
      .catch(err => handleError(err))
      .finally(() => setLoading(false))
  }, [ids])

  const getBestIdx = (metric) => {
    if (!metric.higherIsBetter) return -1
    const values = players.map(p => {
      const v = p[metric.key]
      return (v === null || v === undefined) ? -Infinity : Number(v)
    })
    const max = Math.max(...values)
    if (!isFinite(max)) return -1
    const bestIdx = values.indexOf(max)
    return values.filter(v => v === max).length === 1 ? bestIdx : -1
  }

  if (!ids) {
    return (
      <div className="p-8 text-center py-24">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant">compare_arrows</span>
        <p className="text-on-surface-variant text-lg mt-4">No players selected.</p>
        <p className="text-on-surface-variant/60 text-sm mt-2">Select 2–4 players from search and click Compare.</p>
        <button onClick={() => navigate('/players')} className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-lg transition-colors">
          Go to Player Search
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-headline font-black text-on-surface">Player Comparison</h1>
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface text-sm transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">arrow_back</span>Back
        </button>
      </div>

      <ErrorBanner error={error} onClose={clearError} />
      {loading && <div className="h-96 bg-surface-container rounded-xl animate-pulse" />}

      {!loading && players.length >= 2 && (
        <>
          {/* Player header cards */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `160px repeat(${players.length}, 1fr)` }}>
            <div />
            {players.map(p => (
              <div key={p.player_id}
                className="text-center bg-surface-container rounded-xl p-4 cursor-pointer hover:bg-surface-bright transition-colors"
                onClick={() => navigate(`/players/${p.player_id}`)}>
                <div className="flex justify-center mb-3">
                  <ScoreRing score={p.score} size={64} strokeWidth={5} />
                </div>
                <p className="text-on-surface font-bold text-sm leading-tight">{p.player_name}</p>
                <p className="text-on-surface-variant text-xs mt-1">{p.team_name}</p>
                <p className="text-primary text-xs font-medium mt-1">{p.tactical_role || p.position_group}</p>
                <p className="text-on-surface-variant/60 text-xs">{p.league_name}</p>
                {p.is_injured && (
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-[9px] font-bold bg-red-900/50 text-red-400 border border-red-500/50">INJURED</span>
                )}
              </div>
            ))}
          </div>

          {/* Radar overlay */}
          <div className="bg-surface-container rounded-xl p-5 mb-6">
            <p className="label-xs mb-4">Radar Comparison</p>
            <RadarChart players={players} role={players[0]?.tactical_role || players[0]?.position_group} />
          </div>

          {/* Stats comparison table */}
          <div className="bg-surface-container rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant/10">
              <p className="label-xs">Stat Comparison</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="text-left py-3 px-4 text-on-surface-variant text-xs font-bold uppercase tracking-wider w-44">Metric</th>
                  {players.map(p => (
                    <th key={p.player_id} className="text-center py-3 px-4 text-on-surface text-xs font-bold uppercase tracking-wider">
                      {p.player_name.split(' ').slice(-1)[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {COMPARE_METRICS.map((metric, i) => {
                  const bestIdx = getBestIdx(metric)
                  return (
                    <tr key={metric.key} className={`hover:bg-surface-bright transition-colors ${i % 2 === 0 ? '' : 'bg-surface-container-high/30'}`}>
                      <td className="py-2.5 px-4 text-on-surface-variant text-xs">{metric.label}</td>
                      {players.map((p, idx) => {
                        const val = metric.format(p[metric.key])
                        const isBest = idx === bestIdx && val !== '—'
                        return (
                          <td key={p.player_id} className={`py-2.5 px-4 text-center font-mono text-sm font-medium ${isBest ? 'text-green-400' : 'text-on-surface'}`}>
                            {isBest ? <strong>{val}</strong> : val}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && players.length === 1 && (
        <p className="text-on-surface-variant text-center py-12">Only one player found. Add another to compare.</p>
      )}
    </div>
  )
}
