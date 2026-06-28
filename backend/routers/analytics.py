from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

import pandas as pd

from database.connection import run_query
from models.talent_detection import get_emerging_talents
from config import SCATTER_METRIC_LABELS, NEGATIVE_METRICS

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

WEIGHT_ALLOWED = [
    "xg", "xa", "npxg", "goals", "assists",
    "aerial_duels_won", "defensive_duels_won",
    "interceptions", "clearances", "recoveries", "key_passes",
    "passes_accurate", "dribbles_successful",
]

# Update scatter metric labels for new schema
SCATTER_METRIC_LABELS_NEW = {
    "xg_per90":             "xG per 90",
    "xa_per90":             "xA per 90",
    "goals_per90":          "Goals per 90",
    "assists_per90":        "Assists per 90",
    "shots_per90":          "Shots per 90",
    "key_passes_per90":     "Key Passes per 90",
    "dribbles_per90":       "Dribbles per 90",
    "aerials_per90":        "Aerials Won per 90",
    "interceptions_per90":  "Interceptions per 90",
    "recoveries_per90":     "Recoveries per 90",
    "progressive_runs_per90": "Progressive Runs per 90",
}


class WeightedRankingRequest(BaseModel):
    weights: dict
    competition: Optional[str] = None
    league: Optional[str] = None
    position: Optional[str] = None
    min_minutes: int = 450
    limit: int = 50


