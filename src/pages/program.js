// ── program page ─────────────────────────────────────────────
import { getWeekPlan, currentWeekNumber, getMeso, MESO_DEFS } from '../modules/program.js'
import { getPendingSuggestions, resolveSuggestion, getRecentSessions, getUserSettings } from '../modules/userData.js'
import { runAdaptationCheck } from '../modules/adaptation.js'
import { suggestionLabel, suggestionDetail } from '../modules/adaptation.js'
import { display } from '../modules/units.js'
import { toast } from '../modules/ui.js'

export async function renderProgram (container, { supabase }) {
  container.innerHTML = `<div style="padding-top:1rem"><h1 class="page-title">Program</h1><div class="mt-2 skeleton" style="height:120px;border-radius:12px"></div></div>`

  const [settings, pending, recent] = await Promise.all([
    getUserSettings(supabase),
    getPendingSuggestions(supabase),
    getRecentSessions(supabase, 14),
  ])

  const startDate = settings?.program_start_date || new Date().toISOString().split('T')[0]
  const weekNum   = currentWeekNumber(startDate)
  const weekPlan  = getWeekPlan(weekNum)
  const meso      = getMeso(weekNum)

  // Run adaptation check in background
  runAdaptationCheck(supabase, recent, pending).catch(console.error)

  container.innerHTML = `
    <div style="padding-top:1rem">
      <h1 class="page-title">Program</h1>

      <div class="card mt-2">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="section-label">Current position</div>
            <div style="font-size:1.2rem;font-family:var(--font-display);font-weight:500;color:var(--ink)">Week ${weekNum} of 52</div>
            <div class="body-sm muted">Mesocycle ${meso.meso} · ${meso.label}</div>
          </div>
          <div style="text-align:right">
            <div class="pill ${weekPlan.isDeload ? 'pill-amber' : 'pill-accent'}">${weekPlan.isDeload ? 'Deload' : weekPlan.phase}</div>
            <div style="font-size:11px;color:var(--ink-3);margin-top:4px">${weekPlan.intensityPct}% intensity</div>
          </div>
        </div>
        <div style="margin-top:.875rem;background:var(--bg-surface);border-radius:var(--radius-sm);height:6px;overflow:hidden">
          <div style="height:100%;background:var(--accent);width:${Math.round(weekNum/52*100)}%;border-radius:var(--radius-sm);transition:width .4s"></div>
        </div>
        <div style="font-size:10px;color:var(--ink-4);margin-top:4px;text-align:right">${weekNum}/52 weeks complete</div>
      </div>

      ${pending.length > 0 ? `
        <div style="margin-top:1.25rem">
          <div class="section-label">Suggested adjustments</div>
          ${pending.map(s => suggestionCard(s)).join('')}
        </div>
      ` : ''}

      <div style="margin-top:1.25rem">
        <div class="section-label">This week — ${weekPlan.label}</div>
        ${mesoDesc(meso)}
        ${['A','B','C','D'].map(d => dayPreviewCard(d, weekPlan)).join('')}
      </div>

      <div style="margin-top:1.25rem">
        <div class="section-label">Macrocycle overview</div>
        ${MESO_DEFS.map(m => mesoBlock(m, weekNum)).join('')}
      </div>

      <div style="height:1rem"></div>
    </div>
  `

  // Suggestion listeners
  container.querySelectorAll('[data-accept]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.accept
      await resolveSuggestion(supabase, id, 'accepted', weekNum + 1)
      toast('Adjustment accepted — takes effect next week', 'success')
      renderProgram(container, { supabase })
    })
  })
  container.querySelectorAll('[data-dismiss]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.dismiss
      await resolveSuggestion(supabase, id, 'dismissed')
      toast('Suggestion dismissed')
      renderProgram(container, { supabase })
    })
  })
}

function suggestionCard (s) {
  const typeColor = {
    reduce_intensity: 'amber',
    increase_intensity: 'green',
    reduce_volume: 'amber',
    deload: 'amber',
    flag_injury: 'red',
  }[s.suggestion_type] || 'blue'
  return `
    <div class="card mb-1" style="border-left:3px solid var(--${typeColor === 'red' ? 'red' : typeColor === 'green' ? 'green' : typeColor === 'amber' ? 'amber' : 'blue'})">
      <div style="font-size:14px;font-weight:500;color:var(--ink);margin-bottom:.25rem">${suggestionLabel(s)}</div>
      <div class="body-sm muted" style="margin-bottom:.75rem">${suggestionDetail(s)}</div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" style="flex:1;padding:.6rem" data-accept="${s.id}">Accept</button>
        <button class="btn-ghost" style="flex:1" data-dismiss="${s.id}">Dismiss</button>
      </div>
    </div>
  `
}

function mesoDesc (meso) {
  return `<div class="card mb-2"><p class="body-sm">${meso.description}</p></div>`
}

function dayPreviewCard (dayLabel, weekPlan) {
  const day = weekPlan.days[dayLabel]
  const dayNames = { A:'Monday', B:'Tuesday', C:'Thursday', D:'Saturday' }
  return `
    <div class="card mb-1">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--ink-3)">${dayNames[dayLabel]}</div>
          <div style="font-size:15px;font-weight:500;color:var(--ink)">${day.focus}</div>
        </div>
        <div class="pill pill-accent" style="font-size:10px">${day.exercises.length} lifts</div>
      </div>
      <div style="margin-top:.5rem">
        ${day.exercises.map(ex => `<div class="body-sm" style="padding:.2rem 0">· ${formatEx(ex.exercise)} ${ex.sets}×${ex.reps} @ ${Math.round(ex.pct*100)}%</div>`).join('')}
      </div>
    </div>
  `
}

function mesoBlock (m, currentWeek) {
  const isCurrent = currentWeek >= m.weeks[0] && currentWeek <= m.weeks[1]
  return `
    <div class="card mb-1${isCurrent ? '' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="body-sm muted">Weeks ${m.weeks[0]}–${m.weeks[1]}</div>
          <div style="font-size:14px;font-weight:500;color:var(--ink)">${m.label}</div>
        </div>
        <div>
          ${isCurrent ? '<span class="pill pill-accent">Current</span>' : ''}
          <div style="font-size:11px;color:var(--ink-4);text-align:right;margin-top:2px">${m.base_intensity}→${m.peak_intensity}%</div>
        </div>
      </div>
    </div>
  `
}

function formatEx (ex) {
  return ex.replace(/_/g,' ').replace(/\b\w/g, l=>l.toUpperCase())
}
