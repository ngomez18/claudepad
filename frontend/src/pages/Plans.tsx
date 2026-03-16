import { useState, useEffect, useRef } from 'react'
import { FileText, RotateCcw, Eye, Code2, Pencil, Pin, Archive, SlidersHorizontal, ChevronDown, Globe, FolderOpen, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useQueryClient } from '@tanstack/react-query'
import { SetPlanName, SetPlanMeta, RevealInFinder } from '@/lib/api'
import { usePlans } from '@/hooks/usePlans'
import { usePreservedPlans } from '@/hooks/usePreservedPlans'
import { useProjects } from '@/hooks/useProjects'
import { relativeTime } from '@/lib/utils'
import type { plans, projects } from '../../wailsjs/go/models'
import type { Components } from 'react-markdown'
import SearchableContent from '@/components/SearchableContent'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatName(filename: string): string {
  const spaced = filename.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function displayName(plan: plans.Plan): string {
  return plan.name || formatName(plan.filename)
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
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

// ── Status badge ──────────────────────────────────────────────────────────────

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; msg: string }

function StatusBadge({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  if (status.kind === 'saving') return <span className="text-xs text-slate-500">Saving…</span>
  if (status.kind === 'saved') return <span className="text-xs text-emerald-400">Saved</span>
  return <span className="text-xs text-red-400">{status.msg}</span>
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

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

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

// ── List panel ────────────────────────────────────────────────────────────────

function PlanRow({ plan, selected, onClick }: {
  plan: plans.Plan
  selected: boolean
  onClick: () => void
}) {
  const pct = plan.todoTotal > 0 ? (plan.todoDone / plan.todoTotal) * 100 : 0
  const allDone = plan.todoTotal > 0 && plan.todoDone === plan.todoTotal

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-white/4 transition-colors group relative
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

// ── Markdown components ───────────────────────────────────────────────────────

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-xl font-semibold text-slate-100 mb-3 mt-6 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[16px] font-semibold text-slate-100 mb-2 mt-5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[14px] font-semibold text-slate-200 mb-2 mt-4 first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="text-[13px] font-semibold text-slate-300 mb-1.5 mt-3 first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="text-[12px] font-semibold text-slate-400 mb-1 mt-3 first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="text-[12px] font-medium text-slate-500 mb-1 mt-2 first:mt-0">{children}</h6>,
  p:  ({ children }) => <p className="text-[14px] text-slate-300 leading-relaxed mb-3">{children}</p>,
  code: ({ children, className }) => {
    const isBlock = !!className
    if (isBlock) return <code className="text-slate-300 text-sm font-mono">{children}</code>
    return <code className="bg-white/8 text-blue-300 px-1.5 py-0.5 rounded text-[12px] font-mono">{children}</code>
  },
  pre: ({ children }) => <pre className="bg-white/5 rounded-lg p-4 mb-3 overflow-x-auto">{children}</pre>,
  ul: ({ children }) => <ul className="text-slate-300 pl-5 mb-3 space-y-1 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="text-slate-300 pl-5 mb-3 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => {
    const childArr = Array.isArray(children) ? children : [children]
    const firstChild = childArr[0]
    if (
      firstChild &&
      typeof firstChild === 'object' &&
      'type' in firstChild &&
      firstChild.type === 'input'
    ) {
      const checked = (firstChild as React.ReactElement<{ checked?: boolean }>).props.checked
      return (
        <li className="text-[14px] leading-relaxed list-none flex items-start gap-2 -ml-1">
          <span className={`mt-0.75 size-3.5 shrink-0 rounded-[3px] border flex items-center justify-center ${
            checked ? 'bg-blue-500/30 border-blue-500/50' : 'border-white/20'
          }`}>
            {checked && <span className="block size-1.25 rounded-[1px] bg-blue-400" />}
          </span>
          <span>{childArr.slice(1)}</span>
        </li>
      )
    }
    return <li className="text-[14px] leading-relaxed">{children}</li>
  },
  blockquote: ({ children }) => <blockquote className="border-l-2 border-white/15 pl-4 text-slate-500 italic mb-3">{children}</blockquote>,
  a: ({ children, href }) => <a href={href} className="text-blue-400 hover:text-blue-300 underline">{children}</a>,
  hr: () => <hr className="border-white/10 my-4" />,
  strong: ({ children }) => <strong className="text-slate-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
}

// ── Metadata popup ────────────────────────────────────────────────────────────

type MetaState = {
  pinned: boolean
  projectId: string
  tags: string[]
  notes: string
  archived: boolean
}

function MetaPopup({ plan, projectList, onClose }: {
  plan: plans.Plan
  projectList: projects.Project[] | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [meta, setMeta] = useState<MetaState>({
    pinned: plan.pinned,
    projectId: plan.projectId,
    tags: plan.tags ?? [],
    notes: plan.notes,
    archived: plan.archived,
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
      await SetPlanMeta(plan.path, {
        pinned: next.pinned,
        projectId: next.projectId,
        tags: next.tags,
        notes: next.notes,
        archived: next.archived,
      })
      queryClient.invalidateQueries({ queryKey: ['plans'] })
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

function PlanDetail({ plan, projectList }: {
  plan: plans.Plan
  projectList: projects.Project[] | null
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

        {/* Right: actions (shrink-0 keeps this from wrapping) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Reveal in Finder */}
          <button
            onClick={() => RevealInFinder(plan.path)}
            title="Reveal in Finder"
            className="p-1.5 rounded-md transition-colors cursor-pointer text-slate-600 hover:text-slate-400 hover:bg-white/5"
          >
            <FolderOpen className="size-3.5" />
          </button>

          {/* Archive */}
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
                plan={plan}
                projectList={projectList}
                onClose={() => setShowMeta(false)}
              />
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/8 mx-1" />

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white/4 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('rendered')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] transition-colors ${
                viewMode === 'rendered' ? 'bg-white/10 text-slate-200' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Eye className="size-3" />
              Rendered
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] transition-colors ${
                viewMode === 'raw' ? 'bg-white/10 text-slate-200' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Code2 className="size-3" />
              Raw
            </button>
          </div>
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
      <SearchableContent className="flex-1 overflow-y-auto" innerClassName="px-8 py-6" contentKey={plan.path}>
        {viewMode === 'rendered' ? (
          <ReactMarkdown components={markdownComponents}>{plan.content}</ReactMarkdown>
        ) : (
          <pre className="text-[14px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap wrap-break-word">
            {plan.content}
          </pre>
        )}
      </SearchableContent>
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

function EmptyList({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
      <FileText className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">{loading ? 'Loading…' : 'No plans yet'}</p>
      {!loading && (
        <p className="text-[12px] text-slate-700">Plans appear here when created in Claude Code</p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlansPage({
  projects: projectList,
}: {
  projects: projects.Project[] | null
}) {
  const { data: planList, isLoading, refetch } = usePlans()
  const { data: preservedPlans } = usePreservedPlans()
  const { data: fetchedProjects } = useProjects()
  const resolvedProjectList = projectList ?? fetchedProjects ?? null

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showPreserved, setShowPreserved] = useState(false)

  const visiblePlans = [
    ...(planList ? (showArchived ? planList : planList.filter(p => !p.archived)) : []),
    ...(showPreserved ? (preservedPlans ?? []) : []),
  ]

  const allPlans = [...(planList ?? []), ...(preservedPlans ?? [])]
  const selected = allPlans.find(p => p.path === selectedPath) ?? null

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
              onClick={() => setShowPreserved(s => !s)}
              className={`text-[11px] transition-colors cursor-pointer ${
                showPreserved ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              Preserved
            </button>
            <button onClick={() => refetch()} className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer" title="Refresh">
              <RotateCcw className="size-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visiblePlans.length === 0 ? (
            <EmptyList loading={isLoading} />
          ) : (
            visiblePlans.map(plan => (
              <PlanRow
                key={plan.path}
                plan={plan}
                selected={selectedPath === plan.path}
                onClick={() => setSelectedPath(plan.path)}
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
          ? <PlanDetail plan={selected} projectList={resolvedProjectList} />
          : <NoSelection />
        }
      </Panel>
    </PanelGroup>
  )
}
