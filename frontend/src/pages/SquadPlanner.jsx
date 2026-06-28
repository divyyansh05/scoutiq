import { exportSquadPlanReport } from '../utils/export'
import { useState, useEffect, useCallback, useRef } from 'react'
import PositionBadge from '../components/PositionBadge'
import ScoreRing from '../components/ScoreRing'
import {
  getPlannerPlans,
  createPlannerPlan,
  deletePlannerPlan,
  getPlannerPlan,
  addPlannerPlayer,
  updatePlannerSlot,
  removePlannerPlayer,
  getPlannerCurrentSquad,
} from '../api/client'

// ── Constants ──────────────────────────────────────────────────────────────

const POSITION_GROUPS = ['GK', 'DEF', 'MID', 'FWD']
const POSITION_CAPS = { GK: 3, DEF: 6, MID: 6, FWD: 5 }
const POSITION_LABELS = { GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' }

const KNOWN_TEAMS = [
  { team_id: 10, name: 'Chelsea' },
  { team_id: 1, name: 'Arsenal' },
  { team_id: 4, name: 'Manchester City' },
  { team_id: 6, name: 'Liverpool' },
  { team_id: 5, name: 'Manchester United' },
  { team_id: 20, name: 'Tottenham Hotspur' },
]

const SQUAD_ROLES = [
  { value: 'first_team', label: 'First Team' },
  { value: 'loan', label: 'On Loan' },
  { value: 'academy', label: 'Academy' },
]

const ROLE_BADGE = {
  first_team: 'bg-blue-500/10 text-blue-400',
  loan: 'bg-amber-500/10 text-amber-400',
  academy: 'bg-purple-500/10 text-purple-400',
}

// ── Small helpers ──────────────────────────────────────────────────────────

function fmt(val, dp = 1) {
  if (val === null || val === undefined) return '—'
  return typeof val === 'number' ? val.toFixed(dp) : val
}

function scoreColor(score) {
  if (score === null || score === undefined) return 'text-on-surface/40'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 65) return 'text-blue-400'
  if (score >= 45) return 'text-amber-400'
  return 'text-red-400'
}

// ── Available Player Card (sidebar) ───────────────────────────────────────

function AvailableCard({ player, onDragStart, onAdd }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, { source: 'available', data: player })}
      className="bg-surface-container rounded-xl p-3 flex items-center gap-3 cursor-grab hover:bg-surface-container-high transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="font-headline font-semibold text-sm text-on-surface truncate">
          {player.player_name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <PositionBadge position={player.position_group} />
          <span className="text-xs text-on-surface/50">
            {player.age ? `${player.age}y` : '—'}
          </span>
          {player.nationality && (
            <span className="text-xs text-on-surface/40 truncate">{player.nationality}</span>
          )}
        </div>
      </div>
      {player.performance_score != null ? (
        <ScoreRing score={player.performance_score} size={36} strokeWidth={4} />
      ) : (
        <span className="text-xs text-on-surface/30 w-9 text-center">—</span>
      )}
      <button
        onClick={() => onAdd(player)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
        title="Add to plan"
      >
        <span className="material-symbols-outlined text-base leading-none">add</span>
      </button>
    </div>
  )
}

// ── Plan Slot Card ─────────────────────────────────────────────────────────

