import { useState, useEffect, useRef } from 'react'
import MarkdownView from '@/components/MarkdownView'
import SearchableContent from '@/components/SearchableContent'
import { MessageSquare, RotateCcw, GitBranch, Clock, Hash, Wrench } from 'lucide-react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useSessions } from '@/hooks/useSessions'
import { useTranscript } from '@/hooks/useTranscript'
import { relativeTime } from '@/lib/utils'
import type { sessions, projects } from '../../wailsjs/go/models'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

// Decode the encoded project path to a human-friendly name.
// e.g. "-Users-ngomez-code-claudepad" → "claudepad"
function decodeProjectName(encoded: string): string {
  const decoded = encoded.replace(/^-/, '/').replace(/-/g, '/')
  const parts = decoded.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? encoded
}

function sessionLabel(s: sessions.Session): string {
  return s.slug || s.snippet || s.sessionId.slice(0, 8)
}

// ── Session list ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  selected,
  onClick,
}: {
  session: sessions.Session
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
      {/* Slug or snippet */}
      <div className={`text-[15px] font-medium leading-snug truncate mb-1 ${
        selected ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-200'
      }`}>
        {sessionLabel(session)}
      </div>

      {/* Snippet (shown only when slug is the primary label and snippet exists) */}
      {!!session.slug && !!session.snippet && (
        <div className="text-[12px] text-slate-500 leading-snug truncate mb-1">
          {session.snippet}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-slate-600 font-mono">
          {decodeProjectName(session.projectPath)}
        </span>
        {session.gitBranch && (
          <span className="flex items-center gap-1 text-[11px] text-slate-600 bg-white/4 px-1.5 py-0.5 rounded">
            <GitBranch className="size-2.5" />
            {session.gitBranch}
          </span>
        )}
        {session.messageCount > 0 && (
          <span className="text-[11px] text-slate-700 tabular-nums">
            {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
          </span>
        )}
        <span className="text-[12px] text-slate-600 ml-auto">
          {relativeTime(session.startedAt)}
        </span>
      </div>
    </button>
  )
}

// ── Transcript viewer ─────────────────────────────────────────────────────────

function TranscriptView({
  session,
  transcript,
  loading,
}: {
  session: sessions.Session
  transcript: sessions.TranscriptMessage[] | null
  loading: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [transcript])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <div className="text-[15px] font-semibold text-slate-100 leading-snug truncate mb-1.5">
          {sessionLabel(session)}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {session.cwd && (
            <span className="text-[12px] text-slate-600 font-mono truncate max-w-[240px]" title={session.cwd}>
              {session.cwd}
            </span>
          )}
          {session.gitBranch && (
            <span className="flex items-center gap-1 text-[11px] text-slate-600">
              <GitBranch className="size-3" />
              {session.gitBranch}
            </span>
          )}
          {session.durationSecs > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-600">
              <Clock className="size-3" />
              {formatDuration(session.durationSecs)}
            </span>
          )}
          {session.messageCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-600">
              <Hash className="size-3" />
              {session.messageCount} messages
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <SearchableContent className="flex-1 overflow-y-auto" innerClassName="px-4 py-4" contentKey={session.sessionId}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[14px] text-slate-600">Loading…</p>
          </div>
        ) : !transcript || transcript.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[14px] text-slate-600">No messages</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {transcript.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </SearchableContent>
    </div>
  )
}

function MessageBubble({ msg }: { msg: sessions.TranscriptMessage }) {
  const isUser = msg.role === 'user'
  const time = msg.timestamp ? relativeTime(msg.timestamp) : null

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
      {isUser ? (
        <div className="bg-white/5 rounded-xl rounded-tr-sm px-3.5 py-2.5 break-words">
          <MarkdownView content={msg.text} />
        </div>
      ) : (
        <>
          {msg.text && (
            <div className="px-1 w-full">
              <MarkdownView content={msg.text} />
            </div>
          )}
          {msg.tools && msg.tools.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap px-1 mt-0.5">
              <Wrench className="size-3 text-slate-600 shrink-0" />
              {msg.tools.map((tool, i) => (
                <span
                  key={i}
                  className="bg-white/[0.04] text-slate-500 text-[12px] px-2 py-0.5 rounded-full font-mono"
                >
                  {tool}
                </span>
              ))}
            </div>
          )}
        </>
      )}
      {time && (
        <span className="text-[11px] text-slate-700 px-1">{time}</span>
      )}
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function NoSelection() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <MessageSquare className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">Select a session to view its transcript</p>
    </div>
  )
}

function EmptyList({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
      <MessageSquare className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">
        {loading ? 'Loading…' : 'No sessions found'}
      </p>
      {!loading && (
        <p className="text-[12px] text-slate-700">
          Sessions appear here after using Claude Code
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionsPage({
  activeProject,
}: {
  activeProject: projects.Project | null
}) {
  const { data: sessionList, isLoading, refetch } = useSessions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  // When project changes, clear selected session.
  useEffect(() => { setSelectedId(null) }, [activeProject?.id])

  // Filter by active project (client-side).
  const projectFiltered = activeProject?.is_global
    ? sessionList
    : sessionList?.filter(s => s.projectPath === activeProject?.encoded_name) ?? null

  const selected = projectFiltered?.find(s => s.sessionId === selectedId) ?? null

  const { data: transcript, isLoading: loadingTranscript } = useTranscript(
    selected?.projectPath ?? '',
    selectedId
  )

  function handleSelect(session: sessions.Session) {
    if (session.sessionId === selectedId) return
    setSelectedId(session.sessionId)
  }

  const filterLower = filter.toLowerCase()
  const filtered = projectFiltered?.filter(s => {
    if (!filter) return true
    return (
      s.slug.toLowerCase().includes(filterLower) ||
      s.snippet.toLowerCase().includes(filterLower) ||
      s.cwd.toLowerCase().includes(filterLower)
    )
  }) ?? null

  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      {/* List panel */}
      <Panel defaultSize="300px" minSize="200px" maxSize="60%" className="flex flex-col border-r border-white/5 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[12px] font-semibold tracking-widest uppercase text-slate-500">
            Sessions
          </span>
          <button
            onClick={() => refetch()}
            className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RotateCcw className="size-3" />
          </button>
        </div>

        {/* Filter */}
        <div className="px-3 py-2 border-b border-white/4 shrink-0">
          <input
            type="text"
            placeholder="Filter sessions…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full bg-white/4 border border-white/6 rounded-md px-3 py-1.5 text-[13px] text-slate-300 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-white/15 transition-colors"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {!filtered || filtered.length === 0 ? (
            <EmptyList loading={isLoading} />
          ) : (
            filtered.map(session => (
              <SessionRow
                key={session.sessionId}
                session={session}
                selected={selectedId === session.sessionId}
                onClick={() => handleSelect(session)}
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
        {selected ? (
          <TranscriptView
            session={selected}
            transcript={transcript ?? null}
            loading={loadingTranscript}
          />
        ) : (
          <NoSelection />
        )}
      </Panel>
    </PanelGroup>
  )
}
