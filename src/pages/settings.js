// ── settings.js ──────────────────────────────────────────────
import { getUnit, setUnit, display } from '../modules/units.js'
import { getUserSettings, updateUserSettings } from '../modules/userData.js'
import { BASELINE, TARGETS }        from '../modules/program.js'
import { toast }                    from '../modules/ui.js'

// Local-date YYYY-MM-DD; avoids UTC skew near midnight.
function localDateString () {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function renderSettings (container, { supabase }) {
  const settings = await getUserSettings(supabase)
  const unit     = getUnit()

  container.innerHTML = `
    <div style="padding-top:1rem">
      <h1 class="page-title">Settings</h1>

      <div class="mt-2">

        <!-- Unit preference -->
        <div class="section-label">Weight unit</div>
        <div class="card mb-2">
          <div class="body-sm muted mb-1">All displays switch instantly. Data is always stored in kg internally.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:.625rem">
            <button class="unit-opt${unit==='lbs'?' unit-opt--active':''}" data-unit="lbs">
              <div style="font-size:1.1rem;font-weight:600">lbs</div>
              <div style="font-size:11px;opacity:.7">Imperial</div>
            </button>
            <button class="unit-opt${unit==='kg'?' unit-opt--active':''}" data-unit="kg">
              <div style="font-size:1.1rem;font-weight:600">kg</div>
              <div style="font-size:11px;opacity:.7">Metric</div>
            </button>
          </div>
        </div>

        <!-- Program start date -->
        <div class="section-label">Program start date</div>
        <div class="card mb-2">
          <div class="body-sm muted mb-1">Used to calculate current week number. Change only if restarting the program.</div>
          <input type="date"
            id="start-date"
            value="${settings?.program_start_date || localDateString()}"
            style="width:100%;padding:.625rem .75rem;border:1px solid var(--border-med);border-radius:var(--radius-md);font-family:var(--font-body);font-size:15px;background:var(--bg-surface);color:var(--ink);margin-top:.25rem"
          />
          <button class="btn-secondary mt-1" id="save-date" style="width:100%">Save date</button>
        </div>

        <!-- Current maxes -->
        <div class="section-label">Current 1RM baselines (kg)</div>
        <div class="card mb-2">
          <div class="body-sm muted mb-1">These anchor all percentage-based targets. Update after testing a new max.</div>
          ${baselineRow('snatch',         'Snatch',         BASELINE.snatch)}
          ${baselineRow('clean_and_jerk', 'Clean & Jerk',   BASELINE.clean_and_jerk)}
          ${baselineRow('back_squat',     'Back Squat',      BASELINE.back_squat)}
          ${baselineRow('front_squat',    'Front Squat',     BASELINE.front_squat)}
          <button class="btn-primary mt-2" id="save-baselines">Save baselines</button>
        </div>

        <!-- Targets -->
        <div class="section-label">Year-end targets</div>
        <div class="card mb-2">
          <div class="body-sm muted mb-1">Displayed in the milestones tab. Shown in ${unit}.</div>
          <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="body-sm">Snatch</span>
              <span style="font-size:14px;font-weight:500;color:var(--accent)">${display(TARGETS.snatch, false)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="body-sm">Clean & Jerk</span>
              <span style="font-size:14px;font-weight:500;color:var(--accent)">${display(TARGETS.clean_and_jerk, false)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="body-sm">Back Squat</span>
              <span style="font-size:14px;font-weight:500;color:var(--accent)">${display(TARGETS.back_squat, false)}</span>
            </div>
          </div>
        </div>

        <!-- App info -->
        <div class="card mb-2">
          <div class="section-label mb-1">About</div>
          <div class="body-sm muted">Lift — personal weightlifting tracker</div>
          <div class="body-sm muted">Based on Greg Everett's Olympic Weightlifting methodology</div>
          <div class="body-sm muted" style="margin-top:.25rem">v1.0.0</div>
        </div>

        <div style="height:1rem"></div>
      </div>
    </div>

    <style>
      .unit-opt {
        padding: .875rem;
        border-radius: var(--radius-md);
        border: 1.5px solid var(--border-med);
        background: var(--bg-surface);
        color: var(--ink-2);
        cursor: pointer;
        text-align: center;
        transition: border-color .15s, background .15s, color .15s;
        font-family: var(--font-body);
      }
      .unit-opt--active {
        border-color: var(--accent);
        background: var(--accent-light);
        color: var(--accent-dark);
      }
      .baseline-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: .5rem 0;
        border-bottom: 1px solid var(--border);
      }
      .baseline-input {
        width: 72px;
        padding: .4rem .5rem;
        border: 1px solid var(--border-med);
        border-radius: var(--radius-sm);
        font-family: var(--font-body);
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        background: var(--bg-surface);
        color: var(--ink);
      }
    </style>
  `

  attachSettingsListeners(container, supabase)
}

function baselineRow (id, label, currentKg) {
  return `
    <div class="baseline-row">
      <span class="body-sm" style="font-weight:500">${label}</span>
      <div style="display:flex;align-items:center;gap:6px">
        <input
          class="baseline-input"
          type="number"
          inputmode="decimal"
          id="baseline-${id}"
          value="${currentKg}"
          min="20" max="300" step="0.5"
        />
        <span class="muted" style="font-size:12px">kg</span>
      </div>
    </div>
  `
}

function attachSettingsListeners (container, supabase) {
  // Unit toggle
  container.querySelectorAll('.unit-opt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const unit = btn.dataset.unit
      await setUnit(unit, supabase)
      container.querySelectorAll('.unit-opt').forEach(b => b.classList.remove('unit-opt--active'))
      btn.classList.add('unit-opt--active')
      toast(`Switched to ${unit}`, 'success')
    })
  })

  // Save start date
  container.querySelector('#save-date').addEventListener('click', async () => {
    const val = container.querySelector('#start-date').value
    if (!val) return
    await updateUserSettings(supabase, { program_start_date: val })
    toast('Program start date saved', 'success')
  })

  // Save baselines — stored in program.js BASELINE object + user_settings JSON
  container.querySelector('#save-baselines').addEventListener('click', async () => {
    const snatch  = parseFloat(container.querySelector('#baseline-snatch').value)
    const cj      = parseFloat(container.querySelector('#baseline-clean_and_jerk').value)
    const bs      = parseFloat(container.querySelector('#baseline-back_squat').value)
    const fs      = parseFloat(container.querySelector('#baseline-front_squat').value)

    if ([snatch, cj, bs, fs].some(v => isNaN(v) || v <= 0)) {
      toast('Please enter valid weights', 'error')
      return
    }

    // Persist to user_settings as a JSON blob for runtime override
    await updateUserSettings(supabase, {
      baselines: JSON.stringify({ snatch, clean_and_jerk: cj, back_squat: bs, front_squat: fs })
    })

    // Update runtime BASELINE object directly (already imported at top)
    BASELINE.snatch         = snatch
    BASELINE.clean_and_jerk = cj
    BASELINE.back_squat     = bs
    BASELINE.front_squat    = fs

    toast('Baselines saved', 'success')
  })
}
