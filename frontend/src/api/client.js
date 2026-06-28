import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Score label helper (compute client-side) ──────────────────
export const getScoreLabel = (score) => {
  if (!score && score !== 0) return '—'
  if (score >= 80) return 'Elite'
  if (score >= 65) return 'Quality'
  if (score >= 50) return 'Average'
  if (score >= 35) return 'Below Average'
  return 'Poor'
}

// ── Competition list (cached at module level after first call) ─
let _competitionsCache = null
export const getCompetitions = async () => {
  if (_competitionsCache) return _competitionsCache
  const res = await api.get('/api/competitions')
  _competitionsCache = res
  return res
}

// ── Players ──────────────────────────────────────────────────
export const searchPlayers = (params) => api.get('/api/players/search', { params })
export const exportPlayers = (filters, format = 'csv', variant = 'basic') => {
  const params = new URLSearchParams({ ...filters, format, variant })
  window.open(`http://localhost:8000/api/players/export?${params.toString()}`, '_blank')
}
export const getPlayer = (id, params) => api.get(`/api/players/${id}`, { params })
export const getPlayerSeasons = (id) => api.get(`/api/players/${id}/seasons`)
export const getPlayerForm = (id, n = 20) => api.get(`/api/players/${id}/form`, { params: { n } })
export const getSimilarPlayers = (id, params) => api.get(`/api/players/${id}/similar`, { params })
export const getSimilarPlayersGlobal = (playerId, n = 10, minMinutes = 450) =>
  api.get(`/api/players/${playerId}/similar-global`, { params: { n, min_minutes: minMinutes } })
export const getPlayerVectorInfo = (playerId) => api.get(`/api/players/${playerId}/vector-info`)
export const getPlayerDatacenter = (playerId) => api.get(`/api/players/${playerId}/datacenter`)
export const getPlayerAdaptability = (id) => api.get(`/api/players/${id}/adaptability`)
export const downloadReport = (id) =>
  window.open(`http://localhost:8000/api/reports/player/${id}`, '_blank')

export const comparePlayers = (ids) =>
  api.get('/api/players/compare', {
    params: { ids: Array.isArray(ids) ? ids.join(',') : ids },
  })

// ── Teams ────────────────────────────────────────────────────
export const getTeamStyles = (params) => api.get('/api/teams/styles', { params })
export const getAllTeams = () => api.get('/api/teams')
export const getTeam = (id, competition) =>
  api.get(`/api/teams/${id}`, { params: { ...(competition && { competition }) } })
export const getTeamPlayers = (id, competition) =>
  api.get(`/api/teams/${id}/players`, { params: { ...(competition && { competition }) } })
export const getSquadGap = (teamId, competition) =>
  api.get(`/api/teams/${teamId}/squad-gap`, {
    params: { ...(competition && { competition }) },
  })
export const getTeamDatacenter = (teamId, competition, metric) =>
  api.get(`/api/teams/${teamId}/datacenter`, {
    params: { ...(competition && { competition }), ...(metric && { metric }) },
  })

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

// ── Leagues / Competitions ────────────────────────────────────
export const getSeasons = () => api.get('/api/competitions')
export const getLeagues = () => api.get('/api/leagues')
export const getLeagueProfile = (leagueId, competition) =>
  api.get(`/api/leagues/${leagueId}`, {
    params: { ...(competition && { competition }) },
  })

// ── Positional Profiles ───────────────────────────────────────
export const getProfiles = () => api.get('/api/profiles/')
export const getProfilePlayers = (profileKey, params) => api.get(`/api/profiles/${profileKey}/players`, { params })

// ── Recruitment Pipeline ──────────────────────────────────────
export const getRecruitmentPipeline = () => api.get('/api/recruitment/')
export const addToRecruitment = (data) => api.post('/api/recruitment/', data)
export const moveRecruitmentStage = (id, stage) => api.patch(`/api/recruitment/${id}/stage`, { stage })
export const updateRecruitmentNotes = (id, notes) => api.patch(`/api/recruitment/${id}/notes`, { notes })
export const removeFromRecruitment = (id) => api.delete(`/api/recruitment/${id}`)

// ── Player Context / Fit / Feasibility ───────────────────────
export const getPlayerFeasibility = (id) => api.get(`/api/players/${id}/feasibility`)
export const getPlayerSquadFit = (id) => api.get(`/api/players/${id}/squad-fit`)
export const getPlayerTeamContext = (id) => api.get(`/api/players/${id}/team-context`)

// ── Squad Analysis + SWOT ─────────────────────────────────────
export const getTeamSwot = (teamId) => api.get(`/api/teams/${teamId}/swot`)

// ── Squad Analysis ────────────────────────────────────────────
export const getSquadGapProfiles = (teamId, params) => api.get(`/api/teams/${teamId}/squad-gap-profiles`, { params })
export const getTeamPriorityPositions = (teamId, params) => api.get(`/api/teams/${teamId}/priority-positions`, { params })
export const getSquadDiagnostic = (teamId, params) => api.get(`/api/teams/${teamId}/squad-diagnostic`, { params })

// ── Squad Planner ─────────────────────────────────────────────
export const getPlannerPlans = () => api.get('/api/planner/plans')
export const createPlannerPlan = (data) => api.post('/api/planner/plans', data)
export const deletePlannerPlan = (id) => api.delete(`/api/planner/plans/${id}`)
export const getPlannerPlan = (id) => api.get(`/api/planner/plans/${id}`)
export const getPlannerSlots = (id) => api.get(`/api/planner/plans/${id}/players`)
export const addPlannerPlayer = (planId, data) => api.post(`/api/planner/plans/${planId}/players`, data)
export const updatePlannerSlot = (planId, slotId, data) => api.patch(`/api/planner/plans/${planId}/players/${slotId}`, data)
export const removePlannerPlayer = (planId, slotId) => api.delete(`/api/planner/plans/${planId}/players/${slotId}`)
export const getPlannerCurrentSquad = (teamId) => api.get(`/api/planner/teams/${teamId}/current-squad`)

// ── Tactical Fit ──────────────────────────────────────────────
export const getTacticalPresets = () => api.get('/api/tactical/presets')
export const createTacticalPreset = (data) => api.post('/api/tactical/presets', data)
export const updateTacticalPreset = (id, data) => api.put(`/api/tactical/presets/${id}`, data)
export const deleteTacticalPreset = (id) => api.delete(`/api/tactical/presets/${id}`)
export const getPlayerTacticalFit = (presetId, playerId) =>
  api.get(`/api/tactical/presets/${presetId}/fit/${playerId}`)

export default api
