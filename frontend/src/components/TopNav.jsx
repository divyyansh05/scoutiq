import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../api/client'

export default function TopNav() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      globalSearch(query).then(r => {
        setResults(r.data || [])
        setOpen(true)
      }).catch(() => {})
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const handleSelect = (item) => {
    setOpen(false)
    setQuery('')
    if (item.type === 'player') {
      navigate(`/players/${item.player_id}`)
    }
  }

  return (
    <header className="fixed top-0 left-64 right-0 z-40 bg-[#060e20] flex justify-between items-center px-6 py-3 shadow-[0_2px_40px_-10px_rgba(133,173,255,0.06)] border-b border-white/5">
      <div className="flex items-center gap-6 relative">
        <div className="flex items-center bg-[#091328] px-4 py-2 rounded-lg gap-3 border border-outline-variant/10 w-72">
          <span className="material-symbols-outlined text-slate-500 text-base">search</span>
          <input
            className="bg-transparent border-none focus:outline-none text-sm text-on-surface w-full placeholder:text-slate-600 font-space-grotesk tracking-wide"
            placeholder="Search players, clubs..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
          />
        </div>

        {/* Autocomplete dropdown */}
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-surface-container-high rounded-xl shadow-2xl border border-outline-variant/20 z-50 overflow-hidden">
            {results.map((item, i) => (
              <button
                key={i}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-bright transition-colors text-left"
                onClick={() => handleSelect(item)}
              >
                <span className="material-symbols-outlined text-primary text-base">
                  {item.type === 'player' ? 'person' : 'shield'}
                </span>
                <div>
                  <p className="text-sm font-bold text-on-surface">{item.name}</p>
                  <p className="text-xs text-on-surface-variant">{item.subtitle} {item.position ? `· ${item.position}` : ''}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button className="text-slate-400 hover:text-white p-2 rounded-full transition-all">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="text-slate-400 hover:text-white p-2 rounded-full transition-all">
          <span className="material-symbols-outlined">settings</span>
        </button>
        <div className="w-8 h-8 rounded-full bg-surface-container-highest border border-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
        </div>
      </div>
    </header>
  )
}
