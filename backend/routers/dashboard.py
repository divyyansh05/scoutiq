from fastapi import APIRouter
from typing import Optional

from database.connection import run_query
from config import score_label as get_score_label

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats():
    import pandas as pd

    players_df = run_query("SELECT COUNT(*) AS total FROM players")
    matches_df = run_query("SELECT COUNT(*) AS total FROM player_match_stats")
    scores_df = run_query("SELECT COUNT(*) AS total FROM player_scores")

    breakdown_sql = """
        SELECT competition_name,
               COUNT(DISTINCT player_id) AS players,
               COUNT(*) AS matches
        FROM player_match_stats
        GROUP BY competition_name
        ORDER BY players DESC
        LIMIT 15
    """
    breakdown_df = run_query(breakdown_sql)

    total_players = int(players_df.iloc[0]["total"]) if not players_df.empty else 0
    total_matches = int(matches_df.iloc[0]["total"]) if not matches_df.empty else 0
    total_scores = int(scores_df.iloc[0]["total"]) if not scores_df.empty else 0

    return {
        "total_players": total_players,
        "players_tracked": total_players,
        "total_records": total_matches,
        "total_scores": total_scores,
        "with_deep_stats": total_scores,
        "current_season_players": total_players,
        "leagues_covered": len(breakdown_df) if not breakdown_df.empty else 0,
        "seasons_covered": 1,
        "competition_breakdown": breakdown_df.fillna(0).to_dict(orient="records") if not breakdown_df.empty else [],
        "league_breakdown": breakdown_df.fillna(0).to_dict(orient="records") if not breakdown_df.empty else [],
        "last_updated": None,
    }


@router.get("/top-performers")
def get_top_performers(
    competition: Optional[str] = None,
    position: Optional[str] = None,
    limit: int = 10,
):
    import pandas as pd

    current_where = ["match_date >= '2025-07-01'"]
    where = ["ps.minutes_total >= 450"]
    params: dict = {"limit": limit}

    if competition:
        where.append("c.name = :competition")
        current_where.append("competition_name = :competition")
        params["competition"] = competition
    if position and position.upper() in ("GK", "DEF", "MID", "FWD"):
        where.append("ps.position_group = :position")
        params["position"] = position.upper()

    where_sql = " AND ".join(where)
    current_where_sql = " AND ".join(current_where)

    sql = f"""
        WITH current_players AS (
            SELECT DISTINCT player_id
            FROM player_match_stats
            WHERE {current_where_sql}
        ),
        best AS (
            SELECT DISTINCT ON (ps.player_id)
                ps.player_id,
                ps.performance_score,
                ps.percentile_rank,
                ps.position_group,
                ps.minutes_total,
                ps.goals_p90,
                ps.xg_p90,
                ps.assists_p90,
                c.name AS competition_name
            FROM player_scores ps
            JOIN competitions c ON c.competition_id = ps.competition_id
            JOIN current_players cp ON cp.player_id = ps.player_id
            WHERE {where_sql}
            ORDER BY ps.player_id, ps.performance_score DESC NULLS LAST
        )
        SELECT
            b.player_id,
            p.name,
            p.position_group,
            p.nationality,
            p.current_team_name   AS team_name,
            b.competition_name    AS league_name,
            b.performance_score   AS score,
            b.percentile_rank     AS percentile,
            b.minutes_total       AS minutes,
            b.goals_p90,
            b.xg_p90,
            b.assists_p90
        FROM best b
        JOIN players p ON p.player_id = b.player_id
        ORDER BY b.performance_score DESC NULLS LAST
        LIMIT :limit
    """

    df = run_query(sql, params)
    if df.empty:
        return {"performers": []}

    df["score"] = pd.to_numeric(df["score"], errors="coerce")
    df["percentile"] = pd.to_numeric(df["percentile"], errors="coerce")
    df["score_label"] = df["score"].apply(
        lambda s: get_score_label(float(s)) if pd.notna(s) else "—"
    )
    df["player_name"] = df["name"]
    return {"performers": df.fillna(0).to_dict(orient="records")}


@router.get("/coverage")
def league_coverage():
    sql = """
        SELECT
            competition_name             AS league_name,
            competition_name,
            COUNT(DISTINCT player_id)    AS total_players,
            COUNT(DISTINCT player_id)    AS active_players,
            COUNT(*)                     AS matches,
            MIN(match_date)              AS first_match,
            MAX(match_date)              AS last_match
        FROM player_match_stats
        GROUP BY competition_name
        ORDER BY total_players DESC
    """
    df = run_query(sql)
    if df.empty:
        return {"coverage": []}

    df["players_with_minutes"] = df["active_players"]
    df["players_with_xg"] = df["total_players"]
    df["players_with_deep_stats"] = df["total_players"]
    df["players_with_rating"] = 0
    df["country"] = ""
    df["season_name"] = ""
    df["start_year"] = 0
    df["avg_xg"] = 0
    df["avg_rating"] = 0
    df["league_id"] = 0
    df["total_teams"] = 0
    df["with_xg"] = df["total_players"]
    df["with_rating"] = 0
    return {"coverage": df.fillna(0).to_dict("records")}
