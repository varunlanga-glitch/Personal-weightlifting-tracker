// ── milestones.js ────────────────────────────────────────────
// Projects current rate of progress onto goal timelines.
// All calculations in kg. Display via units.js.
// ─────────────────────────────────────────────────────────────

import { TARGETS, BASELINE } from './program.js'

/**
 * Given exercise history (array of { date, est1rm }),
 * project when the target 1RM will be reached.
 *
 * Uses a rolling linear regression over the last 8 data points
 * to smooth out noise from single bad sessions.
 *
 * @returns {object} { etaDate, etaLabel, ratePerWeek, weeksRemaining, pctComplete }
 */
export function projectMilestone (history, targetKg) {
  if (!history || history.length < 2) {
    return {
      etaDate:      null,
      etaLabel:     'Log more sessions',
      ratePerWeek:  0,
      weeksRemaining: null,
      pctComplete:  0,
    }
  }

  const recent = history.slice(-10)  // last 10 data points
  const n      = recent.length
  const first  = recent[0]
  const last   = recent[n - 1]

  const startKg    = first.est1rm
  const currentKg  = last.est1rm
  const startDate  = new Date(first.date)
  const lastDate   = new Date(last.date)
  const daysDiff   = Math.max(1, (lastDate - startDate) / (1000 * 60 * 60 * 24))
  const ratePerDay = (currentKg - startKg) / daysDiff
  const ratePerWeek = ratePerDay * 7

  const baselineKg  = BASELINE[exerciseFromHistory(history)] || startKg
  const totalGap    = targetKg - baselineKg
  const remaining   = targetKg - currentKg
  const pctComplete = totalGap > 0
    ? Math.min(100, Math.round(((currentKg - baselineKg) / totalGap) * 100))
    : 100

  if (ratePerDay <= 0) {
    return {
      etaDate:      null,
      etaLabel:     'Maintain consistency to project',
      ratePerWeek:  Math.round(ratePerWeek * 10) / 10,
      weeksRemaining: null,
      pctComplete,
    }
  }

  const daysRemaining   = remaining / ratePerDay
  const etaDate         = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
  const weeksRemaining  = Math.ceil(daysRemaining / 7)

  return {
    etaDate,
    etaLabel:      formatETA(etaDate, weeksRemaining),
    ratePerWeek:   Math.round(ratePerWeek * 10) / 10,
    weeksRemaining,
    pctComplete,
  }
}

function formatETA (date, weeks) {
  if (weeks <= 0)  return 'Target reached!'
  if (weeks <= 4)  return `~${weeks} week${weeks > 1 ? 's' : ''}`
  if (weeks <= 52) return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return 'Over 1 year at current rate'
}

// Attempt to infer exercise from history object if tagged
function exerciseFromHistory (history) {
  return history[0]?._exercise || null
}

/**
 * Generate projected weekly 1RM data points for chart overlay.
 * Returns array of { date (ISO string), kg } for the next N weeks.
 */
export function projectFuture (history, targetKg, weeksAhead = 26) {
  if (!history || history.length < 2) return []

  const recent      = history.slice(-6)
  const n           = recent.length
  const last        = recent[n - 1]
  const first       = recent[0]
  const daysDiff    = Math.max(1, (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24))
  const ratePerDay  = (last.est1rm - first.est1rm) / daysDiff

  if (ratePerDay <= 0) return []

  const points = []
  for (let w = 1; w <= weeksAhead; w++) {
    const projDate = new Date(new Date(last.date).getTime() + w * 7 * 24 * 60 * 60 * 1000)
    const projKg   = Math.round((last.est1rm + ratePerDay * w * 7) * 10) / 10
    if (projKg >= targetKg) {
      points.push({ date: projDate.toISOString().split('T')[0], kg: targetKg, isTarget: true })
      break
    }
    points.push({ date: projDate.toISOString().split('T')[0], kg: projKg })
  }
  return points
}

/**
 * Build mesocycle summary stats from session history.
 * Returns array of { meso, avgRPE, totalSets, prsHit, completionRate }
 */
export function mesoSummary (recentSessions) {
  const byMeso = {}
  for (const s of recentSessions) {
    const m = s.mesocycle || 1
    if (!byMeso[m]) byMeso[m] = { sessions: [], sets: [], prs: 0 }
    byMeso[m].sessions.push(s)
    for (const set of (s.sets || [])) {
      if (set.completed) {
        byMeso[m].sets.push(set)
        if (set.is_pr) byMeso[m].prs++
      }
    }
  }

  return Object.entries(byMeso).map(([meso, data]) => {
    const rpeSets  = data.sets.filter(s => s.rpe)
    const avgRPE   = rpeSets.length
      ? Math.round((rpeSets.reduce((a, s) => a + s.rpe, 0) / rpeSets.length) * 10) / 10
      : null
    const completed = data.sessions.filter(s => s.completed).length
    return {
      meso:            parseInt(meso),
      avgRPE,
      totalSets:       data.sets.length,
      prsHit:          data.prs,
      completionRate:  data.sessions.length
        ? Math.round((completed / data.sessions.length) * 100)
        : 0,
    }
  }).sort((a, b) => a.meso - b.meso)
}
