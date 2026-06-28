"""
Team style clustering using K-Means on team_match_stats aggregates.
Rewritten for football_platform schema.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Optional

from database.connection import run_query

try:
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans
    _SKLEARN_AVAILABLE = True
except ImportError:
    _SKLEARN_AVAILABLE = False

_N_CLUSTERS = 5

_FETCH_SQL = """
    SELECT
        t.team_id,
        t.name                             AS team_name,
        tms.competition_name               AS league_name,
        COUNT(*)                           AS matches,
        ROUND(AVG(tms.xg)::numeric, 3)     AS avg_xg,
        ROUND(AVG(tms.shots)::numeric, 1)  AS avg_shots,
        ROUND(AVG(tms.crosses)::numeric, 1) AS avg_crosses,
        ROUND(AVG(tms.touches_in_box)::numeric, 1) AS avg_touches_in_box,
        ROUND(AVG(tms.deep_passes)::numeric, 1)    AS avg_deep_passes,
        ROUND(AVG(CASE WHEN tms.result='W' THEN 1 ELSE 0 END)::numeric * 100, 1) AS win_rate
    FROM team_match_stats tms
    JOIN teams t ON t.team_id = tms.team_id
    {extra_where}
    GROUP BY t.team_id, t.name, tms.competition_name
    HAVING COUNT(*) >= 5
"""

_FEATURE_COLS = [
    "avg_xg", "avg_shots", "avg_crosses",
    "avg_touches_in_box", "avg_deep_passes", "win_rate",
]


def _label_cluster(centroid: np.ndarray, feature_names: list[str]) -> str:
    feat = dict(zip(feature_names, centroid))
    xg = feat.get('avg_xg', 0)
    shots = feat.get('avg_shots', 0)
    crosses = feat.get('avg_crosses', 0)
    touches = feat.get('avg_touches_in_box', 0)
    deep = feat.get('avg_deep_passes', 0)

    if xg > 1.5 and deep > 25:
        return 'Possession'
    elif shots > 14 and xg > 1.3:
        return 'High Press'
    elif crosses > 10 and touches > 15:
        return 'Direct Play'
    elif xg < 1.1 and shots < 11:
        return 'Defensive Block'
    elif xg > 1.2 and crosses < 8:
        return 'Counter Attack'
    else:
        scores = {
            'Possession': deep * 0.4 + xg * 0.4 + touches * 0.2,
            'High Press': shots * 0.5 + xg * 0.3 + touches * 0.2,
            'Direct Play': crosses * 0.5 + touches * 0.3 + shots * 0.2,
            'Defensive Block': (15 - shots) * 0.5 + (1.5 - xg) * 0.5,
            'Counter Attack': xg * 0.5 + (10 - crosses) * 0.3 + shots * 0.2,
        }
        return max(scores, key=scores.get)


def get_team_styles(
    season: Optional[str] = None,
    n_clusters: int = _N_CLUSTERS,
    competition: Optional[str] = None,
) -> pd.DataFrame:
    extra_parts = []
    params: dict = {}

    comp_filter = competition or season
    if comp_filter:
        extra_parts.append("WHERE tms.competition_name = :competition")
        params["competition"] = comp_filter

    sql = _FETCH_SQL.format(extra_where=" ".join(extra_parts))
    df = run_query(sql, params)

    if df.empty:
        return pd.DataFrame()

    for col in _FEATURE_COLS + ["matches"]:
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

    centroids_original = scaler.inverse_transform(km.cluster_centers_)
    cluster_styles = {
        i: _label_cluster(centroids_original[i], _FEATURE_COLS)
        for i in range(k)
    }
    df["style"] = df["cluster"].map(cluster_styles)

    return df[[
        "team_id", "team_name", "league_name", "cluster", "style",
        "matches", "avg_xg", "avg_shots", "avg_crosses",
        "avg_touches_in_box", "avg_deep_passes", "win_rate",
    ]]
