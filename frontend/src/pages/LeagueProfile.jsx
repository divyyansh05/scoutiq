import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLeagueProfile } from '../api/client';
import { useSeasons } from '../hooks/useSeasons';
import useApiError from '../hooks/useApiError';
import ErrorBanner from '../components/ErrorBanner';
import { formatMarketValue } from '../utils/format';

const ROLE_ORDER = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WNG', 'SS', 'CF'];

export default function LeagueProfile() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const { seasonOptions } = useSeasons();
  const [season, setSeason] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('top_performers');
  const [error, handleError, clearError] = useApiError();

  useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    clearError();
    getLeagueProfile(leagueId, season || undefined)
      .then(res => {
        setData(res.data);
        if (!season) setSeason(res.data.season);
      })
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [leagueId, season]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {data?.league_name || 'League Profile'}
          </h1>
          {data?.country && (
            <p className="text-gray-400 text-sm mt-1">{data.country}</p>
          )}
        </div>
        <select
          value={season || ''}
          onChange={e => setSeason(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-1.5"
        >
          {seasonOptions
            .filter(s => s.season_name !== 'All Seasons')
            .map(s => (
              <option key={s.season_name} value={s.season_name}>
                {s.season_name}
              </option>
            ))}
        </select>
      </div>

      <ErrorBanner error={error} onClose={clearError} />
      {loading && <p className="text-gray-400 text-center py-12">Loading league data...</p>}

      {data && !loading && (
        <>
          {/* Overview stat chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Players', value: data.overview.total_players },
              { label: 'Teams', value: data.overview.total_teams },
              { label: 'Avg Score', value: data.overview.avg_score },
              { label: 'Avg REAP', value: data.overview.avg_reap },
              { label: 'Avg Value', value: data.overview.avg_value_m ? `€${data.overview.avg_value_m}M` : '—' },
              { label: 'Injured', value: data.overview.injured_count },
              { label: 'Season', value: data.season },
              { label: 'Updated', value: data.overview.last_updated || '—' },
            ].map(item => (
              <div key={item.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-white">{item.value ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-700">
            {[
              { key: 'top_performers', label: 'Top Performers' },
              { key: 'teams', label: 'Team Rankings' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'text-white border-blue-500'
                    : 'text-gray-400 border-transparent hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Top Performers tab */}
          {activeTab === 'top_performers' && (
            <div className="space-y-6">
              {ROLE_ORDER.filter(role => data.top_by_role[role]?.length > 0).map(role => (
                <div key={role}>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    {role}
                  </h3>
                  <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700 text-gray-500 text-xs">
                          <th className="text-left py-2 px-4">#</th>
                          <th className="text-left py-2 px-4">Player</th>
                          <th className="text-left py-2 px-4">Team</th>
                          <th className="text-right py-2 px-4">Min</th>
                          <th className="text-right py-2 px-4">Score</th>
                          <th className="text-right py-2 px-4">REAP</th>
                          <th className="text-right py-2 px-4">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_by_role[role].map((p, i) => (
                          <tr
                            key={p.player_id}
                            className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors"
                            onClick={() => navigate(`/players/${p.player_id}`)}
                          >
                            <td className="py-2.5 px-4 text-gray-500 text-xs">{i + 1}</td>
                            <td className="py-2.5 px-4">
                              <span className="text-white font-medium">{p.player_name}</span>
                              {p.is_injured && (
                                <span className="ml-2 text-xs text-red-400">INJ</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-gray-400 text-xs">{p.team_name}</td>
                            <td className="py-2.5 px-4 text-right text-gray-400 text-xs">{p.minutes}</td>
                            <td className="py-2.5 px-4 text-right">
                              <span className={`font-bold text-sm ${
                                p.performance_score >= 70 ? 'text-green-400' :
                                p.performance_score >= 50 ? 'text-blue-400' :
                                'text-gray-400'
                              }`}>
                                {p.performance_score ? Math.round(p.performance_score) : '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right text-gray-300 text-sm">
                              {p.reap_score ? Number(p.reap_score).toFixed(2) : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right text-green-400 text-xs">
                              {formatMarketValue(p.market_value_eur) || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Team Rankings tab */}
          {activeTab === 'teams' && (
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                    <th className="text-left py-3 px-4">#</th>
                    <th className="text-left py-3 px-4">Team</th>
                    <th className="text-right py-3 px-4">Squad</th>
                    <th className="text-right py-3 px-4">Avg Score</th>
                    <th className="text-right py-3 px-4">Avg REAP</th>
                    <th className="text-right py-3 px-4">Total Value</th>
                    <th className="text-right py-3 px-4">Avg Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.team_rankings.map((t, i) => (
                    <tr
                      key={t.team_id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/teams/${t.team_id}`)}
                    >
                      <td className="py-3 px-4 text-gray-500 text-xs">{i + 1}</td>
                      <td className="py-3 px-4 text-white font-medium">{t.team_name}</td>
                      <td className="py-3 px-4 text-right text-gray-400">{t.squad_size}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-bold ${
                          t.avg_score >= 60 ? 'text-green-400' :
                          t.avg_score >= 45 ? 'text-blue-400' :
                          'text-gray-400'
                        }`}>
                          {t.avg_score ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-300">
                        {t.avg_reap ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-green-400 text-sm">
                        {t.total_value_m ? `€${t.total_value_m}M` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-400 text-sm">
                        {t.avg_value_m ? `€${t.avg_value_m}M` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
