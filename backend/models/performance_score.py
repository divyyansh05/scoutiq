"""
Scout Score — composite efficiency metric (0–100, percentile-based).

Score = player's percentile rank within their position group.
Score 73 → better than 73% of players at that position.
Labels: Elite (90+) | Top Tier (75+) | Above Avg (60+) |
        Average (40+) | Below Avg (25+) | Developing (<25)
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Optional

from database.connection import run_query
from config import POSITION_MAP, MIN_MINUTES, PERFORMANCE_WEIGHTS, SCORE_PCT_METRICS, score_label


_FETCH_SQL = """
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
        COALESCE(pss.npxg, 0)                        AS npxg,
        pss.shots,
        COALESCE(pss.shots_inside_box, 0)             AS shots_inside_box,
        pss.key_passes,
        COALESCE(pss.dribbles_completed, 0)           AS successful_dribbles,
        pss.aerials_won                               AS aerial_duels_won,
        COALESCE(pss.aerial_win_pct, 0)               AS aerial_win_pct,
        pss.tackles_won,
        COALESCE(pss.tackles_won_pct, 0)              AS tackles_won_pct,
        COALESCE(pss.tackles, 0)                      AS tackles,
        pss.interceptions,
        COALESCE(pss.clearances, 0)                   AS clearances,
        pss.recoveries,
        COALESCE(pss.duels_won, 0)                    AS duels_won,
        COALESCE(pss.duels_won_pct, 0)                AS duels_won_pct,
        COALESCE(pss.dispossessed, 0)                 AS dispossessed,
        COALESCE(pss.big_chances_created, 0)          AS big_chances_created,
        COALESCE(pss.big_chances_missed, 0)           AS big_chances_missed,
        pss.accurate_passes_pct,
        COALESCE(pss.accurate_final_third, 0)         AS accurate_final_third,
        COALESCE(pss.possession_won_att_third, 0)     AS possession_won_att_third,
        COALESCE(pss.touches, 0)                      AS touches,
        pss.sofascore_rating,
        COALESCE(pss.shots_blocked, 0)                AS saves
    FROM player_season_stats pss
    JOIN players  p ON pss.player_id  = p.player_id
    JOIN teams    t ON pss.team_id    = t.team_id
    JOIN leagues  l ON pss.league_id  = l.league_id
    JOIN seasons  s ON pss.season_id  = s.season_id
    WHERE pss.minutes >= :min_minutes
    {extra_where}
    ORDER BY pss.sofascore_rating DESC NULLS LAST
"""


def _normalize_position(pos: str) -> str:
    if not pos:
        return "MID"
    return POSITION_MAP.get(pos.strip(), "MID")


def calculate_performance_scores(
    season: Optional[str] = None,
    league: Optional[str] = None,
    position_group: Optional[str] = None,
    min_minutes: int = MIN_MINUTES,
) -> pd.DataFrame:
    extra_parts = []
    params: dict = {"min_minutes": min_minutes}

    if season:
        extra_parts.append("AND s.season_name = :season")
        params["season"] = season
    if league:
        extra_parts.append("AND l.league_name = :league")
        params["league"] = league

    sql = _FETCH_SQL.format(extra_where=" ".join(extra_parts))
    df = run_query(sql, params)

    if df.empty:
        return pd.DataFrame()

    # Coerce numerics
    for col in df.columns:
        if col not in ("player_id", "player_name", "team_name", "league_name", "season_name", "position"):
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["position_group"] = df["position"].apply(_normalize_position)

    if position_group and position_group.upper() in ["GK", "DEF", "MID", "WNG", "FWD"]:
        df = df[df["position_group"] == position_group.upper()].copy()
        if df.empty:
            return pd.DataFrame()

    results = []
    for pos_grp, pos_df in df.groupby("position_group"):
        weights = PERFORMANCE_WEIGHTS.get(pos_grp, PERFORMANCE_WEIGHTS["MID"])
        pos_df = pos_df.copy()

        if len(pos_df) < 3:
            pos_df["raw_score"] = 50.0
            pos_df["score"] = 50.0
            pos_df["percentile"] = 50
            results.append(pos_df)
            continue

        pos_df["min90"] = (pos_df["minutes"] / 90).replace(0, np.nan)

        weighted_sum = pd.Series(0.0, index=pos_df.index)

        for metric, weight in weights.items():
            if metric not in pos_df.columns:
                continue
            if metric in SCORE_PCT_METRICS:
                values = pos_df[metric].fillna(0)
            else:
                values = (pos_df[metric].fillna(0) / pos_df["min90"]).fillna(0)

            vmin, vmax = values.min(), values.max()
            if vmax > vmin:
                norm = (values - vmin) / (vmax - vmin)
            else:
                norm = pd.Series(0.5, index=values.index)

            if weight < 0:
                weighted_sum += abs(weight) * (1 - norm)
            else:
                weighted_sum += weight * norm

        pos_df["raw_score"] = weighted_sum

        # Percentile rank within position group.
        # Score = fraction of peers with a strictly lower weighted sum, scaled to 0–98.
        # This prevents the top player from saturating at 100 so distributions look healthy.
        n = len(pos_df)
        ranks = pos_df["raw_score"].rank(method="average", ascending=True)
        pos_df["score"] = ((ranks - 1) / n * 98).round(1)
        pos_df["percentile"] = (pos_df["score"] / 98 * 100).round(0).astype(int).clip(0, 99)

        results.append(pos_df)

    if not results:
        return pd.DataFrame()

    final = pd.concat(results, ignore_index=True)
    final["score_label"] = final["score"].apply(score_label)

    keep = [
        "player_id", "player_name", "team_name", "league_name",
        "season_name", "position_group", "minutes",
        "xg", "xa", "goals", "assists",
        "score", "percentile", "score_label",
    ]
    return final[keep].sort_values("score", ascending=False)
