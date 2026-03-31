import os
from dotenv import load_dotenv

load_dotenv()

# Chelsea FC team ID from the football database (override via env)
CHELSEA_TEAM_ID = int(os.getenv("CHELSEA_TEAM_ID", "0"))

# Minimum minutes played to qualify for analysis
MIN_MINUTES = int(os.getenv("MIN_MINUTES", "900"))

# Maps raw Sofascore position strings → 5-group normalised code
POSITION_MAP: dict[str, str] = {
    # Goalkeeper
    "GK": "GK", "Goalkeeper": "GK", "G": "GK",
    # Defenders
    "CB": "DEF", "Center Back": "DEF", "RCB": "DEF", "LCB": "DEF",
    "RB": "DEF", "Right Back": "DEF", "LB": "DEF", "Left Back": "DEF",
    "RWB": "DEF", "LWB": "DEF", "SW": "DEF", "Sweeper": "DEF",
    "D": "DEF", "DC": "DEF", "DL": "DEF", "DR": "DEF",
    # Central / Defensive Midfielders
    "CM": "MID", "Central Midfield": "MID",
    "DM": "MID", "Defensive Midfield": "MID", "CDM": "MID",
    "AM": "MID", "Attacking Midfield": "MID", "CAM": "MID",
    "M": "MID", "MC": "MID", "DM": "MID",
    # Wingers
    "LW": "WNG", "Left Wing": "WNG",
    "RW": "WNG", "Right Wing": "WNG",
    "LM": "WNG", "Left Midfield": "WNG",
    "RM": "WNG", "Right Midfield": "WNG",
    "W": "WNG", "ML": "WNG", "MR": "WNG",
    # Forwards
    "ST": "FWD", "Striker": "FWD",
    "CF": "FWD", "Center Forward": "FWD",
    "SS": "FWD", "Second Striker": "FWD",
    "F": "FWD", "FW": "FWD",
}

# Metrics available on the scatter plot
SCATTER_METRICS = [
    "xg_per90", "xa_per90", "goals_per90", "assists_per90",
    "shots_per90", "key_passes_per90", "dribbles_per90",
    "aerials_per90", "tackles_per90", "interceptions_per90",
    "recoveries_per90", "rating",
]

SCATTER_METRIC_LABELS: dict[str, str] = {
    "xg_per90":             "xG per 90",
    "xa_per90":             "xA per 90",
    "goals_per90":          "Goals per 90",
    "assists_per90":        "Assists per 90",
    "shots_per90":          "Shots per 90",
    "key_passes_per90":     "Key Passes per 90",
    "dribbles_per90":       "Dribbles per 90",
    "aerials_per90":        "Aerials Won per 90",
    "tackles_per90":        "Tackles Won per 90",
    "interceptions_per90":  "Interceptions per 90",
    "recoveries_per90":     "Recoveries per 90",
    "rating":               "Sofascore Rating",
}

# REAP-inspired position-specific performance weights
# Keys must match aliased column names fetched by performance_score.py SQL
PERFORMANCE_WEIGHTS = {
    'GK': {
        'sofascore_rating':   0.30,
        'saves':              0.25,
        'aerial_duels_won':   0.15,
        'tackles':            0.10,
        'clearances':         0.10,
        'interceptions':      0.05,
        'recoveries':         0.05,
    },
    'DEF': {
        'sofascore_rating':   0.15,
        'aerial_duels_won':   0.18,
        'aerial_win_pct':     0.07,
        'tackles_won':        0.15,
        'tackles_won_pct':    0.05,
        'interceptions':      0.12,
        'clearances':         0.08,
        'accurate_passes_pct':0.08,
        'recoveries':         0.07,
        'duels_won':          0.05,
    },
    'MID': {
        'sofascore_rating':         0.15,
        'xa':                       0.12,
        'xg':                       0.08,
        'key_passes':               0.12,
        'accurate_passes_pct':      0.12,
        'accurate_final_third':     0.10,
        'tackles_won':              0.08,
        'recoveries':               0.08,
        'possession_won_att_third': 0.08,
        'duels_won':                0.07,
    },
    'WNG': {
        'sofascore_rating':         0.15,
        'xg':                       0.15,
        'xa':                       0.18,
        'key_passes':               0.12,
        'big_chances_created':      0.12,
        'accurate_final_third':     0.08,
        'successful_dribbles':      0.08,
        'possession_won_att_third': 0.07,
        'dispossessed':             -0.05,
    },
    'FWD': {
        'sofascore_rating':         0.15,
        'xg':                       0.22,
        'npxg':                     0.12,
        'goals':                    0.12,
        'shots_inside_box':         0.08,
        'aerial_duels_won':         0.10,
        'key_passes':               0.08,
        'big_chances_missed':       -0.08,
        'possession_won_att_third': 0.05,
        'touches':                  0.08,
    },
}

# Percentage-based metrics — use raw value, not divided by minutes
SCORE_PCT_METRICS = {
    'accurate_passes_pct', 'aerial_win_pct', 'ground_duels_won_pct',
    'duels_won_pct', 'tackles_won_pct', 'sofascore_rating',
}

# Score band labels (0–100, percentile-based)
SCORE_LABELS = [
    (90, "Elite"),
    (75, "Top Tier"),
    (60, "Above Avg"),
    (40, "Average"),
    (25, "Below Avg"),
    (0,  "Developing"),
]


def score_label(score: float) -> str:
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return label
    return "Developing"
