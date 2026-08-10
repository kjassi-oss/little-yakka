// When did family data last change in this browser session?
//
// Client pages fetch their own data, so a mutation updates the page you're on
// straight away. The SERVER-rendered pages (Home, Summary, Kid Mode) are a
// different story: Next keeps their rendered payload in the client Router Cache
// for `staleTimes.dynamic` (see next.config.ts), and `router.refresh()` only
// clears the cache for the route you're currently on — not the others. So
// deleting a child in Settings left them visible on Home until the cache aged
// out (or the app was restarted).
//
// Every mutation stamps this module; RealtimeRefresh (mounted in the dashboard
// layout, so it survives navigation) re-fetches any route you arrive at whose
// cached copy predates the stamp. Tab switching stays instant when nothing has
// changed, and is guaranteed fresh when something has.
//
// Module scope is enough: a full page load resets this AND the Router Cache
// together, so they can't disagree.
let lastChange = 0

export function markDataChanged() {
  lastChange = Date.now()
}

export function lastDataChange(): number {
  return lastChange
}
