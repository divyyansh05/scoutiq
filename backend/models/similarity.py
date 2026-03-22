"""
Player similarity engine using cosine similarity on position-normalised features.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Optional

from database.connection import run_query
from config import POSITION_MAP, MIN_MINUTES


_FEATURE_COLS = [
    "xg_per90", "xa_per90", "goals_per90", "assists_per90",
    "shots_per90", "key_passes_per90", "dribbles_per90",
    "aerials_per90", "tackles_per90", "interceptions_per90",
    "recoveries_per90", "pass_accuracy", "rating",
]

_FETCH_SQL = """
    SELECT
        p.player_id,
        p.player_name,
        t.team_name,
        l.league_name,
        s.season_name,
        p.position,
        pss.minutes,
        pss.xg,
        pss.xa,
        pss.goals,
        pss.assists,
        pss.shots,
        pss.key_passes,
        pss.dribbles_completed  AS dribbles,
        pss.aerials_won,
        pss.tackles_won,
        pss.interceptions,
        pss.recoveries,
        pss.accurate_passes_pct AS pass_accuracy,
        pss.sofascore_rating    AS rating
    FROM player_season_stats pss
    JOIN players  p ON pss.player_id  = p.player_id
    JOIN teams    t ON pss.team_id    = t.team_id
    JOIN leagues  l ON pss.league_id  = l.league_id
    JOIN seasons  s ON pss.season_id  = s.season_id
    WHERE pss.minutes >= :min_minutes
    {extra_where}
"""


def _normalize_position(pos: str) -> str:
    if not pos:
        return "MID"
    return POSITION_MAP.get(pos.strip(), "MID")


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    num_cols = [
        "minutes", "xg", "xa", "goals", "assists", "shots",
        "key_passes", "dribbles", "aerials_won", "tackles_won",
        "interceptions", "recoveries", "pass_accuracy", "rating",
    ]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    mins = df["minutes"].clip(lower=1)
    df["xg_per90"]            = df["xg"]           / mins * 90
    df["xa_per90"]            = df["xa"]            / mins * 90
    df["goals_per90"]         = df["goals"]         / mins * 90
    df["assists_per90"]       = df["assists"]       / mins * 90
    df["shots_per90"]         = df["shots"]         / mins * 90
    df["key_passes_per90"]    = df["key_passes"]    / mins * 90
    df["dribbles_per90"]      = df["dribbles"]      / mins * 90
    df["aerials_per90"]       = df["aerials_won"]   / mins * 90
    df["tackles_per90"]       = df["tackles_won"]   / mins * 90
    df["interceptions_per90"] = df["interceptions"] / mins * 90
    df["recoveries_per90"]    = df["recoveries"]    / mins * 90

    df["position_group"] = df["position"].apply(_normalize_position)
    return df


def _cosine_similarity_matrix(matrix: np.ndarray) -> np.ndarray:
    """Row-wise L2 normalise then dot-product for cosine similarity."""
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1e-9, norms)
    normed = matrix / norms
    return normed @ normed.T


def get_similar_players(
    player_id: int,
    season: Optional[str] = None,
    n: int = 10,
    same_league_only: bool = False,
    league_filter: Optional[str] = None,
    min_minutes: int = MIN_MINUTES,
) -> pd.DataFrame:
    extra_parts = []
    params: dict = {"min_minutes": min_minutes}

    if season:
        extra_parts.append("AND s.season_name = :season")
        params["season"] = season
    if league_filter:
        extra_parts.append("AND l.league_name = :league")
        params["league"] = league_filter

    sql = _FETCH_SQL.format(extra_where=" ".join(extra_parts))
    df = run_query(sql, params)

    if df.empty:
        return pd.DataFrame()

    df = _build_features(df)

    # Locate the target player
    target_mask = df["player_id"] == player_id
    if not target_mask.any():
        return pd.DataFrame()

    target_row = df[target_mask].iloc[0]
    target_pos = target_row["position_group"]

    # Filter to same position group
    same_pos = df[df["position_group"] == target_pos].copy()

    if len(same_pos) < 2:
        return pd.DataFrame()

    # Build feature matrix (only columns available)
    feat_cols = [c for c in _FEATURE_COLS if c in same_pos.columns]
    feat_matrix = same_pos[feat_cols].fillna(0).values.astype(float)

    # Cosine similarity
    sim_matrix = _cosine_similarity_matrix(feat_matrix)

    # Find index of target within same_pos
    target_idx_in_group = same_pos.index.get_loc(same_pos[same_pos["player_id"] == player_id].index[0])
    sim_scores = sim_matrix[target_idx_in_group]

    same_pos = same_pos.copy()
    same_pos["similarity"] = (sim_scores * 100).round(1)

    # Exclude the player themselves and sort
    result = (
        same_pos[same_pos["player_id"] != player_id]
        .sort_values("similarity", ascending=False)
        .head(n)
    )

    if same_league_only:
        result = result[result["league_name"] == target_row["league_name"]]

    return result[[
        "player_id", "player_name", "team_name", "league_name",
        "season_name", "position_group", "similarity",
        "xg_per90", "xa_per90", "goals_per90", "assists_per90",
        "aerials_per90", "tackles_per90", "rating",
    ]].head(n)
