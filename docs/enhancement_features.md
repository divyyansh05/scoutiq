# ScoutIQ — Enhancement Features
# Status: Backlog · Source: Product Feedback
# Last updated: 2026-06-22

---

## 1. Club Budget Snapshot
Pull from publicly available financial transparency reports (e.g. UEFA Club Licensing, Companies House filings) to display a club's estimated transfer budget, wage spend, and net spend for the current and prior window. Shown as a read-only summary card on the Club Profile page. Helps analysts understand the financial envelope before building a shortlist.

---

## 2. SWOT Analysis — Club / Squad
Auto-generate a SWOT (Strengths, Weaknesses, Opportunities, Threats) panel for a given club based on live squad data. Strengths and weaknesses derived from squad metrics vs league average; opportunities derived from expiring contracts and U23 players above percentile threshold; threats derived from key players in final year of contract or with high injury history. Available on the Club Profile page.

---

## 3. Priority Position Identifier
Given a club's current squad composition and performance scores, surface the top 2–3 positional gaps that most need addressing in the next transfer window. Ranked by impact on squad quality (i.e. which position, if improved, raises the overall squad average most). Output shown as a ranked list with justification text.

---

## 4. Transfer Investment vs. League Position
A historical chart (line or scatter) showing a club's cumulative net transfer spend plotted against their final league position each season. Surfaces whether spending correlates with results. Available on the Club Profile page. Uses public transfer data (Transfermarkt-style) if available in the DB, or manual input.

---

## 5. Recruitment Board
A Kanban-style or table view where analysts can manage transfer targets across stages: **Identified → Scouted → Shortlisted → Approached → Signed / Rejected**. Each card shows player name, position, age, performance score, estimated value, and contract expiry. Backed by a new SQLite table (extends the existing scouting_lists schema). Replaces the current flat Scouting Lists page with a pipeline view.

---

## 6. Squad Diagnostic — Including Academy Players
Extend the existing Squad Gap analysis to include academy / youth squad players (U18, U21). For each positional gap identified, show whether an internal academy player is close to first-team readiness (based on age, percentile rank within their competition). The diagnostic flags: "External signing needed" vs. "Internal promotion candidate available." Requires tagging players with a squad tier (First Team / U21 / U18) in the DB or via a manual override.

---

## 7. Final Squad Planner (e.g. 2026–27)
A drag-and-drop squad builder showing the projected 25-man (or club-defined) squad for the next season. Analysts can slot in current players, proposed signings, and loanees. The tool highlights: positional balance, age spread, wage budget consumed (if available), and nationality slots. Outputs a shareable summary. Chelsea-specific by default but configurable per club.

---

## 8. Tactical Fit — Manager Profile Matching
Define a manager's tactical system as a set of weighted KPIs (e.g. a high-press manager values recoveries/90, defensive duels won, progressive runs; a possession manager values pass accuracy, key passes, touches in box). When viewing any player profile, display a **Tactical Fit Score** (0–100) showing how well that player's stats match the manager's required profile. Managers are stored as named presets that an analyst can create and save.

---

## 9. Player Context — Team-Level Stats Overlay
On each player profile, add a context panel showing how the player's individual stats relate to the team's overall playing style. For example: if the team averages 58% possession, show the player's touch rate and pass accuracy relative to that. If the team concedes few goals, contextualise the CB's defensive load accordingly. Data sourced from `team_match_stats` aggregates.

---

## 10. Positional Profiling — Sub-Profiles per Position
Move beyond the four broad position groups (GK / DEF / MID / FWD) to named **positional profiles** with bespoke KPI sets. Each profile has a defined set of key metrics and thresholds. Examples:

| Profile | Key KPIs |
|---|---|
| Ball-Playing GK | Long pass accuracy, passes p90, gk_exits p90, sweeper actions |
| Inverted Winger (Left foot, right side) | Shots p90, dribbles p90, xG p90, touches in box |
| Traditional Winger | Crosses p90, assists p90, progressive runs, dribbles |
| Attacking Full-Back | Crosses p90, xa p90, progressive runs, key passes, defensive duels |
| Defensive Full-Back | Defensive duels won, interceptions p90, aerial won, pass accuracy |
| Ball-Playing CB | Passes p90, long passes accurate, progressive passes, defensive duels |
| Aerial CB | Aerial duels won p90, clearances p90, defensive duels won |
| Deep-Lying Midfielder (DM) | Interceptions p90, defensive duels won, recoveries p90, pass accuracy |
| Box-to-Box Midfielder | Key passes p90, tackles p90, progressive runs, goals p90 |
| False 9 | xG p90, key passes p90, touches in box, dribbles p90 |
| Target Striker | Aerial duels won, goals p90, shots p90, xG p90 |

Profiles can be applied as filters on the Player Search page to instantly surface players who match a specific sub-type.

---

## 11. Gap Analysis by Positional Profile
Extend the current Squad Gap page to work at the sub-profile level (from Feature 10). Instead of showing "DEF: 4 players", show: "Ball-Playing CB: 1 player (gap)" and "Aerial CB: 2 players (adequate)". Flags each profile slot as Covered / Thin / Gap based on player count and average score in that profile.

---

## 12. Transfer Target Shortlist — Profile-Driven
Given a target positional profile (from Feature 10) and a minimum performance score / percentile threshold, automatically query the database and return the top N matching players globally. Displayed as a ranked shortlist with: name, nationality, age, club, competition, profile match score, performance score, and estimated market value. One-click to add any player to the Recruitment Board (Feature 5).

---

## 13. Squad Fit — Cultural & Nationality Layer
When evaluating a transfer target, show an additional **Squad Fit** card on the player profile with:
- **Nationality cluster**: how many teammates from the same country or region already at the club (useful for settling-in assessment)
- **Language group**: shared language with existing squad members
- **League familiarity**: number of seasons in the same league as the target club, or similar-tier league

Data sourced from `players.nationality` and `player_match_stats.competition_name`. No external API required — purely derived from existing data.

---

## 14. Transfer Feasibility Assessment
For any player on a shortlist, display a **Feasibility Panel** with:
- **Country / League accessibility**: whether the player's current league has a history of selling to the target league (signal, not guarantee)
- **Estimated transfer value**: market_value_eur from DB, with ScoutIQ model estimate alongside
- **Contract situation**: years remaining on contract (derived from `contract_expires` field in players table), with flags: "Expiring (≤1 yr)", "Mid-contract", "Long-term"
- **Availability signal**: if contract ≤ 12 months, flag as "Potential free agent" or "Leverage window"

This panel sits on the player profile page and in the Recruitment Board card view.

---

## Summary — Feature Priority Order

| # | Feature | Complexity | Impact |
|---|---|---|---|
| 5 | Recruitment Board | Medium | High |
| 10 | Positional Profiling | Medium | High |
| 12 | Profile-Driven Shortlist | Low | High |
| 8 | Tactical Fit Matching | Medium | High |
| 14 | Transfer Feasibility | Low | High |
| 11 | Profile-Level Gap Analysis | Low | Medium |
| 6 | Squad Diagnostic + Academy | Medium | Medium |
| 3 | Priority Position Identifier | Low | Medium |
| 9 | Team Context Overlay | Low | Medium |
| 13 | Squad Fit — Cultural Layer | Low | Medium |
| 7 | Final Squad Planner | High | Medium |
| 2 | SWOT Analysis | High | Medium |
| 4 | Transfer Investment vs Position | Medium | Low |
| 1 | Budget Snapshot | High | Low |
