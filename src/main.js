// ── main.js ──────────────────────────────────────────────────
import { createClient }            from '@supabase/supabase-js'
import { Chart }                   from 'chart.js/auto'
import { initUI }                  from './modules/ui.js'
import { loadUnitFromDB, getUnit, setUnit } from './modules/units.js'
import { generateProgramWeeksRows, BASELINE } from './modules/program.js'

window.Chart = Chart

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

async function seedProgramWeeks () {
  const { data } = await supabase.from('program_weeks').select('id').limit(1)
  if (data && data.length > 0) return
  const rows = generateProgramWeeksRows()
  await supabase.from('program_weeks').insert(rows)
}

async function init () {
  await loadUnitFromDB(supabase)

  seedProgramWeeks().catch(console.error)

  // Load persisted baselines if user has saved them
  try {
    const { data } = await supabase.from('user_settings').select('baselines').single()
    if (data?.baselines) {
      const saved = typeof data.baselines === 'string'
        ? JSON.parse(data.baselines)
        : data.baselines
      Object.assign(BASELINE, saved)
    }
  } catch (e) { /* first run — no baselines saved yet */ }

  window.__unit = getUnit()
  window.addEventListener('unit-changed', e => { window.__unit = e.detail.unit })

  window.__setUnit = (u) => setUnit(u, supabase)
  window.__getUnit = getUnit

  initUI({ supabase })
}

init().catch(err => {
  console.error('App init failed:', err)
  document.getElementById('page').innerHTML = `
    <div style="padding:2rem 1rem;text-align:center">
      <div style="font-size:15px;font-weight:500;color:var(--ink)">Could not connect</div>
      <div class="body-sm muted mt-1">Check your internet connection and try again.</div>
      <button class="btn-secondary mt-2" onclick="location.reload()">Retry</button>
    </div>
  `
})
