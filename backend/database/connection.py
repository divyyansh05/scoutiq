import os
import logging
import pandas as pd
import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/football_data")

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
    return _engine


def get_db():
    """Get a PostgreSQL database session (FastAPI dependency pattern)."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())

    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_lists_db():
    """Get a SQLite connection for the lists database."""
    db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lists.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def get_current_season() -> str:
    """Not used in new schema (competition-based). Returns empty string."""
    return ""


def get_latest_season_name() -> str:
    """Not used in new schema (competition-based). Returns empty string."""
    return ""


def run_query(sql: str, params=None) -> pd.DataFrame:
    """Execute a SQL query and return a DataFrame. Returns empty DataFrame on error."""
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text(sql), params or {})
            rows = result.fetchall()
            if not rows:
                return pd.DataFrame()
            return pd.DataFrame(rows, columns=list(result.keys()))
    except Exception as exc:
        log.error(f"Query error: {exc}", exc_info=True)
        return pd.DataFrame()
