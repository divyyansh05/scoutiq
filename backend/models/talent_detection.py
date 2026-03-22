"""
Emerging talent detection.

Finds U-N players (default U-23) who score in the top X-th percentile of
their position group relative to players of *all* ages in the same cohort.
This surfaces players who punch above their age.
"""

from __future__ import annotations

import pandas as pd
from typing import Optional

from models.performance_score import calculate_performance_scores
from config import MIN_MINUTES


def get_emerging_talents(
    season: Optional[str] = None,
    max_age: int = 23,
    min_minutes: int = 450,
    top_percentile: float = 75.0,
    league: Optional[str] = None,
) -> pd.DataFrame:
    # Get scores for everyone (to get proper percentiles in context)
    all_scores = calculate_performance_scores(
        season=season,
        league=league,
        min_minutes=min_minutes,
    )

    if all_scores.empty:
        return pd.DataFrame()

    # We need age – fetch it separately since performance_score doesn't include DOB
    from database.connection import run_query

    extra_parts = ["AND pss.minutes >= :min_minutes"]
    params: dict = {"min_minutes": min_minutes}

    if season:
        extra_parts.append("AND s.season_name = :season")
        params["season"] = season
    if league:
        extra_parts.append("AND l.league_name = :league")
        params["league"] = league

    extra_where = " ".join(extra_parts)

    age_sql = f"""
        SELECT
            p.player_id,
            EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age
        FROM players p
        JOIN player_season_stats pss ON p.player_id = pss.player_id
        JOIN seasons s ON pss.season_id = s.season_id
        JOIN leagues l ON pss.league_id = l.league_id
        WHERE {extra_where.lstrip('AND ')}
    """

    # strip leading AND for WHERE clause
    age_sql = f"""
        SELECT
            p.player_id,
            EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age
        FROM players p
        JOIN player_season_stats pss ON p.player_id = pss.player_id
        JOIN seasons s ON pss.season_id = s.season_id
        JOIN leagues l ON pss.league_id = l.league_id
        WHERE pss.minutes >= :min_minutes
        {"AND s.season_name = :season" if season else ""}
        {"AND l.league_name = :league" if league else ""}
    """

    age_df = run_query(age_sql, params)

    if age_df.empty:
        return pd.DataFrame()

    age_df["age"] = pd.to_numeric(age_df["age"], errors="coerce").fillna(99).astype(int)

    merged = all_scores.merge(age_df[["player_id", "age"]], on="player_id", how="left")
    merged["age"] = merged["age"].fillna(99).astype(int)

    # Filter to target age group
    young = merged[merged["age"] <= max_age].copy()

    if young.empty:
        return pd.DataFrame()

    # Keep only those above the percentile threshold (relative to full cohort)
    threshold = top_percentile
    young = young[young["percentile"] >= threshold].copy()

    young = young.sort_values(["score", "age"], ascending=[False, True])

    return young[[
        "player_id", "player_name", "team_name", "league_name",
        "season_name", "position_group", "age", "minutes",
        "xg_per90", "xa_per90", "goals_per90", "assists_per90",
        "rating", "score", "percentile", "score_label",
    ]]
