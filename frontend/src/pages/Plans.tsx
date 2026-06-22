import { useState, useEffect, useRef } from 'react'
import { FileText, RotateCcw, Eye, Code2, Pencil, Pin, Archive, SlidersHorizontal, ChevronDown, ChevronRight, Globe, FolderOpen, Folder as FolderIcon, FolderPlus, Trash2, Check } from 'lucide-react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { SetPlanName, SetPlanMeta, RevealInFinder, GetPlanFolders, CreatePlanFolder, RenameFolder, SetFolderPinned, DeleteFolder } from '@/lib/api'
import { usePlans } from '@/hooks/usePlans'
import { usePreservedPlans } from '@/hooks/usePreservedPlans'
import { useProjects } from '@/hooks/useProjects'
import { relativeTime, absoluteTime } from '@/lib/utils'
import type { plans, projects, folders } from '../../wailsjs/go/models'
import MarkdownView from '@/components/MarkdownView'
import ConfirmModal from '@/components/ConfirmModal'
import StatusBadge from '@/components/StatusBadge'
import ViewModeToggle from '@/components/ViewModeToggle'
import EmptyState from '@/components/EmptyState'
import { useClickOutside } from '@/hooks/useClickOutside'
import type { Status } from '@/components/StatusBadge'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatName(filename: string): string {
  const spaced = filename.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function displayName(plan: plans.Plan): string {
  return plan.name || formatName(plan.filename)
}

function planStatus(plan: plans.Plan): { label: string; color: string } {
  if (plan.todoTotal === 0) return { label: 'No tasks', color: 'text-slate-600' }
  if (plan.todoDone === 0) return { label: 'Not started', color: 'text-slate-500' }
  if (plan.todoDone === plan.todoTotal) return { label: 'Complete', color: 'text-emerald-400' }
  return { label: 'In progress', color: 'text-blue-400' }
}

function readTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200))
}

// ── Project dropdown ──────────────────────────────────────────────────────────

