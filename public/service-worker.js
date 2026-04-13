// ── service-worker.js ────────────────────────────────────────
// Caches the app shell for offline use.
// Data (Supabase) still requires network — this ensures the UI
// loads and shows cached workout even with no signal.
// ─────────────────────────────────────────────────────────────

const CACHE_NAME  = 'lift-v1'
const FONT_CACHE  = 'lift-fonts-v1'

const APP_SHELL = [
  '/',
  '/index.html',
]

const FONT_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]

// ── Install — cache app shell ─────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// ── Activate — clean old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch strategy ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Skip Supabase API calls — always network only
  if (url.hostname.includes('supabase.co')) return

  // Fonts — cache first, long-lived
  if (FONT_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached
          return fetch(event.request).then(response => {
            cache.put(event.request, response.clone())
            return response
          })
        })
      )
    )
    return
  }

  // Chart.js CDN — cache first
  if (url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached
          return fetch(event.request).then(response => {
            cache.put(event.request, response.clone())
            return response
          })
        })
      )
    )
    return
  }

  // App shell — network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
  )
})
