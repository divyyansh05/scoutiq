from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os

router = APIRouter(prefix="/api/lists", tags=["lists"])

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "lists.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS scouting_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS list_players (
            list_id INTEGER NOT NULL,
            player_id INTEGER NOT NULL,
            player_name TEXT,
            team_name TEXT,
            position TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (list_id, player_id),
            FOREIGN KEY (list_id) REFERENCES scouting_lists(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()


init_db()


class ListCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PlayerAdd(BaseModel):
    player_id: int
    player_name: Optional[str] = None
    team_name: Optional[str] = None
    position: Optional[str] = None


@router.get("/")
def get_lists():
    conn = get_db()
    rows = conn.execute("""
        SELECT sl.*, COUNT(lp.player_id) AS player_count
        FROM scouting_lists sl
        LEFT JOIN list_players lp ON sl.id = lp.list_id
        GROUP BY sl.id
        ORDER BY sl.created_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/")
def create_list(body: ListCreate):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO scouting_lists (name, description) VALUES (?, ?)",
        (body.name, body.description)
    )
    list_id = cur.lastrowid
    conn.commit()
    row = conn.execute("SELECT * FROM scouting_lists WHERE id = ?", (list_id,)).fetchone()
    conn.close()
    return dict(row)


@router.delete("/{list_id}")
def delete_list(list_id: int):
    conn = get_db()
    conn.execute("DELETE FROM scouting_lists WHERE id = ?", (list_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.get("/{list_id}/players")
def get_list_players(list_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM list_players WHERE list_id = ? ORDER BY added_at DESC",
        (list_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/{list_id}/players")
def add_player_to_list(list_id: int, body: PlayerAdd):
    conn = get_db()
    # Check list exists
    lst = conn.execute("SELECT id FROM scouting_lists WHERE id = ?", (list_id,)).fetchone()
    if not lst:
        conn.close()
        raise HTTPException(status_code=404, detail="List not found")

    # Upsert player
    conn.execute("""
        INSERT OR REPLACE INTO list_players (list_id, player_id, player_name, team_name, position)
        VALUES (?, ?, ?, ?, ?)
    """, (list_id, body.player_id, body.player_name, body.team_name, body.position))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/{list_id}/players/{player_id}")
def remove_player_from_list(list_id: int, player_id: int):
    conn = get_db()
    conn.execute(
        "DELETE FROM list_players WHERE list_id = ? AND player_id = ?",
        (list_id, player_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}
