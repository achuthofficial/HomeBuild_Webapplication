import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import strings from '@/i18n/strings'
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  isSupported,
  labelFor,
  translateStrings,
} from '@/i18n/translator'

const LanguageContext = createContext(null)

const STORAGE_KEY = 'homebuild.language'
const CACHE_PREFIX = 'homebuild.i18n.'

const CODES = LANGUAGES.map((l) => l.code)

/** Every leaf string in the catalogue, flattened to dotted keys. */
function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') flatten(value, path, out)
    else out[path] = value
  }
  return out
}

const EN = flatten(strings)
const EN_VALUES = Object.values(EN)

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return CODES.includes(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

/**
 * A previously translated dictionary.
 *
 * Cached so switching back to a language is instant and works with no network
 * and no model reload. Keyed by language only — the catalogue is English, so
 * a string that has since been added is simply missing from the cache and
 * gets picked up on the next translation pass.
 */
function readCache(code) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + code)
    return raw ? new Map(Object.entries(JSON.parse(raw))) : null
  } catch {
    return null
  }
}

function writeCache(code, dictionary) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + code,
      JSON.stringify(Object.fromEntries(dictionary)),
    )
  } catch {
    /* Quota or private mode — the dictionary still works for this session. */
  }
}

/** Fills `{name}` style placeholders after translation. */
function interpolate(template, values) {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    values[key] === undefined ? match : String(values[key]),
  )
}

/**
 * Language provider.
 *
 * `language` is the chosen BCP 47 code. `dictionary` maps ENGLISH STRINGS to
 * their translation — keyed on the string rather than on the dotted key, so
 * the same sentence used in two places is translated once.
 *
 * Translation is asynchronous and can be partial, so `t()` always has an
 * English answer available and upgrades to the translated one as it arrives.
 * Nothing ever renders a raw key or an empty string.
 */
export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage)
  const [dictionary, setDictionary] = useState(() => readCache(readStoredLanguage()))
  const [progress, setProgress] = useState(null)
  /* Set when the engine is present but could not actually be used — the model
     could not be fetched. The picker says so rather than staying stuck. */
  const [failed, setFailed] = useState(false)

  /* Abort a pass still running when the user picks a third language. */
  const abortRef = useRef(null)

  useEffect(() => {
    /* Assistive tech and the browser's own hyphenation both key on this. */
    document.documentElement.lang = language
  }, [language])

  /**
   * Must be called from a user gesture the first time a language is used:
   * Chrome only permits the model download from one, and this is invoked
   * straight out of the Settings dropdown's change event.
   */
  const setLanguage = useCallback(async (code) => {
    if (!CODES.includes(code)) return
    setLanguageState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      /* Storage unavailable — the choice holds for this session. */
    }

    abortRef.current?.abort()

    setFailed(false)

    if (code === DEFAULT_LANGUAGE) {
      setDictionary(null)
      setProgress(null)
      return
    }

    const cached = readCache(code)
    /* Show the cached dictionary immediately, then refresh it in the
       background so strings added since it was written get picked up. */
    if (cached) setDictionary(cached)

    if (!isSupported()) return

    const controller = new AbortController()
    abortRef.current = controller
    setProgress({ phase: 'translating', done: 0, total: EN_VALUES.length })

    try {
      const next = await translateStrings(EN_VALUES, code, {
        signal: controller.signal,
        onDownload: (loaded) =>
          setProgress({ phase: 'downloading', loaded }),
        onProgress: (done, total) =>
          setProgress({ phase: 'translating', done, total }),
      })
      if (controller.signal.aborted) return
      if (next.size) {
        setDictionary(next)
        writeCache(code, next)
      }
    } catch (error) {
      console.error('[i18n] translation failed', error)
      /* Nothing cached either, so the screen is staying in English and should
         say why rather than leaving a picker that looks like it worked. */
      if (!controller.signal.aborted && !cached) setFailed(true)
    } finally {
      if (!controller.signal.aborted) setProgress(null)
    }
  }, [])

  /**
   * Translate by key.
   *
   * Resolution is: English catalogue -> dictionary -> interpolate. An unknown
   * key returns the key itself, which is visible in development and harmless
   * in production — but it cannot happen for a key that exists in strings.js.
   */
  const t = useCallback(
    (key, values) => {
      const english = EN[key]
      if (english === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`)
        return key
      }
      return interpolate(dictionary?.get(english) ?? english, values)
    },
    [dictionary],
  )

  const value = useMemo(
    () => ({
      language,
      languageLabel: labelFor(language),
      setLanguage,
      t,
      /* False on Firefox, Safari and every mobile browser, so the UI can say
         so instead of offering a control that quietly does nothing. */
      canTranslate: isSupported(),
      /* True when the browser advertises the API but the model could not be
         loaded — a different message from "this browser cannot do it". */
      translationFailed: failed,
      /* { phase: 'downloading', loaded } | { phase: 'translating', done, total } */
      progress,
      languages: LANGUAGES,
    }),
    [language, setLanguage, t, progress, failed],
  )

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useTranslation must be used inside a LanguageProvider')
  }
  return ctx
}
