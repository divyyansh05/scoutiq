from fastapi import APIRouter
from typing import Optional

from database.connection import run_query
from models.clustering import get_team_styles
from config import CHELSEA_TEAM_ID, MIN_MINUTES

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/styles")
def team_styles(season: Optional[str] = None):
    df = get_team_styles(season=season)
    if df.empty:
        return []
    return df.fillna(0).to_dict(orient="records")


@router.get("/chelsea")
def chelsea_focus(season: Optional[str] = None):
    where_clauses = [
        "pss.team_id = :team_id",
        "pss.minutes >= :min_minutes"
    ]
    params: dict = {"team_id": CHELSEA_TEAM_ID, "min_minutes": MIN_MINUTES}

    if season:
        where_clauses.append("s.season_name = :season")
        params["season"] = season

    where_sql = " AND ".join(where_clauses)

    sql = f"""
        SELECT
            p.player_id,
            p.player_name,
            p.position,
            pss.minutes,
            pss.goals,
            pss.assists,
            pss.xg,
            pss.xa,
            pss.sofascore_rating AS rating,
            EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE {where_sql}
        ORDER BY pss.sofascore_rating DESC NULLS LAST
    """

    df = run_query(sql, params)
    if df.empty:
        return {"team": "Chelsea FC", "players": [], "stats": {}}

    import pandas as pd
    num_cols = ["minutes", "goals", "assists", "xg", "xa", "rating", "age"]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df = df.rename(columns={"minutes": "minutes_played"})

    stats = {
        "squad_size": len(df),
        "avg_age": round(float(df["age"].mean()), 1),
        "avg_rating": round(float(df["rating"].mean()), 2),
        "total_goals": int(df["goals"].sum()),
        "total_assists": int(df["assists"].sum()),
    }

    return {
        "team": "Chelsea FC",
        "stats": stats,
        "players": df.fillna(0).to_dict(orient="records"),
    }
