# ScoutIQ Presentation Script — Chelsea FC / Xabi Alonso Case Study

**Duration:** ~35–40 minutes  
**Format:** Word-for-word teleprompter with explicit action cues.  
**Key:** Every number, player name, and screen action below is verified against live data.

---

## PART 1 — PLATFORM TOUR (0:00–15:00)

---

### 1.1 · Dashboard (0:00–3:00)

**[ACTION: Open browser at `http://localhost:5173/` — the Dashboard. Mouse still. Let it fully load.]**

**SPEAK:**
"Hello. Today I'm going to walk you through ScoutIQ — a professional football scouting intelligence platform I built from scratch. Everything you're about to see is powered by a live PostgreSQL data warehouse, a Python FastAPI backend, and a React frontend.

The platform currently holds data on five thousand eight hundred and eighteen players — that's over six hundred and eighty-six thousand individual match records, fed in from Wyscout across every major European competition.

Every piece of data you see here is real. There are no mock numbers, no placeholder content."

**[ACTION: Hover the mouse slowly over the four summary stat cards at the top — Total Players, Scored Profiles, Match Records, Competitions.]**

**SPEAK:**
"The dashboard surfaces the headline numbers. We have twenty-one thousand scored player profiles — each one carrying a composite Performance Score that I'll explain in a moment. And we cover fifteen competitions, including the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, and the Champions League."

**[ACTION: Scroll down slowly until the Top Performers widget is fully visible. Hover over the score ring of the first player shown.]**

**SPEAK:**
"The central innovation in ScoutIQ is this — the Performance Score. This is a zero to one hundred composite metric that is position-weighted and percentile-ranked. So it doesn't just count a player's raw numbers — it weights the metrics that actually matter for their position, normalises them per ninety minutes, and then ranks them against every other player in the same position across the same competition. The colour band tells you immediately: green is elite, teal is top tier, yellow is average."

---

### 1.2 · Player Search (3:00–7:00)

**[ACTION: Click 'PLAYER SEARCH' in the left sidebar. Wait for `/players` to load.]**

**SPEAK:**
"This is the Player Search engine. It's multi-dimensional — you can filter by position, competition, age, minutes, and sort by any metric."

**[ACTION: Click the 'FWD' position tab at the top of the search results.]**

**SPEAK:**
"Let's scope to Forwards."

**[ACTION: In the League dropdown, select or type 'England. Premier League'.]**

**SPEAK:**
"...in the Premier League."

**[ACTION: In the Sort dropdown, select 'Score'.]**

**SPEAK:**
"Sorting by Performance Score, Haaland comes straight to the top. His score here reflects his dominance — the highest expected goals per ninety in the entire league at 0.78 xG per 90, across over eleven thousand minutes of Premier League football."

**[ACTION: Click the 'MID' position tab. Change sort to 'Score'.]**

**SPEAK:**
"If I switch to Midfielders, I can instantly see the creative engine room of the league ranked by their composite output."

**[ACTION: Click 'Add to Compare' on the first player card. Then click 'Add to Compare' on the second player card. Watch the ComparisonBar appear at the bottom.]**

**SPEAK:**
"ScoutIQ has a built-in comparison engine. I'll pin the top two midfielders and bring them into a head-to-head analysis."

**[ACTION: Click the 'Compare' button in the bottom ComparisonBar. The `/compare` page loads.]**

---

### 1.3 · Comparison Tool (7:00–10:00)

**[ACTION: Let the Compare page fully load. Rest the mouse near the radar chart.]**

**SPEAK:**
"This is the Compare view. At the top, you see both players' Performance Scores and percentile rankings side by side. The radar chart overlays their statistical footprints across six key metrics."

**[ACTION: Hover over different axes of the radar chart to reveal tooltips.]**

**SPEAK:**
"You can immediately read who is the higher volume creator, who wins more in the air, who defends more. No cognitive load — the chart does the work."

**[ACTION: Scroll down slowly to the metric table below the radar.]**

**SPEAK:**
"Below the radar is a granular metric table covering goals, assists, expected goals, expected assists, key passes, dribbles, aerials, tackles, and more. The green highlight automatically marks the statistically superior player in each row. A scout can scan this in ten seconds and make an informed decision."

---

### 1.4 · Similar Players — AI Similarity Engine (10:00–13:00)

**[ACTION: Click 'SIMILAR PLAYERS' in the left sidebar. The `/similar` page loads.]**

**SPEAK:**
"This is the Similarity Engine — one of the ML models powering ScoutIQ. The question it answers is: if a club loses a key player, who are the closest statistical equivalents available in the market?"

**[ACTION: In the search bar on this page, type 'Rodri'. Select 'Rodri' — Manchester City — from the dropdown.]**

