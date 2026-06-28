import pandas as pd
from fastapi import APIRouter, HTTPException
from typing import Optional

from database.connection import run_query
from models.clustering import get_team_styles
from models.performance_score import calculate_performance_scores
from config import CHELSEA_TEAM_ID, format_nationality, MIN_MINUTES, POSITION_MAP

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
def chelsea_focus(season: Optional[str] = None):
    scores = calculate_performance_scores(min_minutes=0)
    top3 = []
    avg_score = 0.0
    squad_size = 0

    if not scores.empty:
        chelsea_scores = scores[scores["team_name"].str.contains("Chelsea", case=False, na=False)]
        if not chelsea_scores.empty:
            squad_size = len(chelsea_scores["player_id"].unique())
            top3 = (
                chelsea_scores.nlargest(3, "score")[
                    ["player_id", "player_name", "position_group", "score"]
                ].fillna(0).to_dict("records")
            )
            avg_score = round(float(chelsea_scores["score"].mean()), 1)

    return {"squad_size": squad_size, "avg_age": 0, "avg_score": avg_score, "top3": top3}


@router.get("/chelsea/full")
def chelsea_full(competition: Optional[str] = None):
    return _get_team_players_internal(CHELSEA_TEAM_ID, competition)


@router.get("")
def list_all_teams():
    # Return all teams from database with their primary domestic league (highest match count)
    sql = """
        WITH team_primary_league AS (
            SELECT 
                team_id,
                competition_name,
                ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY COUNT(*) DESC) as rn
            FROM team_match_stats
            GROUP BY team_id, competition_name
        )
        SELECT 
            t.team_id,
            t.name AS team_name,
            tpl.competition_name AS league_name
        FROM teams t
        LEFT JOIN team_primary_league tpl ON tpl.team_id = t.team_id AND tpl.rn = 1
        ORDER BY t.name ASC
    """
    df = run_query(sql, {})
    if df.empty:
        # Fallback to simple select from teams
        df = run_query("SELECT team_id, name AS team_name, '' AS league_name FROM teams", {})
    return df.fillna("").to_dict(orient="records")


@router.get("/{team_id}")
def get_team(team_id: int, competition: Optional[str] = None):
    team_sql = "SELECT team_id, name AS team_name FROM teams WHERE team_id = :team_id"
    team_df = run_query(team_sql, {"team_id": team_id})
    if team_df.empty:
        raise HTTPException(status_code=404, detail="Team not found")
    team_name = str(team_df.iloc[0]["team_name"])

    # Resolve primary competition if not provided
    if not competition:
        primary_comp_sql = """
            SELECT competition_name
            FROM team_match_stats
            WHERE team_id = :team_id
            GROUP BY competition_name
            ORDER BY COUNT(*) DESC
            LIMIT 1
        """
        comp_df = run_query(primary_comp_sql, {"team_id": team_id})
        competition = str(comp_df.iloc[0]["competition_name"]) if not comp_df.empty else ""

    players_data = _get_team_players_internal(team_id, competition)
    players_list = players_data.get("players", [])

    squad_size = len(players_list)
    avg_age = 0.0
    avg_score = 0.0
    avg_rating = 0.0

    if squad_size > 0:
        ages = [p["age"] for p in players_list if p.get("age")]
        scores = [p["score"] for p in players_list if p.get("score")]
        ratings = [p["rating"] for p in players_list if p.get("rating")]

        avg_age = round(sum(ages) / len(ages), 1) if ages else 0.0
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0

    # Aggregate team-level per-90 radar metrics from player_match_stats
    radar_sql = """
        SELECT
            ROUND(CAST(AVG(pms.passes_accurate::float / NULLIF(pms.passes, 0) * 100) AS numeric), 1) AS avg_pass_pct,
            ROUND(CAST(SUM(pms.key_passes)::numeric / NULLIF(SUM(pms.minutes_played), 0) * 90 AS numeric), 2) AS avg_key_passes,
            ROUND(CAST(SUM(pms.aerial_duels_won)::numeric / NULLIF(SUM(pms.minutes_played), 0) * 90 AS numeric), 2) AS avg_aerials,
            ROUND(CAST(SUM(pms.defensive_duels_won)::numeric / NULLIF(SUM(pms.minutes_played), 0) * 90 AS numeric), 2) AS avg_tackles,
            ROUND(CAST(SUM(pms.recoveries)::numeric / NULLIF(SUM(pms.minutes_played), 0) * 90 AS numeric), 2) AS avg_recoveries,
            ROUND(CAST(SUM(pms.xg)::numeric / NULLIF(SUM(pms.minutes_played), 0) * 90 AS numeric), 3) AS avg_xg,
            ROUND(CAST(SUM(pms.xa)::numeric / NULLIF(SUM(pms.minutes_played), 0) * 90 AS numeric), 3) AS avg_xa
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        WHERE p.current_team_name ILIKE :team_name
          AND pms.competition_name = :competition
    """
    radar_df = run_query(radar_sql, {"team_name": f"%{team_name}%", "competition": competition})
    radar = {}
    if not radar_df.empty:
        r = radar_df.iloc[0]
        for col in ["avg_pass_pct", "avg_key_passes", "avg_aerials", "avg_tackles",
                    "avg_recoveries", "avg_xg", "avg_xa"]:
            v = r.get(col)
            radar[col] = float(v) if v is not None else 0.0

    return {
        "team_id": team_id,
        "team_name": team_name,
        "squad_size": squad_size,
        "avg_age": avg_age,
        "avg_score": avg_score,
        "avg_rating": avg_rating,
        "league_name": competition,
        **radar,
    }


