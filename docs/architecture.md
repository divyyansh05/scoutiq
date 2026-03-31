# ScoutIQ — Architecture

## System Overview

```
football-etl-pipeline (data producer — separate repo)
  └── PostgreSQL DB (localhost:5434/football_data)
        └── FastAPI backend (localhost:8000)
              └── React frontend (localhost:5173)

SQLite (backend/data/lists.db)
  └── FastAPI backend (read/write — lists, notes, saved searches only)
```

## Data Flow

1. Pipeline scrapes SofaScore/Understat/ClubElo weekly
2. Analytics layer (compute_scores.py) populates player_scores table every Saturday
3. ScoutIQ backend reads from PostgreSQL (read-only)
4. Frontend fetches from backend API — never touches DB directly
5. User sees ranked, scored player data

## Backend Structure (actual, as of 2026-03-31)

```
backend/
├── main.py                  — FastAPI app, CORS config, router includes
├── config.py                — constants: CHELSEA_TEAM_ID (338), MIN_MINUTES (900),
│                              POSITION_MAP, PERFORMANCE_WEIGHTS, SCATTER_METRICS,
│                              SCORE_LABELS, score_label()
├── .env                     — DATABASE_URL, CHELSEA_TEAM_ID
├── database/
│   ├── __init__.py
│   └── connection.py        — get_engine(), run_query(sql, params) → DataFrame
│                              Pool: size=5, max_overflow=10, pre_ping=True
├── models/                  — ML / analytics computation (NOT Pydantic schemas)
│   ├── performance_score.py — position-weighted 0-100 scoring, computes at query time
│   ├── similarity.py        — cosine similarity (L2-normalised), 13 per-90 features
│   ├── clustering.py        — K-Means k=5 team style clustering on 10 agg features
│   └── talent_detection.py  — young player (U-23 default) cohort percentile filter
├── routers/                 — API route handlers
│   ├── players.py           — /api/players/*
│   ├── teams.py             — /api/teams/*
│   ├── analytics.py         — /api/analytics/*
│   ├── rankings.py          — /api/rankings/
│   ├── search.py            — /api/search/
│   ├── lists.py             — /api/lists/* (SQLite-backed CRUD)
│   └── dashboard.py         — /api/dashboard/*
├── data/
│   └── lists.db             — SQLite (scouting_lists, list_players, player_notes, saved_searches)
└── requirements.txt
```

## Frontend Structure (actual, as of 2026-03-31)

```
frontend/
├── index.html
├── package.json             — React 18, Vite 5, Tailwind 3, react-router-dom 6, Recharts, Axios
├── vite.config.js
├── tailwind.config.js       — custom design tokens (colors, fonts, radius)
├── postcss.config.js
└── src/
    ├── App.jsx              — BrowserRouter, 13 routes, all nested under <Layout />
    ├── main.jsx             — React entry point
    ├── api/
    │   └── client.js        — Axios instance (baseURL: localhost:8000) + all API functions
    ├── components/          — reusable UI
    │   ├── Layout.jsx       — shell: TopNav + <Outlet />
    │   ├── TopNav.jsx       — navigation header with all page links
    │   ├── PlayerCard.jsx   — search result card, per-90 toggle, selection checkbox
    │   ├── PositionBadge.jsx— coloured position pill (5 colours)
    │   ├── ScoreRing.jsx    — SVG circular 0-100 score ring
    │   ├── RadarChart.jsx   — Recharts radar, single or 2-player overlay
    │   └── ComparisonBar.jsx— horizontal bar for up to 4 selected players
    ├── pages/               — 13 page components (one per route)
    │   ├── Dashboard.jsx
    │   ├── PlayerSearch.jsx
    │   ├── PlayerProfile.jsx
    │   ├── SimilarPlayers.jsx
    │   ├── Rankings.jsx
    │   ├── ScatterPlot.jsx
    │   ├── EmergingTalent.jsx
    │   ├── TeamStyle.jsx
    │   ├── ScoutingLists.jsx
    │   ├── LeagueCoverage.jsx
    │   ├── MetricWeighting.jsx
    │   ├── TeamProfile.jsx
    │   └── ChelseaTeam.jsx
    ├── styles/
    │   └── index.css        — Tailwind base directives + custom utilities
    └── utils/
        └── export.js        — exportToCSV(data, filename)
```

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| DB access | Read-only from PostgreSQL | ScoutIQ is a consumer, not a producer |
| Score computation | Python at query time (currently) | player_scores table exists but not yet wired to backend |
| Current season | Dynamic (is_current=TRUE) | Never hardcode season name |
| Lists storage | SQLite | Simple, no multi-user requirement |
| TypeScript | No — plain JSX | Not worth migration for portfolio project |
| Auth | None | Out of scope |
| Real-time | None | Weekly pipeline refresh is sufficient |

## CORS Configuration
Backend allows: http://localhost:5173, http://localhost:3000, http://localhost:5174

## Known Architectural Debt
1. Backend score computation is in Python (models/performance_score.py) but
   the player_scores table in DB has pre-computed values from the pipeline.
   These two systems should be unified — backend should read from DB.
2. config.py still imports os/dotenv unnecessarily after DATABASE_URL removal.
3. SQLite lists.db would need migration to PostgreSQL for multi-user deployment.
4. No query caching — K-Means clustering and similarity runs on every request.
