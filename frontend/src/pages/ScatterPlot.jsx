import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { getScatter } from '../api/client'
import { SEASONS } from './Dashboard'

const POSITION_COLORS = {
  FWD: '#ef4444',
  WNG: '#f59e0b',
  MID: '#22c55e',
  DEF: '#3b82f6',
  GK:  '#a855f7',
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="bg-surface-container-highest border border-outline-variant/20 rounded-xl p-3 shadow-2xl min-w-52 pointer-events-none">
      <p className="font-headline font-bold text-sm text-on-surface mb-1">{d.player_name}</p>
      <p className="text-xs text-on-surface-variant mb-2">{d.team_name} · {d.league_name}</p>
      <div className="flex gap-4">
        <div>
          <p className="text-[9px] uppercase font-bold text-on-surface-variant">X</p>
          <p className="text-sm font-mono font-bold text-primary">{Number(d.x || 0).toFixed(3)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase font-bold text-on-surface-variant">Y</p>
          <p className="text-sm font-mono font-bold text-primary">{Number(d.y || 0).toFixed(3)}</p>
        </div>
      </div>
      {d.is_chelsea && (
        <p className="mt-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Chelsea FC</p>
      )}
    </div>
  )
}

export default function ScatterPlot() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [meta, setMeta] = useState({ metrics: [], x_label: 'xG/90', y_label: 'xA/90', top_outlier: '', last_updated: 'Live' })
  const [xMetric, setXMetric] = useState('xg_per90')
  const [yMetric, setYMetric] = useState('xa_per90')
  const [positions, setPositions] = useState({ GK: true, DEF: true, MID: true, WNG: true, FWD: true })
  const [minMinutes, setMinMinutes] = useState(450)
  const [season, setSeason] = useState('2025-26')
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const activePOS = Object.entries(positions).filter(([, v]) => v).map(([k]) => k).join(',')
    const seasonParam = season === 'All Seasons' ? undefined : season
    try {
      const res = await getScatter({
        x_metric: xMetric,
        y_metric: yMetric,
        min_minutes: minMinutes,
        positions: activePOS || undefined,
        season: seasonParam,
      })
      setData(res.data.data || [])
      setMeta({
        metrics: res.data.metrics || [],
        x_label: res.data.x_label || xMetric,
        y_label: res.data.y_label || yMetric,
        top_outlier: res.data.top_outlier || '',
        last_updated: res.data.last_updated || 'Live',
      })
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [xMetric, yMetric, minMinutes, positions, season])

  useEffect(() => { fetchData() }, [fetchData])

  const chelsea = data.filter(d => d.is_chelsea)
  const others = data.filter(d => !d.is_chelsea)

  const xVals = data.map(d => d.x).filter(Boolean)
  const yVals = data.map(d => d.y).filter(Boolean)
  const xMed = xVals.length ? [...xVals].sort((a, b) => a - b)[Math.floor(xVals.length / 2)] : 0
  const yMed = yVals.length ? [...yVals].sort((a, b) => a - b)[Math.floor(yVals.length / 2)] : 0

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Analysis</p>
        <h1 className="text-4xl font-headline font-black text-on-surface">Scatter Analysis</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Plot any two metrics across the database. Chelsea FC players highlighted in blue.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-surface-container rounded-xl p-5 mb-6 grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
        <div>
          <label className="label-xs block mb-1.5">Season</label>
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">X Axis</label>
          <select
            value={xMetric}
            onChange={e => setXMetric(e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {meta.metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Y Axis</label>
          <select
            value={yMetric}
            onChange={e => setYMetric(e.target.value)}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            {meta.metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Min Minutes</label>
          <div className="flex items-center gap-2">
            <input
              type="range" min="100" max="2000" step="50"
              value={minMinutes}
              onChange={e => setMinMinutes(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-xs font-mono font-bold text-primary w-10">{minMinutes}</span>
          </div>
        </div>

        <div>
          <label className="label-xs block mb-1.5">Positions</label>
          <div className="flex gap-1.5 flex-wrap">
            {['GK', 'DEF', 'MID', 'WNG', 'FWD'].map(pos => (
              <button
                key={pos}
                onClick={() => setPositions(p => ({ ...p, [pos]: !p[pos] }))}
                className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-tight transition-all ${
                  positions[pos] ? 'text-white' : 'bg-surface-container-high text-on-surface-variant'
                }`}
                style={positions[pos] ? { backgroundColor: POSITION_COLORS[pos] } : {}}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-surface-container rounded-xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-4 text-xs text-on-surface-variant">
            <p className="label-xs">{data.length.toLocaleString()} players plotted</p>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-outline-variant" />
              All players
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              Chelsea FC
            </span>
          </div>
          {meta.top_outlier && (
            <p className="text-xs text-on-surface-variant">
              Top {meta.x_label}: <span className="text-primary font-bold">{meta.top_outlier}</span>
            </p>
          )}
        </div>

        {loading ? (
          <div className="h-[480px] flex items-center justify-center">
            <p className="text-on-surface-variant text-sm">Loading data…</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={480}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 30 }}>
              <CartesianGrid stroke="#192540" strokeOpacity={0.5} />
              <XAxis
                type="number" dataKey="x"
                name={meta.x_label}
                label={{ value: meta.x_label, position: 'insideBottom', offset: -20, fill: '#a3aac4', fontSize: 11 }}
                tick={{ fill: '#a3aac4', fontSize: 10 }}
              />
              <YAxis
                type="number" dataKey="y"
                name={meta.y_label}
                label={{ value: meta.y_label, angle: -90, position: 'insideLeft', offset: 10, fill: '#a3aac4', fontSize: 11 }}
                tick={{ fill: '#a3aac4', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#40485d' }} />
              <ReferenceLine x={xMed} stroke="#40485d" strokeDasharray="4 4" />
              <ReferenceLine y={yMed} stroke="#40485d" strokeDasharray="4 4" />
              <Scatter
                name="All Players" data={others}
                fill="#40485d" fillOpacity={0.6}
                shape={({ cx, cy, payload }) => (
                  <circle
                    cx={cx} cy={cy} r={3.5}
                    fill={POSITION_COLORS[payload.position_group] || '#40485d'}
                    fillOpacity={0.35}
                    stroke="none"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/players/${payload.player_id}`)}
                  />
                )}
              />
              <Scatter
                name="Chelsea FC" data={chelsea}
                shape={({ cx, cy, payload }) => (
                  <g style={{ cursor: 'pointer' }} onClick={() => navigate(`/players/${payload.player_id}`)}>
                    <circle cx={cx} cy={cy} r={7} fill="#85adff" fillOpacity={1.0} stroke="#60a5fa" strokeWidth={1.5} />
                  </g>
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}

        <div className="mt-3 flex items-center gap-6 text-xs text-on-surface-variant border-t border-outline-variant/10 pt-3">
          <span>Sample size: {data.length.toLocaleString()}</span>
          {meta.top_outlier && <span>Top outlier: <span className="text-primary">{meta.top_outlier}</span></span>}
          <span className="ml-auto">Last updated: {meta.last_updated}</span>
        </div>
      </div>
    </div>
  )
}
