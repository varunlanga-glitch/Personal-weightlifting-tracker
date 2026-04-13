// ── adaptation.js ────────────────────────────────────────────
// Analyses logged data and generates suggestions.
// Never auto-applies. Always awaits user confirmation.
// ─────────────────────────────────────────────────────────────

import { createSuggestion } from './userData.js'

const RULES = {
  // RPE consistently high → reduce intensity
  HIGH_RPE_STREAK: {
    threshold: 8.5,
    sessions:  4,
    type:      'reduce_intensity',
    change:    -5,
    label:     (ex) => `Average RPE on ${fmt(ex)} has been ${'>'}8.5 for 4+ sessions`,
  },
  // Body feel flagged multiple times → suggest deload
  INJURY_FLAGS: {
    count:  2,
    days:   14,
    type:   'flag_injury',
    change: 0,
    label:  () => 'Lower back flagged 2+ times in the last 2 weeks',
  },
  // RPE consistently low → athlete ready for more
  LOW_RPE_STREAK: {
    threshold: 6.0,
    sessions:  4,
    type:      'increase_intensity',
    change:    +5,
    label:     (ex) => `Average RPE on ${fmt(ex)} has been ${'<'}6 for 4+ sessions — ready to progress`,
  },
  // Missing sessions → volume adaptation
  MISSED_SESSIONS: {
    count: 3,
    days:  14,
    type:  'reduce_volume',
    change: 0,
    label:  () => '3+ sessions missed in last 2 weeks — reduce volume to rebuild consistency',
  },
}

function fmt (exercise) {
  return exercise.replace(/_/g, ' ')
}

// ── Main analysis function ────────────────────────────────────

/**
 * Analyse recent session data and return suggestions.
 * @param {Array} recentSessions — last 14 sessions with .sets[]
 * @returns {Array} suggestion objects (not yet saved)
 */
export function analyseSessions (recentSessions) {
  const suggestions = []
  const now = new Date()
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000)

  const recent = recentSessions.filter(s => new Date(s.date) >= twoWeeksAgo)

  // ── Check for injury flags ──────────────────────────────
  const flagCount = recent.filter(s => s.body_feel === 'flag').length
  if (flagCount >= RULES.INJURY_FLAGS.count) {
    suggestions.push({
      exercise:              null,
      trigger_reason:        RULES.INJURY_FLAGS.label(),
      suggestion_type:       'flag_injury',
      suggested_pct_change:  0,
      status:                'pending',
    })
  }

  // ── Check per-exercise RPE trends ──────────────────────
  const exercises = ['snatch', 'clean_and_jerk', 'back_squat']
  for (const ex of exercises) {
    const exSets = recent.flatMap(s =>
      (s.sets || []).filter(set => set.exercise === ex && set.completed && set.rpe)
    )

    if (exSets.length < 6) continue  // not enough data

    // Group by session — take mean RPE per session
    const sessionRPEs = {}
    for (const set of exSets) {
      if (!sessionRPEs[set.session_id]) sessionRPEs[set.session_id] = []
      sessionRPEs[set.session_id].push(set.rpe)
    }
    const meanRPEs = Object.values(sessionRPEs)
      .map(rpList => rpList.reduce((a,b) => a+b, 0) / rpList.length)
    const lastN = meanRPEs.slice(-RULES.HIGH_RPE_STREAK.sessions)

    if (lastN.length >= RULES.HIGH_RPE_STREAK.sessions) {
      const avg = lastN.reduce((a,b) => a+b, 0) / lastN.length

      if (avg > RULES.HIGH_RPE_STREAK.threshold) {
        suggestions.push({
          exercise:              ex,
          trigger_reason:        RULES.HIGH_RPE_STREAK.label(ex),
          suggestion_type:       'reduce_intensity',
          suggested_pct_change:  RULES.HIGH_RPE_STREAK.change,
          status:                'pending',
        })
      } else if (avg < RULES.LOW_RPE_STREAK.threshold) {
        suggestions.push({
          exercise:              ex,
          trigger_reason:        RULES.LOW_RPE_STREAK.label(ex),
          suggestion_type:       'increase_intensity',
          suggested_pct_change:  RULES.LOW_RPE_STREAK.change,
          status:                'pending',
        })
      }
    }
  }

  // ── Check missed sessions ───────────────────────────────
  const expectedSessions = 8  // 4 days/week × 2 weeks
  const completedSessions = recent.filter(s => s.completed).length
  const missedCount = expectedSessions - completedSessions
  if (missedCount >= RULES.MISSED_SESSIONS.count) {
    suggestions.push({
      exercise:              null,
      trigger_reason:        RULES.MISSED_SESSIONS.label(),
      suggestion_type:       'reduce_volume',
      suggested_pct_change:  0,
      status:                'pending',
    })
  }

  return suggestions
}

/**
 * Run analysis and save new suggestions to DB.
 * Avoids duplicating existing pending suggestions.
 */
export async function runAdaptationCheck (supabase, recentSessions, existingPending) {
  const suggestions = analyseSessions(recentSessions)
  const existingTypes = new Set(
    existingPending.map(s => `${s.suggestion_type}:${s.exercise || 'null'}`)
  )

  for (const s of suggestions) {
    const key = `${s.suggestion_type}:${s.exercise || 'null'}`
    if (!existingTypes.has(key)) {
      await createSuggestion(supabase, s)
    }
  }
}

// ── Apply accepted suggestion to program overrides ───────────

/**
 * Apply a confirmed suggestion to the active program overrides.
 * Returns updated overrides object to be saved.
 */
export function applyAcceptedSuggestion (suggestion, currentOverrides, currentBaselines) {
  const overrides = { ...currentOverrides }

  if (suggestion.suggestion_type === 'reduce_intensity' ||
      suggestion.suggestion_type === 'increase_intensity') {
    const ex   = suggestion.exercise
    const base = currentBaselines[ex]
    if (base) {
      const change = suggestion.suggested_pct_change / 100
      overrides[ex] = Math.round(base * (1 + change) * 2) / 2  // snap to 0.5 kg
    }
  }

  return overrides
}

// ── Human-readable suggestion descriptions ───────────────────

export function suggestionLabel (s) {
  const typeLabels = {
    reduce_intensity: `Reduce ${fmt(s.exercise || 'all lifts')} intensity by ${Math.abs(s.suggested_pct_change)}%`,
    increase_intensity: `Increase ${fmt(s.exercise || 'all lifts')} intensity by ${s.suggested_pct_change}%`,
    reduce_volume: 'Reduce training volume this week',
    deload: 'Take a full deload week (65%, 70% volume)',
    flag_injury: 'Lower back flagged — reduce load and add mobility work',
  }
  return typeLabels[s.suggestion_type] || s.suggestion_type
}

export function suggestionDetail (s) {
  return s.trigger_reason
}
