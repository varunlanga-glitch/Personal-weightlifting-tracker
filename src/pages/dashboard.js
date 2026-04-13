// ── dashboard.js ─────────────────────────────────────────────
import { getExerciseHistory, getAllPRs, getRecentSessions } from '../modules/userData.js'
import { display, unitLabel, kgToDisplay, colsToKg }        from '../modules/units.js'
import { BASELINE, TARGETS }                                  from '../modules/program.js'
import { projectMilestone, projectFuture, mesoSummary }      from '../modules/milestones.js'

export async function renderDashboard (container, { supabase }) {
  container.innerHTML = `
    <div style="padding-top:1rem">
      <h1 class="page-title">Progress</h1>
      <div class="mt-2" id="dash-content">
        <div class="skeleton" style="height:200px;border-radius:12px;margin-bottom:.75rem"></div>
        <div class="skeleton" style="height:160px;border-radius:12px"></div>
      </div>
    </div>`

  const [snatHist, cjHist, sqHist, prs, recent] = await Promise.all([
    getExerciseHistory(supabase, 'snatch'),
    getExerciseHistory(supabase, 'clean_and_jerk'),
    getExerciseHistory(supabase, 'back_squat'),
    getAllPRs(supabase),
    getRecentSessions(supabase, 30),
  ])

  const dash = container.querySelector('#dash-content')
  dash.innerHTML = `
    ${tabBar()}
    <div id="tab-trends">${trendsTab()}</div>
    <div id="tab-prs"    style="display:none">${prsTab(prs)}</div>
    <div id="tab-miles"  style="display:none">${milestonesTab(snatHist, cjHist, sqHist, recent)}</div>`

  attachDashListeners(dash, snatHist, cjHist, sqHist)
  requestAnimationFrame(() => initCharts(snatHist, cjHist, sqHist))
}

function tabBar () {
  return `
    <div style="display:flex;gap:6px;margin-bottom:1rem;background:var(--bg-surface);border-radius:var(--radius-md);padding:4px" role="tablist">
      <button class="dash-tab active" data-tab="trends" role="tab" style="flex:1">Trends</button>
      <button class="dash-tab" data-tab="prs" role="tab" style="flex:1">PRs</button>
      <button class="dash-tab" data-tab="miles" role="tab" style="flex:1">Milestones</button>
    </div>
    <style>
      .dash-tab{padding:.5rem 0;border-radius:var(--radius-sm);border:none;background:transparent;font-size:13px;font-weight:500;color:var(--ink-3);cursor:pointer;transition:background .15s,color .15s;font-family:var(--font-body)}
      .dash-tab.active{background:var(--bg-card);color:var(--ink);box-shadow:0 1px 3px rgba(28,25,22,.08)}
    </style>`
}

function trendsTab () {
  return `
    <div class="card mb-2">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div class="section-label" style="margin-bottom:0">Snatch</div>
        <span style="font-size:11px;color:var(--ink-4)">est. 1RM · dashed = projected</span>
      </div>
      <canvas id="chart-snatch" height="130"></canvas>
    </div>
    <div class="card mb-2">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div class="section-label" style="margin-bottom:0">Clean & Jerk</div>
        <span style="font-size:11px;color:var(--ink-4)">est. 1RM</span>
      </div>
      <canvas id="chart-cj" height="130"></canvas>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <div class="section-label" style="margin-bottom:0">Back squat</div>
        <span style="font-size:11px;color:var(--ink-4)">est. 1RM</span>
      </div>
      <canvas id="chart-sq" height="130"></canvas>
    </div>`
}

function prsTab (prs) {
  if (!prs.length) {
    return `<div class="card"><p class="body-sm muted">No PRs recorded yet. Log your first session to start tracking.</p></div>`
  }
  return `<div class="card">${prs.map(pr => {
    const dateStr = pr.achieved_on
      ? new Date(pr.achieved_on + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—'
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.625rem 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:14px;font-weight:500;color:var(--ink)">${fmtEx(pr.exercise)}</div>
          <div class="body-sm muted">${dateStr}</div>
        </div>
        <div style="font-size:1.15rem;font-family:var(--font-display);font-weight:500;color:var(--accent)">${display(pr.kg_whole, pr.kg_half)}</div>
      </div>`
  }).join('')}</div>`
}

function milestonesTab (snatHist, cjHist, sqHist, recent) {
  const snP  = projectMilestone(snatHist, TARGETS.snatch)
  const cjP  = projectMilestone(cjHist,   TARGETS.clean_and_jerk)
  const sqP  = projectMilestone(sqHist,   TARGETS.back_squat)
  const mesos = mesoSummary(recent)

  return `
    <div class="card mb-2">
      <div class="section-label mb-1">Goal targets</div>
      ${goalRow('Snatch',       BASELINE.snatch,         TARGETS.snatch,         snP)}
      ${goalRow('Clean & Jerk', BASELINE.clean_and_jerk, TARGETS.clean_and_jerk, cjP)}
      ${goalRow('Back squat',   BASELINE.back_squat,     TARGETS.back_squat,     sqP)}
    </div>
    <div class="card mb-2">
      <div class="section-label mb-1">Rate of progress</div>
      ${rateRow('Snatch',       snP)}
      ${rateRow('Clean & Jerk', cjP)}
      ${rateRow('Back squat',   sqP)}
    </div>
    ${mesos.length ? `
      <div class="card mb-2">
        <div class="section-label mb-1">Mesocycle summary</div>
        ${mesos.map(m => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
            <span class="body-sm">Meso ${m.meso}</span>
            <div style="display:flex;gap:.75rem;font-size:12px;color:var(--ink-3)">
              ${m.avgRPE ? `<span>RPE ${m.avgRPE}</span>` : ''}
              <span>${m.totalSets} sets</span>
              ${m.prsHit ? `<span style="color:var(--accent);font-weight:500">${m.prsHit} PR${m.prsHit > 1 ? 's' : ''}</span>` : ''}
              <span>${m.completionRate}%</span>
            </div>
          </div>`).join('')}
      </div>` : ''}
    <div class="card">
      <p class="body-sm muted">Projections use linear regression on your last 10 logged sessions. Actual progress depends on consistency, recovery, and health.</p>
    </div>`
}

