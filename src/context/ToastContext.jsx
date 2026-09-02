import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

const ToastContext = createContext(null)

/**
 * Lightweight toast queue. Every action in the prototype that would hit a
 * backend instead raises a toast, so no click is a dead end.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (message, { tone = 'success', duration = 3200 } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((list) => [...list, { id, message, tone }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
      return id
    },
    [dismiss],
  )

  // Clear every pending timer if the provider unmounts.
  const timersRef = timers
  useEffect(() => {
    const map = timersRef.current
    return () => {
      map.forEach(clearTimeout)
      map.clear()
    }
  }, [timersRef])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[min(360px,calc(100vw-3rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-[10px] border bg-surface px-3.5 py-3 shadow-[var(--shadow-pop)]',
              t.tone === 'success' ? 'border-success/25' : 'border-line',
            )}
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="mt-px size-4 shrink-0 text-success" />
            ) : (
              <Info className="mt-px size-4 shrink-0 text-brand-600" />
            )}
            <p className="flex-1 text-[13px] leading-snug text-ink">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="focus-ring -m-1 rounded p-1 text-ink-4 transition hover:text-ink-2"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider')
  return ctx
}