@router.get("/scores")
def get_scores(
    competition: Optional[str] = None,
    league: Optional[str] = None,
    position: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    from models.performance_score import calculate_performance_scores
    comp = competition or league
    df = calculate_performance_scores(competition=comp, position_group=position)
    if df.empty:
        return []
    df = df.head(limit)
    return df.fillna(0).to_dict(orient="records")


@router.get("/talents")
def get_talents(
    competition: Optional[str] = None,
    league: Optional[str] = None,
    max_age: int = Query(23, ge=15, le=30),
    min_minutes: int = Query(450, ge=100, le=9000),
    top_percentile: float = Query(75.0, ge=50.0, le=99.0),
    season: Optional[str] = None,
):
    comp = competition or league
    df = get_emerging_talents(
        max_age=max_age,
        min_minutes=min_minutes,
        top_percentile=top_percentile,
        competition=comp,
    )
    if df.empty:
        return []
    return df.fillna(0).to_dict(orient="records")


@router.get("/scatter")
def get_scatter(
    x_metric: str = Query("xg_per90"),
    y_metric: str = Query("xa_per90"),
    competition: Optional[str] = None,
    league: Optional[str] = None,
    positions: Optional[str] = None,
    min_minutes: int = Query(450, ge=100, le=9000),
    season: Optional[str] = None,
):
    comp = competition or league

    where = ["pms.minutes_played > 0"]
    params: dict = {"min_minutes": min_minutes}

    if comp:
        where.append("pms.competition_name = :competition")
        params["competition"] = comp

    where_sql = " AND ".join(where)

    sql = f"""
        SELECT
            p.player_id, p.name AS player_name,
            p.current_team_name AS team_name, p.position_group,
            pms.competition_name AS league_name,
            SUM(pms.minutes_played)                    AS minutes_played,
            COALESCE(SUM(pms.goals), 0)               AS goals,
            COALESCE(SUM(pms.assists), 0)             AS assists,
            COALESCE(SUM(pms.xg), 0)                  AS xg,
            COALESCE(SUM(pms.xa), 0)                  AS xa,
            COALESCE(SUM(pms.shots), 0)               AS shots,
            COALESCE(SUM(pms.key_passes), 0)          AS key_passes,
            COALESCE(SUM(pms.dribbles_successful), 0) AS dribbles,
            COALESCE(SUM(pms.aerial_duels_won), 0)    AS aerials_won,
            COALESCE(SUM(pms.defensive_duels_won), 0) AS tackles_won,
            COALESCE(SUM(pms.interceptions), 0)       AS interceptions,
            COALESCE(SUM(pms.recoveries), 0)          AS recoveries,
            COALESCE(SUM(pms.progressive_runs), 0)    AS progressive_runs
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        WHERE {where_sql}
        GROUP BY p.player_id, p.name, p.current_team_name, p.position_group, pms.competition_name
        HAVING SUM(pms.minutes_played) >= :min_minutes
    """

    df = run_query(sql, params)
    if df.empty:
        return {"data": [], "x_label": x_metric, "y_label": y_metric,
                "metrics": list(SCATTER_METRIC_LABELS_NEW.items()), "top_outlier": ""}

    num_cols = ["minutes_played", "goals", "assists", "xg", "xa", "shots",
                "key_passes", "dribbles", "aerials_won", "tackles_won",
                "interceptions", "recoveries", "progressive_runs"]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    mins = df["minutes_played"].clip(lower=1)
    df["goals_per90"]           = (df["goals"]            / mins * 90).round(3)
    df["assists_per90"]         = (df["assists"]           / mins * 90).round(3)
    df["xg_per90"]              = (df["xg"]               / mins * 90).round(3)
    df["xa_per90"]              = (df["xa"]               / mins * 90).round(3)
    df["shots_per90"]           = (df["shots"]            / mins * 90).round(3)
    df["key_passes_per90"]      = (df["key_passes"]       / mins * 90).round(3)
    df["dribbles_per90"]        = (df["dribbles"]         / mins * 90).round(3)
    df["aerials_per90"]         = (df["aerials_won"]      / mins * 90).round(3)
    df["interceptions_per90"]   = (df["interceptions"]    / mins * 90).round(3)
    df["recoveries_per90"]      = (df["recoveries"]       / mins * 90).round(3)
    df["progressive_runs_per90"] = (df["progressive_runs"] / mins * 90).round(3)

    # Chelsea highlight
    from database.connection import run_query as rq
    chelsea_players_sql = """
        SELECT p.player_id FROM players p
        JOIN teams t ON t.wyscout_id = p.current_team_wyscout_id
        WHERE t.team_id = 10
    """
    chelsea_df = run_query(chelsea_players_sql, {})
    chelsea_ids = set(chelsea_df["player_id"].tolist()) if not chelsea_df.empty else set()
    df["is_chelsea"] = df["player_id"].isin(chelsea_ids)

    if positions:
        pos_list = [p.strip().upper() for p in positions.split(",")]
        df = df[df["position_group"].isin(pos_list)]

    x_col = x_metric if x_metric in df.columns else "xg_per90"
    y_col = y_metric if y_metric in df.columns else "xa_per90"

    out = df[["player_id", "player_name", "team_name", "league_name",
              "position_group", "minutes_played", "is_chelsea", x_col, y_col]].copy()
    out = out.rename(columns={x_col: "x", y_col: "y"})

    top_outlier = ""
    if not out.empty:
        outlier_row = out.nlargest(1, "x")
        if not outlier_row.empty:
            top_outlier = str(outlier_row.iloc[0].get("player_name", ""))

    return {
        "data": out.fillna(0).to_dict(orient="records"),
        "x_label": SCATTER_METRIC_LABELS_NEW.get(x_metric, x_metric),
        "y_label": SCATTER_METRIC_LABELS_NEW.get(y_metric, y_metric),
        "metrics": [{"key": k, "label": v} for k, v in SCATTER_METRIC_LABELS_NEW.items()],
        "top_outlier": top_outlier,
        "last_updated": "Live",
    }


@router.post("/weighted-ranking")
def weighted_ranking(body: WeightedRankingRequest):
    weights = {k: v for k, v in body.weights.items() if k in WEIGHT_ALLOWED and v > 0}
    if not weights:
        return {"players": []}

    comp = body.competition or body.league

    where = ["pms.minutes_played > 0"]
    params: dict = {"min_minutes": body.min_minutes}

    if comp:
        where.append("pms.competition_name = :competition")
        params["competition"] = comp

    where_sql = " AND ".join(where)
    metric_selects = ", ".join([
        f"COALESCE(SUM(pms.{m}), 0) AS {m}" for m in weights
    ])

    sql = f"""
        SELECT p.player_id, p.name AS player_name, p.position_group,
               p.nationality,
               EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
               p.current_team_name AS team_name,
               pms.competition_name AS league_name,
               SUM(pms.minutes_played) AS minutes,
               {metric_selects}
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        WHERE {where_sql}
        GROUP BY p.player_id, p.name, p.position_group, p.nationality,
                 p.date_of_birth, p.current_team_name, pms.competition_name
        HAVING SUM(pms.minutes_played) >= :min_minutes
    """

    df = run_query(sql, params)
    if df.empty:
        return {"players": []}

    if body.position and body.position.upper() in ("GK", "DEF", "MID", "FWD"):
        df = df[df["position_group"] == body.position.upper()]

    for col in df.columns:
        if col not in ("player_id", "player_name", "position_group", "nationality",
                       "team_name", "league_name"):
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["min90"] = (df["minutes"] / 90).clip(lower=1)
    total_weight = sum(weights.values())
    import numpy as np
    composite = pd.Series(0.0, index=df.index)

    for metric, weight in weights.items():
        if metric not in df.columns:
            continue
        values = (df[metric] / df["min90"]).fillna(0)
        vmin, vmax = values.min(), values.max()
        if vmax > vmin:
            norm = (values - vmin) / (vmax - vmin)
            if metric in NEGATIVE_METRICS:
                norm = 1.0 - norm
        else:
            norm = pd.Series(0.5, index=values.index)
        composite += (weight / total_weight) * norm

    df["composite_score"] = (composite * 100).round(1)
    df = df.nlargest(body.limit, "composite_score").reset_index(drop=True)
    df["rank"] = range(1, len(df) + 1)

    return {"players": df.fillna(0).to_dict("records")}
