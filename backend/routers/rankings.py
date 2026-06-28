from fastapi import APIRouter, Query
from typing import Optional

from database.connection import run_query

router = APIRouter(prefix="/api/rankings", tags=["rankings"])

ALLOWED_METRICS = [
    "goals", "assists", "xg", "xa", "npxg", "shots", "shots_on_target",
    "key_passes", "dribbles_successful", "progressive_runs", "touches_in_box",
    "interceptions", "clearances", "recoveries", "aerial_duels_won",
    "passes", "passes_accurate", "defensive_duels_won", "offensive_duels_won",
    "fouls_committed", "fouls_suffered",
]

METRIC_LABELS = {
    "goals": "Goals", "assists": "Assists", "xg": "xG", "xa": "xA",
    "npxg": "npxG", "shots": "Shots", "shots_on_target": "Shots on Target",
    "key_passes": "Key Passes", "dribbles_successful": "Dribbles",
    "progressive_runs": "Progressive Runs", "touches_in_box": "Touches in Box",
    "interceptions": "Interceptions", "clearances": "Clearances",
    "recoveries": "Recoveries", "aerial_duels_won": "Aerials Won",
    "passes": "Passes", "passes_accurate": "Accurate Passes",
    "defensive_duels_won": "Defensive Duels Won",
    "offensive_duels_won": "Offensive Duels Won",
    "fouls_committed": "Fouls", "fouls_suffered": "Fouls Won",
}

NON_PER90_METRICS: set = set()


@router.get("/")
def get_rankings(
    metric: str = Query("xg"),
    competition: Optional[str] = None,
    league: Optional[str] = None,
    position: Optional[str] = None,
    min_minutes: int = Query(450, ge=100, le=9000),
    per90: bool = Query(True),
    limit: int = Query(50, ge=1, le=200),
    # legacy ignored
    season: Optional[str] = None,
):
    import pandas as pd

    if metric not in ALLOWED_METRICS:
        metric = "xg"

    comp_filter = competition or league

    where = ["pms.minutes_played > 0"]
    params: dict = {"min_minutes": min_minutes, "limit": limit}

    if comp_filter:
        where.append("pms.competition_name = :competition")
        params["competition"] = comp_filter

    pos_where = ""
    pos_upper = position.upper() if position else None
    if pos_upper and pos_upper in ("GK", "DEF", "MID", "FWD"):
        pos_where = "AND p.position_group = :position"
        params["position"] = pos_upper

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT
            p.player_id,
            p.name,
            p.primary_position,
            p.position_group,
            p.nationality,
            EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
            p.current_team_name AS team_name,
            pms.competition_name AS league_name,
            SUM(pms.minutes_played)                       AS minutes,
            COUNT(*)                                       AS matches,
            COALESCE(SUM(pms.{metric}), 0)                AS total,
            ROUND(
                COALESCE(SUM(pms.{metric}), 0)::numeric
                / NULLIF(SUM(pms.minutes_played),0) * 90, 3
            )                                             AS per90
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        WHERE {where_sql}
        {pos_where}
        GROUP BY p.player_id, p.name, p.primary_position, p.position_group,
                 p.nationality, p.date_of_birth, p.current_team_name,
                 pms.competition_name
        HAVING SUM(pms.minutes_played) >= :min_minutes
        ORDER BY {"per90" if per90 else "total"} DESC NULLS LAST
        LIMIT :limit
    """

    df = run_query(sql, params)
    if df.empty:
        return {
            "rankings": [], "metric": metric,
            "metric_label": METRIC_LABELS.get(metric, metric),
            "per90": per90, "total": 0,
            "available_metrics": [{"key": k, "label": v} for k, v in METRIC_LABELS.items()],
        }

    for col in ["minutes", "total", "per90", "age"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["metric_value"] = df["per90"] if per90 else df["total"]
    df = df.reset_index(drop=True)
    df["rank"] = range(1, len(df) + 1)

    # Backward-compat alias
    df["player_name"] = df["name"]
    df["season_name"] = comp_filter or "All Competitions"

    return {
        "rankings": df.fillna(0).to_dict("records"),
        "metric": metric,
        "metric_label": METRIC_LABELS.get(metric, metric),
        "per90": per90,
        "total": len(df),
        "available_metrics": [{"key": k, "label": v} for k, v in METRIC_LABELS.items()],
    }
