import json
import os
import sqlite3
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database.connection import run_query

router = APIRouter(prefix="/api/tactical", tags=["tactical"])

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "lists.db")

AVAILABLE_KPIS = {
    "xg_p90": "xG per 90",
    "xa_p90": "xA per 90",
    "goals_p90": "Goals per 90",
    "key_passes_p90": "Key Passes per 90",
    "shots_p90": "Shots per 90",
    "tackles_p90": "Tackles per 90",
    "interceptions_p90": "Interceptions per 90",
    "aerial_won_p90": "Aerial Duels Won per 90",
    "successful_dribbles_p90": "Dribbles per 90",
    "recoveries_p90": "Recoveries per 90",
    "accurate_passes_pct": "Pass Accuracy %",
}

DEFAULT_PRESETS = [
    {
        "name": "High Press",
        "description": "Intense pressing, win ball high up pitch",
        "tactical_style": "pressing",
        "kpi_weights": {"recoveries_p90": 30, "tackles_p90": 30, "interceptions_p90": 25, "xg_p90": 15},
    },
    {
        "name": "Possession",
        "description": "Patient build-up, high pass accuracy",
        "tactical_style": "possession",
        "kpi_weights": {"accurate_passes_pct": 35, "key_passes_p90": 30, "xa_p90": 20, "successful_dribbles_p90": 15},
    },
    {
        "name": "Counter Attack",
        "description": "Direct play, clinical finishing",
        "tactical_style": "counter",
        "kpi_weights": {"xg_p90": 35, "goals_p90": 30, "shots_p90": 20, "successful_dribbles_p90": 15},
    },
]

DEFAULT_PRESET_NAMES = {p["name"] for p in DEFAULT_PRESETS}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS manager_presets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            tactical_style TEXT,
            kpi_weights TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()

    count = conn.execute("SELECT COUNT(*) FROM manager_presets").fetchone()[0]
    if count == 0:
        for preset in DEFAULT_PRESETS:
            conn.execute(
                "INSERT INTO manager_presets (name, description, tactical_style, kpi_weights) VALUES (?, ?, ?, ?)",
                (preset["name"], preset["description"], preset["tactical_style"], json.dumps(preset["kpi_weights"])),
            )
        conn.commit()

    conn.close()


init_db()


def _validate_weights(kpi_weights: dict):
    for key in kpi_weights:
        if key not in AVAILABLE_KPIS:
            raise HTTPException(status_code=422, detail=f"Unknown KPI key: '{key}'. Allowed keys: {list(AVAILABLE_KPIS.keys())}")
    total = sum(kpi_weights.values())
    if abs(total - 100) > 1:
        raise HTTPException(status_code=422, detail=f"KPI weights must sum to 100 (±1). Current sum: {total}")


class PresetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tactical_style: Optional[str] = None
    kpi_weights: dict


class PresetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tactical_style: Optional[str] = None
    kpi_weights: Optional[dict] = None


@router.get("/presets")
def list_presets():
    conn = get_db()
    rows = conn.execute("SELECT * FROM manager_presets ORDER BY id ASC").fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["kpi_weights"] = json.loads(d["kpi_weights"])
        d["is_default"] = d["name"] in DEFAULT_PRESET_NAMES
        results.append(d)
    return results


@router.post("/presets", status_code=201)
def create_preset(body: PresetCreate):
    _validate_weights(body.kpi_weights)
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO manager_presets (name, description, tactical_style, kpi_weights) VALUES (?, ?, ?, ?)",
        (body.name, body.description, body.tactical_style, json.dumps(body.kpi_weights)),
    )
    preset_id = cur.lastrowid
    conn.commit()
    row = conn.execute("SELECT * FROM manager_presets WHERE id = ?", (preset_id,)).fetchone()
    conn.close()
    d = dict(row)
    d["kpi_weights"] = json.loads(d["kpi_weights"])
    d["is_default"] = False
    return d


