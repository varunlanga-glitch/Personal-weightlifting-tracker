// ── today.js ─────────────────────────────────────────────────
// Today page — shows today's workout, logs sets via bottom sheet
// ─────────────────────────────────────────────────────────────

import { getUnit, display, unitLabel, drumStep, drumStepLarge, drumMin, drumMax, snapToStep, kgToSnapped, kgToCols, colsToKg, drumValueToCols } from '../modules/units.js'
import { getTodaySession, createSession, updateSessionFeel, getSetsForSession, logSet, updateSet, deleteSet } from '../modules/userData.js'
import { getWeekPlan, currentWeekNumber, todayDayLabel, targetKg, BASELINE } from '../modules/program.js'
import { openSheet, closeSheet, toast, confirm } from '../modules/ui.js'

let sessionData  = null
let setsData     = {}   // { exercise: [set, ...] }
let feelLocked   = false
let weekPlan     = null
let dayPlan      = null
let programOverrides = {}

export async function renderToday (container, { supabase }) {
  const today      = new Date().toISOString().split('T')[0]
  const settings   = await supabase.from('user_settings').select('*').single()
  const startDate  = settings.data?.program_start_date || today
  const weekNum    = currentWeekNumber(startDate)
  const dayLabel   = todayDayLabel()

  weekPlan = getWeekPlan(weekNum)
  dayPlan  = dayLabel ? weekPlan.days[dayLabel] : null
  programOverrides = settings.data?.baselines || {}

  // Load or create session
  sessionData = await getTodaySession(supabase, today)
  if (!sessionData && dayLabel) {
    sessionData = await createSession(supabase, {
      date: today,
      week_number: weekNum,
      mesocycle: weekPlan.mesocycle,
      day_label: dayLabel,
    })
  }

  // Load existing sets
  if (sessionData) {
    const sets = await getSetsForSession(supabase, sessionData.id)
    setsData = {}
    for (const s of sets) {
      if (!setsData[s.exercise]) setsData[s.exercise] = []
      setsData[s.exercise].push(s)
    }
    feelLocked = sets.length > 0
  }

  container.innerHTML = buildTodayHTML(today, weekNum, dayLabel, weekPlan, dayPlan)
  attachTodayListeners(container, supabase, today, weekNum, dayLabel)
}

// ── HTML builders ─────────────────────────────────────────────

function buildTodayHTML (today, weekNum, dayLabel, weekPlan, dayPlan) {
  const dateStr = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })

  if (!dayLabel) {
    return `
      <div style="padding-top:1rem">
        <p class="muted" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:600">${dateStr}</p>
        <h1 class="page-title" style="margin-top:.25rem">Rest Day</h1>
        <div class="card mt-2">
          <p class="body-sm">Today is a rest day. Next session is <strong>${nextSessionDay()}</strong>.</p>
          <p class="body-sm mt-1">Use this time for mobility work and recovery.</p>
        </div>
        ${mobilityCard()}
      </div>
    `
  }

  return `
    <div style="padding-top:1rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem">
        <div>
          <p class="muted" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:600">${dateStr}</p>
          <h1 class="page-title" style="margin-top:.2rem">${dayPlan.focus}</h1>
        </div>
        <div style="text-align:right">
          <div class="pill pill-accent">Week ${weekNum}</div>
          <div style="font-size:11px;color:var(--ink-3);margin-top:3px">Meso ${weekPlan.mesocycle} · ${weekPlan.intensityPct}%</div>
        </div>
      </div>

      ${weekPlan.isDeload ? deloadBanner() : ''}

      <div class="section-label">How do you feel today?</div>
      ${feelWidget()}

      <div class="divider"></div>
      <div class="section-label" style="margin-top:1rem">Main lifts</div>
      ${dayPlan.exercises.map(ex => exerciseCard(ex, weekPlan.intensityPct)).join('')}

      <div class="divider"></div>
      <div class="section-label" style="margin-top:1rem">Accessories</div>
      ${dayPlan.accessories.map(acc => accessoryCard(acc)).join('')}

      <div style="height:1rem"></div>
    </div>
  `
}

function feelWidget () {
  const feel = sessionData?.body_feel || 'good'
  const locked = feelLocked ? ' locked' : ''
  return `
    <div class="feel-row" id="feel-row">
      <button class="feel-btn feel-good${feel==='good'?' selected':''}${locked}" data-feel="good">Good to go</button>
      <button class="feel-btn feel-caution${feel==='caution'?' selected':''}${locked}" data-feel="caution">A bit stiff</button>
      <button class="feel-btn feel-flag${feel==='flag'?' selected':''}${locked}" data-feel="flag">Lower back</button>
    </div>
    ${feelLocked ? '<p class="muted" style="font-size:11px;margin-top:4px">Locked after first set</p>' : ''}
  `
}