**SPEAK:**
"Let's take Rodri from Manchester City. Arguably the best defensive midfielder in the world. His data profile is ninety-three point two percent pass accuracy, three point three three tackles per ninety, and four point one three interceptions per ninety in the Premier League."

**[ACTION: Wait for the results list to populate. Make sure 'Same League' is selected in the Scope toggle.]**

**SPEAK:**
"The engine computes a cosine similarity score between Rodri's per-ninety statistical vector and every other midfielder in the database. What you see here is a ranked shortlist ordered by percentage match. Each player's similarity score is displayed on the right."

**[ACTION: Click the compare icon on the top similar player to overlay them on the radar chart.]**

**SPEAK:**
"I can instantly overlay any similar player onto a radar chart here to visually compare their statistical shapes. This is how you go from 'we need a Rodri replacement' to a concrete target list in under sixty seconds."

---

### 1.5 · Emerging Talent (13:00–15:00)

**[ACTION: Click 'EMERGING TALENT' in the left sidebar. The `/talent` page loads.]**

**SPEAK:**
"The final piece of Part One is the Emerging Talent screen. This filters the database for players under a configurable age — default is twenty-three — who are already performing at the top percentile for their position."

**[ACTION: Set the Competition filter to 'England. Premier League'. Let the results load.]**

**SPEAK:**
"In the Premier League right now, the top under-23 performers by score include Savinho at Manchester City — twenty-two years old, score of 74 — and Chelsea's own Levi Colwill — twenty-three years old, score of 63.6 and in the 76th percentile for defenders. This is exactly the kind of intelligence that de-risks young player recruitment."

---

## PART 2 — CHELSEA FC CASE STUDY (15:00–40:00)

---

### 2.1 · Setting the Stage (15:00–19:00)

**[ACTION: Click 'SQUAD DIAGNOSTIC' in the left sidebar. The `/squad-gap` page loads. In the team dropdown, type or select 'Chelsea'. Click 'Run Diagnostic'.]**

**SPEAK:**
"For the remainder of this presentation, we are going to use ScoutIQ to solve a real-world problem.

The scenario: Chelsea Football Club. The board has just appointed Xabi Alonso as the new manager ahead of the 2026-27 season. Our job as the data team is to audit the current squad and identify targeted signings that fit Alonso's specific tactical system.

Alonso plays a 3-4-2-1. The philosophy is controlled possession, press-resistance, and attacking width through the wing-backs. To make this work at the highest level, we need three very specific profiles. One: progressive centre-backs who can play like midfielders — the Libero archetype. Two: wing-backs who provide elite attacking width and can take on defenders. Three: a press-resistant midfield controller who dominates possession and breaks up counter-attacks.

Let's start with the audit."

**[ACTION: Let the squad diagnostic results load fully. Point the mouse at the overall squad summary at the top.]**

**SPEAK:**
"The Squad Diagnostic gives us a position-by-position breakdown of Chelsea's current squad. Twenty-six players in the database. Two goalkeepers. Eleven defenders. And when we look at the average scores by position group — defenders are sitting at an average score of fifty-six point four, midfielders at fifty-two, forwards at fifty-two. These are above-average but not elite numbers."

**[ACTION: Scroll down or point the mouse at the DEF section of the diagnostic.]**

**SPEAK:**
"In defence, we can see the full picture. Wesley Fofana leads with a score of 72.1 and Adarabioyo at 73.5. These are good. But look further down the list — we have question marks around the wing-back positions."

---

### 2.2 · The Audit — Who Doesn't Fit (19:00–26:00)

**[ACTION: Go to the global search bar at the top. Type 'Cucurella'. Select 'Marc Cucurella' from the dropdown to navigate to his Player Profile.]**

**SPEAK:**
"Let's run the data on Marc Cucurella. He's been a loyal servant to Chelsea. But Alonso's system demands wing-backs who are genuinely dangerous in the final third. So let's look at his numbers objectively."

**[ACTION: Wait for the player profile to fully load. Scroll down slowly to the Statistics section — specifically the KPI table rows for attacking stats.]**

**SPEAK:**
"Cucurella's Performance Score is fifty. He's at the 47th percentile for defenders — average. But the detail is in these numbers. In Premier League football over nearly ten thousand and three hundred minutes — that's a huge sample — he managed zero point three two successful dribbles per ninety and zero point three one key passes per ninety.

In a Guardiola or Alonso-style system, the wing-back is your primary ball carrier and width creator. You need someone who can beat their man, who can produce assists, who can be a constant threat. These numbers don't support that role. The data is telling us: stylistic mismatch."

**[ACTION: Scroll back up to the Performance Score ring. Note the 50.0 score clearly on screen.]**

**SPEAK:**
"His score of 50 is not a bad player — it's an honest assessment. He is an average defender in the context of the Premier League. For a mid-table club, that works. For an Alonso possession system that demands more from the position, we need to upgrade.

