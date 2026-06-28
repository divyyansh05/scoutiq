import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchPlayers, getProfiles, getProfilePlayers, getAllTeams } from '../api/client'
import api from '../api/client'
import PlayerCard from '../components/PlayerCard'
import ComparisonBar from '../components/ComparisonBar'
import { exportPlayersReport } from '../utils/export'
const SEASONS = ['All Seasons', '2025-26', '2024-25', '2023-24', '2022-23']

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

// Position group colour classes (matching PositionBadge conventions)
const POSITION_CHIP_CLASSES = {
  GK:  'bg-purple-500/15 text-purple-300 ring-purple-500/40',
  DEF: 'bg-blue-500/15 text-blue-300 ring-blue-500/40',
  MID: 'bg-green-500/15 text-green-300 ring-green-500/40',
  FWD: 'bg-red-500/15 text-red-300 ring-red-500/40',
}

const POSITION_ACTIVE_CLASSES = {
  GK:  'bg-purple-500/30 text-purple-200 ring-2 ring-purple-400/60',
  DEF: 'bg-blue-500/30 text-blue-200 ring-2 ring-blue-400/60',
  MID: 'bg-green-500/30 text-green-200 ring-2 ring-green-400/60',
  FWD: 'bg-red-500/30 text-red-200 ring-2 ring-red-400/60',
}

const POSITION_BANNER_CLASSES = {
  GK:  'border-purple-500/30 bg-purple-500/10 text-purple-300',
  DEF: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  MID: 'border-green-500/30 bg-green-500/10 text-green-300',
  FWD: 'border-red-500/30 bg-red-500/10 text-red-300',
}

// Group profiles by base_position for display
function groupProfilesByPosition(profiles) {
  const groups = { GK: [], DEF: [], MID: [], FWD: [] }
  profiles.forEach(p => {
    if (groups[p.base_position]) {
      groups[p.base_position].push(p)
    }
  })
  return groups
}

