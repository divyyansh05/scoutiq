from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import math
import numpy as np

from database.connection import run_query
from models.performance_score import calculate_performance_scores
from models.similarity import get_similar_players
from config import POSITION_MAP, MIN_MINUTES, format_nationality

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


@router.get("/compare")
def compare_players(ids: str = Query(..., description="Comma separated list of player IDs")):
    player_ids = [int(pid) for pid in ids.split(",") if pid.strip().isdigit()]
    if not player_ids:
        raise HTTPException(status_code=400, detail="No valid player IDs provided")
    
    results = []
    for pid in player_ids[:4]: # Limit to 4 players for comparison
        try:
            player_data = get_player(player_id=pid)
            results.append(player_data)
        except HTTPException:
            continue
            
    return results


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
    team: Optional[str] = None,
):
    import pandas as pd

    df = calculate_performance_scores(
        season=season,
        competition=league,
        position_group=position if position and position.upper() in ["GK", "DEF", "MID", "FWD"] else None,
        min_minutes=min_minutes,
    )

    if team and not df.empty:
        df = df[df["team_name"].str.contains(team, case=False, na=False)]
    if df.empty:
        return {"players": [], "total": 0, "page": page, "pages": 0}

    # Merge player metadata (age, nationality, dob)
    meta_sql = """
        SELECT player_id, name AS player_name, nationality, date_of_birth,
               position_group, current_team_name AS team_name
        FROM players
    """
    meta = run_query(meta_sql, {})
    if not meta.empty:
        df = df.merge(meta[["player_id", "date_of_birth"]], on="player_id", how="left")
        df["age"] = pd.to_datetime(df["date_of_birth"], errors="coerce").apply(
            lambda d: (pd.Timestamp.now() - d).days // 365 if pd.notna(d) else 0
        )
    else:
        df["age"] = 0

    # Text filter
    if q:
        ql = q.lower()
        mask = (
            df["player_name"].str.lower().str.contains(ql, na=False) |
            df["team_name"].str.lower().str.contains(ql, na=False)
        )
        df = df[mask]

    # Age filters
    if min_age is not None:
        df = df[df["age"] >= min_age]
    if max_age is not None:
        df = df[df["age"] <= max_age]

    # WNG mapping
    if position and position.upper() == "WNG":
        df = df[df["position_group"] == "MID"]
    elif position and position.upper() in ["GK", "DEF", "MID", "FWD"]:
        df = df[df["position_group"] == position.upper()]

    df = df.rename(columns={"minutes": "minutes_played"})

    mins = df["minutes_played"].clip(lower=1)
    for src, dst in [("xg_p90", "xg_per90"), ("xa_p90", "xa_per90"),
                     ("goals_p90", "goals_per90"), ("assists_p90", "assists_per90")]:
        if src in df.columns:
            df[dst] = df[src]

    sort_col, sort_asc = SORT_COLS.get(sort, ("score", False))
    if sort_col in df.columns:
        df = df.sort_values(sort_col, ascending=sort_asc)

    total = len(df)
    pages = math.ceil(total / page_size) if page_size else 1
    start = (page - 1) * page_size
    page_df = df.iloc[start:start + page_size]

    return {"players": page_df.fillna(0).to_dict(orient="records"), "total": total, "page": page, "pages": pages}


