from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import math
import numpy as np

from database.connection import run_query
from models.performance_score import calculate_performance_scores
from models.similarity import get_similar_players
from config import POSITION_MAP, MIN_MINUTES

router = APIRouter(prefix="/api/players", tags=["players"])

SORT_COLS = {
    "score":       ("score", False),
    "minutes":     ("minutes_played", False),
    "xg_per90":    ("xg_per90", False),
    "xa_per90":    ("xa_per90", False),
    "aerials":     ("aerials_won", False),
    "rating":      ("rating", False),
    "age_asc":     ("age", True),
    "age_desc":    ("age", False),
}


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
    deep: Optional[str] = None,
    sort: str = "score",
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

    if deep == "true" or deep == "1":
        where_clauses.append("pss.aerials_won > 0 AND pss.sofascore_rating > 0")

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
            pss.key_passes,
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
    num_cols = ["minutes", "goals", "assists", "xg", "xa", "aerials_won", "rating", "age", "key_passes"]
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
    df["key_passes_per90"] = (df["key_passes"] / mins * 90).round(2)
    df["age"] = df["age"].astype(int)

    # Merge scores
    season_for_scores = season if season else None
    scores_df = calculate_performance_scores(season=season_for_scores)
    if not scores_df.empty:
        df = df.merge(
            scores_df[["player_id", "score", "percentile", "score_label"]],
            on="player_id", how="left"
        )
        df["score"] = pd.to_numeric(df.get("score", 0), errors="coerce").fillna(0)
        df["percentile"] = pd.to_numeric(df.get("percentile", 0), errors="coerce").fillna(0)
        df["score_label"] = df.get("score_label", "—").fillna("—")
    else:
        df["score"] = 0.0
        df["percentile"] = 0.0
        df["score_label"] = "—"

    # Sort
    sort_col, sort_asc = SORT_COLS.get(sort, ("score", False))
    if sort_col in df.columns:
        df = df.sort_values(sort_col, ascending=sort_asc)

    total = len(df)
    pages = math.ceil(total / page_size)
    start = (page - 1) * page_size
    end = start + page_size
    page_df = df.iloc[start:end]

    return {"players": page_df.fillna(0).to_dict(orient="records"), "total": total, "page": page, "pages": pages}


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
            p.player_id, p.player_name,
            t.team_name, l.league_name, s.season_name,
            p.position, p.nationality,
            EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age,
            pss.minutes,
            pss.goals, pss.assists,
            pss.xg, pss.xa,
            COALESCE(pss.npxg, 0)                    AS npxg,
            pss.shots,
            COALESCE(pss.shots_inside_box, 0)         AS shots_inside_box,
            COALESCE(pss.shots_outside_box, 0)        AS shots_outside_box,
            pss.key_passes,
            COALESCE(pss.dribbles_completed, 0)       AS successful_dribbles,
            pss.aerials_won,
            COALESCE(pss.aerial_win_pct, 0)           AS aerial_win_pct,
            COALESCE(pss.aerial_duels_lost, 0)        AS aerial_duels_lost,
            pss.tackles_won,
            COALESCE(pss.tackles_won_pct, 0)          AS tackles_won_pct,
            pss.interceptions,
            COALESCE(pss.clearances, 0)               AS clearances,
            pss.recoveries,
            COALESCE(pss.duels_won, 0)                AS duels_won,
            COALESCE(pss.duels_won_pct, 0)            AS duels_won_pct,
            COALESCE(pss.dispossessed, 0)             AS dispossessed,
            COALESCE(pss.dribbled_past, 0)            AS dribbled_past,
            COALESCE(pss.big_chances_created, 0)      AS big_chances_created,
            COALESCE(pss.big_chances_missed, 0)       AS big_chances_missed,
            pss.accurate_passes_pct,
            COALESCE(pss.accurate_final_third, 0)     AS accurate_final_third,
            COALESCE(pss.accurate_long_balls, 0)      AS accurate_long_balls,
            COALESCE(pss.possession_won_att_third, 0) AS possession_won_att_third,
            COALESCE(pss.touches, 0)                  AS touches,
            COALESCE(pss.fouls_committed, 0)          AS fouls_committed,
            COALESCE(pss.fouls_won, 0)                AS fouls_won,
            COALESCE(pss.offsides, 0)                 AS offsides,
            COALESCE(pss.error_lead_to_goal, 0)       AS error_lead_to_goal,
            COALESCE(pss.ground_duels_won, 0)         AS ground_duels_won,
            COALESCE(pss.ground_duels_won_pct, 0)     AS ground_duels_won_pct,
            pss.sofascore_rating AS rating,
            COALESCE(pss.shots_blocked, 0)            AS saves
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
    for col in df.columns:
        if col not in ("player_id", "player_name", "team_name", "league_name", "season_name", "position", "nationality"):
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    row = df.rename(columns={"minutes": "minutes_played"}).iloc[0].to_dict()
    row["age"] = int(row.get("age", 0))
    row["position_group"] = _normalize_position(str(row.get("position", "")))

    mins = max(row.get("minutes_played", 1), 1)
    per90_cols = [
        ("xg", "xg_per90"), ("xa", "xa_per90"), ("goals", "goals_per90"),
        ("assists", "assists_per90"), ("shots", "shots_per90"),
        ("key_passes", "key_passes_per90"), ("successful_dribbles", "dribbles_per90"),
        ("aerials_won", "aerials_per90"), ("tackles_won", "tackles_per90"),
        ("interceptions", "interceptions_per90"), ("recoveries", "recoveries_per90"),
        ("saves", "saves_per90"), ("shots_inside_box", "shots_inside_box_per90"),
        ("big_chances_created", "big_chances_created_per90"),
        ("possession_won_att_third", "possession_won_att_third_per90"),
        ("touches", "touches_per90"),
    ]
    for src, dest in per90_cols:
        row[dest] = round(row.get(src, 0) / mins * 90, 3)

    # Also add pass_accuracy alias
    row["pass_accuracy"] = row.get("accurate_passes_pct", 0)

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


