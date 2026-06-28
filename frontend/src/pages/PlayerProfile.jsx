import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPlayer, getPlayerSeasons, getSimilarPlayers, getLists, addToList, getPlayerFeasibility, getPlayerSquadFit, getPlayerTeamContext } from '../api/client'
import api from '../api/client'
import ScoreRing from '../components/ScoreRing'
import PositionBadge from '../components/PositionBadge'
import RadarChart from '../components/RadarChart'

const RADAR_METRICS_BY_POS = {
  GK:  [
    { key: 'pass_accuracy',     label: 'Pass Acc.' },
    { key: 'saves_per90',       label: 'Saves/90' },
    { key: 'recoveries_per90',  label: 'Recoveries' },
  ],
  DEF: [
    { key: 'aerials_per90',         label: 'Aerials' },
    { key: 'tackles_per90',         label: 'Tackles' },
    { key: 'interceptions_per90',   label: 'Intercept.' },
    { key: 'recoveries_per90',      label: 'Recoveries' },
    { key: 'xa_per90',              label: 'xA/90' },
    { key: 'pass_accuracy',         label: 'Pass Acc.' },
  ],
  MID: [
    { key: 'xg_per90',          label: 'xG/90' },
    { key: 'xa_per90',          label: 'xA/90' },
    { key: 'key_passes_per90',  label: 'Key Passes' },
    { key: 'dribbles_per90',    label: 'Dribbles' },
    { key: 'tackles_per90',     label: 'Tackles' },
    { key: 'recoveries_per90',  label: 'Recoveries' },
  ],
  WNG: [
    { key: 'xg_per90',         label: 'xG/90' },
    { key: 'xa_per90',         label: 'xA/90' },
    { key: 'dribbles_per90',   label: 'Dribbles' },
    { key: 'key_passes_per90', label: 'Key Passes' },
    { key: 'shots_per90',      label: 'Shots/90' },
  ],
  FWD: [
    { key: 'xg_per90',       label: 'xG/90' },
    { key: 'goals_per90',    label: 'Goals/90' },
    { key: 'xa_per90',       label: 'xA/90' },
    { key: 'shots_per90',    label: 'Shots/90' },
    { key: 'dribbles_per90', label: 'Dribbles' },
    { key: 'aerials_per90',  label: 'Aerials' },
  ],
}

function StatBox({ label, value, sub }) {
  return (
    <div className="bg-surface-container-high rounded-xl p-4 text-center">
      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{label}</p>
      <p className="text-xl font-headline font-black text-primary">{value ?? '—'}</p>
      {sub && <p className="text-[10px] text-on-surface-variant mt-0.5">{sub}</p>}
    </div>
  )
}

function KpiRow({ label, value, per90, show }) {
  if (!show && !value) return null
  return (
    <div className="flex items-center gap-3 py-2 border-b border-outline-variant/10 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant w-36 shrink-0">{label}</span>
      <span className="font-mono font-bold text-primary text-sm">{value ?? '—'}</span>
      {per90 != null && (
        <span className="text-[10px] text-on-surface-variant ml-auto">{per90}/90</span>
      )}
    </div>
  )
}

function KpiSection({ title, rows }) {
  const hasData = rows.some(r => r.value && Number(r.value) !== 0)
  if (!hasData) return null
  return (
    <div className="mb-4">
      <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-2">{title}</p>
      {rows.map((r, i) => <KpiRow key={i} {...r} show={Number(r.value) !== 0} />)}
    </div>
  )
}

