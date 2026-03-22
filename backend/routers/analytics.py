from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

import numpy as np
import pandas as pd

from database.connection import run_query
from models.performance_score import calculate_performance_scores
from models.talent_detection import get_emerging_talents
from config import CHELSEA_TEAM_ID, MIN_MINUTES, SCATTER_METRICS, SCATTER_METRIC_LABELS, POSITION_MAP

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

WEIGHT_ALLOWED = [
    "xg", "xa", "npxg", "goals", "assists", "aerials_won",
    "aerial_win_pct", "tackles_won", "tackles_won_pct",
    "interceptions", "clearances", "recoveries", "key_passes",
    "accurate_passes_pct", "accurate_final_third", "big_chances_created",
    "big_chances_missed", "dispossessed", "sofascore_rating",
    "dribbles_completed", "possession_won_att_third", "shots_inside_box",
]

PCT_METRICS = {"accurate_passes_pct", "aerial_win_pct", "tackles_won_pct", "sofascore_rating"}


def _normalize_position(pos: str) -> str:
    if not pos:
        return "MID"
    return POSITION_MAP.get(pos.strip(), "MID")


class WeightedRankingRequest(BaseModel):
    weights: dict
    season: str = "2025-26"
    position: Optional[str] = None
    league: Optional[str] = None
    min_minutes: int = 450
    limit: int = 50


