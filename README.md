# ScoutIQ — Football Intelligence Platform

> Professional-grade football scouting application. Position-weighted performance scoring, in-memory cosine similarity search, squad gap analysis, tactical fit engine, and recruitment pipeline management — powered by real Wyscout match data.

---

## What It Does

ScoutIQ turns raw match statistics into structured scouting intelligence. Built as an applied case study for Chelsea FC / Xabi Alonso recruitment planning.

- **5,818 players** tracked across 15+ competitions
- **686,761 individual match records** from Wyscout
- **21,075 scored player profiles** — zero to 100, position-adjusted, percentile-ranked
- Every number on every screen is live from the database — no mock data

---

## Screens

| Route | Screen | What It Shows |
|---|---|---|
| `/` | Dashboard | Summary KPIs, top performers by competition |
| `/players` | Player Search | Multi-filter search, CSV export, comparison bar |
| `/players/:id` | Player Profile | Full stats, per-90s, radar, similar players, scout notes |
| `/compare` | Comparison Tool | Side-by-side stats table, dual radar, green-highlight best |
| `/similar` | Similar Players | Cosine similarity — same league or all leagues |
| `/talent` | Emerging Talent | U-23 high-percentile performers by competition |
| `/rankings` | Rankings | Statistical leaderboard for any of 20+ metrics |
| `/scatter` | Scatter Plot | Any two metrics plotted, position-filtered |
| `/weighting` | Metric Weighting | Custom composite score via sliders, instant re-rank |
| `/team-style` | Team Style | K-Means clustering — 5 tactical archetypes |
| `/teams/:id` | Team Profile | Squad roster, radar vs league avg, Priority Positions, SWOT |
| `/squad-gap` | Squad Diagnostic | Position-by-position gap analysis, academy candidates |
| `/planner` | Squad Planner | Build future squads, drag players from current roster |
| `/tactical` | Tactical Fit | Score any player against custom KPI presets |
| `/profiles/shortlist` | Profile Shortlist | 11 positional archetypes — Ball-Playing GK, False Nine, etc. |
| `/recruitment` | Recruitment Board | Kanban pipeline — Identified → Scouted → Shortlisted → Signed |
| `/lists` | Scouting Lists | Create and manage player shortlists |
| `/coverage` | Data Coverage | League-by-league data completeness |

---

## Features

### Performance Scoring
- **0–100 composite score** — position-weighted, per-90 normalised, percentile ranked within competition
- **Colour bands:** Elite (90+) · Top Tier (75–89) · Above Avg (60–74) · Average (40–59) · Below Avg (25–39) · Developing (0–24)
- Scores pre-computed by the ETL pipeline and stored in `player_scores` table; read-only at query time

