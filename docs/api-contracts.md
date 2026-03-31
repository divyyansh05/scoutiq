# ScoutIQ API Contracts

Base URL: http://localhost:8000
API prefix: /api/ (NOT /api/v1/)
Docs UI:    http://localhost:8000/docs

---

## Health

### GET /health
No params. Returns DB connectivity status.
Response: { "status": "ok", "service": "ScoutIQ API", "version": "1.0.0" }
Status: EXISTS ✅

---

## Dashboard

### GET /api/dashboard/stats
No params.
Returns: player count, deep stats count, leagues covered count.
Status: EXISTS ✅

### GET /api/dashboard/top-performers
Params: limit (int, default 5), season (str, optional)
Returns: top N players by performance score across all positions.
Status: EXISTS ✅

### GET /api/dashboard/coverage
No params.
Returns: per-league breakdown — teams, players, minutes coverage, xG coverage,
         deep stats %, avg xG, avg rating. Expandable season breakdown.
Status: EXISTS ✅

---

## Players

### GET /api/players/search
Params:
  q          string  optional — player name or club
  season     string  optional — e.g. "2025-26"
  league     string  optional
  position   string  optional — GK/DEF/MID/WNG/FWD
  min_age    int     optional
  max_age    int     optional
  min_minutes int    optional (default: MIN_MINUTES from config = 900)
  sort       string  optional — one of 8 sort options
  page       int     optional (default 1)
  page_size  int     optional (default 20)
Returns: paginated player list with per-90 stats + performance score.
Status: EXISTS ✅

### GET /api/players/{player_id}
Params: player_id (path, int), season (str, optional), league (str, optional)
Returns: full player profile — stats, score, position, team, league, season.
Status: EXISTS ✅

### GET /api/players/{player_id}/seasons
Params: player_id (path)
Returns: all seasons this player appears in the DB.
Status: EXISTS ✅

### GET /api/players/{player_id}/similar
Params:
  player_id  int   path
  season     str   optional (default: current)
  n          int   optional (default 10, max 30)
  min_minutes int  optional
  league     str   optional (filter to same league)
Returns: top N similar players by cosine similarity on 13 per-90 features.
Similarity score as % included.
Status: EXISTS ✅

### GET /api/players/{player_id}/adaptability
Params: player_id (path), season (str, optional)
Returns: team fit analysis — compatibility % with each team's avg style.
Status: EXISTS ✅

---

## Teams

### GET /api/teams/styles
Params: season (str, optional)
Returns: K-Means cluster assignment (5 styles) for each team.
Styles: High Press, Possession, Counter Attack, Direct Play, Defensive Block.
Status: EXISTS ✅

### GET /api/teams/chelsea
Params: season (str, optional)
Returns: top 3 players + squad avg stats for Chelsea (team_id=338).
Status: EXISTS ✅

### GET /api/teams/chelsea/full
Params: season (str, optional)
Returns: full Chelsea roster with stats and scores.
Status: EXISTS ✅

### GET /api/teams/{team_id}
Params: team_id (path), season (str, optional)
Returns: aggregated squad stats — avg age, avg rating, xG totals, squad size.
Status: EXISTS ✅

### GET /api/teams/{team_id}/players
Params: team_id (path), season (str, optional)
Returns: full roster with individual player stats.
Status: EXISTS ✅

---

## Analytics

### GET /api/analytics/scores
Params: limit (int, default 50, max 500), position (str, optional), season (str, optional)
Returns: top players by performance score. NOTE: computed at request time in Python.
Status: EXISTS ✅

### GET /api/analytics/talents
Params:
  season       str   optional (default: current)
  max_age      int   optional (default 23, max 30)
  min_minutes  int   optional (default 100)
  top_percentile float optional (default 75)
Returns: young players exceeding top_percentile threshold for their position.
Status: EXISTS ✅

### GET /api/analytics/scatter
Params:
  x_metric    str   required — one of 12 scatter metrics
  y_metric    str   required — one of 12 scatter metrics
  season      str   optional
  min_minutes int   optional
  positions   list  optional — filter by position group(s)
Returns: scatter data with Chelsea highlighted.
Status: EXISTS ✅

### POST /api/analytics/weighted-ranking
Body: { weights: { metric: 0-5, ... }, season, position, league, min_minutes }
Returns: players ranked by custom composite score.
Status: EXISTS ✅

---

## Rankings

### GET /api/rankings/
Params:
  metric      str   required — one of 25 allowed metrics
  season      str   optional
  position    str   optional
  league      str   optional
  min_minutes int   optional (slider, 100-2000)
  per_90      bool  optional (default false)
  limit       int   optional (default 50)
Returns: leaderboard sorted by metric. Top 3 get medal colours in UI.
Status: EXISTS ✅

---

## Search

### GET /api/search/
Params: q (str, required, min 2 chars)
Returns: combined players + teams results.
Status: EXISTS ✅

---

## Scouting Lists (SQLite)

### GET/POST /api/lists/
GET: returns all scouting lists.
POST body: { name, description }
Status: EXISTS ✅

### DELETE /api/lists/{list_id}
Cascades — also removes all list_players entries.
Status: EXISTS ✅

### GET/POST /api/lists/{list_id}/players
GET: returns players in this list.
POST body: { player_id, player_name, team_name, position }
Status: EXISTS ✅

### DELETE /api/lists/{list_id}/players/{player_id}
Status: EXISTS ✅

### GET/POST /api/lists/notes/{player_id}
GET: returns scout note for this player.
POST body: { note_text } — upserts (creates or updates).
Status: EXISTS ✅

### GET/POST/DELETE /api/lists/searches/
GET: all saved searches.
POST body: { name, description, filters_json }
DELETE /api/lists/searches/{search_id}
Status: EXISTS ✅

---

## Missing Endpoints (must be built)

### GET /api/leagues                                               MISSING ❌
Returns list of leagues with data in the DB.
Response shape: { data: [{ league_id, league_name, seasons_available: [str] }] }
Use case: populate league selector dropdowns from DB, not hardcoded frontend list.

### GET /api/players/compare                                       MISSING ❌
Params: player_a_id (int, required), player_b_id (int, required), season (str, optional)
Returns side-by-side profiles for both players.
Response:
{
  "player_a": { ...full player profile with per-90 stats and score },
  "player_b": { ...same shape }
}
Required by: /compare frontend page (not yet built).

---

## Response Shape Conventions (current — NOT using envelope wrapper)
Single objects returned directly (not wrapped in { "data": {} }).
Lists returned as plain arrays or with pagination metadata.
Errors: FastAPI default format — { "detail": "message" }
NOTE: backend does NOT use the { "data": [...], "total": N } envelope pattern
described in some reference docs. Match what the code actually returns.