function exerciseCard (exDef, intensityPct) {
  const kg    = targetKg(exDef.exercise, exDef.pct, programOverrides)
  const sets  = setsData[exDef.exercise] || []
  const done  = sets.filter(s => s.completed).length
  const isComplete = done >= exDef.sets

  const targetDisplay = kg ? display(Math.floor(kg), (kg % 1) >= 0.5) : '—'

  return `
    <div class="exercise-card${isComplete ? ' complete' : ''}" data-exercise="${exDef.exercise}">
      <div class="ex-header">
        <div>
          <div class="ex-name">${formatExName(exDef.exercise)}</div>
          ${exDef.note ? `<div class="body-sm muted" style="font-size:11px;margin-top:2px">${exDef.note}</div>` : ''}
        </div>
        <div class="ex-target">
          ${exDef.sets}×${exDef.reps} @ ${targetDisplay}<br>
          <span style="font-size:10px;color:var(--ink-4)">${Math.round(exDef.pct*100)}% of max</span>
        </div>
      </div>
      ${buildSetRows(exDef, sets, kg)}
    </div>
  `
}

function buildSetRows (exDef, sets, targetKgVal) {
  const rows = []
  for (let i = 1; i <= exDef.sets; i++) {
    const set = sets[i - 1]
    if (set && set.completed) {
      const label = set.is_pr
        ? `<span class="pill pill-accent" style="font-size:10px;margin-right:4px">PR</span>` : ''
      rows.push(`
        <div class="set-log-row">
          <div class="set-num">S${i}</div>
          <div class="set-chip${set.is_pr?' pr':' done'}">${label}${display(set.kg_whole, set.kg_half)} · ${set.reps} rep${set.reps!==1?'s':''} · RPE ${set.rpe}</div>
          <button class="set-edit-btn" data-set-id="${set.id}" data-exercise="${exDef.exercise}" data-set-num="${i}">edit</button>
        </div>
      `)
    } else if (i === sets.filter(s=>s.completed).length + 1) {
      rows.push(`
        <div class="set-log-row">
          <div class="set-num">S${i}</div>
          <div class="set-chip">—</div>
          <button class="set-add-btn"
            data-exercise="${exDef.exercise}"
            data-set-num="${i}"
            data-target-kg="${targetKgVal || 0}"
            data-target-reps="${exDef.reps}">+ Log set</button>
        </div>
      `)
    } else {
      rows.push(`
        <div class="set-log-row">
          <div class="set-num">S${i}</div>
          <div class="set-chip">—</div>
        </div>
      `)
    }
  }
  return rows.join('')
}

function accessoryCard (acc) {
  return `
    <div class="card" style="margin-bottom:.5rem">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:14px;font-weight:500;color:var(--ink)">${acc.name}</div>
          <div class="body-sm muted">${acc.note}</div>
        </div>
        <div style="font-size:13px;font-weight:500;color:var(--ink-3);white-space:nowrap;margin-left:.75rem">${acc.sets}×${acc.reps}</div>
      </div>
    </div>
  `
}

function deloadBanner () {
  return `
    <div style="background:var(--blue-bg);border:1px solid rgba(24,95,165,.2);border-radius:var(--radius-md);padding:.75rem 1rem;margin-bottom:1rem">
      <div style="font-size:13px;font-weight:600;color:var(--blue)">Deload week</div>
      <div class="body-sm" style="color:var(--blue);opacity:.8;margin-top:2px">65% intensity · reduced volume · prioritise recovery</div>
    </div>
  `
}

function mobilityCard () {
  return `
    <div class="card mt-2">
      <div class="section-label mb-1">Suggested mobility</div>
      <div class="body-sm">· Hip flexor stretch — 60s each side</div>
      <div class="body-sm">· Pigeon stretch — 60s each side</div>
      <div class="body-sm">· Thoracic spine rotations — 2×10</div>
      <div class="body-sm">· McGill big 3 — bird dog, curl-up, side plank</div>
    </div>
  `
}

function nextSessionDay () {
  const day = new Date().getDay()
  const map = { 0:'Monday', 3:'Friday', 5:'Monday' }
  return map[day] || 'next training day'
}

// ── Sheet: log / edit a set ───────────────────────────────────

