import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import streamlit as st
import plotly.graph_objects as go
from modules.db import get_supabase_client
from modules import user_data, units, milestones, program

st.set_page_config(page_title="Lift — Dashboard", page_icon="📊", layout="wide")
st.title("Dashboard")

supabase = get_supabase_client()
if not supabase:
    st.error("Supabase not configured.")
    st.stop()

settings_data = user_data.get_user_settings(supabase)
unit = st.session_state.get("unit", settings_data.get("preferred_unit", "lbs") if settings_data else "lbs")
baselines = (settings_data.get("baselines") or program.BASELINE) if settings_data else program.BASELINE

# ── Tabs ──────────────────────────────────────────────────────────────────────

tab_trends, tab_prs, tab_milestones = st.tabs(["Trends", "Personal Records", "Milestones"])

# ── Helpers ───────────────────────────────────────────────────────────────────

PRIMARY_EXERCISES = [
    ("snatch", "Snatch"),
    ("clean_and_jerk", "Clean & Jerk"),
    ("back_squat", "Back Squat"),
]


@st.cache_data(ttl=120)
def _get_history(_sb, exercise):
    return user_data.get_exercise_history(_sb, exercise)


@st.cache_data(ttl=120)
def _get_prs(_sb):
    return user_data.get_all_prs(_sb)


def _make_chart(exercise: str, ex_label: str) -> go.Figure:
    history = _get_history(supabase, exercise)
    target = program.TARGETS.get(exercise)

    fig = go.Figure()

    if history:
        dates = [h["date"] for h in history]
        est1rms_kg = [h["est1rm"] for h in history]
        est1rms = [units.kg_to_display(k, unit) for k in est1rms_kg]

        fig.add_trace(go.Scatter(
            x=dates,
            y=est1rms,
            mode="lines+markers",
            name="Est. 1RM",
            line={"color": "#2563eb", "width": 2},
            marker={"size": 6},
        ))

        if target:
            proj = milestones.project_future(history, target)
            if proj:
                proj_dates = [p["date"] for p in proj]
                proj_kgs = [units.kg_to_display(p["kg"], unit) for p in proj]
                fig.add_trace(go.Scatter(
                    x=proj_dates,
                    y=proj_kgs,
                    mode="lines",
                    name="Projected",
                    line={"color": "#9ca3af", "width": 2, "dash": "dash"},
                ))

        if target:
            target_disp = units.kg_to_display(target, unit)
            fig.add_hline(
                y=target_disp,
                line_dash="dot",
                line_color="#16a34a",
                annotation_text=f"Target: {units.format_weight(target, unit)}",
                annotation_position="bottom right",
            )

    fig.update_layout(
        title=f"{ex_label} — Estimated 1RM",
        xaxis_title="Date",
        yaxis_title=f"Weight ({unit})",
        height=350,
        margin={"l": 40, "r": 20, "t": 50, "b": 40},
        legend={"orientation": "h", "yanchor": "bottom", "y": 1.02},
    )
    return fig


# ── Trends tab ────────────────────────────────────────────────────────────────

with tab_trends:
    for ex, label in PRIMARY_EXERCISES:
        history = _get_history(supabase, ex)
        if not history:
            st.info(f"No data yet for {label}. Log some sessions to see trends.")
            continue
        st.plotly_chart(_make_chart(ex, label), use_container_width=True)


# ── PRs tab ───────────────────────────────────────────────────────────────────

with tab_prs:
    prs = _get_prs(supabase)
    if not prs:
        st.info("No personal records recorded yet.")
    else:
        for pr in prs:
            ex_name = pr["exercise"].replace("_", " ").title()
            kg_val = pr.get("weight_kg", 0)
            disp = units.format_weight(kg_val, unit)
            date_achieved = pr.get("achieved_on", "")
            c1, c2, c3 = st.columns([3, 2, 2])
            c1.markdown(f"**{ex_name}**")
            c2.markdown(f"**{disp}**")
            c3.caption(date_achieved)
        st.divider()

    # Also show best sets from history as implied PRs
    st.subheader("Best Est. 1RM from logged sets")
    for ex, label in PRIMARY_EXERCISES:
        history = _get_history(supabase, ex)
        if not history:
            continue
        best = max(history, key=lambda h: h["est1rm"])
        best_disp = units.format_weight(best["est1rm"], unit)
        c1, c2, c3 = st.columns([3, 2, 2])
        c1.write(label)
        c2.write(f"**{best_disp}**")
        c3.caption(f"on {best['date']}")


# ── Milestones tab ────────────────────────────────────────────────────────────

with tab_milestones:
    st.subheader("Progress toward year-end targets")
    any_data = False

    for ex, label in PRIMARY_EXERCISES:
        history = _get_history(supabase, ex)
        target = program.TARGETS.get(ex)
        if not target:
            continue

        milestone = milestones.project_milestone(history, target, exercise=ex)
        current_est = history[-1]["est1rm"] if history else None

        st.markdown(f"**{label}**")
        c1, c2, c3, c4 = st.columns(4)

        current_disp = units.format_weight(current_est, unit) if current_est else "—"
        target_disp = units.format_weight(target, unit)

        c1.metric("Current Est. 1RM", current_disp)
        c2.metric("Target", target_disp)
        c3.metric("Rate / week", f"{milestone['rate_per_week']} kg" if milestone["rate_per_week"] else "—")
        c4.metric("ETA", milestone["eta_label"])

        pct = milestone["pct_complete"]
        st.progress(pct / 100, text=f"{pct}% complete")
        st.divider()
        any_data = True

    if not any_data:
        st.info("Log sessions to see milestone projections.")

    # Mesocycle summary
    recent = user_data.get_recent_sessions(supabase, limit=50)
    summary = milestones.meso_summary(recent)
    if summary:
        st.subheader("Mesocycle Summary")
        rows = []
        for m in summary:
            rows.append({
                "Mesocycle": m["meso"],
                "Avg RPE": m["avg_rpe"] or "—",
                "Total Sets": m["total_sets"],
                "PRs Hit": m["prs_hit"],
                "Completion %": f"{m['completion_rate']}%",
            })
        st.dataframe(rows, use_container_width=True, hide_index=True)
