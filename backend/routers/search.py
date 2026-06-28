from fastapi import APIRouter, Query
from database.connection import run_query

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/")
def global_search(q: str = Query(..., min_length=2)):
    player_sql = """
        SELECT DISTINCT
            p.player_id,
            p.player_id        AS id,
            p.name             AS name,
            p.current_team_name AS subtitle,
            'player'           AS type,
            p.position_group   AS position
        FROM players p
        WHERE LOWER(p.name) LIKE :q
        LIMIT 10
    """

    team_sql = """
        SELECT DISTINCT
            t.team_id   AS player_id,
            t.team_id   AS id,
            t.name      AS name,
            t.country   AS subtitle,
            'team'      AS type,
            ''          AS position
        FROM teams t
        WHERE LOWER(t.name) LIKE :q
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
