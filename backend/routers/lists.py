from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os

router = APIRouter(prefix="/api/lists", tags=["lists"])
notes_router = APIRouter(prefix="/api/notes", tags=["notes"])
searches_router = APIRouter(prefix="/api/searches", tags=["searches"])
recruitment_router = APIRouter(prefix="/api/recruitment", tags=["recruitment"])

VALID_STAGES = {"identified", "scouted", "shortlisted", "approached", "signed", "rejected"}

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
        CREATE TABLE IF NOT EXISTS player_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL UNIQUE,
            note_text TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS saved_searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            filters_json TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS recruitment_pipeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            player_name TEXT NOT NULL,
            team_name TEXT,
            league_name TEXT,
            position_group TEXT,
            age INTEGER,
            nationality TEXT,
            performance_score REAL,
            market_value_eur REAL,
            contract_expires TEXT,
            stage TEXT NOT NULL DEFAULT 'identified',
            notes TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id)
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


class NoteUpsert(BaseModel):
    note_text: str


class SearchSave(BaseModel):
    name: str
    description: Optional[str] = None
    filters_json: Optional[str] = None


# ── Scouting Lists ────────────────────────────────────────────────────────────

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
    lst = conn.execute("SELECT id FROM scouting_lists WHERE id = ?", (list_id,)).fetchone()
    if not lst:
        conn.close()
        raise HTTPException(status_code=404, detail="List not found")
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


# ── Player Notes ──────────────────────────────────────────────────────────────

@notes_router.get("/{player_id}")
def get_note(player_id: int):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM player_notes WHERE player_id = ?", (player_id,)
    ).fetchone()
    conn.close()
    if not row:
        return {"player_id": player_id, "note_text": "", "updated_at": None}
    return dict(row)


@notes_router.post("/{player_id}")
def upsert_note(player_id: int, body: NoteUpsert):
    conn = get_db()
    conn.execute("""
        INSERT INTO player_notes (player_id, note_text, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(player_id) DO UPDATE SET
            note_text = excluded.note_text,
            updated_at = datetime('now')
    """, (player_id, body.note_text))
    conn.commit()
    row = conn.execute("SELECT * FROM player_notes WHERE player_id = ?", (player_id,)).fetchone()
    conn.close()
    return dict(row)


# ── Saved Searches ────────────────────────────────────────────────────────────

@searches_router.get("/")
def get_saved_searches():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM saved_searches ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@searches_router.post("/")
def save_search(body: SearchSave):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO saved_searches (name, description, filters_json) VALUES (?, ?, ?)",
        (body.name, body.description, body.filters_json)
    )
    sid = cur.lastrowid
    conn.commit()
    row = conn.execute("SELECT * FROM saved_searches WHERE id = ?", (sid,)).fetchone()
    conn.close()
    return dict(row)


@searches_router.delete("/{search_id}")
def delete_saved_search(search_id: int):
    conn = get_db()
    conn.execute("DELETE FROM saved_searches WHERE id = ?", (search_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Recruitment Pipeline ───────────────────────────────────────────────────────

class RecruitmentAdd(BaseModel):
    player_id: int
    player_name: str
    team_name: Optional[str] = None
    league_name: Optional[str] = None
    position_group: Optional[str] = None
    age: Optional[int] = None
    nationality: Optional[str] = None
    performance_score: Optional[float] = None
    market_value_eur: Optional[float] = None
    contract_expires: Optional[str] = None
    stage: Optional[str] = "identified"


class RecruitmentStageUpdate(BaseModel):
    stage: str


class RecruitmentNotesUpdate(BaseModel):
    notes: str


@recruitment_router.get("/")
def get_recruitment_pipeline():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM recruitment_pipeline ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()

    result = {s: [] for s in ["identified", "scouted", "shortlisted", "approached", "signed", "rejected"]}
    for row in rows:
        entry = dict(row)
        stage = entry.get("stage", "identified")
        if stage in result:
            result[stage].append(entry)
    return result


@recruitment_router.post("/")
def add_to_recruitment(body: RecruitmentAdd):
    if body.stage and body.stage not in VALID_STAGES:
        raise HTTPException(status_code=422, detail=f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}")
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM recruitment_pipeline WHERE player_id = ?", (body.player_id,)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=409, detail="Player already in recruitment pipeline")
    cur = conn.execute("""
        INSERT INTO recruitment_pipeline
            (player_id, player_name, team_name, league_name, position_group, age,
             nationality, performance_score, market_value_eur, contract_expires, stage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        body.player_id, body.player_name, body.team_name, body.league_name,
        body.position_group, body.age, body.nationality, body.performance_score,
        body.market_value_eur, body.contract_expires, body.stage or "identified"
    ))
    row_id = cur.lastrowid
    conn.commit()
    row = conn.execute("SELECT * FROM recruitment_pipeline WHERE id = ?", (row_id,)).fetchone()
    conn.close()
    return dict(row)


@recruitment_router.patch("/{entry_id}/stage")
def move_recruitment_stage(entry_id: int, body: RecruitmentStageUpdate):
    if body.stage not in VALID_STAGES:
        raise HTTPException(status_code=422, detail=f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}")
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM recruitment_pipeline WHERE id = ?", (entry_id,)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Recruitment entry not found")
    conn.execute(
        "UPDATE recruitment_pipeline SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (body.stage, entry_id)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM recruitment_pipeline WHERE id = ?", (entry_id,)).fetchone()
    conn.close()
    return dict(row)


@recruitment_router.patch("/{entry_id}/notes")
def update_recruitment_notes(entry_id: int, body: RecruitmentNotesUpdate):
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM recruitment_pipeline WHERE id = ?", (entry_id,)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Recruitment entry not found")
    conn.execute(
        "UPDATE recruitment_pipeline SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (body.notes, entry_id)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM recruitment_pipeline WHERE id = ?", (entry_id,)).fetchone()
    conn.close()
    return dict(row)


@recruitment_router.delete("/{entry_id}")
def remove_from_recruitment(entry_id: int):
    conn = get_db()
    conn.execute("DELETE FROM recruitment_pipeline WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