@router.get("/{team_id}/players")
def get_team_players(team_id: int, competition: Optional[str] = None):
    return _get_team_players_internal(team_id, competition)


@router.get("/{team_id}/priority-positions")
def get_priority_positions(team_id: int):
    team_sql = "SELECT name FROM teams WHERE team_id = :team_id"
    team_df = run_query(team_sql, {"team_id": team_id})
    if team_df.empty:
        raise HTTPException(status_code=404, detail="Team not found")
    team_name = str(team_df.iloc[0]["name"])

    # Find the team's primary competition name
    primary_comp_sql = """
        SELECT competition_name
        FROM team_match_stats
        WHERE team_id = :team_id
        GROUP BY competition_name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    """
    comp_df = run_query(primary_comp_sql, {"team_id": team_id})
    primary_comp = str(comp_df.iloc[0]["competition_name"]) if not comp_df.empty else "England. Premier League"

    # Get league average score per position group
    league_avg_sql = """
        SELECT ps.position_group, AVG(ps.performance_score)::float AS avg_score
        FROM player_scores ps
        JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE c.name = :competition
        GROUP BY ps.position_group
    """
    league_avg_df = run_query(league_avg_sql, {"competition": primary_comp})
    league_avgs = {r["position_group"]: round(r["avg_score"], 1) for _, r in league_avg_df.iterrows()} if not league_avg_df.empty else {}

    # Get squad players and their scores in the primary competition
    squad_scores_sql = """
        SELECT p.player_id, p.position_group, ps.performance_score
        FROM players p
        LEFT JOIN player_scores ps ON ps.player_id = p.player_id
        LEFT JOIN competitions c ON c.competition_id = ps.competition_id AND c.name = :competition
        WHERE p.current_team_name ILIKE :team_name
    """
    squad_df = run_query(squad_scores_sql, {"team_name": f"%{team_name}%", "competition": primary_comp})

    result = []
    for pos in ["GK", "DEF", "MID", "FWD"]:
        pos_df = squad_df[squad_df["position_group"] == pos] if not squad_df.empty else pd.DataFrame()
        squad_player_count = len(pos_df)
        
        # calculate average score of players who have scores
        valid_scores = pos_df["performance_score"].dropna() if not pos_df.empty else pd.Series()
        squad_avg_score = round(float(valid_scores.mean()), 1) if not valid_scores.empty else 0.0
        league_avg_score = league_avgs.get(pos, 50.0)

        gap_score = round(league_avg_score - squad_avg_score, 1)
        uplift_potential = round(90.0 - squad_avg_score, 1) if squad_avg_score < 90.0 else 0.0

        if squad_player_count == 0:
            justification = f"No active {pos}s currently registered. Signing a starting {pos} is a critical priority."
            gap_score = league_avg_score
            uplift_potential = league_avg_score
        else:
            justification = f"Squad average score of {squad_avg_score:.1f} is {abs(gap_score):.1f} points {'below' if gap_score > 0 else 'above'} league average ({league_avg_score:.1f})."
            if gap_score > 0:
                justification += f" Adding a top-tier {pos} is recommended to raise quality."
            else:
                justification += f" Position group shows solid performance levels relative to standard competition."

        result.append({
            "position_group": pos,
            "priority_rank": 0,
            "squad_avg_score": squad_avg_score,
            "league_avg_score": league_avg_score,
            "gap_score": gap_score,
            "uplift_potential": uplift_potential,
            "squad_player_count": squad_player_count,
            "justification": justification,
        })

    result.sort(key=lambda x: x["gap_score"], reverse=True)
    for idx, r in enumerate(result[:3]):
        r["priority_rank"] = idx + 1

    return result[:3]