@router.get("/{player_id}")
def get_player(
    player_id: int,
    season: Optional[str] = None,
):
    import pandas as pd

    player_sql = """
        SELECT player_id, name AS player_name, position_group, nationality,
               passport_countries,
               date_of_birth, current_team_name AS team_name,
               market_value_eur, contract_expires, height_cm, preferred_foot,
               sofascore_rating,
               EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER AS age
        FROM players
        WHERE player_id = :pid
    """
    p_df = run_query(player_sql, {"pid": player_id})
    if p_df.empty:
        raise HTTPException(status_code=404, detail="Player not found")

    row = p_df.iloc[0].to_dict()
    row["age"] = int(row.get("age") or 0)
    row["position_group"] = str(row.get("position_group") or "MID")
    row["position"] = row["position_group"]
    row["rating"] = float(row.pop("sofascore_rating") or 0)
    row["nationality"] = format_nationality(row.get("nationality", ""), row.get("passport_countries", ""))

    # Best score entry for this player from player_scores
    score_sql = """
        SELECT ps.performance_score AS score, ps.percentile_rank AS percentile,
               ps.minutes_total AS minutes, ps.goals_p90, ps.assists_p90,
               ps.xg_p90, ps.xa_p90, c.name AS competition_name
        FROM player_scores ps
        JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE ps.player_id = :pid
        ORDER BY ps.performance_score DESC NULLS LAST
        LIMIT 1
    """
    score_df = run_query(score_sql, {"pid": player_id})

    if score_df.empty:
        # No score data — still return player identity
        best_competition = season or ""
        row.update({
            "score": None, "percentile": None, "score_label": "—",
            "league_name": "—", "season_name": "—", "minutes_played": 0,
            "goals_p90": None, "assists_p90": None, "xg_p90": None, "xa_p90": None,
            "goals_per90": None, "assists_per90": None, "xg_per90": None, "xa_per90": None,
        })
    else:
        from config import score_label
        best = score_df.iloc[0]
        best_competition = str(best.get("competition_name") or "")
        row["score"] = float(best["score"]) if best["score"] is not None else None
        row["percentile"] = float(best["percentile"]) if best["percentile"] is not None else None
        row["score_label"] = score_label(float(best["score"])) if best["score"] is not None else "—"
        row["league_name"] = best_competition
        row["season_name"] = best_competition
        row["minutes_played"] = int(best.get("minutes") or 0)
        for col, alias in [("goals_p90", "goals_per90"), ("assists_p90", "assists_per90"),
                           ("xg_p90", "xg_per90"), ("xa_p90", "xa_per90")]:
            val = best.get(col)
            fval = float(val) if val is not None else None
            row[col] = fval
            row[alias] = fval

    # Aggregate raw stats from player_match_stats for the best competition
    comp_filter_sql = "AND pms.competition_name = :competition" if best_competition else ""
    agg_sql = f"""
        SELECT
            SUM(pms.minutes_played)          AS minutes_total,
            SUM(pms.goals)                   AS goals,
            SUM(pms.assists)                 AS assists,
            SUM(pms.shots)                   AS shots,
            SUM(pms.shots_on_target)         AS shots_on_target,
            COALESCE(SUM(pms.xg), 0)         AS xg,
            COALESCE(SUM(pms.xa), 0)         AS xa,
            COALESCE(SUM(pms.npxg), 0)       AS npxg,
            SUM(pms.key_passes)              AS key_passes,
            SUM(pms.dribbles_successful)     AS successful_dribbles,
            SUM(pms.aerial_duels_won)        AS aerials_won,
            SUM(pms.aerial_duels)            AS aerials_total,
            SUM(pms.defensive_duels_won)     AS tackles_won,
            SUM(pms.defensive_duels)         AS tackles_total,
            SUM(pms.interceptions)           AS interceptions,
            SUM(pms.clearances)              AS clearances,
            SUM(pms.recoveries)              AS recoveries,
            SUM(pms.duels_won)               AS duels_won,
            SUM(pms.duels)                   AS duels_total,
            SUM(pms.losses)                  AS dispossessed,
            SUM(pms.gk_saves)                AS saves,
            SUM(pms.fouls_suffered)          AS fouls_won,
            SUM(pms.fouls_committed)         AS fouls_committed,
            AVG(pms.passes_accurate::float / NULLIF(pms.passes, 0) * 100) AS accurate_passes_pct,
            SUM(pms.passes_final_third_acc)  AS accurate_final_third,
            SUM(pms.long_passes_accurate)    AS accurate_long_balls,
            SUM(pms.touches_in_box)          AS touches_in_box,
            SUM(pms.progressive_runs)        AS progressive_runs
        FROM player_match_stats pms
        WHERE pms.player_id = :pid
        {comp_filter_sql}
    """
    agg_params: dict = {"pid": player_id}
    if best_competition:
        agg_params["competition"] = best_competition
    agg_df = run_query(agg_sql, agg_params)

    if not agg_df.empty:
        agg = agg_df.iloc[0].to_dict()
        mins = max(float(agg.get("minutes_total") or row.get("minutes_played") or 1), 1)

        def _raw(k):
            v = agg.get(k)
            return float(v) if v is not None else None

        def _p90(k):
            v = _raw(k)
            return round(v / mins * 90, 3) if v is not None else None

        row["goals"] = _raw("goals")
        row["assists"] = _raw("assists")
        row["shots"] = _raw("shots")
        row["shots_on_target"] = _raw("shots_on_target")
        row["xg"] = round(_raw("xg") or 0, 3)
        row["xa"] = round(_raw("xa") or 0, 3)
        row["npxg"] = round(_raw("npxg") or 0, 3)
        row["key_passes"] = _raw("key_passes")
        row["successful_dribbles"] = _raw("successful_dribbles")
        row["aerials_won"] = _raw("aerials_won")
        at = _raw("aerials_total")
        aw = _raw("aerials_won")
        row["aerial_win_pct"] = round(aw / at * 100, 1) if at and at > 0 else None
        row["aerial_duels_lost"] = round(at - aw, 0) if at is not None and aw is not None else None
        row["tackles_won"] = _raw("tackles_won")
        tt = _raw("tackles_total")
        tw = _raw("tackles_won")
        row["tackles_won_pct"] = round(tw / tt * 100, 1) if tt and tt > 0 else None
        row["interceptions"] = _raw("interceptions")
        row["clearances"] = _raw("clearances")
        row["recoveries"] = _raw("recoveries")
        row["duels_won"] = _raw("duels_won")
        dt = _raw("duels_total")
        dw = _raw("duels_won")
        row["duels_won_pct"] = round(dw / dt * 100, 1) if dt and dt > 0 else None
        row["dispossessed"] = _raw("dispossessed")
        row["dribbled_past"] = None
        row["ground_duels_won"] = None
        row["ground_duels_won_pct"] = None
        row["saves"] = _raw("saves")
        row["fouls_won"] = _raw("fouls_won")
        row["fouls_committed"] = _raw("fouls_committed")
        row["accurate_passes_pct"] = round(_raw("accurate_passes_pct") or 0, 1)
        row["accurate_final_third"] = _raw("accurate_final_third")
        row["accurate_long_balls"] = _raw("accurate_long_balls")
        row["touches"] = _raw("touches_in_box")
        row["possession_won_att_third"] = _raw("progressive_runs")
        row["big_chances_created"] = None
        row["big_chances_missed"] = None
        row["shots_inside_box"] = None
        row["shots_outside_box"] = None
        row["error_lead_to_goal"] = None

        # Per-90 from raw aggregates (overrides player_scores p90 for completeness)
        if not row.get("goals_per90"):
            row["goals_per90"] = _p90("goals")
            row["goals_p90"] = row["goals_per90"]
        if not row.get("assists_per90"):
            row["assists_per90"] = _p90("assists")
            row["assists_p90"] = row["assists_per90"]
        row["shots_per90"] = _p90("shots")
        row["key_passes_per90"] = _p90("key_passes")
        row["dribbles_per90"] = _p90("successful_dribbles")
        row["aerials_per90"] = _p90("aerials_won")
        row["tackles_per90"] = _p90("tackles_won")
        row["interceptions_per90"] = _p90("interceptions")
        row["recoveries_per90"] = _p90("recoveries")
        row["saves_per90"] = _p90("saves")
        row["pass_accuracy"] = row["accurate_passes_pct"]

    return row


