"""
Emerging talent detection — U-N players in top percentile.
Rewritten for football_platform schema.
"""

from __future__ import annotations

import pandas as pd
from typing import Optional

from database.connection import run_query


def get_emerging_talents(
    season: Optional[str] = None,
    max_age: int = 23,
    min_minutes: int = 450,
    top_percentile: float = 75.0,
    league: Optional[str] = None,
    competition: Optional[str] = None,
) -> pd.DataFrame:
    comp_filter = competition or league

    where = ["ps.minutes_total >= :min_minutes", "ps.percentile_rank >= :threshold"]
    params: dict = {"min_minutes": min_minutes, "threshold": top_percentile}

    if comp_filter:
        where.append("c.name = :competition")
        params["competition"] = comp_filter

    sql = f"""
        SELECT
            p.player_id,
            p.name                   AS player_name,
            p.position_group,
            p.primary_position,
            p.nationality,
            p.current_team_name      AS team_name,
            c.name                   AS competition_name,
            EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
            ps.performance_score     AS score,
            ps.percentile_rank       AS percentile,
            ps.minutes_total         AS minutes,
            ps.matches_total         AS matches,
            ps.goals_p90,
            ps.xg_p90,
            ps.assists_p90,
            ps.xa_p90,
            p.date_of_birth
        FROM player_scores ps
        JOIN players p ON p.player_id = ps.player_id
        JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE {' AND '.join(where)}
          AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) <= :max_age
        ORDER BY ps.performance_score DESC NULLS LAST, p.date_of_birth DESC
    """
    params["max_age"] = max_age

    df = run_query(sql, params)
    if df.empty:
        return pd.DataFrame()

    df["score"] = pd.to_numeric(df["score"], errors="coerce")
    df["percentile"] = pd.to_numeric(df["percentile"], errors="coerce")
    df["age"] = pd.to_numeric(df["age"], errors="coerce").fillna(99).astype(int)

    from config import score_label
    df["score_label"] = df["score"].apply(
        lambda s: score_label(float(s)) if pd.notna(s) else "—"
    )

    # Backward-compat aliases
    df["player_name"] = df["player_name"]  # already set
    df["league_name"] = df["competition_name"]
    df["season_name"] = df["competition_name"]
    df["xg_per90"] = df["xg_p90"]
    df["xa_per90"] = df["xa_p90"]
    df["goals_per90"] = df["goals_p90"]
    df["assists_per90"] = df["assists_p90"]
    df["rating"] = None

    # Deduplicate: keep highest-score record per player
    df = df.sort_values("score", ascending=False)
    df = df.drop_duplicates(subset=["player_id"], keep="first")

    keep = [
        "player_id", "player_name", "position_group", "primary_position",
        "nationality", "team_name", "competition_name", "league_name",
        "age", "minutes", "matches",
        "goals_p90", "xg_p90", "assists_p90", "xa_p90",
        "xg_per90", "xa_per90", "goals_per90", "assists_per90",
        "score", "percentile", "score_label",
    ]
    return df[[c for c in keep if c in df.columns]]
