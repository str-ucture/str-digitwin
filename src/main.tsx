import './lib/threePatches' // must run before any R3F Canvas mounts
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './i18n/index'
import './styles/globals.css'

// Mapbox GL JS sends Turnstile (billing) and telemetry pings to events.mapbox.com.
// Ad blockers intercept these at the network level, causing the fetch() calls inside
// Mapbox's internal worker to reject. Because the worker inherits the page's fetch
// shim, we can intercept these here — before mapbox-gl is imported — and return a
// silent 200 so neither the network error nor the unhandled rejection appears.
const _originalFetch = window.fetch.bind(window)
window.fetch = (input, init?) => {
  const url = typeof input === 'string' ? input
    : input instanceof URL ? input.href
    : (input as Request).url
  if (url.includes('events.mapbox.com')) {
    return Promise.resolve(new Response(null, { status: 200 }))
  }
  return _originalFetch(input, init)
}

// Intercept global unhandled promise rejections to quietly suppress Mapbox GL JS v3's
// internal tile loading AbortErrors. When switching base map styles rapidly while tiles
// are in-flight, Mapbox internally cancels pending fetches via AbortController but omits
// top-level promise catch blocks, causing harmless unhandled rejections to bubble up.
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && (event.reason.name === 'AbortError' || event.reason.message?.includes('aborted'))) {
    event.preventDefault() // Suppresses the red console output completely
  }
})

// StrictMode is intentionally omitted: it double-invokes effects in development,
// which causes mapbox-gl to abort in-flight tile requests and throw unhandled
// AbortErrors. All other React best-practice warnings still apply.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
