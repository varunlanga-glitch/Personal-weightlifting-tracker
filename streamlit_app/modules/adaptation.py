from datetime import datetime, timedelta
from .user_data import create_suggestion


def _fmt(exercise: str) -> str:
    return exercise.replace("_", " ")


def analyse_sessions(recent_sessions: list, is_deload: bool = False) -> list:
    if is_deload:
        return []
    suggestions = []
    two_weeks_ago = datetime.now() - timedelta(days=14)

    recent = [
        s for s in recent_sessions
        if datetime.strptime(s["date"], "%Y-%m-%d") >= two_weeks_ago
    ]

    # Injury flags
    flag_count = sum(1 for s in recent if s.get("body_feel") == "flag")
    if flag_count >= 2:
        suggestions.append({
            "exercise": None,
            "trigger_reason": "Lower back flagged 2+ times in the last 2 weeks",
            "suggestion_type": "flag_injury",
            "suggested_pct_change": 0,
            "status": "pending",
        })

    # Per-exercise RPE trends
    for ex in ["snatch", "clean_and_jerk", "back_squat"]:
        ex_sets = []
        for s in recent:
            for set_data in s.get("sets") or []:
                if set_data.get("exercise") == ex and set_data.get("completed") and set_data.get("rpe"):
                    ex_sets.append({**set_data, "_session_id": s["id"]})

        if len(ex_sets) < 6:
            continue

        session_rpes: dict = {}
        for set_data in ex_sets:
            sid = set_data["_session_id"]
            session_rpes.setdefault(sid, []).append(set_data["rpe"])

        mean_rpes = [sum(v) / len(v) for v in session_rpes.values()]
        last_n = mean_rpes[-4:]

        if len(last_n) >= 4:
            avg = sum(last_n) / len(last_n)
            if avg > 8.5:
                suggestions.append({
                    "exercise": ex,
                    "trigger_reason": f"Average RPE on {_fmt(ex)} has been >8.5 for 4+ sessions",
                    "suggestion_type": "reduce_intensity",
                    "suggested_pct_change": -5,
                    "status": "pending",
                })
            elif avg < 6.0:
                suggestions.append({
                    "exercise": ex,
                    "trigger_reason": f"Average RPE on {_fmt(ex)} has been <6 for 4+ sessions — ready to progress",
                    "suggestion_type": "increase_intensity",
                    "suggested_pct_change": 5,
                    "status": "pending",
                })

    # Missed sessions
    completed_sessions = sum(1 for s in recent if s.get("completed"))
    missed_count = 8 - completed_sessions  # 4 days/week × 2 weeks
    if missed_count >= 3:
        suggestions.append({
            "exercise": None,
            "trigger_reason": "3+ sessions missed in last 2 weeks — reduce volume to rebuild consistency",
            "suggestion_type": "reduce_volume",
            "suggested_pct_change": 0,
            "status": "pending",
        })

    return suggestions


def run_adaptation_check(supabase, recent_sessions: list, existing_pending: list, is_deload: bool = False):
    suggestions = analyse_sessions(recent_sessions, is_deload=is_deload)
    existing_keys = {
        f"{s['suggestion_type']}:{s['exercise'] or 'null'}" for s in existing_pending
    }
    for s in suggestions:
        key = f"{s['suggestion_type']}:{s['exercise'] or 'null'}"
        if key not in existing_keys:
            create_suggestion(supabase, s)


def apply_accepted_suggestion(suggestion: dict, current_overrides: dict, current_baselines: dict) -> dict:
    overrides = dict(current_overrides)
    if suggestion["suggestion_type"] in ("reduce_intensity", "increase_intensity"):
        ex = suggestion["exercise"]
        base = current_baselines.get(ex)
        if base:
            change = suggestion["suggested_pct_change"] / 100
            overrides[ex] = round(base * (1 + change) * 2) / 2
    return overrides


def suggestion_label(s: dict) -> str:
    exercise = s.get("exercise")
    ex_name = _fmt(exercise) if exercise else "all lifts"
    pct = abs(s.get("suggested_pct_change", 0))
    labels = {
        "reduce_intensity": f"Reduce {ex_name} intensity by {pct}%",
        "increase_intensity": f"Increase {ex_name} intensity by {pct}%",
        "reduce_volume": "Reduce training volume this week",
        "deload": "Take a full deload week (65%, 70% volume)",
        "flag_injury": "Lower back flagged — reduce load and add mobility work",
    }
    return labels.get(s["suggestion_type"], s["suggestion_type"])
