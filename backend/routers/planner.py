"""
Squad Planner router — /api/planner
Persists squad plans in SQLite (lists.db), reads player data from PostgreSQL.
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database.connection import run_query

router = APIRouter(prefix="/api/planner", tags=["planner"])

# ── SQLite setup ─────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent.parent / "data" / "lists.db"


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_planner_tables():
    conn = get_db()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS squad_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT '2026-27 Squad Plan',
                team_id INTEGER,
                team_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS plan_players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                player_id INTEGER,
                player_name TEXT NOT NULL,
                position_group TEXT NOT NULL,
                age INTEGER,
                nationality TEXT,
                performance_score REAL,
                squad_role TEXT DEFAULT 'first_team',
                is_custom INTEGER DEFAULT 0,
                slot_index INTEGER DEFAULT 0,
                FOREIGN KEY (plan_id) REFERENCES squad_plans(id) ON DELETE CASCADE
            );
        """)
        conn.commit()
    finally:
        conn.close()


init_planner_tables()


# ── Pydantic models ───────────────────────────────────────────────────────────

class PlanCreate(BaseModel):
    name: Optional[str] = "2026-27 Squad Plan"
    team_id: Optional[int] = None
    team_name: Optional[str] = None


class PlayerAdd(BaseModel):
    player_id: Optional[int] = None
    player_name: str
    position_group: str
    age: Optional[int] = None
    nationality: Optional[str] = None
    performance_score: Optional[float] = None
    squad_role: Optional[str] = "first_team"
    is_custom: Optional[int] = 0


class SlotUpdate(BaseModel):
    position_group: Optional[str] = None
    squad_role: Optional[str] = None
    slot_index: Optional[int] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def row_to_dict(row):
    return dict(row)


def plan_with_players(plan_id: int, conn):
    plan = conn.execute("SELECT * FROM squad_plans WHERE id = ?", (plan_id,)).fetchone()
    if not plan:
        return None
    players = conn.execute(
        "SELECT * FROM plan_players WHERE plan_id = ? ORDER BY position_group, slot_index",
        (plan_id,)
    ).fetchall()
    result = row_to_dict(plan)
    result["players"] = [row_to_dict(p) for p in players]
    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/plans")
def list_plans():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM squad_plans ORDER BY updated_at DESC"
        ).fetchall()
        return [row_to_dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/plans", status_code=201)
def create_plan(body: PlanCreate):
    conn = get_db()
    try:
        cur = conn.execute(
            "INSERT INTO squad_plans (name, team_id, team_name) VALUES (?, ?, ?)",
            (body.name, body.team_id, body.team_name),
        )
        conn.commit()
        plan_id = cur.lastrowid
        plan = conn.execute("SELECT * FROM squad_plans WHERE id = ?", (plan_id,)).fetchone()
        return row_to_dict(plan)
    finally:
        conn.close()


@router.get("/plans/{plan_id}")
def get_plan(plan_id: int):
    conn = get_db()
    try:
        result = plan_with_players(plan_id, conn)
        if result is None:
            raise HTTPException(status_code=404, detail="Plan not found")
        return result
    finally:
        conn.close()


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int):
    conn = get_db()
    try:
        affected = conn.execute("DELETE FROM squad_plans WHERE id = ?", (plan_id,)).rowcount
        conn.commit()
        if affected == 0:
            raise HTTPException(status_code=404, detail="Plan not found")
    finally:
        conn.close()


