import pandas as pd
from fastapi import APIRouter, HTTPException
from typing import Optional

from database.connection import run_query
from models.clustering import get_team_styles
from models.performance_score import calculate_performance_scores
from config import CHELSEA_TEAM_ID, MIN_MINUTES, POSITION_MAP

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _normalize_position(pos: str) -> str:
    if not pos:
        return "MID"
    return POSITION_MAP.get(pos.strip(), "MID")


@router.get("/styles")
def team_styles(season: Optional[str] = None):
    df = get_team_styles(season=season)
    if df.empty:
        return []
    return df.fillna(0).to_dict(orient="records")


@router.get("/chelsea")
def chelsea_focus(season: str = "2025-26"):
    stats_sql = """
        SELECT
            COUNT(DISTINCT pss.player_id) AS squad_size,
            ROUND(AVG(EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth)))::numeric, 1) AS avg_age
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE pss.team_id = :team_id
        AND s.season_name = :season
        AND pss.minutes > 0
    """
    stats_df = run_query(stats_sql, {"team_id": CHELSEA_TEAM_ID, "season": season})

    scores = calculate_performance_scores(season=season)
    top3 = []
    avg_score = 0.0

    if not scores.empty:
        chelsea_scores = scores[
            scores["team_name"].str.contains("Chelsea", case=False, na=False)
        ]
        if not chelsea_scores.empty:
            top3 = (
                chelsea_scores.nlargest(3, "score")[
                    ["player_id", "player_name", "position_group", "score"]
                ]
                .fillna(0)
                .to_dict("records")
            )
            avg_score = round(float(chelsea_scores["score"].mean()), 1)

    row = stats_df.iloc[0] if not stats_df.empty else {}
    return {
        "squad_size": int(row.get("squad_size", 0)),
        "avg_age": float(row.get("avg_age", 0) or 0),
        "avg_score": avg_score,
        "top3": top3,
        "season": season,
    }


@router.get("/chelsea/full")
def chelsea_full(season: str = "2025-26"):
    return _get_team_players_internal(CHELSEA_TEAM_ID, season)


@router.get("/{team_id}")
def get_team(team_id: int, season: str = "2025-26"):
    sql = """
        SELECT t.team_id, t.team_name, l.league_name,
               COUNT(DISTINCT pss.player_id) as squad_size,
               ROUND(AVG(EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth)))::numeric, 1) as avg_age,
               ROUND(AVG(pss.sofascore_rating)::numeric, 2) as avg_rating,
               AVG(pss.xg) as avg_xg,
               AVG(pss.xa) as avg_xa,
               AVG(pss.accurate_passes_pct) as avg_pass_pct,
               AVG(pss.aerials_won) as avg_aerials,
               AVG(pss.tackles_won) as avg_tackles,
               AVG(pss.key_passes) as avg_key_passes,
               AVG(pss.recoveries) as avg_recoveries
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN teams t ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE t.team_id = :team_id
        AND s.season_name = :season
        AND pss.minutes > 0
        GROUP BY t.team_id, t.team_name, l.league_name
    """
    team = run_query(sql, {"team_id": team_id, "season": season})
    if team.empty:
        raise HTTPException(status_code=404, detail="Team not found")
    return team.iloc[0].fillna(0).to_dict()


@router.get("/{team_id}/players")
def get_team_players(team_id: int, season: str = "2025-26"):
    result = _get_team_players_internal(team_id, season)
    return result


def _get_team_players_internal(team_id: int, season: str):
    sql = """
        SELECT
            p.player_id, p.player_name, p.position, p.nationality,
            EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth))::int AS age,
            pss.minutes,
            pss.goals, pss.assists,
            ROUND(pss.xg::numeric, 2) AS xg,
            ROUND(pss.xa::numeric, 2) AS xa,
            pss.aerials_won,
            pss.tackles_won,
            ROUND(pss.sofascore_rating::numeric, 2) AS rating,
            pss.key_passes,
            pss.interceptions,
            COALESCE(pss.clearances, 0) AS clearances,
            pss.accurate_passes_pct,
            pss.recoveries,
            t.team_name,
            l.league_name
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN teams t ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE pss.team_id = :team_id
        AND s.season_name = :season
        AND pss.minutes > 0
        ORDER BY pss.minutes DESC
    """
    players_df = run_query(sql, {"team_id": team_id, "season": season})

    if players_df.empty:
        return {"team_name": "Unknown", "league": "", "season": season, "players": []}

    players_df["position_group"] = players_df["position"].apply(_normalize_position)

    scores = calculate_performance_scores(season=season)
    if not scores.empty:
        players_df = players_df.merge(
            scores[["player_id", "score", "percentile", "score_label"]],
            on="player_id", how="left"
        )

    num_cols = ["age", "minutes", "goals", "assists", "xg", "xa",
                "aerials_won", "tackles_won", "rating", "key_passes",
                "score", "percentile", "interceptions", "clearances"]
    for col in num_cols:
        if col in players_df.columns:
            players_df[col] = pd.to_numeric(players_df[col], errors="coerce").fillna(0)

    team_name = str(players_df.iloc[0].get("team_name", "Team")) if not players_df.empty else "Team"
    league_name = str(players_df.iloc[0].get("league_name", "")) if not players_df.empty else ""

    return {
        "team_name": team_name,
        "league": league_name,
        "season": season,
        "players": players_df.fillna(0).to_dict("records"),
    }
