import { useState, useEffect } from 'react'
import { FolderOpen, Eye, Code2 } from 'lucide-react'
import MarkdownView from '@/components/MarkdownView'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
import { UpdateSettings, UpdateClaudeMd, RevealInFinder } from '@/lib/api'
import { useSettings } from '@/hooks/useSettings'
import { useClaudeMd } from '@/hooks/useClaudeMd'
import { useKeyboardSave } from '@/hooks/useKeyboardSave'
import type { settings, claudemd } from '../../wailsjs/go/models'
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

type EditorFile = { path: string; content: string; exists: boolean }

function EditorPanel({ file, language, onSave }: {
  file: EditorFile
  language: 'json' | 'markdown'
  onSave: (path: string, content: string) => Promise<void>
}) {
  const [editorContent, setEditorContent] = useState(file.content)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [viewMode, setViewMode] = useState<'edit' | 'rendered'>('edit')

  useEffect(() => {
    setEditorContent(file.content)
    setStatus({ kind: 'idle' })
    setViewMode('edit')
  }, [file.path, file.content])

  async function handleSave() {
    setStatus({ kind: 'saving' })
    try {
      await onSave(file.path, editorContent)
      setStatus({ kind: 'saved' })
      setTimeout(() => setStatus({ kind: 'idle' }), 2000)
    } catch (err) {
      setStatus({ kind: 'error', msg: String(err) })
    }
  }

  const isDirty = editorContent !== file.content
  useKeyboardSave(handleSave, isDirty && (language === 'json' || viewMode === 'edit'))
  const extensions = language === 'json' ? [json()] : [markdown(), EditorView.lineWrapping]

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {!file.exists && (
        <p className="text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
          This file doesn't exist yet — saving will create it.
        </p>
      )}

      <div className="flex items-center gap-2">
        <p className="text-xs text-slate-600 font-mono flex-1 min-w-0 truncate">{file.path}</p>
        {file.exists && (
          <button
            onClick={() => RevealInFinder(file.path)}
            title="Reveal in Finder"
            className="p-1 rounded-md transition-colors cursor-pointer text-slate-600 hover:text-slate-400 hover:bg-white/5 shrink-0"
          >
            <FolderOpen className="size-3.5" />
          </button>
        )}
        {language === 'markdown' && (
          <div className="flex items-center gap-0.5 bg-white/4 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('rendered')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] transition-colors ${
                viewMode === 'rendered' ? 'bg-white/10 text-slate-200' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Eye className="size-3" />
              Preview
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] transition-colors ${
                viewMode === 'edit' ? 'bg-white/10 text-slate-200' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Code2 className="size-3" />
              Edit
            </button>
          </div>
        )}
      </div>

      {language === 'markdown' && viewMode === 'rendered' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <MarkdownView content={editorContent} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/5">
          <CodeMirror
            value={editorContent}
            height="100%"
            extensions={extensions}
            theme={oneDark}
            basicSetup={{ lineNumbers: true, bracketMatching: true }}
            onChange={setEditorContent}
            style={{ height: '100%' }}
          />
        </div>
      )}

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

// ── Settings JSON section ─────────────────────────────────────────────────────

function SettingsJsonSection({ projectPath }: { projectPath: string }) {
  const { data } = useSettings(projectPath)
  const [activeLayer, setActiveLayer] = useState<string>('global')

  const globalFile = data?.find((f: settings.SettingsFile) => f.layer === 'global') ?? null
  const projectFile = data?.find((f: settings.SettingsFile) => f.layer === 'project') ?? null
  const localFile = data?.find((f: settings.SettingsFile) => f.layer === 'local') ?? null

  const hasProjectLayers = Boolean(projectFile)

  const fileByLayer: Record<string, settings.SettingsFile | null> = {
    global: globalFile,
    project: projectFile,
    local: localFile,
  }
  const activeFile = fileByLayer[activeLayer] ?? null

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
    <div className="flex flex-col flex-1 min-h-0 gap-4">
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

      {activeFile ? (
        <EditorPanel
          key={activeFile.path}
          file={activeFile}
          language="json"
          onSave={UpdateSettings}
        />
      ) : (
        <p className="text-sm text-slate-600">No settings file found.</p>
      )}
    </div>
  )
}

// ── CLAUDE.md section ─────────────────────────────────────────────────────────

function ClaudeMdSection({ projectPath }: { projectPath: string }) {
  const { data } = useClaudeMd(projectPath)
  const [activeLayer, setActiveLayer] = useState<string>('global')

  const globalFile = data?.find((f: claudemd.ClaudeMdFile) => f.layer === 'global') ?? null
  const projectFile = data?.find((f: claudemd.ClaudeMdFile) => f.layer === 'project') ?? null

  const hasProjectLayer = Boolean(projectFile)

  const fileByLayer: Record<string, claudemd.ClaudeMdFile | null> = {
    global: globalFile,
    project: projectFile,
  }
  const activeFile = fileByLayer[activeLayer] ?? null

  useEffect(() => {
    setActiveLayer('global')
  }, [projectPath])

  if (!data) {
    return <p className="text-sm text-slate-600">Loading…</p>
  }

  type Tab = { id: string; label: string; description: string }
  const tabs: Tab[] = [
    { id: 'global', label: 'Global', description: '~/.claude/CLAUDE.md' },
    ...(hasProjectLayer ? [
      { id: 'project', label: 'Project', description: '<project-root>/CLAUDE.md' },
    ] : []),
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
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

      {activeFile ? (
        <EditorPanel
          key={activeFile.path}
          file={activeFile}
          language="markdown"
          onSave={UpdateClaudeMd}
        />
      ) : (
        <p className="text-sm text-slate-600">No CLAUDE.md file found.</p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Section = 'settings' | 'claudemd'

export default function SettingsPage({ activeProject }: { activeProject: projects.Project | null }) {
  const projectPath = activeProject?.is_global ? '' : (activeProject?.real_path ?? '')
  const [section, setSection] = useState<Section>('settings')

  const sectionTabs: { id: Section; label: string }[] = [
    { id: 'settings', label: 'settings.json' },
    { id: 'claudemd', label: 'CLAUDE.md' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* Section toggle */}
      <div className="flex gap-1 shrink-0 border-b border-white/5 pb-3">
        {sectionTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium font-mono transition-colors cursor-pointer border-0 outline-none
              ${section === tab.id
                ? 'bg-white/8 text-slate-200'
                : 'text-slate-600 hover:text-slate-400 hover:bg-white/5'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {section === 'settings'
        ? <SettingsJsonSection projectPath={projectPath} />
        : <ClaudeMdSection projectPath={projectPath} />
      }
    </div>
  )
}
