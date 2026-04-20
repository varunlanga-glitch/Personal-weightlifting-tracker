import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from dotenv import load_dotenv
    _root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_root, ".env"))
    load_dotenv(os.path.join(_root, ".env.production"), override=False)
except ImportError:
    pass

import streamlit as st
from datetime import date

from modules.db import get_supabase_client
from modules import program, user_data, units, adaptation

st.set_page_config(
    page_title="Lift — Today",
    page_icon="🏋️",
    layout="centered",
)

# ── Supabase ──────────────────────────────────────────────────────────────────

supabase = get_supabase_client()

if not supabase:
    st.error("Supabase not configured.")
    st.info("Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables, then restart.")
    st.stop()

# ── Settings ──────────────────────────────────────────────────────────────────

@st.cache_data(ttl=120)
def _load_settings(_sb):
    return user_data.get_user_settings(_sb)

settings = _load_settings(supabase)

if not settings:
    st.warning("No settings found. Please configure your profile first.")
    st.page_link("pages/4_Settings.py", label="Go to Settings →")
    st.stop()

if "unit" not in st.session_state:
    st.session_state.unit = settings.get("preferred_unit", "lbs")

unit = st.session_state.unit
baselines = settings.get("baselines") or program.BASELINE
targets = settings.get("targets") or program.TARGETS
start_date_str = settings.get("program_start_date") or "2024-01-01"

# ── Program state ─────────────────────────────────────────────────────────────

week_num = program.current_week_number(start_date_str)
week_plan = program.get_week_plan(week_num)
today_str = date.today().isoformat()

# ── Cache helpers ─────────────────────────────────────────────────────────────

@st.cache_data(ttl=30)
def _get_session(_sb, date_str):
    return user_data.get_today_session(_sb, date_str)

@st.cache_data(ttl=15)
def _get_sets(_sb, session_id):
    return user_data.get_sets_for_session(_sb, session_id)

@st.cache_data(ttl=60)
def _get_last_sets(_sb, exercise, exclude_session_id):
    return user_data.get_last_sets_for_exercise(_sb, exercise, exclude_session_id)

# ── Header ────────────────────────────────────────────────────────────────────

st.title("Today's Workout")

c1, c2, c3 = st.columns(3)
c1.metric("Week", f"{week_num} / 52")
c2.metric("Mesocycle", f"{week_plan['mesocycle']} — {week_plan['label']}")
deload_suffix = " · Deload" if week_plan["is_deload"] else ""
c3.metric("Intensity", f"{week_plan['intensity_pct']}%{deload_suffix}")

# ── Fetch existing session ────────────────────────────────────────────────────

session = _get_session(supabase, today_str)

# ── Day selection ─────────────────────────────────────────────────────────────

all_day_keys = ["A", "B", "C", "D"]
day_display = {
    "A": "A — Monday · Snatch",
    "B": "B — Tuesday · Jerk",
    "C": "C — Thursday · Clean",
    "D": "D — Saturday · Competition sim",
}

if session:
    day_label = session.get("day_label") or program.today_day_label()
else:
    computed_day = program.today_day_label()
    if computed_day is None:
        st.info("Rest day — no training scheduled today.")
        if not st.checkbox("Train a makeup session instead"):
            st.caption("Next session: check the Program page for the week schedule.")
            st.stop()
        day_label = st.selectbox("Choose training day", all_day_keys,
                                  format_func=lambda x: day_display[x])
    else:
        day_label = st.selectbox(
            "Training day",
            all_day_keys,
            index=all_day_keys.index(computed_day),
            format_func=lambda x: day_display[x],
            help="Adjust if you're making up a missed day",
        )

if day_label is None:
    st.stop()

day_plan = week_plan["days"][day_label]
st.subheader(f"{day_plan['label']} — {day_plan['focus']} Focus")

if week_plan["is_deload"]:
    st.warning("Deload week — 65% intensity. Focus on movement quality, not load.")

# ── Session ───────────────────────────────────────────────────────────────────

if not session:
    st.info("No session started yet for today.")
    st.markdown("**Planned work:**")
    for ex in day_plan["exercises"]:
        t = program.target_kg(ex["exercise"], ex["pct"], baselines)
        disp = units.format_weight(t, unit) if t else "—"
        ex_name = ex["exercise"].replace("_", " ").title()
        st.write(f"- {ex_name}: {ex['sets']}×{ex['reps']} @ {disp}")
    if st.button("Start Session", type="primary"):
        user_data.create_session(supabase, today_str, week_num, week_plan["mesocycle"], day_label)
        st.cache_data.clear()
        st.rerun()
    st.stop()

# ── Body feel ─────────────────────────────────────────────────────────────────

feel_options = ["good", "caution", "flag"]
feel_labels = {"good": "Good", "caution": "Caution / Stiff", "flag": "Flag — Lower Back"}
feel_col, _ = st.columns([1, 2])
with feel_col:
    current_feel = session.get("body_feel", "good")
    new_feel = st.selectbox(
        "Body feel",
        options=feel_options,
        format_func=lambda x: feel_labels[x],
        index=feel_options.index(current_feel),
    )
    if new_feel != current_feel:
        user_data.update_session_feel(supabase, session["id"], new_feel)
        st.cache_data.clear()
        st.rerun()

st.divider()

# ── Main lifts ────────────────────────────────────────────────────────────────

st.subheader("Main Lifts")

existing_sets = _get_sets(supabase, session["id"])