function SlotCard({ slot, onDragStart, onRemove, onRoleChange }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, { source: 'slot', id: slot.id, data: slot })}
      className="bg-surface-container-high rounded-xl p-3 flex items-center gap-3 cursor-grab relative group"
    >
      <div className="flex-1 min-w-0">
        <p className="font-headline font-semibold text-sm text-on-surface truncate">
          {slot.player_name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-on-surface/50">{slot.age ? `${slot.age}y` : '—'}</span>
          {slot.nationality && (
            <span className="text-xs text-on-surface/40 truncate max-w-[80px]">
              {slot.nationality}
            </span>
          )}
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[slot.squad_role] || ROLE_BADGE.first_team}`}
          >
            {SQUAD_ROLES.find((r) => r.value === slot.squad_role)?.label || 'First Team'}
          </span>
        </div>
      </div>

      {slot.performance_score != null ? (
        <ScoreRing score={slot.performance_score} size={36} strokeWidth={4} />
      ) : (
        <span className="text-xs text-on-surface/30 w-9 text-center">—</span>
      )}

      {/* Actions on hover */}
      <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-1">
        <select
          value={slot.squad_role || 'first_team'}
          onChange={(e) => onRoleChange(slot.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] bg-surface-container border border-outline-variant/20 rounded px-1 py-0.5 text-on-surface/70 cursor-pointer"
        >
          {SQUAD_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(slot.id) }}
          className="p-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
          title="Remove"
        >
          <span className="material-symbols-outlined text-sm leading-none">close</span>
        </button>
      </div>
    </div>
  )
}

// ── Empty drop placeholder ─────────────────────────────────────────────────

function EmptySlot({ onDrop, onDragOver }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); onDragOver(e) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(e) }}
      className={`rounded-xl border-2 border-dashed flex items-center justify-center h-16 transition-all ${
        over ? 'border-primary bg-primary/5' : 'border-outline-variant/20 bg-surface-container/30'
      }`}
    >
      <span className="text-xs text-on-surface/30">Drop here</span>
    </div>
  )
}

// ── Position Row ───────────────────────────────────────────────────────────

function PositionRow({ position, slots, maxSlots, onDragStart, onDrop, onDragOver, onRemove, onRoleChange }) {
  const filled = slots.filter((s) => s.position_group === position)
  const emptyCount = Math.max(0, maxSlots - filled.length)

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <PositionBadge position={position} />
        <span className="text-xs font-headline font-bold text-on-surface/60 tracking-widest uppercase">
          {POSITION_LABELS[position]}
        </span>
        <span className="text-xs text-on-surface/40 ml-auto">
          {filled.length}/{maxSlots}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {filled.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            onDragStart={onDragStart}
            onRemove={onRemove}
            onRoleChange={onRoleChange}
          />
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <EmptySlot
            key={`empty-${position}-${i}`}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, position)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Summary Panel ──────────────────────────────────────────────────────────

function SummaryPanel({ slots, onExport }) {
  const total = slots.length
  const byPos = POSITION_GROUPS.reduce((acc, p) => {
    acc[p] = slots.filter((s) => s.position_group === p).length
    return acc
  }, {})

  const withScore = slots.filter((s) => s.performance_score != null)
  const avgScore =
    withScore.length > 0
      ? withScore.reduce((sum, s) => sum + s.performance_score, 0) / withScore.length
      : null

  const u23 = slots.filter((s) => s.age != null && s.age < 23).length
  const prime = slots.filter((s) => s.age != null && s.age >= 23 && s.age <= 28).length
  const senior = slots.filter((s) => s.age != null && s.age > 28).length
  const noAge = slots.filter((s) => s.age == null).length

  const byRole = SQUAD_ROLES.reduce((acc, r) => {
    acc[r.value] = slots.filter((s) => s.squad_role === r.value).length
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-4">
      {/* Squad count */}
      <div className="bg-surface-container rounded-2xl p-4">
        <p className="text-xs font-headline font-bold tracking-widest uppercase text-on-surface/50 mb-3">
          Squad Size
        </p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-headline font-black text-on-surface">{total}</span>
          <span className="text-on-surface/40 text-lg mb-1">/ 25</span>
        </div>
        <div className="mt-2 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(100, (total / 25) * 100)}%` }}
          />
        </div>
      </div>

      {/* Position balance */}
      <div className="bg-surface-container rounded-2xl p-4">
        <p className="text-xs font-headline font-bold tracking-widest uppercase text-on-surface/50 mb-3">
          By Position
        </p>
        <div className="space-y-2">
          {POSITION_GROUPS.map((p) => (
            <div key={p} className="flex items-center gap-3">
              <PositionBadge position={p} />
              <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (byPos[p] / POSITION_CAPS[p]) * 100)}%`,
                    backgroundColor:
                      p === 'GK' ? '#a855f7' :
                      p === 'DEF' ? '#3b82f6' :
                      p === 'MID' ? '#22c55e' : '#ef4444',
                  }}
                />
              </div>
              <span className="text-xs text-on-surface/60 w-12 text-right">
                {byPos[p]}/{POSITION_CAPS[p]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Age spread */}
      <div className="bg-surface-container rounded-2xl p-4">
        <p className="text-xs font-headline font-bold tracking-widest uppercase text-on-surface/50 mb-3">
          Age Spread
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-headline font-black text-emerald-400">{u23}</p>
            <p className="text-[10px] text-on-surface/50 mt-0.5">U-23</p>
          </div>
          <div>
            <p className="text-2xl font-headline font-black text-blue-400">{prime}</p>
            <p className="text-[10px] text-on-surface/50 mt-0.5">23-28</p>
          </div>
          <div>
            <p className="text-2xl font-headline font-black text-amber-400">{senior}</p>
            <p className="text-[10px] text-on-surface/50 mt-0.5">29+</p>
          </div>
        </div>
        {noAge > 0 && (
          <p className="text-[10px] text-on-surface/30 text-center mt-2">{noAge} no DOB data</p>
        )}
      </div>

      {/* Avg score */}
      <div className="bg-surface-container rounded-2xl p-4">
        <p className="text-xs font-headline font-bold tracking-widest uppercase text-on-surface/50 mb-3">
          Avg Performance Score
        </p>
        {avgScore != null ? (
          <div className="flex items-center gap-3">
            <ScoreRing score={avgScore} size={48} strokeWidth={6} />
            <div>
              <p className={`text-2xl font-headline font-black ${scoreColor(avgScore)}`}>
                {avgScore.toFixed(1)}
              </p>
              <p className="text-xs text-on-surface/40">across {withScore.length} scored</p>
            </div>
          </div>
        ) : (
          <p className="text-on-surface/40 text-sm">—</p>
        )}
      </div>

      {/* Squad roles */}
      <div className="bg-surface-container rounded-2xl p-4">
        <p className="text-xs font-headline font-bold tracking-widest uppercase text-on-surface/50 mb-3">
          By Role
        </p>
        <div className="space-y-1">
          {SQUAD_ROLES.map((r) => (
            <div key={r.value} className="flex items-center justify-between">
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ROLE_BADGE[r.value]}`}>
                {r.label}
              </span>
              <span className="text-sm font-headline font-bold text-on-surface/70">
                {byRole[r.value]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <button
        onClick={onExport}
        className="flex items-center justify-center gap-2 px-4 py-3 bg-surface-container rounded-2xl text-on-surface/70 hover:text-on-surface hover:bg-surface-container-high transition-colors text-sm font-headline font-bold"
      >
        <span className="material-symbols-outlined text-base">download</span>
        Export Report
      </button>
    </div>
  )
}

