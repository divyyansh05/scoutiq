from fastapi import APIRouter, Query
from typing import Optional

from database.connection import run_query
from config import POSITION_MAP

router = APIRouter(prefix="/api/rankings", tags=["rankings"])

ALLOWED_METRICS = [
    "xg", "xa", "npxg", "goals", "assists", "shots", "key_passes",
    "sofascore_rating", "aerials_won", "tackles_won", "interceptions",
    "clearances", "recoveries", "accurate_passes_pct", "accurate_final_third",
    "big_chances_created", "dispossessed", "minutes", "accurate_long_balls",
    "fouls_won", "dribbles_completed", "possession_won_att_third",
    "shots_inside_box", "touches",
]

METRIC_LABELS = {
    "xg": "xG", "xa": "xA", "npxg": "npxG", "goals": "Goals",
    "assists": "Assists", "shots": "Shots", "key_passes": "Key Passes",
    "sofascore_rating": "Rating", "aerials_won": "Aerials Won",
    "tackles_won": "Tackles Won", "interceptions": "Interceptions",
    "clearances": "Clearances", "recoveries": "Recoveries",
    "accurate_passes_pct": "Pass Acc%", "accurate_final_third": "Final Third Passes",
    "big_chances_created": "Big Chances Created", "dispossessed": "Dispossessed",
    "minutes": "Minutes", "accurate_long_balls": "Accurate Long Balls",
    "fouls_won": "Fouls Won", "dribbles_completed": "Dribbles",
    "possession_won_att_third": "Poss. Won Att Third",
    "shots_inside_box": "Shots Inside Box", "touches": "Touches",
}

NON_PER90_METRICS = {"sofascore_rating", "accurate_passes_pct", "minutes"}


def _normalize_position(pos: str) -> str:
    if not pos:
        return "MID"
    return POSITION_MAP.get(pos.strip(), "MID")


@router.get("/")
def get_rankings(
    metric: str = Query("xg"),
    season: str = Query("2025-26"),
    position: Optional[str] = None,
    league: Optional[str] = None,
    min_minutes: int = Query(450, ge=100, le=3400),
    per90: bool = Query(True),
    limit: int = Query(50, ge=1, le=200),
):
    if metric not in ALLOWED_METRICS:
        metric = "xg"

    league_filter = "AND l.league_name = :league" if league else ""

    sql = f"""
        SELECT p.player_id, p.player_name, p.position, p.nationality,
               EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth))::int AS age,
               t.team_name, l.league_name, s.season_name,
               pss.minutes,
               COALESCE(pss.{metric}, 0) AS metric_value
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN teams t ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE s.season_name = :season
        AND pss.minutes >= :min_minutes
        AND p.position IS NOT NULL
        {league_filter}
        ORDER BY pss.{metric} DESC NULLS LAST
        LIMIT :limit
    """

    params: dict = {"season": season, "min_minutes": min_minutes, "limit": limit}
    if league:
        params["league"] = league

    import pandas as pd
    df = run_query(sql, params)
    if df.empty:
        return {"rankings": [], "metric": metric, "metric_label": METRIC_LABELS.get(metric, metric), "per90": per90}

    df["position_group"] = df["position"].apply(_normalize_position)

    for col in ["minutes", "metric_value", "age"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    if position and position.upper() in ["GK", "DEF", "MID", "WNG", "FWD"]:
        df = df[df["position_group"] == position.upper()]

    if per90 and metric not in NON_PER90_METRICS:
        df["metric_value"] = (df["metric_value"] / (df["minutes"] / 90).clip(lower=1)).round(3)
        df = df.sort_values("metric_value", ascending=False)

    df = df.reset_index(drop=True)
    df["rank"] = range(1, len(df) + 1)

    return {
        "rankings": df.fillna(0).to_dict("records"),
        "metric": metric,
        "metric_label": METRIC_LABELS.get(metric, metric),
        "per90": per90,
        "total": len(df),
        "available_metrics": [{"key": k, "label": v} for k, v in METRIC_LABELS.items()],
    }
