import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Server, Zap } from 'lucide-react'
import { GetMcpServers, SetMcpServers } from '@/lib/api'
import { useKeyboardSave } from '@/hooks/useKeyboardSave'
import type { McpServerConfig } from '@/lib/types'

type McpServer = McpServerConfig

// ── Helpers ──────────────────────────────────────────────────────────────────

function useMcpServers() {
  return useQuery({
    queryKey: ['mcp-servers'],
    queryFn: GetMcpServers,
  })
}


// ── Server card ───────────────────────────────────────────────────────────────

function ServerCard({ name, config, onDelete, onUpdate }: {
  name: string
  config: McpServer
  onDelete: () => void
  onUpdate: (c: McpServer) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(JSON.stringify(config, null, 2))
  const [parseErr, setParseErr] = useState('')

  useKeyboardSave(handleSave, editing)
  function handleSave() {
    try {
      const parsed = JSON.parse(draft)
      onUpdate(parsed)
      setEditing(false)
      setParseErr('')
    } catch (e) {
      setParseErr(String(e))
    }
  }

  const inputClass = "w-full bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/40"

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Server className="size-4 text-slate-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-slate-200 truncate">{name}</p>
            <p className="text-[12px] text-slate-600 truncate font-mono">
              {config.type} · {config.command || config.url || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEditing(e => !e)}
            className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-white/5"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={onDelete}
            title="Remove server"
            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer rounded-md"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={8}
            className={`${inputClass} resize-y font-mono text-[12px]`}
          />
          {parseErr && <p className="text-[12px] text-red-400">{parseErr}</p>}
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-[13px] text-blue-300 hover:bg-blue-500/30 transition-colors cursor-pointer"
          >
            Save
          </button>
        </div>
      )}
    </div>
  )
}

// ── Add server dialog ─────────────────────────────────────────────────────────

function AddServerForm({ onAdd }: { onAdd: (name: string, config: McpServer) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'stdio' | 'http'>('stdio')
  const [command, setCommand] = useState('')
  const [url, setUrl] = useState('')

  function handleAdd() {
    if (!name.trim()) return
    const config: McpServer = {
      type,
      command: type === 'stdio' ? command : '',
      args: [],
      url: type !== 'stdio' ? url : '',
      headers: {},
    }
    onAdd(name.trim(), config)
    setName(''); setCommand(''); setUrl('')
  }

  const inputClass = "w-full bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5 text-[13px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/40"
  const labelClass = "text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5 block"

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-4 space-y-3">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">Add server</p>
      <div>
        <label className={labelClass}>Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="my-server" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Type</label>
        <div className="flex gap-2">
          {(['stdio', 'http'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-md text-[12px] transition-colors cursor-pointer ${
                type === t ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300' : 'bg-white/5 border border-white/8 text-slate-400 hover:bg-white/8'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {type === 'stdio' ? (
        <div>
          <label className={labelClass}>Command</label>
          <input type="text" value={command} onChange={e => setCommand(e.target.value)} placeholder="/path/to/binary" className={inputClass} />
        </div>
      ) : (
        <div>
          <label className={labelClass}>URL</label>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className={inputClass} />
        </div>
      )}
      <button
        onClick={handleAdd}
        disabled={!name.trim()}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-[13px] text-blue-300 hover:bg-blue-500/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="size-3.5" />
        Add
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function McpServersPage() {
  const queryClient = useQueryClient()
  const { data: servers, isLoading } = useMcpServers()
  const [showAdd, setShowAdd] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function persist(updated: Record<string, McpServer>) {
    setSaveError('')
    try {
      await SetMcpServers(updated)
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
    } catch (e) {
      setSaveError(String(e))
    }
  }

  async function handleDelete(name: string) {
    const updated = { ...(servers ?? {}) }
    delete updated[name]
    await persist(updated)
  }

  async function handleUpdate(name: string, config: McpServer) {
    await persist({ ...(servers ?? {}), [name]: config })
  }

  async function handleAdd(name: string, config: McpServer) {
    await persist({ ...(servers ?? {}), [name]: config })
    setShowAdd(false)
  }

  const builtInEntry = servers?.['claudepad']
  const userServers = Object.entries(servers ?? {}).filter(([name]) => name !== 'claudepad')

  return (
    <div className="space-y-8">
      {/* Built-in server status */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <Zap className="size-4 text-emerald-400 shrink-0" />
          <p className="text-[14px] font-semibold text-slate-200">Claudepad MCP server — running</p>
        </div>
        <p className="text-[13px] text-slate-500 mb-3 ml-7">
          The MCP server starts automatically with Claudepad and is pre-configured in{' '}
          <code className="font-mono text-slate-400">~/.claude.json</code>. Use{' '}
          <code className="font-mono text-slate-400">save_note</code> in any Claude Code session.
        </p>
        {builtInEntry?.url && (
          <p className="text-[12px] font-mono text-slate-600 ml-7">{builtInEntry.url}</p>
        )}
      </div>

      {/* User-added servers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-slate-500">
            Other servers
          </h2>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] bg-white/5 border border-white/8 text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
            Add server
          </button>
        </div>

        {saveError && (
          <p className="mb-3 text-[13px] text-red-400">{saveError}</p>
        )}

        <div className="space-y-2">
          {isLoading ? (
            <p className="text-[14px] text-slate-600">Loading…</p>
          ) : userServers.length === 0 ? (
            <p className="text-[14px] text-slate-600">No other MCP servers configured.</p>
          ) : (
            userServers.map(([name, config]) => (
              <ServerCard
                key={name}
                name={name}
                config={config}
                onDelete={() => handleDelete(name)}
                onUpdate={c => handleUpdate(name, c)}
              />
            ))
          )}
        </div>

        {showAdd && (
          <div className="mt-2">
            <AddServerForm onAdd={handleAdd} />
          </div>
        )}
      </div>
    </div>
  )
}
