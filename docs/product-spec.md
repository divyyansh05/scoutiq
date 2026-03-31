# ScoutIQ — Product Specification

## Purpose
A professional-grade football scouting tool for performance analysts and
scouting analysts at clubs. Surfaces player intelligence from structured
football data collected by the football-etl-pipeline.

## Target User
A data-literate football analyst who wants to:
- Identify top performers in a league by position this season
- Find players matching a specific statistical profile
- Compare two players across key metrics
- Track a player's performance trend across seasons
- Maintain a shortlist of players under consideration

## Success Criteria
A club analyst opens ScoutIQ and within 30 seconds can answer:
"Who are the top 5 performing central defenders in the Premier League
this season, by our composite performance methodology?"

## Pages That Exist (do not rebuild)

| Route          | Page              | Description                                              |
|----------------|-------------------|----------------------------------------------------------|
| /              | Dashboard         | Live DB stats, top performers, Chelsea squad focus       |
| /players       | PlayerSearch      | Filter by position/league/age/season, CSV export         |
| /players/:id   | PlayerProfile     | Full stats, radar, notes, similar players                |
| /similar       | SimilarPlayers    | Cosine similarity + team adaptability                    |
| /rankings      | Rankings          | Leaderboard for any of 25 metrics                        |
| /scatter       | ScatterPlot       | Any metric vs any metric scatter                         |
| /talent        | EmergingTalent    | Young players outperforming their cohort                 |
| /team-style    | TeamStyle         | K-Means team playing style clusters                      |
| /lists         | ScoutingLists     | Create/manage scouting lists, add players                |
| /coverage      | LeagueCoverage    | Data availability by league and season                   |
| /weighting     | MetricWeighting   | Custom composite scoring via weight sliders              |
| /teams/:teamId | TeamProfile       | Full team roster with sortable stats                     |
| /chelsea       | ChelseaTeam       | Chelsea-specific full squad view (season-filtered)       |

## Pages To Build (priority order)

### 1. Player Comparison (/compare) — HIGH PRIORITY
What: Side-by-side comparison of exactly two players.
Layout:
  Left column: Player A (name, club, position, score)
  Middle column: Metric labels
  Right column: Player B (same)
Highlight the better value in each row (green bg).
Per-90 and raw totals both visible.
Shareable via URL: /compare?a=123&b=456
Backend needed: GET /api/players/compare?player_a_id=X&player_b_id=Y

### 2. Season Trend on Player Profile — MEDIUM PRIORITY
What: Add a small chart to PlayerProfile showing performance_score across seasons.
Already available: GET /api/players/{id}/seasons returns season history.
Just needs a line/bar chart component added to PlayerProfile.jsx.

### 3. Shortlist (localStorage) — LOW PRIORITY
What: Save players without a backend. Use localStorage.
Add "Add to Shortlist" button on PlayerProfile and search results.
Display on a /shortlist page.
No backend changes needed.

## What ScoutIQ Is Not
- Not a video analysis tool
- Not a transfer platform or market value tool
- Not a live match tracker
- Not a team tactics board
- Not multi-user (no auth, no shared state)

## Data Constraints
- Position comparison is within 5 groups (GK/DEF/MID/WNG/FWD) — backend splits WNG from MID
  but DB only has 4 groups. This means some WNG players scored vs MID cohort.
- League difficulty not adjusted — PL and La Liga players compared equally.
- Performance scores computed at request time by Python (not pre-fetched from player_scores table yet).
- Data current as of latest pipeline run. No live match data.
