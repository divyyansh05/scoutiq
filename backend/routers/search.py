from fastapi import APIRouter, Query
from database.connection import run_query

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/")
def global_search(q: str = Query(..., min_length=2)):
    player_sql = """
        SELECT DISTINCT
            p.player_id,
            p.player_name AS name,
            t.team_name AS subtitle,
            'player' AS type,
            p.position
        FROM players p
        JOIN player_season_stats pss ON p.player_id = pss.player_id
        JOIN teams t ON pss.team_id = t.team_id
        WHERE LOWER(p.player_name) LIKE :q
        LIMIT 10
    """

    team_sql = """
        SELECT DISTINCT
            t.team_id AS player_id,
            t.team_name AS name,
            l.league_name AS subtitle,
            'team' AS type,
            '' AS position
        FROM teams t
        JOIN player_season_stats pss ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        WHERE LOWER(t.team_name) LIKE :q
        LIMIT 5
    """

    params = {"q": f"%{q.lower()}%"}

    players = run_query(player_sql, params)
    teams = run_query(team_sql, params)

    results = []
    if not players.empty:
        results += players.fillna("").to_dict(orient="records")
    if not teams.empty:
        results += teams.fillna("").to_dict(orient="records")

    return results
