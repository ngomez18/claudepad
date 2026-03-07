import { useState, useEffect } from 'react'
import { Terminal, RotateCcw } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { UpdateCommand } from '../../wailsjs/go/main/App'
import type { commands } from '../../wailsjs/go/models'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Status badge ──────────────────────────────────────────────────────────────

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; msg: string }

function StatusBadge({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  if (status.kind === 'saving') return <span className="text-xs text-slate-500">Saving…</span>
  if (status.kind === 'saved') return <span className="text-xs text-emerald-400">Saved</span>
  return <span className="text-xs text-red-400">{status.msg}</span>
}

// ── List row ──────────────────────────────────────────────────────────────────

function CommandRow({
  command,
  selected,
  onClick,
}: {
  command: commands.Command
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
        {command.name}
      </div>
      {command.description && (
        <div className="text-[13px] text-slate-500 truncate mb-1">{command.description}</div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-slate-700">{command.filename}.md</span>
        <span className="text-[11px] text-slate-700">· {relativeTime(command.modifiedAt)}</span>
        <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${
          command.scope === 'project'
            ? 'bg-amber-500/15 text-amber-400/80'
            : 'bg-white/5 text-slate-600'
        }`}>
          {command.scope}
        </span>
      </div>
    </button>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function CommandDetail({
  command,
  onRefresh,
}: {
  command: commands.Command
  onRefresh: () => void
}) {
  const [editorContent, setEditorContent] = useState(command.content)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    setEditorContent(command.content)
    setStatus({ kind: 'idle' })
  }, [command.path, command.content])

  async function handleSave() {
    setStatus({ kind: 'saving' })
    try {
      await UpdateCommand(command.path, editorContent)
      setStatus({ kind: 'saved' })
      onRefresh()
      setTimeout(() => setStatus({ kind: 'idle' }), 2000)
    } catch (err) {
      setStatus({ kind: 'error', msg: String(err) })
    }
  }

  const isDirty = editorContent !== command.content

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-white/5 shrink-0">
        <h2 className="text-[16px] font-semibold text-slate-100 leading-snug">{command.name}</h2>
        <p className="text-[12px] text-slate-600 mt-1 font-mono">{command.path}</p>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3 p-6">
        <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/5">
          <CodeMirror
            value={editorContent}
            height="100%"
            extensions={[markdown()]}
            theme={oneDark}
            basicSetup={{ lineNumbers: true, bracketMatching: true }}
            onChange={setEditorContent}
            style={{ height: '100%' }}
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleSave}
            disabled={!isDirty || status.kind === 'saving'}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Save
          </button>
          <StatusBadge status={status} />
        </div>
      </div>
    </div>
  )
}

function NoSelection() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <Terminal className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">Select a command to edit it</p>
    </div>
  )
}

function EmptyList({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
      <Terminal className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">
        {loading ? 'Loading…' : 'No commands found'}
      </p>
      {!loading && (
        <p className="text-[12px] text-slate-700">
          Add <span className="font-mono">.md</span> files to <span className="font-mono">~/.claude/commands/</span>
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommandsPage({
  commands: commandList,
  onRefresh,
}: {
  commands: commands.Command[] | null
  onRefresh: () => void
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const selected = commandList?.find(c => c.path === selectedPath) ?? null

  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      <Panel defaultSize="280px" minSize="180px" maxSize="60%" className="flex flex-col border-r border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[12px] font-semibold tracking-widest uppercase text-slate-500">
            Commands
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
          {!commandList || commandList.length === 0 ? (
            <EmptyList loading={commandList === null} />
          ) : (
            commandList.map(cmd => (
              <CommandRow
                key={cmd.path}
                command={cmd}
                selected={selectedPath === cmd.path}
                onClick={() => setSelectedPath(cmd.path)}
              />
            ))
          )}
        </div>
      </Panel>

      <PanelResizeHandle className="w-3 group flex items-stretch justify-center cursor-col-resize">
        <div className="w-px bg-white/5 group-hover:bg-blue-500/40 transition-colors" />
      </PanelResizeHandle>

      <Panel className="overflow-hidden">
        {selected ? (
          <CommandDetail command={selected} onRefresh={onRefresh} />
        ) : (
          <NoSelection />
        )}
      </Panel>
    </PanelGroup>
  )
}
