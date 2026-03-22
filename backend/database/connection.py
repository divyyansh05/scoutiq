import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/football_data")

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
    return _engine


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
        print(f"[DB] Query error: {exc}")
        return pd.DataFrame()