function goalRow (label, baseline, target, proj) {
  const pct = proj.pctComplete
  return `
    <div style="padding:.625rem 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;margin-bottom:.4rem">
        <span style="font-size:13px;font-weight:500;color:var(--ink)">${label}</span>
        <span style="font-size:12px;color:var(--ink-3)">${display(baseline, false)} → ${display(target, false)}</span>
      </div>
      <div style="background:var(--bg-surface);border-radius:4px;height:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:4px;transition:width .5s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:.3rem">
        <span style="font-size:11px;color:var(--ink-4)">${pct}% complete</span>
        <span style="font-size:11px;color:var(--accent);font-weight:500">${proj.etaLabel}</span>
      </div>
    </div>`
}

function rateRow (label, proj) {
  const rate  = proj.ratePerWeek
  const sign  = rate > 0 ? '+' : ''
  const color = rate > 0 ? 'var(--green)' : rate < 0 ? 'var(--red)' : 'var(--ink-3)'
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border)">
      <span class="body-sm">${label}</span>
      <span style="font-size:13px;font-weight:500;color:${color}">${sign}${rate} ${unitLabel()}/wk</span>
    </div>`
}

function attachDashListeners (dash, snatHist, cjHist, sqHist) {
  const map = { trends: 'tab-trends', prs: 'tab-prs', miles: 'tab-miles' }
  dash.querySelectorAll('.dash-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      dash.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      Object.values(map).forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none' })
      const target = document.getElementById(map[btn.dataset.tab])
      if (target) {
        target.style.display = 'block'
        if (btn.dataset.tab === 'trends') requestAnimationFrame(() => initCharts(snatHist, cjHist, sqHist))
      }
    })
  })
}

function initCharts (s, c, q) {
  if (!window.Chart) return
  drawChart('chart-snatch', s, TARGETS.snatch,         '#8B6F4E', 'rgba(139,111,78,.08)')
  drawChart('chart-cj',     c, TARGETS.clean_and_jerk, '#3B6D11', 'rgba(59,109,17,.08)')
  drawChart('chart-sq',     q, TARGETS.back_squat,     '#185FA5', 'rgba(24,95,165,.08)')
}

function drawChart (id, history, targetKg, color, fill) {
  const canvas = document.getElementById(id)
  if (!canvas) return
  if (canvas._chart) { canvas._chart.destroy(); canvas._chart = null }
  if (!history.length) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.offsetWidth, 130)
    ctx.fillStyle = '#B5AFA7'; ctx.font = '13px Nunito,sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('No data yet — log your first session', canvas.offsetWidth / 2, 65)
    return
  }
  const future    = projectFuture(history, targetKg, 20)
  const labels    = [...history.map(h => sd(h.date)), ...future.map(f => sd(f.date) + ' ›')]
  const actual    = [...history.map(h => r1(kgToDisplay(h.est1rm))), ...Array(future.length).fill(null)]
  const proj      = [...Array(history.length - 1).fill(null), r1(kgToDisplay(history[history.length-1].est1rm)), ...future.map(f => r1(kgToDisplay(f.kg)))]
  const tgtLine   = labels.map(() => r1(kgToDisplay(targetKg)))

  canvas._chart = new window.Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [
      { label:'Actual',    data:actual, borderColor:color, backgroundColor:fill, pointBackgroundColor:color, pointRadius:3, tension:.35, fill:true,  spanGaps:false },
      { label:'Projected', data:proj,   borderColor:color, backgroundColor:'transparent', pointRadius:2, borderDash:[4,4], tension:.35, fill:false, spanGaps:false },
      { label:'Target',    data:tgtLine,borderColor:'rgba(139,111,78,.3)', backgroundColor:'transparent', pointRadius:0, borderDash:[2,6], tension:0, fill:false },
    ]},
    options: {
      responsive: true,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { display:false },
        tooltip: { callbacks: { label: c => c.parsed.y===null ? null : `${c.dataset.label}: ${c.parsed.y} ${unitLabel()}` }, filter: i => i.parsed.y !== null }
      },
      scales: {
        y: { ticks:{ font:{size:11,family:'Nunito'}, color:'#8A8178' }, grid:{ color:'rgba(28,25,22,.05)' } },
        x: { ticks:{ font:{size:10,family:'Nunito'}, color:'#8A8178', maxTicksLimit:6 }, grid:{ display:false } },
      }
    }
  })
}

const sd  = d => new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
const r1  = v => Math.round(v*10)/10
const fmtEx = ex => ex?.replace(/_/g,' ').replace(/\b\w/g, l=>l.toUpperCase())||'—'
