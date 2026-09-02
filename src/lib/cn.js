/**
 * Tiny classname joiner. Filters out falsy values so conditional classes read
 * cleanly at the call site: cn('base', isActive && 'active').
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
