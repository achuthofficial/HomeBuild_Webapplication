/**
 * Offline capture for site updates.
 *
 * PRD 5.2.5: "Offline capture supported — uploads when connectivity restored",
 * and the non-functional table repeats it: "Critical site supervisor functions
 * (photo capture, notes) work offline with sync on reconnect".
 *
 * This is not a nice-to-have for the supervisor persona. The PRD's own words:
 * "Poor internet connectivity at most sites". Losing a day's log because the
 * signal dropped mid-submit is the failure that makes someone stop using the
 * app.
 *
 * IndexedDB rather than localStorage because the queue holds photo Blobs, and
 * localStorage is strings only — and a 5 MB cap that a single photo can blow.
 */

const DB_NAME = 'homebuild-offline'
const DB_VERSION = 1
const STORE = 'pending-updates'

let dbPromise = null

/** randomUUID needs a secure context; the fallback keeps http:// dev working. */
function newToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function openDb() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser has no offline storage.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  /* A failed open must not be cached forever — a private-mode browser that
     blocks IndexedDB on the first try may allow it later in the session. */
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE)
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Queues one update, with its photos, for later. */
export async function enqueueUpdate(draft, files = []) {
  const db = await openDb()
  return request(
    tx(db, 'readwrite').add({
      /* Minted here, once, and reused on every retry: the queue is
         at-least-once (it sends, then deletes), so a flush interrupted
         between those two steps resends. The server's unique index on this
         token turns that resend into a no-op instead of a duplicate entry in
         the site log. */
      draft: { ...draft, clientToken: newToken() },
      /* Blobs survive in IndexedDB; a File does too, but normalising to Blob
         plus a name avoids relying on structured-clone support for File in
         older WebViews, which is what a low-end Android device runs. */
      files: files.map((f) => ({ blob: f.slice(0, f.size, f.type), name: f.name })),
      queuedAt: new Date().toISOString(),
    }),
  )
}

export async function listQueued() {
  try {
    const db = await openDb()
    return await request(tx(db, 'readonly').getAll())
  } catch {
    /* No offline storage available: report an empty queue rather than
       breaking the page that asked. */
    return []
  }
}

export async function countQueued() {
  return (await listQueued()).length
}

async function removeQueued(id) {
  const db = await openDb()
  return request(tx(db, 'readwrite').delete(id))
}

/**
 * Sends everything queued, oldest first.
 *
 * `send` does the actual posting and is injected rather than imported, so this
 * module stays free of the API layer and is testable on its own.
 *
 * An entry is deleted only after its send resolves. If one fails, the flush
 * STOPS rather than skipping ahead: a site log is chronological, and posting
 * Thursday before Wednesday because Wednesday's photo failed would produce a
 * feed that lies about the order work happened in.
 */
export async function flushQueue(send) {
  const queued = await listQueued()
  let sent = 0

  for (const entry of queued) {
    try {
      await send(
        entry.draft,
        entry.files.map(
          (f) => new File([f.blob], f.name, { type: f.blob.type }),
        ),
      )
      await removeQueued(entry.id)
      sent += 1
    } catch {
      break
    }
  }

  return { sent, remaining: queued.length - sent }
}

/** True when the browser believes it is offline. */
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Whether a failure is worth queueing for.
 *
 * A dropped connection should be retried; "you do not have permission" never
 * will be, and queueing it would leave the supervisor with an update that can
 * never send and no explanation.
 */
export function isNetworkFailure(error) {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    isOffline() ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to load')
  )
}
