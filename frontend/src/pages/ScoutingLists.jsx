import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLists, createList, deleteList, getListPlayers, removeFromList } from '../api/client'
import PositionBadge from '../components/PositionBadge'

function CreateListModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onCreate({ name: name.trim(), description: desc.trim() || null })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-container-highest rounded-2xl p-7 w-full max-w-md shadow-2xl border border-outline-variant/20">
        <h2 className="font-headline font-bold text-xl text-on-surface mb-6">New Scouting List</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label-xs block mb-1.5">List Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Premier League Wingers"
              className="w-full bg-surface-container text-on-surface text-sm rounded-lg px-4 py-2.5 border border-outline-variant/20 focus:outline-none focus:border-primary/40"
              required
            />
          </div>
          <div>
            <label className="label-xs block mb-1.5">Description (optional)</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What is this list for?"
              rows={3}
              className="w-full bg-surface-container text-on-surface text-sm rounded-lg px-4 py-2.5 border border-outline-variant/20 focus:outline-none focus:border-primary/40 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ListCard({ list, onSelect, onDelete, active }) {
  return (
    <div
      className={`rounded-xl p-5 cursor-pointer transition-all border ${
        active
          ? 'bg-blue-600/10 border-blue-500/30'
          : 'bg-surface-container hover:bg-surface-bright border-transparent'
      }`}
      onClick={() => onSelect(list)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-headline font-bold text-on-surface truncate">{list.name}</p>
          {list.description && (
            <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{list.description}</p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(list.id) }}
          className="text-on-surface-variant hover:text-error transition-colors p-1 shrink-0"
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-outline-variant/10">
        <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-sm">person</span>
          {list.player_count} player{list.player_count !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-on-surface-variant">
          {new Date(list.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}

export default function ScoutingLists() {
  const navigate = useNavigate()
  const [lists, setLists] = useState([])
  const [selectedList, setSelectedList] = useState(null)
  const [players, setPlayers] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [playersLoading, setPlayersLoading] = useState(false)

  const fetchLists = async () => {
    try {
      const res = await getLists()
      setLists(res.data || [])
    } catch {
      setLists([])
    }
  }

  useEffect(() => {
    fetchLists().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedList) { setPlayers([]); return }
    setPlayersLoading(true)
    getListPlayers(selectedList.id)
      .then(r => setPlayers(r.data || []))
      .catch(() => setPlayers([]))
      .finally(() => setPlayersLoading(false))
  }, [selectedList])

  const handleCreate = async (data) => {
    await createList(data)
    await fetchLists()
  }

  const handleDelete = async (id) => {
    await deleteList(id)
    if (selectedList?.id === id) setSelectedList(null)
    await fetchLists()
  }

  const handleRemovePlayer = async (playerId) => {
    if (!selectedList) return
    await removeFromList(selectedList.id, playerId)
    setPlayers(p => p.filter(x => x.player_id !== playerId))
    setLists(prev => prev.map(l => l.id === selectedList.id ? { ...l, player_count: l.player_count - 1 } : l))
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Workspace</p>
          <h1 className="text-4xl font-headline font-black text-on-surface">Scouting Lists</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-base">add</span>
          New List
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lists sidebar */}
        <div>
          <p className="label-xs mb-3">{lists.length} list{lists.length !== 1 ? 's' : ''}</p>
          {loading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-surface-container rounded-xl animate-pulse" />)}
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-16 bg-surface-container rounded-xl">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">format_list_bulleted</span>
              <p className="text-on-surface-variant text-sm mt-3">No lists yet.</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">Create First List</button>
            </div>
          ) : (
            <div className="space-y-2">
              {lists.map(l => (
                <ListCard
                  key={l.id}
                  list={l}
                  active={selectedList?.id === l.id}
                  onSelect={setSelectedList}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Players panel */}
        <div className="lg:col-span-2">
          {!selectedList ? (
            <div className="text-center py-24 bg-surface-container rounded-xl">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant">playlist_add_check</span>
              <p className="text-on-surface-variant mt-4">Select a list to view its players.</p>
              <p className="text-xs text-on-surface-variant mt-2">
                Add players to lists from any player profile.
              </p>
            </div>
          ) : (
            <div className="bg-surface-container rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
                <div>
                  <h2 className="font-headline font-bold text-on-surface">{selectedList.name}</h2>
                  {selectedList.description && (
                    <p className="text-xs text-on-surface-variant mt-0.5">{selectedList.description}</p>
                  )}
                </div>
                <span className="chip">{players.length} players</span>
              </div>

              {playersLoading ? (
                <div className="p-6 space-y-3">
                  {Array(4).fill(0).map((_, i) => <div key={i} className="h-14 bg-surface-container-high rounded-xl animate-pulse" />)}
                </div>
              ) : players.length === 0 ? (
                <div className="text-center py-16">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant">person_add</span>
                  <p className="text-on-surface-variant mt-3 text-sm">No players in this list.</p>
                  <button
                    onClick={() => navigate('/players')}
                    className="btn-primary mt-4 flex items-center gap-2 mx-auto"
                  >
                    <span className="material-symbols-outlined text-sm">search</span>
                    Browse Players
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {players.map(p => (
                    <div key={p.player_id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-bright transition-colors group">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/players/${p.player_id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors">
                            {p.player_name || 'Unknown Player'}
                          </p>
                          {p.position && <PositionBadge position={p.position} />}
                        </div>
                        {p.team_name && (
                          <p className="text-xs text-on-surface-variant mt-0.5">{p.team_name}</p>
                        )}
                      </div>
                      <span className="text-xs text-on-surface-variant">
                        {new Date(p.added_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleRemovePlayer(p.player_id)}
                        className="text-on-surface-variant hover:text-error transition-colors p-1 opacity-0 group-hover:opacity-100"
                      >
                        <span className="material-symbols-outlined text-base">remove_circle</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateListModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