@router.get("/{team_id}/squad-diagnostic")
def squad_diagnostic(team_id: int, competition: Optional[str] = None):
    """Position-by-position gap analysis for a team."""
    team_sql = "SELECT team_id, name AS team_name FROM teams WHERE team_id = :team_id"
    team_df = run_query(team_sql, {"team_id": team_id})
    if team_df.empty:
        raise HTTPException(status_code=404, detail="Team not found")
    team_name = str(team_df.iloc[0]["team_name"])

    # Resolve primary competition if not provided
    if not competition:
        primary_comp_sql = """
            SELECT competition_name
            FROM team_match_stats
            WHERE team_id = :team_id
            GROUP BY competition_name
            ORDER BY COUNT(*) DESC
            LIMIT 1
        """
        comp_df = run_query(primary_comp_sql, {"team_id": team_id})
        competition = str(comp_df.iloc[0]["competition_name"]) if not comp_df.empty else ""

    # All players for this team with their scores in this competition
    players_sql = """
        SELECT DISTINCT ON (p.player_id)
            p.player_id,
            p.name                      AS player_name,
            p.position_group,
            p.nationality,
            EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER AS age,
            ps.performance_score,
            ps.percentile_rank,
            ps.minutes_total AS minutes
        FROM players p
        LEFT JOIN player_scores ps ON ps.player_id = p.player_id
        LEFT JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE p.current_team_name ILIKE :team_name
        ORDER BY p.player_id,
                 (c.name = :competition) DESC,
                 ps.performance_score DESC NULLS LAST
    """
    df = run_query(players_sql, {"team_name": f"%{team_name}%", "competition": competition})
    if df.empty:
        return []

    df["age"] = pd.to_numeric(df["age"], errors="coerce").fillna(0).astype(int)
    df["performance_score"] = pd.to_numeric(df["performance_score"], errors="coerce")
    df["is_young"] = df["age"].between(16, 21)

    result = []
    for pos in ["GK", "DEF", "MID", "FWD"]:
        pos_df = df[df["position_group"] == pos]
        count = len(pos_df)
        avg_score = round(float(pos_df["performance_score"].mean()), 1) if not pos_df.empty and pos_df["performance_score"].notna().any() else None
        
        # Simple gap status
        min_ok = {"GK": 2, "DEF": 6, "MID": 6, "FWD": 3}.get(pos, 4)
        if count == 0:
            status = "Critical gap"
        elif count < min_ok or (avg_score is not None and avg_score < 40):
            status = "Thin"
        else:
            status = "Adequate"

        players_in_pos = []
        for _, r in pos_df.iterrows():
            players_in_pos.append({
                "player_id": int(r["player_id"]),
                "player_name": str(r["player_name"]),
                "age": int(r["age"]),
                "performance_score": round(float(r["performance_score"]), 1) if pd.notna(r.get("performance_score")) else None,
                "percentile_rank": round(float(r["percentile_rank"]), 1) if pd.notna(r.get("percentile_rank")) else None,
                "is_young": bool(r["is_young"]),
            })

        academy = [p for p in players_in_pos if p["is_young"]]
        for a in academy:
            if a.get("percentile_rank") is not None:
                if a["percentile_rank"] >= 75:
                    a["readiness"] = "Ready"
                elif a["percentile_rank"] >= 50:
                    a["readiness"] = "Close"
                else:
                    a["readiness"] = "Developing"
            else:
                a["readiness"] = "Developing"

        result.append({
            "position_group": pos,
            "player_count": count,
            "avg_score": avg_score,
            "status": status,
            "signing_needed": status == "Critical gap" or count == 0,
            "players": players_in_pos,
            "academy_candidates": academy,
        })

    return result


