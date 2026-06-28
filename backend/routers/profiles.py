"""
Positional sub-profile system (Feature 10).

POSITIONAL_PROFILES defines 11 scouting sub-profiles. Each profile maps
a conceptual player archetype to a weighted set of per-90 metrics from
the player_scores table (plus accurate_passes_pct from player_season_stats).

Used by:
  GET /api/profiles/                  — list all profiles
  GET /api/profiles/{key}/players     — ranked players for a profile
  GET /api/teams/{id}/squad-gap-profiles  — gap analysis per team (teams.py)
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from database.connection import run_query
from models.performance_score import get_season_dates
from config import format_nationality

router = APIRouter(prefix="/api/profiles", tags=["profiles"])

# ---------------------------------------------------------------------------
# Profile definitions
# ---------------------------------------------------------------------------

POSITIONAL_PROFILES: dict[str, dict] = {
    # ── Goalkeepers ─────────────────────────────────────────────────────────
    "ball_playing_gk": {
        "label": "Ball-Playing GK",
        "base_position": "GK",
        "kpis": [
            {"field": "accurate_passes_pct",      "weight": 0.40, "label": "Pass %"},
            {"field": "recoveries_p90",            "weight": 0.30, "label": "Recoveries/90"},
            {"field": "aerial_won_p90",            "weight": 0.30, "label": "Aerial Won/90"},
        ],
    },

    # ── Midfielders ─────────────────────────────────────────────────────────
    "inverted_winger": {
        "label": "Inverted Winger",
        "base_position": "MID",
        "kpis": [
            {"field": "xg_p90",                   "weight": 0.30, "label": "xG/90"},
            {"field": "shots_p90",                 "weight": 0.20, "label": "Shots/90"},
            {"field": "successful_dribbles_p90",   "weight": 0.25, "label": "Dribbles/90"},
            {"field": "xa_p90",                    "weight": 0.25, "label": "xA/90"},
        ],
    },
    "traditional_winger": {
        "label": "Traditional Winger",
        "base_position": "MID",
        "kpis": [
            {"field": "xa_p90",                   "weight": 0.35, "label": "xA/90"},
            {"field": "key_passes_p90",            "weight": 0.30, "label": "KP/90"},
            {"field": "successful_dribbles_p90",   "weight": 0.20, "label": "Dribbles/90"},
            {"field": "xg_p90",                   "weight": 0.15, "label": "xG/90"},
        ],
    },
    "deep_lying_midfielder": {
        "label": "Deep-Lying Midfielder",
        "base_position": "MID",
        "kpis": [
            {"field": "accurate_passes_pct",      "weight": 0.35, "label": "Pass %"},
            {"field": "recoveries_p90",            "weight": 0.25, "label": "Recoveries/90"},
            {"field": "tackles_p90",               "weight": 0.20, "label": "Tackles/90"},
            {"field": "interceptions_p90",         "weight": 0.20, "label": "Interceptions/90"},
        ],
    },
    "box_to_box_midfielder": {
        "label": "Box-to-Box Midfielder",
        "base_position": "MID",
        "kpis": [
            {"field": "recoveries_p90",            "weight": 0.25, "label": "Recoveries/90"},
            {"field": "tackles_p90",               "weight": 0.20, "label": "Tackles/90"},
            {"field": "xa_p90",                   "weight": 0.20, "label": "xA/90"},
            {"field": "xg_p90",                   "weight": 0.20, "label": "xG/90"},
            {"field": "key_passes_p90",            "weight": 0.15, "label": "KP/90"},
        ],
    },

    # ── Defenders ────────────────────────────────────────────────────────────
    "attacking_fullback": {
        "label": "Attacking Full-Back",
        "base_position": "DEF",
        "kpis": [
            {"field": "xa_p90",                   "weight": 0.30, "label": "xA/90"},
            {"field": "key_passes_p90",            "weight": 0.25, "label": "KP/90"},
            {"field": "successful_dribbles_p90",   "weight": 0.25, "label": "Dribbles/90"},
            {"field": "tackles_p90",               "weight": 0.20, "label": "Tackles/90"},
        ],
    },
    "defensive_fullback": {
        "label": "Defensive Full-Back",
        "base_position": "DEF",
        "kpis": [
            {"field": "tackles_p90",               "weight": 0.30, "label": "Tackles/90"},
            {"field": "interceptions_p90",         "weight": 0.30, "label": "Interceptions/90"},
            {"field": "recoveries_p90",            "weight": 0.20, "label": "Recoveries/90"},
            {"field": "aerial_won_p90",            "weight": 0.20, "label": "Aerial Won/90"},
        ],
    },
    "ball_playing_cb": {
        "label": "Ball-Playing CB",
        "base_position": "DEF",
        "kpis": [
            {"field": "accurate_passes_pct",      "weight": 0.35, "label": "Pass %"},
            {"field": "recoveries_p90",            "weight": 0.25, "label": "Recoveries/90"},
            {"field": "interceptions_p90",         "weight": 0.20, "label": "Interceptions/90"},
            {"field": "tackles_p90",               "weight": 0.20, "label": "Tackles/90"},
        ],
    },
    "aerial_cb": {
        "label": "Aerial CB",
        "base_position": "DEF",
        "kpis": [
            {"field": "aerial_won_p90",            "weight": 0.50, "label": "Aerial Won/90"},
            {"field": "tackles_p90",               "weight": 0.25, "label": "Tackles/90"},
            {"field": "interceptions_p90",         "weight": 0.25, "label": "Interceptions/90"},
        ],
    },

    # ── Forwards ─────────────────────────────────────────────────────────────
    "false_nine": {
        "label": "False Nine",
        "base_position": "FWD",
        "kpis": [
            {"field": "xa_p90",                   "weight": 0.30, "label": "xA/90"},
            {"field": "key_passes_p90",            "weight": 0.25, "label": "KP/90"},
            {"field": "xg_p90",                   "weight": 0.25, "label": "xG/90"},
            {"field": "successful_dribbles_p90",   "weight": 0.20, "label": "Dribbles/90"},
        ],
    },
    "target_striker": {
        "label": "Target Striker",
        "base_position": "FWD",
        "kpis": [
            {"field": "xg_p90",                   "weight": 0.35, "label": "xG/90"},
            {"field": "goals_p90",                "weight": 0.30, "label": "Goals/90"},
            {"field": "aerial_won_p90",            "weight": 0.20, "label": "Aerial Won/90"},
            {"field": "shots_p90",                 "weight": 0.15, "label": "Shots/90"},
        ],
    },
}

# ---------------------------------------------------------------------------
# Shared helper: fetch player_scores data for a position group
# ---------------------------------------------------------------------------

def _fetch_position_data(
    position_group: str,
    min_minutes: int = 450,
    season: Optional[str] = None,
    team: Optional[str] = None,
) -> pd.DataFrame:
    """Fetch per-90 stats for all players in a position group from player_match_stats."""
    where_parts = []
    params: dict = {"min_minutes": min_minutes}

    if position_group == "MID":
        where_parts.append("p.position_group IN ('MID', 'WNG')")
    else:
        where_parts.append("p.position_group = :position_group")
        params["position_group"] = position_group

    start_date, end_date = get_season_dates(season)
    if start_date and end_date:
        where_parts.append("pms.match_date >= :start_date AND pms.match_date <= :end_date")
        params["start_date"] = start_date
        params["end_date"] = end_date

    if team:
        where_parts.append("p.current_team_name ILIKE :team")
        params["team"] = f"%{team}%"

    where_sql = " AND ".join(where_parts)

    sql = f"""
        SELECT
            p.player_id,
            p.name                      AS player_name,
            p.position_group,
            p.nationality,
            p.passport_countries,
            EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
            p.current_team_name         AS team_name,
            c.name                      AS league_name,
            ps.performance_score,
            ps.minutes_total            AS minutes,
            SUM(pms.minutes_played)     AS minutes_played,
            COALESCE(SUM(pms.xg), 0) / NULLIF(SUM(pms.minutes_played),0) * 90           AS xg_p90,
            COALESCE(SUM(pms.xa), 0) / NULLIF(SUM(pms.minutes_played),0) * 90           AS xa_p90,
            COALESCE(SUM(pms.goals), 0) / NULLIF(SUM(pms.minutes_played),0) * 90        AS goals_p90,
            COALESCE(SUM(pms.assists), 0) / NULLIF(SUM(pms.minutes_played),0) * 90      AS assists_p90,
            COALESCE(SUM(pms.shots), 0) / NULLIF(SUM(pms.minutes_played),0) * 90        AS shots_p90,
            COALESCE(SUM(pms.key_passes), 0) / NULLIF(SUM(pms.minutes_played),0) * 90   AS key_passes_p90,
            COALESCE(SUM(pms.defensive_duels_won), 0) / NULLIF(SUM(pms.minutes_played),0) * 90  AS tackles_p90,
            COALESCE(SUM(pms.interceptions), 0) / NULLIF(SUM(pms.minutes_played),0) * 90         AS interceptions_p90,
            COALESCE(SUM(pms.aerial_duels_won), 0) / NULLIF(SUM(pms.minutes_played),0) * 90      AS aerial_won_p90,
            COALESCE(SUM(pms.dribbles_successful), 0) / NULLIF(SUM(pms.minutes_played),0) * 90   AS successful_dribbles_p90,
            COALESCE(SUM(pms.recoveries), 0) / NULLIF(SUM(pms.minutes_played),0) * 90            AS recoveries_p90,
            AVG(pms.passes_accurate::float / NULLIF(pms.passes, 0) * 100)               AS accurate_passes_pct
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        JOIN (
            SELECT DISTINCT ON (player_id) player_id, competition_id, performance_score, minutes_total
            FROM player_scores
            ORDER BY player_id, performance_score DESC NULLS LAST
        ) ps ON ps.player_id = p.player_id
        JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE {where_sql}
        GROUP BY p.player_id, p.name, p.position_group, p.nationality, p.passport_countries, p.date_of_birth,
                 p.current_team_name, c.name, ps.performance_score, ps.minutes_total
        HAVING SUM(pms.minutes_played) >= :min_minutes
    """
    df = run_query(sql, params)
    if not df.empty:
        df["nationality"] = df.apply(
            lambda r: format_nationality(r["nationality"], r.get("passport_countries", "")),
            axis=1
        )
    return df


def compute_profile_scores(df: pd.DataFrame, profile_key: str) -> pd.Series:
    """
    Compute a 0-100 profile score for each row in df using min-max
    normalisation of each KPI, then a weighted sum.

    Returns a Series with the same index as df.
    """
    if df.empty:
        return pd.Series(dtype=float)

    profile = POSITIONAL_PROFILES[profile_key]
    kpis = profile["kpis"]

    weighted_sum = pd.Series(0.0, index=df.index)
    total_weight = 0.0

    for kpi in kpis:
        field = kpi["field"]
        weight = kpi["weight"]

        if field not in df.columns:
            continue

        col = pd.to_numeric(df[field], errors="coerce")
        col_min = col.min()
        col_max = col.max()

        if col_max == col_min or pd.isna(col_max):
            # All same → give everyone 50
            normalised = pd.Series(0.5, index=df.index)
        else:
            normalised = (col - col_min) / (col_max - col_min)

        weighted_sum += normalised * weight
        total_weight += weight

    if total_weight == 0:
        return pd.Series(50.0, index=df.index)

    # Scale to 0-100
    raw = weighted_sum / total_weight
    return (raw * 100).round(1)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/")
def list_profiles():
    """List all available positional sub-profiles."""
    return [
        {
            "profile_key": key,
            "label": val["label"],
            "base_position": val["base_position"],
            "kpis": val["kpis"],
        }
        for key, val in POSITIONAL_PROFILES.items()
    ]


@router.get("/{profile_key}/players")
def get_profile_players(
    profile_key: str,
    min_score: float = Query(default=50.0, ge=0, le=100),
    min_minutes: int = Query(default=450, ge=0),
    league: Optional[str] = Query(default=None),
    season: Optional[str] = Query(default=None),
    team: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    min_age: Optional[int] = Query(default=None),
    max_age: Optional[int] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
):
    """
    Return players ranked by their profile score for a given sub-profile.
    Profile score is computed via min-max normalisation of KPI fields,
    weighted by the profile definition.
    """
    if profile_key not in POSITIONAL_PROFILES:
        raise HTTPException(status_code=404, detail=f"Profile '{profile_key}' not found")

    profile = POSITIONAL_PROFILES[profile_key]
    base_pos = profile["base_position"]

    df = _fetch_position_data(base_pos, min_minutes=min_minutes, season=season, team=team)
    if df.empty:
        return {"profile_key": profile_key, "label": profile["label"], "players": []}

    # Optional league filter
    if league:
        df = df[df["league_name"].str.lower() == league.lower()]

    if df.empty:
        return {"profile_key": profile_key, "label": profile["label"], "players": []}

    df = df.copy()
    df["profile_score"] = compute_profile_scores(df, profile_key)

    # Filter by min_score
    df = df[df["profile_score"] >= min_score]

    # Text filter (q)
    if q and not df.empty:
        df = df[df["player_name"].str.contains(q, case=False, na=False)]

    # Age filters
    if min_age is not None and not df.empty:
        df = df[df["age"] >= min_age]
    if max_age is not None and not df.empty:
        df = df[df["age"] <= max_age]

    if df.empty:
        return {"profile_key": profile_key, "label": profile["label"], "players": []}

    # Sort and limit
    df = df.sort_values("profile_score", ascending=False).head(limit).reset_index(drop=True)

    # Build KPI value dict per player
    kpis = profile["kpis"]

    def _kpi_values(row):
        return {
            kpi["label"]: (
                round(float(row[kpi["field"]]), 2)
                if kpi["field"] in row and pd.notna(row[kpi["field"]])
                else None
            )
            for kpi in kpis
        }

    records = []
    for _, row in df.iterrows():
        records.append({
            "rank": len(records) + 1,
            "player_id": int(row["player_id"]),
            "player_name": str(row["player_name"]),
            "nationality": str(row.get("nationality") or ""),
            "age": int(row["age"]) if pd.notna(row.get("age")) else None,
            "team_name": str(row["team_name"]),
            "league_name": str(row["league_name"]),
            "profile_score": float(row["profile_score"]),
            "performance_score": (
                round(float(row["performance_score"]), 1)
                if pd.notna(row.get("performance_score"))
                else None
            ),
            "minutes": int(row["minutes"]) if pd.notna(row.get("minutes")) else None,
            "kpi_values": _kpi_values(row),
        })

    return {
        "profile_key": profile_key,
        "label": profile["label"],
        "base_position": base_pos,
        "kpis": kpis,
        "total": len(records),
        "players": records,
    }
