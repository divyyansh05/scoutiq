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
    season: Optional[str] = None,
    league: Optional[str] = None,
    limit: int = 10,
):
    df = calculate_performance_scores(season=season, league=league)
    if df.empty:
        return []

    top = df.sort_values("score", ascending=False).head(limit)
    return top.fillna(0).to_dict(orient="records")
