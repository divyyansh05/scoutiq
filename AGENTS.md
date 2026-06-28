# ScoutIQ — Agent Instructions

## What This Project Is
ScoutIQ is a professional football scouting web application.
Frontend: React 18 + JSX + Tailwind CSS (port 5173, location: frontend/)
Backend:  FastAPI + Python + SQLAlchemy (port 8000, location: backend/)
Data:     football-data-platform API at http://localhost:8000 (READ-ONLY)
          PostgreSQL at localhost:5434/football_platform (accessed via API only)
Lists:    SQLite at backend/data/lists.db (read/write — scouting lists only)

## How To Start Development
```bash
bash scripts/dev.sh
```
Or manually:
```bash
# Terminal 1 — Backend
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

## Read These Before Every Session
1. .claude/skills/migration-playbook.md            — ⚡ READ FIRST. Full DB migration guide + execution order
2. .claude/CLAUDE.md                              — project state, current phase, known issues
3. .claude/rules/backend.md                       — FastAPI, SQLAlchemy, SQL rules
4. .claude/rules/frontend.md                      — React, Tailwind, component rules
5. .claude/rules/data.md                          — exact DB schema and column names
6. .claude/rules/ux.md                            — scouting UX conventions and domain vocab
7. .claude/skills/pipeline-data.md                — data availability and SQL patterns
8. .claude/skills/scouting-domain.md              — football analytics concepts
9. .claude/skills/football-data-platform-api.md   — ⚡ NEW PRIMARY DATA SOURCE API reference

## Architecture (never deviate)
Frontend → Backend API (/api/*) → PostgreSQL (read-only)
No direct DB access from frontend.
No mock data — every screen queries the real pipeline DB.

## Database (read-only)
postgresql://postgres:postgres@localhost:5434/football_data
Main tables: players, player_season_stats, player_scores, teams, leagues, seasons, team_elo
Gold view:   v_players_current_season (use as default for current-season queries)

## API Routes (what currently exists)
GET  /health                            — health check
GET  /api/players/search                — player search with filters
GET  /api/players/{player_id}           — player profile
GET  /api/players/{player_id}/seasons   — player's season history
GET  /api/players/{player_id}/similar   — cosine similarity matches
GET  /api/players/{player_id}/adaptability — team fit analysis
GET  /api/teams/styles                  — K-Means team clustering
GET  /api/teams/chelsea                 — Chelsea focus stats
GET  /api/teams/chelsea/full            — full Chelsea roster
GET  /api/teams/{team_id}               — team aggregated stats
GET  /api/teams/{team_id}/players       — team roster
GET  /api/analytics/scores              — top performers by score
GET  /api/analytics/talents             — emerging talent (young players)
GET  /api/analytics/scatter             — scatter plot data
POST /api/analytics/weighted-ranking    — custom composite ranking
GET  /api/rankings/                     — leaderboard for any of 25 metrics
GET  /api/search/                       — global player + team search
GET/POST   /api/lists/                  — scouting list CRUD
DELETE     /api/lists/{list_id}
GET/POST   /api/lists/{list_id}/players
DELETE     /api/lists/{list_id}/players/{player_id}
GET/POST   /api/lists/notes/{player_id} — scout notes (SQLite)
GET/POST/DELETE /api/lists/searches/    — saved searches (SQLite)
GET  /api/dashboard/stats               — DB coverage summary
GET  /api/dashboard/top-performers      — top N scored players
GET  /api/dashboard/coverage            — per-league coverage breakdown

## Missing (build these)
- GET /api/players/compare?player_a_id=X&player_b_id=Y — side-by-side comparison
- GET /api/leagues — league list with data availability
- /compare frontend page — side-by-side player comparison

## Current Build Priority (update at end of each session)
1. Wire backend to read player_scores from DB instead of recomputing at query time
2. Add /api/players/compare endpoint
3. Add /compare frontend page (Player A | Metric | Player B layout)

## Active Decisions
- No authentication (portfolio project scope)
- No real-time updates (weekly pipeline refresh is sufficient)
- Desktop-first layout (responsive is nice-to-have)
- No TypeScript migration (plain JSX throughout)
- No video integration

## Dead Code / Do Not Resurrect
- FotMob scraper in pipeline: permanently dead (HMAC auth added)
- FBref: permanently blocked (403 Cloudflare)
- Any reference to /api/v1/ prefix: backend does not use this prefix

## Pipeline Data Context
Data comes from ~/Projects/football-data-platform (primary) via API at http://localhost:8000.
NEVER query football_data or football_etl_pipeline directly — use the API.

  Players:           5,818  (up from 632 — full 5-season European dataset)
  Player match rows: 686,761 with match_date, competition, and 331 stats per row
  Teams:             173
  Competitions:      6 (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League)
  Seasons:           5 (2021 to 2025, inclusive)
  Player scores:     21,076 position-aware percentile scores

Full API contract: .claude/skills/football-data-platform-api.md
