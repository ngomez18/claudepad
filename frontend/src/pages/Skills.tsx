import { useState } from 'react'
import { Brain, RotateCcw } from 'lucide-react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import type { skills } from '../../wailsjs/go/models'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  if (!iso) return ''
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

// ── List row ──────────────────────────────────────────────────────────────────

function SkillRow({
  skill,
  selected,
  onClick,
}: {
  skill: skills.Skill
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-white/4 transition-colors group relative
        ${selected
          ? 'bg-blue-500/10 border-l-2 border-l-blue-500/60 pl-3.5'
          : 'hover:bg-white/3 border-l-2 border-l-transparent'
        }`}
    >
      <div className={`text-[15px] font-medium leading-snug truncate mb-0.5 ${
        selected ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-200'
      }`}>
        {skill.name}
      </div>
      {skill.description && (
        <div className="text-[13px] text-slate-500 truncate mb-1">{skill.description}</div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-slate-700">{skill.dirName}</span>
        {skill.modifiedAt && (
          <span className="text-[11px] text-slate-700">· {relativeTime(skill.modifiedAt)}</span>
        )}
        <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${
          skill.scope === 'project'
            ? 'bg-amber-500/15 text-amber-400/80'
            : 'bg-white/5 text-slate-600'
        }`}>
          {skill.scope}
        </span>
      </div>
    </button>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function SkillDetail({ skill }: { skill: skills.Skill }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-white/5 shrink-0">
        <h2 className="text-[16px] font-semibold text-slate-100 leading-snug">{skill.name}</h2>
        <p className="text-[12px] text-slate-600 mt-1 font-mono">{skill.path}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          {skill.content ? (
            <pre className="text-[14px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap wrap-break-word">
              {skill.content}
            </pre>
          ) : (
            <p className="text-sm text-slate-600">No SKILL.md found in this directory.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function NoSelection() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <Brain className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">Select a skill to view it</p>
    </div>
  )
}

function EmptyList({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
      <Brain className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">
        {loading ? 'Loading…' : 'No skills found'}
      </p>
      {!loading && (
        <p className="text-[12px] text-slate-700">
          Add skills to <span className="font-mono">~/.claude/skills/</span>
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SkillsPage({
  skills: skillList,
  onRefresh,
}: {
  skills: skills.Skill[] | null
  onRefresh: () => void
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const selected = skillList?.find(s => s.path === selectedPath) ?? null

  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      <Panel defaultSize="280px" minSize="180px" maxSize="60%" className="flex flex-col border-r border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[12px] font-semibold tracking-widest uppercase text-slate-500">
            Skills
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
          {!skillList || skillList.length === 0 ? (
            <EmptyList loading={skillList === null} />
          ) : (
            skillList.map(skill => (
              <SkillRow
                key={skill.path}
                skill={skill}
                selected={selectedPath === skill.path}
                onClick={() => setSelectedPath(skill.path)}
              />
            ))
          )}
        </div>
      </Panel>

      <PanelResizeHandle className="w-3 group flex items-stretch justify-center cursor-col-resize">
        <div className="w-px bg-white/5 group-hover:bg-blue-500/40 transition-colors" />
      </PanelResizeHandle>

      <Panel className="overflow-hidden">
        {selected ? <SkillDetail skill={selected} /> : <NoSelection />}
      </Panel>
    </PanelGroup>
  )
}
