import { useState, useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { UpdateSettings, RevealInFinder } from '@/lib/api'
import { useSettings } from '@/hooks/useSettings'
import type { settings } from '../../wailsjs/go/models'
import type { projects } from '../../wailsjs/go/models'

// ── Status badge ──────────────────────────────────────────────────────────────

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; msg: string }

function StatusBadge({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  if (status.kind === 'saving') return <span className="text-xs text-slate-500">Saving…</span>
  if (status.kind === 'saved') return <span className="text-xs text-emerald-400">Saved</span>
  return <span className="text-xs text-red-400">{status.msg}</span>
}

// ── Editor panel ──────────────────────────────────────────────────────────────

function EditorPanel({ file }: { file: settings.SettingsFile }) {
  const [editorContent, setEditorContent] = useState(file.content)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  // Reset editor when switching layers
  useEffect(() => {
    setEditorContent(file.content)
    setStatus({ kind: 'idle' })
  }, [file.path, file.content])

  async function handleSave() {
    setStatus({ kind: 'saving' })
    try {
      await UpdateSettings(file.path, editorContent)
      setStatus({ kind: 'saved' })
      setTimeout(() => setStatus({ kind: 'idle' }), 2000)
    } catch (err) {
      setStatus({ kind: 'error', msg: String(err) })
    }
  }

  const isDirty = editorContent !== file.content

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {!file.exists && (
        <p className="text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
          This file doesn't exist yet — saving will create it.
        </p>
      )}

      <div className="flex items-center gap-2">
        <p className="text-xs text-slate-600 font-mono flex-1 min-w-0 truncate">{file.path}</p>
        <button
          onClick={() => RevealInFinder(file.path)}
          title="Reveal in Finder"
          className="p-1 rounded-md transition-colors cursor-pointer text-slate-600 hover:text-slate-400 hover:bg-white/5 shrink-0"
        >
          <FolderOpen className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/5">
        <CodeMirror
          value={editorContent}
          height="100%"
          extensions={[json()]}
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
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage({ activeProject }: { activeProject: projects.Project | null }) {
  const projectPath = activeProject?.is_global ? '' : (activeProject?.real_path ?? '')
  const { data } = useSettings(projectPath)
  const [activeLayer, setActiveLayer] = useState<string>('global')

  const globalFile = data?.find(f => f.layer === 'global') ?? null
  const projectFile = data?.find(f => f.layer === 'project') ?? null
  const localFile = data?.find(f => f.layer === 'local') ?? null

  const hasProjectLayers = Boolean(projectFile)

  const fileByLayer: Record<string, settings.SettingsFile | null> = {
    global: globalFile,
    project: projectFile,
    local: localFile,
  }
  const activeFile = fileByLayer[activeLayer] ?? null

  // When project changes, default to global tab
  useEffect(() => {
    setActiveLayer('global')
  }, [projectPath])

  if (!data) {
    return <p className="text-sm text-slate-600">Loading…</p>
  }

  type Tab = { id: string; label: string; description: string }
  const tabs: Tab[] = [
    { id: 'global', label: 'Global', description: '~/.claude/settings.json' },
    ...(hasProjectLayers ? [
      { id: 'project', label: 'Project', description: '.claude/settings.json (shared)' },
      { id: 'local', label: 'Local', description: '.claude/settings.local.json (gitignored)' },
    ] : []),
  ]

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* Layer tabs */}
      <div className="flex gap-1 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveLayer(tab.id)}
            title={tab.description}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border-0 outline-none
              ${activeLayer === tab.id
                ? 'bg-blue-500/15 text-blue-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      {activeFile ? (
        <EditorPanel key={activeFile.path} file={activeFile} />
      ) : (
        <p className="text-sm text-slate-600">No settings file found.</p>
      )}
    </div>
  )
}