@router.get("/{player_id}/adaptability")
def player_adaptability(player_id: int, season: str = "2025-26"):
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.preprocessing import StandardScaler

    player_sql = """
        SELECT pss.xg, pss.xa, pss.aerials_won, pss.tackles_won,
               pss.key_passes, pss.accurate_passes_pct, pss.recoveries,
               pss.sofascore_rating, pss.minutes, p.position,
               p.player_name
        FROM player_season_stats pss
        JOIN players p ON pss.player_id = p.player_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE pss.player_id = :pid AND s.season_name = :season
        LIMIT 1
    """
    player_df = run_query(player_sql, {"pid": player_id, "season": season})
    if player_df.empty:
        return {"teams": []}

    team_sql = """
        SELECT t.team_id, t.team_name, l.league_name,
               AVG(pss.xg) as avg_xg, AVG(pss.xa) as avg_xa,
               AVG(pss.aerials_won) as avg_aerial,
               AVG(pss.tackles_won) as avg_tackles,
               AVG(pss.key_passes) as avg_key_passes,
               AVG(pss.accurate_passes_pct) as avg_pass_pct,
               AVG(pss.recoveries) as avg_recoveries,
               AVG(pss.sofascore_rating) as avg_rating
        FROM player_season_stats pss
        JOIN teams t ON pss.team_id = t.team_id
        JOIN leagues l ON pss.league_id = l.league_id
        JOIN seasons s ON pss.season_id = s.season_id
        WHERE s.season_name = :season
        AND pss.minutes >= 450
        GROUP BY t.team_id, t.team_name, l.league_name
        HAVING COUNT(DISTINCT pss.player_id) >= 5
    """
    teams_df = run_query(team_sql, {"season": season})
    if teams_df.empty:
        return {"teams": []}

    import pandas as pd
    features = ["avg_xg", "avg_xa", "avg_aerial", "avg_tackles",
                "avg_key_passes", "avg_pass_pct", "avg_recoveries", "avg_rating"]

    player_row = player_df.iloc[0]
    min90 = max(float(player_row.get("minutes", 90) or 90) / 90, 1)

    player_vec = np.array([
        float(player_row.get("xg", 0) or 0) / min90,
        float(player_row.get("xa", 0) or 0) / min90,
        float(player_row.get("aerials_won", 0) or 0) / min90,
        float(player_row.get("tackles_won", 0) or 0) / min90,
        float(player_row.get("key_passes", 0) or 0) / min90,
        float(player_row.get("accurate_passes_pct", 0) or 0),
        float(player_row.get("recoveries", 0) or 0) / min90,
        float(player_row.get("sofascore_rating", 0) or 0),
    ]).reshape(1, -1)

    team_matrix = teams_df[features].fillna(0).values.astype(float)

    all_data = np.vstack([player_vec, team_matrix])
    try:
        scaled = StandardScaler().fit_transform(all_data)
        p_scaled = scaled[0].reshape(1, -1)
        t_scaled = scaled[1:]
        sims = cosine_similarity(p_scaled, t_scaled)[0]
    except Exception:
        sims = np.zeros(len(teams_df))

    teams_df["compatibility_pct"] = (sims * 100).round(1)
    result = teams_df.nlargest(10, "compatibility_pct")

    return {
        "player_name": str(player_row.get("player_name", "")),
        "teams": result[["team_id", "team_name", "league_name", "compatibility_pct"] + features]
                       .fillna(0).to_dict("records"),
    }
