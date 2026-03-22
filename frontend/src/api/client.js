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

// ── Teams ────────────────────────────────────────────────────
export const getTeamStyles = (params) => api.get('/api/teams/styles', { params })
export const getChelseaFocus = (params) => api.get('/api/teams/chelsea', { params })

// ── Analytics ────────────────────────────────────────────────
export const getScores = (params) => api.get('/api/analytics/scores', { params })
export const getTalents = (params) => api.get('/api/analytics/talents', { params })
export const getScatter = (params) => api.get('/api/analytics/scatter', { params })

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

// ── Dashboard ────────────────────────────────────────────────
export const getDashboardStats = () => api.get('/api/dashboard/stats')
export const getTopPerformers = (params) => api.get('/api/dashboard/top-performers', { params })

export default api
