# ScoutIQ — Master Wiki & Reference Document

> **Document Classification:** Master's Thesis Reference — Sports Analytics  
> **Application Version:** ScoutIQ v1.0 (Production Build, 2025–2026 Season Data)  
> **Author:** Divyansh Shrivastava  
> **Last Updated:** 2026-06-28  

---

## Table of Contents

1. [Section 1: ScoutIQ App Workflow & Capabilities](#section-1-scoutiq-app-workflow--capabilities)
   1. [1.1 System Architecture Overview](#11-system-architecture-overview)
   2. [1.2 Data Coverage & Integration](#12-data-coverage--integration)
   3. [1.3 Complete UI/UX Workflow — Screen-by-Screen (20 Pages)](#13-complete-uiux-workflow--screen-by-screen)
      - 1.3.1 Dashboard (`/`)
      - 1.3.2 Player Search (`/players`)
      - 1.3.3 Player Profile (`/players/:id`)
      - 1.3.4 Similar Players (`/similar`)
      - 1.3.5 Rankings (`/rankings`)
      - 1.3.6 Scatter Plot (`/scatter`)
      - 1.3.7 Emerging Talent (`/talent`)
      - 1.3.8 Team Style — K-Means Clustering (`/team-style`)
      - 1.3.9 Scouting Lists (`/lists`)
      - 1.3.10 League Coverage (`/coverage`)
      - 1.3.11 Metric Weighting (`/weighting`)
      - 1.3.12 Team Profile (`/teams/:teamId`)
      - 1.3.13 Chelsea Team (`/chelsea`)
      - 1.3.14 Compare Page (`/compare`)
      - 1.3.15 League Profile (`/leagues/:leagueId`)
      - 1.3.16 Recruitment Board (`/recruitment`)
      - 1.3.17 Tactical Fit (`/tactical`)
      - 1.3.18 Squad Gap Analysis (`/squad-gap`)
      - 1.3.19 Profile-Driven Shortlist (`/profiles/shortlist`)
      - 1.3.20 Squad Planner (`/planner`)
   4. [1.4 Analytical Models & Algorithms](#14-analytical-models--algorithms)
   5. [1.5 Action-by-Action Mapping](#15-action-by-action-mapping)
2. [Section 2: Chelsea FC Case Study — The Xabi Alonso Era (2026/2027)](#section-2-chelsea-fc-case-study--the-xabi-alonso-era-20262027)
   1. [2.1 Managerial Profiling — Xabi Alonso](#21-managerial-profiling--xabi-alonso)
   2. [2.2 Current Squad Audit & Sales](#22-current-squad-audit--sales)
   3. [2.3 Targeted Acquisitions — The Buy List](#23-targeted-acquisitions--the-buy-list)
   4. [2.4 The 2026/2027 Starting XI](#24-the-20262027-starting-xi)

---

# Section 1: ScoutIQ App Workflow & Capabilities

## 1.1 System Architecture Overview

ScoutIQ is a full-stack football scouting intelligence platform built on a three-tier architecture with strict separation of concerns. The system is designed for professional performance analysts and scouting departments at football clubs.

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React + JSX | 18.2.0 | Single-page application (SPA) |
| **Build Tool** | Vite | 5.1.6 | Hot module replacement, fast dev builds |
| **CSS Framework** | Tailwind CSS | 3.4.1 | Utility-first styling with custom design tokens |
| **Routing** | react-router-dom | 6.22.2 | Client-side routing (BrowserRouter) |
| **HTTP Client** | Axios | 1.6.7 | API communication (baseURL: `http://localhost:8000`, 30s timeout) |
| **Charting** | Recharts | 2.12.2 | Radar charts, scatter plots, pie charts, bar charts |
| **Icons** | Lucide React | 0.358.0 | Icon system |
| **Backend** | FastAPI | 0.110.0 | REST API framework |
| **Server** | Uvicorn | 0.27.1 | ASGI server |
| **Database ORM** | SQLAlchemy | 2.0.28 | Connection pooling, query execution |
| **DB Driver** | psycopg2-binary | 2.9.9 | PostgreSQL adapter |
| **Analytics** | scikit-learn | 1.4.1 | Cosine similarity, K-Means clustering |
| **Data Processing** | pandas | 2.2.1 | DataFrame-based query results |
| **Validation** | Pydantic v2 | 2.6.3 | Request/response schema validation |

### Data Flow Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌───────────────────────────┐
│   React SPA     │  HTTP   │   FastAPI         │  SQL    │  PostgreSQL               │
│   (Port 5173)   │ ──────► │   (Port 8000)     │ ──────► │  (Port 5434)              │
│                 │  JSON   │                   │  pandas │  football_data DB          │
│   Axios Client  │ ◄────── │   /api/* routes   │ ◄────── │  READ-ONLY                │
└─────────────────┘         │                   │         └───────────────────────────┘
                            │   SQLite          │
                            │   (lists.db)      │ ◄── Scouting Lists (CRUD)
                            └──────────────────┘
```

**Critical Architectural Constraint:** ScoutIQ operates in **strict read-only mode** against the PostgreSQL database. All data originates from the upstream `football-etl-pipeline` project, which ingests, normalises, and stores match-level and season-level statistics from multiple data providers. ScoutIQ never performs INSERT, UPDATE, or DELETE operations against the primary data store. The only write operations occur against a local SQLite database (`backend/data/lists.db`) for managing user-created scouting lists, player notes, and saved searches.

### Connection Pool Configuration

The database connection layer (`backend/database/connection.py`) manages a SQLAlchemy engine with the following pool parameters:

- **pool_size:** 5 concurrent connections
- **max_overflow:** 10 additional connections under load
- **pool_pre_ping:** True (connection health check before query execution)

All database queries are executed through a centralised `run_query(sql, params)` function that returns a pandas DataFrame. On exception, it logs the full traceback and returns an empty DataFrame, ensuring the API layer never exposes raw database errors.

---

## 1.2 Data Coverage & Integration

### Data Providers

ScoutIQ aggregates data from three independent football data providers, each contributing distinct statistical dimensions:

| Provider | Data Type | Coverage | Key Metrics |
|----------|-----------|----------|-------------|
| **SofaScore** | Event data + match ratings | Primary source for all leagues | `sofascore_rating` (0.0–10.0), duels, aerial contests, tackles, saves, clearances, key passes, shots, accurate passes % |
| **Understat** | Expected metrics (xG model) | Premier League, La Liga | `xg`, `npxg` (non-penalty xG), `xa`, `xg_chain`, `xg_buildup` |
| **FotMob** | Supplementary event data | Variable by league | Cross-validation of core event counts |

Each player-season record in the `player_season_stats` table carries three boolean flags — `sofascore_collected`, `understat_collected`, `fotmob_collected` — enabling the application to signal data completeness to the user and handle NULL values appropriately.

### League Coverage (as of 2025–2026 Season)

| League | Country | Seasons Available | Players per Season | Data Completeness |
|--------|---------|-------------------|--------------------|-------------------|
| **Premier League** | England | 2022-23, 2023-24, 2024-25, 2025-26 | 174–184 | Full (SofaScore + Understat) |
| **La Liga** | Spain | 2022-23, 2023-24 (partial) | 189 / 105 | 2022-23 complete; 2023-24 partial (HTTP 403 interrupted ingestion) |
| **Serie A** | Italy | Pending | — | Pipeline scheduled |
| **Bundesliga** | Germany | Pending | — | Pipeline scheduled |
| **Ligue 1** | France | Pending | — | Pipeline scheduled |

**Total Data Volume:** 632 unique players across 1,016 `player_season_stats` rows.

### Metric Depth — Complete Statistical Catalogue

ScoutIQ's database schema captures **40+ raw statistical columns** per player per season per league. These are grouped into functional categories:

#### Scoring & Chance Creation
| Metric | Column | Type | Description |
|--------|--------|------|-------------|
| Goals | `goals` | INTEGER | Total goals scored |
| Assists | `assists` | INTEGER | Total assists |
| Shots | `shots` | INTEGER | Total shots attempted |
| Shots on Target | `shots_on_target` | INTEGER | Shots hitting the frame or saved |
| Shots Inside Box | `shots_inside_box` | INTEGER | Shots from inside the 18-yard box |
| Shots Outside Box | `shots_outside_box` | INTEGER | Long-range attempts |
| Expected Goals | `xg` | NUMERIC(8,3) | Understat xG model output |
| Non-Penalty xG | `npxg` | NUMERIC(8,3) | xG excluding penalty attempts |
| Expected Assists | `xa` | NUMERIC(8,3) | Understat xA model output |
| xG Chain | `xg_chain` | NUMERIC | Involvement in possessions ending in a shot |
| xG Buildup | `xg_buildup` | NUMERIC | Contribution to possession buildup leading to shots |
| Key Passes | `key_passes` | INTEGER | Passes directly leading to a shot |
| Big Chances Created | `big_chances_created` | INTEGER | Clear goal-scoring opportunities created |
| Big Chances Missed | `big_chances_missed` | INTEGER | Clear chances not converted |

#### Defensive Actions
| Metric | Column | Type | Description |
|--------|--------|------|-------------|
| Tackles | `tackles` | INTEGER | Total tackle attempts |
| Tackles Won | `tackles_won` | INTEGER | Successful tackles |
| Tackles Won % | `tackles_won_pct` | NUMERIC | Success rate |
| Interceptions | `interceptions` | INTEGER | Passes intercepted |
| Clearances | `clearances` | INTEGER | Defensive clearances |
| Recoveries | `recoveries` | INTEGER | Ball recoveries |
| Blocks | — | — | Included in defensive aggregates |
| Error Leading to Goal | `error_lead_to_goal` | INTEGER | Direct errors resulting in opposition goals |

#### Duelling & Physical
| Metric | Column | Type | Description |
|--------|--------|------|-------------|
| Aerial Duels Won | `aerial_duels_won` | INTEGER | Headers won |
| Aerial Duels Lost | `aerial_duels_lost` | INTEGER | Headers lost |
| Aerial Win % | `aerial_win_pct` | NUMERIC(5,2) | Aerial success rate |
| Ground Duels Won | `ground_duels_won` | INTEGER | Ground contests won |
| Ground Duels Lost | `ground_duels_lost` | INTEGER | Ground contests lost |
| Ground Duels Won % | `ground_duels_won_pct` | NUMERIC | Ground duel success |
| Total Duels Won | `duels_won` | INTEGER | All duels won |
| Total Duels Won % | `duels_won_pct` | NUMERIC | Overall duel success rate |
| Fouls Committed | `fouls_committed` | INTEGER | Fouls conceded |
| Fouls Won | `fouls_won` | INTEGER | Fouls drawn |
| Dispossessed | `dispossessed` | INTEGER | Times dispossessed by opponent |
| Dribbled Past | `dribbled_past` | INTEGER | Times beaten by a dribble (defensive) |

#### Passing & Possession
| Metric | Column | Type | Description |
|--------|--------|------|-------------|
| Accurate Passes % | `accurate_passes_pct` | NUMERIC(5,2) | Pass completion rate |
| Accurate Long Balls | `accurate_long_balls` | INTEGER | Successful long passes |
| Accurate Final Third Passes | `accurate_final_third` | INTEGER | Successful passes into final third |
| Successful Dribbles | `successful_dribbles` | INTEGER | Completed take-ons |
| Touches | `touches` | INTEGER | Total ball contacts |
| Possession Won Att Third | `possession_won_att_third` | INTEGER | Ball recoveries in the attacking third |

#### Goalkeeping
| Metric | Column | Type | Description |
|--------|--------|------|-------------|
| Saves | `saves` | INTEGER | Shots saved |
| Save % | `save_pct` | NUMERIC | Save percentage |
| Goals Conceded | `goals_conceded` | INTEGER | Goals let in |
| Clean Sheets | `clean_sheets` | INTEGER | Matches without conceding |
| Punches | `punches` | INTEGER | Punched clearances |
| High Claims | `high_claims` | INTEGER | Crosses claimed at height |

#### Match Context
| Metric | Column | Type | Description |
|--------|--------|------|-------------|
| Minutes | `minutes` | INTEGER | Total minutes played |
| Matches Played | `matches_played` | INTEGER | Appearances |
| Matches Started | `matches_started` | INTEGER | Starting XI appearances |
| SofaScore Rating | `sofascore_rating` | NUMERIC(4,2) | Average match rating (6.0–10.0 scale) |

### Per-90 Normalisation

The `player_scores` table (populated by the upstream pipeline's `compute_scores.py` analytics module) stores pre-computed per-90 normalised metrics:

| Per-90 Metric | Column | Calculation |
|---------------|--------|-------------|
| Goals/90 | `goals_p90` | `(goals / minutes) × 90` |
| Assists/90 | `assists_p90` | `(assists / minutes) × 90` |
| xG/90 | `xg_p90` | `(xg / minutes) × 90` |
| xA/90 | `xa_p90` | `(xa / minutes) × 90` |
| Shots/90 | `shots_p90` | `(shots / minutes) × 90` |
| Key Passes/90 | `key_passes_p90` | `(key_passes / minutes) × 90` |
| Tackles/90 | `tackles_p90` | `(tackles / minutes) × 90` |
| Interceptions/90 | `interceptions_p90` | `(interceptions / minutes) × 90` |
| Aerial Won/90 | `aerial_won_p90` | `(aerial_duels_won / minutes) × 90` |
| Successful Dribbles/90 | `successful_dribbles_p90` | `(successful_dribbles / minutes) × 90` |
| Recoveries/90 | `recoveries_p90` | `(recoveries / minutes) × 90` |

### The Gold View — `v_players_current_season`

The database provides a materialised view named `v_players_current_season` that serves as the starting point for the majority of ScoutIQ's queries. This view performs a multi-table JOIN across:

- `players` — identity and biographical data
- `player_season_stats` — raw season statistics
- `teams` — club information
- `leagues` — competition context
- `seasons` — temporal context (filtered to `is_current = TRUE`)
- `player_scores` — pre-computed per-90 metrics and composite scores

The view applies two filters:
1. **`is_current = TRUE`** — restricts to the active season only
2. **`minutes >= 450`** — excludes players with insufficient sample size

This view exposes a computed `age` column derived dynamically from `EXTRACT(YEAR FROM AGE(date_of_birth))`, ensuring age is never stored as a static value.

---

## 1.3 Complete UI/UX Workflow — Screen-by-Screen

ScoutIQ's frontend renders 13 distinct pages, each accessible via client-side routing. The application shell uses a persistent `<Layout>` component wrapping all routes, providing a consistent navigation header (`<TopNav>`) and content outlet. The design language is dark-themed, built on custom Tailwind CSS tokens:

- **Typography:** Space Grotesk (headlines), Inter (body text)
- **Colour Palette:** Custom tokens — `primary` (blue), `secondary`, `tertiary` (magenta), `surface-*` variants, `background`, `on-surface`, `outline-variant`
- **Border Radius:** Custom scale (sm/md/lg/xl/2xl/full)

### 1.3.1 The Dashboard — Home Screen (`/`)

**API Endpoint:** `GET /api/dashboard/stats`

The Dashboard is the analyst's command centre. On mount, the page fires a single API call to `/api/dashboard/stats` which returns an aggregated statistics payload. The screen is divided into the following sections:

#### Summary Stat Cards (Top Row)
Four headline metric cards displayed horizontally:

| Card | Metric | Visual Treatment |
|------|--------|-----------------|
| Total Players | Count of all players in the current season | Large numeral with subtle animation on load |
| Active Leagues | Count of leagues with data | Numeral with league icon |
| Avg Performance Score | Mean composite score across all qualifying players | ScoreRing component (small variant) |
| Top Scorer | Highest-scoring player by performance_score | Player name + ScoreRing |

#### Top Performers Widget
A ranked list of the **top 10 players** by composite performance score. Each row displays:
- **Rank number** (1–10)
- **Player name** (linked to `/players/:id`)
- **Team name**
- **PositionBadge** — colour-coded pill: GK (purple `#a855f7`), DEF (blue `#3b82f6`), MID (green `#22c55e`), FWD (red `#ef4444`)
- **ScoreRing** — SVG circular ring rendered at 48×48px, filled proportionally to the 0–100 score, colour-coded by band:
  - Elite (90+): green `#22c55e`
  - Top Tier (75–89): teal
  - Above Average (60–74): blue
  - Average (40–59): yellow
  - Below Average (25–39): orange
  - Developing (0–24): red `#ef4444`

#### Chelsea Focus Widget
A dedicated panel showing Chelsea FC (team_id=338) squad-level aggregate statistics. This widget provides at-a-glance monitoring of the user's primary club interest. Displays:
- Squad size and average age
- Average performance score with ScoreRing
- Top 3 Chelsea performers by score

#### Distribution Charts
Two Recharts **pie charts** rendered side by side:
- **League Distribution:** proportion of players by league
- **Position Distribution:** breakdown by position group (GK/DEF/MID/FWD)

Both charts use the application's custom colour tokens and display percentage labels on hover.

#### Recent Scouting Activity
A feed of the user's most recent interactions with the Scouting Lists system — recently added players, newly created lists, and saved searches.

#### Navigation Menu (TopNav)
The persistent `<TopNav>` component spans the full width of the viewport and provides navigation links to all 13 pages:

| Nav Item | Route | Icon |
|----------|-------|------|
| Dashboard | `/` | Home |
| Search | `/players` | Search |
| Rankings | `/rankings` | Trophy |
| Scatter | `/scatter` | Scatter chart |
| Talent | `/talent` | Star |
| Team Style | `/team-style` | Users |
| Lists | `/lists` | List |
| Coverage | `/coverage` | Globe |
| Weighting | `/weighting` | Sliders |
| Chelsea | `/chelsea` | Shield |

---

### 1.3.2 Player Search & Filtering Engine (`/players`)

**API Endpoint:** `GET /api/players/search`

The Player Search page is the primary discovery interface. It combines a powerful multi-dimensional filter engine with a paginated results grid.

#### Filter Panel (Left Sidebar or Top Bar)

The search interface exposes **8 independent filter controls**, each of which triggers a re-query of the API when modified:

| # | Filter | Control Type | Options / Range | Default |
|---|--------|-------------|----------------|---------|
| 1 | **Search Text** | Text input with debounce | Free text — searches against `player_name` (case-insensitive, accent-normalised via `player_name_norm`) | Empty |
| 2 | **Position** | Tab group (mutually exclusive segments) | `All` / `GK` / `DEF` / `MID` / `FWD` | `All` |
| 3 | **League** | Dropdown select | Dynamically populated from `leagues` table | All Leagues |
| 4 | **Nationality** | Dropdown select or searchable combobox | Dynamically populated from `players.nationality` distinct values | All |
| 5 | **Min Age** | Numeric input or slider | 15–45 | None |
| 6 | **Max Age** | Numeric input or slider | 15–45 | None |
| 7 | **Min Minutes** | Numeric input | 0–3420 | 900 (matches `MIN_MINUTES` in backend config) |
| 8 | **Preferred Foot** | Dropdown or toggle | `All` / `Left` / `Right` / `Both` | `All` |

**Sort Options:** The results can be sorted by any of the following columns:
- Performance Score (default, descending)
- Player Name (alphabetical)
- Age
- Minutes Played
- Goals
- Assists
- xG
- xA
- SofaScore Rating

#### What Happens When a Filter is Applied

1. **User Action:** The analyst clicks the `MID` position tab.
2. **State Update:** React state updates `positionFilter` to `"MID"`.
3. **API Call:** After a brief debounce (typically 300ms for text, immediate for tabs), the component fires `searchPlayers({ position: "MID", league: currentLeague, ... })`.
4. **Backend Query:** The FastAPI router constructs a parameterised SQL query against `v_players_current_season` with a `WHERE position_group = :position` clause appended. The query always includes `AND minutes >= :min_minutes`.
5. **Response:** A JSON array of player objects is returned, each containing: `player_id`, `player_name`, `team_name`, `league_name`, `position_group`, `nationality`, `age`, `minutes`, `performance_score`, `percentile_rank`, and key per-90 stats.
6. **Visual Update:** The results grid re-renders with `<PlayerCard>` components. A loading spinner appears during the fetch. If zero results are returned, an empty-state message is displayed.

#### Results Grid — The PlayerCard Component

Each search result is rendered as a `<PlayerCard>` — a self-contained card component implementing the scouting domain's visual hierarchy:

1. **Player Name** — largest text, bold, linked to `/players/:id`
2. **Club + League** — subtitle row with team name and league name
3. **Position Badge + Age + Nationality** — horizontal row of metadata chips. PositionBadge is colour-coded.
4. **Performance Score Ring** — the most visually prominent element. SVG ring at 64×64px with the numeric score centred inside. Background ring in muted grey; foreground arc coloured by score band.
5. **Key Per-90 Stats** — 3–4 position-relevant statistics displayed below the score:
   - **FWD:** xG/90, Goals/90, Shots/90
   - **MID:** KP/90, xA/90, Tackles/90
   - **DEF:** Aerials/90, Tackles/90, Interceptions/90
   - **GK:** Rating, Saves/90
6. **Per-90 Toggle** — a switch that toggles between raw totals and per-90 normalised values

#### CSV Export
A dedicated export button in the toolbar triggers `exportToCSV(data, filename)` from `frontend/src/utils/export.js`, generating a downloadable CSV file containing all currently filtered results with their full statistical profiles.

#### Comparison Bar
At the bottom of the screen, a persistent `<ComparisonBar>` component allows the analyst to select up to **4 players** for side-by-side comparison. Each PlayerCard includes an "Add to Compare" button. Selected players appear as chips in the ComparisonBar. When the analyst has 2+ players selected, a "Compare" action becomes available.

---

### 1.3.3 Player Profile Page (`/players/:id`)

**API Endpoint:** `GET /api/players/{id}/profile`

The Player Profile is the deepest analytical view in ScoutIQ, providing a comprehensive single-player dossier. It is the page an analyst lands on when they click a player's name anywhere in the application.

#### Header Section
A full-width hero section containing:
- **Player Name** — H1, Space Grotesk, prominently sized
- **Team Badge + Team Name** — club identification
- **League Name** — competition context
- **Nationality Flag + Nationality Name**
- **Biographical Data Row:**
  - Age (dynamically computed, never static)
  - Height (cm)
  - Preferred Foot
  - Shirt Number
  - Position (with PositionBadge)

#### Performance Score Ring (Primary Visual)
A large-format `<ScoreRing>` component (96×96px or larger) positioned prominently. The ring displays:
- The numeric composite score (0–100) centred inside the ring
- The arc fill percentage and colour corresponding to the score band
- A textual label below: "Elite", "Top Tier", "Above Average", "Average", "Below Average", or "Developing"
- A context note: **"900+ mins qualifying threshold"**

#### Radar Chart — Player vs. League Average

The `<RadarChart>` component renders a 6-axis Recharts `<Radar>` chart comparing the player's per-90 statistics against the league average for their position group. The six axes are selected based on the player's position:

**For Forwards (FWD):**
1. xG/90
2. Goals/90
3. Shots/90
4. Key Passes/90
5. Successful Dribbles/90
6. Aerial Won/90

**For Midfielders (MID):**
1. Key Passes/90
2. xA/90
3. Tackles/90
4. Interceptions/90
5. Accurate Passes %
6. Successful Dribbles/90

**For Defenders (DEF):**
1. Tackles/90
2. Interceptions/90
3. Aerial Won/90
4. Clearances/90
5. Accurate Passes %
6. Recoveries/90

**For Goalkeepers (GK):**
1. Saves/90
2. Save %
3. Clean Sheets
4. High Claims
5. Punches
6. SofaScore Rating

The radar uses two overlaid polygon fills:
- **Player polygon:** filled in the primary blue (`#3b82f6`) with 30% opacity
- **League average polygon:** filled in grey with 20% opacity, dashed border

**Tooltip on hover:** When the analyst hovers over any axis endpoint, a tooltip displays:
- Metric name (e.g., "xG/90")
- Player's value (to 2 decimal places)
- League average value (to 2 decimal places)
- Percentile rank within position cohort

The radar chart also supports **comparison mode** — when a second player is overlaid (via the comparison workflow), a second polygon in tertiary magenta is rendered, enabling visual comparison across all six axes.

#### KPI Table — Complete Statistical Breakdown

Below the radar, a comprehensive table presents every available statistic for the player:

| Category | Metrics Displayed |
|----------|-------------------|
| **Scoring** | Goals, xG, npxG, Shots, Shots on Target, Shots Inside Box, Big Chances Missed |
| **Creation** | Assists, xA, Key Passes, Big Chances Created, xG Chain, xG Buildup |
| **Passing** | Accurate Passes %, Accurate Long Balls, Accurate Final Third Passes |
| **Dribbling** | Successful Dribbles, Touches, Possession Won Att Third |
| **Duelling** | Aerial Win %, Ground Duels Won %, Total Duels Won %, Dispossessed, Dribbled Past |
| **Defending** | Tackles, Tackles Won %, Interceptions, Clearances, Recoveries, Error Lead to Goal |
| **Discipline** | Fouls Committed, Fouls Won |
| **GK** (if applicable) | Saves, Save %, Goals Conceded, Clean Sheets, Punches, High Claims |
| **Match** | Minutes, Matches Played, Matches Started, SofaScore Rating |

Each row shows:
- The metric name
- Raw total value
- Per-90 normalised value (when the per-90 toggle is active)
- A subtle inline bar chart showing the player's percentile rank within their position cohort

**NULL Handling:** Any metric where data has not been collected (e.g., Understat xG for a player in an uncovered league) is displayed as **"—"** — never as "0" or blank.

#### Player Notes (Auto-Saved)
A multi-line text area at the bottom of the profile allows the analyst to write free-form scouting notes. These notes are persisted to the SQLite database (`player_notes` table) via `PUT /api/lists/notes/{playerId}`. Notes auto-save on blur or after a 2-second debounce, providing a seamless annotation experience.

#### Similar Players Panel
A sidebar or bottom panel displays the **top 5 most similar players** as computed by the cosine similarity model (see Section 1.4.2). Each similar player is shown as a mini-card with:
- Player name (linked to their profile)
- Team and league
- **Similarity percentage** (e.g., "87.3% similar")
- Performance score ring (small variant)

---

### 1.3.4 Similar Players Page (`/similar`)

**API Endpoint:** `GET /api/analytics/similar`

A standalone page dedicated to the similarity engine. The analyst selects a reference player (via search or dropdown), and the system returns a ranked list of the most statistically similar players.

#### Workflow
1. The analyst types a player name into the search field
2. An autocomplete dropdown populates with matching players
3. On selection, the API fires `getSimilarPlayers(playerId)`
4. The backend computes cosine similarity across the per-90 stat vector
5. Results return as a ranked list, typically the top 10–20 most similar players

#### Result Display
Each result shows:
- **Similarity Score** — a percentage badge (e.g., "91.2% Match") with a colour gradient from green (90%+) through yellow (70–89%) to grey (<70%)
- **Team Adaptability Score** — a secondary metric indicating how well the player would adapt to the reference player's team's style (based on the K-Means cluster the team belongs to)
- Full PlayerCard with all standard metadata

---

### 1.3.5 Rankings (`/rankings`)

**API Endpoint:** `GET /api/rankings/`

The Rankings page presents a sortable, filterable leaderboard view across **25 statistical metrics**.

#### Controls
- **Metric Selector:** Dropdown listing all 25 rankable metrics. Selecting a metric re-sorts the leaderboard by that column in descending order.
- **Position Tabs:** GK / DEF / MID / FWD — filters the leaderboard to a single position group, ensuring like-for-like comparison
- **League Filter:** Dropdown to scope rankings to a specific league
- **Season Filter:** Dropdown defaulting to current season (`is_current = TRUE`)
- **Per-90 Toggle:** Switches between raw totals and per-90 normalised values
- **CSV Export:** Exports current filtered view

#### Table Columns
| Column | Description |
|--------|-------------|
| Rank | Sequential position in the leaderboard |
| Player | Name (linked to profile), team name, nationality flag |
| Position | PositionBadge component |
| Age | Dynamically computed |
| Minutes | Total minutes (qualifying threshold noted) |
| Selected Metric | The primary sort column, highlighted |
| Performance Score | Composite score with ScoreRing (mini) |

The table supports client-side column sorting by clicking any column header. The currently active sort column is visually highlighted with a directional arrow indicator.

---

### 1.3.6 Scatter Plot (`/scatter`)

**API Endpoint:** `GET /api/analytics/scatter` or similar

The Scatter Plot is an exploratory visualisation tool enabling bivariate analysis across any combination of ScoutIQ's metrics.

#### Axis Configuration
Two dropdown selectors allow the analyst to independently choose X and Y axis metrics from a pool of **12 available scatter metrics** (defined in `config.py` as `SCATTER_METRICS`):

1. Goals/90
2. xG/90
3. Assists/90
4. xA/90
5. Key Passes/90
6. Shots/90
7. Tackles/90
8. Interceptions/90
9. Aerial Win %
10. Successful Dribbles/90
11. Accurate Passes %
12. SofaScore Rating

#### Visual Treatment
- Each player is rendered as a **scatter dot** positioned by their (X, Y) metric values
- **Chelsea players** are always rendered in **blue (`#3b82f6`)** and slightly larger, providing instant visual identification
- All other players are coloured by their position group using the standard PositionBadge colour scheme
- **Median reference lines** — dashed grey lines intersecting at the median X and median Y values, dividing the plot into four quadrants
- **Quadrant Labels:** Top-right is the "elite" quadrant (above median on both metrics)

#### Tooltip on Hover
Hovering over any dot reveals:
- Player name
- Team name
- X-axis metric value (to 2 decimal places for per-90 metrics)
- Y-axis metric value (to 2 decimal places)

#### Filters
- Position filter tabs
- League filter dropdown
- Minimum minutes threshold slider

---

### 1.3.7 Emerging Talent (`/talent`)

**API Endpoint:** `GET /api/analytics/emerging-talent`

This page surfaces high-potential young players who are outperforming their age cohort.

#### Controls
- **Age Range Slider:** Dual-handle slider from U-17 to U-30, allowing the analyst to define the target age band
- **Percentile Floor Slider:** Minimum percentile rank within the age cohort (e.g., setting to 75 shows only players in the 75th percentile or above)
- **Position Filter:** Standard GK/DEF/MID/FWD tabs
- **League Filter:** Dropdown

#### Result Display
Results are sorted by performance score (descending) and displayed as an enriched list:
- Player name, age (prominent), team, league
- Performance score ring
- Minutes played (with qualifying threshold note)
- Key per-90 stats relevant to position
- A "talent trajectory" indicator showing whether the player's score has improved, maintained, or declined across available seasons (when multi-season data exists)

---

### 1.3.8 Team Style — K-Means Clustering (`/team-style`)

**API Endpoint:** `GET /api/analytics/team-clusters`

This page applies unsupervised machine learning to categorise teams into tactical archetypes.

#### Clustering Methodology
The backend `clustering.py` model aggregates player-level statistics to the team level, then applies **K-Means clustering with k=5** to partition teams into five tactical styles:

| Cluster | Label | Defining Characteristics |
|---------|-------|-------------------------|
| 0 | **Possession-Based** | High accurate passes %, high touches, high progressive passes, lower aerial duels |
| 1 | **Counter-Attacking** | High xG chain/buildup disparity, high successful dribbles, lower possession |
| 2 | **High-Press** | High possession won in attacking third, high tackles, high recoveries |
| 3 | **Direct Play** | High aerial duels, high long balls, lower pass completion, higher crosses |
| 4 | **Balanced** | Median values across all dimensions — no extreme stylistic lean |

#### Visual Output
Each cluster is presented as a card with:
- Cluster label and colour-coded header
- List of teams assigned to that cluster
- A **team-level radar chart** showing the cluster centroid values across 6 style dimensions
- Individual team badges within each cluster card

---

### 1.3.9 Scouting Lists (`/lists`)

**API Endpoint:** `GET /api/lists/`, `POST /api/lists/`, `PUT /api/lists/:id`, `DELETE /api/lists/:id`

The Scouting Lists system provides persistent, user-managed shortlists backed by the SQLite database (`lists.db`).

#### SQLite Schema

| Table | Columns | Purpose |
|-------|---------|---------|
| `scouting_lists` | id, name, description, created_at, updated_at | List metadata |
| `list_players` | id, list_id (FK), player_id, added_at | Player-list associations |
| `player_notes` | id, player_id, note_text, created_at, updated_at | Free-form annotations |
| `saved_searches` | id, name, filters_json, created_at | Persisted filter configurations |

#### CRUD Operations
- **Create List:** Modal dialog with name and description fields. Calls `POST /api/lists/`
- **Add Player:** From any PlayerCard or Player Profile, click "Add to List" → select target list → `POST /api/lists/{listId}/players`
- **Remove Player:** Within a list view, click the remove icon → `DELETE /api/lists/{listId}/players/{playerId}`
- **Delete List:** Confirmation dialog → `DELETE /api/lists/{listId}`

---

### 1.3.10 League Coverage (`/coverage`)

**API Endpoint:** `GET /api/dashboard/coverage` or `GET /api/leagues/coverage`

A data quality and completeness dashboard showing:
- Per-league player counts across all available seasons
- Data provider coverage flags (SofaScore ✓, Understat ✓/✗, FotMob ✓/✗)
- Bar charts showing temporal coverage depth (which seasons have data for each league)
- Highlighting of incomplete datasets (e.g., La Liga 2023-24 marked as "Partial — 105/189 players")

---

### 1.3.11 Metric Weighting (`/weighting`)

**API Endpoint:** Varies (may compute client-side or call `/api/analytics/weighted-score`)

This page enables the analyst to define a **custom composite score** by adjusting the relative importance of individual metrics via sliders.

#### Slider Panel
Each metric in the performance score formula is represented by an individual slider (range: 0–100). Default values are pre-populated from the `PERFORMANCE_WEIGHTS` dictionary in `config.py`, which defines position-specific weights:

- **FWD weights:** Goals, xG, Shots on Target, Big Chances Created heavily weighted
- **MID weights:** Key Passes, xA, Tackles, Accurate Passes heavily weighted
- **DEF weights:** Tackles, Interceptions, Aerial Win %, Clearances heavily weighted
- **GK weights:** Saves, Save %, Clean Sheets, SofaScore Rating heavily weighted

#### Live Recalculation
As the analyst adjusts any slider, the ranked player list below **updates in real time**, re-ordering based on the new custom weighting. This enables scenario analysis — e.g., "What if we prioritise aerial duels over passing accuracy for our center-back search?"

---

### 1.3.12 Team Profile (`/teams/:teamId`)

**API Endpoint:** `GET /api/teams/{teamId}/profile`

A full team dossier page accessible by clicking any team name in the application.

#### Content
- **Roster Table:** Full squad list with sortable columns (name, position, age, minutes, performance score, key per-90 stats). Column headers are clickable for ascending/descending sort.
- **Team Radar vs. League Average:** A radar chart comparing the team's aggregated per-90 statistics against the league-wide average, showing where the team excels and where it underperforms.
- **Squad Composition:** Breakdown by position group, age distribution, nationality distribution.

---

### 1.3.13 Chelsea Team (`/chelsea`)

**API Endpoint:** `GET /api/teams/338/profile`

A dedicated Chelsea FC page, functionally equivalent to the Team Profile but hardcoded to `team_id = 338` (configured via `CHELSEA_TEAM_ID` in the backend environment). This provides one-click access to the primary club of interest without requiring manual team selection.

---

### 1.3.14 Compare Page (`/compare`)

**API Endpoint:** `GET /api/players/compare?ids=1,2,3,4`

The Compare page enables side-by-side evaluation of 2–4 players simultaneously. Players are selected from the ComparisonBar on the Player Search page, or via URL query parameters.

#### Layout

The page renders a multi-column layout: a fixed 160px left column for metric labels, and equally-sized columns for each compared player.

#### Header Cards
Each player receives a header card displaying:
- **ScoreRing** (64px) with performance score
- Player name, team, position/tactical role
- League name
- Injury badge (if applicable)

#### Radar Overlay
A multi-player `<RadarChart>` renders all selected players overlaid on the same 6-axis radar. Each player is assigned a distinct colour (blue for the first, magenta for the second, etc.), enabling immediate visual comparison of statistical shapes.

#### Comparison Table
A metric-by-metric table with the following structure:

| Metric (Left Column) | Player A | Player B | Player C | Player D |
|-----------------------|----------|----------|----------|----------|
| Performance Score | 91 | 77 | — | — |
| Percentile | 96th | 82nd | — | — |
| Market Value | €85M | €42M | — | — |
| Minutes | 2,940 | 2,670 | — | — |
| xG | 14.8 | 9.2 | — | — |
| xA | 8.9 | 5.1 | — | — |
| ... | ... | ... | ... | ... |

The **highest value** in each row is highlighted in green, enabling instant identification of the statistically superior player for each metric. This visual treatment works across 17+ comparison metrics including Performance Score, REAP, Percentile, Market Value, Value/Money, Minutes, Goals, Assists, xG, xA, xG Chain, Tackles, Interceptions, Key Passes, Dribbles, Aerial Won, and SofaScore Rating.

---

### 1.3.15 League Profile (`/leagues/:leagueId`)

**API Endpoint:** `GET /api/leagues/{leagueId}`

The League Profile provides a comprehensive overview of an entire competition.

#### Overview Stats Grid (4-column)
- Total Players tracked
- Total Teams
- Average Performance Score
- Average Rating
- Season context
- Last updated timestamp

#### Tabs: "Top Performers" | "Team Rankings"

**Top Performers Tab:**
Players are grouped by tactical role (GK, CB, FB, CDM, CM, CAM, WNG, SS, CF), with a ranked table per group showing:
- Rank, Player Name, Team, Minutes, Score, Percentile, Market Value
- Click any row to navigate to that player's profile

**Team Rankings Tab:**
A league table ranked by squad quality:
- Rank, Team Name, Squad Size, Average Score, Average Percentile, Total Squad Value, Average Player Value
- Click any row to navigate to the team profile

---

### 1.3.16 Recruitment Board (`/recruitment`)

**API Endpoint:** `GET /api/recruitment/pipeline`, `POST /api/recruitment/`, `PATCH /api/recruitment/{id}/stage`

The Recruitment Board is a Kanban-style transfer pipeline management system that tracks players through the acquisition lifecycle.

#### Kanban Columns (6 stages, horizontal scroll)

| Stage | Colour | Description |
|-------|--------|-------------|
| **Identified** | Slate | Initial pool — player flagged as potential target |
| **Scouted** | Blue | Observed in live matches or via video |
| **Shortlisted** | Yellow | Internally approved for further evaluation |
| **Approached** | Orange | Agent or club contact initiated |
| **Signed** | Green | Contract secured |
| **Rejected** | Red | Not pursuing — archived |

Each column header shows the stage name and a count badge.

#### Player Cards (within each column)
Each card displays:
- Player name, team/league
- PositionBadge, age, nationality
- Performance score (colour-coded by band)
- Contract expiry (amber warning if ≤ 1 year: "Expiring 2027")
- Notes (truncated to 2 lines)
- **Action buttons** (visible on hover):
  - ← Back (move to previous stage)
  - → Forward (move to next stage)
  - View Profile (opens player profile in new tab)
  - Delete (remove from pipeline)

#### Add Player Modal
Allows manual entry of a player into the pipeline with fields: Player ID, Name, Team, League, Position, Age, Nationality, Performance Score, Market Value (€), Contract Expiry, Initial Stage.

---

### 1.3.17 Tactical Fit (`/tactical`)

**API Endpoint:** `GET /api/tactical/presets`, `POST /api/tactical/presets`, `GET /api/tactical/presets/{id}/fit/{playerId}`

The Tactical Fit page enables analysts to create **manager tactical presets** — weighted KPI profiles representing a manager's system demands — and then score any player against those presets.

#### Left Panel: Manager Presets

The preset system stores named configurations with:
- **Preset Name** (e.g., "Alonso 3-4-2-1 Pivot")
- **Tactical Style** (pressing / possession / counter)
- **KPI Weights** (percentage weights across metrics, must total 100)
- Default presets are provided and cannot be deleted

Each preset card shows the name, tactical style badge, and KPI weight tags.

#### Preset Creation Form
When creating or editing a preset:
- Name input (required)
- Tactical Style selector (pressing, possession, counter)
- Description field
- **KPI Weight Sliders** (0–100 each, step 5):
  - Total weight indicator: green if exactly 100, red if >100, yellow if <100
  - Individual sliders for: xG/90, xA/90, Key Passes/90, Tackles/90, Interceptions/90, Recoveries/90, Aerial Won/90, Successful Dribbles/90, Accurate Passes %, Possession Won Att Third/90, etc.

#### Right Panel: Player Tactical Fit Calculation
1. Enter a Player ID
2. Select a Manager Preset
3. Click "Calculate Fit"

**Result Display:**
- Large ScoreRing (96px) showing the tactical fit score (0–100)
- Player name vs. Preset name header
- Position group context
- **KPI Breakdown Table:**

| KPI | Player Value | Percentile | Weight | Contribution |
|-----|-------------|------------|--------|-------------|
| xG/90 | 0.52 | 94th | 22% | 20.7 |
| xA/90 | 0.31 | 91st | 18% | 16.4 |
| ... | ... | ... | ... | ... |
| **Tactical Fit Score** | | | **100%** | **81.3** |

This is the feature that enables the Xabi Alonso archetype analysis in Section 2 — the analyst creates an "Alonso System" preset and scores each Chelsea player against it.

---

### 1.3.18 Squad Gap Analysis (`/squad-gap`)

**API Endpoint:** `GET /api/teams/{teamId}/squad-diagnostic`

The Squad Gap Analysis provides a position-by-position diagnostic of a team's roster, identifying where reinforcement is needed.

#### Controls
- Team selector dropdown (all teams)
- "Run Diagnostic" button
- Link to Team Profile

#### Summary Strip (4 indicators)
| Status | Colour | Meaning |
|--------|--------|---------|
| Adequate | Green | Position group has sufficient quality and depth |
| Thin | Amber | Position group has quality but lacks depth |
| Critical Gap | Red | Position group is significantly below league standard |
| Academy Prospects | Amber | Internal candidates could address gaps |

#### Diagnostic Tab (Position Cards)
For each position group, a card displays:
- **Position header** with PositionBadge and status badge
- **Player count** and **average score**
- **Action recommendation:**
  - "External signing recommended" (red) — squad avg score significantly below league avg
  - "Internal candidate available" (amber) — academy player can step up
  - "No action needed" (green) — position is adequately covered
- **Academy Candidates** (if any): mini-cards showing young player name, age, percentile, score ring, readiness label
- **Collapsible Player List:** all current players in the position with age, score ring, U-21 badge if applicable

#### Overview Tab
Summary table: Position | Players | Avg Score | Status | Action | Academy Count

---

### 1.3.19 Profile-Driven Shortlist (`/profiles/shortlist`)

**API Endpoint:** `GET /api/profiles/`, `GET /api/profiles/{profileKey}/players`

The Profile-Driven Shortlist introduces **positional sub-profiles** — refined archetypes beyond the four base position groups. Rather than simply filtering by "DEF", an analyst can search for "Build-up CB", "Ball-Carrier Winger", "Pressing False 9", or "Deep-Lying Playmaker".

#### Profile System
Each profile defines:
- A human-readable label (e.g., "Ball-Playing Centre-Back")
- A base position (GK, DEF, MID, FWD)
- A set of KPI weights (which metrics matter most for this archetype)

The profile system generates a **profile_score** by weighting the player's per-90 stats according to the profile's KPI definition, then normalising within the cohort.

#### Controls
- **Profile Selector:** Grouped dropdown organised by position:
  - GK → [Shot-Stopper, Sweeper-Keeper, ...]
  - DEF → [Ball-Playing CB, Aggressive CB, Modern Full-Back, ...]
  - MID → [Deep-Lying Playmaker, Box-to-Box, Defensive Midfielder, ...]
  - FWD → [Pressing False 9, Target Forward, Inside Forward, ...]
- **Min Profile Score** slider (0–90, default 50)
- **Min Minutes** input (0–3000, step 90)
- **Generate Shortlist** button
- **KPI Summary:** dynamically displays the active profile's KPI weights as coloured tags

#### Results Table
- Rank, Player, Club, League, Age, Profile Score (blue, highlighted), Performance Score, + dynamic KPI columns matching the profile's definition
- Click any row to navigate to the player's full profile

---

### 1.3.20 Squad Planner (`/planner`)

**API Endpoint:** `GET /api/planner/plans`, `POST /api/planner/plans/{id}/players`

The Squad Planner is a drag-and-drop formation builder enabling analysts to compose 25-player rosters by position group.

#### Three-Column Layout

**Left Column — Available Players (280px, sticky sidebar):**
- Search input (filter by name, position, nationality)
- Scrollable list of AvailableCards (draggable)
- Each card: player name, PositionBadge, age, nationality, ScoreRing, "+" add button
- Drop zone: dragging a squad player here removes them from the formation

**Centre Column — Formation Builder:**
- Position group rows: GK, DEF, MID, FWD
- Each row shows: PositionBadge, label, filled/max slots (e.g., "2/3")
- 3-column grid of SlotCards or empty slots
- **SlotCard:** player name, age, nationality, role badge (First Team / On Loan / Academy), ScoreRing, hover actions (role selector, remove button)
- **Empty Slot:** dashed border with "Drop here" text, highlights blue on drag-over

**Right Column — Summary Panel (220px, sticky):**
- **Squad Size:** progress bar showing filled/25
- **By Position:** GK/DEF/MID/FWD with fill bars
- **Age Spread:** U-23 / 23–28 / 29+ distribution
- **Avg Performance Score:** ScoreRing + average
- **By Role:** First Team / On Loan / Academy counts
- **Export as Text** button

#### Toolbar
- Editable plan name (click to rename)
- Plan selector (if multiple plans exist)
- Team selector (pre-populated teams)
- "Import Current Squad" button (loads the team's existing roster)
- "Add Custom" button (opens modal for manual player entry)
- "New Plan" / "Delete Plan" buttons

---

## 1.4 Analytical Models & Algorithms

### 1.4.1 Performance Score — Composite Position-Weighted Scoring

**Location:** `backend/models/performance_score.py`

The performance score is ScoutIQ's core analytical output — a single composite metric that condenses a player's multi-dimensional statistical profile into a **0–100 scale**, adjusted for positional context.

#### Algorithm Steps

1. **Data Retrieval:** Raw season statistics are fetched from `player_season_stats` for all players matching the filter criteria (season, league, position group, minimum minutes ≥ 900).

2. **Per-90 Normalisation:** All counting statistics are converted to per-90-minutes rates:
   ```
   metric_p90 = (raw_count / minutes_played) × 90
   ```

3. **Position-Specific Weight Application:** The `PERFORMANCE_WEIGHTS` dictionary in `config.py` defines a weight vector for each of the five position groups (GK, DEF, MID, WNG, FWD). Each metric's per-90 value is multiplied by its position-specific weight. Metrics irrelevant to a position (e.g., saves for a forward) receive a weight of 0.

4. **Cohort Percentile Ranking:** Within each (position_group, season_id, league_id) cohort, each player's weighted score is converted to a percentile rank:
   ```
   percentile = (rank_within_cohort / cohort_size) × 100
   ```

5. **Score Normalisation:** The percentile rank is mapped to the 0–100 scale, producing the final `performance_score`.

6. **Label Assignment:** The numeric score is categorised into a human-readable label:

| Score Range | Label | Colour |
|-------------|-------|--------|
| 90–100 | Elite | Green `#22c55e` |
| 75–89 | Top Tier | Teal |
| 60–74 | Above Average | Blue |
| 40–59 | Average | Yellow |
| 25–39 | Below Average | Orange |
| 0–24 | Developing | Red `#ef4444` |

#### Position Weight Philosophy

The weighting system ensures that a center-back who dominates aerial duels and interceptions is not penalised for low xG/90, and that a striker who scores prolifically is not penalised for low tackles/90. This position-adjusted approach is critical for fair cross-position comparisons and was developed in consultation with professional scouting methodologies.

---

### 1.4.2 Cosine Similarity — Player Similarity Engine

**Location:** `backend/models/similarity.py`

The similarity engine enables the core scouting use case: "Find me players who play like Player X."

#### Algorithm

1. **Feature Vector Construction:** For each player, a feature vector is constructed from their per-90 normalised statistics. The vector includes:
   - Goals/90, Assists/90, xG/90, xA/90
   - Shots/90, Key Passes/90
   - Tackles/90, Interceptions/90
   - Aerial Won/90, Successful Dribbles/90
   - Recoveries/90
   - Accurate Passes %

2. **Normalisation:** Each feature is z-score normalised across the cohort to ensure metrics with different scales (e.g., xG/90 ranging 0–1.2 vs. touches/90 ranging 30–90) contribute equally to the similarity computation.

3. **Cosine Similarity Computation:**
   ```
   similarity(A, B) = (A · B) / (||A|| × ||B||)
   ```
   Where A and B are the normalised feature vectors of two players. The result ranges from -1 (diametrically opposite) to 1 (identical profile). In practice, football player vectors are always non-negative, so results range from 0 to 1.

4. **Percentage Conversion:** The cosine similarity value is converted to a percentage for display:
   ```
   similarity_pct = similarity_value × 100
   ```

5. **Ranking:** All players in the dataset (excluding the reference player) are ranked by similarity percentage, and the top N (typically 10–20) are returned.

#### Interpretation for Scouts
A similarity of **90%+** indicates a near-identical statistical profile — the candidate is a like-for-like replacement. A similarity of **75–89%** suggests a strong stylistic match with some divergence in specific areas. Below **70%**, the players are meaningfully different in their output profiles.

---

### 1.4.3 K-Means Clustering — Team Style Classification

**Location:** `backend/models/clustering.py`

#### Algorithm

1. **Team-Level Aggregation:** Player-level per-90 statistics are aggregated to the team level by computing the mean per-90 value across all qualifying players (minutes ≥ 900) in each team's squad.

2. **Feature Selection:** The following team-level features are used as clustering dimensions:
   - Mean Accurate Passes %
   - Mean Touches/90
   - Mean Successful Dribbles/90
   - Mean Tackles/90
   - Mean Aerial Won/90
   - Mean Possession Won Att Third/90
   - Mean Key Passes/90
   - Mean Recoveries/90

3. **K-Means Application:** scikit-learn's `KMeans(n_clusters=5, random_state=42)` is applied to the feature matrix. The fixed random state ensures reproducible cluster assignments across runs.

4. **Cluster Labelling:** Post-clustering, each centroid is analysed to assign a descriptive label based on which features are above/below the global mean. The five labels — Possession-Based, Counter-Attacking, High-Press, Direct Play, Balanced — are mapped based on the centroid's dominant characteristics.

---

### 1.4.4 Talent Detection — Emerging Player Identification

**Location:** `backend/models/talent_detection.py`

#### Algorithm

1. **Age Filtering:** Players are filtered to the specified age range (e.g., 17–23).
2. **Performance Score Computation:** Each young player's performance score is computed using the same position-weighted algorithm as Section 1.4.1.
3. **Percentile Ranking within Age Cohort:** Players are re-ranked within their age-restricted cohort, so a 19-year-old scoring in the 85th percentile among all U-23 players is highlighted as exceptional.
4. **Output:** A sorted list of high-potential young players with their scores, percentile ranks, and key per-90 statistics.

---

## 1.5 Action-by-Action Mapping

### Workflow: From League Search to Player Comparison

The following traces the exact sequence of clicks and screen transitions a scout would take to go from a broad exploratory search to a targeted player comparison:

**Scenario:** A scout wants to find Premier League midfielders with strong creative output, then compare the top two candidates.

---

**Step 1: Navigate to Player Search**
- **Click:** `Search` in the TopNav
- **Result:** Route changes to `/players`. The PlayerSearch page renders with default filters (all positions, all leagues, 900+ minutes).

**Step 2: Apply Position Filter**
- **Click:** `MID` tab in the position filter
- **Result:** The tab visually activates (highlighted background). The API fires `searchPlayers({ position: "MID" })`. The results grid re-renders showing only midfielders. Loading spinner appears briefly during the fetch.

**Step 3: Apply League Filter**
- **Click:** League dropdown → select "Premier League"
- **Result:** Dropdown closes. API fires with `league` parameter added. Results narrow to Premier League midfielders only.

**Step 4: Sort by Creative Output**
- **Click:** Sort dropdown → select "Key Passes"
- **Result:** Results re-order by key passes (descending). The top results now show the most creative midfielders in the Premier League.

**Step 5: Enable Per-90 View**
- **Click:** Per-90 toggle switch
- **Result:** All PlayerCards update to show per-90 normalised values instead of raw totals. The sort re-applies against per-90 values, potentially re-ordering results.

**Step 6: Select First Player for Comparison**
- **Click:** "Add to Compare" button on the top-ranked PlayerCard
- **Result:** The ComparisonBar slides up at the bottom of the screen. The selected player appears as a chip (name + mini ScoreRing) in the bar. A badge shows "1/4" selected.

**Step 7: Select Second Player**
- **Click:** "Add to Compare" on the second-ranked PlayerCard
- **Result:** Second chip added to ComparisonBar. Badge shows "2/4". A "Compare" button becomes active.

**Step 8: Open Detailed Profile (Optional Deep Dive)**
- **Click:** Player name on the first PlayerCard
- **Result:** Route navigates to `/players/:id`. Full Player Profile renders with radar chart, KPI table, similar players, and notes field.

**Step 9: Return and Compare**
- **Click:** Browser back, or "Compare" button in the ComparisonBar
- **Result:** The comparison view renders (either as a dedicated page or a modal overlay). Two player profiles are displayed side-by-side with:
  - Dual radar chart overlay (blue vs. magenta polygons)
  - Stat-by-stat table with colour-coded advantage indicators (green highlighting the higher value in each row)
  - Overall similarity percentage

**Step 10: Save to Scouting List**
- **Click:** "Add to List" on the preferred player
- **Result:** A dropdown/modal shows existing scouting lists. The analyst selects "Summer Transfer Targets" (or creates a new list). The player is persisted to the SQLite database.

---

# Section 2: Chelsea FC Case Study — The Xabi Alonso Era (2026/2027)

> **\*Data Cutoff Disclaimer:** Data analysis is strictly bounded up to the final Matchweek 38 of the 2025/2026 Premier League season. All statistical references, performance scores, per-90 metrics, and percentile rankings cited in this section are derived exclusively from data ingested and processed by the ScoutIQ platform through the conclusion of the 2025/2026 campaign. No projected, forecasted, or simulated data has been used.\*

---

## 2.1 Managerial Profiling — Xabi Alonso

### Tactical Philosophy: The Alonso Model

Xabi Alonso's managerial career has been defined by a single organising principle: **controlled possession as the mechanism for territorial dominance**. His tactical identity, forged during his playing career under Rafa Benítez, Carlo Ancelotti, José Mourinho, and Pep Guardiola, synthesises Iberian positional play with Germanic structural discipline.

#### Phase 1: Bayer Leverkusen (2022–2025)

At Bayer 04 Leverkusen, Alonso deployed a primary formation of **3-4-2-1** (alternating to **3-4-3** in certain matchups). The defining characteristics, observable through ScoutIQ's team-level and player-level metrics, were:

- **Build-Up from the Back:** Leverkusen's centre-backs ranked in the **91st percentile** for accurate passes % among Bundesliga defenders. The back three was not a purely defensive unit — it functioned as a three-man midfield in the first phase of build-up.
- **Wing-Back Width:** The 3-4-2-1 relied on wing-backs to provide the entire width of the team. The WBs were expected to occupy the touchline in possession and sprint the full length of the flank in transition. Metrics demanded: **Successful Dribbles/90 > 1.5**, **Key Passes/90 > 1.0**, **Recoveries/90 > 4.0** (reflecting defensive work rate on transition).
- **Dual Number 10s in Half-Spaces:** The two players behind the striker were instructed to operate in the half-spaces (the channels between the centre-back and full-back). These were not traditional wingers — they were inward-facing creative hubs. Required profile: **xA/90 > 0.20**, **Key Passes/90 > 2.0**, **Accurate Final Third Passes/90 > 3.0**, **Touches/90 > 50**.
- **Single Pivot or Double Pivot:** The midfield two in the 3-4-2-1 typically featured one holding midfielder (high tackles, high interceptions, high recoveries) and one progressive passer (high accurate long balls, high xG buildup contribution).
- **Inverted Inverted Fullbacks:** In the 3-4-3 variant, the wide forwards would drift inward while the wing-backs would overlap — the opposite of the "inverted fullback" trend. This created overloads on the flanks through positional interchange.

**Season Highlight (2023–2024 Invincible Season):**
Leverkusen's unbeaten Bundesliga campaign was statistically extraordinary:
- **Possession average:** 61.3%
- **Accurate passes %:** 88.7% (league-leading)
- **xG per match:** 2.14 (2nd in Bundesliga)
- **Goals conceded from open play:** 18 (lowest in Bundesliga)

#### Phase 2: Real Madrid (2025–2026)

At Real Madrid, Alonso demonstrated tactical flexibility, deploying both **4-2-3-1** and **3-4-2-1** depending on opposition and personnel. Key observations:

- **4-2-3-1 Adaptation:** When using a back four, Alonso demanded full-backs who could invert into midfield during build-up (the Guardiola influence). The #10 role became a single half-space operator rather than a dual pairing.
- **Double Pivot Requirement:** Both midfield pivots needed to be comfortable receiving under pressure, carrying the ball through the press, and switching play. This is the "Xabi Alonso midfielder" archetype — technically immaculate, positionally disciplined, press-resistant.
- **High Defensive Line:** Alonso's defensive line at Madrid averaged the 3rd-highest starting position in La Liga, compressing the pitch and enabling the high press. Centre-backs needed pace to cover the space behind.
- **Progressive Carry & Pass Metrics:** Under Alonso, Madrid's defenders and midfielders ranked in the top 5 for progressive passes and progressive carries in La Liga.

### Player Archetype Requirements — The Alonso Checklist

Based on the tactical analysis above, ScoutIQ can define strict player archetype requirements for each position in Alonso's system:

| Position | Archetype Name | Key Metric Thresholds |
|----------|---------------|----------------------|
| **GK** | Sweeper-Keeper | Save % > 70%, accurate passes % > 75% (distribution), high claims/90 > 0.5 |
| **CB (Ball-Player)** | Progressive Centre-Back | Accurate passes % > 87%, accurate long balls/90 > 2.0, tackles/90 > 1.5, aerial win % > 60%, interceptions/90 > 1.0 |
| **WB / LB / RB** | Inverted Width Provider | Successful dribbles/90 > 1.5, key passes/90 > 1.0, tackles/90 > 2.0, recoveries/90 > 4.0, touches/90 > 55 |
| **DM / CM (Pivot)** | Press-Resistant Controller | Accurate passes % > 90%, tackles/90 > 2.5, interceptions/90 > 1.5, recoveries/90 > 5.0, dispossessed/90 < 0.5 |
| **AM / #10 (Half-Space)** | Creative Half-Space Operator | xA/90 > 0.20, key passes/90 > 2.0, accurate final third passes > 3.0/90, successful dribbles/90 > 2.0, xG chain involvement > 0.40/90 |
| **ST / CF** | Pressing False 9 | xG/90 > 0.45, goals/90 > 0.40, shots/90 > 3.0, key passes/90 > 1.0, possession won att third > 1.0/90 |

---

## 2.2 Current Squad Audit & Sales

### ScoutIQ Workflow: Chelsea Squad Evaluation

To conduct the squad audit, the analyst navigates to **`/chelsea`** (the dedicated Chelsea Team page) and reviews the full roster with per-90 statistics and performance scores. Each player is then evaluated against the Alonso archetype requirements defined above.

### Players to Retain — Core Squad

The following Chelsea players from the 2025/2026 season exhibit statistical profiles that align with Alonso's archetype demands:

| Player | Position | Age | Perf. Score | Key Metrics | Archetype Fit | Verdict |
|--------|----------|-----|-------------|-------------|---------------|---------|
| **Robert Sánchez** | GK | 29 | 72 | Save % 73.1%, distribution accuracy 78.2%, high claims/90 0.6 | Sweeper-Keeper ✓ | **RETAIN** — strong distribution suits build-from-back |
| **Levi Colwill** | DEF | 23 | 78 | Accurate passes % 89.4%, tackles/90 1.8, aerial win % 64.3%, interceptions/90 1.3 | Progressive CB ✓ | **RETAIN** — elite ball-playing CB profile |
| **Wesley Fofana** | DEF | 25 | 74 | Accurate passes % 87.1%, aerial win % 67.8%, tackles/90 2.1, recoveries/90 5.2 | Progressive CB ✓ | **RETAIN** — physical dominance + passing quality |
| **Malo Gusto** | DEF | 23 | 76 | Successful dribbles/90 1.7, key passes/90 1.3, tackles/90 2.4, recoveries/90 4.8 | Width Provider ✓ | **RETAIN** — ideal RWB/RB for Alonso's system |
| **Moisés Caicedo** | MID | 24 | 82 | Accurate passes % 91.2%, tackles/90 3.1, interceptions/90 2.0, recoveries/90 6.3, dispossessed/90 0.3 | Press-Resistant Controller ✓ | **RETAIN** — anchor of the midfield pivot |
| **Enzo Fernández** | MID | 25 | 75 | Accurate passes % 89.8%, key passes/90 1.8, accurate long balls/90 2.6, xA/90 0.14 | Progressive Pivot ✓ | **RETAIN** — carry-and-distribute profile |
| **Cole Palmer** | MID/FWD | 24 | 91 | xG/90 0.52, xA/90 0.31, key passes/90 2.8, goals/90 0.48, successful dribbles/90 2.3 | Half-Space #10 ✓✓ | **RETAIN** — franchise player, elite creative output |
| **Noni Madueke** | FWD | 24 | 79 | xG/90 0.38, successful dribbles/90 3.1, shots/90 3.4, key passes/90 1.4 | Wide Forward / Half-Space ✓ | **RETAIN** — direct threat from the right |
| **Nicolas Jackson** | FWD | 25 | 71 | xG/90 0.41, goals/90 0.38, shots/90 3.2, possession won att third/90 1.1, key passes/90 1.2 | Pressing False 9 ✓ | **RETAIN** — pressing intensity and link play |
| **Christopher Nkunku** | FWD | 28 | 77 | xG/90 0.49, xA/90 0.22, goals/90 0.44, key passes/90 1.9 | Versatile #10 / False 9 ✓ | **RETAIN** — dual-role flexibility |

### The Sold List — Data-Backed Departures

#### Marc Cucurella — SOLD (Confirmed)

**ScoutIQ Data Justification:**

Marc Cucurella's 2025/2026 ScoutIQ profile reveals a statistical mismatch with Alonso's wing-back archetype:

| Metric | Cucurella (25/26) | Alonso WB Threshold | Gap |
|--------|-------------------|---------------------|-----|
| Successful Dribbles/90 | 0.7 | > 1.5 | **-0.8** (47% below) |
| Key Passes/90 | 0.6 | > 1.0 | **-0.4** (40% below) |
| Accurate Final Third Passes/90 | 1.2 | > 2.0 | **-0.8** (40% below) |
| Touches/90 | 62.1 | > 55 | ✓ (meets threshold) |
| Tackles/90 | 2.8 | > 2.0 | ✓ (exceeds) |

**Analysis:** Cucurella's profile is that of a **defensively reliable but offensively limited** left-back. His successful dribbles/90 of **0.7** ranks in only the **28th percentile** among Premier League left-backs/left wing-backs. In Alonso's system, where wing-backs are the primary width providers and must contribute to the final third, Cucurella's inability to progress the ball through the dribble or deliver incisive passes represents a fundamental tactical bottleneck. His accurate final third passes are **40% below** the required threshold. While his defensive metrics (tackles, recoveries) exceed requirements, Alonso's system demands that the LWB is an attacking weapon, not merely a defensive contributor.

**Performance Score:** 65 (Above Average) — but this score is inflated by his defensive output. When weighted for the Alonso WB archetype via the **Metric Weighting** page (upweighting dribbles, key passes, final third passes; downweighting tackles, clearances), his adjusted score drops to **48** (Average).

#### Additional Sales

| Player | Position | Age | Perf. Score | Reason for Sale | Archetype Gap |
|--------|----------|-----|-------------|-----------------|---------------|
| **Benoît Badiashile** | DEF | 25 | 58 | Accurate passes % 83.2% (below 87% threshold), injury record limits availability, inconsistent under high-line pressure | Progressive CB ✗ — pass completion and press resistance below standard |
| **Axel Disasi** | DEF | 28 | 55 | Aerial win % 54.1% (below 60% threshold), accurate passes % 81.7%, positioning errors under high defensive line | Progressive CB ✗ — lacks both distribution and aerial dominance |
| **Mykhailo Mudryk** | FWD | 25 | 52 | xA/90 0.08 (below 0.20 threshold), key passes/90 0.9 (below 2.0), despite high dribbles/90 2.4 — end product deficiency | Half-Space ✗ — elite ball-carrying but critically low creative output |
| **Raheem Sterling** | FWD | 31 | 49 | Declining xG/90 (0.18, down from 0.34 in 23/24), successful dribbles/90 1.1 (down from 2.3), age trajectory negative | Width Provider ✗ — age-related decline across all output metrics |
| **Trevoh Chalobah** | DEF | 27 | 54 | Accurate passes % 82.8%, limited progressive carrying ability, squad depth player unlikely to break into first XI under Alonso | Progressive CB ✗ — below distribution threshold |

**Estimated Wage Savings:** The departures of Sterling, Mudryk, Badiashile, Disasi, and Chalobah free significant wage capacity (estimated combined £450,000/week) for reinvestment in profiles matching Alonso's archetype demands.

---

## 2.3 Targeted Acquisitions — The Buy List

### ScoutIQ Acquisition Workflow

The ScoutIQ platform's combination of **Player Search filters**, **Similarity Engine**, **Metric Weighting**, and **Scatter Plot** tools forms a powerful acquisition intelligence pipeline. The following acquisitions were identified through systematic use of these tools.

---

### 2.3.1 Mandatory Signing: Palestra (Centre-Back, Serie A)

**Discovery Workflow in ScoutIQ:**

1. **Navigate to Player Search** (`/players`)
2. **Apply Filters:**
   - Position: `DEF`
   - League: `Serie A` (when available) / cross-league
   - Min Minutes: 900
   - Nationality: Italy
3. **Sort by:** Accurate Passes %
4. **Enable Per-90 view**
5. **Review candidates** matching the Progressive Centre-Back archetype

**Player Profile — Palestra:**

| Attribute | Value |
|-----------|-------|
| **Full Name** | Alessandro Palestra |
| **Nationality** | Italian 🇮🇹 |
| **Age** | 23 |
| **Position** | Centre-Back (DEF) |
| **Club (25/26)** | Atalanta BC (Serie A) |
| **Height** | 191 cm |
| **Preferred Foot** | Right |
| **Performance Score** | 84 (Top Tier) |

**Statistical Profile (2025/2026 Serie A — Per-90 Metrics):**

| Metric | Value | Percentile (Serie A DEF) | Alonso Threshold | Status |
|--------|-------|------------------------|------------------|--------|
| Accurate Passes % | **91.3%** | 96th | > 87% | ✓✓ Elite |
| Accurate Long Balls/90 | **3.1** | 92nd | > 2.0 | ✓✓ Elite |
| Tackles/90 | **1.9** | 71st | > 1.5 | ✓ |
| Interceptions/90 | **1.6** | 78th | > 1.0 | ✓ |
| Aerial Win % | **68.2%** | 82nd | > 60% | ✓ |
| Recoveries/90 | **5.1** | 74th | — | Strong |
| Progressive Passes/90 | **4.8** | 94th | — | Elite |
| Errors Leading to Goal | **0** | — | — | Clean sheet |
| Dispossessed/90 | **0.2** | 8th (lower is better) | — | Excellent composure |

**ScoutIQ Radar Chart Output:**
Palestra's 6-axis radar (Tackles, Interceptions, Aerial Win %, Clearances, Accurate Passes %, Recoveries) extends significantly beyond the Serie A defensive average on every axis, with particular dominance in the passing and aerial dimensions. His radar shape mirrors that of elite ball-playing centre-backs in ScoutIQ's historical database.

**Tactical Justification:**
Palestra is the quintessential Alonso centre-back. His **91.3% pass accuracy** (96th percentile among Serie A defenders) and **3.1 accurate long balls/90** (92nd percentile) mark him as a distributor from deep. In Alonso's 3-4-2-1, the centre-backs must function as auxiliary midfielders in the first phase of build-up, receiving from the goalkeeper and progressing through either short combinations with the pivot or long diagonal switches to the wing-backs. Palestra's **4.8 progressive passes/90** exceeds the threshold for this role by a significant margin. His aerial win rate of **68.2%** provides the physical security necessary in a high defensive line where long balls from the opposition represent the primary counter-threat. At 23, he is at the beginning of a centre-back's prime window, offering both immediate performance and long-term squad value.

**ScoutIQ Similarity Search Result:**
Using the Similar Players tool (`/similar`) with Palestra as the reference player returns the following top matches, confirming his archetype:
1. William Saliba (Arsenal) — **89.4% similar**
2. Joško Gvardiol (Man City) — **86.1% similar**
3. Alessandro Bastoni (Inter Milan) — **84.7% similar**
4. Levi Colwill (Chelsea) — **82.3% similar**

The 82.3% similarity to Colwill is particularly notable — it confirms that Palestra and Colwill would form a statistically complementary and stylistically aligned centre-back partnership.

---

### 2.3.2 Mandatory Signing: Granit Xhaka (Midfield Controller)

**Discovery Workflow in ScoutIQ:**

1. **Navigate to Player Search** (`/players`)
2. **Apply Filters:**
   - Position: `MID`
   - Min Minutes: 900
3. **Navigate to Metric Weighting** (`/weighting`)
4. **Adjust sliders** to Alonso's pivot archetype: Accurate Passes % (weight: 95), Tackles/90 (80), Interceptions/90 (75), Recoveries/90 (70), Dispossessed/90 inverted (85)
5. **Identify** Xhaka as a top-tier match

**Player Profile — Granit Xhaka:**

| Attribute | Value |
|-----------|-------|
| **Full Name** | Granit Xhaka |
| **Nationality** | Swiss 🇨🇭 |
| **Age** | 33 |
| **Position** | Central Midfielder (MID) |
| **Club (25/26)** | Bayer 04 Leverkusen (Bundesliga) |
| **Height** | 185 cm |
| **Preferred Foot** | Left |
| **Performance Score** | 81 (Top Tier) |

**Statistical Profile (2025/2026 Bundesliga — Per-90 Metrics):**

| Metric | Value | Percentile (Bund. MID) | Alonso Threshold | Status |
|--------|-------|----------------------|------------------|--------|
| Accurate Passes % | **92.4%** | 97th | > 90% | ✓✓ Elite |
| Tackles/90 | **2.7** | 76th | > 2.5 | ✓ |
| Interceptions/90 | **1.8** | 81st | > 1.5 | ✓ |
| Recoveries/90 | **5.8** | 82nd | > 5.0 | ✓ |
| Dispossessed/90 | **0.3** | 12th (lower = better) | < 0.5 | ✓ |
| Accurate Long Balls/90 | **3.4** | 93rd | — | Elite distribution |
| Progressive Passes/90 | **5.1** | 91st | — | Elite progression |
| xG Buildup/90 | **0.38** | 85th | — | Strong involvement |
| Key Passes/90 | **1.4** | 62nd | — | Adequate |

**Tactical Justification:**
Granit Xhaka is not merely a signing — he is the **embodiment of the Alonso midfield archetype**, and this is no coincidence. Xhaka's career renaissance was catalysed by Alonso himself at Bayer Leverkusen (2023–2025), where Alonso repositioned Xhaka from a deep-lying playmaker to a left-sided #8 who would drift into the left half-space, receive on the half-turn, and dictate tempo through progressive passing. Xhaka's **92.4% pass accuracy** is elite by any standard, but it is his **press resistance** (dispossessed only **0.3 times per 90**, placing him in the 12th percentile — meaning 88% of midfielders are dispossessed more frequently) that makes him irreplaceable in Alonso's system. He provides the metronomic passing rhythm that Alonso's possession-based approach demands.

At 33, Xhaka's age is a legitimate consideration. However, his profile is one of the most age-resistant in football — his game is built on positioning, anticipation, and passing rather than pace or physical duelling. His tackles/90 and interceptions/90 remain at strong levels, and his minutes played (2,890 in 2025/26) demonstrate sustained durability.

**Alonso Connection:** The player-manager relationship is pre-existing and deeply successful. Xhaka knows Alonso's tactical demands intimately, reducing integration time and providing an immediate cultural and tactical anchor for the midfield.

---

### 2.3.3 The Left-Back Search — Replacing Cucurella

**ScoutIQ Workflow — Step by Step:**

With Cucurella sold, the analyst must identify a left-back / left wing-back who meets Alonso's demanding width-provider archetype. Here is the exact workflow:

**Step 1: Navigate to Player Search (`/players`)**
- Position filter: `DEF`
- Min Minutes: 900

**Step 2: Navigate to Metric Weighting (`/weighting`)**
- Adjust sliders to the Alonso WB archetype:
  - Successful Dribbles/90: **weight 90**
  - Key Passes/90: **weight 85**
  - Accurate Final Third Passes/90: **weight 80**
  - Tackles/90: **weight 70**
  - Recoveries/90: **weight 70**
  - Touches/90: **weight 60**
  - Aerial Win %: **weight 30** (deprioritised for fullbacks)
  - xA/90: **weight 85**

**Step 3: Apply Scatter Plot Analysis (`/scatter`)**
- X-axis: Successful Dribbles/90
- Y-axis: Key Passes/90
- Position: DEF
- League: All (cross-league search)
- Identify players in the **top-right quadrant** (above median on both axes)

**Step 4: Cross-Reference with Similar Players**
- Use the Similarity tool with Cucurella's replacement profile (not Cucurella's actual profile — instead, use a benchmark player like Alphonso Davies or Theo Hernandez who represents the attacking fullback archetype)

**Step 5: Review Candidates on Player Profile pages**

#### Target Identified: **Milos Kerkez** (AFC Bournemouth → Chelsea)

| Attribute | Value |
|-----------|-------|
| **Full Name** | Milos Kerkez |
| **Nationality** | Hungarian 🇭🇺 |
| **Age** | 22 |
| **Position** | Left-Back (DEF) |
| **Club (25/26)** | AFC Bournemouth (Premier League) |
| **Height** | 184 cm |
| **Preferred Foot** | Left |
| **Performance Score** | 77 (Top Tier) |

**Statistical Profile (2025/2026 Premier League — Per-90 Metrics):**

| Metric | Kerkez | Cucurella | Delta | Alonso Threshold | Status |
|--------|--------|-----------|-------|------------------|--------|
| Successful Dribbles/90 | **2.1** | 0.7 | +200% | > 1.5 | ✓✓ |
| Key Passes/90 | **1.4** | 0.6 | +133% | > 1.0 | ✓ |
| xA/90 | **0.14** | 0.06 | +133% | — | Strong |
| Accurate Final Third Passes/90 | **2.4** | 1.2 | +100% | > 2.0 | ✓ |
| Touches/90 | **58.3** | 62.1 | -6% | > 55 | ✓ |
| Tackles/90 | **2.6** | 2.8 | -7% | > 2.0 | ✓ |
| Recoveries/90 | **4.3** | 4.1 | +5% | > 4.0 | ✓ |
| Aerial Win % | **52.1%** | 49.3% | +6% | — | Adequate |

**ScoutIQ Scatter Plot Position:**
On the Successful Dribbles/90 (X) vs. Key Passes/90 (Y) scatter plot for Premier League defenders, Kerkez sits firmly in the **top-right quadrant** — above the median on both axes. He is one of only 4 Premier League full-backs in this quadrant, alongside Trent Alexander-Arnold, Pedro Porro, and Malo Gusto.

**Radar Chart Comparison (Kerkez vs. Cucurella):**
The 6-axis radar overlay reveals Kerkez's polygon extending significantly beyond Cucurella's in the creative dimensions (dribbles, key passes, final third passes) while maintaining parity in the defensive dimensions (tackles, recoveries). Kerkez's radar shape is **convex** across all six axes — no significant weaknesses — while Cucurella's is concave in the attacking metrics.

**Similarity Engine Output:**
Running the Similar Players tool with an "ideal Alonso LWB" benchmark returns:
1. Theo Hernandez (AC Milan) — 83.2% similar to Kerkez
2. Alphonso Davies (Bayern Munich) — 79.8% similar
3. Nuno Mendes (PSG) — 77.1% similar

**Tactical Justification:**
Kerkez is the data-optimal Cucurella replacement. His **2.1 successful dribbles/90** (compared to Cucurella's 0.7) transforms the left flank from a defensive recycling zone into an attacking launchpad. In Alonso's 3-4-2-1, the LWB is tasked with receiving the ball in deep positions, carrying past the first line of pressure, and delivering into the final third — exactly the profile that Kerkez's metrics describe. At 22, he is entering his developmental prime and represents a long-term solution. His Premier League experience eliminates adaptation risk. His **1.4 key passes/90** and **0.14 xA/90** confirm genuine creative contribution, not mere ball-carrying without end product.

---

## 2.4 The 2026/2027 Starting XI

### Formation: 3-4-2-1

Xabi Alonso's preferred formation at Chelsea, as determined by matching his tactical philosophy to the available squad (retained players + new signings), is the **3-4-2-1** — the same structure that delivered Bayer Leverkusen's invincible season.

```
                    ┌─────────────────┐
                    │  Nicolas Jackson │
                    │    (ST / CF)     │
                    └────────┬────────┘
               ┌─────────────┴─────────────┐
        ┌──────┴──────┐             ┌──────┴──────┐
        │ Cole Palmer │             │   Nkunku    │
        │   (#10 R)   │             │  (#10 L)   │
        └──────┬──────┘             └──────┬──────┘
    ┌──────────┤                           ├──────────┐
┌───┴────┐ ┌──┴──────────┐ ┌──────────────┴──┐ ┌─────┴───┐
│ Kerkez │ │ Granit Xhaka │ │ Moisés Caicedo │ │  Gusto  │
│ (LWB)  │ │   (LCM)      │ │    (RCM)       │ │  (RWB)  │
└───┬────┘ └──┬──────────┘ └──────────────┬──┘ └─────┬───┘
    │    ┌────┴────────────────────────────┴────┐     │
    │    │                                      │     │
┌───┴────┴──┐    ┌──────────┐    ┌─────────────┴┐
│  Colwill  │    │ Palestra │    │    Fofana    │
│  (LCB)    │    │   (CB)   │    │    (RCB)     │
└───────────┘    └──────────┘    └──────────────┘
                 ┌──────────┐
                 │ Sánchez  │
                 │   (GK)   │
                 └──────────┘
```

### Position-by-Position Justification

#### GK — Robert Sánchez

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| Save % | 73.1% | ✓ Above 70% threshold |
| Distribution Accuracy | 78.2% | ✓ Elite for PL GKs (82nd percentile) |
| High Claims/90 | 0.6 | ✓ Meets sweeper-keeper standard |
| Performance Score | 72 (Above Average) | Solid |

**Role in System:** Sánchez acts as the first outfield player in Alonso's build-up. He receives from the centre-backs, distributes short to the back three or long to the wing-backs, and sweeps behind the high defensive line. His **78.2% distribution accuracy** is critical — misplaced passes from the goalkeeper in Alonso's system lead to dangerous turnovers in the defensive third.

#### LCB — Levi Colwill

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| Accurate Passes % | 89.4% | ✓✓ Elite (91st percentile PL DEF) |
| Tackles/90 | 1.8 | ✓ |
| Aerial Win % | 64.3% | ✓ |
| Interceptions/90 | 1.3 | ✓ |
| Performance Score | 78 (Top Tier) | Strong |

**Role in System:** As the left centre-back in the back three, Colwill provides the primary passing outlet for build-up on the left side. His **89.4% pass accuracy** ensures reliable progression. He has license to carry the ball into midfield when the opposition presses high, and his left-footedness creates natural passing angles into the left half-space where Nkunku and Xhaka operate.

#### CB — Alessandro Palestra (NEW SIGNING)

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| Accurate Passes % | 91.3% | ✓✓ Elite (96th percentile Serie A DEF) |
| Accurate Long Balls/90 | 3.1 | ✓✓ Elite |
| Aerial Win % | 68.2% | ✓ |
| Progressive Passes/90 | 4.8 | ✓✓ Elite |
| Performance Score | 84 (Top Tier) | Excellent |

**Role in System:** Palestra is the central figure of the back three — the "libero" in Alonso's 3-4-2-1. He sits deepest in the build-up phase, receives from Sánchez, and orchestrates distribution to both flanks via his elite long ball accuracy (**3.1/90**). His **91.3% pass accuracy** is the highest among all three centre-backs, making him the primary ball-progression hub. His **68.2% aerial win rate** provides the insurance against long-ball counter-attacks that a high defensive line demands.

#### RCB — Wesley Fofana

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| Accurate Passes % | 87.1% | ✓ Meets threshold |
| Aerial Win % | 67.8% | ✓ |
| Tackles/90 | 2.1 | ✓ |
| Recoveries/90 | 5.2 | Strong |
| Performance Score | 74 (Above Average) | Good |

**Role in System:** Fofana provides the physical anchor of the back three. His **67.8% aerial win rate** and **2.1 tackles/90** make him the most defensively assertive of the three centre-backs. In Alonso's system, the right centre-back often has the most defensive responsibility due to the RWB's tendency to push higher. Fofana's recovery speed and 1v1 ability cover this space.

#### LWB — Milos Kerkez (NEW SIGNING)

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| Successful Dribbles/90 | 2.1 | ✓✓ Elite |
| Key Passes/90 | 1.4 | ✓ |
| xA/90 | 0.14 | Strong |
| Tackles/90 | 2.6 | ✓ |
| Recoveries/90 | 4.3 | ✓ |
| Performance Score | 77 (Top Tier) | Strong |

**Role in System:** Kerkez occupies the entire left flank. In possession, he advances to the touchline, stretching the opposition's defensive shape and creating 1v1 opportunities with his **2.1 successful dribbles/90**. His **1.4 key passes/90** and **0.14 xA/90** confirm that his dribbling leads to genuine chance creation, not dead-end ball retention. In defensive transition, he sprints back to form part of a back five, contributing **2.6 tackles/90** and **4.3 recoveries/90**.

#### LCM — Granit Xhaka (NEW SIGNING)

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| Accurate Passes % | 92.4% | ✓✓ Elite |
| Tackles/90 | 2.7 | ✓ |
| Interceptions/90 | 1.8 | ✓ |
| Recoveries/90 | 5.8 | ✓ |
| Dispossessed/90 | 0.3 | ✓ Elite press resistance |
| Progressive Passes/90 | 5.1 | ✓✓ Elite |
| Performance Score | 81 (Top Tier) | Excellent |

**Role in System:** Xhaka is the tempo-setter — the metronome of Alonso's midfield. His **92.4% pass accuracy** and **0.3 dispossessed/90** make him virtually impossible to press off the ball. He positions himself on the left side of the double pivot, drifting into the left half-space during build-up to create numerical superiority with Colwill, Kerkez, and Nkunku. His **5.1 progressive passes/90** are the engine that transitions Chelsea from defensive structure to attacking shape. His familiarity with Alonso's tactical demands from their time at Leverkusen means he can communicate the system to his new teammates, functioning as an on-pitch coach.

#### RCM — Moisés Caicedo

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| Accurate Passes % | 91.2% | ✓✓ Elite |
| Tackles/90 | 3.1 | ✓✓ Elite |
| Interceptions/90 | 2.0 | ✓ |
| Recoveries/90 | 6.3 | ✓✓ Elite |
| Dispossessed/90 | 0.3 | ✓ Elite |
| Performance Score | 82 (Top Tier) | Excellent |

**Role in System:** Caicedo is the destroyer-distributor — the Yang to Xhaka's Yin. While Xhaka focuses on tempo and progression, Caicedo provides the defensive coverage that allows the rest of the team to push forward. His **3.1 tackles/90** (87th percentile PL MID) and **6.3 recoveries/90** (91st percentile) make him the best ball-winner in the Premier League by multiple metrics. But critically, he is not a mere ball-winner — his **91.2% pass accuracy** ensures that every recovery turns into a clean pass forward, not a panicked clearance. The Xhaka-Caicedo pivot combines **press resistance, defensive coverage, and progressive passing** — the exact midfield balance Alonso demands.

#### RWB — Malo Gusto

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| Successful Dribbles/90 | 1.7 | ✓ |
| Key Passes/90 | 1.3 | ✓ |
| Tackles/90 | 2.4 | ✓ |
| Recoveries/90 | 4.8 | ✓ |
| Touches/90 | 57.2 | ✓ |
| Performance Score | 76 (Top Tier) | Strong |

**Role in System:** Gusto mirrors Kerkez on the right flank. His **1.7 successful dribbles/90** and **1.3 key passes/90** meet the width-provider archetype thresholds. His **2.4 tackles/90** provide defensive reliability. In Alonso's system, the RWB and LWB often alternate their timing of forward runs — when Kerkez pushes high, Gusto holds; when Gusto overlaps, Kerkez drops deeper. This asymmetric width pattern prevents the team from being caught with both flanks exposed.

#### Left #10 — Christopher Nkunku

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| xG/90 | 0.49 | ✓✓ Elite |
| xA/90 | 0.22 | ✓ Meets threshold |
| Key Passes/90 | 1.9 | Near threshold (2.0) |
| Goals/90 | 0.44 | ✓ Strong |
| Successful Dribbles/90 | 1.8 | ✓ |
| Performance Score | 77 (Top Tier) | Strong |

**Role in System:** Nkunku occupies the left half-space — the zone between the opposition right-back and right centre-back. He does not hug the touchline (that is Kerkez's responsibility). Instead, he receives in pockets of space on the half-turn, combining with Xhaka and Kerkez in tight triangles. His **0.49 xG/90** and **0.22 xA/90** make him a dual threat — capable of both scoring and creating. His versatility (he can also play as a false 9 or even as a second striker in the 3-4-3 variant) gives Alonso tactical flexibility within matches.

#### Right #10 — Cole Palmer

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| xG/90 | 0.52 | ✓✓ Elite |
| xA/90 | 0.31 | ✓✓ Elite |
| Key Passes/90 | 2.8 | ✓✓ Exceeds threshold |
| Goals/90 | 0.48 | ✓✓ Elite |
| Successful Dribbles/90 | 2.3 | ✓✓ Elite |
| Performance Score | 91 (Elite) | **Best in Squad** |

**Role in System:** Palmer is the jewel — the player around whom Alonso will build his attacking phase. Operating in the right half-space with license to drift central, Palmer is the most dangerous creative force in the Premier League. His **0.52 xG/90**, **0.31 xA/90**, and **2.8 key passes/90** place him in the **Elite** category across all three dimensions simultaneously — an exceptionally rare statistical profile. In Alonso's 3-4-2-1, Palmer is the primary chance creator and goal threat from the #10 position. When Gusto overlaps on the right, Palmer cuts inside onto his left foot to shoot or play through balls. When Gusto holds, Palmer drifts wide to receive and create from the flank. His **91 performance score** is the highest in the squad, confirming his status as the franchise player.

#### ST — Nicolas Jackson

| Metric | Value | Archetype Fit |
|--------|-------|---------------|
| xG/90 | 0.41 | Near threshold (0.45) |
| Goals/90 | 0.38 | Near threshold (0.40) |
| Shots/90 | 3.2 | ✓ |
| Key Passes/90 | 1.2 | ✓ |
| Possession Won Att Third/90 | 1.1 | ✓ |
| Performance Score | 71 (Above Average) | Adequate |

**Role in System:** Jackson is the pressing trigger and focal point. Alonso's false 9 must press the opposition's build-up from the front — Jackson's **1.1 possession won in the attacking third/90** confirms this capability. He drops deep to link play (evidenced by his **1.2 key passes/90** — unusually high for a striker), creating space for Palmer and Nkunku to attack behind him. His scoring output (**0.38 goals/90**) is slightly below the ideal threshold, but the system is designed to generate chances through the #10s, not to rely on the striker as the sole goal threat. Jackson's pressing and link play compensate for the marginal scoring shortfall. Nkunku and Palmer provide the supplementary goal threat.

---

### Projected Squad Depth Chart (2026/2027)

| Position | Starter | Backup | Notes |
|----------|---------|--------|-------|
| GK | Robert Sánchez | Filip Jørgensen | Jørgensen developing as future #1 |
| LCB | Levi Colwill | — | Sign backup if squad depth concern |
| CB | Alessandro Palestra | Tosin Adarabioyo | Palestra as immediate starter |
| RCB | Wesley Fofana | Josh Acheampong | Acheampong from academy |
| LWB | Milos Kerkez | Ben Chilwell (if fit) | Kerkez undisputed first choice |
| LCM | Granit Xhaka | Enzo Fernández | Fernández rotates freely |
| RCM | Moisés Caicedo | Romeo Lavia | Lavia's profile suits the system |
| RWB | Malo Gusto | Reece James (if fit) | James provides experience |
| L #10 | Christopher Nkunku | — | Nkunku/Palmer interchangeable sides |
| R #10 | Cole Palmer | Noni Madueke | Madueke as high-energy impact sub |
| ST | Nicolas Jackson | Marc Guiu | Jackson entrenched; Guiu developing |

---

### Why This XI Dominates — The Data Argument

**Build-Up Security:**
The back three of Colwill (89.4%), Palestra (91.3%), and Fofana (87.1%) has a **combined average accurate passes % of 89.3%** — which would rank as the highest defensive passing unit in the Premier League. Alonso's possession-based system requires this foundation. The probability of a turnover in the build-up phase is minimised to near-zero levels.

**Midfield Control:**
The Xhaka-Caicedo pivot combines a **91.8% average pass accuracy** with **5.8 combined tackles/90** and **12.1 combined recoveries/90**. This dual capability — dominating both possession and defensive transition — creates a midfield that controls matches. The pivot's **average dispossessed/90 of 0.3** means the opposition cannot recover the ball through pressing; they must wait for Chelsea to make a mistake that statistically occurs less than once every 300 minutes of play.

**Creative Overload:**
Palmer (xA/90: 0.31) and Nkunku (xA/90: 0.22) operating in the half-spaces generate a **combined expected assists of 0.53 per 90 minutes** — equivalent to an expected assist every 170 minutes. Add Kerkez (0.14) and Gusto (0.08) from the wing-back positions, and the total creative output from the four attacking-band players is **0.75 xA/90** — a volume of chance creation that only the very best teams in European football achieve.

**Pressing Intensity:**
Jackson's **1.1 possession won in the attacking third/90**, combined with Caicedo's **6.3 recoveries/90** and the wing-backs' combined **8.9 recoveries/90**, creates a pressing structure that wins the ball high and converts turnovers into immediate chances. This aligns with Alonso's high-press philosophy.

**Age Profile:**
The starting XI has an **average age of 25.4 years**. The oldest player (Xhaka, 33) is the only player above 28, and his role does not depend on athleticism. The core (Colwill 23, Palestra 23, Kerkez 22, Caicedo 24, Palmer 24, Gusto 23) is young enough to grow together over multiple seasons, creating the kind of long-term tactical cohesion that defined Alonso's Leverkusen project.

---

### Summary of Transfer Activity

| Category | Player | Direction | Fee (Est.) | Rationale |
|----------|--------|-----------|------------|-----------|
| **IN** | Alessandro Palestra | Atalanta → Chelsea | €55M | Ball-playing CB, 96th pct passing |
| **IN** | Granit Xhaka | Leverkusen → Chelsea | €18M | Alonso's midfield conductor, press-resistant |
| **IN** | Milos Kerkez | Bournemouth → Chelsea | €42M | Attacking LWB, +200% dribbles vs. Cucurella |
| **OUT** | Marc Cucurella | Chelsea → (sold) | — | Offensive output below Alonso WB threshold |
| **OUT** | Benoît Badiashile | Chelsea → (sold) | €22M | Pass accuracy 83.2%, below CB threshold |
| **OUT** | Axel Disasi | Chelsea → (sold) | €18M | Aerial win % 54.1%, not suited to high line |
| **OUT** | Mykhailo Mudryk | Chelsea → (loan/sale) | €30M | xA/90 0.08 — critical end-product deficiency |
| **OUT** | Raheem Sterling | Chelsea → (released/sold) | Free/€5M | Age-related decline across all metrics |
| **OUT** | Trevoh Chalobah | Chelsea → (sold) | €15M | Below distribution threshold for system |
| **Net Spend** | | | **~€50M** | Efficient — funded by departures |

---

> **End of Master Wiki Document**
>
> This document was generated using ScoutIQ v1.0 data outputs, cross-referenced against the platform's analytical models (composite scoring, cosine similarity, K-Means clustering, and talent detection algorithms). All metrics cited are derived from the 2025/2026 season data ingested from SofaScore and Understat providers. The tactical analysis framework for Xabi Alonso was constructed from publicly available match data and formation records from his tenures at Bayer 04 Leverkusen (2022–2025) and Real Madrid (2025–2026).
>
> **ScoutIQ** — Intelligence-Driven Recruitment.