// ── Custom player modal ────────────────────────────────────────────────────

function AddCustomModal({ targetPosition, onConfirm, onClose }) {
  const [form, setForm] = useState({
    player_name: '',
    position_group: targetPosition || 'MID',
    age: '',
    nationality: '',
    squad_role: 'first_team',
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.player_name.trim()) return
    onConfirm({
      ...form,
      age: form.age ? parseInt(form.age) : null,
      is_custom: 1,
      performance_score: null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-surface-container rounded-2xl p-6 w-full max-w-md">
        <h2 className="font-headline font-black text-lg text-on-surface mb-4">Add Custom Player</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-on-surface/50 mb-1">Player Name *</label>
            <input
              autoFocus
              value={form.player_name}
              onChange={(e) => setForm({ ...form, player_name: e.target.value })}
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
              placeholder="e.g. João Silva"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-on-surface/50 mb-1">Position</label>
              <select
                value={form.position_group}
                onChange={(e) => setForm({ ...form, position_group: e.target.value })}
                className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
              >
                {POSITION_GROUPS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-on-surface/50 mb-1">Age</label>
              <input
                type="number"
                min="15"
                max="45"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                placeholder="e.g. 24"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-on-surface/50 mb-1">Nationality</label>
            <input
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
              placeholder="e.g. Portugal"
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface/50 mb-1">Squad Role</label>
            <select
              value={form.squad_role}
              onChange={(e) => setForm({ ...form, squad_role: e.target.value })}
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
            >
              {SQUAD_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface-container-high rounded-xl text-on-surface/60 hover:text-on-surface text-sm font-headline font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-xl text-sm font-headline font-bold hover:bg-primary/90"
            >
              Add Player
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function SquadPlanner() {
  const [plans, setPlans] = useState([])
  const [activePlanId, setActivePlanId] = useState(null)
  const [slots, setSlots] = useState([])
  const [planName, setPlanName] = useState('2026-27 Squad Plan')
  const [editingName, setEditingName] = useState(false)
  const [teamId, setTeamId] = useState(10)
  const [availablePlayers, setAvailablePlayers] = useState([])
  const [availableSearch, setAvailableSearch] = useState('')
  const [dragging, setDragging] = useState(null)
  const [loading, setLoading] = useState(true)
  const [squadLoading, setSquadLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customTargetPos, setCustomTargetPos] = useState('MID')
  const nameInputRef = useRef(null)

  // ── Load plans on mount ────────────────────────────────────────────────

  useEffect(() => {
    loadPlans()
  }, [])

  async function loadPlans() {
    setLoading(true)
    setError(null)
    try {
      const res = await getPlannerPlans()
      const data = res.data
      setPlans(data)
      if (data.length > 0) {
        await loadPlan(data[0].id)
      } else {
        // Create a default plan
        await createNewPlan()
      }
    } catch (err) {
      setError('Failed to load plans.')
    } finally {
      setLoading(false)
    }
  }

  async function loadPlan(id) {
    try {
      const res = await getPlannerPlan(id)
      const data = res.data
      setActivePlanId(data.id)
      setPlanName(data.name)
      setTeamId(data.team_id || 10)
      setSlots(data.players || [])
      // Also reload available players for this team
      await loadAvailablePlayers(data.team_id || 10)
    } catch (err) {
      setError('Failed to load plan.')
    }
  }

  async function loadAvailablePlayers(tid) {
    setSquadLoading(true)
    try {
      const res = await getPlannerCurrentSquad(tid)
      setAvailablePlayers(res.data || [])
    } catch {
      setAvailablePlayers([])
    } finally {
      setSquadLoading(false)
    }
  }

  async function createNewPlan() {
    try {
      const teamName = KNOWN_TEAMS.find((t) => t.team_id === teamId)?.name || 'Unknown'
      const res = await createPlannerPlan({
        name: '2026-27 Squad Plan',
        team_id: teamId,
        team_name: teamName,
      })
      const newPlan = res.data
      setActivePlanId(newPlan.id)
      setPlanName(newPlan.name)
      setSlots([])
      setPlans((prev) => [newPlan, ...prev])
      await loadAvailablePlayers(teamId)
    } catch {
      setError('Failed to create plan.')
    }
  }

  async function handleDeletePlan(id) {
    if (!window.confirm('Delete this plan?')) return
    try {
      await deletePlannerPlan(id)
      const remaining = plans.filter((p) => p.id !== id)
      setPlans(remaining)
      if (id === activePlanId) {
        if (remaining.length > 0) {
          await loadPlan(remaining[0].id)
        } else {
          setActivePlanId(null)
          setSlots([])
          setPlanName('2026-27 Squad Plan')
        }
      }
    } catch {
      setError('Failed to delete plan.')
    }
  }

  // ── Team switch ────────────────────────────────────────────────────────

  async function handleTeamChange(newTeamId) {
    setTeamId(newTeamId)
    await loadAvailablePlayers(newTeamId)
  }

  // ── Import current squad ───────────────────────────────────────────────

  async function handleImportSquad() {
    if (!activePlanId) return
    if (
      slots.length > 0 &&
      !window.confirm('This will add all current squad players to the plan. Continue?')
    )
      return
    setSquadLoading(true)
    try {
      const res = await getPlannerCurrentSquad(teamId)
      const players = res.data || []
      for (const p of players) {
        const added = await addPlannerPlayer(activePlanId, {
          player_id: p.player_id,
          player_name: p.player_name,
          position_group: p.position_group,
          age: p.age,
          nationality: p.nationality,
          performance_score: p.performance_score,
          squad_role: 'first_team',
          is_custom: 0,
        })
        setSlots((prev) => [...prev, added.data])
      }
    } catch {
      setError('Failed to import squad.')
    } finally {
      setSquadLoading(false)
    }
  }

  // ── Drag & drop ────────────────────────────────────────────────────────

  function handleDragStart(e, dragInfo) {
    setDragging(dragInfo)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDropOnPosition(e, position) {
    e.preventDefault()
    if (!dragging || !activePlanId) return

    if (dragging.source === 'available') {
      // Add from available list
      const p = dragging.data
      try {
        const res = await addPlannerPlayer(activePlanId, {
          player_id: p.player_id,
          player_name: p.player_name,
          position_group: position,
          age: p.age,
          nationality: p.nationality,
          performance_score: p.performance_score,
          squad_role: 'first_team',
          is_custom: 0,
        })
        setSlots((prev) => [...prev, res.data])
      } catch {
        setError('Failed to add player.')
      }
    } else if (dragging.source === 'slot') {
      // Reposition within plan
      const slot = dragging.data
      if (slot.position_group === position) {
        setDragging(null)
        return
      }
      try {
        const res = await updatePlannerSlot(activePlanId, slot.id, { position_group: position })
        setSlots((prev) => prev.map((s) => (s.id === slot.id ? res.data : s)))
      } catch {
        setError('Failed to move player.')
      }
    }
    setDragging(null)
  }

  // Drop on "available" zone to remove from plan
  async function handleDropOnAvailable(e) {
    e.preventDefault()
    if (!dragging || dragging.source !== 'slot' || !activePlanId) {
      setDragging(null)
      return
    }
    try {
      await removePlannerPlayer(activePlanId, dragging.data.id)
      setSlots((prev) => prev.filter((s) => s.id !== dragging.data.id))
    } catch {
      setError('Failed to remove player.')
    }
    setDragging(null)
  }

  // ── Direct add from sidebar ────────────────────────────────────────────

  async function handleAddFromAvailable(player, position) {
    if (!activePlanId) return
    const pos = position || player.position_group
    try {
      const res = await addPlannerPlayer(activePlanId, {
        player_id: player.player_id,
        player_name: player.player_name,
        position_group: pos,
        age: player.age,
        nationality: player.nationality,
        performance_score: player.performance_score,
        squad_role: 'first_team',
        is_custom: 0,
      })
      setSlots((prev) => [...prev, res.data])
    } catch {
      setError('Failed to add player.')
    }
  }

  // ── Remove slot ────────────────────────────────────────────────────────

  async function handleRemoveSlot(slotId) {
    if (!activePlanId) return
    try {
      await removePlannerPlayer(activePlanId, slotId)
      setSlots((prev) => prev.filter((s) => s.id !== slotId))
    } catch {
      setError('Failed to remove player.')
    }
  }

  // ── Role change ────────────────────────────────────────────────────────

  async function handleRoleChange(slotId, role) {
    if (!activePlanId) return
    try {
      const res = await updatePlannerSlot(activePlanId, slotId, { squad_role: role })
      setSlots((prev) => prev.map((s) => (s.id === slotId ? res.data : s)))
    } catch {
      setError('Failed to update role.')
    }
  }

  // ── Custom player ──────────────────────────────────────────────────────

  async function handleCustomConfirm(data) {
    setShowCustomModal(false)
    if (!activePlanId) return
    try {
      const res = await addPlannerPlayer(activePlanId, data)
      setSlots((prev) => [...prev, res.data])
    } catch {
      setError('Failed to add custom player.')
    }
  }

  // ── Export as visual HTML report ─────────────────────────────────────────

  function handleExport() {
    exportSquadPlanReport(slots, planName, plan?.team_name || '')
  }

  // ── Filtered available players ─────────────────────────────────────────

  const planPlayerIds = new Set(slots.filter((s) => s.player_id).map((s) => s.player_id))
  const filteredAvailable = availablePlayers.filter((p) => {
    const notInPlan = !planPlayerIds.has(p.player_id)
    const matchSearch =
      !availableSearch ||
      p.player_name.toLowerCase().includes(availableSearch.toLowerCase()) ||
      (p.position_group || '').toLowerCase().includes(availableSearch.toLowerCase()) ||
      (p.nationality || '').toLowerCase().includes(availableSearch.toLowerCase())
    return notInPlan && matchSearch
  })

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-on-surface/40 font-headline text-sm">Loading squad planner…</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400/60 hover:text-red-400">
            <span className="material-symbols-outlined text-base leading-none">close</span>
          </button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 bg-surface-container rounded-2xl px-5 py-4">
        {/* Plan name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              autoFocus
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false) }}
              className="bg-transparent border-b border-primary text-on-surface font-headline font-black text-xl focus:outline-none min-w-0 flex-1"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="font-headline font-black text-xl text-on-surface hover:text-primary transition-colors truncate"
              title="Click to edit plan name"
            >
              {planName}
            </button>
          )}
          <span className="material-symbols-outlined text-base text-on-surface/30 cursor-pointer hover:text-primary"
            onClick={() => setEditingName(true)}>
            edit
          </span>
        </div>

        {/* Plan selector */}
        {plans.length > 1 && (
          <select
            value={activePlanId || ''}
            onChange={(e) => loadPlan(parseInt(e.target.value))}
            className="bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {/* Team selector */}
        <select
          value={teamId}
          onChange={(e) => handleTeamChange(parseInt(e.target.value))}
          className="bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
        >
          {KNOWN_TEAMS.map((t) => (
            <option key={t.team_id} value={t.team_id}>{t.name}</option>
          ))}
        </select>

        {/* Import squad */}
        <button
          onClick={handleImportSquad}
          disabled={squadLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-headline font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">download</span>
          {squadLoading ? 'Importing…' : 'Import Current Squad'}
        </button>

        {/* Add custom */}
        <button
          onClick={() => { setCustomTargetPos('MID'); setShowCustomModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface/70 rounded-xl text-sm font-headline font-bold hover:text-on-surface hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          Add Custom
        </button>

        {/* New plan */}
        <button
          onClick={createNewPlan}
          className="flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface/70 rounded-xl text-sm font-headline font-bold hover:text-on-surface hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          New Plan
        </button>

        {/* Delete plan */}
        {activePlanId && (
          <button
            onClick={() => handleDeletePlan(activePlanId)}
            className="p-2 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            title="Delete this plan"
          >
            <span className="material-symbols-outlined text-base leading-none">delete</span>
          </button>
        )}
      </div>

      {/* ── Three columns ── */}
      <div className="grid grid-cols-[280px_1fr_220px] gap-4 items-start">

        {/* Left: Available players */}
        <div
          className="bg-surface-container rounded-2xl p-4 sticky top-20 max-h-[calc(100vh-160px)] flex flex-col"
          onDragOver={handleDragOver}
          onDrop={handleDropOnAvailable}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-headline font-bold tracking-widest uppercase text-on-surface/50">
              Available Players
            </p>
            <span className="text-xs text-on-surface/40">{filteredAvailable.length}</span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-on-surface/30">
              search
            </span>
            <input
              value={availableSearch}
              onChange={(e) => setAvailableSearch(e.target.value)}
              placeholder="Filter players…"
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl pl-8 pr-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div className="text-[10px] text-on-surface/30 mb-2 italic">
            Drag to formation or click +. Drop a squad player here to remove.
          </div>

          {squadLoading ? (
            <div className="text-center text-on-surface/30 text-sm py-8">Loading squad…</div>
          ) : filteredAvailable.length === 0 ? (
            <div className="text-center text-on-surface/30 text-sm py-8">
              {availablePlayers.length === 0 ? 'No data for this team.' : 'All players added.'}
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {filteredAvailable.map((p) => (
                <AvailableCard
                  key={p.player_id}
                  player={p}
                  onDragStart={handleDragStart}
                  onAdd={(player) => handleAddFromAvailable(player, null)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Center: Formation */}
        <div className="bg-surface-container rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-headline font-black text-lg text-on-surface">Formation Builder</h2>
              <p className="text-xs text-on-surface/40 mt-0.5">
                Drag players into position slots. Drop on Available to remove.
              </p>
            </div>
            <div className="text-xs text-on-surface/30 text-right">
              <span className="font-bold text-on-surface/60">{slots.length}</span> / 25 slots
            </div>
          </div>

          {POSITION_GROUPS.map((pos) => (
            <PositionRow
              key={pos}
              position={pos}
              slots={slots}
              maxSlots={POSITION_CAPS[pos]}
              onDragStart={handleDragStart}
              onDrop={handleDropOnPosition}
              onDragOver={handleDragOver}
              onRemove={handleRemoveSlot}
              onRoleChange={handleRoleChange}
            />
          ))}

          {/* Drop zone for "return to available" in center area too */}
          <div
            className="mt-4 border-2 border-dashed border-outline-variant/10 rounded-xl p-3 text-center text-xs text-on-surface/20"
            onDragOver={handleDragOver}
            onDrop={handleDropOnAvailable}
          >
            Drop a player here to remove from plan
          </div>
        </div>

        {/* Right: Summary */}
        <div className="sticky top-20">
          <SummaryPanel slots={slots} onExport={handleExport} />
        </div>
      </div>

      {/* Custom modal */}
      {showCustomModal && (
        <AddCustomModal
          targetPosition={customTargetPos}
          onConfirm={handleCustomConfirm}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </div>
  )
}