Based on a similar data audit, we can also flag Malo Gusto on the right side — score of 37.8, in the 25th percentile — and Romeo Lavia, who has struggled for minutes and consistency. These three are the sales that fund our recruitment."

---

### 2.3 · Finding the Wing-Back (26:00–30:00)

**[ACTION: Click 'SCATTER PLOT' in the left sidebar. The `/scatter` page loads.]**

**SPEAK:**
"Now we spend the transfer budget. We need an attacking wing-back. The two metrics that define this profile are successful dribbles per ninety and key passes per ninety. Let me plot them."

**[ACTION: Set the X-axis dropdown to 'Dribbles per 90' and Y-axis to 'Key Passes per 90'. Set position filter to 'DEF'.]**

**SPEAK:**
"I'm plotting all defenders across the database — dribbles on the X axis, key passes on the Y axis. I want the player in the top-right quadrant. That's our target zone."

**[ACTION: Move the mouse to the top-right area of the scatter. Look for and hover over Frimpong or another top-right defender.]**

**SPEAK:**
"Up in that elite quadrant, the standout profile is Jeremie Frimpong at Liverpool. His numbers are two point six successful dribbles per ninety and one point one six key passes per ninety in the Premier League. Those are elite wing-back numbers. He also registers zero point two four expected assists per ninety. That's the attacking output that Alonso's system demands from that right wing-back position."