@router.get("/scores")
def get_scores(
    season: Optional[str] = None,
    league: Optional[str] = None,
    position: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    df = calculate_performance_scores(season=season, league=league, position_group=position)
    if df.empty:
        return []
    df = df.sort_values("score", ascending=False).head(limit)
    return df.fillna(0).to_dict(orient="records")


@router.get("/talents")
def get_talents(
    season: Optional[str] = None,
    max_age: int = Query(23, ge=15, le=30),
    min_minutes: int = Query(450, ge=100, le=3400),
    top_percentile: float = Query(75.0, ge=50.0, le=99.0),
    league: Optional[str] = None,
):
    df = get_emerging_talents(
        season=season,
        max_age=max_age,
        min_minutes=min_minutes,
        top_percentile=top_percentile,
        league=league,
    )
    if df.empty:
        return []
    return df.fillna(0).to_dict(orient="records")


@router.get("/scatter")
def get_scatter(
    x_metric: str = Query("xg_per90"),
    y_metric: str = Query("xa_per90"),
    season: Optional[str] = None,
    league: Optional[str] = None,
    positions: Optional[str] = None,
    min_minutes: int = Query(450, ge=100, le=3400),
):
    where_clauses = ["pss.minutes >= :min_minutes"]
    params: dict = {"min_minutes": min_minutes}

    if season:
        where_clauses.append("s.season_name = :season")
        params["season"] = season

    if league:
        where_clauses.append("l.league_name = :league")
        params["league"] = league

    where_sql = " AND ".join(where_clauses)

    sql = f"""
        SELECT
            p.player_id, p.player_name,
            t.team_name, t.team_id, l.league_name,
            p.position, pss.minutes,
            pss.goals, pss.assists,
            pss.xg, pss.xa, pss.shots, pss.key_passes,
            COALESCE(pss.dribbles_completed, 0) AS successful_dribbles,
            pss.aerials_won, pss.tackles_won, pss.interceptions,
            pss.recoveries, pss.accurate_passes_pct AS pass_accuracy,
            pss.sofascore_rating AS rating
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN teams t ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE {where_sql}
    """

    df = run_query(sql, params)
    if df.empty:
        return {"data": [], "x_label": x_metric, "y_label": y_metric, "metrics": [], "top_outlier": ""}

    num_cols = [
        "minutes", "goals", "assists", "xg", "xa", "shots",
        "key_passes", "successful_dribbles", "aerials_won", "tackles_won",
        "interceptions", "recoveries", "pass_accuracy", "rating"
    ]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df = df.rename(columns={"minutes": "minutes_played"})
    mins = df["minutes_played"].clip(lower=1)
    df["goals_per90"]          = df["goals"]              / mins * 90
    df["assists_per90"]        = df["assists"]             / mins * 90
    df["xg_per90"]             = df["xg"]                 / mins * 90
    df["xa_per90"]             = df["xa"]                 / mins * 90
    df["shots_per90"]          = df["shots"]              / mins * 90
    df["key_passes_per90"]     = df["key_passes"]         / mins * 90
    df["dribbles_per90"]       = df["successful_dribbles"]/ mins * 90
    df["aerials_per90"]        = df["aerials_won"]        / mins * 90
    df["tackles_per90"]        = df["tackles_won"]        / mins * 90
    df["interceptions_per90"]  = df["interceptions"]      / mins * 90
    df["recoveries_per90"]     = df["recoveries"]         / mins * 90

    df["position_group"] = df["position"].apply(_normalize_position)
    df["is_chelsea"] = df["team_id"] == CHELSEA_TEAM_ID

    if positions:
        pos_list = [p.strip().upper() for p in positions.split(",")]
        df = df[df["position_group"].isin(pos_list)]

    x_col = x_metric if x_metric in df.columns else "xg_per90"
    y_col = y_metric if y_metric in df.columns else "xa_per90"

    out = df[["player_id", "player_name", "team_name", "league_name", "position_group",
              "minutes_played", "is_chelsea", x_col, y_col]].copy()
    out = out.rename(columns={x_col: "x", y_col: "y"})

    top_outlier = ""
    if not out.empty and "x" in out.columns:
        outlier_row = out.nlargest(1, "x")
        if not outlier_row.empty:
            top_outlier = str(outlier_row.iloc[0].get("player_name", ""))

    return {
        "data": out.fillna(0).to_dict(orient="records"),
        "x_label": SCATTER_METRIC_LABELS.get(x_metric, x_metric),
        "y_label": SCATTER_METRIC_LABELS.get(y_metric, y_metric),
        "metrics": [{"key": k, "label": v} for k, v in SCATTER_METRIC_LABELS.items()],
        "top_outlier": top_outlier,
        "last_updated": "Live",
    }


@router.post("/weighted-ranking")
def weighted_ranking(body: WeightedRankingRequest):
    weights = {k: v for k, v in body.weights.items() if k in WEIGHT_ALLOWED and v > 0}
    if not weights:
        return {"players": []}

    metric_list = list(weights.keys())
    league_filter = "AND l.league_name = :league" if body.league else ""

    metric_selects = ", ".join([f"COALESCE(pss.{m}, 0) AS {m}" for m in metric_list])

    sql = f"""
        SELECT p.player_id, p.player_name, p.position, p.nationality,
               EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth))::int AS age,
               t.team_name, l.league_name, pss.minutes,
               {metric_selects}
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN teams t ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE s.season_name = :season
        AND pss.minutes >= :min_minutes
        AND p.position IS NOT NULL
        {league_filter}
    """

    params: dict = {"season": body.season, "min_minutes": body.min_minutes}
    if body.league:
        params["league"] = body.league

    df = run_query(sql, params)
    if df.empty:
        return {"players": []}

    df["position_group"] = df["position"].apply(_normalize_position)

    if body.position and body.position.upper() in ["GK", "DEF", "MID", "WNG", "FWD"]:
        df = df[df["position_group"] == body.position.upper()]

    for col in df.columns:
        if col not in ("player_id", "player_name", "position", "nationality", "team_name", "league_name", "position_group"):
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["min90"] = (df["minutes"] / 90).clip(lower=1)
    total_weight = sum(weights.values())
    composite = pd.Series(0.0, index=df.index)

    for metric, weight in weights.items():
        if metric not in df.columns:
            continue
        if metric in PCT_METRICS:
            values = df[metric].fillna(0)
        else:
            values = (df[metric].fillna(0) / df["min90"]).fillna(0)

        vmin, vmax = values.min(), values.max()
        if vmax > vmin:
            norm = (values - vmin) / (vmax - vmin)
        else:
            norm = pd.Series(0.5, index=values.index)

        composite += (weight / total_weight) * norm

    df["composite_score"] = (composite * 100).round(1)
    df = df.nlargest(body.limit, "composite_score")
    df = df.reset_index(drop=True)
    df["rank"] = range(1, len(df) + 1)

    return {"players": df.fillna(0).to_dict("records")}
