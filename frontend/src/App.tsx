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
  Plus,
  type LucideIcon,
} from 'lucide-react'
import PlansPage from './pages/Plans'
import UsagePage from './pages/Usage'
import SessionsPage from './pages/Sessions'
import { GetPlans, GetUsageStats, GetSessions, GetProjects, AddProject, PickProjectDir } from '../wailsjs/go/main/App'
import { EventsOn } from '../wailsjs/runtime/runtime'
import type { plans, usage, sessions, projects } from '../wailsjs/go/models'

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

function Sidebar({ active, onNavigate, projectId, onProjectChange, projectList }: {
  active: string
  onNavigate: (id: string) => void
  projectId: string
  onProjectChange: (id: string) => void
  projectList: projects.Project[] | null
}) {
  async function handleAddProject() {
    const path = await PickProjectDir()
    if (!path) return
    await AddProject(path)
  }

  return (
    <aside className="flex flex-col w-48 shrink-0 h-screen bg-[#161b27] border-r border-white/5 py-5">
      <div className="px-5 pb-4 text-[16px] font-semibold tracking-tight text-slate-100">
        Claudepad
      </div>

      <div className="px-3">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <select
              value={projectId}
              onChange={e => onProjectChange(e.target.value)}
              className="w-full appearance-none bg-white/5 border border-white/8 rounded-md px-3 py-1.5 pr-8 text-[14px] text-slate-300 cursor-pointer outline-none hover:bg-white/8 focus:ring-1 focus:ring-white/20 transition-colors"
            >
              {projectList?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              )) ?? <option value="">Loading…</option>}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
          </div>
          <button
            onClick={handleAddProject}
            title="Add project"
            className="shrink-0 size-[30px] flex items-center justify-center rounded-md bg-white/5 border border-white/8 text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="my-4 h-px bg-white/5" />

      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[15px] font-medium transition-colors text-left cursor-pointer border-0 outline-none
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

function useProjects() {
  const [data, setData] = useState<projects.Project[] | null>(null)

  useEffect(() => {
    const fetch = () => GetProjects().then(setData).catch(() => setData([]))
    fetch()
    const off = EventsOn('projects:updated', fetch)
    return off
  }, [])

  return data
}

function useSessions() {
  const [data, setData] = useState<sessions.Session[] | null>(null)

  const fetch = () => GetSessions().then(setData).catch(() => setData([]))

  useEffect(() => {
    fetch()
    const off = EventsOn('sessions:updated', fetch)
    return off
  }, [])

  return { data, refresh: fetch }
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

function PageContent({ section, activeProject }: { section: string; activeProject: projects.Project | null }) {
  const item = NAV_ITEMS.find(n => n.id === section)
  const { data: plansData, refresh: refreshPlans } = usePlans()
  const { data: sessionsData, refresh: refreshSessions } = useSessions()
  const { data: usageData, error: usageError } = useUsageStats()

  const isEdgeToEdge = section === 'plans' || section === 'sessions'

  return (
    <main className={`flex-1 flex flex-col overflow-hidden bg-[#0f1117] ${isEdgeToEdge ? '' : 'p-10 overflow-y-auto'}`}>
      {!isEdgeToEdge && (
        <div className="flex items-baseline gap-3 mb-8">
          <h1 className="text-[24px] font-bold text-slate-100 m-0">{item?.label}</h1>
          <span className="text-sm text-slate-500 bg-white/5 px-2 py-0.5 rounded">
            {activeProject?.name ?? 'Global'}
          </span>
        </div>
      )}

      {section === 'plans' ? (
        <PlansPage plans={plansData} onRefresh={refreshPlans} />
      ) : section === 'sessions' ? (
        <SessionsPage sessions={sessionsData} onRefresh={refreshSessions} activeProject={activeProject} />
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
  const [projectId, setProjectId] = useState<string>('')
  const projectList = useProjects()

  // Default to the global project (first in the list) once loaded.
  useEffect(() => {
    if (!projectId && projectList && projectList.length > 0) {
      setProjectId(projectList[0].id)
    }
  }, [projectList, projectId])

  const activeProject = projectList?.find(p => p.id === projectId) ?? null

  return (
    <div className="flex h-screen overflow-hidden dark">
      <Sidebar
        active={activeSection}
        onNavigate={setActiveSection}
        projectId={projectId}
        onProjectChange={setProjectId}
        projectList={projectList}
      />
      <PageContent section={activeSection} activeProject={activeProject} />
    </div>
  )
}
