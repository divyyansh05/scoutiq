import { useState, useEffect } from 'react'
import { getCompetitions } from '../api/client'

export function useSeasons() {
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCompetitions()
      .then(res => {
        const comps = (res.data || []).filter(c =>
          ['England. Premier League', 'Spain. La Liga', 'Italy. Serie A',
           'Germany. Bundesliga', 'France. Ligue 1', 'Europe. UEFA Champions League',
           'England. Championship', 'Netherlands. Eredivisie', 'Portugal. Primeira Liga',
           'Belgium. Pro League', 'Türkiye. Süper Lig', 'United States. MLS',
           'Spain. Segunda División', 'Italy. Serie B', 'Germany. 2. Bundesliga',
           'France. Ligue 2', 'Europe. UEFA Europa League',
          ].includes(c.name)
        )
        setSeasons(comps.map(c => ({ ...c, season_name: c.name, league_name: c.name })))
      })
      .catch(err => console.error('Failed to load competitions:', err))
      .finally(() => setLoading(false))
  }, [])

  const seasonOptions = [
    { season_name: 'All Competitions', league_name: '', name: '' },
    ...seasons,
  ]

  const defaultSeason = null

  return { seasons, seasonOptions, defaultSeason, loading }
}
