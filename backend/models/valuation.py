"""
valuation.py — PFDB-style player market valuation model.

Formula:
  estimated_value = base_value(role) × score_factor × age_factor × league_factor × minutes_factor

Components:
  base_value:    median market value for the role in top leagues (€M)
  score_factor:  performance_score / 50 (normalised around median score)
  age_factor:    peak at 24, decay before 21 and after 28
  league_factor: PL/La Liga = 1.0, lower leagues = 0.75
  minutes_factor: penalise players with < 900 minutes this season

Output is clamped to [€500K, €150M].
Labelled as "ScoutIQ Est." to distinguish from Transfermarkt values.
"""

from datetime import date
from typing import Optional


# Base values in € — median for role in top leagues
ROLE_BASE_VALUE = {
    'GK':  8_000_000,
    'CB':  15_000_000,
    'FB':  18_000_000,
    'CDM': 20_000_000,
    'CM':  22_000_000,
    'CAM': 28_000_000,
    'WNG': 30_000_000,
    'SS':  25_000_000,
    'CF':  30_000_000,
    # Fallbacks
    'DEF': 15_000_000,
    'MID': 20_000_000,
    'FWD': 28_000_000,
}

LEAGUE_FACTORS = {
    'Premier League': 1.0,
    'La Liga': 1.0,
    'Serie A': 0.90,
    'Bundesliga': 0.90,
    'Ligue 1': 0.85,
}


def age_factor(date_of_birth) -> float:
    """
    Age curve: peaks at 24, ramps up from 17, decays after 28.
    """
    if not date_of_birth:
        return 0.75
    try:
        today = date.today()
        dob = date_of_birth if hasattr(date_of_birth, 'year') else date.fromisoformat(str(date_of_birth))
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except Exception:
        return 0.75

    if age <= 17:   return 0.40
    if age == 18:   return 0.55
    if age == 19:   return 0.70
    if age == 20:   return 0.82
    if age == 21:   return 0.90
    if age == 22:   return 0.95
    if age == 23:   return 0.98
    if age == 24:   return 1.00
    if age == 25:   return 1.00
    if age == 26:   return 0.97
    if age == 27:   return 0.93
    if age == 28:   return 0.87
    if age == 29:   return 0.78
    if age == 30:   return 0.67
    if age == 31:   return 0.55
    if age == 32:   return 0.42
    if age == 33:   return 0.30
    if age == 34:   return 0.20
    return 0.12


def estimate_value(
    role: Optional[str],
    performance_score: Optional[float],
    date_of_birth,
    league_name: Optional[str],
    minutes: Optional[int],
) -> Optional[int]:
    """
    Estimate player market value in EUR.
    Returns None if insufficient data.
    """
    if not role or performance_score is None:
        return None

    base = ROLE_BASE_VALUE.get(role, 15_000_000)
    score_f = max(0.1, (float(performance_score) / 50.0))  # 50 = median score
    age_f = age_factor(date_of_birth)
    league_f = LEAGUE_FACTORS.get(league_name, 0.80)
    mins_f = min(1.0, max(0.4, (minutes or 0) / 1800.0)) if minutes else 0.5

    estimated = base * score_f * age_f * league_f * mins_f

    # Clamp
    estimated = max(500_000, min(150_000_000, estimated))
    return int(round(estimated, -4))  # round to nearest €10K
