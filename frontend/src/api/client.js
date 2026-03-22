import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Players ──────────────────────────────────────────────────
export const searchPlayers = (params) => api.get('/api/players/search', { params })
export const getPlayer = (id, params) => api.get(`/api/players/${id}`, { params })
export const getPlayerSeasons = (id) => api.get(`/api/players/${id}/seasons`)
export const getSimilarPlayers = (id, params) => api.get(`/api/players/${id}/similar`, { params })
export const getPlayerAdaptability = (id, season) => api.get(`/api/players/${id}/adaptability`, { params: { season } })

// ── Teams ────────────────────────────────────────────────────
export const getTeamStyles = (params) => api.get('/api/teams/styles', { params })
export const getChelseaFocus = (params) => api.get('/api/teams/chelsea', { params })
export const getChelseaFull = (season) => api.get('/api/teams/chelsea/full', { params: { season } })
export const getTeam = (id, season) => api.get(`/api/teams/${id}`, { params: { season } })
export const getTeamPlayers = (id, season) => api.get(`/api/teams/${id}/players`, { params: { season } })

// ── Analytics ────────────────────────────────────────────────
export const getScores = (params) => api.get('/api/analytics/scores', { params })
export const getTalents = (params) => api.get('/api/analytics/talents', { params })
export const getScatter = (params) => api.get('/api/analytics/scatter', { params })
export const getWeightedRanking = (data) => api.post('/api/analytics/weighted-ranking', data)

// ── Rankings ─────────────────────────────────────────────────
export const getRankings = (params) => api.get('/api/rankings/', { params })

// ── Search ───────────────────────────────────────────────────
export const globalSearch = (q) => api.get('/api/search/', { params: { q } })

// ── Scouting Lists ───────────────────────────────────────────
export const getLists = () => api.get('/api/lists/')
export const createList = (data) => api.post('/api/lists/', data)
export const deleteList = (id) => api.delete(`/api/lists/${id}`)
export const getListPlayers = (id) => api.get(`/api/lists/${id}/players`)
export const addToList = (id, data) => api.post(`/api/lists/${id}/players`, data)
export const removeFromList = (listId, playerId) =>
  api.delete(`/api/lists/${listId}/players/${playerId}`)

// ── Notes ────────────────────────────────────────────────────
export const getNote = (playerId) => api.get(`/api/notes/${playerId}`)
export const saveNote = (playerId, note_text) => api.post(`/api/notes/${playerId}`, { note_text })

// ── Saved Searches ────────────────────────────────────────────
export const getSavedSearches = () => api.get('/api/searches/')
export const saveSearch = (data) => api.post('/api/searches/', data)
export const deleteSavedSearch = (id) => api.delete(`/api/searches/${id}`)

// ── Dashboard ────────────────────────────────────────────────
export const getDashboardStats = () => api.get('/api/dashboard/stats')
export const getTopPerformers = (params) => api.get('/api/dashboard/top-performers', { params })
export const getLeagueCoverage = () => api.get('/api/dashboard/coverage')

export default api
