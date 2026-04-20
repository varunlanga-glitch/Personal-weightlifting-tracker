import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import streamlit as st
from modules.db import get_supabase_client
from modules import user_data, units

st.set_page_config(page_title="Lift — Log", page_icon="📋", layout="centered")
st.title("Session Log")

supabase = get_supabase_client()
if not supabase:
    st.error("Supabase not configured.")
    st.stop()

settings_data = user_data.get_user_settings(supabase)
unit = st.session_state.get("unit", settings_data.get("preferred_unit", "lbs") if settings_data else "lbs")

# ── Load sessions ─────────────────────────────────────────────────────────────

@st.cache_data(ttl=60)
def _get_sessions(_sb, limit):
    return user_data.get_recent_sessions(_sb, limit)

limit = st.slider("Sessions to show", min_value=5, max_value=50, value=14, step=5)
sessions = _get_sessions(supabase, limit)

if not sessions:
    st.info("No sessions logged yet. Start your first session on the Today page.")
    st.stop()

# ── Build previous-same-day lookup for comparisons ────────────────────────────

same_day_prev: dict = {}  # day_label -> most recent prior session
prev_by_id: dict = {}     # session_id -> previous same-day session

for s in reversed(sessions):  # oldest to newest
    dl = s.get("day_label")
    if dl:
        if dl in same_day_prev:
            prev_by_id[s["id"]] = same_day_prev[dl]
        same_day_prev[dl] = s

# ── Render sessions ───────────────────────────────────────────────────────────

feel_emoji = {"good": "✅", "caution": "⚠️", "flag": "🚩"}
day_names = {"A": "Snatch", "B": "Jerk", "C": "Clean", "D": "Competition sim"}

for s in sessions:
    date_str = s["date"]
    day_label = s.get("day_label", "")
    day_name = day_names.get(day_label, day_label)
    feel = s.get("body_feel", "good")
    completed = s.get("completed", False)
    sets = s.get("sets") or []

    total_sets = len([x for x in sets if x.get("completed")])
    completed_badge = "✓" if completed else "○"
    title = f"{completed_badge} {date_str} — Day {day_label} ({day_name})  {feel_emoji.get(feel, '')}  · {total_sets} sets"

    with st.expander(title):
        if not sets:
            st.caption("No sets logged.")
        else:
            by_exercise: dict = {}
            for set_data in sorted(sets, key=lambda x: (x.get("exercise", ""), x.get("set_number", 0))):
                ex = set_data.get("exercise", "unknown")
                by_exercise.setdefault(ex, []).append(set_data)

            for ex, ex_sets in by_exercise.items():
                ex_name = ex.replace("_", " ").title()
                st.markdown(f"**{ex_name}**")
                cols = st.columns([1, 2, 1, 1])
                cols[0].caption("Set")
                cols[1].caption("Weight")
                cols[2].caption("Reps")
                cols[3].caption("RPE")
                for sd in ex_sets:
                    kg = units.cols_to_kg(sd["kg_whole"], sd["kg_half"])
                    weight_str = units.format_weight(kg, unit)
                    row = st.columns([1, 2, 1, 1])
                    row[0].write(str(sd.get("set_number", "")))
                    row[1].write(weight_str)
                    row[2].write(str(sd.get("reps", "")))
                    row[3].write(str(sd.get("rpe", "—")) if sd.get("rpe") else "—")

        if s.get("notes"):
            st.caption(f"Notes: {s['notes']}")

        # ── vs previous same day ──────────────────────────────────────────────
        prev = prev_by_id.get(s["id"])
        if prev and prev.get("sets"):
            prev_sets = prev.get("sets") or []
            prev_by_ex: dict = {}
            for sd in prev_sets:
                ex = sd.get("exercise", "")
                if ex:
                    prev_by_ex.setdefault(ex, []).append(sd)

            if prev_by_ex:
                parts = []
                for ex, ex_sets in prev_by_ex.items():
                    ex_name = ex.replace("_", " ").title()
                    weights = [
                        f"{units.format_weight(units.cols_to_kg(sd['kg_whole'], sd['kg_half']), unit)}×{sd['reps']}"
                        for sd in sorted(ex_sets, key=lambda x: x.get("set_number", 0))
                    ]
                    parts.append(f"{ex_name}: {', '.join(weights)}")
                st.caption(f"vs {prev['date']}: " + "  |  ".join(parts))