@router.get("/{team_id}/swot")
def get_team_swot(team_id: int):
    """Generate SWOT analysis from real squad + league data."""
    team_sql = "SELECT name FROM teams WHERE team_id = :team_id"
    team_df = run_query(team_sql, {"team_id": team_id})
    if team_df.empty:
        raise HTTPException(status_code=404, detail="Team not found")
    team_name = str(team_df.iloc[0]["name"])

    # Primary competition
    comp_sql = """
        SELECT competition_name FROM team_match_stats
        WHERE team_id = :team_id
        GROUP BY competition_name ORDER BY COUNT(*) DESC LIMIT 1
    """
    comp_df = run_query(comp_sql, {"team_id": team_id})
    competition = str(comp_df.iloc[0]["competition_name"]) if not comp_df.empty else ""

    # Team aggregate per-90 stats
    team_agg_sql = """
        SELECT
            ROUND(CAST(AVG(passes_accurate::float / NULLIF(passes, 0) * 100) AS numeric), 1) AS pass_pct,
            ROUND(CAST(SUM(key_passes)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 2) AS kp_p90,
            ROUND(CAST(SUM(aerial_duels_won)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 2) AS aerials_p90,
            ROUND(CAST(SUM(defensive_duels_won)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 2) AS tackles_p90,
            ROUND(CAST(SUM(recoveries)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 2) AS rec_p90,
            ROUND(CAST(SUM(xg)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 3) AS xg_p90,
            ROUND(CAST(SUM(xa)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 3) AS xa_p90,
            SUM(goals) AS total_goals
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        WHERE p.current_team_name ILIKE :team_name
          AND pms.competition_name = :competition
    """
    t_df = run_query(team_agg_sql, {"team_name": f"%{team_name}%", "competition": competition})

    # League average per-90 stats
    league_agg_sql = """
        SELECT
            ROUND(CAST(AVG(passes_accurate::float / NULLIF(passes, 0) * 100) AS numeric), 1) AS pass_pct,
            ROUND(CAST(SUM(key_passes)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 2) AS kp_p90,
            ROUND(CAST(SUM(aerial_duels_won)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 2) AS aerials_p90,
            ROUND(CAST(SUM(defensive_duels_won)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 2) AS tackles_p90,
            ROUND(CAST(SUM(recoveries)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 2) AS rec_p90,
            ROUND(CAST(SUM(xg)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 3) AS xg_p90,
            ROUND(CAST(SUM(xa)::numeric / NULLIF(SUM(minutes_played), 0) * 90 AS numeric), 3) AS xa_p90
        FROM player_match_stats
        WHERE competition_name = :competition
    """
    l_df = run_query(league_agg_sql, {"competition": competition})

    # Young high-performers (opportunities)
    young_sql = """
        SELECT p.name, EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
               ps.performance_score, ps.percentile_rank
        FROM players p
        JOIN (
            SELECT DISTINCT ON (player_id) player_id, performance_score, percentile_rank
            FROM player_scores ORDER BY player_id, performance_score DESC NULLS LAST
        ) ps ON ps.player_id = p.player_id
        WHERE p.current_team_name ILIKE :team_name
          AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) <= 23
          AND ps.percentile_rank >= 60
        ORDER BY ps.percentile_rank DESC LIMIT 4
    """
    young_df = run_query(young_sql, {"team_name": f"%{team_name}%"})

    # Aging key players (threats)
    aging_sql = """
        SELECT p.name, EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
               ps.performance_score, p.position_group
        FROM players p
        JOIN (
            SELECT DISTINCT ON (player_id) player_id, performance_score
            FROM player_scores ORDER BY player_id, performance_score DESC NULLS LAST
        ) ps ON ps.player_id = p.player_id
        WHERE p.current_team_name ILIKE :team_name
          AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= 27
        ORDER BY age DESC, ps.performance_score DESC NULLS LAST LIMIT 3
    """
    aging_df = run_query(aging_sql, {"team_name": f"%{team_name}%"})

    strengths, weaknesses, opportunities, threats = [], [], [], []

    if not t_df.empty and not l_df.empty:
        t = t_df.iloc[0]
        l = l_df.iloc[0]

        def sf(v): return float(v) if v is not None else 0.0
        def cmp(key, label, unit="", higher_fmt=None):
            tv, lv = sf(t.get(key)), sf(l.get(key))
            if tv == 0 and lv == 0:
                return
            diff_pct = ((tv - lv) / lv * 100) if lv else 0
            fmt_tv = f"{tv:.2f}{unit}" if not higher_fmt else higher_fmt(tv)
            fmt_lv = f"{lv:.2f}{unit}" if not higher_fmt else higher_fmt(lv)
            if diff_pct >= 5:
                strengths.append({"text": f"{label}: {fmt_tv} vs league avg {fmt_lv} (+{diff_pct:.0f}%)"})
            elif diff_pct <= -5:
                weaknesses.append({"text": f"{label}: {fmt_tv} vs league avg {fmt_lv} ({diff_pct:.0f}%)"})

        cmp("pass_pct", "Pass Accuracy", "%", lambda v: f"{v:.1f}%")
        cmp("kp_p90", "Key Passes/90")
        cmp("aerials_p90", "Aerial Duels Won/90")
        cmp("tackles_p90", "Tackles/90")
        cmp("rec_p90", "Recoveries/90")
        cmp("xg_p90", "xG/90")
        cmp("xa_p90", "xA/90")

    for _, row in young_df.iterrows():
        opportunities.append({
            "text": f"{row['name']} (age {int(row['age'])}) — {float(row['percentile_rank']):.0f}th percentile, score {float(row['performance_score']):.1f}. High-ceiling asset.",
            "percentile": int(row["percentile_rank"]),
        })

    for _, row in aging_df.iterrows():
        threats.append({
            "text": f"{row['name']} (age {int(row['age'])}, {row['position_group']}) — key performer approaching career decline window."
        })

    if not strengths:
        strengths.append({"text": "Insufficient competition data to identify clear statistical strengths."})
    if not weaknesses:
        weaknesses.append({"text": "Squad metrics broadly aligned with league average."})

    return {
        "team_id": team_id,
        "team_name": team_name,
        "competition": competition,
        "season": competition,
        "swot": {
            "strengths": strengths,
            "weaknesses": weaknesses,
            "opportunities": opportunities,
            "threats": threats,
        },
    }


