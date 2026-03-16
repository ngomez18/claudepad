import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'

// ── DOM helpers ───────────────────────────────────────────────────────────────

function clearMarks(root: HTMLElement): void {
  root.querySelectorAll('mark.sh').forEach(m => {
    const parent = m.parentNode
    if (!parent) return
    parent.replaceChild(document.createTextNode(m.textContent ?? ''), m)
    parent.normalize()
  })
}

function applyMarks(root: HTMLElement, query: string): HTMLElement[] {
  if (!query) return []
  const lower = query.toLowerCase()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const ranges: Range[] = []

  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    let start = 0
    while (true) {
      const idx = text.toLowerCase().indexOf(lower, start)
      if (idx === -1) break
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + query.length)
      ranges.push(range)
      start = idx + query.length
    }
  }

  // Apply from end to start to preserve offsets
  const marks: HTMLElement[] = []
  for (let i = ranges.length - 1; i >= 0; i--) {
    try {
      const mark = document.createElement('mark')
      mark.className = 'sh'
      ranges[i].surroundContents(mark)
      marks.unshift(mark)
    } catch {
      // Skip ranges that span element boundaries
    }
  }
  return marks
}

function updateCurrent(marks: HTMLElement[], idx: number): void {
  marks.forEach(m => m.classList.remove('sh-current'))
  if (marks[idx]) {
    marks[idx].classList.add('sh-current')
    marks[idx].scrollIntoView({ block: 'nearest' })
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SearchableContentProps {
  className?: string
  innerClassName?: string
  contentKey: string
  children: React.ReactNode
}

export default function SearchableContent({
  className,
  innerClassName,
  contentKey,
  children,
}: SearchableContentProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [marks, setMarks] = useState<HTMLElement[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global Ctrl/Cmd+F listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // Only intercept if we're within our container
        if (containerRef.current) {
          e.preventDefault()
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function close() {
    setIsOpen(false)
    setQuery('')
    if (contentRef.current) clearMarks(contentRef.current)
    setMarks([])
    setCurrentIdx(0)
  }

  // Re-apply marks when query, isOpen, or contentKey changes
  useEffect(() => {
    if (!contentRef.current) return
    clearMarks(contentRef.current)
    if (!isOpen || !query) {
      setMarks([])
      setCurrentIdx(0)
      return
    }
    const newMarks = applyMarks(contentRef.current, query)
    setMarks(newMarks)
    setCurrentIdx(0)
  }, [query, isOpen, contentKey])

  // Scroll to current match
  useEffect(() => {
    if (marks.length > 0) {
      updateCurrent(marks, currentIdx)
    }
  }, [currentIdx, marks])

  const navigate = useCallback((delta: number) => {
    if (marks.length === 0) return
    setCurrentIdx(i => (i + delta + marks.length) % marks.length)
  }, [marks])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      close()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      navigate(e.shiftKey ? -1 : 1)
    }
  }

  return (
    <div ref={containerRef} className={className} tabIndex={-1} style={{ outline: 'none' }}>
      {/* Search bar — sticky inside scroll container */}
      {isOpen && (
        <div className="sticky top-0 z-50 bg-[#161b27]/95 backdrop-blur-sm border-b border-white/8 px-3 py-2 flex items-center gap-2">
          <Search className="size-3.5 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search…"
            className="flex-1 bg-transparent text-[13px] text-slate-300 placeholder-slate-600 outline-none"
          />
          {query && (
            <span className="text-[12px] text-slate-500 tabular-nums shrink-0">
              {marks.length === 0 ? '0 / 0' : `${currentIdx + 1} / ${marks.length}`}
            </span>
          )}
          <button
            onClick={() => navigate(-1)}
            disabled={marks.length === 0}
            className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
            title="Previous (Shift+Enter)"
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            onClick={() => navigate(1)}
            disabled={marks.length === 0}
            className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
            title="Next (Enter)"
          >
            <ChevronDown className="size-3.5" />
          </button>
          <button
            onClick={close}
            className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
            title="Close (Escape)"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div ref={contentRef} className={innerClassName}>
        {children}
      </div>
    </div>
  )
}
