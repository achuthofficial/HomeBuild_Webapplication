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
 *
 * `fetcher` must be stable or memoised — it is invoked whenever `deps` change.
 */
export function useQuery(fetcher, deps = [], { enabled = true } = {}) {
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

  const run = useCallback(async () => {
    if (!enabled) {
      setState({ data: null, error: null, isLoading: false })
      return
    }

    const id = ++requestId.current
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const data = await fetcher()
      if (!mounted.current || id !== requestId.current) return
      setState({ data, error: null, isLoading: false })
    } catch (error) {
      if (!mounted.current || id !== requestId.current) return
      console.error('[query] failed', error)
      setState({
        data: null,
        error: error?.message ?? 'Something went wrong loading this data.',
        isLoading: false,
      })
    }
    // fetcher is intentionally excluded: callers pass inline arrow functions,
    // and `deps` is the declared cache key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  useEffect(() => {
    run()
  }, [run])

  return { ...state, refetch: run }
}