### Similarity Engine
- Cosine similarity on per-90 stat vectors (goals, assists, xG, xA, shots, key passes, dribbles, aerials, tackles, interceptions, recoveries)
- Min-max normalised features, same-position cohort
- Two modes: **Same League** (auto-detects player's primary competition) and **All Leagues** (cross-competition)
- Full player profile fetched on comparison select → radar chart renders real data

### Tactical Fit
- Manager presets stored in SQLite (High Press, Possession, Counter Attack — editable)
- KPI weights summing to 100 across 11 metrics
- Player scored against preset via percentile rank within position cohort
- Breakdown table shows per-KPI contribution

### Squad Diagnostic
- Per-position coverage (GK/DEF/MID/FWD): count, avg score, gap vs league avg
- Status: Adequate / Thin / Critical Gap
- Academy candidates: U-21 players by percentile readiness

### SWOT Analysis
- Auto-generated from real data: squad per-90 stats vs competition average
- Strengths/Weaknesses: metrics >5% above/below league mean
- Opportunities: U-23 players ≥60th percentile
- Threats: key contributors aged 27+

### Recruitment Pipeline
- Kanban board: Identified → Scouted → Shortlisted → Approached → Signed / Rejected
- Add player via search autocomplete (pre-fills all fields from DB)
- Move between stages, add scout notes, view player profile inline
- Persisted in SQLite

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.2, Vite 5.1, Tailwind CSS 3.4, Recharts 2.12, Axios 1.6 |
| Backend | FastAPI 0.110, SQLAlchemy 2.0, Uvicorn 0.27, Pydantic v2 |
| Analytics | scikit-learn 1.4 (K-Means, cosine similarity), pandas 2.2, numpy 1.26 |
| Primary DB | PostgreSQL 15 via football-data-platform (read-only) |
| Lists DB | SQLite — scouting lists, notes, recruitment pipeline, squad plans, tactical presets |
| Data source | Wyscout match-level data via football-data-platform ETL |

---

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 20+
- [football-data-platform](https://github.com/divyyansh05/football-etl-pipeline) running (provides PostgreSQL at port 5434)

### 1. Clone the backend and start the database

```bash
# Clone the backend repository into a folder named football-data-platform
git clone https://github.com/divyyansh05/football-etl-pipeline.git football-data-platform

# Navigate to the folder and start the database
cd football-data-platform
docker compose up -d db
```

### 2. Start ScoutIQ

```bash
cd ~/Projects/scoutiq
./start.sh start
```

Open **http://localhost:5173**

```bash
./start.sh stop      # Stop both servers
./start.sh status    # Check what's running
./start.sh restart   # Restart
```

### 3. Manual start

```bash
# Terminal 1 — Backend (port 8000)
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend (port 5173)
cd frontend
npm install
npm run dev
```

---

## Environment

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5434/football_platform` | PostgreSQL from football-data-platform |
| `CHELSEA_TEAM_ID` | `10` | Team ID for dashboard Chelsea focus |
| `MIN_MINUTES` | `900` | Minimum minutes for performance score eligibility |

---

## API Reference

Interactive docs: **http://localhost:8000/docs**

### Players

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/players/search` | Search with position, competition, age, minutes filters |
| `GET` | `/api/players/{id}` | Full profile — raw totals + per-90s + score |
| `GET` | `/api/players/{id}/similar` | Similar players, same league (auto-detected) |
| `GET` | `/api/players/{id}/similar-global` | Similar players, all leagues |
| `GET` | `/api/players/{id}/seasons` | Competitions available for this player |
| `GET` | `/api/players/compare?ids=1,2` | Side-by-side comparison (2–4 players) |
| `GET` | `/api/players/export` | CSV export |

### Teams

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/teams/{id}` | Team summary + radar aggregate metrics |
| `GET` | `/api/teams/{id}/players` | Full squad with scores |
| `GET` | `/api/teams/{id}/squad-diagnostic` | Position gap analysis |
| `GET` | `/api/teams/{id}/swot` | SWOT from real squad vs league data |
| `GET` | `/api/teams/{id}/priority-positions` | Top 3 positions to recruit |
| `GET` | `/api/teams/styles` | K-Means team style clusters |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/rankings/` | Statistical leaderboard for any metric |
| `GET` | `/api/analytics/scatter` | Scatter data (x/y metric, position filter) |
| `GET` | `/api/analytics/talents` | Emerging talent (U-N, top percentile) |
| `POST` | `/api/analytics/weighted-ranking` | Custom composite score ranking |
| `GET` | `/api/profiles/` | List all 11 positional archetypes |
| `GET` | `/api/profiles/{key}/players` | Players ranked by archetype fit score |

### Tactical & Planner

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tactical/presets` | List manager presets |
| `POST` | `/api/tactical/presets` | Create preset |
| `GET` | `/api/tactical/presets/{id}/fit/{player_id}` | Score player against preset |
| `GET` | `/api/planner/plans` | List squad plans |
| `POST` | `/api/planner/plans` | Create plan |
| `GET` | `/api/planner/teams/{team_id}/current-squad` | Import team's current roster |

### Other

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/competitions` | All competitions with data |
| `GET` | `/api/leagues` | Competitions with match counts |
| `GET` | `/api/dashboard/stats` | Platform KPI summary |
| `GET` | `/api/dashboard/top-performers` | Top scored players by competition |
| `GET` | `/api/lists/` | Scouting lists CRUD |
| `GET` | `/api/recruitment/` | Recruitment pipeline |
| `GET` | `/health` | Service health |

---

## Project Structure

```
scoutiq/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, router registration
│   ├── config.py                # Constants, position map, score bands
│   ├── database/
│   │   └── connection.py        # PostgreSQL engine, run_query(), SQLite helpers
│   ├── models/
│   │   ├── performance_score.py # Reads pre-computed scores from player_scores table
│   │   ├── similarity.py        # Cosine similarity (pgvector ready, Python fallback)
│   │   ├── clustering.py        # K-Means team style on team_match_stats
│   │   ├── talent_detection.py  # U-N high-percentile player detection
│   │   └── valuation.py         # Market value estimation
│   └── routers/
│       ├── players.py           # Search, profile, similar, compare, export
│       ├── teams.py             # Profile, players, diagnostic, SWOT, priority positions
│       ├── analytics.py         # Scatter, weighted ranking, emerging talent
│       ├── rankings.py          # Statistical leaderboards from player_match_stats
│       ├── profiles.py          # 11 positional archetypes with fit scoring
│       ├── tactical.py          # Manager presets + player fit scoring
│       ├── planner.py           # Squad planning (SQLite)
│       ├── lists.py             # Scouting lists + recruitment pipeline (SQLite)
│       ├── leagues.py           # Competition profiles
│       ├── dashboard.py         # KPIs, top performers, coverage
│       ├── reports.py           # PDF scouting reports
│       ├── search.py            # Global search (players + teams)
│       └── meta.py              # Competitions/seasons endpoint
├── frontend/
│   └── src/
│       ├── pages/               # 18 page components
│       ├── components/          # Layout, TopNav, RadarChart, ScoreRing, etc.
│       ├── hooks/               # useSeasons, useLeagues, useApiError
│       ├── api/client.js        # Centralised Axios calls for every endpoint
│       └── utils/               # export.js, format.js
├── docs/
│   ├── MASTER_WIKI.md           # Full technical documentation
│   ├── scout_iq_presentor.md    # Screen-recording script (Chelsea case study)
│   └── Bugs.md                  # Bug log and resolutions
├── docker-compose.yml
├── start.sh
└── README.md
```

---

## Data Architecture

```
football-data-platform (separate repo — populates the DB)
    │
    ▼
PostgreSQL 15 @ localhost:5434/football_platform
    │
    ├── players              — 5,818 players (name, position_group, DOB, team, nationality)
    ├── player_match_stats   — 686,761 match records (goals, xG, xA, tackles, dribbles, etc.)
    ├── player_scores        — 21,075 scored profiles (performance_score, percentile_rank, p90 stats)
    ├── team_match_stats     — team-level match aggregates (xG, shots, crosses, result)
    ├── competitions         — competition reference (Premier League, La Liga, UCL, etc.)
    ├── teams                — team reference
    └── seasons              — season reference
    │
    ▼
ScoutIQ Backend (FastAPI, read-only)
    │
    └── SQLite @ backend/data/lists.db
        ├── scouting_lists + list_players
        ├── player_notes
        ├── saved_searches
        ├── recruitment_pipeline
        ├── squad_plans + plan_players
        └── manager_presets
    │
    ▼
ScoutIQ Frontend (React 18 @ localhost:5173)
```

---

## Applied Case Study: Chelsea FC / Xabi Alonso

The platform's primary demo scenario is: *Chelsea FC preparing for 2026-27 under Xabi Alonso (3-4-2-1).*

Real data findings from the platform:
- **Cucurella audit:** 0.32 dribbles/90, 0.31 key passes/90 in EPL — below wing-back profile threshold
- **Frimpong target:** 2.60 dribbles/90, 1.16 key passes/90 — top attacking DEF in EPL
- **Saliba target:** 94.4% pass accuracy — highest among EPL centre-backs with 2000+ mins
- **Rodri benchmark:** 93.2% pass accuracy, 4.13 interceptions/90 — gold standard midfield controller
- **Palmer output:** 46 goals + 19 assists across 107 EPL appearances

Full recording script: [`docs/scout_iq_presentor.md`](docs/scout_iq_presentor.md)

---

## Related

- [football-data-platform](https://github.com/divyyansh05/football-etl-pipeline) — Database platform and ETL that populates the PostgreSQL database

---

**MSc Sports Analytics — Universidad Europea de Madrid.**