@router.get("/plans/{plan_id}/players")
def get_plan_players(plan_id: int):
    conn = get_db()
    try:
        plan = conn.execute("SELECT id FROM squad_plans WHERE id = ?", (plan_id,)).fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        rows = conn.execute(
            "SELECT * FROM plan_players WHERE plan_id = ? ORDER BY position_group, slot_index",
            (plan_id,)
        ).fetchall()
        return [row_to_dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/plans/{plan_id}/players", status_code=201)
def add_player_to_plan(plan_id: int, body: PlayerAdd):
    conn = get_db()
    try:
        plan = conn.execute("SELECT id FROM squad_plans WHERE id = ?", (plan_id,)).fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")

        # Determine next slot_index for this position group
        row = conn.execute(
            "SELECT COALESCE(MAX(slot_index), -1) as mx FROM plan_players WHERE plan_id = ? AND position_group = ?",
            (plan_id, body.position_group)
        ).fetchone()
        next_slot = (row["mx"] + 1) if row else 0

        cur = conn.execute(
            """INSERT INTO plan_players
               (plan_id, player_id, player_name, position_group, age, nationality,
                performance_score, squad_role, is_custom, slot_index)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                plan_id,
                body.player_id,
                body.player_name,
                body.position_group,
                body.age,
                body.nationality,
                body.performance_score,
                body.squad_role or "first_team",
                body.is_custom or 0,
                next_slot,
            ),
        )
        conn.execute(
            "UPDATE squad_plans SET updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), plan_id),
        )
        conn.commit()
        slot = conn.execute("SELECT * FROM plan_players WHERE id = ?", (cur.lastrowid,)).fetchone()
        return row_to_dict(slot)
    finally:
        conn.close()


@router.patch("/plans/{plan_id}/players/{slot_id}")
def update_plan_slot(plan_id: int, slot_id: int, body: SlotUpdate):
    conn = get_db()
    try:
        slot = conn.execute(
            "SELECT id FROM plan_players WHERE id = ? AND plan_id = ?", (slot_id, plan_id)
        ).fetchone()
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")

        updates = []
        params = []
        if body.position_group is not None:
            updates.append("position_group = ?")
            params.append(body.position_group)
        if body.squad_role is not None:
            updates.append("squad_role = ?")
            params.append(body.squad_role)
        if body.slot_index is not None:
            updates.append("slot_index = ?")
            params.append(body.slot_index)

        if updates:
            params.extend([slot_id, plan_id])
            conn.execute(
                f"UPDATE plan_players SET {', '.join(updates)} WHERE id = ? AND plan_id = ?",
                params,
            )
            conn.execute(
                "UPDATE squad_plans SET updated_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), plan_id),
            )
            conn.commit()

        updated = conn.execute("SELECT * FROM plan_players WHERE id = ?", (slot_id,)).fetchone()
        return row_to_dict(updated)
    finally:
        conn.close()


@router.delete("/plans/{plan_id}/players/{slot_id}", status_code=204)
def remove_player_from_plan(plan_id: int, slot_id: int):
    conn = get_db()
    try:
        affected = conn.execute(
            "DELETE FROM plan_players WHERE id = ? AND plan_id = ?", (slot_id, plan_id)
        ).rowcount
        if affected == 0:
            raise HTTPException(status_code=404, detail="Slot not found")
        conn.execute(
            "UPDATE squad_plans SET updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), plan_id),
        )
        conn.commit()
    finally:
        conn.close()


@router.get("/teams/{team_id}/current-squad")
def get_current_squad(team_id: int):
    """Fetch a team's players from PostgreSQL for import into a plan."""
    # Look up team name from teams table
    team_sql = "SELECT name FROM teams WHERE team_id = :team_id"
    team_df = run_query(team_sql, {"team_id": team_id})
    if team_df.empty:
        return []
    team_name = str(team_df.iloc[0]["name"])

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
        sql = """
            WITH current_players AS (
                SELECT DISTINCT player_id
                FROM player_match_stats
                WHERE match_date >= '2025-07-01'
            )
            SELECT DISTINCT ON (p.player_id)
                p.player_id,
                p.name         AS player_name,
                p.position_group,
                p.nationality,
                p.passport_countries,
                EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER AS age,
                ps.performance_score,
                ps.percentile_rank,
                ps.minutes_total AS minutes
            FROM players p
            JOIN current_players cp ON cp.player_id = p.player_id
            LEFT JOIN player_scores ps ON ps.player_id = p.player_id
            WHERE p.current_team_name ILIKE :team_name
              AND (ps.minutes_total IS NULL OR ps.minutes_total >= 450)
            ORDER BY p.player_id, ps.performance_score DESC NULLS LAST
        """
    else:
        sql = """
            SELECT DISTINCT ON (p.player_id)
                p.player_id,
                p.name         AS player_name,
                p.position_group,
                p.nationality,
                p.passport_countries,
                EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER AS age,
                ps.performance_score,
                ps.percentile_rank,
                ps.minutes_total AS minutes
            FROM player_scores ps
            JOIN players p ON p.player_id = ps.player_id
            WHERE p.current_team_name ILIKE :team_name
              AND ps.minutes_total >= 450
            ORDER BY p.player_id, ps.performance_score DESC NULLS LAST
        """

    df = run_query(sql, {"team_name": f"%{team_name}%"})
    if df.empty:
        return []

    # Format nationality for dual citizenship
    import pandas as pd
    from config import format_nationality
    df["nationality"] = df.apply(
        lambda r: format_nationality(r["nationality"], r.get("passport_countries", "")),
        axis=1
    )
    
    # Sort by position group, then performance score desc
    df["performance_score"] = pd.to_numeric(df["performance_score"], errors="coerce").fillna(0)
    df = df.sort_values(["position_group", "performance_score"], ascending=[True, False])
    return df.to_dict(orient="records")