@router.get("/{player_id}/seasons")
def get_player_seasons(player_id: int):
    sql = """
        SELECT DISTINCT c.name AS season_name, c.competition_id AS season_id
        FROM player_scores ps
        JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE ps.player_id = :player_id
        ORDER BY c.name DESC
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
    import pandas as pd

    # Get position + best competition of the target player
    pos_df = run_query("""
        SELECT p.position_group, c.name AS competition_name
        FROM players p
        LEFT JOIN (
            SELECT DISTINCT ON (player_id) player_id, competition_id
            FROM player_scores ORDER BY player_id, performance_score DESC NULLS LAST
        ) ps ON ps.player_id = p.player_id
        LEFT JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE p.player_id = :pid
    """, {"pid": player_id})
    if pos_df.empty:
        return []
    target_position = str(pos_df.iloc[0]["position_group"] or "MID")
    # Auto-detect competition for "same league" mode when not explicitly provided
    if not league:
        league = pos_df.iloc[0].get("competition_name") or None

    # Aggregate per-90 stats from player_match_stats for all players (same position)
    comp_filter = f"AND pms.competition_name = :competition" if league else ""
    agg_sql = f"""
        SELECT
            p.player_id,
            p.name AS player_name,
            p.position_group,
            p.current_team_name AS team_name,
            c.name AS competition_name,
            ps.performance_score,
            ps.percentile_rank,
            SUM(pms.minutes_played) AS minutes,
            COALESCE(SUM(pms.goals), 0)               AS goals,
            COALESCE(SUM(pms.assists), 0)             AS assists,
            COALESCE(SUM(pms.xg), 0)                  AS xg,
            COALESCE(SUM(pms.xa), 0)                  AS xa,
            COALESCE(SUM(pms.shots), 0)               AS shots,
            COALESCE(SUM(pms.key_passes), 0)          AS key_passes,
            COALESCE(SUM(pms.dribbles_successful), 0) AS dribbles,
            COALESCE(SUM(pms.aerial_duels_won), 0)    AS aerials_won,
            COALESCE(SUM(pms.defensive_duels_won), 0) AS tackles_won,
            COALESCE(SUM(pms.interceptions), 0)       AS interceptions,
            COALESCE(SUM(pms.recoveries), 0)          AS recoveries
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        JOIN (
            SELECT DISTINCT ON (player_id) player_id, competition_id, performance_score, percentile_rank
            FROM player_scores
            ORDER BY player_id, performance_score DESC NULLS LAST
        ) ps ON ps.player_id = p.player_id
        JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE p.position_group = :position_group
          {comp_filter}
        GROUP BY p.player_id, p.name, p.position_group, p.current_team_name,
                 c.name, ps.performance_score, ps.percentile_rank
        HAVING SUM(pms.minutes_played) >= 450
    """
    agg_params: dict = {"position_group": target_position}
    if league:
        agg_params["competition"] = league
    df = run_query(agg_sql, agg_params)

    if df.empty:
        return []

    for col in ["minutes", "goals", "assists", "xg", "xa", "shots",
                "key_passes", "dribbles", "aerials_won", "tackles_won",
                "interceptions", "recoveries"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    mins = df["minutes"].clip(lower=1)
    feature_cols = []
    for raw, feat in [("goals", "f_goals"), ("assists", "f_assists"), ("xg", "f_xg"),
                      ("xa", "f_xa"), ("shots", "f_shots"), ("key_passes", "f_kp"),
                      ("dribbles", "f_drb"), ("aerials_won", "f_aer"),
                      ("tackles_won", "f_tck"), ("interceptions", "f_int"),
                      ("recoveries", "f_rec")]:
        df[feat] = df[raw] / mins * 90
        feature_cols.append(feat)

    # Normalise features 0-1
    feat_df = df[feature_cols].copy()
    for c in feature_cols:
        mn, mx = feat_df[c].min(), feat_df[c].max()
        feat_df[c] = (feat_df[c] - mn) / (mx - mn + 1e-9)

    target_mask = df["player_id"] == player_id
    if not target_mask.any():
        return []

    target_vec = feat_df[target_mask].values[0]
    other_df = df[~target_mask].copy()
    other_feat = feat_df[~target_mask].values

    if len(other_df) == 0:
        return []

    dots = other_feat @ target_vec
    target_norm = float(np.linalg.norm(target_vec)) + 1e-9
    other_norms = np.linalg.norm(other_feat, axis=1) + 1e-9
    sims = dots / (target_norm * other_norms)
    other_df = other_df.copy()
    other_df["similarity"] = np.clip(sims * 100, 0, 100).round(1)
    other_df = other_df.nlargest(n, "similarity")

    result = []
    for _, r in other_df.iterrows():
        result.append({
            "player_id": int(r["player_id"]),
            "player_name": str(r["player_name"]),
            "team_name": str(r.get("team_name") or ""),
            "position_group": str(r.get("position_group") or ""),
            "competition_name": str(r.get("competition_name") or ""),
            "performance_score": float(r["performance_score"]) if r.get("performance_score") is not None else None,
            "percentile_rank": float(r["percentile_rank"]) if r.get("percentile_rank") is not None else None,
            "similarity": float(r["similarity"]),
        })
    return result


@router.get("/{player_id}/similar-global")
def get_similar_global(
    player_id: int,
    n: int = Query(10, ge=1, le=30),
    min_minutes: int = Query(450, ge=0, le=9000),
):
    """Cross-league similarity — same as /similar but ignores position filter."""
    import pandas as pd

    pos_df = run_query("SELECT position_group FROM players WHERE player_id = :pid", {"pid": player_id})
    if pos_df.empty:
        return []
    target_position = str(pos_df.iloc[0]["position_group"] or "MID")

    agg_sql = """
        SELECT
            p.player_id,
            p.name AS player_name,
            p.position_group,
            p.current_team_name AS team_name,
            c.name AS competition_name,
            ps.performance_score,
            ps.percentile_rank,
            SUM(pms.minutes_played) AS minutes,
            COALESCE(SUM(pms.goals), 0)               AS goals,
            COALESCE(SUM(pms.assists), 0)             AS assists,
            COALESCE(SUM(pms.xg), 0)                  AS xg,
            COALESCE(SUM(pms.xa), 0)                  AS xa,
            COALESCE(SUM(pms.shots), 0)               AS shots,
            COALESCE(SUM(pms.key_passes), 0)          AS key_passes,
            COALESCE(SUM(pms.dribbles_successful), 0) AS dribbles,
            COALESCE(SUM(pms.aerial_duels_won), 0)    AS aerials_won,
            COALESCE(SUM(pms.defensive_duels_won), 0) AS tackles_won,
            COALESCE(SUM(pms.interceptions), 0)       AS interceptions,
            COALESCE(SUM(pms.recoveries), 0)          AS recoveries
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        JOIN (
            SELECT DISTINCT ON (player_id) player_id, competition_id, performance_score, percentile_rank
            FROM player_scores
            ORDER BY player_id, performance_score DESC NULLS LAST
        ) ps ON ps.player_id = p.player_id
        JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE p.position_group = :position_group
        GROUP BY p.player_id, p.name, p.position_group, p.current_team_name,
                 c.name, ps.performance_score, ps.percentile_rank
        HAVING SUM(pms.minutes_played) >= :min_minutes
    """
    df = run_query(agg_sql, {"position_group": target_position, "min_minutes": min_minutes})

    if df.empty:
        return []

    for col in ["minutes", "goals", "assists", "xg", "xa", "shots",
                "key_passes", "dribbles", "aerials_won", "tackles_won",
                "interceptions", "recoveries"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    mins = df["minutes"].clip(lower=1)
    feature_cols = []
    for raw, feat in [("goals", "f_goals"), ("assists", "f_assists"), ("xg", "f_xg"),
                      ("xa", "f_xa"), ("shots", "f_shots"), ("key_passes", "f_kp"),
                      ("dribbles", "f_drb"), ("aerials_won", "f_aer"),
                      ("tackles_won", "f_tck"), ("interceptions", "f_int"),
                      ("recoveries", "f_rec")]:
        df[feat] = df[raw] / mins * 90
        feature_cols.append(feat)

    feat_df = df[feature_cols].copy()
    for c in feature_cols:
        mn, mx = feat_df[c].min(), feat_df[c].max()
        feat_df[c] = (feat_df[c] - mn) / (mx - mn + 1e-9)

    target_mask = df["player_id"] == player_id
    if not target_mask.any():
        return []

    target_vec = feat_df[target_mask].values[0]
    other_df = df[~target_mask].copy()
    other_feat = feat_df[~target_mask].values

    if len(other_df) == 0:
        return []

    dots = other_feat @ target_vec
    target_norm = float(np.linalg.norm(target_vec)) + 1e-9
    other_norms = np.linalg.norm(other_feat, axis=1) + 1e-9
    sims = dots / (target_norm * other_norms)
    other_df = other_df.copy()
    other_df["similarity"] = np.clip(sims * 100, 0, 100).round(1)
    other_df = other_df.nlargest(n, "similarity")

    result = []
    for _, r in other_df.iterrows():
        result.append({
            "player_id": int(r["player_id"]),
            "player_name": str(r["player_name"]),
            "team_name": str(r.get("team_name") or ""),
            "position_group": str(r.get("position_group") or ""),
            "competition_name": str(r.get("competition_name") or ""),
            "performance_score": float(r["performance_score"]) if r.get("performance_score") is not None else None,
            "percentile_rank": float(r["percentile_rank"]) if r.get("percentile_rank") is not None else None,
            "similarity": float(r["similarity"]),
        })
    return result


@router.get("/{player_id}/adaptability")
def player_adaptability(player_id: int, season: Optional[str] = None):
    return {"teams": []}
