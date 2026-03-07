import { useState, useEffect } from 'react'
import {
  ClipboardList,
  MessageSquare,
  Settings,
  Brain,
  Webhook,
  Terminal,
  BarChart2,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import PlansPage from './pages/Plans'
import UsagePage from './pages/Usage'
import { GetPlans, GetUsageStats } from '../wailsjs/go/main/App'
import { EventsOn } from '../wailsjs/runtime/runtime'
import type { plans, usage } from '../wailsjs/go/models'

interface NavItem {
  id: string
  label: string
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { id: 'plans',    label: 'Plans',    Icon: ClipboardList },
  { id: 'sessions', label: 'Sessions', Icon: MessageSquare },
  { id: 'settings', label: 'Settings', Icon: Settings },
  { id: 'skills',   label: 'Skills',   Icon: Brain },
  { id: 'hooks',    label: 'Hooks',    Icon: Webhook },
  { id: 'commands', label: 'Commands', Icon: Terminal },
  { id: 'usage',    label: 'Usage',    Icon: BarChart2 },
]

function Sidebar({ active, onNavigate, project, onProjectChange }: {
  active: string
  onNavigate: (id: string) => void
  project: string
  onProjectChange: (p: string) => void
}) {
  return (
    <aside className="flex flex-col w-55 shrink-0 h-screen bg-[#161b27] border-r border-white/5 py-5">
      <div className="px-5 pb-4 text-[15px] font-semibold tracking-tight text-slate-100">
        Claudepad
      </div>

      <div className="px-3">
        <div className="relative">
          <select
            value={project}
            onChange={e => onProjectChange(e.target.value)}
            className="w-full appearance-none bg-white/5 border border-white/8 rounded-md px-3 py-1.5 pr-8 text-[13px] text-slate-300 cursor-pointer outline-none hover:bg-white/8 focus:ring-1 focus:ring-white/20 transition-colors"
          >
            <option value="global">Global</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
        </div>
      </div>

      <div className="my-4 h-px bg-white/5" />

      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors text-left cursor-pointer border-0 outline-none
              ${active === id
                ? 'bg-blue-500/15 text-blue-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

function usePlans() {
  const [data, setData] = useState<plans.Plan[] | null>(null)

  const fetch = () => GetPlans().then(setData).catch(() => setData([]))

  useEffect(() => {
    fetch()
    const off = EventsOn('plans:updated', fetch)
    return off
  }, [])

  return { data, refresh: fetch }
}

function useUsageStats() {
  const [data, setData] = useState<usage.StatsCache | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = () => GetUsageStats().then(setData).catch(err => setError(String(err)))
    fetch()
    const off = EventsOn('usage:stats-updated', fetch)
    return off
  }, [])

  return { data, error }
}

function PageContent({ section, project }: { section: string; project: string }) {
  const item = NAV_ITEMS.find(n => n.id === section)
  const { data: plansData, refresh: refreshPlans } = usePlans()
  const { data: usageData, error: usageError } = useUsageStats()

  const isEdgeToEdge = section === 'plans'

  return (
    <main className={`flex-1 flex flex-col overflow-hidden bg-[#0f1117] ${isEdgeToEdge ? '' : 'p-10 overflow-y-auto'}`}>
      {!isEdgeToEdge && (
        <div className="flex items-baseline gap-3 mb-8">
          <h1 className="text-[22px] font-bold text-slate-100 m-0">{item?.label}</h1>
          <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">
            {project === 'global' ? 'Global' : project}
          </span>
        </div>
      )}

      {section === 'plans' ? (
        <PlansPage plans={plansData} onRefresh={refreshPlans} />
      ) : section === 'usage' ? (
        usageError
          ? <p className="text-sm text-red-400/70">{usageError}</p>
          : <UsagePage data={usageData} />
      ) : (
        <p className="text-sm text-slate-600">{item?.label} content goes here.</p>
      )}
    </main>
  )
}

export default function App() {
  const [activeSection, setActiveSection] = useState('plans')
  const [project, setProject] = useState('global')

  return (
    <div className="flex h-screen overflow-hidden dark">
      <Sidebar
        active={activeSection}
        onNavigate={setActiveSection}
        project={project}
        onProjectChange={setProject}
      />
      <PageContent section={activeSection} project={project} />
    </div>
  )
}