**[ACTION: Click on Frimpong's dot on the scatter to navigate to his profile OR use the global search to navigate to his profile directly.]**

**SPEAK:**
"Let's pull up his full profile to confirm."

**[ACTION: On Frimpong's player profile, hover the mouse over his score ring and then over the radar chart.]**

**SPEAK:**
"His Performance Score. His radar. This is our primary wing-back target. His data profile fits perfectly into Alonso's 3-4-2-1."

---

### 2.4 · Finding the Libero Centre-Back (30:00–34:00)

**[ACTION: Click 'PLAYER SEARCH' in the left sidebar. Click the 'DEF' tab. In the League dropdown, select 'England. Premier League'. In the Sort dropdown, select 'Score'.]**

**SPEAK:**
"Next we need our Libero — a centre-back who can orchestrate from deep. In Alonso's system, the central defender must be comfortable in possession, able to play through the press with accuracy. The key metric is pass accuracy."

**[ACTION: Scroll through the results. Use the global search bar at the top to search 'Saliba'. Navigate to William Saliba's profile.]**

**SPEAK:**
"In the Premier League, when you sort defenders by pass accuracy, one name dominates. William Saliba at Arsenal. His pass accuracy in Premier League football sits at 94.4 percent — that's the highest among Premier League centre-backs with meaningful minutes.

He also averages 1.79 accurate long balls per ninety — he's a genuine quarterback from defence. And his aerial dominance means he doesn't sacrifice the defensive fundamentals. His Performance Score is deep in the top tier."

**[ACTION: Hover over his radar chart on the profile page.]**

**SPEAK:**
"Look at his radar. The passing and recovery axes are exceptional. This is the Libero profile Alonso needs. Now, acquiring Saliba from Arsenal would be a complex negotiation — but ScoutIQ's job is to tell us who the data says is the best fit. The negotiation follows the data. He is our centre-back target."

---

### 2.5 · Finding the Midfield Controller (34:00–38:00)

**[ACTION: Click 'METRIC WEIGHTING' in the left sidebar. The `/weighting` page loads.]**

**SPEAK:**
"For the third signing — the midfield controller — I'm going to use ScoutIQ's custom Metric Weighting engine. This is where the tool becomes genuinely powerful. Instead of accepting a generic ranking, I can tell the algorithm exactly what Alonso's system demands."

**[ACTION: Find the pass accuracy slider and drag it to approximately 90. Find the tackles slider and drag to approximately 85. Find the interceptions slider and drag to approximately 80. Leave recoveries at a moderate level.]**

**SPEAK:**
"I'm loading three weights: heavy emphasis on pass accuracy — this is Alonso's non-negotiable — heavy weight on tackling, and significant weight on interceptions. I want a player who controls possession, wins the ball back, and rarely loses it."

**[ACTION: Wait for the ranked list below the sliders to update. Point to the top player on the list.]**

**SPEAK:**
"The algorithm re-ranks the entire database in real time. And the player it surfaces at the top of this specific profile is exactly who you'd expect if you know Alonso's football.

Rodri. Manchester City. Ninety-three point two percent pass accuracy in the Premier League. Three point three three tackles per ninety. Four point one three interceptions per ninety. He doesn't get dispossessed. He doesn't take risks. He controls the tempo of every game he plays.

Rodri already knows Alonso's system — he played under a similar philosophy at City for years. He is the data-perfect pick for this role."

**[ACTION: Use the global search to navigate to Rodri's player profile.]**

**SPEAK:**
"And here on his profile — score, radar, every metric — this is what elite midfield play looks like in the data."

---

### 2.6 · Validating with Similar Players (38:00–40:00)

**[ACTION: On Rodri's profile, scroll down to the 'Similar Players' panel on the right. Look at the list of similar players generated.]**

**SPEAK:**
"One final validation. ScoutIQ's similarity engine on Rodri's profile gives us a ranked shortlist of his closest statistical clones — players who have a similar per-ninety statistical fingerprint. This is our fallback list if Rodri is unavailable. Every name here is a data-supported alternative, not a guess."

---

### 2.7 · Squad Planner — The Final Picture (40:00–43:00)

**[ACTION: Click 'SQUAD PLANNER' in the left sidebar. The `/planner` page loads. Click on an existing plan or create a new one named 'Xabi Alonso 2026-27'. Import the Chelsea squad.]**

**SPEAK:**
"Finally, let's bring the whole picture together in the Squad Planner."

**[ACTION: Show the squad plan with players arranged by position. Point the mouse across the goalkeeper, defenders, midfielders, and forwards sections.]**

**SPEAK:**
"We have our 3-4-2-1. Sanchez and Jörgensen in goal. Our back three: Fofana, our new Libero signing alongside Adarabioyo and Colwill. The wing-back axis: Frimpong on the right, a left-sided equivalent on the left. The midfield double-pivot: Rodri as our controller, Caicedo — score 55.6, four point two five tackles per ninety — as the athletic runner alongside him. And in the half-spaces behind João Pedro, the creative combination of Cole Palmer and Pedro Neto.

Palmer, by the way — forty-six Premier League goals and nineteen assists across one hundred and seven appearances. That output is not going anywhere."

**[ACTION: Move the mouse to the squad summary stats panel — average score, total players, position coverage.]**

**SPEAK:**
"The planner gives us the squad overview. Average Performance Score. Position coverage. Age profile. Every metric suggests this rebuild — built entirely on empirical data — is coherent, targeted, and tactically aligned with what Xabi Alonso demands.

This is ScoutIQ. Not gut feel. Not transfer gossip. Structured, data-driven squad architecture. Every signing justified by numbers. Every sale explained by position-specific evidence. Every decision grounded in what the data actually shows."

**[ACTION: Hold the mouse still over the squad planner for a final beat. Then stop recording.]**

**SPEAK:**
"Thank you."

**[ACTION: Stop screen recording.]**

---

## REFERENCE — REAL DATA USED IN THIS SCRIPT

| Player | Stat | Value | Source |
|---|---|---|---|
| Dashboard | Total players | 5,818 | Live DB |
| Dashboard | Match records | 686,761 | Live DB |
| Dashboard | Scored profiles | 21,075 | Live DB |
| Haaland | xG/90 (EPL) | 0.782 | player_match_stats |
| Palmer | Goals (EPL, all time) | 46 | player_match_stats |
| Palmer | Assists (EPL, all time) | 19 | player_match_stats |
| Palmer | Appearances (EPL) | 107 | player_match_stats |
| Cucurella | Dribbles/90 (EPL) | 0.32 | player_match_stats |
| Cucurella | Key passes/90 (EPL) | 0.31 | player_match_stats |
| Cucurella | Performance Score | 50.0 | player_scores |
| M. Gusto | Performance Score | 37.8 | player_scores |
| Caicedo | Tackles/90 (EPL) | 4.25 | player_match_stats |
| Caicedo | Interceptions/90 (EPL) | 3.75 | player_match_stats |
| Caicedo | Performance Score | 55.6 | player_scores |
| W. Fofana | Performance Score | 72.1 | player_scores |
| Adarabioyo | Performance Score | 73.5 | player_scores |
| Colwill | Performance Score | 63.6 | player_scores |
| Frimpong | Dribbles/90 (EPL) | 2.60 | player_match_stats |
| Frimpong | Key passes/90 (EPL) | 1.16 | player_match_stats |
| Frimpong | xA/90 (EPL) | 0.24 | player_match_stats |
| Saliba | Pass accuracy (EPL) | 94.4% | player_match_stats |
| Rodri | Pass accuracy (EPL) | 93.2% | player_match_stats |
| Rodri | Tackles/90 (EPL) | 3.33 | player_match_stats |
| Rodri | Interceptions/90 (EPL) | 4.13 | player_match_stats |
| Savinho | Age / Score | 22 / 74.4 | player_scores |
| Colwill | Age / Score | 23 / 63.6 | player_scores |
| Chelsea squad | Total players in DB | 26 | players table |
| Chelsea squad | Avg performance score | 53.8 | player_scores |
