import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchPlayers } from '../api/client'
import api from '../api/client'
import PlayerCard from '../components/PlayerCard'
import ComparisonBar from '../components/ComparisonBar'
import { exportToCSV } from '../utils/export'
import { SEASONS } from './Dashboard'

const POSITIONS = ['', 'GK', 'DEF', 'MID', 'WNG', 'FWD']
const PAGE_SIZE = 20
const SORT_OPTIONS = [
  { value: 'score',    label: 'Scout Score' },
  { value: 'minutes',  label: 'Minutes' },
  { value: 'xg_per90',label: 'xG/90' },
  { value: 'xa_per90', label: 'xA/90' },
  { value: 'aerials',  label: 'Aerial Duels' },
  { value: 'rating',   label: 'Rating' },
  { value: 'age_asc',  label: 'Age (Young→Old)' },
  { value: 'age_desc', label: 'Age (Old→Young)' },
]

export default function PlayerSearch() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const deepInit = searchParams.get('has_deep_stats') === 'true' ? 'true' : ''

  const [filters, setFilters] = useState({
    q: '', position: '', season: '2025-26',
    min_age: '', max_age: '', deep: deepInit,
  })
  const [sort, setSort] = useState('score')
  const [per90, setPer90] = useState(true)
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState([])
  const [saveModal, setSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')

  const fetchPlayers = useCallback(async (pageNum = 1) => {
    setLoading(true)
    try {
      const params = { ...filters, sort, page: pageNum, page_size: PAGE_SIZE }
      Object.keys(params).forEach(k => !params[k] && delete params[k])
      const res = await searchPlayers(params)
      setResults(res.data.players || [])
      setTotal(res.data.total || 0)
      setPages(res.data.pages || 0)
      setPage(pageNum)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [filters, sort])

  useEffect(() => {
    const t = setTimeout(() => fetchPlayers(1), 400)
    return () => clearTimeout(t)
  }, [fetchPlayers])

  const toggleSelect = (player) => {
    setSelected(prev => {
      const exists = prev.find(p => p.player_id === player.player_id)
      if (exists) return prev.filter(p => p.player_id !== player.player_id)
      if (prev.length >= 4) return prev
      return [...prev, player]
    })
  }

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  const handleSaveSearch = async () => {
    if (!saveName.trim()) return
    try {
      await api.post('/api/searches/', {
        name: saveName,
        description: saveDesc,
        filters_json: JSON.stringify({ ...filters, sort }),
      })
      setSaveModal(false)
      setSaveName('')
      setSaveDesc('')
    } catch {}
  }

  const handleExport = () => {
    exportToCSV(results, 'player_search')
  }

  return (
    <div className="p-8 max-w-7xl mx-auto pb-32">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Database</p>
          <h1 className="text-4xl font-headline font-black text-on-surface">Player Search</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Per-90 toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-on-surface-variant font-bold">Per-90</span>
            <button
              onClick={() => setPer90(v => !v)}
              className={`w-10 h-5 rounded-full transition-colors relative ${per90 ? 'bg-primary' : 'bg-surface-container-highest'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${per90 ? 'left-5.5' : 'left-0.5'}`}
                    style={{ left: per90 ? '1.375rem' : '0.125rem' }} />
            </button>
          </label>
          <button onClick={() => setSaveModal(true)} className="btn-secondary text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">bookmark</span>
            Save Search
          </button>
          <button onClick={handleExport} className="btn-secondary text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container rounded-xl p-5 mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="col-span-2 md:col-span-3 lg:col-span-2">
          <label className="label-xs block mb-1.5">Search</label>
          <div className="flex items-center bg-surface-container-high rounded-lg px-3 gap-2 border border-outline-variant/20">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
            <input
              value={filters.q}
              onChange={e => setFilter('q', e.target.value)}
              placeholder="Player or club name…"
              className="bg-transparent py-2 text-sm text-on-surface placeholder:text-slate-600 focus:outline-none w-full"
            />
          </div>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Position</label>
          <select
            value={filters.position}
            onChange={e => setFilter('position', e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {POSITIONS.map(p => <option key={p} value={p}>{p || 'All'}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Season</label>
          <select
            value={filters.season}
            onChange={e => setFilter('season', e.target.value === 'All Seasons' ? '' : e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {SEASONS.map(s => <option key={s} value={s === 'All Seasons' ? '' : s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Min Age</label>
          <input
            type="number" min="14" max="45"
            value={filters.min_age}
            onChange={e => setFilter('min_age', e.target.value)}
            placeholder="e.g. 18"
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="label-xs block mb-1.5">Max Age</label>
          <input
            type="number" min="14" max="45"
            value={filters.max_age}
            onChange={e => setFilter('max_age', e.target.value)}
            placeholder="e.g. 30"
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="label-xs block mb-1.5">Sort By</label>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Deep stats filter chip */}
      {filters.deep === 'true' && (
        <div className="mb-4 flex items-center gap-2">
          <span className="chip bg-blue-500/10 text-blue-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">analytics</span>
            Deep Stats Only
          </span>
          <button onClick={() => setFilter('deep', '')} className="text-xs text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Results header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">
          {loading ? 'Searching…' : <><span className="text-on-surface font-bold">{total.toLocaleString()}</span> players found</>}
        </p>
        {selected.length > 0 && (
          <p className="text-xs text-primary font-bold">{selected.length} selected (max 4)</p>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-surface-container rounded-xl h-36 animate-pulse" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">manage_search</span>
          <p className="text-on-surface-variant mt-4">No players found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map(p => (
            <PlayerCard
              key={p.player_id}
              player={p}
              per90={per90}
              selected={!!selected.find(s => s.player_id === p.player_id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            disabled={page <= 1}
            onClick={() => fetchPlayers(page - 1)}
            className="btn-secondary disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-on-surface-variant font-mono">{page} / {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => fetchPlayers(page + 1)}
            className="btn-secondary disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}

      <ComparisonBar selected={selected} onClear={() => setSelected([])} />

      {/* Save Search Modal */}
      {saveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-container-highest rounded-2xl p-6 w-96 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline font-bold text-on-surface">Save Search</h3>
              <button onClick={() => setSaveModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Search name…"
              className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-4 py-2.5 border border-outline-variant/20 focus:outline-none mb-3"
            />
            <textarea
              value={saveDesc}
              onChange={e => setSaveDesc(e.target.value)}
              placeholder="Description (optional)…"
              rows={2}
              className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-4 py-2.5 border border-outline-variant/20 focus:outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={handleSaveSearch} className="btn-primary flex-1">Save</button>
              <button onClick={() => setSaveModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
