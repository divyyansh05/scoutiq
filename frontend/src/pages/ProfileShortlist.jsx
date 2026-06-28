import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfiles, getProfilePlayers } from '../api/client'

// Score band colours (mirrors UX rules)
function scoreBandClass(score) {
  if (score == null) return 'text-slate-500'
  if (score >= 90) return 'text-green-400'
  if (score >= 75) return 'text-teal-400'
  if (score >= 60) return 'text-blue-400'
  if (score >= 40) return 'text-yellow-400'
  if (score >= 25) return 'text-orange-400'
  return 'text-red-400'
}

function ScoreBadge({ score, label }) {
  const cls = scoreBandClass(score)
  return (
    <span className={`font-headline font-black text-sm ${cls}`}>
      {score != null ? score.toFixed(1) : '—'}
      {label && <span className="text-[10px] font-normal text-slate-500 ml-1">{label}</span>}
    </span>
  )
}

const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD']
const POS_LABEL = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder / Winger', FWD: 'Forward' }

export default function ProfileShortlist() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [selectedProfile, setSelectedProfile] = useState('')
  const [minScore, setMinScore] = useState(50)
  const [minMinutes, setMinMinutes] = useState(450)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load profile list on mount
  useEffect(() => {
    getProfiles()
      .then((res) => {
        setProfiles(res.data || [])
        if (res.data?.length) setSelectedProfile(res.data[0].profile_key)
      })
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false))
  }, [])

  function handleGenerate() {
    if (!selectedProfile) return
    setLoading(true)
    setError(null)
    setResults(null)
    getProfilePlayers(selectedProfile, {
      min_score: minScore,
      min_minutes: minMinutes,
      limit: 30,
    })
      .then((res) => setResults(res.data))
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to generate shortlist')
      })
      .finally(() => setLoading(false))
  }

  // Group profiles by position for grouped <select>
  const profilesByPos = {}
  for (const pos of POSITION_ORDER) profilesByPos[pos] = []
  for (const p of profiles) {
    const pos = p.base_position
    if (profilesByPos[pos]) profilesByPos[pos].push(p)
  }

  const activeProfile = profiles.find((p) => p.profile_key === selectedProfile)
  const kpis = results?.kpis || activeProfile?.kpis || []

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-black text-on-surface mb-1">
          Profile-Driven Shortlist
        </h1>
        <p className="text-slate-400 text-sm">
          Select a positional sub-profile and generate a ranked shortlist of players
          who best match that archetype, scored across the profile's key metrics.
        </p>
      </div>

      {/* Filter row */}
      <div className="bg-[#091328] border border-outline-variant/10 rounded-xl p-6 mb-6">
        <div className="flex flex-wrap gap-6 items-end">
          {/* Profile selector */}
          <div className="flex-1 min-w-56">
            <label className="block font-headline text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
              Positional Profile
            </label>
            {profilesLoading ? (
              <div className="h-10 bg-[#0d1f3c] border border-outline-variant/20 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="w-full bg-[#0d1f3c] border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
              >
                {POSITION_ORDER.map((pos) => {
                  const group = profilesByPos[pos]
                  if (!group.length) return null
                  return (
                    <optgroup key={pos} label={POS_LABEL[pos] || pos}>
                      {group.map((p) => (
                        <option key={p.profile_key} value={p.profile_key}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            )}
          </div>

          {/* Min profile score */}
          <div className="flex-1 min-w-40">
            <label className="block font-headline text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
              Min Profile Score: <span className="text-primary">{minScore}</span>
            </label>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Min minutes */}
          <div className="w-36">
            <label className="block font-headline text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
              Min Minutes
            </label>
            <input
              type="number"
              min={0}
              max={3000}
              step={90}
              value={minMinutes}
              onChange={(e) => setMinMinutes(Number(e.target.value))}
              className="w-full bg-[#0d1f3c] border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !selectedProfile}
            className="px-6 py-2.5 bg-primary text-white font-headline font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate Shortlist'}
          </button>
        </div>

        {/* Active profile KPI summary */}
        {kpis.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="font-headline text-[10px] text-slate-500 uppercase tracking-widest self-center">KPIs:</span>
            {kpis.map((kpi) => (
              <span
                key={kpi.label}
                className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400 font-headline font-bold"
              >
                {kpi.label}
                <span className="text-slate-500 font-normal ml-1">×{kpi.weight}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-slate-400">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
            <span className="font-headline text-sm font-bold tracking-widest uppercase">
              Generating shortlist…
            </span>
          </div>
        </div>
      )}

      {/* Results table */}
      {results && !loading && (
        <>
          {/* Meta info */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">
                {results.label}
                <span className="text-slate-500 font-normal text-base ml-2">({results.total} players)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Profile score ≥ {minScore} · Min {minMinutes} mins · League-wide normalisation
              </p>
            </div>
          </div>

          {results.players.length === 0 ? (
            <div className="bg-[#091328] border border-outline-variant/10 rounded-xl p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-700 mb-3 block">search_off</span>
              <p className="font-headline font-bold text-slate-500 uppercase tracking-widest text-xs">
                No players meet the criteria
              </p>
              <p className="text-xs text-slate-600 mt-2">Try lowering the minimum profile score or minutes.</p>
            </div>
          ) : (
            <div className="bg-[#091328] border border-outline-variant/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/10">
                      <th className="px-4 py-3 text-left font-headline text-[10px] font-bold tracking-widest text-slate-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left font-headline text-[10px] font-bold tracking-widest text-slate-500 uppercase">Player</th>
                      <th className="px-4 py-3 text-left font-headline text-[10px] font-bold tracking-widest text-slate-500 uppercase">Club</th>
                      <th className="px-4 py-3 text-left font-headline text-[10px] font-bold tracking-widest text-slate-500 uppercase">League</th>
                      <th className="px-4 py-3 text-center font-headline text-[10px] font-bold tracking-widest text-slate-500 uppercase">Age</th>
                      <th className="px-4 py-3 text-center font-headline text-[10px] font-bold tracking-widest text-blue-500 uppercase">Profile Score</th>
                      <th className="px-4 py-3 text-center font-headline text-[10px] font-bold tracking-widest text-slate-500 uppercase">Perf. Score</th>
                      {/* Dynamic KPI columns */}
                      {kpis.map((kpi) => (
                        <th
                          key={kpi.label}
                          className="px-4 py-3 text-center font-headline text-[10px] font-bold tracking-widest text-slate-500 uppercase whitespace-nowrap"
                        >
                          {kpi.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.players.map((player) => (
                      <tr
                        key={player.player_id}
                        className="border-b border-outline-variant/5 hover:bg-blue-500/5 cursor-pointer transition-colors"
                        onClick={() => navigate(`/players/${player.player_id}`)}
                      >
                        {/* Rank */}
                        <td className="px-4 py-3 font-headline font-bold text-slate-600 text-xs">
                          {player.rank}
                        </td>

                        {/* Player */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-headline font-bold text-on-surface text-sm">
                              {player.player_name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{player.nationality || '—'}</p>
                          </div>
                        </td>

                        {/* Club */}
                        <td className="px-4 py-3 text-sm text-slate-300">{player.team_name}</td>

                        {/* League */}
                        <td className="px-4 py-3 text-xs text-slate-500">{player.league_name}</td>

                        {/* Age */}
                        <td className="px-4 py-3 text-center text-sm text-slate-400">
                          {player.age ?? '—'}
                        </td>

                        {/* Profile score */}
                        <td className="px-4 py-3 text-center">
                          <ScoreBadge score={player.profile_score} />
                        </td>

                        {/* Performance score */}
                        <td className="px-4 py-3 text-center">
                          <ScoreBadge score={player.performance_score} />
                        </td>

                        {/* KPI values */}
                        {kpis.map((kpi) => {
                          const val = player.kpi_values?.[kpi.label]
                          return (
                            <td key={kpi.label} className="px-4 py-3 text-center text-sm text-slate-300">
                              {val != null ? val.toFixed(2) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Initial empty state */}
      {!results && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-700 mb-4">manage_search</span>
          <p className="font-headline font-bold text-slate-500 text-sm tracking-widest uppercase">
            Select a profile and click Generate Shortlist
          </p>
          <p className="text-xs text-slate-600 mt-2">
            Players are ranked by their fit to the selected positional archetype
          </p>
        </div>
      )}
    </div>
  )
}
