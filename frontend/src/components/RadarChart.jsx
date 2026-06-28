import {
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

const RADAR_AXES = {
  GK: [
    { key: 'saves_per90', label: 'Saves/90' },
    { key: 'aerial_won_p90', label: 'Aerial Won/90' },
    { key: 'interceptions_per90', label: 'Intercepts/90' },
    { key: 'recoveries_per90', label: 'Recoveries/90' },
    { key: 'tackles_per90', label: 'Tackles/90' },
    { key: 'key_passes_per90', label: 'Key Passes/90' },
  ],
  CB: [
    { key: 'aerials_per90', label: 'Aerial Won/90' },
    { key: 'tackles_per90', label: 'Tackles/90' },
    { key: 'interceptions_per90', label: 'Intercepts/90' },
    { key: 'recoveries_per90', label: 'Recoveries/90' },
    { key: 'xg_per90', label: 'xG/90' },
    { key: 'xa_per90', label: 'xA/90' },
  ],
  FB: [
    { key: 'tackles_per90', label: 'Tackles/90' },
    { key: 'recoveries_per90', label: 'Recoveries/90' },
    { key: 'xa_per90', label: 'xA/90' },
    { key: 'key_passes_per90', label: 'Key Passes/90' },
    { key: 'dribbles_per90', label: 'Dribbles/90' },
    { key: 'aerials_per90', label: 'Aerial Won/90' },
  ],
  CDM: [
    { key: 'tackles_per90', label: 'Tackles/90' },
    { key: 'interceptions_per90', label: 'Intercepts/90' },
    { key: 'recoveries_per90', label: 'Recoveries/90' },
    { key: 'xa_per90', label: 'xA/90' },
    { key: 'key_passes_per90', label: 'Key Passes/90' },
    { key: 'aerials_per90', label: 'Aerial Won/90' },
  ],
  CM: [
    { key: 'key_passes_per90', label: 'Key Passes/90' },
    { key: 'xa_per90', label: 'xA/90' },
    { key: 'xg_per90', label: 'xG/90' },
    { key: 'tackles_per90', label: 'Tackles/90' },
    { key: 'recoveries_per90', label: 'Recoveries/90' },
    { key: 'dribbles_per90', label: 'Dribbles/90' },
  ],
  CAM: [
    { key: 'xa_per90', label: 'xA/90' },
    { key: 'key_passes_per90', label: 'Key Passes/90' },
    { key: 'xg_per90', label: 'xG/90' },
    { key: 'goals_per90', label: 'Goals/90' },
    { key: 'dribbles_per90', label: 'Dribbles/90' },
    { key: 'assists_per90', label: 'Assists/90' },
  ],
  WNG: [
    { key: 'xa_per90', label: 'xA/90' },
    { key: 'dribbles_per90', label: 'Dribbles/90' },
    { key: 'xg_per90', label: 'xG/90' },
    { key: 'key_passes_per90', label: 'Key Passes/90' },
    { key: 'goals_per90', label: 'Goals/90' },
    { key: 'assists_per90', label: 'Assists/90' },
  ],
  SS: [
    { key: 'xg_per90', label: 'xG/90' },
    { key: 'goals_per90', label: 'Goals/90' },
    { key: 'xa_per90', label: 'xA/90' },
    { key: 'key_passes_per90', label: 'Key Passes/90' },
    { key: 'dribbles_per90', label: 'Dribbles/90' },
    { key: 'assists_per90', label: 'Assists/90' },
  ],
  CF: [
    { key: 'goals_per90', label: 'Goals/90' },
    { key: 'xg_per90', label: 'xG/90' },
    { key: 'shots_per90', label: 'Shots/90' },
    { key: 'assists_per90', label: 'Assists/90' },
    { key: 'aerials_per90', label: 'Aerial Won/90' },
    { key: 'xa_per90', label: 'xA/90' },
  ],
  DEF: [
    { key: 'aerials_per90', label: 'Aerial Won/90' },
    { key: 'tackles_per90', label: 'Tackles/90' },
    { key: 'interceptions_per90', label: 'Intercepts/90' },
    { key: 'recoveries_per90', label: 'Recoveries/90' },
    { key: 'xg_per90', label: 'xG/90' },
    { key: 'xa_per90', label: 'xA/90' },
  ],
  MID: [
    { key: 'key_passes_per90', label: 'Key Passes/90' },
    { key: 'xa_per90', label: 'xA/90' },
    { key: 'xg_per90', label: 'xG/90' },
    { key: 'tackles_per90', label: 'Tackles/90' },
    { key: 'recoveries_per90', label: 'Recoveries/90' },
    { key: 'goals_per90', label: 'Goals/90' },
  ],
  FWD: [
    { key: 'goals_per90', label: 'Goals/90' },
    { key: 'xg_per90', label: 'xG/90' },
    { key: 'shots_per90', label: 'Shots/90' },
    { key: 'assists_per90', label: 'Assists/90' },
    { key: 'xa_per90', label: 'xA/90' },
    { key: 'key_passes_per90', label: 'Key Passes/90' },
  ],
}

const DEFAULT_AXES = [
  { key: 'xg_per90', label: 'xG/90' },
  { key: 'xa_per90', label: 'xA/90' },
  { key: 'goals_per90', label: 'Goals/90' },
  { key: 'assists_per90', label: 'Assists/90' },
  { key: 'tackles_per90', label: 'Tackles/90' },
  { key: 'key_passes_per90', label: 'Key Passes/90' },
]

// Legacy metrics prop support: build a metrics array from explicit prop
// New: role-based automatic axis selection
export default function RadarChart({ metrics, player, comparison, players, role }) {
  // Support both old (player/comparison/metrics) and new (players array) calling conventions
  const primaryPlayer = player || (Array.isArray(players) ? players[0] : null)
  const compPlayer = comparison || (Array.isArray(players) && players.length > 1 ? players[1] : null)

  // Determine axes: explicit metrics prop overrides role-based
  const axes = metrics && metrics.length > 0
    ? metrics
    : (RADAR_AXES[role] || DEFAULT_AXES)

  if (!primaryPlayer) return null

  const safeVal = (obj, key) => {
    if (!obj) return 0
    const v = obj[key]
    if (v === null || v === undefined || isNaN(Number(v))) return 0
    return Number(v)
  }

  const data = axes.map(m => ({
    metric: m.label || m.key,
    player: parseFloat(safeVal(primaryPlayer, m.key).toFixed(2)),
    ...(compPlayer ? { comparison: parseFloat(safeVal(compPlayer, m.key).toFixed(2)) } : {}),
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ReRadarChart data={data}>
        <PolarGrid stroke="#40485d" strokeOpacity={0.4} />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: '#a3aac4', fontSize: 10, fontFamily: 'Inter', fontWeight: 700 }}
        />
        <Radar
          name={primaryPlayer?.player_name || 'Player'}
          dataKey="player"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        {compPlayer && (
          <Radar
            name={compPlayer.player_name || 'Comparison'}
            dataKey="comparison"
            stroke="#fbabff"
            fill="#fbabff"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        )}
        <Tooltip
          contentStyle={{
            background: '#192540',
            border: '1px solid rgba(64,72,93,0.3)',
            borderRadius: '0.5rem',
            fontSize: '12px',
            color: '#dee5ff',
          }}
        />
        {compPlayer && <Legend wrapperStyle={{ fontSize: '11px', color: '#a3aac4' }} />}
      </ReRadarChart>
    </ResponsiveContainer>
  )
}
