from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import math

from database.connection import run_query
from models.performance_score import calculate_performance_scores
from models.similarity import get_similar_players
from config import POSITION_MAP, MIN_MINUTES

router = APIRouter(prefix="/api/players", tags=["players"])


def _normalize_position(pos: str) -> str:
    if not pos:
        return "MID"
    return POSITION_MAP.get(pos.strip(), "MID")


@router.get("/search")
def search_players(
    q: Optional[str] = None,
    season: Optional[str] = None,
    league: Optional[str] = None,
    position: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    min_minutes: int = MIN_MINUTES,
    page: int = 1,
    page_size: int = 20,
):
    where_clauses = ["pss.minutes >= :min_minutes"]
    params: dict = {"min_minutes": min_minutes}

    if q:
        where_clauses.append("(LOWER(p.player_name) LIKE :q OR LOWER(t.team_name) LIKE :q)")
        params["q"] = f"%{q.lower()}%"

    if season:
        where_clauses.append("s.season_name = :season")
        params["season"] = season

    if league:
        where_clauses.append("l.league_name = :league")
        params["league"] = league

    if min_age is not None:
        where_clauses.append("EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= :min_age")
        params["min_age"] = min_age

    if max_age is not None:
        where_clauses.append("EXTRACT(YEAR FROM AGE(p.date_of_birth)) <= :max_age")
        params["max_age"] = max_age

    where_sql = " AND ".join(where_clauses)

    sql = f"""
        SELECT
            p.player_id,
            p.player_name,
            t.team_name,
            l.league_name,
            s.season_name,
            p.position,
            pss.minutes,
            pss.goals,
            pss.assists,
            pss.xg,
            pss.xa,
            pss.aerials_won,
            pss.sofascore_rating AS rating,
            EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN teams t ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE {where_sql}
        ORDER BY pss.sofascore_rating DESC NULLS LAST
    """

    df = run_query(sql, params)
    if df.empty:
        return {"players": [], "total": 0, "page": page, "pages": 0}

    import pandas as pd
    num_cols = ["minutes", "goals", "assists", "xg", "xa", "aerials_won", "rating", "age"]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df = df.rename(columns={"minutes": "minutes_played"})
    df["position_group"] = df["position"].apply(_normalize_position)

    if position and position.upper() in ["GK", "DEF", "MID", "WNG", "FWD"]:
        df = df[df["position_group"] == position.upper()]

    mins = df["minutes_played"].clip(lower=1)
    df["xg_per90"] = (df["xg"] / mins * 90).round(2)
    df["xa_per90"] = (df["xa"] / mins * 90).round(2)
    df["aerials_per90"] = (df["aerials_won"] / mins * 90).round(2)
    df["age"] = df["age"].astype(int)

    total = len(df)
    pages = math.ceil(total / page_size)
    start = (page - 1) * page_size
    end = start + page_size
    page_df = df.iloc[start:end]

    records = page_df.fillna(0).to_dict(orient="records")
    return {"players": records, "total": total, "page": page, "pages": pages}


@router.get("/{player_id}")
def get_player(
    player_id: int,
    season: Optional[str] = None,
):
    where_clauses = ["p.player_id = :player_id"]
    params: dict = {"player_id": player_id}

    if season:
        where_clauses.append("s.season_name = :season")
        params["season"] = season

    where_sql = " AND ".join(where_clauses)

    sql = f"""
        SELECT
            p.player_id,
            p.player_name,
            t.team_name,
            l.league_name,
            s.season_name,
            p.position,
            p.nationality,
            EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age,
            pss.minutes,
            pss.goals,
            pss.assists,
            pss.xg,
            pss.xa,
            pss.shots,
            pss.shots_blocked AS saves,
            pss.key_passes,
            pss.dribbles_completed AS successful_dribbles,
            pss.aerials_won,
            pss.tackles_won,
            pss.interceptions,
            pss.recoveries,
            pss.accurate_passes_pct AS pass_accuracy,
            pss.sofascore_rating AS rating
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN teams t ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE {where_sql}
        ORDER BY s.season_name DESC
        LIMIT 1
    """

    df = run_query(sql, params)
    if df.empty:
        raise HTTPException(status_code=404, detail="Player not found")

    import pandas as pd
    num_cols = [
        "age", "minutes", "goals", "assists", "xg", "xa", "shots", "saves",
        "key_passes", "successful_dribbles", "aerials_won", "tackles_won",
        "interceptions", "recoveries", "pass_accuracy", "rating"
    ]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    row = df.rename(columns={"minutes": "minutes_played"}).iloc[0].to_dict()
    row["age"] = int(row.get("age", 0))
    row["position_group"] = _normalize_position(str(row.get("position", "")))

    mins = max(row.get("minutes_played", 1), 1)
    row["xg_per90"] = round(row.get("xg", 0) / mins * 90, 3)
    row["xa_per90"] = round(row.get("xa", 0) / mins * 90, 3)
    row["goals_per90"] = round(row.get("goals", 0) / mins * 90, 3)
    row["assists_per90"] = round(row.get("assists", 0) / mins * 90, 3)
    row["shots_per90"] = round(row.get("shots", 0) / mins * 90, 3)
    row["key_passes_per90"] = round(row.get("key_passes", 0) / mins * 90, 3)
    row["dribbles_per90"] = round(row.get("successful_dribbles", 0) / mins * 90, 3)
    row["aerials_per90"] = round(row.get("aerials_won", 0) / mins * 90, 3)
    row["tackles_per90"] = round(row.get("tackles_won", 0) / mins * 90, 3)
    row["interceptions_per90"] = round(row.get("interceptions", 0) / mins * 90, 3)
    row["recoveries_per90"] = round(row.get("recoveries", 0) / mins * 90, 3)
    row["saves_per90"] = round(row.get("saves", 0) / mins * 90, 3)

    sel_season = row.get("season_name")
    scores_df = calculate_performance_scores(season=sel_season, league=row.get("league_name"))
    if not scores_df.empty and player_id in scores_df["player_id"].values:
        p_row = scores_df[scores_df["player_id"] == player_id].iloc[0]
        row["score"] = float(p_row["score"])
        row["percentile"] = float(p_row["percentile"])
        row["score_label"] = p_row["score_label"]
    else:
        row["score"] = 50.0
        row["percentile"] = 50.0
        row["score_label"] = "Average"

    return row


@router.get("/{player_id}/seasons")
def get_player_seasons(player_id: int):
    sql = """
        SELECT DISTINCT s.season_name, s.season_id
        FROM player_season_stats pss
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE pss.player_id = :player_id
        ORDER BY s.season_name DESC
    """
    df = run_query(sql, {"player_id": player_id})
    if df.empty:
        return []
    return df.to_dict(orient="records")


@router.get("/{player_id}/similar")
def get_similar(
    player_id: int,
    season: Optional[str] = None,
    n: int = Query(10, ge=1, le=30),
    same_league_only: bool = False,
    league: Optional[str] = None,
):
    df = get_similar_players(
        player_id=player_id,
        season=season,
        n=n,
        same_league_only=same_league_only,
        league_filter=league,
    )
    if df.empty:
        return []
    return df.fillna(0).to_dict(orient="records")
