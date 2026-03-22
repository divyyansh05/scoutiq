import {
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

export default function RadarChart({ metrics = [], player, comparison }) {
  if (!metrics.length) return null

  const data = metrics.map(m => ({
    metric: m.label || m.key,
    player: Number(player?.[m.key] || 0).toFixed(2),
    ...(comparison ? { comparison: Number(comparison[m.key] || 0).toFixed(2) } : {}),
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
          name={player?.player_name || 'Player'}
          dataKey="player"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        {comparison && (
          <Radar
            name={comparison.player_name || 'Comparison'}
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
        {comparison && <Legend wrapperStyle={{ fontSize: '11px', color: '#a3aac4' }} />}
      </ReRadarChart>
    </ResponsiveContainer>
  )
}
