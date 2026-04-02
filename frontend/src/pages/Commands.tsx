import { useState, useEffect } from 'react'
import { Terminal, RotateCcw, FolderOpen, Eye, Code2 } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import MarkdownView from '@/components/MarkdownView'
import CodeMirrorEditor from '@/components/CodeMirrorEditor'
import StatusBadge from '@/components/StatusBadge'
import ViewModeToggle from '@/components/ViewModeToggle'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { useQueryClient } from '@tanstack/react-query'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { UpdateCommand, RevealInFinder } from '@/lib/api'
import { useCommands } from '@/hooks/useCommands'
import { useKeyboardSave } from '@/hooks/useKeyboardSave'
import { relativeTime } from '@/lib/utils'
import type { commands, projects } from '../../wailsjs/go/models'
import type { Status } from '@/components/StatusBadge'

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
        <div className="ml-auto flex items-center gap-1">
          {command.filename.startsWith('cpad-') && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400/70 border border-blue-500/20">
              Claudepad
            </span>
          )}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            command.scope === 'project'
              ? 'bg-amber-500/15 text-amber-400/80'
              : 'bg-white/5 text-slate-600'
          }`}>
            {command.scope}
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function CommandDetail({
  command,
}: {
  command: commands.Command
}) {
  const queryClient = useQueryClient()
  const [editorContent, setEditorContent] = useState(command.content)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [viewMode, setViewMode] = useState<'edit' | 'rendered'>('edit')

  useEffect(() => {
    setEditorContent(command.content)
    setStatus({ kind: 'idle' })
  }, [command.path, command.content])

  async function handleSave() {
    setStatus({ kind: 'saving' })
    try {
      await UpdateCommand(command.path, editorContent)
      setStatus({ kind: 'saved' })
      queryClient.invalidateQueries({ queryKey: ['commands'] })
      setTimeout(() => setStatus({ kind: 'idle' }), 2000)
    } catch (err) {
      setStatus({ kind: 'error', msg: String(err) })
    }
  }

  const isDirty = editorContent !== command.content
  useKeyboardSave(handleSave, isDirty && viewMode === 'edit')

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-white/5 shrink-0 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-slate-100 leading-snug">{command.name}</h2>
          <p className="text-[12px] text-slate-600 mt-1 font-mono">{command.path}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            onClick={() => RevealInFinder(command.path)}
            title="Reveal in Finder"
            className="p-1.5 rounded-md transition-colors cursor-pointer text-slate-600 hover:text-slate-400 hover:bg-white/5"
          >
            <FolderOpen className="size-3.5" />
          </button>
          <div className="w-px h-4 bg-white/8 mx-0.5" />
          <ViewModeToggle
            modes={[
              { id: 'rendered', label: 'Preview', icon: Eye },
              { id: 'edit', label: 'Edit', icon: Code2 },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        </div>
      </div>
      {viewMode === 'rendered' ? (
        <MarkdownView
          content={editorContent}
          contentKey={command.path}
          className="flex-1 overflow-y-auto"
          innerClassName="px-6"
        />
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-3 p-6">
          <CodeMirrorEditor
            value={editorContent}
            onChange={setEditorContent}
            extensions={[markdown(), EditorView.lineWrapping]}
          />
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
      )}
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


// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommandsPage({
  activeProject,
}: {
  activeProject: projects.Project | null
}) {
  const projectPath = activeProject?.is_global ? '' : (activeProject?.real_path ?? '')
  const { data: commandList, isLoading, refetch } = useCommands(projectPath)
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
            onClick={() => refetch()}
            className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RotateCcw className="size-3" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!commandList || commandList.length === 0 ? (
            <EmptyState
              icon={Terminal}
              loading={isLoading}
              title="No commands found"
              description="Add .md files to ~/.claude/commands/"
            />
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
          <CommandDetail command={selected} />
        ) : (
          <NoSelection />
        )}
      </Panel>
    </PanelGroup>
  )
}
