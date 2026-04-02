import { useState, useEffect, useRef } from 'react'
import {
  StickyNote, RotateCcw, Pin, Archive, SlidersHorizontal, Pencil, Trash2,
  ChevronRight, ChevronDown, FolderPlus, FolderOpen, Folder as FolderIcon,
} from 'lucide-react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { SetNoteTitle, SetNoteMeta, DeleteNote, GetNoteFolders, CreateNoteFolder, RenameFolder, SetFolderPinned, DeleteFolder } from '@/lib/api'
import { useNotes } from '@/hooks/useNotes'
import { relativeTime, absoluteTime } from '@/lib/utils'
import type { notes, folders } from '../../wailsjs/go/models'
import MarkdownView from '@/components/MarkdownView'
import ConfirmModal from '@/components/ConfirmModal'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import { useClickOutside } from '@/hooks/useClickOutside'
import type { Status } from '@/components/StatusBadge'

// ── Helpers ──────────────────────────────────────────────────────────────────

function readTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200))
}

// ── Note row (draggable) ──────────────────────────────────────────────────────

function NoteRow({ note, selected, onClick, onDragStart }: {
  note: notes.Note
  selected: boolean
  onClick: () => void
  onDragStart: (path: string) => void
}) {
  return (
    <button
      draggable
      onDragStart={e => { e.dataTransfer.setData('notePath', note.path); e.dataTransfer.effectAllowed = 'move'; onDragStart(note.path) }}
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-white/4 transition-colors group relative cursor-grab active:cursor-grabbing
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

// ── Folder section ────────────────────────────────────────────────────────────

function FolderSection({ folder, notes: folderNotes, collapsed, isDropTarget, onToggle, onDrop, onDragOver, onDragLeave, selectedPath, onNoteClick, onDragStart, onPin, onRename, onDelete }: {
  folder: folders.Folder | null  // null = Uncategorized
  notes: notes.Note[]
  collapsed: boolean
  isDropTarget: boolean
  onToggle: () => void
  onDrop: (notePath: string) => void
  onDragOver: () => void
  onDragLeave: () => void
  selectedPath: string | null
  onNoteClick: (path: string) => void
  onDragStart: (path: string) => void
  onPin?: (pinned: boolean) => void
  onRename?: (name: string) => void
  onDelete?: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const isUncategorized = folder === null
  const name = folder?.name ?? 'Uncategorized'

  function handleRenameSubmit() {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== name) onRename?.(trimmed)
    setRenaming(false)
  }

  return (
    <div>
      {/* Folder header */}
      <div
        className={`flex items-center gap-2 px-3 py-2.5 group/folder border-b border-white/6 transition-colors ${
          isDropTarget ? 'bg-blue-500/15 border-b-blue-500/30' : 'hover:bg-white/4'
        }`}
        onDragOver={e => { e.preventDefault(); onDragOver() }}
        onDragLeave={onDragLeave}
        onDrop={e => { e.preventDefault(); const path = e.dataTransfer.getData('notePath'); if (path) onDrop(path) }}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {collapsed
            ? <ChevronRight className="size-3.5 text-slate-600 shrink-0" />
            : <ChevronDown className="size-3.5 text-slate-500 shrink-0" />
          }
          {isUncategorized
            ? <FolderIcon className="size-4 text-slate-600 shrink-0" />
            : (isDropTarget
              ? <FolderOpen className={`size-4 shrink-0 ${folder?.pinned ? 'text-blue-400' : 'text-slate-400'}`} />
              : <FolderIcon className={`size-4 shrink-0 ${folder?.pinned ? 'text-blue-400' : 'text-slate-500'}`} />
            )
          }
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); else if (e.key === 'Escape') setRenaming(false) }}
              onBlur={handleRenameSubmit}
              onClick={e => e.stopPropagation()}
              className="flex-1 min-w-0 text-[13px] font-semibold text-slate-200 bg-white/5 border border-blue-500/40 rounded px-1.5 outline-none"
            />
          ) : (
            <span className={`text-[13px] font-semibold truncate ${isUncategorized ? 'text-slate-600' : 'text-slate-400'}`}>
              {name}
            </span>
          )}
          <span className="text-[11px] text-slate-600 ml-0.5 shrink-0">{folderNotes.length}</span>
        </button>

        {/* Controls (only for named folders) */}
        {!isUncategorized && !renaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity">
            <button
              onClick={() => onPin?.(!folder?.pinned)}
              className={`p-1 rounded transition-colors ${folder?.pinned ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
              title={folder?.pinned ? 'Unpin folder' : 'Pin folder'}
            >
              <Pin className="size-3.5" />
            </button>
            <button
              onClick={() => { setRenameValue(name); setRenaming(true) }}
              className="p-1 rounded text-slate-600 hover:text-slate-400 transition-colors"
              title="Rename folder"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
              title="Delete folder"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Notes in folder */}
      {!collapsed && folderNotes.map(note => (
        <NoteRow
          key={note.path}
          note={note}
          selected={selectedPath === note.path}
          onClick={() => onNoteClick(note.path)}
          onDragStart={onDragStart}
        />
      ))}

      {showDeleteModal && (
        <ConfirmModal
          title="Delete folder"
          message={folderNotes.length > 0
            ? `"${name}" has ${folderNotes.length} note${folderNotes.length !== 1 ? 's' : ''}. They will be moved to Uncategorized.`
            : `Delete "${name}"?`
          }
          confirmLabel="Delete"
          onConfirm={() => { onDelete?.(); setShowDeleteModal(false) }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}

// ── Metadata popup ────────────────────────────────────────────────────────────

type MetaState = {
  tags: string[]
  pinned: boolean
  notes: string
  archived: boolean
  folderId: string
}

function MetaPopup({ note, folderList, onClose }: {
  note: notes.Note
  folderList: folders.Folder[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [meta, setMeta] = useState<MetaState>({
    tags: note.tags ?? [],
    pinned: note.pinned,
    notes: note.notes,
    archived: note.archived,
    folderId: note.folderId ?? '',
  })
  const [saveStatus, setSaveStatus] = useState<Status>({ kind: 'idle' })
  const [tagInput, setTagInput] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const metaRef = useRef(meta)
  metaRef.current = meta
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useClickOutside(popupRef, onClose)

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
        folderId: next.folderId,
      })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setSaveStatus({ kind: 'saved' })
      setTimeout(() => setSaveStatus({ kind: 'idle' }), 2000)
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

  async function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) { setCreatingFolder(false); return }
    try {
      const folder = await CreateNoteFolder(name)
      queryClient.invalidateQueries({ queryKey: ['noteFolders'] })
      setCreatingFolder(false)
      setNewFolderName('')
      save({ folderId: folder.id })
    } catch { /* ignore */ }
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

        {/* Folder */}
        <div className="px-4 py-3">
          <label className={labelClass}>Folder</label>
          <div className="flex gap-1.5">
            <select
              value={meta.folderId}
              onChange={e => save({ folderId: e.target.value })}
              className={`${inputClass} flex-1 appearance-none`}
            >
              <option value="">No folder</option>
              {folderList.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button
              onClick={() => setCreatingFolder(true)}
              className="p-1.5 rounded-md bg-white/5 border border-white/8 text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors shrink-0"
              title="New folder"
            >
              <FolderPlus className="size-3.5" />
            </button>
          </div>
          {creatingFolder && (
            <div className="mt-1.5 flex gap-1.5">
              <input
                autoFocus
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); else if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName('') } }}
                placeholder="Folder name…"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={handleCreateFolder}
                className="px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-[12px] text-blue-400 hover:bg-blue-500/30 transition-colors shrink-0"
              >
                Create
              </button>
            </div>
          )}
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

function NoteDetail({ note, folderList, onDeleted }: { note: notes.Note; folderList: folders.Folder[]; onDeleted: () => void }) {
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
        folderId: note.folderId ?? '',
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
              {note.folderName && (
                <p className="text-[11px] text-slate-700 mt-0.5 truncate flex items-center gap-1">
                  <FolderIcon className="size-3 inline shrink-0" />
                  {note.folderName}
                </p>
              )}
              {note.project && (
                <p className="text-[11px] text-slate-700 mt-0.5 truncate">{note.project}</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
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
                folderList={folderList}
                onClose={() => setShowMeta(false)}
              />
            )}
          </div>
        </div>
      </div>

      <MarkdownView
        content={note.content}
        contentKey={note.path}
        className="flex-1 overflow-y-auto"
        innerClassName="px-8 py-6"
      />
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const queryClient = useQueryClient()
  const { data: noteList, isLoading, refetch } = useNotes()
  const { data: folderList = [] } = useQuery({ queryKey: ['noteFolders'], queryFn: GetNoteFolders })

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragOverId, setDragOverId] = useState<string | null>(null) // folder id or '__uncategorized__'
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const visibleNotes = (noteList ?? []).filter(n => {
    if (!showArchived && n.archived) return false
    if (search) {
      const q = search.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    }
    return true
  })

  const selected = (noteList ?? []).find(n => n.path === selectedPath) ?? null

  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleDrop(notePath: string, folderId: string) {
    setDragOverId(null)
    const note = (noteList ?? []).find(n => n.path === notePath)
    if (!note || note.folderId === folderId) return
    try {
      await SetNoteMeta(notePath, {
        tags: note.tags ?? [],
        pinned: note.pinned,
        notes: note.notes,
        archived: note.archived,
        folderId,
      })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    } catch { /* ignore */ }
  }

  async function handlePin(id: string, pinned: boolean) {
    try {
      await SetFolderPinned(id, pinned)
      queryClient.invalidateQueries({ queryKey: ['noteFolders'] })
    } catch { /* ignore */ }
  }

  async function handleRename(id: string, name: string) {
    try {
      await RenameFolder(id, name)
      queryClient.invalidateQueries({ queryKey: ['noteFolders'] })
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await DeleteFolder(id)
      queryClient.invalidateQueries({ queryKey: ['noteFolders'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    } catch { /* ignore */ }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) { setCreatingFolder(false); return }
    try {
      await CreateNoteFolder(name)
      queryClient.invalidateQueries({ queryKey: ['noteFolders'] })
      setCreatingFolder(false)
      setNewFolderName('')
    } catch { /* ignore */ }
  }

  // Group notes by folder for non-search view
  const notesByFolder = new Map<string, notes.Note[]>()
  for (const note of visibleNotes) {
    const key = note.folderId ?? ''
    if (!notesByFolder.has(key)) notesByFolder.set(key, [])
    notesByFolder.get(key)!.push(note)
  }
  const uncategorized = notesByFolder.get('') ?? []

  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      <Panel defaultSize="280px" minSize="180px" maxSize="60%" className="flex flex-col border-r border-white/5 overflow-hidden">
        {/* Header */}
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
            <button
              onClick={() => setCreatingFolder(c => !c)}
              className={`transition-colors cursor-pointer ${creatingFolder ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
              title="New folder"
            >
              <FolderPlus className="size-3" />
            </button>
            <button onClick={() => refetch()} className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer" title="Refresh">
              <RotateCcw className="size-3" />
            </button>
          </div>
        </div>

        {/* New folder inline input */}
        {creatingFolder && (
          <div className="px-3 py-2 border-b border-white/5 shrink-0 flex gap-1.5">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); else if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName('') } }}
              placeholder="Folder name…"
              className="flex-1 bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/40"
            />
            <button
              onClick={handleCreateFolder}
              className="px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-[12px] text-blue-400 hover:bg-blue-500/30 transition-colors shrink-0"
            >
              Create
            </button>
          </div>
        )}

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

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {visibleNotes.length === 0 && folderList.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              loading={isLoading}
              title="No notes yet"
              description="Use /cpad-save-note in Claude Code to save answers here"
            />
          ) : search ? (
            // Flat list when searching
            visibleNotes.length === 0 ? (
              <div className="flex items-center justify-center h-16">
                <p className="text-[13px] text-slate-600">No results</p>
              </div>
            ) : (
              visibleNotes.map(note => (
                <NoteRow
                  key={note.path}
                  note={note}
                  selected={selectedPath === note.path}
                  onClick={() => setSelectedPath(note.path)}
                  onDragStart={() => {}}
                />
              ))
            )
          ) : (
            // Grouped by folder
            <>
              {folderList.map(folder => (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  notes={notesByFolder.get(folder.id) ?? []}
                  collapsed={collapsed.has(folder.id)}
                  isDropTarget={dragOverId === folder.id}
                  onToggle={() => toggleCollapse(folder.id)}
                  onDrop={notePath => handleDrop(notePath, folder.id)}
                  onDragOver={() => setDragOverId(folder.id)}
                  onDragLeave={() => setDragOverId(null)}
                  selectedPath={selectedPath}
                  onNoteClick={setSelectedPath}
                  onDragStart={() => {}}
                  onPin={pinned => handlePin(folder.id, pinned)}
                  onRename={name => handleRename(folder.id, name)}
                  onDelete={() => handleDelete(folder.id)}
                />
              ))}
              {/* Uncategorized — always shown if it has notes or as a drop target */}
              {(uncategorized.length > 0 || dragOverId === '__uncategorized__') && (
                <FolderSection
                  key="__uncategorized__"
                  folder={null}
                  notes={uncategorized}
                  collapsed={collapsed.has('__uncategorized__')}
                  isDropTarget={dragOverId === '__uncategorized__'}
                  onToggle={() => toggleCollapse('__uncategorized__')}
                  onDrop={notePath => handleDrop(notePath, '')}
                  onDragOver={() => setDragOverId('__uncategorized__')}
                  onDragLeave={() => setDragOverId(null)}
                  selectedPath={selectedPath}
                  onNoteClick={setSelectedPath}
                  onDragStart={() => {}}
                />
              )}
              {/* Show flat list only if no folders and no uncategorized notes */}
              {folderList.length === 0 && uncategorized.length === 0 && !isLoading && (
                <EmptyState
                  icon={StickyNote}
                  loading={false}
                  title="No notes yet"
                  description="Use /cpad-save-note in Claude Code to save answers here"
                />
              )}
            </>
          )}
        </div>
      </Panel>

      <PanelResizeHandle className="w-3 group flex items-stretch justify-center cursor-col-resize">
        <div className="w-px bg-white/5 group-hover:bg-blue-500/40 transition-colors" />
      </PanelResizeHandle>

      <Panel className="overflow-hidden">
        {selected
          ? <NoteDetail note={selected} folderList={folderList} onDeleted={() => setSelectedPath(null)} />
          : <NoSelection />
        }
      </Panel>
    </PanelGroup>
  )
}
