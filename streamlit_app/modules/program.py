from datetime import datetime
from typing import Optional

BASELINE = {
    "snatch": 60,
    "clean_and_jerk": 60,
    "back_squat": 93,
    "front_squat": 76,
}

TARGETS = {
    "snatch": 90,
    "clean_and_jerk": 110,
    "back_squat": 150,
}

MESO_DEFS = [
    {
        "meso": 1,
        "weeks": [1, 13],
        "phase": "preparation",
        "label": "Base strength",
        "description": "High volume, moderate intensity. Build positional strength and pulling mechanics.",
        "base_intensity": 70,
        "peak_intensity": 80,
    },
    {
        "meso": 2,
        "weeks": [14, 26],
        "phase": "preparation",
        "label": "Strength-speed",
        "description": "Reduce volume, increase intensity. Introduce heavier singles on Saturdays.",
        "base_intensity": 75,
        "peak_intensity": 87,
    },
    {
        "meso": 3,
        "weeks": [27, 39],
        "phase": "competition",
        "label": "Competition prep",
        "description": "Peaking cycles. Max singles, maintain volume via back-off sets.",
        "base_intensity": 80,
        "peak_intensity": 95,
    },
    {
        "meso": 4,
        "weeks": [40, 52],
        "phase": "competition",
        "label": "Peak & test",
        "description": "PR attempts, competition simulation. Conservative deloads protect lower back.",
        "base_intensity": 78,
        "peak_intensity": 100,
    },
]


def get_meso(week_num: int) -> dict:
    for m in MESO_DEFS:
        if m["weeks"][0] <= week_num <= m["weeks"][1]:
            return m
    return MESO_DEFS[0]


def week_intensity(week_in_meso: int, base_int: int, peak_int: int, is_deload: bool) -> int:
    if is_deload:
        return 65
    work_week = ((week_in_meso - 1) % 4) + 1
    rng = peak_int - base_int
    return round(base_int + (rng * (work_week - 1) / 3))


def get_day_plan(day_label: str, week_num: int, intensity_pct: int, phase: str) -> dict:
    pct = intensity_pct / 100
    comp = phase == "competition"
    prep = phase == "preparation"

    plans = {
        "A": {
            "label": "Day A",
            "focus": "Snatch",
            "exercises": [
                {"exercise": "snatch", "sets": 5, "reps": 1 if comp else 2, "pct": pct,
                 "note": "Focus on receiving position. No grinding."},
                {"exercise": "snatch_pull", "sets": 4, "reps": 3, "pct": pct + 0.10,
                 "note": "Maintain back angle. Explosive at hip."},
                {"exercise": "back_squat", "sets": 4, "reps": 3 if comp else 5, "pct": pct,
                 "note": "Controlled descent. Drive knees out."},
            ],
            "accessories": [
                {"name": "Glute bridge hold", "sets": 3, "reps": 10, "note": "Glute medius activation"},
                {"name": "Dead bug", "sets": 3, "reps": 8, "note": "Anti-extension core"},
                {"name": "Side-lying clamshell", "sets": 3, "reps": 12, "note": "Glute medius — banded if possible"},
            ],
        },
        "B": {
            "label": "Day B",
            "focus": "Jerk",
            "exercises": [
                {"exercise": "jerk", "sets": 5, "reps": 1 if comp else 2, "pct": pct,
                 "note": "Full lock-out overhead. Punch through."},
                {"exercise": "push_press", "sets": 3, "reps": 5, "pct": pct * 0.75,
                 "note": "Drive from legs. Press lockout."},
                {"exercise": "front_squat", "sets": 4, "reps": 3, "pct": pct,
                 "note": "Elbows high. Upright torso."},
                {"exercise": "overhead_squat", "sets": 3, "reps": 3, "pct": pct * 0.80,
                 "note": "Snatch grip. Active shoulders."},
            ],
            "accessories": [
                {"name": "Pallof press", "sets": 3, "reps": 10, "note": "Anti-rotation core stability"},
                {"name": "Hip flexor stretch", "sets": 2, "reps": 60, "note": "60s per side — kneeling lunge"},
                {"name": "McGill curl-up", "sets": 3, "reps": 8, "note": "Gentle spinal flexion endurance"},
            ],
        },
        "C": {
            "label": "Day C",
            "focus": "Clean",
            "exercises": [
                {"exercise": "clean_and_jerk", "sets": 5, "reps": 1 if comp else 2, "pct": pct,
                 "note": "Full clean + jerk. Quality over load."},
                {"exercise": "clean_pull", "sets": 4, "reps": 3, "pct": pct + 0.10,
                 "note": "Full extension. Bar close to body."},
                {"exercise": "back_squat", "sets": 3, "reps": 3 if comp else 5, "pct": pct * 0.92,
                 "note": "Speed out of hole."},
            ],
            "accessories": [
                {"name": "Single-leg glute bridge", "sets": 3, "reps": 10,
                 "note": "Each leg. Glute medius + hip stability"},
                {"name": "Bird dog", "sets": 3, "reps": 8, "note": "Each side. Lumbar stability"},
                {"name": "Copenhagen plank", "sets": 3, "reps": 20, "note": "20s hold. Adductor + core"},
            ],
        },
        "D": {
            "label": "Day D",
            "focus": "Competition sim",
            "exercises": [
                {"exercise": "snatch", "sets": 3 if prep else 5, "reps": 1,
                 "pct": pct + 0.05 if prep else pct + 0.12,
                 "note": "Work to heavy single."},
                {"exercise": "clean_and_jerk", "sets": 3 if prep else 5, "reps": 1,
                 "pct": pct + 0.05 if prep else pct + 0.12,
                 "note": "Heavy single. Full competition attempt."},
                {"exercise": "front_squat", "sets": 3, "reps": 2 if comp else 3, "pct": pct + 0.05,
                 "note": "Post-competition strength maintenance."},
            ],
            "accessories": [
                {"name": "Loaded carry (farmer)", "sets": 3, "reps": 30, "note": "30m. Core bracing under load"},
                {"name": "Hip 90/90 stretch", "sets": 2, "reps": 60, "note": "60s per side"},
                {"name": "Thoracic spine mob", "sets": 2, "reps": 10, "note": "Cat-cow + thoracic rotation"},
            ],
        },
    }

    return plans.get(day_label, plans["A"])


