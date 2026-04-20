import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import streamlit as st
from datetime import datetime, date
from modules.db import get_supabase_client
from modules import user_data, units, program

st.set_page_config(page_title="Lift — Settings", page_icon="⚙️", layout="centered")
st.title("Settings")

supabase = get_supabase_client()
if not supabase:
    st.error("Supabase not configured.")
    st.stop()

@st.cache_data(ttl=60)
def _load_settings(_sb):
    return user_data.get_user_settings(_sb)

settings = _load_settings(supabase)

# Defaults if no settings exist yet
current_unit = settings.get("preferred_unit", "lbs") if settings else "lbs"
current_baselines = (settings.get("baselines") or program.BASELINE) if settings else program.BASELINE
current_start = settings.get("program_start_date", "2024-01-01") if settings else "2024-01-01"

# ── Unit preference ───────────────────────────────────────────────────────────

st.subheader("Unit Preference")
unit_choice = st.radio(
    "Display weights in",
    options=["lbs", "kg"],
    index=0 if current_unit == "lbs" else 1,
    horizontal=True,
)

# ── Program start date ────────────────────────────────────────────────────────

st.subheader("Program Start Date")
try:
    default_start = datetime.strptime(current_start, "%Y-%m-%d").date()
except (ValueError, TypeError):
    default_start = date(2024, 1, 1)

start_date = st.date_input("Program started on", value=default_start)
week_num = program.current_week_number(start_date.isoformat())
st.caption(f"Current week: {week_num} / 52")

# ── Baseline 1RMs ─────────────────────────────────────────────────────────────

st.subheader("Baseline 1RMs")
st.caption("Your starting 1RM values used to calculate training loads.")

display_unit = unit_choice
step = units.drum_step(display_unit)
lo = units.drum_min(display_unit)
hi = units.drum_max(display_unit)

baseline_exercises = [
    ("snatch", "Snatch"),
    ("clean_and_jerk", "Clean & Jerk"),
    ("back_squat", "Back Squat"),
    ("front_squat", "Front Squat"),
]

new_baselines = {}
cols = st.columns(2)
for i, (ex, label) in enumerate(baseline_exercises):
    kg_val = float(current_baselines.get(ex) or program.BASELINE.get(ex, 60))
    disp_val = units.kg_to_display(kg_val, display_unit)
    with cols[i % 2]:
        entered = st.number_input(
            f"{label} ({display_unit})",
            min_value=lo,
            max_value=hi,
            value=float(disp_val),
            step=step,
            format="%.1f" if display_unit == "kg" else "%.2f",
            key=f"baseline_{ex}",
        )
        new_baselines[ex] = round(units.display_to_kg(entered, display_unit) * 2) / 2

# ── Year-end targets ──────────────────────────────────────────────────────────

st.subheader("Year-End Targets")
st.caption("Goal 1RMs for milestone tracking and projections.")

current_targets = program.TARGETS  # targets are fixed in program logic for now
target_exercises = [
    ("snatch", "Snatch"),
    ("clean_and_jerk", "Clean & Jerk"),
    ("back_squat", "Back Squat"),
]

st.info(
    "Targets: "
    + "  |  ".join(
        f"{label}: {units.format_weight(current_targets[ex], display_unit)}"
        for ex, label in target_exercises
        if ex in current_targets
    )
)
st.caption("To change targets, edit `program.TARGETS` in `modules/program.py`.")

# ── Save ──────────────────────────────────────────────────────────────────────

st.divider()
if st.button("Save Settings", type="primary"):
    user_data.upsert_user_settings(supabase, {
        "preferred_unit": unit_choice,
        "program_start_date": start_date.isoformat(),
        "baselines": new_baselines,
    })
    st.session_state.unit = unit_choice
    st.cache_data.clear()
    st.success("Settings saved.")
    st.rerun()