function buildSetSheet (exercise, setNum, targetKgVal, targetReps, existingSet) {
  const unit     = getUnit()
  const initVal  = existingSet
    ? kgToSnapped(colsToKg(existingSet.kg_whole, existingSet.kg_half))
    : snapToStep(targetKgVal
        ? (unit === 'lbs' ? targetKgVal * 2.20462 : targetKgVal)
        : (unit === 'lbs' ? 99 : 45))
  const initReps = existingSet?.reps || targetReps || 2
  const initRpe  = existingSet?.rpe  || 7

  const repOptions = [1,2,3,4,5,6,8,10,12,15]

  return `
    <div class="sheet-handle"></div>
    <div class="sheet-title">${formatExName(exercise)} · Set ${setNum}</div>

    <div class="section-label">Weight (${unitLabel()})</div>
    <div class="drum-wrap" style="margin:.5rem 0 .75rem">
      <div class="drum">
        <button class="drum-btn" id="drum-up" style="width:52px">▲</button>
        <div class="drum-value" id="drum-val">${formatDrumVal(initVal)}</div>
        <button class="drum-btn" id="drum-dn" style="width:52px">▼</button>
        <div class="drum-label">${unitLabel()}</div>
      </div>
    </div>
    <div style="font-size:11px;color:var(--ink-3);text-align:center;margin-bottom:1rem" id="drum-conversion"></div>

    <div class="section-label">Reps</div>
    <div class="rep-grid" id="rep-grid">
      ${repOptions.map(r => `
        <button class="rep-btn${r===initReps?' active':''}" data-reps="${r}">${r}</button>
      `).join('')}
    </div>

    <div class="section-label" style="margin-top:1rem">RPE</div>
    <div class="rpe-strip" id="rpe-strip">
      ${[1,2,3,4,5,6,7,8,9,10].map(r => {
        let cls = r===initRpe ? ' active' : ''
        if (r >= 9 && r===initRpe) cls = ' rpe-max'
        else if (r >= 7 && r===initRpe) cls = ' rpe-high'
        return `<button class="rpe-btn${cls}" data-rpe="${r}">${r}</button>`
      }).join('')}
    </div>

    <div style="margin-top:1rem">
      <button class="btn-primary" id="save-set-btn" data-exercise="${exercise}" data-set-num="${setNum}" data-set-id="${existingSet?.id||''}">
        ${existingSet ? 'Update set' : 'Save set'}
      </button>
      ${existingSet ? `<button class="btn-danger" id="delete-set-btn" data-set-id="${existingSet.id}" style="width:100%;margin-top:.5rem">Delete this set</button>` : ''}
    </div>
    <div style="height:.5rem"></div>
  `
}

function formatDrumVal (val) {
  const unit = getUnit()
  if (unit === 'kg') return val % 1 === 0 ? `${val}` : `${val.toFixed(1)}`
  return val % 1 === 0 ? `${val}` : `${val.toFixed(2).replace(/0+$/,'')}`
}

function updateDrumConversion (val, el) {
  const unit = getUnit()
  if (unit === 'lbs') {
    el.textContent = `≈ ${(val / 2.20462).toFixed(1)} kg stored`
  } else {
    el.textContent = `≈ ${(val * 2.20462).toFixed(1)} lbs equivalent`
  }
}

// ── Event listeners ───────────────────────────────────────────

function attachTodayListeners (container, supabase, today, weekNum, dayLabel) {
  // Body feel
  container.addEventListener('click', async (e) => {
    const feelBtn = e.target.closest('[data-feel]')
    if (feelBtn && !feelLocked && sessionData) {
      container.querySelectorAll('.feel-btn').forEach(b => b.classList.remove('selected'))
      feelBtn.classList.add('selected')
      await updateSessionFeel(supabase, sessionData.id, feelBtn.dataset.feel)
      sessionData.body_feel = feelBtn.dataset.feel
    }

    // Add set
    const addBtn = e.target.closest('.set-add-btn')
    if (addBtn) {
      const ex         = addBtn.dataset.exercise
      const setNum     = parseInt(addBtn.dataset.setNum)
      const targetKgV  = parseFloat(addBtn.dataset.targetKg) || 0
      const targetReps = parseInt(addBtn.dataset.targetReps) || 2

      let currentDrumVal
      const sheet = openSheet(buildSetSheet(ex, setNum, targetKgV, targetReps, null))
      currentDrumVal = parseFloat(sheet.querySelector('#drum-val').textContent)
      attachSheetListeners(sheet, supabase, ex, setNum, null, today, weekNum, dayLabel, container)
    }

    // Edit set
    const editBtn = e.target.closest('.set-edit-btn')
    if (editBtn) {
      const setId    = editBtn.dataset.setId
      const ex       = editBtn.dataset.exercise
      const setNum   = parseInt(editBtn.dataset.setNum)
      const existing = (setsData[ex] || []).find(s => s.id === setId)
      if (existing) {
        const sheet = openSheet(buildSetSheet(ex, setNum, 0, existing.reps, existing))
        attachSheetListeners(sheet, supabase, ex, setNum, existing, today, weekNum, dayLabel, container)
      }
    }
  })
}

