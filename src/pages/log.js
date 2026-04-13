// ── log.js ───────────────────────────────────────────────────
import { getRecentSessions } from '../modules/userData.js'
import { display }           from '../modules/units.js'

export async function renderLog (container, { supabase }) {
  container.innerHTML = `<div style="padding-top:1rem"><h1 class="page-title">Log</h1><div class="mt-2" id="log-list"><div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:.625rem"></div><div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:.625rem"></div></div></div>`

  const sessions = await getRecentSessions(supabase, 20)
  const list     = container.querySelector('#log-list')

  if (!sessions.length) {
    list.innerHTML = `<div class="card"><p class="body-sm muted">No sessions logged yet. Start with today's workout.</p></div>`
    return
  }

  list.innerHTML = sessions.map(s => {
    const date = new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    })
    const sets  = s.sets || []
    const total = sets.filter(x => x.completed).length
    const prs   = sets.filter(x => x.is_pr).length

    const feelColor = { good: 'var(--green)', caution: 'var(--amber)', flag: 'var(--red)' }[s.body_feel] || 'var(--ink-3)'
    const feelDot   = `<span style="width:8px;height:8px;border-radius:50%;background:${feelColor};display:inline-block;margin-right:5px"></span>`

    return `
      <div class="card" style="margin-bottom:.625rem;cursor:pointer" data-session-id="${s.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:14px;font-weight:500;color:var(--ink)">${date}</div>
            <div class="body-sm muted" style="margin-top:2px">${feelDot}${s.day_label ? 'Day '+s.day_label : ''} · Week ${s.week_number||'—'}</div>
          </div>
          <div style="text-align:right">
            ${s.completed ? '<span class="pill pill-green">Done</span>' : '<span class="pill pill-amber">Partial</span>'}
            ${prs > 0 ? `<div style="font-size:11px;color:var(--accent);margin-top:3px">${prs} PR${prs>1?'s':''}</div>` : ''}
          </div>
        </div>
        <div style="margin-top:.625rem;display:none" class="session-detail">
          ${sets.filter(x=>x.completed).map(st => `
            <div class="set-log-row" style="border-top:1px solid var(--border)">
              <div class="set-num" style="min-width:90px;font-size:12px;color:var(--ink-2)">${formatEx(st.exercise)}</div>
              <div class="set-chip${st.is_pr?' pr':' done'}">${display(st.kg_whole,st.kg_half)} · ${st.reps} reps · RPE ${st.rpe||'—'}</div>
            </div>
          `).join('')}
          ${!sets.length ? '<p class="body-sm muted" style="padding:.5rem 0">No sets logged</p>' : ''}
        </div>
      </div>
    `
  }).join('')

  // Toggle detail
  list.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const detail = card.querySelector('.session-detail')
      if (detail) detail.style.display = detail.style.display === 'none' ? 'block' : 'none'
    })
  })
}

function formatEx (ex) {
  return ex?.replace(/_/g,' ').replace(/\b\w/g, l=>l.toUpperCase()) || '—'
}
