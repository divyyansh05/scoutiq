"""
reports.py — PDF scouting report generation.

Generates a professional single-player scouting report as a PDF.
Report contains: player bio, performance score ring, key metrics,
radar chart description, similar players, scout notes, data freshness.
"""

import io
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.connection import get_db

log = logging.getLogger('reports')
router = APIRouter()


def get_player_report_data(player_id: int, season: Optional[str], db: Session) -> dict:
    """Fetch all data needed for the scouting report from football_platform schema."""
    from database.connection import run_query

    bio_sql = """
        SELECT player_id, name AS player_name, position_group AS position,
               nationality, date_of_birth, height_cm, preferred_foot,
               market_value_eur, current_team_name AS team_name
        FROM players WHERE player_id = :pid
    """
    bio_df = run_query(bio_sql, {"pid": player_id})
    if bio_df.empty:
        return None

    bio = bio_df.iloc[0].to_dict()

    totals_sql = """
        SELECT
            SUM(minutes_played) AS minutes,
            COUNT(*) AS matches_played,
            COALESCE(SUM(goals), 0) AS goals,
            COALESCE(SUM(assists), 0) AS assists,
            ROUND(SUM(xg)::numeric, 2) AS xg,
            ROUND(SUM(xa)::numeric, 2) AS xa,
            ROUND(SUM(npxg)::numeric, 2) AS npxg,
            COALESCE(SUM(shots), 0) AS shots,
            COALESCE(SUM(key_passes), 0) AS key_passes,
            COALESCE(SUM(dribbles_successful), 0) AS successful_dribbles,
            COALESCE(SUM(defensive_duels_won), 0) AS tackles_won,
            COALESCE(SUM(interceptions), 0) AS interceptions,
            COALESCE(SUM(clearances), 0) AS clearances,
            COALESCE(SUM(aerial_duels_won), 0) AS aerial_duels_won,
            COALESCE(SUM(recoveries), 0) AS recoveries,
            COALESCE(SUM(gk_saves), 0) AS saves
        FROM player_match_stats WHERE player_id = :pid
    """
    totals_df = run_query(totals_sql, {"pid": player_id})

    score_sql = """
        SELECT ps.performance_score, ps.percentile_rank, ps.position_group,
               ps.goals_p90, ps.assists_p90, ps.xg_p90, ps.xa_p90,
               ps.minutes_total, c.name AS competition_name
        FROM player_scores ps
        JOIN competitions c ON c.competition_id = ps.competition_id
        WHERE ps.player_id = :pid
        ORDER BY ps.performance_score DESC NULLS LAST LIMIT 1
    """
    score_df = run_query(score_sql, {"pid": player_id})

    player = {**bio}
    dob = player.get("date_of_birth")
    player["date_of_birth"] = str(dob) if dob else None
    player["market_value_date"] = None
    player["league_name"] = ""
    player["season_name"] = ""
    player["is_injured"] = False
    player["last_updated"] = None
    player["tactical_role"] = bio.get("position")
    player["reap_score"] = None
    player["matches_started"] = None
    player["xg_chain"] = None
    player["xg_buildup"] = None
    player["sofascore_rating"] = None
    player["accurate_passes_pct"] = None

    if not totals_df.empty:
        t = totals_df.iloc[0].to_dict()
        player.update(t)
        mins = max(float(player.get("minutes") or 1), 1)
        for src, dest in [
            ("goals", "goals_p90"), ("assists", "assists_p90"),
            ("xg", "xg_p90"), ("xa", "xa_p90"),
            ("shots", "shots_p90"), ("key_passes", "key_passes_p90"),
            ("aerial_duels_won", "aerial_won_p90"),
            ("successful_dribbles", "successful_dribbles_p90"),
            ("tackles_won", "tackles_p90"), ("interceptions", "interceptions_p90"),
            ("recoveries", "recoveries_p90"),
        ]:
            val = float(player.get(src) or 0)
            player[dest] = round(val / mins * 90, 3)

    if not score_df.empty:
        s = score_df.iloc[0]
        player["performance_score"] = float(s.get("performance_score") or 0) or None
        player["percentile_rank"] = float(s.get("percentile_rank") or 0) or None
        player["league_name"] = s.get("competition_name") or ""
        player["season_name"] = s.get("competition_name") or ""
        # Use pre-computed p90s if available
        for k in ["goals_p90", "assists_p90", "xg_p90", "xa_p90"]:
            v = s.get(k)
            if v is not None:
                player[k] = float(v)

    notes = ""
    try:
        from database.connection import get_lists_db
        import sqlite3
        lists_db_gen = get_lists_db()
        lists_db = next(lists_db_gen)
        note_row = lists_db.execute(
            "SELECT note_text FROM player_notes WHERE player_id = ?",
            (player_id,)
        ).fetchone()
        if note_row:
            notes = note_row["note_text"] or ""
    except Exception:
        pass

    similar = []
    try:
        from models.similarity import get_similar_players
        similar = get_similar_players(
            player_id=player_id,
            db=db,
            n=5,
            min_minutes=450,
            same_role_only=True,
        )
        # Normalize field names for report template
        for sp in similar:
            sp["player_name"] = sp.get("name", sp.get("player_name", ""))
            sp["team_name"] = sp.get("team_name", "")
            sp["league_name"] = sp.get("competition_name", "")
    except Exception as e:
        log.warning(f"Could not fetch similar players for report: {e}")

    return {
        'player': player,
        'notes': notes,
        'similar_players': similar,
    }