def _get_team_players_internal(team_id: int, competition: Optional[str] = None):
    team_sql = "SELECT team_id, name AS team_name FROM teams WHERE team_id = :team_id"
    team_df = run_query(team_sql, {"team_id": team_id})
    if team_df.empty:
        return {"team_name": "Unknown", "league": "", "season": "", "players": []}
    team_name = str(team_df.iloc[0]["team_name"])

    # Resolve primary competition if not provided
    if not competition:
        primary_comp_sql = """
            SELECT competition_name
            FROM team_match_stats
            WHERE team_id = :team_id
            GROUP BY competition_name
            ORDER BY COUNT(*) DESC
            LIMIT 1
        """
        comp_df = run_query(primary_comp_sql, {"team_id": team_id})
        competition = str(comp_df.iloc[0]["competition_name"]) if not comp_df.empty else ""

    # Check if team has current season active players (with matches in 2025-26)
    check_sql = """
        SELECT COUNT(DISTINCT pms.player_id) AS cnt
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        WHERE p.current_team_name ILIKE :team_name AND pms.match_date >= '2025-07-01'
    """
    check_df = run_query(check_sql, {"team_name": f"%{team_name}%"})
    has_current = not check_df.empty and int(check_df.iloc[0]["cnt"]) > 0

    if has_current:
        players_sql = """
            WITH current_players AS (
                SELECT DISTINCT player_id
                FROM player_match_stats
                WHERE match_date >= '2025-07-01'
            )
            SELECT DISTINCT ON (p.player_id)
                p.player_id,
                p.name                      AS player_name,
                p.position_group,
                p.nationality,
                p.passport_countries,
                EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER AS age,
                p.current_team_name         AS team_name,
                c.name                      AS competition_name,
                ps.performance_score        AS score,
                ps.percentile_rank          AS percentile,
                ps.minutes_total            AS minutes,
                ps.goals_p90,
                ps.xg_p90,
                ps.assists_p90,
                ps.xa_p90,
                ps.matches_total            AS matches,
                p.sofascore_rating          AS rating,
                p.height_cm,
                p.preferred_foot,
                COALESCE(stats.goals, 0)    AS goals,
                COALESCE(stats.assists, 0)  AS assists,
                COALESCE(stats.xg, 0)       AS xg,
                COALESCE(stats.xa, 0)       AS xa,
                COALESCE(stats.aerials, 0)  AS aerials_won,
                COALESCE(stats.tackles, 0)  AS tackles_won
            FROM players p
            JOIN current_players cp ON cp.player_id = p.player_id
            LEFT JOIN player_scores ps ON ps.player_id = p.player_id
            LEFT JOIN competitions c ON c.competition_id = ps.competition_id
            LEFT JOIN (
                SELECT
                    pms.player_id,
                    pms.competition_name,
                    SUM(pms.goals) AS goals,
                    SUM(pms.assists) AS assists,
                    SUM(pms.xg) AS xg,
                    SUM(pms.xa) AS xa,
                    SUM(pms.aerial_duels_won) AS aerials,
                    SUM(pms.defensive_duels_won) AS tackles
                FROM player_match_stats pms
                WHERE pms.match_date >= '2025-07-01'
                GROUP BY pms.player_id, pms.competition_name
            ) stats ON stats.player_id = p.player_id AND stats.competition_name = c.name
            WHERE p.current_team_name ILIKE :team_name
            ORDER BY p.player_id,
                     (c.name = :competition) DESC,
                     ps.performance_score DESC NULLS LAST
        """
    else:
        players_sql = """
            SELECT DISTINCT ON (p.player_id)
                p.player_id,
                p.name                      AS player_name,
                p.position_group,
                p.nationality,
                p.passport_countries,
                EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER AS age,
                p.current_team_name         AS team_name,
                c.name                      AS competition_name,
                ps.performance_score        AS score,
                ps.percentile_rank          AS percentile,
                ps.minutes_total            AS minutes,
                ps.goals_p90,
                ps.xg_p90,
                ps.assists_p90,
                ps.xa_p90,
                ps.matches_total            AS matches,
                p.sofascore_rating          AS rating,
                p.height_cm,
                p.preferred_foot,
                COALESCE(stats.goals, 0)    AS goals,
                COALESCE(stats.assists, 0)  AS assists,
                COALESCE(stats.xg, 0)       AS xg,
                COALESCE(stats.xa, 0)       AS xa,
                COALESCE(stats.aerials, 0)  AS aerials_won,
                COALESCE(stats.tackles, 0)  AS tackles_won
            FROM players p
            LEFT JOIN player_scores ps ON ps.player_id = p.player_id
            LEFT JOIN competitions c ON c.competition_id = ps.competition_id
            LEFT JOIN (
                SELECT
                    pms.player_id,
                    pms.competition_name,
                    SUM(pms.goals) AS goals,
                    SUM(pms.assists) AS assists,
                    SUM(pms.xg) AS xg,
                    SUM(pms.xa) AS xa,
                    SUM(pms.aerial_duels_won) AS aerials,
                    SUM(pms.defensive_duels_won) AS tackles
                FROM player_match_stats pms
                GROUP BY pms.player_id, pms.competition_name
            ) stats ON stats.player_id = p.player_id AND stats.competition_name = c.name
            WHERE p.current_team_name ILIKE :team_name
            ORDER BY p.player_id,
                     (c.name = :competition) DESC,
                     ps.performance_score DESC NULLS LAST
        """

    df = run_query(players_sql, {"team_name": f"%{team_name}%", "competition": competition})
    if df.empty:
        return {"team_name": team_name, "league": competition or "", "season": "2025-26", "players": []}

    df["score"] = pd.to_numeric(df["score"], errors="coerce").fillna(0)
    df["percentile"] = pd.to_numeric(df["percentile"], errors="coerce").fillna(0)
    df["minutes"] = pd.to_numeric(df["minutes"], errors="coerce").fillna(0)
    df["age"] = pd.to_numeric(df["age"], errors="coerce").fillna(0)
    df["nationality"] = df.apply(
        lambda r: format_nationality(r["nationality"], r.get("passport_countries", "")),
        axis=1
    )

    # Sort players by score DESC
    df = df.sort_values("score", ascending=False)

    return {
        "team_name": team_name,
        "league": competition or "",
        "season": "2025-26",
        "players": df.fillna(0).to_dict("records"),
    }
