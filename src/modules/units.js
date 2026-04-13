// ── units.js ─────────────────────────────────────────────────
// Single source of truth for all unit conversion.
// Storage is always kg. Display converts on read.
// ─────────────────────────────────────────────────────────────

const KG_TO_LBS  = 2.20462262185
const STEP_LBS   = 1.25          // smallest loadable plate increment
const SETTINGS_KEY = 'wlt_unit'

// ── Preference ───────────────────────────────────────────────

export function getUnit () {
  return localStorage.getItem(SETTINGS_KEY) || 'lbs'
}

export async function setUnit (unit, supabase) {
  localStorage.setItem(SETTINGS_KEY, unit)
  if (supabase) {
    await supabase
      .from('user_settings')
      .update({ preferred_unit: unit, unit_updated_at: new Date().toISOString() })
      .eq('id', (await supabase.from('user_settings').select('id').single()).data?.id)
  }
  window.dispatchEvent(new CustomEvent('unit-changed', { detail: { unit } }))
}

export async function loadUnitFromDB (supabase) {
  const { data } = await supabase
    .from('user_settings')
    .select('preferred_unit')
    .single()
  if (data?.preferred_unit) {
    localStorage.setItem(SETTINGS_KEY, data.preferred_unit)
  }
  return getUnit()
}

// ── Conversion helpers ────────────────────────────────────────

/** Convert kg (stored) → display value in current unit */
export function kgToDisplay (kg) {
  if (getUnit() === 'kg') return kg
  return roundToPlate(kg * KG_TO_LBS)
}

/** Convert display value in current unit → kg for storage */
export function displayToKg (val) {
  if (getUnit() === 'kg') return val
  return val / KG_TO_LBS
}

/** Round lbs to nearest 1.25 (smallest loadable increment) */
export function roundToPlate (lbs) {
  return Math.round(lbs / STEP_LBS) * STEP_LBS
}

// ── kg_whole + kg_half → single numeric kg ───────────────────

export function colsToKg (kg_whole, kg_half) {
  return kg_whole + (kg_half ? 0.5 : 0)
}

/** Parse kg float → { kg_whole, kg_half } for DB storage */
export function kgToCols (kg) {
  const whole = Math.floor(kg)
  const half  = (kg - whole) >= 0.25  // treat >.25 as .5
  return { kg_whole: whole, kg_half: half }
}

// ── Display formatting ────────────────────────────────────────

/** "132.5 lbs" or "60 kg" */
export function display (kg_whole, kg_half = false) {
  const kg  = colsToKg(kg_whole, kg_half)
  const val = kgToDisplay(kg)
  const unit = getUnit()
  if (unit === 'kg') {
    return val % 1 === 0 ? `${val} kg` : `${val.toFixed(1)} kg`
  }
  return `${formatLbs(val)} lbs`
}

/** Just the number, no unit label */
export function displayNum (kg_whole, kg_half = false) {
  const kg  = colsToKg(kg_whole, kg_half)
  const val = kgToDisplay(kg)
  if (getUnit() === 'kg') {
    return val % 1 === 0 ? `${val}` : `${val.toFixed(1)}`
  }
  return formatLbs(val)
}

function formatLbs (lbs) {
  // Display as integer if whole, else 1 decimal
  return lbs % 1 === 0 ? `${lbs}` : `${lbs.toFixed(2).replace(/\.?0+$/, '')}`
}

/** Unit label string */
export function unitLabel () {
  return getUnit() === 'kg' ? 'kg' : 'lbs'
}

/** Axis label for charts */
export function axisLabel () {
  return getUnit() === 'kg' ? 'Weight (kg)' : 'Weight (lbs)'
}

// ── Drum input helpers ────────────────────────────────────────

/** Small step for drum scroll */
export function drumStep () {
  return getUnit() === 'kg' ? 0.5 : 2.5
}

/** Large step for drum hold/fast-scroll */
export function drumStepLarge () {
  return getUnit() === 'kg' ? 2.5 : 5
}

export function drumMin () {
  return getUnit() === 'kg' ? 20 : 45
}

export function drumMax () {
  return getUnit() === 'kg' ? 250 : 550
}

/** Snap a display value to the nearest valid drum step */
export function snapToStep (val) {
  const step = getUnit() === 'kg' ? 0.5 : STEP_LBS
  return Math.round(val / step) * step
}

/** Given a stored kg value, return the nearest snapped display value */
export function kgToSnapped (kg) {
  return snapToStep(kgToDisplay(kg))
}

/** Convert drum display value → DB cols */
export function drumValueToCols (displayVal) {
  const kg = displayToKg(displayVal)
  return kgToCols(kg)
}
