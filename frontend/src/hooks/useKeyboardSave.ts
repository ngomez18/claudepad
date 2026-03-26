import { useEffect, useRef } from 'react'

/**
 * Triggers onSave when Cmd+S (or Ctrl+S) is pressed.
 * enabled can be used to gate the shortcut (e.g. only when isDirty).
 */
export function useKeyboardSave(onSave: () => void, enabled = true) {
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    if (!enabled) return
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSaveRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled])
}