function attachSheetListeners (sheet, supabase, ex, setNum, existingSet, today, weekNum, dayLabel, container) {
  let drumVal = parseFloat(sheet.querySelector('#drum-val').textContent)
  // Read the initially active rep button so we honour targetReps pre-selection
  let selReps = parseInt(sheet.querySelector('.rep-btn.active')?.dataset.reps) || existingSet?.reps || 2
  let selRpe  = existingSet?.rpe  || 7
  const convEl = sheet.querySelector('#drum-conversion')
  updateDrumConversion(drumVal, convEl)

  // Drum buttons
  const step = drumStep()
  const max  = drumMax()
  const min  = drumMin()

  let holdTimer = null

  function doAdj (dir) {
    drumVal = Math.max(min, Math.min(max, drumVal + dir * step))
    drumVal = Math.round(drumVal / step) * step
    sheet.querySelector('#drum-val').textContent = formatDrumVal(drumVal)
    updateDrumConversion(drumVal, convEl)
  }

  function startHold (dir) {
    holdTimer = setInterval(() => doAdj(dir), 80)
  }
  function stopHold () { clearInterval(holdTimer) }

  sheet.querySelector('#drum-up').addEventListener('click', () => doAdj(1))
  sheet.querySelector('#drum-dn').addEventListener('click', () => doAdj(-1))
  sheet.querySelector('#drum-up').addEventListener('pointerdown', () => startHold(1))
  sheet.querySelector('#drum-dn').addEventListener('pointerdown', () => startHold(-1))
  document.addEventListener('pointerup', stopHold, { once: true })

  // Reps
  sheet.querySelectorAll('.rep-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('.rep-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      selReps = parseInt(btn.dataset.reps)
    })
  })

  // RPE
  sheet.querySelectorAll('.rpe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('.rpe-btn').forEach(b => {
        b.classList.remove('active','rpe-high','rpe-max')
      })
      const r = parseInt(btn.dataset.rpe)
      if (r >= 9) btn.classList.add('rpe-max')
      else if (r >= 7) btn.classList.add('rpe-high')
      else btn.classList.add('active')
      selRpe = r
    })
  })

  // Save
  sheet.querySelector('#save-set-btn').addEventListener('click', async () => {
    const btn = sheet.querySelector('#save-set-btn')
    btn.disabled = true
    btn.textContent = 'Saving…'
    try {
      window.__unit = getUnit()

      if (existingSet) {
        const updated = await updateSet(supabase, existingSet.id, {
          kgDisplay: drumVal, reps: selReps, rpe: selRpe
        })
        // Update local
        const idx = (setsData[ex] || []).findIndex(s => s.id === existingSet.id)
        if (idx !== -1) setsData[ex][idx] = { ...setsData[ex][idx], ...updated }
        toast('Set updated', 'success')
      } else {
        const saved = await logSet(supabase, {
          session_id: sessionData.id,
          exercise: ex,
          set_number: setNum,
          kgDisplay: drumVal,
          reps: selReps,
          rpe: selRpe,
        })
        if (!setsData[ex]) setsData[ex] = []
        setsData[ex].push(saved)
        if (!feelLocked) {
          feelLocked = true
        }
        if (saved.is_pr) toast(`New PR on ${formatExName(ex)}!`, 'success')
        else toast('Set logged', 'success')
      }

      closeSheet()
      // Re-render today page
      const page = document.getElementById('page')
      await renderToday(page, { supabase })
    } catch (err) {
      toast('Error saving set', 'error')
      btn.disabled = false
      btn.textContent = existingSet ? 'Update set' : 'Save set'
      console.error(err)
    }
  })

  // Delete
  const delBtn = sheet.querySelector('#delete-set-btn')
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      confirm('Delete this set? This cannot be undone.', async () => {
        try {
          await deleteSet(supabase, existingSet.id)
          setsData[ex] = (setsData[ex] || []).filter(s => s.id !== existingSet.id)
          toast('Set deleted')
          const page = document.getElementById('page')
          renderToday(page, { supabase })
        } catch (err) {
          toast('Error deleting set', 'error')
        }
      })
    })
  }
}

// ── Helpers ───────────────────────────────────────────────────

function formatExName (exercise) {
  const names = {
    snatch:          'Snatch',
    clean_and_jerk:  'Clean & Jerk',
    back_squat:      'Back Squat',
    front_squat:     'Front Squat',
    snatch_pull:     'Snatch Pull',
    clean_pull:      'Clean Pull',
    jerk:            'Jerk',
    push_press:      'Push Press',
    overhead_squat:  'Overhead Squat',
    snatch_balance:  'Snatch Balance',
  }
  return names[exercise] || exercise
}