def generate_pdf_report(data: dict) -> bytes:
    """
    Generate PDF bytes from player report data.
    Uses WeasyPrint if available, falls back to ReportLab.
    """
    player = data['player']
    notes = data['notes']
    similar = data['similar_players']

    # Format helpers
    def fmt(v, d=2):
        if v is None:
            return '—'
        try:
            return f"{float(v):.{d}f}"
        except (TypeError, ValueError):
            return '—'

    def fmt_val(eur):
        if not eur:
            return '—'
        if eur >= 1_000_000:
            return f"€{eur / 1_000_000:.1f}M"
        return f"€{eur / 1_000:.0f}K"

    def fmt_age(dob):
        if not dob:
            return '—'
        from datetime import date
        today = date.today()
        try:
            birth = dob if hasattr(dob, 'year') else date.fromisoformat(str(dob))
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
            return str(age)
        except Exception:
            return '—'

    score = player.get('performance_score')
    score_str = str(round(float(score))) if score else '—'
    score_val = float(score) if score else 0
    percentile = player.get('percentile_rank')
    pct_str = f"{round(float(percentile))}th percentile" if percentile else ''
    role = player.get('tactical_role') or player.get('position', '—')
    reap = player.get('reap_score')
    reap_str = f"{float(reap):.2f}" if reap else '—'
    reap_val = float(reap) if reap else 0

    # REAP interpretation
    if reap_val >= 2.0:
        reap_context = "Elite per-minute efficiency"
    elif reap_val >= 1.5:
        reap_context = "Above average efficiency"
    elif reap_val >= 1.0:
        reap_context = "Average efficiency"
    else:
        reap_context = "Below average efficiency"

    # Score band colour
    if score and float(score) >= 80:
        score_colour = '#22c55e'
    elif score and float(score) >= 60:
        score_colour = '#3b82f6'
    elif score and float(score) >= 40:
        score_colour = '#f59e0b'
    else:
        score_colour = '#6b7280'

    # Compute role profile from per-90 metrics
    per90_metrics = {
        'Goals/90': float(player.get('goals_p90') or 0),
        'Assists/90': float(player.get('assists_p90') or 0),
        'xG/90': float(player.get('xg_p90') or 0),
        'xA/90': float(player.get('xa_p90') or 0),
        'Key Passes/90': float(player.get('key_passes_p90') or 0),
        'Tackles/90': float(player.get('tackles_p90') or 0),
        'Interceptions/90': float(player.get('interceptions_p90') or 0),
        'Aerial Won/90': float(player.get('aerial_won_p90') or 0),
        'Dribbles/90': float(player.get('successful_dribbles_p90') or 0),
        'Recoveries/90': float(player.get('recoveries_p90') or 0),
    }

    # Normalise 0-100 within available metrics
    if per90_metrics:
        max_val = max(per90_metrics.values()) or 1
        normalised = {k: (v / max_val) * 100 for k, v in per90_metrics.items() if v > 0}
        sorted_metrics = sorted(normalised.items(), key=lambda x: x[1], reverse=True)
        top_3 = sorted_metrics[:3]
        bottom_2 = sorted_metrics[-2:] if len(sorted_metrics) >= 5 else []
    else:
        top_3 = []
        bottom_2 = []

    def metric_tier(per90_val, metric_name):
        """Simple tier based on typical values per role."""
        thresholds = {
            'Goals': (0.5, 0.3),
            'Assists': (0.4, 0.2),
            'xG': (0.5, 0.25),
            'xA': (0.4, 0.2),
            'Key Passes': (1.5, 0.8),
            'Dribbles': (2.0, 1.0),
            'Tackles': (2.5, 1.5),
            'Interceptions': (1.5, 0.8),
            'Aerial Won': (2.0, 1.0),
            'Recoveries': (3.0, 1.5),
        }
        if not per90_val or per90_val == '—':
            return '#6b7280'
        try:
            val = float(str(per90_val).replace('/90',''))
            high, med = thresholds.get(metric_name, (1.0, 0.5))
            if val >= high: return '#22c55e'
            if val >= med: return '#f59e0b'
            return '#6b7280'
        except:
            return '#6b7280'

    # Metrics table rows
    metrics = [
        ('Goals', fmt(player.get('goals'), 0), fmt(player.get('goals_p90'), 2) + '/90'),
        ('Assists', fmt(player.get('assists'), 0), fmt(player.get('assists_p90'), 2) + '/90'),
        ('xG', fmt(player.get('xg'), 2), fmt(player.get('xg_p90'), 2) + '/90'),
        ('xA', fmt(player.get('xa'), 2), fmt(player.get('xa_p90'), 2) + '/90'),
        ('xG Chain', fmt(player.get('xg_chain'), 2), '—'),
        ('xG Buildup', fmt(player.get('xg_buildup'), 2), '—'),
        ('Shots', fmt(player.get('shots'), 0), fmt(player.get('shots_p90'), 2) + '/90'),
        ('Key Passes', fmt(player.get('key_passes'), 0), fmt(player.get('key_passes_p90'), 2) + '/90'),
        ('Dribbles', fmt(player.get('successful_dribbles'), 0), fmt(player.get('successful_dribbles_p90'), 2) + '/90'),
        ('Tackles', fmt(player.get('tackles'), 0), fmt(player.get('tackles_p90'), 2) + '/90'),
        ('Interceptions', fmt(player.get('interceptions'), 0), fmt(player.get('interceptions_p90'), 2) + '/90'),
        ('Aerial Won', fmt(player.get('aerial_duels_won'), 0), fmt(player.get('aerial_won_p90'), 2) + '/90'),
        ('Recoveries', fmt(player.get('recoveries'), 0), fmt(player.get('recoveries_p90'), 2) + '/90'),
        ('Pass Accuracy', fmt(player.get('accurate_passes_pct'), 1) + '%', '—'),
        ('Rating', fmt(player.get('sofascore_rating'), 1), '—'),
    ]

    metrics_rows_html = ''.join(
        f"""<tr>
            <td class="metric-name"><span style="color:{metric_tier(m[2].replace('/90',''), m[0])}">●</span> {m[0]}</td>
            <td class="metric-val">{m[1]}</td>
            <td class="metric-p90">{m[2]}</td>
        </tr>"""
        for m in metrics if m[1] != '—'
    )

    similar_rows_html = ''.join(
        f"""<tr>
            <td>{sp.get('player_name', '—')}</td>
            <td>{sp.get('team_name', '—')}</td>
            <td>{sp.get('league_name', '—')}</td>
            <td style="color:#22c55e;font-weight:bold">{sp.get('similarity', 0):.1f}%</td>
        </tr>"""
        for sp in (similar or [])
    )

    from datetime import datetime
    generated_at = datetime.now().strftime('%d %b %Y %H:%M')
    last_updated = str(player.get('last_updated', ''))[:10] if player.get('last_updated') else '—'
    injured_badge = '<span class="injured-badge">INJURED</span>' if player.get('is_injured') else ''

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{
    size: A4;
    margin: 15mm 15mm 15mm 15mm;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    color: #1f2937;
    background: #ffffff;
  }}

  /* Header */
  .header {{
    background: #0f172a;
    color: white;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-radius: 6px;
    margin-bottom: 14px;
  }}
  .player-name {{
    font-size: 22pt;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #f9fafb;
  }}
  .player-sub {{
    color: #94a3b8;
    font-size: 10pt;
    margin-top: 4px;
  }}
  .player-sub span {{
    margin-right: 12px;
  }}
  .score-block {{
    text-align: center;
    min-width: 80px;
  }}
  .score-number {{
    font-size: 36pt;
    font-weight: 900;
    color: {score_colour};
    line-height: 1;
  }}
  .score-label {{
    color: #94a3b8;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 2px;
  }}
  .score-pct {{
    color: #64748b;
    font-size: 8pt;
    margin-top: 2px;
  }}

  /* Bio strip */
  .bio-strip {{
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }}
  .bio-chip {{
    background: #f1f5f9;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 9pt;
    color: #374151;
  }}
  .bio-chip .label {{
    color: #9ca3af;
    font-size: 8pt;
    display: block;
  }}
  .injured-badge {{
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fca5a5;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 8pt;
    font-weight: 700;
  }}

  /* Two column layout */
  .two-col {{
    display: flex;
    gap: 12px;
    margin-bottom: 14px;
  }}
  .col-left {{ flex: 1.2; }}
  .col-right {{ flex: 1; }}

  /* Section */
  .section {{
    margin-bottom: 14px;
  }}
  .section-title {{
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #6b7280;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }}

  /* Metrics table */
  .metrics-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }}
  .metrics-table tr:nth-child(even) td {{
    background: #f9fafb;
  }}
  .metrics-table td {{
    padding: 4px 8px;
  }}
  .metric-name {{ color: #374151; }}
  .metric-val {{ font-weight: 600; color: #111827; text-align: right; }}
  .metric-p90 {{ color: #6b7280; text-align: right; font-size: 8pt; }}

  /* Performance indicators */
  .perf-row {{
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }}
  .perf-chip {{
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px;
    text-align: center;
  }}
  .perf-chip .val {{
    font-size: 14pt;
    font-weight: 800;
    color: #1e40af;
  }}
  .perf-chip .lbl {{
    font-size: 7pt;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }}

  /* Similar players */
  .similar-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }}
  .similar-table th {{
    text-align: left;
    padding: 4px 8px;
    color: #9ca3af;
    font-size: 8pt;
    font-weight: 600;
    border-bottom: 1px solid #e5e7eb;
  }}
  .similar-table td {{
    padding: 5px 8px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
  }}

  /* Notes */
  .notes-box {{
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 9pt;
    color: #374151;
    min-height: 40px;
    white-space: pre-wrap;
  }}

  /* Footer */
  .footer {{
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    color: #9ca3af;
    font-size: 7pt;
  }}
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div>
    <div class="player-name">
      {player.get('player_name', '—')} {injured_badge}
    </div>
    <div class="player-sub">
      <span>{player.get('team_name', '—')}</span>
      <span>{player.get('league_name', '—')}</span>
      <span>{player.get('season_name', '—')}</span>
      <span style="color:#64748b">{role}</span>
    </div>
  </div>
  <div class="score-block">
    <div style="margin: 8px 0;">
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="score-number">{score_str}</div>
        <div style="flex:1; min-width:80px;">
          <div style="background:#1e293b; border-radius:4px; height:8px; overflow:hidden;">
            <div style="background:{score_colour}; width:{score_val if score_val > 0 else 0}%;
                        height:100%; border-radius:4px;"></div>
          </div>
        </div>
      </div>
      <div class="score-label">ScoutIQ Score</div>
      <div class="score-pct">{pct_str}</div>
    </div>
  </div>
</div>

<!-- Bio strip -->
<div class="bio-strip">
  <div class="bio-chip">
    <span class="label">Age</span>
    {fmt_age(player.get('date_of_birth'))}
  </div>
  <div class="bio-chip">
    <span class="label">Height</span>
    {player.get('height_cm') or '—'} cm
  </div>
  <div class="bio-chip">
    <span class="label">Foot</span>
    {(player.get('preferred_foot') or '—').title()}
  </div>
  <div class="bio-chip">
    <span class="label">Nationality</span>
    {player.get('nationality') or '—'}
  </div>
  <div class="bio-chip">
    <span class="label">Market Value</span>
    {fmt_val(player.get('market_value_eur'))}
  </div>
  <div class="bio-chip">
    <span class="label">Minutes</span>
    {fmt(player.get('minutes'), 0)}
  </div>
  <div class="bio-chip">
    <span class="label">Apps</span>
    {fmt(player.get('matches_played'), 0)}
    ({fmt(player.get('matches_started'), 0)} starts)
  </div>
</div>

<!-- Performance indicators -->
<div class="perf-row">
  <div class="perf-chip">
    <div class="val">{fmt(player.get('goals'), 0)}</div>
    <div class="lbl">Goals</div>
  </div>
  <div class="perf-chip">
    <div class="val">{fmt(player.get('assists'), 0)}</div>
    <div class="lbl">Assists</div>
  </div>
  <div class="perf-chip">
    <div class="val">{fmt(player.get('xg'), 1)}</div>
    <div class="lbl">xG</div>
  </div>
  <div class="perf-chip">
    <div class="val">{fmt(player.get('xa'), 1)}</div>
    <div class="lbl">xA</div>
  </div>
  <div class="perf-chip">
    <div class="val">{reap_str}</div>
    <div class="lbl">REAP</div>
    <div style="font-size:6pt;color:#64748b;margin-top:2px;">{reap_context if reap_val > 0 else ''}</div>
  </div>
  <div class="perf-chip">
    <div class="val">{fmt(player.get('sofascore_rating'), 1)}</div>
    <div class="lbl">Rating</div>
  </div>
</div>

<!-- Role Profile -->
{'<div class="section">' +
  '<div class="section-title">Role Profile — ' + role + '</div>' +
  '<p style="font-size:8pt; color:#22c55e; font-weight:600; margin-bottom:4px;">STRENGTHS</p>' +
  ''.join(f'''<div style="margin-bottom:5px;">
    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
      <span style="font-size:8pt; color:#d1d5db;">{name}</span>
      <span style="font-size:8pt; color:#22c55e; font-weight:600;">{val:.0f}</span>
    </div>
    <div style="background:#1e293b; border-radius:2px; height:6px;">
      <div style="background:#22c55e; width:{val:.0f}%; height:100%; border-radius:2px;"></div>
    </div>
  </div>''' for name, val in top_3) +
  (('<p style="font-size:8pt; color:#f59e0b; font-weight:600; margin:8px 0 4px;">RELATIVE WEAKNESSES</p>' +
    ''.join(f'''<div style="margin-bottom:5px;">
    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
      <span style="font-size:8pt; color:#d1d5db;">{name}</span>
      <span style="font-size:8pt; color:#f59e0b;">{val:.0f}</span>
    </div>
    <div style="background:#1e293b; border-radius:2px; height:6px;">
      <div style="background:#f59e0b; width:{val:.0f}%; height:100%; border-radius:2px;"></div>
    </div>
  </div>''' for name, val in bottom_2)) if bottom_2 else '') +
'</div>' if top_3 else ''}

<!-- Two column -->
<div class="two-col">
  <!-- Left: full metrics table -->
  <div class="col-left">
    <div class="section">
      <div class="section-title">Statistics — {player.get('season_name', '')} Season</div>
      <table class="metrics-table">
        <tr>
          <th style="text-align:left;padding:4px 8px;color:#9ca3af;font-size:8pt;border-bottom:1px solid #e5e7eb">Metric</th>
          <th style="text-align:right;padding:4px 8px;color:#9ca3af;font-size:8pt;border-bottom:1px solid #e5e7eb">Total</th>
          <th style="text-align:right;padding:4px 8px;color:#9ca3af;font-size:8pt;border-bottom:1px solid #e5e7eb">Per 90</th>
        </tr>
        {metrics_rows_html}
      </table>
    </div>
  </div>

  <!-- Right: similar players + notes -->
  <div class="col-right">
    <div class="section">
      <div class="section-title">Most Similar Players</div>
      {'<table class="similar-table"><tr><th>Player</th><th>Team</th><th>League</th><th>Sim%</th></tr>' + similar_rows_html + '</table>'
       if similar_rows_html else '<p style="color:#9ca3af;font-size:9pt">No similar players found.</p>'}
    </div>

    <div class="section">
      <div class="section-title">Scout Notes</div>
      <div class="notes-box">{notes if notes else 'No notes recorded.'}</div>
    </div>
  </div>
</div>

<!-- Footer -->
<div class="footer">
  <span>Generated by ScoutIQ · {generated_at}</span>
  <span>Data as of {last_updated}</span>
  <span>ScoutIQ — Football Intelligence Platform</span>
</div>

</body>
</html>"""

    # Try WeasyPrint first, fall back to reportlab text PDF
    try:
        import weasyprint
        pdf_bytes = weasyprint.HTML(string=html).write_pdf()
        return pdf_bytes
    except (ImportError, OSError):
        pass

    # ReportLab fallback — plain text layout
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        w, h = A4

        c.setFont('Helvetica-Bold', 18)
        c.drawString(15*mm, h - 25*mm, player.get('player_name', '—'))

        c.setFont('Helvetica', 10)
        c.drawString(15*mm, h - 35*mm,
            f"{player.get('team_name','—')} · {player.get('league_name','—')} · {player.get('season_name','—')}")

        c.setFont('Helvetica-Bold', 28)
        c.setFillColorRGB(0.13, 0.77, 0.43)
        c.drawString(15*mm, h - 50*mm, f"Score: {score_str}")

        c.setFont('Helvetica', 10)
        c.setFillColorRGB(0, 0, 0)
        y = h - 65*mm
        c.drawString(15*mm, y, f"REAP: {reap_str}  |  Minutes: {fmt(player.get('minutes'),0)}  |  Value: {fmt_val(player.get('market_value_eur'))}")

        y -= 10*mm
        c.setFont('Helvetica-Bold', 11)
        c.drawString(15*mm, y, 'Key Statistics')
        c.setFont('Helvetica', 10)
        y -= 6*mm

        for name, total, p90 in metrics[:12]:
            if total != '—':
                c.drawString(15*mm, y, f"{name}: {total}  ({p90})")
                y -= 6*mm
                if y < 30*mm:
                    break

        if notes:
            y -= 5*mm
            c.setFont('Helvetica-Bold', 11)
            c.drawString(15*mm, y, 'Scout Notes')
            c.setFont('Helvetica', 9)
            y -= 6*mm
            for line in notes[:300].split('\n')[:5]:
                c.drawString(15*mm, y, line[:90])
                y -= 5*mm

        c.setFont('Helvetica', 8)
        c.setFillColorRGB(0.6, 0.6, 0.6)
        c.drawString(15*mm, 10*mm, f"ScoutIQ · Generated {generated_at} · Data as of {last_updated}")

        c.save()
        return buffer.getvalue()

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF generation not available. Install weasyprint or reportlab."
        )


@router.get("/api/reports/player/{player_id}")
def generate_player_report(
    player_id: int,
    season: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Generate and download a PDF scouting report for a player.
    """
    data = get_player_report_data(player_id, season, db)
    if not data:
        raise HTTPException(status_code=404, detail="Player not found")

    pdf_bytes = generate_pdf_report(data)
    player_name = data['player'].get('player_name', 'player').replace(' ', '_')

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{player_name}_ScoutIQ_Report.pdf"',
            'Content-Length': str(len(pdf_bytes)),
        }
    )
