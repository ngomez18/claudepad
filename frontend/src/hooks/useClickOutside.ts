import { type RefObject, useEffect } from 'react'

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handler()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, handler, enabled])
}
