"""
Team style clustering using K-Means on aggregate team statistics.

Clusters are labelled with a style fingerprint based on which features
dominate each centroid.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Optional

from database.connection import run_query
from config import MIN_MINUTES

try:
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans
    _SKLEARN_AVAILABLE = True
except ImportError:
    _SKLEARN_AVAILABLE = False

_N_CLUSTERS = 5

_STYLE_NAMES = {
    0: "High Press",
    1: "Possession",
    2: "Counter Attack",
    3: "Direct Play",
    4: "Defensive Block",
}

_FETCH_SQL = """
    SELECT
        t.team_id,
        t.team_name,
        l.league_name,
        AVG(pss.xg)                  AS avg_xg,
        AVG(pss.xa)                  AS avg_xa,
        AVG(pss.shots)               AS avg_shots,
        AVG(pss.key_passes)          AS avg_key_passes,
        AVG(pss.dribbles_completed)  AS avg_dribbles,
        AVG(pss.aerials_won)         AS avg_aerials,
        AVG(pss.tackles_won)         AS avg_tackles,
        AVG(pss.interceptions)       AS avg_interceptions,
        AVG(pss.recoveries)          AS avg_recoveries,
        AVG(pss.accurate_passes_pct) AS avg_pass_accuracy,
        AVG(pss.sofascore_rating)    AS avg_rating,
        COUNT(DISTINCT pss.player_id) AS squad_size
    FROM player_season_stats pss
    JOIN teams   t ON pss.team_id   = t.team_id
    JOIN leagues l ON pss.league_id = l.league_id
    JOIN seasons s ON pss.season_id = s.season_id
    WHERE pss.minutes >= :min_minutes
    {extra_where}
    GROUP BY t.team_id, t.team_name, l.league_name
    HAVING COUNT(DISTINCT pss.player_id) >= 5
"""

_FEATURE_COLS = [
    "avg_xg", "avg_xa", "avg_shots", "avg_key_passes", "avg_dribbles",
    "avg_aerials", "avg_tackles", "avg_interceptions", "avg_recoveries",
    "avg_pass_accuracy",
]


def _label_cluster(centroid: np.ndarray, feature_names: list[str]) -> str:
    """Assign a human-readable style based on which features are highest."""
    top_idx = np.argsort(centroid)[::-1][:3]
    top = [feature_names[i] for i in top_idx]

    if "avg_tackles" in top and "avg_interceptions" in top:
        return "High Press"
    if "avg_pass_accuracy" in top and "avg_key_passes" in top:
        return "Possession"
    if "avg_recoveries" in top and "avg_shots" in top:
        return "Counter Attack"
    if "avg_aerials" in top and "avg_shots" in top:
        return "Direct Play"
    return "Defensive Block"


def get_team_styles(
    season: Optional[str] = None,
    n_clusters: int = _N_CLUSTERS,
    min_minutes: int = MIN_MINUTES,
) -> pd.DataFrame:
    extra_parts = []
    params: dict = {"min_minutes": min_minutes}

    if season:
        extra_parts.append("AND s.season_name = :season")
        params["season"] = season

    sql = _FETCH_SQL.format(extra_where=" ".join(extra_parts))
    df = run_query(sql, params)

    if df.empty:
        return pd.DataFrame()

    # Coerce
    for col in _FEATURE_COLS + ["avg_rating", "squad_size"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    if not _SKLEARN_AVAILABLE or len(df) < n_clusters:
        df["cluster"] = 0
        df["style"] = "Unknown"
        return df

    feature_matrix = df[_FEATURE_COLS].values.astype(float)

    scaler = StandardScaler()
    scaled = scaler.fit_transform(feature_matrix)

    k = min(n_clusters, len(df))
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    df["cluster"] = km.fit_predict(scaled)

    # Label each cluster
    centroids_original = scaler.inverse_transform(km.cluster_centers_)
    cluster_styles = {
        i: _label_cluster(centroids_original[i], _FEATURE_COLS)
        for i in range(k)
    }
    df["style"] = df["cluster"].map(cluster_styles)

    return df[[
        "team_id", "team_name", "league_name", "cluster", "style",
        "avg_xg", "avg_xa", "avg_shots", "avg_key_passes",
        "avg_aerials", "avg_tackles", "avg_pass_accuracy",
        "avg_rating", "squad_size",
    ]]