for ex in day_plan["exercises"]:
    ex_name = ex["exercise"].replace("_", " ").title()
    target_kg_val = program.target_kg(ex["exercise"], ex["pct"], baselines)
    disp_target = units.format_weight(target_kg_val, unit) if target_kg_val else "—"
    logged = [s for s in existing_sets if s["exercise"] == ex["exercise"]]

    with st.expander(
        f"**{ex_name}** — {ex['sets']}×{ex['reps']} @ {disp_target}",
        expanded=True,
    ):
        st.caption(ex.get("note", ""))

        # Last session context
        last_sets = _get_last_sets(supabase, ex["exercise"], session["id"])
        if last_sets:
            last_date = (last_sets[0].get("sessions") or {}).get("date", "?")
            parts = []
            for ls in last_sets:
                kg = units.cols_to_kg(ls["kg_whole"], ls["kg_half"])
                rpe_str = f" @{ls['rpe']}" if ls.get("rpe") else ""
                parts.append(f"{units.format_weight(kg, unit)}×{ls['reps']}{rpe_str}")
            st.caption(f"Last ({last_date}): {' · '.join(parts)}")

        if logged:
            header = st.columns([2, 2, 1, 1, 1])
            header[0].markdown("**Set**")
            header[1].markdown("**Weight**")
            header[2].markdown("**Reps**")
            header[3].markdown("**RPE**")
            for s in logged:
                kg = units.cols_to_kg(s["kg_whole"], s["kg_half"])
                weight_str = units.format_weight(kg, unit)
                row = st.columns([2, 2, 1, 1, 1])
                row[0].write(f"Set {s['set_number']}")
                row[1].write(weight_str)
                row[2].write(str(s["reps"]))
                row[3].write(str(s["rpe"]) if s.get("rpe") else "—")
                if row[4].button("✕", key=f"del_{s['id']}"):
                    user_data.delete_set(supabase, s["id"])
                    st.cache_data.clear()
                    st.rerun()

        next_num = len(logged) + 1
        if next_num <= ex["sets"]:
            # Default weight: last set this session > last set prior session > target > minimum
            if logged:
                last_logged = max(logged, key=lambda x: x.get("set_number", 0))
                default_kg = units.cols_to_kg(last_logged["kg_whole"], last_logged["kg_half"])
            elif last_sets:
                last_prior = last_sets[-1]
                default_kg = units.cols_to_kg(last_prior["kg_whole"], last_prior["kg_half"])
            else:
                default_kg = target_kg_val

            with st.form(key=f"form_{ex['exercise']}_{next_num}"):
                st.write(f"Log Set {next_num}")
                step = units.drum_step(unit)
                lo = units.drum_min(unit)
                hi = units.drum_max(unit)
                default_w = units.kg_to_display(default_kg, unit) if default_kg else lo
                fmt_str = "%.1f" if unit == "kg" else "%.2f"
                w_col, r_col, rpe_col = st.columns(3)
                weight = w_col.number_input(
                    f"Weight ({unit})",
                    min_value=lo,
                    max_value=hi,
                    value=float(default_w),
                    step=step,
                    format=fmt_str,
                )
                reps = r_col.number_input("Reps", min_value=1, max_value=20, value=int(ex["reps"]), step=1)
                rpe = rpe_col.number_input("RPE", min_value=1.0, max_value=10.0, value=7.0, step=0.5)
                if st.form_submit_button("Log Set", type="primary"):
                    kg_val = units.display_to_kg(weight, unit)
                    try:
                        user_data.log_set(supabase, session["id"], ex["exercise"], next_num, kg_val, int(reps), rpe)
                        st.cache_data.clear()
                        st.rerun()
                    except Exception as _err:
                        st.error(f"Failed to log set: {_err}")
        elif next_num > ex["sets"]:
            st.success(f"All {ex['sets']} sets logged.")

st.divider()

# ── Accessories ───────────────────────────────────────────────────────────────

with st.expander("Accessories"):
    acc_done = list(session.get("accessories_done") or [])
    for acc in day_plan["accessories"]:
        is_done = acc["name"] in acc_done
        checked = st.checkbox(
            f"**{acc['name']}** — {acc['sets']}×{acc['reps']}  \n_{acc['note']}_",
            value=is_done,
            key=f"acc_{acc['name']}",
        )
        if checked and not is_done:
            acc_done.append(acc["name"])
            try:
                user_data.update_session_accessories(supabase, session["id"], acc_done)
                st.cache_data.clear()
                st.rerun()
            except Exception:
                pass
        elif not checked and is_done:
            acc_done = [a for a in acc_done if a != acc["name"]]
            try:
                user_data.update_session_accessories(supabase, session["id"], acc_done)
                st.cache_data.clear()
                st.rerun()
            except Exception:
                pass

st.divider()

# ── Session notes ─────────────────────────────────────────────────────────────

with st.expander("Session notes"):
    current_notes = session.get("notes") or ""
    new_notes = st.text_area("Notes", value=current_notes, label_visibility="collapsed")
    if st.button("Save notes"):
        user_data.update_session_notes(supabase, session["id"], new_notes)
        st.cache_data.clear()
        st.success("Saved.")

# ── Complete session ──────────────────────────────────────────────────────────

if session.get("completed"):
    st.success("Session completed! Great work.")
elif existing_sets:
    if st.button("Complete Session", type="primary"):
        user_data.complete_session(supabase, session["id"])
        recent = user_data.get_recent_sessions(supabase)
        pending = user_data.get_pending_suggestions(supabase)
        adaptation.run_adaptation_check(supabase, recent, pending, is_deload=week_plan["is_deload"])
        st.cache_data.clear()
        st.success("Session completed! Adaptation check run.")
        st.rerun()