export default function PlayerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [similar, setSimilar] = useState([])
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [lists, setLists] = useState([])
  const [addingToList, setAddingToList] = useState(false)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const noteTimer = useRef(null)

  // Enrichment panels
  const [feasibility, setFeasibility] = useState(null)
  const [feasibilityLoading, setFeasibilityLoading] = useState(true)
  const [squadFit, setSquadFit] = useState(null)
  const [squadFitLoading, setSquadFitLoading] = useState(true)
  const [teamContext, setTeamContext] = useState(null)
  const [teamContextLoading, setTeamContextLoading] = useState(true)
  const [feasibilityOpen, setFeasibilityOpen] = useState(true)
  const [squadFitOpen, setSquadFitOpen] = useState(true)
  const [teamContextOpen, setTeamContextOpen] = useState(true)

  useEffect(() => {
    Promise.all([getPlayerSeasons(id), getLists()])
      .then(([s, l]) => {
        setSeasons(s.data || [])
        setLists(l.data || [])
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    api.get(`/api/notes/${id}`).then(r => setNote(r.data?.note_text || '')).catch(() => {})
  }, [id])

  useEffect(() => {
    setLoading(true)
    const params = selectedSeason ? { season: selectedSeason } : {}
    getPlayer(id, params)
      .then(r => setPlayer(r.data))
      .catch(() => setPlayer(null))
      .finally(() => setLoading(false))
  }, [id, selectedSeason])

  useEffect(() => {
    if (!player) return
    getSimilarPlayers(id, { n: 5 })
      .then(r => setSimilar(r.data || []))
      .catch(() => setSimilar([]))
  }, [id, player])

  useEffect(() => {
    setFeasibilityLoading(true)
    getPlayerFeasibility(id)
      .then(r => setFeasibility(r.data))
      .catch(() => setFeasibility(null))
      .finally(() => setFeasibilityLoading(false))
  }, [id])

  useEffect(() => {
    setSquadFitLoading(true)
    getPlayerSquadFit(id)
      .then(r => setSquadFit(r.data))
      .catch(() => setSquadFit(null))
      .finally(() => setSquadFitLoading(false))
  }, [id])

  useEffect(() => {
    setTeamContextLoading(true)
    getPlayerTeamContext(id)
      .then(r => setTeamContext(r.data))
      .catch(() => setTeamContext(null))
      .finally(() => setTeamContextLoading(false))
  }, [id])

  const handleNoteChange = (v) => {
    setNote(v)
    setNoteSaved(false)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      api.post(`/api/notes/${id}`, { note_text: v })
        .then(() => setNoteSaved(true))
        .catch(() => {})
    }, 800)
  }

  const handleAddToList = async (listId) => {
    if (!player) return
    try {
      await addToList(listId, {
        player_id: player.player_id,
        player_name: player.player_name,
        team_name: player.team_name,
        position: player.position_group,
      })
      setAddingToList(false)
    } catch {}
  }

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="h-40 bg-surface-container rounded-xl animate-pulse mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-24 bg-surface-container rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="p-8 text-center py-32">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant">person_off</span>
        <p className="text-on-surface-variant mt-4">Player not found.</p>
        <button onClick={() => navigate('/players')} className="btn-primary mt-4">Back to Search</button>
      </div>
    )
  }

  const radarMetrics = RADAR_METRICS_BY_POS[player.position_group] || RADAR_METRICS_BY_POS.MID
  const m = player
  const fm = (v, d = 2) => Number(v || 0).toFixed(d)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface text-sm mb-6 transition-colors"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Back
      </button>

      {/* Hero */}
      <div className="bg-surface-container rounded-xl p-7 mb-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        <div className="w-20 h-20 rounded-2xl bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant/20">
          <span className="font-headline font-black text-primary text-3xl">
            {(m.player_name || 'XX').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-3xl font-headline font-black text-on-surface">{m.player_name}</h1>
            <PositionBadge position={m.position_group} />
          </div>
          <p className="text-on-surface-variant">{m.team_name} · {m.league_name}</p>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {m.nationality && <span className="chip">{m.nationality}</span>}
            {m.age > 0 && <span className="chip">Age {m.age}</span>}
            {m.season_name && <span className="chip">{m.season_name}</span>}
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="text-center">
            <ScoreRing score={m.score || 0} size={72} strokeWidth={7} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">Score</p>
            <p className="text-xs font-bold text-primary">{m.score_label}</p>
          </div>

          <div className="flex flex-col gap-2">
            {seasons.length > 0 && (
              <select
                value={selectedSeason || ''}
                onChange={e => setSelectedSeason(e.target.value || null)}
                className="bg-surface-container-high text-on-surface text-xs rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
              >
                <option value="">Latest season</option>
                {seasons.map(s => (
                  <option key={s.season_id} value={s.season_name}>{s.season_name}</option>
                ))}
              </select>
            )}

            <div className="relative">
              <button
                onClick={() => setAddingToList(v => !v)}
                className="btn-secondary w-full flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">playlist_add</span>
                Add to List
              </button>
              {addingToList && (
                <div className="absolute right-0 top-full mt-2 bg-surface-container-highest border border-outline-variant/20 rounded-xl shadow-2xl z-30 min-w-48 overflow-hidden">
                  {lists.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-on-surface-variant">No lists yet. Create one first.</p>
                  ) : (
                    lists.map(l => (
                      <button
                        key={l.id}
                        onClick={() => handleAddToList(l.id)}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-surface-bright transition-colors text-on-surface"
                      >
                        {l.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: KPIs + Notes */}
        <div className="xl:col-span-2 space-y-6">
          {/* Season totals */}
          <div className="bg-surface-container rounded-xl p-5">
            <p className="label-xs mb-4">Season Totals</p>
            <div className="grid grid-cols-4 gap-3">
              <StatBox label="Minutes" value={Math.round(m.minutes_played || 0).toLocaleString()} />
              <StatBox label="Goals" value={Math.round(m.goals || 0)} />
              <StatBox label="Assists" value={Math.round(m.assists || 0)} />
              <StatBox label="Rating" value={fm(m.rating)} />
            </div>
          </div>

          {/* Full KPI Table */}
          <div className="bg-surface-container rounded-xl p-5">
            <p className="label-xs mb-4">Statistics</p>
            <KpiSection title="General" rows={[
              { label: 'xG',              value: fm(m.xg, 3),           per90: fm(m.xg_per90, 3) },
              { label: 'xA',              value: fm(m.xa, 3),           per90: fm(m.xa_per90, 3) },
              { label: 'npxG',            value: fm(m.npxg, 3) },
              { label: 'Goals',           value: Math.round(m.goals || 0),    per90: fm(m.goals_per90, 3) },
              { label: 'Assists',         value: Math.round(m.assists || 0),  per90: fm(m.assists_per90, 3) },
              { label: 'Shots',           value: Math.round(m.shots || 0),    per90: fm(m.shots_per90, 2) },
              { label: 'Shots Inside Box',value: Math.round(m.shots_inside_box || 0) },
              { label: 'Big Chances Missed', value: Math.round(m.big_chances_missed || 0) },
            ]} />
            <KpiSection title="Defensive" rows={[
              { label: 'Aerial Duels Won',value: Math.round(m.aerials_won || 0),     per90: fm(m.aerials_per90, 2) },
              { label: 'Aerial Win %',    value: fm(m.aerial_win_pct, 1) + '%' },
              { label: 'Aerial Lost',     value: Math.round(m.aerial_duels_lost || 0) },
              { label: 'Tackles Won',     value: Math.round(m.tackles_won || 0),     per90: fm(m.tackles_per90, 2) },
              { label: 'Tackles Won %',   value: fm(m.tackles_won_pct, 1) + '%' },
              { label: 'Interceptions',   value: Math.round(m.interceptions || 0),   per90: fm(m.interceptions_per90, 2) },
              { label: 'Clearances',      value: Math.round(m.clearances || 0) },
              { label: 'Recoveries',      value: Math.round(m.recoveries || 0),      per90: fm(m.recoveries_per90, 2) },
              { label: 'Duels Won',       value: Math.round(m.duels_won || 0) },
              { label: 'Duels Won %',     value: fm(m.duels_won_pct, 1) + '%' },
              { label: 'Dispossessed',    value: Math.round(m.dispossessed || 0) },
              { label: 'Dribbled Past',   value: Math.round(m.dribbled_past || 0) },
              { label: 'Ground Duels Won',value: Math.round(m.ground_duels_won || 0) },
              { label: 'Ground Duels %',  value: fm(m.ground_duels_won_pct, 1) + '%' },
            ]} />
            <KpiSection title="Passing" rows={[
              { label: 'Pass Accuracy %', value: fm(m.accurate_passes_pct, 1) + '%' },
              { label: 'Key Passes',      value: Math.round(m.key_passes || 0),         per90: fm(m.key_passes_per90, 2) },
              { label: 'Final Third Passes', value: Math.round(m.accurate_final_third || 0) },
              { label: 'Accurate Long Balls', value: Math.round(m.accurate_long_balls || 0) },
              { label: 'Touches',         value: Math.round(m.touches || 0) },
              { label: 'Poss. Won Att. Third', value: Math.round(m.possession_won_att_third || 0) },
            ]} />
            <KpiSection title="Attacking" rows={[
              { label: 'Big Chances Created', value: Math.round(m.big_chances_created || 0) },
              { label: 'Successful Dribbles',  value: Math.round(m.successful_dribbles || 0), per90: fm(m.dribbles_per90, 2) },
              { label: 'Shots Inside Box',     value: Math.round(m.shots_inside_box || 0) },
              { label: 'Shots Outside Box',    value: Math.round(m.shots_outside_box || 0) },
              { label: 'Fouls Won',            value: Math.round(m.fouls_won || 0) },
              { label: 'Error Lead to Goal',   value: Math.round(m.error_lead_to_goal || 0) },
            ]} />
          </div>

          {/* Transfer Feasibility Panel */}
          <div className="bg-surface-container rounded-xl overflow-hidden">
            <button
              onClick={() => setFeasibilityOpen(v => !v)}
              className="w-full px-5 py-4 flex items-center gap-2 hover:bg-surface-bright transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary text-lg">payments</span>
              <p className="label-xs flex-1">Transfer Feasibility</p>
              <span className="material-symbols-outlined text-on-surface-variant text-sm">
                {feasibilityOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {feasibilityOpen && (
              <div className="px-5 pb-5 border-t border-outline-variant/10">
                {feasibilityLoading ? (
                  <div className="h-16 bg-surface-container-high rounded-xl animate-pulse mt-4" />
                ) : feasibility == null ? (
                  <p className="text-xs text-on-surface-variant mt-4">Feasibility data unavailable.</p>
                ) : (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {/* Market Value */}
                    <div className="bg-surface-container-high rounded-xl p-4 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Market Value</p>
                      <p className="text-xl font-headline font-black text-primary">
                        {feasibility.market_value_formatted ?? '—'}
                      </p>
                    </div>
                    {/* Contract Status */}
                    <div className="bg-surface-container-high rounded-xl p-4 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Contract</p>
                      {feasibility.contract_status == null ? (
                        <p className="text-xl font-headline font-black text-on-surface-variant">—</p>
                      ) : (
                        <span className={[
                          'inline-block text-[11px] font-bold px-2 py-1 rounded-full mt-1',
                          feasibility.contract_status === 'Potential Free Agent' ? 'bg-red-500/20 text-red-400' :
                          feasibility.contract_status === 'Expiring (≤1 yr)' ? 'bg-red-500/20 text-red-400' :
                          feasibility.contract_status === 'Mid-contract (1-3 yrs)' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        ].join(' ')}>
                          {feasibility.contract_status}
                        </span>
                      )}
                      {feasibility.contract_expires && (
                        <p className="text-[10px] text-on-surface-variant mt-1">
                          Expires {feasibility.contract_expires}
                        </p>
                      )}
                    </div>
                    {/* League Tier */}
                    <div className="bg-surface-container-high rounded-xl p-4 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">League Tier</p>
                      <span className={[
                        'inline-block text-[11px] font-bold px-2 py-1 rounded-full mt-1',
                        feasibility.league_tier === 'Top 5 League' ? 'bg-primary/20 text-primary' : 'bg-on-surface-variant/20 text-on-surface-variant'
                      ].join(' ')}>
                        {feasibility.league_tier ?? '—'}
                      </span>
                      <p className="text-[10px] text-on-surface-variant mt-1 truncate">{feasibility.league_name}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cultural & Squad Fit Panel */}
          <div className="bg-surface-container rounded-xl overflow-hidden">
            <button
              onClick={() => setSquadFitOpen(v => !v)}
              className="w-full px-5 py-4 flex items-center gap-2 hover:bg-surface-bright transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary text-lg">group</span>
              <p className="label-xs flex-1">Cultural & Squad Fit</p>
              <span className="material-symbols-outlined text-on-surface-variant text-sm">
                {squadFitOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {squadFitOpen && (
              <div className="px-5 pb-5 border-t border-outline-variant/10">
                {squadFitLoading ? (
                  <div className="h-16 bg-surface-container-high rounded-xl animate-pulse mt-4" />
                ) : squadFit == null ? (
                  <p className="text-xs text-on-surface-variant mt-4">Squad fit data unavailable.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant text-base">flag</span>
                      <p className="text-sm text-on-surface">
                        <span className="font-bold text-primary">{squadFit.same_nation_teammates}</span>
                        {' '}teammate{squadFit.same_nation_teammates !== 1 ? 's' : ''} share{squadFit.same_nation_teammates === 1 ? 's' : ''} your nationality
                        {squadFit.nationality ? ` (${squadFit.nationality})` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant text-base">history</span>
                      <p className="text-sm text-on-surface">
                        League familiarity: <span className="font-bold text-primary">{squadFit.league_familiarity}</span>
                        {' '}in {squadFit.league_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant text-base">translate</span>
                      <p className="text-sm text-on-surface">
                        Language group:{' '}
                        <span className="inline-block bg-primary/20 text-primary text-[11px] font-bold px-2 py-0.5 rounded-full">
                          {squadFit.language_group}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Team Context Overlay Panel */}
          <div className="bg-surface-container rounded-xl overflow-hidden">
            <button
              onClick={() => setTeamContextOpen(v => !v)}
              className="w-full px-5 py-4 flex items-center gap-2 hover:bg-surface-bright transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary text-lg">compare_arrows</span>
              <p className="label-xs flex-1">Team Context</p>
              <span className="material-symbols-outlined text-on-surface-variant text-sm">
                {teamContextOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {teamContextOpen && (
              <div className="px-5 pb-5 border-t border-outline-variant/10">
                {teamContextLoading ? (
                  <div className="h-24 bg-surface-container-high rounded-xl animate-pulse mt-4" />
                ) : teamContext == null ? (
                  <p className="text-xs text-on-surface-variant mt-4">Team context data unavailable.</p>
                ) : (
                  <div className="mt-4">
                    <p className="text-[10px] text-on-surface-variant mb-3">
                      vs {teamContext.team_name} squad avg ({teamContext.squad_size} players)
                    </p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
                          <th className="text-left pb-2">Stat</th>
                          <th className="text-right pb-2">Player</th>
                          <th className="text-right pb-2">Team Avg</th>
                          <th className="text-right pb-2">vs Team</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {(() => {
                          const pg = teamContext.position_group
                          const ps = teamContext.player_stats || {}
                          const ta = teamContext.team_averages || {}
                          const rows = pg === 'GK' ? [
                            { label: 'Recoveries/90', pKey: 'recoveries_p90', tKey: 'recoveries_p90' },
                            { label: 'Pass Acc.', pKey: 'accurate_passes_pct', tKey: 'accurate_passes_pct', suffix: '%' },
                          ] : pg === 'DEF' ? [
                            { label: 'Tackles/90', pKey: 'tackles_p90', tKey: 'tackles_p90' },
                            { label: 'Interceptions/90', pKey: 'interceptions_p90', tKey: 'interceptions_p90' },
                            { label: 'Recoveries/90', pKey: 'recoveries_p90', tKey: 'recoveries_p90' },
                            { label: 'Pass Acc.', pKey: 'accurate_passes_pct', tKey: 'accurate_passes_pct', suffix: '%' },
                          ] : pg === 'FWD' ? [
                            { label: 'xG/90', pKey: 'xg_p90', tKey: 'xg_p90' },
                            { label: 'Goals/90', pKey: 'goals_p90', tKey: 'goals_p90' },
                            { label: 'xA/90', pKey: 'xa_p90', tKey: 'xa_p90' },
                            { label: 'Pass Acc.', pKey: 'accurate_passes_pct', tKey: 'accurate_passes_pct', suffix: '%' },
                          ] : [
                            { label: 'xG/90', pKey: 'xg_p90', tKey: 'xg_p90' },
                            { label: 'Key Passes/90', pKey: 'key_passes_p90', tKey: 'key_passes_p90' },
                            { label: 'Tackles/90', pKey: 'tackles_p90', tKey: 'tackles_p90' },
                            { label: 'Pass Acc.', pKey: 'accurate_passes_pct', tKey: 'accurate_passes_pct', suffix: '%' },
                          ]
                          return rows.map(({ label, pKey, tKey, suffix = '' }) => {
                            const pVal = ps[pKey]
                            const tVal = ta[tKey]
                            const above = pVal != null && tVal != null && pVal > tVal
                            const below = pVal != null && tVal != null && pVal < tVal
                            return (
                              <tr key={pKey} className="text-sm">
                                <td className="py-2 text-on-surface-variant text-[11px]">{label}</td>
                                <td className="py-2 text-right font-mono font-bold text-on-surface text-[12px]">
                                  {pVal != null ? `${Number(pVal).toFixed(2)}${suffix}` : '—'}
                                </td>
                                <td className="py-2 text-right font-mono text-on-surface-variant text-[12px]">
                                  {tVal != null ? `${Number(tVal).toFixed(2)}${suffix}` : '—'}
                                </td>
                                <td className="py-2 text-right text-[11px] font-bold">
                                  {above && <span className="text-emerald-400">↑ Above</span>}
                                  {below && <span className="text-red-400">↓ Below</span>}
                                  {!above && !below && pVal != null && tVal != null && <span className="text-on-surface-variant">= Equal</span>}
                                  {(pVal == null || tVal == null) && <span className="text-on-surface-variant">—</span>}
                                </td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scout Notes */}
          <div className="bg-surface-container rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="label-xs">Scout Notes</p>
              {noteSaved && <span className="text-[10px] text-emerald-400 font-bold">Saved</span>}
            </div>
            <textarea
              value={note}
              onChange={e => handleNoteChange(e.target.value)}
              placeholder="Add your scouting notes here…"
              rows={4}
              className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-4 py-3 border border-outline-variant/20 focus:outline-none resize-none placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Right: Radar + Similar */}
        <div className="space-y-6">
          <div className="bg-surface-container rounded-xl p-5">
            <p className="label-xs mb-4">Attribute Radar</p>
            <RadarChart metrics={radarMetrics} player={player} />
          </div>

          <div className="bg-surface-container rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/10">
              <p className="label-xs">Similar Players</p>
            </div>
            {similar.length === 0 ? (
              <p className="px-5 py-4 text-xs text-on-surface-variant">No similar players found.</p>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {similar.map(p => (
                  <button
                    key={p.player_id}
                    onClick={() => navigate(`/players/${p.player_id}`)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-surface-bright transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{p.player_name}</p>
                      <p className="text-[11px] text-on-surface-variant truncate">{p.team_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-primary">{p.similarity?.toFixed(0)}%</p>
                      <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">match</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-container rounded-xl p-5">
            <button
              onClick={() => navigate(`/similar?player_id=${m.player_id}`)}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">compare_arrows</span>
              Find Similar Players
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
