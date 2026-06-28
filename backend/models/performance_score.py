"""
performance_score.py — Read pre-computed scores from player_scores table.
Replaces the old Python computation against player_season_stats.
"""

from __future__ import annotations

import pandas as pd
from typing import Optional

from database.connection import run_query
from config import score_label, format_nationality


def get_season_dates(season: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not season or season == "All Seasons":
        return None, None
    parts = season.strip().split('-')
    if len(parts) == 2:
        try:
            start_year = int(parts[0])
            end_year = 2000 + int(parts[1]) if len(parts[1]) == 2 else int(parts[1])
            return f"{start_year}-07-01", f"{end_year}-06-30"
        except ValueError:
            pass
    return None, None


def calculate_performance_scores(
    season: Optional[str] = None,
    league: Optional[str] = None,
    position_group: Optional[str] = None,
    min_minutes: int = 450,
    competition: Optional[str] = None,
) -> pd.DataFrame:
    """Read pre-computed scores from player_scores, keyed by competition."""
    comp_filter = competition or league
    start_date, end_date = get_season_dates(season)

    where = []
    params: dict = {}

    if comp_filter:
        where.append("c.name = :competition")
        params["competition"] = comp_filter

    if position_group and position_group.upper() in ("GK", "DEF", "MID", "FWD"):
        where.append("ps.position_group = :position_group")
        params["position_group"] = position_group.upper()

    if start_date and end_date:
        # Season filter active - we aggregate minutes/matches from player_match_stats for that season
        params["start_date"] = start_date
        params["end_date"] = end_date
        params["min_minutes"] = min_minutes
        where_sql = " AND ".join(where) if where else "1=1"

        sql = f"""
            WITH player_stats AS (
                SELECT
                    pms.player_id,
                    pms.competition_name,
                    SUM(pms.minutes_played) AS minutes_played,
                    COUNT(DISTINCT pms.id) AS matches_played
                FROM player_match_stats pms
                WHERE pms.match_date >= :start_date AND pms.match_date <= :end_date
                GROUP BY pms.player_id, pms.competition_name
            )
            SELECT DISTINCT ON (ps.player_id)
                p.player_id,
                p.name                   AS player_name,
                p.position_group,
                p.nationality,
                p.passport_countries,
                p.current_team_name      AS team_name,
                c.name                   AS competition_name,
                ps.performance_score     AS score,
                ps.percentile_rank       AS percentile,
                stats.minutes_played     AS minutes,
                ps.goals_p90,
                ps.xg_p90,
                ps.assists_p90,
                ps.xa_p90,
                stats.matches_played     AS matches
            FROM player_scores ps
            JOIN players p ON p.player_id = ps.player_id
            JOIN competitions c ON c.competition_id = ps.competition_id
            JOIN player_stats stats ON stats.player_id = ps.player_id AND stats.competition_name = c.name
            WHERE {where_sql} AND stats.minutes_played >= :min_minutes
            ORDER BY ps.player_id, ps.performance_score DESC NULLS LAST
        """
    else:
        # Standard fast path without season date filtering
        where.append("ps.minutes_total >= :min_minutes")
        params["min_minutes"] = min_minutes
        where_sql = " AND ".join(where)

        sql = f"""
            SELECT DISTINCT ON (ps.player_id)
                p.player_id,
                p.name                   AS player_name,
                p.position_group,
                p.nationality,
                p.passport_countries,
                p.current_team_name      AS team_name,
                c.name                   AS competition_name,
                ps.performance_score     AS score,
                ps.percentile_rank       AS percentile,
                ps.minutes_total         AS minutes,
                ps.goals_p90,
                ps.xg_p90,
                ps.assists_p90,
                ps.xa_p90,
                ps.matches_total         AS matches
            FROM player_scores ps
            JOIN players p ON p.player_id = ps.player_id
            JOIN competitions c ON c.competition_id = ps.competition_id
            WHERE {where_sql}
            ORDER BY ps.player_id, ps.performance_score DESC NULLS LAST
        """

    df = run_query(sql, params)
    if df.empty:
        return pd.DataFrame()

    df["score"] = pd.to_numeric(df["score"], errors="coerce")
    df["percentile"] = pd.to_numeric(df["percentile"], errors="coerce")
    df["score_label"] = df["score"].apply(
        lambda s: score_label(float(s)) if pd.notna(s) else "—"
    )
    df["nationality"] = df.apply(
        lambda r: format_nationality(r["nationality"], r.get("passport_countries", "")),
        axis=1
    )
    # Backward-compat aliases
    df["league_name"] = df["competition_name"]
    df["season_name"] = df["competition_name"]
    df["xg"] = df.get("xg_p90", 0)
    df["xa"] = df.get("xa_p90", 0)
    df["goals"] = df.get("goals_p90", 0)
    df["assists"] = df.get("assists_p90", 0)

    return df.sort_values("score", ascending=False)
