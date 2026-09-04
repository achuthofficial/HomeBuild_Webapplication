import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Minimal async-data hook.
 *
 * Deliberately not TanStack Query: these screens are read-mostly and mount
 * once, so the parts that library earns its bundle size for — background
 * refetch, cache invalidation graphs, optimistic mutation rollback — are not
 * in play here. What IS needed is the correctness a naive useEffect gets
 * wrong, so that is what this does:
 *
 *   · A request counter, so a slow first response cannot overwrite a fast
 *     second one when `deps` change mid-flight.
 *   · A mounted guard, so navigating away during a fetch does not setState on
 *     an unmounted component.
 *   · `refetch`, for after a mutation.
 *   · `refreshMs`, for the screens with a freshness requirement.
 *
 * `fetcher` must be stable or memoised — it is invoked whenever `deps` change.
 */
export function useQuery(
  fetcher,
  deps = [],
  { enabled = true, refreshMs = 0 } = {},
) {
  const [state, setState] = useState({
    data: null,
    error: null,
    isLoading: enabled,
  })

  const mounted = useRef(true)
  /* Monotonic id: only the newest in-flight request may commit its result. */
  const requestId = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  /**
   * `silent` skips the loading flag, for the background refresh below.
   * Without it a 45-second poll would replace the feed with skeletons every
   * 45 seconds — a screen that flickers on its own is worse than one that is
   * slightly stale.
   */
  const run = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) {
      setState({ data: null, error: null, isLoading: false })
      return
    }

    const id = ++requestId.current
    if (!silent) {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
    }

    try {
      const data = await fetcher()
      if (!mounted.current || id !== requestId.current) return
      setState({ data, error: null, isLoading: false })
    } catch (error) {
      if (!mounted.current || id !== requestId.current) return
      console.error('[query] failed', error)
      /* A failed background poll keeps whatever is on screen. Replacing a
         working feed with an error because one refresh missed — on a site
         connection that drops constantly — would be the wrong trade. */
      if (silent) return
      setState({
        data: null,
        error: error?.message ?? 'Something went wrong loading this data.',
        isLoading: false,
      })
    }
    // Two suppressions, both deliberate:
    //
    // `fetcher` is excluded because callers pass inline arrow functions, which
    // are a new reference every render; `deps` is the declared cache key and
    // is what should drive a refetch.
    //
    // The spread is what `react-hooks/use-memo` objects to — it cannot verify
    // a dependency list it has to evaluate. Spreading a caller-supplied key
    // into the array is the whole design of this hook, and the alternative
    // (serialising deps to a string) would make object keys silently unequal.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, [enabled, ...deps])

  useEffect(() => {
    run()
  }, [run])

  /**
   * Background refresh, for PRD 5.2.6: "site feed updates appear in customer
   * view within 60 seconds of upload".
   *
   * Two things keep this from being wasteful. It only runs while the tab is
   * VISIBLE, so a dashboard left open in a background tab costs nothing; and
   * it fires immediately on becoming visible again, so returning to the tab
   * shows current data rather than whatever was there when you left.
   */
  const silentRun = useRef(run)
  /* Updated in an effect, not during render: writing a ref while rendering is
     the pattern React explicitly warns against, and the interval below only
     reads it after a render has committed anyway. */
  useEffect(() => {
    silentRun.current = run
  }, [run])

  useEffect(() => {
    if (!refreshMs || !enabled) return undefined

    const tick = () => {
      if (document.visibilityState === 'visible') {
        silentRun.current({ silent: true })
      }
    }

    const timer = setInterval(tick, refreshMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refreshMs, enabled])

  /* Wrapped so a call site can pass it straight to onClick without the click
     event arriving as the options argument. */
  const refetch = useCallback(() => run(), [run])

  return { ...state, refetch }
}
