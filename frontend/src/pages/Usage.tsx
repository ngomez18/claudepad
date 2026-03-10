import { useState, useMemo } from 'react'
import { Layers, MessageSquare, Zap, Bot, BarChart3 } from 'lucide-react'
import { useUsageStats } from '@/hooks/useUsageStats'
import type { usage } from '../../wailsjs/go/models'

export type StatsCache = usage.StatsCache

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatModelName(model: string): string {
  const parts = model.split('-').filter(p => p !== 'claude' && !/^\d{8}$/.test(p))
  if (parts.length === 0) return model
  const family = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  const version = parts.slice(1).join('.')
  return version ? `${family} ${version}` : family
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function fmtFull(n: number): string {
  return n.toLocaleString()
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function fmtFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const month = d.toLocaleDateString('en-US', { month: 'long' })
  const year = d.getFullYear()
  return `${month} ${ordinal(d.getDate())}, ${year}`
}

function getLast30Days(dailyActivity: StatsCache['dailyActivity']) {
  const lookup = new Map(dailyActivity.map(d => [d.date, d]))
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const date = d.toISOString().split('T')[0]
    return lookup.get(date) ?? { date, messageCount: 0, sessionCount: 0, toolCallCount: 0 }
  })
}

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  accent?: string
}

function StatCard({ icon: Icon, label, value, sub, accent = 'text-blue-400' }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#161b27] border border-white/5 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold tracking-widest uppercase text-slate-500">
          {label}
        </span>
        <div className={`${accent} opacity-60`}>
          <Icon className="size-3.5" />
        </div>
      </div>

      <div className={`font-mono text-3xl font-bold tracking-tight ${accent === 'text-blue-400' ? 'text-slate-100' : accent}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {typeof value === 'number' ? fmt(value) : value}
      </div>

      {sub && (
        <div className="text-[12px] text-slate-600 font-medium">{sub}</div>
      )}

      {/* subtle corner glow */}
      <div className={`absolute -bottom-4 -right-4 size-16 rounded-full blur-2xl opacity-10 bg-blue-500`} />
    </div>
  )
}

// ── Activity Chart ────────────────────────────────────────────────────────────

function ActivityChart({ data }: { data: ReturnType<typeof getLast30Days> }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const maxVal = Math.max(...data.map(d => d.messageCount), 1)

  // Show month labels at the start of each month
  const monthLabels = useMemo(() => {
    const labels: { idx: number; label: string }[] = []
    let lastMonth = ''
    data.forEach((d, i) => {
      const m = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })
      if (m !== lastMonth) {
        labels.push({ idx: i, label: m })
        lastMonth = m
      }
    })
    return labels
  }, [data])

  return (
    <div className="rounded-xl bg-[#161b27] border border-white/5 p-5">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[12px] font-semibold tracking-widest uppercase text-slate-500">
          Daily Activity
        </span>
        <span className="text-[12px] text-slate-600">last 30 days · messages</span>
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="w-full h-px bg-white/[0.03]" />
          ))}
        </div>

        {/* Bars */}
        <div className="flex items-end gap-px h-28 pb-0">
          {data.map((day, i) => {
            const pct = maxVal > 0 ? (day.messageCount / maxVal) * 100 : 0
            const isHovered = hoveredIdx === i
            const hasData = day.messageCount > 0

            return (
              <div
                key={day.date}
                className="relative flex-1 flex flex-col justify-end cursor-crosshair"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap shadow-xl">
                      <div className="text-slate-500 text-[11px] mb-0.5">{fmtDate(day.date)}</div>
                      <div className="text-slate-200 font-mono font-semibold">
                        {day.messageCount.toLocaleString()} msgs
                      </div>
                      {day.sessionCount > 0 && (
                        <div className="text-slate-600 text-[11px]">{day.sessionCount} sessions</div>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`w-full rounded-t-[2px] transition-colors duration-100 ${
                    !hasData
                      ? 'bg-white/[0.03]'
                      : isHovered
                      ? 'bg-blue-400'
                      : 'bg-blue-500/40'
                  }`}
                  style={{ height: hasData ? `${Math.max(pct, 3)}%` : '2px' }}
                />
              </div>
            )
          })}
        </div>

        {/* Month labels */}
        <div className="relative h-5 mt-1">
          {monthLabels.map(({ idx, label }) => (
            <span
              key={label}
              className="absolute text-[11px] text-slate-600 font-medium"
              style={{ left: `${(idx / 30) * 100}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Model Table ───────────────────────────────────────────────────────────────

function ModelTable({ modelUsage }: { modelUsage: StatsCache['modelUsage'] }) {
  const rows = useMemo(
    () =>
      Object.entries(modelUsage)
        .map(([model, usage]) => ({
          model,
          displayName: formatModelName(model),
          total: usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens,
          ...usage,
        }))
        .sort((a, b) => b.total - a.total),
    [modelUsage]
  )

  if (rows.length === 0) return null

  return (
    <div className="rounded-xl bg-[#161b27] border border-white/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <span className="text-[12px] font-semibold tracking-widest uppercase text-slate-500">
          Model Breakdown
        </span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            {['Model', 'Input', 'Output', 'Cache Read', 'Cache Create'].map(h => (
              <th
                key={h}
                className="px-5 py-3 text-left text-[12px] font-semibold tracking-wider text-slate-600 uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.model}
              className={`border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors ${
                i % 2 === 0 ? '' : 'bg-white/[0.01]'
              }`}
            >
              <td className="px-5 py-3.5">
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-blue-400/60 shrink-0" />
                  <span className="text-slate-300 font-medium">{row.displayName}</span>
                </span>
              </td>
              <td className="px-5 py-3.5 font-mono text-[14px] text-slate-400" title={fmtFull(row.inputTokens)}>
                {fmt(row.inputTokens)}
              </td>
              <td className="px-5 py-3.5 font-mono text-[14px] text-blue-300" title={fmtFull(row.outputTokens)}>
                {fmt(row.outputTokens)}
              </td>
              <td className="px-5 py-3.5 font-mono text-[14px] text-emerald-400/80" title={fmtFull(row.cacheReadInputTokens)}>
                {fmt(row.cacheReadInputTokens)}
              </td>
              <td className="px-5 py-3.5 font-mono text-[14px] text-amber-400/80" title={fmtFull(row.cacheCreationInputTokens)}>
                {fmt(row.cacheCreationInputTokens)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <BarChart3 className="size-8 text-slate-700" />
      <p className="text-slate-600 text-sm">No usage data found</p>
      <p className="text-slate-700 text-sm">Start a Claude Code session to see stats here</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const { data, isLoading, isError } = useUsageStats()

  if (isLoading) return <EmptyState />
  if (isError) return <p className="text-sm text-red-400/70">Failed to load usage stats</p>
  if (!data) return <EmptyState />

  const totalTokens = Object.values(data.modelUsage).reduce(
    (sum, m) =>
      sum + m.inputTokens + m.outputTokens + m.cacheReadInputTokens + m.cacheCreationInputTokens,
    0
  )

  const mostUsedModel =
    Object.entries(data.modelUsage).sort(
      (a, b) => b[1].inputTokens + b[1].outputTokens - (a[1].inputTokens + a[1].outputTokens)
    )[0]?.[0] ?? '—'

  const last30 = getLast30Days(data.dailyActivity)

  const firstDate = data.firstSessionDate
    ? new Date(data.firstSessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : undefined

  const isStale = data.lastComputedDate !== new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col gap-6">
      {/* Last computed badge */}
      <div className="flex items-center gap-1.5 self-start">
        <div className="relative group">
          <div className={`size-2 rounded-full ${isStale ? 'bg-orange-500' : 'bg-green-500'}`} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-[#0f1117] border border-white/10 text-[12px] whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            {isStale
              ? <span className="text-orange-400">Stale — Claude Code hasn't run today</span>
              : <span className="text-green-400">Up to date</span>
            }
          </div>
        </div>
        <span className="text-[12px] text-slate-600">
          Last computed {fmtFullDate(data.lastComputedDate)}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Layers}
          label="Sessions"
          value={data.totalSessions}
          sub={firstDate ? `since ${firstDate}` : undefined}
        />
        <StatCard
          icon={MessageSquare}
          label="Messages"
          value={data.totalMessages}
        />
        <StatCard
          icon={Zap}
          label="Total Tokens"
          value={totalTokens}
        />
        <StatCard
          icon={Bot}
          label="Top Model"
          value={formatModelName(mostUsedModel)}
          accent="text-blue-400"
        />
      </div>

      {/* Activity chart */}
      <ActivityChart data={last30} />

      {/* Model table */}
      <ModelTable modelUsage={data.modelUsage} />

    </div>
  )
}