function ProjectDropdown({ value, onChange, projectList }: {
  value: string
  onChange: (id: string) => void
  projectList: projects.Project[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = value ? projectList.find(p => p.id === value) : null

  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/8 hover:bg-white/8 transition-colors cursor-pointer outline-none text-left"
      >
        {active
          ? active.is_global
            ? <Globe className="size-3.5 shrink-0 text-slate-500" />
            : <FolderOpen className="size-3.5 shrink-0 text-slate-500" />
          : <FolderOpen className="size-3.5 shrink-0 text-slate-600" />
        }
        <span className="flex-1 text-[13px] text-slate-300 truncate">
          {active?.name ?? 'None'}
        </span>
        <ChevronDown className={`size-3.5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[60] rounded-lg border border-white/8 bg-[#1a2035] shadow-xl overflow-hidden">
          <button
            onClick={() => { onChange(''); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors cursor-pointer"
          >
            <FolderOpen className="size-3.5 shrink-0 text-slate-600" />
            <span className={`flex-1 text-[13px] truncate ${value === '' ? 'text-slate-100' : 'text-slate-400'}`}>None</span>
            {value === '' && <Check className="size-3 shrink-0 text-blue-400" />}
          </button>
          {projectList.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors cursor-pointer"
            >
              {p.is_global
                ? <Globe className="size-3.5 shrink-0 text-slate-500" />
                : <FolderOpen className="size-3.5 shrink-0 text-slate-500" />
              }
              <span className={`flex-1 text-[13px] truncate ${p.id === value ? 'text-slate-100' : 'text-slate-400'}`}>
                {p.name ?? p.real_path}
              </span>
              {p.id === value && <Check className="size-3 shrink-0 text-blue-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Plan row (draggable) ──────────────────────────────────────────────────────

function PlanRow({ plan, selected, onClick, onDragStart }: {
  plan: plans.Plan
  selected: boolean
  onClick: () => void
  onDragStart: (path: string) => void
}) {
  const pct = plan.todoTotal > 0 ? (plan.todoDone / plan.todoTotal) * 100 : 0
  const allDone = plan.todoTotal > 0 && plan.todoDone === plan.todoTotal

  return (
    <button
      draggable
      onDragStart={e => { e.dataTransfer.setData('planPath', plan.path); e.dataTransfer.effectAllowed = 'move'; onDragStart(plan.path) }}
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-white/4 transition-colors group relative cursor-grab active:cursor-grabbing
        ${plan.archived || plan.preserved ? 'opacity-70' : ''}
        ${selected
          ? plan.preserved
            ? 'bg-amber-500/8 border-l-2 border-l-amber-500/40 pl-3.5'
            : 'bg-blue-500/10 border-l-2 border-l-blue-500/60 pl-3.5'
          : 'hover:bg-white/3 border-l-2 border-l-transparent'
        }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {plan.preserved && <Archive className="size-3 text-amber-500/70 shrink-0" />}
        <div className={`flex-1 text-[15px] font-medium leading-snug truncate ${
          selected ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-200'
        }`}>
          {displayName(plan)}
        </div>
        {plan.pinned && <Pin className="size-3 text-blue-400/70 shrink-0" />}
      </div>

      {plan.tags && plan.tags.length > 0 && (
        <div className="flex gap-1 mb-1.5 flex-wrap">
          {plan.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/6 text-slate-500 font-mono">
              {tag}
            </span>
          ))}
          {plan.tags.length > 2 && (
            <span className="text-[10px] text-slate-600">+{plan.tags.length - 2}</span>
          )}
        </div>
      )}

      {plan.todoTotal > 0 && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 h-0.75 rounded-full bg-white/8 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allDone ? 'bg-emerald-500/70' : 'bg-blue-500/50'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-[11px] font-mono tabular-nums shrink-0 ${
            allDone ? 'text-emerald-500/70' : 'text-slate-600'
          }`}>
            {plan.todoDone}/{plan.todoTotal}
          </span>
        </div>
      )}

      <div className="relative group/date inline-block">
        <span className="text-[12px] text-slate-600">{relativeTime(plan.modifiedAt)}</span>
        <span className="absolute bottom-full left-0 mb-1.5 px-2 py-1 rounded bg-[#0f1117] border border-white/10 text-[11px] text-slate-400 whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover/date:opacity-100 transition-opacity z-10">
          {absoluteTime(plan.modifiedAt)}
        </span>
      </div>
    </button>
  )
}

// ── Folder section ────────────────────────────────────────────────────────────

