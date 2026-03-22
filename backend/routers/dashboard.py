from fastapi import APIRouter
from typing import Optional

from database.connection import run_query
from models.performance_score import calculate_performance_scores
from config import MIN_MINUTES

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats():
    players_sql = "SELECT COUNT(DISTINCT player_id) AS total FROM players"
    deep_stats_sql = """
        SELECT COUNT(DISTINCT player_id) AS total
        FROM player_season_stats
        WHERE minutes >= :min_minutes
    """
    leagues_sql = "SELECT COUNT(DISTINCT league_id) AS total FROM leagues"

    players_df = run_query(players_sql)
    deep_df = run_query(deep_stats_sql, {"min_minutes": MIN_MINUTES})
    leagues_df = run_query(leagues_sql)

    return {
        "players_tracked": int(players_df.iloc[0]["total"]) if not players_df.empty else 0,
        "with_deep_stats": int(deep_df.iloc[0]["total"]) if not deep_df.empty else 0,
        "leagues_covered": int(leagues_df.iloc[0]["total"]) if not leagues_df.empty else 5,
    }


@router.get("/top-performers")
def get_top_performers(
    season: str = "2025-26",
    league: Optional[str] = None,
    limit: int = 5,
):
    df = calculate_performance_scores(season=season, league=league)
    if df.empty:
        return {"performers": []}

    top = df.nlargest(limit, "score")
    cols = [
        "player_id", "player_name", "team_name", "league_name",
        "position_group", "minutes", "score", "percentile", "score_label",
    ]
    return {"performers": top[cols].fillna(0).to_dict(orient="records")}


@router.get("/coverage")
def league_coverage():
    sql = """
        SELECT
            l.league_name,
            s.season_name,
            COUNT(DISTINCT t.team_id) AS total_teams,
            COUNT(DISTINCT pss.player_id) AS total_players,
            COUNT(CASE WHEN pss.minutes > 90 THEN 1 END) AS players_with_minutes,
            COUNT(CASE WHEN pss.xg > 0 THEN 1 END) AS players_with_xg,
            COUNT(CASE WHEN pss.aerials_won > 0 THEN 1 END) AS players_with_deep_stats,
            COUNT(CASE WHEN pss.sofascore_rating > 0 THEN 1 END) AS players_with_rating,
            ROUND(AVG(pss.xg)::numeric, 3) AS avg_xg,
            ROUND(AVG(pss.sofascore_rating)::numeric, 2) AS avg_rating
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN teams t ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE l.league_name IN (
            'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'
        )
        GROUP BY l.league_name, s.season_name
        ORDER BY l.league_name, s.season_name DESC
    """
    df = run_query(sql)
    if df.empty:
        return {"coverage": []}
    return {"coverage": df.fillna(0).to_dict("records")}
