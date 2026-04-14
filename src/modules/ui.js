// ── ui.js ────────────────────────────────────────────────────
// Client-side router, bottom sheet, toast, nav rendering.
// ─────────────────────────────────────────────────────────────

import { renderToday }     from '../pages/today.js'
import { renderLog }       from '../pages/log.js'
import { renderDashboard } from '../pages/dashboard.js'
import { renderProgram }   from '../pages/program.js'
import { renderSettings }  from '../pages/settings.js'

// ── Navigation ───────────────────────────────────────────────

const ROUTES = [
  { id: 'today',     label: 'Today',    icon: iconToday() },
  { id: 'log',       label: 'Log',      icon: iconLog() },
  { id: 'dashboard', label: 'Progress', icon: iconChart() },
  { id: 'program',   label: 'Program',  icon: iconProgram() },
  { id: 'settings',  label: 'Settings', icon: iconSettings() },
]

let currentRoute = 'today'
let appContext   = null   // { supabase }

export function initUI (context) {
  appContext = context
  renderNav()
  navigate('today')
  // Re-render on unit change
  window.addEventListener('unit-changed', () => renderCurrentPage())
}

function renderNav () {
  const nav = document.getElementById('nav')
  nav.innerHTML = ROUTES.map(r => `
    <button class="nav-item${r.id === currentRoute ? ' active' : ''}"
            data-route="${r.id}" aria-label="${r.label}">
      ${r.icon}
      <span>${r.label}</span>
    </button>
  `).join('')
  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route))
  })
}

export function navigate (route) {
  currentRoute = route
  renderNav()
  renderCurrentPage()
}

function renderCurrentPage () {
  const page = document.getElementById('page')
  page.innerHTML = '<div style="padding:2rem 0;display:flex;justify-content:center"><div class="skeleton" style="width:60%;height:24px;border-radius:8px"></div></div>'
  const ctx = appContext
  if (currentRoute === 'today')     renderToday(page, ctx)
  if (currentRoute === 'log')       renderLog(page, ctx)
  if (currentRoute === 'dashboard') renderDashboard(page, ctx)
  if (currentRoute === 'program')   renderProgram(page, ctx)
  if (currentRoute === 'settings')  renderSettings(page, ctx)
}

// ── Bottom sheet ──────────────────────────────────────────────

let sheetCloseCallback = null

export function openSheet (htmlContent, onClose) {
  sheetCloseCallback = onClose || null

  let sheet = document.getElementById('bottom-sheet')
  if (!sheet) {
    sheet = document.createElement('div')
    sheet.id = 'bottom-sheet'
    sheet.className = 'bottom-sheet'
    document.body.appendChild(sheet)
  }

  sheet.innerHTML = htmlContent
  const overlay = document.getElementById('sheet-overlay')
  overlay.classList.remove('hidden')

  requestAnimationFrame(() => {
    requestAnimationFrame(() => sheet.classList.add('open'))
  })

  overlay.onclick = closeSheet
  return sheet
}

export function closeSheet () {
  const sheet  = document.getElementById('bottom-sheet')
  const overlay = document.getElementById('sheet-overlay')
  if (sheet) {
    // Let listeners tear down intervals, global listeners, etc.
    sheet.dispatchEvent(new CustomEvent('sheet-cleanup'))
    sheet.classList.remove('open')
    setTimeout(() => {
      sheet.innerHTML = ''
      overlay.classList.add('hidden')
    }, 300)
  }
  if (sheetCloseCallback) sheetCloseCallback()
  sheetCloseCallback = null
}

// ── Toast ─────────────────────────────────────────────────────

export function toast (message, type = 'default') {
  const container = document.getElementById('toast-container')
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = message
  container.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

// ── Confirm dialog (inline — no native alert) ─────────────────

export function confirm (message, onConfirm, onCancel) {
  const html = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="font-family:var(--font-body);font-size:15px;padding:.75rem 0 .5rem">${message}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:.5rem">
      <button class="btn-secondary" id="confirm-cancel">Cancel</button>
      <button class="btn-primary" id="confirm-ok" style="background:var(--red)">Confirm</button>
    </div>
    <div style="height:.5rem"></div>
  `
  const sheet = openSheet(html)
  sheet.querySelector('#confirm-cancel').onclick = () => { closeSheet(); if (onCancel) onCancel() }
  sheet.querySelector('#confirm-ok').onclick     = () => { closeSheet(); if (onConfirm) onConfirm() }
}

// ── SVG icons ─────────────────────────────────────────────────

function iconToday () {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/></svg>`
}
function iconLog () {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`
}
function iconChart () {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
}
function iconProgram () {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`
}
function iconSettings () {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
}
