import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeagueCoverage } from '../api/client'
import useApiError from '../hooks/useApiError'
import ErrorBanner from '../components/ErrorBanner'

export default function LeagueCoverage() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, handleError, clearError] = useApiError()

  useEffect(() => {
    getLeagueCoverage()
      .then(r => setData(r.data?.coverage || []))
      .catch(handleError)
      .finally(() => setLoading(false))
  }, [])

  const filtered = data.filter(c => {
    const name = (c.competition_name || c.league_name || '').toLowerCase()
    return !search || name.includes(search.toLowerCase())
  })

  const maxPlayers = Math.max(...filtered.map(c => c.total_players || 0), 1)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <ErrorBanner error={error} onClose={clearError} />
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface text-sm mb-6 transition-colors"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Dashboard
      </button>

      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Coverage</p>
          <h1 className="text-4xl font-headline font-black text-on-surface">Competition Coverage</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {data.length} competitions · {data.reduce((s, c) => s + (c.total_players || 0), 0).toLocaleString()} player records ·{' '}
            {data.reduce((s, c) => s + (c.matches || 0), 0).toLocaleString()} matches
          </p>
        </div>
        <div className="flex items-center bg-surface-container rounded-xl px-4 gap-2 border border-outline-variant/10">
          <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter competitions…"
            className="bg-transparent py-2.5 text-sm text-on-surface placeholder:text-slate-600 focus:outline-none w-52"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array(15).fill(0).map((_, i) => <div key={i} className="h-16 bg-surface-container rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">public</span>
          <p className="text-on-surface-variant mt-4">No competitions found.</p>
        </div>
      ) : (
        <div className="bg-surface-container rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10">
                {['Competition', 'Players', 'Matches', 'First Match', 'Last Match', 'Coverage'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filtered.map(comp => {
                const name = comp.competition_name || comp.league_name || ''
                const players = comp.total_players || 0
                const matches = comp.matches || 0
                const pct = Math.round((players / maxPlayers) * 100)
                return (
                  <tr key={name} className="hover:bg-surface-bright transition-colors">
                    <td className="px-5 py-3.5 font-bold text-on-surface">{name}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono font-bold text-primary">{players.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-on-surface-variant">{matches.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant text-xs">
                      {comp.first_match ? String(comp.first_match).slice(0, 10) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-on-surface-variant text-xs">
                      {comp.last_match ? String(comp.last_match).slice(0, 10) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold ${pct >= 50 ? 'text-emerald-400' : pct >= 20 ? 'text-amber-400' : 'text-red-400'}`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
