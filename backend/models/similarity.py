"""
similarity.py — Player similarity via pgvector on player_scores.stat_vector.
Rewritten for football_platform schema (no player_season_stats).
"""

import logging
from typing import Optional
from sqlalchemy import text

log = logging.getLogger('similarity')


def get_similar_players(
    player_id: int,
    db,
    n: int = 10,
    min_minutes: int = 450,
    same_role_only: bool = True,
    # Legacy params ignored in new schema
    season_id=None,
    league_id=None,
    exclude_same_team: bool = False,
    **kwargs,
) -> list[dict]:
    n = min(n, 30)

    target_sql = text("""
        SELECT ps.stat_vector, ps.position_group, p.current_team_wyscout_id
        FROM player_scores ps
        JOIN players p ON ps.player_id = p.player_id
        WHERE ps.player_id = :player_id AND ps.stat_vector IS NOT NULL
        ORDER BY ps.performance_score DESC NULLS LAST
        LIMIT 1
    """)
    target = db.execute(target_sql, {'player_id': player_id}).fetchone()

    if not target or target.stat_vector is None:
        log.warning(f"Player {player_id} has no stat_vector")
        return []

    target_vector = target.stat_vector
    target_role = target.position_group
    target_team_wyscout = target.current_team_wyscout_id

    if isinstance(target_vector, str):
        target_vector_str = target_vector
    else:
        target_vector_str = str(target_vector)

    where = [
        "ps.stat_vector IS NOT NULL",
        "ps.player_id != :player_id",
        "ps.minutes_total >= :min_minutes",
    ]
    params = {
        'player_id': player_id,
        'min_minutes': min_minutes,
        'target_vector': target_vector_str,
        'n': n,
    }

    if same_role_only and target_role:
        where.append("ps.position_group = :target_role")
        params['target_role'] = target_role

    if exclude_same_team and target_team_wyscout:
        where.append("p.current_team_wyscout_id != :target_team")
        params['target_team'] = target_team_wyscout

    where_sql = ' AND '.join(where)

    similarity_sql = text(f"""
        WITH best_per_player AS (
            SELECT DISTINCT ON (ps.player_id)
                ps.player_id,
                ps.stat_vector,
                ps.position_group,
                ps.performance_score,
                ps.percentile_rank,
                ps.minutes_total,
                ps.goals_p90,
                ps.xg_p90,
                ps.assists_p90,
                ps.xa_p90,
                c.name AS competition_name
            FROM player_scores ps
            JOIN players p ON ps.player_id = p.player_id
            JOIN competitions c ON c.competition_id = ps.competition_id
            WHERE {where_sql}
            ORDER BY ps.player_id, ps.minutes_total DESC
        )
        SELECT
            bpp.player_id,
            p.name,
            p.position_group,
            p.primary_position,
            p.nationality,
            p.current_team_name,
            bpp.competition_name,
            bpp.performance_score,
            bpp.percentile_rank,
            bpp.minutes_total,
            bpp.goals_p90,
            bpp.xg_p90,
            bpp.assists_p90,
            bpp.xa_p90,
            ROUND(
                CAST((1 - (bpp.stat_vector <=> CAST(:target_vector AS vector))) AS numeric),
                3
            ) AS similarity
        FROM best_per_player bpp
        JOIN players p ON p.player_id = bpp.player_id
        ORDER BY bpp.stat_vector <=> CAST(:target_vector AS vector)
        LIMIT :n
    """)

    rows = db.execute(similarity_sql, params).fetchall()

    return [
        {
            'player_id': r.player_id,
            'name': r.name,
            'player_name': r.name,
            'position_group': r.position_group,
            'primary_position': r.primary_position,
            'nationality': r.nationality,
            'team_name': r.current_team_name,
            'competition_name': r.competition_name,
            'performance_score': float(r.performance_score) if r.performance_score else None,
            'percentile_rank': float(r.percentile_rank) if r.percentile_rank else None,
            'minutes_total': r.minutes_total,
            'goals_p90': float(r.goals_p90) if r.goals_p90 else None,
            'xg_p90': float(r.xg_p90) if r.xg_p90 else None,
            'assists_p90': float(r.assists_p90) if r.assists_p90 else None,
            'xa_p90': float(r.xa_p90) if r.xa_p90 else None,
            'similarity': float(r.similarity) if r.similarity else 0.0,
        }
        for r in rows
    ]


def get_player_vector_info(player_id: int, db) -> Optional[dict]:
    sql = text("""
        SELECT ps.player_id, ps.position_group,
               ps.stat_vector IS NOT NULL AS has_vector,
               ps.performance_score,
               c.name AS competition_name
        FROM player_scores ps
        JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE ps.player_id = :player_id AND ps.stat_vector IS NOT NULL
        ORDER BY ps.minutes_total DESC
        LIMIT 1
    """)
    row = db.execute(sql, {'player_id': player_id}).fetchone()
    if not row:
        return None
    return {
        'player_id': row.player_id,
        'role': row.position_group,
        'has_vector': row.has_vector,
        'performance_score': float(row.performance_score) if row.performance_score else None,
        'competition_name': row.competition_name,
    }
