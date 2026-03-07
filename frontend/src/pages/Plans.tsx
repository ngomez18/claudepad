import { useState } from 'react'
import { FileText, RotateCcw, Eye, Code2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import type { plans } from '../../wailsjs/go/models'
import type { Components } from 'react-markdown'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatName(filename: string): string {
  const spaced = filename.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 30)  return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── List panel ────────────────────────────────────────────────────────────────

function PlanRow({
  plan,
  selected,
  onClick,
}: {
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
        ${selected
          ? 'bg-blue-500/10 border-l-2 border-l-blue-500/60 pl-3.5'
          : 'hover:bg-white/3 border-l-2 border-l-transparent'
        }`}
    >
      {/* Name */}
      <div className={`text-[15px] font-medium leading-snug truncate mb-1 ${
        selected ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-200'
      }`}>
        {formatName(plan.filename)}
      </div>

      {/* Todo progress */}
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

      {/* Modified date */}
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
    // Detect task list items by inspecting children for checkbox input
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

// ── Detail panel ──────────────────────────────────────────────────────────────

function PlanDetail({ plan }: { plan: plans.Plan }) {
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-white/5 shrink-0 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-100 leading-snug">
            {formatName(plan.filename)}
          </h2>
          {plan.todoTotal > 0 && (
            <p className="text-[12px] text-slate-600 mt-1">
              {plan.todoDone} of {plan.todoTotal} tasks complete
            </p>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-white/4 rounded-md p-0.5 shrink-0">
          <button
            onClick={() => setViewMode('rendered')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] transition-colors ${
              viewMode === 'rendered'
                ? 'bg-white/10 text-slate-200'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <Eye className="size-3" />
            Rendered
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] transition-colors ${
              viewMode === 'raw'
                ? 'bg-white/10 text-slate-200'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <Code2 className="size-3" />
            Raw
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          {viewMode === 'rendered' ? (
            <ReactMarkdown components={markdownComponents}>
              {plan.content}
            </ReactMarkdown>
          ) : (
            <pre className="text-[14px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap wrap-break-word">
              {plan.content}
            </pre>
          )}
        </div>
      </div>
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

// ── Empty / loading states ────────────────────────────────────────────────────

function EmptyList({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
      <FileText className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">
        {loading ? 'Loading…' : 'No plans yet'}
      </p>
      {!loading && (
        <p className="text-[12px] text-slate-700">
          Plans appear here when created in Claude Code
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlansPage({
  plans: planList,
  onRefresh,
}: {
  plans: plans.Plan[] | null
  onRefresh: () => void
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const selected = planList?.find(p => p.path === selectedPath) ?? null

  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      {/* List panel */}
      <Panel defaultSize="280px" minSize="180px" maxSize="60%" className="flex flex-col border-r border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[12px] font-semibold tracking-widest uppercase text-slate-500">
            Plans
          </span>
          <button
            onClick={onRefresh}
            className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RotateCcw className="size-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!planList || planList.length === 0 ? (
            <EmptyList loading={planList === null} />
          ) : (
            planList.map(plan => (
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

      {/* Detail panel */}
      <Panel className="overflow-hidden">
        {selected ? <PlanDetail plan={selected} /> : <NoSelection />}
      </Panel>
    </PanelGroup>
  )
}