def get_week_plan(week_num: int) -> dict:
    meso = get_meso(week_num)
    week_in_meso = week_num - (meso["weeks"][0] - 1)
    is_deload = (week_in_meso % 4) == 0
    intensity_pct = week_intensity(week_in_meso, meso["base_intensity"], meso["peak_intensity"], is_deload)

    return {
        "week_num": week_num,
        "mesocycle": meso["meso"],
        "phase": meso["phase"],
        "label": meso["label"],
        "description": meso["description"],
        "is_deload": is_deload,
        "intensity_pct": intensity_pct,
        "days": {
            "A": get_day_plan("A", week_num, intensity_pct, meso["phase"]),
            "B": get_day_plan("B", week_num, intensity_pct, meso["phase"]),
            "C": get_day_plan("C", week_num, intensity_pct, meso["phase"]),
            "D": get_day_plan("D", week_num, intensity_pct, meso["phase"]),
        },
    }


def target_kg(exercise: str, pct: float, baselines: dict = None) -> Optional[float]:
    base_vals = baselines or {}
    base = base_vals.get(exercise) or BASELINE.get(exercise)
    if not base:
        return None
    return round(base * pct * 2) / 2


def current_week_number(start_date_str: str) -> int:
    try:
        start = datetime.strptime(start_date_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        return 1
    diff = datetime.now() - start
    week = diff.days // 7 + 1
    return max(1, min(52, week))


def today_day_label() -> Optional[str]:
    # weekday(): 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    day = datetime.now().weekday()
    day_map = {0: "A", 1: "B", 3: "C", 5: "D"}
    return day_map.get(day)


def generate_program_weeks_rows() -> list:
    rows = []
    for w in range(1, 53):
        meso = get_meso(w)
        week_in_meso = w - (meso["weeks"][0] - 1)
        is_deload = (week_in_meso % 4) == 0
        intensity_pct = week_intensity(
            week_in_meso, meso["base_intensity"], meso["peak_intensity"], is_deload
        )
        rows.append({
            "week_number": w,
            "mesocycle": meso["meso"],
            "phase": meso["phase"],
            "intensity_pct": intensity_pct,
            "volume_modifier": 0.7 if is_deload else 1.0,
            "notes": "Deload week — 65%, reduced volume" if is_deload else meso["label"],
        })
    return rows
