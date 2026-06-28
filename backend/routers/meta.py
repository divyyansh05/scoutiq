from fastapi import APIRouter
from database.connection import run_query

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/competitions")
def get_competitions():
    """All competitions with match data, for UI dropdowns."""
    sql = """
        SELECT competition_name          AS name,
               competition_name          AS league_name,
               COUNT(DISTINCT player_id) AS player_count,
               COUNT(*)                  AS match_count
        FROM player_match_stats
        GROUP BY competition_name
        ORDER BY player_count DESC
    """
    df = run_query(sql)
    if df.empty:
        return []
    return df.fillna(0).to_dict(orient="records")


@router.get("/seasons")
def get_seasons():
    """Returns competitions list (seasons concept replaced by competitions)."""
    return get_competitions()
