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
from modules import user_data, units, program, adaptation

st.set_page_config(page_title="Lift — Program", page_icon="📅", layout="centered")
st.title("Program")

supabase = get_supabase_client()
if not supabase:
    st.error("Supabase not configured.")
    st.stop()

settings_data = user_data.get_user_settings(supabase)
unit = st.session_state.get("unit", settings_data.get("preferred_unit", "lbs") if settings_data else "lbs")
baselines = (settings_data.get("baselines") or program.BASELINE) if settings_data else program.BASELINE
start_date_str = (settings_data.get("program_start_date") or "2024-01-01") if settings_data else "2024-01-01"

week_num = program.current_week_number(start_date_str)
week_plan = program.get_week_plan(week_num)
meso_def = next((m for m in program.MESO_DEFS if m["meso"] == week_plan["mesocycle"]), program.MESO_DEFS[0])

# ── Current week header ───────────────────────────────────────────────────────

st.subheader(f"Week {week_num} — {week_plan['label']}")
c1, c2, c3 = st.columns(3)
c1.metric("Mesocycle", week_plan["mesocycle"])
c2.metric("Phase", week_plan["phase"].title())
deload_suffix = " (Deload)" if week_plan["is_deload"] else ""
c3.metric("Intensity", f"{week_plan['intensity_pct']}%{deload_suffix}")
st.caption(meso_def["description"])

if week_plan["is_deload"]:
    st.warning("Deload week — reduced volume and intensity. Prioritise recovery.")

st.divider()

# ── Adaptation suggestions ────────────────────────────────────────────────────

@st.cache_data(ttl=60)
def _get_pending(_sb):
    return user_data.get_pending_suggestions(_sb)

pending = _get_pending(supabase)

if pending:
    st.subheader(f"Adaptation Suggestions ({len(pending)})")
    for s in pending:
        label = adaptation.suggestion_label(s)
        detail = s.get("trigger_reason", "")
        stype = s["suggestion_type"]

        if stype == "flag_injury":
            box = st.error
        elif stype in ("reduce_intensity", "reduce_volume"):
            box = st.warning
        else:
            box = st.info

        with box(f"**{label}**  \n{detail}"):
            pass

        col_a, col_d, _ = st.columns([1, 1, 3])
        if col_a.button("Accept", key=f"accept_{s['id']}"):
            user_data.resolve_suggestion(supabase, s["id"], "accepted", week_num)
            st.cache_data.clear()
            st.rerun()
        if col_d.button("Dismiss", key=f"dismiss_{s['id']}"):
            user_data.resolve_suggestion(supabase, s["id"], "dismissed")
            st.cache_data.clear()
            st.rerun()
    st.divider()

# ── This week's schedule ──────────────────────────────────────────────────────

st.subheader("This Week's Schedule")
day_info = [
    ("A", "Monday"),
    ("B", "Tuesday"),
    ("C", "Thursday"),
    ("D", "Saturday"),
]

for day_label, day_name in day_info:
    day_plan = week_plan["days"][day_label]
    with st.expander(f"{day_name} — {day_plan['label']}: {day_plan['focus']}"):
        for ex in day_plan["exercises"]:
            ex_name = ex["exercise"].replace("_", " ").title()
            t = program.target_kg(ex["exercise"], ex["pct"], baselines)
            disp = units.format_weight(t, unit) if t else "—"
            st.write(f"- **{ex_name}** — {ex['sets']}×{ex['reps']} @ {disp}  \n  _{ex.get('note', '')}_")
        st.caption("Accessories: " + ", ".join(a["name"] for a in day_plan["accessories"]))

st.divider()

# ── 52-week macrocycle overview ───────────────────────────────────────────────

st.subheader("52-Week Macrocycle")

rows = program.generate_program_weeks_rows()
# Highlight current week
table_data = []
for r in rows:
    marker = " ← current" if r["week_number"] == week_num else ""
    table_data.append({
        "Week": r["week_number"],
        "Meso": r["mesocycle"],
        "Phase": r["phase"].title(),
        "Intensity %": r["intensity_pct"],
        "Volume": f"{int(r['volume_modifier'] * 100)}%",
        "Notes": r["notes"] + marker,
    })

st.dataframe(table_data, use_container_width=True, hide_index=True, height=400)
