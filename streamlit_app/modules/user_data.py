from datetime import datetime
from .units import cols_to_kg, kg_to_cols


def estimate_1rm(kg: float, reps: int) -> float:
    if reps == 1:
        return kg
    return round(kg * (1 + reps / 30) * 10) / 10


# ── Sessions ──────────────────────────────────────────────────────────────────

def get_today_session(supabase, date: str):
    result = supabase.table("sessions").select("*").eq("date", date).maybe_single().execute()
    return result.data if result is not None else None


def create_session(supabase, date: str, week_number: int, mesocycle: int, day_label: str):
    result = (
        supabase.table("sessions")
        .insert({
            "date": date,
            "week_number": week_number,
            "mesocycle": mesocycle,
            "day_label": day_label,
            "body_feel": "good",
            "completed": False,
        })
        .select()
        .execute()
    )
    return result.data[0] if result.data else None


def update_session_feel(supabase, session_id: str, body_feel: str):
    supabase.table("sessions").update({"body_feel": body_feel}).eq("id", session_id).execute()


def update_session_notes(supabase, session_id: str, notes: str):
    supabase.table("sessions").update({"notes": notes}).eq("id", session_id).execute()


def complete_session(supabase, session_id: str):
    supabase.table("sessions").update({"completed": True}).eq("id", session_id).execute()


def get_recent_sessions(supabase, limit: int = 14):
    result = (
        supabase.table("sessions")
        .select("*, sets(*)")
        .order("date", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


# ── Sets ──────────────────────────────────────────────────────────────────────

def get_sets_for_session(supabase, session_id: str):
    result = (
        supabase.table("sets")
        .select("*")
        .eq("session_id", session_id)
        .order("set_number")
        .execute()
    )
    return result.data or []


def log_set(
    supabase,
    session_id: str,
    exercise: str,
    set_number: int,
    kg_val: float,
    reps: int,
    rpe: float,
    notes: str = None,
):
    cols = kg_to_cols(kg_val)
    result = (
        supabase.table("sets")
        .insert({
            "session_id": session_id,
            "exercise": exercise,
            "set_number": set_number,
            "kg_whole": cols["kg_whole"],
            "kg_half": cols["kg_half"],
            "reps": reps,
            "rpe": rpe,
            "completed": True,
            "notes": notes,
        })
        .select()
        .execute()
    )
    return result.data[0] if result.data else None


def delete_set(supabase, set_id: str):
    supabase.table("sets").delete().eq("id", set_id).execute()


# ── Personal records ──────────────────────────────────────────────────────────

def get_all_prs(supabase):
    result = supabase.table("personal_records").select("*").order("exercise").execute()
    return result.data or []


# ── Exercise history for charts ───────────────────────────────────────────────

def get_exercise_history(supabase, exercise: str, limit: int = 52):
    result = (
        supabase.table("sets")
        .select("kg_whole, kg_half, reps, rpe, created_at, sessions(date, week_number)")
        .eq("exercise", exercise)
        .eq("completed", True)
        .order("created_at")
        .limit(limit * 10)
        .execute()
    )

    by_date = {}
    for s in result.data or []:
        session_data = s.get("sessions")
        date = session_data.get("date") if isinstance(session_data, dict) else None
        if not date:
            continue
        kg = cols_to_kg(s["kg_whole"], s["kg_half"])
        est1rm = estimate_1rm(kg, s["reps"])
        if date not in by_date or est1rm > by_date[date]["est1rm"]:
            by_date[date] = {
                "date": date,
                "kg": kg,
                "reps": s["reps"],
                "rpe": s.get("rpe"),
                "est1rm": est1rm,
                "week": session_data.get("week_number") if isinstance(session_data, dict) else None,
            }

    return sorted(by_date.values(), key=lambda x: x["date"])


# ── Adaptation suggestions ────────────────────────────────────────────────────

def get_pending_suggestions(supabase):
    result = (
        supabase.table("adaptation_suggestions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def resolve_suggestion(supabase, suggestion_id: str, status: str, applied_from_week: int = None):
    supabase.table("adaptation_suggestions").update({
        "status": status,
        "resolved_at": datetime.now().isoformat(),
        "applied_from_week": applied_from_week,
    }).eq("id", suggestion_id).execute()


def create_suggestion(supabase, suggestion: dict):
    supabase.table("adaptation_suggestions").insert(suggestion).execute()


# ── User settings ─────────────────────────────────────────────────────────────

def get_user_settings(supabase):
    result = supabase.table("user_settings").select("*").maybe_single().execute()
    return result.data if result is not None else None


def upsert_user_settings(supabase, updates: dict):
    settings = get_user_settings(supabase)
    if settings:
        supabase.table("user_settings").update(updates).eq("id", settings["id"]).execute()
    else:
        supabase.table("user_settings").insert(updates).execute()
