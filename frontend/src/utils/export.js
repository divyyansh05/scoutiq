// ── Shared helpers ─────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score == null) return '#64748b'
  if (score >= 90) return '#22c55e'
  if (score >= 75) return '#14b8a6'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#eab308'
  if (score >= 25) return '#f97316'
  return '#ef4444'
}

function scoreLabel(score) {
  if (score == null) return '—'
  if (score >= 90) return 'Elite'
  if (score >= 75) return 'Top Tier'
  if (score >= 60) return 'Above Avg'
  if (score >= 40) return 'Average'
  if (score >= 25) return 'Below Avg'
  return 'Developing'
}

function fmt(v, dp = 2) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return isNaN(n) ? v : n.toFixed(dp)
}

function fmtInt(v) {
  if (v == null || v === '') return '—'
  const n = Math.round(Number(v))
  return isNaN(n) ? v : n.toLocaleString()
}

function today() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: #060e20;
    color: #dee5ff;
    min-height: 100vh;
    padding: 40px 48px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .headline { font-family: 'Space Grotesk', sans-serif; }
  .header {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: 32px; padding-bottom: 24px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo-icon {
    width: 40px; height: 40px; background: rgba(59,130,246,0.2);
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    font-size: 20px;
  }
  .logo-text { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 22px; color: #60a5fa; letter-spacing: -0.5px; }
  .logo-sub { font-size: 10px; font-weight: 700; color: rgba(96,165,250,0.5); letter-spacing: 0.08em; text-transform: uppercase; }
  .report-meta { text-align: right; }
  .report-title { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 26px; color: #fff; letter-spacing: -0.5px; }
  .report-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
  .stats-bar {
    display: grid; gap: 12px; margin-bottom: 28px;
  }
  .stat-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 14px 18px; text-align: center;
  }
  .stat-value { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 26px; color: #60a5fa; }
  .stat-label { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    padding: 10px 12px; text-align: left;
    font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: #475569; background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
  tbody tr:nth-child(even) { background: rgba(255,255,255,0.02); }
  tbody td { padding: 10px 12px; color: #cbd5e1; vertical-align: middle; }
  .rank-cell { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 14px; color: #3b82f6; width: 40px; }
  .rank-1 { color: #fbbf24; }
  .rank-2 { color: #94a3b8; }
  .rank-3 { color: #c2845f; }
  .player-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13px; color: #fff; }
  .team-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .pos-badge {
    display: inline-block; padding: 2px 7px; border-radius: 999px;
    font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  }
  .pos-GK { background: rgba(168,85,247,0.2); color: #a855f7; }
  .pos-DEF { background: rgba(59,130,246,0.2); color: #3b82f6; }
  .pos-MID { background: rgba(34,197,94,0.2); color: #22c55e; }
  .pos-WNG { background: rgba(245,158,11,0.2); color: #f59e0b; }
  .pos-FWD { background: rgba(239,68,68,0.2); color: #ef4444; }
  .mono { font-family: 'Courier New', monospace; font-weight: 700; }
  .score-ring {
    display: inline-flex; align-items: center; gap: 6px;
  }
  .score-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  .score-val { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 13px; }
  .footer {
    margin-top: 40px; padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; color: #334155;
  }
  @media print {
    body { background: #060e20 !important; padding: 20px 24px; color: #dee5ff !important; }
    @page { size: A4 landscape; margin: 10mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    a { text-decoration: none; }
  }
`

function openHTML(html, filename) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.document.title = filename
  // Auto-trigger print dialog so user can Save as PDF immediately
  win.addEventListener('load', () => setTimeout(() => win.print(), 250))
}

// ── Player Search / Scouting List Report ───────────────────────────────────

export function exportPlayersReport(players, title = 'Player Search Results', context = '') {
  if (!players?.length) return
  const date = today()

  const avgScore = players.reduce((s, p) => s + (Number(p.score) || 0), 0) / players.length
  const positions = [...new Set(players.map(p => p.position_group).filter(Boolean))]

  const rows = players.map((p, i) => {
    const sc = Number(p.score) || 0
    const col = scoreColor(sc)
    const lbl = scoreLabel(sc)
    const pos = p.position_group || '—'
    return `
      <tr>
        <td class="rank-cell ${i < 3 ? `rank-${i + 1}` : ''}">${i + 1}</td>
        <td>
          <div class="player-name">${p.player_name || p.name || '—'}</div>
          <div class="team-sub">${p.team_name || '—'} · ${p.competition_name || p.league_name || '—'}</div>
        </td>
        <td><span class="pos-badge pos-${pos}">${pos}</span></td>
        <td class="mono" style="color:#94a3b8">${p.age || '—'}</td>
        <td class="mono" style="color:#94a3b8">${fmtInt(p.minutes_played || p.minutes)}</td>
        <td>
          <div class="score-ring">
            <div class="score-dot" style="background:${col}"></div>
            <span class="score-val" style="color:${col}">${sc.toFixed(1)}</span>
            <span style="font-size:9px;color:#475569;margin-left:2px">${lbl}</span>
          </div>
        </td>
        <td class="mono" style="color:#60a5fa">${fmt(p.xg_per90 || p.xg_p90, 3)}</td>
        <td class="mono" style="color:#60a5fa">${fmt(p.xa_per90 || p.xa_p90, 3)}</td>
        <td class="mono" style="color:#22c55e">${fmt(p.goals_per90 || p.goals_p90, 3)}</td>
        <td class="mono" style="color:#22c55e">${fmt(p.assists_per90 || p.assists_p90, 3)}</td>
        <td class="mono" style="color:#94a3b8">${p.nationality || '—'}</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>${title}</title>
  <style>${BASE_STYLES}
    .stats-bar { grid-template-columns: repeat(4, 1fr); }
    table { margin-top: 4px; }
  </style></head><body>
  <div class="header">
    <div class="logo">
      <div class="logo-icon">⚡</div>
      <div><div class="logo-text">ScoutIQ</div><div class="logo-sub">Football Intelligence</div></div>
    </div>
    <div class="report-meta">
      <div class="report-title">${title}</div>
      <div class="report-sub">${context ? context + ' · ' : ''}Generated ${date}</div>
    </div>
  </div>
  <div class="stats-bar">
    <div class="stat-card"><div class="stat-value">${players.length}</div><div class="stat-label">Players</div></div>
    <div class="stat-card"><div class="stat-value">${avgScore.toFixed(1)}</div><div class="stat-label">Avg Score</div></div>
    <div class="stat-card"><div class="stat-value">${positions.join(' / ') || '—'}</div><div class="stat-label">Positions</div></div>
    <div class="stat-card"><div class="stat-value">${[...new Set(players.map(p => p.team_name).filter(Boolean))].length}</div><div class="stat-label">Clubs</div></div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Player</th><th>Pos</th><th>Age</th><th>Mins</th>
      <th>Score</th><th>xG/90</th><th>xA/90</th><th>G/90</th><th>A/90</th><th>Nationality</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>ScoutIQ · Football Intelligence Platform</span>
    <span>${date}</span>
  </div>
  </body></html>`

  openHTML(html, title)
}

// ── Rankings Report ────────────────────────────────────────────────────────

export function exportRankingsReport(rankings, metric = 'xG', per90 = true, competition = '') {
  if (!rankings?.length) return
  const date = today()
  const metricLabel = per90 ? `${metric} per 90` : `${metric} (total)`

  const rows = rankings.slice(0, 50).map((p, i) => {
    const rank = p.rank || i + 1
    const val = Number(p.metric_value || p.per90 || p.total || 0)
    const pos = p.position_group || '—'
    return `
      <tr>
        <td class="rank-cell ${rank <= 3 ? `rank-${rank}` : ''}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</td>
        <td>
          <div class="player-name">${p.player_name || p.name || '—'}</div>
          <div class="team-sub">${p.team_name || '—'} · ${p.league_name || competition || '—'}</div>
        </td>
        <td><span class="pos-badge pos-${pos}">${pos}</span></td>
        <td class="mono" style="color:#94a3b8">${p.age || '—'}</td>
        <td class="mono" style="color:#94a3b8">${fmtInt(p.minutes)}</td>
        <td class="mono" style="color:#60a5fa;font-size:15px;font-weight:900">${val.toFixed(3)}</td>
        <td class="mono" style="color:#94a3b8">${p.nationality || '—'}</td>
      </tr>`
  }).join('')

  const top = rankings[0]
  const topVal = Number(top?.metric_value || top?.per90 || 0)

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>Rankings — ${metricLabel}</title>
  <style>${BASE_STYLES}
    .stats-bar { grid-template-columns: repeat(3, 1fr); }
    .metric-hero {
      background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.08));
      border: 1px solid rgba(59,130,246,0.2); border-radius: 16px;
      padding: 20px 24px; margin-bottom: 28px;
      display: flex; align-items: center; gap: 20px;
    }
    .metric-name { font-family:'Space Grotesk',sans-serif; font-weight:900; font-size:32px; color:#3b82f6; }
    .metric-desc { font-size:11px; color:#64748b; margin-top:3px; }
    .top-player-val { font-family:'Space Grotesk',sans-serif; font-weight:900; font-size:28px; color:#fff; }
    .top-player-name { font-size:11px; color:#94a3b8; }
  </style></head><body>
  <div class="header">
    <div class="logo">
      <div class="logo-icon">📊</div>
      <div><div class="logo-text">ScoutIQ</div><div class="logo-sub">Football Intelligence</div></div>
    </div>
    <div class="report-meta">
      <div class="report-title">Statistical Rankings</div>
      <div class="report-sub">${competition || 'All Competitions'} · Generated ${date}</div>
    </div>
  </div>
  <div class="metric-hero">
    <div>
      <div class="metric-name">${metric}</div>
      <div class="metric-desc">${metricLabel} · Top ${Math.min(rankings.length, 50)} players</div>
    </div>
    <div style="margin-left:auto;text-align:right">
      <div class="top-player-val">${topVal.toFixed(3)}</div>
      <div class="top-player-name">Leader: ${top?.player_name || top?.name || '—'} · ${top?.team_name || '—'}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Rank</th><th>Player</th><th>Pos</th><th>Age</th><th>Mins</th>
      <th>${metricLabel}</th><th>Nationality</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>ScoutIQ · Football Intelligence Platform</span>
    <span>${date}</span>
  </div>
  </body></html>`

  openHTML(html, `Rankings - ${metric}`)
}

// ── Weighted Ranking / Custom Composite Report ─────────────────────────────

export function exportWeightedReport(players, weights = {}) {
  if (!players?.length) return
  const date = today()
  const weightLines = Object.entries(weights)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}%`)
    .join('  ·  ')

  const rows = players.slice(0, 50).map((p, i) => {
    const rank = p.rank || i + 1
    const sc = Number(p.composite_score || 0)
    const barW = Math.round(sc)
    const col = sc >= 80 ? '#22c55e' : sc >= 60 ? '#3b82f6' : sc >= 40 ? '#eab308' : '#ef4444'
    const pos = p.position_group || '—'
    return `
      <tr>
        <td class="rank-cell ${rank <= 3 ? `rank-${rank}` : ''}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</td>
        <td>
          <div class="player-name">${p.player_name || '—'}</div>
          <div class="team-sub">${p.team_name || '—'} · ${p.league_name || '—'}</div>
        </td>
        <td><span class="pos-badge pos-${pos}">${pos}</span></td>
        <td class="mono" style="color:#94a3b8">${p.age || '—'}</td>
        <td class="mono" style="color:#94a3b8">${fmtInt(p.minutes)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
              <div style="width:${barW}%;height:100%;background:${col};border-radius:3px"></div>
            </div>
            <span class="mono" style="color:${col};font-size:13px;font-weight:900;min-width:36px;text-align:right">${sc.toFixed(1)}</span>
          </div>
        </td>
        <td class="mono" style="color:#94a3b8">${p.nationality || '—'}</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>Custom Metric Ranking</title>
  <style>${BASE_STYLES}
    .weights-banner {
      background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
      border-radius: 12px; padding: 12px 16px; margin-bottom: 24px;
      font-size: 11px; color: #818cf8; line-height: 1.6;
    }
    .weights-title { font-family:'Space Grotesk',sans-serif; font-weight:800; font-size:12px; color:#818cf8; margin-bottom:4px; }
  </style></head><body>
  <div class="header">
    <div class="logo">
      <div class="logo-icon">⚖️</div>
      <div><div class="logo-text">ScoutIQ</div><div class="logo-sub">Football Intelligence</div></div>
    </div>
    <div class="report-meta">
      <div class="report-title">Custom Metric Ranking</div>
      <div class="report-sub">Composite score via weighted metrics · Generated ${date}</div>
    </div>
  </div>
  ${weightLines ? `<div class="weights-banner"><div class="weights-title">Weight Configuration</div>${weightLines}</div>` : ''}
  <table>
    <thead><tr>
      <th>Rank</th><th>Player</th><th>Pos</th><th>Age</th><th>Mins</th>
      <th>Composite Score (0–100)</th><th>Nationality</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>ScoutIQ · Football Intelligence Platform</span>
    <span>${date}</span>
  </div>
  </body></html>`

  openHTML(html, 'Custom Metric Ranking')
}

// ── Team Squad Report ──────────────────────────────────────────────────────

export function exportSquadReport(players, teamName, competition = '') {
  if (!players?.length) return
  const date = today()

  const byPos = { GK: [], DEF: [], MID: [], FWD: [] }
  players.forEach(p => {
    const pos = p.position_group || 'MID'
    if (byPos[pos]) byPos[pos].push(p)
    else byPos.MID.push(p)
  })

  const posConfig = {
    GK:  { label: 'Goalkeepers',  color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.2)' },
    DEF: { label: 'Defenders',    color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)' },
    MID: { label: 'Midfielders',  color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)' },
    FWD: { label: 'Forwards',     color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
  }

  const avgScore = players.reduce((s, p) => s + (Number(p.score) || 0), 0) / players.length

  const sections = Object.entries(byPos).filter(([, arr]) => arr.length > 0).map(([pos, arr]) => {
    const cfg = posConfig[pos]
    const sorted = [...arr].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
    const cards = sorted.map(p => {
      const sc = Number(p.score) || 0
      const col = scoreColor(sc)
      return `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;border-radius:8px;background:${cfg.bg};border:1px solid ${cfg.border};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <span style="font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:11px;color:${cfg.color}">${pos}</span>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.player_name || '—'}</div>
            <div style="font-size:10px;color:#475569;margin-top:2px">${p.age ? `Age ${p.age}` : '—'} · ${p.nationality || '—'}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:16px;color:${col}">${sc > 0 ? sc.toFixed(1) : '—'}</div>
            <div style="font-size:9px;color:#475569;text-transform:uppercase;letter-spacing:0.08em">${scoreLabel(sc > 0 ? sc : null)}</div>
          </div>
        </div>`
    }).join('')

    return `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap-8px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid ${cfg.border}">
          <span style="font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:13px;color:${cfg.color};text-transform:uppercase;letter-spacing:0.08em">${cfg.label}</span>
          <span style="font-size:11px;color:#334155;margin-left:8px">${arr.length} players</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">${cards}</div>
      </div>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>${teamName} — Squad Report</title>
  <style>${BASE_STYLES}
    .stats-bar { grid-template-columns: repeat(4, 1fr); }
  </style></head><body>
  <div class="header">
    <div class="logo">
      <div class="logo-icon">🛡️</div>
      <div><div class="logo-text">ScoutIQ</div><div class="logo-sub">Football Intelligence</div></div>
    </div>
    <div class="report-meta">
      <div class="report-title">${teamName}</div>
      <div class="report-sub">Squad Report · ${competition || 'All Competitions'} · Generated ${date}</div>
    </div>
  </div>
  <div class="stats-bar">
    <div class="stat-card"><div class="stat-value">${players.length}</div><div class="stat-label">Squad Size</div></div>
    <div class="stat-card"><div class="stat-value">${avgScore.toFixed(1)}</div><div class="stat-label">Avg Score</div></div>
    <div class="stat-card"><div class="stat-value">${byPos.GK.length} · ${byPos.DEF.length} · ${byPos.MID.length} · ${byPos.FWD.length}</div><div class="stat-label">GK · DEF · MID · FWD</div></div>
    <div class="stat-card"><div class="stat-value">${players.filter(p => p.age && p.age <= 23).length}</div><div class="stat-label">U-23 Players</div></div>
  </div>
  ${sections}
  <div class="footer">
    <span>ScoutIQ · Football Intelligence Platform</span>
    <span>${date}</span>
  </div>
  </body></html>`

  openHTML(html, `${teamName} Squad Report`)
}

// ── Squad Planner Visual Report ────────────────────────────────────────────

export function exportSquadPlanReport(slots, planName, teamName = '') {
  if (!slots?.length) return
  const date = today()

  const byPos = { GK: [], DEF: [], MID: [], FWD: [] }
  slots.forEach(s => {
    const pos = s.position_group || 'MID'
    if (byPos[pos]) byPos[pos].push(s)
    else byPos.MID.push(s)
  })

  const posConfig = {
    GK:  { label: 'GK',  fullLabel: 'Goalkeepers',  color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.3)', field: '#1a0d2e' },
    DEF: { label: 'DEF', fullLabel: 'Defenders',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)', field: '#0d1a35' },
    MID: { label: 'MID', fullLabel: 'Midfielders',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',  field: '#0d2218' },
    FWD: { label: 'FWD', fullLabel: 'Forwards',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',  field: '#2e0d0d' },
  }

  const roleColors = { first_team: '#3b82f6', loan: '#f59e0b', academy: '#a855f7' }
  const roleLabels = { first_team: 'First Team', loan: 'On Loan', academy: 'Academy' }

  const posOrder = ['FWD', 'MID', 'DEF', 'GK']
  const fieldSections = posOrder.filter(pos => byPos[pos].length > 0).map(pos => {
    const cfg = posConfig[pos]
    const posSlots = byPos[pos]
    const cards = posSlots.map(s => {
      const sc = Number(s.performance_score) || 0
      const col = scoreColor(sc > 0 ? sc : null)
      const rolecol = roleColors[s.squad_role] || '#3b82f6'
      const rolelbl = roleLabels[s.squad_role] || 'First Team'
      return `
        <div style="background:rgba(6,14,32,0.85);border:1px solid ${cfg.border};border-radius:12px;padding:12px 14px;min-width:160px;max-width:200px;flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};border-radius:999px;font-size:8px;font-weight:800;letter-spacing:0.1em;padding:2px 7px;text-transform:uppercase">${cfg.label}</span>
            <span style="font-size:8px;color:${rolecol};font-weight:700;text-transform:uppercase;letter-spacing:0.06em">${rolelbl}</span>
          </div>
          <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:13px;color:#fff;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.player_name || 'TBD'}</div>
          <div style="font-size:10px;color:#475569;margin-bottom:8px">${s.age ? `Age ${s.age}` : '—'} · ${s.nationality || '—'}</div>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">
              <div style="width:${sc}%;height:100%;background:${col};border-radius:2px"></div>
            </div>
            <span style="font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:12px;color:${col};min-width:28px;text-align:right">${sc > 0 ? sc.toFixed(0) : '—'}</span>
          </div>
        </div>`
    }).join('')

    return `
      <div style="background:${cfg.field};border:1px solid ${cfg.border};border-radius:16px;padding:20px 24px;margin-bottom:12px;position:relative">
        <div style="position:absolute;top:12px;left:16px;font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:11px;color:${cfg.color};opacity:0.6;text-transform:uppercase;letter-spacing:0.12em">${cfg.fullLabel}</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding-top:20px">${cards}</div>
      </div>`
  }).join('')

  // Summary stats
  const totalPlayers = slots.length
  const firstTeam = slots.filter(s => s.squad_role === 'first_team').length
  const loans = slots.filter(s => s.squad_role === 'loan').length
  const academy = slots.filter(s => s.squad_role === 'academy').length
  const scoredPlayers = slots.filter(s => s.performance_score > 0)
  const avgScore = scoredPlayers.length ? scoredPlayers.reduce((a, s) => a + s.performance_score, 0) / scoredPlayers.length : 0
  const u23 = slots.filter(s => s.age && s.age <= 23).length

  // Legend
  const legend = Object.entries(roleColors).map(([k, c]) => `
    <span style="display:inline-flex;align-items:center;gap:5px;margin-right:16px">
      <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0"></span>
      <span style="font-size:10px;color:#64748b">${roleLabels[k]}</span>
    </span>`).join('')

  const scoreBands = [
    ['#22c55e', 'Elite 90+'], ['#14b8a6', 'Top Tier 75+'], ['#3b82f6', 'Above Avg 60+'],
    ['#eab308', 'Average 40+'], ['#f97316', 'Below Avg 25+'], ['#ef4444', 'Developing']
  ].map(([c, l]) => `
    <span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px">
      <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0"></span>
      <span style="font-size:10px;color:#64748b">${l}</span>
    </span>`).join('')

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>${planName}</title>
  <style>${BASE_STYLES}
    .stats-bar { grid-template-columns: repeat(6, 1fr); }
  </style></head><body>
  <div class="header">
    <div class="logo">
      <div class="logo-icon">📋</div>
      <div><div class="logo-text">ScoutIQ</div><div class="logo-sub">Football Intelligence</div></div>
    </div>
    <div class="report-meta">
      <div class="report-title">${planName}</div>
      <div class="report-sub">${teamName ? teamName + ' · ' : ''}Squad Plan · Generated ${date}</div>
    </div>
  </div>

  <div class="stats-bar">
    <div class="stat-card"><div class="stat-value">${totalPlayers}</div><div class="stat-label">Total Players</div></div>
    <div class="stat-card"><div class="stat-value">${firstTeam}</div><div class="stat-label">First Team</div></div>
    <div class="stat-card"><div class="stat-value">${loans}</div><div class="stat-label">On Loan</div></div>
    <div class="stat-card"><div class="stat-value">${academy}</div><div class="stat-label">Academy</div></div>
    <div class="stat-card"><div class="stat-value">${avgScore.toFixed(1)}</div><div class="stat-label">Avg Score</div></div>
    <div class="stat-card"><div class="stat-value">${u23}</div><div class="stat-label">U-23</div></div>
  </div>

  <div style="margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;gap:4px">
    <span style="font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.1em;margin-right:4px">Role:</span>${legend}
    <span style="font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.1em;margin-left:16px;margin-right:4px">Score:</span>${scoreBands}
  </div>

  <div style="position:relative;background:linear-gradient(180deg,rgba(34,197,94,0.03) 0%,rgba(59,130,246,0.03) 100%);border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:8px;margin-bottom:24px">
    ${fieldSections}
  </div>

  <div class="footer">
    <span>ScoutIQ · Football Intelligence Platform · ${planName}</span>
    <span>${date}</span>
  </div>
  </body></html>`

  openHTML(html, planName)
}

// ── Legacy CSV export (kept for backward compat) ───────────────────────────

export function exportToCSV(data, filename) {
  if (!data?.length) return
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h]
        if (val === null || val === undefined) return ''
        if (typeof val === 'string' && (val.includes(',') || val.includes('"')))
          return `"${val.replace(/"/g, '""')}"`
        return val
      }).join(',')
    )
  ].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