@router.put("/presets/{preset_id}")
def update_preset(preset_id: int, body: PresetUpdate):
    conn = get_db()
    row = conn.execute("SELECT * FROM manager_presets WHERE id = ?", (preset_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Preset not found")

    current = dict(row)
    new_name = body.name if body.name is not None else current["name"]
    new_desc = body.description if body.description is not None else current["description"]
    new_style = body.tactical_style if body.tactical_style is not None else current["tactical_style"]

    if body.kpi_weights is not None:
        _validate_weights(body.kpi_weights)
        new_weights = json.dumps(body.kpi_weights)
    else:
        new_weights = current["kpi_weights"]

    conn.execute(
        """UPDATE manager_presets
           SET name=?, description=?, tactical_style=?, kpi_weights=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?""",
        (new_name, new_desc, new_style, new_weights, preset_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM manager_presets WHERE id = ?", (preset_id,)).fetchone()
    conn.close()
    d = dict(row)
    d["kpi_weights"] = json.loads(d["kpi_weights"])
    d["is_default"] = d["name"] in DEFAULT_PRESET_NAMES
    return d


@router.delete("/presets/{preset_id}")
def delete_preset(preset_id: int):
    conn = get_db()
    row = conn.execute("SELECT name FROM manager_presets WHERE id = ?", (preset_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Preset not found")
    if row["name"] in DEFAULT_PRESET_NAMES:
        conn.close()
        raise HTTPException(status_code=403, detail="Cannot delete built-in default presets")
    conn.execute("DELETE FROM manager_presets WHERE id = ?", (preset_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.get("/presets/{preset_id}/fit/{player_id}")
def get_tactical_fit(preset_id: int, player_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM manager_presets WHERE id = ?", (preset_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Preset not found")

    preset = dict(row)
    kpi_weights = json.loads(preset["kpi_weights"])

    # Aggregate per-90 stats from player_match_stats for the player's best competition
    player_sql = """
        WITH best_comp AS (
            SELECT competition_id FROM player_scores
            WHERE player_id = :player_id
            ORDER BY performance_score DESC NULLS LAST LIMIT 1
        )
        SELECT
            p.name AS player_name,
            p.position_group,
            SUM(pms.minutes_played)                                        AS minutes,
            COALESCE(SUM(pms.xg), 0) / NULLIF(SUM(pms.minutes_played),0) * 90          AS xg_p90,
            COALESCE(SUM(pms.xa), 0) / NULLIF(SUM(pms.minutes_played),0) * 90          AS xa_p90,
            COALESCE(SUM(pms.goals), 0) / NULLIF(SUM(pms.minutes_played),0) * 90       AS goals_p90,
            COALESCE(SUM(pms.shots), 0) / NULLIF(SUM(pms.minutes_played),0) * 90       AS shots_p90,
            COALESCE(SUM(pms.key_passes), 0) / NULLIF(SUM(pms.minutes_played),0) * 90  AS key_passes_p90,
            COALESCE(SUM(pms.defensive_duels_won), 0) / NULLIF(SUM(pms.minutes_played),0) * 90  AS tackles_p90,
            COALESCE(SUM(pms.interceptions), 0) / NULLIF(SUM(pms.minutes_played),0) * 90        AS interceptions_p90,
            COALESCE(SUM(pms.aerial_duels_won), 0) / NULLIF(SUM(pms.minutes_played),0) * 90     AS aerial_won_p90,
            COALESCE(SUM(pms.dribbles_successful), 0) / NULLIF(SUM(pms.minutes_played),0) * 90  AS successful_dribbles_p90,
            COALESCE(SUM(pms.recoveries), 0) / NULLIF(SUM(pms.minutes_played),0) * 90           AS recoveries_p90,
            AVG(pms.passes_accurate::float / NULLIF(pms.passes, 0) * 100) AS accurate_passes_pct
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        JOIN competitions c ON c.name = pms.competition_name
        WHERE pms.player_id = :player_id
          AND c.competition_id = (SELECT competition_id FROM best_comp)
        GROUP BY p.name, p.position_group
    """
    player_df = run_query(player_sql, {"player_id": player_id})
    if player_df.empty:
        raise HTTPException(status_code=404, detail="Player not found or no stats")

    player_row = player_df.iloc[0]
    position_group = str(player_row["position_group"] or "MID")
    player_name = str(player_row["player_name"])

    # Cohort: same position, aggregate per-90 from player_match_stats
    cohort_sql = """
        SELECT
            p.player_id,
            SUM(pms.minutes_played) AS minutes,
            COALESCE(SUM(pms.xg), 0) / NULLIF(SUM(pms.minutes_played),0) * 90          AS xg_p90,
            COALESCE(SUM(pms.xa), 0) / NULLIF(SUM(pms.minutes_played),0) * 90          AS xa_p90,
            COALESCE(SUM(pms.goals), 0) / NULLIF(SUM(pms.minutes_played),0) * 90       AS goals_p90,
            COALESCE(SUM(pms.shots), 0) / NULLIF(SUM(pms.minutes_played),0) * 90       AS shots_p90,
            COALESCE(SUM(pms.key_passes), 0) / NULLIF(SUM(pms.minutes_played),0) * 90  AS key_passes_p90,
            COALESCE(SUM(pms.defensive_duels_won), 0) / NULLIF(SUM(pms.minutes_played),0) * 90  AS tackles_p90,
            COALESCE(SUM(pms.interceptions), 0) / NULLIF(SUM(pms.minutes_played),0) * 90        AS interceptions_p90,
            COALESCE(SUM(pms.aerial_duels_won), 0) / NULLIF(SUM(pms.minutes_played),0) * 90     AS aerial_won_p90,
            COALESCE(SUM(pms.dribbles_successful), 0) / NULLIF(SUM(pms.minutes_played),0) * 90  AS successful_dribbles_p90,
            COALESCE(SUM(pms.recoveries), 0) / NULLIF(SUM(pms.minutes_played),0) * 90           AS recoveries_p90,
            AVG(pms.passes_accurate::float / NULLIF(pms.passes, 0) * 100) AS accurate_passes_pct
        FROM player_match_stats pms
        JOIN players p ON p.player_id = pms.player_id
        WHERE p.position_group = :position_group
        GROUP BY p.player_id
        HAVING SUM(pms.minutes_played) >= 450
    """
    cohort_df = run_query(cohort_sql, {"position_group": position_group})
    if cohort_df.empty:
        raise HTTPException(status_code=500, detail="No cohort data for percentile calculation")

    for col in cohort_df.columns:
        if col != "player_id":
            cohort_df[col] = pd.to_numeric(cohort_df[col], errors="coerce")

    percentile_cols = [k for k in kpi_weights if k in cohort_df.columns]
    for col in percentile_cols:
        cohort_df[f"{col}_pct"] = cohort_df[col].rank(pct=True, na_option="bottom") * 100

    player_cohort = cohort_df[cohort_df["player_id"] == player_id]

    breakdown = []
    weighted_sum = 0.0
    total_weight = 0.0

    for kpi, weight in kpi_weights.items():
        label = AVAILABLE_KPIS.get(kpi, kpi)
        raw_val = player_row.get(kpi)
        raw_val = float(raw_val) if raw_val is not None and not pd.isna(raw_val) else None

        if player_cohort.empty or f"{kpi}_pct" not in cohort_df.columns:
            percentile = 0.0
        else:
            pct_val = player_cohort.iloc[0].get(f"{kpi}_pct")
            percentile = float(pct_val) if pct_val is not None and not pd.isna(pct_val) else 0.0

        contribution = (percentile * weight) / 100.0
        weighted_sum += contribution
        total_weight += weight

        breakdown.append({
            "kpi": kpi,
            "label": label,
            "player_value": round(raw_val, 2) if raw_val is not None else None,
            "percentile": round(percentile, 1),
            "weight": weight,
            "contribution": round(contribution, 2),
        })

    tactical_fit_score = round(weighted_sum, 1) if total_weight > 0 else 0.0

    return {
        "preset_id": preset_id,
        "preset_name": preset["name"],
        "player_id": player_id,
        "player_name": player_name,
        "position_group": position_group,
        "tactical_fit_score": tactical_fit_score,
        "breakdown": breakdown,
    }