export default function PlayerSearch() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const deepInit = searchParams.get('has_deep_stats') === 'true' ? 'true' : ''

  const [filters, setFilters] = useState({
    q: '', position: '', season: '2025-26',
    min_age: '', max_age: '', deep: deepInit,
    league: '', team: '',
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

  // Profile mode state
  const [profiles, setProfilesList] = useState([])
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [profileMode, setProfileMode] = useState(false)
  const [profileResults, setProfileResults] = useState([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [showProfilePanel, setShowProfilePanel] = useState(false)

  // Options lists
  const [leaguesList, setLeaguesList] = useState([])
  const [teamsList, setTeamsList] = useState([])

  // Load profiles, leagues, and teams on mount
  useEffect(() => {
    getProfiles()
      .then(res => {
        const mapped = (res.data || []).map(p => ({ ...p, key: p.profile_key }))
        setProfilesList(mapped)
      })
      .catch(() => setProfilesList([]))

    api.get('/api/leagues')
      .then(res => setLeaguesList(res.data || []))
      .catch(() => {})

    getAllTeams()
      .then(res => {
        const data = res.data || []
        const unique = Array.from(
          new Map(data.map(t => [t.team_id, { team_id: t.team_id, team_name: t.team_name, league_name: t.league_name }])).values()
        ).sort((a, b) => a.team_name.localeCompare(b.team_name))
        setTeamsList(unique)
      })
      .catch(() => {})
  }, [])

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

  const fetchProfilePlayers = useCallback(async (profileKey) => {
    if (!profileKey) return
    setProfileLoading(true)
    try {
      const params = {
        min_score: 0,
      }
      if (filters.season && filters.season !== 'All Seasons') params.season = filters.season
      if (filters.league) params.league = filters.league
      if (filters.team) params.team = filters.team
      if (filters.q) params.q = filters.q
      if (filters.min_age) params.min_age = filters.min_age
      if (filters.max_age) params.max_age = filters.max_age
      const res = await getProfilePlayers(profileKey, params)
      setProfileResults(res.data.players || [])
    } catch {
      setProfileResults([])
    } finally {
      setProfileLoading(false)
    }
  }, [filters.season, filters.league, filters.team, filters.q, filters.min_age, filters.max_age])

  useEffect(() => {
    const t = setTimeout(() => {
      if (profileMode) {
        if (selectedProfile) {
          fetchProfilePlayers(selectedProfile.key)
        }
      } else {
        fetchPlayers(1)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [
    filters.q,
    filters.min_age,
    filters.max_age,
    filters.season,
    filters.league,
    filters.team,
    profileMode,
    selectedProfile,
    fetchPlayers,
    fetchProfilePlayers
  ])

  const handleSelectProfile = (profile) => {
    setSelectedProfile(profile)
    setProfileMode(true)
    // Clear position filter when entering profile mode
    setFilters(f => ({ ...f, position: '' }))
  }

  const handleClearProfile = () => {
    setSelectedProfile(null)
    setProfileMode(false)
    setProfileResults([])
  }

  const toggleSelect = (player) => {
    setSelected(prev => {
      const exists = prev.find(p => p.player_id === player.player_id)
      if (exists) return prev.filter(p => p.player_id !== player.player_id)
      if (prev.length >= 4) return prev
      return [...prev, player]
    })
  }

  const setFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }))
    // Clear profile mode when changing position group filter
    if (key === 'position' && val) {
      handleClearProfile()
    }
  }

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
    const ctx = [filters.position, filters.league].filter(Boolean).join(" · "); exportPlayersReport(profileMode ? profileResults : results, "Player Search Results", ctx)
  }

  const profileGroups = groupProfilesByPosition(profiles)
  const activeProfileDef = selectedProfile
    ? profiles.find(p => p.key === selectedProfile.key)
    : null

  const displayResults = profileMode ? profileResults : results
  const displayLoading = profileMode ? profileLoading : loading

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
      <div className="bg-surface-container rounded-xl p-5 mb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
        <div className="col-span-2">
          <label className="label-xs block mb-1.5">Search</label>
          <div className="flex items-center bg-surface-container-high rounded-lg px-3 gap-2 border border-outline-variant/20">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
            <input
              value={filters.q}
              onChange={e => setFilter('q', e.target.value)}
              placeholder="Player name…"
              className="bg-transparent py-2 text-sm text-on-surface placeholder:text-slate-600 focus:outline-none w-full"
            />
          </div>
        </div>

        <div>
          <label className="label-xs block mb-1.5">League</label>
          <select
            value={filters.league}
            onChange={e => {
              setFilters(f => ({ ...f, league: e.target.value, team: '' }))
            }}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            <option value="">All Leagues</option>
            {leaguesList.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Team</label>
          <select
            value={filters.team}
            onChange={e => setFilter('team', e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            <option value="">All Teams</option>
            {teamsList.filter(t => !filters.league || t.league_name === filters.league).map(t => (
              <option key={t.team_id} value={t.team_name}>{t.team_name}</option>
            ))}
          </select>
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

      {/* Positional Profile Panel */}
      <div className="bg-surface-container rounded-xl mb-4 overflow-hidden">
        <button
          onClick={() => setShowProfilePanel(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-bright transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm">category</span>
            <span className="text-sm font-bold text-on-surface">Positional Profile</span>
            {profileMode && activeProfileDef && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ring-1 ${POSITION_CHIP_CLASSES[activeProfileDef.base_position]}`}>
                {activeProfileDef.label}
              </span>
            )}
          </div>
          <span className={`material-symbols-outlined text-on-surface-variant text-sm transition-transform ${showProfilePanel ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>

        {showProfilePanel && (
          <div className="px-5 pb-5 border-t border-outline-variant/10">
            <p className="text-xs text-on-surface-variant mt-3 mb-3">
              Filter and rank players by a specific playing style. Selecting a profile overrides the position group filter.
            </p>

            {profiles.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">Loading profiles…</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(profileGroups).map(([pos, posProfiles]) => {
                  if (posProfiles.length === 0) return null
                  return (
                    <div key={pos} className="flex items-start gap-3">
                      <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 w-8 shrink-0 ${
                        pos === 'GK' ? 'text-purple-400' :
                        pos === 'DEF' ? 'text-blue-400' :
                        pos === 'MID' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {pos}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {posProfiles.map(profile => {
                          const isActive = selectedProfile?.key === profile.key
                          return (
                            <button
                              key={profile.key}
                              onClick={() => isActive ? handleClearProfile() : handleSelectProfile(profile)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg ring-1 transition-all ${
                                isActive
                                  ? POSITION_ACTIVE_CLASSES[pos]
                                  : `${POSITION_CHIP_CLASSES[pos]} hover:brightness-125`
                              }`}
                            >
                              {profile.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {profileMode && (
              <button
                onClick={handleClearProfile}
                className="mt-4 text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Clear profile — return to standard search
              </button>
            )}
          </div>
        )}
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

      {/* Profile Mode Banner */}
      {profileMode && activeProfileDef && (
        <div className={`mb-4 rounded-xl border px-5 py-3 flex items-start justify-between gap-4 ${POSITION_BANNER_CLASSES[activeProfileDef.base_position]}`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1 opacity-70">Profile Mode</p>
            <p className="text-sm font-bold">
              Showing players ranked by: <span className="text-on-surface">{activeProfileDef.label}</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {activeProfileDef.kpis.map(kpi => (
                <span key={kpi.field} className="text-[10px] font-bold uppercase tracking-wider bg-black/20 rounded px-2 py-0.5">
                  {kpi.label} ({kpi.weight}%)
                </span>
              ))}
            </div>
          </div>
          <button onClick={handleClearProfile} className="shrink-0 mt-0.5 opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Results header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">
          {displayLoading
            ? 'Searching…'
            : profileMode
              ? <><span className="text-on-surface font-bold">{profileResults.length}</span> players ranked</>
              : <><span className="text-on-surface font-bold">{total.toLocaleString()}</span> players found</>
          }
        </p>
        {selected.length > 0 && (
          <p className="text-xs text-primary font-bold">{selected.length} selected (max 4)</p>
        )}
      </div>

      {/* Grid */}
      {displayLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-surface-container rounded-xl h-36 animate-pulse" />
          ))}
        </div>
      ) : displayResults.length === 0 ? (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">manage_search</span>
          <p className="text-on-surface-variant mt-4">
            {profileMode
              ? 'No players found for this profile. Try a different season or profile.'
              : 'No players found. Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayResults.map((p, idx) => (
            profileMode
              ? (
                <ProfilePlayerCard
                  key={p.player_id}
                  player={p}
                  rank={idx + 1}
                  profile={activeProfileDef}
                  selected={!!selected.find(s => s.player_id === p.player_id)}
                  onToggleSelect={toggleSelect}
                />
              )
              : (
                <PlayerCard
                  key={p.player_id}
                  player={p}
                  per90={per90}
                  selected={!!selected.find(s => s.player_id === p.player_id)}
                  onToggleSelect={toggleSelect}
                />
              )
          ))}
        </div>
      )}

      {/* Pagination — only in standard mode */}
      {!profileMode && pages > 1 && (
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

// ── Profile Player Card ───────────────────────────────────────────────────────
const POSITION_SCORE_COLOUR = {
  GK:  'text-purple-300',
  DEF: 'text-blue-300',
  MID: 'text-green-300',
  FWD: 'text-red-300',
}

function ProfilePlayerCard({ player, rank, profile, selected, onToggleSelect }) {
  const navigate = useNavigate()
  const {
    player_id, player_name, position_group, team_name, league_name,
    age, minutes, profile_score, performance_score, kpi_values,
  } = player

  const scoreColour = POSITION_SCORE_COLOUR[position_group] || 'text-primary'

  const parts = (player_name || 'UN').split(' ')
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : (player_name || 'UN').substring(0, 2)

  return (
    <div
      className={`
        bg-surface-container hover:bg-surface-bright transition-all duration-300
        rounded-xl p-5 relative group overflow-hidden cursor-pointer
        ${selected ? 'ring-2 ring-primary/60' : ''}
      `}
      onClick={() => navigate(`/players/${player_id}`)}
    >
      {/* Rank badge */}
      <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center">
        <span className="text-[10px] font-bold font-mono text-on-surface-variant">#{rank}</span>
      </div>

      {/* Checkbox */}
      <div className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect && onToggleSelect(player)}
          className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
          title="Add to comparison"
        />
      </div>

      <div className="flex gap-4 mt-2">
        <div className="w-14 h-14 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant/20">
          <span className="font-headline font-bold text-primary text-lg">{initials.toUpperCase()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className="font-headline font-bold text-on-surface text-base truncate">{player_name}</h3>
          </div>
          <p className="text-xs text-on-surface-variant truncate">{team_name} · {league_name}</p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">
            {age ? `Age ${age}` : ''}
            {age && minutes ? ' · ' : ''}
            {minutes ? `${minutes.toLocaleString()} mins` : ''}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className={`text-xl font-headline font-bold ${scoreColour}`}>
            {profile_score != null ? profile_score.toFixed(1) : '—'}
          </div>
          <div className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">Profile</div>
          {performance_score != null && (
            <>
              <div className="text-sm font-bold text-primary mt-1">{Math.round(performance_score)}</div>
              <div className="text-[9px] text-primary/60 font-bold uppercase tracking-widest">Score</div>
            </>
          )}
        </div>
      </div>

      {/* KPI values row */}
      {profile && kpi_values && (
        <div className="mt-4 pt-4 border-t border-outline-variant/10 grid gap-2" style={{ gridTemplateColumns: `repeat(${profile.kpis.length}, 1fr)` }}>
          {profile.kpis.map((kpi, i) => {
            const val = kpi_values[kpi.field]
            const display = val != null ? Number(val).toFixed(2) : '—'
            return (
              <div key={kpi.field} className={`text-center ${i > 0 ? 'border-l border-outline-variant/10' : ''}`}>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider leading-tight">
                  {kpi.label}
                </p>
                <p className="text-sm font-mono font-bold text-primary">{display}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
