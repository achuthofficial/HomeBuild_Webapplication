/**
 * Service worker — the other half of offline capture (PRD 5.2.5).
 *
 * The IndexedDB queue keeps a site update safe when the connection drops
 * mid-submit. That only helps if the app is already open. A supervisor who
 * arrives on site with no signal and taps the icon needs the app to LOAD,
 * which is what this does.
 *
 * Deliberately narrow: it caches this origin's own shell and assets and
 * nothing else. Requests to Supabase and Firebase are left alone so they fail
 * normally — the queue depends on seeing a real network error, and a service
 * worker that quietly served a stale API response would be worse than being
 * offline, because the screen would look correct and be wrong.
 */

const VERSION = 'v4'
const SHELL = `homebuild-shell-${VERSION}`
const ASSETS = `homebuild-assets-${VERSION}`

/**
 * Precache the shell AND the assets it references.
 *
 * Runtime caching alone is not enough here: on a normal second visit the
 * browser serves the JS and CSS from its own HTTP cache, so no fetch event
 * ever reaches this worker and nothing gets stored. The first time the device
 * is actually offline, the shell loads and then fails on an empty page.
 *
 * The asset filenames are content-hashed by the build and unknown to this
 * static file, so they are read out of index.html at install time. That keeps
 * the worker a plain file with no build step, and the list can never drift
 * from what was actually deployed.
 */
async function precache() {
  const cache = await caches.open(SHELL)
  await cache.addAll(['/', '/index.html'])

  const html = await (await fetch('/index.html', { cache: 'reload' })).text()
  const urls = new Set()
  for (const match of html.matchAll(/["'](\/assets\/[^"']+)["']/g)) {
    urls.add(match[1])
  }

  if (urls.size) {
    const assets = await caches.open(ASSETS)
    /* Individually, so one 404 does not reject the whole batch the way
       cache.addAll would. */
    await Promise.all(
      [...urls].map((url) =>
        fetch(url, { cache: 'reload' })
          .then((r) => (r.ok ? assets.put(url, r) : undefined))
          .catch(() => undefined),
      ),
    )
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precache()
      /* A failed precache must not block activation — the runtime cache below
         still fills on the next successful load. */
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('homebuild-') && !k.endsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  /* Only GET, only this origin. Everything else — the Supabase REST calls,
     Firebase token refresh, the storage uploads — goes straight to the
     network and fails honestly when there is none. */
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  /* Navigations: network first, so a deployed update is picked up promptly,
     falling back to the cached shell when there is nothing to reach. The SPA
     router resolves the path once the shell boots. */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL).then((c) => c.put('/index.html', copy))
          return response
        })
        .catch(() =>
          caches
            .match('/index.html')
            .then(
              (cached) =>
                cached ??
                new Response('Offline, and the app has not been cached yet.', {
                  status: 503,
                  headers: { 'Content-Type': 'text/plain' },
                }),
            ),
        ),
    )
    return
  }

  /* Assets are content-hashed by the build, so a cache hit is always the
     right bytes for that URL. */
  event.respondWith(
    /* ignoreVary: the precache stores a plain same-origin fetch, while the
       page requests its module scripts with `crossorigin`. The two carry
       different request headers, and a Vary-respecting match treats them as
       different entries — the cache filled correctly and every lookup still
       missed. */
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        /* No `response.type === 'basic'` check here: Vite emits its module
           scripts with a `crossorigin` attribute, so even same-origin assets
           come back as type 'cors' and that test silently cached nothing at
           all. The same-origin guard above is what makes this safe. */
        if (response.ok) {
          const copy = response.clone()
          caches.open(ASSETS).then((c) => c.put(request, copy))
        }
        return response
      })
    }),
  )
})
