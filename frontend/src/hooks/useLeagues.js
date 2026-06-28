import { useState, useEffect } from 'react'
import { getCompetitions } from '../api/client'

export function useLeagues() {
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCompetitions()
      .then(res => {
        const data = (res.data || []).map(c => ({
          ...c,
          league_name: c.name,
          league_id: c.competition_id || c.name,
        }))
        setLeagues(data)
      })
      .catch(err => console.error('Failed to load leagues:', err))
      .finally(() => setLoading(false))
  }, [])

  const leagueOptions = [
    { league_name: 'All Competitions', name: '', league_id: null },
    ...leagues,
  ]

  return { leagues, leagueOptions, loading }
}
