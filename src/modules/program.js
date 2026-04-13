// ── program.js ───────────────────────────────────────────────
// Greg Everett periodisation logic.
// 52-week macrocycle. 4 mesocycles × ~13 weeks.
// All weights in kg. units.js handles display conversion.
// ─────────────────────────────────────────────────────────────

// ── Athlete baseline (kg) ────────────────────────────────────
export const BASELINE = {
  snatch:         60,
  clean_and_jerk: 60,
  back_squat:     93,   // 205 lbs ≈ 93kg
  front_squat:    76,   // ~82% of back squat
}

// ── Yearly targets ───────────────────────────────────────────
export const TARGETS = {
  snatch:         90,
  clean_and_jerk: 110,  // conservative: C&J typically ~15-20% above snatch
  back_squat:     150,
}

// ── Mesocycle definitions ────────────────────────────────────
// Each meso is ~12-13 weeks with a 1-week deload
// Phase intensities follow Everett's preparation → competition model

export const MESO_DEFS = [
  {
    meso: 1,
    weeks: [1,13],
    phase: 'preparation',
    label: 'Base strength',
    description: 'High volume, moderate intensity. Build positional strength and pulling mechanics.',
    base_intensity: 70,   // % of 1RM
    peak_intensity: 80,
  },
  {
    meso: 2,
    weeks: [14,26],
    phase: 'preparation',
    label: 'Strength-speed',
    description: 'Reduce volume, increase intensity. Introduce heavier singles on Saturdays.',
    base_intensity: 75,
    peak_intensity: 87,
  },
  {
    meso: 3,
    weeks: [27,39],
    phase: 'competition',
    label: 'Competition prep',
    description: 'Peaking cycles. Max singles, maintain volume via back-off sets.',
    base_intensity: 80,
    peak_intensity: 95,
  },
  {
    meso: 4,
    weeks: [40,52],
    phase: 'competition',
    label: 'Peak & test',
    description: 'PR attempts, competition simulation. Conservative deloads protect lower back.',
    base_intensity: 78,
    peak_intensity: 100,
  },
]

// ── Weekly intensity progression ─────────────────────────────
// Returns intensity % for a given week within its mesocycle
function weekIntensity (weekInMeso, baseInt, peakInt, isDeload) {
  if (isDeload) return 65
  // Linear ramp over 3 working weeks, reset on week 4 (deload)
  const workWeek = ((weekInMeso - 1) % 4) + 1
  const range    = peakInt - baseInt
  return Math.round(baseInt + (range * (workWeek - 1) / 3))
}

// ── 4-day training template (Mon/Tue/Thu/Sat) ────────────────
// Based on Everett's Stage 1→3 beginner-intermediate template
// Modified: removed SLDL, good mornings — replaced with safer
// accessories for lower back health.

function getDayPlan (dayLabel, weekNum, intensityPct, phase) {
  const pct = intensityPct / 100

  const plans = {
    // ── Day A — Snatch focus ──────────────────────────────
    A: {
      label: 'Day A',
      focus: 'Snatch',
      exercises: [
        {
          exercise: 'snatch',
          sets: 5,
          reps: phase === 'competition' ? 1 : 2,
          pct: pct,
          note: 'Focus on receiving position. No grinding.',
        },
        {
          exercise: 'snatch_pull',
          sets: 4,
          reps: 3,
          pct: pct + 0.10,  // pulls slightly heavier
          note: 'Maintain back angle. Explosive at hip.',
        },
        {
          exercise: 'back_squat',
          sets: 4,
          reps: phase === 'preparation' ? 5 : 3,
          pct: pct,
          note: 'Controlled descent. Drive knees out.',
        },
      ],
      accessories: [
        { name: 'Glute bridge hold',    sets: 3, reps: 10, note: 'Glute medius activation' },
        { name: 'Dead bug',             sets: 3, reps: 8,  note: 'Anti-extension core' },
        { name: 'Side-lying clamshell', sets: 3, reps: 12, note: 'Glute medius — banded if possible' },
      ],
    },

    // ── Day B — Jerk focus ────────────────────────────────
    B: {
      label: 'Day B',
      focus: 'Jerk',
      exercises: [
        {
          exercise: 'jerk',
          sets: 5,
          reps: phase === 'competition' ? 1 : 2,
          pct: pct,
          note: 'Full lock-out overhead. Punch through.',
        },
        {
          exercise: 'push_press',
          sets: 3,
          reps: 5,
          pct: pct * 0.75,  // push press ~75% of jerk
          note: 'Drive from legs. Press lockout.',
        },
        {
          exercise: 'front_squat',
          sets: 4,
          reps: 3,
          pct: pct,
          note: 'Elbows high. Upright torso.',
        },
        {
          exercise: 'overhead_squat',
          sets: 3,
          reps: 3,
          pct: pct * 0.80,
          note: 'Snatch grip. Active shoulders.',
        },
      ],
      accessories: [
        { name: 'Pallof press',      sets: 3, reps: 10, note: 'Anti-rotation core stability' },
        { name: 'Hip flexor stretch', sets: 2, reps: 60, note: '60s per side — kneeling lunge' },
        { name: 'McGill curl-up',    sets: 3, reps: 8,  note: 'Gentle spinal flexion endurance' },
      ],
    },

    // ── Day C — Clean focus ───────────────────────────────
    C: {
      label: 'Day C',
      focus: 'Clean',
      exercises: [
        {
          exercise: 'clean_and_jerk',
          sets: 5,
          reps: phase === 'competition' ? 1 : 2,
          pct: pct,
          note: 'Full clean + jerk. Quality over load.',
        },
        {
          exercise: 'clean_pull',
          sets: 4,
          reps: 3,
          pct: pct + 0.10,
          note: 'Full extension. Bar close to body.',
        },
        {
          exercise: 'back_squat',
          sets: 3,
          reps: phase === 'preparation' ? 5 : 3,
          pct: pct * 0.92,  // slightly lighter than Day A
          note: 'Speed out of hole.',
        },
      ],
      accessories: [
        { name: 'Single-leg glute bridge', sets: 3, reps: 10, note: 'Each leg. Glute medius + hip stability' },
        { name: 'Bird dog',                sets: 3, reps: 8,  note: 'Each side. Lumbar stability' },
        { name: 'Copenhagen plank',        sets: 3, reps: 20, note: '20s hold. Adductor + core' },
      ],
    },

    // ── Day D — Competition day (Saturday) ────────────────
    D: {
      label: 'Day D',
      focus: 'Competition sim',
      exercises: [
        {
          exercise: 'snatch',
          sets: phase === 'preparation' ? 3 : 5,
          reps: 1,
          pct: phase === 'preparation' ? pct + 0.05 : pct + 0.12,
          note: 'Work to heavy single. 15 total reps.',
        },
        {
          exercise: 'clean_and_jerk',
          sets: phase === 'preparation' ? 3 : 5,
          reps: 1,
          pct: phase === 'preparation' ? pct + 0.05 : pct + 0.12,
          note: 'Heavy single. Full competition attempt.',
        },
        {
          exercise: 'front_squat',
          sets: 3,
          reps: phase === 'preparation' ? 3 : 2,
          pct: pct + 0.05,
          note: 'Post-competition strength maintenance.',
        },
      ],
      accessories: [
        { name: 'Loaded carry (farmer)',  sets: 3, reps: 30, note: '30m. Core bracing under load' },
        { name: 'Hip 90/90 stretch',      sets: 2, reps: 60, note: '60s per side' },
        { name: 'Thoracic spine mob',     sets: 2, reps: 10, note: 'Cat-cow + thoracic rotation' },
      ],
    },
  }

  return plans[dayLabel] || plans.A
}

