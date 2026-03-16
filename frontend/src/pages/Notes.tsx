import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { StickyNote, RotateCcw, Pin, Archive, SlidersHorizontal, Pencil, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useQueryClient } from '@tanstack/react-query'
import { SetNoteTitle, SetNoteMeta, DeleteNote } from '@/lib/api'
import { useNotes } from '@/hooks/useNotes'
import { relativeTime } from '@/lib/utils'
import type { notes } from '../../wailsjs/go/models'
import type { Components } from 'react-markdown'
import SearchableContent from '@/components/SearchableContent'

// ── Helpers ──────────────────────────────────────────────────────────────────

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function readTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200))
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-[#161b27] border border-white/10 rounded-xl shadow-2xl w-80 p-6">
        <h3 className="text-[15px] font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-[13px] text-slate-400 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[13px] text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-md text-[13px] bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; msg: string }

function StatusBadge({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  if (status.kind === 'saving') return <span className="text-xs text-slate-500">Saving…</span>
  if (status.kind === 'saved') return <span className="text-xs text-emerald-400">Saved</span>
  return <span className="text-xs text-red-400">{status.msg}</span>
}

// ── List panel ────────────────────────────────────────────────────────────────

function NoteRow({ note, selected, onClick }: {
  note: notes.Note
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-white/4 transition-colors group relative
        ${note.archived ? 'opacity-70' : ''}
        ${selected
          ? 'bg-blue-500/10 border-l-2 border-l-blue-500/60 pl-3.5'
          : 'hover:bg-white/3 border-l-2 border-l-transparent'
        }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`flex-1 text-[15px] font-medium leading-snug truncate ${
          selected ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-200'
        }`}>
          {note.title}
        </div>
        {note.pinned && <Pin className="size-3 text-blue-400/70 shrink-0" />}
      </div>

      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-1 mb-1.5 flex-wrap">
          {note.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/6 text-slate-500 font-mono">
              {tag}
            </span>
          ))}
          {note.tags.length > 2 && (
            <span className="text-[10px] text-slate-600">+{note.tags.length - 2}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative group/date inline-block">
          <span className="text-[12px] text-slate-600">{relativeTime(note.modifiedAt)}</span>
          <span className="absolute bottom-full left-0 mb-1.5 px-2 py-1 rounded bg-[#0f1117] border border-white/10 text-[11px] text-slate-400 whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover/date:opacity-100 transition-opacity z-10">
            {absoluteTime(note.modifiedAt)}
          </span>
        </div>
        <span className="text-[12px] text-slate-700">·</span>
        <span className="text-[12px] text-slate-700">{note.wordCount}w</span>
      </div>
    </button>
  )
}

// ── Markdown components ───────────────────────────────────────────────────────

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-xl font-semibold text-slate-100 mb-3 mt-6 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[16px] font-semibold text-slate-100 mb-2 mt-5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[14px] font-semibold text-slate-200 mb-2 mt-4 first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="text-[13px] font-semibold text-slate-300 mb-1.5 mt-3 first:mt-0">{children}</h4>,
  p:  ({ children }) => <p className="text-[14px] text-slate-300 leading-relaxed mb-3">{children}</p>,
  code: ({ children, className }) => {
    const isBlock = !!className
    if (isBlock) return <code className="text-slate-300 text-sm font-mono">{children}</code>
    return <code className="bg-white/8 text-blue-300 px-1.5 py-0.5 rounded text-[12px] font-mono">{children}</code>
  },
  pre: ({ children }) => <pre className="bg-white/5 rounded-lg p-4 mb-3 overflow-x-auto">{children}</pre>,
  ul: ({ children }) => <ul className="text-slate-300 pl-5 mb-3 space-y-1 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="text-slate-300 pl-5 mb-3 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="text-[14px] leading-relaxed">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-white/15 pl-4 text-slate-500 italic mb-3">{children}</blockquote>,
  a: ({ children, href }) => <a href={href} className="text-blue-400 hover:text-blue-300 underline">{children}</a>,
  hr: () => <hr className="border-white/10 my-4" />,
  strong: ({ children }) => <strong className="text-slate-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
}

// ── Metadata popup ────────────────────────────────────────────────────────────

type MetaState = {
  tags: string[]
  pinned: boolean
  notes: string
  archived: boolean
}