function FolderSection({ folder, plans: folderPlans, collapsed, isDropTarget, onToggle, onDrop, onDragOver, onDragLeave, selectedPath, onPlanClick, onDragStart, onPin, onRename, onDelete }: {
  folder: folders.Folder | null
  plans: plans.Plan[]
  collapsed: boolean
  isDropTarget: boolean
  onToggle: () => void
  onDrop: (planPath: string) => void
  onDragOver: () => void
  onDragLeave: () => void
  selectedPath: string | null
  onPlanClick: (path: string) => void
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
      <div
        className={`flex items-center gap-2 px-3 py-2.5 group/folder border-b border-white/6 transition-colors ${
          isDropTarget ? 'bg-blue-500/15 border-b-blue-500/30' : 'hover:bg-white/4'
        }`}
        onDragOver={e => { e.preventDefault(); onDragOver() }}
        onDragLeave={onDragLeave}
        onDrop={e => { e.preventDefault(); const path = e.dataTransfer.getData('planPath'); if (path) onDrop(path) }}
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
          <span className="text-[11px] text-slate-600 ml-0.5 shrink-0">{folderPlans.length}</span>
        </button>

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

      {!collapsed && folderPlans.map(plan => (
        <PlanRow
          key={plan.path}
          plan={plan}
          selected={selectedPath === plan.path}
          onClick={() => onPlanClick(plan.path)}
          onDragStart={onDragStart}
        />
      ))}

      {showDeleteModal && (
        <ConfirmModal
          title="Delete folder"
          message={folderPlans.length > 0
            ? `"${name}" has ${folderPlans.length} plan${folderPlans.length !== 1 ? 's' : ''}. They will be moved to Uncategorized.`
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
  pinned: boolean
  projectId: string
  tags: string[]
  notes: string
  archived: boolean
  folderId: string
}

function MetaPopup({ plan, projectList, folderList, onClose }: {
  plan: plans.Plan
  projectList: projects.Project[] | null
  folderList: folders.Folder[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [meta, setMeta] = useState<MetaState>({
    pinned: plan.pinned,
    projectId: plan.projectId,
    tags: plan.tags ?? [],
    notes: plan.notes,
    archived: plan.archived,
    folderId: plan.folderId ?? '',
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
      await SetPlanMeta(plan.path, {
        pinned: next.pinned,
        projectId: next.projectId,
        tags: next.tags,
        notes: next.notes,
        archived: next.archived,
        folderId: next.folderId,
      })
      queryClient.invalidateQueries({ queryKey: ['plans'] })
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
      const folder = await CreatePlanFolder(name)
      queryClient.invalidateQueries({ queryKey: ['planFolders'] })
      setCreatingFolder(false)
      setNewFolderName('')
      save({ folderId: folder.id })
    } catch { /* ignore */ }
  }

  const status = planStatus(plan)
  const labelClass = "text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5 block"
  const inputClass = "w-full bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/40"

  return (
    <div
      ref={popupRef}
      className="absolute top-full right-0 mt-2 w-68 bg-[#161b27] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      {/* Stats row */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-medium ${status.color}`}>{status.label}</span>
          <span className="text-[12px] text-slate-600">· {plan.wordCount}w · {readTime(plan.wordCount)}m</span>
        </div>
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

        {/* Project */}
        {projectList && projectList.length > 0 && (
          <div className="px-4 py-3">
            <label className={labelClass}>Project</label>
            <ProjectDropdown
              value={meta.projectId}
              onChange={v => save({ projectId: v })}
              projectList={projectList}
            />
          </div>
        )}

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

        {/* Notes */}
        <div className="px-4 py-3">
          <label className={labelClass}>Notes</label>
          <textarea
            value={meta.notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Private notes…"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function PlanDetail({ plan, projectList, folderList }: {
  plan: plans.Plan
  projectList: projects.Project[] | null
  folderList: folders.Folder[]
}) {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered')
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameStatus, setRenameStatus] = useState<Status>({ kind: 'idle' })
  const [showMeta, setShowMeta] = useState(false)

  useEffect(() => {
    setRenaming(false)
    setRenameStatus({ kind: 'idle' })
    setShowMeta(false)
  }, [plan.path])

  async function handleRename() {
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenaming(false); return }
    setRenameStatus({ kind: 'saving' })
    try {
      await SetPlanName(plan.path, trimmed)
      setRenaming(false)
      setRenameStatus({ kind: 'saved' })
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setTimeout(() => setRenameStatus({ kind: 'idle' }), 2000)
    } catch (err) {
      setRenameStatus({ kind: 'error', msg: String(err) })
    }
  }

  async function toggleArchive() {
    try {
      await SetPlanMeta(plan.path, {
        pinned: plan.pinned,
        projectId: plan.projectId,
        tags: plan.tags ?? [],
        notes: plan.notes,
        archived: !plan.archived,
        folderId: plan.folderId ?? '',
      })
      queryClient.invalidateQueries({ queryKey: ['plans'] })
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-white/5 shrink-0 flex items-center justify-between gap-4">
        {/* Left: title */}
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
                  onClick={() => { setRenameValue(displayName(plan)); setRenaming(true) }}
                >
                  {displayName(plan)}
                </h2>
                <button
                  onClick={() => { setRenameValue(displayName(plan)); setRenaming(true) }}
                  className="opacity-0 group-hover/rename:opacity-100 transition-opacity text-slate-600 hover:text-slate-400 shrink-0"
                  title="Rename"
                >
                  <Pencil className="size-3.5" />
                </button>
                <StatusBadge status={renameStatus} />
              </div>
              <p className="text-[11px] text-slate-600 font-mono mt-0.5 truncate">{plan.filename}</p>
            </>
          )}
          {plan.todoTotal > 0 && (
            <p className="text-[12px] text-slate-600 mt-1">
              {plan.todoDone} of {plan.todoTotal} tasks complete
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => RevealInFinder(plan.path)}
            title="Reveal in Finder"
            className="p-1.5 rounded-md transition-colors cursor-pointer text-slate-600 hover:text-slate-400 hover:bg-white/5"
          >
            <FolderOpen className="size-3.5" />
          </button>

          <button
            onClick={toggleArchive}
            title={plan.archived ? 'Unarchive' : 'Archive'}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              plan.archived
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
                plan={plan}
                projectList={projectList}
                folderList={folderList}
                onClose={() => setShowMeta(false)}
              />
            )}
          </div>

          <div className="w-px h-5 bg-white/8 mx-1" />

          <ViewModeToggle
            modes={[
              { id: 'rendered', label: 'Rendered', icon: Eye },
              { id: 'raw', label: 'Raw', icon: Code2 },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        </div>
      </div>

      {/* Preserved notice */}
      {plan.preserved && (
        <div className="px-8 pt-4 shrink-0">
          <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-[13px] text-amber-400">
              Removed from Claude Code — Claudepad has a preserved copy.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === 'rendered' ? (
        <MarkdownView
          content={plan.content}
          contentKey={plan.path}
          className="flex-1 overflow-y-auto"
          innerClassName="px-8 py-6"
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <pre className="text-[14px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap wrap-break-word">
            {plan.content}
          </pre>
        </div>
      )}
    </div>
  )
}

function NoSelection() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <FileText className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">Select a plan to view it</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlansPage({
  projects: projectList,
  initialPlanSlug,
  onPlanSlugConsumed,
}: {
  projects: projects.Project[] | null
  initialPlanSlug?: string | null
  onPlanSlugConsumed?: () => void
}) {
  const queryClient = useQueryClient()
  const { data: planList, isLoading, refetch } = usePlans()
  const { data: preservedPlans } = usePreservedPlans()
  const { data: fetchedProjects } = useProjects()
  const { data: folderList = [] } = useQuery({ queryKey: ['planFolders'], queryFn: GetPlanFolders })
  const resolvedProjectList = projectList ?? fetchedProjects ?? null

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [seenFolderIds, setSeenFolderIds] = useState<Set<string>>(new Set())
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Collapse any folder that hasn't been seen before (default closed).
  useEffect(() => {
    if (!folderList) return
    const newIds = folderList.map(f => f.id).filter(id => !seenFolderIds.has(id))
    if (newIds.length === 0) return
    setCollapsed(prev => new Set([...prev, ...newIds]))
    setSeenFolderIds(prev => new Set([...prev, ...newIds]))
  }, [folderList])

  const allPlans = [...(planList ?? []), ...(preservedPlans ?? [])]

  useEffect(() => {
    if (!initialPlanSlug || allPlans.length === 0) return
    const match = allPlans.find(p => p.filename === initialPlanSlug)
    if (match) setSelectedPath(match.path)
    onPlanSlugConsumed?.()
  }, [initialPlanSlug, allPlans.length])

  const visiblePlans = allPlans.filter(p => showArchived || !p.archived)
  const selected = allPlans.find(p => p.path === selectedPath) ?? null

  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleDrop(planPath: string, folderId: string) {
    setDragOverId(null)
    const plan = allPlans.find(p => p.path === planPath)
    if (!plan || plan.folderId === folderId) return
    try {
      await SetPlanMeta(planPath, {
        pinned: plan.pinned,
        projectId: plan.projectId,
        tags: plan.tags ?? [],
        notes: plan.notes,
        archived: plan.archived,
        folderId,
      })
      queryClient.invalidateQueries({ queryKey: ['plans'] })
    } catch { /* ignore */ }
  }

  async function handlePin(id: string, pinned: boolean) {
    try {
      await SetFolderPinned(id, pinned)
      queryClient.invalidateQueries({ queryKey: ['planFolders'] })
    } catch { /* ignore */ }
  }

  async function handleRename(id: string, name: string) {
    try {
      await RenameFolder(id, name)
      queryClient.invalidateQueries({ queryKey: ['planFolders'] })
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await DeleteFolder(id)
      queryClient.invalidateQueries({ queryKey: ['planFolders'] })
      queryClient.invalidateQueries({ queryKey: ['plans'] })
    } catch { /* ignore */ }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) { setCreatingFolder(false); return }
    try {
      await CreatePlanFolder(name)
      queryClient.invalidateQueries({ queryKey: ['planFolders'] })
      setCreatingFolder(false)
      setNewFolderName('')
    } catch { /* ignore */ }
  }

  // Group plans by folder
  const plansByFolder = new Map<string, plans.Plan[]>()
  for (const plan of visiblePlans) {
    const key = plan.folderId ?? ''
    if (!plansByFolder.has(key)) plansByFolder.set(key, [])
    plansByFolder.get(key)!.push(plan)
  }
  const uncategorized = plansByFolder.get('') ?? []

  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      <Panel defaultSize="280px" minSize="180px" maxSize="60%" className="flex flex-col border-r border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[12px] font-semibold tracking-widest uppercase text-slate-500">Plans</span>
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

        <div className="flex-1 overflow-y-auto">
          {visiblePlans.length === 0 && folderList.length === 0 ? (
            <EmptyState
              icon={FileText}
              loading={isLoading}
              title="No plans yet"
              description="Plans appear here when created in Claude Code"
            />
          ) : folderList.length > 0 || uncategorized.length > 0 ? (
            <>
              {folderList.map(folder => (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  plans={plansByFolder.get(folder.id) ?? []}
                  collapsed={collapsed.has(folder.id)}
                  isDropTarget={dragOverId === folder.id}
                  onToggle={() => toggleCollapse(folder.id)}
                  onDrop={planPath => handleDrop(planPath, folder.id)}
                  onDragOver={() => setDragOverId(folder.id)}
                  onDragLeave={() => setDragOverId(null)}
                  selectedPath={selectedPath}
                  onPlanClick={setSelectedPath}
                  onDragStart={() => {}}
                  onPin={pinned => handlePin(folder.id, pinned)}
                  onRename={name => handleRename(folder.id, name)}
                  onDelete={() => handleDelete(folder.id)}
                />
              ))}
              {(uncategorized.length > 0 || dragOverId === '__uncategorized__') && (
                <FolderSection
                  key="__uncategorized__"
                  folder={null}
                  plans={uncategorized}
                  collapsed={collapsed.has('__uncategorized__')}
                  isDropTarget={dragOverId === '__uncategorized__'}
                  onToggle={() => toggleCollapse('__uncategorized__')}
                  onDrop={planPath => handleDrop(planPath, '')}
                  onDragOver={() => setDragOverId('__uncategorized__')}
                  onDragLeave={() => setDragOverId(null)}
                  selectedPath={selectedPath}
                  onPlanClick={setSelectedPath}
                  onDragStart={() => {}}
                />
              )}
            </>
          ) : (
            visiblePlans.map(plan => (
              <PlanRow
                key={plan.path}
                plan={plan}
                selected={selectedPath === plan.path}
                onClick={() => setSelectedPath(plan.path)}
                onDragStart={() => {}}
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
          ? <PlanDetail plan={selected} projectList={resolvedProjectList} folderList={folderList} />
          : <NoSelection />
        }
      </Panel>
    </PanelGroup>
  )
}
