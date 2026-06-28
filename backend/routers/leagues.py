"""
leagues.py — Competition profile and analytics endpoints.
Uses competition_name strings from player_match_stats.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from database.connection import run_query

router = APIRouter(prefix="/api/leagues", tags=["leagues"])


@router.get("")
def list_leagues():
    sql = """
        SELECT competition_name          AS name,
               competition_name          AS league_name,
               COUNT(DISTINCT player_id) AS player_count,
               COUNT(*)                  AS total_matches,
               MIN(match_date)           AS first_match,
               MAX(match_date)           AS last_match
        FROM player_match_stats
        GROUP BY competition_name
        HAVING COUNT(DISTINCT player_id) > 0
        ORDER BY player_count DESC
    """
    df = run_query(sql, {})
    if df.empty:
        return []
    records = df.fillna(0).to_dict(orient="records")
    for r in records:
        r["first_match"] = str(r["first_match"]) if r.get("first_match") else None
        r["last_match"] = str(r["last_match"]) if r.get("last_match") else None
    return records


@router.get("/competitions")
def list_competitions():
    """Alias for /api/competitions — returns list for UI dropdowns."""
    return list_leagues()


@router.get("/{league_id}")
def get_league_profile(league_id: int, season: Optional[str] = None, competition: Optional[str] = None):
    """
    league_id is ignored — this DB is competition_name based.
    If competition param not provided, try to look up by competition_id.
    """
    if not competition:
        comp_sql = "SELECT name FROM competitions WHERE competition_id = :cid"
        df = run_query(comp_sql, {"cid": league_id})
        if df.empty:
            raise HTTPException(status_code=404, detail="Competition not found")
        competition = str(df.iloc[0]["name"])

    overview_sql = """
        SELECT
            competition_name,
            COUNT(DISTINCT player_id)   AS total_players,
            COUNT(*)                    AS total_matches,
            COALESCE(SUM(goals), 0)     AS total_goals,
            ROUND(AVG(xg)::numeric, 3)  AS avg_xg_per_match,
            MIN(match_date)             AS first_match,
            MAX(match_date)             AS last_match
        FROM player_match_stats
        WHERE competition_name = :competition
        GROUP BY competition_name
    """
    overview_df = run_query(overview_sql, {"competition": competition})
    if overview_df.empty:
        raise HTTPException(status_code=404, detail="No data for this competition")

    ov = overview_df.iloc[0]

    # Top scorers
    top_sql = """
        SELECT p.name, p.position_group,
               SUM(pms.goals) AS goals,
               ROUND(SUM(pms.xg)::numeric, 2) AS xg,
               SUM(pms.minutes_played) AS minutes
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        WHERE pms.competition_name = :competition
        GROUP BY p.player_id, p.name, p.position_group
        HAVING SUM(pms.minutes_played) >= 450
        ORDER BY goals DESC LIMIT 20
    """
    top_df = run_query(top_sql, {"competition": competition})

    # Top by performance score
    score_sql = """
        WITH best AS (
            SELECT DISTINCT ON (ps.player_id)
                ps.player_id, ps.performance_score, ps.percentile_rank,
                ps.position_group, ps.goals_p90, ps.xg_p90, ps.assists_p90
            FROM player_scores ps
            JOIN competitions c ON c.competition_id = ps.competition_id
            WHERE c.name = :competition
            ORDER BY ps.player_id, ps.performance_score DESC NULLS LAST
        )
        SELECT b.player_id, p.name, p.current_team_name AS team_name,
               p.position_group, b.performance_score, b.percentile_rank,
               b.goals_p90, b.xg_p90, b.assists_p90
        FROM best b JOIN players p ON p.player_id = b.player_id
        ORDER BY b.performance_score DESC NULLS LAST LIMIT 20
    """
    score_df = run_query(score_sql, {"competition": competition})

    top_by_role = {}
    if not score_df.empty:
        for _, r in score_df.iterrows():
            role = str(r.get("position_group", "Unknown"))
            if role not in top_by_role:
                top_by_role[role] = []
            if len(top_by_role[role]) < 5:
                top_by_role[role].append({
                    "player_id": int(r["player_id"]),
                    "player_name": r.get("name"),
                    "team_name": r.get("team_name"),
                    "performance_score": float(r["performance_score"]) if r["performance_score"] else None,
                    "percentile_rank": float(r["percentile_rank"]) if r["percentile_rank"] else None,
                    "goals_p90": float(r["goals_p90"]) if r["goals_p90"] else None,
                    "xg_p90": float(r["xg_p90"]) if r["xg_p90"] else None,
                    "assists_p90": float(r["assists_p90"]) if r["assists_p90"] else None,
                })

    def sf(v, d=1):
        try:
            return round(float(v), d) if v is not None else None
        except (TypeError, ValueError):
            return None

    return {
        "league_id": league_id,
        "league_name": competition,
        "competition_name": competition,
        "country": "",
        "season": competition,
        "overview": {
            "total_players": int(ov.get("total_players", 0)),
            "total_teams": 0,
            "total_matches": int(ov.get("total_matches", 0)),
            "total_goals": int(ov.get("total_goals", 0)),
            "avg_xg_per_match": sf(ov.get("avg_xg_per_match"), 3),
            "first_match": str(ov.get("first_match", "")) if ov.get("first_match") else None,
            "last_match": str(ov.get("last_match", "")) if ov.get("last_match") else None,
            "avg_score": None,
            "injured_count": 0,
            "last_updated": None,
        },
        "top_by_role": top_by_role,
        "top_scorers": top_df.fillna(0).to_dict(orient="records") if not top_df.empty else [],
        "team_rankings": [],
    }
