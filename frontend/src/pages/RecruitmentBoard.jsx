import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getRecruitmentPipeline,
  addToRecruitment,
  moveRecruitmentStage,
  removeFromRecruitment,
  searchPlayers,
} from '../api/client'

const STAGES = [
  { key: 'identified',  label: 'Identified',  color: 'bg-slate-500/20 border-slate-500/30 text-slate-300' },
  { key: 'scouted',     label: 'Scouted',     color: 'bg-blue-500/20 border-blue-500/30 text-blue-300' },
  { key: 'shortlisted', label: 'Shortlisted', color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300' },
  { key: 'approached',  label: 'Approached',  color: 'bg-orange-500/20 border-orange-500/30 text-orange-300' },
  { key: 'signed',      label: 'Signed',      color: 'bg-green-500/20 border-green-500/30 text-green-300' },
  { key: 'rejected',    label: 'Rejected',    color: 'bg-red-500/20 border-red-500/30 text-red-300' },
]

const STAGE_KEYS = STAGES.map((s) => s.key)

const POSITION_COLORS = {
  GK:  'text-purple-400 bg-purple-400/10 border-purple-400/30',
  DEF: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  MID: 'text-green-400 bg-green-400/10 border-green-400/30',
  FWD: 'text-red-400 bg-red-400/10 border-red-400/30',
  WNG: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
}

function scoreColor(score) {
  if (score === null || score === undefined) return 'text-slate-400'
  if (score >= 90) return 'text-green-400'
  if (score >= 75) return 'text-teal-400'
  if (score >= 60) return 'text-blue-400'
  if (score >= 40) return 'text-yellow-400'
  if (score >= 25) return 'text-orange-400'
  return 'text-red-400'
}

function formatMarketValue(val) {
  if (val === null || val === undefined) return '—'
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}K`
  return `€${val}`
}

function contractWarning(contractExpires) {
  if (!contractExpires) return null
  const expiry = new Date(contractExpires)
  const now = new Date()
  const oneYearFromNow = new Date()
  oneYearFromNow.setFullYear(now.getFullYear() + 1)
  if (expiry <= oneYearFromNow) return 'expiring'
  return 'ok'
}

// ── Add Player Modal ──────────────────────────────────────────────────────────

function AddPlayerModal({ onClose, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [stage, setStage] = useState('identified')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const searchTimer = useRef(null)

  function handleQueryChange(e) {
    const q = e.target.value
    setQuery(q)
    setSelected(null)
    clearTimeout(searchTimer.current)
    if (q.trim().length < 2) { setResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchPlayers({ q: q.trim(), page_size: 8, min_minutes: 0 })
        setResults(res.data?.players || [])
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
  }

  function handleSelect(player) {
    setSelected(player)
    setQuery(player.player_name)
    setResults([])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!selected) { setError('Select a player from the search results.'); return }
    const payload = {
      player_id: selected.player_id,
      player_name: selected.player_name,
      team_name: selected.team_name || null,
      league_name: selected.league_name || null,
      position_group: selected.position_group || null,
      age: selected.age || null,
      nationality: selected.nationality || null,
      performance_score: selected.score != null ? parseFloat(selected.score) : null,
      market_value_eur: selected.market_value_eur || null,
      contract_expires: selected.contract_expires || null,
      notes: notes.trim() || null,
      stage,
    }
    setSubmitting(true)
    try {
      await onAdd(payload)
      onClose()
    } catch (err) {
      if (err?.response?.status === 409) {
        setError('This player is already in the recruitment pipeline.')
      } else {
        setError(err?.response?.data?.detail || 'Failed to add player.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1f3c] border border-outline-variant/20 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
          <h2 className="font-headline font-bold text-on-surface text-lg">Add to Pipeline</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Player search */}
          <div className="relative">
            <label className="block text-xs font-headline font-bold text-slate-400 uppercase tracking-wide mb-1">
              Player Search <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Type player name…"
                autoFocus
                className="w-full bg-surface-1 border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-primary/50 pr-8"
              />
              {searching && (
                <span className="absolute right-2 top-2 material-symbols-outlined text-sm text-slate-400 animate-spin">autorenew</span>
              )}
            </div>
            {results.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-[#0d1f3c] border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                {results.map(p => (
                  <button
                    key={p.player_id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-surface-bright text-left transition-colors border-b border-outline-variant/10 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{p.player_name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{p.team_name} · {p.position_group}</p>
                    </div>
                    {p.score != null && (
                      <span className="text-xs font-mono font-bold text-primary shrink-0">{Number(p.score).toFixed(0)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected player preview */}
          {selected && (
            <div className="bg-surface-container-high rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-base">check_circle</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-surface truncate">{selected.player_name}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {[selected.team_name, selected.position_group, selected.age ? `Age ${selected.age}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" onClick={() => { setSelected(null); setQuery('') }} className="text-slate-500 hover:text-red-400 transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Stage selector */}
          <div>
            <label className="block text-xs font-headline font-bold text-slate-400 uppercase tracking-wide mb-1">Initial Stage</label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="w-full bg-surface-1 border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-primary/50"
            >
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          {/* Optional notes */}
          <div>
            <label className="block text-xs font-headline font-bold text-slate-400 uppercase tracking-wide mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Scouting notes, reasons for tracking…"
              rows={2}
              className="w-full bg-surface-1 border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-primary/50 resize-none placeholder:text-slate-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-headline font-bold text-xs tracking-wide transition-colors">
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting || !selected}
              className="px-5 py-2 bg-primary/20 hover:bg-primary/30 text-blue-400 border border-primary/30 rounded-lg font-headline font-bold text-xs tracking-wide transition-colors disabled:opacity-50"
            >
              {submitting ? 'ADDING…' : 'ADD PLAYER'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Player Card ───────────────────────────────────────────────────────────────

function PlayerCard({ player, stageIndex, onMove, onRemove }) {
  const navigate = useNavigate()
  const [moving, setMoving] = useState(false)
  const [removing, setRemoving] = useState(false)

  const canMoveBack = stageIndex > 0
  const canMoveForward = stageIndex < STAGE_KEYS.length - 1

  async function handleMove(direction) {
    const newStage = STAGE_KEYS[stageIndex + direction]
    setMoving(true)
    try {
      await onMove(player.id, newStage)
    } finally {
      setMoving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await onRemove(player.id)
    } finally {
      setRemoving(false)
    }
  }

  const posColor = POSITION_COLORS[player.position_group] || 'text-slate-400 bg-slate-400/10 border-slate-400/30'
  const contractStatus = contractWarning(player.contract_expires)
  const expiryYear = player.contract_expires
    ? new Date(player.contract_expires).getFullYear()
    : null

  return (
    <div className="bg-[#0d1f3c] border border-outline-variant/15 rounded-xl p-4 space-y-3 hover:border-outline-variant/30 transition-colors">
      {/* Header: name + remove */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-headline font-bold text-on-surface text-sm leading-tight truncate">
            {player.player_name}
          </p>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {[player.team_name, player.league_name].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <button
          onClick={handleRemove}
          disabled={removing}
          title="Remove from pipeline"
          className="shrink-0 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      </div>

      {/* Position + Age + Nationality */}
      <div className="flex items-center gap-2 flex-wrap">
        {player.position_group && (
          <span className={`text-[10px] font-headline font-bold px-2 py-0.5 rounded-full border ${posColor}`}>
            {player.position_group}
          </span>
        )}
        {player.age && (
          <span className="text-xs text-slate-400">{player.age}y</span>
        )}
        {player.nationality && (
          <span className="text-xs text-slate-400">{player.nationality}</span>
        )}
      </div>

      {/* Score + Value */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-headline font-bold tracking-wide">Score</p>
          <p className={`text-lg font-headline font-bold ${scoreColor(player.performance_score)}`}>
            {player.performance_score !== null && player.performance_score !== undefined
              ? player.performance_score.toFixed(0)
              : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase font-headline font-bold tracking-wide">Value</p>
          <p className="text-sm font-headline font-bold text-slate-300">
            {formatMarketValue(player.market_value_eur)}
          </p>
        </div>
      </div>

      {/* Contract expiry */}
      {expiryYear && (
        <div className="flex items-center gap-1.5">
          {contractStatus === 'expiring' ? (
            <span className="text-[10px] font-headline font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5">
              ⚠ Expiring {expiryYear}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500">
              Contract: {expiryYear}
            </span>
          )}
        </div>
      )}

      {/* Notes (truncated) */}
      {player.notes && (
        <p className="text-[11px] text-slate-500 italic line-clamp-2 border-t border-outline-variant/10 pt-2">
          {player.notes}
        </p>
      )}

      {/* Action buttons */}
      <div className="space-y-2 pt-1 border-t border-outline-variant/10">
        {/* Move controls */}
        <div className="flex gap-2">
          <button
            onClick={() => handleMove(-1)}
            disabled={!canMoveBack || moving}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-headline font-bold text-slate-400 hover:text-slate-200 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-xs">arrow_back</span>
            BACK
          </button>
          <button
            onClick={() => handleMove(1)}
            disabled={!canMoveForward || moving}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-headline font-bold text-blue-400 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            FORWARD
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </div>
        {/* View profile */}
        <button
          onClick={() => navigate(`/players/${player.player_id}`)}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] font-headline font-bold text-slate-400 hover:text-slate-200 bg-slate-700/20 hover:bg-slate-700/40 rounded-lg py-1.5 transition-colors"
        >
          <span className="material-symbols-outlined text-xs">open_in_new</span>
          VIEW PROFILE
        </button>
      </div>
    </div>
  )
}

// ── Stage Column ──────────────────────────────────────────────────────────────

function StageColumn({ stage, stageIndex, players, onMove, onRemove }) {
  return (
    <div className="flex flex-col gap-3 min-w-[260px] max-w-[280px]">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${stage.color}`}>
        <span className="font-headline font-bold text-xs tracking-wide uppercase">
          {stage.label}
        </span>
        <span className="font-headline font-bold text-xs tabular-nums">
          {players.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {players.length === 0 ? (
          <div className="border border-dashed border-outline-variant/20 rounded-xl p-6 text-center">
            <p className="text-xs text-slate-600 font-headline">No players</p>
          </div>
        ) : (
          players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              stageIndex={stageIndex}
              onMove={onMove}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RecruitmentBoard() {
  const [pipeline, setPipeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)

  async function fetchPipeline() {
    try {
      const res = await getRecruitmentPipeline()
      setPipeline(res.data)
      setError(null)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load recruitment pipeline.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPipeline()
  }, [])

  async function handleAdd(data) {
    await addToRecruitment(data)
    await fetchPipeline()
  }

  async function handleMove(id, stage) {
    await moveRecruitmentStage(id, stage)
    await fetchPipeline()
  }

  async function handleRemove(id) {
    await removeFromRecruitment(id)
    await fetchPipeline()
  }

  const totalPlayers = pipeline
    ? Object.values(pipeline).reduce((sum, arr) => sum + arr.length, 0)
    : 0

  return (
    <div className="p-8 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-headline font-black text-3xl text-on-surface tracking-tight">
            Recruitment Board
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Transfer pipeline management
            {pipeline && (
              <span className="ml-2 text-slate-500">· {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} tracked</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-blue-400 border border-primary/30 rounded-xl font-headline font-bold text-xs tracking-wide transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          ADD PLAYER
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">autorenew</span>
            <p className="text-slate-400 text-sm font-headline">Loading pipeline…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="material-symbols-outlined text-4xl text-red-400">error</span>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={fetchPipeline}
            className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-blue-400 rounded-lg text-xs font-headline font-bold tracking-wide transition-colors"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Kanban board */}
      {!loading && !error && pipeline && (
        <div className="overflow-x-auto pb-6">
          <div className="flex gap-4 min-w-max">
            {STAGES.map((stage, idx) => (
              <StageColumn
                key={stage.key}
                stage={stage}
                stageIndex={idx}
                players={pipeline[stage.key] || []}
                onMove={handleMove}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showModal && (
        <AddPlayerModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