// ── Main public API ───────────────────────────────────────────

/**
 * Get program for a specific week
 * @param {number} weekNum — 1-52
 * @returns {object} full week plan with all 4 days
 */
export function getWeekPlan (weekNum) {
  const meso = getMeso(weekNum)
  const weekInMeso = weekNum - (meso.weeks[0] - 1)
  const isDeload   = (weekInMeso % 4) === 0
  const intensityPct = weekIntensity(
    weekInMeso,
    meso.base_intensity,
    meso.peak_intensity,
    isDeload
  )

  return {
    weekNum,
    mesocycle: meso.meso,
    phase: meso.phase,
    label: meso.label,
    isDeload,
    intensityPct,
    days: {
      A: getDayPlan('A', weekNum, intensityPct, meso.phase),
      B: getDayPlan('B', weekNum, intensityPct, meso.phase),
      C: getDayPlan('C', weekNum, intensityPct, meso.phase),
      D: getDayPlan('D', weekNum, intensityPct, meso.phase),
    }
  }
}

/**
 * Calculate target kg for an exercise in a given week
 * @param {string} exercise
 * @param {number} pct — fraction (0–1.1)
 * @param {object} overrides — optional user-confirmed adaptations
 */
export function targetKg (exercise, pct, overrides = {}) {
  const base = overrides[exercise] || BASELINE[exercise]
  if (!base) return null
  // Clamp to nearest 0.5 kg
  return Math.round(base * pct * 2) / 2
}

/**
 * Get which mesocycle a week belongs to
 */
export function getMeso (weekNum) {
  return MESO_DEFS.find(m => weekNum >= m.weeks[0] && weekNum <= m.weeks[1])
    || MESO_DEFS[0]
}

/**
 * Given a program start date and today's date, return current week number
 */
export function currentWeekNumber (startDateStr) {
  const start = new Date(startDateStr)
  const now   = new Date()
  const diff  = now - start
  const week  = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return Math.max(1, Math.min(52, week))
}

/**
 * Map day of week to training day label
 * Mon=A, Tue=B, Thu=C, Sat=D, rest days return null
 */
export function todayDayLabel () {
  const day = new Date().getDay() // 0=Sun
  const map  = { 1: 'A', 2: 'B', 4: 'C', 6: 'D' }
  return map[day] || null
}

/**
 * Seed program_weeks table rows (call once on first run)
 */
export function generateProgramWeeksRows () {
  const rows = []
  for (let w = 1; w <= 52; w++) {
    const meso = getMeso(w)
    const weekInMeso  = w - (meso.weeks[0] - 1)
    const isDeload    = (weekInMeso % 4) === 0
    const intensityPct = weekIntensity(
      weekInMeso, meso.base_intensity, meso.peak_intensity, isDeload
    )
    rows.push({
      week_number:      w,
      mesocycle:        meso.meso,
      phase:            meso.phase,
      intensity_pct:    intensityPct,
      volume_modifier:  isDeload ? 0.7 : 1.0,
      notes:            isDeload ? 'Deload week — 65%, reduced volume' : meso.label,
    })
  }
  return rows
}
