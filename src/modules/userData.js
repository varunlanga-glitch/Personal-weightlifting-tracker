// ── userData.js ──────────────────────────────────────────────
// All Supabase interactions. No other module touches the DB.
// ─────────────────────────────────────────────────────────────

import { kgToCols, colsToKg, displayToKg } from './units.js'

// ── Sessions ─────────────────────────────────────────────────

export async function getTodaySession (supabase, date) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createSession (supabase, { date, week_number, mesocycle, day_label }) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ date, week_number, mesocycle, day_label, body_feel: 'good', completed: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSessionFeel (supabase, sessionId, body_feel) {
  const { error } = await supabase
    .from('sessions')
    .update({ body_feel })
    .eq('id', sessionId)
  if (error) throw error
}

export async function updateSessionNotes (supabase, sessionId, notes) {
  const { error } = await supabase
    .from('sessions')
    .update({ notes })
    .eq('id', sessionId)
  if (error) throw error
}

export async function completeSession (supabase, sessionId) {
  const { error } = await supabase
    .from('sessions')
    .update({ completed: true })
    .eq('id', sessionId)
  if (error) throw error
}

export async function getRecentSessions (supabase, limit = 14) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, sets(*)')
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// ── Sets ─────────────────────────────────────────────────────

export async function getSetsForSession (supabase, sessionId) {
  const { data, error } = await supabase
    .from('sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('set_number', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * Log a set.
 * kgDisplay is in the user's current unit — converted to kg cols before write.
 */
export async function logSet (supabase, {
  session_id,
  exercise,
  set_number,
  kgDisplay,    // numeric in current display unit
  reps,
  rpe,
  notes
}) {
  const { kg_whole, kg_half } = kgToCols(displayToKg(kgDisplay))
  const { data, error } = await supabase
    .from('sets')
    .insert({
      session_id,
      exercise,
      set_number,
      kg_whole,
      kg_half,
      reps,
      rpe,
      completed: true,
      notes: notes || null
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSet (supabase, setId, {
  kgDisplay,
  reps,
  rpe,
  notes
}) {
  const { kg_whole, kg_half } = kgToCols(displayToKg(kgDisplay))
  const { data, error } = await supabase
    .from('sets')
    .update({ kg_whole, kg_half, reps, rpe, notes: notes || null })
    .eq('id', setId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSet (supabase, setId) {
  const { error } = await supabase
    .from('sets')
    .delete()
    .eq('id', setId)
  if (error) throw error
}

// ── Personal records ─────────────────────────────────────────

export async function getAllPRs (supabase) {
  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .order('exercise')
  if (error) throw error
  return data || []
}

// ── Performance history (for charts) ─────────────────────────

export async function getExerciseHistory (supabase, exercise, limit = 52) {
  const { data, error } = await supabase
    .from('sets')
    .select('kg_whole, kg_half, reps, rpe, created_at, sessions(date, week_number)')
    .eq('exercise', exercise)
    .eq('completed', true)
    .order('created_at', { ascending: true })
    .limit(limit * 10)  // fetch more, aggregate client-side
  if (error) throw error
  // Group by session date — take max kg per session as estimated peak
  const byDate = {}
  for (const s of data || []) {
    const date = s.sessions?.date
    if (!date) continue
    const kg = colsToKg(s.kg_whole, s.kg_half)
    const est1rm = estimate1RM(kg, s.reps)
    if (!byDate[date] || est1rm > byDate[date].est1rm) {
      byDate[date] = { date, kg, reps: s.reps, rpe: s.rpe, est1rm, week: s.sessions?.week_number }
    }
  }
  return Object.values(byDate).sort((a,b) => a.date.localeCompare(b.date))
}

// Epley formula
function estimate1RM (kg, reps) {
  if (reps === 1) return kg
  return Math.round((kg * (1 + reps / 30)) * 10) / 10
}

export { estimate1RM }

// ── Program weeks ─────────────────────────────────────────────

export async function getProgramWeeks (supabase) {
  const { data, error } = await supabase
    .from('program_weeks')
    .select('*')
    .order('week_number')
  if (error) throw error
  return data || []
}

// ── Adaptation suggestions ────────────────────────────────────

export async function getPendingSuggestions (supabase) {
  const { data, error } = await supabase
    .from('adaptation_suggestions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function resolveSuggestion (supabase, id, status, applied_from_week = null) {
  const { error } = await supabase
    .from('adaptation_suggestions')
    .update({ status, resolved_at: new Date().toISOString(), applied_from_week })
    .eq('id', id)
  if (error) throw error
}

export async function createSuggestion (supabase, suggestion) {
  const { error } = await supabase
    .from('adaptation_suggestions')
    .insert(suggestion)
  if (error) throw error
}

// ── User settings ─────────────────────────────────────────────

export async function getUserSettings (supabase) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function updateUserSettings (supabase, updates) {
  const settings = await getUserSettings(supabase)
  if (settings) {
    const { error } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('id', settings.id)
    if (error) throw error
    return
  }
  // First-run user — no row exists yet. Insert instead of silently no-oping.
  const { error } = await supabase
    .from('user_settings')
    .insert(updates)
  if (error) throw error
}
