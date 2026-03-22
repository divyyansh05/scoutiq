import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPlayer, getPlayerSeasons, getSimilarPlayers, getLists, addToList } from '../api/client'
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
