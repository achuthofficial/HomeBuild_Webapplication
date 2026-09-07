/**
 * Live translation, on the device.
 *
 * ── Why this rather than checked-in translation files ─────────────────────
 * The PRD asks for a multi-language interface. Hand-written per-language
 * files would mean every new string needs four more edits before it can ship,
 * by someone who can write Telugu — which is how half-translated screens
 * happen. Here English is the only authored language (src/i18n/strings.js)
 * and the rest are produced at runtime, so a string added today is translated
 * today.
 *
 * ── What does the translating ─────────────────────────────────────────────
 * Chrome's built-in Translator API: an on-device model, no API key, no server,
 * no request leaving the machine. That last point matters — project names and
 * client names pass through these screens, and shipping them to a third-party
 * translation endpoint to localise a button label would be a poor trade.
 *
 * It is Chrome 138+ and Edge 148+, DESKTOP ONLY. Firefox, Safari and mobile
 * have no equivalent, so `isSupported()` is false there and the app stays in
 * English rather than pretending. `translateStrings` is the seam a hosted
 * translation API would drop into for those browsers — it takes strings and
 * returns strings, and nothing above it knows which engine answered.
 *
 * ── The model download ────────────────────────────────────────────────────
 * The first use of a language pair downloads a model, which Chrome permits
 * only from a user gesture. Choosing a language from the Settings dropdown is
 * one, so the call chain from that change event must stay synchronous up to
 * `Translator.create()` — do not await anything else first.
 */

/** BCP 47 codes, and how each language names itself. */
export const LANGUAGES = [
  { code: 'en', label: 'English (United States)' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
]

export const DEFAULT_LANGUAGE = 'en'

/**
 * How long to wait for `Translator.create()` before giving up.
 *
 * Generous, because it covers a genuine first-run model download on a slow
 * connection — but bounded, because the call can hang forever when the model
 * host is unreachable.
 */
const CREATE_TIMEOUT_MS = 60_000

export const labelFor = (code) =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code

/** Whether this browser can translate at all. */
export function isSupported() {
  return typeof self !== 'undefined' && 'Translator' in self
}

/**
 * Whether a language is ready, needs a download, or cannot be served.
 * Returns one of 'available' | 'downloadable' | 'downloading' | 'unavailable'.
 */
export async function availabilityFor(code) {
  if (!isSupported() || code === DEFAULT_LANGUAGE) return 'available'
  try {
    return await self.Translator.availability({
      sourceLanguage: DEFAULT_LANGUAGE,
      targetLanguage: code,
    })
  } catch {
    return 'unavailable'
  }
}

/* Placeholders must survive the round trip. The on-device model usually
   leaves `{name}` alone, but "usually" is not good enough for a string whose
   only job is to name the signed-in user — a mangled placeholder would render
   literal braces in the UI. Any translation that drops one is rejected. */
const PLACEHOLDER = /\{(\w+)\}/g

function placeholdersOf(text) {
  return (text.match(PLACEHOLDER) ?? []).sort().join(',')
}

/**
 * Translates a batch of English strings into `code`.
 *
 * Resolves to a Map of english -> translated. A string that fails, or comes
 * back having lost a placeholder, is simply absent from the map, and the
 * caller renders the English. Partial success is the norm to design for, not
 * an error state.
 *
 * `onProgress(done, total)` reports translation progress; `onDownload(0..1)`
 * reports model download progress, which only fires on first use.
 */
export async function translateStrings(
  englishStrings,
  code,
  { onProgress, onDownload, signal } = {},
) {
  const out = new Map()
  if (code === DEFAULT_LANGUAGE || !isSupported()) return out

  /* Created before any await that could break the user-gesture chain. */
  const creating = self.Translator.create({
    sourceLanguage: DEFAULT_LANGUAGE,
    targetLanguage: code,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => onDownload?.(e.loaded))
    },
  })

  /* create() does NOT reject when the model cannot be fetched — it simply
     never settles. Observed on a machine with no route to the model host:
     the promise hung indefinitely, which left the language picker disabled
     with a progress message that would never finish. A browser that reports
     the API as present is not a browser that can necessarily use it, so this
     races the wait and gives up rather than hanging the screen. */
  const translator = await Promise.race([
    creating,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('TRANSLATOR_UNAVAILABLE')),
        CREATE_TIMEOUT_MS,
      ),
    ),
  ])

  const unique = [...new Set(englishStrings)]
  let done = 0

  /* A small concurrency window: the model is local, so a handful in flight is
     faster than one at a time, and far kinder than a hundred at once. */
  const WINDOW = 6
  let cursor = 0

  async function worker() {
    while (cursor < unique.length) {
      if (signal?.aborted) return
      const text = unique[cursor++]
      try {
        const translated = await translator.translate(text)
        if (placeholdersOf(translated) === placeholdersOf(text)) {
          out.set(text, translated)
        }
      } catch {
        /* Leave it out; English shows through. */
      }
      onProgress?.(++done, unique.length)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(WINDOW, unique.length) }, worker),
  )

  translator.destroy?.()
  return out
}
