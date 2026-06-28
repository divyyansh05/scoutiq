import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ScoreRing from '../components/ScoreRing'
import {
  getTacticalPresets,
  createTacticalPreset,
  updateTacticalPreset,
  deleteTacticalPreset,
  getPlayerTacticalFit,
} from '../api/client'

const AVAILABLE_KPIS = [
  { key: 'xg_p90',                  label: 'xG per 90' },
  { key: 'xa_p90',                  label: 'xA per 90' },
  { key: 'goals_p90',               label: 'Goals per 90' },
  { key: 'key_passes_p90',          label: 'Key Passes per 90' },
  { key: 'shots_p90',               label: 'Shots per 90' },
  { key: 'tackles_p90',             label: 'Tackles per 90' },
  { key: 'interceptions_p90',       label: 'Interceptions per 90' },
  { key: 'aerial_won_p90',          label: 'Aerial Duels Won per 90' },
  { key: 'successful_dribbles_p90', label: 'Dribbles per 90' },
  { key: 'recoveries_p90',          label: 'Recoveries per 90' },
  { key: 'accurate_passes_pct',     label: 'Pass Accuracy %' },
]

const STYLE_COLOURS = {
  pressing:   'text-red-400 bg-red-400/10 border-red-400/20',
  possession: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  counter:    'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

function scoreColour(score) {
  if (score >= 90) return 'text-green-400'
  if (score >= 75) return 'text-teal-400'
  if (score >= 60) return 'text-blue-400'
  if (score >= 40) return 'text-yellow-400'
  if (score >= 25) return 'text-orange-400'
  return 'text-red-400'
}

function scoreBg(score) {
  if (score >= 90) return 'bg-green-400'
  if (score >= 75) return 'bg-teal-400'
  if (score >= 60) return 'bg-blue-400'
  if (score >= 40) return 'bg-yellow-400'
  if (score >= 25) return 'bg-orange-400'
  return 'bg-red-400'
}

function emptyWeights() {
  return Object.fromEntries(AVAILABLE_KPIS.map(k => [k.key, 0]))
}

function PresetForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [tacticalStyle, setTacticalStyle] = useState(initial?.tactical_style || '')
  const [weights, setWeights] = useState(() => {
    const base = emptyWeights()
    if (initial?.kpi_weights) {
      Object.entries(initial.kpi_weights).forEach(([k, v]) => { base[k] = v })
    }
    return base
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = Object.values(weights).reduce((a, b) => a + Number(b), 0)
  const valid = name.trim().length > 0 && Math.abs(total - 100) <= 1

  const setWeight = (key, val) => {
    setWeights(w => ({ ...w, [key]: Number(val) }))
    setError('')
  }

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    setError('')
    try {
      const activeWeights = Object.fromEntries(
        Object.entries(weights).filter(([, v]) => v > 0)
      )
      await onSave({ name: name.trim(), description: description.trim() || null, tactical_style: tacticalStyle || null, kpi_weights: activeWeights })
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to save preset'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const totalColour = Math.abs(total - 100) <= 1
    ? 'text-green-400'
    : total > 100
      ? 'text-red-400'
      : 'text-yellow-400'

  return (
    <div className="bg-surface-container-high rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs block mb-1.5">Preset Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Gegenpressing"
            className="w-full bg-surface-container text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="label-xs block mb-1.5">Tactical Style</label>
          <select
            value={tacticalStyle}
            onChange={e => setTacticalStyle(e.target.value)}
            className="w-full bg-surface-container text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
          >
            <option value="">None</option>
            <option value="pressing">Pressing</option>
            <option value="possession">Possession</option>
            <option value="counter">Counter Attack</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label-xs block mb-1.5">Description</label>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          className="w-full bg-surface-container text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none focus:border-primary/50"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="label-xs">KPI Weights</p>
          <span className={`text-xs font-mono font-bold ${totalColour}`}>
            Total: {total} / 100
          </span>
        </div>
        <div className="space-y-2">
          {AVAILABLE_KPIS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className={`text-[10px] font-bold flex-1 ${weights[key] > 0 ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {label}
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weights[key]}
                onChange={e => setWeight(key, e.target.value)}
                className="w-28 accent-blue-500"
              />
              <span className={`text-xs font-mono font-bold w-8 text-right ${weights[key] > 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
                {weights[key]}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-on-surface-variant mt-2">
          Weights must sum to exactly 100 (±1). Use the sliders above.
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={!valid || saving}
          className="btn-primary flex-1 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Preset'}
        </button>
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  )
}

function StyleBadge({ style }) {
  if (!style) return null
  const cls = STYLE_COLOURS[style] || 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
      {style}
    </span>
  )
}

function PresetCard({ preset, onEdit, onDelete, isEditMode, editId, onCancelEdit, onSaveEdit }) {
  const activeKpis = Object.entries(preset.kpi_weights).filter(([, v]) => v > 0)

  if (isEditMode && editId === preset.id) {
    return (
      <PresetForm
        initial={preset}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
      />
    )
  }

  return (
    <div className="bg-surface-container rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-headline font-bold text-on-surface text-sm">{preset.name}</h3>
            {preset.is_default && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                Default
              </span>
            )}
            <StyleBadge style={preset.tactical_style} />
          </div>
          {preset.description && (
            <p className="text-on-surface-variant text-xs">{preset.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button
            onClick={() => onEdit(preset)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors"
            title="Edit preset"
          >
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button
            onClick={() => onDelete(preset)}
            disabled={preset.is_default}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={preset.is_default ? 'Cannot delete default presets' : 'Delete preset'}
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {activeKpis.map(([key, weight]) => {
          const kpi = AVAILABLE_KPIS.find(k => k.key === key)
          return (
            <div
              key={key}
              className="flex items-center gap-1 bg-surface-container-high rounded-lg px-2 py-1"
            >
              <span className="text-[10px] text-on-surface-variant">{kpi?.label || key}</span>
              <span className="text-[10px] font-bold text-primary">{weight}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TacticalFit() {
  const [presets, setPresets] = useState([])
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [presetsError, setPresetsError] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [editId, setEditId] = useState(null)

  const [playerId, setPlayerId] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('')
  const [fitLoading, setFitLoading] = useState(false)
  const [fitError, setFitError] = useState('')
  const [fitResult, setFitResult] = useState(null)

  const loadPresets = async () => {
    setPresetsLoading(true)
    setPresetsError('')
    try {
      const res = await getTacticalPresets()
      setPresets(res.data)
    } catch {
      setPresetsError('Failed to load presets')
    } finally {
      setPresetsLoading(false)
    }
  }

  useEffect(() => { loadPresets() }, [])

  const handleCreate = async (data) => {
    await createTacticalPreset(data)
    setShowNewForm(false)
    await loadPresets()
  }

  const handleSaveEdit = async (data) => {
    await updateTacticalPreset(editId, data)
    setEditId(null)
    await loadPresets()
  }

  const handleDelete = async (preset) => {
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return
    try {
      await deleteTacticalPreset(preset.id)
      await loadPresets()
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to delete preset')
    }
  }

  const handleCalculateFit = async () => {
    if (!playerId.trim() || !selectedPreset) return
    setFitLoading(true)
    setFitError('')
    setFitResult(null)
    try {
      const res = await getPlayerTacticalFit(selectedPreset, playerId.trim())
      setFitResult(res.data)
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to calculate fit'
      setFitError(msg)
    } finally {
      setFitLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Intelligence</p>
        <h1 className="text-4xl font-headline font-black text-on-surface">Tactical Fit</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Match players to a manager's tactical system using weighted KPIs.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Section A: Manager Presets */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline font-bold text-on-surface text-lg">Manager Presets</h2>
            {!showNewForm && (
              <button
                onClick={() => { setShowNewForm(true); setEditId(null) }}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                <span className="material-symbols-outlined text-base">add</span>
                New Preset
              </button>
            )}
          </div>

          {showNewForm && (
            <PresetForm
              onSave={handleCreate}
              onCancel={() => setShowNewForm(false)}
            />
          )}

          {presetsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-surface-container rounded-xl animate-pulse" />
              ))}
            </div>
          ) : presetsError ? (
            <div className="bg-surface-container rounded-xl p-6 text-center">
              <p className="text-red-400 text-sm">{presetsError}</p>
              <button onClick={loadPresets} className="btn-secondary text-xs mt-3">Retry</button>
            </div>
          ) : presets.length === 0 ? (
            <div className="bg-surface-container rounded-xl p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">sports_soccer</span>
              <p className="text-on-surface-variant text-sm">No presets yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {presets.map(preset => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  editId={editId}
                  isEditMode={editId === preset.id}
                  onEdit={(p) => { setEditId(p.id); setShowNewForm(false) }}
                  onDelete={handleDelete}
                  onCancelEdit={() => setEditId(null)}
                  onSaveEdit={handleSaveEdit}
                />
              ))}
            </div>
          )}
        </div>

        {/* Section B: Player Fit Lookup */}
        <div className="space-y-4">
          <h2 className="font-headline font-bold text-on-surface text-lg">Player Tactical Fit</h2>

          <div className="bg-surface-container rounded-xl p-5 space-y-4">
            <div>
              <label className="label-xs block mb-1.5">Player ID</label>
              <input
                type="number"
                value={playerId}
                onChange={e => setPlayerId(e.target.value)}
                placeholder="Enter player_id (e.g. 42)"
                className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none focus:border-primary/50"
              />
              <p className="text-[10px] text-on-surface-variant mt-1">
                Find player IDs via Player Search (/players).
              </p>
            </div>

            <div>
              <label className="label-xs block mb-1.5">Manager Preset</label>
              <select
                value={selectedPreset}
                onChange={e => setSelectedPreset(e.target.value)}
                className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant/20 focus:outline-none"
              >
                <option value="">Select a preset…</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCalculateFit}
              disabled={!playerId.trim() || !selectedPreset || fitLoading}
              className="btn-primary w-full disabled:opacity-40"
            >
              {fitLoading ? 'Calculating…' : 'Calculate Fit'}
            </button>
          </div>

          {/* Result */}
          {fitLoading && (
            <div className="space-y-3">
              <div className="h-40 bg-surface-container rounded-xl animate-pulse" />
              <div className="h-48 bg-surface-container rounded-xl animate-pulse" />
            </div>
          )}

          {fitError && (
            <div className="bg-surface-container rounded-xl p-5">
              <p className="text-red-400 text-sm">{fitError}</p>
            </div>
          )}

          {fitResult && !fitLoading && (
            <div className="space-y-4">
              {/* Score card */}
              <div className="bg-surface-container rounded-xl p-5">
                <div className="flex items-center gap-5">
                  <ScoreRing score={fitResult.tactical_fit_score} size={96} strokeWidth={8} />
                  <div className="flex-1">
                    <h3 className="font-headline font-bold text-on-surface text-lg leading-tight">
                      {fitResult.player_name}
                    </h3>
                    <p className="text-on-surface-variant text-sm mt-0.5">
                      vs <span className="text-on-surface font-semibold">{fitResult.preset_name}</span>
                    </p>
                    <p className="text-on-surface-variant text-xs mt-1">
                      Position: <span className="text-on-surface">{fitResult.position_group}</span>
                    </p>
                    <p className={`text-xl font-headline font-black mt-2 ${scoreColour(fitResult.tactical_fit_score)}`}>
                      {fitResult.tactical_fit_score.toFixed(1)} <span className="text-sm font-normal text-on-surface-variant">/ 100</span>
                    </p>
                  </div>
                  <Link
                    to={`/players/${fitResult.player_id}`}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    Full profile
                  </Link>
                </div>
              </div>

              {/* Breakdown table */}
              <div className="bg-surface-container rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-outline-variant/10">
                  <p className="label-xs">KPI Breakdown</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant/10">
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-on-surface-variant">KPI</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider text-on-surface-variant">Value</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider text-on-surface-variant">Percentile</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider text-on-surface-variant">Weight</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider text-on-surface-variant">Contrib.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {fitResult.breakdown.map(row => (
                        <tr key={row.kpi} className="hover:bg-surface-bright transition-colors">
                          <td className="px-4 py-3 text-on-surface">{row.label}</td>
                          <td className="px-4 py-3 text-right font-mono text-on-surface-variant">
                            {row.player_value != null ? row.player_value.toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${scoreBg(row.percentile)}`}
                                  style={{ width: `${row.percentile}%` }}
                                />
                              </div>
                              <span className={`font-mono font-bold w-8 text-right ${scoreColour(row.percentile)}`}>
                                {row.percentile.toFixed(0)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-on-surface-variant">{row.weight}%</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-primary">{row.contribution.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-outline-variant/20">
                        <td colSpan={4} className="px-4 py-3 font-bold uppercase tracking-wider text-on-surface-variant text-right">
                          Tactical Fit Score
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-black text-base ${scoreColour(fitResult.tactical_fit_score)}`}>
                          {fitResult.tactical_fit_score.toFixed(1)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