function MetaPopup({ note, onClose }: {
  note: notes.Note
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [meta, setMeta] = useState<MetaState>({
    tags: note.tags ?? [],
    pinned: note.pinned,
    notes: note.notes,
    archived: note.archived,
  })
  const [saveStatus, setSaveStatus] = useState<Status>({ kind: 'idle' })
  const [tagInput, setTagInput] = useState('')
  const metaRef = useRef(meta)
  metaRef.current = meta
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  async function save(patch: Partial<MetaState>) {
    const next = { ...metaRef.current, ...patch }
    setMeta(next)
    metaRef.current = next
    setSaveStatus({ kind: 'saving' })
    try {
      await SetNoteMeta(note.path, {
        tags: next.tags,
        pinned: next.pinned,
        notes: next.notes,
        archived: next.archived,
      })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setSaveStatus({ kind: 'saved' })
      setTimeout(() => setSaveStatus({ kind: 'idle' }), 1500)
    } catch (err) {
      setSaveStatus({ kind: 'error', msg: String(err) })
    }
  }

  function handleNotesChange(value: string) {
    setMeta(m => ({ ...m, notes: value }))
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => save({ notes: value }), 400)
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag || meta.tags.includes(tag)) { setTagInput(''); return }
    save({ tags: [...meta.tags, tag] })
    setTagInput('')
  }

  const labelClass = "text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5 block"
  const inputClass = "w-full bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/40"

  return (
    <div
      ref={popupRef}
      className="absolute top-full right-0 mt-2 w-68 bg-[#161b27] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      {/* Stats row */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-[12px] text-slate-600">{note.wordCount}w · {readTime(note.wordCount)}m read</span>
        <StatusBadge status={saveStatus} />
      </div>

      <div className="divide-y divide-white/5">
        {/* Pinned toggle */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="size-3.5 text-slate-600" />
            <span className="text-[13px] text-slate-400">Pinned</span>
          </div>
          <button
            onClick={() => save({ pinned: !meta.pinned })}
            className={`relative w-8 h-5 rounded-full transition-colors shrink-0 ${
              meta.pinned ? 'bg-blue-500/60' : 'bg-white/10'
            }`}
          >
            <span className={`absolute left-0 top-[3px] size-3.5 rounded-full bg-white transition-transform ${
              meta.pinned ? 'translate-x-[15px]' : 'translate-x-[3px]'
            }`} />
          </button>
        </div>

        {/* Tags */}
        <div className="px-4 py-3">
          <label className={labelClass}>Tags</label>
          {meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {meta.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400 font-mono">
                  {tag}
                  <button
                    onClick={() => save({ tags: meta.tags.filter(t => t !== tag) })}
                    className="text-slate-600 hover:text-slate-300 leading-none"
                  >×</button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
            placeholder="Add tag…"
            className={inputClass}
          />
        </div>

        {/* Notes (private annotations) */}
        <div className="px-4 py-3">
          <label className={labelClass}>Notes</label>
          <textarea
            value={meta.notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Private annotations…"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function NoteDetail({ note, onDeleted }: { note: notes.Note; onDeleted: () => void }) {
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameStatus, setRenameStatus] = useState<Status>({ kind: 'idle' })
  const [showMeta, setShowMeta] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    setRenaming(false)
    setRenameStatus({ kind: 'idle' })
    setShowMeta(false)
    setShowDeleteModal(false)
  }, [note.path])

  async function handleRename() {
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenaming(false); return }
    setRenameStatus({ kind: 'saving' })
    try {
      await SetNoteTitle(note.path, trimmed)
      setRenaming(false)
      setRenameStatus({ kind: 'saved' })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setTimeout(() => setRenameStatus({ kind: 'idle' }), 2000)
    } catch (err) {
      setRenameStatus({ kind: 'error', msg: String(err) })
    }
  }

  async function handleDelete() {
    try {
      await DeleteNote(note.path)
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      onDeleted()
    } catch { /* ignore */ }
  }

  async function toggleArchive() {
    try {
      await SetNoteMeta(note.path, {
        tags: note.tags ?? [],
        pinned: note.pinned,
        notes: note.notes,
        archived: !note.archived,
      })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-white/5 shrink-0 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); else if (e.key === 'Escape') setRenaming(false) }}
              onBlur={handleRename}
              className="w-full text-[16px] font-semibold text-slate-100 bg-white/5 border border-blue-500/40 rounded px-2 py-0.5 outline-none focus:border-blue-500/70"
            />
          ) : (
            <>
              <div className="group/rename flex items-center gap-2 min-w-0">
                <h2
                  className="text-[16px] font-semibold text-slate-100 leading-snug truncate cursor-pointer"
                  onClick={() => { setRenameValue(note.title); setRenaming(true) }}
                >
                  {note.title}
                </h2>
                <button
                  onClick={() => { setRenameValue(note.title); setRenaming(true) }}
                  className="opacity-0 group-hover/rename:opacity-100 transition-opacity text-slate-600 hover:text-slate-400 shrink-0"
                  title="Rename"
                >
                  <Pencil className="size-3.5" />
                </button>
                <StatusBadge status={renameStatus} />
              </div>
              <p className="text-[11px] text-slate-600 font-mono mt-0.5 truncate">{note.filename}</p>
              {note.project && (
                <p className="text-[11px] text-slate-700 mt-0.5 truncate">{note.project}</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Delete */}
          <button
            onClick={() => setShowDeleteModal(true)}
            title="Delete note"
            className="p-1.5 rounded-md transition-colors cursor-pointer text-slate-600 hover:text-red-400 hover:bg-red-400/10"
          >
            <Trash2 className="size-3.5" />
          </button>

          {showDeleteModal && (
            <ConfirmModal
              title="Delete note"
              message={`"${note.title}" will be permanently deleted.`}
              onConfirm={handleDelete}
              onCancel={() => setShowDeleteModal(false)}
            />
          )}

          {/* Archive */}
          <button
            onClick={toggleArchive}
            title={note.archived ? 'Unarchive' : 'Archive'}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              note.archived
                ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                : 'text-slate-600 hover:text-slate-400 hover:bg-white/5'
            }`}
          >
            <Archive className="size-3.5" />
          </button>

          {/* Metadata */}
          <div className="relative">
            <button
              onClick={() => setShowMeta(m => !m)}
              title="Metadata"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                showMeta
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-slate-600 hover:text-slate-400 hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
            </button>
            {showMeta && (
              <MetaPopup
                note={note}
                onClose={() => setShowMeta(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <SearchableContent className="flex-1 overflow-y-auto" innerClassName="px-8 py-6" contentKey={note.path}>
        <ReactMarkdown components={markdownComponents}>{note.content}</ReactMarkdown>
      </SearchableContent>
    </div>
  )
}

function NoSelection() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <StickyNote className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">Select a note to view it</p>
    </div>
  )
}

function EmptyList({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
      <StickyNote className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">{loading ? 'Loading…' : 'No notes yet'}</p>
      {!loading && (
        <p className="text-[12px] text-slate-700">Use /cpad-save-note in Claude Code to save answers here</p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const { data: noteList, isLoading, refetch } = useNotes()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')

  const visibleNotes = (noteList ?? []).filter(n => {
    if (!showArchived && n.archived) return false
    if (search) {
      const q = search.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    }
    return true
  })

  const selected = (noteList ?? []).find(n => n.path === selectedPath) ?? null

  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      <Panel defaultSize="280px" minSize="180px" maxSize="60%" className="flex flex-col border-r border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[12px] font-semibold tracking-widest uppercase text-slate-500">Notes</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(s => !s)}
              className={`text-[11px] transition-colors cursor-pointer ${
                showArchived ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              Archived
            </button>
            <button onClick={() => refetch()} className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer" title="Refresh">
              <RotateCcw className="size-3" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-white/5 shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/40"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {visibleNotes.length === 0 ? (
            <EmptyList loading={isLoading} />
          ) : (
            visibleNotes.map(note => (
              <NoteRow
                key={note.path}
                note={note}
                selected={selectedPath === note.path}
                onClick={() => setSelectedPath(note.path)}
              />
            ))
          )}
        </div>
      </Panel>

      <PanelResizeHandle className="w-3 group flex items-stretch justify-center cursor-col-resize">
        <div className="w-px bg-white/5 group-hover:bg-blue-500/40 transition-colors" />
      </PanelResizeHandle>

      <Panel className="overflow-hidden">
        {selected
          ? <NoteDetail note={selected} onDeleted={() => setSelectedPath(null)} />
          : <NoSelection />
        }
      </Panel>
    </PanelGroup>
  )
}
