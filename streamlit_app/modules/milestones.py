from datetime import datetime, timedelta
from .program import BASELINE, TARGETS


def project_milestone(history: list, target_kg: float, exercise: str = None, user_baselines: dict = None) -> dict:
    if not history or len(history) < 2:
        return {
            "eta_date": None,
            "eta_label": "Log more sessions",
            "rate_per_week": 0,
            "weeks_remaining": None,
            "pct_complete": 0,
        }

    recent = history[-10:]
    first, last = recent[0], recent[-1]

    start_kg = first["est1rm"]
    current_kg = last["est1rm"]
    start_date = datetime.strptime(first["date"], "%Y-%m-%d")
    last_date = datetime.strptime(last["date"], "%Y-%m-%d")
    days_diff = max(1, (last_date - start_date).days)
    rate_per_day = (current_kg - start_kg) / days_diff
    rate_per_week = rate_per_day * 7

    effective_baselines = user_baselines or BASELINE
    baseline_kg = effective_baselines.get(exercise, start_kg) if exercise else start_kg
    total_gap = target_kg - baseline_kg
    pct_complete = (
        max(0, min(100, round(((current_kg - baseline_kg) / total_gap) * 100)))
        if total_gap > 0
        else 100
    )

    if rate_per_day <= 0:
        return {
            "eta_date": None,
            "eta_label": "Maintain consistency to project",
            "rate_per_week": round(rate_per_week * 10) / 10,
            "weeks_remaining": None,
            "pct_complete": pct_complete,
        }

    remaining = target_kg - current_kg
    days_remaining = remaining / rate_per_day
    eta_date = datetime.now() + timedelta(days=days_remaining)
    weeks_remaining = -(-int(days_remaining) // 7)  # ceiling

    return {
        "eta_date": eta_date,
        "eta_label": _format_eta(eta_date, weeks_remaining),
        "rate_per_week": round(rate_per_week * 10) / 10,
        "weeks_remaining": weeks_remaining,
        "pct_complete": pct_complete,
    }


def _format_eta(date: datetime, weeks: int) -> str:
    if weeks <= 0:
        return "Target reached!"
    if weeks <= 4:
        return f"~{weeks} week{'s' if weeks > 1 else ''}"
    if weeks <= 52:
        return date.strftime("%B %Y")
    return "Over 1 year at current rate"


def project_future(history: list, target_kg: float, weeks_ahead: int = 26) -> list:
    if not history or len(history) < 2:
        return []

    recent = history[-6:]
    first, last = recent[0], recent[-1]
    days_diff = max(
        1,
        (datetime.strptime(last["date"], "%Y-%m-%d") - datetime.strptime(first["date"], "%Y-%m-%d")).days,
    )
    rate_per_day = (last["est1rm"] - first["est1rm"]) / days_diff

    if rate_per_day <= 0:
        return []

    points = []
    last_date = datetime.strptime(last["date"], "%Y-%m-%d")
    for w in range(1, weeks_ahead + 1):
        proj_date = last_date + timedelta(weeks=w)
        proj_kg = round((last["est1rm"] + rate_per_day * w * 7) * 10) / 10
        if proj_kg >= target_kg:
            points.append({"date": proj_date.strftime("%Y-%m-%d"), "kg": target_kg, "is_target": True})
            break
        points.append({"date": proj_date.strftime("%Y-%m-%d"), "kg": proj_kg})

    return points


def meso_summary(recent_sessions: list) -> list:
    by_meso: dict = {}
    for s in recent_sessions:
        m = s.get("mesocycle", 1)
        by_meso.setdefault(m, {"sessions": [], "sets": [], "prs": 0})
        by_meso[m]["sessions"].append(s)
        for set_data in s.get("sets") or []:
            if set_data.get("completed"):
                by_meso[m]["sets"].append(set_data)
                if set_data.get("is_pr"):
                    by_meso[m]["prs"] += 1

    result = []
    for meso, data in by_meso.items():
        rpe_sets = [s for s in data["sets"] if s.get("rpe")]
        avg_rpe = (
            round(sum(s["rpe"] for s in rpe_sets) / len(rpe_sets) * 10) / 10
            if rpe_sets
            else None
        )
        completed = sum(1 for s in data["sessions"] if s.get("completed"))
        result.append({
            "meso": int(meso),
            "avg_rpe": avg_rpe,
            "total_sets": len(data["sets"]),
            "prs_hit": data["prs"],
            "completion_rate": (
                round(completed / len(data["sessions"]) * 100) if data["sessions"] else 0
            ),
        })

    return sorted(result, key=lambda x: x["meso"])
